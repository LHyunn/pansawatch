import judgesData from "@/data/judges.json";
import courtsData from "@/data/courts.json";
import articlesData from "@/data/articles.json";
import casesData from "@/data/cases.json";
import judgeArticlesData from "@/data/judgeArticles.json";
import caseVotesData from "@/data/caseVotes.json";
import articleVotesData from "@/data/articleVotes.json";
import type {
  Article,
  ArticleVote,
  ArticleVoteSummary,
  ArticleWithJudges,
  Case,
  CaseType,
  CaseVote,
  CaseVoteSummary,
  Court,
  Judge,
  JudgeAgreementStat,
  JudgeAppealStat,
  JudgeArticle,
  JudgeWithStats,
  MonthlyCount,
} from "@/lib/types";

const judges = judgesData as Judge[];
const courts = courtsData as Court[];
const articles = articlesData as Article[];
const cases = casesData as Case[];
const judgeArticles = judgeArticlesData as JudgeArticle[];
const caseVotes = caseVotesData as CaseVote[];
const articleVotes = articleVotesData as ArticleVote[];

const judgeById = new Map(judges.map((j) => [j.id, j]));
const courtById = new Map(courts.map((c) => [c.id, c]));
const caseById = new Map(cases.map((c) => [c.id, c]));

// Volatile maps (articles + judgeArticles) are rebuilt on each access so that
// JSON file edits picked up by Turbopack's HMR are reflected immediately —
// the static `articles` / `judgeArticles` references reflect the latest import,
// but a module-level Map built once at module init would freeze stale data.
// Cost: a few thousand-element Map rebuilds per request — negligible.
function db() {
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const articlesByJudge = new Map<string, JudgeArticle[]>();
  const judgesByArticle = new Map<string, JudgeArticle[]>();
  for (const ja of judgeArticles) {
    if (!articlesByJudge.has(ja.judgeId)) articlesByJudge.set(ja.judgeId, []);
    articlesByJudge.get(ja.judgeId)!.push(ja);
    if (!judgesByArticle.has(ja.articleId)) judgesByArticle.set(ja.articleId, []);
    judgesByArticle.get(ja.articleId)!.push(ja);
  }
  return { articles, judgeArticles, articleById, articlesByJudge, judgesByArticle };
}

const casesByJudge = new Map<string, Case[]>();
for (const c of cases) {
  if (!casesByJudge.has(c.judgeId)) casesByJudge.set(c.judgeId, []);
  casesByJudge.get(c.judgeId)!.push(c);
}

const judgesByCourt = new Map<string, Judge[]>();
for (const j of judges) {
  if (!judgesByCourt.has(j.courtId)) judgesByCourt.set(j.courtId, []);
  judgesByCourt.get(j.courtId)!.push(j);
}

const votesByCase = new Map<string, CaseVote[]>();
for (const v of caseVotes) {
  if (!votesByCase.has(v.caseId)) votesByCase.set(v.caseId, []);
  votesByCase.get(v.caseId)!.push(v);
}

const votesByArticle = new Map<string, ArticleVote[]>();
for (const v of articleVotes) {
  if (!votesByArticle.has(v.articleId)) votesByArticle.set(v.articleId, []);
  votesByArticle.get(v.articleId)!.push(v);
}

// ---------------------------------------------------------------------------
// Existing helpers
// ---------------------------------------------------------------------------

export function getAllJudges(): Judge[] {
  return judges;
}

export function getAllCourts(): Court[] {
  return courts;
}

export function getAllArticles(): Article[] {
  return db().articles;
}

export function getAllCases(): Case[] {
  return cases;
}

export function getJudge(id: string): Judge | null {
  return judgeById.get(id) ?? null;
}

// 같은 (court, name) 그룹 내 안정 정렬용 인덱스. id 사전순.
const judgeNameGroups = (() => {
  const map = new Map<string, Judge[]>();
  for (const j of judges) {
    const key = `${j.court}${j.name}`;
    const arr = map.get(key) ?? [];
    arr.push(j);
    map.set(key, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.id.localeCompare(b.id));
  }
  return map;
})();

/**
 * 동명이인이 같은 법원에 있을 때만 1, 2 ... 접미. 단일이면 이름만.
 */
export function judgeSlug(judge: Judge): string {
  const key = `${judge.court}${judge.name}`;
  const group = judgeNameGroups.get(key) ?? [judge];
  if (group.length === 1) return judge.name;
  const idx = group.findIndex((j) => j.id === judge.id);
  return `${judge.name}${idx + 1}`;
}

/**
 * /judges/{court}/{slug} 형태의 절대 경로. Link href 에 그대로 사용.
 * Next.js 가 path segment 인코딩을 처리하므로 raw 한글 그대로 둔다.
 */
export function getJudgePath(judge: Judge): string {
  return `/judges/${encodeURIComponent(judge.court)}/${encodeURIComponent(
    judgeSlug(judge)
  )}`;
}

/**
 * id 만 알고 있을 때 (검색 결과·관련 판사 칩 등) 사용하는 편의 함수.
 * 알 수 없는 id 면 빈 hash 를 반환해 navigation 를 차단.
 */
export function getJudgePathById(id: string): string {
  const j = judgeById.get(id);
  return j ? getJudgePath(j) : "#";
}

/**
 * 슬러그(이름 또는 이름+숫자) + 법원명으로 판사 lookup.
 * - suffix 없는 슬러그: 그룹 내 1명일 때만 매치, 동명이인이면 ambiguous → null
 * - suffix 있는 슬러그: 정렬 인덱스 기반 정확 매치
 */
export function getJudgeBySlug(
  courtName: string,
  nameSlug: string
): Judge | null {
  const m = nameSlug.match(/^(.+?)(\d+)$/);
  let baseName: string;
  let suffixIdx: number | null = null;
  if (m) {
    baseName = m[1]!;
    suffixIdx = parseInt(m[2]!, 10) - 1;
  } else {
    baseName = nameSlug;
  }
  const group = judgeNameGroups.get(`${courtName}${baseName}`);
  if (!group || group.length === 0) return null;
  if (suffixIdx !== null) return group[suffixIdx] ?? null;
  if (group.length === 1) return group[0]!;
  return null;
}

export function getCourt(id: string): Court | null {
  return courtById.get(id) ?? null;
}

const courtByName = new Map(courts.map((c) => [c.name, c]));

/**
 * URL slug: 법원 이름의 공백을 하이픈으로 치환.
 * 예: "수원지방법원 성남지원" → "수원지방법원-성남지원".
 * 데이터에는 하이픈 포함 이름이 없어 역변환 시 충돌 없음.
 */
export function courtSlug(court: Court): string {
  return court.name.replace(/ /g, "-");
}

export function getCourtPath(court: Court): string {
  return `/courts/${encodeURIComponent(courtSlug(court))}`;
}

export function getCourtPathById(id: string): string {
  const c = courtById.get(id);
  return c ? getCourtPath(c) : "#";
}

/**
 * URL slug → Court. 하이픈을 공백으로 되돌려 정확 매치.
 */
export function getCourtBySlug(slug: string): Court | null {
  const name = slug.replace(/-/g, " ");
  return courtByName.get(name) ?? null;
}

export function getArticle(id: string): Article | null {
  return db().articleById.get(id) ?? null;
}

export function getJudgesByCourt(courtId: string): Judge[] {
  return judgesByCourt.get(courtId) ?? [];
}

export function getArticlesByJudge(judgeId: string): Article[] {
  const d = db();
  const links = d.articlesByJudge.get(judgeId) ?? [];
  return links
    .map((l) => d.articleById.get(l.articleId))
    .filter((a): a is Article => Boolean(a))
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}

export function getCasesByJudge(judgeId: string): Case[] {
  return (casesByJudge.get(judgeId) ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.decisionDate).getTime() -
        new Date(a.decisionDate).getTime()
    );
}

export function getJudgesForArticle(articleId: string): Judge[] {
  const links = db().judgesByArticle.get(articleId) ?? [];
  return links
    .map((l) => judgeById.get(l.judgeId))
    .filter((j): j is Judge => Boolean(j));
}

export function getJudgeWithStats(j: Judge): JudgeWithStats {
  return {
    ...j,
    articleCount: db().articlesByJudge.get(j.id)?.length ?? 0,
    caseCount: casesByJudge.get(j.id)?.length ?? 0,
  };
}

export function getRecentArticles(limit = 12): ArticleWithJudges[] {
  return db().articles
    .slice()
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, limit)
    .map((a) => ({
      ...a,
      judges: getJudgesForArticle(a.id).map((j) => ({
        id: j.id,
        name: j.name,
        court: j.court,
      })),
    }));
}

export function getArticlesPage(opts: {
  page?: number;
  pageSize?: number;
  source?: string;
  region?: string;
  from?: string;
  to?: string;
}): { items: ArticleWithJudges[]; total: number; page: number; pageSize: number } {
  const { page = 1, pageSize = 20, source, region, from, to } = opts;
  let filtered = db().articles.slice();
  if (source) filtered = filtered.filter((a) => a.source === source);
  if (from) filtered = filtered.filter((a) => a.publishedAt >= from);
  if (to) filtered = filtered.filter((a) => a.publishedAt <= to);
  if (region) {
    filtered = filtered.filter((a) => {
      const linked = getJudgesForArticle(a.id);
      return linked.some((j) => j.courtRegion === region);
    });
  }
  filtered.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map((a) => ({
    ...a,
    judges: getJudgesForArticle(a.id).map((j) => ({
      id: j.id,
      name: j.name,
      court: j.court,
    })),
  }));
  return { items, total, page, pageSize };
}

export function getAllSources(): string[] {
  return Array.from(new Set(db().articles.map((a) => a.source))).sort();
}

export function getAllRegions(): string[] {
  return Array.from(new Set(courts.map((c) => c.region))).sort();
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Civic record style: YYYY.MM.DD
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

export function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 30) return `${Math.floor(days / 30)}개월 전`;
  if (days > 0) return `${days}일 전`;
  if (hours > 0) return `${hours}시간 전`;
  if (minutes > 0) return `${minutes}분 전`;
  return "방금 전";
}

export function getCourtTypeLabel(t: Court["type"]): string {
  const map: Record<Court["type"], string> = {
    supreme: "대법원",
    high: "고등법원",
    district: "지방법원",
    family: "가정법원",
    administrative: "행정법원",
    rehabilitation: "회생법원",
    patent: "특허법원",
  };
  return map[t];
}

export function getStats() {
  return {
    courts: courts.length,
    judges: judges.length,
    articles: db().articles.length,
    cases: cases.length,
  };
}

// ---------------------------------------------------------------------------
// New helpers (v2)
// ---------------------------------------------------------------------------

export function getCaseVoteSummary(caseId: string): CaseVoteSummary {
  const votes = votesByCase.get(caseId) ?? [];
  let agree = 0;
  let disagree = 0;
  let appropriate = 0;
  let tooLight = 0;
  let tooHeavy = 0;

  for (const v of votes) {
    if (v.voteCategory === "decision_agreement") {
      if (v.voteValue === "agree") agree++;
      else if (v.voteValue === "disagree") disagree++;
    } else if (v.voteCategory === "sentencing_fairness") {
      if (v.voteValue === "appropriate") appropriate++;
      else if (v.voteValue === "too_light") tooLight++;
      else if (v.voteValue === "too_heavy") tooHeavy++;
    }
  }

  const agreementTotal = agree + disagree;
  const sentencingTotal = appropriate + tooLight + tooHeavy;

  const summary: CaseVoteSummary = {
    agreement: {
      agree,
      disagree,
      total: agreementTotal,
      rate: agreementTotal > 0 ? agree / agreementTotal : 0,
    },
  };

  if (sentencingTotal > 0) {
    summary.sentencing = {
      appropriate,
      tooLight,
      tooHeavy,
      total: sentencingTotal,
      appropriateRate: appropriate / sentencingTotal,
    };
  }

  return summary;
}

export function getJudgeAgreementRate(judgeId: string): JudgeAgreementStat {
  const judgeCases = casesByJudge.get(judgeId) ?? [];
  let agree = 0;
  let total = 0;
  for (const c of judgeCases) {
    const votes = votesByCase.get(c.id) ?? [];
    for (const v of votes) {
      if (v.voteCategory === "decision_agreement") {
        total++;
        if (v.voteValue === "agree") agree++;
      }
    }
  }
  return {
    rate: total > 0 ? agree / total : 0,
    totalVotes: total,
    totalCases: judgeCases.length,
  };
}

export function getJudgeCaseTypeDistribution(
  judgeId: string
): Record<CaseType, number> {
  const dist: Record<CaseType, number> = {
    민사: 0,
    형사: 0,
    행정: 0,
    가사: 0,
  };
  const judgeCases = casesByJudge.get(judgeId) ?? [];
  for (const c of judgeCases) {
    dist[c.caseType] = (dist[c.caseType] ?? 0) + 1;
  }
  return dist;
}

export function getJudgeAppealRate(judgeId: string): JudgeAppealStat {
  const judge = judgeById.get(judgeId);
  const judgeCases = casesByJudge.get(judgeId) ?? [];
  const appealedCount = judgeCases.filter((c) => c.isAppealed).length;
  const reversedCount = judgeCases.filter(
    (c) =>
      c.isAppealed &&
      (c.appealResult === "파기환송" || c.appealResult === "파기자판")
  ).length;
  const rate = appealedCount > 0 ? reversedCount / appealedCount : 0;

  // court average — across all judges in same court
  let courtAverage = 0;
  if (judge) {
    const sameCourtJudges = judgesByCourt.get(judge.courtId) ?? [];
    let totalAppealed = 0;
    let totalReversed = 0;
    for (const sj of sameCourtJudges) {
      const cs = casesByJudge.get(sj.id) ?? [];
      for (const c of cs) {
        if (c.isAppealed) {
          totalAppealed++;
          if (c.appealResult === "파기환송" || c.appealResult === "파기자판") {
            totalReversed++;
          }
        }
      }
    }
    courtAverage = totalAppealed > 0 ? totalReversed / totalAppealed : 0;
  }

  return {
    appealedCount,
    reversedCount,
    rate,
    courtAverage,
  };
}

export interface MonthlyAgreement {
  month: string; // "2026-04"
  rate: number; // 0~1
  voteCount: number;
}

const monthlyAgreementCache = new Map<string, MonthlyAgreement[]>();

export function getJudgeMonthlyAgreementRate(
  judgeId: string,
  months: number = 12
): MonthlyAgreement[] {
  const cacheKey = `${judgeId}:${months}`;
  const cached = monthlyAgreementCache.get(cacheKey);
  if (cached) return cached;

  // Anchor on the most recent caseVote so the result is deterministic and
  // independent of "now".
  const anchor =
    caseVotes.length > 0
      ? caseVotes
          .map((v) => new Date(v.createdAt).getTime())
          .reduce((a, b) => Math.max(a, b), 0)
      : 0;
  const anchorDate = anchor > 0 ? new Date(anchor) : new Date(0);

  const buckets: { month: string; agree: number; total: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - i, 1)
    );
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    buckets.push({ month: `${yyyy}-${mm}`, agree: 0, total: 0 });
  }

  const byKey = new Map(buckets.map((b) => [b.month, b]));
  const judgeCases = casesByJudge.get(judgeId) ?? [];
  for (const c of judgeCases) {
    const votes = votesByCase.get(c.id) ?? [];
    for (const v of votes) {
      if (v.voteCategory !== "decision_agreement") continue;
      const d = new Date(v.createdAt);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const bucket = byKey.get(`${yyyy}-${mm}`);
      if (!bucket) continue;
      bucket.total++;
      if (v.voteValue === "agree") bucket.agree++;
    }
  }

  const result: MonthlyAgreement[] = buckets.map((b) => ({
    month: b.month,
    rate: b.total > 0 ? b.agree / b.total : 0,
    voteCount: b.total,
  }));
  monthlyAgreementCache.set(cacheKey, result);
  return result;
}

export function getJudgeMonthlyArticleCounts(
  judgeId: string,
  months: number = 12
): MonthlyCount[] {
  const judgeArticles = getArticlesByJudge(judgeId);
  // build last `months` buckets ending at the most recent article (deterministic)
  // Use the most recent publishedAt across ALL articles as the anchor so the
  // result is stable regardless of "now".
  const allArticles = db().articles;
  const anchor =
    allArticles.length > 0
      ? allArticles
          .map((a) => new Date(a.publishedAt).getTime())
          .reduce((a, b) => Math.max(a, b), 0)
      : 0;
  const anchorDate = anchor > 0 ? new Date(anchor) : new Date(0);

  const buckets: MonthlyCount[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - i, 1)
    );
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    buckets.push({ month: `${yyyy}-${mm}`, count: 0 });
  }

  const byKey = new Map(buckets.map((b) => [b.month, b]));
  for (const a of judgeArticles) {
    const d = new Date(a.publishedAt);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.count++;
  }

  return buckets;
}

export function searchCasesByNumber(query: string): Case[] {
  const q = query.trim();
  if (!q) return [];
  return cases.filter((c) => c.caseNumber.includes(q));
}

export function getCourtAgreementRate(
  courtId: string
): { rate: number; totalVotes: number; totalCases: number } {
  const courtJudges = judgesByCourt.get(courtId) ?? [];
  let agree = 0;
  let total = 0;
  let totalCases = 0;
  for (const j of courtJudges) {
    const judgeCases = casesByJudge.get(j.id) ?? [];
    totalCases += judgeCases.length;
    for (const c of judgeCases) {
      const votes = votesByCase.get(c.id) ?? [];
      for (const v of votes) {
        if (v.voteCategory === "decision_agreement") {
          total++;
          if (v.voteValue === "agree") agree++;
        }
      }
    }
  }
  return {
    rate: total > 0 ? agree / total : 0,
    totalVotes: total,
    totalCases,
  };
}

export function getArticleVoteSummary(articleId: string): ArticleVoteSummary {
  const votes = votesByArticle.get(articleId) ?? [];
  let useful = 0;
  let notUseful = 0;
  for (const v of votes) {
    if (v.voteType === "useful") useful++;
    else if (v.voteType === "not_useful") notUseful++;
  }
  const total = useful + notUseful;
  return {
    useful,
    notUseful,
    total,
    rate: total > 0 ? useful / total : 0,
  };
}

export function getCase(id: string): Case | null {
  return caseById.get(id) ?? null;
}

export function getAllJudgesWithFullStats(): (JudgeWithStats & {
  agreementRate: number;
  agreementVotes: number;
})[] {
  return judges.map((j) => {
    const stats = getJudgeWithStats(j);
    const agreement = getJudgeAgreementRate(j.id);
    return {
      ...stats,
      agreementRate: agreement.rate,
      agreementVotes: agreement.totalVotes,
    };
  });
}
