import { Award, BookOpen, CheckCircle2, ExternalLink, Shield, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getCourseProgress, listPublishedCourses } from "../api/client.ts";
import type { CourseProgress, PublicCourseSummary } from "../api/types.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { creatorCenterLabel, roleLabels } from "../auth/permissions.ts";
import { PanelState } from "../components/PanelState.tsx";
import { sepoliaCertificateUrl } from "../web3/contracts.ts";
import { readOwnedCertificates, type OwnedCertificate } from "../web3/certificates.ts";
import { displayYdBalance, useYdBalance } from "../web3/useYdBalance.ts";

interface LearningItem {
  course: PublicCourseSummary;
  progress: CourseProgress;
}

export function ProfilePage() {
  const auth = useAuth();
  const role = auth.role ?? "student";
  const ydBalance = useYdBalance();
  const learning = useLearningOverview(auth.token, role !== "admin");
  const certificates = useCertificateOverview(learning.courses, auth.getEthereumProvider);
  const inProgress = learning.items.filter((item) => item.progress.completedCount > 0 && !item.progress.completed).length;
  const primaryCertificate = certificates.items[0] ?? null;
  const shortcut = role === "admin"
    ? { label: "进入管理后台", to: "/admin" }
    : role === "student"
      ? { label: "申请成为创作者", to: "/creator" }
      : { label: `进入${creatorCenterLabel(role)}`, to: "/creator" };

  return (
    <div className="page-container profile-page">
      <div className="profile-heading"><div><span className="overline">ACCOUNT & ROLE</span><h1>个人中心</h1><p>查看当前角色、学习进度、钱包余额与真实链上证书。</p></div></div>
      <div className="profile-card">
        <span className="avatar large">{auth.displayName.slice(0, 1).toUpperCase()}</span>
        <div><h2>{auth.displayName}</h2><span>{auth.demoMode ? "本地演示身份" : "Privy 已验证用户"} · {roleLabels[role]}</span><p>{auth.walletAddress ?? "尚未绑定钱包"}</p></div>
        <span className={`role-badge role-${role}`}><Shield size={15} />{roleLabels[role]}</span>
        <Link className="button secondary" to={shortcut.to}>{shortcut.label}</Link>
      </div>
      <div className="profile-stats">
        <div><WalletCards /><span>真实 YD 余额</span><strong title={ydBalance.error ?? undefined}>{displayYdBalance(ydBalance.balance)}</strong></div>
        <div><BookOpen /><span>学习中</span><strong>{learning.loading ? "—" : inProgress}</strong></div>
        <div><Award /><span>链上证书</span><strong>{certificates.loading ? "—" : certificates.items.length}</strong></div>
      </div>
      <div className="profile-grid">
        <section className="content-block">
          <div className="block-heading"><h2>{role === "admin" ? "角色权限" : "学习进度"}</h2><Link to={shortcut.to}>{shortcut.label}</Link></div>
          {role === "admin" ? (
            <div className="role-summary"><Shield /><div><strong>平台审核权限</strong><p>可以审核教师 / 商家入驻和课程上架；学生、教师与商家操作入口已隐藏。</p></div></div>
          ) : learning.loading ? (
            <PanelState title="加载中…" description="正在汇总真实学习进度。" />
          ) : learning.error ? (
            <PanelState tone="error" title="无法读取学习进度" description={learning.error} />
          ) : learning.items.length === 0 ? (
            <PanelState title="还没有学习记录" description="进入课程并完成任意章节后，进度会显示在这里。" action={<Link className="button secondary small" to="/">浏览课程</Link>} />
          ) : (
            learning.items.map(({ course, progress }) => (
              <Link className="profile-course" to={`/learn/${course.slug}`} key={course.id}>
                <div className={`mini-cover ${course.coverTone}`}>{course.category.slice(0, 4)}</div>
                <div><strong>{course.title}</strong><span>{progress.completed ? "全部章节已完成" : `${progress.completedCount}/${progress.totalSections} 节已完成`}</span><div className="progress"><i style={{ width: `${progress.percent}%` }} /></div></div>
                <b>{progress.percent}%</b>
              </Link>
            ))
          )}
        </section>
        <CertificatePanel certificate={primaryCertificate} loading={certificates.loading} error={certificates.error} displayName={auth.displayName} />
      </div>
      <div className="security-note"><CheckCircle2 /><span>角色由后端验证后的当前钱包映射；链上余额、分账和证书均从 Sepolia 合约读取。</span></div>
    </div>
  );
}

function CertificatePanel({ certificate, loading, error, displayName }: { certificate: OwnedCertificate | null; loading: boolean; error: string | null; displayName: string }) {
  return (
    <section className="certificate-panel">
      <div className="certificate-top"><span><Award /></span><small>YD UNIVERSITY</small><b>不可转让</b></div>
      {loading ? <><h2>正在读取链上证书…</h2><p>从 CourseCertificate 查询当前钱包持有的凭证。</p></>
        : certificate ? <><h2>{certificate.courseTitle}</h2><p>授予 <strong>{displayName}</strong>，证明该钱包已获得课程完成证书。</p><div className="certificate-meta"><span>课程 ID</span><strong>#{certificate.courseId}</strong><span>证书 Token</span><strong>#{certificate.tokenId}</strong></div><a className="button secondary full" href={sepoliaCertificateUrl(certificate.tokenId)} target="_blank" rel="noreferrer">在区块浏览器验证<ExternalLink size={16} /></a></>
          : <><h2>当前钱包暂无证书</h2><p>{error ?? "完成已购买课程并等待完成报告确认后，证书会显示在这里。"}</p></>}
    </section>
  );
}

function useLearningOverview(token: string | null, enabled: boolean) {
  const [courses, setCourses] = useState<PublicCourseSummary[]>([]);
  const [items, setItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!token) { setCourses([]); setItems([]); setLoading(false); setError(null); return; }
    const controller = new AbortController();
    setLoading(true);
    listPublishedCourses(controller.signal)
      .then(async (published) => {
        setCourses(published);
        if (!enabled) { setItems([]); return; }
        const progress = await Promise.all(published.map(async (course) => ({ course, progress: await getCourseProgress(token, course.slug, controller.signal) })));
        if (!controller.signal.aborted) setItems(progress.filter((item) => item.progress.completedCount > 0));
      })
      .then(() => { if (!controller.signal.aborted) setError(null); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "读取学习进度失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [enabled, token]);
  return { courses, items, loading, error };
}

function useCertificateOverview(courses: readonly PublicCourseSummary[], getProvider: ReturnType<typeof useAuth>["getEthereumProvider"]) {
  const [items, setItems] = useState<OwnedCertificate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const courseKey = useMemo(() => courses.map((course) => `${course.id}:${course.chainCourseId ?? ""}`).join("|"), [courses]);
  useEffect(() => {
    if (!getProvider || courses.length === 0) { setItems([]); setLoading(false); setError(null); return; }
    let cancelled = false;
    setLoading(true);
    getProvider()
      .then((provider) => readOwnedCertificates(provider, courses))
      .then((owned) => { if (!cancelled) { setItems(owned); setError(null); } })
      .catch((cause: unknown) => { if (!cancelled) { setItems([]); setError(cause instanceof Error ? cause.message : "读取证书失败"); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseKey, courses, getProvider]);
  return { items, loading, error };
}
