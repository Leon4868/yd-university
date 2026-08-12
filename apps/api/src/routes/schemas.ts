import { z } from "zod";

export const idParamsSchema = z.object({ id: z.uuid() });

export const reasonBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const walletAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{40}$/, "钱包地址格式不正确");

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .regex(/^https?:\/\/.+/, "链接必须以 http(s):// 开头");
