import type { CourseDetail, CourseSummary } from "../domain/course.js";
import type { CourseRepository } from "./course-repository.js";
import { MockDataStore, toCourseDetail, toCourseSummary } from "./mock-store.js";

export class MockCourseRepository implements CourseRepository {
  private readonly store: MockDataStore;

  constructor(store: MockDataStore = new MockDataStore()) {
    this.store = store;
  }

  async listPublished(): Promise<CourseSummary[]> {
    return this.store.courses.filter((course) => course.status === "published").map(toCourseSummary);
  }

  async findPublishedDetailBySlug(slug: string): Promise<CourseDetail | null> {
    const course = this.store.courses.find(
      (item) => item.slug === slug && item.status === "published",
    );
    return course ? toCourseDetail(course) : null;
  }
}
