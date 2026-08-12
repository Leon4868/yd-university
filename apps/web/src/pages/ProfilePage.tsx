import { Award, BookOpen, CheckCircle2, ExternalLink, Pencil, Shield, WalletCards } from "lucide-react";

import { useAuth } from "../auth/AuthContext.tsx";
import { sepoliaCertificateUrl } from "../web3/contracts.ts";
import { displayYdBalance, useYdBalance } from "../web3/useYdBalance.ts";

export function ProfilePage() {
  const auth = useAuth();
  const ydBalance = useYdBalance();
  return (
    <div className="page-container profile-page">
      <div className="profile-heading"><div><span className="overline">LEARNING PROFILE</span><h1>个人中心</h1><p>管理你的学习档案、钱包与链上证书。</p></div></div>
      <div className="profile-card"><span className="avatar large">L</span><div><h2>{auth.displayName}</h2><span>{auth.demoMode ? "本地演示身份" : "Privy 已验证用户"}</span><p>{auth.walletAddress ?? "尚未绑定钱包"}</p></div><button className="button secondary"><Pencil size={17} />编辑用户名</button><button className="button secondary"><Shield size={17} />签名验证钱包</button></div>
      <div className="profile-stats"><div><WalletCards /><span>YD 余额</span><strong title={ydBalance.error ?? undefined}>{displayYdBalance(ydBalance.balance)}</strong></div><div><BookOpen /><span>学习中</span><strong>3</strong></div><div><Award /><span>已获得证书</span><strong>2</strong></div></div>
      <div className="profile-grid">
        <section className="content-block"><div className="block-heading"><h2>继续学习</h2><span>查看全部</span></div><div className="profile-course"><div className="mini-cover violet">SOL</div><div><strong>Solidity 智能合约开发从入门到实战</strong><span>下一节：部署你的第一个合约</span><div className="progress"><i style={{ width: "72%" }} /></div></div><b>72%</b></div><div className="profile-course"><div className="mini-cover blue">DeFi</div><div><strong>DeFi 核心原理与协议拆解（Uniswap V2 源码精讲）</strong><span>下一节：恒定乘积曲线图解</span><div className="progress"><i style={{ width: "35%" }} /></div></div><b>35%</b></div></section>
        <section className="certificate-panel"><div className="certificate-top"><span><Award /></span><small>YD UNIVERSITY</small><b>不可转让</b></div><h2>Solidity 智能合约入门证书</h2><p>授予 <strong>{auth.displayName}</strong>，证明已完成全部课程学习。</p><div><span>课程 ID</span><strong>#1</strong><span>签发网络</span><strong>Sepolia</strong></div><a className="button secondary full" href={sepoliaCertificateUrl(1)} target="_blank" rel="noreferrer">在区块浏览器验证<ExternalLink size={16} /></a></section>
      </div>
      <div className="security-note"><CheckCircle2 /><span>签名仅用于验证钱包归属，不会转移资产，也不会授权课程付款。</span></div>
    </div>
  );
}
