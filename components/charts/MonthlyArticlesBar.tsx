import { useId } from "react";

interface Props {
  judgeName: string;
  data: { month: string; count: number }[]; // 12 entries
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
  const [yyyy, mm] = ym.split("-");
  if (!yyyy || !mm) return ym;
  return `${yyyy.slice(2)}.${mm}`;
}

export default function MonthlyArticlesBar({ judgeName, data }: Props) {
  const titleId = useId();
  const descId = useId();

  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const isEmpty = totalCount === 0;

  if (isEmpty) {
    return (
      <figure>
        <figcaption className="text-[11px] uppercase tracking-[0.16em] text-muted-faint mb-2 font-semibold">
          월별 관련 기사 추이
        </figcaption>
        <div
          className="flex items-center justify-center w-full border border-line bg-paper-100 text-muted-faint text-xs"
          style={{ aspectRatio: `${W} / ${H}` }}
          role="img"
          aria-label={`${judgeName} 판사 월별 관련 기사 추이 — 데이터 없음`}
        >
          수집된 관련 기사가 없습니다
        </div>
      </figure>
    );
  }

  const maxCount = data.reduce((m, d) => Math.max(m, d.count), 0);
  const avgCount = data.length > 0 ? totalCount / data.length : 0;
  const avgRounded = Math.round(avgCount * 10) / 10;
  const maxEntry = data.reduce((a, b) => (a.count >= b.count ? a : b));
  const maxMonthLabel = formatMonthLabel(maxEntry.month);

  // Bar geometry
  const n = data.length;
  const gap = 2;
  const totalGap = gap * (n - 1);
  const barW = (CHART_W - totalGap) / n;

  const bars = data.map((d, i) => {
    const x = PAD_L + i * (barW + gap);
    const h = maxCount > 0 ? (d.count / maxCount) * CHART_H : 0;
    const y = PAD_T + (CHART_H - h);
    const isLast = i === n - 1;
    return { ...d, x, y, h, isLast, idx: i };
  });

  // Average line y
  const avgY = maxCount > 0 ? PAD_T + (CHART_H - (avgCount / maxCount) * CHART_H) : PAD_T + CHART_H;

  // X-axis labels: first, middle, last
  const firstIdx = 0;
  const lastIdx = n - 1;
  const midIdx = Math.floor(n / 2);

  return (
    <figure>
      <figcaption className="text-[11px] uppercase tracking-[0.16em] text-muted-faint mb-2 font-semibold">
        월별 관련 기사 추이
      </figcaption>
      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-muted mb-1">
        <span>평균 {avgRounded}건/월</span>
        <span>합계 {totalCount}건</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <title id={titleId}>{judgeName} 판사 월별 관련 기사 추이</title>
        <desc id={descId}>
          최근 12개월 총 {totalCount}건, 월평균 {avgRounded}건, 최대 {maxCount}건 ({maxMonthLabel})
        </desc>

        {/* Y axis baseline */}
        <line
          x1={PAD_L}
          y1={PAD_T + CHART_H}
          x2={PAD_L + CHART_W}
          y2={PAD_T + CHART_H}
          stroke="var(--color-line)"
          strokeWidth={1}
        />

        {/* Max value (top-right corner above chart) */}
        <text
          x={PAD_L - 4}
          y={PAD_T + 4}
          textAnchor="end"
          className="font-mono tabular-nums"
          style={{ fontSize: 8, fill: "var(--color-muted-faint)" }}
        >
          {maxCount}
        </text>
        <text
          x={PAD_L - 4}
          y={PAD_T + CHART_H + 3}
          textAnchor="end"
          className="font-mono tabular-nums"
          style={{ fontSize: 8, fill: "var(--color-muted-faint)" }}
        >
          0
        </text>

        {/* Bars */}
        {bars.map((b) => (
          <rect
            key={`bar-${b.idx}`}
            x={b.x}
            y={b.y}
            width={Math.max(0.5, barW)}
            height={Math.max(0, b.h)}
            fill={b.isLast ? "var(--color-navy-900)" : "var(--color-civic-600)"}
          />
        ))}

        {/* Average dashed line */}
        {maxCount > 0 && (
          <line
            x1={PAD_L}
            y1={avgY}
            x2={PAD_L + CHART_W}
            y2={avgY}
            stroke="var(--color-muted-faint)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}

        {/* X axis labels */}
        {[firstIdx, midIdx, lastIdx].map((idx) => {
          const b = bars[idx];
          if (!b) return null;
          const tx = b.x + barW / 2;
          return (
            <text
              key={`xl-${idx}`}
              x={tx}
              y={H - 4}
              textAnchor={idx === firstIdx ? "start" : idx === lastIdx ? "end" : "middle"}
              className="font-mono tabular-nums"
              style={{ fontSize: 8, fill: "var(--color-muted-faint)" }}
            >
              {formatMonthLabel(b.month)}
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
              <th className="text-right px-2 py-1">기사 수</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month} className="border-t border-line-soft">
                <td className="px-2 py-1 font-mono tabular-nums">{d.month}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">{d.count}</td>
              </tr>
            ))}
            <tr className="border-t border-line bg-paper-100">
              <td className="px-2 py-1 font-semibold">합계</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums font-semibold">
                {totalCount}
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </figure>
  );
}
