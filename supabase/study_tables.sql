-- ============================================================
-- Study mode tables
-- Run in Supabase SQL Editor
-- ============================================================

-- Sessions d'étude créées par l'utilisateur via le wizard
CREATE TABLE IF NOT EXISTS study_sessions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject       text        NOT NULL,
  source        text        NOT NULL, -- 'topic' | 'pdf' | 'library' | 'mine' | 'manual'
  question_count int        NOT NULL DEFAULT 10,
  mode          text        NOT NULL DEFAULT 'normal', -- 'normal' | 'adaptive'
  difficulty    int         NOT NULL DEFAULT 1,
  topic         text,
  completed_at  timestamptz,
  created_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS study_sessions_user_id_idx ON study_sessions (user_id);
CREATE INDEX IF NOT EXISTS study_sessions_created_at_idx ON study_sessions (created_at DESC);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON study_sessions FOR ALL
  USING (auth.uid() = user_id);

-- Progression question par question dans une session
CREATE TABLE IF NOT EXISTS study_progress (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    uuid        REFERENCES study_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id   text        NOT NULL,
  correct       boolean     NOT NULL,
  answered_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS study_progress_session_id_idx ON study_progress (session_id);

ALTER TABLE study_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own progress"
  ON study_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM study_sessions s
      WHERE s.id = study_progress.session_id
        AND s.user_id = auth.uid()
    )
  );

-- Cache des questions générées par IA (PDF ou sujet libre)
-- Évite de re-appeler Claude pour le même contenu
CREATE TABLE IF NOT EXISTS generated_questions_cache (
  id         uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key  text  UNIQUE NOT NULL, -- SHA-256 du contenu source
  subject    text  NOT NULL,
  questions  jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS generated_questions_cache_key_idx ON generated_questions_cache (cache_key);

ALTER TABLE generated_questions_cache ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les authentifiés (cache partagé)
CREATE POLICY "Authenticated users can read cache"
  ON generated_questions_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Écriture via service role uniquement (API routes)
CREATE POLICY "Service role writes cache"
  ON generated_questions_cache FOR INSERT
  WITH CHECK (true);
