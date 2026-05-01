# PansaWatch 전담 세션 프롬프트

각 카테고리별로 **별도 Claude Code 세션**을 열어 해당 영역만 관리하도록 설계된 역할 부여 프롬프트입니다.
새 세션을 시작할 때 해당 파일 내용을 그대로 첫 메시지로 붙여넣으면 됩니다.

## 세션 목록

| # | 세션 | 파일 | 핵심 책임 |
|---|------|------|----------|
| **0** | **PM Orchestrator** ⭐ | [`00-pm-orchestrator.md`](00-pm-orchestrator.md) | issue/PR 관리·검토·머지·조율 |
| 1 | UX + UI/Design + Frontend | [`01-ui-frontend.md`](01-ui-frontend.md) | 컴포넌트·페이지·차트·스타일·접근성 |
| 2 | Backend / API | [`02-backend-api.md`](02-backend-api.md) | Route Handlers·인증·입력 검증 |
| 3 | DB | [`03-db.md`](03-db.md) | Postgres 스키마·RLS·마이그레이션 |
| 4 | Data Pipeline | [`04-data-pipeline.md`](04-data-pipeline.md) | 크롤러·매칭·중복 제거 |
| 5 | AI/ML + DevOps | [`05-ai-devops.md`](05-ai-devops.md) | Claude API·프롬프트·배포·CI |
| 6 | Content | [`06-content.md`](06-content.md) | 사용자 노출 카피·정책 문서 |
| 7 | Legal | [`07-legal.md`](07-legal.md) | 법적 검토·개인정보·라이선스 |
| 8 | SEO | [`08-seo.md`](08-seo.md) | 메타·sitemap·구조화 데이터 |

⭐ **PM Orchestrator 는 항상 첫 번째로 엽니다.** 다른 세션은 PM 이 만든 issue 를 받아 작업합니다.

---

## 사용 흐름

```
┌──────────────────────────────────────────────────────────────┐
│ 1. 사용자 → PM 세션 (00) 에서 요청                              │
│    "Phase 2 진입하자"                                          │
│                                                                │
│ 2. PM → 작업 분해 + gh issue create (5개)                      │
│    #10 [agent:db]  users 테이블 + auth 트리거                  │
│    #11 [agent:backend] lib/supabase 클라이언트                 │
│    #12 [agent:backend] lib/data.ts → Supabase 전환             │
│    #13 [agent:ui] 인증 UI                                      │
│    #14 [agent:ai-devops] Vercel 배포                           │
│                                                                │
│ 3. 사용자 → DB 세션 (03) 새로 열기 → #10 작업                  │
│    branch: agent/db/users-auth-trigger                         │
│    push + gh pr create → 자동 라벨 agent:db                    │
│                                                                │
│ 4. 사용자 → PM 세션 으로 돌아옴 → "PR 검토 부탁"               │
│    PM: gh pr diff + 경계 검사 + CI 확인 → approve + merge      │
│    issue #10 close, #11 unblock                                │
│                                                                │
│ 5. 사용자 → Backend 세션 (02) 열기 → #11 작업                  │
│    ...반복                                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## GitHub 통합

이 세션 시스템은 GitHub repo 위에서 동작합니다.

### 인프라 파일 (`.github/`)
- `CODEOWNERS` — 경로 → 담당 세션 매핑 (advisory)
- `labeler.yml` — PR path 변경 → 자동 `agent:*` 라벨
- `PULL_REQUEST_TEMPLATE.md` — 에이전트 자기-점검 체크리스트
- `ISSUE_TEMPLATE/` — 도메인별 issue 템플릿
- `labels.yml` — 표준 라벨 manifest
- `workflows/ci.yml` — typecheck + build (PR 머지 게이트)
- `workflows/labeler.yml` — auto-label workflow

### 브랜치 컨벤션
- `main` — 보호 브랜치 (직접 push 금지, PR + CI green 필수)
- `agent/<role>/<short-task>` — 도메인 세션의 작업 브랜치
  - 예: `agent/db/users-auth-trigger`, `agent/ui/judge-card-redesign`

### 라벨 체계
- `agent:ui`, `agent:backend`, `agent:db`, `agent:pipeline`, `agent:ai-devops`, `agent:content`, `agent:legal`, `agent:seo`
- `phase:1`, `phase:2`, `phase:3`, `phase:5`
- `priority:high`, `priority:medium`, `priority:low`
- `status:in-progress`, `status:review`, `status:blocked`
- `type:feature`, `type:bug`, `type:refactor`, `type:docs`

---

## 세션 별 주요 파일 매트릭스

```
파일                                      | UI | API | DB | Pipe | DevOps | Cont | Legal | SEO |
------------------------------------------|----|----|----|------|--------|------|-------|-----|
app/**/page.tsx                           | ●  |    |    |      |        | △    | △     | △   |
components/**/*.tsx                       | ●  |    |    |      |        | △    |       |     |
app/api/**/route.ts                       |    | ●  |    |      |        |      |       |     |
lib/data.ts (Phase1)                      | △  | △  | △  |      |        |      |       |     |
lib/supabase/*.ts (Phase2+)               |    | ●  |    |      |        |      |       |     |
db/**/*.sql                               |    |    | ●  |      |        |      |       |     |
db/seed.ts                                |    |    | ●  | △    |        |      |       |     |
scripts/crawlers/**/*.ts (Phase3+)        |    |    |    | ●    |        |      |       |     |
docs/data-sources.md                      |    |    |    | ●    |        |      | △     |     |
docs/pipeline-architecture.md             |    |    |    | ●    | △      |      |       |     |
docs/ai-pipeline.md                       |    |    |    | △    | ●      |      |       |     |
.github/workflows/*.yml                   |    |    |    |      | ●      |      |       |     |
app/layout.tsx (metadata)                 | △  |    |    |      |        |      |       | ●   |
app/sitemap.ts / app/robots.ts            |    |    |    |      |        |      |       | ●   |
사용자 노출 텍스트 (모든 위치)             | △  |    |    |      |        | ●    | ●     |     |
docs/policy.md / 약관 / 개인정보          |    |    |    |      |        | ●    | ●     |     |

● 주 담당  △ 협업 가능 (인터페이스 합의 필요)
```

---

## 세션 간 협업 원칙

- **단방향 의존**: DB → Backend → UI, Pipeline → DB. 역방향 변경은 PM 가 issue 분해.
- **인터페이스 합의**: 한 세션이 다른 세션 영역을 변경해야 하면 → 인터페이스(타입·DDL·API 스키마) 만 합의하고 구현은 담당 세션에 위임.
- **공통 참조**: 모든 세션은 `pansawatch-project-brief-v2.md` + `AGENTS.md` 를 진실의 원천으로 삼습니다.
- **충돌 방지**: 같은 파일을 동시 두 세션이 편집하지 않도록 PM 가 의존성 직렬화.

---

## 사전 준비

PM 세션이 동작하려면 `gh` CLI 가 필요합니다:

```bash
# Windows
winget install --id GitHub.cli

# 인증 (한 번만)
gh auth login
```

브랜치 보호 (main 강제 PR + CI green):
- `gh repo edit --enable-auto-merge` (선택)
- GitHub 웹 → Settings → Branches → main → Protect
  - Require pull request before merging ✅
  - Require status checks (ci) ✅
  - Require branches to be up to date ✅

---

## 주의 사항

- 각 세션은 **다른 세션의 작업을 모릅니다**. 이전 대화 컨텍스트를 가정하지 말고 모든 상황을 명시적으로 기술하세요.
- 세션 간 동시 편집은 **머지 충돌 위험**. PM 가 의존성 순서로 직렬화.
- 모든 세션은 `pansawatch-project-brief-v2.md` 룰을 준수합니다 (운영자 의견 게시 금지, 판결 단위 투표, 면책 의무).
- PM 은 **코드 직접 작성 금지** — 항상 도메인 세션에 위임.
