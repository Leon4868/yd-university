import postgres, { type ISql, type Sql } from "postgres";

import type {
  CreatorApplication,
  CreatorApplicationWithApplicant,
  CreatorRole,
  ReviewStatus,
} from "../domain/creator.js";
import type { UserRole } from "../domain/user.js";
import type { CreatorApplicationInput, CreatorRepository } from "./creator-repository.js";
import { CONFLICT_MESSAGES, RepositoryConflictError } from "./errors.js";

interface CreatorRow {
  id: string;
  user_id: string | null;
  role: CreatorRole;
  display_name: string;
  wallet_address: string;
  review_status: ReviewStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  verified_at: Date | null;
  created_at: Date;
}

interface CreatorWithApplicantRow extends CreatorRow {
  applicant_id: string | null;
  applicant_username: string | null;
  applicant_role: UserRole | null;
  applicant_wallet: string | null;
}

export class PostgresCreatorRepository implements CreatorRepository {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
  }

  async findLatestByUser(userId: string): Promise<CreatorApplication | null> {
    const rows = await this.sql<CreatorRow[]>`
      SELECT
        id, user_id, role, display_name, wallet_address,
        review_status, rejection_reason, reviewed_by, reviewed_at, verified_at, created_at
      FROM creators
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const row = rows[0];
    return row ? mapCreatorRow(row) : null;
  }

  async findApproved(userId: string, role: CreatorRole): Promise<CreatorApplication | null> {
    const rows = await this.sql<CreatorRow[]>`
      SELECT
        id, user_id, role, display_name, wallet_address,
        review_status, rejection_reason, reviewed_by, reviewed_at, verified_at, created_at
      FROM creators
      WHERE user_id = ${userId} AND role = ${role} AND review_status = 'approved'
      LIMIT 1
    `;
    const row = rows[0];
    return row ? mapCreatorRow(row) : null;
  }

  async apply(input: CreatorApplicationInput): Promise<CreatorApplication> {
    let rows: CreatorRow[];
    try {
      // 冲突落在部分唯一索引 creators_user_role_uniq_idx：已驳回的申请复用同一行重置为 pending
      rows = await this.sql<CreatorRow[]>`
        INSERT INTO creators (user_id, role, display_name, wallet_address, review_status)
        VALUES (${input.userId}, ${input.role}, ${input.displayName}, ${input.walletAddress}, 'pending')
        ON CONFLICT (user_id, role) WHERE user_id IS NOT NULL DO UPDATE SET
          display_name = EXCLUDED.display_name,
          wallet_address = EXCLUDED.wallet_address,
          review_status = 'pending',
          rejection_reason = NULL,
          reviewed_by = NULL,
          reviewed_at = NULL,
          verified_at = NULL,
          updated_at = now()
        WHERE creators.review_status = 'rejected'
        RETURNING
          id, user_id, role, display_name, wallet_address,
          review_status, rejection_reason, reviewed_by, reviewed_at, verified_at, created_at
      `;
    } catch (error) {
      throw toApplyConflict(error);
    }
    const row = rows[0];
    if (!row) {
      // ON CONFLICT 命中但 DO UPDATE 的 WHERE 未放行，说明已有 pending/approved 申请
      throw new RepositoryConflictError(
        "DUPLICATE_APPLICATION",
        CONFLICT_MESSAGES.DUPLICATE_APPLICATION,
      );
    }
    return mapCreatorRow(row);
  }

  async listByStatus(status: ReviewStatus): Promise<CreatorApplicationWithApplicant[]> {
    return queryCreators(this.sql, { status });
  }

  async findById(id: string): Promise<CreatorApplicationWithApplicant | null> {
    const [found] = await queryCreators(this.sql, { id });
    return found ?? null;
  }

  async approve(id: string, reviewerId: string): Promise<CreatorApplicationWithApplicant | null> {
    // 审核通过要同时改 creators 与 users.role，两张表必须在同一事务里
    return this.sql.begin(async (tx) => {
      const rows = await tx<CreatorRow[]>`
        UPDATE creators SET
          review_status = 'approved',
          verified_at = now(),
          reviewed_by = ${reviewerId},
          reviewed_at = now(),
          rejection_reason = NULL,
          updated_at = now()
        WHERE id = ${id} AND review_status = 'pending'
        RETURNING
          id, user_id, role, display_name, wallet_address,
          review_status, rejection_reason, reviewed_by, reviewed_at, verified_at, created_at
      `;
      const row = rows[0];
      if (!row) {
        return null;
      }
      if (row.user_id) {
        await tx`
          UPDATE users SET role = ${row.role}, updated_at = now()
          WHERE id = ${row.user_id} AND role <> 'admin'
        `;
      }
      const [updated] = await queryCreators(tx, { id });
      return updated ?? null;
    });
  }

  async reject(
    id: string,
    reviewerId: string,
    reason: string,
  ): Promise<CreatorApplicationWithApplicant | null> {
    const rows = await this.sql<{ id: string }[]>`
      UPDATE creators SET
        review_status = 'rejected',
        verified_at = NULL,
        reviewed_by = ${reviewerId},
        reviewed_at = now(),
        rejection_reason = ${reason},
        updated_at = now()
      WHERE id = ${id} AND review_status = 'pending'
      RETURNING id
    `;
    return rows[0] ? this.findById(id) : null;
  }
}

/** 同一条 SQL 服务列表与单条查询，事务内外都能复用 */
async function queryCreators(
  sql: ISql,
  filter: { id?: string; status?: ReviewStatus },
): Promise<CreatorApplicationWithApplicant[]> {
  const id = filter.id ?? null;
  const status = filter.status ?? null;
  const rows = await sql<CreatorWithApplicantRow[]>`
    SELECT
      c.id,
      c.user_id,
      c.role,
      c.display_name,
      c.wallet_address,
      c.review_status,
      c.rejection_reason,
      c.reviewed_by,
      c.reviewed_at,
      c.verified_at,
      c.created_at,
      u.id AS applicant_id,
      u.username AS applicant_username,
      u.role AS applicant_role,
      u.primary_wallet AS applicant_wallet
    FROM creators c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE (${id}::uuid IS NULL OR c.id = ${id}::uuid)
      AND (${status}::text IS NULL OR c.review_status::text = ${status}::text)
    ORDER BY c.created_at DESC
  `;
  return rows.map(mapCreatorWithApplicantRow);
}

function mapCreatorRow(row: CreatorRow): CreatorApplication {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
    walletAddress: row.wallet_address,
    reviewStatus: row.review_status,
    rejectionReason: row.rejection_reason,
    reviewedBy: row.reviewed_by,
    reviewedAt: toIso(row.reviewed_at),
    verifiedAt: toIso(row.verified_at),
    createdAt: row.created_at.toISOString(),
  };
}

function mapCreatorWithApplicantRow(row: CreatorWithApplicantRow): CreatorApplicationWithApplicant {
  return {
    ...mapCreatorRow(row),
    applicant:
      row.applicant_id && row.applicant_username && row.applicant_role
        ? {
            id: row.applicant_id,
            username: row.applicant_username,
            role: row.applicant_role,
            primaryWallet: row.applicant_wallet,
          }
        : null,
  };
}

/** 23505 按 constraint_name 区分：钱包被别人占用 vs 自己重复提交 */
function toApplyConflict(error: unknown): unknown {
  if (!(error instanceof postgres.PostgresError) || error.code !== "23505") {
    return error;
  }
  if (error.constraint_name === "creators_role_wallet_address_key") {
    return new RepositoryConflictError("WALLET_TAKEN", CONFLICT_MESSAGES.WALLET_TAKEN);
  }
  return new RepositoryConflictError(
    "DUPLICATE_APPLICATION",
    CONFLICT_MESSAGES.DUPLICATE_APPLICATION,
  );
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
