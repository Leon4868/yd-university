import { Check, ChevronLeft, ChevronRight, Circle, Play, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const lessons = ["认识 Hardhat 3", "搭建第一个 Solidity 项目", "状态变量与存储", "函数与权限", "事件与错误", "ERC20 标准", "CourseRegistry 设计", "部署第一个合约", "编写购买合约", "重入与安全测试", "Sepolia 部署", "合约验证"];

export function LearnPage() {
  return (
    <div className="learn-page page-container">
      <div className="learn-heading"><Link to="/courses/solidity-from-zero"><ChevronLeft size={18} />返回课程</Link><div><strong>Solidity 智能合约从入门到实战</strong><span>72% · 7/12 节</span></div><div className="progress compact"><i style={{ width: "72%" }} /></div></div>
      <div className="player-layout">
        <div>
          <div className="video-player"><button aria-label="播放"><Play size={38} fill="currentColor" /></button><span>第 8 节</span></div>
          <div className="lesson-heading"><div><span className="overline">CHAPTER 04</span><h1>部署第一个合约</h1></div><button className="button primary">完成本节并继续<ChevronRight size={18} /></button></div>
          <div className="tabs"><button className="active">课程介绍</button><button>学习笔记</button><button>评论</button></div>
          <div className="lesson-copy"><h3>本节目标</h3><p>使用 Hardhat Ignition 将合约部署到本地网络，读取部署地址，并理解部署参数为什么必须与构造函数保持一致。</p></div>
          <div className="cre-notice"><ShieldCheck /><div><strong>证书自动验证</strong><p>学习进度达到 100% 后，Chainlink CRE 会传递完成报告并发放不可转让证书。</p></div><div className="certificate-flow"><span className="active">学习中</span><i /><span>验证中</span><i /><span>已发放</span></div></div>
        </div>
        <aside className="lesson-list"><div><strong>课程目录</strong><span>7/12 已完成</span></div>{lessons.map((lesson, index) => <button key={lesson} className={index === 7 ? "current" : ""}><span>{index < 7 ? <Check size={14} /> : <Circle size={13} />}</span><div><small>第 {index + 1} 节</small><strong>{lesson}</strong></div>{index === 7 && <Play size={15} />}</button>)}</aside>
      </div>
    </div>
  );
}
