"use client";

import { useMemo, useState } from "react";
import JudgeCard from "@/components/JudgeCard";
import type { JudgeWithStats } from "@/lib/types";

type SortKey =
  | "name"
  | "appointment_asc"
  | "appointment_desc"
  | "agreement_high"
  | "agreement_low";

type JudgeRow = JudgeWithStats & {
  agreementRate: number;
  agreementVotes: number;
};

interface Props {
  judges: JudgeRow[];
  positions: string[];
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "가나다순" },
  { value: "appointment_asc", label: "임관 빠른순" },
  { value: "appointment_desc", label: "임관 늦은순" },
  { value: "agreement_high", label: "판결 동의율 평균 높은순" },
  { value: "agreement_low", label: "판결 동의율 평균 낮은순" },
];

export default function JudgesIndex({ judges, positions }: Props) {
  const [sort, setSort] = useState<SortKey>("name");
  const [position, setPosition] = useState<string | undefined>(undefined);

  const filteredJudges = useMemo(() => {
    let list = judges.slice();
    if (position) {
      list = list.filter((j) => j.position === position);
    }

    const collator = new Intl.Collator("ko-KR");

    switch (sort) {
      case "name":
        list.sort((a, b) => collator.compare(a.name, b.name));
        break;
      case "appointment_asc":
        list.sort(
          (a, b) =>
            a.appointmentYear - b.appointmentYear ||
            collator.compare(a.name, b.name)
        );
        break;
      case "appointment_desc":
        list.sort(
          (a, b) =>
            b.appointmentYear - a.appointmentYear ||
            collator.compare(a.name, b.name)
        );
        break;
      case "agreement_high":
      case "agreement_low": {
        const dir = sort === "agreement_high" ? -1 : 1;
        list.sort((a, b) => {
          const aHas = a.agreementVotes > 0 ? 1 : 0;
          const bHas = b.agreementVotes > 0 ? 1 : 0;
          // Judges with votes first
          if (aHas !== bHas) return bHas - aHas;
          if (aHas === 0) return collator.compare(a.name, b.name);
          if (a.agreementRate !== b.agreementRate) {
            return dir * (a.agreementRate - b.agreementRate);
          }
          return collator.compare(a.name, b.name);
        });
        break;
      }
    }
    return list;
  }, [judges, sort, position]);

  const hasFilter = position !== undefined || sort !== "name";

  return (
    <div className="grid lg:grid-cols-4 gap-8">
      <aside className="lg:col-span-1">
        <div className="lg:sticky lg:top-20 space-y-6">
          <FilterGroup
            title="정렬"
            items={SORT_OPTIONS.map((opt) => ({
              label: opt.label,
              value: opt.value,
            }))}
            active={sort}
            onSelect={(v) => setSort((v as SortKey) ?? "name")}
            allowClear={false}
          />
          <p className="text-[11px] text-muted-faint mt-3 leading-relaxed">
            ※ 판사 단위 평가가 아닌 판결별 시민 투표의 평균입니다.
          </p>
          <FilterGroup
            title="직위"
            items={[
              { label: "전체", value: undefined },
              ...positions.map((p) => ({ label: p, value: p })),
            ]}
            active={position}
            onSelect={(v) => setPosition(v)}
            allowClear={true}
          />
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setSort("name");
                setPosition(undefined);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-civic-700 hover:underline"
              aria-label="정렬·필터 초기화"
            >
              <span aria-hidden>✕</span> 필터 초기화
            </button>
          )}
        </div>
      </aside>

      <div className="lg:col-span-3">
        <div
          className="flex items-center justify-between mb-4 text-xs text-muted"
          aria-live="polite"
        >
          <span>
            <span className="font-medium text-navy-900 tabular-nums">
              {filteredJudges.length.toLocaleString()}명
            </span>
            {position && (
              <>
                {" "}·{" "}
                <span className="text-civic-700 font-medium">{position}</span>
              </>
            )}
          </span>
          <span>
            정렬:{" "}
            <span className="font-medium text-navy-900">
              {SORT_OPTIONS.find((o) => o.value === sort)?.label}
            </span>
          </span>
        </div>

        {filteredJudges.length === 0 ? (
          <div className="border border-dashed border-line bg-white py-16 px-6 text-center">
            <p className="font-medium text-navy-900">
              해당 조건의 판사가 없습니다.
            </p>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              직위 필터를 조정하거나 초기화해 보세요.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredJudges.map((j) => (
              <JudgeCard
                key={j.id}
                judge={j}
                agreementRate={j.agreementRate}
                agreementVotes={j.agreementVotes}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  items,
  active,
  onSelect,
  allowClear,
}: {
  title: string;
  items: { label: string; value?: string }[];
  active?: string;
  onSelect: (v: string | undefined) => void;
  allowClear: boolean;
}) {
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wider text-muted-soft font-semibold mb-2">
        {title}
      </h3>
      <ul className="space-y-0.5">
        {items.map((it) => {
          const isActive = (active ?? undefined) === (it.value ?? undefined);
          return (
            <li key={it.label}>
              <button
                type="button"
                onClick={() => {
                  if (isActive && allowClear) onSelect(undefined);
                  else onSelect(it.value);
                }}
                aria-pressed={isActive}
                className={`block w-full text-left text-sm py-1 px-2 rounded transition truncate ${
                  isActive
                    ? "bg-navy-700 text-white font-medium"
                    : "text-muted hover:text-navy-900 hover:bg-navy-50"
                }`}
              >
                {it.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
