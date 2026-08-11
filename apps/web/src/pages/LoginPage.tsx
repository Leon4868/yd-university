import { Award, BookOpenCheck, ShieldCheck, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.tsx";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const handleLogin = () => { auth.login(); navigate("/"); };
  return (
    <div className="login-page page-container">
      <div className="login-pitch"><span className="eyebrow">YD UNIVERSITY</span><h1>从学习开始，建立你的链上能力证明</h1><p>邮箱或钱包都可以进入。没有钱包时，Privy 可以为学习者创建嵌入式钱包。</p><div><span><BookOpenCheck />精选课程</span><span><Wallet />YD 购买</span><span><Award />不可转让证书</span></div></div>
      <div className="login-card"><span className="brand-mark large"><ShieldCheck /></span><h2>欢迎来到 YD University</h2><p>{auth.demoMode ? "当前未配置 Privy App ID，将进入本地演示身份。" : "使用 Privy 安全登录。"}</p><button className="button primary full" onClick={handleLogin}>使用邮箱或钱包继续</button><small>继续即表示你了解 Sepolia 测试代币没有真实价值。</small></div>
    </div>
  );
}
