import Link from "next/link";
import { notFound } from "next/navigation";
import JudgeCard from "@/components/JudgeCard";
import CorrectionRequest from "@/components/CorrectionRequest";
import {
  getCourt,
  getJudgesByCourt,
  getJudgeWithStats,
  getCourtTypeLabel,
  getAllCourts,
  getArticlesByJudge,
  getJudgesForArticle,
  getCourtAgreementRate,
  getJudgeAgreementRate,
} from "@/lib/data";
import ArticleCard from "@/components/ArticleCard";

export function generateStaticParams() {
  return getAllCourts().map((c) => ({ id: c.id }));
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const court = getCourt(id);
  if (!court) return { title: "법원을 찾을 수 없음" };
  return {
    title: court.name,
    description: `${court.name} 소속 판사 목록 및 관련 공개 정보.`,
  };
}

export default async function CourtPage({ params }: Props) {
  const { id } = await params;
  const court = getCourt(id);
  if (!court) notFound();

  const judgesBase = getJudgesByCourt(court.id).map(getJudgeWithStats);
  const judges = judgesBase.map((j) => {
    const ag = getJudgeAgreementRate(j.id);
    return { ...j, agreementRate: ag.rate, agreementVotes: ag.totalVotes };
  });
  const courtAgreement = getCourtAgreementRate(court.id);

  const courtArticles = new Map<string, ReturnType<typeof getArticlesByJudge>[number]>();
  for (const j of judges) {
    for (const a of getArticlesByJudge(j.id)) {
      if (!courtArticles.has(a.id)) courtArticles.set(a.id, a);
    }
  }
  const articles = Array.from(courtArticles.values())
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, 6)
    .map((a) => ({
      ...a,
      judges: getJudgesForArticle(a.id).map((j) => ({
        id: j.id,
        name: j.name,
        court: j.court,
      })),
    }));

  const totalArticles = judges.reduce((s, j) => s + j.articleCount, 0);
  const totalCases = judges.reduce((s, j) => s + j.caseCount, 0);

  const mapsHref = `https://www.google.com/maps?q=${court.latitude},${court.longitude}`;

  const courtNo = court.id.replace("court-", "").padStart(3, "0");

  return (
    <div>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4">
          <nav
            className="flex items-center gap-1.5 text-xs text-muted"
            aria-label="breadcrumb"
          >
            <Link href="/" className="hover:text-navy-900">
              홈
            </Link>
            <span className="text-muted-faint">/</span>
            <span className="text-navy-900 font-medium">{court.name}</span>
          </nav>
        </div>
      </div>

      <header className="bg-surface border-b border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 lg:py-14">
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <span className="eyebrow eyebrow-civic">
                  {getCourtTypeLabel(court.type)}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-faint">
                  법원 #{courtNo}
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-navy-900 leading-tight">
                {court.name}
              </h1>
              <p className="mt-3 text-sm text-muted">
                {court.region} · {court.address}
              </p>

              <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm pt-4 border-t border-line-soft">
                <Stat label="등록 판사" value={judges.length} />
                <Stat label="관련 기사" value={totalArticles} />
                <Stat label="등록 판례" value={totalCases} />
                <Stat
                  label="시민 동의율"
                  display={
                    courtAgreement.totalVotes > 0
                      ? `${Math.round(courtAgreement.rate * 100)}%`
                      : "—"
                  }
                />
              </dl>
            </div>

            <div className="border border-line bg-paper-100">
              <div className="px-5 py-3 border-b border-line-soft flex items-center gap-2">
                <span className="font-mono text-[10px] tabular-nums text-muted-faint">
                  COORD
                </span>
                <h2 className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted">
                  법원 위치
                </h2>
              </div>
              <div className="px-5 py-5">
                <div className="aspect-[4/3] bg-surface border border-line-soft grid place-items-center mb-3 relative overflow-hidden">
                  {/* subtle grid pattern */}
                  <div
                    aria-hidden
                    className="absolute inset-0 opacity-[0.06]"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, var(--color-navy-900) 1px, transparent 1px), linear-gradient(to bottom, var(--color-navy-900) 1px, transparent 1px)",
                      backgroundSize: "16px 16px",
                    }}
                  />
                  <div className="text-center px-4 relative">
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className="h-7 w-7 text-seal-600 mx-auto mb-1.5"
                      fill="currentColor"
                    >
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
                    </svg>
                    <div className="font-mono text-[11px] tabular-nums text-muted">
                      {court.latitude.toFixed(4)}, {court.longitude.toFixed(4)}
                    </div>
                  </div>
                </div>
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:text-civic-700"
                >
                  Google Maps에서 보기 →
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10 lg:py-14">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="eyebrow">소속 판사 명단</span>
              <span className="font-mono text-[10px] tabular-nums text-muted-faint">
                §01
              </span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-navy-900">
              소속 판사 ({judges.length}명)
            </h2>
          </div>
        </div>
        {judges.length === 0 ? (
          <div className="border border-dashed border-line bg-surface py-12 text-center text-muted">
            등록된 판사가 없습니다.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {judges.map((j) => (
              <JudgeCard
                key={j.id}
                judge={j}
                agreementRate={j.agreementRate}
                agreementVotes={j.agreementVotes}
              />
            ))}
          </div>
        )}
      </section>

      {articles.length > 0 && (
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 lg:py-14">
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="eyebrow">관련 기록</span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-faint">
                    §02
                  </span>
                </div>
                <h2 className="font-serif text-2xl font-bold text-navy-900">
                  법원 관련 최근 뉴스
                </h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {articles.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-12">
        <div className="mt-4 pt-6 border-t border-line text-center">
          <CorrectionRequest
            context="court"
            contextId={court.id}
            contextLabel={`${court.name} 정보`}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  display,
}: {
  label: string;
  value?: number;
  display?: string;
}) {
  const out = display ?? (typeof value === "number" ? value.toLocaleString() : "—");
  return (
    <div>
      <dd className="figure-number text-[1.6rem] leading-none">{out}</dd>
      <dt className="text-[10.5px] uppercase tracking-[0.16em] text-muted-faint mt-1">
        {label}
      </dt>
    </div>
  );
}
