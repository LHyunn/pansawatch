---
name: "[Backend] API/서버 작업"
about: Route Handlers·인증·입력 검증·Supabase 클라이언트
title: "[backend] "
labels: ["agent:backend"]
---

## 작업 목표
<!-- 1-2 문장. WHY 위주. -->


## 영향 받는 파일 (예상)
- `app/api/...`
- `lib/supabase/...`
- `lib/schemas/...`
- `middleware.ts`

## 엔드포인트 사양 (해당 시)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/... | ... |

### 입력 스키마 (zod)
```ts
```

### 출력 스키마
```ts
```

## 인증 / 권한
- [ ] anon (공개)
- [ ] authenticated (로그인 필요)
- [ ] admin (운영자만)
- [ ] RLS 에 위임 (별도 권한 검증 X)

## 의존성
- 선행 issue: 없음 / #N (DB 스키마 변경 필요 등)
- 후속 작업: UI 세션이 호출 코드 추가 필요 / 없음

## 검증
- [ ] `npx tsc --noEmit` 통과
- [ ] curl 또는 fetch 로 정상 케이스 검증
- [ ] 잘못된 입력 → 400
- [ ] 미인증 접근 → 401
- [ ] 권한 없음 → 403

## 우선순위
- [ ] high
- [ ] medium
- [ ] low
