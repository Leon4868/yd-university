import postgres, { type Sql } from "postgres";

import type { ManagedCourse } from "../domain/course.js";
import { CONFLICT_MESSAGES, RepositoryConflictError } from "./errors.js";
import { queryManagedCourses } from "./postgres-managed-course.js";
import type { CourseDraftInput, TeacherCourseRepository } from "./teacher-course-repository.js";

export class PostgresTeacherCourseRepository implements TeacherCourseRepository {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  async listByTeacher(teacherId: string): Promise<ManagedCourse[]> {
    return queryManagedCourses(this.sql, { teacherId });
  }

  async findById(id: string): Promise<ManagedCourse | null> {
    const [found] = await queryManagedCourses(this.sql, { id });
    return found ?? null;
  }

  async create(input: CourseDraftInput): Promise<ManagedCourse> {
    try {
      const created = await this.sql.begin(async (tx) => {
        const rows = await tx<{ id: string }[]>`
          INSERT INTO courses (
            slug, teacher_id, merchant_id, title, summary, category, level,
            cover_tone, price_yd, status, course_url, provider_name
          ) VALUES (
            ${input.slug},
            ${input.teacherId},
            ${input.merchantId},
            ${input.title},
            ${input.summary},
            ${input.category},
            ${input.level},
            ${input.coverTone ?? "violet"},
            ${input.priceYD},
            'draft',
            ${input.courseUrl ?? null},
            ${input.providerName ?? null}
          )
          RETURNING id
        `;
        const row = rows[0];
        if (!row) {
          throw new Error("insert course returned no row");
        }
        const sections = input.sections ?? [];
        for (const [index, section] of sections.entries()) {
          await tx`
            INSERT INTO course_sections (
              course_id, title, original_title, position, duration_seconds
            ) VALUES (
              ${row.id},
              ${section.title},
              ${section.originalTitle ?? null},
              ${index + 1},
              ${section.durationSeconds ?? 0}
            )
          `;
        }
        const [managed] = await queryManagedCourses(tx, { id: row.id });
        if (!managed) {
          throw new Error("created course is not readable");
        }
        return managed;
      });
      return created;
    } catch (error) {
      throw toCreateConflict(error);
    }
  }

  async submit(id: string, teacherId: string): Promise<ManagedCourse | null> {
    const rows = await this.sql<{ id: string }[]>`
      UPDATE courses SET
        status = 'review',
        submitted_at = now(),
        rejection_reason = NULL,
        updated_at = now()
      WHERE id = ${id} AND teacher_id = ${teacherId} AND status = 'draft'
      RETURNING id
    `;
    return rows[0] ? this.findById(id) : null;
  }
}

function toCreateConflict(error: unknown): unknown {
  if (error instanceof postgres.PostgresError && error.code === "23505") {
    return new RepositoryConflictError("DUPLICATE_SLUG", CONFLICT_MESSAGES.DUPLICATE_SLUG);
  }
  return error;
}
