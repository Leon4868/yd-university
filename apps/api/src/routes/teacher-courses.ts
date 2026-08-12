import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { CreatorApplication } from "../domain/creator.js";
import { type AuthGuards, currentUser } from "../auth/guards.js";
import { fail, failValidation } from "../http/errors.js";
import type { CreatorRepository } from "../repositories/creator-repository.js";
import type { TeacherCourseRepository } from "../repositories/teacher-course-repository.js";
import { httpUrlSchema, idParamsSchema } from "./schemas.js";

const sectionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  originalTitle: z.string().trim().min(1).max(160).optional(),
  url: httpUrlSchema.optional(),
  durationSeconds: z.coerce.number().int().min(0).max(86_400).optional(),
});

const draftBodySchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, "slug 只能包含小写字母、数字与短横线"),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(500),
  category: z.string().trim().min(1).max(60),
  level: z.enum(["入门", "进阶", "高级"]),
  priceYD: z.string().trim().regex(/^[1-9][0-9]{0,29}$/, "priceYD 必须是正整数字符串"),
  coverTone: z.enum(["violet", "blue", "teal"]).optional(),
  courseUrl: httpUrlSchema.optional(),
  providerName: z.string().trim().min(1).max(60).optional(),
  sections: z.array(sectionSchema).max(200).optional(),
});

export async function registerTeacherCourseRoutes(
  app: FastifyInstance,
  guards: AuthGuards,
  creators: CreatorRepository,
  courses: TeacherCourseRepository,
) {
  /** 教师身份必须已通过审核，未通过一律 403 */
  async function resolveTeacher(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<CreatorApplication | null> {
    const teacher = await creators.findApproved(currentUser(request).id, "teacher");
    if (!teacher) {
      await fail(reply, 403, "FORBIDDEN", "教师身份尚未通过审核");
      return null;
    }
    return teacher;
  }

  app.get("/api/teacher/courses", { preHandler: guards.requireUser }, async (request, reply) => {
    const teacher = await resolveTeacher(request, reply);
    if (!teacher) {
      return reply;
    }
    return { data: await courses.listByTeacher(teacher.id) };
  });

  app.post("/api/teacher/courses", { preHandler: guards.requireUser }, async (request, reply) => {
    const teacher = await resolveTeacher(request, reply);
    if (!teacher) {
      return reply;
    }
    const parsed = draftBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return failValidation(reply, parsed.error);
    }
    const created = await courses.create({ teacherId: teacher.id, ...parsed.data });
    return reply.code(201).send({ data: created });
  });

  app.post("/api/teacher/courses/:id/submit", { preHandler: guards.requireUser }, async (request, reply) => {
    const teacher = await resolveTeacher(request, reply);
    if (!teacher) {
      return reply;
    }
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) {
      return failValidation(reply, params.error);
    }
    const existing = await courses.findById(params.data.id);
    if (!existing || existing.teacherId !== teacher.id) {
      return fail(reply, 404, "NOT_FOUND", "课程不存在");
    }
    const submitted = await courses.submit(params.data.id, teacher.id);
    if (!submitted) {
      return fail(reply, 409, "INVALID_STATE_TRANSITION", "只有草稿状态的课程可以提交审核");
    }
    return { data: submitted };
  });
}
