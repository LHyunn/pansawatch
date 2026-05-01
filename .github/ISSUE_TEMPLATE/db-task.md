---
name: "[DB] 마이그레이션/RLS/시드"
about: PostgreSQL 스키마 진화, RLS 정책, 시드 스크립트
title: "[db] "
labels: ["agent:db"]
---

## 작업 목표
<!-- 1-2 문장. WHY 위주. -->


## 변경 종류
- [ ] 새 테이블
- [ ] 컬럼 추가/변경
- [ ] 인덱스
- [ ] ENUM 추가/변경
- [ ] RLS 정책
- [ ] 트리거 / 함수
- [ ] 시드 데이터
- [ ] view / 집계 함수

## 영향 받는 파일 (예상)
- `db/migrations/000N_<description>.sql` (새 파일)
- `db/policies.sql` (RLS 갱신 시)
- `docs/db-decisions.md` (결정 기록)
- `docs/erd.md` (ERD 갱신)
- `db/seed.ts` (시드 변경 시)

## 결정 필요 사항
<!-- docs/db-decisions.md 에 기록할 항목 -->
- 

## lib/types.ts 와 동기화 필요
- [ ] 새 인터페이스 추가
- [ ] 기존 인터페이스 변경
- [ ] 변경 없음 (Backend 세션 핑 불필요)

## 의존성
- 선행 issue: 없음 / #N
- 후속 작업: Backend 세션이 클라이언트 코드 갱신 / Pipeline 세션이 INSERT 로직 갱신

## 검증
- [ ] 빈 Postgres 에 schema.sql + policies.sql 적용 → 오류 0
- [ ] seed.ts 실행 → 무결성 위반 0
- [ ] RLS 정책 작동 확인 (anon SELECT, authenticated INSERT 본인만 등)
- [ ] 마이그레이션 idempotent (두 번 실행 안전)

## 우선순위
- [ ] high
- [ ] medium
- [ ] low
