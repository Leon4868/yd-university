import type { SectionProgress } from "../domain/progress.js";
import { type LessonProgressRecord, MockDataStore } from "./mock-store.js";
import type { ProgressRepository } from "./progress-repository.js";

export class MockProgressRepository implements ProgressRepository {
  private readonly store: MockDataStore;

  constructor(store: MockDataStore = new MockDataStore()) {
    this.store = store;
  }

  async listByCourse(userId: string, courseId: string): Promise<SectionProgress[]> {
    const course = this.store.findCourse(courseId);
    const sectionIds = new Set((course?.sections ?? []).map((section) => section.id));
    return this.store.lessonProgress
      .filter((row) => row.userId === userId && sectionIds.has(row.sectionId))
      .map((row) => ({
        sectionId: row.sectionId,
        completed: row.completedAt !== null,
        firstCompletedAt: row.createdAt,
      }));
  }

  async complete(userId: string, sectionId: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = this.find(userId, sectionId);
    if (existing) {
      existing.completedAt ??= now;
      return;
    }
    this.store.lessonProgress.push({ userId, sectionId, completedAt: now, createdAt: now });
  }

  async uncomplete(userId: string, sectionId: string): Promise<void> {
    const existing = this.find(userId, sectionId);
    if (existing) {
      existing.completedAt = null;
    }
  }

  private find(userId: string, sectionId: string): LessonProgressRecord | null {
    return (
      this.store.lessonProgress.find(
        (row) => row.userId === userId && row.sectionId === sectionId,
      ) ?? null
    );
  }
}
