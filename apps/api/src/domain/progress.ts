/** 单个小节的学习进度，取消完成只清 completed，firstCompletedAt 保留 */
export interface SectionProgress {
  sectionId: string;
  completed: boolean;
  firstCompletedAt: string;
}

/**
 * 一条待发证的完成记录，供 Chainlink CRE workflow 拉取后生成链上报告。
 * 只带链上本来就公开的字段（钱包、链上课程 id），不带用户名等站内信息。
 */
export interface PendingCompletion {
  courseSlug: string;
  /** CourseRegistry 里的课程 id，没上链的课程不会出现在结果里 */
  chainCourseId: string;
  /** 证书铸造的目标钱包 */
  studentWallet: string;
  /** 最后一节完成的时间 */
  completedAt: string;
}

/** 契约里的课程进度视图，percent 向下取整 */
export interface CourseProgress {
  courseId: string;
  slug: string;
  totalSections: number;
  completedSectionIds: string[];
  completedCount: number;
  percent: number;
  completed: boolean;
  completedAt: string | null;
}
