import { useId } from "react";

type CaseTypeKey = "민사" | "형사" | "행정" | "가사";

interface Props {
  judgeName: string;
  distribution: Record<CaseTypeKey, number>;
  total: number;
}

const W = 220;
const H = 140;
const CX = 70;
const CY = 70;
const R_OUTER = 55;
const R_INNER = 35;

const CATEGORY_ORDER: CaseTypeKey[] = ["민사", "형사", "행정", "가사"];
const CATEGORY_COLOR: Record<CaseTypeKey, string> = {
  민사: "var(--color-navy-700)",
  형사: "var(--color-seal-600)",
  행정: "var(--color-civic-600)",
  가사: "var(--color-muted)",
};

function polar(cx: number, cy: number, r: number, angleRad: number): [number, number] {
  return [cx + r * Math.cos(angleRad), cy + r * Math.sin(angleRad)];
}

// Returns SVG path for a donut segment between two angles (radians, clockwise from -90deg)
function donutSegment(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startA: number,
  endA: number
): string {
  const largeArc = endA - startA > Math.PI ? 1 : 0;
  const [sx1, sy1] = polar(cx, cy, rOuter, startA);
  const [ex1, ey1] = polar(cx, cy, rOuter, endA);
  const [sx2, sy2] = polar(cx, cy, rInner, endA);
  const [ex2, ey2] = polar(cx, cy, rInner, startA);

  return [
    `M${sx1.toFixed(2)} ${sy1.toFixed(2)}`,
    `A${rOuter} ${rOuter} 0 ${largeArc} 1 ${ex1.toFixed(2)} ${ey1.toFixed(2)}`,
    `L${sx2.toFixed(2)} ${sy2.toFixed(2)}`,
    `A${rInner} ${rInner} 0 ${largeArc} 0 ${ex2.toFixed(2)} ${ey2.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export default function CaseTypeDonut({ judgeName, distribution, total }: Props) {
  const titleId = useId();
  const descId = useId();

  const sum = CATEGORY_ORDER.reduce((s, k) => s + (distribution[k] ?? 0), 0);

  if (total === 0 || sum === 0) {
    return (
      <figure>
        <figcaption className="text-[11px] uppercase tracking-[0.16em] text-muted-faint mb-2 font-semibold">
          사건유형 분포
        </figcaption>
        <div
          className="flex items-center justify-center w-full border border-line bg-paper-100 text-muted-faint text-xs"
          style={{ aspectRatio: `${W} / ${H}` }}
          role="img"
          aria-label={`${judgeName} 판사 사건유형 분포 — 데이터 없음`}
        >
          담당 판결 데이터가 없습니다
        </div>
      </figure>
    );
  }

  // Build segments
  const segments: { key: CaseTypeKey; count: number; pct: number; pathD: string }[] = [];
  let cursorAngle = -Math.PI / 2; // start at 12 o'clock
  for (const key of CATEGORY_ORDER) {
    const count = distribution[key] ?? 0;
    if (count <= 0) continue;
    const frac = count / sum;
    const startA = cursorAngle;
    const endA = cursorAngle + frac * Math.PI * 2;
    // Avoid full-circle degenerate (single category) — clamp slightly
    const endAdj = frac >= 1 ? startA + Math.PI * 2 - 0.0001 : endA;
    const pathD = donutSegment(CX, CY, R_OUTER, R_INNER, startA, endAdj);
    segments.push({ key, count, pct: frac * 100, pathD });
    cursorAngle = endA;
  }

  // Top type
  const top = segments.slice().sort((a, b) => b.count - a.count)[0];
  const topType = top?.key ?? "-";
  const topCount = top?.count ?? 0;
  const topPercent = top ? Math.round(top.pct) : 0;

  // Legend rows
  const legendX = 140;
  const legendStartY = 30;
  const rowH = 22;

  return (
    <figure>
      <figcaption className="text-[11px] uppercase tracking-[0.16em] text-muted-faint mb-2 font-semibold">
        사건유형 분포
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <title id={titleId}>{judgeName} 판사 사건유형 분포</title>
        <desc id={descId}>
          총 {total}건 중 가장 많은 유형은 {topType} ({topCount}건, {topPercent}%)
        </desc>

        {/* Donut segments */}
        <g>
          {segments.map((s) => (
            <path
              key={`seg-${s.key}`}
              d={s.pathD}
              fill={CATEGORY_COLOR[s.key]}
              stroke="var(--color-surface)"
              strokeWidth={1}
            />
          ))}
        </g>

        {/* Center number */}
        <text
          x={CX}
          y={CY - 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="figure-number tabular-nums"
          style={{
            fontSize: 24,
            fill: "var(--color-navy-900)",
            fontFamily: "var(--font-serif-stack)",
            fontWeight: 700,
          }}
        >
          {total}
        </text>
        <text
          x={CX}
          y={CY + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 10, fill: "var(--color-muted-faint)" }}
        >
          건
        </text>

        {/* Legend */}
        {CATEGORY_ORDER.map((key, idx) => {
          const count = distribution[key] ?? 0;
          const pct = sum > 0 ? Math.round((count / sum) * 100) : 0;
          const y = legendStartY + idx * rowH;
          const dim = count === 0;
          return (
            <g key={`leg-${key}`} opacity={dim ? 0.4 : 1}>
              <rect
                x={legendX}
                y={y - 6}
                width={8}
                height={8}
                fill={CATEGORY_COLOR[key]}
              />
              <text
                x={legendX + 14}
                y={y}
                dominantBaseline="middle"
                style={{ fontSize: 10, fill: "var(--color-navy-900)" }}
              >
                {key}
              </text>
              <text
                x={legendX + 40}
                y={y}
                dominantBaseline="middle"
                className="font-mono tabular-nums"
                style={{ fontSize: 10, fill: "var(--color-muted)" }}
              >
                {count}건
              </text>
              <text
                x={legendX + 70}
                y={y}
                dominantBaseline="middle"
                className="font-mono tabular-nums"
                style={{ fontSize: 9, fill: "var(--color-muted-faint)" }}
              >
                {pct}%
              </text>
            </g>
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
              <th className="text-left px-2 py-1">유형</th>
              <th className="text-right px-2 py-1">건수</th>
              <th className="text-right px-2 py-1">비율</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map((key) => {
              const count = distribution[key] ?? 0;
              const pct = sum > 0 ? Math.round((count / sum) * 100) : 0;
              return (
                <tr key={key} className="border-t border-line-soft">
                  <td className="px-2 py-1">{key}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums">{count}</td>
                  <td className="px-2 py-1 text-right font-mono tabular-nums text-muted-faint">
                    {pct}%
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-line bg-paper-100">
              <td className="px-2 py-1 font-semibold">합계</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums font-semibold">
                {total}
              </td>
              <td className="px-2 py-1 text-right font-mono tabular-nums text-muted-faint">
                100%
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </figure>
  );
}
