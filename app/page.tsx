import Link from "next/link";
import KoreaMap, { type CourtEnrichment } from "@/components/KoreaMap";
import ArticleCard from "@/components/ArticleCard";
import HomeSearch from "@/components/HomeSearch";
import {
  getAllCourts,
  getRecentArticles,
  getStats,
  getCourtTypeLabel,
  getJudgesByCourt,
  getJudgeWithStats,
  getCasesByJudge,
  getCourtAgreementRate,
  getCourtPath,
} from "@/lib/data";

export default function HomePage() {
  const courts = getAllCourts();
  const recentArticles = getRecentArticles(8);
  const stats = getStats();

  const courtsByType = courts.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + 1;
    return acc;
  }, {});

  // Per-court enrichment for map tooltip
  const courtEnrichments: Record<string, CourtEnrichment> = {};
  for (const c of courts) {
    const judges = getJudgesByCourt(c.id).map(getJudgeWithStats);
    const topJudges = judges
      .slice()
      .sort((a, b) => b.articleCount - a.articleCount)
      .slice(0, 3)
      .map((j) => ({
        id: j.id,
        name: j.name,
        position: j.position,
        articleCount: j.articleCount,
      }));
    const totalArticles = judges.reduce((s, j) => s + j.articleCount, 0);
    const totalCases = judges.reduce(
      (s, j) => s + getCasesByJudge(j.id).length,
      0
    );
    const agreement = getCourtAgreementRate(c.id);
    courtEnrichments[c.id] = {
      topJudges,
      totalArticles,
      totalCases,
      agreementRate: agreement.rate,
      agreementVotes: agreement.totalVotes,
    };
  }

  return (
    <div>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 lg:py-14">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-6 xl:col-span-5 space-y-5">
              <div className="flex items-center gap-3">
                <span className="eyebrow eyebrow-civic">
                  공공 정보 정리 기록
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-faint">
                  §01
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.85rem] font-bold leading-[1.15] tracking-tight text-navy-900">
                대한민국 법관에 대한
                <br />
                <span className="text-civic-700">공개 정보를</span>
                <br />
                한곳에서 열람합니다.
              </h1>
              <p className="text-[15px] text-muted leading-relaxed max-w-md">
                PansaWatch는 공개된 뉴스와 판례를 키워드 기반으로 자동
                수집·정리해 시민이 법관의 공적 직무 정보를 열람할 수 있도록
                돕습니다. 운영자는 어떠한 평가나 의견도 게시하지 않습니다.
              </p>

              <HomeSearch />

              <dl className="flex flex-wrap gap-x-6 gap-y-3 pt-5 border-t border-line">
                <Stat label="등록 법원" value={stats.courts} />
                <Stat label="등록 판사" value={stats.judges} />
                <Stat label="수집 기사" value={stats.articles} />
                <Stat label="등록 판례" value={stats.cases} />
                <Stat label="최종 갱신" value="2026.04.28" mono />
              </dl>
            </div>

            <div className="lg:col-span-6 xl:col-span-7">
              <div className="border border-line bg-paper-100">
                <div className="flex items-center justify-between border-b border-line-soft px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tabular-nums text-muted-faint">
                      MAP §02
                    </span>
                    <h2 className="font-serif text-base font-semibold text-navy-900">
                      대한민국 법원 분포
                    </h2>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-faint">
                    <span className="tag tag-seal">
                      대법원 {courtsByType.supreme ?? 0}
                    </span>
                    <span className="tag tag-civic">
                      고등 {courtsByType.high ?? 0}
                    </span>
                    <span className="tag tag-navy">
                      그 외{" "}
                      {courts.length -
                        (courtsByType.supreme ?? 0) -
                        (courtsByType.high ?? 0)}
                    </span>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  <KoreaMap
                    courts={courts}
                    enrichments={courtEnrichments}
                    initialScale={1.15}
                    initialCenter={[127.6, 36.5]}
                  />
                </div>
                <div className="border-t border-line-soft px-5 py-2.5 text-[11px] text-muted-faint">
                  ※ 마커를 클릭하면 해당 법원 페이지로 이동합니다. 좌표는 공식
                  주소 기반입니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 lg:py-16">
          <div className="flex items-end justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="eyebrow">최근 수집 기록</span>
                <span className="font-mono text-[10px] tabular-nums text-muted-faint">
                  §03
                </span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-navy-900">
                자동 수집된 공개 뉴스
              </h2>
              <p className="text-sm text-muted-soft mt-1">
                키워드 기반 자동 수집 · 운영자 편집 미게재
              </p>
            </div>
            <Link
              href="/news"
              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:text-civic-700"
            >
              전체 기록 열람
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M5 12h14" />
                <path d="m13 5 7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
            {recentArticles.map((a, i) => (
              <ArticleCard key={a.id} article={a} index={i} />
            ))}
          </div>

          <div className="mt-8 sm:hidden">
            <Link
              href="/news"
              className="block w-full text-center border border-line bg-surface py-3 text-sm font-medium text-navy-900"
            >
              전체 기록 열람 →
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 lg:py-16">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-2">
                <span className="eyebrow">법원 색인</span>
                <span className="font-mono text-[10px] tabular-nums text-muted-faint">
                  §04
                </span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-navy-900 mb-6">
                법원별 탐색
              </h2>

              <div className="grid sm:grid-cols-2 gap-0 border-t border-l border-line">
                {courts.slice(0, 12).map((c) => (
                  <Link
                    key={c.id}
                    href={getCourtPath(c)}
                    className="flex items-center justify-between border-b border-r border-line bg-surface p-4 hover:bg-navy-50/50 hover:border-navy-700 transition"
                  >
                    <div>
                      <div className="text-sm font-medium text-navy-900">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {getCourtTypeLabel(c.type)} · {c.region}
                      </div>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-muted-faint">
                      {String(c.judgeCount).padStart(2, "0")}명
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <aside className="lg:col-span-1 space-y-5">
              <div className="border border-line bg-surface">
                <div className="border-b border-line-soft px-5 py-3 flex items-center gap-2">
                  <span className="font-mono text-[10px] tabular-nums text-muted-faint">
                    POLICY §05
                  </span>
                  <h3 className="font-serif text-sm font-semibold text-navy-900">
                    데이터 수집 원칙
                  </h3>
                </div>
                <ul className="px-5 py-4 space-y-2.5 text-sm text-muted leading-relaxed">
                  {[
                    "키워드 기반 자동 수집으로 중립성 유지",
                    "기사 원문은 저장하지 않고 링크와 AI 요약만 보관",
                    "판사 개인 사적 정보는 수집·게시하지 않음",
                    "운영자는 편집 의견을 표현하지 않음",
                  ].map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="mt-2 inline-block w-1 h-1 rounded-full bg-civic-600 shrink-0"
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/about"
                  className="block border-t border-line-soft px-5 py-3 text-sm font-medium text-navy-700 hover:bg-navy-50"
                >
                  전체 정책 열람 →
                </Link>
              </div>

              <div className="stamp-box border-2 border-dashed border-seal-100 px-5 py-4">
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
                  <h3 className="text-[11px] uppercase tracking-[0.16em] font-bold text-seal-700">
                    면책 고지
                  </h3>
                </div>
                <p className="text-[12.5px] text-seal-700/95 leading-relaxed">
                  본 사이트의 모든 요약문은 자동 생성된 것이며, 정확한 내용은
                  반드시 원문 기사 또는 판례 원문을 확인하시기 바랍니다.
                  PansaWatch는 정보 제공만을 목적으로 하며, 어떠한 평가나
                  의견도 제공하지 않습니다.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: number | string;
  mono?: boolean;
}) {
  return (
    <div>
      <dd
        className={`figure-number text-[1.6rem] leading-none ${
          mono ? "font-mono text-[1rem]" : ""
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </dd>
      <dt className="text-[10.5px] uppercase tracking-[0.16em] text-muted-faint mt-1">
        {label}
      </dt>
    </div>
  );
}
