-- =============================================================================
-- PansaWatch — Migration 0001_init
-- Created: 2026-04-30
-- Author : db-architect (Phase 2 진입 전 청사진)
--
-- 설명:
--   Phase 1 (mock JSON) 운영 후 Phase 2 (Supabase Postgres) 진입을 위한
--   초기 스키마 + RLS 정책 통합 마이그레이션.
--
--   db/schema.sql + db/policies.sql 을 하나로 합친 실행 가능 형태.
--   Supabase CLI 사용 가정:
--       supabase migration new init      # (이 파일이 그 결과물)
--       supabase db push                 # 적용
--
--   롤백:
--     이 마이그레이션의 down 스크립트는 별도 (이번 phase 미포함).
--     필요 시:  DROP TABLE ... CASCADE;  DROP TYPE ...;
--
-- 의존성:
--   - PostgreSQL >= 15
--   - Supabase auth 스키마 (auth.users 테이블 존재)
--
-- 적용 후 검증:
--   SELECT count(*) FROM pg_tables WHERE schemaname = 'public';   -- 8
--   SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';  -- 13 (PK 포함 시 더 많음)
--   SELECT count(*) FROM pg_policies WHERE schemaname = 'public'; -- 16
-- =============================================================================


BEGIN;


-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------

CREATE TYPE court_type AS ENUM (
  'supreme',
  'high',
  'district',
  'family',
  'administrative'
);

CREATE TYPE case_type AS ENUM (
  '민사',
  '형사',
  '행정',
  '가사'
);

CREATE TYPE vote_category AS ENUM (
  'decision_agreement',
  'sentencing_fairness'
);

CREATE TYPE vote_value AS ENUM (
  'agree',
  'disagree',
  'appropriate',
  'too_light',
  'too_heavy'
);

CREATE TYPE article_vote_type AS ENUM (
  'useful',
  'not_useful'
);


-- -----------------------------------------------------------------------------
-- 2. TABLES
-- -----------------------------------------------------------------------------

CREATE TABLE courts (
  id            text         PRIMARY KEY,
  name          text         NOT NULL,
  type          court_type   NOT NULL,
  region        text         NOT NULL,
  address       text         NOT NULL,
  latitude      double precision NOT NULL,
  longitude     double precision NOT NULL,
  judge_count   integer      NOT NULL DEFAULT 0 CHECK (judge_count >= 0),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id              uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_provider   text         NOT NULL CHECK (auth_provider IN ('google', 'kakao')),
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE judges (
  id                 text         PRIMARY KEY,
  name               text         NOT NULL,
  court_id           text         NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  court              text         NOT NULL,
  court_region       text         NOT NULL,
  position           text         NOT NULL,
  appointment_year   integer      NOT NULL CHECK (appointment_year BETWEEN 1900 AND 2100),
  career_summary     text         NOT NULL DEFAULT '',
  photo_url          text         NULL,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE articles (
  id              text         PRIMARY KEY,
  title           text         NOT NULL,
  url             text         NOT NULL,
  source          text         NOT NULL,
  published_at    timestamptz  NOT NULL,
  ai_summary      text         NOT NULL DEFAULT '',
  collected_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE cases (
  id                text         PRIMARY KEY,
  case_number       text         NOT NULL,
  court             text         NOT NULL,
  judge_id          text         NOT NULL REFERENCES judges(id) ON DELETE RESTRICT,
  case_type         case_type    NOT NULL,
  decision_date     date         NOT NULL,
  ai_summary        text         NOT NULL DEFAULT '',
  source_url        text         NOT NULL,
  decision_result   text         NOT NULL DEFAULT '',
  is_appealed       boolean      NOT NULL DEFAULT false,
  appeal_result     text         NULL,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  CHECK (is_appealed = true OR appeal_result IS NULL)
);

CREATE TABLE judge_articles (
  id                text         PRIMARY KEY,
  judge_id          text         NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  article_id        text         NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  relevance_score   double precision NOT NULL CHECK (relevance_score BETWEEN 0 AND 1),
  UNIQUE (judge_id, article_id)
);

CREATE TABLE case_votes (
  id              text          PRIMARY KEY,
  user_id         uuid          NULL REFERENCES users(id) ON DELETE SET NULL,
  case_id         text          NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  vote_category   vote_category NOT NULL,
  vote_value      vote_value    NOT NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  CHECK (
    (vote_category = 'decision_agreement'
       AND vote_value IN ('agree', 'disagree'))
    OR
    (vote_category = 'sentencing_fairness'
       AND vote_value IN ('appropriate', 'too_light', 'too_heavy'))
  ),
  UNIQUE (user_id, case_id, vote_category)
);

CREATE TABLE article_votes (
  id            text              PRIMARY KEY,
  user_id       uuid              NULL REFERENCES users(id) ON DELETE SET NULL,
  article_id    text              NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  vote_type     article_vote_type NOT NULL,
  created_at    timestamptz       NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);


-- -----------------------------------------------------------------------------
-- 3. INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX idx_articles_published_at        ON articles (published_at DESC);
CREATE INDEX idx_articles_source              ON articles (source);
CREATE INDEX idx_judge_articles_judge         ON judge_articles (judge_id);
CREATE INDEX idx_judge_articles_article       ON judge_articles (article_id);
CREATE INDEX idx_judges_court                 ON judges (court_id);
CREATE INDEX idx_cases_judge_decision         ON cases (judge_id, decision_date DESC);
CREATE INDEX idx_cases_number_trgm            ON cases USING gin (case_number gin_trgm_ops);
CREATE INDEX idx_case_votes_case_category     ON case_votes (case_id, vote_category);
CREATE INDEX idx_case_votes_user              ON case_votes (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_article_votes_article        ON article_votes (article_id);
CREATE INDEX idx_article_votes_user           ON article_votes (user_id) WHERE user_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 4. VIEWS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_case_vote_summary AS
SELECT
  case_id,
  vote_category,
  vote_value,
  COUNT(*)::bigint AS n
FROM case_votes
GROUP BY case_id, vote_category, vote_value;

CREATE OR REPLACE VIEW v_judge_agreement AS
SELECT
  c.judge_id,
  COUNT(*) FILTER (WHERE cv.vote_value = 'agree')::bigint AS agree_votes,
  COUNT(*)::bigint                                      AS total_votes,
  CASE
    WHEN COUNT(*) > 0
      THEN COUNT(*) FILTER (WHERE cv.vote_value = 'agree')::double precision / COUNT(*)
    ELSE 0
  END AS rate
FROM cases c
JOIN case_votes cv
  ON cv.case_id = c.id
 AND cv.vote_category = 'decision_agreement'
GROUP BY c.judge_id;

CREATE OR REPLACE VIEW v_judge_appeal AS
SELECT
  judge_id,
  COUNT(*) FILTER (WHERE is_appealed)::bigint AS appealed_count,
  COUNT(*) FILTER (
    WHERE is_appealed
      AND appeal_result IN ('파기환송', '파기자판')
  )::bigint AS reversed_count,
  CASE
    WHEN COUNT(*) FILTER (WHERE is_appealed) > 0
      THEN COUNT(*) FILTER (
             WHERE is_appealed AND appeal_result IN ('파기환송', '파기자판')
           )::double precision
           / COUNT(*) FILTER (WHERE is_appealed)
    ELSE 0
  END AS reverse_rate
FROM cases
GROUP BY judge_id;

CREATE OR REPLACE VIEW v_article_vote_summary AS
SELECT
  article_id,
  COUNT(*) FILTER (WHERE vote_type = 'useful')::bigint     AS useful,
  COUNT(*) FILTER (WHERE vote_type = 'not_useful')::bigint AS not_useful,
  COUNT(*)::bigint                                          AS total
FROM article_votes
GROUP BY article_id;


-- -----------------------------------------------------------------------------
-- 5. updated_at 트리거
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_courts_updated_at
  BEFORE UPDATE ON courts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_judges_updated_at
  BEFORE UPDATE ON judges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- 6. auth.users -> public.users 미러 트리거 (Supabase 특화)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provider_text text;
BEGIN
  provider_text := COALESCE(NEW.raw_app_meta_data->>'provider', 'google');
  IF provider_text NOT IN ('google', 'kakao') THEN
    provider_text := 'google';
  END IF;

  INSERT INTO public.users (id, auth_provider, created_at)
  VALUES (NEW.id, provider_text, COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

ALTER TABLE courts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE judges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_articles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_votes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_votes   ENABLE ROW LEVEL SECURITY;

-- 공개 데이터 SELECT
CREATE POLICY courts_select_all          ON courts          FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY judges_select_all          ON judges          FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY articles_select_all        ON articles        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY cases_select_all           ON cases           FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY judge_articles_select_all  ON judge_articles  FOR SELECT TO anon, authenticated USING (true);

-- users
CREATE POLICY users_self_select ON users
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- case_votes
CREATE POLICY case_votes_select_all ON case_votes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY case_votes_insert_self ON case_votes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY case_votes_update_self ON case_votes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY case_votes_delete_self ON case_votes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- article_votes
CREATE POLICY article_votes_select_all ON article_votes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY article_votes_insert_self ON article_votes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY article_votes_update_self ON article_votes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY article_votes_delete_self ON article_votes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


COMMIT;
