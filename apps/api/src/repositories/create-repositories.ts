import postgres from "postgres";

import type { AppEnv } from "../env.js";
import type { AdminCourseRepository } from "./admin-course-repository.js";
import type { CourseRepository } from "./course-repository.js";
import type { CreatorRepository } from "./creator-repository.js";
import type { MerchantCourseRepository } from "./merchant-course-repository.js";
import type { ProgressRepository } from "./progress-repository.js";
import { MockAdminCourseRepository } from "./mock-admin-course-repository.js";
import { MockCourseRepository } from "./mock-course-repository.js";
import { MockCreatorRepository } from "./mock-creator-repository.js";
import { MockMerchantCourseRepository } from "./mock-merchant-course-repository.js";
import { MockDataStore } from "./mock-store.js";
import { MockProgressRepository } from "./mock-progress-repository.js";
import { MockTeacherCourseRepository } from "./mock-teacher-course-repository.js";
import { MockUserRepository } from "./mock-user-repository.js";
import { PostgresAdminCourseRepository } from "./postgres-admin-course-repository.js";
import { PostgresCourseRepository } from "./postgres-course-repository.js";
import { PostgresCreatorRepository } from "./postgres-creator-repository.js";
import { PostgresMerchantCourseRepository } from "./postgres-merchant-course-repository.js";
import { PostgresProgressRepository } from "./postgres-progress-repository.js";
import { PostgresTeacherCourseRepository } from "./postgres-teacher-course-repository.js";
import { PostgresUserRepository } from "./postgres-user-repository.js";
import type { TeacherCourseRepository } from "./teacher-course-repository.js";
import type { UserRepository } from "./user-repository.js";

export interface Repositories {
  courses: CourseRepository;
  users: UserRepository;
  creators: CreatorRepository;
  adminCourses: AdminCourseRepository;
  teacherCourses: TeacherCourseRepository;
  merchantCourses: MerchantCourseRepository;
  progress: ProgressRepository;
}

export function createMockRepositories(store: MockDataStore = new MockDataStore()): Repositories {
  return {
    courses: new MockCourseRepository(store),
    users: new MockUserRepository(store),
    creators: new MockCreatorRepository(store),
    adminCourses: new MockAdminCourseRepository(store),
    teacherCourses: new MockTeacherCourseRepository(store),
    merchantCourses: new MockMerchantCourseRepository(store),
    progress: new MockProgressRepository(store),
  };
}

export function createRepositories(env: AppEnv): Repositories {
  if (env.COURSE_DATA_SOURCE !== "postgres") {
    return createMockRepositories();
  }
  if (!env.DATABASE_URL) {
    throw new Error("Validated PostgreSQL mode is missing DATABASE_URL");
  }
  // 所有仓储共用一个连接池
  const sql = postgres(env.DATABASE_URL, { max: 10 });
  return {
    courses: new PostgresCourseRepository(sql),
    users: new PostgresUserRepository(sql),
    creators: new PostgresCreatorRepository(sql),
    adminCourses: new PostgresAdminCourseRepository(sql),
    teacherCourses: new PostgresTeacherCourseRepository(sql),
    merchantCourses: new PostgresMerchantCourseRepository(sql),
    progress: new PostgresProgressRepository(sql),
  };
}
