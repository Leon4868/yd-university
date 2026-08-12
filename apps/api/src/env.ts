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
  })
  .superRefine((value, context) => {
    if (value.COURSE_DATA_SOURCE === "postgres" && !value.DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required when COURSE_DATA_SOURCE=postgres",
      });
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
