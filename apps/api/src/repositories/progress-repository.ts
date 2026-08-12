import type { SectionProgress } from "../domain/progress.js";

export interface ProgressRepository {
  /** 只返回该课程下有过完成记录的小节 */
  listByCourse(userId: string, courseId: string): Promise<SectionProgress[]>;
  /** 幂等：重复标记不改变首次完成时间 */
  complete(userId: string, sectionId: string): Promise<void>;
  /** 幂等：只清完成态，首次完成时间保留 */
  uncomplete(userId: string, sectionId: string): Promise<void>;
}
