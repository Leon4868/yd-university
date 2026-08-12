BEGIN;

-- 001 的 creators 没有申请人字段，存量数据无从归属，故允许为 NULL
ALTER TABLE creators ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE RESTRICT;

-- 同一用户同一 role 只保留一条申请；驳回后复用该行重置为 pending
-- 用部分唯一索引而非表级 UNIQUE：存量 user_id 为 NULL 的行不参与去重
CREATE UNIQUE INDEX IF NOT EXISTS creators_user_role_uniq_idx
  ON creators (user_id, role)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS creators_user_idx
  ON creators (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

COMMIT;
