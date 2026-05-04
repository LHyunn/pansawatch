import Link from "next/link";
import { notFound } from "next/navigation";
import JudgeTabs from "@/components/JudgeTabs";
import JudgeStatSummary from "@/components/JudgeStatSummary";
import CorrectionRequest from "@/components/CorrectionRequest";
import {
  getJudge,
  getCourt,
  getArticlesByJudge,
  getCasesByJudge,
  getJudgesForArticle,
  getAllJudges,
  getCaseVoteSummary,
  getArticleVoteSummary,
  getJudgeAgreementRate,
  getJudgeCaseTypeDistribution,
  getJudgeAppealRate,
  getJudgeMonthlyArticleCounts,
  getJudgeMonthlyAgreementRate,
} from "@/lib/data";

export function generateStaticParams() {
  return getAllJudges().map((j) => ({ id: j.id }));
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const judge = getJudge(id);
  if (!judge) return { title: "판사를 찾을 수 없음" };
  return {
    title: `${judge.name} ${judge.position}`,
    description: `${judge.court} 소속 ${judge.name} ${judge.position}의 공개 정보, 관련 뉴스 및 판례.`,
  };
}

function initials(name: string) {
  return name.length > 1 ? name.slice(-2) : name;
}

export default async function JudgePage({ params }: Props) {
  const { id } = await params;
  const judge = getJudge(id);
  if (!judge) notFound();
  const court = getCourt(judge.courtId);
  const rawArticles = getArticlesByJudge(judge.id);
  const articles = rawArticles.map((a) => ({
    ...a,
    judges: getJudgesForArticle(a.id).map((j) => ({
      id: j.id,
      name: j.name,
      court: j.court,
    })),
  }));
  const cases = getCasesByJudge(judge.id);

  const agreement = getJudgeAgreementRate(judge.id);
  const caseVoteSummaries = new Map(
    cases.map((c) => [c.id, getCaseVoteSummary(c.id)])
  );
  const articleVoteSummaries = new Map(
    articles.map((a) => [a.id, getArticleVoteSummary(a.id)])
  );

  const statsData = {
    agreementMonthly: getJudgeMonthlyAgreementRate(judge.id, 12),
    caseDistribution: getJudgeCaseTypeDistribution(judge.id),
    appeal: getJudgeAppealRate(judge.id),
    articleMonthly: getJudgeMonthlyArticleCounts(judge.id, 12),
  };

  const judgeNo = judge.id.replace("judge-", "").padStart(3, "0");

  return (
    <div>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4">
          <nav
            className="flex items-center gap-1.5 text-xs text-muted"
            aria-label="breadcrumb"
          >
            <Link href="/" className="hover:text-navy-900">
              홈
            </Link>
            <span className="text-muted-faint">/</span>
            <Link href="/judges" className="hover:text-navy-900">
              판사
            </Link>
            <span className="text-muted-faint">/</span>
            {court && (
              <>
                <Link
                  href={`/courts/${court.id}`}
                  className="hover:text-navy-900"
                >
                  {court.name}
                </Link>
                <span className="text-muted-faint">/</span>
              </>
            )}
            <span className="text-navy-900 font-medium">{judge.name}</span>
          </nav>
        </div>
      </div>

      <header className="bg-surface border-b border-line">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 lg:py-14">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="relative shrink-0">
              <div className="grid place-items-center h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-navy-100 text-navy-700 text-2xl sm:text-3xl font-bold font-serif">
                {initials(judge.name)}
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 font-mono text-[9px] tabular-nums text-muted-faint bg-surface px-1.5 py-0.5 border border-line rounded-sm">
                #{judgeNo}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="eyebrow eyebrow-civic">판사 프로필</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-[2.4rem] font-bold text-navy-900 leading-tight">
                {judge.name}
                <span className="ml-2 text-base sm:text-lg font-medium text-muted">
                  {judge.position}
                </span>
              </h1>
              <p className="mt-2 text-sm text-muted">
                {court ? (
                  <Link
                    href={`/courts/${court.id}`}
                    className="hover:text-civic-700 underline-offset-2 hover:underline"
                  >
                    {judge.court}
                  </Link>
                ) : (
                  judge.court
                )}{" "}
                · {judge.courtRegion}
              </p>
              {judge.division && (
                <p className="mt-4 text-[14.5px] text-foreground leading-relaxed max-w-3xl border-l-2 border-navy-100 pl-3">
                  {judge.division}
                </p>
              )}
            </div>
          </div>

          <div className="mt-8">
            <JudgeStatSummary
              caseCount={cases.length}
              agreementRate={agreement.rate}
              totalVotes={agreement.totalVotes}
              articleCount={articles.length}
            />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <JudgeTabs
          judgeId={judge.id}
          judgeName={judge.name}
          articles={articles}
          cases={cases}
          caseVoteSummaries={caseVoteSummaries}
          articleVoteSummaries={articleVoteSummaries}
          statsData={statsData}
        />

        <div className="mt-12 pt-6 border-t border-line text-center">
          <CorrectionRequest
            context="judge"
            contextId={judge.id}
            contextLabel={`${judge.name} ${judge.position} 프로필`}
          />
        </div>
      </section>
    </div>
  );
}
