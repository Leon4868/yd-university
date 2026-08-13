import type { PendingCompletion, SectionProgress } from "../domain/progress.js";
import { type LessonProgressRecord, MockDataStore } from "./mock-store.js";
import type { ProgressRepository } from "./progress-repository.js";

export class MockProgressRepository implements ProgressRepository {
  private readonly store: MockDataStore;

  constructor(store: MockDataStore = new MockDataStore()) {
    this.store = store;
  }

  async listPendingCompletions(): Promise<PendingCompletion[]> {
    const completedAt = new Map<string, string>();
    for (const row of this.store.lessonProgress) {
      if (row.completedAt !== null) completedAt.set(row.sectionId, row.completedAt);
    }

    const pending: PendingCompletion[] = [];
    for (const user of this.store.users) {
      if (!user.primaryWallet) continue;
      const done = new Set(
        this.store.lessonProgress
          .filter((row) => row.userId === user.id && row.completedAt !== null)
          .map((row) => row.sectionId),
      );
      for (const course of this.store.courses) {
        // 未上架或没绑定链上课程的，链上没有购买记录，铸证书必然 revert
        if (course.status !== "published" || !course.chainCourseId) continue;
        if (course.sections.length === 0) continue;
        if (!course.sections.every((section) => done.has(section.id))) continue;
        const finishedAt = course.sections
          .map((section) => completedAt.get(section.id) ?? "")
          .reduce((latest, current) => (current > latest ? current : latest), "");
        pending.push({
          courseSlug: course.slug,
          chainCourseId: course.chainCourseId,
          studentWallet: user.primaryWallet,
          completedAt: finishedAt,
        });
      }
    }
    return pending.sort((left, right) => left.completedAt.localeCompare(right.completedAt));
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
