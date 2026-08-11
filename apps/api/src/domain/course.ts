export type CourseLevel = "入门" | "进阶" | "高级";

export interface CourseSummary {
  id: string;
  slug: string;
  chainCourseId: string | null;
  title: string;
  summary: string;
  category: string;
  level: CourseLevel;
  teacherName: string;
  teacherWallet: string;
  merchantWallet: string;
  priceYD: string;
  lessonCount: number;
  rating: number;
  studentCount: number;
  status: "draft" | "review" | "published" | "archived";
  coverTone: "violet" | "blue" | "teal";
}
