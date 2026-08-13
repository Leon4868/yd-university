import { GraduationCap, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.tsx";
import { creatorCenterLabel, roleLabels } from "../auth/permissions.ts";
import { learnEntrySlug, usePurchasedCourses } from "../web3/usePurchasedCourses.ts";
import { displayYdBalance, useYdBalance } from "../web3/useYdBalance.ts";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const ydBalance = useYdBalance();
  const purchased = usePurchasedCourses();
  const navigate = useNavigate();
  const hasRole = auth.authenticated && auth.role !== null && !auth.profileError;
  // 管理员不参与学习；其余角色都要先在链上买过课，入口才出现
  const learnSlug = hasRole && auth.role !== "admin" ? learnEntrySlug(purchased) : null;
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
            {learnSlug && <NavLink to={`/learn/${learnSlug}`}>我的学习</NavLink>}
            {hasRole && (auth.role === "student" || auth.role === "teacher" || auth.role === "merchant") && <NavLink to="/creator">{creatorCenterLabel(auth.role)}</NavLink>}
            {hasRole && auth.role === "admin" && <NavLink to="/admin">管理后台</NavLink>}
          </nav>
          <div className="wallet-cluster">
            {auth.authenticated && auth.demoMode && auth.demoIdentities.length > 0 && (
              <label className="demo-switch">
                <span className="demo-badge">演示模式</span>
                <select value={auth.demoUserId ?? ""} aria-label="切换演示身份" onChange={(event) => auth.switchDemoIdentity(event.target.value)}>
                  {auth.demoIdentities.map((item) => <option key={item.privyUserId} value={item.privyUserId}>{item.label}</option>)}
                </select>
              </label>
            )}
            <span className="network-badge"><i />Ethereum Sepolia</span>
            {auth.authenticated && <span className="balance" title={ydBalance.error ?? undefined}><WalletCards size={16} />{displayYdBalance(ydBalance.balance)} YD</span>}
            {auth.authenticated ? (
              <>
                <Link to="/profile" className="wallet-button" title={auth.role ? `当前身份：${roleLabels[auth.role]}` : "正在确认身份"}>
                  {auth.walletAddress ? shortenAddress(auth.walletAddress) : auth.displayName} · {auth.role ? roleLabels[auth.role] : "身份确认中"}
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
