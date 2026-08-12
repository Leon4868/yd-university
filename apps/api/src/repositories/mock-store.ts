import type { CourseDetail, CourseRecord, CourseSummary, ManagedCourse } from "../domain/course.js";
import type { CreatorApplication } from "../domain/creator.js";
import type { User } from "../domain/user.js";
import {
  DEMO_ADMIN_ID,
  DEMO_MERCHANT_CREATOR_ID,
  DEMO_TEACHER_CREATOR_ID,
  demoCourses,
  demoCreators,
  demoUsers,
} from "./mock-data.js";

const SEED_TIMESTAMP = "2025-01-01T00:00:00.000Z";

export interface MockStoreSeed {
  users?: User[];
  creators?: CreatorApplication[];
  courses?: CourseDetail[];
}

/** mock 三张表的共享内存态，各仓储读写同一份数据以支撑完整审核流转 */
export class MockDataStore {
  readonly users: User[];
  readonly creators: CreatorApplication[];
  readonly courses: CourseRecord[];

  constructor(seed: MockStoreSeed = {}) {
    this.users = (seed.users ?? demoUsers).map((user) => ({ ...user }));
    this.creators = (seed.creators ?? demoCreators).map((creator) => ({ ...creator }));
    this.courses = (seed.courses ?? demoCourses).map(toCourseRecord);
  }

  findUser(id: string): User | null {
    return this.users.find((user) => user.id === id) ?? null;
  }

  findCreator(id: string): CreatorApplication | null {
    return this.creators.find((creator) => creator.id === id) ?? null;
  }

  findCourse(id: string): CourseRecord | null {
    return this.courses.find((course) => course.id === id) ?? null;
  }
}

/** 演示课程只有公开视图，补齐归属与审核轨迹后进内存表 */
function toCourseRecord(course: CourseDetail): CourseRecord {
  const published = course.status === "published";
  return {
    ...course,
    sections: course.sections.map((section) => ({ ...section })),
    teacherId: DEMO_TEACHER_CREATOR_ID,
    merchantId: DEMO_MERCHANT_CREATOR_ID,
    submittedAt: SEED_TIMESTAMP,
    reviewedBy: published ? DEMO_ADMIN_ID : null,
    reviewedAt: published ? SEED_TIMESTAMP : null,
    rejectionReason: null,
    publishedAt: published ? SEED_TIMESTAMP : null,
    createdAt: SEED_TIMESTAMP,
  };
}

export function toCourseSummary(course: CourseRecord): CourseSummary {
  return {
    id: course.id,
    slug: course.slug,
    chainCourseId: course.chainCourseId,
    title: course.title,
    summary: course.summary,
    category: course.category,
    level: course.level,
    teacherName: course.teacherName,
    teacherXHandle: course.teacherXHandle,
    teacherXUrl: course.teacherXUrl,
    teacherWallet: course.teacherWallet,
    merchantWallet: course.merchantWallet,
    providerName: course.providerName,
    providerXUrl: course.providerXUrl,
    courseUrl: course.courseUrl,
    priceYD: course.priceYD,
    lessonCount: course.lessonCount,
    rating: course.rating,
    studentCount: course.studentCount,
    status: course.status,
    coverTone: course.coverTone,
  };
}

export function toCourseDetail(course: CourseRecord): CourseDetail {
  return {
    ...toCourseSummary(course),
    sections: course.sections.map((section) => ({ ...section })),
  };
}

export function toManagedCourse(course: CourseRecord): ManagedCourse {
  return {
    ...toCourseSummary(course),
    teacherId: course.teacherId,
    submittedAt: course.submittedAt,
    reviewedAt: course.reviewedAt,
    rejectionReason: course.rejectionReason,
    publishedAt: course.publishedAt,
    createdAt: course.createdAt,
  };
}

export function byCreatedAtDesc(left: { createdAt: string }, right: { createdAt: string }): number {
  return right.createdAt.localeCompare(left.createdAt);
}
