import type { ManagedCourse } from "../domain/course.js";
import type { MerchantCourseRepository } from "./merchant-course-repository.js";
import { byCreatedAtDesc, MockDataStore, toManagedCourse } from "./mock-store.js";

export class MockMerchantCourseRepository implements MerchantCourseRepository {
  private readonly store: MockDataStore;

  constructor(store: MockDataStore = new MockDataStore()) {
    this.store = store;
  }

  async listByMerchant(merchantId: string): Promise<ManagedCourse[]> {
    return this.store.courses
      .filter((course) => course.merchantId === merchantId)
      .sort(byCreatedAtDesc)
      .map(toManagedCourse);
  }
}
