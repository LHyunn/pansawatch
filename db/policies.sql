-- =============================================================================
-- PansaWatch — policies.sql
-- Row Level Security (RLS) 정책.
--
-- 원칙:
--   1. 공개 데이터 (courts, judges, articles, judge_articles, cases) 는 SELECT 만
--      anon / authenticated 모두 허용. 쓰기는 service_role (서버) 만.
--   2. 투표 (case_votes, article_votes) 는
--      - SELECT: 공개 (집계 표시용)
--      - INSERT: authenticated, auth.uid() = user_id
--      - UPDATE/DELETE: 본인 행만
--   3. users (auth 미러) 는 본인 행만 SELECT. UPDATE 는 service_role.
--   4. 모든 테이블에 RLS ENABLE — Supabase 의 anon/authenticated 키로 접근 시
--      정책 미설정 = 접근 거부.
--
-- 참고: service_role 키는 RLS 를 우회. seed.ts 등 서버 쓰기는 service_role 사용.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- RLS 활성화
-- -----------------------------------------------------------------------------

ALTER TABLE courts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE judges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_articles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_votes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_votes   ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 공개 데이터 — SELECT 모두 허용
-- -----------------------------------------------------------------------------

-- courts
CREATE POLICY courts_select_all ON courts
  FOR SELECT TO anon, authenticated
  USING (true);

-- judges
CREATE POLICY judges_select_all ON judges
  FOR SELECT TO anon, authenticated
  USING (true);

-- articles
CREATE POLICY articles_select_all ON articles
  FOR SELECT TO anon, authenticated
  USING (true);

-- cases
CREATE POLICY cases_select_all ON cases
  FOR SELECT TO anon, authenticated
  USING (true);

-- judge_articles (매핑)
CREATE POLICY judge_articles_select_all ON judge_articles
  FOR SELECT TO anon, authenticated
  USING (true);


-- -----------------------------------------------------------------------------
-- users — 본인 행만 SELECT
--   (탈퇴/프로필 갱신은 service_role 또는 별도 RPC 함수로 처리)
-- -----------------------------------------------------------------------------

CREATE POLICY users_self_select ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);


-- -----------------------------------------------------------------------------
-- case_votes — 핵심 투표 테이블
--   SELECT  : 모두 허용 (집계 노출)
--   INSERT  : authenticated, user_id 가 본인
--   UPDATE  : 본인 행만 (투표 변경 가능 — 프로젝트 브리프 §12)
--   DELETE  : 본인 행만 (투표 취소)
-- -----------------------------------------------------------------------------

CREATE POLICY case_votes_select_all ON case_votes
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY case_votes_insert_self ON case_votes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY case_votes_update_self ON case_votes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY case_votes_delete_self ON case_votes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- article_votes — case_votes 와 동일 패턴
-- -----------------------------------------------------------------------------

CREATE POLICY article_votes_select_all ON article_votes
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY article_votes_insert_self ON article_votes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY article_votes_update_self ON article_votes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY article_votes_delete_self ON article_votes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
