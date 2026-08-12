import type { CourseStatus, ReviewStatus } from "../api/types.ts";

const reviewStatusLabels: Record<ReviewStatus, string> = { pending: "待审核", approved: "已通过", rejected: "已驳回" };
const courseStatusLabels: Record<CourseStatus, string> = { draft: "草稿", review: "待上架", published: "已上架", archived: "已归档" };
const statusTones: Record<string, string> = { pending: "warn", review: "warn", approved: "ok", published: "ok", rejected: "danger" };

export const creatorRoleLabels = { teacher: "教师", merchant: "商家" } as const;

export function reviewStatusLabel(status: ReviewStatus) {
  return reviewStatusLabels[status];
}

export function courseStatusLabel(status: CourseStatus) {
  return courseStatusLabels[status];
}

export function statusTone(status: string) {
  return statusTones[status] ?? "muted";
}

export function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { hour12: false });
}

export function shortenAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}
