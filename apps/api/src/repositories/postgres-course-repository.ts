import postgres, { type Sql } from "postgres";

import type { CourseLevel, CourseSummary } from "../domain/course.js";
import type { CourseRepository } from "./course-repository.js";

interface CourseRow {
  id: string;
  slug: string;
  chain_course_id: string | null;
  title: string;
  summary: string;
  category: string;
  level: CourseLevel;
  teacher_name: string;
  teacher_wallet: string;
  merchant_wallet: string;
  price_yd: string;
  lesson_count: number;
  rating: string;
  student_count: number;
  status: CourseSummary["status"];
  cover_tone: CourseSummary["coverTone"];
}

export class PostgresCourseRepository implements CourseRepository {
  private readonly sql: Sql;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, { max: 10 });
  }

  async listPublished(): Promise<CourseSummary[]> {
    const rows = await this.sql<CourseRow[]>`
      SELECT
        c.id,
        c.slug,
        c.chain_course_id,
        c.title,
        c.summary,
        c.category,
        c.level,
        teacher.display_name AS teacher_name,
        teacher.wallet_address AS teacher_wallet,
        merchant.wallet_address AS merchant_wallet,
        c.price_yd,
        (SELECT count(*)::int FROM course_sections s WHERE s.course_id = c.id) AS lesson_count,
        c.rating,
        c.student_count,
        c.status,
        c.cover_tone
      FROM courses c
      JOIN creators teacher ON teacher.id = c.teacher_id
      JOIN creators merchant ON merchant.id = c.merchant_id
      WHERE c.status = 'published'
      ORDER BY c.published_at DESC NULLS LAST, c.created_at DESC
    `;
    return rows.map(mapCourseRow);
  }

  async findPublishedBySlug(slug: string): Promise<CourseSummary | null> {
    const rows = await this.sql<CourseRow[]>`
      SELECT
        c.id,
        c.slug,
        c.chain_course_id,
        c.title,
        c.summary,
        c.category,
        c.level,
        teacher.display_name AS teacher_name,
        teacher.wallet_address AS teacher_wallet,
        merchant.wallet_address AS merchant_wallet,
        c.price_yd,
        (SELECT count(*)::int FROM course_sections s WHERE s.course_id = c.id) AS lesson_count,
        c.rating,
        c.student_count,
        c.status,
        c.cover_tone
      FROM courses c
      JOIN creators teacher ON teacher.id = c.teacher_id
      JOIN creators merchant ON merchant.id = c.merchant_id
      WHERE c.slug = ${slug} AND c.status = 'published'
      LIMIT 1
    `;
    return rows[0] ? mapCourseRow(rows[0]) : null;
  }
}

function mapCourseRow(row: CourseRow): CourseSummary {
  return {
    id: row.id,
    slug: row.slug,
    chainCourseId: row.chain_course_id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    level: row.level,
    teacherName: row.teacher_name,
    teacherWallet: row.teacher_wallet,
    merchantWallet: row.merchant_wallet,
    priceYD: row.price_yd,
    lessonCount: row.lesson_count,
    rating: Number(row.rating),
    studentCount: row.student_count,
    status: row.status,
    coverTone: row.cover_tone,
  };
}
