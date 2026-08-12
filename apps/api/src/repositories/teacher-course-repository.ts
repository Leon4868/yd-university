import type { CourseLevel, CourseSummary, ManagedCourse } from "../domain/course.js";

export interface CourseSectionInput {
  title: string;
  originalTitle?: string;
  url?: string;
  durationSeconds?: number;
}

export interface CourseDraftInput {
  /** creators.id，教师本人已通过审核的创作者身份 */
  teacherId: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: CourseLevel;
  priceYD: string;
  coverTone?: CourseSummary["coverTone"];
  courseUrl?: string;
  providerName?: string;
  sections?: CourseSectionInput[];
}

export interface TeacherCourseRepository {
  listByTeacher(teacherId: string): Promise<ManagedCourse[]>;
  findById(id: string): Promise<ManagedCourse | null>;
  /** slug 重复抛 RepositoryConflictError */
  create(input: CourseDraftInput): Promise<ManagedCourse>;
  /** 仅 draft 可提交，写 submitted_at 并清空上轮 rejection_reason；其它状态返回 null */
  submit(id: string, teacherId: string): Promise<ManagedCourse | null>;
}
