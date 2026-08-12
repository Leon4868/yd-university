export interface CourseSection {
  position: number;
  title: string;
  originalTitle: string;
  durationSeconds?: number;
}

export interface Course {
  slug: string;
  chainCourseId?: string;
  title: string;
  summary: string;
  category: string;
  level: "入门" | "进阶" | "高级";
  courseUrl: string;
  isFree: boolean;
  teacherName: string;
  teacherXHandle?: string;
  teacherXUrl?: string;
  providerName: string;
  providerXUrl?: string;
  sections: CourseSection[];
  priceYD: number;
  lessonCount: number;
  rating: number;
  studentCount: number;
  tone: "violet" | "blue" | "teal";
}

export const courses: Course[] = [
  {
    slug: "solidity-from-zero",
    chainCourseId: "1",
    title: "Solidity 智能合约开发从入门到实战",
    summary: "Cyfrin Updraft 免费课，用 Remix 从变量函数写到部署合约，五小时入门 Solidity。",
    category: "Solidity",
    level: "入门",
    courseUrl: "https://updraft.cyfrin.io/courses/solidity",
    isFree: true,
    teacherName: "Patrick Collins",
    teacherXHandle: "@PatrickAlphaC",
    teacherXUrl: "https://x.com/PatrickAlphaC",
    providerName: "Cyfrin Updraft",
    providerXUrl: "https://x.com/CyfrinUpdraft",
    sections: [
      { position: 1, title: "课程导论", originalTitle: "Introduction", durationSeconds: 180 },
      { position: 2, title: "编写你的第一个合约", originalTitle: "Setting Up Your First Contract", durationSeconds: 600 },
      { position: 3, title: "基础变量类型", originalTitle: "Basic Variable Types", durationSeconds: 480 },
      { position: 4, title: "函数", originalTitle: "Functions", durationSeconds: 1140 },
      { position: 5, title: "数组与结构体", originalTitle: "Arrays and Structs", durationSeconds: 720 },
      { position: 6, title: "错误与警告", originalTitle: "Errors and Warnings", durationSeconds: 300 },
      { position: 7, title: "memory、storage 与 calldata", originalTitle: "Memory Storage and Calldata", durationSeconds: 360 },
      { position: 8, title: "映射 Mapping", originalTitle: "Mappings", durationSeconds: 240 },
      { position: 9, title: "部署你的第一个合约", originalTitle: "Deploying Your First Contract", durationSeconds: 600 },
      { position: 10, title: "本章回顾", originalTitle: "Section Recap", durationSeconds: 180 },
      { position: 11, title: "合约工厂入门", originalTitle: "Storage Factory Introduction", durationSeconds: 180 },
      { position: 12, title: "用合约部署合约", originalTitle: "Deploying a Contract From a Contract" },
      { position: 13, title: "Solidity 导入机制", originalTitle: "Solidity Imports" },
      { position: 14, title: "通过 ABI 与合约交互", originalTitle: "Interacting With Contracts ABI" },
      { position: 15, title: "Solidity 继承", originalTitle: "Inheritance in Solidity" },
    ],
    priceYD: 4,
    lessonCount: 15,
    rating: 4.9,
    studentCount: 1248,
    tone: "violet",
  },
  {
    slug: "defi-principles",
    title: "DeFi 核心原理与协议拆解（Uniswap V2 源码精讲）",
    summary: "以 Uniswap V2 为样本，拆解 AMM 恒定乘积、手续费、LP 份额、闪电兑换与 TWAP 预言机的完整实现。",
    category: "DeFi",
    level: "进阶",
    courseUrl: "https://updraft.cyfrin.io/courses/uniswap-v2",
    isFree: true,
    teacherName: "Tasuku Nakamura",
    teacherXHandle: "@ProgrammerSmart",
    teacherXUrl: "https://x.com/ProgrammerSmart",
    providerName: "Cyfrin Updraft",
    providerXUrl: "https://x.com/CyfrinUpdraft",
    sections: [
      { position: 1, title: "课程总览：Uniswap V2 是什么", originalTitle: "Overview - Intro" },
      { position: 2, title: "恒定乘积曲线图解", originalTitle: "Overview - Graph" },
      { position: 3, title: "核心合约结构：Factory / Pair / Router", originalTitle: "Overview - Contracts" },
      { position: 4, title: "兑换数学推导", originalTitle: "Swap - Swap Math" },
      { position: 5, title: "兑换手续费机制", originalTitle: "Swap - Swap Fee" },
      { position: 6, title: "现货价格的计算方式", originalTitle: "Swap - Spot Price Math" },
      { position: 7, title: "滑点与价格影响", originalTitle: "Swap - Slippage" },
      { position: 8, title: "源码走读：createPair 创建交易对", originalTitle: "Create Pool - Code Walk Create Pair" },
      { position: 9, title: "LP 份额（Pool Shares）入门", originalTitle: "Add Liquidity - Pool Shares Intro" },
      { position: 10, title: "添加流动性的数学原理", originalTitle: "Add Liquidity - Add Liq Math" },
      { position: 11, title: "移除流动性数学：dx 与 dy 的求解", originalTitle: "Remove Liquidity - Remove Liq Math Dx Dy" },
      { position: 12, title: "闪电兑换（Flash Swap）数学", originalTitle: "Flash Swap - Flash Swap Math" },
      { position: 13, title: "TWAP 与现货价格预言机", originalTitle: "Twap - Twap Spot Price Oracle" },
      { position: 14, title: "实战应用：套利（Arbitrage）入门", originalTitle: "App - Arb Intro" },
    ],
    priceYD: 4,
    lessonCount: 14,
    rating: 4.8,
    studentCount: 896,
    tone: "blue",
  },
  {
    slug: "smart-contract-security",
    title: "智能合约安全：从攻击到防御",
    summary: "Cyfrin Updraft 免费高级安全课，用 6 个真实合约审计实战掌握漏洞挖掘与防御。",
    category: "安全",
    level: "高级",
    courseUrl: "https://updraft.cyfrin.io/courses/security",
    isFree: true,
    teacherName: "Patrick Collins",
    teacherXHandle: "@PatrickAlphaC",
    teacherXUrl: "https://x.com/PatrickAlphaC",
    providerName: "Cyfrin Updraft",
    providerXUrl: "https://x.com/CyfrinUpdraft",
    sections: [
      { position: 1, title: "课程导论：走进智能合约安全", originalTitle: "Course Introduction", durationSeconds: 3600 },
      { position: 2, title: "基础回顾：Solidity 与测试预备知识", originalTitle: "Review", durationSeconds: 3600 },
      { position: 3, title: "什么是智能合约审计", originalTitle: "What is a smart contract audit", durationSeconds: 3600 },
      { position: 4, title: "第一次审计实战：PasswordStore", originalTitle: "Your First Audit | PasswordStore", durationSeconds: 7200 },
      { position: 5, title: "Puppy Raffle 审计：重入与拒绝服务", originalTitle: "Puppy raffle", durationSeconds: 18000 },
      { position: 6, title: "TSwap 审计：AMM 不变量与模糊测试", originalTitle: "TSwap", durationSeconds: 18000 },
      { position: 7, title: "Thunder Loan 审计：闪电贷与预言机操纵", originalTitle: "Thunder Loan", durationSeconds: 14400 },
      { position: 8, title: "Boss Bridge 审计：跨链桥安全", originalTitle: "Boss Bridge", durationSeconds: 7200 },
      { position: 9, title: "MEV 与治理攻击", originalTitle: "MEV & Governance", durationSeconds: 3600 },
    ],
    priceYD: 4,
    lessonCount: 9,
    rating: 4.9,
    studentCount: 632,
    tone: "teal",
  },
];

export function findCourseBySlug(slug?: string): Course | undefined {
  return courses.find((item) => item.slug === slug) ?? courses[0];
}

export function formatDuration(seconds?: number | null) {
  if (!seconds) return "";
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.round(minutes / 6) / 10} 小时` : `${minutes} 分钟`;
}
