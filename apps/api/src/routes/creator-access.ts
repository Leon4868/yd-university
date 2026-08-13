import type { CreatorApplication, CreatorRole } from "../domain/creator.js";
import type { User } from "../domain/user.js";
import type { CreatorRepository } from "../repositories/creator-repository.js";

/** 审核身份优先按用户归属查；钱包映射账号可复用同钱包的预置创作者资料 */
export async function findApprovedCreator(
  creators: CreatorRepository,
  user: User,
  role: CreatorRole,
): Promise<CreatorApplication | null> {
  const owned = await creators.findApproved(user.id, role);
  if (owned || !user.primaryWallet) return owned;
  return creators.findApprovedByWallet(user.primaryWallet, role);
}
