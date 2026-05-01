import Link from "next/link";
import { getStats } from "@/lib/data";

export const metadata = {
  title: "프로젝트 소개",
  description:
    "PansaWatch는 공개된 뉴스와 판례를 자동 수집해 시민이 법관 정보를 쉽게 열람할 수 있도록 하는 비영리 시빅테크 프로젝트입니다.",
};

export default function AboutPage() {
  const stats = getStats();

  return (
    <div className="bg-paper">
      <header className="bg-white border-b border-line">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 lg:py-16">
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-civic-700">
            <span className="h-px w-6 bg-civic-600" />
            About PansaWatch
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-navy-900 mt-3 leading-tight">
            공개된 법관 정보를
            <br />
            <span className="text-civic-700">한곳에서</span> 정리합니다.
          </h1>
          <p className="mt-5 text-base text-muted leading-relaxed">
            PansaWatch는 대한민국 법관에 대한 공개 뉴스와 판례 정보를
            자동으로 수집·정리하여, 시민이 누구나 쉽게 열람할 수 있도록 하는
            <strong className="text-navy-900"> 비영리 시빅테크 프로젝트</strong>입니다.
            운영자는 어떠한 의견도 표현하지 않으며, 사전에 정의된 키워드로
            자동 수집합니다.
          </p>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-14">
        <Section title="우리는 왜 이 프로젝트를 만들었나" eyebrow="Mission">
          <p>
            법관은 공적 인물이며, 판결문에서 법관의 실명은 공식적으로
            공개됩니다. 그러나 시민이 법관에 대한 공개 정보를 한 곳에서 쉽게
            열람할 수 있는 공간은 거의 없습니다. PansaWatch는 누구나 접근
            가능한 공개 자료(뉴스 기사, 판례 원문 링크)를 정리해서 보여주는,
            가장 가벼운 형태의 공공 기록 정리 도구를 지향합니다.
          </p>
          <p>
            일본의{" "}
            <a
              href="https://saibankan-map.jp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
            >
              재판관맵(裁判官マップ)
            </a>
            을 레퍼런스로 삼되, 법적 리스크를 줄이기 위해 <strong>리뷰·평점
            기능을 제외</strong>하고, 대신 공개 뉴스와 판례 위주로 정보를
            제공합니다.
          </p>
        </Section>

        <Section title="핵심 설계 원칙" eyebrow="Design" id="design-principle">
          <p>
            <strong>판사가 아니라 판결을 평가한다.</strong>
          </p>
          <p>
            사람에 대한 평가(&ldquo;김OO 판사 별점 2점&rdquo;)는 명예훼손
            리스크가 큽니다. 반면 공문서(판결문)에 대한 의견 표명은 표현의
            자유의 핵심 영역입니다.
          </p>
          <p>
            PansaWatch의 모든 시민 투표는 판결 단위로 설계됩니다. 판결별
            투표가 축적되면, 예를 들어 &ldquo;담당 판결 20건 중 시민 동의율
            35%&rdquo;처럼 자연스럽게 판사에 대한 시민 평가가 드러나지만,
            구조적으로는 공문서 평가의 합산일 뿐입니다.
          </p>
        </Section>

        <Section
          title="법적 안전성 분석"
          eyebrow="Legal"
          id="legal-analysis"
        >
          <p>
            플랫폼을 구성하는 다섯 개의 데이터 컴포넌트는 각각 독립적으로 법적
            안전성을 확보하도록 설계되었습니다.
          </p>
          <ol>
            <li>
              <strong>판사 프로필</strong> — 대법원이 매년 공개하는 인사발령
              데이터에 기반합니다. 정부가 공표한 공적 정보이므로 명예훼손
              대상이 되지 않습니다.
            </li>
            <li>
              <strong>뉴스 기사 링크 + AI 요약</strong> — 원문은 저장하지 않고
              링크와 짧은 요약만 보관합니다. 키워드 기반 자동 수집이므로
              운영자의 편집 의도가 개입되지 않습니다.
            </li>
            <li>
              <strong>판결문 + AI 요약</strong> — 판결문은 국가가 공개한
              공문서입니다. 공문서의 요약을 명예훼손으로 주장할 근거가
              없습니다.
            </li>
            <li>
              <strong>시민 투표 결과</strong> — &ldquo;시민 N%가
              동의&rdquo;는 의견 집계이며, 사실의 적시가 아닙니다.
              여론조사 결과와 같은 성격으로 명예훼손 대상이 되기 어렵습니다.
            </li>
            <li>
              <strong>객관 통계</strong> — 항소심 파기율, 사건유형별 비율
              등은 판결문에서 추출한 팩트입니다. 통계 자체에 대해
              명예훼손을 주장하기는 극히 어렵습니다.
            </li>
          </ol>

          <h3 className="font-serif text-lg font-semibold text-navy-900 mt-6">
            임시조치 대응
          </h3>
          <p>
            정보통신망법 제44조의2상의 정보 삭제·임시조치 절차는 &ldquo;해당
            정보&rdquo; 단위로 적용됩니다. PansaWatch가 표시하는 자료는 정부가
            공표한 공적 데이터(인사발령·판결문)와 이미 공개된 보도의 링크·요약
            으로 구성되어 있습니다.
          </p>

          <h3 className="font-serif text-lg font-semibold text-navy-900 mt-6">
            참고 판례
          </h3>
          <p>
            <strong>나무위키 학교법인 소송 (2026)</strong> — 법원은
            &ldquo;게시물의 불법성이 명백하다고 보기에 부족하고, 가치중립적
            성격을 띠고 있어 구체적인 피해를 입었다고 보기 어렵다&rdquo;며
            청구를 기각했습니다. 공개된 사실의 가치중립적 정리 자체에 대한
            명예훼손 책임을 다툰 사례로 참고됩니다.
          </p>
        </Section>

        <Section title="현재 수집 현황" eyebrow="Numbers">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 not-prose">
            <Metric label="등록 법원" value={stats.courts} />
            <Metric label="등록 판사" value={stats.judges} />
            <Metric label="수집 기사" value={stats.articles} />
            <Metric label="등록 판례" value={stats.cases} />
          </div>
          <p className="text-sm text-muted-soft">
            현재 표시되는 데이터는 프로토타입을 위한{" "}
            <strong>가상(mock) 데이터</strong>입니다. 실제 수집 파이프라인은
            추후 연동됩니다.
          </p>
        </Section>

        <Section title="데이터 수집 방법" eyebrow="Data" id="data">
          <p>
            본 프로젝트는 다음과 같은 원칙에 따라 데이터를 수집합니다:
          </p>
          <ul>
            <li>
              <strong>키워드 기반 자동 수집</strong> — 운영자의 주관적 선별
              없이, 사전에 정의된 법원·판사 키워드 기반으로 공개 RSS·뉴스
              API에서 자동 수집합니다.
            </li>
            <li>
              <strong>원문 미저장</strong> — 저작권 보호를 위해 기사 본문은
              저장하지 않고, 제목 + 원문 링크 + AI가 생성한 2~3문장 요약만
              보관합니다.
            </li>
            <li>
              <strong>AI 요약</strong> — 짧은 기사 요약은 Claude Haiku, 판례
              요약은 Claude Sonnet을 사용합니다. 모든 요약문 옆에 면책 문구를
              표시합니다.
            </li>
            <li>
              <strong>판사 매칭</strong> — NER(개체명 인식)과 법원 메타데이터
              교차 검증으로 잘못된 매칭(동명이인 등)을 최소화합니다.
            </li>
            <li>
              <strong>수집 주기</strong> — 매일 1~2회 자동 갱신.
            </li>
          </ul>
          <p>
            수집 대상 사이트, 수집 키워드 목록은 추후 공개 페이지를 통해 모두
            투명하게 공개할 예정입니다.
          </p>
        </Section>

        <Section title="법적 안전성과 면책" eyebrow="Disclaimer" id="disclaimer">
          <ul>
            <li>
              판사는 공적 인물이며, 판결문에서 법관 실명이 공개됩니다.
            </li>
            <li>
              운영자는 의견을 표현하지 않고 공개 기사를 기계적으로
              수집·정리하므로 명예훼손 리스크가 극히 낮습니다.
            </li>
            <li>
              기사 원문을 복제하지 않고, 링크와 AI 요약만 제공하여 저작권
              리스크를 회피합니다.
            </li>
            <li>
              모든 AI 요약문 하단에{" "}
              <em>"AI가 생성한 요약이며, 정확한 내용은 원문을 확인하세요"</em>{" "}
              면책 문구를 포함합니다.
            </li>
            <li>
              판사 개인의 사적 정보(연락처, 주소, 가족 등)는 수집·게시하지
              않습니다.
            </li>
            <li>
              투표는 판사 개인이 아닌 판결·기사 단위로 설계되며, "이 판결이
              적절하다고 생각하나요?" 형태입니다.
            </li>
          </ul>
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
                중요 면책 고지
              </h4>
            </div>
            <p className="text-[13px] text-seal-700/95 leading-relaxed">
              본 사이트의 모든 요약문은 AI가 생성한 것이며, 정확한 내용은
              반드시 원문 기사 또는 판례 원문을 확인하시기 바랍니다.
              PansaWatch는 정보 제공만을 목적으로 하며, 어떠한 평가나 의견도
              제공하지 않습니다. 본 사이트의 정보를 법적 의사결정의 단독
              근거로 사용해서는 안 됩니다.
            </p>
          </div>
        </Section>

        <Section title="비영리 운영 원칙" eyebrow="Operation">
          <ul>
            <li>
              <strong>광고 없음</strong> — 본 사이트에는 어떠한 광고도
              게재하지 않습니다.
            </li>
            <li>
              <strong>수익 모델 없음</strong> — 유료 서비스, 구독, 후원 강요
              없음. .org 도메인을 사용합니다.
            </li>
            <li>
              <strong>오픈 데이터 지향</strong> — 수집 키워드, 법원 메타데이터
              등 비저작 데이터는 누구나 검증할 수 있도록 공개를 지향합니다.
            </li>
            <li>
              <strong>오류 신고</strong> — 잘못된 매칭이나 부정확한 요약을
              신고하면 검토 후 수정합니다.
            </li>
          </ul>
        </Section>

        <Section title="문의처" eyebrow="Contact" id="contact">
          <p>
            오류 신고, 정보 정정 요청, 협업·후원 문의는 다음으로 연락
            바랍니다:
          </p>
          <ul>
            <li>
              이메일:{" "}
              <a
                href="mailto:contact@pansawatch.org"
                className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
              >
                contact@pansawatch.org
              </a>
            </li>
            <li>
              GitHub:{" "}
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-navy-700 hover:text-civic-700 underline-offset-2 underline"
              >
                github.com/pansawatch
              </a>
            </li>
          </ul>
        </Section>

        <div className="not-prose border-t border-line pt-8 flex flex-wrap items-center justify-between gap-4 text-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-navy-700 hover:text-civic-700 font-medium"
          >
            ← 홈으로
          </Link>
          <Link
            href="/news"
            className="inline-flex items-center gap-1 text-navy-700 hover:text-civic-700 font-medium"
          >
            전체 뉴스 보기 →
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line bg-white p-4">
      <div className="font-serif text-3xl font-bold text-navy-900 tabular-nums leading-none">
        {value.toLocaleString()}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-muted-soft mt-2">
        {label}
      </div>
    </div>
  );
}
