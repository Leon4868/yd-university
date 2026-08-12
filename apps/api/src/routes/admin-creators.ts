import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { type AuthGuards, currentUser } from "../auth/guards.js";
import { fail, failValidation } from "../http/errors.js";
import type { CreatorRepository } from "../repositories/creator-repository.js";
import { toAdminCreatorView } from "./presenters.js";
import { idParamsSchema, reasonBodySchema } from "./schemas.js";

const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

export async function registerAdminCreatorRoutes(
  app: FastifyInstance,
  guards: AuthGuards,
  creators: CreatorRepository,
) {
  const requireAdmin = guards.requireRole("admin");

  app.get("/api/admin/creators", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return failValidation(reply, parsed.error);
    }
    const applications = await creators.listByStatus(parsed.data.status);
    return { data: applications.map(toAdminCreatorView) };
  });

  app.post("/api/admin/creators/:id/approve", { preHandler: requireAdmin }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) {
      return failValidation(reply, params.error);
    }
    const existing = await creators.findById(params.data.id);
    if (!existing) {
      return fail(reply, 404, "NOT_FOUND", "申请不存在");
    }
    const approved = await creators.approve(params.data.id, currentUser(request).id);
    if (!approved) {
      return fail(reply, 409, "INVALID_STATE_TRANSITION", "该申请已审核过，不能重复审核");
    }
    return { data: toAdminCreatorView(approved) };
  });

  app.post("/api/admin/creators/:id/reject", { preHandler: requireAdmin }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) {
      return failValidation(reply, params.error);
    }
    const body = reasonBodySchema.safeParse(request.body);
    if (!body.success) {
      return failValidation(reply, body.error);
    }
    const existing = await creators.findById(params.data.id);
    if (!existing) {
      return fail(reply, 404, "NOT_FOUND", "申请不存在");
    }
    const rejected = await creators.reject(params.data.id, currentUser(request).id, body.data.reason);
    if (!rejected) {
      return fail(reply, 409, "INVALID_STATE_TRANSITION", "该申请已审核过，不能重复审核");
    }
    return { data: toAdminCreatorView(rejected) };
  });
}
