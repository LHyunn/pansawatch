interface Props {
  context: "judge" | "case" | "article" | "court";
  contextId: string;
  contextLabel?: string;
}

const contextNames: Record<Props["context"], string> = {
  judge: "판사 프로필",
  case: "판례 정보",
  article: "기사 정보",
  court: "법원 정보",
};

export default function CorrectionRequest({
  context,
  contextId,
  contextLabel,
}: Props) {
  const subjectLabel = contextLabel ?? `${contextNames[context]} ${contextId}`;
  const subject = `정정요청 - ${context} ${contextId}`;
  const body = [
    `대상: ${subjectLabel}`,
    `식별자: ${contextId}`,
    "",
    "정정 요청 내용:",
    "",
    "",
    "(아래는 자동 생성된 메타데이터입니다.)",
    `context=${context}`,
    `contextId=${contextId}`,
  ].join("\n");

  const href =
    `mailto:correction@pansawatch.org` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 text-[11px] text-muted-faint hover:text-navy-700 transition"
      aria-label={`${subjectLabel}에 대한 오류 신고 또는 정정 요청`}
    >
      <CorrectionIcon />
      <span>오류 신고 · 정정 요청</span>
    </a>
  );
}

function CorrectionIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="12"
      height="12"
      className="shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}
