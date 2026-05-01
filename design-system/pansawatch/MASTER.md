# PansaWatch — Design System Master

> **LOGIC:** When building a specific page, first check `design-system/pansawatch/pages/[page-name].md`.
> If that file exists, its rules **override** this Master.
> If not, strictly follow the rules below.

**Project:** PansaWatch.org (Civic Tech / Judicial Transparency Platform)
**Generated:** 2026-04-29 (synthesized from `ui-ux-pro-max` v2.5.0)
**Category:** Government/Public Service × News-Editorial × Data-Dense Dashboard

---

## 1. Design Philosophy

PansaWatch는 시민이 **공문서(판결)를 읽고 의견을 표현하는 정보 플랫폼**이다. 디자인은 다음 세 축을 동시에 만족해야 한다:

1. **신뢰감 (Trust)** — 정부 공개정보를 다루는 시빅테크. 광고나 장식이 없고, 데이터가 주인공.
2. **저널리즘적 가독성 (Editorial readability)** — 판결문/기사 요약이 길게 이어지는 페이지에서 긴 호흡으로 읽힌다.
3. **데이터 밀도 (Information density)** — 통계 탭, 판례 리스트, 뉴스 피드처럼 스캔이 필요한 화면이 많다.

**스타일 합성**: `Government/Public Service` (Trust 색상 골격) + `Editorial Grid / Magazine` (판사·판례 페이지) + `Data-Dense Dashboard` (통계 탭) + `Swiss Modernism 2.0` (12-col 격자 시스템).

**의도적으로 거부하는 것**:
- Bento Grid Showcase, Glassmorphism, Claymorphism — 시빅 톤에 맞지 않음
- 자극적인 빨강 배경, 과장된 그라데이션 — 중립성 훼손
- 이모지 아이콘 — 일관성 부족 + 시빅 톤 부적합

---

## 2. Color Palette

베이스: **Government Navy** + **Legal Authority Gold** (브리프의 "네이비 + 화이트 + 앰버" 매칭)

### 2.1 Brand & Surface

| Role | Light Hex | Dark Hex | CSS Variable | Usage |
|------|-----------|----------|--------------|-------|
| Primary (Navy) | `#0F172A` | `#E2E8F0` | `--color-primary` | 헤더, 주요 텍스트, 1차 버튼 |
| On Primary | `#FFFFFF` | `#0F172A` | `--color-on-primary` | Primary 위 텍스트 |
| Secondary (Slate) | `#334155` | `#94A3B8` | `--color-secondary` | 부제, 메타 정보 |
| Accent (Authority Gold) | `#B45309` | `#F59E0B` | `--color-accent` | 강조, "동의율" 하이라이트, 알림 |
| Link/Action Blue | `#0369A1` | `#38BDF8` | `--color-link` | 링크, 보조 액션 |
| Background | `#F8FAFC` | `#020617` | `--color-bg` | 페이지 배경 |
| Surface (Card) | `#FFFFFF` | `#0F172A` | `--color-card` | 카드, 패널 |
| Foreground | `#020617` | `#F8FAFC` | `--color-fg` | 본문 텍스트 |
| Muted | `#E8ECF1` | `#1E293B` | `--color-muted` | 비활성, 배경 패턴 |
| Muted Foreground | `#64748B` | `#94A3B8` | `--color-muted-fg` | 캡션, 메타 텍스트 |
| Border | `#E2E8F0` | `#334155` | `--color-border` | 카드/입력 테두리 |
| Ring (Focus) | `#0369A1` | `#38BDF8` | `--color-ring` | 키보드 포커스 링 (3px) |

### 2.2 Semantic / Voting Colors

투표 결과는 **색만으로 의미를 전달하지 않는다**. 항상 아이콘 + 텍스트 라벨을 함께 표시한다.

| Role | Light | Dark | CSS Variable | Usage |
|------|-------|------|--------------|-------|
| Success / 동의 / 적절 | `#059669` | `#10B981` | `--color-success` | "동의" 버튼, "적절한 양형" |
| Warning / 과소 | `#B45309` | `#F59E0B` | `--color-warning` | "양형 과소" |
| Danger / 비동의 / 과중 | `#B91C1C` | `#EF4444` | `--color-danger` | "비동의", "양형 과중", 경고 |
| Info | `#0369A1` | `#38BDF8` | `--color-info` | 안내, 면책 문구 박스 |

> **중요**: `Danger`는 `#DC2626` 같은 형광 톤이 아닌 **#B91C1C**(deeper crimson)을 쓴다. 시빅 톤에 맞고 빨강이 화면을 점령하지 않는다.

### 2.3 Data Visualization Palette

차트용 카테고리 컬러. Colorblind-safe + WCAG AA 대비 확보.

```
data-1: #1E3A8A   /* Navy */
data-2: #B45309   /* Gold */
data-3: #0F766E   /* Teal */
data-4: #7C2D12   /* Burnt orange */
data-5: #4338CA   /* Indigo */
data-6: #65A30D   /* Olive */
```

선형 그래프에서는 **선 패턴**(solid / dashed / dotted)을 함께 사용해 색맹 대응.

---

## 3. Typography

### 3.1 폰트 스택 (Korean-first)

한국어 콘텐츠가 100%이므로 **Pretendard**를 1순위로, 영문/숫자는 IBM Plex Sans/Mono를 보조로 사용한다.

| Role | Font | Fallback | Weights |
|------|------|----------|---------|
| Sans (UI/Body) | **Pretendard** | `Noto Sans KR`, `system-ui` | 400, 500, 600, 700 |
| Editorial Heading | **Pretendard** (ExtraBold/Black) | `Noto Sans KR` | 800, 900 |
| Numeric / Code | **IBM Plex Mono** | `JetBrains Mono`, `monospace` | 400, 500 |
| Optional Serif (긴 글) | **Nanum Myeongjo** | `Noto Serif KR` | 400, 700 |

**왜 Pretendard?** 한국어 웹의 사실상 표준. Inter 호환 메트릭으로 영문도 자연스럽게 어울리고, 가변 폰트(variable font)를 지원해 성능에도 좋다.

**CDN Setup** (`app/layout.tsx`에서 선언):

```html
<link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Nanum+Myeongjo:wght@400;700&display=swap" rel="stylesheet" />
```

**Tailwind config 매핑**:
```ts
fontFamily: {
  sans: ['"Pretendard Variable"', 'Pretendard', 'system-ui', 'sans-serif'],
  serif: ['"Nanum Myeongjo"', 'serif'],
  mono: ['"IBM Plex Mono"', 'monospace'],
}
```

### 3.2 Type Scale

8px 기반의 모듈러 스케일. 한국어는 영문 대비 행간을 약간 넉넉하게(1.6~1.7) 잡는다.

| Token | Size / Line-height | Weight | Usage |
|-------|-------------------|--------|-------|
| `text-display` | 48 / 56 | 800 | 페이지 히어로 (e.g., "PansaWatch") |
| `text-h1` | 32 / 40 | 700 | 페이지 제목 (판사 이름) |
| `text-h2` | 24 / 32 | 700 | 섹션 헤더 |
| `text-h3` | 20 / 28 | 600 | 카드 제목 |
| `text-h4` | 18 / 26 | 600 | 보조 제목 |
| `text-body-lg` | 17 / 28 | 400 | AI 요약문, 긴 글 본문 |
| `text-body` | 15 / 24 | 400 | 일반 본문 |
| `text-sm` | 14 / 20 | 400 | 메타데이터, 캡션 |
| `text-xs` | 12 / 16 | 500 | 배지, 라벨 |
| `text-mono-md` | 14 / 20 | 500 | 사건번호, 통계 수치 |

**한국어 본문 룰**:
- `letter-spacing: -0.01em` (Pretendard는 약간 좁히면 더 자연스러움)
- `word-break: keep-all`로 어절 단위 줄바꿈
- 본문 line-length 35~50자 (한글 기준), 모바일 25~35자

---

## 4. Layout & Spacing

### 4.1 Grid

**Swiss Modernism 2.0 기반 12-column 그리드**. 데스크탑 max-width는 `7xl` (1280px), 콘텐츠 영역은 `5xl` (1024px)을 기본으로.

```css
--container-max: 1280px;   /* 페이지 외곽 */
--content-max: 1024px;     /* 본문 영역 */
--reading-max: 720px;      /* 긴 글(AI 요약 등) */
--grid-gap: 24px;
```

### 4.2 Spacing Tokens

4px 기반. Tailwind 기본 스케일 그대로 사용.

| Token | Value | Tailwind | 주 용도 |
|-------|-------|----------|---------|
| `space-1` | 4px | `p-1` | 인라인 갭 |
| `space-2` | 8px | `p-2` | 아이콘 간격 |
| `space-3` | 12px | `p-3` | 작은 패딩 |
| `space-4` | 16px | `p-4` | 표준 패딩 |
| `space-6` | 24px | `p-6` | 카드 패딩, 섹션 갭 |
| `space-8` | 32px | `p-8` | 큰 갭 |
| `space-12` | 48px | `p-12` | 섹션 마진 |
| `space-16` | 64px | `p-16` | 히어로 패딩 |

### 4.3 Breakpoints

| Name | Min | 핵심 변화 |
|------|-----|-----------|
| (mobile) | 0 | 1-col, 검색바 풀폭, 지도 비활성/대체 |
| `sm` | 640px | 카드 2-col |
| `md` | 768px | 사이드바 등장, 통계 카드 3-col |
| `lg` | 1024px | 12-col 그리드 본격 |
| `xl` | 1280px | 콘텐츠 최대폭 도달 |

**모바일 우선** + `viewport-fit=cover`로 노치/홈인디케이터 안전영역 확보.

### 4.4 Border Radius

| Token | Value | 용도 |
|-------|-------|------|
| `radius-sm` | 6px | 배지, 작은 버튼 |
| `radius-md` | 8px | 입력, 일반 버튼 |
| `radius-lg` | 12px | 카드 |
| `radius-xl` | 16px | 모달, 큰 패널 |
| `radius-pill` | 9999px | 필터 칩, 태그 |

### 4.5 Elevation (Shadow)

저채도, 낮은 elevation. 시빅 톤에 맞춰 화려한 그림자 금지.

```css
--shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
--shadow-md: 0 2px 8px rgba(15, 23, 42, 0.06);
--shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.08);
--shadow-xl: 0 16px 48px rgba(15, 23, 42, 0.12);  /* 모달만 */
```

---

## 5. Page Pattern

### 5.1 Landing Pattern: **Search-First Directory + News Feed**

`Marketplace/Directory` 패턴 변형.

```
[Header: 로고 + 검색바(중앙) + nav(법원·뉴스·소개)]
[Hero: 한 줄 미션 + 글로벌 검색바 (큰 사이즈)]
[Map Section: 대한민국 법원 지도 + 마커]
[News Feed: 최근 수집된 기사 10~20건]
[Footer: 데이터 출처, 면책, 문의처]
```

- 1차 CTA = **검색바**. "판사 이름, 법원, 사건번호로 검색" placeholder.
- 지도는 보조 탐색 도구. 모바일에서는 지도 대신 "지역별 법원 리스트"로 대체.

### 5.2 Detail Pattern (판사 상세): **Editorial Grid + Tabs**

Magazine layout 변형 — 좌측 프로필(고정 또는 sticky), 우측 탭 콘텐츠.

```
[Profile Strip: 이름 / 직위 / 법원 / 약력 / 통계 카드 3개]
[Tabs: 판례 | 뉴스 | 통계]
  ├─ 판례 탭: 판례 카드 리스트 + 판결별 투표 위젯
  ├─ 뉴스 탭: 헤드라인 + 언론사 + AI 요약 + 원문 링크
  └─ 통계 탭: Recharts 라인/바/파이 차트
```

### 5.3 Dashboard Pattern (통계 탭): **Data-Dense**

`Data-Dense Dashboard` 스타일 적용. 차트 간 패딩 최소화, KPI 카드 한 줄, 차트 그리드.

---

## 6. Components

### 6.1 Button

```css
/* Primary (네이비) - 1차 액션 */
.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 15px;
  letter-spacing: -0.01em;
  transition: background 200ms ease, box-shadow 200ms ease;
  cursor: pointer;
  min-height: 44px;  /* a11y 터치 타겟 */
}
.btn-primary:hover { background: #1E293B; box-shadow: var(--shadow-md); }
.btn-primary:focus-visible { outline: 3px solid var(--color-ring); outline-offset: 2px; }

/* Secondary (테두리) */
.btn-secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-border);
}

/* Vote buttons - 의미 색상 사용 */
.btn-vote-agree { background: var(--color-success); color: white; }
.btn-vote-disagree { background: var(--color-danger); color: white; }
```

> 모든 버튼: **min-height 44px**, focus ring 표시, 호버는 색·그림자만 변경(레이아웃 시프트 금지).

### 6.2 Card (판례, 뉴스 공용)

```css
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}
.card:hover { border-color: #CBD5E1; box-shadow: var(--shadow-md); }
```

판례 카드 구조 (위→아래):
1. 메타 라인: `사건번호 (mono) · 사건유형 배지 · 선고일`
2. 판결 결과 (간결한 한 줄)
3. AI 요약 (3~5문장, body-lg)
4. 면책 박스 (`info` 색상, 작은 글씨): "AI가 생성한 요약입니다. 정확한 내용은 원문을 확인하세요."
5. 시민 투표 위젯 (다음 항목)
6. 원문 링크 버튼 (Secondary)

### 6.3 Voting Widget ⭐ 핵심 컴포넌트

```
┌────────────────────────────────────────────┐
│ 이 판결에 동의하십니까?       총 N명 참여 │
│ [✓ 동의 (62%)]    [✗ 비동의 (38%)]        │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  ← 가로 스택 바     │
└────────────────────────────────────────────┘
```

요구사항:
- 상태: **로그아웃 / 미투표 / 투표완료(변경 가능)** 3가지를 명확히 구분
- 투표 직후 낙관적 업데이트(Optimistic UI), 비율 200ms 애니메이션
- 형사 사건은 양형 위젯 추가 (적절/과소/과중, 3-segment)
- 색상: 동의(`success`), 비동의(`danger`), 양형 적절(`success`), 과소(`warning`), 과중(`danger`)
- 색맹 대응: 아이콘(✓/✗) + 텍스트 라벨 항상 함께
- 미투표 상태에서는 투표하면 결과가 보인다는 힌트 제공

### 6.4 Search Bar

```css
.search {
  height: 56px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 0 24px 0 56px;  /* 좌측 아이콘 자리 */
  font-size: 16px;  /* iOS 자동 확대 방지 */
  background: var(--color-card);
}
.search:focus { border-color: var(--color-ring); box-shadow: 0 0 0 3px rgba(3, 105, 161, 0.15); }
```

### 6.5 Stat Card (요약 통계)

```
┌──────────────────────┐
│ 담당 판결            │
│ 87 건                │  ← 큰 숫자(mono, h1 크기)
│ 시민 동의율 64%      │  ← 보조(muted-fg)
└──────────────────────┘
```

수치는 mono 폰트(`IBM Plex Mono` 500). 비교 화살표(↑↓)는 `success`/`danger` 색상.

### 6.6 Badge

| Variant | 배경 | 텍스트 | 용도 |
|---------|------|--------|------|
| `default` | `--color-muted` | `--color-fg` | 사건유형 (민사/형사/행정/가사) |
| `info` | `#DBEAFE` | `#1E3A8A` | "신규 수집" 등 정보 |
| `success` | `#D1FAE5` | `#065F46` | "원심 유지" |
| `danger` | `#FEE2E2` | `#7F1D1D` | "파기 환송" |

### 6.7 Tabs

```
[ 판례 8 ]  [ 뉴스 23 ]  [ 통계 ]
═══════
```

- 활성: 하단 2px 네이비 underline + 700 weight
- 비활성: muted-fg, 호버 시 fg
- 모바일은 좌우 스크롤 + 스냅, 셀렉트 박스로 전환하지 않음 (탭 수가 3개로 적음)

---

## 7. Charts (Recharts 권장)

| 데이터 종류 | 차트 타입 | 라이브러리 | 비고 |
|-------------|-----------|------------|------|
| 시계열 동의율 | Line Chart | Recharts | 데이터 패턴(solid/dashed)으로 a11y |
| 사건유형 분포 | Bar Chart (vertical) | Recharts | 항상 내림차순 정렬, 막대에 값 라벨 |
| 항소심 결과 | Stacked Bar | Recharts | 원심유지 / 파기환송 / 파기자판 |
| 월별 기사 수 | Line / Area | Recharts | 6개월 윈도우, 점 호버 툴팁 |
| 법원 지도 | Choropleth + Markers | `react-simple-maps` | Phase 1은 react-simple-maps |
| 사건 분야 비율 | Donut | Recharts | **5개 이하만**. 그 이상이면 Bar로 |

차트 룰:
- 모든 차트에 keyboard nav + 텍스트 요약 (`aria-label`) 또는 토글 가능한 데이터 테이블
- 색상은 §2.3 Data Visualization Palette 사용
- 빈 상태 ("아직 투표가 없습니다") + 로딩 스켈레톤 항상 구현
- 모바일에서는 가로 차트로 reflow

---

## 8. Iconography

- **세트**: `lucide-react` (단일 세트 고정, 절대 혼용 금지)
- **크기 토큰**: 16 / 20 / 24px (인라인은 16, 표준 20, 강조 24)
- **stroke-width**: 1.75 통일 (lucide 기본은 2 — 약간 가늘게 가서 시빅 톤 유지)
- **금지**: 이모지(🎨 🚀 ⚖️) 절대 금지. "법" 관련 아이콘은 `Scale`, `Gavel`, `Building2` 사용
- **터치 타겟**: 16/20px 아이콘이라도 클릭 가능한 영역은 44×44px (`p-3` 등으로 확보)

---

## 9. Motion

- **Duration**: micro 150ms, standard 200ms, modal/sheet 300ms
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out으로 자연스러움)
- **Transform/Opacity만** 애니메이션. width/height/top/left 금지 (CLS 회피)
- **Reduced Motion**: `@media (prefers-reduced-motion: reduce)`에서 모든 transition `0.01ms`로 단축
- **투표 결과 막대**: 200ms width transition (단, reduced-motion에서는 즉시)

---

## 10. Accessibility (필수)

- 모든 텍스트 대비 **4.5:1** 이상 (large text 3:1)
- 키보드 탐색 가능: Tab 순서가 시각 순서와 일치
- 포커스 링: 3px `--color-ring`, offset 2px (브라우저 기본 outline 제거 시 반드시 대체)
- 아이콘만 있는 버튼: `aria-label` 필수
- 차트: `role="img"` + `aria-label="요약 한 줄"` + 데이터 테이블 토글
- 폼 에러: 필드 아래에 표시 + `aria-live="polite"` 영역에 요약 announcement
- 다이내믹 텍스트 사이즈: rem 단위 사용, 200% 줌까지 깨지지 않음
- 색맹 대응: 의미 전달 시 색 + 아이콘 + 라벨 3중 코딩

---

## 11. Next.js Stack Rules (App Router)

> **중요**: `AGENTS.md`의 "This is NOT the Next.js you know" 규칙. 코드 작성 전 `node_modules/next/dist/docs/` 확인.

| 규칙 | Do | Don't |
|------|----|-------|
| 라우팅 | `app/` 디렉토리 + `page.tsx` | `pages/` 디렉토리 |
| 메타데이터 (정적) | `export const metadata = {...}` | `<head>` 태그 수동 |
| 메타데이터 (동적) | `export async function generateMetadata({ params })` | 하드코딩 |
| 클라이언트 컴포넌트 | `'use client'` 명시 (이벤트 핸들러/훅 필요시) | 서버 컴포넌트에 useState |
| API | `app/api/.../route.ts` + `export async function GET/POST` | `pages/api/` |
| 데이터 페칭 | Server Component에서 `await fetch` | useEffect로 fetch |
| 폰트 | `next/font` 또는 CDN preload | `<link>` 직접 (성능 손해) |

**SEO 우선 페이지** (반드시 Server Component + generateMetadata):
- `/judges/[id]` — 판사 상세
- `/courts/[id]` — 법원 상세
- `/news` — 뉴스 피드
- `/about` — 소개

**Client Component로 격리**:
- 검색바 (인터랙션)
- 투표 위젯 (인터랙션 + 낙관적 UI)
- 지도 (`react-simple-maps`)
- 차트 (Recharts는 클라이언트만 동작)

---

## 12. Anti-Patterns

다음은 PansaWatch에서 **절대 사용 금지**:

- ❌ 판사 개인 별점 / 리뷰 — 법적 리스크 + 브리프와 정면 충돌
- ❌ 빨강 배경, 형광색 그라데이션 — 시빅 톤 위반
- ❌ Bento Grid Showcase, Glassmorphism — 데이터 가독성 저해
- ❌ 이모지를 아이콘으로 사용
- ❌ 광고 배너, 추천 카드, 프로모션 영역 — 비영리 포지션 위반
- ❌ 호버에서 `transform: scale()`로 레이아웃을 시프트
- ❌ `transition: all` (지정된 속성만 transition)
- ❌ 색만으로 의미 전달 (동의/비동의에 색만 쓰지 말 것)
- ❌ `placeholder`만으로 라벨 대체
- ❌ 모달/시트에 닫기 버튼 없음
- ❌ 가로 스크롤 모바일

---

## 13. Pre-Delivery Checklist

페이지/컴포넌트 PR 전 확인:

### 비주얼
- [ ] Pretendard 폰트가 로드되고 한국어가 깨지지 않음
- [ ] 색상은 §2 토큰만 사용 (인라인 hex 금지)
- [ ] 아이콘은 lucide-react 단일 세트
- [ ] 본문 line-height ≥ 1.6, `word-break: keep-all`

### 인터랙션
- [ ] 모든 클릭 가능 요소에 `cursor-pointer`
- [ ] 호버/포커스 상태가 모두 시각적으로 구분됨
- [ ] 터치 타겟 ≥ 44×44px
- [ ] 트랜지션은 transform/opacity/color만, 150-300ms

### 접근성
- [ ] 키보드만으로 모든 기능 접근 가능
- [ ] 포커스 링이 보임 (outline 제거 시 대체 필수)
- [ ] 본문/메타 텍스트 대비 4.5:1 이상
- [ ] 아이콘 버튼에 `aria-label`
- [ ] 차트에 `aria-label` + 데이터 테이블 대안

### 반응형
- [ ] 375 / 768 / 1024 / 1280에서 깨지지 않음
- [ ] 모바일에서 가로 스크롤 없음
- [ ] viewport meta 설정, 줌 비활성화 금지

### Next.js
- [ ] App Router 사용 (app/)
- [ ] `'use client'`는 필요한 leaf 컴포넌트에만
- [ ] 동적 페이지에 `generateMetadata` 구현
- [ ] 서버에서 미리 데이터를 가져오는 페이지는 SSR 활용

### 데이터 정합성
- [ ] AI 요약문에 면책 박스 표시
- [ ] 투표 결과는 "총 N명 참여"와 함께 표시
- [ ] 통계는 "운영자 의견이 아닌 자동 집계" 명시 (판사 프로필)

---

## 14. References

- [브리프 v2](../../pansawatch-project-brief-v2.md)
- 일본 saibankan-map.jp (지도 기반 탐색)
- watch.peoplepower21.org (한국 시빅테크 톤)
- OpenSecrets.org (데이터 시빅테크 정보 구조)
- ui-ux-pro-max v2.5.0 검색 결과: `product/Government Public Service`, `style/Editorial Grid`, `style/Data-Dense Dashboard`, `style/Swiss Modernism 2.0`, `color/Government Public Service`, `color/Legal Services`, `typography/Korean Modern + Financial Trust`
