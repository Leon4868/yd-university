// 字段名与 docs/api-contract.md 严格一致，改接口先改契约

export type UserRole = "student" | "teacher" | "merchant" | "admin";
export type CreatorRole = "teacher" | "merchant";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type CourseStatus = "draft" | "review" | "published" | "archived";
export type CourseLevel = "入门" | "进阶" | "高级";
export type CoverTone = "violet" | "blue" | "teal";

export interface CreatorApplication {
  id: string;
  role: CreatorRole;
  displayName: string;
  walletAddress: string;
  reviewStatus: ReviewStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

/** 管理端列表可能额外带申请人信息，契约未强制，缺省时退回申请本身的字段 */
export interface AdminCreatorApplication extends CreatorApplication {
  createdAt?: string | null;
  applicant?: { id: string; username: string; primaryWallet: string | null } | null;
}

export interface CurrentUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  primaryWallet: string | null;
  role: UserRole;
  creator: CreatorApplication | null;
}

export interface CreatorApplicationInput {
  role: CreatorRole;
  displayName: string;
  walletAddress: string;
}

export interface CourseSectionInput {
  title: string;
  originalTitle?: string;
  url?: string;
  durationSeconds?: number;
}

export interface CourseDraftInput {
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: CourseLevel;
  priceYD: string;
  coverTone?: CoverTone;
  courseUrl?: string;
  providerName?: string;
  sections?: CourseSectionInput[];
}

/** 教师与管理端看到的课程，含未上架状态；展示型字段后端可能不下发，一律按可选处理 */
export interface ManagedCourse {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  summary?: string | null;
  category?: string | null;
  level?: CourseLevel | null;
  priceYD?: string | null;
  coverTone?: CoverTone | null;
  courseUrl?: string | null;
  providerName?: string | null;
  teacherName?: string | null;
  lessonCount?: number | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt?: string | null;
}

export interface PublicCourseSection {
  id: string;
  position: number;
  title: string;
  originalTitle: string | null;
  url: string | null;
  durationSeconds: number | null;
}

export interface PublicCourseSummary {
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
  status: CourseStatus;
  coverTone: CoverTone;
}

export interface PublicCourseDetail extends PublicCourseSummary {
  sections: PublicCourseSection[];
}
