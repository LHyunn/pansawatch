# PansaWatch — AI 파이프라인 (Claude API)

> Phase 3 — 기사·판례 요약 + 인명/법원 NER 의 Claude API 사용 명세.
> 모델·토큰·캐시·면책 자동 부착까지 일체 결정 명시.

---

## 1. 모델 선택

| 작업 | 모델 | 이유 | 가격 (per MTok) |
|-----|------|-----|----------------|
| 기사 요약 | **Claude Haiku 4.5** (`claude-haiku-4-5`) | 1~3문장 한국어 뉴스 요약은 단순. 빠르고 저렴. | input $1 / output $5 |
| 판례 요약 | **Claude Sonnet 4.6** (`claude-sonnet-4-6`) | 판결문은 길고 법률 용어 정확도 필수. 1M 컨텍스트 활용. | input $3 / output $15 |
| 인명/법원 NER | **Claude Haiku 4.5** | 짧은 텍스트에서 구조화된 JSON 추출. KoNLPy 등 외부 NER 인프라 불필요. | input $1 / output $5 |

> **모델 ID는 약식**(`-latest`) 대신 **명시 버전 핀**. Anthropic 모델 deprecation 정책 상 마이너 버전 혼란을 막기 위함.

### 폴백
- Haiku 4.5 fail → Haiku 3.5 (`claude-haiku-3-5`) 자동 폴백.
- Sonnet 4.6 fail → Sonnet 4.5 (`claude-sonnet-4-5`).

---

## 2. 시스템 프롬프트 (캐시 대상)

### 2-1. 기사 요약 (Haiku 4.5)

```
당신은 대한민국 사법부 관련 뉴스 기사를 시민에게 전달하는 시빅테크 플랫폼 PansaWatch 의 요약 보조원입니다.

원칙:
1. 사실 기반. 보도된 내용만 그대로 요약하고, 평가·추측·정치적 색깔을 더하지 않습니다.
2. 판사 개인을 평가하지 않습니다. "OO 판사가 잘못했다" 같은 표현 금지.
3. 한국어로 2~3문장, 각 문장 70자 이내.
4. 사건번호·법원명·판사 직위가 본문에 있으면 그대로 포함.
5. 출력은 JSON: {"summary": "...", "judges_mentioned": [{"name": "...", "court": "...", "position": "..."}], "case_number": "..."(없으면 null)}.

면책: 이 요약은 자동 생성되며, 정확한 내용은 원문을 참조하라는 안내가 사이트에 별도 부착됩니다.
```

길이: 약 600 토큰 (시스템 프롬프트). **5분 캐시 활성** (cron 1회 실행 동안 재사용 → 일일 호출 100건이 5분 안에 일괄 처리되는 경우 95% cache hit).

### 2-2. 판례 요약 (Sonnet 4.6)

```
당신은 대한민국 판례를 시민이 이해할 수 있는 평이한 한국어로 요약하는 PansaWatch 의 보조원입니다.

원칙:
1. 사실 기반. 판결문에 적힌 내용만 요약하고, 판결의 정당성·판사의 자질에 대한 평가를 추가하지 않습니다.
2. 한국어로 3~5문장. 첫 문장은 "이 사건은 ...에 관한 사건이다." 형식으로 사건 본질을 한 줄에 정리.
3. 법률 용어는 가능한 한 쉬운 말로 풀되, 핵심 개념은 그대로 사용 (예: "기각", "원고 승소").
4. 항소심·상고심 결과가 있으면 마지막 문장에 명시.
5. 출력은 JSON:
   {
     "summary": "3~5문장 요약",
     "case_type": "민사" | "형사" | "행정" | "가사",
     "decision_result": "원고 승소" | "피고 승소" | "일부 승소" | "기각" | "징역 N년" | ...,
     "is_appealed": boolean,
     "appeal_result": "원심유지" | "파기환송" | "파기자판" | null,
     "judges": [{"name": "...", "court": "...", "position": "..."}]
   }

법조 톤: 중립·존대(공식체). "~하였다", "~판단했다" 등.
면책: 이 요약은 자동 생성되며, 사이트에 자동 부착됩니다.
```

길이: 약 1,200 토큰. **5분 캐시 활성**.

### 2-3. NER (Haiku 4.5)

```
입력 텍스트에서 한국 법원·판사 정보를 추출해 JSON 으로 반환하라.

규칙:
1. "OO 판사", "OO 부장판사", "OO 대법관", "OO 헌법재판관", "OO 법원장" 등의 직위와 함께 등장한 인명만 추출.
2. 법원명은 텍스트에 명시된 것만 (추정 금지).
3. 동일 인명이 여러 번 나오면 한 번만.
4. 출력 schema:
   { "candidates": [{ "name": "홍길동", "position": "부장판사", "court": "서울중앙지방법원" | null, "confidence": 0.0~1.0 }] }
5. confidence 산정 기준:
   - 1.0: 직위·법원·이름 모두 같은 문장에 있음
   - 0.7: 이름·직위 있고 법원은 인접 문장에 있음
   - 0.5: 이름·직위만, 법원 추출 불가
   - 0.3: 이름은 있으나 직위가 모호 (예: "김 판사")
   추출 누락보다는 0.5 이하로 보내고 매칭 단계에서 폐기하는 편이 안전.
6. 추가 텍스트 없이 JSON 만 출력.
```

길이: 약 400 토큰. **5분 캐시 활성**.

---

## 3. 프롬프트 캐싱 전략

### 적용 원칙
- 시스템 프롬프트 + 도구 정의 (만약 사용 시) → `cache_control: { type: "ephemeral" }` 5분 캐시.
- 사용자 메시지는 매번 다르므로 캐시 X.
- Cron 1회 실행 = 1 batch (예: 100건의 기사). 첫 호출이 cache write, 이후 99건은 cache read → 비용 절감 ~80%.

### 코드 패턴 (Anthropic SDK, TypeScript)

```typescript
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic();

const SYSTEM_PROMPT_ARTICLE = "..."; // 위 2-1

async function summarizeArticle(title: string, excerpt: string) {
  return anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 800,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT_ARTICLE,
        cache_control: { type: "ephemeral" }, // 5분 캐시
      },
    ],
    messages: [
      {
        role: "user",
        content: `제목: ${title}\n\n발췌:\n${excerpt}`,
      },
    ],
  });
}
```

### 캐시 효율 측정
응답의 `usage.cache_creation_input_tokens` (write) 와 `usage.cache_read_input_tokens` (hit) 를 `crawler_runs.metadata` 에 누적 기록 → 일일 cache hit ratio 모니터링.

---

## 4. 토큰 예산 (월간)

[pipeline-architecture.md §7](./pipeline-architecture.md#7-비용-추정-월간) 참조 — 최종 표:

| 항목 | 일일 건수 | 입력/건 | 출력/건 | 모델 | 월 비용 |
|-----|---------|--------|--------|------|--------|
| 기사 요약 | 100 | 3,000 (80% 캐시) | 500 | Haiku 4.5 | **$10** |
| 판례 요약 | ~1 (월 30) | 8,000 (15% 캐시) | 1,500 | Sonnet 4.6 | **$1.30** |
| 기사 NER | 100 | 1,500 (60% 캐시) | 200 | Haiku 4.5 | **$8** |
| 판례 NER | ~1 | 3,000 (40% 캐시) | 300 | Sonnet 4.6 | **$0.40** |
| **합계** | | | | | **~$20/월** |

**1,400 KRW/USD 기준 ≈ 28,000 KRW.**

---

## 5. 캐싱 전략 (애플리케이션 레벨 — 재처리 방지)

LLM 호출 결과는 **DB 의 source-of-truth 이므로 별도 캐시 불필요**. 단:

| 시나리오 | 정책 |
|---------|------|
| 동일 article URL 재수집 | URL hash 로 articles 테이블 lookup → 존재하면 LLM 호출 건너뜀 |
| 동일 case_number 재수집 | (case_number, court) 조합으로 cases 테이블 lookup → 존재하면 건너뜀 |
| 요약 재생성 (수동) | `articles.ai_summary IS NULL` 또는 `force_resummarize=true` 컬럼 (선택)만 처리 |
| 모델 업그레이드 시 백필 | 별도 1회성 batch script — Haiku 4.5 → 4.6 전환 등 |

### 멱등성
- `articles.id` 는 `sha256(url_canonical)` 의 처음 16자 (저장 가능, 충돌 무시 가능).
- `cases.id` 는 `sha256(case_number + ":" + court)` 의 처음 16자.
- INSERT … ON CONFLICT DO NOTHING 으로 중복 시 silent skip.

---

## 6. 면책 자동 부착

### DB 에는 요약만, 화면에는 면책

`articles.ai_summary`, `cases.ai_summary` 에는 순수 요약 텍스트만 저장. 화면 컴포넌트(`<AISummary>`)에서 다음 면책을 **자동 prepend/append**:

```tsx
<AISummary>
  <p className="text-xs text-amber-600 mb-1">※ AI 자동 생성 요약</p>
  <p>{summary}</p>
  <p className="text-xs text-slate-500 mt-1">
    정확한 내용은{" "}
    <a href={sourceUrl} target="_blank" rel="noopener noreferrer">원문</a>
    을 확인하세요.
  </p>
</AISummary>
```

### About 페이지에도 표시
브리프 §12: 모든 AI 요약에 면책. `/about` 에서 사용 모델명·요약 정책·면책 문구를 명시적으로 공개.

---

## 7. 안전 가드 (시민 톤·법적 안전성)

### 출력 검증 (post-processing)
LLM 응답에 다음 패턴이 포함되면 자동 reject + DLQ 로 보내고 매뉴얼 검토:

| 차단 패턴 (정규식) | 사유 |
|------------------|-----|
| `(잘못|부당|편파|편향|불공정).{0,10}(판단|판결|선고)` | 판결 평가 표현 |
| `(자질|능력).{0,5}(부족|의심)` | 판사 자질 평가 |
| `(부패|비리|로비|의혹).{0,10}(판사|법관|재판부)` | 사실 미확인 의혹 표현 |
| `명백.{0,10}(잘못|위법)` | 단정적 위법 단정 |

> 위 패턴은 **요약 출력에 한해** 적용. NER 결과·메타데이터에는 적용 안 함 (원문 인용일 수 있음).

### 입력 측 가드
한 호출에 매우 긴 텍스트 (예: 50,000 토큰) 가 들어오면 자동 자르기 (Haiku 입력 ≤ 10,000 토큰, Sonnet ≤ 50,000 토큰). 잘릴 경우 metadata 에 `truncated: true` 기록.

---

## 8. legal-tone-reviewer 가이드 일치성

브리프 §2 + 디자인 시스템의 시빅 톤과 정합성 확보:

| 가이드 | 프롬프트 반영 |
|-------|--------------|
| 판사 개인 X, 판결 단위 ✓ | 시스템 프롬프트 1번 원칙 |
| 사실 기반, 의견 X | 시스템 프롬프트 1번 원칙 + post-processing 패턴 차단 |
| 면책 명시 | `<AISummary>` 컴포넌트에 자동 부착 |
| 한국어 시빅 톤 | 시스템 프롬프트의 문체 지침 (공식체, 평이한 표현) |

---

## 9. Phase 3 구현 순서 (AI 파이프라인)

1. `crawlers/src/lib/anthropic.ts` — Anthropic SDK 래퍼 + 캐싱 + 재시도 + 비용 로깅
2. `prompts/article-summary.txt` (시스템 프롬프트 파일로 분리, 버전 관리)
3. `prompts/case-summary.txt`
4. `prompts/ner.txt`
5. `crawlers/src/pipeline/summarize-haiku.ts`
6. `crawlers/src/pipeline/summarize-sonnet.ts`
7. `crawlers/src/pipeline/ner-claude.ts`
8. **eval set**: mock 데이터(`data/articles.json` 50건 + `data/cases.json` 30건)으로 dry-run → 면책 패턴 차단·요약 길이·NER 정확도 측정
9. 운영 가동 + `crawler_runs.metadata` 에 토큰/비용 적재

---

## 출처

- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- 프로젝트 브리프 §2 (법적 분석), §12 (면책 문구)
