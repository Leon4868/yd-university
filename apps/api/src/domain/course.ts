export type CourseLevel = "入门" | "进阶" | "高级";

export interface CourseSection {
  id: string;
  position: number;
  title: string;
  originalTitle: string | null;
  url: string | null;
  durationSeconds: number | null;
}

export interface CourseSummary {
  id: string;
  slug: string;
  chainCourseId: string | null;
  title: string;
  summary: string;
  category: string;
  level: CourseLevel;
  teacherName: string;
  teacherXHandle: string | null;
  teacherXUrl: string | null;
  teacherWallet: string;
  merchantWallet: string;
  providerName: string | null;
  providerXUrl: string | null;
  courseUrl: string | null;
  priceYD: string;
  lessonCount: number;
  rating: number;
  studentCount: number;
  status: "draft" | "review" | "published" | "archived";
  coverTone: "violet" | "blue" | "teal";
}

/** 详情比列表多一份按 position 排好序的小节 */
export interface CourseDetail extends CourseSummary {
  sections: CourseSection[];
}

/** 仓储内部持有的课程全量态，比公开视图多出归属与审核轨迹 */
export interface CourseRecord extends CourseDetail {
  teacherId: string;
  merchantId: string;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  publishedAt: string | null;
  createdAt: string;
}

/** 管理端与教师端视图：公开字段之外附带审核轨迹 */
export interface ManagedCourse extends CourseSummary {
  teacherId: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  publishedAt: string | null;
  createdAt: string;
}
