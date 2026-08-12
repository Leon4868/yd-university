import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { CourseRepository } from "../repositories/course-repository.js";

const courseParamsSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
});

export async function registerCourseRoutes(app: FastifyInstance, repository: CourseRepository) {
  app.get("/api/courses", async () => {
    const courses = await repository.listPublished();
    return { data: courses };
  });

  app.get("/api/courses/:slug", async (request, reply) => {
    const parsed = courseParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_COURSE_SLUG" });
    }
    const course = await repository.findPublishedDetailBySlug(parsed.data.slug);
    if (!course) {
      return reply.code(404).send({ error: "COURSE_NOT_FOUND" });
    }
    return { data: course };
  });
}
