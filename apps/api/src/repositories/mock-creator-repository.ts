import { randomUUID } from "node:crypto";

import type {
  CreatorApplication,
  CreatorApplicationWithApplicant,
  CreatorRole,
  ReviewStatus,
} from "../domain/creator.js";
import type { CreatorApplicationInput, CreatorRepository } from "./creator-repository.js";
import { CONFLICT_MESSAGES, RepositoryConflictError } from "./errors.js";
import { byCreatedAtDesc, MockDataStore } from "./mock-store.js";

export class MockCreatorRepository implements CreatorRepository {
  private readonly store: MockDataStore;

  constructor(store: MockDataStore = new MockDataStore()) {
    this.store = store;
  }

  async findLatestByUser(userId: string): Promise<CreatorApplication | null> {
    const [latest] = this.store.creators
      .filter((creator) => creator.userId === userId)
      .sort(byCreatedAtDesc);
    return latest ? { ...latest } : null;
  }

  async findApproved(userId: string, role: CreatorRole): Promise<CreatorApplication | null> {
    const approved = this.store.creators.find(
      (creator) =>
        creator.userId === userId && creator.role === role && creator.reviewStatus === "approved",
    );
    return approved ? { ...approved } : null;
  }

  async apply(input: CreatorApplicationInput): Promise<CreatorApplication> {
    const existing = this.store.creators.find(
      (creator) => creator.userId === input.userId && creator.role === input.role,
    );
    if (existing && existing.reviewStatus !== "rejected") {
      throw new RepositoryConflictError(
        "DUPLICATE_APPLICATION",
        CONFLICT_MESSAGES.DUPLICATE_APPLICATION,
      );
    }
    // 对齐 001 的 UNIQUE (role, wallet_address)：同一角色下钱包不可被两份申请占用
    const walletTaken = this.store.creators.some(
      (creator) =>
        creator.role === input.role &&
        creator.walletAddress === input.walletAddress &&
        creator.id !== existing?.id,
    );
    if (walletTaken) {
      throw new RepositoryConflictError("WALLET_TAKEN", CONFLICT_MESSAGES.WALLET_TAKEN);
    }

    if (existing) {
      existing.displayName = input.displayName;
      existing.walletAddress = input.walletAddress;
      existing.reviewStatus = "pending";
      existing.rejectionReason = null;
      existing.reviewedBy = null;
      existing.reviewedAt = null;
      existing.verifiedAt = null;
      return { ...existing };
    }

    const created: CreatorApplication = {
      id: randomUUID(),
      userId: input.userId,
      role: input.role,
      displayName: input.displayName,
      walletAddress: input.walletAddress,
      reviewStatus: "pending",
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      verifiedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.store.creators.push(created);
    return { ...created };
  }

  async listByStatus(status: ReviewStatus): Promise<CreatorApplicationWithApplicant[]> {
    return this.store.creators
      .filter((creator) => creator.reviewStatus === status)
      .sort(byCreatedAtDesc)
      .map((creator) => this.withApplicant(creator));
  }

  async findById(id: string): Promise<CreatorApplicationWithApplicant | null> {
    const creator = this.store.findCreator(id);
    return creator ? this.withApplicant(creator) : null;
  }

  async approve(id: string, reviewerId: string): Promise<CreatorApplicationWithApplicant | null> {
    const creator = this.store.findCreator(id);
    if (!creator || creator.reviewStatus !== "pending") {
      return null;
    }
    const now = new Date().toISOString();
    creator.reviewStatus = "approved";
    creator.rejectionReason = null;
    creator.reviewedBy = reviewerId;
    creator.reviewedAt = now;
    creator.verifiedAt = now;

    const applicant = creator.userId ? this.store.findUser(creator.userId) : null;
    if (applicant && applicant.role !== "admin") {
      applicant.role = creator.role;
    }
    return this.withApplicant(creator);
  }

  async reject(
    id: string,
    reviewerId: string,
    reason: string,
  ): Promise<CreatorApplicationWithApplicant | null> {
    const creator = this.store.findCreator(id);
    if (!creator || creator.reviewStatus !== "pending") {
      return null;
    }
    creator.reviewStatus = "rejected";
    creator.rejectionReason = reason;
    creator.reviewedBy = reviewerId;
    creator.reviewedAt = new Date().toISOString();
    creator.verifiedAt = null;
    return this.withApplicant(creator);
  }

  private withApplicant(creator: CreatorApplication): CreatorApplicationWithApplicant {
    const applicant = creator.userId ? this.store.findUser(creator.userId) : null;
    return {
      ...creator,
      applicant: applicant
        ? {
            id: applicant.id,
            username: applicant.username,
            role: applicant.role,
            primaryWallet: applicant.primaryWallet,
          }
        : null,
    };
  }
}
