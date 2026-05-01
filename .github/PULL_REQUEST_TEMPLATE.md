<!--
이 PR 은 PansaWatch 의 에이전트 세션 워크플로우를 따릅니다.
한 PR = 한 도메인 = 한 세션. 다른 도메인 영역을 함께 변경하지 마세요.
-->

## 담당 세션

<!-- 본 PR 을 작성한 세션을 체크 (단 하나) -->

- [ ] `agent:ui` — UX/UI/Frontend
- [ ] `agent:backend` — Backend/API
- [ ] `agent:db` — Database
- [ ] `agent:pipeline` — Data Pipeline
- [ ] `agent:ai-devops` — AI/ML + DevOps
- [ ] `agent:content` — Content
- [ ] `agent:legal` — Legal
- [ ] `agent:seo` — SEO
- [ ] `agent:pm` — PM Orchestrator (메타·인프라만)

## 연관 issue

Closes #
<!-- 또는: Refs #N -->

## 변경 요약

<!-- 1-3 문장. WHY 위주. WHAT 은 diff 가 보여줍니다. -->


## 변경 파일 도메인 검증

- [ ] 변경된 모든 파일이 위에 체크한 세션의 담당 영역 내에 있음
- [ ] 다른 도메인 파일을 수정해야 했다면 → 해당 세션에 별도 issue 만들고 본 PR 에서 제외함
- [ ] `.github/CODEOWNERS` 또는 `.github/labeler.yml` 에서 도메인 매핑 확인함

## 시빅 원칙 자기-점검

(사용자 노출 콘텐츠 변경이 있을 경우만)

- [ ] 운영자 평가·의견 표현 없음
- [ ] "판사를 평가" 식 카피 없음 → "판결 단위" 표현
- [ ] AI 생성물에 ※ 디스클레이머 부착
- [ ] 출처 링크 명시 (외부는 `rel="noopener noreferrer"`)
- [ ] 정정 요청 절차 안내 (해당 시)

## 검증 결과

<!-- 도메인별로 다름 — 적용되는 것만 -->

- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 성공
- [ ] 로컬 dev 서버에서 동작 확인
- [ ] DB 변경 시: `db reset + seed` 무결성 위반 0
- [ ] 크롤러 변경 시: dry-run (10건) 성공
- [ ] AI 변경 시: 토큰·비용 추정 첨부

## 의존성 / 후속 작업

<!-- 다른 세션이 후속으로 작업해야 할 것 -->
- (없으면 "없음")

## 면책 / 법적 검토 필요?

- [ ] 사용자 노출 카피 신규/수정 → Legal 세션 검토 요청 필요
- [ ] 새 데이터 소스 → Legal 세션 검토 요청 필요
- [ ] 개인정보 컬럼 추가 → Legal 세션 검토 요청 필요
- [ ] 해당 없음

---

🤖 본 PR 은 Claude Code 의 PansaWatch 도메인 세션에서 생성되었습니다.
PM Orchestrator 세션이 검토 후 머지합니다.
