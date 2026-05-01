import Link from "next/link";

export const metadata = {
  title: "기록을 찾을 수 없음",
  description:
    "요청하신 페이지를 찾을 수 없습니다. PansaWatch는 공개 자료를 자동 수집·정리합니다.",
};

interface ActionItem {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ACTIONS: ActionItem[] = [
  {
    href: "/judges",
    title: "전체 판사 명단",
    description: "등록된 법관을 이름·법원·지역으로 탐색합니다.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/",
    title: "법원별 탐색",
    description: "전국 법원 분포 지도와 색인을 확인합니다.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 21V7l9-4 9 4v14" />
        <path d="M9 21V11h6v10" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
  {
    href: "/news",
    title: "전체 뉴스",
    description: "키워드 기반 자동 수집된 공개 보도 피드입니다.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 4h12a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2Z" />
        <path d="M8 8h6" />
        <path d="M8 12h6" />
        <path d="M8 16h4" />
      </svg>
    ),
  },
  {
    href: "/about",
    title: "프로젝트 소개",
    description: "수집 원칙·법적 안전성·면책 고지를 안내합니다.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01" />
        <path d="M11 12h1v4h1" />
      </svg>
    ),
  },
];

export default function NotFound() {
  return (
    <div className="bg-paper">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20">
        <section
          aria-labelledby="not-found-title"
          className="border-b border-line pb-10"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="eyebrow">기록을 찾을 수 없음</span>
            <span className="font-mono text-[10px] tabular-nums text-muted-faint">
              404
            </span>
          </div>
          <h1
            id="not-found-title"
            className="font-serif text-3xl sm:text-4xl font-bold text-navy-900 leading-tight"
          >
            요청하신 기록을 찾을 수 없습니다.
          </h1>
          <p className="mt-5 text-[15px] text-muted leading-relaxed max-w-xl">
            PansaWatch는 공개 자료를 자동 수집·정리합니다. 다른 검색어로
            시도하시거나 아래 진입점을 이용해 주세요.
          </p>
        </section>

        <section
          aria-label="다른 진입점으로 이동"
          className="mt-10"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="eyebrow eyebrow-civic">진입점</span>
            <span className="font-mono text-[10px] tabular-nums text-muted-faint">
              §A
            </span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ACTIONS.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="block border border-line bg-surface p-5 hover:border-navy-700 transition"
                  aria-label={it.title}
                >
                  <div className="flex items-center gap-2 text-civic-700 mb-2">
                    {it.icon}
                    <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-muted-faint">
                      이동
                    </span>
                  </div>
                  <div className="text-sm font-medium text-navy-900">
                    {it.title}
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    {it.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 pt-6 border-t border-line-soft text-xs text-muted-faint">
          URL을 직접 입력하셨다면 오타가 있을 수 있습니다.
        </p>
      </div>
    </div>
  );
}
