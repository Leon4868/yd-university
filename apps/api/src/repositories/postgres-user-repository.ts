import type { Sql } from "postgres";

import type { User, UserRole } from "../domain/user.js";
import type { ProvisionUserInput, UserRepository } from "./user-repository.js";

interface UserRow {
  id: string;
  privy_user_id: string;
  username: string;
  avatar_url: string | null;
  primary_wallet: string | null;
  role: UserRole;
}

export class PostgresUserRepository implements UserRepository {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  async findByPrivyUserId(privyUserId: string): Promise<User | null> {
    const rows = await this.sql<UserRow[]>`
      SELECT id, privy_user_id, username, avatar_url, primary_wallet, role
      FROM users
      WHERE privy_user_id = ${privyUserId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return null;
    }
    return mapUserRow(row);
  }

  async provision(input: ProvisionUserInput): Promise<User> {
    // 并发下两个请求可能同时建号，ON CONFLICT 保证只落一行且都能拿到它
    const rows = await this.sql<UserRow[]>`
      INSERT INTO users (privy_user_id, username, primary_wallet, role)
      VALUES (${input.privyUserId}, ${input.username}, ${input.primaryWallet}, 'student')
      ON CONFLICT (privy_user_id) DO UPDATE SET updated_at = now()
      RETURNING id, privy_user_id, username, avatar_url, primary_wallet, role
    `;
    const row = rows[0];
    if (!row) {
      throw new Error("provision users 未返回记录");
    }
    return mapUserRow(row);
  }

  async promoteToAdmin(userId: string): Promise<User> {
    const rows = await this.sql<UserRow[]>`
      UPDATE users
      SET role = 'admin', updated_at = now()
      WHERE id = ${userId}
      RETURNING id, privy_user_id, username, avatar_url, primary_wallet, role
    `;
    const row = rows[0];
    if (!row) {
      throw new Error("promoteToAdmin 未找到用户");
    }
    return mapUserRow(row);
  }

  async updatePrimaryWallet(userId: string, primaryWallet: string): Promise<User> {
    const rows = await this.sql<UserRow[]>`
      UPDATE users
      SET primary_wallet = COALESCE(primary_wallet, ${primaryWallet}), updated_at = now()
      WHERE id = ${userId}
      RETURNING id, privy_user_id, username, avatar_url, primary_wallet, role
    `;
    const row = rows[0];
    if (!row) throw new Error("updatePrimaryWallet 未找到用户");
    return mapUserRow(row);
  }
}

function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    privyUserId: row.privy_user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    primaryWallet: row.primary_wallet,
    role: row.role,
  };
}
