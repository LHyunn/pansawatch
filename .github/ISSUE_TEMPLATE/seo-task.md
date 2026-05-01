---
name: "[SEO] 메타·sitemap·구조화 데이터"
about: title, description, OG, JSON-LD, sitemap, robots
title: "[seo] "
labels: ["agent:seo"]
---

## 작업 목표
<!-- 1-2 문장. WHY 위주. -->


## 작업 종류
- [ ] 글로벌 metadata 작성/변경 (`app/layout.tsx`)
- [ ] 페이지별 generateMetadata 추가
- [ ] sitemap.ts 생성/갱신
- [ ] robots.ts 생성/갱신
- [ ] JSON-LD 구조화 데이터 추가
- [ ] OG 이미지 (정적 / 동적)
- [ ] 검색 콘솔 verification (Google / 네이버 / Bing)

## 영향 받는 파일 (예상)
- `app/layout.tsx`
- `app/**/page.tsx` (generateMetadata)
- `app/sitemap.ts` / `app/robots.ts`
- `app/opengraph-image.tsx`

## 메타 카피 (Content 세션 협업)
- title: 
- description: 

## JSON-LD 타입 (해당 시)
- [ ] Organization
- [ ] BreadcrumbList
- [ ] Person
- [ ] NewsArticle
- [ ] GovernmentOrganization

## 시빅 톤 점검 (메타 카피)
- [ ] 운영자 평가·의견 없음
- [ ] 낚시성·선정적 표현 없음
- [ ] 면책 의도 명시 (해당 시)

## 의존성
- 선행 issue: 없음 / #N (UI 세션의 새 페이지 생성 후 메타 추가)
- 후속 작업: Content 세션 카피 검토

## 검증
- [ ] `next build` → 메타 출력 확인
- [ ] view source 로 `<title>`, `<meta>`, `<link rel="canonical">` 확인
- [ ] JSON-LD validator 통과 (Google Rich Results Test)
- [ ] sitemap 동적 생성 (모든 동적 라우트 포함)

## 우선순위
- [ ] high
- [ ] medium
- [ ] low
