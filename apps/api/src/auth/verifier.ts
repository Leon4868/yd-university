import { createRemoteJWKSet, jwtVerify } from "jose";

import type { AppEnv } from "../env.js";

export interface VerifiedIdentity {
  /** 对应 users.privy_user_id */
  subject: string;
  email?: string;
  wallet?: string;
}

export interface AuthVerifier {
  verify(token: string, identityToken?: string): Promise<VerifiedIdentity | null>;
  /** 校验通过但库里没有该 subject 时，是否按学生自动建号。demo 模式不建，避免任意字符串开号 */
  readonly autoProvision: boolean;
}

const DEMO_TOKEN_PREFIX = "demo:";

/** 本地联调用：token 形如 demo:<privy_user_id>，不做任何签名校验 */
export class DemoAuthVerifier implements AuthVerifier {
  readonly autoProvision = false;

  async verify(token: string, _identityToken?: string): Promise<VerifiedIdentity | null> {
    if (!token.startsWith(DEMO_TOKEN_PREFIX)) {
      return null;
    }
    const subject = token.slice(DEMO_TOKEN_PREFIX.length).trim();
    return subject ? { subject } : null;
  }
}

const PRIVY_ISSUER = "privy.io";
const jwksUrl = (appId: string) => new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`);

/**
 * 校验 Privy 签发的访问令牌（ES256）。公钥取自该 App 的 JWKS 端点，
 * 所以只需要 App ID；App Secret 仅在将来调用 Privy 服务端 API 取用户资料时才需要。
 */
export class PrivyAuthVerifier implements AuthVerifier {
  readonly autoProvision = true;
  private readonly appId: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(appId: string | undefined) {
    if (!appId) {
      throw new Error("AUTH_MODE=privy requires PRIVY_APP_ID");
    }
    this.appId = appId;
    this.jwks = createRemoteJWKSet(jwksUrl(appId));
  }

  async verify(token: string, identityToken?: string): Promise<VerifiedIdentity | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: PRIVY_ISSUER,
        audience: this.appId,
        algorithms: ["ES256"],
      });
      const subject = payload.sub?.trim();
      if (!subject) return null;
      const wallet = identityToken ? await this.readWallet(subject, identityToken) : null;
      return { subject, wallet: wallet ?? undefined };
    } catch {
      // 签名、过期、issuer/audience 不匹配都归为「凭证无效」，不区分原因以免探测
      return null;
    }
  }

  private async readWallet(subject: string, identityToken: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(identityToken, this.jwks, {
        issuer: PRIVY_ISSUER,
        audience: this.appId,
        algorithms: ["ES256"],
      });
      if (payload.sub !== subject || typeof payload.linked_accounts !== "string") return null;
      const linkedAccounts: unknown = JSON.parse(payload.linked_accounts);
      if (!Array.isArray(linkedAccounts)) return null;
      const account = linkedAccounts.find((item) => {
        if (typeof item !== "object" || item === null) return false;
        const value = item as { type?: unknown; address?: unknown };
        return value.type === "wallet" && typeof value.address === "string" && /^0x[0-9a-fA-F]{40}$/.test(value.address);
      }) as { address: string } | undefined;
      return account?.address ?? null;
    } catch {
      return null;
    }
  }
}

export function createAuthVerifier(env: AppEnv): AuthVerifier {
  if (env.AUTH_MODE === "privy") {
    return new PrivyAuthVerifier(env.PRIVY_APP_ID);
  }
  return new DemoAuthVerifier();
}
