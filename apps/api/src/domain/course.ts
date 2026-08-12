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
