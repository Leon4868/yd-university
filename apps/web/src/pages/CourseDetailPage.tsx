import { BookOpenCheck, Check, ChevronRight, CircleDollarSign, ExternalLink, ShieldCheck, Star, Users } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.tsx";
import { can } from "../auth/permissions.ts";
import { PanelState } from "../components/PanelState.tsx";
import { courses, formatDuration, type Course } from "../data/courses.ts";
import { approveCourse, buyCourse, InsufficientYdError, readPurchaseState } from "../web3/purchase.ts";
import { shortfallYd } from "../web3/swap.ts";
import { bumpChainRevision, getChainRevision, subscribeChainRevision } from "../web3/chainState.ts";
import { hasSepoliaContractConfig, hasSwapConfig, SEPOLIA_CHAIN_ID, sepoliaTransactionUrl } from "../web3/contracts.ts";

type PurchaseStep = "approve" | "buy" | "complete";

export function CourseDetailPage() {
  const { slug } = useParams();
  const course = courses.find((item) => item.slug === slug);
  if (!course) {
    return <div className="page-container detail-page"><PanelState tone="error" title="课程不存在" description="该课程地址无效，或课程已经下架。" action={<Link className="button secondary small" to="/">返回课程市场</Link>} /></div>;
  }
  return <CourseDetail course={course} />;
}

function CourseDetail({ course }: { course: Course }) {
  const auth = useAuth();
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("approve");
  const [busy, setBusy] = useState(false);
  const [ydBalance, setYdBalance] = useState<string | null>(null);
  // null 表示还没读到链上余额，此时不提前判定为不足
  const [sufficient, setSufficient] = useState<boolean | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approveTx, setApproveTx] = useState<string | null>(null);
  const [buyTx, setBuyTx] = useState<string | null>(null);
  // 授权/购买进行到哪一步，仅用于按钮文案
  const [stage, setStage] = useState<"approve" | "buy" | null>(null);
  const canPurchase = can(auth.role, "purchase");
  const chainRevision = useSyncExternalStore(subscribeChainRevision, getChainRevision, getChainRevision);
  // YD 不够时不替用户决定兑换数量，引导到兑换页自行决定
  const needsSwap = canPurchase && sufficient === false;
  const swapHref = `/swap?need=${encodeURIComponent(shortfallYd(ydBalance, String(course.priceYD)))}&from=${encodeURIComponent(course.slug)}`;
  useEffect(() => {
    const chainCourseId = course.chainCourseId;
    if (!chainCourseId || !auth.authenticated || !canPurchase || !auth.getEthereumProvider || !hasSepoliaContractConfig) {
      setYdBalance(null);
      setSufficient(null);
      return;
    }
    let cancelled = false;
    void auth.getEthereumProvider()
      .then((provider) => readPurchaseState(provider, chainCourseId, String(course.priceYD)))
      .then((state) => {
        if (cancelled) return;
        setYdBalance(state.balance);
        setSufficient(state.sufficient);
        setPurchaseStep(state.purchased ? "complete" : state.allowance > 0n ? "buy" : "approve");
      })
      .catch((error: unknown) => {
        if (!cancelled) setActionError(error instanceof Error ? error.message : "读取链上购买状态失败");
      });
    return () => { cancelled = true; };
  }, [auth.authenticated, auth.getEthereumProvider, canPurchase, chainRevision, course.chainCourseId, course.priceYD]);

  const actionLabel = !course.chainCourseId
    ? "课程尚未上链"
    : !hasSepoliaContractConfig
      ? "待配置 Sepolia"
      : auth.authenticated && auth.role === "admin"
        ? "管理员不可购买课程"
      : auth.demoMode
        ? "使用钱包登录后购买"
      : !auth.authenticated
        ? "登录后购买"
        : busy
          ? stage === "buy" ? "购买中…" : "等待钱包确认…"
          : purchaseStep === "approve"
            ? `授权 ${course.priceYD} YD`
            : purchaseStep === "buy"
              ? "购买课程"
              : "购买成功";

  const handlePurchase = async () => {
    if (!course.chainCourseId) return;
    if (!auth.authenticated) {
      auth.login();
      return;
    }
    if (!canPurchase) {
      setActionError("当前角色没有课程购买权限，请使用学生、教师或商家账号登录");
      return;
    }
    if (!auth.getEthereumProvider || !auth.switchEthereumChain) {
      setActionError("当前登录账号没有可用的 EVM 钱包，请使用钱包登录或先在 Privy 中连接钱包");
      return;
    }
    if (sufficient === false) {
      setActionError(`当前钱包 YD 余额不足，购买该课程需要 ${course.priceYD} YD，请先前往兑换页兑换`);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await auth.switchEthereumChain(SEPOLIA_CHAIN_ID);
      const provider = await auth.getEthereumProvider();
      // 每一步都先查链上真实状态，所以中途失败后再点一次会从断点继续，不会重复交易
      setStage("approve");
      const approveHash = await approveCourse(provider, String(course.priceYD));
      if (approveHash) setApproveTx(approveHash);
      setPurchaseStep("buy");
      setStage("buy");
      const buyHash = await buyCourse(provider, course.chainCourseId, String(course.priceYD));
      setBuyTx(buyHash);
      setPurchaseStep("complete");
      // 购买会扣减 YD 并解锁「我的学习」，通知常驻组件重新读链
      bumpChainRevision();
    } catch (error: unknown) {
      // 授权前的余额复查失败时同步 UI 状态，避免按钮仍可点
      if (error instanceof InsufficientYdError) {
        setYdBalance(error.balance);
        setSufficient(false);
      }
      setActionError(error instanceof Error ? error.message : "链上交易失败，请稍后重试");
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  return (
    <div className="page-container detail-page">
      <div className="breadcrumbs"><Link to="/">课程</Link><ChevronRight size={15} /><span>{course.category}</span><ChevronRight size={15} /><span>{course.title}</span></div>
      <div className="detail-layout">
        <div className="detail-main">
          <div className={`detail-cover ${course.tone}`}><BookOpenCheck size={68} aria-hidden="true" /><span>章节式自主学习 · 无视频或章节外链</span></div>
          <div className="detail-title"><div className="chip-row"><span className="chip">{course.level}</span><span>{course.category}</span>{course.isFree && <span>原课程免费</span>}<a className="source-link" href={course.courseUrl} target="_blank" rel="noreferrer">课程来源：{course.providerName}<ExternalLink size={13} /></a></div><h1>{course.title}</h1><p>{course.summary}</p></div>
          <div className="teacher-profile"><span className="avatar">{course.teacherName.slice(0, 1)}</span><div><strong>{course.teacherName}</strong><span>{course.providerName} 讲师</span>{course.teacherXUrl && <a className="source-link" href={course.teacherXUrl} target="_blank" rel="noreferrer">{course.teacherXHandle ?? "讲师 X 主页"}<ExternalLink size={13} /></a>}</div><div className="teacher-stats"><span><Star size={16} fill="currentColor" />{course.rating}</span><span><Users size={16} />{course.studentCount.toLocaleString()} 名学员</span></div></div>
          <section className="content-block"><h2>你将学到什么</h2><div className="learn-grid"><span><Check />理解 EVM 与 Solidity 核心语法</span><span><Check />使用 OpenZeppelin 构建安全合约</span><span><Check />编写边界、权限和攻击测试</span><span><Check />部署并在 Sepolia 验证合约</span></div></section>
          <section className="content-block"><h2>课程大纲 · {course.sections.length} 节</h2>{course.sections.map((section) => <div className="syllabus-row" key={section.position}><span>{String(section.position).padStart(2, "0")}</span><strong>{section.title}</strong><small>{formatDuration(section.durationSeconds) || section.originalTitle}</small></div>)}</section>
        </div>
        <aside className="purchase-card">
          <div className="purchase-header"><span>课程价格</span><strong>{course.priceYD} YD</strong><small>{ydBalance ? `链上余额 ${ydBalance} YD` : auth.demoMode ? "演示模式未连接链上钱包" : "连接钱包后读取余额"}</small></div>
          <div className="network-line"><span className="network-badge"><i />Ethereum Sepolia</span><ShieldCheck size={18} /></div>
          <div className="transaction-steps">
            <div className={purchaseStep !== "approve" ? "done" : "active"}><span>{purchaseStep !== "approve" ? <Check size={15} /> : "1"}</span><div><strong>授权 YD</strong><small>允许 CourseMarket 使用 {course.priceYD} YD</small></div></div>
            <div className={purchaseStep === "complete" ? "done" : purchaseStep === "buy" ? "active" : ""}><span>{purchaseStep === "complete" ? <Check size={15} /> : "2"}</span><div><strong>购买课程</strong><small>链上记录购买与分账</small></div></div>
          </div>
          {purchaseStep === "complete" && canPurchase ? <Link to={`/learn/${course.slug}`} className="button primary full">开始学习<ChevronRight size={18} /></Link>
          : needsSwap ? <Link to={swapHref} className="button primary full">YD 不足，去兑换<ChevronRight size={18} /></Link>
          : <button className="button primary full" type="button" disabled={!course.chainCourseId || !hasSepoliaContractConfig || busy || (auth.authenticated && !canPurchase) || (auth.demoMode && !auth.getEthereumProvider)} onClick={() => void handlePurchase()}>{actionLabel}<ChevronRight size={18} /></button>}
          <p className="purchase-help">{course.chainCourseId ? "授权与购买由当前登录钱包在 Ethereum Sepolia 上签名，交易确认后才能进入学习。" : "该课程还没有绑定 Sepolia CourseRegistry 课程，暂不能购买。"}</p>
          {actionError && <p className="inline-alert">{actionError}</p>}
          {approveTx && <a className="explorer-link" href={sepoliaTransactionUrl(approveTx)} target="_blank" rel="noreferrer">查看授权交易<ExternalLink size={14} /></a>}
          {buyTx && <a className="explorer-link" href={sepoliaTransactionUrl(buyTx)} target="_blank" rel="noreferrer">查看购买交易<ExternalLink size={14} /></a>}
          <div className="split-card"><div><CircleDollarSign size={18} /><strong>收益自动分配</strong></div><div className="split-bar"><i /><i /><i /></div><ul><li><span>教师 70%</span><strong>{formatShare(course.priceYD, 70)} YD</strong></li><li><span>商家 20%</span><strong>{formatShare(course.priceYD, 20)} YD</strong></li><li><span>平台 10%</span><strong>{formatShare(course.priceYD, 10)} YD</strong></li></ul></div>
          <p className="purchase-help">{!hasSwapConfig
            ? "YD 兑换尚未配置，请使用当前钱包已有的 Sepolia 测试 YD。"
            : sufficient === false
              ? `购买该课程需要 ${course.priceYD} YD，当前余额不足。可前往兑换页用 ETH 兑换任意数量的 YD，兑换完成后回到本页购买。`
              : sufficient === true
                ? "YD 余额充足，无需兑换。"
                : "连接钱包后会读取 YD 余额，不足时可用 ETH 自动兑换。"}</p>
          <a className="explorer-link" href="https://sepolia.etherscan.io" target="_blank" rel="noreferrer">在 Sepolia Explorer 查看<ExternalLink size={14} /></a>
        </aside>
      </div>
    </div>
  );
}

function formatShare(priceYD: number, percent: number) {
  return (priceYD * percent / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
