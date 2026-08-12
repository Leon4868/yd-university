import type { Sql } from "postgres";

import type { CourseDetail, CourseLevel, CourseSection, CourseSummary } from "../domain/course.js";
import type { CourseRepository } from "./course-repository.js";
import { toXHandle } from "./postgres-managed-course.js";

interface CourseRow {
  id: string;
  slug: string;
  chain_course_id: string | null;
  title: string;
  summary: string;
  category: string;
  level: CourseLevel;
  teacher_name: string;
  teacher_x_url: string | null;
  teacher_wallet: string;
  merchant_wallet: string;
  provider_name: string | null;
  provider_x_url: string | null;
  course_url: string | null;
  price_yd: string;
  lesson_count: number;
  rating: string;
  student_count: number;
  status: CourseSummary["status"];
  cover_tone: CourseSummary["coverTone"];
}

interface SectionRow {
  id: string;
  position: number;
  title: string;
  original_title: string | null;
  url: string | null;
  duration_seconds: number | null;
}

export class PostgresCourseRepository implements CourseRepository {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
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
        c.teacher_x_url,
        teacher.wallet_address AS teacher_wallet,
        merchant.wallet_address AS merchant_wallet,
        c.provider_name,
        c.provider_x_url,
        c.course_url,
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

  async findPublishedDetailBySlug(slug: string): Promise<CourseDetail | null> {
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
        c.teacher_x_url,
        teacher.wallet_address AS teacher_wallet,
        merchant.wallet_address AS merchant_wallet,
        c.provider_name,
        c.provider_x_url,
        c.course_url,
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
    const row = rows[0];
    if (!row) {
      return null;
    }

    const sectionRows = await this.sql<SectionRow[]>`
      SELECT
        s.id,
        s.position,
        s.title,
        s.original_title,
        COALESCE(s.external_url, s.video_url) AS url,
        s.duration_seconds
      FROM course_sections s
      WHERE s.course_id = ${row.id}
      ORDER BY s.position ASC
    `;
    return { ...mapCourseRow(row), sections: sectionRows.map(mapSectionRow) };
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
    teacherXHandle: toXHandle(row.teacher_x_url),
    teacherXUrl: row.teacher_x_url,
    teacherWallet: row.teacher_wallet,
    merchantWallet: row.merchant_wallet,
    providerName: row.provider_name,
    providerXUrl: row.provider_x_url,
    courseUrl: row.course_url,
    priceYD: row.price_yd,
    lessonCount: row.lesson_count,
    rating: Number(row.rating),
    studentCount: row.student_count,
    status: row.status,
    coverTone: row.cover_tone,
  };
}

function mapSectionRow(row: SectionRow): CourseSection {
  return {
    id: row.id,
    position: row.position,
    title: row.title,
    originalTitle: row.original_title,
    url: row.url,
    durationSeconds: row.duration_seconds,
  };
}
