-- =============================================================================
-- PansaWatch — schema.sql
-- Phase 2 진입 전 청사진. PostgreSQL >= 15, Supabase 환경 가정.
--
-- 적용 순서:
--   0. extensions
--   1. enums
--   2. tables  (FK 의존성 순서: courts -> users -> judges -> articles
--                                 -> cases -> judge_articles -> case_votes
--                                 -> article_votes)
--   3. indexes (lib/data.ts 핵심 헬퍼에서 도출)
--   4. views   (집계는 view 우선, materialized view 는 Phase 5 검토)
--   5. updated_at 자동 갱신 트리거
--   6. auth.users -> public.users 미러 트리거 (Supabase 특화)
--
-- 명명 규칙:
--   - 테이블/컬럼: snake_case
--   - PK: id
--   - 외래키 컬럼: <ref_table>_id  (예: judge_id, court_id)
--   - 인덱스: idx_<table>_<col>[_<col2>]
--   - 트리거: trg_<table>_<purpose>
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- case_number trigram 검색


-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------

-- 법원 종류 (lib/types.ts CourtType)
CREATE TYPE court_type AS ENUM (
  'supreme',
  'high',
  'district',
  'family',
  'administrative'
);

-- 사건 유형 (lib/types.ts CaseType — 한글 라벨)
CREATE TYPE case_type AS ENUM (
  '민사',
  '형사',
  '행정',
  '가사'
);

-- 투표 카테고리 (lib/types.ts VoteCategory)
CREATE TYPE vote_category AS ENUM (
  'decision_agreement',
  'sentencing_fairness'
);

-- 투표 값 (lib/types.ts VoteValue) — agree/disagree (decision_agreement),
-- appropriate/too_light/too_heavy (sentencing_fairness)
CREATE TYPE vote_value AS ENUM (
  'agree',
  'disagree',
  'appropriate',
  'too_light',
  'too_heavy'
);

-- 기사 투표 종류
CREATE TYPE article_vote_type AS ENUM (
  'useful',
  'not_useful'
);


-- -----------------------------------------------------------------------------
-- 2. TABLES
-- -----------------------------------------------------------------------------

-- courts: 법원 마스터.
-- judge_count 는 비정규화된 캐시. judges insert/delete 시 동기화 필요
-- (Phase 2 에서는 view 또는 트리거 결정 — 현재는 seed 단계에서 채움).
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

COMMENT ON TABLE courts IS '법원 마스터. 위경도는 메인 페이지 지도 마커용.';
COMMENT ON COLUMN courts.judge_count IS '소속 판사 수 캐시. Phase 2 후반 트리거로 자동 동기화 검토.';


-- users: Supabase auth.users 의 public 미러. id 는 auth.users.id 와 동일 UUID.
-- ON DELETE CASCADE: auth.users 삭제 시 미러도 제거.
-- (Supabase 특화 — auth 스키마 의존)
CREATE TABLE users (
  id              uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_provider   text         NOT NULL CHECK (auth_provider IN ('google', 'kakao')),
  created_at      timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'Supabase auth.users 의 public 미러. handle_new_user 트리거가 자동 생성.';


-- judges: 판사. court_id FK는 RESTRICT (판사 있는 법원 삭제 불가).
-- court / court_region 컬럼은 비정규화 — 조회 성능 위함. courts.name 변경 시 동기화 필요.
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

COMMENT ON TABLE judges IS '판사 프로필. 공적 인사 데이터만 보관.';
COMMENT ON COLUMN judges.court IS '비정규화: courts.name 사본. courts.name 변경 시 application 또는 트리거에서 동기화.';
COMMENT ON COLUMN judges.court_region IS '비정규화: courts.region 사본.';


-- articles: 뉴스 기사. 본문은 저장하지 않는다 — title + url + ai_summary 만 (저작권 회피).
CREATE TABLE articles (
  id              text         PRIMARY KEY,
  title           text         NOT NULL,
  url             text         NOT NULL,
  source          text         NOT NULL,
  published_at    timestamptz  NOT NULL,
  ai_summary      text         NOT NULL DEFAULT '',
  collected_at    timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE articles IS '뉴스 기사 메타데이터. 원문은 저장하지 않음 — 링크 + AI 요약만.';


-- cases: 판례.
-- judge_id FK는 RESTRICT (판사 삭제 시 판례 고아 방지).
-- case_number 는 도메인상 UNIQUE 가능성 있으나 실제 사건번호 충돌 사례가 있으므로
-- 일단 UNIQUE 미설정 — 필요 시 Phase 2 후반 추가 검토.
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
  -- 무결성: appeal_result 는 is_appealed = true 일 때만 의미.
  CHECK (is_appealed = true OR appeal_result IS NULL)
);

COMMENT ON TABLE cases IS '판례. 공문서이므로 명예훼손 대상 아님.';
COMMENT ON COLUMN cases.appeal_result IS '항소심 결과 (원심유지/파기환송/파기자판/기각 등). is_appealed=false 면 NULL.';


-- judge_articles: 판사 ↔ 기사 다대다.
-- 둘 중 하나라도 삭제되면 매핑도 제거 (CASCADE).
-- UNIQUE(judge_id, article_id) 로 중복 매핑 방지.
CREATE TABLE judge_articles (
  id                text         PRIMARY KEY,
  judge_id          text         NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  article_id        text         NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  relevance_score   double precision NOT NULL CHECK (relevance_score BETWEEN 0 AND 1),
  UNIQUE (judge_id, article_id)
);

COMMENT ON TABLE judge_articles IS '판사 ↔ 기사 매핑. relevance_score 는 NER 매칭 점수.';


-- case_votes: 판결에 대한 시민 투표.  ⭐ 핵심 테이블.
-- user_id 는 NOT NULL — Phase 2 부터 인증 필수.
-- (단, Phase 1 mock seed 데이터는 system user 1명에 일괄 귀속시켜 import 가능 — seed.ts 참고)
-- ON DELETE: cases CASCADE (판례 삭제 시 투표도 제거),
--            users SET NULL (탈퇴 시 익명화하여 집계는 유지).
-- UNIQUE(user_id, case_id, vote_category): 1인 1투표 제약.
--   (단, user_id NULL 인 시드 row 의 경우 Postgres 의 NULL 비교 특성상 UNIQUE 가
--    여러 NULL 을 허용 — 이는 의도된 동작이며 시드 후 user_id 강제 NOT NULL 마이그레이션
--    적용 시 문제되지 않음.)
CREATE TABLE case_votes (
  id              text          PRIMARY KEY,
  user_id         uuid          NULL REFERENCES users(id) ON DELETE SET NULL,
  case_id         text          NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  vote_category   vote_category NOT NULL,
  vote_value      vote_value    NOT NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  -- 카테고리별로 허용된 vote_value 제약
  CHECK (
    (vote_category = 'decision_agreement'
       AND vote_value IN ('agree', 'disagree'))
    OR
    (vote_category = 'sentencing_fairness'
       AND vote_value IN ('appropriate', 'too_light', 'too_heavy'))
  ),
  -- 1인 1투표: 같은 (user, case, category) 조합 중복 방지.
  -- NULL user_id 는 mock seed 한정. Phase 4 에 user_id NOT NULL 강화 예정.
  UNIQUE (user_id, case_id, vote_category)
);

COMMENT ON TABLE case_votes IS '판결 단위 시민 투표. "판사가 아닌 공문서에 대한 의견" — 법적 안전성 핵심.';
COMMENT ON COLUMN case_votes.user_id IS 'Phase 1 mock seed 는 NULL 허용. Phase 4 에 NOT NULL 강화.';


-- article_votes: 기사 유용성 투표.
CREATE TABLE article_votes (
  id            text              PRIMARY KEY,
  user_id       uuid              NULL REFERENCES users(id) ON DELETE SET NULL,
  article_id    text              NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  vote_type     article_vote_type NOT NULL,
  created_at    timestamptz       NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);

COMMENT ON TABLE article_votes IS '기사 유용성 투표 (useful / not_useful).';


-- -----------------------------------------------------------------------------
-- 3. INDEXES
--   lib/data.ts 의 핵심 헬퍼에서 도출:
--     - getRecentArticles, getArticlesPage         -> articles.published_at DESC
--     - getArticlesByJudge, getJudgesForArticle    -> judge_articles.(judge_id, article_id)
--     - getCasesByJudge                            -> cases.(judge_id, decision_date DESC)
--     - getCaseVoteSummary, getJudgeAgreementRate  -> case_votes.(case_id, vote_category)
--     - searchCasesByNumber                        -> cases.case_number (trgm)
--     - getArticleVoteSummary                      -> article_votes.article_id
--     - getJudgesByCourt, getCourtAgreementRate    -> judges.court_id
--     - getArticlesPage source/from/to/region 필터  -> articles.source
-- -----------------------------------------------------------------------------

-- 기사 목록 (최신순 페이지네이션, 메인/뉴스 페이지)
CREATE INDEX idx_articles_published_at ON articles (published_at DESC);

-- 언론사 필터
CREATE INDEX idx_articles_source ON articles (source);

-- 판사 -> 기사
CREATE INDEX idx_judge_articles_judge ON judge_articles (judge_id);

-- 기사 -> 판사
CREATE INDEX idx_judge_articles_article ON judge_articles (article_id);

-- 법원 소속 판사
CREATE INDEX idx_judges_court ON judges (court_id);

-- 판사별 판례 최신순
CREATE INDEX idx_cases_judge_decision ON cases (judge_id, decision_date DESC);

-- 사건번호 부분일치 검색 (Phase 5 Elasticsearch 도입 시 제거 예정)
CREATE INDEX idx_cases_number_trgm ON cases USING gin (case_number gin_trgm_ops);

-- 판례 투표 집계
CREATE INDEX idx_case_votes_case_category ON case_votes (case_id, vote_category);

-- 사용자별 투표 (마이페이지 용)
CREATE INDEX idx_case_votes_user ON case_votes (user_id) WHERE user_id IS NOT NULL;

-- 기사 투표 집계
CREATE INDEX idx_article_votes_article ON article_votes (article_id);
CREATE INDEX idx_article_votes_user ON article_votes (user_id) WHERE user_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 4. VIEWS (집계 — 정합성 우선)
--   Phase 5 에서 트래픽이 늘면 v_case_vote_summary 를 materialized view 또는
--   Redis 캐시로 전환 검토.
-- -----------------------------------------------------------------------------

-- 판례별 (카테고리, 값) 카운트.  application 에서 CaseVoteSummary 형태로 가공.
CREATE OR REPLACE VIEW v_case_vote_summary AS
SELECT
  case_id,
  vote_category,
  vote_value,
  COUNT(*)::bigint AS n
FROM case_votes
GROUP BY case_id, vote_category, vote_value;

COMMENT ON VIEW v_case_vote_summary IS '판례별 카테고리 x 값 카운트. lib/data.ts:getCaseVoteSummary 의 SQL 구현.';

-- 판사별 시민 동의율.
-- 정의: 해당 판사 담당 판례에 달린 decision_agreement 투표 중 agree 비율.
-- (lib/data.ts:getJudgeAgreementRate 와 동일 — 투표 단위 평균이지 판례 단위 평균이 아님)
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

COMMENT ON VIEW v_judge_agreement IS '판사별 시민 동의율 (투표 단위). lib/data.ts:getJudgeAgreementRate 의 SQL 구현.';

-- 판사별 항소/파기 통계.
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

COMMENT ON VIEW v_judge_appeal IS '판사별 항소/파기 카운트 + 파기율. lib/data.ts:getJudgeAppealRate 부분 SQL 구현.';

-- 기사별 유용성 투표 카운트.
CREATE OR REPLACE VIEW v_article_vote_summary AS
SELECT
  article_id,
  COUNT(*) FILTER (WHERE vote_type = 'useful')::bigint     AS useful,
  COUNT(*) FILTER (WHERE vote_type = 'not_useful')::bigint AS not_useful,
  COUNT(*)::bigint                                          AS total
FROM article_votes
GROUP BY article_id;

COMMENT ON VIEW v_article_vote_summary IS '기사 유용성 투표 카운트.';


-- -----------------------------------------------------------------------------
-- 5. updated_at 자동 갱신 트리거
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
-- 6. auth.users -> public.users 자동 미러 (Supabase 특화)
--   신규 회원가입 시 public.users row 자동 생성.
--   auth_provider 는 raw_app_meta_data->>'provider' 에서 추출.
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
  -- 허용된 provider 만 기록. 그 외는 google 로 폴백.
  IF provider_text NOT IN ('google', 'kakao') THEN
    provider_text := 'google';
  END IF;

  INSERT INTO public.users (id, auth_provider, created_at)
  VALUES (NEW.id, provider_text, COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Supabase 특화: auth.users 에 트리거를 건다.
-- (Supabase CLI / dashboard 에서 실행해야 함 — 일반 Postgres 에는 auth 스키마 없음)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
