import { buildApp } from "./app.js";
import { readEnv } from "./env.js";
import { createCourseRepository } from "./repositories/create-course-repository.js";

const env = readEnv();
const courseRepository = createCourseRepository(env);
const app = await buildApp({ courseRepository, logger: true });

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
