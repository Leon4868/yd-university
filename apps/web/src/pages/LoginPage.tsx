import { Award, BookOpenCheck, ShieldCheck, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.tsx";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const handleLogin = () => { auth.login(); navigate("/"); };
  const handleSwitchAccount = () => { auth.logout(); };
  return (
    <div className="login-page page-container">
      <div className="login-pitch"><span className="eyebrow">YD UNIVERSITY</span><h1>从学习开始，建立你的链上能力证明</h1><p>邮箱 / Google / GitHub / 钱包都可以进入。没有钱包时，Privy 可以为学习者创建嵌入式钱包。</p><div><span><BookOpenCheck />精选课程</span><span><Wallet />YD 购买</span><span><Award />不可转让证书</span></div></div>
      <div className="login-card"><span className="brand-mark large"><ShieldCheck /></span><h2>欢迎来到 YD University</h2><p>{auth.demoMode ? "当前未配置 Privy App ID，可在顶部切换学生、老师、商户和管理员演示身份。" : "使用 Privy 安全登录，支持邮箱 / Google / GitHub / 钱包。登录后角色由服务端账号权限决定。"}</p>{auth.loginError && <div className="login-error" role="alert">{auth.loginError}</div>}{auth.authenticated && !auth.demoMode ? <><p className="login-current">当前已登录：{auth.displayName}（{auth.role === "student" ? "学生" : auth.role === "teacher" ? "老师" : auth.role === "merchant" ? "商户" : "管理员"}）</p><button className="button secondary full" onClick={handleSwitchAccount}>退出并切换账号</button></> : <button className="button primary full" onClick={handleLogin}>使用邮箱 / Google / GitHub / 钱包继续</button>}<small>继续即表示你了解 Sepolia 测试代币没有真实价值。</small></div>
    </div>
  );
}
