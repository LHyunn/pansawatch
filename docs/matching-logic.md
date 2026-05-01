# PansaWatch — 판사 매칭 로직

> 외부에서 수집된 텍스트(기사·판례)에 등장하는 인명을 `judges` 테이블 row 와 연결하는 단계.
> Phase 3 의 가장 어려운 부분 — 한국어 동명이인이 흔하기 때문에 보수적 매칭이 원칙.

---

## 1. NER 도구 결정

### 후보 비교

| 도구 | 장점 | 단점 | 추가 인프라 |
|------|------|------|------------|
| **Claude Haiku 4.5** | 컨텍스트 이해 (직위·법원과 함께 추출), 별도 모델 불필요 | API 호출 비용 (월 ~$8 — [ai-pipeline.md](./ai-pipeline.md) 참조) | 없음 |
| KoNLPy (Mecab/Komoran) | 무료, 빠름, 오프라인 | 인명 인식 정확도 낮음, 직위·법원 같은 컨텍스트 결합 추출 어려움, Windows 설치 까다로움 | Python 환경 + 형태소 분석기 dict |
| HuggingFace KoBERT NER | 학습 모델 활용, 정확도 높음 | 추론 인프라 필요 (GPU 또는 양자화), 모델 호스팅 비용 | 추론 서버 |
| spaCy + ko_core_news_md | TS 직접 사용 어려움 (Python) | spaCy 한국어 모델 품질 낮음 | Python sidecar |

### 결정: Claude Haiku 4.5

**이유**:
1. PansaWatch 는 이미 Claude API 통합 (요약용) → 인프라 추가 불필요.
2. NER 단계에서 단순 인명 추출이 아닌 **(이름, 직위, 법원, confidence)** 구조화 출력 필요 → LLM 이 자연스럽게 구조화 가능.
3. 한국어 형태소 분석기는 인명 인식 정확도가 낮아 후처리 비용이 더 큼 ([검색결과](https://github.com/datanada/Awesome-Korean-NLP)).
4. 운영자 1인 환경 → 운영 단순화 우선.

**리스크 완화**:
- LLM 환각 → confidence 0.5 미만은 자동 폐기, 매칭 단계에서 추가 검증.
- 비용 폭증 가능 → 월간 모니터링 알림 ($30 초과 시).

---

## 2. 매칭 단계 (5단계 파이프라인)

```
TEXT (기사 본문 발췌 또는 판결문 메타)
   ↓
[1] LLM 후보 추출  →  candidates: [{name, position, court, confidence}]
   ↓
[2] 정규화         →  법원명 standard form, 직위 표준화
   ↓
[3] judges 테이블 lookup
   ↓
[4] 동명이인 처리  →  법원/임관년 교차 검증
   ↓
[5] relevance_score 계산 + 매칭 또는 보류
```

### Step 1. LLM 후보 추출

[ai-pipeline.md §2-3](./ai-pipeline.md#2-3-ner-haiku-45) 의 NER 시스템 프롬프트 사용. 출력:

```json
{
  "candidates": [
    { "name": "김명석", "position": "대법관", "court": "대법원", "confidence": 1.0 },
    { "name": "이정아", "position": "부장판사", "court": "서울중앙지방법원", "confidence": 0.7 },
    { "name": "박 판사", "position": "판사", "court": null, "confidence": 0.3 }
  ]
}
```

confidence < 0.5 후보는 즉시 폐기 (DLQ 도 안 보냄 — 노이즈가 많음).

### Step 2. 정규화

#### 법원명 표준화
LLM 이 "서울중앙지법", "서울중앙지방법원", "서울 중앙지방법원" 등 변형으로 출력할 수 있으므로 표준 사전으로 매핑.

```typescript
const COURT_ALIASES: Record<string, string> = {
  "서울중앙지법": "서울중앙지방법원",
  "서울중앙지방법원": "서울중앙지방법원",
  "중앙지법": "서울중앙지방법원",  // 위험 — 컨텍스트에 다른 법원 없을 때만
  "서울지법": "서울중앙지방법원",  // legacy 명칭
  "서울가법": "서울가정법원",
  "서울행법": "서울행정법원",
  "서울고법": "서울고등법원",
  "대법": "대법원",
  // ... 21개 법원 alias 사전 (`crawlers/src/lib/court-aliases.ts`)
};
```

#### 직위 정규화

```typescript
const POSITION_ALIASES: Record<string, string> = {
  "대법관": "대법관",
  "헌법재판관": "헌법재판관",
  "법원장": "법원장",
  "수석부장판사": "수석부장판사",
  "부장판사": "부장판사",
  "판사": "판사",
  "전담법관": "전담법관",
};
```

### Step 3. judges 테이블 lookup

```sql
-- 1차: 이름 + 법원 정확 일치
SELECT id, name, court, court_id, position, appointment_year
FROM judges
WHERE name = $1 AND court = $2;

-- 2차 (1차 결과 0건): 이름만 정확 일치
SELECT id, name, court, court_id, position, appointment_year
FROM judges
WHERE name = $1;
```

### Step 4. 동명이인 처리

이름 매칭에서 row >= 2 인 경우:

#### Case A: 법원이 후보에 명시됨
```
candidate: { name: "김민수", court: "서울중앙지방법원" }
DB rows:
  - judge-12 김민수 (서울중앙지방법원, 부장판사)
  - judge-44 김민수 (대전지방법원, 판사)
→ 매칭: judge-12 (법원 일치)
```

#### Case B: 법원 정보 없으나 직위만 명시
```
candidate: { name: "이정아", position: "대법관", court: null }
DB rows:
  - judge-2 이정아 (대법원, 대법관)
  - judge-77 이정아 (광주지방법원, 판사)
→ 매칭: judge-2 (직위 = "대법관"으로 유일하게 식별 가능)
```

#### Case C: 정보 부족
```
candidate: { name: "박현우", position: "판사", court: null }
DB rows:
  - judge-3 박현우 (대법원, 대법관)   ← 직위 불일치
  - judge-50 박현우 (부산지방법원, 판사)
  - judge-71 박현우 (인천지방법원, 판사)
→ 매칭 보류 → DLQ (manual review queue)
```

#### Case D: 임관년도 보강 (선택)
기사 본문에 "1995년 임관한 박OO 판사" 같은 표현 있을 시 LLM 이 함께 추출하면 추가 식별 가능. (Phase 3 후반 고도화)

### Step 5. relevance_score 계산

```typescript
function relevanceScore(
  candidate: NerCandidate,
  match: JudgeRow | null
): number {
  if (!match) return 0;

  // 이름 + 법원 정확 일치
  if (
    candidate.name === match.name &&
    candidate.court &&
    candidate.court === match.court
  ) {
    return 1.0;
  }

  // 이름 + 직위 정확 일치 (동명이인 식별 가능)
  if (
    candidate.name === match.name &&
    candidate.position === match.position
  ) {
    return 0.85;
  }

  // 이름만 일치, 동명이인 없음 (DB row 1개)
  if (candidate.name === match.name) {
    return 0.7;
  }

  // 모호한 매칭 (호출 측에서 review 필요)
  return 0.5;
}
```

### Insert 정책

| relevance_score | 동작 |
|----------------|------|
| `>= 0.7` | `judge_articles` 또는 `cases.judge_id` 에 자동 insert |
| `0.5 <= x < 0.7` | DLQ `error_class='matching_unsure'` → 운영자 검토 |
| `< 0.5` | drop (insert 안 함, DLQ 도 안 보냄) |

> **이유**: brief §2 (법적 안전성) — 잘못 매칭된 판사·기사 연결은 명예훼손 리스크 증가. 보수적으로 매칭 보류가 안전.

---

## 3. 판례의 경우 추가 룰

판례는 판결문 헤더에 재판부 정보가 정형 텍스트로 있어 추출 정확도가 높음.

### 판결문 헤더 패턴 (예시)
```
재판장 판사 김명석
판사 이정아
판사 박현우
```
또는
```
부장판사 김명석
판사 이정아
판사 박현우
```

### 룰 기반 추출 (LLM 보조)
1. LLM 1차 추출 (시스템 프롬프트에 "재판부 정보를 우선 추출"). 출력 키 `judges` (위 ai-pipeline NER 형식).
2. 정규식 검증:
   ```
   /(부장판사|재판장 판사|판사|대법관|헌법재판관|법원장)\s+([가-힣]{2,4})/g
   ```
3. LLM 결과 ⊃ 정규식 결과 ⇒ LLM 신뢰. 차이 발생 시 정규식 결과 우선 (판결문은 형식적이라 정규식이 안전).

### 사건번호 정규화
[crawler-spec/cases.md §3](./crawler-spec/cases.md) 의 사건번호 정규화 룰 적용. 정규화된 사건번호 + 법원명 조합으로 `cases` 테이블 dedupe.

### Primary judge 결정
판례에는 `cases.judge_id` 1개만 저장 (스키마 제약). 다음 우선순위:
1. 헤더에 "재판장" 명시된 경우 → 그 사람
2. "부장판사" 직위 → 그 사람
3. 첫 번째 등장 인물

나머지 판사는 Phase 4 의 `case_judges` (m:n) 테이블 추가 시 보존 (현재는 metadata 로 raw 저장).

---

## 4. 매칭 실패 큐 (Manual Review Queue)

### 데이터 구조

`crawler_dlq` 테이블 ([pipeline-architecture.md §5](./pipeline-architecture.md#5-에러재시도dlq) 정의) 의 `error_class='matching_unsure'` row 가 manual review queue 역할.

`payload` JSON 예시:
```json
{
  "source_type": "article",
  "source_id": "naver:202604301035",
  "title": "박OO 판사, 횡령 사건 1심 무죄",
  "candidate": {
    "name": "박현우",
    "position": "판사",
    "court": null,
    "confidence": 0.6
  },
  "matches_found": [
    { "judge_id": "judge-3", "court": "대법원", "position": "대법관" },
    { "judge_id": "judge-50", "court": "부산지방법원", "position": "판사" },
    { "judge_id": "judge-71", "court": "인천지방법원", "position": "판사" }
  ],
  "scores": [
    { "judge_id": "judge-50", "score": 0.5 },
    { "judge_id": "judge-71", "score": 0.5 }
  ]
}
```

### Resolve 인터페이스
Phase 3 후반 — `/admin/review` 페이지 (운영자 only). 각 row 에 대해:
- 후보 매치 중 1개 선택 → `judge_articles` insert + `crawler_dlq.resolved=true`.
- "해당 없음" → drop + resolved=true.
- "보류" → 일단 그대로.

운영자 부담 최소화: 일일 평균 새 항목 < 5건 목표 (NER 정확도 + 보수적 매칭).

---

## 5. 정확도 측정 (Phase 3 사전 평가)

### Mock 기반 eval

`data/articles.json` 의 100건 기사 + `data/cases.json` 의 80건 판례를 입력으로 사용. 정답은 mock 의 `judgeId` (cases) 또는 `judge_articles` 매핑.

### 측정 지표
- **Precision** (자동 매칭된 것 중 정답 비율) — 목표 ≥ 95%
- **Recall** (정답 중 자동 매칭된 비율) — 목표 ≥ 70%
- **Manual queue ratio** (DLQ 진입 비율) — 목표 ≤ 10%
- **F1 score** — 목표 ≥ 0.80

### 평가 스크립트
```
crawlers/src/eval/run-matching-eval.ts
```
Phase 3 첫 sprint 산출물. 입력 = mock JSON, 출력 = 위 4개 지표 + 오분류 케이스 dump.

### 튜닝 우선순위
1. NER 시스템 프롬프트 개선 (confidence threshold 조정)
2. 법원명 alias 사전 보강
3. 동명이인 임관년 검증 룰 추가

---

## 6. 동명이인 통계 (참고)

mock 데이터 기준:
- `data/judges.json` 50명. 동명이인 0건 (의도적 unique).
- 실제 한국 법관 약 3,300명 중 흔한 성씨(김·이·박·최) 비율 ~50%, 두 글자 이름 ~50%, 즉 **이름 충돌 가능성 약 20% 추정**.

→ 매칭 보수성은 실제 운영에서 더 중요해짐. Phase 3 첫 가동 시 manual queue ratio 모니터링 필수.

---

## 7. 개인정보 가드

브리프 §12: 판사의 개인 연락처·주소·사적 정보 미수집.

### NER 단계에서 차단
LLM 시스템 프롬프트에 명시:
> 추출 대상은 (이름, 직위, 법원) 만. 거주지·연락처·가족·취미 등 사적 정보는 추출 결과에 포함하지 않는다.

### Post-processing 차단 (안전망)
NER JSON 응답에 다음 키가 있으면 자동 strip:
- `address`, `phone`, `email`, `family`, `hobby`, `personal_*`

(Haiku 가 schema 외 키를 추가할 가능성은 낮으나 안전망으로 유지.)

---

## 8. Phase 3 구현 순서 (Matching)

1. `crawlers/src/lib/court-aliases.ts` — 법원·직위 alias 사전
2. `crawlers/src/pipeline/normalize-entities.ts` — Step 2
3. `crawlers/src/pipeline/match-judges.ts` — Step 3~5
4. `crawlers/src/eval/run-matching-eval.ts` — mock 기반 평가
5. eval F1 ≥ 0.80 도달까지 prompt + alias 튜닝
6. `crawler_dlq` insertion + `/admin/review` 페이지 (Phase 3 후반)

---

## 출처

- [GitHub: 한국어 NER 자료 (Awesome-Korean-NLP)](https://github.com/datanada/Awesome-Korean-NLP)
- 프로젝트 브리프 §2 (법적 분석), §12 (개인정보 정책)
- [ai-pipeline.md](./ai-pipeline.md) — NER 시스템 프롬프트
- [pipeline-architecture.md](./pipeline-architecture.md) — DLQ 스키마
