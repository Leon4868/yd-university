BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE creator_role AS ENUM ('teacher', 'merchant');
CREATE TYPE course_level AS ENUM ('入门', '进阶', '高级');
CREATE TYPE course_status AS ENUM ('draft', 'review', 'published', 'archived');
CREATE TYPE purchase_status AS ENUM ('pending', 'confirmed', 'failed', 'reorged');
CREATE TYPE certificate_status AS ENUM ('pending', 'minted', 'revoked', 'failed');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id text NOT NULL UNIQUE,
  username varchar(50) NOT NULL,
  avatar_url text,
  primary_wallet varchar(42),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_wallet_format CHECK (
    primary_wallet IS NULL OR primary_wallet ~ '^0x[0-9a-fA-F]{40}$'
  )
);

CREATE TABLE creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role creator_role NOT NULL,
  display_name varchar(80) NOT NULL,
  wallet_address varchar(42) NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creators_wallet_format CHECK (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  UNIQUE (role, wallet_address)
);

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(120) NOT NULL UNIQUE,
  teacher_id uuid NOT NULL REFERENCES creators(id) ON DELETE RESTRICT,
  merchant_id uuid NOT NULL REFERENCES creators(id) ON DELETE RESTRICT,
  title varchar(160) NOT NULL,
  summary varchar(500) NOT NULL,
  description text NOT NULL DEFAULT '',
  category varchar(60) NOT NULL,
  level course_level NOT NULL,
  cover_url text,
  cover_tone varchar(12) NOT NULL DEFAULT 'violet',
  price_yd numeric(78, 0) NOT NULL,
  teacher_share_bps smallint NOT NULL DEFAULT 7000,
  merchant_share_bps smallint NOT NULL DEFAULT 2000,
  platform_share_bps smallint NOT NULL DEFAULT 1000,
  status course_status NOT NULL DEFAULT 'draft',
  rating numeric(2, 1) NOT NULL DEFAULT 0,
  student_count integer NOT NULL DEFAULT 0,
  chain_id bigint,
  registry_address varchar(42),
  chain_course_id numeric(78, 0),
  publish_tx_hash varchar(66),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_positive_price CHECK (price_yd > 0),
  CONSTRAINT courses_split_total CHECK (
    teacher_share_bps + merchant_share_bps + platform_share_bps = 10000
  ),
  CONSTRAINT courses_cover_tone CHECK (cover_tone IN ('violet', 'blue', 'teal'))
);

CREATE TABLE course_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  video_url text,
  position integer NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, position),
  CONSTRAINT course_sections_position CHECK (position > 0),
  CONSTRAINT course_sections_duration CHECK (duration_seconds >= 0)
);

CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  buyer_wallet varchar(42) NOT NULL,
  paid_price_yd numeric(78, 0) NOT NULL,
  chain_id bigint NOT NULL,
  tx_hash varchar(66) NOT NULL,
  block_number bigint,
  log_index integer,
  status purchase_status NOT NULL DEFAULT 'pending',
  purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, tx_hash, log_index),
  UNIQUE (course_id, buyer_wallet),
  CONSTRAINT purchases_wallet_format CHECK (buyer_wallet ~ '^0x[0-9a-fA-F]{40}$')
);

CREATE TABLE lesson_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
  completed_at timestamptz,
  watched_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section_id),
  CONSTRAINT lesson_progress_watched CHECK (watched_seconds >= 0)
);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  body varchar(1000) NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comments_body_not_blank CHECK (length(trim(body)) > 0)
);

CREATE TABLE certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  student_wallet varchar(42) NOT NULL,
  completion_id uuid NOT NULL UNIQUE,
  token_id numeric(78, 0),
  mint_tx_hash varchar(66),
  metadata_uri text NOT NULL,
  status certificate_status NOT NULL DEFAULT 'pending',
  completed_at timestamptz NOT NULL,
  minted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_wallet),
  CONSTRAINT certificates_wallet_format CHECK (student_wallet ~ '^0x[0-9a-fA-F]{40}$')
);

CREATE TABLE chain_sync_cursors (
  chain_id bigint NOT NULL,
  contract_address varchar(42) NOT NULL,
  last_finalized_block bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, contract_address),
  CONSTRAINT chain_sync_cursor_block CHECK (last_finalized_block >= 0)
);

CREATE INDEX courses_status_published_idx ON courses (status, published_at DESC);
CREATE INDEX course_sections_course_idx ON course_sections (course_id, position);
CREATE INDEX purchases_user_status_idx ON purchases (user_id, status, purchased_at DESC);
CREATE INDEX lesson_progress_user_idx ON lesson_progress (user_id, completed_at);
CREATE INDEX comments_course_created_idx ON comments (course_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX certificates_user_status_idx ON certificates (user_id, status, created_at DESC);

COMMIT;
