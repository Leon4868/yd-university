import { GraduationCap, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.tsx";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
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
            <NavLink to="/creator">创作者中心</NavLink>
          </nav>
          <div className="wallet-cluster">
            {auth.demoMode && <span className="demo-badge">演示模式</span>}
            <span className="network-badge"><i />Ethereum Sepolia</span>
            <span className="balance"><WalletCards size={16} />128.40 YD</span>
            {auth.authenticated && auth.walletAddress ? (
              <Link to="/profile" className="wallet-button">{shortenAddress(auth.walletAddress)}</Link>
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
