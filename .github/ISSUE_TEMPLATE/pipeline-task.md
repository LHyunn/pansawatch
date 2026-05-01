---
name: "[Pipeline] 데이터 수집·매칭"
about: 크롤러, 매칭 로직, 새 데이터 소스 추가
title: "[pipeline] "
labels: ["agent:pipeline"]
---

## 작업 목표
<!-- 1-2 문장. WHY 위주. -->


## 작업 종류
- [ ] 새 데이터 소스 추가
- [ ] 기존 크롤러 변경
- [ ] 매칭 로직 개선
- [ ] AI 요약 프롬프트 변경
- [ ] 중복 제거 / 정규화 룰
- [ ] 모니터링 / 알림

## 영향 받는 파일 (예상)
- `scripts/crawlers/...`
- `lib/pipeline/...`
- `docs/data-sources.md`
- `docs/crawler-spec/...`

## 데이터 소스 (새 소스 추가 시)
- URL: 
- 인증: API key / 무료 / 협약 / 없음
- robots.txt 결과: 
- 라이선스: 
- 일별 호출 한도: 
- 한국어 처리: 

## 법적 검토 필요
- [ ] 새 데이터 소스 → Legal 세션 별도 issue 로 escalate
- [ ] 개인정보 가능성 (사건 당사자 이름 등)
- [ ] 저작권 검토 필요
- [ ] 해당 없음

## DB 스키마 변경 필요
- [ ] 새 컬럼·테이블 → DB 세션에 별도 issue
- [ ] 변경 없음

## 비용 추정 (해당 시)
- Claude API: 월 약 $X
- 인프라: 월 약 $Y

## 의존성
- 선행 issue: 없음 / #N (DB 스키마, AI 프롬프트 등)
- 후속 작업: 

## 검증
- [ ] dry-run (10건 한정) 성공
- [ ] robots.txt 준수 확인
- [ ] rate limit 보수적 (초당 1 req 이하)
- [ ] 저작권 회피 (기사 본문 미저장)

## 우선순위
- [ ] high
- [ ] medium
- [ ] low
