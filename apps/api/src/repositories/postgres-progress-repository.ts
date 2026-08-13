import type { Sql } from "postgres";

import type { PendingCompletion, SectionProgress } from "../domain/progress.js";
import type { ProgressRepository } from "./progress-repository.js";

interface ProgressRow {
  section_id: string;
  completed_at: Date | null;
  created_at: Date;
}

interface PendingCompletionRow {
  slug: string;
  chain_course_id: string;
  primary_wallet: string;
  completed_at: Date;
}

export class PostgresProgressRepository implements ProgressRepository {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  async listPendingCompletions(): Promise<PendingCompletion[]> {
    // HAVING 比对的是「该课程完成的小节数 == 该课程小节总数」，少一节就不出现在结果里
    const rows = await this.sql<PendingCompletionRow[]>`
      SELECT c.slug, c.chain_course_id, u.primary_wallet, max(p.completed_at) AS completed_at
      FROM lesson_progress p
      JOIN course_sections s ON s.id = p.section_id
      JOIN courses c ON c.id = s.course_id
      JOIN users u ON u.id = p.user_id
      WHERE p.completed_at IS NOT NULL
        AND c.status = 'published'
        AND c.chain_course_id IS NOT NULL
        AND u.primary_wallet IS NOT NULL
      GROUP BY u.id, u.primary_wallet, c.id, c.slug, c.chain_course_id
      HAVING count(DISTINCT p.section_id) = (
        SELECT count(*) FROM course_sections cs WHERE cs.course_id = c.id
      )
      ORDER BY completed_at ASC
    `;
    return rows.map((row) => ({
      courseSlug: row.slug,
      chainCourseId: row.chain_course_id,
      studentWallet: row.primary_wallet,
      completedAt: row.completed_at.toISOString(),
    }));
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
