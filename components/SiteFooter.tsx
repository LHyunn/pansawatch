import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-12">
        <div className="md:col-span-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid place-items-center h-7 w-7 bg-navy-900 text-white text-[11px] font-bold font-serif rounded-sm"
            >
              判
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-serif text-lg font-bold text-navy-900">
                PansaWatch
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-faint font-mono">
                .org
              </span>
            </span>
          </div>
          <p className="text-sm text-muted leading-relaxed max-w-md">
            대한민국 법관에 대한 공개 뉴스와 판례 정보를 자동으로 수집·정리해
            시민이 열람할 수 있도록 하는 비영리 시빅테크 기록물입니다.
          </p>
          <p className="text-[11.5px] text-muted-faint leading-relaxed max-w-md">
            본 사이트의 모든 요약문은 자동 생성된 것이며, 정확한 내용은 원문 기사
            및 판례 원문을 확인하시기 바랍니다.
          </p>
        </div>

        <div className="md:col-span-3">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-faint mb-3">
            기록 열람
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/" className="text-muted hover:text-navy-900">
                지도로 보기
              </Link>
            </li>
            <li>
              <Link href="/news" className="text-muted hover:text-navy-900">
                전체 뉴스
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-muted hover:text-navy-900">
                프로젝트 소개
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-faint mb-3">
            정책 및 책임
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/about#disclaimer"
                className="text-muted hover:text-navy-900"
              >
                면책 조항
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="text-muted hover:text-navy-900"
              >
                개인정보 처리방침
              </Link>
            </li>
            <li>
              <Link
                href="/about#data"
                className="text-muted hover:text-navy-900"
              >
                데이터 수집 방법
              </Link>
            </li>
            <li>
              <Link
                href="/about#contact"
                className="text-muted hover:text-navy-900"
              >
                오류 신고 · 정정 요청
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line-soft">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-[11px] text-muted-faint font-mono tabular-nums">
          <span>
            © {new Date().getFullYear()} PansaWatch · 비영리 시빅테크 기록물
          </span>
          <span className="flex items-center gap-3">
            <span>광고 없음</span>
            <span className="text-line">·</span>
            <span>운영자 편집 없음</span>
            <span className="text-line">·</span>
            <span>자동 수집 v0.1</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
