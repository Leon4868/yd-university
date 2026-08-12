import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { type AuthGuards, currentUser } from "../auth/guards.js";
import { fail, failValidation } from "../http/errors.js";
import type { AdminCourseRepository } from "../repositories/admin-course-repository.js";
import { idParamsSchema, reasonBodySchema } from "./schemas.js";

const listQuerySchema = z.object({
  status: z.enum(["draft", "review", "published", "archived"]).default("review"),
});

export async function registerAdminCourseRoutes(
  app: FastifyInstance,
  guards: AuthGuards,
  courses: AdminCourseRepository,
) {
  const requireAdmin = guards.requireRole("admin");

  app.get("/api/admin/courses", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return failValidation(reply, parsed.error);
    }
    return { data: await courses.listByStatus(parsed.data.status) };
  });

  app.post("/api/admin/courses/:id/publish", { preHandler: requireAdmin }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) {
      return failValidation(reply, params.error);
    }
    const existing = await courses.findById(params.data.id);
    if (!existing) {
      return fail(reply, 404, "NOT_FOUND", "课程不存在");
    }
    const published = await courses.publish(params.data.id, currentUser(request).id);
    if (!published) {
      return fail(reply, 409, "INVALID_STATE_TRANSITION", "只有待审核的课程可以上架");
    }
    return { data: published };
  });

  app.post("/api/admin/courses/:id/reject", { preHandler: requireAdmin }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) {
      return failValidation(reply, params.error);
    }
    const body = reasonBodySchema.safeParse(request.body);
    if (!body.success) {
      return failValidation(reply, body.error);
    }
    const existing = await courses.findById(params.data.id);
    if (!existing) {
      return fail(reply, 404, "NOT_FOUND", "课程不存在");
    }
    const rejected = await courses.reject(params.data.id, currentUser(request).id, body.data.reason);
    if (!rejected) {
      return fail(reply, 409, "INVALID_STATE_TRANSITION", "只有待审核的课程可以驳回");
    }
    return { data: rejected };
  });
}
