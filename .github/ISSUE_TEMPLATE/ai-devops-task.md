---
name: "[AI/DevOps] AI/ML + 인프라 작업"
about: Claude API, 프롬프트, 배포, CI/CD, 환경 변수
title: "[ai-devops] "
labels: ["agent:ai-devops"]
---

## 작업 목표
<!-- 1-2 문장. WHY 위주. -->


## 작업 영역
- [ ] AI: 새 프롬프트 / 모델 변경 / 캐싱
- [ ] AI: 토큰·비용 추적
- [ ] DevOps: GitHub Actions 워크플로우
- [ ] DevOps: Vercel 배포 설정
- [ ] DevOps: 환경 변수 / secrets 관리
- [ ] DevOps: 모니터링 / 알림
- [ ] DevOps: Supabase 설정

## 영향 받는 파일 (예상)
- `lib/ai/...`
- `.github/workflows/...`
- `next.config.ts` / `vercel.json`
- `.env.example` / `docs/env-vars.md`

## 모델 선택 (AI 작업 시)
- [ ] Claude Haiku 4.5 (저비용·고속)
- [ ] Claude Sonnet 4.6 (긴 컨텍스트)
- [ ] Claude Opus 4.7 (사용 자제 — 명시적 사용자 승인 필요)

## 비용 추정 (해당 시)
- 월간 호출 수: 
- 입력 토큰 평균: 
- 출력 토큰 평균: 
- 월 USD: 

## 환경 변수 추가 필요 (있다면)
- 변수 명: 
- 위치: GitHub Secrets / Vercel env / Supabase Vault
- 누가 설정: 사용자 / 본 세션

## 의존성
- 선행 issue: 없음 / #N
- 후속 작업: 

## 검증
- [ ] secrets 코드에 하드코딩 X
- [ ] 캐싱 / 토큰 추적 적용
- [ ] dry-run / preview 환경에서 검증
- [ ] CI 실행 시간 합리적

## 우선순위
- [ ] high
- [ ] medium
- [ ] low
