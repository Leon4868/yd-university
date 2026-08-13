import type { FastifyReply, FastifyRequest } from "fastify";

import type { User, UserRole } from "../domain/user.js";
import type { UserRepository } from "../repositories/user-repository.js";
import { fail } from "../http/errors.js";
import type { AuthVerifier } from "./verifier.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser: User | null;
  }
}

export type AuthGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

export interface AuthGuards {
  requireUser: AuthGuard;
  requireRole: (...roles: UserRole[]) => AuthGuard;
}

/** 角色只认数据库里的 users.role，请求头与请求体中的角色声明一律忽略 */
export function createAuthGuards(
  verifier: AuthVerifier,
  users: UserRepository,
  bootstrapAdminSubjects: readonly string[] = [],
  bootstrapAdminWallets: readonly string[] = [],
  walletRoles: ReadonlyMap<string, UserRole> = new Map(),
): AuthGuards {
  const adminSubjects = new Set(bootstrapAdminSubjects);
  const adminWallets = new Set(bootstrapAdminWallets.map((wallet) => wallet.toLowerCase()));
  const configuredWalletRoles = new Map([...walletRoles].map(([wallet, role]) => [wallet.toLowerCase(), role]));

  function walletRole(wallet?: string | null): UserRole | undefined {
    if (!wallet) return undefined;
    const normalized = wallet.toLowerCase();
    return configuredWalletRoles.get(normalized) ?? (adminWallets.has(normalized) ? "admin" : undefined);
  }

  /** 只有后端验证过的钱包才能触发角色映射；从已映射钱包切走时回到学生身份，避免管理员权限残留 */
  async function applyVerifiedIdentity(user: User, subject: string, wallet?: string): Promise<User> {
    const previousWalletWasMapped = Boolean(walletRole(user.primaryWallet));
    const activeWalletRole = walletRole(wallet);
    const walletChanged = Boolean(wallet && user.primaryWallet?.toLowerCase() !== wallet.toLowerCase());
    const targetRole = adminSubjects.has(subject)
      ? "admin"
      : activeWalletRole ?? (walletChanged && previousWalletWasMapped ? "student" : undefined);

    let current = user;
    if (walletChanged && wallet) {
      current = await users.updatePrimaryWallet(user.id, wallet);
    }
    if (targetRole && current.role !== targetRole) {
      current = await users.setRole(current.id, targetRole);
    }
    return current;
  }

  const requireUser: AuthGuard = async (request, reply) => {
    if (request.currentUser) {
      return;
    }
    const token = readBearerToken(request.headers.authorization);
    if (!token) {
      return fail(reply, 401, "UNAUTHENTICATED", "缺少登录凭证");
    }
    const identity = await verifier.verify(
      token,
      readIdentityToken(request.headers["privy-id-token"]),
      readActiveWallet(request.headers["x-active-wallet"]),
    );
    if (!identity) {
      return fail(reply, 401, "UNAUTHENTICATED", "登录凭证无效");
    }
    const existing = await users.findByPrivyUserId(identity.subject);
    if (existing) {
      request.currentUser = await applyVerifiedIdentity(existing, identity.subject, identity.wallet);
      return;
    }
    if (!verifier.autoProvision) {
      return fail(reply, 401, "UNAUTHENTICATED", "账号不存在，请重新登录");
    }
    // 外部身份提供方校验通过但本地还没有账号，按学生建号；角色永远从 student 起步
    const provisioned = await users.provision({
      privyUserId: identity.subject,
      username: defaultUsername(identity.subject),
      primaryWallet: identity.wallet ?? null,
    });
    request.currentUser = await applyVerifiedIdentity(provisioned, identity.subject, identity.wallet);
  };

  const requireRole = (...roles: UserRole[]): AuthGuard =>
    async (request, reply) => {
      await requireUser(request, reply);
      const user = request.currentUser;
      if (!user) {
        return reply;
      }
      if (!roles.includes(user.role)) {
        return fail(reply, 403, "FORBIDDEN", "当前身份没有权限执行该操作");
      }
    };

  return { requireUser, requireRole };
}

export function currentUser(request: FastifyRequest): User {
  const user = request.currentUser;
  if (!user) {
    throw new Error("currentUser 只能在 requireUser 之后使用");
  }
  return user;
}

/** Privy 的 sub 形如 did:privy:cxxxx，取尾段生成占位用户名，长度受 users.username 限制 */
function defaultUsername(subject: string): string {
  const tail = subject.split(":").pop()?.trim() ?? "";
  const suffix = tail.slice(-6) || "新用户";
  return `学员_${suffix}`.slice(0, 50);
}

function readBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const matched = /^Bearer\s+(.+)$/i.exec(header.trim());
  return matched?.[1]?.trim() || null;
}

function readIdentityToken(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.trim() || undefined;
}

function readActiveWallet(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.trim() || undefined;
}
