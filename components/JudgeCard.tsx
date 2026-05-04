import Link from "next/link";
import { getJudgePath } from "@/lib/data";
import type { JudgeWithStats } from "@/lib/types";

interface Props {
  judge: JudgeWithStats;
  variant?: "default" | "compact";
  agreementRate?: number; // 0~1; if undefined, 표시 안 함
  agreementVotes?: number; // total votes count
}

function initials(name: string): string {
  return name.length > 1 ? name.slice(-2) : name;
}

export default function JudgeCard({
  judge,
  variant = "default",
  agreementRate,
  agreementVotes,
}: Props) {
  const judgeNo = judge.id.replace("judge-", "").padStart(3, "0");

  if (variant === "compact") {
    return (
      <Link
        href={getJudgePath(judge)}
        className="flex items-center gap-3 py-2 px-2 -mx-2 rounded hover:bg-navy-50 transition"
      >
        <div className="grid place-items-center h-9 w-9 rounded-full bg-navy-100 text-navy-700 text-xs font-semibold shrink-0">
          {initials(judge.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-navy-900 truncate">
            {judge.name}
          </div>
          <div className="text-xs text-muted truncate">{judge.position}</div>
        </div>
        <span className="text-xs text-muted-soft shrink-0 tabular-nums">
          {judge.articleCount}건
        </span>
      </Link>
    );
  }

  const showAgreement =
    typeof agreementRate === "number" &&
    typeof agreementVotes === "number" &&
    agreementVotes > 0;
  const agreementPct = showAgreement
    ? Math.round((agreementRate as number) * 100)
    : 0;

  return (
    <Link
      href={getJudgePath(judge)}
      className="block border border-line bg-surface hover:border-navy-700 hover:shadow-sm transition group"
    >
      <div className="flex items-stretch border-b border-line-soft text-[10px] tabular-nums">
        <span className="px-2.5 py-1 border-r border-line-soft text-muted-faint font-mono">
          판사 #{judgeNo}
        </span>
        <span className="px-2.5 py-1 text-muted uppercase tracking-[0.12em] font-semibold">
          {judge.position}
        </span>
      </div>
      <div className="flex items-start gap-4 p-5">
        <div className="grid place-items-center h-12 w-12 rounded-full bg-navy-100 text-navy-700 text-base font-semibold shrink-0 group-hover:bg-navy-700 group-hover:text-white transition font-serif">
          {initials(judge.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg font-semibold text-navy-900 truncate mb-1">
            {judge.name}
          </h3>
          <div className="text-xs text-muted mb-2 truncate">{judge.court}</div>
          {judge.division && (
            <p className="text-xs text-muted leading-relaxed line-clamp-2 mb-3">
              {judge.division}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-2 border-t border-line-soft text-[11px]">
            <span className="text-muted-faint tabular-nums">
              관련 기사{" "}
              <span className="font-semibold text-navy-900">
                {judge.articleCount}
              </span>
            </span>
            <span className="text-line-soft" aria-hidden>
              ·
            </span>
            <span className="text-muted-faint tabular-nums">
              담당 판례{" "}
              <span className="font-semibold text-navy-900">
                {judge.caseCount}
              </span>
            </span>
            {showAgreement && (
              <>
                <span className="text-line-soft" aria-hidden>
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <span className="text-civic-700">
                    판결 동의율{" "}
                    <span className="font-semibold">{agreementPct}%</span>
                  </span>
                  <span className="text-muted-faint font-mono text-[10.5px]">
                    ({agreementVotes}표)
                  </span>
                  <AgreementMiniBar
                    pct={agreementPct}
                    label={`${agreementPct}% 판결 동의`}
                  />
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function AgreementMiniBar({ pct, label }: { pct: number; label: string }) {
  const safePct = Math.max(0, Math.min(100, pct));
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 60 8"
      width="60"
      height="8"
      className="shrink-0 ml-0.5"
    >
      <rect x="0" y="0" width="60" height="8" fill="var(--color-paper-100)" />
      <rect
        x="0"
        y="0"
        width={(60 * safePct) / 100}
        height="8"
        fill="var(--color-civic-600)"
      />
      <rect
        x="0"
        y="0"
        width="60"
        height="8"
        fill="none"
        stroke="var(--color-line-soft)"
        strokeWidth="1"
      />
    </svg>
  );
}
