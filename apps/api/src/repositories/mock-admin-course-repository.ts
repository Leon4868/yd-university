import type { CourseSummary, ManagedCourse } from "../domain/course.js";
import type { AdminCourseRepository } from "./admin-course-repository.js";
import { byCreatedAtDesc, MockDataStore, toManagedCourse } from "./mock-store.js";

export class MockAdminCourseRepository implements AdminCourseRepository {
  private readonly store: MockDataStore;

  constructor(store: MockDataStore = new MockDataStore()) {
    this.store = store;
  }

  async listByStatus(status: CourseSummary["status"]): Promise<ManagedCourse[]> {
    return this.store.courses
      .filter((course) => course.status === status)
      .sort(byCreatedAtDesc)
      .map(toManagedCourse);
  }

  async findById(id: string): Promise<ManagedCourse | null> {
    const course = this.store.findCourse(id);
    return course ? toManagedCourse(course) : null;
  }

  async publish(id: string, reviewerId: string): Promise<ManagedCourse | null> {
    const course = this.store.findCourse(id);
    if (!course || course.status !== "review") {
      return null;
    }
    // courses_published_reviewed 要求上架时审核轨迹齐全，三个字段一起写
    const now = new Date().toISOString();
    course.status = "published";
    course.reviewedBy = reviewerId;
    course.reviewedAt = now;
    course.publishedAt = now;
    course.rejectionReason = null;
    return toManagedCourse(course);
  }

  async reject(id: string, reviewerId: string, reason: string): Promise<ManagedCourse | null> {
    const course = this.store.findCourse(id);
    if (!course || course.status !== "review") {
      return null;
    }
    course.status = "draft";
    course.reviewedBy = reviewerId;
    course.reviewedAt = new Date().toISOString();
    course.rejectionReason = reason;
    return toManagedCourse(course);
  }
}
