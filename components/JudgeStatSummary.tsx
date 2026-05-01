interface Props {
  caseCount: number;
  agreementRate: number; // 0~1
  totalVotes: number;
  articleCount: number;
}

export default function JudgeStatSummary({
  caseCount,
  agreementRate,
  totalVotes,
  articleCount,
}: Props) {
  const hasVotes = totalVotes > 0;
  const agreementPct = hasVotes ? Math.round(agreementRate * 100) : 0;

  return (
    <div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line-soft border border-line">
        <StatTile label="담당 판결" value={caseCount.toLocaleString("ko-KR")} />

        <StatTile
          label="판결 동의율 평균"
          value={hasVotes ? `${agreementPct}%` : "—"}
          ariaLabel={
            hasVotes
              ? `판결 동의율 평균 ${agreementPct}%`
              : "판결 동의율 평균 데이터 없음"
          }
          baseline={
            hasVotes ? (
              <>
                <div
                  className="mt-2 h-1 w-full bg-paper-100 border border-line-soft"
                  role="progressbar"
                  aria-valuenow={agreementPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`판결 동의율 평균 ${agreementPct}%`}
                >
                  <div
                    className="h-full bg-civic-600"
                    style={{ width: `${agreementPct}%` }}
                    aria-hidden
                  />
                </div>
                <div className="text-[9px] text-muted-faint mt-1 leading-tight">
                  (판결별 평균)
                </div>
              </>
            ) : (
              <>
                <div
                  className="mt-2 h-1 w-full bg-paper-100 border border-line-soft"
                  aria-hidden
                />
                <div className="text-[9px] text-muted-faint mt-1 leading-tight">
                  (판결별 평균)
                </div>
              </>
            )
          }
        />

        <StatTile
          label="시민 투표"
          value={totalVotes.toLocaleString("ko-KR")}
          sublabel={hasVotes ? `총 ${totalVotes.toLocaleString("ko-KR")}표` : "투표 없음"}
        />

        <StatTile
          label="관련 기사"
          value={articleCount.toLocaleString("ko-KR")}
        />
      </dl>
      <p className="mt-2 text-[11px] text-muted-faint leading-relaxed">
        ※ 위 통계는 판결별 시민 투표의 평균이며, 운영자의 평가가 아닙니다.
      </p>
    </div>
  );
}

function StatTile({
  label,
  value,
  baseline,
  sublabel,
  ariaLabel,
}: {
  label: string;
  value: string;
  baseline?: React.ReactNode;
  sublabel?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="bg-surface px-4 py-3" aria-label={ariaLabel}>
      <dt className="text-[10.5px] uppercase tracking-[0.16em] text-muted-faint font-semibold">
        {label}
      </dt>
      <dd className="figure-number text-[1.6rem] leading-none mt-1.5 tabular-nums">
        {value}
      </dd>
      {baseline}
      {sublabel && (
        <div className="text-[10.5px] text-muted-faint mt-1.5 font-mono tabular-nums">
          {sublabel}
        </div>
      )}
    </div>
  );
}
