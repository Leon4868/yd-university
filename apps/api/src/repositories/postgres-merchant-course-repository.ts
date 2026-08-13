import type { Sql } from "postgres";

import type { ManagedCourse } from "../domain/course.js";
import type { MerchantCourseRepository } from "./merchant-course-repository.js";
import { queryManagedCourses } from "./postgres-managed-course.js";

export class PostgresMerchantCourseRepository implements MerchantCourseRepository {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  async listByMerchant(merchantId: string): Promise<ManagedCourse[]> {
    return queryManagedCourses(this.sql, { merchantId });
  }
}
