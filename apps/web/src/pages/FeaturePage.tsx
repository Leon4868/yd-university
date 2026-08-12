import { ArrowRight, CheckCircle2, CircleDollarSign, ClipboardCheck, Coins, FilePlus2, LayoutDashboard, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

const configs = {
  swap: { eyebrow: "UNISWAP ROUTE", title: "兑换 YD", description: "用测试 USDC 获取课程支付所需的 YD。", icon: Coins, stats: [["支付", "10 USDC"], ["预计获得", "40 YD"], ["滑点", "0.5%"]], action: "兑换为 YD" },
  creator: { eyebrow: "CREATOR CENTER", title: "创作者中心", description: "提交课程、跟踪审核状态并查看自动分账收益。", icon: LayoutDashboard, stats: [["已发布课程", "4"], ["总学员", "2,486"], ["可提现", "1,264 YD"]], action: "提交新课程" },
  admin: { eyebrow: "ADMIN REVIEW", title: "教师资质与课程上架审核", description: "教师需管理员审核通过后才能开课；课程需管理员审核上架后才对外可见并写入链上。", icon: ClipboardCheck, stats: [["待审核教师", "3"], ["待上架课程", "8"], ["本周已上架", "12"]], action: "审核下一条申请" },
} as const;

export function FeaturePage({ type }: { type: keyof typeof configs }) {
  const config = configs[type];
  const Icon = config.icon;
  return (
    <div className="page-container feature-page">
      <div className="feature-heading"><span className="feature-icon"><Icon /></span><div><span className="overline">{config.eyebrow}</span><h1>{config.title}</h1><p>{config.description}</p></div></div>
      <div className="feature-stats">{config.stats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="feature-workspace"><div><h2>{type === "swap" ? "USDC → YD" : type === "creator" ? "课程与收益" : "待审核教师与课程"}</h2><p>页面结构已按 Stitch 设计系统建立，真实链上/API 操作将在对应模块配置完成后启用。</p><div className="placeholder-rows">{type === "admin" ? <><span><CheckCircle2 />教师提交入驻申请，管理员审核通过后才能开课</span><span><FilePlus2 />课程提交后进入待审核，管理员上架后才对外可见并上链</span><span><ShieldAlert />驳回与下架需填写理由，操作留痕可追溯</span></> : <><span><CheckCircle2 />角色与数据边界已定义</span><span><FilePlus2 />接口和状态模型待下一阶段接线</span><span><ShieldAlert />危险操作将要求钱包二次确认</span></>}</div></div><button className="button primary">{config.action}<ArrowRight size={18} /></button></div>
      <div className="split-card wide"><div><CircleDollarSign /><strong>固定分账模型</strong></div><div className="split-bar"><i /><i /><i /></div><ul><li><span>教师</span><strong>70%</strong></li><li><span>商家</span><strong>20%</strong></li><li><span>平台</span><strong>10%</strong></li></ul></div>
      <Link to="/" className="text-link">返回课程市场<ArrowRight size={16} /></Link>
    </div>
  );
}
