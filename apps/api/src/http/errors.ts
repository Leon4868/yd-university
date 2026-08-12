import type { FastifyReply } from "fastify";
import type { ZodError } from "zod";

/** 契约统一错误形状 { error, message } */
export function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: code, message });
}

export function failValidation(reply: FastifyReply, error: ZodError) {
  const issue = error.issues[0];
  if (!issue) {
    return fail(reply, 400, "INVALID_REQUEST", "参数校验失败");
  }
  const path = issue.path.join(".");
  return fail(reply, 400, "INVALID_REQUEST", path ? `${path}: ${issue.message}` : issue.message);
}
