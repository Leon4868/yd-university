import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { UserRole } from "../api/types.ts";
import { PanelState } from "../components/PanelState.tsx";
import { useAuth } from "./AuthContext.tsx";
import { roleHome, roleLabels } from "./permissions.ts";

export function AccessBoundary({ roles, children }: { roles?: readonly UserRole[]; children: ReactNode }) {
  const auth = useAuth();
  if (!auth.ready || (auth.authenticated && !auth.token) || auth.profileLoading) {
    return <AccessPage><PanelState title="正在确认身份" description="正在读取登录状态与角色权限。" /></AccessPage>;
  }
  if (!auth.authenticated) {
    return (
      <AccessPage>
        <PanelState title="请先登录" description="登录后才能访问该功能。" action={<button type="button" className="button primary small" onClick={auth.login}>登录</button>} />
      </AccessPage>
    );
  }
  if (auth.profileError || !auth.role) {
    return (
      <AccessPage>
        <PanelState tone="error" title="无法确认账号权限" description={auth.profileError ?? "角色信息暂不可用，请重试。"} action={<button type="button" className="button secondary small" onClick={auth.refreshProfile}>重新读取身份</button>} />
      </AccessPage>
    );
  }
  if (roles && !roles.includes(auth.role)) {
    return (
      <AccessPage>
        <PanelState
          tone="error"
          title="当前角色无权访问"
          description={`你当前以${roleLabels[auth.role]}身份登录，该页面未向此角色开放。`}
          action={<Link className="button secondary small" to={roleHome(auth.role)}>返回我的工作台</Link>}
        />
      </AccessPage>
    );
  }
  return children;
}

function AccessPage({ children }: { children: ReactNode }) {
  return <div className="page-container access-page">{children}</div>;
}
