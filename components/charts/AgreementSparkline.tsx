import { useId } from "react";

interface Props {
  judgeName: string;
  data: { month: string; rate: number; voteCount: number }[]; // 12 entries; rate 0~1
}

const W = 280;
const H = 90;
const PAD_L = 25;
const PAD_R = 5;
const PAD_T = 8;
const PAD_B = 18;
const CHART_W = W - PAD_L - PAD_R;
const CHART_H = H - PAD_T - PAD_B;

function formatMonthLabel(ym: string): string {
  // "2026-04" -> "26.04"
  const [yyyy, mm] = ym.split("-");
  if (!yyyy || !mm) return ym;
  return `${yyyy.slice(2)}.${mm}`;
}

export default function AgreementSparkline({ judgeName, data }: Props) {
  const titleId = useId();
  const descId = useId();

  const totalVotes = data.reduce((s, d) => s + d.voteCount, 0);
  const isEmpty = totalVotes === 0;

  if (isEmpty) {
    return (
      <figure>
        <figcaption className="text-[11px] uppercase tracking-[0.16em] text-muted-faint mb-2 font-semibold">
          시민 동의율 12개월 추이
        </figcaption>
        <div
          className="flex items-center justify-center w-full border border-line bg-paper-100 text-muted-faint text-xs"
          style={{ aspectRatio: `${W} / ${H}` }}
          role="img"
          aria-label={`${judgeName} 판사 시민 동의율 12개월 추이 — 데이터 없음`}
        >
          아직 충분한 투표 데이터가 없습니다
        </div>
      </figure>
    );
  }

  // Build points (skip empty months for line continuity gap rendering)
  const points = data.map((d, i) => {
    const x = PAD_L + (i / Math.max(1, data.length - 1)) * CHART_W;
    // y: rate 0~1 mapped to chart top/bottom (1 -> top, 0 -> bottom)
    const y = PAD_T + (1 - d.rate) * CHART_H;
    return { x, y, ...d };
  });

  // Build line path with gaps for voteCount === 0
  let pathD = "";
  let started = false;
  for (const p of points) {
    if (p.voteCount === 0) {
      started = false;
      continue;
    }
    pathD += started ? ` L${p.x.toFixed(2)} ${p.y.toFixed(2)}` : `M${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    started = true;
  }

  // Area fill — only over non-empty contiguous segments
  const areaSegments: string[] = [];
  let segStart: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.voteCount > 0) {
      if (segStart === null) segStart = i;
      const isLast = i === points.length - 1;
      const next = points[i + 1];
      const segEnd = isLast || !next || next.voteCount === 0;
      if (segEnd && segStart !== null) {
        const seg = points.slice(segStart, i + 1);
        if (seg.length >= 1) {
          let d = `M${seg[0].x.toFixed(2)} ${(PAD_T + CHART_H).toFixed(2)}`;
          for (const s of seg) {
            d += ` L${s.x.toFixed(2)} ${s.y.toFixed(2)}`;
          }
          d += ` L${seg[seg.length - 1].x.toFixed(2)} ${(PAD_T + CHART_H).toFixed(2)} Z`;
          areaSegments.push(d);
        }
        segStart = null;
      }
    }
  }

  // Stats for desc
  const nonEmpty = data.filter((d) => d.voteCount > 0);
  const avg =
    nonEmpty.length > 0
      ? Math.round((nonEmpty.reduce((s, d) => s + d.rate, 0) / nonEmpty.length) * 100)
      : 0;
  const last = nonEmpty.length > 0 ? Math.round(nonEmpty[nonEmpty.length - 1].rate * 100) : 0;
  const min = nonEmpty.length > 0 ? nonEmpty.reduce((a, b) => (a.rate <= b.rate ? a : b)) : null;
  const max = nonEmpty.length > 0 ? nonEmpty.reduce((a, b) => (a.rate >= b.rate ? a : b)) : null;

  const minPct = min ? Math.round(min.rate * 100) : 0;
  const maxPct = max ? Math.round(max.rate * 100) : 0;
  const minMonth = min ? formatMonthLabel(min.month) : "-";
  const maxMonth = max ? formatMonthLabel(max.month) : "-";

  // Last point with data (for highlighted dot)
  const lastWithData = [...points].reverse().find((p) => p.voteCount > 0);

  // X-axis label indices: first, middle, last
  const firstIdx = 0;
  const lastIdx = data.length - 1;
  const midIdx = Math.floor(data.length / 2);

  // Y baseline at 50%
  const y50 = PAD_T + 0.5 * CHART_H;

  return (
    <figure>
      <figcaption className="text-[11px] uppercase tracking-[0.16em] text-muted-faint mb-2 font-semibold">
        시민 동의율 12개월 추이
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <title id={titleId}>{judgeName} 판사 시민 동의율 12개월 추이</title>
        <desc id={descId}>
          평균 {avg}%, 최근값 {last}%, 최저 {minPct}% ({minMonth}), 최고 {maxPct}% ({maxMonth})
        </desc>

        {/* Y-axis tick lines (subtle) */}
        <line
          x1={PAD_L}
          y1={PAD_T}
          x2={PAD_L}
          y2={PAD_T + CHART_H}
          stroke="var(--color-line)"
          strokeWidth={1}
        />

        {/* 50% baseline (dashed) */}
        <line
          x1={PAD_L}
          y1={y50}
          x2={PAD_L + CHART_W}
          y2={y50}
          stroke="var(--color-muted-faint)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />

        {/* Y axis labels */}
        <text
          x={PAD_L - 4}
          y={PAD_T + 3}
          textAnchor="end"
          className="font-mono tabular-nums"
          style={{ fontSize: 8, fill: "var(--color-muted-faint)" }}
        >
          100%
        </text>
        <text
          x={PAD_L - 4}
          y={y50 + 3}
          textAnchor="end"
          className="font-mono tabular-nums"
          style={{ fontSize: 8, fill: "var(--color-muted-faint)" }}
        >
          50%
        </text>
        <text
          x={PAD_L - 4}
          y={PAD_T + CHART_H + 3}
          textAnchor="end"
          className="font-mono tabular-nums"
          style={{ fontSize: 8, fill: "var(--color-muted-faint)" }}
        >
          0%
        </text>

        {/* Area fill */}
        {areaSegments.map((d, i) => (
          <path
            key={`area-${i}`}
            d={d}
            fill="var(--color-civic-100)"
            fillOpacity={0.6}
          />
        ))}

        {/* Line path */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="var(--color-civic-600)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Dots */}
        {points.map((p, i) => {
          if (p.voteCount === 0) return null;
          const isLast = lastWithData && p.x === lastWithData.x && p.y === lastWithData.y;
          return (
            <circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={isLast ? 3 : 1.5}
              fill={isLast ? "var(--color-civic-600)" : "var(--color-navy-700)"}
            />
          );
        })}

        {/* X axis labels (3 only) */}
        {[firstIdx, midIdx, lastIdx].map((idx) => {
          const p = points[idx];
          if (!p) return null;
          return (
            <text
              key={`xl-${idx}`}
              x={p.x}
              y={H - 4}
              textAnchor={idx === firstIdx ? "start" : idx === lastIdx ? "end" : "middle"}
              className="font-mono tabular-nums"
              style={{ fontSize: 8, fill: "var(--color-muted-faint)" }}
            >
              {formatMonthLabel(p.month)}
            </text>
          );
        })}
      </svg>
      <details className="mt-2">
        <summary className="text-[11px] text-muted cursor-pointer hover:text-navy-900">
          표로 보기
        </summary>
        <table className="w-full text-xs mt-2 border border-line">
          <thead className="bg-paper-100 text-muted-faint uppercase tracking-wider text-[10px]">
            <tr>
              <th className="text-left px-2 py-1">월</th>
              <th className="text-right px-2 py-1">동의율</th>
              <th className="text-right px-2 py-1">투표수</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month} className="border-t border-line-soft">
                <td className="px-2 py-1 font-mono tabular-nums">{d.month}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">
                  {d.voteCount > 0 ? `${Math.round(d.rate * 100)}%` : "—"}
                </td>
                <td className="px-2 py-1 text-right font-mono tabular-nums text-muted-faint">
                  {d.voteCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
