import type { UserRole } from "../api/types.ts";

export type Capability =
  | "learn"
  | "purchase"
  | "applyCreator"
  | "manageCourses"
  | "manageMerchantRevenue"
  | "reviewPlatform";

export const allRoles: readonly UserRole[] = ["student", "teacher", "merchant", "admin"];
export const learnerRoles: readonly UserRole[] = ["student", "teacher", "merchant"];
export const creatorCenterRoles: readonly UserRole[] = ["student", "teacher", "merchant"];

export const roleLabels: Record<UserRole, string> = {
  student: "学生",
  teacher: "教师",
  merchant: "商家",
  admin: "管理员",
};

const capabilities: Record<UserRole, readonly Capability[]> = {
  student: ["learn", "purchase", "applyCreator"],
  teacher: ["learn", "purchase", "manageCourses"],
  merchant: ["learn", "purchase", "manageMerchantRevenue"],
  admin: ["reviewPlatform"],
};

export function can(role: UserRole | null, capability: Capability): boolean {
  return role ? capabilities[role].includes(capability) : false;
}

export function roleHome(role: UserRole | null): string {
  if (role === "admin") return "/admin";
  if (role === "teacher" || role === "merchant") return "/creator";
  if (role === "student") return "/profile";
  return "/";
}

export function creatorCenterLabel(role: UserRole | null): string {
  if (role === "teacher") return "教学中心";
  if (role === "merchant") return "商家中心";
  return "申请入驻";
}
