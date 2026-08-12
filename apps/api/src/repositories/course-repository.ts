import type { CourseDetail, CourseSummary } from "../domain/course.js";

export interface CourseRepository {
  listPublished(): Promise<CourseSummary[]>;
  findPublishedDetailBySlug(slug: string): Promise<CourseDetail | null>;
}
