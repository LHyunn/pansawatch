---
name: "[UI] Frontend 작업"
about: 컴포넌트·페이지·차트·스타일·접근성 변경
title: "[ui] "
labels: ["agent:ui"]
---

## 작업 목표
<!-- 1-2 문장. WHY 위주. -->


## 영향 받는 파일 (예상)
<!-- 정확한 경로. 다른 도메인 파일은 포함 X -->
- `components/...`
- `app/...`

## 디자인 / 톤 제약
- [ ] civic 팔레트 (navy / civic / seal) 만 사용
- [ ] 한국어 word-break 유지
- [ ] 카드 일관성 (line-clamp + min-h)
- [ ] 시빅 톤 (운영자 의견 X)

## 접근성 요구
- [ ] WCAG 2.1 AA
- [ ] 키보드 가능성
- [ ] 차트는 title+desc+표 fallback

## 의존성
- 선행 issue: 없음 / #N
- 후속 작업: 없음 / Content 세션 카피 검토 필요 / SEO 세션 메타 갱신 필요

## 검증
- [ ] `npx tsc --noEmit` 통과
- [ ] dev 서버 시각 확인 (모바일 + 데스크탑)
- [ ] 콘솔 에러 0

## 우선순위
- [ ] high
- [ ] medium
- [ ] low
