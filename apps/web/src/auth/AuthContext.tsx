import { PrivyProvider, useActiveWallet, useIdentityToken, useLogin, usePrivy, useWallets, type EIP1193Provider } from "@privy-io/react-auth";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, getMe, setApiIdentity } from "../api/client.ts";
import type { CreatorApplication, CurrentUser, UserRole } from "../api/types.ts";

export type { UserRole };

export interface DemoIdentity {
  privyUserId: string;
  label: string;
}

interface AuthState {
  ready: boolean;
  authenticated: boolean;
  displayName: string;
  walletAddress: string | null;
  role: UserRole | null;
  creator: CreatorApplication | null;
  token: string | null;
  demoMode: boolean;
  profileLoading: boolean;
  /** /api/me 取不到时的降级说明，UI 必须明示当前是本地演示身份 */
  profileError: string | null;
  loginError: string | null;
  demoIdentities: DemoIdentity[];
  demoUserId: string | null;
  walletReady: boolean;
  getEthereumProvider: (() => Promise<EIP1193Provider>) | null;
  switchEthereumChain: ((chainId: number) => Promise<void>) | null;
  switchDemoIdentity: (privyUserId: string) => void;
  refreshProfile: () => void;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const privyAppId: string = import.meta.env.VITE_PRIVY_APP_ID ?? "";
const hasConfiguredPrivy = Boolean(privyAppId.trim() && !privyAppId.trim().startsWith("<"));
const TOKEN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// 仅本地开发用：demo 模式下 token 形如 demo:<privy_user_id>，对应后端 DemoAuthVerifier。
// 这里只决定「用哪个 subject 发请求」，真实角色始终由 /api/me 的 users.role 决定，
// 换身份换不出权限，后端 AUTH_MODE=privy 时整块入口不会出现。
const demoIdentityEnv: string = import.meta.env.VITE_DEMO_USER_IDS ?? "";
const demoRoleLabels: Record<string, string> = {
  "demo-student": "学生",
  "demo-teacher": "老师",
  "demo-merchant": "商户",
  "demo-admin": "管理员",
};
const demoIdentities: DemoIdentity[] = demoIdentityEnv
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .map((privyUserId) => ({ privyUserId, label: demoRoleLabels[privyUserId] ?? privyUserId }));
if (demoIdentities.length === 0) {
  demoIdentities.push(
    { privyUserId: "demo-student", label: "学生" },
    { privyUserId: "demo-teacher", label: "老师" },
    { privyUserId: "demo-merchant", label: "商户" },
    { privyUserId: "demo-admin", label: "管理员" },
  );
}
const demoWallet = "0x72F40000000000000000000000000000000091A2";

interface Identity {
  ready: boolean;
  authenticated: boolean;
  token: string | null;
  demoMode: boolean;
  loginError: string | null;
  identityToken: string | null;
  activeWalletAddress: string | null;
  fallbackDisplayName: string;
  fallbackWallet: string | null;
  login: () => void;
  logout: () => void;
  getEthereumProvider: (() => Promise<EIP1193Provider>) | null;
  switchEthereumChain: ((chainId: number) => Promise<void>) | null;
}

interface DemoControls {
  demoUserId: string;
  switchIdentity: (privyUserId: string) => void;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (hasConfiguredPrivy) {
    return (
      <PrivyProvider
        appId={privyAppId.trim()}
        config={{
          appearance: { theme: "light", accentColor: "#5B5CE2" },
          loginMethods: ["email", "google", "github", "wallet"],
        }}
      >
        <PrivyAuthBridge>{children}</PrivyAuthBridge>
      </PrivyProvider>
    );
  }
  return <DemoAuthBridge>{children}</DemoAuthBridge>;
}

function PrivyAuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, logout, user, getAccessToken } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { wallet: activeWallet } = useActiveWallet();
  const { wallets, ready: walletsReady } = useWallets();
  const [loginError, setLoginError] = useState<string | null>(null);
  const { login: openLogin } = useLogin({
    onError: (error) => setLoginError(formatPrivyLoginError(String(error))),
  });
  const ethereumWallet = activeWallet?.type === "ethereum"
    ? activeWallet
    : wallets.find((wallet) => wallet.type === "ethereum");
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (!authenticated) {
      setToken(null);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void getAccessToken().then((value) => { if (!cancelled) setToken(value); });
    };
    refresh();
    // Privy access token 约 1 小时过期，定时重取避免长时间停留后全站 401
    const timer = window.setInterval(refresh, TOKEN_REFRESH_INTERVAL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [authenticated, getAccessToken]);
  const identity = useMemo<Identity>(
    () => ({
      ready,
      authenticated,
      token,
      demoMode: false,
      loginError,
      identityToken,
      activeWalletAddress: ethereumWallet?.address ?? null,
      fallbackDisplayName: user?.email?.address?.split("@")[0] ?? "学习者",
      fallbackWallet: ethereumWallet?.address ?? user?.wallet?.address ?? null,
      login: () => { setLoginError(null); openLogin(); },
      logout: () => { setLoginError(null); void logout(); },
      getEthereumProvider: ethereumWallet ? () => ethereumWallet.getEthereumProvider() : null,
      switchEthereumChain: ethereumWallet ? (chainId: number) => ethereumWallet.switchChain(chainId) : null,
    }),
    [authenticated, ethereumWallet, identityToken, loginError, logout, openLogin, ready, token, user],
  );
  return <ProfileBridge identity={identity} demo={null} walletReady={walletsReady}>{children}</ProfileBridge>;
}

function DemoAuthBridge({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(true);
  const [demoUserId, setDemoUserId] = useState(demoIdentities[0]?.privyUserId ?? "demo-student");
  const identity = useMemo<Identity>(
    () => ({
      ready: true,
      authenticated,
      token: authenticated ? `demo:${demoUserId}` : null,
      demoMode: true,
      loginError: null,
      identityToken: null,
      activeWalletAddress: null,
      fallbackDisplayName: demoIdentities.find((item) => item.privyUserId === demoUserId)?.label ?? demoUserId,
      fallbackWallet: authenticated ? demoWallet : null,
      login: () => setAuthenticated(true),
      logout: () => setAuthenticated(false),
      getEthereumProvider: null,
      switchEthereumChain: null,
    }),
    [authenticated, demoUserId],
  );
  const demo = useMemo<DemoControls>(() => ({ demoUserId, switchIdentity: setDemoUserId }), [demoUserId]);
  return <ProfileBridge identity={identity} demo={demo} walletReady={false}>{children}</ProfileBridge>;
}

function ProfileBridge({ identity, demo, walletReady, children }: { identity: Identity; demo: DemoControls | null; walletReady: boolean; children: ReactNode }) {
  const [profile, setProfile] = useState<CurrentUser | null>(null);
  const [profileIdentityKey, setProfileIdentityKey] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { authenticated, token } = identity;
  const identityKey = `${token ?? ""}|${identity.identityToken ?? ""}|${identity.activeWalletAddress?.toLowerCase() ?? ""}`;

  useEffect(() => {
    setApiIdentity(identity.identityToken, identity.activeWalletAddress);
    return () => setApiIdentity(null, null);
  }, [identity.activeWalletAddress, identity.identityToken]);

  useEffect(() => {
    if (!authenticated || !token) {
      setProfile(null);
      setProfileIdentityKey(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }
    const controller = new AbortController();
    setProfileLoading(true);
    getMe(
      token,
      controller.signal,
      identity.identityToken,
      identity.identityToken ? identity.activeWalletAddress : null,
    )
      .then((current) => {
        if (controller.signal.aborted) return;
        setProfile(current);
        setProfileError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setProfile(null);
        // 拿不到角色时不猜测身份，由路由边界明确阻止访问并提供重试
        setProfileError(error instanceof ApiError ? error.message : "读取账号信息失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setProfileIdentityKey(identityKey);
          setProfileLoading(false);
        }
      });
    return () => controller.abort();
  }, [authenticated, identity.activeWalletAddress, identity.identityToken, identityKey, token, reloadKey]);

  const refreshProfile = useCallback(() => setReloadKey((current) => current + 1), []);
  const profileIsCurrent = profileIdentityKey === identityKey;
  const currentProfile = profileIsCurrent ? profile : null;
  const currentProfileError = profileIsCurrent ? profileError : null;
  const isChangingIdentity = Boolean(authenticated && token && !profileIsCurrent);

  const value = useMemo<AuthState>(
    () => ({
      ready: identity.ready,
      authenticated: identity.authenticated,
      displayName: currentProfile?.username ?? identity.fallbackDisplayName,
      walletAddress: currentProfile?.primaryWallet ?? identity.fallbackWallet,
      role: identity.authenticated ? currentProfile?.role ?? null : null,
      creator: identity.authenticated ? currentProfile?.creator ?? null : null,
      token: identity.token,
      demoMode: identity.demoMode,
      profileLoading: profileLoading || isChangingIdentity,
      profileError: currentProfileError,
      loginError: identity.loginError,
      demoIdentities: identity.demoMode ? demoIdentities : [],
      demoUserId: demo?.demoUserId ?? null,
      walletReady,
      getEthereumProvider: identity.getEthereumProvider,
      switchEthereumChain: identity.switchEthereumChain,
      switchDemoIdentity: (privyUserId: string) => demo?.switchIdentity(privyUserId),
      refreshProfile,
      login: identity.login,
      logout: identity.logout,
    }),
    [currentProfile, currentProfileError, demo, identity, isChangingIdentity, profileLoading, refreshProfile, walletReady],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function formatPrivyLoginError(error: string) {
  if (error === "disallowed_login_method") {
    return "Google 或 GitHub 登录尚未在 Privy 控制台启用，请在 Login methods → Socials 中打开后重试。";
  }
  if (error === "user_rejected") {
    return "你取消了登录授权。";
  }
  return `登录失败（${error}），请稍后重试。`;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
