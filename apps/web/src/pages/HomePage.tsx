import { ArrowRight, Award, BookOpenCheck, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { CourseCard } from "../components/CourseCard.tsx";
import { courses } from "../data/courses.ts";

export function HomePage() {
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
        <div><strong>48</strong><span>精选课程</span></div><div><strong>26</strong><span>认证讲师</span></div><div><strong>1,284</strong><span>已颁发证书</span></div>
      </section>
      <section id="courses" className="section page-container">
        <div className="section-heading"><div><span className="overline">CURATED LEARNING</span><h2>热门课程</h2></div><div className="filters"><button className="active">全部</button><button>Web3 入门</button><button>Solidity</button><button>DeFi</button><button>安全</button></div></div>
        <div className="course-grid">{courses.map((course) => <CourseCard key={course.slug} course={course} />)}</div>
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
        <div className="continue-cover violet"><span>72%</span></div>
        <div className="continue-content"><span className="overline">继续学习</span><h3>Solidity 智能合约开发从入门到实战</h3><p>下一节：部署你的第一个合约</p><div className="progress"><i style={{ width: "72%" }} /></div></div>
        <Link to="/learn/solidity-from-zero" className="button primary">继续学习<ArrowRight size={18} /></Link>
      </section>
    </>
  );
}
