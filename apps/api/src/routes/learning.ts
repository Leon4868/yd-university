import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { CertificateIssuer } from "../chain/certificate-issuer.js";
import type { CourseDetail } from "../domain/course.js";
import { type AuthGuards, currentUser } from "../auth/guards.js";
import { fail, failValidation } from "../http/errors.js";
import type { CourseRepository } from "../repositories/course-repository.js";
import type { ProgressRepository } from "../repositories/progress-repository.js";
import { toCourseProgress } from "./presenters.js";

const slugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, "slug 只能包含小写字母、数字与短横线"),
});

const sectionParamsSchema = slugParamsSchema.extend({ sectionId: z.uuid() });

const SECTION_PATH = "/api/learning/courses/:slug/sections/:sectionId/complete";

export async function registerLearningRoutes(
  app: FastifyInstance,
  guards: AuthGuards,
  courses: CourseRepository,
  progress: ProgressRepository,
  certificates: CertificateIssuer,
) {
  const requireLearner = guards.requireRole("student", "teacher", "merchant");
  /** 只有已上架课程可学，未上架与不存在一律 404，不泄露存在性 */
  async function resolvePublished(slug: string, reply: FastifyReply): Promise<CourseDetail | null> {
    const course = await courses.findPublishedDetailBySlug(slug);
    if (!course) {
      await fail(reply, 404, "NOT_FOUND", "课程不存在");
      return null;
    }
    return course;
  }

  async function readProgress(userId: string, course: CourseDetail) {
    return { data: toCourseProgress(course, await progress.listByCourse(userId, course.id)) };
  }

  /** 完成与取消完成只差一次写入，校验与响应完全一致 */
  function sectionHandler(mutate: (userId: string, sectionId: string) => Promise<void>) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const params = sectionParamsSchema.safeParse(request.params);
      if (!params.success) {
        return failValidation(reply, params.error);
      }
      const course = await resolvePublished(params.data.slug, reply);
      if (!course) {
        return reply;
      }
      if (!course.sections.some((section) => section.id === params.data.sectionId)) {
        return fail(reply, 404, "NOT_FOUND", "小节不存在");
      }
      const userId = currentUser(request).id;
      await mutate(userId, params.data.sectionId);
      const result = await readProgress(userId, course);
      // 学完最后一节立刻触发发证；kick 不阻塞，发证失败由兜底扫描重试，不影响本次响应。
      // 取消完成只会让 percent 下降，所以这里天然只在 POST 完成路径上触发。
      if (result.data.completed) {
        certificates.kick();
      }
      return result;
    };
  }

  app.get(
    "/api/learning/courses/:slug/progress",
    { preHandler: requireLearner },
    async (request, reply) => {
      const params = slugParamsSchema.safeParse(request.params);
      if (!params.success) {
        return failValidation(reply, params.error);
      }
      const course = await resolvePublished(params.data.slug, reply);
      if (!course) {
        return reply;
      }
      return readProgress(currentUser(request).id, course);
    },
  );

  app.post(
    SECTION_PATH,
    { preHandler: requireLearner },
    sectionHandler((userId, sectionId) => progress.complete(userId, sectionId)),
  );

  app.delete(
    SECTION_PATH,
    { preHandler: requireLearner },
    sectionHandler((userId, sectionId) => progress.uncomplete(userId, sectionId)),
  );
}
