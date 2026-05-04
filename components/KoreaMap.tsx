"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as topojson from "topojson-client";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Court } from "@/lib/types";

export interface CourtEnrichment {
  topJudges?: { id: string; name: string; position: string; articleCount: number }[];
  totalCases?: number;
  totalArticles?: number;
  agreementRate?: number;
  agreementVotes?: number;
}

interface Props {
  courts: Court[];
  enrichments?: Record<string, CourtEnrichment>;
  /** 초기 줌 배율 (1 = 본토 fit). 기본 1. */
  initialScale?: number;
  /** 초기 중심 좌표 [경도, 위도]. 미지정 시 본토 fit 의 자연 중심. */
  initialCenter?: [number, number];
}

const WIDTH = 760;
const HEIGHT = 880;
const MIN_SCALE = 1;
const MAX_SCALE = 8;
// key = canonical short label; aliases include the formal full names used in
// the topojson (e.g. "충청북도", "전라남도") and any historic variants.
const REGION_DEFS: { key: string; aliases: string[] }[] = [
  { key: "서울", aliases: ["서울"] },
  { key: "부산", aliases: ["부산"] },
  { key: "대구", aliases: ["대구"] },
  { key: "인천", aliases: ["인천"] },
  { key: "광주", aliases: ["광주"] },
  { key: "대전", aliases: ["대전"] },
  { key: "울산", aliases: ["울산"] },
  { key: "세종", aliases: ["세종"] },
  { key: "경기", aliases: ["경기"] },
  { key: "강원", aliases: ["강원"] },
  { key: "충북", aliases: ["충청북", "충북"] },
  { key: "충남", aliases: ["충청남", "충남"] },
  { key: "전북", aliases: ["전라북", "전북"] },
  { key: "전남", aliases: ["전라남", "전남"] },
  { key: "경북", aliases: ["경상북", "경북"] },
  { key: "경남", aliases: ["경상남", "경남"] },
  { key: "제주", aliases: ["제주"] },
];

function regionForFeature(name: string | undefined): string {
  if (!name) return "";
  for (const { key, aliases } of REGION_DEFS)
    for (const a of aliases) if (name.includes(a)) return key;
  return name;
}

function regionForCourt(courtRegion: string): string {
  for (const { key, aliases } of REGION_DEFS)
    for (const a of aliases) if (courtRegion.includes(a)) return key;
  return courtRegion;
}

function courtTypeLabel(t: Court["type"]): string {
  return {
    supreme: "대법원",
    high: "고등법원",
    district: "지방법원",
    family: "가정법원",
    administrative: "행정법원",
    rehabilitation: "회생법원",
    patent: "특허법원",
  }[t];
}

// 8-bucket 분류 — 가시성 토글의 단위. district 는 본원/지원 분리.
type CourtBucket =
  | "supreme"
  | "high"
  | "district_main"
  | "district_branch"
  | "family"
  | "administrative"
  | "rehabilitation"
  | "patent";

function bucketOf(c: Court): CourtBucket {
  if (c.type === "district") {
    return c.name.includes("지원") ? "district_branch" : "district_main";
  }
  return c.type as CourtBucket;
}

const BUCKET_DEFS: { key: CourtBucket; label: string }[] = [
  { key: "supreme", label: "대법원" },
  { key: "high", label: "고등" },
  { key: "district_main", label: "지법 본원" },
  { key: "district_branch", label: "지법 지원" },
  { key: "family", label: "가정" },
  { key: "administrative", label: "행정" },
  { key: "rehabilitation", label: "회생" },
  { key: "patent", label: "특허" },
];

// 기본 가시성 — '본원 중심' 시작화면. 지법 지원만 OFF.
const DEFAULT_VISIBLE: Record<CourtBucket, boolean> = {
  supreme: true,
  high: true,
  district_main: true,
  district_branch: false,
  family: true,
  administrative: true,
  rehabilitation: true,
  patent: true,
};

export default function KoreaMap({
  courts,
  enrichments = {},
  initialScale = 1,
  initialCenter,
}: Props) {
  const router = useRouter();
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [hoveredCourt, setHoveredCourt] = useState<Court | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [transform, setTransform] = useState({
    tx: 0,
    ty: 0,
    scale: initialScale,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [visibleBuckets, setVisibleBuckets] = useState<
    Record<CourtBucket, boolean>
  >(DEFAULT_VISIBLE);
  const initialAppliedRef = useRef(false);
  const dragStart = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/korea.topojson")
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return;
        const obj = topo.objects?.skorea_provinces_2018_geo;
        if (obj) {
          const fc = topojson.feature(
            topo,
            obj
          ) as unknown as FeatureCollection;
          setGeo(fc);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const { projection, pathD } = useMemo(() => {
    if (!geo) return { projection: null, pathD: null };
    const proj = geoMercator().fitSize([WIDTH, HEIGHT], geo);
    const path = geoPath(proj);
    return { projection: proj, pathD: path };
  }, [geo]);

  // Compute the canonical initial transform (applied at mount + on reset).
  const initialTransform = useMemo(() => {
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, initialScale));
    if (!projection || !initialCenter) {
      return { tx: 0, ty: 0, scale };
    }
    const p = projection(initialCenter);
    if (!p) return { tx: 0, ty: 0, scale };
    return {
      tx: WIDTH / 2 - p[0] * scale,
      ty: HEIGHT / 2 - p[1] * scale,
      scale,
    };
  }, [projection, initialScale, initialCenter]);

  // Apply the initial transform once when projection becomes available.
  useEffect(() => {
    if (!projection || initialAppliedRef.current) return;
    initialAppliedRef.current = true;
    setTransform(initialTransform);
  }, [projection, initialTransform]);

  // 토글에 따른 bucket 별 카운트 — 라벨 옆 표시
  const bucketCounts = useMemo(() => {
    const counts: Record<CourtBucket, number> = {
      supreme: 0,
      high: 0,
      district_main: 0,
      district_branch: 0,
      family: 0,
      administrative: 0,
      rehabilitation: 0,
      patent: 0,
    };
    for (const c of courts) counts[bucketOf(c)]++;
    return counts;
  }, [courts]);

  const courtMarkers = useMemo(() => {
    if (!projection) return [];
    const projected = courts
      .filter((c) => visibleBuckets[bucketOf(c)])
      .map((c) => {
        const p = projection([c.longitude, c.latitude]);
        if (!p) return null;
        return { ...c, x: p[0], y: p[1] };
      })
      .filter(Boolean) as (Court & { x: number; y: number })[];

    // 같은 빌딩에 입주한 법원이 좌표를 100% 공유하는 케이스(서울고법·서울중앙·
    // 회생법원 등) 가 다수. 그룹 내 가장 중요한 항목(supreme>high>그 외)을 중심
    // 으로, 나머지를 동일 거리의 angular offset 으로 펼친다.
    const typeOrder: Record<string, number> = {
      supreme: 0,
      high: 1,
      district: 2,
      family: 3,
      administrative: 4,
      rehabilitation: 5,
      patent: 6,
    };
    const groups = new Map<string, typeof projected>();
    for (const m of projected) {
      const key = `${m.latitude.toFixed(5)},${m.longitude.toFixed(5)}`;
      const arr = groups.get(key) ?? [];
      arr.push(m);
      groups.set(key, arr);
    }
    const offsetRadius = 16;
    const dispersed: typeof projected = [];
    for (const group of groups.values()) {
      if (group.length === 1) {
        dispersed.push(group[0]!);
        continue;
      }
      const ordered = group.slice().sort((a, b) => {
        const ao = typeOrder[a.type] ?? 9;
        const bo = typeOrder[b.type] ?? 9;
        if (ao !== bo) return ao - bo;
        return b.judgeCount - a.judgeCount;
      });
      const cx = ordered[0]!.x;
      const cy = ordered[0]!.y;
      dispersed.push(ordered[0]!);
      const n = ordered.length - 1;
      for (let i = 1; i <= n; i++) {
        const angle = (Math.PI * 2 * (i - 1)) / n - Math.PI / 2;
        dispersed.push({
          ...ordered[i]!,
          x: cx + Math.cos(angle) * offsetRadius,
          y: cy + Math.sin(angle) * offsetRadius,
        });
      }
    }

    // 그리기 순서: supreme/high 가 항상 위에 오도록 type 우선순위로 정렬.
    // 같은 우선순위 안에서는 큰 마커가 먼저(아래) → 작은 마커가 위로.
    dispersed.sort((a, b) => {
      const pa = a.type === "supreme" ? 2 : a.type === "high" ? 1 : 0;
      const pb = b.type === "supreme" ? 2 : b.type === "high" ? 1 : 0;
      if (pa !== pb) return pa - pb;
      return b.judgeCount - a.judgeCount;
    });
    return dispersed;
  }, [courts, projection, visibleBuckets]);

  const regionStats = useMemo(() => {
    const judgeCount = new Map<string, number>();
    const courtCount = new Map<string, number>();
    for (const c of courts) {
      const r = regionForCourt(c.region);
      judgeCount.set(r, (judgeCount.get(r) ?? 0) + c.judgeCount);
      courtCount.set(r, (courtCount.get(r) ?? 0) + 1);
    }
    return { judgeCount, courtCount };
  }, [courts]);

  // Per-region projected bbox (union across feature parts)
  const regionBboxes = useMemo(() => {
    const map = new Map<string, [[number, number], [number, number]]>();
    if (!geo || !pathD) return map;
    for (const f of geo.features) {
      const region = regionForFeature(f.properties?.name as string | undefined);
      if (!region) continue;
      const b = pathD.bounds(f as Feature<Geometry>);
      const existing = map.get(region);
      if (existing) {
        existing[0][0] = Math.min(existing[0][0], b[0][0]);
        existing[0][1] = Math.min(existing[0][1], b[0][1]);
        existing[1][0] = Math.max(existing[1][0], b[1][0]);
        existing[1][1] = Math.max(existing[1][1], b[1][1]);
      } else {
        map.set(region, [
          [b[0][0], b[0][1]],
          [b[1][0], b[1][1]],
        ]);
      }
    }
    return map;
  }, [geo, pathD]);

  const orderedRegions = useMemo(() => {
    const s = new Set<string>();
    for (const { key } of REGION_DEFS) {
      if (regionBboxes.has(key)) s.add(key);
    }
    return Array.from(s);
  }, [regionBboxes]);

  // Zoom to a region by projected bbox
  const zoomToRegion = useCallback(
    (region: string | null) => {
      if (!region) {
        setTransform({ tx: 0, ty: 0, scale: 1 });
        setSelectedRegion(null);
        return;
      }
      const bbox = regionBboxes.get(region);
      if (!bbox) return;
      const [[x0, y0], [x1, y1]] = bbox;
      const w = Math.max(1, x1 - x0);
      const h = Math.max(1, y1 - y0);
      const padding = 0.82;
      const scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, Math.min(WIDTH / w, HEIGHT / h) * padding)
      );
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const tx = WIDTH / 2 - cx * scale;
      const ty = HEIGHT / 2 - cy * scale;
      setTransform({ tx, ty, scale });
      setSelectedRegion(region);
    },
    [regionBboxes]
  );

  // Wheel zoom — attach via useEffect for { passive: false }
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const cursorX = ((e.clientX - rect.left) / rect.width) * WIDTH;
      const cursorY = ((e.clientY - rect.top) / rect.height) * HEIGHT;
      setTransform((t) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const newScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, t.scale * factor)
        );
        if (newScale === t.scale) return t;
        const ratio = newScale / t.scale;
        const newTx = cursorX - (cursorX - t.tx) * ratio;
        const newTy = cursorY - (cursorY - t.ty) * ratio;
        return { tx: newTx, ty: newTy, scale: newScale };
      });
      setSelectedRegion(null);
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, []);

  // Pan via drag
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      tx: transform.tx,
      ty: transform.ty,
    };
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      // Snapshot drag origin to a local var. setTransform()의 콜백은 React
      // batch 후 실행되므로, 그 사이 mouseup 이 dragStart.current 를 null 로
      // 클리어할 수 있다. 로컬 변수로 캡처하면 race 가 사라진다.
      const start = dragStart.current;
      if (!start || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const dx = ((e.clientX - start.x) / rect.width) * WIDTH;
      const dy = ((e.clientY - start.y) / rect.height) * HEIGHT;
      setTransform((t) => ({
        ...t,
        tx: start.tx + dx,
        ty: start.ty + dy,
      }));
    };
    const onUp = () => {
      setIsDragging(false);
      dragStart.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const zoomBy = (factor: number) => {
    setTransform((t) => {
      const newScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, t.scale * factor)
      );
      if (newScale === t.scale) return t;
      const ratio = newScale / t.scale;
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      return {
        tx: cx - (cx - t.tx) * ratio,
        ty: cy - (cy - t.ty) * ratio,
        scale: newScale,
      };
    });
    setSelectedRegion(null);
  };

  const reset = () => {
    setTransform(initialTransform);
    setSelectedRegion(null);
  };

  const isAtInitial =
    transform.scale === initialTransform.scale &&
    transform.tx === initialTransform.tx &&
    transform.ty === initialTransform.ty;

  // bucket 별 baseline + judgeCount 보조. 범위를 4~11px 로 좁혀
  // 본원·지원·고법 사이 시각 차이를 부드럽게.
  function radius(c: Court): number {
    const b = bucketOf(c);
    if (b === "supreme") return 11;
    if (b === "high") return 9;
    if (b === "district_branch") {
      if (c.judgeCount >= 30) return 6;
      if (c.judgeCount >= 10) return 5;
      return 4;
    }
    // 본원·가정·행정·회생·특허
    if (c.judgeCount >= 100) return 11;
    if (c.judgeCount >= 50) return 9;
    if (c.judgeCount >= 20) return 7;
    return 6;
  }

  function markerFill(c: Court, hover: boolean): string {
    if (hover) return "var(--color-civic-600)";
    if (c.type === "supreme") return "var(--color-seal-600)";
    if (c.type === "high") return "var(--color-civic-600)";
    if (bucketOf(c) === "district_branch") return "var(--color-navy-500)";
    return "var(--color-navy-700)";
  }

  const hoveredMarker = hoveredCourt
    ? courtMarkers.find((m) => m.id === hoveredCourt.id)
    : null;
  const hoveredEnrich = hoveredCourt
    ? enrichments[hoveredCourt.id]
    : undefined;
  // Stroke width should not grow with zoom
  const strokeScale = 1 / transform.scale;

  const regionForActiveZone = selectedRegion;

  return (
    <div className="relative w-full">
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-faint mr-1.5">
          지역
        </span>
        {orderedRegions.map((r) => {
          const judges = regionStats.judgeCount.get(r) ?? 0;
          const isActive = selectedRegion === r;
          const hasCourts = (regionStats.courtCount.get(r) ?? 0) > 0;
          return (
            <button
              key={r}
              onClick={() => zoomToRegion(isActive ? null : r)}
              aria-pressed={isActive}
              className={`text-[11px] px-2 py-1 border rounded-sm transition tabular-nums ${
                isActive
                  ? "bg-navy-900 text-white border-navy-900"
                  : hasCourts
                    ? "border-line text-navy-900 bg-surface hover:border-navy-700 hover:bg-navy-50"
                    : "border-line-soft text-muted-faint bg-surface"
              }`}
            >
              {r}
              {judges > 0 && (
                <span
                  className={`ml-1 font-mono text-[10px] ${
                    isActive ? "text-white/70" : "text-muted-faint"
                  }`}
                >
                  {judges}명
                </span>
              )}
            </button>
          );
        })}
        {selectedRegion && (
          <button
            onClick={reset}
            className="text-[11px] px-2 py-1 ml-1 text-civic-700 hover:underline"
            aria-label="지역 선택 해제 및 전체 보기"
          >
            ✕ 전체 보기
          </button>
        )}
      </div>

      {/* 유형 필터 토글 — 본원 중심 시작화면, 지법 지원 기본 OFF */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-faint mr-1.5">
          유형
        </span>
        {BUCKET_DEFS.map(({ key, label }) => {
          const count = bucketCounts[key];
          const isOn = visibleBuckets[key];
          if (count === 0) return null;
          // 색 톤: supreme=seal, high=civic, 그 외=navy
          const onClass =
            key === "supreme"
              ? "bg-seal-600 text-white border-seal-600"
              : key === "high"
                ? "bg-civic-600 text-white border-civic-600"
                : "bg-navy-900 text-white border-navy-900";
          return (
            <button
              key={key}
              type="button"
              onClick={() =>
                setVisibleBuckets((prev) => ({ ...prev, [key]: !prev[key] }))
              }
              aria-pressed={isOn}
              className={`text-[11px] px-2 py-1 border rounded-sm transition tabular-nums ${
                isOn
                  ? onClass
                  : "border-line text-muted bg-surface hover:border-navy-700 hover:text-navy-900"
              }`}
            >
              {label}
              <span
                className={`ml-1 font-mono text-[10px] ${
                  isOn ? "text-white/75" : "text-muted-faint"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative aspect-[760/880] w-full max-w-[600px] mx-auto">
        {!geo && (
          <div className="absolute inset-0 grid place-items-center text-muted text-sm">
            지도 불러오는 중…
          </div>
        )}
        {geo && (
          <>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className={`block w-full h-full select-none ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              role="img"
              aria-label="대한민국 법원 위치 지도"
              onMouseDown={handleMouseDown}
            >
              {/* Background — receives wheel/drag events when no shape under cursor */}
              <rect
                x={0}
                y={0}
                width={WIDTH}
                height={HEIGHT}
                fill="transparent"
              />
              <g
                transform={`translate(${transform.tx} ${transform.ty}) scale(${transform.scale})`}
                style={{
                  transition: isDragging ? "none" : "transform 0.4s ease-out",
                }}
              >
                {/* Provinces */}
                <g>
                  {geo.features.map((f: Feature<Geometry>, i) => {
                    const name = f.properties?.name as string | undefined;
                    const region = regionForFeature(name);
                    const judgeCount =
                      regionStats.judgeCount.get(region) ?? 0;
                    const isActive = regionForActiveZone === region;
                    return (
                      <path
                        key={i}
                        d={pathD!(f) || ""}
                        fill={
                          isActive
                            ? "var(--color-navy-100)"
                            : judgeCount > 0
                              ? "#eef1f8"
                              : "#f7f8fb"
                        }
                        stroke="#c7cee0"
                        strokeWidth={0.6 * strokeScale}
                        onClick={() =>
                          zoomToRegion(
                            selectedRegion === region ? null : region
                          )
                        }
                        className="cursor-pointer"
                      />
                    );
                  })}
                </g>

                {/* Court markers */}
                <g data-courts>
                  {courtMarkers.map((c) => {
                    const hovered = hoveredCourt?.id === c.id;
                    const r = radius(c);
                    const fill = markerFill(c, hovered);
                    const isSupreme = c.type === "supreme";
                    const isHigh = c.type === "high";
                    const isBranch = bucketOf(c) === "district_branch";
                    // 외곽 후광 — supreme/high 는 진하게, 지원은 옅게
                    const haloOpacity = hovered
                      ? 0.28
                      : isSupreme
                        ? 0.2
                        : isHigh
                          ? 0.16
                          : isBranch
                            ? 0.04
                            : 0.08;
                    const strokeWidth =
                      (isSupreme ? 2.4 : isHigh ? 2.2 : isBranch ? 0.8 : 1.5) *
                      strokeScale;
                    return (
                      <g
                        key={c.id}
                        transform={`translate(${c.x}, ${c.y})`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredCourt(c)}
                        onMouseLeave={() => setHoveredCourt(null)}
                        onClick={(e) => {
                          if (isDragging) return;
                          e.stopPropagation();
                          router.push(`/courts/${c.id}`);
                        }}
                      >
                        <circle
                          r={(r + 3) * strokeScale}
                          fill={fill}
                          opacity={haloOpacity}
                        />
                        <circle
                          r={r * strokeScale}
                          fill={fill}
                          stroke={isBranch ? "var(--color-line)" : "white"}
                          strokeWidth={strokeWidth}
                        />
                        {/* 대법원: 가운데 표적(흰 고리 + 빨강 점) */}
                        {isSupreme && (
                          <>
                            <circle
                              r={(r - 4) * strokeScale}
                              fill="white"
                            />
                            <circle
                              r={(r - 7) * strokeScale}
                              fill={fill}
                            />
                          </>
                        )}
                      </g>
                    );
                  })}
                </g>
              </g>

            </svg>

            {/* Zoom controls */}
            <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
              <button
                onClick={() => zoomBy(1.4)}
                aria-label="확대"
                disabled={transform.scale >= MAX_SCALE}
                className="grid place-items-center w-8 h-8 bg-surface border border-line text-navy-900 hover:border-navy-700 hover:bg-navy-50 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>
              <button
                onClick={() => zoomBy(0.7)}
                aria-label="축소"
                disabled={transform.scale <= MIN_SCALE}
                className="grid place-items-center w-8 h-8 bg-surface border border-line text-navy-900 hover:border-navy-700 hover:bg-navy-50 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <button
                onClick={reset}
                aria-label="지도 초기화"
                disabled={isAtInitial}
                className="grid place-items-center w-8 h-8 bg-surface border border-line text-navy-900 hover:border-navy-700 hover:bg-navy-50 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v5h5" />
                </svg>
              </button>
            </div>

            {/* Zoom indicator */}
            <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-surface/90 border border-line text-[10px] font-mono tabular-nums text-muted-faint rounded-sm">
              {transform.scale.toFixed(1)}×
            </div>
          </>
        )}

        {hoveredMarker && hoveredCourt && (
          <CourtTooltip
            court={hoveredCourt}
            marker={hoveredMarker}
            transform={transform}
            enrich={hoveredEnrich}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs text-muted justify-center">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: "var(--color-seal-600)" }}
          />
          대법원
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: "var(--color-civic-600)" }}
          />
          고등법원
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: "var(--color-navy-700)" }}
          />
          지방·가정·행정
        </span>
        <span className="text-muted-soft">· 마커 크기: 소속 판사 수</span>
        <span className="text-muted-soft hidden sm:inline">
          · 휠로 확대/축소 · 드래그로 이동
        </span>
      </div>
    </div>
  );
}

function CourtTooltip({
  court,
  marker,
  transform,
  enrich,
}: {
  court: Court;
  marker: { x: number; y: number };
  transform: { tx: number; ty: number; scale: number };
  enrich?: CourtEnrichment;
}) {
  // Project marker coords through current transform to viewBox space
  const vx = marker.x * transform.scale + transform.tx;
  const vy = marker.y * transform.scale + transform.ty;
  // Tooltip shows above/below depending on space
  const showBelow = vy < HEIGHT * 0.3;
  const left = `${(vx / WIDTH) * 100}%`;
  const top = showBelow
    ? `${((vy + 18) / HEIGHT) * 100}%`
    : `${((vy - 18) / HEIGHT) * 100}%`;

  return (
    <div
      className={`pointer-events-none absolute z-20 -translate-x-1/2 ${
        showBelow ? "" : "-translate-y-full"
      }`}
      style={{ left, top }}
    >
      <div className="rounded-md bg-navy-900 text-white text-xs shadow-lg max-w-[280px] min-w-[220px]">
        <div className="px-3 py-2 border-b border-navy-700">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] uppercase tracking-[0.16em] font-semibold text-civic-500">
              {courtTypeLabel(court.type)}
            </span>
            <span className="text-[9px] font-mono text-white/40">
              #{court.id.replace("court-", "").padStart(3, "0")}
            </span>
          </div>
          <div className="font-medium leading-snug">{court.name}</div>
          <div className="text-[10px] text-white/60 mt-0.5">
            {court.region}
          </div>
        </div>
        <div className="px-3 py-2 space-y-1.5 text-[11px]">
          <Row label="소속 판사" value={`${court.judgeCount}명`} />
          {typeof enrich?.totalCases === "number" && (
            <Row label="등록 판례" value={`${enrich.totalCases}건`} />
          )}
          {typeof enrich?.totalArticles === "number" && (
            <Row label="관련 기사" value={`${enrich.totalArticles}건`} />
          )}
          {typeof enrich?.agreementRate === "number" &&
            (enrich.agreementVotes ?? 0) > 0 && (
              <Row
                label="판결 동의율"
                value={`${Math.round(enrich.agreementRate * 100)}%`}
                muted={`(${enrich.agreementVotes}표)`}
              />
            )}
        </div>
        {enrich?.topJudges && enrich.topJudges.length > 0 && (
          <div className="px-3 py-2 border-t border-navy-700">
            <div className="text-[9px] uppercase tracking-[0.16em] font-semibold text-white/50 mb-1.5">
              주요 판사 (관련 기사 순)
            </div>
            <ul className="space-y-1">
              {enrich.topJudges.slice(0, 3).map((j) => (
                <li
                  key={j.id}
                  className="flex items-baseline justify-between gap-2 text-[11px]"
                >
                  <span>
                    <span className="font-medium">{j.name}</span>
                    <span className="text-white/50 ml-1">{j.position}</span>
                  </span>
                  <span className="font-mono tabular-nums text-white/50 text-[10px]">
                    {j.articleCount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="px-3 py-1.5 border-t border-navy-700 text-[10px] text-civic-500 flex items-center gap-1">
          <svg
            viewBox="0 0 24 24"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M5 12h14" />
            <path d="m13 5 7 7-7 7" />
          </svg>
          클릭하여 상세 보기
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-white/60">{label}</span>
      <span className="font-mono tabular-nums">
        {value}
        {muted && <span className="text-white/40 ml-1">{muted}</span>}
      </span>
    </div>
  );
}
