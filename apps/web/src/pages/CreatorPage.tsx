import { ArrowRight, CircleDollarSign, ExternalLink, LayoutDashboard, Store } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiErrorMessage, createCreatorApplication, createTeacherCourse, listApprovedMerchants, listMerchantCourses, listTeacherCourses, submitTeacherCourse } from "../api/client.ts";
import type { CourseDraftInput, CourseLevel, CoverTone, CreatorApplication, CreatorRole, ManagedCourse } from "../api/types.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { PanelState } from "../components/PanelState.tsx";
import { courseStatusLabel, creatorRoleLabels, formatDateTime, reviewStatusLabel, shortenAddress, statusTone } from "../lib/format.ts";
import { useAsyncList } from "../lib/useAsyncList.ts";
import { hasSepoliaContractConfig, SEPOLIA_CHAIN_ID, sepoliaTransactionUrl } from "../web3/contracts.ts";
import { readPendingRevenue, withdrawRevenue } from "../web3/revenue.ts";
import { displayYdBalance } from "../web3/useYdBalance.ts";

const walletPattern = /^0x[0-9a-fA-F]{40}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pricePattern = /^[1-9][0-9]{0,29}$/;
const levels: CourseLevel[] = ["入门", "进阶", "高级"];
const tones: CoverTone[] = ["violet", "blue", "teal"];

export function CreatorPage() {
  const auth = useAuth();
  const heading = auth.role === "teacher"
    ? { overline: "TEACHER CENTER", title: "教学中心", description: "管理课程草稿、提交审核并提取教师分账。" }
    : auth.role === "merchant"
      ? { overline: "MERCHANT CENTER", title: "商家中心", description: "查看参与分账的课程与链上可提取收益。" }
      : { overline: "CREATOR ONBOARDING", title: "创作者入驻", description: "申请成为教师或商家，并跟踪管理员审核状态。" };
  return (
    <div className="page-container feature-page">
      <div className="feature-heading">
        <span className="feature-icon"><LayoutDashboard /></span>
        <div>
          <span className="overline">{heading.overline}</span>
          <h1>{heading.title}</h1>
          <p>{heading.description}</p>
        </div>
      </div>
      <CreatorBody />
      <Link to="/" className="text-link">返回课程市场<ArrowRight size={16} /></Link>
    </div>
  );
}

function CreatorBody() {
  const auth = useAuth();
  if (!auth.authenticated || !auth.token) {
    return <PanelState title="请先登录" description="登录后即可申请成为教师或商家。" action={<button type="button" className="button primary small" onClick={auth.login}>登录</button>} />;
  }
  if (auth.profileLoading) {
    return <PanelState title="加载中…" description="正在读取账号与申请状态。" />;
  }
  if (auth.profileError) {
    return <PanelState tone="error" title="无法读取账号信息" description={auth.profileError} action={<button type="button" className="button secondary small" onClick={auth.refreshProfile}>重试</button>} />;
  }
  const creator = auth.creator;
  if (auth.role === "student" && !creator) {
    return <ApplicationForm token={auth.token} title="申请成为创作者" submitLabel="提交申请" onSubmitted={auth.refreshProfile} />;
  }
  if (!creator) {
    return <PanelState tone="error" title="创作者资料未同步" description="当前角色已经生效，但没有找到与当前钱包对应的已审核创作者资料。请确认登录钱包与角色映射地址一致。" action={<button type="button" className="button secondary small" onClick={auth.refreshProfile}>重新同步</button>} />;
  }
  if (creator.reviewStatus === "pending") {
    return <ApplicationStatus creator={creator} description="申请已提交，管理员审核通过后即可开课。" />;
  }
  if (creator.reviewStatus === "rejected") {
    return (
      <>
        <ApplicationStatus creator={creator} description="申请未通过，修改后可以重新提交。" />
        <ApplicationForm token={auth.token} initial={creator} title="重新提交申请" submitLabel="重新提交" onSubmitted={auth.refreshProfile} />
      </>
    );
  }
  if (auth.role === "student") {
    return <PanelState title="角色正在同步" description="创作者资质已通过，请重新读取账号角色后进入工作台。" action={<button type="button" className="button secondary small" onClick={auth.refreshProfile}>刷新角色</button>} />;
  }
  if (auth.role !== creator.role) {
    return <PanelState tone="error" title="角色与创作者资料不一致" description="当前登录角色与已审核资料不匹配，请退出后使用对应的钱包账号重新登录。" />;
  }
  return (
    <>
      <ApplicationStatus creator={creator} description="资质已通过审核。" />
      <RevenuePanel creator={creator} />
      {creator.role === "teacher" ? <TeacherWorkspace token={auth.token} /> : <MerchantWorkspace token={auth.token} />}
    </>
  );
}

function RevenuePanel({ creator }: { creator: CreatorApplication }) {
  const auth = useAuth();
  const [amount, setAmount] = useState<string | null>(null);
  const [hasRevenue, setHasRevenue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.getEthereumProvider || !hasSepoliaContractConfig) {
      setAmount(null);
      setHasRevenue(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const state = await readPendingRevenue(await auth.getEthereumProvider());
      if (state.account.toLowerCase() !== creator.walletAddress.toLowerCase()) {
        throw new Error("当前签名钱包与创作者收款钱包不一致，请切换到对应账号");
      }
      setAmount(state.amount);
      setHasRevenue(state.amountRaw > 0n);
    } catch (cause) {
      setAmount(null);
      setHasRevenue(false);
      setError(cause instanceof Error ? cause.message : "读取链上分账失败");
    } finally {
      setLoading(false);
    }
  }, [auth.getEthereumProvider, creator.walletAddress]);

  useEffect(() => { void load(); }, [load]);

  const withdraw = async () => {
    if (!auth.getEthereumProvider || !auth.switchEthereumChain) return;
    setWithdrawing(true);
    setError(null);
    try {
      await auth.switchEthereumChain(SEPOLIA_CHAIN_ID);
      const hash = await withdrawRevenue(await auth.getEthereumProvider());
      setTxHash(hash);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "提取分账失败");
    } finally {
      setWithdrawing(false);
    }
  };

  const share = creator.role === "teacher" ? "教师 70%" : "商家 20%";
  return (
    <section className="revenue-card creator-section">
      <div>
        <span className="revenue-icon"><CircleDollarSign /></span>
        <div><span>{share} 链上分账</span><strong>{loading ? "读取中…" : `${displayYdBalance(amount)} YD`}</strong><small>CourseMarket 当前可提取余额</small></div>
      </div>
      <div className="revenue-actions">
        <button type="button" className="button secondary small" disabled={loading} onClick={() => void load()}>刷新</button>
        <button type="button" className="button primary small" disabled={withdrawing || !hasRevenue} onClick={() => void withdraw()}>{withdrawing ? "等待钱包确认…" : "提取到钱包"}</button>
      </div>
      {error && <p className="inline-alert">{error}</p>}
      {txHash && <a className="explorer-link" href={sepoliaTransactionUrl(txHash)} target="_blank" rel="noreferrer">查看提取交易<ExternalLink size={14} /></a>}
    </section>
  );
}

function MerchantWorkspace({ token }: { token: string }) {
  const load = useCallback((signal: AbortSignal) => listMerchantCourses(token, signal), [token]);
  const { items, loading, error, reload } = useAsyncList<ManagedCourse>(load);
  return (
    <section className="creator-section">
      <div className="block-heading"><h2>参与分账的课程</h2><button type="button" className="button secondary small" onClick={reload} disabled={loading}>刷新</button></div>
      {loading && items.length === 0 ? <PanelState title="加载中…" description="正在读取商家课程。" />
        : error ? <PanelState tone="error" title="读取商家课程失败" description={error} action={<button type="button" className="button secondary small" onClick={reload}>重试</button>} />
          : items.length === 0 ? <PanelState title="暂无分账课程" description="课程绑定当前商家钱包后会展示在这里。" />
            : <div className="review-list">{items.map((item) => (
              <article className="review-card" key={item.id}>
                <div className="review-card-top"><div><strong>{item.title}</strong><span><Store size={13} /> 商家分账 20%</span></div><span className={`status-pill ${statusTone(item.status)}`}>{courseStatusLabel(item.status)}</span></div>
                <dl className="review-meta"><div><dt>课程价格</dt><dd>{item.priceYD} YD</dd></div><div><dt>商家每单</dt><dd>{item.priceYD ? `${Number(item.priceYD) * 0.2} YD` : "—"}</dd></div><div><dt>讲师</dt><dd>{item.teacherName ?? "—"}</dd></div></dl>
              </article>
            ))}</div>}
    </section>
  );
}

function ApplicationStatus({ creator, description }: { creator: CreatorApplication; description: string }) {
  return (
    <section className="creator-status">
      <div className="review-card-top">
        <div>
          <strong>{creator.displayName}</strong>
          <span>{creatorRoleLabels[creator.role]}资质</span>
        </div>
        <span className={`status-pill ${statusTone(creator.reviewStatus)}`}>{reviewStatusLabel(creator.reviewStatus)}</span>
      </div>
      <p>{description}</p>
      <dl className="review-meta">
        <div><dt>收款钱包</dt><dd title={creator.walletAddress}>{shortenAddress(creator.walletAddress)}</dd></div>
        <div><dt>审核时间</dt><dd>{formatDateTime(creator.reviewedAt) || "—"}</dd></div>
      </dl>
      {creator.rejectionReason && <p className="review-note">驳回理由：{creator.rejectionReason}</p>}
    </section>
  );
}

interface ApplicationErrors {
  displayName?: string;
  walletAddress?: string;
}

function ApplicationForm({ token, initial, title, submitLabel, onSubmitted }: { token: string; initial?: CreatorApplication; title: string; submitLabel: string; onSubmitted: () => void }) {
  const [role, setRole] = useState<CreatorRole>(initial?.role ?? "teacher");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [walletAddress, setWalletAddress] = useState(initial?.walletAddress ?? "");
  const [errors, setErrors] = useState<ApplicationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const name = displayName.trim();
    const wallet = walletAddress.trim();
    const nextErrors: ApplicationErrors = {};
    if (!name) nextErrors.displayName = "请填写显示名";
    else if (name.length > 80) nextErrors.displayName = "显示名不能超过 80 个字符";
    if (!walletPattern.test(wallet)) nextErrors.walletAddress = "钱包地址需为 0x 开头的 40 位十六进制字符";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    setSubmitError(null);
    createCreatorApplication(token, { role, displayName: name, walletAddress: wallet })
      .then(() => onSubmitted())
      // 409 等业务冲突原样透出后端 message，例如钱包已被占用
      .catch((cause: unknown) => setSubmitError(apiErrorMessage(cause)))
      .finally(() => setSubmitting(false));
  };

  return (
    <form className="creator-form" onSubmit={handleSubmit}>
      <h2>{title}</h2>
      <p className="form-hint">审核通过后，教师可以创建课程，商家可以参与分账。</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="creator-role">申请身份</label>
          <select id="creator-role" value={role} onChange={(event) => setRole(event.target.value === "merchant" ? "merchant" : "teacher")}>
            <option value="teacher">教师</option>
            <option value="merchant">商家</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="creator-name">显示名</label>
          <input id="creator-name" value={displayName} maxLength={80} placeholder="展示在课程页的名称" onChange={(event) => setDisplayName(event.target.value)} />
          {errors.displayName && <span className="field-error">{errors.displayName}</span>}
        </div>
        <div className="field wide">
          <label htmlFor="creator-wallet">收款钱包地址</label>
          <input id="creator-wallet" value={walletAddress} placeholder="0x…" spellCheck={false} onChange={(event) => setWalletAddress(event.target.value)} />
          {errors.walletAddress ? <span className="field-error">{errors.walletAddress}</span> : <small>用于接收课程分账，需为 EVM 地址。</small>}
        </div>
      </div>
      {submitError && <div className="inline-alert">{submitError}</div>}
      <div className="form-actions">
        <button type="submit" className="button primary" disabled={submitting}>{submitting ? "提交中…" : submitLabel}</button>
      </div>
    </form>
  );
}

function TeacherWorkspace({ token }: { token: string }) {
  const load = useCallback((signal: AbortSignal) => listTeacherCourses(token, signal), [token]);
  const { items, loading, error, errorCode, setItems, reload } = useAsyncList<ManagedCourse>(load);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 提交审核先本地改状态，失败回滚到快照
  const submitCourse = async (id: string) => {
    const snapshot = items;
    setBusyId(id);
    setActionError(null);
    setItems((current) => current.map((item) => (item.id === id ? { ...item, status: "review" } : item)));
    try {
      await submitTeacherCourse(token, id);
      reload();
    } catch (cause) {
      setItems(snapshot);
      setActionError(apiErrorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <section className="creator-section">
        <div className="block-heading">
          <h2>我的课程</h2>
          <button type="button" className="button secondary small" onClick={reload} disabled={loading}>刷新</button>
        </div>
        {actionError && <div className="inline-alert">{actionError}</div>}
        {loading && items.length === 0 ? (
          <PanelState title="加载中…" description="正在读取我的课程。" />
        ) : error ? (
          <PanelState tone="error" title={errorCode === "FORBIDDEN" ? "教师资质尚未通过审核" : "读取课程失败"} description={error} action={<button type="button" className="button secondary small" onClick={reload}>重试</button>} />
        ) : items.length === 0 ? (
          <PanelState title="还没有课程" description="用下面的表单创建第一门草稿课程。" />
        ) : (
          <div className="review-list">
            {items.map((item) => (
              <article className="review-card" key={item.id}>
                <div className="review-card-top">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.slug}</span>
                  </div>
                  <span className={`status-pill ${statusTone(item.status)}`}>{courseStatusLabel(item.status)}</span>
                </div>
                <dl className="review-meta">
                  <div><dt>分类</dt><dd>{item.category ?? "—"}</dd></div>
                  <div><dt>难度</dt><dd>{item.level ?? "—"}</dd></div>
                  <div><dt>价格</dt><dd>{item.priceYD ? `${item.priceYD} YD` : "—"}</dd></div>
                  <div><dt>提交时间</dt><dd>{formatDateTime(item.submittedAt) || "—"}</dd></div>
                </dl>
                {item.rejectionReason && <p className="review-note">驳回理由：{item.rejectionReason}</p>}
                {item.status === "draft" ? (
                  <div className="review-actions">
                    <button type="button" className="button primary small" disabled={busyId === item.id} onClick={() => void submitCourse(item.id)}>提交审核</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
      <CourseDraftForm token={token} onCreated={reload} />
    </>
  );
}

interface DraftErrors {
  merchantId?: string;
  slug?: string;
  title?: string;
  summary?: string;
  category?: string;
  priceYD?: string;
  courseUrl?: string;
}

function CourseDraftForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const loadMerchants = useCallback((signal: AbortSignal) => listApprovedMerchants(token, signal), [token]);
  const merchants = useAsyncList<CreatorApplication>(loadMerchants);
  const [merchantId, setMerchantId] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState<CourseLevel>("入门");
  const [priceYD, setPriceYD] = useState("");
  const [coverTone, setCoverTone] = useState<CoverTone>("violet");
  const [courseUrl, setCourseUrl] = useState("");
  const [providerName, setProviderName] = useState("");
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (merchants.items.length > 0 && !merchants.items.some((merchant) => merchant.id === merchantId)) {
      setMerchantId(merchants.items[0]?.id ?? "");
    }
  }, [merchantId, merchants.items]);

  const reset = () => {
    setSlug("");
    setTitle("");
    setSummary("");
    setCategory("");
    setLevel("入门");
    setPriceYD("");
    setCoverTone("violet");
    setCourseUrl("");
    setProviderName("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const draft = {
      slug: slug.trim(),
      title: title.trim(),
      summary: summary.trim(),
      category: category.trim(),
      priceYD: priceYD.trim(),
      courseUrl: courseUrl.trim(),
      providerName: providerName.trim(),
    };
    const nextErrors: DraftErrors = {};
    if (!merchantId) nextErrors.merchantId = "请选择已审核通过的分账商家";
    if (!slugPattern.test(draft.slug)) nextErrors.slug = "只允许小写字母、数字与短横线";
    if (!draft.title) nextErrors.title = "请填写课程标题";
    if (!draft.summary) nextErrors.summary = "请填写课程简介";
    if (!draft.category) nextErrors.category = "请填写课程分类";
    if (!pricePattern.test(draft.priceYD)) nextErrors.priceYD = "价格需为大于 0 的整数 YD";
    if (draft.courseUrl && !/^https?:\/\//.test(draft.courseUrl)) nextErrors.courseUrl = "链接需以 http:// 或 https:// 开头";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input: CourseDraftInput = {
      merchantId,
      slug: draft.slug,
      title: draft.title,
      summary: draft.summary,
      category: draft.category,
      level,
      priceYD: draft.priceYD,
      coverTone,
    };
    if (draft.courseUrl) input.courseUrl = draft.courseUrl;
    if (draft.providerName) input.providerName = draft.providerName;

    setSubmitting(true);
    setSubmitError(null);
    createTeacherCourse(token, input)
      .then(() => { reset(); onCreated(); })
      // slug 重复等 409 冲突原样展示后端 message
      .catch((cause: unknown) => setSubmitError(apiErrorMessage(cause)))
      .finally(() => setSubmitting(false));
  };

  return (
    <form className="creator-form creator-section" onSubmit={handleSubmit}>
      <h2>新建课程草稿</h2>
      <p className="form-hint">草稿保存后可继续完善；分账商家必须已通过审核，课程上架后按 20% 接收分账。</p>
      <div className="form-grid">
        <div className="field wide">
          <label htmlFor="course-merchant">分账商家（20%）</label>
          <select id="course-merchant" value={merchantId} disabled={merchants.loading || merchants.items.length === 0} onChange={(event) => setMerchantId(event.target.value)}>
            {merchants.items.length === 0 ? <option value="">暂无已审核商家</option> : merchants.items.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.displayName} · {shortenAddress(merchant.walletAddress)}</option>)}
          </select>
          {errors.merchantId ? <span className="field-error">{errors.merchantId}</span> : merchants.error ? <span className="field-error">{merchants.error}</span> : <small>这里只展示管理员已审核通过的商家。</small>}
        </div>
        <div className="field">
          <label htmlFor="course-slug">课程标识 slug</label>
          <input id="course-slug" value={slug} placeholder="solidity-from-zero" spellCheck={false} onChange={(event) => setSlug(event.target.value)} />
          {errors.slug && <span className="field-error">{errors.slug}</span>}
        </div>
        <div className="field">
          <label htmlFor="course-title">课程标题</label>
          <input id="course-title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
          {errors.title && <span className="field-error">{errors.title}</span>}
        </div>
        <div className="field wide">
          <label htmlFor="course-summary">课程简介</label>
          <textarea id="course-summary" value={summary} rows={3} maxLength={400} onChange={(event) => setSummary(event.target.value)} />
          {errors.summary && <span className="field-error">{errors.summary}</span>}
        </div>
        <div className="field">
          <label htmlFor="course-category">分类</label>
          <input id="course-category" value={category} placeholder="Solidity" onChange={(event) => setCategory(event.target.value)} />
          {errors.category && <span className="field-error">{errors.category}</span>}
        </div>
        <div className="field">
          <label htmlFor="course-level">难度</label>
          <select id="course-level" value={level} onChange={(event) => setLevel(levels.find((item) => item === event.target.value) ?? "入门")}>
            {levels.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="course-price">价格（YD）</label>
          <input id="course-price" value={priceYD} inputMode="numeric" placeholder="4" onChange={(event) => setPriceYD(event.target.value)} />
          {errors.priceYD && <span className="field-error">{errors.priceYD}</span>}
        </div>
        <div className="field">
          <label htmlFor="course-tone">封面配色</label>
          <select id="course-tone" value={coverTone} onChange={(event) => setCoverTone(tones.find((item) => item === event.target.value) ?? "violet")}>
            {tones.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="course-url">原课程链接（可选）</label>
          <input id="course-url" value={courseUrl} placeholder="https://" spellCheck={false} onChange={(event) => setCourseUrl(event.target.value)} />
          {errors.courseUrl && <span className="field-error">{errors.courseUrl}</span>}
        </div>
        <div className="field">
          <label htmlFor="course-provider">来源平台（可选）</label>
          <input id="course-provider" value={providerName} onChange={(event) => setProviderName(event.target.value)} />
        </div>
      </div>
      {submitError && <div className="inline-alert">{submitError}</div>}
      <div className="form-actions">
        <button type="submit" className="button primary" disabled={submitting || merchants.loading || merchants.items.length === 0}>{submitting ? "创建中…" : "创建草稿"}</button>
      </div>
    </form>
  );
}
