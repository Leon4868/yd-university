import { ArrowRight, Award, BookOpenCheck, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { CourseCard } from "../components/CourseCard.tsx";
import { courses } from "../data/courses.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { creatorCenterLabel, roleLabels } from "../auth/permissions.ts";

const courseFilters = ["全部", "Web3 入门", "Solidity", "DeFi", "安全"] as const;

export function HomePage() {
  const auth = useAuth();
  const [activeFilter, setActiveFilter] = useState<(typeof courseFilters)[number]>("全部");
  const visibleCourses = courses.filter((course) => {
    if (activeFilter === "全部") return true;
    if (activeFilter === "Web3 入门") return course.level === "入门";
    return course.category === activeFilter;
  });
  const roleAction = auth.role === "admin"
    ? { title: "处理平台审核", description: "查看待审入驻申请与待上架课程。", label: "进入管理后台", to: "/admin" }
    : auth.role === "teacher"
      ? { title: "管理你的课程", description: "创建草稿、提交审核并查看链上教师分账。", label: `进入${creatorCenterLabel(auth.role)}`, to: "/creator" }
      : auth.role === "merchant"
        ? { title: "查看商家分账", description: "查看参与分账的课程与当前可提取 YD。", label: `进入${creatorCenterLabel(auth.role)}`, to: "/creator" }
        : auth.role === "student"
          ? { title: "开始你的学习", description: "完成章节会保存真实进度，达到 100% 后进入证书流程。", label: "进入我的学习", to: "/learn/solidity-from-zero" }
          : { title: "正在确认账号身份", description: "角色读取完成后会展示对应工作台。", label: "查看账号状态", to: "/profile" };
  return (
    <>
      <section className="hero page-container">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={16} />教育优先，链上验证</span>
          <h1>学习真实技能，<br />拥有可验证的成长</h1>
          <p>精选 Web3 课程、透明的 YD 支付，以及完成学习后自动发放的不可转让证书。</p>
          <div className="hero-actions">
            <a href="#courses" className="button primary">探索课程<ArrowRight size={18} /></a>
            <Link to="/profile" className="button secondary">查看我的证书</Link>
          </div>
          <div className="trust-line">
            <span><ShieldCheck size={17} />Sepolia 可验证购买</span>
            <span><CheckCircle2 size={17} />100% 进度自动发证</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="链上学习凭证插画">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
          <div className="credential-card">
            <span className="credential-icon"><Award size={30} /></span><small>ON-CHAIN CREDENTIAL</small>
            <strong>Solidity 基础证书</strong><span>不可转让 · Ethereum Sepolia</span><div className="credential-seal">YD</div>
          </div>
          <div className="floating-note note-one">100% 完成</div><div className="floating-note note-two">✓ 已验证</div>
        </div>
      </section>
      <section className="stats-strip page-container" aria-label="平台数据">
        <div><strong>{courses.length}</strong><span>演示课程</span></div><div><strong>4</strong><span>独立角色</span></div><div><strong>Sepolia</strong><span>链上验证网络</span></div>
      </section>
      <section id="courses" className="section page-container">
        <div className="section-heading"><div><span className="overline">CURATED LEARNING</span><h2>热门课程</h2></div><div className="filters">{courseFilters.map((filter) => <button type="button" key={filter} className={activeFilter === filter ? "active" : ""} aria-pressed={activeFilter === filter} onClick={() => setActiveFilter(filter)}>{filter}</button>)}</div></div>
        <div className="course-grid">{visibleCourses.map((course) => <CourseCard key={course.slug} course={course} />)}</div>
      </section>
      <section className="section page-container verify-section">
        <div className="section-heading compact"><div><span className="overline">VERIFIABLE PROGRESS</span><h2>学习如何被验证</h2></div></div>
        <div className="step-grid">
          <div><span>01</span><BookOpenCheck /><h3>购买课程</h3><p>使用 YD 完成链上购买，CourseMarket 留下公开凭证。</p></div>
          <div><span>02</span><CheckCircle2 /><h3>完成学习</h3><p>教务系统按章节计算进度，全部完成后达到 100%。</p></div>
          <div><span>03</span><Award /><h3>获得证书</h3><p>CRE 传递完成报告，自动铸造不可转让 ERC721 证书。</p></div>
        </div>
      </section>
      <section className="continue-card page-container">
        <div className="continue-cover violet"><span>{auth.role ? roleLabels[auth.role].slice(0, 2) : "YD"}</span></div>
        <div className="continue-content"><span className="overline">{auth.authenticated ? "ROLE WORKSPACE" : "WELCOME"}</span><h3>{auth.authenticated ? roleAction.title : "登录后保存学习进度"}</h3><p>{auth.authenticated ? roleAction.description : "支持邮箱、Google、GitHub 与钱包登录。"}</p></div>
        {auth.authenticated ? <Link to={roleAction.to} className="button primary">{roleAction.label}<ArrowRight size={18} /></Link> : <button type="button" className="button primary" onClick={auth.login}>登录开始<ArrowRight size={18} /></button>}
      </section>
    </>
  );
}
