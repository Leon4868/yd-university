import "dotenv/config";

import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().max(65_535).default(3001),
    HOST: z.string().min(1).default("127.0.0.1"),
    COURSE_DATA_SOURCE: z.enum(["mock", "postgres"]).default("mock"),
    DATABASE_URL: z.string().min(1).optional(),
    AUTH_MODE: z.enum(["demo", "privy"]).default("demo"),
    PRIVY_APP_ID: z.string().min(1).optional(),
    /** 令牌校验只用 JWKS 公钥，App Secret 仅将来调 Privy 服务端 API 取用户资料时才需要 */
    PRIVY_APP_SECRET: z.string().min(1).optional(),
    /** 逗号分隔的 privy_user_id 白名单，登录时提升为管理员，用于首次引导 */
    BOOTSTRAP_ADMIN_SUBJECTS: z.string().default(""),
    /** 逗号分隔的钱包白名单，必须来自已验证的 Privy identity token */
    BOOTSTRAP_ADMIN_WALLETS: z.string().default(""),
    /** address=role 逗号分隔映射，role 为 student/teacher/merchant/admin */
    WALLET_ROLE_MAPPINGS: z.string().default(""),
    /** on 时后端用独立钱包代发证书；缺任一配置都不要打开 */
    CERTIFICATE_ISSUANCE: z.enum(["off", "on"]).default("off"),
    SEPOLIA_RPC_URL: z.string().min(1).optional(),
    COURSE_CERTIFICATE_ADDRESS: z.string().optional(),
    /** 独立发证钱包私钥。只用于构造签名账户，任何时候都不打印、不入库、不进日志 */
    CERTIFICATE_ISSUER_PRIVATE_KEY: z.string().optional(),
    /** 兜底扫描间隔，用于重试失败的发证 */
    CERTIFICATE_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
  })
  .superRefine((value, context) => {
    if (value.COURSE_DATA_SOURCE === "postgres" && !value.DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required when COURSE_DATA_SOURCE=postgres",
      });
    }
    if (value.CERTIFICATE_ISSUANCE === "on") {
      if (!value.SEPOLIA_RPC_URL) {
        context.addIssue({
          code: "custom",
          path: ["SEPOLIA_RPC_URL"],
          message: "SEPOLIA_RPC_URL is required when CERTIFICATE_ISSUANCE=on",
        });
      }
      if (!/^0x[0-9a-fA-F]{40}$/.test(value.COURSE_CERTIFICATE_ADDRESS ?? "")) {
        context.addIssue({
          code: "custom",
          path: ["COURSE_CERTIFICATE_ADDRESS"],
          message: "COURSE_CERTIFICATE_ADDRESS must be a 0x-prefixed 20-byte address",
        });
      }
      // 只校验形状，绝不把私钥内容放进报错信息
      if (!/^0x[0-9a-fA-F]{64}$/.test(value.CERTIFICATE_ISSUER_PRIVATE_KEY ?? "")) {
        context.addIssue({
          code: "custom",
          path: ["CERTIFICATE_ISSUER_PRIVATE_KEY"],
          message: "CERTIFICATE_ISSUER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex private key",
        });
      }
    }
    if (value.AUTH_MODE !== "privy") {
      return;
    }
    if (!value.PRIVY_APP_ID) {
      context.addIssue({
        code: "custom",
        path: ["PRIVY_APP_ID"],
        message: "PRIVY_APP_ID is required when AUTH_MODE=privy",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
