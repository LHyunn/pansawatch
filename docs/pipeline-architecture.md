# PansaWatch — 파이프라인 아키텍처

> Phase 3 (데이터 수집·AI 요약·매칭 파이프라인) 청사진.
> 결정 우선 — "추후 검토" 최소화. 구현 코드는 Phase 3 sprint 에서 작성.

---

## 1. 전체 데이터 흐름

```mermaid
flowchart LR
  subgraph Sources["출처 (외부)"]
    NAVER["Naver Search API\n(news)"]
    KAKAO["Kakao Daum Search\n(웹/블로그)"]
    GNEWS["Google News RSS\n(발견용)"]
    LTIMES["법률신문 sitemap"]
    LAW["국가법령정보 OPEN API\n(판례)"]
    SCOURT["대법원 보도자료\n(인사발령)"]
  end

  subgraph Collectors["수집 (GitHub Actions cron)"]
    C_NEWS[news-crawler]
    C_CASES[cases-crawler]
    C_APPT[appointments-crawler]
  end

  subgraph Stage["스테이징 (S3 / Supabase Storage)"]
    RAW["raw/<source>/<yyyy-mm-dd>/<id>.json"]
  end

  subgraph Process["정제 + AI 요약"]
    NORM[normalize\n+ url canonical\n+ dedupe simhash]
    NER[Claude entity extraction\n→ judge candidates]
    AI_NEWS[Haiku 4.5\n기사 요약]
    AI_CASES[Sonnet 4.6\n판례 요약]
  end

  subgraph Match["매칭"]
    MATCH[judges 테이블 lookup\n+ 법원/임관년 검증\n→ relevance_score]
    Q[manual review queue\n(불확실 매칭)]
  end

  subgraph DB["PostgreSQL (Supabase)"]
    T_ART[(articles)]
    T_JART[(judge_articles)]
    T_CASES[(cases)]
    T_JUDGES[(judges)]
  end

  NAVER --> C_NEWS
  KAKAO --> C_NEWS
  GNEWS --> C_NEWS
  LTIMES --> C_NEWS
  LAW --> C_CASES
  SCOURT --> C_APPT

  C_NEWS --> RAW
  C_CASES --> RAW
  C_APPT --> RAW

  RAW --> NORM
  NORM --> NER
  NER --> AI_NEWS
  NER --> AI_CASES
  AI_NEWS --> MATCH
  AI_CASES --> MATCH
  MATCH --> T_ART
  MATCH --> T_JART
  MATCH --> T_CASES
  MATCH --> Q
  C_APPT --> T_JUDGES

  classDef src fill:#1f3b6e,color:#fff,stroke:#0a1f48;
  classDef proc fill:#f4a261,color:#0a1f48,stroke:#b97122;
  classDef db fill:#264653,color:#fff,stroke:#142a30;
  class NAVER,KAKAO,GNEWS,LTIMES,LAW,SCOURT src;
  class C_NEWS,C_CASES,C_APPT,NORM,NER,AI_NEWS,AI_CASES,MATCH proc;
  class T_ART,T_JART,T_CASES,T_JUDGES db;
```

---

## 2. 데이터 라이프사이클 단계

| 단계 | 정의 | 저장 위치 | TTL |
|-----|------|---------|-----|
| **raw** | 원본 응답 그대로 (JSON/XML) | S3 또는 Supabase Storage `raw/<source>/<date>/<id>.json` | 90일 |
| **staged** | 정제 (URL 정규화, HTML 엔티티 디코드, 본문 발췌 제거) | S3 `staged/<source>/<date>/<id>.json` | 30일 |
| **normalized** | 중복 제거된 article/case 후보 | DB 임시 테이블 또는 Redis queue | 7일 (처리 후 삭제) |
| **enriched** | AI 요약 + 매칭 정보 추가 | DB `articles`, `cases`, `judge_articles` | 영구 |

> **본문 미저장 원칙**: raw 단계에서도 기사 본문은 받아오되 **staged 로 옮길 때 발췌(첫 500자) 만 보관**. AI 요약 후 staged 도 30일 후 자동 삭제. DB 에는 title + url + ai_summary 만 영구 저장.

---

## 3. 스케줄링 — GitHub Actions vs AWS Lambda + EventBridge

### 비교표

| 항목 | GitHub Actions cron | AWS Lambda + EventBridge |
|-----|---------------------|--------------------------|
| **비용 (Phase 3 규모)** | 공개 레포 무제한 무료, private 도 월 2,000분 무료 | 1M 호출 + 400k GB-sec 무료 → Phase 3 규모 (월 1k 호출 미만) 사실상 무료 |
| **타이밍 정확도** | 고부하 시 최대 수십 분 지연 (best-effort) | 분 단위 정확 |
| **최대 실행 시간** | 6시간 (job 단위) | 15분 (Lambda 단일 호출) |
| **시크릿 관리** | GitHub Secrets (UI) | AWS Secrets Manager / SSM |
| **로그·관측** | Actions UI + 다운로드 가능한 log artifact | CloudWatch Logs (조회 + 알람) |
| **운영 복잡도** | YAML 1개 + npm script | IAM 역할 + Lambda + EventBridge + 배포 파이프라인 |
| **레포 결합도** | 코드와 같은 곳, 배포 자동 | 별도 배포 단계 필요 |
| **인프라 락인** | 낮음 (커서 변경 쉬움) | AWS 락인 |
| **실패 알림** | Actions failure → email/Slack | CloudWatch Alarm → SNS |
| **Vercel 등 다른 서비스와 트리거 통합** | API token + curl 단순 | EventBridge 룰 추가 |

### Vercel Cron 도 검토했으나 제외
- Vercel Hobby 플랜은 **하루 1회 cron 만** 허용 ([changelog](https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan)). PansaWatch 뉴스 크롤러는 **6시간 주기** 필요 → Hobby 미충족, Pro $20/월 필요.
- Pro 플랜 사용한다 해도 함수 실행 시간 60초 (Hobby) / 900초 (Pro) 제한 — 스파이크 시 부족 가능.

### 권장 — GitHub Actions cron (Phase 3) → Lambda 마이그레이션 (Phase 5)

**이유**
1. Phase 3 트래픽 (일일 ~100건 기사 + 월 ~30건 판례) 은 GitHub Actions free tier 안에서 충분.
2. 코드와 워크플로 동일 레포 → 변경/롤백 단순.
3. 시크릿 1곳 관리 (GitHub Secrets).
4. 운영자 1인 (브리프 §11) 환경에서 인프라 학습 비용 최소화.
5. Phase 5 트래픽 증가 + 분 단위 정확도 필요 시 Lambda 로 이전 (코드는 함수 추상화 유지).

### Cron 스케줄 표현식

| 작업 | 빈도 | UTC 시각 | KST 시각 | cron 표현식 |
|-----|------|---------|---------|------------|
| news-crawler | 6시간마다 | 00:15, 06:15, 12:15, 18:15 | 09:15, 15:15, 21:15, 03:15 | `15 0,6,12,18 * * *` |
| cases-crawler | 월 1회 batch | 매월 1일 19:00 | 익일 04:00 | `0 19 1 * *` |
| cases-backfill | 분기별 1회 (선택) | 매분기 첫째 월요일 19:00 | 익일 04:00 | `0 19 1-7 1,4,7,10 1` |
| appointments-crawler | 주 1회 | 매주 월요일 21:00 | 화 06:00 | `0 21 * * 1` |
| judges-court-sync | 일 1회 | 매일 23:00 | 익일 08:00 | `0 23 * * *` |

> **15분 오프셋** (`15 0,6,12,18 * * *`): GitHub Actions 의 cron 은 정시 (`0 0`) 에 트리거가 몰려 지연됨. 15분 시프트로 큐 단축.

---

## 4. 디렉터리 / 패키지 구조

```
scripts/                                # 기존 mock seed scripts
crawlers/                               # NEW (Phase 3)
  ├─ src/
  │   ├─ adapters/
  │   │   ├─ naver-news.ts
  │   │   ├─ kakao-daum.ts
  │   │   ├─ google-news-rss.ts
  │   │   ├─ lawtimes-sitemap.ts
  │   │   ├─ law-go-kr.ts                # 판례 OPEN API
  │   │   └─ scourt-press.ts             # 보도자료
  │   ├─ pipeline/
  │   │   ├─ normalize.ts                # URL canonical, HTML decode
  │   │   ├─ dedupe.ts                   # SimHash + URL hash
  │   │   ├─ ner-claude.ts               # Claude 인명/법원 추출
  │   │   ├─ summarize-haiku.ts          # 기사 요약
  │   │   ├─ summarize-sonnet.ts         # 판례 요약
  │   │   └─ match-judges.ts             # judges 테이블 lookup
  │   ├─ workers/
  │   │   ├─ news-crawler.ts
  │   │   ├─ cases-crawler.ts
  │   │   └─ appointments-crawler.ts
  │   └─ lib/
  │       ├─ supabase.ts
  │       ├─ s3.ts
  │       ├─ rate-limiter.ts             # token bucket per domain
  │       └─ retry.ts                    # 지수 backoff + jitter
  ├─ package.json
  └─ tsconfig.json
.github/
  └─ workflows/
      ├─ news-crawler.yml
      ├─ cases-crawler.yml
      └─ appointments-crawler.yml
```

---

## 5. 에러·재시도·DLQ

### 재시도 정책
- 모든 외부 호출: **3회 재시도, 지수 backoff (1s → 4s → 16s) + ±25% jitter**.
- HTTP 429 (rate limit): backoff 6배 증가 + 다음 cron 까지 휴식 (해당 도메인 한정).
- HTTP 5xx: 재시도.
- HTTP 4xx (429 제외): 즉시 실패, DLQ 로 이동.

### Dead Letter Queue
- 위치: Supabase 테이블 `crawler_dlq` (Phase 3 추가 스키마).
  ```sql
  CREATE TABLE crawler_dlq (
    id text PRIMARY KEY,
    job_name text NOT NULL,           -- 'news-crawler' / 'cases-crawler' / ...
    source text NOT NULL,             -- 'naver' / 'kakao' / 'law-go-kr' / ...
    payload jsonb NOT NULL,           -- 원본 요청 (재실행 가능하게)
    error_class text NOT NULL,        -- 'http_4xx' / 'parse_error' / 'matching_unsure'
    error_detail text,
    attempt_count integer NOT NULL DEFAULT 1,
    first_failed_at timestamptz NOT NULL DEFAULT now(),
    last_failed_at timestamptz NOT NULL DEFAULT now(),
    resolved boolean NOT NULL DEFAULT false
  );
  CREATE INDEX idx_dlq_unresolved ON crawler_dlq (job_name, resolved);
  ```
- `resolved=false` 항목 일일 1회 재시도 워크플로 (`dlq-replay`, cron `0 22 * * *`).
- 30일 이상 미해결 → 알림 (운영자 Slack/email).

### 매칭 보류 (manual review queue)
판사 매칭이 불확실한 경우 (relevance_score < 0.6 또는 동명이인 충돌) `crawler_dlq` 의 별도 `error_class='matching_unsure'` 로 격리. `judge_articles` 에 insert 하지 않음. 자세한 룰은 [matching-logic.md](./matching-logic.md) 참조.

---

## 6. 모니터링·알림

### 핵심 메트릭

| 메트릭 | 측정 방법 | 알림 임계값 |
|-------|---------|-----------|
| **수집 성공률** | (성공 호출 / 총 호출) per source | < 95% (1시간 윈도우) |
| **중복률** | dedupe 단계에서 dropped / total | > 70% (튜닝 필요) |
| **AI 요약 실패율** | retry 후에도 실패 | > 5% |
| **rate limit hit** | 429 카운트 per domain | 일일 > 10 |
| **매칭 정확도** | manual review queue 진입률 | > 10% (NER 룰 점검) |
| **DLQ 적체** | unresolved count | > 100 (즉시 점검) |

### 출력 채널
- GitHub Actions: workflow 실패 시 자동 issue 생성 (`peter-evans/create-issue-from-file`).
- Supabase: `crawler_runs` 테이블 (start/end/counts) → `/api/admin/health` 엔드포인트로 노출 (Phase 3 후반).
- 옵션: Slack incoming webhook (운영자 1인이면 메일로도 충분).

```sql
CREATE TABLE crawler_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running', -- running/success/failure/partial
  fetched_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  metadata jsonb
);
CREATE INDEX idx_crawler_runs_job_started ON crawler_runs (job_name, started_at DESC);
```

---

## 7. 비용 추정 (월간)

### 인프라

| 항목 | Phase 3 (월) | Phase 5 (월) |
|-----|-------------|-------------|
| GitHub Actions (private repo) | $0 (free 2,000분) | $0~$10 (10k 분 사용 시) |
| Supabase Free (DB + Storage) | $0 (500MB DB + 1GB Storage 한도 내) | $25 (Pro) |
| S3 (raw 백업) | $0~$1 (5GB 미만) | $5 |
| Vercel Hobby | $0 | $20 (Pro) |
| 도메인 (.org) | $1.7 (연 $20 / 12) | $1.7 |
| **인프라 소계** | **$2/월 (~3,000 KRW)** | **$60/월 (~85,000 KRW)** |

### Claude API (모델 가격 출처: [Anthropic 공식](https://platform.claude.com/docs/en/about-claude/pricing), 2026-04 확인)

가격 (per MTok):
- **Haiku 4.5**: input $1, cache write 5m $1.25, cache read $0.10, output $5.
- **Sonnet 4.6**: input $3, cache write 5m $3.75, cache read $0.30, output $15.

#### 기사 요약 (Haiku 4.5)

가정:
- 일일 100건 신규 기사 (월 ~3,000건). 브리프 §11 의 추정과 일치.
- 평균 입력 3,000 토큰 (시스템 프롬프트 + 발췌). **시스템 프롬프트 캐싱 적용 → 80% 토큰은 cache read.**
- 출력 평균 500 토큰 (2~3문장 한국어).

월간 토큰:
- 입력 = 3,000 × 3,000 = 9.0 MTok
  - 시스템 프롬프트 부분 (캐시 read): 7.2 MTok × $0.10 = **$0.72**
  - 변동 부분 (입력 신규): 1.8 MTok × $1 = **$1.80**
  - 캐시 write: 시스템 프롬프트 ~600 토큰 × 일 1회 갱신 × 30일 = 0.018 MTok × $1.25 = **$0.02**
- 출력 = 3,000 × 500 = 1.5 MTok × $5 = **$7.50**

**기사 요약 월 비용 ≈ $10.04** (~14,000 KRW)

> Batch API 50% 할인 적용 시 약 $5/월. 다만 Batch 는 비실시간 → 6시간 cron 주기에는 over-engineering. 일단 표준 호출 사용.

#### 판례 요약 (Sonnet 4.6)

가정:
- 월 1회 batch + 분기별 backfill. 평균 월 ~30건 (브리프와 일치).
- 평균 입력 8,000 토큰 (판결문 일부 + 시스템 프롬프트). 캐시는 시스템 프롬프트만.
- 출력 평균 1,500 토큰 (3~5문장).

월간 토큰:
- 입력 = 30 × 8,000 = 0.24 MTok
  - 시스템 프롬프트 부분 (~1,200 토큰, 캐시 read): 0.036 MTok × $0.30 = **$0.011**
  - 변동 부분: 0.204 MTok × $3 = **$0.61**
  - 캐시 write: 0.0012 MTok × $3.75 = **$0.0045**
- 출력 = 30 × 1,500 = 0.045 MTok × $15 = **$0.68**

**판례 요약 월 비용 ≈ $1.30** (~1,800 KRW)

#### NER (Claude 직접 추출 — Haiku)

- 기사·판례 모두 NER 단계에서 한 번 더 호출 (인명·법원·직위 추출).
- 가정: 기사 1건당 ~1,500 토큰 입력, ~200 토큰 출력. 판례는 ~3,000 / ~300.
- 기사 NER: 3,000건 × (1,500 × $1 + 200 × $5) / 1M = **$7.50**
- 판례 NER: 30건 × (3,000 × $3 + 300 × $15) / 1M = **$0.41**

#### 합산

| 항목 | Phase 3 월 비용 |
|------|---------------|
| Claude Haiku — 기사 요약 | $10 |
| Claude Sonnet — 판례 요약 | $1 |
| Claude Haiku — NER (기사) | $8 |
| Claude Sonnet — NER (판례) | $0.4 |
| **Claude API 소계** | **~$20/월 (~28,000 KRW)** |

### 총합

| | Phase 3 (월) | Phase 5 (월) |
|---|---|---|
| 인프라 | $2 | $60 |
| Claude API | $20 | $80 (트래픽 4배) |
| **합계 (USD)** | **$22** | **$140** |
| **합계 (KRW, 1,400원/USD)** | **30,800 KRW** | **196,000 KRW** |

> 브리프 §11 추정 (월 3~5만 원) 과 일치.

---

## 8. 시크릿 / 환경 변수

### 위치 정책
- **로컬 개발**: `.env.local` (gitignore). 샘플 `.env.example` 커밋.
- **GitHub Actions**: `Settings → Secrets and variables → Actions`.
- **Phase 5 Lambda 마이그레이션 시**: AWS Secrets Manager (`pansawatch/prod/*`).

### 필요 시크릿

| 키 | 용도 | 출처 |
|----|-----|------|
| `ANTHROPIC_API_KEY` | Claude API | console.anthropic.com |
| `NAVER_CLIENT_ID` | Naver Search | NAVER Developers |
| `NAVER_CLIENT_SECRET` | Naver Search | NAVER Developers |
| `KAKAO_REST_API_KEY` | Kakao Daum Search | Kakao Developers |
| `LAW_GO_KR_OC` | 판례 OPEN API | open.law.go.kr 신청 |
| `SUPABASE_URL` | DB 연결 | Supabase 프로젝트 |
| `SUPABASE_SERVICE_ROLE_KEY` | DB 쓰기 (server) | Supabase (RLS bypass) |
| `S3_BUCKET` (선택) | raw 백업 | AWS |
| `S3_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` (선택) | S3 권한 | AWS IAM |
| `CRAWLER_USER_AGENT` | 크롤러 식별 | `PansaWatch/0.1 (+https://pansawatch.org/about)` |
| `SLACK_WEBHOOK_URL` (선택) | 실패 알림 | Slack |

### 안전 가이드라인
- `SUPABASE_SERVICE_ROLE_KEY` 는 서버 전용. Next.js 클라이언트 코드 import 금지.
- 키 회전: 분기별 1회. README 에 회전 일자 기록.
- `.env.local` 은 `.gitignore` (이미 적용).

---

## 9. 운영 체크리스트 (Phase 3 첫 가동)

- [ ] Supabase 프로젝트 + 스키마 적용 완료
- [ ] `crawler_dlq`, `crawler_runs` 테이블 추가
- [ ] Naver / Kakao / 국가법령정보 API 키 발급
- [ ] `.env.example` 작성 + GitHub Secrets 등록
- [ ] `crawlers/` 패키지 + 3개 워크플로 작성
- [ ] mock 데이터 1세트로 dry-run (DB write 차단 모드)
- [ ] 첫 실 데이터 수집 후 `/about` 페이지에 수집 키워드·소스·주기 공개 (브리프 §6-5)
- [ ] DLQ 모니터링 페이지 또는 일일 메일 리포트 가동

---

## 출처

- [Anthropic 가격](https://platform.claude.com/docs/en/about-claude/pricing)
- [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage)
- [Vercel Cron Hobby 제한](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [AWS Lambda EventBridge 가이드](https://docs.aws.amazon.com/lambda/latest/dg/with-eventbridge-scheduler.html)
