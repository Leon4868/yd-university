import type { UserRole } from "./user.js";

export type CreatorRole = "teacher" | "merchant";
export type ReviewStatus = "pending" | "approved" | "rejected";

export interface CreatorApplication {
  id: string;
  userId: string | null;
  role: CreatorRole;
  displayName: string;
  walletAddress: string;
  reviewStatus: ReviewStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

/** 管理端列表比申请本体多一份申请人信息，存量数据没有 user_id 时为 null */
export interface CreatorApplicationWithApplicant extends CreatorApplication {
  applicant: { id: string; username: string; role: UserRole } | null;
}
