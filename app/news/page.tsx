import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import {
  getArticlesPage,
  getAllSources,
  getAllRegions,
  getStats,
} from "@/lib/data";

interface Props {
  searchParams: Promise<{
    page?: string;
    source?: string;
    region?: string;
    period?: string;
  }>;
}

export const metadata = {
  title: "뉴스 피드",
  description: "PansaWatch가 자동 수집한 법관 관련 공개 뉴스 기사 전체.",
};

const PAGE_SIZE = 12;

type PeriodKey = "1w" | "1m" | "3m" | "6m" | "all";

const PERIOD_OPTIONS: { label: string; value: PeriodKey }[] = [
  { label: "전체", value: "all" },
  { label: "최근 1주", value: "1w" },
  { label: "최근 1개월", value: "1m" },
  { label: "최근 3개월", value: "3m" },
  { label: "최근 6개월", value: "6m" },
];

const PERIOD_LABELS: Record<PeriodKey, string> = {
  all: "전체 기간",
  "1w": "최근 1주",
  "1m": "최근 1개월",
  "3m": "최근 3개월",
  "6m": "최근 6개월",
};

function periodToFromIso(period: PeriodKey | undefined): string | undefined {
  if (!period || period === "all") return undefined;
  const now = new Date();
  const d = new Date(now);
  switch (period) {
    case "1w":
      d.setUTCDate(d.getUTCDate() - 7);
      break;
    case "1m":
      d.setUTCMonth(d.getUTCMonth() - 1);
      break;
    case "3m":
      d.setUTCMonth(d.getUTCMonth() - 3);
      break;
    case "6m":
      d.setUTCMonth(d.getUTCMonth() - 6);
      break;
  }
  return d.toISOString();
}

export default async function NewsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const source = sp.source || undefined;
  const region = sp.region || undefined;
  const periodRaw = sp.period as PeriodKey | undefined;
  const period: PeriodKey =
    periodRaw && PERIOD_OPTIONS.some((p) => p.value === periodRaw)
      ? periodRaw
      : "all";
  const from = periodToFromIso(period);

  const { items, total } = getArticlesPage({
    page,
    pageSize: PAGE_SIZE,
    source,
    region,
    from,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sources = getAllSources();
  const regions = getAllRegions();
  const stats = getStats();

  const hasFilter = Boolean(source || region || (period && period !== "all"));

  function buildHref(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      page: String(page),
      source,
      region,
      period: period === "all" ? undefined : period,
      ...overrides,
    };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const qs = params.toString();
    return qs ? `/news?${qs}` : "/news";
  }

  return (
    <div>
      <header className="bg-surface border-b border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 lg:py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="eyebrow eyebrow-civic">자동 수집 기록</span>
                <span className="font-mono text-[10px] tabular-nums text-muted-faint">
                  NEWS §
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-[2.4rem] font-bold text-navy-900 leading-tight">
                전체 수집 뉴스
              </h1>
              <p className="mt-3 text-sm text-muted max-w-md leading-relaxed">
                자동 수집된 모든 공개 기사. 키워드 기반 자동 수집이며 운영자가
                편집·선별하지 않습니다.
              </p>
            </div>
            <div className="hidden sm:block text-right">
              <div className="figure-number text-[2rem] leading-none">
                {stats.articles.toLocaleString()}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-faint mt-1">
                총 수집 기사
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 lg:py-10">
        <div className="grid lg:grid-cols-4 gap-6 lg:gap-8">
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-20 space-y-5">
              <FilterGroup
                title="기간"
                items={PERIOD_OPTIONS.map((opt) => ({
                  label: opt.label,
                  value: opt.value === "all" ? undefined : opt.value,
                }))}
                active={period === "all" ? undefined : period}
                buildHref={(v) => buildHref({ period: v, page: "1" })}
              />
              <FilterGroup
                title="언론사"
                items={[
                  { label: "전체", value: undefined },
                  ...sources.map((s) => ({ label: s, value: s })),
                ]}
                active={source}
                buildHref={(v) => buildHref({ source: v, page: "1" })}
              />
              <FilterGroup
                title="법원 지역"
                items={[
                  { label: "전체", value: undefined },
                  ...regions.map((r) => ({ label: r, value: r })),
                ]}
                active={region}
                buildHref={(v) => buildHref({ region: v, page: "1" })}
              />
              {hasFilter && (
                <Link
                  href="/news"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-civic-700 hover:underline"
                  aria-label="모든 필터 초기화"
                >
                  ✕ 필터 초기화
                </Link>
              )}
            </div>
          </aside>

          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4 text-xs text-muted">
              <span>
                {hasFilter && (
                  <>
                    <span className="text-civic-700 font-medium">
                      {PERIOD_LABELS[period]}
                    </span>
                    {(source || region) && " · 필터 적용됨"} ·{" "}
                  </>
                )}
                <span className="font-medium text-navy-900 tabular-nums">
                  {total.toLocaleString()}건
                </span>
                {total > 0 && (
                  <>
                    {" "}
                    중{" "}
                    {Math.min(
                      (page - 1) * PAGE_SIZE + 1,
                      total
                    ).toLocaleString()}
                    -{Math.min(page * PAGE_SIZE, total).toLocaleString()}
                  </>
                )}
              </span>
              <span>
                {page} / {totalPages}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="border border-dashed border-line bg-white py-16 px-6 text-center">
                <p className="font-medium text-navy-900">
                  해당 조건의 기록이 없습니다.
                </p>
                <p className="text-sm text-muted mt-1.5 leading-relaxed">
                  {period !== "all"
                    ? "다른 기간을 시도해보시거나, 언론사·지역 필터를 해제해 보세요."
                    : "언론사·지역 필터를 조정하거나 초기화해 보세요."}
                </p>
                <Link
                  href="/news"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-civic-700 hover:underline mt-4"
                >
                  ✕ 필터 초기화
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                buildHref={(p) => buildHref({ page: String(p) })}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function FilterGroup({
  title,
  items,
  active,
  buildHref,
}: {
  title: string;
  items: { label: string; value?: string }[];
  active?: string;
  buildHref: (v?: string) => string;
}) {
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wider text-muted-soft font-semibold mb-2">
        {title}
      </h3>
      <ul className="space-y-0.5 max-h-64 overflow-y-auto overflow-x-hidden">
        {items.map((it) => {
          const isActive = (active ?? undefined) === (it.value ?? undefined);
          return (
            <li key={it.label}>
              <Link
                href={buildHref(it.value)}
                aria-current={isActive ? "true" : undefined}
                className={`block text-sm py-2.5 px-2 sm:py-1 rounded transition truncate min-h-[44px] sm:min-h-0 flex items-center ${
                  isActive
                    ? "bg-navy-700 text-white font-medium"
                    : "text-muted hover:text-navy-900 hover:bg-navy-50"
                }`}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (p: number) => string;
}) {
  const window: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) window.push(i);

  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="pagination">
      {page > 1 && (
        <Link
          href={buildHref(page - 1)}
          className="px-3 py-2 text-sm border border-line bg-white hover:border-navy-500"
        >
          ← 이전
        </Link>
      )}
      {window[0]! > 1 && (
        <>
          <Link
            href={buildHref(1)}
            className="px-3 py-2 text-sm border border-line bg-white hover:border-navy-500"
          >
            1
          </Link>
          {window[0]! > 2 && (
            <span className="px-2 text-muted-soft">…</span>
          )}
        </>
      )}
      {window.map((p) => (
        <Link
          key={p}
          href={buildHref(p)}
          className={`px-3 py-2 text-sm border ${
            p === page
              ? "border-navy-700 bg-navy-700 text-white font-medium"
              : "border-line bg-white hover:border-navy-500"
          }`}
        >
          {p}
        </Link>
      ))}
      {window[window.length - 1]! < totalPages && (
        <>
          {window[window.length - 1]! < totalPages - 1 && (
            <span className="px-2 text-muted-soft">…</span>
          )}
          <Link
            href={buildHref(totalPages)}
            className="px-3 py-2 text-sm border border-line bg-white hover:border-navy-500"
          >
            {totalPages}
          </Link>
        </>
      )}
      {page < totalPages && (
        <Link
          href={buildHref(page + 1)}
          className="px-3 py-2 text-sm border border-line bg-white hover:border-navy-500"
        >
          다음 →
        </Link>
      )}
    </nav>
  );
}
