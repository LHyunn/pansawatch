import Link from "next/link";

export const metadata = {
  title: "개인정보 처리방침",
  description:
    "PansaWatch.org 개인정보 처리방침. 개인정보 보호법 제30조에 따라 수집 항목, 보유 기간, 위탁사, 정보주체의 권리 행사 방법을 안내합니다.",
};

const EFFECTIVE_DATE = "Phase 2 (인증 기능 활성화) 시점 발효 예정";
const VERSION = "v1.0 (초안)";

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-paper">
      <header className="bg-white border-b border-line">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 lg:py-16">
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-civic-700">
            <span className="h-px w-6 bg-civic-600" />
            Privacy Policy
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-navy-900 mt-3 leading-tight">
            개인정보
            <br />
            <span className="text-civic-700">처리방침</span>
          </h1>
          <p className="mt-5 text-base text-muted leading-relaxed">
            본 처리방침은 「개인정보 보호법」 제30조에 따라 PansaWatch.org 가
            처리하는 개인정보의 항목, 보유·이용 기간, 처리위탁 사항, 그리고
            정보주체의 권리 행사 절차를 안내합니다.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 not-prose">
            <Meta label="버전" value={VERSION} />
            <Meta label="시행 예정" value={EFFECTIVE_DATE} mono />
          </div>

          <div className="mt-6 border-l-2 border-seal-100 bg-seal-50/50 px-4 py-3">
            <p className="text-[12.5px] text-seal-700/95 leading-relaxed">
              ※ 현재 PansaWatch는 가상 데이터로 구동되는 프로토타입 단계이며,
              실제 회원 가입·인증·투표 기능이 활성화되기 전까지는 본 방침의
              수집 항목이 실제로 처리되지 않습니다. 본 페이지는 사전 공시 및
              검토용으로 게시됩니다.
            </p>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-14">
        <Section title="처리자(개인정보처리자)" eyebrow="Controller" id="controller">
          <table className="not-prose w-full text-sm border border-line">
            <tbody>
              <Row label="처리자 명칭" value="PansaWatch 운영팀" />
              <Row label="도메인" value="pansawatch.org" />
              <Row
                label="대표 연락처"
                value={
                  <a
                    href="mailto:privacy@pansawatch.org"
                    className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
                  >
                    privacy@pansawatch.org
                  </a>
                }
              />
              <Row
                label="일반 문의"
                value={
                  <a
                    href="mailto:contact@pansawatch.org"
                    className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
                  >
                    contact@pansawatch.org
                  </a>
                }
              />
              <Row
                label="정정 요청"
                value={
                  <a
                    href="mailto:correction@pansawatch.org"
                    className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
                  >
                    correction@pansawatch.org
                  </a>
                }
              />
            </tbody>
          </table>
        </Section>

        <Section title="1. 개인정보의 처리 목적" eyebrow="Purpose" id="purpose">
          <p>본 사이트는 다음 목적을 위해서만 개인정보를 처리합니다.</p>
          <ol>
            <li>
              <strong>회원 식별 및 인증</strong> — Google·Kakao OAuth 를 통한
              가입·로그인 식별
            </li>
            <li>
              <strong>시민 투표 무결성 보장</strong> — 1인 1표 원칙 준수,
              다중 계정·자동화 어부징 탐지
            </li>
            <li>
              <strong>고지·민원 응답</strong> — 약관 변경 통지, 오류·정정
              요청 회신, 정보주체의 권리 행사 응답
            </li>
            <li>
              <strong>서비스 운영·보안</strong> — 비정상 접근 차단,
              서비스 안정성 확보
            </li>
          </ol>
          <p>
            본 사이트는 <strong>광고·마케팅·프로파일링·제3자 광고 매칭</strong>{" "}
            목적으로는 개인정보를 처리하지 않습니다.
          </p>
        </Section>

        <Section title="2. 처리하는 개인정보 항목" eyebrow="Items" id="items">
          <h3 className="font-serif text-lg font-semibold text-navy-900">
            2-1. 이용자로부터 수집하는 항목
          </h3>
          <table className="not-prose w-full text-sm border border-line my-3">
            <thead>
              <tr className="bg-paper-100 border-b border-line">
                <Th>구분</Th>
                <Th>항목</Th>
                <Th>비고</Th>
              </tr>
            </thead>
            <tbody>
              <DataRow type="필수" item="이메일 주소" note="식별·통지" />
              <DataRow
                type="필수"
                item="OAuth 식별자 (provider_id, sub)"
                note="중복 가입 방지"
              />
              <DataRow
                type="필수"
                item="표시명 (닉네임)"
                note="OAuth 기본값 또는 변경값"
              />
              <DataRow
                type="자동수집"
                item="IP 주소"
                note="서버 로그 — 90일 후 자동 삭제"
              />
              <DataRow
                type="자동수집"
                item="User-Agent"
                note="서버 로그 — 90일 후 자동 삭제"
              />
              <DataRow
                type="자동수집"
                item="세션 쿠키"
                note="인증 유지 — 세션 종료 시 폐기"
              />
            </tbody>
          </table>

          <h3 className="font-serif text-lg font-semibold text-navy-900 mt-6">
            2-2. 행동 데이터
          </h3>
          <p>
            <strong>시민 투표 기록</strong> (판결 동의/비동의, 양형 적절성, 기사
            유용성) 은 회원 ID 와 연결되어 저장됩니다. 회원 탈퇴 시 회원 ID 는
            복구 불가능한 익명 해시로 대체되며, 투표 자체는 익명 통계로
            보존됩니다.
          </p>

          <h3 className="font-serif text-lg font-semibold text-navy-900 mt-6">
            2-3. 처리하지 않는 항목
          </h3>
          <p>본 사이트는 다음 정보를 수집·처리하지 않습니다.</p>
          <ul>
            <li>주민등록번호·외국인등록번호 등 고유식별정보</li>
            <li>휴대전화번호 (본인인증 미실시)</li>
            <li>실명·생년월일·성별·주소</li>
            <li>신용·금융 정보, 위치 정보 (GPS·기지국)</li>
            <li>외부 광고·분석 사업자용 식별자 (Google Analytics·Meta Pixel 등 미적용)</li>
            <li>OAuth 가 제공하더라도 프로필 이미지는 저장하지 않음</li>
          </ul>

          <h3 className="font-serif text-lg font-semibold text-navy-900 mt-6">
            2-4. 만 14세 미만 아동
          </h3>
          <p>
            본 사이트는 아동 대상 서비스가 아니며,{" "}
            <strong>만 14세 미만 아동의 회원가입을 허용하지 않습니다.</strong>{" "}
            가입 시 이용약관 동의 절차에서 &ldquo;만 14세 이상임&rdquo; 을
            자기 확인하며, 14세 미만 사실이 확인된 경우 즉시 회원 탈퇴 및 관련
            정보를 파기합니다.
          </p>
        </Section>

        <Section
          title="3. 보유 및 이용 기간"
          eyebrow="Retention"
          id="retention"
        >
          <table className="not-prose w-full text-sm border border-line">
            <thead>
              <tr className="bg-paper-100 border-b border-line">
                <Th>항목</Th>
                <Th>보유 기간</Th>
              </tr>
            </thead>
            <tbody>
              <KV
                k="이메일·OAuth ID·닉네임"
                v="회원 자격 유지 기간"
              />
              <KV
                k="서버 액세스 로그 (IP·UA)"
                v="수집 후 90일 자동 삭제"
              />
              <KV
                k="인증 세션 쿠키"
                v="세션 종료 또는 최대 30일"
              />
              <KV
                k="시민 투표 기록"
                v="탈퇴 시 회원 식별자 익명화 → 투표는 익명 통계로 보존"
              />
              <KV
                k="정정 요청·민원 처리 기록"
                v="처리 완료일로부터 3년 (전자상거래법 제6조 준용)"
              />
            </tbody>
          </table>
          <p className="text-[13px] text-muted-soft mt-4">
            보유기간 경과 정보는 매월 1회 일괄 파기되며, 전자적 파일은 복구
            불가능한 방법으로 영구 삭제됩니다. 탈퇴 시 시민 투표는 통계
            무결성을 위해 보존되되 회원 식별자(user_id) 는 단방향 해시로
            대체됩니다 (개인정보 보호법 제58조의2).
          </p>
        </Section>

        <Section
          title="4. 처리위탁 및 국외 이전"
          eyebrow="Processors"
          id="processors"
        >
          <p>
            본 사이트는 서비스 운영을 위해 다음 외부 사업자에게 개인정보 처리를
            위탁합니다. 일부 수탁자는 해외에 소재하므로 「개인정보 보호법」
            제28조의8 에 따라 국외 이전 사실을 함께 공지합니다.
          </p>

          <table className="not-prose w-full text-[13px] border border-line my-4">
            <thead>
              <tr className="bg-paper-100 border-b border-line">
                <Th>수탁자</Th>
                <Th>국가</Th>
                <Th>위탁 업무</Th>
              </tr>
            </thead>
            <tbody>
              <Processor
                name="Vercel Inc."
                country="미국"
                purpose="웹 호스팅·CDN"
              />
              <Processor
                name="Supabase Inc."
                country="미국 또는 싱가포르"
                purpose="회원 DB·인증"
              />
              <Processor
                name="Amazon Web Services"
                country="한국 (서울)"
                purpose="크롤러·백엔드 (개인정보 처리 없음)"
              />
              <Processor
                name="Google LLC"
                country="미국"
                purpose="OAuth 인증 (선택 시)"
              />
              <Processor
                name="Kakao Corp."
                country="한국"
                purpose="OAuth 인증 (선택 시)"
              />
            </tbody>
          </table>

          <p className="text-[13px]">
            새로운 수탁자가 추가되거나 위탁 항목이 변경되는 경우, 본 사이트는
            시행일 7일 이전에 본 처리방침을 개정·공지합니다.
          </p>
          <p className="text-[13px]">
            이용자는 국외 이전을 거부할 권리가 있으나, 거부 시 본 사이트의 회원
            가입·시민 투표 기능을 이용할 수 없습니다.
          </p>
        </Section>

        <Section
          title="5. 정보주체의 권리·의무 및 행사 방법"
          eyebrow="Rights"
          id="rights"
        >
          <p>이용자는 다음의 권리를 언제든지 행사할 수 있습니다.</p>
          <ol>
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정·삭제 요구</li>
            <li>처리 정지 요구</li>
            <li>회원 탈퇴 (동의 철회)</li>
          </ol>

          <h3 className="font-serif text-lg font-semibold text-navy-900 mt-6">
            행사 방법
          </h3>
          <table className="not-prose w-full text-sm border border-line my-3">
            <tbody>
              <KV
                k="이메일"
                v={
                  <a
                    href="mailto:privacy@pansawatch.org"
                    className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
                  >
                    privacy@pansawatch.org
                  </a>
                }
              />
              <KV
                k="전용 폼"
                v="https://pansawatch.org/privacy/request (Phase 2 구현 예정)"
              />
              <KV
                k="계정 설정"
                v="닉네임 변경·이메일 변경·탈퇴는 계정 설정 페이지에서 직접 처리"
              />
            </tbody>
          </table>

          <h3 className="font-serif text-lg font-semibold text-navy-900 mt-6">
            처리 기한
          </h3>
          <ul>
            <li>
              열람·정정·삭제·처리정지: 접수일로부터 <strong>10일 이내</strong>{" "}
              조치 또는 사유 통보
            </li>
            <li>탈퇴: 접수 즉시, 익명화 완료까지 최대 7일</li>
          </ul>

          <h3 className="font-serif text-lg font-semibold text-navy-900 mt-6">
            거절 사유
          </h3>
          <ul>
            <li>본인 또는 정당한 대리인임이 확인되지 않는 경우</li>
            <li>다른 사람의 생명·신체·재산을 부당하게 침해할 우려가 있는 경우</li>
            <li>법령에서 보존 의무를 부과하는 경우</li>
          </ul>
          <p>
            본인 확인은 가입 시 사용한 이메일 주소로 인증 메일을 발송하는 방식
            으로 진행됩니다.
          </p>
        </Section>

        <Section
          title="6. 안전성 확보 조치"
          eyebrow="Safeguards"
          id="safeguards"
        >
          <ul>
            <li>
              <strong>관리적 조치</strong> — 처리자 정기 자체 점검, 개인정보
              취급자 최소화
            </li>
            <li>
              <strong>기술적 조치</strong> — TLS 암호화 통신, 데이터베이스
              암호화, 접근 권한 관리
            </li>
            <li>
              <strong>물리적 조치</strong> — 수탁자 인프라(Vercel, Supabase)
              의 ISO 27001·SOC 2 인증 활용
            </li>
            <li>
              <strong>사고 대응</strong> — 개인정보 유출 사고 발생 시
              「개인정보 보호법」 제34조에 따라 정보주체에게 즉시 통지
            </li>
          </ul>
        </Section>

        <Section
          title="7. 자동수집장치 (쿠키) 의 사용"
          eyebrow="Cookies"
          id="cookies"
        >
          <p>
            본 사이트는 <strong>인증 세션 유지를 위한 필수 쿠키만</strong>{" "}
            사용하며, 광고·분석·추적 목적의 쿠키는 사용하지 않습니다.
          </p>

          <table className="not-prose w-full text-sm border border-line my-3">
            <thead>
              <tr className="bg-paper-100 border-b border-line">
                <Th>쿠키</Th>
                <Th>목적</Th>
                <Th>보존 기간</Th>
              </tr>
            </thead>
            <tbody>
              <CookieRow
                name="sb-access-token (또는 동등)"
                purpose="OAuth 인증 세션 유지"
                expires="세션 종료 시"
              />
              <CookieRow
                name="sb-refresh-token (또는 동등)"
                purpose="세션 갱신"
                expires="최대 30일"
              />
              <CookieRow
                name="CSRF 토큰"
                purpose="위변조 방지"
                expires="세션 종료 시"
              />
            </tbody>
          </table>

          <h3 className="font-serif text-lg font-semibold text-navy-900 mt-6">
            방문자 통계
          </h3>
          <p>
            방문자 통계가 필요한 경우 <strong>쿠키리스 익명 집계 도구</strong>{" "}
            (Plausible · Umami 또는 동등 솔루션) 를 사용하며, IP 를 해시
            처리하여 개인 식별이 불가능합니다. 이는 「개인정보 보호법」 적용
            대상이 아닌 익명 정보 처리에 해당합니다.
          </p>
          <p>
            이용자는 브라우저 설정을 통해 쿠키를 거부할 수 있으나, 거부 시
            로그인이 필요한 기능 (시민 투표) 을 이용할 수 없습니다.
          </p>
        </Section>

        <Section
          title="8. 개인정보 보호책임자 및 신고처"
          eyebrow="Officer"
          id="officer"
        >
          <table className="not-prose w-full text-sm border border-line my-3">
            <tbody>
              <KV k="책임자" v="PansaWatch 운영팀" />
              <KV
                k="연락처"
                v={
                  <a
                    href="mailto:privacy@pansawatch.org"
                    className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
                  >
                    privacy@pansawatch.org
                  </a>
                }
              />
              <KV k="응답 시간" v="영업일 기준 7일 이내 1차 회신" />
            </tbody>
          </table>

          <h3 className="font-serif text-lg font-semibold text-navy-900 mt-6">
            신고·구제 기관
          </h3>
          <p>
            본 사이트가 적절히 처리하지 못한 경우 다음 기관에 신고할 수
            있습니다.
          </p>
          <ul>
            <li>
              개인정보 침해 신고센터 —{" "}
              <a
                href="https://privacy.go.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
              >
                privacy.go.kr
              </a>{" "}
              / 국번 없이 182
            </li>
            <li>
              개인정보 분쟁조정위원회 —{" "}
              <a
                href="https://kopico.go.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
              >
                kopico.go.kr
              </a>{" "}
              / 1833-6972
            </li>
            <li>
              대검찰청 사이버수사과 —{" "}
              <a
                href="https://spo.go.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
              >
                spo.go.kr
              </a>
            </li>
            <li>
              경찰청 사이버수사국 —{" "}
              <a
                href="https://ecrm.cyber.go.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
              >
                ecrm.cyber.go.kr
              </a>{" "}
              / 국번 없이 182
            </li>
          </ul>
        </Section>

        <Section
          title="9. 처리방침의 변경"
          eyebrow="Versioning"
          id="versioning"
        >
          <ul>
            <li>
              <strong>경미한 변경</strong> (오탈자, 절차 명확화 등) — 본
              사이트에 즉시 공지
            </li>
            <li>
              <strong>중요한 변경</strong> (수집 항목 추가, 보유기간 연장,
              수탁자 추가, 정보주체 권리 제한 등) — 시행일 30일 이전 공지 +
              기존 회원에게 이메일 개별 통지
            </li>
          </ul>

          <h3 className="font-serif text-lg font-semibold text-navy-900 mt-6">
            개정 이력
          </h3>
          <table className="not-prose w-full text-sm border border-line my-3">
            <thead>
              <tr className="bg-paper-100 border-b border-line">
                <Th>버전</Th>
                <Th>시행일</Th>
                <Th>주요 변경</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <Td>v1.0</Td>
                <Td>(Phase 2 발효 예정)</Td>
                <Td>최초 작성</Td>
              </tr>
            </tbody>
          </table>
        </Section>

        <div className="not-prose stamp-box border-2 border-dashed p-5 mt-6">
          <div className="flex items-center gap-2 mb-2">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 text-seal-700"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            <h4 className="text-[11px] uppercase tracking-[0.16em] font-bold text-seal-700">
              참고 안내
            </h4>
          </div>
          <p className="text-[13px] text-seal-700/95 leading-relaxed">
            본 처리방침은 일반적인 개인정보 보호법 가이드에 따라 작성된
            초안이며, 실 발효 전 한국 변호사의 자문을 거칠 예정입니다. 처리
            방침 내용에 의문이 있는 경우{" "}
            <a
              href="mailto:privacy@pansawatch.org"
              className="font-semibold underline underline-offset-2"
            >
              privacy@pansawatch.org
            </a>{" "}
            로 문의해 주세요.
          </p>
        </div>

        <div className="not-prose border-t border-line pt-8 flex flex-wrap items-center justify-between gap-4 text-sm">
          <Link
            href="/about"
            className="inline-flex items-center gap-1 text-navy-700 hover:text-civic-700 font-medium"
          >
            ← 프로젝트 소개
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-navy-700 hover:text-civic-700 font-medium"
          >
            홈으로 →
          </Link>
        </div>
      </article>
    </div>
  );
}

function Section({
  title,
  eyebrow,
  id,
  children,
}: {
  title: string;
  eyebrow: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
        <span className="h-px w-6 bg-navy-900" />
        {eyebrow}
      </span>
      <h2 className="font-serif text-2xl sm:text-3xl font-bold text-navy-900 mt-2 mb-5">
        {title}
      </h2>
      <div className="prose prose-sm max-w-none text-muted leading-relaxed prose-strong:text-navy-900 prose-strong:font-semibold prose-li:my-1 prose-p:my-3 prose-ul:my-3 space-y-3">
        {children}
      </div>
    </section>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border border-line bg-white p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-faint font-semibold">
        {label}
      </div>
      <div
        className={`text-navy-900 mt-1 ${
          mono ? "font-mono text-[12px] tabular-nums" : "text-sm font-medium"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[10px] uppercase tracking-[0.16em] text-muted-faint font-semibold px-3 py-2 border-r border-line last:border-r-0">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-3 py-2 align-top text-[13px] text-foreground border-r border-line last:border-r-0">
      {children}
    </td>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="bg-paper-100 px-3 py-2 text-[11px] font-semibold text-muted uppercase tracking-[0.12em] w-1/3 align-top">
        {label}
      </td>
      <td className="px-3 py-2 text-[13.5px] text-foreground">{value}</td>
    </tr>
  );
}

function KV({
  k,
  v,
}: {
  k: string;
  v: React.ReactNode;
}) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="bg-paper-100 px-3 py-2 text-[11.5px] font-medium text-muted-soft w-1/3 align-top">
        {k}
      </td>
      <td className="px-3 py-2 text-[13px] text-foreground align-top">{v}</td>
    </tr>
  );
}

function DataRow({
  type,
  item,
  note,
}: {
  type: string;
  item: string;
  note: string;
}) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <Td>
        <span
          className={`tag ${
            type === "필수" ? "tag-seal" : "tag-navy"
          } whitespace-nowrap`}
        >
          {type}
        </span>
      </Td>
      <Td>
        <span className="font-medium text-navy-900">{item}</span>
      </Td>
      <Td>
        <span className="text-muted-soft">{note}</span>
      </Td>
    </tr>
  );
}

function Processor({
  name,
  country,
  purpose,
}: {
  name: string;
  country: string;
  purpose: string;
}) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <Td>
        <span className="font-medium text-navy-900">{name}</span>
      </Td>
      <Td>
        <span className="font-mono text-[11.5px] text-muted-soft">
          {country}
        </span>
      </Td>
      <Td>{purpose}</Td>
    </tr>
  );
}

function CookieRow({
  name,
  purpose,
  expires,
}: {
  name: string;
  purpose: string;
  expires: string;
}) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <Td>
        <span className="font-mono text-[12px]">{name}</span>
      </Td>
      <Td>{purpose}</Td>
      <Td>
        <span className="font-mono text-[12px] text-muted-soft">
          {expires}
        </span>
      </Td>
    </tr>
  );
}
