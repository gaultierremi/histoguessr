-- ============================================================
-- Spaced repetition columns — Run in Supabase SQL Editor
-- Adds SM-2 algorithm fields to user_concept_mastery
-- ============================================================

ALTER TABLE user_concept_mastery
  ADD COLUMN IF NOT EXISTS easiness_factor float   DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS interval_days   integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS review_count    integer DEFAULT 0;

-- Optional: index for fast "due today" queries
CREATE INDEX IF NOT EXISTS user_concept_mastery_next_review_idx
  ON user_concept_mastery (user_id, next_review);
