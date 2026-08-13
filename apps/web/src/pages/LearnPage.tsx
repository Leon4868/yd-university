import { Check, ChevronLeft, ChevronRight, Circle, Clock3, RotateCcw, ShieldCheck } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { apiErrorMessage, completeCourseSection, getCourseProgress, getPublishedCourse, uncompleteCourseSection } from "../api/client.ts";
import type { CourseProgress } from "../api/types.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { PanelState } from "../components/PanelState.tsx";
import { formatDuration } from "../data/courses.ts";
import { useAsyncData } from "../lib/useAsyncData.ts";
import { usePurchasedCourses } from "../web3/usePurchasedCourses.ts";

export function LearnPage() {
  const { slug } = useParams();
  const auth = useAuth();
  const purchased = usePurchasedCourses();
  let body: ReactNode;
  if (!slug) {
    body = <PanelState tone="error" title="课程不存在" description="链接里缺少课程标识，请从课程市场重新进入。" action={<Link className="button secondary small" to="/">返回课程市场</Link>} />;
  } else if (!auth.authenticated || !auth.token) {
    body = <PanelState title="请先登录" description="学习进度记录在账号里，登录后才能标记完成。" action={<button type="button" className="button primary small" onClick={auth.login}>登录</button>} />;
  } else if (purchased.loading) {
    body = <PanelState title="正在确认购买状态" description="正在读取当前钱包在 CourseMarket 上的购买记录。" />;
  } else if (purchased.error) {
    body = <PanelState tone="error" title="无法确认购买状态" description={purchased.error} action={<Link className="button secondary small" to={`/courses/${slug}`}>返回课程详情</Link>} />;
  } else if (!purchased.bypassed && !purchased.slugs.includes(slug)) {
    body = <PanelState tone="error" title="尚未购买该课程" description="学习页仅向已在链上购买该课程的钱包开放，购买后即可记录进度并在完成后铸造证书。" action={<Link className="button primary small" to={`/courses/${slug}`}>前往课程详情购买</Link>} />;
  } else {
    body = <LearnWorkspace slug={slug} token={auth.token} />;
  }
  return <div className="learn-page page-container">{body}</div>;
}

function LearnWorkspace({ slug, token }: { slug: string; token: string }) {
  const loadCourse = useCallback((signal: AbortSignal) => getPublishedCourse(slug, signal), [slug]);
  const loadProgress = useCallback((signal: AbortSignal) => getCourseProgress(token, slug, signal), [slug, token]);
  const course = useAsyncData(loadCourse);
  const progress = useAsyncData(loadProgress);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (course.loading || progress.loading) {
    return <PanelState title="加载中…" description="正在读取课程目录与学习进度。" />;
  }
  if (!course.data) {
    return <PanelState tone="error" title="无法加载课程" description={course.error ?? "课程不存在或尚未上架。"} action={<button type="button" className="button secondary small" onClick={course.reload}>重试</button>} />;
  }
  if (!progress.data) {
    return <PanelState tone="error" title="无法读取学习进度" description={progress.error ?? "进度接口暂时不可用，完成状态无法保存。"} action={<button type="button" className="button secondary small" onClick={progress.reload}>重试</button>} />;
  }

  const detail = course.data;
  const sections = detail.sections;
  const record = progress.data;
  if (sections.length === 0) {
    return <PanelState title="课程暂无小节" description="讲师还没有添加小节，稍后再来继续学习。" action={<Link className="button secondary small" to={`/courses/${detail.slug}`}>返回课程</Link>} />;
  }

  const index = Math.min(activeIndex, sections.length - 1);
  const active = sections[index];
  const completedIds = new Set(record.completedSectionIds);
  const activeDone = completedIds.has(active.id);
  const isLast = index === sections.length - 1;
  const busy = pendingSectionId !== null;
  const activeDuration = formatDuration(active.durationSeconds);
  const goNext = () => setActiveIndex(Math.min(index + 1, sections.length - 1));

  // 进度只认服务端返回的 CourseProgress，本地不做估算
  const applyProgress = (sectionId: string, run: () => Promise<CourseProgress>, onDone?: () => void) => {
    setPendingSectionId(sectionId);
    setActionError(null);
    run()
      .then((next) => {
        progress.setData(next);
        onDone?.();
      })
      .catch((cause: unknown) => setActionError(apiErrorMessage(cause)))
      .finally(() => setPendingSectionId(null));
  };
  const complete = () => applyProgress(active.id, () => completeCourseSection(token, slug, active.id), goNext);
  const revoke = () => applyProgress(active.id, () => uncompleteCourseSection(token, slug, active.id));

  return (
    <>
      <div className="learn-heading"><Link to={`/courses/${detail.slug}`}><ChevronLeft size={18} />返回课程</Link><div><strong>{detail.title}</strong><span>{record.percent}% · {record.completedCount}/{record.totalSections} 节</span></div><div className="progress compact"><i style={{ width: `${record.percent}%` }} /></div></div>
      <div className="player-layout">
        <div>
          <div className="lesson-heading">
            <div><span className="overline">SECTION {String(active.position).padStart(2, "0")}</span><h1>{active.title}</h1></div>
            <div className="lesson-actions">
              {activeDone
                ? <>
                    <button className="button secondary small" type="button" disabled={busy} onClick={revoke}><RotateCcw size={16} />取消完成</button>
                    <button className="button primary" type="button" disabled={isLast} onClick={goNext}>下一节<ChevronRight size={18} /></button>
                  </>
                : <button className="button primary" type="button" disabled={busy} onClick={complete}><Check size={18} />{isLast ? "完成本节" : "完成本节并继续"}</button>}
            </div>
          </div>
          <div className="lesson-copy">
            <h3>本节说明</h3>
            <div className="lesson-facts">
              <span><Clock3 size={15} />预计学习时长 {activeDuration || "未标注"}</span>
              {active.originalTitle && <span>原始标题：{active.originalTitle}</span>}
              <span className={`section-flag ${activeDone ? "done" : ""}`}>{activeDone ? "已完成" : "未完成"}</span>
            </div>
            <p>本节不提供视频或外链，按上面的时长自行学完后点「完成本节」即视为学完。进度保存在账号里，刷新或换设备都还在，点错了可以取消完成。</p>
            {actionError && <p className="inline-alert">{actionError}</p>}
          </div>
          <div className="cre-notice">
            <ShieldCheck />
            <div>
              <strong>证书自动验证</strong>
              <p>{record.completed ? "进度已达 100%，平台正在为你的钱包铸造证书，稍后刷新即可看到。" : "学习进度达到 100% 后，平台会自动为你的钱包铸造不可转让证书。"}</p>
            </div>
            <div className="certificate-flow"><span className={record.completed ? "done" : "active"}>学习中</span><i /><span className={record.completed ? "active" : ""}>验证中</span><i /><span>已发放</span></div>
          </div>
        </div>
        <aside className="lesson-list">
          <div><strong>课程目录</strong><span>{record.completedCount}/{record.totalSections} 已完成</span></div>
          {sections.map((section, position) => (
            <button key={section.id} type="button" className={position === index ? "current" : ""} onClick={() => setActiveIndex(position)}>
              <span>{completedIds.has(section.id) ? <Check size={14} /> : <Circle size={13} />}</span>
              <div><small>第 {section.position} 节{formatDuration(section.durationSeconds) && ` · ${formatDuration(section.durationSeconds)}`}</small><strong>{section.title}</strong></div>
            </button>
          ))}
        </aside>
      </div>
    </>
  );
}
