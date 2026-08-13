import type { ManagedCourse } from "../domain/course.js";

export interface MerchantCourseRepository {
  /** 只返回分账商家为当前身份的课程 */
  listByMerchant(merchantId: string): Promise<ManagedCourse[]>;
}
