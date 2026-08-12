BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('student', 'teacher', 'merchant', 'admin');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'student';

ALTER TABLE creators ADD COLUMN IF NOT EXISTS review_status verification_status NOT NULL DEFAULT 'pending';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS rejection_reason varchar(500);

-- 001 的 verified_at 语义保留：非空即已通过审核，审核时间沿用 verified_at，审核人未知留空
UPDATE creators
SET review_status = 'approved',
    reviewed_at = COALESCE(reviewed_at, verified_at)
WHERE verified_at IS NOT NULL
  AND review_status = 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creators_approved_verified' AND conrelid = 'creators'::regclass
  ) THEN
    ALTER TABLE creators ADD CONSTRAINT creators_approved_verified CHECK (
      (review_status = 'approved') = (verified_at IS NOT NULL)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creators_rejected_reason' AND conrelid = 'creators'::regclass
  ) THEN
    ALTER TABLE creators ADD CONSTRAINT creators_rejected_reason CHECK (
      review_status <> 'rejected'
      OR (rejection_reason IS NOT NULL AND length(trim(rejection_reason)) > 0)
    );
  END IF;
END $$;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS rejection_reason varchar(500);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_url text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS provider_name varchar(60);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_x_url text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS provider_x_url text;

ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS provider varchar(60);
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS original_title varchar(160);

-- 存量课程：已上架的按 published_at 回填审核时间，待审的按 updated_at 回填提交时间
UPDATE courses
SET reviewed_at = COALESCE(published_at, updated_at)
WHERE status = 'published'
  AND reviewed_at IS NULL;

UPDATE courses
SET submitted_at = updated_at
WHERE status = 'review'
  AND submitted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courses_published_reviewed' AND conrelid = 'courses'::regclass
  ) THEN
    -- 存量已上架课程缺审核人时无法立即校验，先 NOT VALID 保证新写入受约束
    ALTER TABLE courses ADD CONSTRAINT courses_published_reviewed CHECK (
      status <> 'published'
      OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courses_published_reviewed' AND conrelid = 'courses'::regclass AND convalidated
  ) AND NOT EXISTS (
    SELECT 1 FROM courses
    WHERE status = 'published' AND (reviewed_by IS NULL OR reviewed_at IS NULL)
  ) THEN
    ALTER TABLE courses VALIDATE CONSTRAINT courses_published_reviewed;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courses_course_url_format' AND conrelid = 'courses'::regclass
  ) THEN
    ALTER TABLE courses ADD CONSTRAINT courses_course_url_format CHECK (
      course_url IS NULL OR course_url ~ '^https?://'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courses_teacher_x_url_format' AND conrelid = 'courses'::regclass
  ) THEN
    ALTER TABLE courses ADD CONSTRAINT courses_teacher_x_url_format CHECK (
      teacher_x_url IS NULL OR teacher_x_url ~ '^https?://'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courses_provider_x_url_format' AND conrelid = 'courses'::regclass
  ) THEN
    ALTER TABLE courses ADD CONSTRAINT courses_provider_x_url_format CHECK (
      provider_x_url IS NULL OR provider_x_url ~ '^https?://'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courses_provider_name_not_blank' AND conrelid = 'courses'::regclass
  ) THEN
    ALTER TABLE courses ADD CONSTRAINT courses_provider_name_not_blank CHECK (
      provider_name IS NULL OR length(trim(provider_name)) > 0
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'course_sections_external_url_format' AND conrelid = 'course_sections'::regclass
  ) THEN
    ALTER TABLE course_sections ADD CONSTRAINT course_sections_external_url_format CHECK (
      external_url IS NULL OR external_url ~ '^https?://'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'course_sections_provider_not_blank' AND conrelid = 'course_sections'::regclass
  ) THEN
    ALTER TABLE course_sections ADD CONSTRAINT course_sections_provider_not_blank CHECK (
      provider IS NULL OR length(trim(provider)) > 0
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'course_sections_original_title_not_blank' AND conrelid = 'course_sections'::regclass
  ) THEN
    ALTER TABLE course_sections ADD CONSTRAINT course_sections_original_title_not_blank CHECK (
      original_title IS NULL OR length(trim(original_title)) > 0
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role, created_at DESC);
CREATE INDEX IF NOT EXISTS creators_review_status_idx ON creators (review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS creators_review_pending_idx ON creators (created_at DESC) WHERE review_status = 'pending';
CREATE INDEX IF NOT EXISTS courses_review_queue_idx ON courses (submitted_at DESC) WHERE status = 'review';

COMMIT;
