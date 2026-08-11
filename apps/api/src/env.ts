import "dotenv/config";

import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().max(65_535).default(3001),
    HOST: z.string().min(1).default("127.0.0.1"),
    COURSE_DATA_SOURCE: z.enum(["mock", "postgres"]).default("mock"),
    DATABASE_URL: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.COURSE_DATA_SOURCE === "postgres" && !value.DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required when COURSE_DATA_SOURCE=postgres",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
