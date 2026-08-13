import type { PendingCompletion, SectionProgress } from "../domain/progress.js";

export interface ProgressRepository {
  /**
   * 全部已 100% 完成、且课程已上链、学员已绑定钱包的完成记录。
   * 不过滤已发证的：证书是否已铸只有链上知道，由 CRE workflow 读 certificateOf 过滤。
   */
  listPendingCompletions(): Promise<PendingCompletion[]>;
  /** 只返回该课程下有过完成记录的小节 */
  listByCourse(userId: string, courseId: string): Promise<SectionProgress[]>;
  /** 幂等：重复标记不改变首次完成时间 */
  complete(userId: string, sectionId: string): Promise<void>;
  /** 幂等：只清完成态，首次完成时间保留 */
  uncomplete(userId: string, sectionId: string): Promise<void>;
}
