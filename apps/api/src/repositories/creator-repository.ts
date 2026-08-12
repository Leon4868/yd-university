import type {
  CreatorApplication,
  CreatorApplicationWithApplicant,
  CreatorRole,
  ReviewStatus,
} from "../domain/creator.js";

export interface CreatorApplicationInput {
  userId: string;
  role: CreatorRole;
  displayName: string;
  walletAddress: string;
}

export interface CreatorRepository {
  /** /api/me 与「我的申请」只展示最近一条 */
  findLatestByUser(userId: string): Promise<CreatorApplication | null>;
  findApproved(userId: string, role: CreatorRole): Promise<CreatorApplication | null>;
  /** 冲突时抛 RepositoryConflictError；已驳回的申请复用同一行重置为 pending */
  apply(input: CreatorApplicationInput): Promise<CreatorApplication>;
  listByStatus(status: ReviewStatus): Promise<CreatorApplicationWithApplicant[]>;
  findById(id: string): Promise<CreatorApplicationWithApplicant | null>;
  /** 通过并把申请人 users.role 升为该 role（admin 不降级）；非 pending 返回 null */
  approve(id: string, reviewerId: string): Promise<CreatorApplicationWithApplicant | null>;
  /** 驳回，users.role 不变；非 pending 返回 null */
  reject(id: string, reviewerId: string, reason: string): Promise<CreatorApplicationWithApplicant | null>;
}
