export interface Course {
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: "入门" | "进阶" | "高级";
  teacherName: string;
  priceYD: number;
  lessonCount: number;
  rating: number;
  studentCount: number;
  tone: "violet" | "blue" | "teal";
}

export const courses: Course[] = [
  { slug: "solidity-from-zero", title: "Solidity 智能合约从入门到实战", summary: "从 EVM 基础到部署第一个安全合约，完成一条可验证的学习路径。", category: "Solidity", level: "入门", teacherName: "Alex Chen", priceYD: 4, lessonCount: 12, rating: 4.9, studentCount: 1248, tone: "violet" },
  { slug: "defi-principles", title: "DeFi 核心原理与协议拆解", summary: "用可视化案例理解 AMM、借贷、清算与链上风险。", category: "DeFi", level: "进阶", teacherName: "Mia Zhou", priceYD: 4, lessonCount: 10, rating: 4.8, studentCount: 896, tone: "blue" },
  { slug: "smart-contract-security", title: "智能合约安全：从攻击到防御", summary: "通过真实漏洞模式建立重入、权限和预言机安全意识。", category: "安全", level: "高级", teacherName: "Ryan Wu", priceYD: 4, lessonCount: 16, rating: 4.9, studentCount: 632, tone: "teal" },
];
