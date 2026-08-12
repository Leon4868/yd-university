import { Check, ChevronLeft, ChevronRight, Circle, ExternalLink, Play, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { courses, formatDuration } from "../data/courses.ts";

export function LearnPage() {
  const { slug } = useParams();
  const course = courses.find((item) => item.slug === slug) ?? courses[0];
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  if (!course) return null;
  const sections = course.sections;
  const active = sections[activeIndex];
  if (!active) return null;
  const percent = Math.round((completed / sections.length) * 100);
  // 完成本节后进度才推进，最后一节完成时刚好 100%，与「进度 100% 触发发证」的规则一致
  const goNext = () => {
    setCompleted((current) => Math.max(current, activeIndex + 1));
    setActiveIndex((current) => Math.min(current + 1, sections.length - 1));
  };

  return (
    <div className="learn-page page-container">
      <div className="learn-heading"><Link to={`/courses/${course.slug}`}><ChevronLeft size={18} />返回课程</Link><div><strong>{course.title}</strong><span>{percent}% · {completed}/{sections.length} 节</span></div><div className="progress compact"><i style={{ width: `${percent}%` }} /></div></div>
      <div className="player-layout">
        <div>
          <div className="video-player"><button aria-label="播放"><Play size={38} fill="currentColor" /></button><span>第 {active.position} 节</span></div>
          <div className="lesson-heading"><div><span className="overline">SECTION {String(active.position).padStart(2, "0")}</span><h1>{active.title}</h1></div><button className="button primary" type="button" onClick={goNext} disabled={percent === 100 && activeIndex === sections.length - 1}>完成本节并继续<ChevronRight size={18} /></button></div>
          <div className="tabs"><button className="active">课程介绍</button><button>学习笔记</button><button>评论</button></div>
          <div className="lesson-copy"><h3>本节说明</h3><p>本节原始标题：{active.originalTitle}{formatDuration(active.durationSeconds) && ` · 约 ${formatDuration(active.durationSeconds)}`}。视频托管在 {course.providerName}，点击下方链接前往原课程观看。</p><a className="text-link" href={active.url} target="_blank" rel="noreferrer">去原课程学习本节<ExternalLink size={14} /></a></div>
          <div className="cre-notice"><ShieldCheck /><div><strong>证书自动验证</strong><p>学习进度达到 100% 后，Chainlink CRE 会传递完成报告并发放不可转让证书。</p></div><div className="certificate-flow"><span className="active">学习中</span><i /><span>验证中</span><i /><span>已发放</span></div></div>
        </div>
        <aside className="lesson-list"><div><strong>课程目录</strong><span>{completed}/{sections.length} 已完成</span></div>{sections.map((section, index) => <a key={section.position} className={index === activeIndex ? "current" : ""} href={section.url} target="_blank" rel="noreferrer" onClick={() => setActiveIndex(index)}><span>{index < completed ? <Check size={14} /> : <Circle size={13} />}</span><div><small>第 {section.position} 节{formatDuration(section.durationSeconds) && ` · ${formatDuration(section.durationSeconds)}`}</small><strong>{section.title}</strong></div><ExternalLink size={14} /></a>)}</aside>
      </div>
    </div>
  );
}
