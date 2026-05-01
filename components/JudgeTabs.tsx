"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import ArticleCard from "@/components/ArticleCard";
import CaseCard from "@/components/CaseCard";
import {
  AgreementSparkline,
  CaseTypeDonut,
  AppealRateGauge,
  MonthlyArticlesBar,
} from "@/components/charts";
import type {
  Article,
  ArticleVoteSummary,
  Case,
  CaseType,
  CaseVoteSummary,
} from "@/lib/types";

type ArticleWithJudgesLite = Article & {
  judges: { id: string; name: string; court: string }[];
};

interface StatsData {
  agreementMonthly: { month: string; rate: number; voteCount: number }[];
  caseDistribution: Record<CaseType, number>;
  appeal: {
    rate: number;
    courtAverage: number;
    appealedCount: number;
    reversedCount: number;
  };
  articleMonthly: { month: string; count: number }[];
}

interface Props {
  judgeId: string;
  judgeName: string;
  articles: ArticleWithJudgesLite[];
  cases: Case[];
  caseVoteSummaries: Map<string, CaseVoteSummary>;
  articleVoteSummaries: Map<string, ArticleVoteSummary>;
  statsData: StatsData;
}

type Tab = "cases" | "news" | "stats";

const TAB_ORDER: Tab[] = ["cases", "news", "stats"];

export default function JudgeTabs({
  judgeName,
  articles,
  cases,
  caseVoteSummaries,
  articleVoteSummaries,
  statsData,
}: Props) {
  const [tab, setTab] = useState<Tab>("cases");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    cases: null,
    news: null,
    stats: null,
  });

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = TAB_ORDER.indexOf(tab);
    const nextIdx =
      e.key === "ArrowRight"
        ? (idx + 1) % TAB_ORDER.length
        : (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    const next = TAB_ORDER[nextIdx]!;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div>
      <div className="border-b border-line">
        <div className="flex gap-1" role="tablist" aria-label="판사 정보 탭">
          <TabButton
            id="tab-cases"
            controls="panel-cases"
            active={tab === "cases"}
            onClick={() => setTab("cases")}
            onKeyDown={handleTabKeyDown}
            label="담당 판례"
            count={cases.length}
            tabRef={(el) => {
              tabRefs.current.cases = el;
            }}
          />
          <TabButton
            id="tab-news"
            controls="panel-news"
            active={tab === "news"}
            onClick={() => setTab("news")}
            onKeyDown={handleTabKeyDown}
            label="관련 뉴스"
            count={articles.length}
            tabRef={(el) => {
              tabRefs.current.news = el;
            }}
          />
          <TabButton
            id="tab-stats"
            controls="panel-stats"
            active={tab === "stats"}
            onClick={() => setTab("stats")}
            onKeyDown={handleTabKeyDown}
            label="통계"
            tabRef={(el) => {
              tabRefs.current.stats = el;
            }}
          />
        </div>
      </div>

      <div className="mt-6">
        {tab === "cases" && (
          <div
            role="tabpanel"
            id="panel-cases"
            aria-labelledby="tab-cases"
            tabIndex={0}
            className="space-y-4"
          >
            {cases.length === 0 ? (
              <EmptyState
                title="등록된 판례가 없습니다."
                description="공개된 판결문에서 이 판사가 담당한 사건이 확인되면 등록됩니다."
              />
            ) : (
              cases.map((c) => (
                <CaseCard
                  key={c.id}
                  caseRecord={c}
                  voteSummary={caseVoteSummaries.get(c.id)}
                />
              ))
            )}
            {cases.length > 0 && <DisclaimerBanner />}
          </div>
        )}
        {tab === "news" && (
          <div
            role="tabpanel"
            id="panel-news"
            aria-labelledby="tab-news"
            tabIndex={0}
            className="space-y-4"
          >
            {articles.length === 0 ? (
              <EmptyState
                title="아직 수집된 기사가 없습니다."
                description="이 판사와 관련된 공개 기사를 찾는 즉시 표시됩니다."
              />
            ) : (
              articles.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  voteSummary={articleVoteSummaries.get(a.id)}
                />
              ))
            )}
            {articles.length > 0 && <DisclaimerBanner />}
          </div>
        )}
        {tab === "stats" && (
          <div
            role="tabpanel"
            id="panel-stats"
            aria-labelledby="tab-stats"
            tabIndex={0}
          >
            <p className="mb-6 text-[12px] text-muted-faint leading-relaxed border-l-2 border-line-soft pl-3">
              ※ 통계는 공개 판결문 메타데이터에서 추출한 집계이며, 시민 동의율은 판결별 투표의 평균입니다. 운영자의 평가가 아닙니다.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <AgreementSparkline
                judgeName={judgeName}
                data={statsData.agreementMonthly}
              />
              <CaseTypeDonut
                judgeName={judgeName}
                distribution={statsData.caseDistribution}
                total={cases.length}
              />
              <AppealRateGauge
                judgeName={judgeName}
                judgeRate={statsData.appeal.rate}
                courtAverage={statsData.appeal.courtAverage}
                appealedCount={statsData.appeal.appealedCount}
                reversedCount={statsData.appeal.reversedCount}
              />
              <MonthlyArticlesBar
                judgeName={judgeName}
                data={statsData.articleMonthly}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  id,
  controls,
  active,
  onClick,
  onKeyDown,
  label,
  count,
  badge,
  tabRef,
}: {
  id: string;
  controls: string;
  active: boolean;
  onClick: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  label: string;
  count?: number;
  badge?: string;
  tabRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={tabRef}
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`relative px-4 py-3 text-sm font-medium transition ${
        active ? "text-navy-900" : "text-muted hover:text-navy-900"
      }`}
    >
      <span>{label}</span>
      {typeof count === "number" && (
        <span className="ml-2 inline-flex min-w-[1.5rem] justify-center rounded bg-navy-50 px-1.5 py-0.5 text-[11px] tabular-nums text-navy-700">
          {count}
        </span>
      )}
      {badge && (
        <span className="ml-2 inline-flex items-center rounded bg-paper-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-soft">
          {badge}
        </span>
      )}
      {active && (
        <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-civic-600" />
      )}
    </button>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border border-dashed border-line bg-white py-12 px-6 text-center">
      <p className="font-medium text-navy-900">{title}</p>
      <p className="text-sm text-muted mt-1">{description}</p>
    </div>
  );
}

function DisclaimerBanner() {
  return (
    <div className="mt-2 border border-line-soft bg-paper-100 px-4 py-2.5 text-xs text-muted flex items-start gap-2">
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-muted-faint shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
      <span>
        이 페이지의 요약문은 모두 AI가 생성한 것이며, 정확한 내용은 원문을
        확인하세요. 운영자는 어떠한 의견도 제공하지 않습니다.
      </span>
    </div>
  );
}
