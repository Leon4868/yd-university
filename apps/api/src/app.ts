import cors from "@fastify/cors";
import Fastify from "fastify";

import type { CourseRepository } from "./repositories/course-repository.js";
import { MockCourseRepository } from "./repositories/mock-course-repository.js";
import { registerCourseRoutes } from "./routes/courses.js";

interface BuildAppOptions {
  courseRepository?: CourseRepository;
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const courseRepository = options.courseRepository ?? new MockCourseRepository();

  await app.register(cors, {
    origin: ["http://localhost:5173"],
    methods: ["GET"],
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "yd-university-api",
  }));

  await registerCourseRoutes(app, courseRepository);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.code(500).send({ error: "INTERNAL_SERVER_ERROR" });
  });

  return app;
}
