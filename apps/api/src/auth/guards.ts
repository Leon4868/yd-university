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
): AuthGuards {
  const adminSubjects = new Set(bootstrapAdminSubjects);

  /** 白名单里的账号在登录时把管理员角色落库，之后请求仍只读 users.role */
  async function applyBootstrapAdmin(user: User, subject: string): Promise<User> {
    if (user.role === "admin" || !adminSubjects.has(subject)) {
      return user;
    }
    return users.promoteToAdmin(user.id);
  }

  const requireUser: AuthGuard = async (request, reply) => {
    if (request.currentUser) {
      return;
    }
    const token = readBearerToken(request.headers.authorization);
    if (!token) {
      return fail(reply, 401, "UNAUTHENTICATED", "缺少登录凭证");
    }
    const identity = await verifier.verify(token);
    if (!identity) {
      return fail(reply, 401, "UNAUTHENTICATED", "登录凭证无效");
    }
    const existing = await users.findByPrivyUserId(identity.subject);
    if (existing) {
      request.currentUser = await applyBootstrapAdmin(existing, identity.subject);
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
    request.currentUser = await applyBootstrapAdmin(provisioned, identity.subject);
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
