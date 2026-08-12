import type { ISql } from "postgres";

import type { CourseLevel, CourseSummary, ManagedCourse } from "../domain/course.js";

export interface ManagedCourseRow {
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
  teacher_id: string;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  published_at: Date | null;
  created_at: Date;
}

export interface ManagedCourseFilter {
  id?: string;
  status?: CourseSummary["status"];
  teacherId?: string;
}

/** 管理端与教师端共用同一条读 SQL，事务内外都能复用 */
export async function queryManagedCourses(
  sql: ISql,
  filter: ManagedCourseFilter,
): Promise<ManagedCourse[]> {
  const id = filter.id ?? null;
  const status = filter.status ?? null;
  const teacherId = filter.teacherId ?? null;
  const rows = await sql<ManagedCourseRow[]>`
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
      c.cover_tone,
      c.teacher_id,
      c.submitted_at,
      c.reviewed_at,
      c.rejection_reason,
      c.published_at,
      c.created_at
    FROM courses c
    JOIN creators teacher ON teacher.id = c.teacher_id
    JOIN creators merchant ON merchant.id = c.merchant_id
    WHERE (${id}::uuid IS NULL OR c.id = ${id}::uuid)
      AND (${status}::text IS NULL OR c.status::text = ${status}::text)
      AND (${teacherId}::uuid IS NULL OR c.teacher_id = ${teacherId}::uuid)
    ORDER BY c.created_at DESC
  `;
  return rows.map(mapManagedCourseRow);
}

export function mapManagedCourseRow(row: ManagedCourseRow): ManagedCourse {
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
    teacherId: row.teacher_id,
    submittedAt: toIso(row.submitted_at),
    reviewedAt: toIso(row.reviewed_at),
    rejectionReason: row.rejection_reason,
    publishedAt: toIso(row.published_at),
    createdAt: row.created_at.toISOString(),
  };
}

/** 002 迁移只存了 X 链接，handle 由链接首段路径推导 */
export function toXHandle(xUrl: string | null): string | null {
  if (!xUrl) {
    return null;
  }
  try {
    const [handle] = new URL(xUrl).pathname.split("/").filter(Boolean);
    return handle ? `@${handle}` : null;
  } catch {
    return null;
  }
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
