import Link from "next/link";

export default function NoticeBand() {
  return (
    <div className="notice-band text-[12px]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-1.5">
        {/* Mobile — single-line condensed version */}
        <div className="md:hidden flex items-center justify-between gap-2 text-white/85">
          <span className="flex items-center gap-2 min-w-0">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-civic-500 shrink-0"
            />
            <span className="truncate tracking-wide">
              공개 자료 자동 수집·정리 · 비영리
            </span>
          </span>
          <Link
            href="/about#disclaimer"
            className="text-white/70 hover:text-white shrink-0 underline-offset-2 hover:underline"
          >
            면책 ⓘ
          </Link>
        </div>

        {/* Desktop — full notice */}
        <div className="hidden md:flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <div className="flex items-center gap-2 text-white/85">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-civic-500"
            />
            <span className="tracking-wide">
              본 사이트는 공개 자료를 자동 수집·정리하는{" "}
              <strong className="font-semibold text-white">
                비영리 시빅테크
              </strong>{" "}
              프로젝트입니다.
            </span>
          </div>
          <div className="flex items-center gap-4 text-white/70">
            <Link
              href="/about#disclaimer"
              className="hover:text-white underline-offset-2 hover:underline"
            >
              면책 조항
            </Link>
            <Link
              href="/about#data"
              className="hover:text-white underline-offset-2 hover:underline"
            >
              수집 방법
            </Link>
            <span className="tabular-nums text-white/50">v0.1 · 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
