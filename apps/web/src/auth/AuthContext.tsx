import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, getMe } from "../api/client.ts";
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
  role: UserRole;
  creator: CreatorApplication | null;
  token: string | null;
  demoMode: boolean;
  profileLoading: boolean;
  /** /api/me 取不到时的降级说明，UI 必须明示当前是本地演示身份 */
  profileError: string | null;
  demoIdentities: DemoIdentity[];
  demoUserId: string | null;
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
const demoIdentities: DemoIdentity[] = demoIdentityEnv
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .map((privyUserId) => ({ privyUserId, label: privyUserId }));
if (demoIdentities.length === 0) {
  demoIdentities.push(
    { privyUserId: "demo-student", label: "学生 demo-student" },
    { privyUserId: "demo-teacher", label: "教师 demo-teacher" },
    { privyUserId: "demo-merchant", label: "商家 demo-merchant" },
    { privyUserId: "demo-admin", label: "管理员 demo-admin" },
  );
}
const demoWallet = "0x72F40000000000000000000000000000000091A2";

interface Identity {
  ready: boolean;
  authenticated: boolean;
  token: string | null;
  demoMode: boolean;
  fallbackDisplayName: string;
  fallbackWallet: string | null;
  login: () => void;
  logout: () => void;
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
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
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
      fallbackDisplayName: user?.email?.address?.split("@")[0] ?? "学习者",
      fallbackWallet: user?.wallet?.address ?? null,
      login: () => login(),
      logout: () => void logout(),
    }),
    [authenticated, login, logout, ready, token, user],
  );
  return <ProfileBridge identity={identity} demo={null}>{children}</ProfileBridge>;
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
      fallbackDisplayName: demoIdentities.find((item) => item.privyUserId === demoUserId)?.label ?? demoUserId,
      fallbackWallet: authenticated ? demoWallet : null,
      login: () => setAuthenticated(true),
      logout: () => setAuthenticated(false),
    }),
    [authenticated, demoUserId],
  );
  const demo = useMemo<DemoControls>(() => ({ demoUserId, switchIdentity: setDemoUserId }), [demoUserId]);
  return <ProfileBridge identity={identity} demo={demo}>{children}</ProfileBridge>;
}

function ProfileBridge({ identity, demo, children }: { identity: Identity; demo: DemoControls | null; children: ReactNode }) {
  const [profile, setProfile] = useState<CurrentUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { authenticated, token } = identity;

  useEffect(() => {
    if (!authenticated || !token) {
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }
    const controller = new AbortController();
    setProfileLoading(true);
    getMe(token, controller.signal)
      .then((current) => {
        if (controller.signal.aborted) return;
        setProfile(current);
        setProfileError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setProfile(null);
        // 拿不到角色时降级为本地演示身份，不白屏，由 UI 明示降级
        setProfileError(error instanceof ApiError ? error.message : "读取账号信息失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setProfileLoading(false);
      });
    return () => controller.abort();
  }, [authenticated, token, reloadKey]);

  const refreshProfile = useCallback(() => setReloadKey((current) => current + 1), []);

  const value = useMemo<AuthState>(
    () => ({
      ready: identity.ready,
      authenticated: identity.authenticated,
      displayName: profile?.username ?? identity.fallbackDisplayName,
      walletAddress: profile?.primaryWallet ?? identity.fallbackWallet,
      role: profile?.role ?? "student",
      creator: profile?.creator ?? null,
      token: identity.token,
      demoMode: identity.demoMode,
      profileLoading,
      profileError,
      demoIdentities: identity.demoMode ? demoIdentities : [],
      demoUserId: demo?.demoUserId ?? null,
      switchDemoIdentity: (privyUserId: string) => demo?.switchIdentity(privyUserId),
      refreshProfile,
      login: identity.login,
      logout: identity.logout,
    }),
    [demo, identity, profile, profileError, profileLoading, refreshProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
