import type { AppEnv } from "../env.js";
import type { CourseRepository } from "./course-repository.js";
import { MockCourseRepository } from "./mock-course-repository.js";
import { PostgresCourseRepository } from "./postgres-course-repository.js";

export function createCourseRepository(env: AppEnv): CourseRepository {
  if (env.COURSE_DATA_SOURCE === "postgres") {
    if (!env.DATABASE_URL) {
      throw new Error("Validated PostgreSQL mode is missing DATABASE_URL");
    }
    return new PostgresCourseRepository(env.DATABASE_URL);
  }
  return new MockCourseRepository();
}
