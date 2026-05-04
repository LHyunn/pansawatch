"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate, getJudgePathById } from "@/lib/data";
import type { ArticleVoteSummary, ArticleWithJudges } from "@/lib/types";

interface Props {
  article: ArticleWithJudges;
  variant?: "default" | "compact";
  index?: number;
  voteSummary?: ArticleVoteSummary;
}

export default function ArticleCard({
  article,
  variant = "default",
  voteSummary,
}: Props) {
  const [vote, setVote] = useState<"agree" | "disagree" | null>(null);
  const [showLoginHint, setShowLoginHint] = useState(false);
  const articleNo = article.id.replace("article-", "");

  // Mock UI-only counts: when the user toggles a vote, the displayed total
  // shifts by +1/-1. Real mutation is left to a future server-side hook.
  const usefulCount =
    (voteSummary?.useful ?? 0) + (vote === "agree" ? 1 : 0);
  const notUsefulCount =
    (voteSummary?.notUseful ?? 0) + (vote === "disagree" ? 1 : 0);

  function handleVote(next: "agree" | "disagree") {
    setShowLoginHint(true);
    setVote((cur) => (cur === next ? null : next));
  }

  if (variant === "compact") {
    return (
      <article className="border-b border-line-soft py-4">
        <div className="flex items-center gap-2 text-[11px] text-muted-soft mb-1.5">
          <span className="font-mono text-[10px] text-muted-faint tabular-nums">
            #{articleNo.padStart(3, "0")}
          </span>
          <span className="text-muted-faint">·</span>
          <span className="font-medium text-navy-700 uppercase tracking-wider">
            {article.source}
          </span>
          <span className="text-muted-faint">·</span>
          <time className="font-mono tabular-nums">
            {formatDate(article.publishedAt)}
          </time>
        </div>
        <h3 className="font-medium text-navy-900 leading-snug mb-2">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-civic-700 transition"
          >
            {article.title}
          </a>
        </h3>
        {article.judges.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted">
            {article.judges.slice(0, 3).map((j) => (
              <Link
                key={j.id}
                href={getJudgePathById(j.id)}
                className="hover:text-navy-900 underline-offset-2 hover:underline"
              >
                {j.name} 판사
              </Link>
            ))}
          </div>
        )}
      </article>
    );
  }

  return (
    <article className="relative border border-line bg-surface hover:border-navy-700 transition group flex flex-col h-full">
      <div className="flex items-stretch border-b border-line-soft text-[10.5px] tabular-nums shrink-0">
        <div className="px-3 py-1.5 border-r border-line-soft text-muted-faint font-mono">
          REC #{articleNo.padStart(3, "0")}
        </div>
        <div className="px-3 py-1.5 border-r border-line-soft uppercase tracking-[0.12em] font-semibold text-navy-700">
          {article.source}
        </div>
        <time className="px-3 py-1.5 text-muted font-mono">
          {formatDate(article.publishedAt)}
        </time>
        <span className="ml-auto px-3 py-1.5 text-muted-faint flex items-center gap-1.5">
          <span aria-hidden className="block w-1 h-1 rounded-full bg-civic-500" />
          <span className="hidden sm:inline">자동 수집</span>
        </span>
      </div>

      <div className="p-5 sm:p-6 flex flex-col flex-1">
        <h3 className="font-serif text-lg sm:text-[1.35rem] font-semibold leading-snug text-navy-900 mb-3 line-clamp-2 min-h-[3.75rem]">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-civic-700 transition"
          >
            {article.title}
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="inline-block ml-1.5 -mt-0.5 h-3.5 w-3.5 opacity-50 group-hover:opacity-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M7 17 17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        </h3>

        <div className="border-l-2 border-navy-100 pl-3 mb-3">
          <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-faint mb-1">
            AI 요약
          </div>
          <p className="text-sm text-muted leading-relaxed line-clamp-3 min-h-[4.5rem]">
            {article.aiSummary}
          </p>
        </div>

        <p className="text-[10.5px] text-muted-faint leading-relaxed mb-4 shrink-0">
          ※ 위 요약은 자동 생성된 것이며, 정확한 내용은 원문 기사를 확인하시기
          바랍니다.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line-soft mt-auto shrink-0">
          {article.judges.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-faint font-semibold">
                관련 판사
              </span>
              {article.judges.slice(0, 4).map((j) => (
                <Link
                  key={j.id}
                  href={getJudgePathById(j.id)}
                  className="tag tag-navy hover:bg-navy-100"
                >
                  {j.name}
                </Link>
              ))}
            </div>
          ) : (
            <span />
          )}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleVote("agree")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium border transition ${
                  vote === "agree"
                    ? "bg-navy-700 text-white border-navy-700"
                    : "border-line text-muted hover:border-navy-700 hover:text-navy-900"
                }`}
                aria-label="이 기사가 참고가 되었습니다"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
                  <path d="M7 11 12 3l1 1c.6.6.5 1.6 0 2L11 9h7a2 2 0 0 1 2 2.4L18.5 19a2 2 0 0 1-2 1.6H7" />
                </svg>
                참고됨
                {voteSummary && usefulCount > 0 && (
                  <span
                    className={`font-mono text-[10px] ml-1 tabular-nums ${
                      vote === "agree" ? "text-white/85" : "text-muted-faint"
                    }`}
                  >
                    ({usefulCount})
                  </span>
                )}
              </button>
              <button
                onClick={() => handleVote("disagree")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium border transition ${
                  vote === "disagree"
                    ? "bg-seal-600 text-white border-seal-600"
                    : "border-line text-muted hover:border-seal-600 hover:text-seal-700"
                }`}
                aria-label="이 기사에 이의가 있습니다"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1Z" />
                  <path d="M17 13 12 21l-1-1c-.6-.6-.5-1.6 0-2L13 15H6a2 2 0 0 1-2-2.4L5.5 5A2 2 0 0 1 7.5 3.4H17" />
                </svg>
                이의있음
                {voteSummary && notUsefulCount > 0 && (
                  <span
                    className={`font-mono text-[10px] ml-1 tabular-nums ${
                      vote === "disagree" ? "text-white/85" : "text-muted-faint"
                    }`}
                  >
                    ({notUsefulCount})
                  </span>
                )}
              </button>
            </div>
            {showLoginHint && (
              <p
                className="text-[11px] text-muted-faint"
                role="status"
                aria-live="polite"
              >
                투표하려면 로그인이 필요합니다
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
