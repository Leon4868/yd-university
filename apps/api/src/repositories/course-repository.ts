import type { CourseSummary } from "../domain/course.js";

export interface CourseRepository {
  listPublished(): Promise<CourseSummary[]>;
  findPublishedBySlug(slug: string): Promise<CourseSummary | null>;
}
