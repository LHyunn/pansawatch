# PansaWatch — 뉴스 크롤러 명세

> Phase 3 의 `news-crawler` 워커. 6시간 주기로 사법부 뉴스를 수집·정제·요약·매칭 후보를 생성.
> 실제 매칭은 [matching-logic.md](../matching-logic.md) 의 별도 단계.

---

## 1. 키워드 집합

### 1-A. 기본 키워드 (모든 출처에 공통)

```typescript
export const BASE_KEYWORDS = [
  // 법원·재판부
  "판결", "선고", "기각", "인용", "각하",
  "1심", "항소심", "상고심", "파기환송", "원심유지",
  // 재판부 직위 (특정 인물 검색을 위함)
  "부장판사", "대법관", "헌법재판관", "법원장",
  // 사건 유형
  "민사", "형사", "행정", "가사",
  // 법원 명칭 일부 (지역·종류)
  "지방법원", "고등법원", "대법원", "헌법재판소",
];
```

### 1-B. 법원 키워드 (`courts.json` 에서 자동 생성)

```typescript
import courts from "@/data/courts.json";
export const COURT_KEYWORDS = courts.map(c => c.name);
// 예: ["대법원", "서울고등법원", "서울중앙지방법원", ..., "제주지방법원"]
```

### 1-C. 판사 키워드 (`judges.json` 에서 자동 생성)

```typescript
import judges from "@/data/judges.json";
export const JUDGE_KEYWORDS = judges.map(j => `${j.name} 판사`);
// 예: ["김명석 판사", "이정아 판사", ...]
```

> **운영 중 갱신**: `appointments-crawler` 가 `judges` 테이블 업데이트 → `JUDGE_KEYWORDS` 도 자동 반영.

### 1-D. 쿼리 조합 룰

cron 1회 실행당 너무 많은 쿼리를 던지지 않도록 라운드로빈:

| 쿼리 종류 | 빈도 | 1회당 쿼리 수 |
|----------|------|--------------|
| 법원명 (n=21) | 매 cron | 5개 (라운드로빈) |
| 판사명 + " 판사" (n=50~3,300) | 매 cron | 20개 (라운드로빈, 각 판사 평균 1주에 1회) |
| 일반 키워드 ("판결", "선고") | 매 cron | 5개 |

총 **30 쿼리/cron × 4 cron/일 = 120 쿼리/일** → 네이버 25k/일 한도 안에서 충분.

### 1-E. 제외 키워드 (오탐 줄이기)
응답 처리 단계에서 다음을 포함한 결과는 자동 폐기:
```typescript
const EXCLUDE_PATTERNS = [
  /광고|협찬|이벤트|할인|쿠폰/,
  /부동산.{0,10}매물|중고차/,
  /^\[부음\]|\[광고\]|\[협찬\]/,
];
```

---

## 2. 다중 소스 우선순위

```
[1차] Naver Search API (news.json)        ──┐
[2차] Kakao Daum Search (web.json)         ──┼── 결과 합집합 → dedupe
[3차] Google News RSS (search?q=...)       ──┤
[4차] 법률신문 sitemap polling             ──┘
```

각 cron 실행:
1. 1차 호출. 성공 시 결과 사용 + 2~4차는 보강용으로 호출.
2. 1차 실패 시 2차 → 3차 → 4차 순.
3. 결과 합치고 dedupe (다음 §4).

---

## 3. HTML / RSS / JSON 분기 처리

### Naver / Kakao = JSON
파서: 표준 `JSON.parse`. HTML 엔티티 디코드 필요 (`&lt;b&gt;` 등).

### Google News RSS = XML
파서: `fast-xml-parser` 또는 `xml2js`. 구조: `rss.channel.item[]` (title, link, pubDate, source).
**중요**: `link` 가 Google 리다이렉트 URL (`https://news.google.com/articles/...`). 실제 publisher URL 추출 필요:
- 1차 시도: HTML `<a href="...">` 패턴 매칭 (RSS description 안에 publisher URL 이 들어있는 경우).
- 2차 시도: 리다이렉트를 따라가서 최종 URL (HEAD request, 302 follow).
- 실패 시 Google URL 그대로 저장 (불완전한 deeplink 이지만 사용자 클릭 가능).

### 법률신문 = sitemap.xml
파서: 동일 XML 파서. 구조: `urlset.url[]` (loc, lastmod). 각 `loc` 페이지를 fetch 하여 OG 메타데이터(`og:title`, `og:description`, `article:published_time`) 추출.
- HTML fetch 시 본문은 받되 **추출 후 발췌(첫 500자)만 보관**, 본문 전체 폐기.
- bingbot crawl-delay 30초 정책 준수 → **자체 30초 간격** 적용.

---

## 4. URL 정규화

원본 URL 에 분석 트래킹 파라미터, 모바일/PC 구분, 세션 ID 등이 붙어 같은 기사가 여러 URL 로 나타남. 정규화 룰:

```typescript
function canonicalUrl(input: string): string {
  const u = new URL(input);

  // 1. 호스트 정규화
  u.hostname = u.hostname.toLowerCase();
  if (u.hostname.startsWith("www.")) u.hostname = u.hostname.slice(4);
  if (u.hostname.startsWith("m.")) u.hostname = u.hostname.slice(2);  // 모바일 prefix 제거

  // 2. 프로토콜 강제 https
  u.protocol = "https:";

  // 3. 트래킹 파라미터 제거
  const TRACK = /^(utm_|fbclid|gclid|mc_eid|mc_cid|ref|ref_url|from|sess|trk)/i;
  for (const k of [...u.searchParams.keys()]) {
    if (TRACK.test(k)) u.searchParams.delete(k);
  }

  // 4. trailing slash 통일
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";

  // 5. 정렬 (검색 파라미터 순서 무관)
  u.searchParams.sort();

  // 6. fragment 제거
  u.hash = "";

  return u.toString();
}
```

---

## 5. 중복 제거

### 5-A. 단계
1. **URL hash 정확 일치**: `sha256(canonicalUrl)` 가 기존 articles 에 이미 존재하면 drop. (스키마 §8 참조)
2. **Title SimHash + Hamming distance**: SimHash 64bit 생성. Hamming distance ≤ 3 이면 near-duplicate 후보.
3. **Title Levenshtein 보조**: SimHash 후보에 대해 정규화된 제목 (한글 자모 분리, 공백 제거) Levenshtein distance ≤ 5 이면 dedupe.

### 5-B. 라이브러리
- SimHash: `simhash-js` 또는 자체 구현 (한글은 음절 단위 토큰화).
- Levenshtein: `fastest-levenshtein`.

### 5-C. 한글 토큰화 (SimHash 전처리)
```typescript
function tokenize(title: string): string[] {
  // "[속보]" 같은 prefix 제거, 따옴표 제거
  const cleaned = title.replace(/^\[[^\]]+\]\s*/, "").replace(/["“”\s]+/g, " ").trim();
  // 한글 음절 + 단어 경계 단위
  return cleaned.split(/\s+/).filter(t => t.length >= 2);
}
```

### 5-D. dedupe 로깅
중복으로 판정된 article 은 staged 단계에서 drop, `crawler_runs.duplicate_count` 증가. 본문 비교는 안 함 (본문 미저장 원칙).

---

## 6. Rate Limit

### 도메인별 token bucket (`crawlers/src/lib/rate-limiter.ts`)

| 도메인 | RPS | 동시성 | 일일 한도 |
|-------|-----|-------|----------|
| `openapi.naver.com` | 10 | 5 | 25,000 |
| `dapi.kakao.com` | 5 | 3 | 30,000 |
| `news.google.com` | 0.5 (2초마다 1회) | 1 | 5,000 |
| `lawtimes.co.kr` | 0.033 (30초마다 1회) | 1 | 1,000 |
| 기타 (HEAD 리다이렉트 추적) | 1 | 2 | — |

> 위 수치는 Phase 3 시작값. 첫 가동 후 1주일 간 429 카운트 모니터링하여 조정.

### 글로벌 백오프
- HTTP 429 수신 시 해당 도메인 60초 cool-down + 다음 cron 까지 휴식.
- 5xx 수신 시 30초 cool-down.

---

## 7. 실패 처리

### 재시도
[pipeline-architecture.md §5](../pipeline-architecture.md#5-에러재시도dlq) 와 동일:
- 3회 재시도, 지수 backoff `1s → 4s → 16s + ±25% jitter`.
- 4xx (429 제외) 즉시 DLQ.

### DLQ 항목 예시
```json
{
  "job_name": "news-crawler",
  "source": "naver",
  "error_class": "http_4xx",
  "payload": { "query": "이정아 판사", "display": 50 },
  "error_detail": "401 Unauthorized — invalid X-Naver-Client-Secret",
  "attempt_count": 3
}
```

### 부분 실패 정책
- 한 source 실패 → 다른 source 결과로 진행 (overall job status `partial`).
- 모든 source 실패 → `failure`. 다음 cron 까지 대기 + 알림.

---

## 8. 출력

### 8-A. articles 테이블 insert
```sql
INSERT INTO articles (id, title, url, source, published_at, ai_summary, collected_at)
VALUES (
  $1,                       -- sha256(canonicalUrl)[0:16]
  $2,                       -- 제목 (HTML 디코드된)
  $3,                       -- canonicalUrl
  $4,                       -- 'naver:동아일보' / 'kakao:한겨레' 등 — 출처 매체 + 발견 채널
  $5::timestamptz,
  $6,                       -- ai_summary (Haiku 4.5 후처리 결과)
  now()
)
ON CONFLICT (id) DO NOTHING;
```

### 8-B. judge_articles 매칭 후보
NER + 매칭 통과 (relevance_score ≥ 0.7) 한 케이스만 insert. 보류는 `crawler_dlq` 의 `matching_unsure`. 자세한 룰은 [matching-logic.md](../matching-logic.md) 참조.

```sql
INSERT INTO judge_articles (id, judge_id, article_id, relevance_score)
VALUES (
  $1,                       -- sha256(judge_id + ':' + article_id)[0:16]
  $2, $3, $4
)
ON CONFLICT (judge_id, article_id) DO UPDATE
  SET relevance_score = GREATEST(judge_articles.relevance_score, EXCLUDED.relevance_score);
```

### 8-C. 출처 정보 보존
`articles.source` 형식: `<channel>:<publisher>`
- `channel` ∈ {`naver`, `kakao`, `google`, `lawtimes`}
- `publisher` = 매체명 (예: 한겨레, 조선일보). Naver 응답의 `link` URL 호스트로 자동 추론.

---

## 9. 모니터링 메트릭

`crawler_runs.metadata` JSON 에 적재:
```json
{
  "queries_executed": 30,
  "raw_results": 850,
  "after_dedupe": 124,
  "after_excluded": 118,
  "ner_processed": 118,
  "auto_matched": 95,
  "manual_review_queued": 8,
  "ai_tokens_input": 354000,
  "ai_tokens_output": 59000,
  "ai_tokens_cache_read": 280000,
  "ai_cost_usd": 0.34,
  "rate_429_hits": 0,
  "rate_5xx_hits": 1
}
```

---

## 10. Phase 3 구현 순서

1. `crawlers/src/adapters/naver-news.ts`
2. `crawlers/src/adapters/kakao-daum.ts`
3. `crawlers/src/adapters/google-news-rss.ts`
4. `crawlers/src/adapters/lawtimes-sitemap.ts`
5. `crawlers/src/pipeline/normalize.ts` (URL canonical + HTML decode)
6. `crawlers/src/pipeline/dedupe.ts` (URL hash + SimHash)
7. `crawlers/src/lib/rate-limiter.ts`
8. `crawlers/src/workers/news-crawler.ts` (오케스트레이션)
9. `.github/workflows/news-crawler.yml` (cron `15 0,6,12,18 * * *`)
10. dry-run + first prod run + 메트릭 모니터

---

## 출처

- [Naver Search API](https://developers.naver.com/products/service-api/search/search.md)
- [Kakao Daum Search](https://developers.kakao.com/docs/latest/en/daum-search/dev-guide)
- [Google News RSS 검색 (한국)](https://news.google.com/rss/search?q=%EB%B2%95%EC%9B%90&hl=ko&gl=KR&ceid=KR:ko)
- [법률신문 sitemap.xml](https://www.lawtimes.co.kr/sitemap.xml)
- [SimHash 알고리즘 (Manku 외)](https://research.google.com/pubs/archive/33026.pdf)
