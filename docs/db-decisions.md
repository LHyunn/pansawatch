# DB 설계 결정 사항

## 의도 / 범위

- **시점**: Phase 2 진입 전 청사진 (2026-04-30)
- **대상**: PostgreSQL >= 15 + Supabase
- **연관 자료**:
  - `lib/types.ts` — 14개 인터페이스 (DB 모델의 청사진)
  - `lib/data.ts` — 헬퍼 함수 (미래 SQL 쿼리 패턴)
  - `pansawatch-project-brief-v2.md` §2 (법적 분석), §5 (데이터 모델), §9 (개발 순서)
  - `data/*.json` — 7개 mock 파일 (courts 18, judges 50, articles 188, judgeArticles 237, cases 100, caseVotes 938, articleVotes 500)
- **법적 안전성 핵심**: 본 스키마는 "판결 단위 시민 투표" 도메인을 인코딩한다. `case_votes` 의 vote 는 판사 개인이 아닌 공문서(판례)에 대한 의견 표현이므로, 명예훼손 법리상 안전성이 구조적으로 보장되도록 case 와 judge 를 분리하고 vote 는 case 에만 직접 종속시킨다 (judge 는 case 를 통해 간접 집계).

---

## 결정 사항 (10개)

### D1. id 타입: text 유지 (단, users.id 는 UUID)

- **결정**: 도메인 테이블 (`courts`, `judges`, `articles`, `cases`, `judge_articles`, `case_votes`, `article_votes`) 의 `id` 는 `text`. mock JSON 의 `"judge-1"`, `"case-123"` 형식을 그대로 유지.
- **예외**: `users.id` 는 `uuid` — Supabase `auth.users.id` 와 1:1 매핑되어야 하므로 표준을 따름.
- **근거**:
  1. Phase 1 mock 데이터를 Phase 2 로 손실 없이 마이그레이트 가능 — 이미 운영 중인 컴포넌트의 라우트 (`/judges/judge-1`) 가 그대로 동작.
  2. 사람이 읽기 쉬운 ID — 디버깅·로그·URL 가독성.
  3. `text` 인덱스도 b-tree 로 충분히 빠름. 50만 row 까지는 UUID 와 성능 차이 무시 가능.
- **대안**: 추후 데이터 규모가 1000만 row 를 넘거나 외부 시스템과의 통합이 필요해지면 `uuid + slug` 듀얼 키 또는 전체 UUID 마이그레이션을 한 번에 수행. 그 시점까지 `text` PK 를 유지.

---

### D2. timestamp: TIMESTAMPTZ 일관 적용

- **결정**: 모든 시간 컬럼은 `TIMESTAMPTZ DEFAULT NOW()`. `decision_date` 만 예외적으로 `DATE` (시각 정보 없음 — 선고일자만).
- **근거**:
  1. mock JSON 이 이미 ISO 8601 + Z 접미사 (`"2026-04-09T23:33:09Z"`) — UTC 기준.
  2. Supabase 의 모든 트리거·정책 기본값이 TIMESTAMPTZ 친화적.
  3. Vercel (UTC) ↔ 한국 사용자 (KST) 간 변환은 클라이언트에서 처리하면 충분.
- **대안**: 시간 부분 없는 컬럼만 `DATE` (`cases.decision_date`).

---

### D3. ENUM 타입: PostgreSQL ENUM 사용

- **결정**: 5개 enum 정의.
  | 이름 | 값 |
  |------|----|
  | `court_type` | `supreme`, `high`, `district`, `family`, `administrative` |
  | `case_type` | `민사`, `형사`, `행정`, `가사` (한글 라벨) |
  | `vote_category` | `decision_agreement`, `sentencing_fairness` |
  | `vote_value` | `agree`, `disagree`, `appropriate`, `too_light`, `too_heavy` |
  | `article_vote_type` | `useful`, `not_useful` |
- **근거**:
  1. `lib/types.ts` 의 union type 과 1:1 매핑 — 컴파일타임 + DB 양쪽에서 무결성 보장.
  2. `case_type` 한글 라벨은 mock 데이터에 이미 한글이며, 별도 라벨 테이블 없이도 충분 (4종 고정).
  3. `vote_value` 는 카테고리별로 허용값이 다르지만, ENUM 으로 합집합을 만들고 `CHECK` 제약으로 (category, value) 조합 무결성 강제.
- **대안**: `text + CHECK IN (...)`. 거부 — 추가/삭제 시 모든 컬럼 마이그레이션 필요. ENUM 은 `ALTER TYPE ADD VALUE` 로 확장 용이.
- **주의**: ENUM 값 삭제는 PostgreSQL 에서 불가. 신규 값 추가만 가능.

---

### D4. 외래키 ON DELETE 전략

명시적 정책 (schema.sql 에 모두 인코딩):

| FK | 동작 | 근거 |
|----|------|------|
| `judges.court_id → courts(id)` | `RESTRICT` | 판사 있는 법원은 삭제 불가. 데이터 무결성 우선. |
| `cases.judge_id → judges(id)` | `RESTRICT` | 판사 삭제 시 판례 고아 방지. |
| `judge_articles.judge_id → judges(id)` | `CASCADE` | 매핑은 종속 데이터 — 판사 삭제 시 동반 제거. |
| `judge_articles.article_id → articles(id)` | `CASCADE` | 동상. |
| `case_votes.case_id → cases(id)` | `CASCADE` | 판례 삭제 시 투표 동반 제거. |
| `case_votes.user_id → users(id)` | `SET NULL` | 회원 탈퇴 시 익명화 — 집계 결과 유지. |
| `article_votes.article_id → articles(id)` | `CASCADE` | 동상. |
| `article_votes.user_id → users(id)` | `SET NULL` | 동상. |
| `users.id → auth.users(id)` | `CASCADE` | Supabase 표준. |

- **핵심 원칙**: "공적 데이터 (court/judge/case/article) 는 보존. 사용자 데이터 (user) 는 탈퇴 시 익명화하여 사회적 집계 가치를 유지."

---

### D5. 익명 투표 vs 인증 필수

- **결정**: Phase 2 부터 `case_votes`, `article_votes` 는 인증 필수. 단, `user_id` 는 **NULL 허용** 으로 정의 (NOT NULL 미적용).
- **이유**:
  1. mock seed 의 모든 투표 row 는 `userId: null` (Phase 1 단계). 이를 그대로 이관해야 mock 화면의 집계 숫자가 일치.
  2. `users.id` ON DELETE SET NULL 정책의 부작용으로도 NULL 이 자연 발생 — 컬럼 자체가 NULL 허용이어야 일관됨.
  3. `auth.uid() = user_id` RLS 정책은 user_id 가 NULL 인 row 의 INSERT 를 자동 거부 (NULL = NULL 은 false).
- **Phase 4 강화 계획**: `data/*.json` mock 데이터 폐기 후 `case_votes.user_id NOT NULL` 마이그레이션 추가.
- **대안**: 시드 시 시스템 user 1명을 `auth.users` 에 만들어 모든 mock 투표를 그에게 귀속. 거부 — 가짜 사용자가 진짜 통계인 양 보일 위험. NULL 이 의도를 더 명확히 표현.

---

### D6. 집계 컬럼 vs view

- **결정**: **view 우선**. `v_case_vote_summary`, `v_judge_agreement`, `v_judge_appeal`, `v_article_vote_summary` 4개 정의.
- **근거**:
  1. **정합성 우선** — `cases.vote_count` 같은 비정규화 컬럼은 트리거 또는 application 의 동기화 누락 시 즉시 거짓 정보 노출. 시빅테크 신뢰도와 직결.
  2. mock 규모 (cases 100, votes 938) 에서는 view 의 GROUP BY 가 즉시 응답.
  3. Phase 5 까지 트래픽이 누적되어 view 가 느려지면 → materialized view 로 마이그레이션 (5분 주기 refresh) → 이후 Redis 캐시.
- **단 1개 예외**: `courts.judge_count` 는 비정규화 캐시. 이유: 메인 페이지 지도 마커 크기 결정에 사용되며, 판사 추가/삭제 빈도가 매우 낮음 (월 단위). seed 시점에 채우고, Phase 2 후반 트리거 또는 batch job 으로 동기화.
- **대안**: 처음부터 generated column. 거부 — 다중 테이블 집계는 generated column 으로 표현 불가.

---

### D7. soft delete: 도입 X

- **결정**: `deleted_at` 등 soft delete 컬럼 도입하지 않음. 필요 시 별도 archive 테이블로.
- **근거**:
  1. 단순화. RLS 정책이 단순해진다 (`WHERE deleted_at IS NULL` 누락 위험 없음).
  2. 도메인상 진짜 삭제할 일이 거의 없음 — 판사/판례/기사는 공적 데이터로 보존, 투표는 사용자가 변경/취소.
  3. GDPR 류 "삭제 권리" 요구 시 hard delete + audit log 가 더 안전.
- **대안**: 차후 운영상 archive 가 필요해지면 `<table>_archive` 동일 스키마 테이블 + 트리거.

---

### D8. case_number 검색: pg_trgm GIN 인덱스

- **결정**: `CREATE INDEX idx_cases_number_trgm ON cases USING gin (case_number gin_trgm_ops);`
- **근거**:
  1. `lib/data.ts:searchCasesByNumber` 가 `c.caseNumber.includes(q)` — 부분 일치.
  2. 일반 b-tree 인덱스로는 `LIKE '%query%'` 가속 불가. trgm (3-gram) GIN 이 표준 해법.
  3. 사건번호 ("2024가합12345") 는 한글 + 숫자 혼합 — trgm 이 한글에서도 동작.
- **Phase 5 액션**: Elasticsearch 도입 시 본 인덱스 제거 (인덱스 유지비 + insert/update 비용).

---

### D9. Supabase Auth 연동: public.users 미러 + 트리거

- **결정**:
  1. `public.users (id uuid PK REFERENCES auth.users(id) ON DELETE CASCADE, auth_provider text, created_at timestamptz)` 정의.
  2. `auth.users` 에 `AFTER INSERT` 트리거 — `public.handle_new_user()` 가 `auth.users.raw_app_meta_data->>'provider'` 에서 provider 추출 후 mirror 행 생성.
  3. 모든 도메인 FK 는 `public.users(id)` 를 참조 (auth 스키마 직접 참조 회피).
- **근거**:
  1. Supabase 표준 패턴. `auth.users` 직접 FK 참조는 Supabase 가 권장하지 않음 (스키마 변경 가능성).
  2. `auth_provider` 같은 도메인 메타데이터를 추가할 자리가 필요.
- **Supabase 특화 표시**: schema.sql 의 §6 섹션은 일반 Postgres 에서는 동작하지 않음 (auth 스키마 부재). 코멘트로 명시.

---

### D10. 인덱스 전략: lib/data.ts 헬퍼 분석에 기반한 11개

`lib/data.ts` 의 in-memory 헬퍼를 SQL 쿼리 패턴으로 환산:

| 헬퍼 | 인덱스 |
|------|--------|
| `getRecentArticles`, `getArticlesPage` (정렬) | `idx_articles_published_at` |
| `getArticlesPage` source 필터 | `idx_articles_source` |
| `getArticlesByJudge` | `idx_judge_articles_judge` |
| `getJudgesForArticle` | `idx_judge_articles_article` |
| `getJudgesByCourt`, `getCourtAgreementRate` | `idx_judges_court` |
| `getCasesByJudge` (정렬 포함) | `idx_cases_judge_decision` |
| `searchCasesByNumber` | `idx_cases_number_trgm` |
| `getCaseVoteSummary`, `getJudgeAgreementRate` | `idx_case_votes_case_category` |
| 마이페이지 (Phase 2 신규) | `idx_case_votes_user` (partial WHERE NOT NULL) |
| `getArticleVoteSummary` | `idx_article_votes_article` |
| 마이페이지 | `idx_article_votes_user` (partial) |

- **원칙**: 핵심 쿼리만. 인덱스 과다 = insert 비용 증가. Supabase Free Tier 디스크 8GB 고려.
- **partial index**: `user_id` 인덱스는 NULL 제외 (mock seed 가 모두 NULL 이라 인덱스 무의미). Phase 2 이후 진짜 user 데이터에만 효과.

---

## 미해결 / Phase 2 결정 필요

1. **`courts.judge_count` 동기화 메커니즘**: 트리거 vs nightly batch. 추천: Phase 2 후반에 `judges` 테이블에 AFTER INSERT/DELETE 트리거.
2. **judges.court / court_region 비정규화 컬럼 동기화**: courts.name 변경 시 application 또는 트리거. Phase 2 결정 필요.
3. **`cases.case_number` UNIQUE 여부**: 도메인상 충돌 사례 (다른 법원 같은 번호) 존재. 일단 미설정. 실제 데이터 수집 시점에 재검토.
4. **시드 user_id NULL 처리**: NULL 유지 vs 시스템 user 귀속 (D5 항목). Phase 4 에서 재결정.
5. **익명 IP 기반 투표 차단**: 1인 1투표 강화는 user_id UNIQUE 만으론 부족 (계정 다중 생성). reCAPTCHA + IP 레이트 리밋 — Phase 2 결정.

---

## 마이그레이션 운영 절차

### 도구

- **Supabase CLI** 사용 가정.
  ```bash
  npm install --save-dev supabase  # 또는 brew install supabase/tap/supabase
  supabase login
  supabase link --project-ref <project-ref>
  ```

### 디렉토리 구조

```
db/
├── schema.sql                   # 청사진 (참조용)
├── policies.sql                 # 청사진 (참조용)
├── seed.ts                      # mock JSON -> DB
└── migrations/
    └── 0001_init.sql            # 실제 적용 단위
```

> Supabase CLI 표준 디렉토리는 `supabase/migrations/`. Phase 2 진입 시
> `db/migrations/0001_init.sql` 을 `supabase/migrations/<timestamp>_init.sql` 로
> 복사 또는 symlink. 본 phase 에서는 Supabase 디렉토리는 만들지 않음 (CLI 미설치 상태).

### 적용 명령

```bash
# 1. 로컬 검증
supabase db reset           # 로컬 컨테이너 초기화 후 마이그레이션 적용
supabase db diff            # schema 차이 확인

# 2. 프로덕션 적용
supabase db push            # 원격 DB 에 마이그레이션 push

# 3. seed 실행
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
npx ts-node db/seed.ts
```

### 롤백

- 본 phase 의 `0001_init.sql` 는 down 스크립트 없음.
- 필요 시 별도 `0001_init.down.sql` 작성:
  ```sql
  DROP TABLE IF EXISTS article_votes, case_votes, judge_articles, cases,
                       articles, judges, users, courts CASCADE;
  DROP TYPE IF EXISTS court_type, case_type, vote_category, vote_value,
                       article_vote_type;
  DROP FUNCTION IF EXISTS set_updated_at, public.handle_new_user CASCADE;
  ```

### 권장 사전 준비

- `npm install --save-dev @supabase/supabase-js dotenv ts-node` (현재 미설치 상태).
- `.env.local` 에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 추가.
- `.gitignore` 에 `.env.local` 포함 확인.

---

## 확장성 / Phase 5

### 1. Elasticsearch 도입 시점 (검색 고도화)

- 트리거: `cases` row 가 5만+ 또는 trgm 검색 응답 > 200ms.
- 액션:
  1. `idx_cases_number_trgm` 제거 (D8).
  2. `pg_trgm` extension 은 유지 (다른 용도 가능).
  3. ES 인덱스 sync 는 logical replication 또는 Supabase Realtime + 별도 indexer.

### 2. Materialized view 도입 시점

- 트리거: `case_votes` row 가 100만+ 또는 `v_judge_agreement` 응답 > 500ms.
- 액션:
  ```sql
  CREATE MATERIALIZED VIEW mv_judge_agreement AS SELECT * FROM v_judge_agreement;
  CREATE UNIQUE INDEX ON mv_judge_agreement (judge_id);
  -- pg_cron 으로 5분 주기 REFRESH MATERIALIZED VIEW CONCURRENTLY mv_judge_agreement;
  ```

### 3. Redis 캐시 대상

- 우선순위 (Phase 5 진입 시):
  1. `/` 메인 페이지 — 최근 기사 12건 (TTL 60초).
  2. `/judges/[id]` 통계 탭 — `getJudgeAgreementRate`, `getJudgeAppealRate`, `getJudgeMonthlyAgreementRate` (TTL 5분).
  3. `/courts/[id]` — 소속 판사 + 동의율 (TTL 5분).
- 투표 직후 invalidation 은 application 레벨에서.

### 4. Sharding / read replica

- Supabase Pro 의 read replica 가 충분. 자체 sharding 은 불필요 (도메인 규모상 100만 row 미만 예상).

---

## 패키지 설치 안내

본 phase 에서는 `package.json` 변경하지 않음. Phase 2 진입 시 다음을 추가:

```bash
npm install @supabase/supabase-js
npm install --save-dev dotenv ts-node @types/node
```

`db/seed.ts` 는 `@supabase/supabase-js` 를 동적 import 하여, 패키지 미설치 상태에서도 `npx tsc --noEmit` 통과하도록 설계됨. 실제 실행 시점에 친절한 에러 메시지로 설치 안내.

---

## lib/types.ts 와 schema 매핑 (의식적 차이)

| TypeScript | DB | 차이 / 이유 |
|-----------|-----|-----------|
| `Court.judgeCount: number` | `courts.judge_count` | 동일 |
| `Judge.courtId / court / courtRegion` | `judges.court_id, court, court_region` | 후 두 컬럼은 비정규화 캐시 (조회 성능). FK 무결성은 court_id 만. |
| `Case.appealResult: string \| null` | `cases.appeal_result text NULL` + `CHECK (is_appealed=true OR appeal_result IS NULL)` | DB 가 무결성 강화. |
| `CaseVote.userId: string \| null` | `case_votes.user_id uuid NULL` | string → uuid 타입 변환. mock NULL 유지 (D5). |
| `JudgeWithStats`, `ArticleWithJudges` | view 또는 application 조립 | DB 테이블 아님. v_judge_agreement 등으로 일부 제공. |
| `CaseVoteSummary`, `JudgeAgreementStat`, ... | application 단계에서 조립 | view + 클라이언트 가공. |

---

## 카운트

- **테이블**: 8개 (`courts`, `users`, `judges`, `articles`, `cases`, `judge_articles`, `case_votes`, `article_votes`)
- **ENUM**: 5개
- **인덱스**: 11개 (PK 자동 생성 인덱스 8개 별도)
- **VIEW**: 4개
- **TRIGGER**: 4개 (3개 updated_at + 1개 auth mirror)
- **RLS 정책**: 14개 (5개 공개 SELECT — courts/judges/articles/cases/judge_articles + 1개 users self + 4개 case_votes + 4개 article_votes)
