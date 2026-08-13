import { randomUUID } from "node:crypto";

import type { CourseRecord, ManagedCourse } from "../domain/course.js";
import { CONFLICT_MESSAGES, RepositoryConflictError } from "./errors.js";
import { byCreatedAtDesc, MockDataStore, toManagedCourse } from "./mock-store.js";
import type { CourseDraftInput, TeacherCourseRepository } from "./teacher-course-repository.js";

export class MockTeacherCourseRepository implements TeacherCourseRepository {
  private readonly store: MockDataStore;

  constructor(store: MockDataStore = new MockDataStore()) {
    this.store = store;
  }

  async listByTeacher(teacherId: string): Promise<ManagedCourse[]> {
    return this.store.courses
      .filter((course) => course.teacherId === teacherId)
      .sort(byCreatedAtDesc)
      .map(toManagedCourse);
  }

  async findById(id: string): Promise<ManagedCourse | null> {
    const course = this.store.findCourse(id);
    return course ? toManagedCourse(course) : null;
  }

  async create(input: CourseDraftInput): Promise<ManagedCourse> {
    if (this.store.courses.some((course) => course.slug === input.slug)) {
      throw new RepositoryConflictError("DUPLICATE_SLUG", CONFLICT_MESSAGES.DUPLICATE_SLUG);
    }
    const teacher = this.store.findCreator(input.teacherId);
    if (!teacher) {
      throw new Error(`creator ${input.teacherId} not found`);
    }
    const merchant = this.store.findCreator(input.merchantId);
    if (!merchant || merchant.role !== "merchant" || merchant.reviewStatus !== "approved") {
      throw new Error(`approved merchant ${input.merchantId} not found`);
    }
    const sections = (input.sections ?? []).map((section, index) => ({
      id: randomUUID(),
      position: index + 1,
      title: section.title,
      originalTitle: section.originalTitle ?? null,
      durationSeconds: section.durationSeconds ?? null,
    }));
    const created: CourseRecord = {
      id: randomUUID(),
      slug: input.slug,
      chainCourseId: null,
      title: input.title,
      summary: input.summary,
      category: input.category,
      level: input.level,
      teacherName: teacher.displayName,
      teacherXHandle: null,
      teacherXUrl: null,
      teacherWallet: teacher.walletAddress,
      merchantWallet: merchant.walletAddress,
      providerName: input.providerName ?? null,
      providerXUrl: null,
      courseUrl: input.courseUrl ?? null,
      priceYD: input.priceYD,
      lessonCount: sections.length,
      rating: 0,
      studentCount: 0,
      status: "draft",
      coverTone: input.coverTone ?? "violet",
      sections,
      teacherId: teacher.id,
      merchantId: merchant.id,
      submittedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      publishedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.store.courses.push(created);
    return toManagedCourse(created);
  }

  async submit(id: string, teacherId: string): Promise<ManagedCourse | null> {
    const course = this.store.findCourse(id);
    if (!course || course.teacherId !== teacherId || course.status !== "draft") {
      return null;
    }
    course.status = "review";
    course.submittedAt = new Date().toISOString();
    course.rejectionReason = null;
    return toManagedCourse(course);
  }
}
