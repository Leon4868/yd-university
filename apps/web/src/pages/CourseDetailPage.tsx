import { Check, ChevronRight, CircleDollarSign, ExternalLink, Play, ShieldCheck, Star, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.tsx";
import { courses, formatDuration } from "../data/courses.ts";
import { approveCourse, buyCourse, readPurchaseState } from "../web3/purchase.ts";
import { hasSepoliaContractConfig, SEPOLIA_CHAIN_ID, sepoliaTransactionUrl } from "../web3/contracts.ts";

type PurchaseStep = "approve" | "buy" | "complete";

export function CourseDetailPage() {
  const { slug } = useParams();
  const auth = useAuth();
  const course = courses.find((item) => item.slug === slug) ?? courses[0];
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("approve");
  const [busy, setBusy] = useState(false);
  const [ydBalance, setYdBalance] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approveTx, setApproveTx] = useState<string | null>(null);
  const [buyTx, setBuyTx] = useState<string | null>(null);
  useEffect(() => {
    const chainCourseId = course.chainCourseId;
    if (!chainCourseId || !auth.authenticated || !auth.getEthereumProvider || !hasSepoliaContractConfig) {
      setYdBalance(null);
      return;
    }
    let cancelled = false;
    void auth.getEthereumProvider()
      .then((provider) => readPurchaseState(provider, chainCourseId, String(course.priceYD)))
      .then((state) => {
        if (cancelled) return;
        setYdBalance(state.balance);
        setPurchaseStep(state.purchased ? "complete" : "approve");
      })
      .catch((error: unknown) => {
        if (!cancelled) setActionError(error instanceof Error ? error.message : "读取链上购买状态失败");
      });
    return () => { cancelled = true; };
  }, [auth.authenticated, auth.getEthereumProvider, course.chainCourseId, course.priceYD]);

  const actionLabel = !course.chainCourseId
    ? "课程尚未上链"
    : !hasSepoliaContractConfig
      ? "待配置 Sepolia"
      : auth.demoMode
        ? "使用钱包登录后购买"
      : !auth.authenticated
        ? "登录后购买"
        : busy
          ? "等待钱包确认…"
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
    if (!auth.getEthereumProvider || !auth.switchEthereumChain) {
      setActionError("当前登录账号没有可用的 EVM 钱包，请使用钱包登录或先在 Privy 中连接钱包");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await auth.switchEthereumChain(SEPOLIA_CHAIN_ID);
      const provider = await auth.getEthereumProvider();
      if (purchaseStep === "approve") {
        const hash = await approveCourse(provider, String(course.priceYD));
        if (hash) setApproveTx(hash);
        setPurchaseStep("buy");
      } else if (purchaseStep === "buy") {
        const hash = await buyCourse(provider, course.chainCourseId, String(course.priceYD));
        setBuyTx(hash);
        setPurchaseStep("complete");
      }
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "链上交易失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-container detail-page">
      <div className="breadcrumbs"><Link to="/">课程</Link><ChevronRight size={15} /><span>{course.category}</span><ChevronRight size={15} /><span>{course.title}</span></div>
      <div className="detail-layout">
        <div className="detail-main">
          <div className={`detail-cover ${course.tone}`}><button aria-label="播放课程预览"><Play fill="currentColor" /></button><span>预览课程 · 02:18</span></div>
          <div className="detail-title"><div className="chip-row"><span className="chip">{course.level}</span><span>{course.category}</span>{course.isFree && <span>原课程免费</span>}<a className="source-link" href={course.courseUrl} target="_blank" rel="noreferrer">课程来源：{course.providerName}<ExternalLink size={13} /></a></div><h1>{course.title}</h1><p>{course.summary}</p></div>
          <div className="teacher-profile"><span className="avatar">{course.teacherName.slice(0, 1)}</span><div><strong>{course.teacherName}</strong><span>{course.providerName} 讲师</span>{course.teacherXUrl && <a className="source-link" href={course.teacherXUrl} target="_blank" rel="noreferrer">{course.teacherXHandle ?? "讲师 X 主页"}<ExternalLink size={13} /></a>}</div><div className="teacher-stats"><span><Star size={16} fill="currentColor" />{course.rating}</span><span><Users size={16} />{course.studentCount.toLocaleString()} 名学员</span></div></div>
          <section className="content-block"><h2>你将学到什么</h2><div className="learn-grid"><span><Check />理解 EVM 与 Solidity 核心语法</span><span><Check />使用 OpenZeppelin 构建安全合约</span><span><Check />编写边界、权限和攻击测试</span><span><Check />部署并在 Sepolia 验证合约</span></div></section>
          <section className="content-block"><h2>课程大纲 · {course.sections.length} 节</h2>{course.sections.map((section) => <div className="syllabus-row" key={section.position}><span>{String(section.position).padStart(2, "0")}</span><strong>{section.title}</strong><small>{formatDuration(section.durationSeconds) || section.originalTitle}</small></div>)}</section>
        </div>
        <aside className="purchase-card">
          <div className="purchase-header"><span>课程价格</span><strong>{course.priceYD} YD</strong><small>{ydBalance ? `链上余额 ${ydBalance} YD` : auth.demoMode ? "演示模式未连接链上钱包" : "连接钱包后读取余额"}</small></div>
          <div className="network-line"><span className="network-badge"><i />Ethereum Sepolia</span><ShieldCheck size={18} /></div>
          <div className="transaction-steps">
            <div className={purchaseStep !== "approve" ? "done" : "active"}><span>{purchaseStep !== "approve" ? <Check size={15} /> : "1"}</span><div><strong>授权 YD</strong><small>允许 CourseMarket 使用 4 YD</small></div></div>
            <div className={purchaseStep === "complete" ? "done" : purchaseStep === "buy" ? "active" : ""}><span>{purchaseStep === "complete" ? <Check size={15} /> : "2"}</span><div><strong>购买课程</strong><small>链上记录购买与分账</small></div></div>
          </div>
          {purchaseStep === "complete" ? <Link to={`/learn/${course.slug}`} className="button primary full">开始学习<ChevronRight size={18} /></Link> : <button className="button primary full" type="button" disabled={!course.chainCourseId || !hasSepoliaContractConfig || busy || (auth.demoMode && !auth.getEthereumProvider)} onClick={() => void handlePurchase()}>{actionLabel}<ChevronRight size={18} /></button>}
          <p className="purchase-help">{course.chainCourseId ? "授权与购买由当前登录钱包在 Ethereum Sepolia 上签名，交易确认后才能进入学习。" : "该课程还没有绑定 Sepolia CourseRegistry 课程，暂不能购买。"}</p>
          {actionError && <p className="inline-alert">{actionError}</p>}
          {approveTx && <a className="explorer-link" href={sepoliaTransactionUrl(approveTx)} target="_blank" rel="noreferrer">查看授权交易<ExternalLink size={14} /></a>}
          {buyTx && <a className="explorer-link" href={sepoliaTransactionUrl(buyTx)} target="_blank" rel="noreferrer">查看购买交易<ExternalLink size={14} /></a>}
          <div className="split-card"><div><CircleDollarSign size={18} /><strong>收益自动分配</strong></div><div className="split-bar"><i /><i /><i /></div><ul><li><span>教师 70%</span><strong>2.8 YD</strong></li><li><span>商家 20%</span><strong>0.8 YD</strong></li><li><span>平台 10%</span><strong>0.4 YD</strong></li></ul></div>
          <Link to="/swap" className="text-link">没有 YD？前往兑换<ChevronRight size={16} /></Link>
          <a className="explorer-link" href="https://sepolia.etherscan.io" target="_blank" rel="noreferrer">在 Sepolia Explorer 查看<ExternalLink size={14} /></a>
        </aside>
      </div>
    </div>
  );
}
