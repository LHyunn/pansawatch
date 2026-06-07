# PansaWatch (판사워치)

대한민국 법관 공개정보를 모아 시민이 '개별 판결'에 투표하는 시빅테크 플랫폼.

이 프로젝트는 일본의 **재판관맵(裁判官マップ, [saibankan-map.jp](https://saibankan-map.jp))**에서 영감을 얻었습니다. 다만 재판관맵의 판사 개인 별점·리뷰 방식은 채택하지 않고, **판결 단위 시민 투표**로 설계를 바꿨습니다 — 판사 개인이 아닌 공문서(판결)에 대한 의견 표현이 법적으로 훨씬 안전하면서도, 판결별 투표가 축적되면 시민 평가가 자연스럽게 집계되기 때문입니다.

> **핵심 원칙: 판사 개인이 아니라 판결(공문서)을 평가한다.**
> 평가 대상을 사람이 아닌 공적 기록(판결)으로 한정하는 것이 이 프로젝트의 법적 안전성의 핵심입니다. 자세한 설계 논리는 [/about](app/about/page.tsx) 페이지에 있습니다.

## In English

**PansaWatch ("Judge Watch")** is a Korean civic-tech platform for judicial transparency. It aggregates public records on all **2,987 sitting judges** and **83 courts** in South Korea, links court rulings to news coverage with LLM-extracted structured data (court, bench, charges, prosecution demand, sentence), and will let citizens vote on **individual rulings** — public documents — rather than rate judges as people: a deliberately defamation-safe design.

- **Working today** — judge/court profiles, an interactive nationwide court map (d3-geo), a news feed with AI summaries, and a fully automated ingestion pipeline: Naver News search → controversy filtering → vLLM (Gemma) structured extraction → automatic judge linking. 40 real articles ingested so far.
- **Not yet** — per-ruling voting and accounts are UI-only (no DB/persistence); the app renders from static `data/*.json`.
- **Principles** — non-profit, no ads, no editorial alteration of collected public records. Only public-record sources (court gazette, published news); no victim or minor PII; AI-generated summaries are always labeled as such.
- **Inspiration** — Japan's [saibankan-map.jp](https://saibankan-map.jp), replacing its per-judge star-rating model with per-ruling voting for legal safety.

Stack: Next.js 16 (App Router, RSC) · React 19 · TypeScript · Tailwind CSS v4. Pipeline: Node.js + Python, self-hosted vLLM.

## 주요 기능

- **판사 / 법원 프로필 + 지도** — 법원공보 기반 법관 2,987명, 법원 83곳의 공개정보를 탐색. d3-geo 기반 인터랙티브 전국 법원 지도.
- **판사별 뉴스 + AI 요약** — 네이버 뉴스에서 수집한 선고 기사를 판사 프로필에 자동 연결. 헤드라인 + 원문 링크 + LLM 추출 구조화 정보(법원·재판부·죄명·구형·선고형) 제공.
- **⭐ 판결 단위 시민 투표** — 판사 개인이 아닌 *개별 판결*을 평가 대상으로 삼는 핵심 기능. **(UI만 구현, 아직 비작동 — 아래 '현재 상태' 참조)**
- **통계** — 판사/법원별 기사 수, 동의율 등 지표. (투표 데이터가 없어 현재는 대부분 빈 상태)

## 데이터 현황

| 데이터 | 건수 | 출처 |
|---|---|---|
| 판사 (`data/judges.json`) | 2,987 | 법원공보 법원구성부 PDF |
| 법원 (`data/courts.json`) | 83 | 대법원 공개정보 |
| 뉴스 기사 (`data/articles.json`) | 40 | 네이버 뉴스 → vLLM 추출 파이프라인 |
| 판사↔기사 링크 (`data/judgeArticles.json`) | 23 | 재판장 이름+법원 자동 매칭 |
| 판례 / 투표 (`cases.json`, `caseVotes.json`, `articleVotes.json`) | 0 | 미구현 |

모든 데이터는 `data/*.json` 정적 파일입니다. **DB·백엔드 미연동** — 앱은 빌드 시점에 JSON을 임포트해 렌더링합니다.

## 기술 스택

- **Next.js 16.2.4** (App Router, RSC) + **React 19** + **TypeScript** + **Tailwind CSS v4**
- 지도: **d3-geo** + **topojson-client** (차트는 의존성 없이 직접 그린 SVG)
- 수집 파이프라인: Node.js 스크립트(`scripts/*.mjs`) + Python(`scripts/*.py`, pdfplumber/openpyxl)

### ⚠️ Next.js 16 주의

이 버전은 기존 Next.js와 API/관례가 다릅니다(예: `params`/`searchParams`가 Promise). 코드를 작성하기 전에 [`AGENTS.md`](./AGENTS.md)를 참조하고 `node_modules/next/dist/docs/`의 가이드를 확인하세요.

## 로컬 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 프로덕션 빌드
```

웹앱 실행에는 위 명령이면 충분합니다(데이터는 리포에 포함). 아래 파이프라인은 데이터를 **갱신**할 때만 필요합니다.

## 데이터 파이프라인

### A. 법관 데이터 — 법원공보 PDF → `judges.json`

```
법원구성부.pdf ─→ scripts/pdf_to_excel_courts.py ─→ 법원구성부_정제.xlsx
                                                        │
              data/judges.json ←─ scripts/build_judges_json.py
```

- PDF 좌표 기반 파싱(표 병합 셀 대응), 원외재판부 합성, 직위 표준화, 동명이인 분리(`(이름, 법원)` 키 + 법원공보의 생년 구분자 보존).
- 입력 PDF·중간 xlsx는 리포에 포함하지 않습니다(스크립트 상단의 경로 상수를 환경에 맞게 수정).

### B. 뉴스 데이터 — 네이버 뉴스 → vLLM 추출 → `articles.json`

```
네이버 뉴스 API("법원 선고") ─→ 논란성 필터(LLM) ─→ 동일 사건 클러스터링/대표 선정
                                                        │
data/articles.json + judgeArticles.json ←─ vLLM(Gemma) 구조화 추출 + 판사 자동 링크
```

| 스크립트 | 역할 |
|---|---|
| `scripts/find-controversial-articles.mjs` | 네이버 뉴스 검색 + 기수집 링크 제외(`data/seen-articles.json`) |
| `scripts/dedup-by-case.mjs` | 동일 사건 중복 보도 클러스터 → 매체 우선순위로 대표 1건 선정 |
| `scripts/extract-from-naver-url.mjs` | 원격 GPU 서버의 vLLM(Gemma 4 31B) 컨테이너를 SSH로 기동·추출·정리 |
| `scripts/extract-and-register.mjs` | 위 추출을 감싸 등록까지: URL 멱등성 체크 → 추출 → `articles.json` 추가 + 판사 링크 |

**필요 환경변수** (파이프라인 전용 — 웹앱에는 불필요):

| 변수 | 용도 |
|---|---|
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 오픈 API (뉴스 검색) |
| `GPU_SSH_USER` / `GPU_SSH_HOST` / `GPU_SSH_PORT` | vLLM을 실행할 GPU 서버 SSH 접속 정보 (키 인증) |
| `HF_TOKEN` | (권장) Hugging Face 모델 다운로드 가속 |

> ⚠️ 뉴스 파이프라인은 **별도의 GPU 서버**(vLLM + `google/gemma-4-31B-it`, VRAM ~32GB)를 전제합니다. `npm install`만으로 재현되는 구성이 아닙니다.

### Claude Code 스킬

`.claude/skills/`에 파이프라인을 감싼 스킬이 포함되어 있습니다 (Claude Code 사용 시):

- `extract-naver-news` — 네이버 기사 URL을 받아 추출·등록
- `find-controversial-news` — 양형 논란 의심 기사 발견(등록 안 함)
- `register-controversial-news` — 발견 + 등록 end-to-end

## ⚠️ 현재 상태 (정직하게)

페이지는 위 실데이터로 정상 빌드/렌더되지만, 프로젝트의 핵심인 **'판결 단위 투표'는 아직 비작동**입니다.

- 판례(`cases.json`)·투표 데이터 0건 — 동의율/양형 통계는 모두 빈 상태로 렌더
- 투표 위젯은 클라이언트 mock (영속화 없음), 로그인(OAuth)도 UI 스텁
- 정정 요청은 mailto 링크, 개인정보처리방침은 Phase 2 발효 예정 초안

즉, **데이터 수집 파이프라인과 탐색 UI는 실작동, 투표·계정 기능은 골격 단계**입니다.

## 데이터 수집 원칙

- 공개된 정보만 수집: 법원공보(법관 인사), 공개 보도 기사(네이버 뉴스)
- 피해자·미성년자 등 비공개 개인정보 미수록, 판사 사진·연락처 미수록
- AI 요약은 판결 내용의 중립적 기술에 한정하며 모든 노출면에 AI 생성 고지 부착

## 포지셔닝

비영리 프로젝트입니다. `.org` 도메인을 지향하며, **광고 없음**, **운영자 무편집**(수집된 공개정보를 운영자가 임의로 손대지 않음)을 원칙으로 합니다.
