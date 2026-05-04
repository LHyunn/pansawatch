"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import judgesData from "@/data/judges.json";
import courtsData from "@/data/courts.json";
import casesData from "@/data/cases.json";
import { formatDate, getJudgePathById, getCourtPath } from "@/lib/data";
import type { Case, Court, Judge } from "@/lib/types";

const judges = judgesData as Judge[];
const courts = courtsData as Court[];
const cases = casesData as Case[];

const judgeById = new Map(judges.map((j) => [j.id, j]));

export default function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
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

  // Flat result list — used by keyboard nav. Order matches render order.
  const flatResults = useMemo(() => {
    type Result =
      | { kind: "judge"; href: string; id: string }
      | { kind: "case"; href: string; id: string }
      | { kind: "court"; href: string; id: string };
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

  // reset highlight whenever the query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [q, qRaw]);

  // ensure active item is scrolled into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `#home-result-${activeIndex}`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative max-w-md">
      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query && setOpen(true)}
          onKeyDown={(e) => {
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
          }}
          placeholder="판사·법원·사건번호로 검색…"
          className="w-full border border-line bg-white pl-12 pr-4 py-3.5 text-base placeholder:text-muted-soft focus:border-navy-700 focus:ring-2 focus:ring-navy-100 focus:outline-none transition"
          role="combobox"
          aria-expanded={open && q.length > 0}
          aria-controls="home-search-results"
          aria-autocomplete="list"
          aria-activedescendant={
            open && totalResults > 0 ? `home-result-${activeIndex}` : undefined
          }
        />
      </div>
      {open && q && (
        <div
          ref={listRef}
          id="home-search-results"
          role="listbox"
          className="absolute left-0 right-0 mt-2 max-h-[60vh] overflow-y-auto border border-line bg-white shadow-lg z-20"
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
                        id={`home-result-${flatIdx}`}
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
                        id={`home-result-${flatIdx}`}
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
                        id={`home-result-${flatIdx}`}
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
  );
}
