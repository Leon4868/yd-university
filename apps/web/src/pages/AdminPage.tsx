import { ArrowRight, ClipboardCheck, ExternalLink } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import { Link } from "react-router-dom";

import { apiErrorMessage, approveCreator, listAdminCourses, listAdminCreators, publishCourse, rejectCourse, rejectCreator } from "../api/client.ts";
import type { AdminCreatorApplication, ManagedCourse } from "../api/types.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { PanelState } from "../components/PanelState.tsx";
import { courseStatusLabel, creatorRoleLabels, formatDateTime, reviewStatusLabel, shortenAddress, statusTone } from "../lib/format.ts";
import { useAsyncList } from "../lib/useAsyncList.ts";

type AdminTab = "creators" | "courses";

export function AdminPage() {
  return (
    <div className="page-container feature-page">
      <div className="feature-heading">
        <span className="feature-icon"><ClipboardCheck /></span>
        <div>
          <span className="overline">ADMIN REVIEW</span>
          <h1>管理员工作台</h1>
          <p>审核教师 / 商家入驻申请，以及课程上架请求。</p>
        </div>
      </div>
      <AdminBody />
      <Link to="/" className="text-link">返回课程市场<ArrowRight size={16} /></Link>
    </div>
  );
}

// 权限在组件内自行判定，导航隐藏只是视觉层，不能当作权限边界
function AdminBody() {
  const auth = useAuth();
  const [tab, setTab] = useState<AdminTab>("creators");
  if (!auth.authenticated || !auth.token) {
    return <PanelState title="请先登录" description="管理员工作台需要登录后访问。" action={<button type="button" className="button primary small" onClick={auth.login}>登录</button>} />;
  }
  if (auth.profileLoading) {
    return <PanelState title="正在确认身份" description="正在读取账号角色信息。" />;
  }
  if (auth.role !== "admin") {
    return <PanelState tone="error" title="当前身份不是管理员" description={auth.profileError ?? "只有管理员可以进入审核工作台。"} action={<button type="button" className="button secondary small" onClick={auth.refreshProfile}>重新读取身份</button>} />;
  }
  return (
    <>
      <div className="tabs workspace-tabs">
        <button type="button" className={tab === "creators" ? "active" : ""} onClick={() => setTab("creators")}>待审教师 / 商家</button>
        <button type="button" className={tab === "courses" ? "active" : ""} onClick={() => setTab("courses")}>待上架课程</button>
      </div>
      {tab === "creators" ? <CreatorReviewPanel token={auth.token} /> : <CourseReviewPanel token={auth.token} />}
    </>
  );
}

function CreatorReviewPanel({ token }: { token: string }) {
  const load = useCallback((signal: AbortSignal) => listAdminCreators(token, "pending", signal), [token]);
  const { items, loading, error, errorCode, setItems, reload } = useAsyncList<AdminCreatorApplication>(load);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 乐观地把处理完的条目移出待审列表，失败原样回滚并提示
  const runAction = async (id: string, action: () => Promise<unknown>) => {
    const snapshot = items;
    setBusyId(id);
    setActionError(null);
    setItems((current) => current.filter((item) => item.id !== id));
    try {
      await action();
      reload();
      return true;
    } catch (cause) {
      setItems(snapshot);
      setActionError(apiErrorMessage(cause));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  if (loading && items.length === 0) return <PanelState title="加载中…" description="正在读取待审申请。" />;
  if (error) {
    return <PanelState tone="error" title={errorCode === "FORBIDDEN" ? "当前身份不是管理员" : "读取待审申请失败"} description={error} action={<button type="button" className="button secondary small" onClick={reload}>重试</button>} />;
  }

  return (
    <div className="review-panel">
      {actionError && <div className="inline-alert">{actionError}</div>}
      {items.length === 0 ? (
        <PanelState title="暂无待审申请" description="新的教师 / 商家入驻申请会出现在这里。" action={<button type="button" className="button secondary small" onClick={reload}>刷新</button>} />
      ) : (
        <div className="review-list">
          {items.map((item) => (
            <article className="review-card" key={item.id}>
              <div className="review-card-top">
                <div>
                  <strong>{item.displayName}</strong>
                  <span>{creatorRoleLabels[item.role]}入驻 · 申请人 {item.applicant?.username ?? "未知"}</span>
                </div>
                <span className={`status-pill ${statusTone(item.reviewStatus)}`}>{reviewStatusLabel(item.reviewStatus)}</span>
              </div>
              <dl className="review-meta">
                <div><dt>收款钱包</dt><dd title={item.walletAddress}>{shortenAddress(item.walletAddress)}</dd></div>
                <div><dt>登录钱包</dt><dd>{item.applicant?.primaryWallet ? shortenAddress(item.applicant.primaryWallet) : "—"}</dd></div>
                <div><dt>提交时间</dt><dd>{formatDateTime(item.createdAt) || "—"}</dd></div>
              </dl>
              {item.rejectionReason && <p className="review-note">上次驳回理由：{item.rejectionReason}</p>}
              {rejectingId === item.id ? (
                <RejectForm
                  busy={busyId === item.id}
                  placeholder="填写驳回理由，会同步展示给申请人"
                  onCancel={() => setRejectingId(null)}
                  onSubmit={(reason) => { void runAction(item.id, () => rejectCreator(token, item.id, reason)).then((ok) => { if (ok) setRejectingId(null); }); }}
                />
              ) : (
                <div className="review-actions">
                  <button type="button" className="button primary small" disabled={busyId === item.id} onClick={() => void runAction(item.id, () => approveCreator(token, item.id))}>通过</button>
                  <button type="button" className="button secondary small" disabled={busyId === item.id} onClick={() => { setActionError(null); setRejectingId(item.id); }}>驳回</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function CourseReviewPanel({ token }: { token: string }) {
  const load = useCallback((signal: AbortSignal) => listAdminCourses(token, "review", signal), [token]);
  const { items, loading, error, errorCode, setItems, reload } = useAsyncList<ManagedCourse>(load);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = async (id: string, action: () => Promise<unknown>) => {
    const snapshot = items;
    setBusyId(id);
    setActionError(null);
    setItems((current) => current.filter((item) => item.id !== id));
    try {
      await action();
      reload();
      return true;
    } catch (cause) {
      setItems(snapshot);
      setActionError(apiErrorMessage(cause));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  if (loading && items.length === 0) return <PanelState title="加载中…" description="正在读取待上架课程。" />;
  if (error) {
    return <PanelState tone="error" title={errorCode === "FORBIDDEN" ? "当前身份不是管理员" : "读取待上架课程失败"} description={error} action={<button type="button" className="button secondary small" onClick={reload}>重试</button>} />;
  }

  return (
    <div className="review-panel">
      {actionError && <div className="inline-alert">{actionError}</div>}
      {items.length === 0 ? (
        <PanelState title="暂无待上架课程" description="教师提交审核的课程会出现在这里。" action={<button type="button" className="button secondary small" onClick={reload}>刷新</button>} />
      ) : (
        <div className="review-list">
          {items.map((item) => (
            <article className="review-card" key={item.id}>
              <div className="review-card-top">
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.slug} · 讲师 {item.teacherName ?? "未知"}</span>
                </div>
                <span className={`status-pill ${statusTone(item.status)}`}>{courseStatusLabel(item.status)}</span>
              </div>
              {item.summary && <p className="review-summary">{item.summary}</p>}
              <dl className="review-meta">
                <div><dt>分类</dt><dd>{item.category ?? "—"}</dd></div>
                <div><dt>难度</dt><dd>{item.level ?? "—"}</dd></div>
                <div><dt>价格</dt><dd>{item.priceYD ? `${item.priceYD} YD` : "—"}</dd></div>
                <div><dt>章节</dt><dd>{item.lessonCount ?? 0} 节</dd></div>
                <div><dt>提交时间</dt><dd>{formatDateTime(item.submittedAt) || "—"}</dd></div>
              </dl>
              {item.courseUrl && <a className="source-link" href={item.courseUrl} target="_blank" rel="noreferrer">查看课程来源{item.providerName ? ` · ${item.providerName}` : ""}<ExternalLink size={13} /></a>}
              {item.rejectionReason && <p className="review-note">上次驳回理由：{item.rejectionReason}</p>}
              {rejectingId === item.id ? (
                <RejectForm
                  busy={busyId === item.id}
                  placeholder="填写驳回理由，会同步展示给课程作者"
                  onCancel={() => setRejectingId(null)}
                  onSubmit={(reason) => { void runAction(item.id, () => rejectCourse(token, item.id, reason)).then((ok) => { if (ok) setRejectingId(null); }); }}
                />
              ) : (
                <div className="review-actions">
                  <button type="button" className="button primary small" disabled={busyId === item.id} onClick={() => void runAction(item.id, () => publishCourse(token, item.id))}>上架</button>
                  <button type="button" className="button secondary small" disabled={busyId === item.id} onClick={() => { setActionError(null); setRejectingId(item.id); }}>驳回</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// 驳回理由必填，前端先拦一道，空理由不发请求
function RejectForm({ busy, placeholder, onCancel, onSubmit }: { busy: boolean; placeholder: string; onCancel: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (!text) { setError("请填写驳回理由"); return; }
    setError(null);
    onSubmit(text);
  };
  return (
    <form className="reject-form" onSubmit={handleSubmit}>
      <textarea
        value={reason}
        rows={2}
        maxLength={500}
        placeholder={placeholder}
        aria-label="驳回理由"
        onChange={(event) => { setReason(event.target.value); if (error) setError(null); }}
      />
      {error && <span className="field-error">{error}</span>}
      <div className="review-actions">
        <button type="submit" className="button danger small" disabled={busy}>{busy ? "提交中…" : "确认驳回"}</button>
        <button type="button" className="button secondary small" disabled={busy} onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}
