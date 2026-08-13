import type { User, UserRole } from "../domain/user.js";

export interface ProvisionUserInput {
  privyUserId: string;
  username: string;
  primaryWallet: string | null;
}

export interface UserRepository {
  findByPrivyUserId(privyUserId: string): Promise<User | null>;
  /** 首次通过外部身份提供方登录时按学生建号，并发下以 privy_user_id 唯一约束保证幂等 */
  provision(input: ProvisionUserInput): Promise<User>;
  /** 同步经 Privy identity token 验证过的钱包归属 */
  updatePrimaryWallet(userId: string, primaryWallet: string): Promise<User>;
  /** 把经过后端验证的钱包映射到配置角色，返回更新后的用户 */
  setRole(userId: string, role: UserRole): Promise<User>;
}
