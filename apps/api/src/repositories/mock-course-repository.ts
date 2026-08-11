import type { CourseSummary } from "../domain/course.js";
import type { CourseRepository } from "./course-repository.js";

export const demoCourses: CourseSummary[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "solidity-from-zero",
    chainCourseId: "1",
    title: "Solidity 智能合约从入门到实战",
    summary: "从 EVM 基础到部署第一个安全合约，完成一条可验证的学习路径。",
    category: "Solidity",
    level: "入门",
    teacherName: "Alex Chen",
    teacherWallet: "0x1111111111111111111111111111111111111111",
    merchantWallet: "0x2222222222222222222222222222222222222222",
    priceYD: "4",
    lessonCount: 12,
    rating: 4.9,
    studentCount: 1248,
    status: "published",
    coverTone: "violet",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "defi-principles",
    chainCourseId: "2",
    title: "DeFi 核心原理与协议拆解",
    summary: "用可视化案例理解 AMM、借贷、清算与链上风险。",
    category: "DeFi",
    level: "进阶",
    teacherName: "Mia Zhou",
    teacherWallet: "0x3333333333333333333333333333333333333333",
    merchantWallet: "0x2222222222222222222222222222222222222222",
    priceYD: "4",
    lessonCount: 10,
    rating: 4.8,
    studentCount: 896,
    status: "published",
    coverTone: "blue",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "smart-contract-security",
    chainCourseId: "3",
    title: "智能合约安全：从攻击到防御",
    summary: "通过真实漏洞模式建立重入、权限和预言机安全意识。",
    category: "安全",
    level: "高级",
    teacherName: "Ryan Wu",
    teacherWallet: "0x4444444444444444444444444444444444444444",
    merchantWallet: "0x2222222222222222222222222222222222222222",
    priceYD: "4",
    lessonCount: 16,
    rating: 4.9,
    studentCount: 632,
    status: "published",
    coverTone: "teal",
  },
];

export class MockCourseRepository implements CourseRepository {
  async listPublished(): Promise<CourseSummary[]> {
    return demoCourses;
  }

  async findPublishedBySlug(slug: string): Promise<CourseSummary | null> {
    return demoCourses.find((course) => course.slug === slug) ?? null;
  }
}
