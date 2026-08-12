import type { Sql } from "postgres";

import type { SectionProgress } from "../domain/progress.js";
import type { ProgressRepository } from "./progress-repository.js";

interface ProgressRow {
  section_id: string;
  completed_at: Date | null;
  created_at: Date;
}

export class PostgresProgressRepository implements ProgressRepository {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  async listByCourse(userId: string, courseId: string): Promise<SectionProgress[]> {
    const rows = await this.sql<ProgressRow[]>`
      SELECT p.section_id, p.completed_at, p.created_at
      FROM lesson_progress p
      JOIN course_sections s ON s.id = p.section_id
      WHERE p.user_id = ${userId} AND s.course_id = ${courseId}
      ORDER BY s.position ASC
    `;
    return rows.map(mapProgressRow);
  }

  async complete(userId: string, sectionId: string): Promise<void> {
    // 主键冲突时只补完成态，created_at 不动，据此还原首次完成时间
    await this.sql`
      INSERT INTO lesson_progress (user_id, section_id, completed_at)
      VALUES (${userId}, ${sectionId}, now())
      ON CONFLICT (user_id, section_id) DO UPDATE SET
        completed_at = COALESCE(lesson_progress.completed_at, now()),
        updated_at = now()
    `;
  }

  async uncomplete(userId: string, sectionId: string): Promise<void> {
    // 行保留，读取只认 completed_at 非空
    await this.sql`
      UPDATE lesson_progress SET
        completed_at = NULL,
        updated_at = now()
      WHERE user_id = ${userId} AND section_id = ${sectionId}
    `;
  }
}

function mapProgressRow(row: ProgressRow): SectionProgress {
  return {
    sectionId: row.section_id,
    completed: row.completed_at !== null,
    firstCompletedAt: row.created_at.toISOString(),
  };
}
