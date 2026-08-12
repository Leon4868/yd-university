/** 唯一约束冲突的语义分类，路由据此给出不同的 409 文案 */
export type ConflictReason = "DUPLICATE_APPLICATION" | "WALLET_TAKEN" | "DUPLICATE_SLUG";

export class RepositoryConflictError extends Error {
  readonly reason: ConflictReason;

  constructor(reason: ConflictReason, message: string) {
    super(message);
    this.name = "RepositoryConflictError";
    this.reason = reason;
  }
}

export const CONFLICT_MESSAGES: Record<ConflictReason, string> = {
  DUPLICATE_APPLICATION: "你已提交过该角色的申请",
  WALLET_TAKEN: "该钱包已被其他申请占用",
  DUPLICATE_SLUG: "该课程 slug 已被占用",
};
