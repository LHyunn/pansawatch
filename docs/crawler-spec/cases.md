# PansaWatch — 판례 크롤러 명세

> Phase 3 의 `cases-crawler` 워커. 월 1회 batch + 분기별 backfill.
> 메인 채널: **국가법령정보 OPEN API** ([data-sources.md §1](../data-sources.md#1-국가법령정보-open-api--phase-3-판례-메인-채널)).
> 폴백: 대법원 종합법률정보 (글로) — Phase 3 즉시 미사용.

---

## 1. 수집 전략

### 1-A. 채널 선택

**1차: 국가법령정보 OPEN API (`law.go.kr/DRF`)**
- API 인증키 (`OC`) 발급받아 사용.
- 요청은 응답 친화적 → 캡차·세션 무관.
- robots.txt 회피 — API 약관 준수만 하면 됨.

**2차 (폴백): glaw.scourt.go.kr 직접 크롤**
- API 에 누락된 판례 발견 시에만.
- 페이징·세션·캡차 가능성 있음 (직접 fetch 시 ECONNREFUSED 사례 확인 — IP rate limit 추정).
- robots.txt 가 다수 디렉토리 disallow → 검색 결과 페이지 직접 접근은 회색지대.
- **Phase 3 즉시 사용 안 함.** 필요 시 Phase 4 에서 결정.

### 1-B. 수집 기준
- 최근 6개월 선고 판례 위주 (월 batch).
- `prncYd` 파라미터로 기간 명시: `prncYd=20260301~20260331` (예).
- `curt` 파라미터로 법원 한정 가능 — courts.json 기준 21개 법원 라운드로빈.

### 1-C. 분기별 backfill
3개월에 1회 → 누락된 판례 보강 (지연 공개 등). cron `0 19 1-7 1,4,7,10 1`.

---

## 2. 페이징·세션·캡차

### OPEN API (1차)
- 페이징: `display=100`, `page=1..N` 반복. `display * page` 범위 안의 결과만 응답 (제한 없음 — 결과 수만큼 페이지 진행).
- 세션: 무관 (REST). 매 요청 stateless.
- 캡차: 없음.
- rate limit: 명시 미공개. 보수적으로 **분당 60 호출 / 일일 5,000 호출 / 동시성 5**.

### 글로 (폴백)
- 페이징: 검색 결과 페이지 `page` 파라미터.
- 세션: JSESSIONID 쿠키 가능 — 세션 재사용 권장.
- 캡차: 비정상 트래픽 감지 시 발생 가능. 발생 시 즉시 휴식 + 운영자 알림.
- 동시성: 1 (보수적).

---

## 3. 사건번호 정규화

### 3-A. 표준 형식
한국 판결문 사건번호는 [나무위키 - 사건번호](https://namu.wiki/w/%EC%82%AC%EA%B1%B4%EB%B2%88%ED%98%B8) 정의대로 `<연도><부호문자><일련번호>`.

| 사건 종류 | 1심 | 2심(항소) | 3심(상고) |
|----------|-----|----------|----------|
| 민사 단독 | 가단 | 나 | 다 |
| 민사 합의 | 가합 | 나 | 다 |
| 형사 | 고단/고합 | 노 | 도 |
| 행정 | 구단/구합 | 누 | 두 |
| 가사 | 드단/드합 | 르 | 므 |

### 3-B. 정규식
```typescript
const CASE_NUMBER_RE =
  /^(?<year>\d{4})(?<code>[가-힣]+)(?<num>\d+(?:-\d+)?)$/;
//                  ↑                      ↑
//          가합/나/도/노/구합/드합/...    일련번호 (병합사건은 `-` 추가)

function normalizeCaseNumber(raw: string): string | null {
  const cleaned = raw.replace(/[\s ]/g, "");  // 공백·하이픈은 keep
  const m = CASE_NUMBER_RE.exec(cleaned);
  if (!m) return null;
  return `${m.groups!.year}${m.groups!.code}${m.groups!.num}`;
}

// 예
normalizeCaseNumber("2024 가합 12345");   // "2024가합12345"
normalizeCaseNumber("2025노1234");         // "2025노1234"
normalizeCaseNumber("2024구합45-3");      // "2024구합45-3"
normalizeCaseNumber("invalid");           // null
```

### 3-C. 충돌 처리
같은 사건번호가 다른 법원에서 사용될 수 있음. PK 는 `sha256(caseNumber + ":" + court)[0:16]` 으로 생성하여 충돌 방지.

---

## 4. 판결문 헤더에서 판사 추출

### 4-A. 정형 패턴
판결문 마지막에 재판부 정보가 정형:
```
재판장 판사 김명석
판사 이정아
판사 박현우
```
또는 (단독 사건):
```
판사 김명석
```

### 4-B. 정규식 1차 추출
```typescript
const JUDGE_HEADER_RE =
  /(?<role>재판장\s+판사|부장판사|판사|대법관|헌법재판관|법원장)\s+(?<name>[가-힣]{2,4})/g;

function extractJudgesFromHeader(body: string) {
  const judges = [];
  let m;
  while ((m = JUDGE_HEADER_RE.exec(body)) !== null) {
    judges.push({
      role: m.groups!.role,
      name: m.groups!.name,
      isPresiding: m.groups!.role.includes("재판장") || m.groups!.role === "부장판사",
    });
  }
  return judges;
}
```

### 4-C. LLM 보조 추출 (Sonnet 4.6)
정규식이 1명 이상 추출 + LLM JSON 결과와 합집합. 차이가 있으면 정규식 우선 (판결문 형식 의존).

### 4-D. Primary judge 결정
[matching-logic.md §3](../matching-logic.md#3-판례의-경우-추가-룰) 와 동일:
1. `재판장 판사` 또는 `부장판사` → primary
2. 없으면 첫 번째 등장 인물

`cases.judge_id` 1개만 저장. 나머지는 raw 단계 metadata 에 보존 (Phase 4 에서 m:n 테이블로).

---

## 5. decisionResult / isAppealed / appealResult 추출

### 5-A. decisionResult
판결 주문 (`주문` 섹션) 첫 줄 또는 LLM 추출 결과. 표준 라벨:

| 패턴 (raw) | 정규화 |
|-----------|--------|
| `원고의 청구를 기각한다` | "기각" |
| `원고의 청구를 인용한다` | "원고 승소" |
| `원고의 청구를 일부 인용한다` | "일부 승소" |
| `피고는 무죄` | "무죄" |
| `피고를 징역 N년에 처한다` | "징역 N년" (정규식 추출) |
| `피고에게 벌금 N원` | "벌금 N원" |
| `소를 각하한다` | "각하" |

LLM 시스템 프롬프트에서 `decision_result` 키로 위 라벨 중 하나를 강제.

### 5-B. isAppealed / appealResult
판결문 메타에 항소 여부 포함. OPEN API 응답에 항소 정보가 직접 들어있지 않을 수도 있음 — 그 경우:
- 1차 판결만 있으면 `isAppealed=false, appealResult=null`.
- 후속 항소심 판례가 별도로 발견되면 — **사건번호 연결 룰**: 항소심 사건번호의 일련번호와 1심 사건번호를 매칭하기 어려우므로, 항소심 판결문 본문에서 "원심 사건번호" 추출하여 1심 case row 의 `is_appealed=true, appeal_result=...` 업데이트.

### 5-C. appealResult 라벨

| 패턴 | 정규화 |
|-----|-------|
| `원심판결을 유지한다` | "원심유지" |
| `원심판결을 파기한다` (환송) | "파기환송" |
| `원심판결을 파기하고 ... 판결한다` | "파기자판" |
| `상고를 기각한다` | "기각" |

---

## 6. 본문 미저장 + AI 요약 정책

### 6-A. raw 단계
OPEN API 응답 (XML/JSON) 을 S3 `raw/law-go-kr/<date>/<id>.xml` 에 저장. 90일 후 삭제.

### 6-B. staged 단계
- 본문 텍스트는 받되 **요약·NER 처리 후 폐기**.
- `cases.ai_summary` (3~5문장) 만 DB 에 영구 저장.
- 본문 발췌(첫 1,000자) 는 staged 에서만 임시 보관 → AI 요약 후 삭제.

### 6-C. AI 요약 (Sonnet 4.6)
[ai-pipeline.md §2-2](../ai-pipeline.md#2-2-판례-요약-sonnet-46) 의 시스템 프롬프트 사용. 출력 JSON 의 `summary`, `decision_result`, `is_appealed`, `appeal_result` 를 cases 테이블에 매핑.

### 6-D. 면책 자동 부착
DB 에는 면책 미저장. 화면 컴포넌트에서 자동 prepend ([ai-pipeline.md §6](../ai-pipeline.md#6-면책-자동-부착)).

---

## 7. 수집 빈도

| 작업 | cron 표현식 | 주기 | 1회 처리량 (예상) |
|-----|------------|------|----------------|
| `cases-crawler` (월 batch) | `0 19 1 * *` (UTC) | 월 1회 | 30~50건 |
| `cases-backfill` (분기 backfill) | `0 19 1-7 1,4,7,10 1` | 분기 1회 | 50~100건 |

### Throttle
- OPEN API 분당 60건 → 50건 batch 는 약 1분 내 완료.
- 호출간 1초 sleep 권장 (서버 부담 분산).

---

## 8. 출력

### 8-A. cases 테이블 insert
```sql
INSERT INTO cases (
  id, case_number, court, judge_id, case_type, decision_date,
  ai_summary, source_url, decision_result, is_appealed, appeal_result
) VALUES (...)
ON CONFLICT (id) DO UPDATE SET
  ai_summary = EXCLUDED.ai_summary,
  decision_result = EXCLUDED.decision_result,
  is_appealed = EXCLUDED.is_appealed,
  appeal_result = EXCLUDED.appeal_result,
  updated_at = now();
```
> Update on conflict — 항소심 결과 추가 시 1심 row 갱신.

### 8-B. judge_id 미매칭 처리
[matching-logic.md §4](../matching-logic.md#4-매칭-실패-큐-manual-review-queue) 의 review queue 로 보냄. cases 테이블 schema 는 `judge_id NOT NULL` → matching 실패 시 **아예 cases insert 보류**, payload 만 DLQ.

---

## 9. 모니터링 메트릭

`crawler_runs.metadata`:
```json
{
  "api_calls": 50,
  "raw_cases": 80,
  "after_normalize": 80,
  "after_dedupe": 65,
  "ai_summarized": 65,
  "auto_matched": 60,
  "manual_review_queued": 5,
  "appeal_updates": 3,
  "ai_tokens_input": 530000,
  "ai_tokens_output": 88000,
  "ai_cost_usd": 1.42
}
```

---

## 10. Phase 3 구현 순서

1. `crawlers/src/adapters/law-go-kr.ts` (OPEN API client)
2. `crawlers/src/lib/case-number.ts` (정규화)
3. `crawlers/src/pipeline/extract-judges-header.ts` (정규식 + LLM 보조)
4. `crawlers/src/pipeline/extract-decision-result.ts` (라벨 매핑)
5. `crawlers/src/workers/cases-crawler.ts`
6. `.github/workflows/cases-crawler.yml` (cron `0 19 1 * *`)
7. mock data eval 후 첫 batch 실행

---

## 출처

- [국가법령정보 판례 목록 API](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precListGuide)
- [국가법령정보 판례 본문 API](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precInfoGuide)
- [나무위키 - 사건번호](https://namu.wiki/w/%EC%82%AC%EA%B1%B4%EB%B2%88%ED%98%B8)
- [matching-logic.md](../matching-logic.md)
- [ai-pipeline.md](../ai-pipeline.md)
