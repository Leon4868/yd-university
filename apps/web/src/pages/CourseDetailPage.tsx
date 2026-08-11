import { Check, ChevronRight, CircleDollarSign, ExternalLink, Play, ShieldCheck, Star, Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { courses } from "../data/courses.ts";

type PurchaseStep = "approve" | "buy" | "complete";

export function CourseDetailPage() {
  const { slug } = useParams();
  const course = courses.find((item) => item.slug === slug) ?? courses[0];
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("approve");
  if (!course) return null;
  const actionLabel = purchaseStep === "approve" ? `授权 ${course.priceYD} YD` : purchaseStep === "buy" ? "购买课程" : "购买成功";
  const handlePurchase = () => setPurchaseStep((current) => current === "approve" ? "buy" : "complete");

  return (
    <div className="page-container detail-page">
      <div className="breadcrumbs"><Link to="/">课程</Link><ChevronRight size={15} /><span>{course.category}</span><ChevronRight size={15} /><span>{course.title}</span></div>
      <div className="detail-layout">
        <div className="detail-main">
          <div className={`detail-cover ${course.tone}`}><button aria-label="播放课程预览"><Play fill="currentColor" /></button><span>预览课程 · 02:18</span></div>
          <div className="detail-title"><div className="chip-row"><span className="chip">{course.level}</span><span>{course.category}</span></div><h1>{course.title}</h1><p>{course.summary}</p></div>
          <div className="teacher-profile"><span className="avatar">A</span><div><strong>{course.teacherName}</strong><span>Solidity 讲师 · 智能合约工程师</span></div><div className="teacher-stats"><span><Star size={16} fill="currentColor" />{course.rating}</span><span><Users size={16} />{course.studentCount.toLocaleString()} 名学员</span></div></div>
          <section className="content-block"><h2>你将学到什么</h2><div className="learn-grid"><span><Check />理解 EVM 与 Solidity 核心语法</span><span><Check />使用 OpenZeppelin 构建安全合约</span><span><Check />编写边界、权限和攻击测试</span><span><Check />部署并在 Sepolia 验证合约</span></div></section>
          <section className="content-block"><h2>课程大纲</h2>{["第一章 · 认识 EVM 与开发环境", "第二章 · Solidity 数据与函数", "第三章 · ERC 标准与合约安全", "第四章 · 测试、部署与验证"].map((title, index) => <div className="syllabus-row" key={title}><span>{String(index + 1).padStart(2, "0")}</span><strong>{title}</strong><small>{index + 2} 节</small><ChevronRight size={17} /></div>)}</section>
        </div>
        <aside className="purchase-card">
          <div className="purchase-header"><span>课程价格</span><strong>{course.priceYD} YD</strong><small>当前余额 128.40 YD</small></div>
          <div className="network-line"><span className="network-badge"><i />Ethereum Sepolia</span><ShieldCheck size={18} /></div>
          <div className="transaction-steps">
            <div className={purchaseStep !== "approve" ? "done" : "active"}><span>{purchaseStep !== "approve" ? <Check size={15} /> : "1"}</span><div><strong>授权 YD</strong><small>允许 CourseMarket 使用 4 YD</small></div></div>
            <div className={purchaseStep === "complete" ? "done" : purchaseStep === "buy" ? "active" : ""}><span>{purchaseStep === "complete" ? <Check size={15} /> : "2"}</span><div><strong>购买课程</strong><small>链上记录购买与分账</small></div></div>
          </div>
          {purchaseStep === "complete" ? <Link to={`/learn/${course.slug}`} className="button primary full">开始学习<ChevronRight size={18} /></Link> : <button className="button primary full" type="button" onClick={handlePurchase}>{actionLabel}<ChevronRight size={18} /></button>}
          <p className="purchase-help">当前为本地交互演示。部署合约并配置地址后，将替换为真实钱包交易。</p>
          <div className="split-card"><div><CircleDollarSign size={18} /><strong>收益自动分配</strong></div><div className="split-bar"><i /><i /><i /></div><ul><li><span>教师 70%</span><strong>2.8 YD</strong></li><li><span>商家 20%</span><strong>0.8 YD</strong></li><li><span>平台 10%</span><strong>0.4 YD</strong></li></ul></div>
          <Link to="/swap" className="text-link">没有 YD？前往兑换<ChevronRight size={16} /></Link>
          <a className="explorer-link" href="https://sepolia.etherscan.io" target="_blank" rel="noreferrer">在 Sepolia Explorer 查看<ExternalLink size={14} /></a>
        </aside>
      </div>
    </div>
  );
}
