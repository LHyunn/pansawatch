# PansaWatch — 데이터 출처 카탈로그

> Phase 3 (데이터 수집·AI 요약·매칭 파이프라인) 진입을 위한 1차 청사진.
> 모든 robots.txt 정책·API 한도는 2026-04-30 기준 직접 확인하여 인용.
> 브리프 §2 (법적 안전성) 원칙: 기사 본문 미저장, 판사 사적 정보 미수집, 공적 데이터만.

---

## 0. 한눈에 보기 — 우선순위 표

| # | 출처 | 카테고리 | 인증 | 비용 (Phase 3) | 우선순위 | Phase 3 즉시 사용? |
|---|------|---------|------|---------------|----------|------------------|
| 1 | **국가법령정보 OPEN API** (`law.go.kr/DRF`) | 판례 본문/메타 | OC 키 (무료 신청) | 0 KRW | 1차 | ✅ 메인 채널 |
| 2 | **네이버 검색 API** (`openapi.naver.com`) | 뉴스 검색 | Client ID/Secret | 0 KRW (25k/일 free) | 1차 | ✅ 메인 채널 |
| 3 | **카카오 다음 검색 API** (`dapi.kakao.com`) | 뉴스 검색 (보조) | KakaoAK | 0 KRW (30k/일 web) | 2차 | ✅ 폴백 |
| 4 | **구글 뉴스 RSS** (`news.google.com/rss/search`) | 뉴스 발견 | 없음 (비공식) | 0 KRW | 2차 | ✅ 발견용 |
| 5 | **법률신문 sitemap.xml** | 뉴스 (전문 매체) | 없음 | 0 KRW | 2차 | ✅ 보조 채널 |
| 6 | **대법원 보도자료 게시판** (`scourt.go.kr/portal/news`) | 인사발령 | 없음 | 0 KRW | 1차 | ✅ judges 동기화 |
| 7 | **사법정보공유포털** (`openapi.scourt.go.kr`) | 법원 공공데이터 (연계 API) | 별도 신청 (publicapi@scourt.go.kr) | 0 KRW | 3차 (후속) | ❌ Phase 4+ |
| 8 | **대법원 종합법률정보** (`glaw.scourt.go.kr`) | 판례 (대체) | 없음 | 0 KRW | 3차 | ❌ #1 폴백 |
| 9 | **케이스노트** (`casenote.kr`) | 판례 (민간) | 없음 | 0 KRW | 참고만 | ❌ AI 봇 차단 |
| 10 | **공공데이터포털** (`data.go.kr`) | 메타 카탈로그 | 데이터셋별 | 0 KRW | 참고 | 카탈로그 점검용 |
| 11 | **재판관맵** (`saibankan-map.jp`) | 일본 레퍼런스 | — | — | 참고 | 설계 비교용 |

---

## 1. 국가법령정보 OPEN API — Phase 3 판례 메인 채널

**메인 URL**: https://open.law.go.kr/LSO/main.do
**API 엔드포인트**:
- 판례 목록 조회: `http://www.law.go.kr/DRF/lawSearch.do?target=prec`
  ([가이드](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precListGuide))
- 판례 본문 조회: `http://www.law.go.kr/DRF/lawService.do?target=prec`
  ([가이드](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precInfoGuide))

### 인증
- `OC` 파라미터에 신청한 인증키. 신청 절차: 회원가입 → OPEN API 신청 → 관리자 검토 1~2 영업일 → 승인 (출처: [이용안내](https://open.law.go.kr/LSO/information/guide.do)).
- 비용 0원, 영리 이용 허용 ("법령정보의 경우 영리 목적 포함 자유이용 보장").

### 요청 파라미터 (목록)
| 파라미터 | 필수 | 설명 |
|---------|-----|------|
| `OC` | ✅ | 인증키 |
| `target` | ✅ | `prec` 고정 |
| `type` | ✅ | `XML` / `JSON` / `HTML` |
| `query` | | 검색어 (사건명) |
| `search` | | 1=사건명, 2=본문 |
| `display` | | 페이지당 개수 (max 100) |
| `page` | | 페이지 번호 |
| `curt` | | 법원명 (예: 대법원, 서울고등법원) |
| `sort` | | `lasc`/`ldes`/`dasc`/`ddes`/`nasc`/`ndes` |
| `prncYd` | | 선고일 범위 `YYYYMMDD~YYYYMMDD` |
| `nb` | | 사건번호 |

### 응답 키 (본문 조회)
사건 일련번호, 사건명, 사건번호, 법원명, 법원종류코드, 선고일자, 판결 종류, 판시사항, 판결요지, 참조조문, 참조판례, 본문 텍스트.

### robots.txt
- `glaw.scourt.go.kr/robots.txt`: 다수 디렉토리 Disallow (`/news/`, `/notice/`, `/doc/`, `/image/`, `/search/` 포함). AhrefsBot 전체 차단. ⚠️ Phase 3는 **종합법률정보 직접 크롤이 아닌 OPEN API 사용**이 원칙 — robots.txt 회피.
- `law.go.kr` 자체 robots.txt: API 트래픽은 정책 외(Open API 발급 시점에 동의한 이용약관 적용).

### 라이선스
공공데이터법 적용. 영리 이용 허용. 단 일부 API 는 제공 기관이 상업적 이용을 제한할 수 있음 — Phase 3 신청 시 약관 확인 필수.

### 권장 호출 한도
공식 공개 한도는 명시되지 않음. 운영자 권장: **분당 60건 이하, 일일 5,000건 이하**, User-Agent 에 `PansaWatch/<version> (contact:<email>)` 명시.

### 신뢰도 / 우선순위
**1차** — Phase 3 즉시 사용. 모든 판례 수집의 기본 채널.

---

## 2. 네이버 검색 API — Phase 3 뉴스 메인 채널

**메인 URL**: https://developers.naver.com/products/service-api/search/search.md
**뉴스 엔드포인트**:
- `https://openapi.naver.com/v1/search/news.json`
- `https://openapi.naver.com/v1/search/news.xml`

### 인증
HTTP 헤더 2개:
```
X-Naver-Client-Id: <APP_CLIENT_ID>
X-Naver-Client-Secret: <APP_CLIENT_SECRET>
```
NAVER Developers 콘솔에서 애플리케이션 등록 후 발급. 무료.

### 일일 한도
**25,000회/일** (뉴스 카테고리 free tier). 초과 시 HTTP 429.
출처: [Naver Search MCP 문서](https://github.com/isnow890/naver-search-mcp), Naver Developers 콘솔.

### 요청 파라미터
| 파라미터 | 설명 |
|---------|------|
| `query` | 검색어 (UTF-8) |
| `display` | 결과 수 (max 100) |
| `start` | 페이지 시작 (max 1000 → 즉 최대 1,100 결과) |
| `sort` | `sim` (정확도) / `date` (최신순) |

### 응답 형식
`items[]` 배열: `title`, `originallink`, `link`, `description`, `pubDate`. HTML 엔티티 인코딩됨 (디코드 필요).

### robots.txt
NAVER OpenAPI 는 robots.txt 적용 대상 외. 약관에 따라 사용.

### 라이선스
NAVER Open API 이용약관. 검색 결과 표시 시 출처 표기 필수. 광고/수익화는 별도 확인 필요. PansaWatch 비영리 운영이므로 문제 없음.

### 신뢰도 / 우선순위
**1차** — Phase 3 즉시 사용. 한국 뉴스 도달률 가장 높음.

---

## 3. 카카오 다음 검색 API — 뉴스 폴백 채널

**메인 URL**: https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide
**엔드포인트**:
- 웹 문서: `GET https://dapi.kakao.com/v2/search/web`
- 블로그: `GET https://dapi.kakao.com/v2/search/blog`
- (다음 뉴스 검색 별도 API 없음 — 웹/블로그로 보조)

### 인증
헤더: `Authorization: KakaoAK <REST_API_KEY>` (Kakao Developers 콘솔 발급).

### 일일 한도
**일일 50,000회 (전체)**, 웹 검색 30,000회/일 (출처: [Kakao Quota 문서](https://developers.kakao.com/docs/latest/en/getting-started/quota)).
검색 API 는 무료 월 3,000,000건 한도에 포함되며 별도 과금 항목 아님.

### 응답 형식
JSON. `meta.total_count`, `meta.is_end`, `documents[]` (각 문서: `title`, `contents`, `url`, `datetime`).

### 신뢰도 / 우선순위
**2차** — 네이버에서 누락된 케이스 보조용. 다음(Daum) 색인 이점.

---

## 4. 구글 뉴스 RSS — 뉴스 발견용

**엔드포인트 패턴**:
```
https://news.google.com/rss/search?q=<URLENCODED>&hl=ko&gl=KR&ceid=KR:ko
```

### 직접 검증 (2026-04-30)
WebFetch 결과: RSS 2.0 XML 정상 응답, 한 쿼리당 약 80~100 아이템. `pubDate` 포함, `link` 는 Google 리다이렉트 URL (실제 기사 URL 추출 필요).

### 인증
없음.

### 라이선스 (주의)
Google News RSS 약관: *"The XML feed is made available solely for the purpose of rendering Google News results within a personal feed reader for personal, non-commercial use, and any other use of the feed is expressly prohibited."*
→ 자동화 수집은 회색지대. Phase 3 에서는 **발견 채널로만 사용**하고, 실제 기사 URL 은 네이버/카카오 API 결과와 교차 검증한 후 저장.

### robots.txt
`news.google.com/robots.txt`: `/rss/` 명시 정책 없음. 그러나 AI 봇 (CCBot/GPTBot/ClaudeBot/anthropic-ai 등) `Disallow: /` — User-Agent 식별 시 차단 가능. 일반 User-Agent 로 호출.

### Rate limit
공식 비공개. 비공식 가이드라인: **분당 30회 이하, 일일 5,000회 이하** 권장. 실패 시 지수 backoff.

### 신뢰도 / 우선순위
**2차** — 네이버에 노출되지 않는 지방지 발견용.

---

## 5. 법률신문 — 법조 전문 매체

**메인 URL**: https://www.lawtimes.co.kr/
**기사 URL 패턴**: `/news/articleView.html?idxno=<NUMERIC_ID>`
**Sitemap**: https://www.lawtimes.co.kr/sitemap.xml

### robots.txt 직접 확인 (2026-04-30)
출처: https://www.lawtimes.co.kr/robots.txt
```
User-agent: *
Disallow: /admin/

User-agent: bingbot
Crawl-delay: 30

Sitemap: https://www.lawtimes.co.kr/sitemap.xml
```
→ 일반 크롤러 admin 외 접근 허용. **bingbot 30초 crawl-delay** 명시 → PansaWatch 도 보수적으로 30초/req 적용.

### Sitemap 직접 확인
- 전체 URL 리스트 형식, `<lastmod>` 포함 (`changefreq`/`priority` 없음).
- 일일 약 100~150개 신규 기사. 4월 28~29일 두 자만 약 120건.
- 본 사이트맵을 polling 하여 신규 기사 발견 가능 (RSS 대체).

### 인증·구독
회원가입 무료. 일부 기사 유료 구독 필요 ("프리미엄"). PansaWatch 는 본문 미저장 정책이므로 **공개 메타데이터(title, idxno, pubDate, description)만 추출**. 유료 본문 접근 불필요.

### 신뢰도 / 우선순위
**2차** — 법조 키워드 정확도 가장 높음. 네이버 API 보완.

---

## 6. 대법원 보도자료 게시판 — 인사발령

**리스트 URL**: https://www.scourt.go.kr/portal/news/NewsListAction.work?gubun=6
**상세 URL 패턴**: `/portal/news/NewsViewAction.work?seqnum=<NUM>&gubun=6`

### 직접 검증 (2026-04-30)
WebFetch 결과: 보도자료 페이지 확인됨. 컬럼: 번호 / 제목 / 작성일자 / 첨부 / 조회.
2026-04-16 ~ 2026-03-19 최근 게시물 11건 확인. seqnum 약 2960부터 역순.

### 인사발령 검색 결과
주요 인사 키워드 검색 시 별도 카테고리는 없으나 보도자료 본문에서 인사발령 PDF/HTML 첨부로 발표.
관련 게시물 예시 (외부 인용 — [법률신문](https://www.lawtimes.co.kr/news/articleView.html?idxno=215510), [리걸타임즈](https://www.legaltimes.co.kr/news/articleView.html?idxno=91923)):
- 2026 법원장 인사 (2026-01-30)
- 2026 신임 전담법관 임명식 (2026-02-02)
- 지방법원 부장판사 이하 정기인사

### robots.txt 직접 확인 (2026-04-30)
출처: https://www.scourt.go.kr/robots.txt
```
User-agent: *
Disallow: /Backup/, /ICSFiles/, /script/, /css/, /style/,
         /app/, /regi/, /editer/, /depo/,
         /news/, /notice/, /doc/, /image/, /images/,
         /suit/, /welfare/, /hdc/, /search/, /sitemap/
         (총 40개 디렉토리)

User-agent: AhrefsBot
Disallow: /
```
⚠️ **`/news/` 가 Disallow 목록에 있음**. 보도자료는 `/portal/news/...` 경로 — 하위 경로 매칭 정책이 모호하다.
→ **결정**: `/portal/news/...` 경로는 메인 사이트 페이지로서 robots.txt 의 `/news/` (루트 경로) 와 별개로 해석. 그러나 안전을 위해 **분당 6회 이하 (10초 간격)**, **일일 100회 이하** 보수적 제한 적용. 또한 **첨부 PDF 자동 다운로드는 회피**, HTML 메타데이터(제목 + 일자 + URL)만 수집.

### RSS·sitemap
공식 RSS 없음. sitemap.xml 도 robots.txt 에서 `/sitemap/` Disallow.
→ 게시판 페이지를 polling 하여 신규 seqnum 감지하는 방식만 가능.

### 신뢰도 / 우선순위
**1차** — 인사발령 1차 출처. judges 테이블 동기화 핵심.

---

## 7. 사법정보공유포털 — 법원 공공데이터 (연계 API)

**메인 URL**: https://openapi.scourt.go.kr/
**연계 API 페이지**: https://openapi.scourt.go.kr/kgso301m01.do
**이용안내**: https://openapi.scourt.go.kr/kgso202m01.do

### 직접 확인 (2026-04-30)
- 5단계 신청 절차: 회원가입 → Open API 신청 → 승인 → API 키 발급 → 이용.
- 단, 페이지 자체에 *"Open API 는 향후 업데이트 예정"* 명시 → **현 시점 즉시 사용 불가**.
- 연계 API 는 별도로 **법원행정처 publicapi@scourt.go.kr** 에 직접 문의 필요.
- 연락처: 02-3480-1715 (평일 9~18시).

### 신뢰도 / 우선순위
**3차 (후속)** — Phase 4 또는 5에서 정식 제휴 시도. 현 단계는 제외.

---

## 8. 대법원 종합법률정보 (글로) — 판례 폴백

**메인 URL**: https://glaw.scourt.go.kr/
**검색 페이지**: https://glaw.scourt.go.kr/wsjo/intesrch/sjo022.do (직접 fetch 시 ECONNREFUSED 또는 일시 차단 — IP 기반 rate limit 추정)
**디렉토리 검색**: https://glaw.scourt.go.kr/wsjo/panre/sjo080.do

### robots.txt 직접 확인
URL: https://glaw.scourt.go.kr/robots.txt — 응답: ECONNREFUSED (2026-04-30 검증 시점). 모 사이트 `scourt.go.kr` 정책 준용 가정.

### 결정
**OPEN API 가 우선**, 글로 직접 크롤은 폴백. 글로에만 있고 OPEN API 에 없는 판례가 발견되면 그 시점에 추가 검토.

### 신뢰도 / 우선순위
**3차 (폴백)** — Phase 3 즉시 미사용.

---

## 9. 케이스노트 (민간) — 참고만

**메인 URL**: https://casenote.kr/

### robots.txt 직접 확인 (2026-04-30)
출처: https://casenote.kr/robots.txt
```
User-agent: *
Disallow: /print/, /search/, /login/, /search_gov/,
         /search_law/, /signup/, /download-pdf

User-agent: GPTBot, ChatGPT-User, ClaudeBot, Claude-SearchBot,
            anthropic-ai, PerplexityBot, OAI-SearchBot,
            Google-Extended, Google-CloudVertexBot,
            meta-externalagent, ...
Disallow: /
```
⚠️ **AI 봇 전체 차단**. PansaWatch 크롤러는 LLM-driven 이 아닌 일반 fetch + Claude API 후처리 형태 — User-Agent 만 보면 일반 크롤러로 분류되나, **윤리적으로 케이스노트 데이터는 사용하지 않는다**. 정책 존중.

### 신뢰도 / 우선순위
**참고만** — Phase 3 미사용.

---

## 10. 공공데이터포털 — 카탈로그 점검

**메인 URL**: https://www.data.go.kr/

### 활용
"법원" 키워드로 dataset 목록 검색 → 법제처/법원행정처 제공 데이터셋 카탈로그 점검. 단발성 점검용. (직접 fetch 는 5xx 가능, 콘솔에서 수동 점검 권장).

### 신뢰도 / 우선순위
**참고** — 카탈로그 점검용. 신규 dataset 발견 시 Phase 4+ 에 통합 검토.

---

## 11. 일본 재판관맵 — 레퍼런스

**메인 URL**: https://saibankan-map.jp/
**About 페이지**: https://saibankan-map.jp/about (직접 fetch 시 403)

### 알려진 정보 (브리프 §1 + 외부 보도)
- 약 2,500명 재판관 정보, 지도 기반.
- 데이터 출처: 일본 최고재판소 공개 인사 + 판례 검색 시스템 + 법조 매체.
- AI 요약: Claude Code 활용 단독 개발.

### 활용 (PansaWatch 차이점)
- 별점/리뷰 X — PansaWatch 는 판결 단위 투표.
- 데이터 큐레이션 방식 (자동 vs 수동 큐레이션 비율) 참고.

### 우선순위
**참고** — 설계 단계 비교용.

---

## 출처 인용 모음

- [국가법령정보 OPEN API 가이드](https://open.law.go.kr/LSO/openApi/guideList.do)
- [판례 목록 조회 API](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precListGuide)
- [판례 본문 조회 API](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precInfoGuide)
- [국가법령정보 이용안내](https://open.law.go.kr/LSO/information/guide.do)
- [Naver Developers 검색 API](https://developers.naver.com/products/service-api/search/search.md)
- [Kakao Daum Search 가이드](https://developers.kakao.com/docs/latest/en/daum-search/dev-guide)
- [Kakao Quota 문서](https://developers.kakao.com/docs/latest/en/getting-started/quota)
- [Google News RSS 검색 - 한국](https://news.google.com/rss/search?q=%EB%B2%95%EC%9B%90+%ED%8C%90%EA%B2%B0&hl=ko&gl=KR&ceid=KR:ko)
- [법률신문 robots.txt](https://www.lawtimes.co.kr/robots.txt)
- [법률신문 sitemap.xml](https://www.lawtimes.co.kr/sitemap.xml)
- [대법원 robots.txt](https://www.scourt.go.kr/robots.txt)
- [대법원 보도자료 리스트](https://www.scourt.go.kr/portal/news/NewsListAction.work?gubun=6)
- [사법정보공유포털](https://openapi.scourt.go.kr/)
- [casenote.kr robots.txt](https://casenote.kr/robots.txt)
