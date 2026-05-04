"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useRef } from "react";
import judgesData from "@/data/judges.json";
import courtsData from "@/data/courts.json";
import casesData from "@/data/cases.json";
import { formatDate, getJudgePathById, getCourtPath } from "@/lib/data";
import type { Case, Court, Judge } from "@/lib/types";

const judges = judgesData as Judge[];
const courts = courtsData as Court[];
const cases = casesData as Case[];

const judgeById = new Map(judges.map((j) => [j.id, j]));

const navItems = [
  { href: "/", label: "홈" },
  { href: "/judges", label: "판사" },
  { href: "/news", label: "뉴스" },
  { href: "/about", label: "소개" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const qRaw = query.trim();

  const judgeMatches = useMemo(
    () =>
      q
        ? judges
            .filter(
              (j) =>
                j.name.toLowerCase().includes(q) ||
                j.court.toLowerCase().includes(q)
            )
            .slice(0, 5)
        : [],
    [q]
  );
  const caseMatches = useMemo(
    () =>
      qRaw
        ? cases.filter((c) => c.caseNumber.includes(qRaw)).slice(0, 5)
        : [],
    [qRaw]
  );
  const courtMatches = useMemo(
    () =>
      q
        ? courts
            .filter(
              (c) =>
                c.name.toLowerCase().includes(q) ||
                c.region.toLowerCase().includes(q)
            )
            .slice(0, 3)
        : [],
    [q]
  );

  const flatResults = useMemo(() => {
    type Result = { kind: "judge" | "case" | "court"; href: string; id: string };
    const list: Result[] = [];
    for (const j of judgeMatches) {
      list.push({ kind: "judge", href: getJudgePathById(j.id), id: j.id });
    }
    for (const c of caseMatches) {
      list.push({
        kind: "case",
        href: `${getJudgePathById(c.judgeId)}#case-${c.id.replace("case-", "")}`,
        id: c.id,
      });
    }
    for (const c of courtMatches) {
      list.push({ kind: "court", href: getCourtPath(c), id: c.id });
    }
    return list;
  }, [judgeMatches, caseMatches, courtMatches]);

  const totalResults = flatResults.length;

  useEffect(() => {
    setActiveIndex(0);
  }, [q, qRaw]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `#header-result-${activeIndex}`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function handleInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (totalResults === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % totalResults);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + totalResults) % totalResults);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flatResults[activeIndex] ?? flatResults[0];
      if (target) navigate(target.href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function openMobileSearch() {
    // Open the hamburger menu and focus the search input within it.
    setMobileNav(true);
    // delay to next tick so the input is mounted
    setTimeout(() => {
      mobileInputRef.current?.focus();
    }, 0);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6 py-3 lg:py-3.5">
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0 group"
          aria-label="PansaWatch home"
        >
          <span aria-hidden className="grid place-items-center h-7 w-7 bg-navy-900 text-white text-[11px] font-bold font-serif rounded-sm">
            判
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-navy-900 group-hover:text-navy-700">
              PansaWatch
            </span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-muted-faint font-mono">
              .org
            </span>
          </span>
        </Link>

        <div
          ref={containerRef}
          className="relative flex-1 max-w-xl mx-auto hidden md:block"
        >
          <div className="relative">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => query && setOpen(true)}
              onKeyDown={handleInputKey}
              placeholder="판사·법원·사건번호로 검색"
              className="w-full rounded-md border border-line bg-white pl-9 pr-14 py-2 text-sm placeholder:text-muted-soft focus:border-navy-500 focus:ring-2 focus:ring-navy-100 focus:outline-none transition"
              aria-label="검색"
              role="combobox"
              aria-expanded={open && q.length > 0}
              aria-controls="header-search-results"
              aria-autocomplete="list"
              aria-activedescendant={
                open && totalResults > 0
                  ? `header-result-${activeIndex}`
                  : undefined
              }
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1">
              <span className="kbd">⌘</span>
              <span className="kbd">K</span>
            </span>
          </div>

          {open && q && (
            <div
              ref={listRef}
              id="header-search-results"
              role="listbox"
              className="absolute left-0 right-0 mt-2 max-h-[60vh] overflow-y-auto rounded-md border border-line bg-white shadow-lg"
            >
              {totalResults === 0 ? (
                <p className="px-4 py-6 text-sm text-muted">
                  검색 결과가 없습니다.
                </p>
              ) : (
                <div className="py-1">
                  {judgeMatches.length > 0 && (
                    <div>
                      <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-muted-soft">
                        판사
                      </div>
                      {judgeMatches.map((j, i) => {
                        const flatIdx = i;
                        const isActive = activeIndex === flatIdx;
                        return (
                          <Link
                            key={j.id}
                            id={`header-result-${flatIdx}`}
                            role="option"
                            aria-selected={isActive}
                            href={getJudgePathById(j.id)}
                            onClick={() => {
                              setOpen(false);
                              setQuery("");
                            }}
                            onMouseEnter={() => setActiveIndex(flatIdx)}
                            className={`flex items-center justify-between px-4 py-2 text-sm transition ${
                              isActive ? "bg-navy-50" : "hover:bg-navy-50"
                            }`}
                          >
                            <span className="font-medium text-navy-900">
                              {j.name}
                            </span>
                            <span className="text-xs text-muted">
                              {j.position} · {j.court}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  {caseMatches.length > 0 && (
                    <div>
                      <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-muted-soft border-t border-line-soft">
                        사건번호
                      </div>
                      {caseMatches.map((c, i) => {
                        const flatIdx = judgeMatches.length + i;
                        const isActive = activeIndex === flatIdx;
                        const judge = judgeById.get(c.judgeId);
                        const caseNo = c.id.replace("case-", "");
                        return (
                          <Link
                            key={c.id}
                            id={`header-result-${flatIdx}`}
                            role="option"
                            aria-selected={isActive}
                            href={`${getJudgePathById(c.judgeId)}#case-${caseNo}`}
                            onClick={() => {
                              setOpen(false);
                              setQuery("");
                            }}
                            onMouseEnter={() => setActiveIndex(flatIdx)}
                            className={`flex flex-col gap-0.5 px-4 py-2 text-sm transition ${
                              isActive ? "bg-navy-50" : "hover:bg-navy-50"
                            }`}
                          >
                            <span className="font-mono tabular-nums text-navy-900">
                              {c.caseNumber}
                            </span>
                            <span className="text-xs text-muted">
                              {judge ? `${judge.name} 판사` : "판사 미상"} ·{" "}
                              {c.court} ·{" "}
                              <span className="font-mono tabular-nums">
                                {formatDate(c.decisionDate)}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  {courtMatches.length > 0 && (
                    <div>
                      <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-muted-soft border-t border-line-soft">
                        법원
                      </div>
                      {courtMatches.map((c, i) => {
                        const flatIdx =
                          judgeMatches.length + caseMatches.length + i;
                        const isActive = activeIndex === flatIdx;
                        return (
                          <Link
                            key={c.id}
                            id={`header-result-${flatIdx}`}
                            role="option"
                            aria-selected={isActive}
                            href={getCourtPath(c)}
                            onClick={() => {
                              setOpen(false);
                              setQuery("");
                            }}
                            onMouseEnter={() => setActiveIndex(flatIdx)}
                            className={`flex items-center justify-between px-4 py-2 text-sm transition ${
                              isActive ? "bg-navy-50" : "hover:bg-navy-50"
                            }`}
                          >
                            <span className="font-medium text-navy-900">
                              {c.name}
                            </span>
                            <span className="text-xs text-muted">
                              {c.region} · 판사 {c.judgeCount}명
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-1 shrink-0">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "text-navy-900"
                    : "text-muted hover:text-navy-900"
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-0.5 h-[2px] bg-civic-600" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="md:hidden ml-auto flex items-center gap-1.5">
          <button
            onClick={openMobileSearch}
            className="inline-flex items-center justify-center rounded-md border border-line p-2 text-navy-900"
            aria-label="검색 열기"
            aria-expanded={mobileNav}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
          <button
            onClick={() => setMobileNav(!mobileNav)}
            className="inline-flex items-center justify-center rounded-md border border-line p-2 text-navy-900"
            aria-label="메뉴 열기"
            aria-expanded={mobileNav}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {mobileNav ? (
                <>
                  <path d="M6 6 18 18" />
                  <path d="M18 6 6 18" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileNav && (
        <div className="md:hidden border-t border-line-soft bg-white px-4 py-3 space-y-3">
          <input
            ref={mobileInputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            placeholder="판사·법원·사건번호 검색"
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
          />
          {q && totalResults > 0 && (
            <div className="rounded-md border border-line bg-white divide-y divide-line-soft">
              {judgeMatches.map((j) => (
                <Link
                  key={j.id}
                  href={getJudgePathById(j.id)}
                  onClick={() => {
                    setMobileNav(false);
                    setQuery("");
                  }}
                  className="block px-3 py-2 text-sm"
                >
                  <span className="font-medium">{j.name}</span>
                  <span className="text-xs text-muted block">
                    {j.position} · {j.court}
                  </span>
                </Link>
              ))}
              {caseMatches.map((c) => {
                const judge = judgeById.get(c.judgeId);
                const caseNo = c.id.replace("case-", "");
                return (
                  <Link
                    key={c.id}
                    href={`${getJudgePathById(c.judgeId)}#case-${caseNo}`}
                    onClick={() => {
                      setMobileNav(false);
                      setQuery("");
                    }}
                    className="block px-3 py-2 text-sm"
                  >
                    <span className="font-mono tabular-nums font-medium">
                      {c.caseNumber}
                    </span>
                    <span className="text-xs text-muted block">
                      {judge ? `${judge.name} 판사` : "판사 미상"} · {c.court}
                    </span>
                  </Link>
                );
              })}
              {courtMatches.map((c) => (
                <Link
                  key={c.id}
                  href={getCourtPath(c)}
                  onClick={() => {
                    setMobileNav(false);
                    setQuery("");
                  }}
                  className="block px-3 py-2 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted block">
                    {c.region} · 판사 {c.judgeCount}명
                  </span>
                </Link>
              ))}
            </div>
          )}
          <nav className="flex flex-col">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNav(false)}
                className="py-2 text-sm font-medium text-navy-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
