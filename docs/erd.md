# PansaWatch — ERD

Phase 2 (Supabase Postgres) 진입 전 청사진. 8개 테이블 + 4개 view.

## 핵심 관계도 (Mermaid erDiagram)

```mermaid
erDiagram
    courts ||--o{ judges : "has (RESTRICT)"
    judges ||--o{ cases : "decides (RESTRICT)"
    judges ||--o{ judge_articles : "linked (CASCADE)"
    articles ||--o{ judge_articles : "linked (CASCADE)"
    cases ||--o{ case_votes : "voted on (CASCADE)"
    articles ||--o{ article_votes : "voted on (CASCADE)"
    users ||--o{ case_votes : "casts (SET NULL)"
    users ||--o{ article_votes : "casts (SET NULL)"
    auth_users ||--|| users : "mirror (CASCADE)"

    courts {
        text id PK
        text name
        court_type type "supreme/high/district/family/administrative"
        text region
        text address
        double latitude
        double longitude
        integer judge_count "denormalized cache"
        timestamptz created_at
        timestamptz updated_at
    }

    users {
        uuid id PK "= auth.users.id"
        text auth_provider "google or kakao"
        timestamptz created_at
    }

    judges {
        text id PK
        text name
        text court_id FK
        text court "denormalized"
        text court_region "denormalized"
        text position
        integer appointment_year
        text career_summary
        text photo_url "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    articles {
        text id PK
        text title
        text url "external"
        text source
        timestamptz published_at
        text ai_summary
        timestamptz collected_at
    }

    cases {
        text id PK
        text case_number "trgm indexed"
        text court
        text judge_id FK
        case_type case_type "민사/형사/행정/가사"
        date decision_date
        text ai_summary
        text source_url
        text decision_result
        boolean is_appealed
        text appeal_result "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    judge_articles {
        text id PK
        text judge_id FK
        text article_id FK
        double relevance_score "0~1"
    }

    case_votes {
        text id PK
        uuid user_id FK "nullable (mock seed)"
        text case_id FK
        vote_category vote_category "decision_agreement / sentencing_fairness"
        vote_value vote_value "agree/disagree/appropriate/too_light/too_heavy"
        timestamptz created_at
    }

    article_votes {
        text id PK
        uuid user_id FK "nullable"
        text article_id FK
        article_vote_type vote_type "useful / not_useful"
        timestamptz created_at
    }

    auth_users {
        uuid id PK "Supabase auth.users"
    }
```

## 무결성 / 제약 요약

| 테이블 | 핵심 제약 |
|-------|----------|
| `courts` | `CHECK (judge_count >= 0)` |
| `judges` | `CHECK (appointment_year BETWEEN 1900 AND 2100)`, FK courts RESTRICT |
| `cases` | `CHECK (is_appealed = true OR appeal_result IS NULL)`, FK judges RESTRICT |
| `judge_articles` | `UNIQUE(judge_id, article_id)`, `CHECK (relevance_score BETWEEN 0 AND 1)`, FK CASCADE |
| `case_votes` | category-value 정합 CHECK, `UNIQUE(user_id, case_id, vote_category)` (1인 1투표) |
| `article_votes` | `UNIQUE(user_id, article_id)` |
| `users` | FK auth.users CASCADE, `CHECK (auth_provider IN ('google','kakao'))` |

## 집계 view

```mermaid
flowchart LR
    case_votes -->|GROUP BY case_id, category, value| v_case_vote_summary
    case_votes -->|JOIN cases, decision_agreement only| v_judge_agreement
    cases -->|항소/파기 집계| v_judge_appeal
    article_votes -->|GROUP BY article_id| v_article_vote_summary
```

| View | 역할 | 매핑 헬퍼 |
|------|------|----------|
| `v_case_vote_summary` | 판례 x 카테고리 x 값 카운트 | `getCaseVoteSummary` |
| `v_judge_agreement` | 판사별 시민 동의율 (투표 단위) | `getJudgeAgreementRate` |
| `v_judge_appeal` | 판사별 항소/파기 카운트 + 파기율 | `getJudgeAppealRate` (부분) |
| `v_article_vote_summary` | 기사별 useful/not_useful 카운트 | `getArticleVoteSummary` |

## RLS 정책 요약

```mermaid
flowchart TB
    subgraph public_read["공개 읽기 (anon + authenticated)"]
        courts2[courts]
        judges2[judges]
        articles2[articles]
        cases2[cases]
        judge_articles2[judge_articles]
        case_votes_r[case_votes SELECT]
        article_votes_r[article_votes SELECT]
    end

    subgraph self_only["본인 행만 (authenticated, auth.uid)"]
        users3[users SELECT]
        case_votes_w[case_votes INSERT/UPDATE/DELETE]
        article_votes_w[article_votes INSERT/UPDATE/DELETE]
    end

    subgraph service_role["service_role only (서버 시드/관리)"]
        all_writes[모든 쓰기 — courts/judges/articles/cases/judge_articles]
    end
```

## 인덱스 맵

```mermaid
flowchart LR
    subgraph articles_idx[articles]
        idx_articles_published_at
        idx_articles_source
    end
    subgraph judges_idx[judges]
        idx_judges_court
    end
    subgraph cases_idx[cases]
        idx_cases_judge_decision
        idx_cases_number_trgm["idx_cases_number_trgm (GIN)"]
    end
    subgraph ja_idx[judge_articles]
        idx_judge_articles_judge
        idx_judge_articles_article
    end
    subgraph cv_idx[case_votes]
        idx_case_votes_case_category
        idx_case_votes_user["idx_case_votes_user (partial)"]
    end
    subgraph av_idx[article_votes]
        idx_article_votes_article
        idx_article_votes_user["idx_article_votes_user (partial)"]
    end
```
