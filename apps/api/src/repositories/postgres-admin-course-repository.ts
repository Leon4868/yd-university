import type { Sql } from "postgres";

import type { CourseSummary, ManagedCourse } from "../domain/course.js";
import type { AdminCourseRepository } from "./admin-course-repository.js";
import { queryManagedCourses } from "./postgres-managed-course.js";

export class PostgresAdminCourseRepository implements AdminCourseRepository {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  async listByStatus(status: CourseSummary["status"]): Promise<ManagedCourse[]> {
    return queryManagedCourses(this.sql, { status });
  }

  async findById(id: string): Promise<ManagedCourse | null> {
    const [found] = await queryManagedCourses(this.sql, { id });
    return found ?? null;
  }

  async publish(id: string, reviewerId: string): Promise<ManagedCourse | null> {
    // courses_published_reviewed 要求上架时 reviewed_by / reviewed_at / published_at 齐全
    const rows = await this.sql<{ id: string }[]>`
      UPDATE courses SET
        status = 'published',
        reviewed_by = ${reviewerId},
        reviewed_at = now(),
        published_at = now(),
        rejection_reason = NULL,
        updated_at = now()
      WHERE id = ${id} AND status = 'review'
      RETURNING id
    `;
    return rows[0] ? this.findById(id) : null;
  }

  async reject(id: string, reviewerId: string, reason: string): Promise<ManagedCourse | null> {
    const rows = await this.sql<{ id: string }[]>`
      UPDATE courses SET
        status = 'draft',
        reviewed_by = ${reviewerId},
        reviewed_at = now(),
        rejection_reason = ${reason},
        updated_at = now()
      WHERE id = ${id} AND status = 'review'
      RETURNING id
    `;
    return rows[0] ? this.findById(id) : null;
  }
}
