import { GraduationCap, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.tsx";
import { displayYdBalance, useYdBalance } from "../web3/useYdBalance.ts";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const roleLabels = {
  student: "学生",
  teacher: "老师",
  merchant: "商户",
  admin: "管理员",
} as const;

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const ydBalance = useYdBalance();
  const navigate = useNavigate();
  const isAdmin = auth.authenticated && auth.role === "admin";
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="YD University 首页">
            <span className="brand-mark"><GraduationCap size={21} /></span>
            <span>YD University</span>
          </Link>
          <nav className="main-nav" aria-label="主导航">
            <NavLink to="/">课程</NavLink>
            <NavLink to="/learn/solidity-from-zero">我的学习</NavLink>
            {auth.authenticated && <NavLink to="/creator">创作者中心</NavLink>}
            {isAdmin && <NavLink to="/admin">管理后台</NavLink>}
          </nav>
          <div className="wallet-cluster">
            {auth.demoMode && auth.demoIdentities.length > 0 && (
              <label className="demo-switch">
                <span className="demo-badge">演示模式</span>
                <select value={auth.demoUserId ?? ""} aria-label="切换演示身份" onChange={(event) => auth.switchDemoIdentity(event.target.value)}>
                  {auth.demoIdentities.map((item) => <option key={item.privyUserId} value={item.privyUserId}>{item.label}</option>)}
                </select>
              </label>
            )}
            <span className="network-badge"><i />Ethereum Sepolia</span>
            <span className="balance" title={ydBalance.error ?? undefined}><WalletCards size={16} />{displayYdBalance(ydBalance.balance)} YD</span>
            {auth.authenticated ? (
              <>
                <Link to="/profile" className="wallet-button" title={`当前身份：${roleLabels[auth.role]}`}>
                  {auth.walletAddress ? shortenAddress(auth.walletAddress) : auth.displayName} · {roleLabels[auth.role]}
                </Link>
                <button type="button" className="logout-button" onClick={() => { auth.logout(); navigate("/login"); }}>退出登录</button>
              </>
            ) : (
              <button type="button" className="wallet-button" onClick={auth.login}>登录</button>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="page-container footer-inner">
          <span>© 2026 YD University</span>
          <span>Learn. Verify. Own your progress.</span>
          <span>Sepolia 测试代币没有真实价值</span>
        </div>
      </footer>
    </div>
  );
}
