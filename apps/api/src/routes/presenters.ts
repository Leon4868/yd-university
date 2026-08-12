import type { CreatorApplication, CreatorApplicationWithApplicant } from "../domain/creator.js";
import type { User } from "../domain/user.js";

/** 契约里的创作者申请视图，审核人等内部字段不下发 */
export function toCreatorView(application: CreatorApplication) {
  return {
    id: application.id,
    role: application.role,
    displayName: application.displayName,
    walletAddress: application.walletAddress,
    reviewStatus: application.reviewStatus,
    rejectionReason: application.rejectionReason,
    reviewedAt: application.reviewedAt,
  };
}

export function toAdminCreatorView(application: CreatorApplicationWithApplicant) {
  return {
    ...toCreatorView(application),
    createdAt: application.createdAt,
    applicant: application.applicant,
  };
}

export function toCurrentUserView(user: User, creator: CreatorApplication | null) {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    primaryWallet: user.primaryWallet,
    role: user.role,
    creator: creator ? toCreatorView(creator) : null,
  };
}
