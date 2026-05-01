import { useId } from "react";

interface Props {
  judgeName: string;
  judgeRate: number; // 0~1 파기율
  courtAverage: number; // 0~1
  appealedCount: number;
  reversedCount: number;
}

const W = 280;
const H = 90;
const LABEL_W = 60; // left label column
const VALUE_W = 70; // right value column
const PAD_L = 8;
const PAD_R = 8;
const BAR_H = 12;
const BAR_GAP = 18; // vertical gap between bars

export default function AppealRateGauge({
  judgeName,
  judgeRate,
  courtAverage,
  appealedCount,
  reversedCount,
}: Props) {
  const titleId = useId();
  const descId = useId();

  const judgePct = Math.round(judgeRate * 100);
  const courtPct = Math.round(courtAverage * 100);

  if (appealedCount === 0) {
    return (
      <figure>
        <figcaption className="text-[11px] uppercase tracking-[0.16em] text-muted-faint mb-2 font-semibold">
          항소심 파기율 비교
        </figcaption>
        <div
          className="flex items-center justify-center w-full border border-line bg-paper-100 text-muted-faint text-xs"
          style={{ aspectRatio: `${W} / ${H}` }}
          role="img"
          aria-label={`${judgeName} 판사 항소심 파기율 비교 — 데이터 없음`}
        >
          항소된 사건이 아직 없습니다
        </div>
      </figure>
    );
  }

  // Dynamic max scale: 0~30% default, expands if rate exceeds
  const maxScale = Math.max(0.3, judgeRate, courtAverage);

  // Bar geometry
  const barAreaX = PAD_L + LABEL_W + 4;
  const barAreaW = W - barAreaX - VALUE_W - PAD_R;

  const judgeBarRaw = (judgeRate / maxScale) * barAreaW;
  const courtBarRaw = (courtAverage / maxScale) * barAreaW;
  // Min width 4px for visual recognition (when rate > 0)
  const judgeBarW = judgeRate > 0 ? Math.max(4, judgeBarRaw) : 0;
  const courtBarW = courtAverage > 0 ? Math.max(4, courtBarRaw) : 0;

  // Two rows centered vertically
  const totalRowsH = BAR_H * 2 + BAR_GAP;
  const startY = (H - totalRowsH) / 2;
  const judgeRowY = startY;
  const courtRowY = startY + BAR_H + BAR_GAP;

  // Difference indicator
  const diffPct = Math.round((judgeRate - courtAverage) * 100);
  const diffAbs = Math.abs(diffPct);
  const diffArrow = diffPct > 0 ? "↑" : diffPct < 0 ? "↓" : "•";
  const diffColor =
    diffPct > 0 ? "var(--color-seal-700)" : diffPct < 0 ? "var(--color-civic-600)" : "var(--color-muted)";

  return (
    <figure>
      <figcaption className="text-[11px] uppercase tracking-[0.16em] text-muted-faint mb-2 font-semibold">
        항소심 파기율 비교
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <title id={titleId}>{judgeName} 판사 항소심 파기율 비교</title>
        <desc id={descId}>
          이 판사 파기율 {judgePct}% ({reversedCount}/{appealedCount}건), 같은 법원 평균 {courtPct}%
        </desc>

        {/* Row 1: this judge */}
        <text
          x={PAD_L}
          y={judgeRowY + BAR_H / 2}
          dominantBaseline="middle"
          className="font-mono tabular-nums"
          style={{ fontSize: 9, fill: "var(--color-muted)" }}
        >
          이 판사
        </text>
        {/* track */}
        <rect
          x={barAreaX}
          y={judgeRowY}
          width={barAreaW}
          height={BAR_H}
          fill="var(--color-paper-100)"
          stroke="var(--color-line-soft)"
          strokeWidth={0.5}
        />
        {/* bar */}
        {judgeBarW > 0 && (
          <rect
            x={barAreaX}
            y={judgeRowY}
            width={judgeBarW}
            height={BAR_H}
            fill="var(--color-navy-700)"
          />
        )}
        {/* right value */}
        <text
          x={W - PAD_R}
          y={judgeRowY + BAR_H / 2 - 1}
          textAnchor="end"
          dominantBaseline="middle"
          className="font-mono tabular-nums"
          style={{ fontSize: 11, fill: "var(--color-navy-900)", fontWeight: 600 }}
        >
          {judgePct}%
        </text>
        <text
          x={W - PAD_R}
          y={judgeRowY + BAR_H + 8}
          textAnchor="end"
          className="font-mono tabular-nums"
          style={{ fontSize: 8.5, fill: "var(--color-muted-faint)" }}
        >
          ({reversedCount}/{appealedCount})
        </text>

        {/* Row 2: court average */}
        <text
          x={PAD_L}
          y={courtRowY + BAR_H / 2}
          dominantBaseline="middle"
          className="font-mono tabular-nums"
          style={{ fontSize: 9, fill: "var(--color-muted)" }}
        >
          법원 평균
        </text>
        {/* track */}
        <rect
          x={barAreaX}
          y={courtRowY}
          width={barAreaW}
          height={BAR_H}
          fill="var(--color-paper-100)"
          stroke="var(--color-muted-faint)"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
        {/* bar */}
        {courtBarW > 0 && (
          <rect
            x={barAreaX}
            y={courtRowY}
            width={courtBarW}
            height={BAR_H}
            fill="var(--color-muted-faint)"
          />
        )}
        {/* right value */}
        <text
          x={W - PAD_R}
          y={courtRowY + BAR_H / 2 - 1}
          textAnchor="end"
          dominantBaseline="middle"
          className="font-mono tabular-nums"
          style={{ fontSize: 11, fill: "var(--color-muted)", fontWeight: 600 }}
        >
          {courtPct}%
        </text>

        {/* Difference indicator (right of court row, below) */}
        {diffPct !== 0 && (
          <text
            x={W - PAD_R}
            y={courtRowY + BAR_H + 8}
            textAnchor="end"
            className="font-mono tabular-nums"
            style={{ fontSize: 8.5, fill: diffColor, fontWeight: 600 }}
          >
            {diffArrow} {diffAbs}%p
          </text>
        )}
      </svg>
      <details className="mt-2">
        <summary className="text-[11px] text-muted cursor-pointer hover:text-navy-900">
          표로 보기
        </summary>
        <table className="w-full text-xs mt-2 border border-line">
          <thead className="bg-paper-100 text-muted-faint uppercase tracking-wider text-[10px]">
            <tr>
              <th className="text-left px-2 py-1">구분</th>
              <th className="text-right px-2 py-1">파기율</th>
              <th className="text-right px-2 py-1">건수</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line-soft">
              <td className="px-2 py-1">이 판사</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums">{judgePct}%</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums text-muted-faint">
                {reversedCount}/{appealedCount}
              </td>
            </tr>
            <tr className="border-t border-line-soft">
              <td className="px-2 py-1">법원 평균</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums">{courtPct}%</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums text-muted-faint">
                —
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </figure>
  );
}
