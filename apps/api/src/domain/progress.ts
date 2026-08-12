/** 单个小节的学习进度，取消完成只清 completed，firstCompletedAt 保留 */
export interface SectionProgress {
  sectionId: string;
  completed: boolean;
  firstCompletedAt: string;
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
