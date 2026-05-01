import JudgesIndex from "@/components/JudgesIndex";
import { getAllJudgesWithFullStats } from "@/lib/data";

export const metadata = {
  title: "전체 판사 명단",
  description:
    "PansaWatch에 등록된 전체 법관 명단. 직위·임관 연도·시민 동의율로 정렬·탐색.",
};

export default function JudgesPage() {
  const allJudges = getAllJudgesWithFullStats();
  const totalJudges = allJudges.length;
  const positions = Array.from(
    new Set(allJudges.map((j) => j.position))
  ).sort((a, b) => a.localeCompare(b, "ko-KR"));

  return (
    <div>
      <header className="bg-surface border-b border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 lg:py-14">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow eyebrow-civic">전체 판사 명단</span>
            <span className="font-mono text-[10px] tabular-nums text-muted-faint">
              JUDGES §
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-navy-900 leading-tight">
            등록 판사{" "}
            <span className="tabular-nums">
              {totalJudges.toLocaleString("ko-KR")}
            </span>
            명
          </h1>
          <p className="mt-3 text-sm text-muted max-w-md leading-relaxed">
            대법원 인사발령 등 공개 자료 기반. 직위·임관 연도순으로 탐색.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <JudgesIndex judges={allJudges} positions={positions} />
      </section>
    </div>
  );
}
