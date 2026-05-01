import type { Case, CaseVoteSummary } from "@/lib/types";
import { formatDate } from "@/lib/data";
import CaseVoteWidget from "@/components/CaseVoteWidget";

interface Props {
  caseRecord: Case;
  voteSummary?: CaseVoteSummary;
  showVoteWidget?: boolean;
}

export default function CaseCard({
  caseRecord,
  voteSummary,
  showVoteWidget,
}: Props) {
  const caseNo = caseRecord.id.replace("case-", "");
  const shouldShowVoteWidget =
    voteSummary !== undefined && showVoteWidget !== false;

  // Highlight stronger appeal outcomes (파기환송 / 파기자판) with seal tone.
  const appealStrong =
    caseRecord.appealResult === "파기환송" ||
    caseRecord.appealResult === "파기자판";

  return (
    <article
      id={`case-${caseNo}`}
      className="border border-line bg-surface hover:border-navy-700 transition flex flex-col h-full"
    >
      <div className="flex items-stretch border-b border-line-soft text-[10.5px] tabular-nums shrink-0">
        <span className="px-3 py-1.5 border-r border-line-soft text-muted-faint font-mono">
          판례 #{caseNo.padStart(3, "0")}
        </span>
        <span
          className={`px-3 py-1.5 border-r border-line-soft uppercase tracking-[0.12em] font-semibold ${
            caseRecord.caseType === "형사"
              ? "text-seal-700"
              : caseRecord.caseType === "행정"
                ? "text-civic-700"
                : "text-navy-700"
          }`}
        >
          {caseRecord.caseType}
        </span>
        <time className="px-3 py-1.5 text-muted font-mono">
          선고 {formatDate(caseRecord.decisionDate)}
        </time>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-2 min-h-[1.5rem]">
          <span className="font-mono text-sm font-semibold text-navy-900 tabular-nums">
            {caseRecord.caseNumber}
          </span>
          <span className="tag tag-navy">{caseRecord.decisionResult}</span>
          {caseRecord.isAppealed && (
            <>
              <span
                className={`tag ${appealStrong ? "tag-seal" : "tag-civic"}`}
              >
                항소
              </span>
              {caseRecord.appealResult && (
                <span
                  className={`text-xs ${
                    appealStrong ? "text-seal-700 font-medium" : "text-muted-faint"
                  }`}
                >
                  → {caseRecord.appealResult}
                </span>
              )}
            </>
          )}
          <span className="text-xs text-muted-faint">·</span>
          <span className="text-xs text-muted">{caseRecord.court}</span>
        </div>
        <div className="border-l-2 border-navy-100 pl-3 mb-3">
          <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-faint mb-1">
            AI 요약
          </div>
          <p className="text-sm text-muted leading-relaxed line-clamp-4 min-h-[5.75rem]">
            {caseRecord.aiSummary}
          </p>
        </div>
        {shouldShowVoteWidget && voteSummary && (
          <CaseVoteWidget
            caseId={caseRecord.id}
            caseType={caseRecord.caseType}
            summary={voteSummary}
          />
        )}
        <div className="flex items-center justify-between text-xs pt-3 border-t border-line-soft mt-auto shrink-0">
          <span className="text-muted-faint">
            ※ 자동 생성된 요약입니다. 정확한 판단은 원문을 확인하세요.
          </span>
          <a
            href={caseRecord.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-navy-700 hover:text-civic-700 font-medium"
          >
            원문 판례
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M7 17 17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  );
}
