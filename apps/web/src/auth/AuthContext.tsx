import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

export type UserRole = "student" | "teacher" | "merchant" | "admin";

interface AuthState {
  ready: boolean;
  authenticated: boolean;
  displayName: string;
  walletAddress: string | null;
  role: UserRole;
  demoMode: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID?.trim();
const hasConfiguredPrivy = Boolean(privyAppId && !privyAppId.startsWith("<"));

export function AuthProvider({ children }: { children: ReactNode }) {
  if (hasConfiguredPrivy && privyAppId) {
    return (
      <PrivyProvider
        appId={privyAppId}
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
  const { ready, authenticated, login, logout, user } = usePrivy();
  const value = useMemo<AuthState>(
    () => ({
      ready,
      authenticated,
      displayName: user?.email?.address?.split("@")[0] ?? "学习者",
      walletAddress: user?.wallet?.address ?? null,
      // 角色由后端审核结果下发，接线前统一按学生处理
      role: "student",
      demoMode: false,
      login: () => login(),
      logout: () => void logout(),
    }),
    [authenticated, login, logout, ready, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function DemoAuthBridge({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(true);
  const value = useMemo<AuthState>(
    () => ({
      ready: true,
      authenticated,
      displayName: "Leon",
      walletAddress: authenticated ? "0x72F40000000000000000000000000000000091A2" : null,
      role: "student",
      demoMode: true,
      login: () => setAuthenticated(true),
      logout: () => setAuthenticated(false),
    }),
    [authenticated],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
