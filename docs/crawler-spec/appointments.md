# PansaWatch — 인사발령 크롤러 명세

> Phase 3 의 `appointments-crawler` 워커. 주 1회. 신규·전보·퇴임을 감지하여 `judges` 테이블 동기화.
> 메인 출처: 대법원 보도자료 게시판 ([data-sources.md §6](../data-sources.md#6-대법원-보도자료-게시판--인사발령)).
> 보조 출처: 법률신문 인사 카테고리 (참고용 — 사실 검증).

---

## 1. 출처 + URL 패턴

### 1-A. 대법원 보도자료
**리스트**: `https://www.scourt.go.kr/portal/news/NewsListAction.work?gubun=6`
**상세**: `https://www.scourt.go.kr/portal/news/NewsViewAction.work?seqnum=<NUM>&gubun=6`

`seqnum` 은 단조증가 (현재 ~2960 대). 페이지네이션은 `pageIndex=1,2,...`.

### 1-B. 인사발령 식별 키워드
보도자료 카테고리는 단일하므로 제목 필터 사용:
```typescript
const APPOINTMENT_KEYWORDS = [
  "인사발령", "법관 인사", "신임", "임명", "임명식",
  "정기인사", "전보", "퇴직", "퇴임",
  "법원장", "고등법원", "전담법관"
];
```
제목에 위 키워드 1개 이상 포함된 게시물만 처리 대상.

### 1-C. 보조 출처 (참고)
- [법률신문 인사 검색](https://www.lawtimes.co.kr/news?searchSection=2&category=인사) — 사실 교차검증용.
- [리걸타임즈 인사](https://www.legaltimes.co.kr/) — 동일 목적.

---

## 2. 셀렉터 / 파싱

### 2-A. 리스트 페이지 (HTML)

```typescript
// pseudocode (cheerio)
const $ = cheerio.load(html);
$("table.tblA tbody tr").each((_, tr) => {
  const $tr = $(tr);
  const titleEl = $tr.find("td:nth-child(2) a");
  const title = titleEl.text().trim();
  const href = titleEl.attr("href");
  const seqnum = new URL(href, baseUrl).searchParams.get("seqnum");
  const dateStr = $tr.find("td:nth-child(3)").text().trim();  // "2026-04-16"
  // ...
});
```

> **주의**: 대법원 사이트의 셀렉터는 시간이 지나면서 변할 수 있다. Phase 3 첫 가동 시 selector 를 코드 상수로 분리하고, 실패 시 즉시 알림.

### 2-B. 상세 페이지

상세 페이지 HTML 본문 또는 첨부 PDF 에 발령 명단이 들어있음.
- HTML 본문: `<div class="article">` (예시 — 실제 selector 는 첫 가동시 확인) 텍스트 추출.
- 첨부 PDF: **자동 다운로드 회피** (robots.txt `/news/` Disallow 정책 + 트래픽 부담). 대신 PDF 링크는 메타데이터로 저장하여 운영자 수동 처리.

---

## 3. 신규·전보·퇴임 감지 (diff)

### 3-A. snapshot 기반
`appointments-crawler` 가 추출한 인사 데이터를 별도 스테이징 테이블 `appointment_drafts` 에 저장:

```sql
CREATE TABLE appointment_drafts (
  id text PRIMARY KEY,                    -- sha256(seqnum + name + court)[0:16]
  source_seqnum integer NOT NULL,
  announced_at date NOT NULL,             -- 보도자료 작성일
  effective_at date NULL,                 -- 발령 시행일 (본문에서 추출)
  name text NOT NULL,
  position text NOT NULL,
  court_name text NOT NULL,               -- 정규화 전 raw
  court_id text NULL,                     -- 정규화 후 (court_aliases 적용)
  appointment_kind text NOT NULL,         -- 'new' | 'transfer' | 'retire' | 'unknown'
  raw_text text NOT NULL,                 -- 본문 발췌
  applied boolean NOT NULL DEFAULT false, -- judges 에 반영됐나
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_appt_drafts_unapplied ON appointment_drafts (announced_at DESC) WHERE applied = false;
```

### 3-B. diff 룰

| 상황 | judges 테이블 동작 | appointment_kind |
|------|-------------------|------------------|
| 새 인물 + 새 court → DB 에 없는 이름·법원 조합 | INSERT (Phase 3 단계에서는 보류 → 운영자 review) | `new` |
| 기존 인물 + 다른 court → 같은 이름이 다른 법원 row 와 일치 | UPDATE court_id, court, court_region (양손 검증) | `transfer` |
| 기존 인물 + "퇴직"/"퇴임" 키워드 | DELETE 대신 `judges.notes` 기록 (cases FK RESTRICT 때문에 row 유지) | `retire` |
| 본문 파싱 실패 | unknown — DLQ | `unknown` |

> **자동 INSERT/UPDATE 보류**: Phase 3 첫 가동에서는 모든 변경을 `appointment_drafts` 에 staging → 운영자 `/admin/appointments` 페이지에서 적용. Phase 5 에서 자동 적용 검토.

### 3-C. 동명이인 처리

[matching-logic.md §4](../matching-logic.md#4-매칭-실패-큐-manual-review-queue) 와 동일한 룰.
- 같은 이름이 DB 에 여러 row 있고 인사발령 본문에 법원·직위 동시 명시 → 정확 매칭.
- 본문이 모호 → `unknown` 으로 staging.

#### 임관년 활용
인사발령 본문에 `사법연수원 N기` 형식이 자주 등장 — 임관년 추정 가능 (`기수 + 1990 = 임관년` 근사). LLM 추출 시 `appointment_year_hint` 키 추가하여 기존 `judges.appointment_year` 와 비교.

---

## 4. LLM 보조 추출

대법원 보도자료 본문은 자유 형식 텍스트가 많아 정규식만으로 어려움. Sonnet 4.6 (또는 Haiku 4.5 — 비용 우선) 으로 구조화:

### 시스템 프롬프트 (요약)
```
다음 대법원 보도자료에서 법관 인사 발령 정보를 추출하라.

출력 schema:
{
  "effective_at": "YYYY-MM-DD" | null,
  "appointments": [
    {
      "name": "홍길동",
      "position": "부장판사" | "판사" | "대법관" | "법원장" | ...,
      "from_court": "서울중앙지방법원" | null,    // 전보의 경우
      "to_court": "대법원" | null,                // 신규·전보의 경우
      "kind": "new" | "transfer" | "retire" | "unknown",
      "career_hint": "사법연수원 N기" | null
    }
  ]
}

원칙: 본문에 명시된 정보만 추출, 추정 금지.
```

[ai-pipeline.md](../ai-pipeline.md) 의 NER 시스템 프롬프트와 별도 — 인사발령 전용.

---

## 5. 수집 빈도

- cron `0 21 * * 1` (UTC 월요일 21시 → KST 화요일 06시).
- 일일 보도자료 발생량 ~3건 → 주 1회 cron 으로 충분.
- 누락 방지: 매 cron 마지막 처리 `seqnum` 을 메타에 저장 → 다음 실행시 그 이후 seqnum 만 fetch.

```sql
CREATE TABLE crawler_state (
  job_name text PRIMARY KEY,
  last_processed_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 6. Rate Limit / robots.txt 준수

### 6-A. robots.txt 정책
[data-sources.md §6](../data-sources.md#6-대법원-보도자료-게시판--인사발령) 에 인용된 대로 `/news/` Disallow 가 모호하지만 보수적으로 적용:
- **분당 6 호출 (10초 간격)**
- **일일 100 호출 이하**
- User-Agent 명시: `PansaWatch/0.1 (+https://pansawatch.org/about)`

### 6-B. 첨부 PDF 정책
- 자동 다운로드 안 함.
- 첨부 URL 만 staging 에 보존.

---

## 7. 출력

### 7-A. appointment_drafts insert
모든 추출 결과 staging 에 저장. `applied=false` 가 운영자 review 대상.

### 7-B. judges 테이블 적용 (운영자 승인 후)

```sql
-- 신규 (new)
INSERT INTO judges (id, name, court_id, court, court_region, position, appointment_year, career_summary)
VALUES (...);

-- 전보 (transfer)
UPDATE judges
SET court_id = $new_court_id,
    court = $new_court_name,
    court_region = $new_court_region,
    position = COALESCE($new_position, position),
    updated_at = now()
WHERE id = $judge_id;

-- 퇴임 (retire) — row 유지, notes 기록
UPDATE judges
SET career_summary = career_summary || E'\n\n' || '※ ' || $effective_at::text || ' 퇴임',
    updated_at = now()
WHERE id = $judge_id;
```

### 7-C. courts.judge_count 동기화
판사 INSERT/UPDATE/퇴임 시 `courts.judge_count` 갱신:
```sql
UPDATE courts
SET judge_count = (SELECT COUNT(*) FROM judges WHERE court_id = courts.id)
WHERE id IN ($affected_court_ids);
```
(스키마 §2 의 `judge_count` 비정규화 컬럼 동기화 정책 — `db/schema.sql` 의 COMMENT 와 정합.)

---

## 8. 모니터링 메트릭

```json
{
  "list_pages_fetched": 1,
  "new_seqnums": 3,
  "appointment_pages_processed": 2,
  "drafts_inserted": 12,
  "ner_failures": 0,
  "ai_tokens_input": 25000,
  "ai_tokens_output": 4500,
  "ai_cost_usd": 0.05
}
```

---

## 9. 동기화 빈도와 트리거

```
appointments-crawler (주 1회)
  └─ appointment_drafts 에 insert
       └─ /admin/appointments 페이지 (운영자 일일 점검)
            └─ approve → judges INSERT/UPDATE
                  └─ trigger: judges-court-sync (일 1회)
                       └─ courts.judge_count 갱신
```

`judges-court-sync` 별도 워커 (cron `0 23 * * *`) — `courts.judge_count` 일일 재계산. 트리거 누락 대비 안전망.

---

## 10. Phase 3 구현 순서

1. `crawlers/src/adapters/scourt-press.ts` (리스트 + 상세 fetch)
2. `crawlers/src/pipeline/extract-appointments.ts` (정규식 + LLM)
3. DB schema 추가: `appointment_drafts`, `crawler_state`
4. `crawlers/src/workers/appointments-crawler.ts`
5. `.github/workflows/appointments-crawler.yml` (cron `0 21 * * 1`)
6. `/admin/appointments` 페이지 (운영자 review UI — Next.js)
7. mock-mode dry-run 후 첫 실 가동

---

## 출처

- [대법원 보도자료 리스트](https://www.scourt.go.kr/portal/news/NewsListAction.work?gubun=6)
- [대법원 robots.txt](https://www.scourt.go.kr/robots.txt)
- [법률신문 인사 카테고리 예시](https://www.lawtimes.co.kr/news/articleView.html?idxno=215510)
- [matching-logic.md](../matching-logic.md) — 동명이인 처리
- [ai-pipeline.md](../ai-pipeline.md) — LLM 시스템 프롬프트 정책
