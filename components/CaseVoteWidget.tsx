"use client";

import { useState } from "react";
import type { CaseVoteSummary } from "@/lib/types";

type AgreementChoice = "agree" | "disagree";
type SentencingChoice = "appropriate" | "too_light" | "too_heavy";

interface Props {
  caseId: string;
  caseType: "민사" | "형사" | "행정" | "가사";
  summary: CaseVoteSummary;
}

export default function CaseVoteWidget({ caseId, caseType, summary }: Props) {
  const [agreementVote, setAgreementVote] = useState<AgreementChoice | null>(
    null
  );
  const [sentencingVote, setSentencingVote] = useState<SentencingChoice | null>(
    null
  );
  const [showLoginNotice, setShowLoginNotice] = useState(false);

  const { agreement, sentencing } = summary;

  const agreeRate = agreement.total > 0 ? agreement.rate : 0;
  const disagreeRate = agreement.total > 0 ? 1 - agreement.rate : 0;
  const agreePct = Math.round(agreeRate * 100);
  const disagreePct = Math.max(0, 100 - agreePct);

  const handleAgreementClick = (choice: AgreementChoice) => {
    setShowLoginNotice(true);
    setAgreementVote((prev) => (prev === choice ? null : choice));
    // mock — real API integration deferred
    // eslint-disable-next-line no-console
    console.log("[case-vote] agreement", { caseId, choice });
  };

  const handleSentencingClick = (choice: SentencingChoice) => {
    setShowLoginNotice(true);
    setSentencingVote((prev) => (prev === choice ? null : choice));
    // eslint-disable-next-line no-console
    console.log("[case-vote] sentencing", { caseId, choice });
  };

  // Sentencing breakdown — calculate percentages safely.
  let appropriatePct = 0;
  let tooLightPct = 0;
  let tooHeavyPct = 0;
  if (sentencing && sentencing.total > 0) {
    appropriatePct = Math.round((sentencing.appropriate / sentencing.total) * 100);
    tooLightPct = Math.round((sentencing.tooLight / sentencing.total) * 100);
    tooHeavyPct = Math.max(0, 100 - appropriatePct - tooLightPct);
  }

  return (
    <section className="border-t border-line-soft pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow eyebrow-civic">시민 투표</div>
        <span className="font-mono text-[10.5px] text-muted-faint tracking-tight">
          § 의견 집계
        </span>
      </div>

      {/* Question 1 — agreement (always shown) */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-navy-900 mb-2">
          이 판결에 동의하십니까?
        </h4>

        <div className="mb-2">
          <div
            role="progressbar"
            aria-valuenow={agreePct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`동의율 ${agreePct}%`}
            className="relative flex h-2 w-full overflow-hidden bg-paper-100 border border-line-soft"
          >
            <span
              className="block bg-civic-600 h-full"
              style={{ width: `${agreePct}%` }}
              aria-hidden
            />
            <span
              className="block bg-seal-600 h-full"
              style={{ width: `${disagreePct}%` }}
              aria-hidden
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[11px]">
            <span className="text-civic-700 font-semibold tabular-nums">
              동의 {agreePct}%
            </span>
            <span className="font-mono text-[10.5px] text-muted-faint tabular-nums">
              ({agreement.total.toLocaleString("ko-KR")}표)
            </span>
            <span className="text-seal-700 font-semibold tabular-nums">
              비동의 {disagreePct}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <VoteButton
            label="동의"
            active={agreementVote === "agree"}
            tone="civic"
            onClick={() => handleAgreementClick("agree")}
            ariaLabel="이 판결에 동의합니다"
            icon={<ThumbsUpIcon />}
          />
          <VoteButton
            label="비동의"
            active={agreementVote === "disagree"}
            tone="seal"
            onClick={() => handleAgreementClick("disagree")}
            ariaLabel="이 판결에 동의하지 않습니다"
            icon={<ThumbsDownIcon />}
          />
        </div>
      </div>

      {/* Question 2 — sentencing fairness (criminal cases only) */}
      {caseType === "형사" && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-navy-900 mb-2">
            양형이 적절하다고 생각하십니까?
          </h4>

          <div className="mb-2">
            <div
              role="progressbar"
              aria-valuenow={appropriatePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`양형 적절 ${appropriatePct}%`}
              className="relative flex h-2 w-full overflow-hidden bg-paper-100 border border-line-soft"
            >
              <span
                className="block bg-civic-600 h-full"
                style={{ width: `${appropriatePct}%` }}
                aria-hidden
              />
              <span
                className="block bg-navy-100 h-full"
                style={{ width: `${tooLightPct}%` }}
                aria-hidden
              />
              <span
                className="block bg-seal-600 h-full"
                style={{ width: `${tooHeavyPct}%` }}
                aria-hidden
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px] tabular-nums">
              <span className="text-civic-700 font-semibold">
                적절 {appropriatePct}%
              </span>
              <span className="text-navy-700 font-semibold">
                과소 {tooLightPct}%
              </span>
              <span className="text-seal-700 font-semibold">
                과중 {tooHeavyPct}%
              </span>
            </div>
            {sentencing && (
              <div className="text-right mt-0.5">
                <span className="font-mono text-[10.5px] text-muted-faint tabular-nums">
                  ({sentencing.total.toLocaleString("ko-KR")}표)
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <VoteButton
              label="적절"
              active={sentencingVote === "appropriate"}
              tone="civic"
              onClick={() => handleSentencingClick("appropriate")}
              ariaLabel="양형이 적절합니다"
            />
            <VoteButton
              label="과소"
              active={sentencingVote === "too_light"}
              tone="navy"
              onClick={() => handleSentencingClick("too_light")}
              ariaLabel="양형이 과소합니다"
            />
            <VoteButton
              label="과중"
              active={sentencingVote === "too_heavy"}
              tone="seal"
              onClick={() => handleSentencingClick("too_heavy")}
              ariaLabel="양형이 과중합니다"
            />
          </div>
        </div>
      )}

      {showLoginNotice && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 border border-line-soft bg-navy-50 px-3 py-2.5 flex flex-wrap items-center gap-2"
        >
          <p className="text-[11px] text-navy-900 leading-relaxed flex-1 min-w-0">
            투표하려면 로그인이 필요합니다.
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                // eslint-disable-next-line no-console
                console.log("[auth] google login requested");
              }}
              className="text-[11px] font-medium text-civic-700 hover:text-civic-600 underline-offset-2 hover:underline px-1.5 py-1 min-h-[32px]"
            >
              Google 로그인
            </button>
            <span className="text-line text-[11px] self-center">·</span>
            <button
              type="button"
              onClick={() => {
                // eslint-disable-next-line no-console
                console.log("[auth] kakao login requested");
              }}
              className="text-[11px] font-medium text-civic-700 hover:text-civic-600 underline-offset-2 hover:underline px-1.5 py-1 min-h-[32px]"
            >
              Kakao 로그인
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-faint leading-relaxed">
        ※ 위 비율은 시민 투표 집계이며 사실의 확정이 아닙니다.
      </p>
    </section>
  );
}

interface VoteButtonProps {
  label: string;
  active: boolean;
  tone: "civic" | "seal" | "navy";
  onClick: () => void;
  ariaLabel: string;
  icon?: React.ReactNode;
}

function VoteButton({
  label,
  active,
  tone,
  onClick,
  ariaLabel,
  icon,
}: VoteButtonProps) {
  const toneClasses = (() => {
    if (tone === "civic") {
      return active
        ? "bg-civic-600 text-white border-civic-600"
        : "border-line text-navy-900 hover:border-civic-700 hover:text-civic-700";
    }
    if (tone === "seal") {
      return active
        ? "bg-seal-600 text-white border-seal-600"
        : "border-line text-navy-900 hover:border-seal-600 hover:text-seal-700";
    }
    return active
      ? "bg-navy-700 text-white border-navy-700"
      : "border-line text-navy-900 hover:border-navy-700";
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-sm font-medium border rounded-sm transition ${toneClasses}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ThumbsUpIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
      <path d="M7 11 12 3l1 1c.6.6.5 1.6 0 2L11 9h7a2 2 0 0 1 2 2.4L18.5 19a2 2 0 0 1-2 1.6H7" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1Z" />
      <path d="M17 13 12 21l-1-1c-.6-.6-.5-1.6 0-2L13 15H6a2 2 0 0 1-2-2.4L5.5 5A2 2 0 0 1 7.5 3.4H17" />
    </svg>
  );
}
