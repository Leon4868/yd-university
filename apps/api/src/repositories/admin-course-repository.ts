import type { CourseSummary, ManagedCourse } from "../domain/course.js";

export interface AdminCourseRepository {
  listByStatus(status: CourseSummary["status"]): Promise<ManagedCourse[]>;
  findById(id: string): Promise<ManagedCourse | null>;
  /** 上架同时写 reviewed_by / reviewed_at / published_at；非 review 状态返回 null */
  publish(id: string, reviewerId: string): Promise<ManagedCourse | null>;
  /** 驳回退回 draft 并写 rejection_reason；非 review 状态返回 null */
  reject(id: string, reviewerId: string, reason: string): Promise<ManagedCourse | null>;
}
