/**
 * PansaWatch — db/seed.ts
 *
 * Phase 1 mock JSON 데이터를 Phase 2 Supabase Postgres 로 적재.
 *
 * 사용:
 *   1. .env.local 에 다음 환경변수 설정
 *        SUPABASE_URL=https://<project-ref>.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
 *   2. (필요 시) npm install --save-dev @supabase/supabase-js dotenv ts-node
 *   3. 실행
 *        npx ts-node db/seed.ts
 *      또는
 *        bun db/seed.ts
 *
 * 동작:
 *   - 무결성 순서대로 upsert: courts -> judges -> articles -> cases
 *                          -> judge_articles -> case_votes -> article_votes
 *   - 500 row 단위 batch.
 *   - userId === null 인 mock 투표는 그대로 NULL 로 적재 (Phase 1 시드 한정).
 *     Phase 4 에서 user_id NOT NULL 강화 마이그레이션 적용 시 정리.
 *   - JSON 의 camelCase 를 DB 의 snake_case 로 변환.
 *   - 진행률을 stdout 에 출력.
 *
 * 주의:
 *   - service_role 키는 RLS 를 우회. 절대 클라이언트 번들에 노출 금지.
 *   - 본 파일은 실제 DB 가 없는 Phase 1 시점에 타입 체크만 통과시키는 것이 목표.
 *     실행 전 @supabase/supabase-js 설치 필요.
 */

import path from "node:path";
import { promises as fs } from "node:fs";

// ---------------------------------------------------------------------------
// minimal Supabase client typings — @supabase/supabase-js 미설치 시에도
// tsc --noEmit 통과시키기 위한 자체 정의. 실제 client 는 동적 import.
// ---------------------------------------------------------------------------

type PostgrestError = { message: string; code?: string; details?: string };

interface PostgrestSingleResponse<T> {
  data: T | null;
  error: PostgrestError | null;
}

interface PostgrestQueryBuilder {
  upsert(
    rows: Record<string, unknown>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean }
  ): Promise<PostgrestSingleResponse<unknown>>;
  delete(): {
    neq: (col: string, val: string) => Promise<PostgrestSingleResponse<unknown>>;
  };
}

interface SupabaseClientLike {
  from(table: string): PostgrestQueryBuilder;
}

type CreateClientFn = (
  url: string,
  key: string,
  options?: Record<string, unknown>
) => SupabaseClientLike;

// ---------------------------------------------------------------------------
// JSON 입력 타입 (lib/types.ts 와 동일하나 의존을 끊기 위해 재정의 — Phase 2 에서
// 실제 DB row 타입 (snake_case) 으로 분리될 예정)
// ---------------------------------------------------------------------------

interface CourtJson {
  id: string;
  name: string;
  type: "supreme" | "high" | "district" | "family" | "administrative";
  region: string;
  address: string;
  latitude: number;
  longitude: number;
  judgeCount: number;
}

interface JudgeJson {
  id: string;
  name: string;
  courtId: string;
  court: string;
  courtRegion: string;
  position: string;
  division: string;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ArticleJson {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  aiSummary: string;
  collectedAt: string;
}

interface CaseJson {
  id: string;
  caseNumber: string;
  court: string;
  judgeId: string;
  caseType: "민사" | "형사" | "행정" | "가사";
  decisionDate: string;
  aiSummary: string;
  sourceUrl: string;
  decisionResult: string;
  isAppealed: boolean;
  appealResult: string | null;
}

interface JudgeArticleJson {
  id: string;
  judgeId: string;
  articleId: string;
  relevanceScore: number;
}

interface CaseVoteJson {
  id: string;
  userId: string | null;
  caseId: string;
  voteCategory: "decision_agreement" | "sentencing_fairness";
  voteValue: "agree" | "disagree" | "appropriate" | "too_light" | "too_heavy";
  createdAt: string;
}

interface ArticleVoteJson {
  id: string;
  userId: string | null;
  articleId: string;
  voteType: "useful" | "not_useful";
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 설정
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500;
const DATA_DIR = path.resolve(process.cwd(), "data");

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function readJson<T>(file: string): Promise<T> {
  const full = path.join(DATA_DIR, file);
  const buf = await fs.readFile(full, "utf-8");
  return JSON.parse(buf) as T;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function loadCreateClient(): Promise<CreateClientFn> {
  // 동적 import — 패키지 미설치 시에도 tsc 통과.
  // 모듈 이름을 변수로 두어 타입체커의 정적 모듈 해석을 우회.
  // 실행 시점에 미설치면 친절한 에러를 던진다.
  const moduleName = "@supabase/supabase-js";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dynImport = new Function(
      "spec",
      "return import(spec);"
    ) as (spec: string) => Promise<{ createClient: CreateClientFn }>;
    const mod = await dynImport(moduleName);
    return mod.createClient;
  } catch {
    throw new Error(
      "@supabase/supabase-js 가 설치되어 있지 않습니다.\n" +
        "  npm install --save-dev @supabase/supabase-js\n" +
        "후 다시 실행하세요."
    );
  }
}

async function upsertBatched(
  client: SupabaseClientLike,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<void> {
  const total = rows.length;
  if (total === 0) {
    process.stdout.write(`  [${table}] 0 rows — skip\n`);
    return;
  }
  const batches = chunk(rows, BATCH_SIZE);
  let done = 0;
  for (const b of batches) {
    const { error } = await client
      .from(table)
      .upsert(b, { onConflict });
    if (error) {
      throw new Error(`upsert ${table} 실패: ${error.message}`);
    }
    done += b.length;
    process.stdout.write(
      `  [${table}] ${done}/${total} (${((done / total) * 100).toFixed(1)}%)\n`
    );
  }
}

// ---------------------------------------------------------------------------
// row mappers (camelCase JSON -> snake_case DB)
// ---------------------------------------------------------------------------

function mapCourt(c: CourtJson): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    region: c.region,
    address: c.address,
    latitude: c.latitude,
    longitude: c.longitude,
    judge_count: c.judgeCount,
  };
}

function mapJudge(j: JudgeJson): Record<string, unknown> {
  return {
    id: j.id,
    name: j.name,
    court_id: j.courtId,
    court: j.court,
    court_region: j.courtRegion,
    position: j.position,
    division: j.division,
    photo_url: j.photoUrl,
    created_at: j.createdAt,
    updated_at: j.updatedAt,
  };
}

function mapArticle(a: ArticleJson): Record<string, unknown> {
  return {
    id: a.id,
    title: a.title,
    url: a.url,
    source: a.source,
    published_at: a.publishedAt,
    ai_summary: a.aiSummary,
    collected_at: a.collectedAt,
  };
}

function mapCase(c: CaseJson): Record<string, unknown> {
  return {
    id: c.id,
    case_number: c.caseNumber,
    court: c.court,
    judge_id: c.judgeId,
    case_type: c.caseType,
    decision_date: c.decisionDate,
    ai_summary: c.aiSummary,
    source_url: c.sourceUrl,
    decision_result: c.decisionResult,
    is_appealed: c.isAppealed,
    appeal_result: c.appealResult,
  };
}

function mapJudgeArticle(ja: JudgeArticleJson): Record<string, unknown> {
  return {
    id: ja.id,
    judge_id: ja.judgeId,
    article_id: ja.articleId,
    relevance_score: ja.relevanceScore,
  };
}

function mapCaseVote(v: CaseVoteJson): Record<string, unknown> {
  return {
    id: v.id,
    user_id: v.userId, // null 허용 (mock seed)
    case_id: v.caseId,
    vote_category: v.voteCategory,
    vote_value: v.voteValue,
    created_at: v.createdAt ?? new Date().toISOString(),
  };
}

function mapArticleVote(v: ArticleVoteJson): Record<string, unknown> {
  return {
    id: v.id,
    user_id: v.userId,
    article_id: v.articleId,
    vote_type: v.voteType,
    created_at: v.createdAt ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      ".env.local 에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되어 있어야 합니다."
    );
  }

  const createClient = await loadCreateClient();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  process.stdout.write("PansaWatch seed 시작\n");
  process.stdout.write(`  data dir: ${DATA_DIR}\n`);

  // 1. courts
  process.stdout.write("[1/7] courts\n");
  const courts = await readJson<CourtJson[]>("courts.json");
  await upsertBatched(client, "courts", courts.map(mapCourt), "id");

  // 2. judges
  process.stdout.write("[2/7] judges\n");
  const judges = await readJson<JudgeJson[]>("judges.json");
  await upsertBatched(client, "judges", judges.map(mapJudge), "id");

  // 3. articles
  process.stdout.write("[3/7] articles\n");
  const articles = await readJson<ArticleJson[]>("articles.json");
  await upsertBatched(client, "articles", articles.map(mapArticle), "id");

  // 4. cases
  process.stdout.write("[4/7] cases\n");
  const cases = await readJson<CaseJson[]>("cases.json");
  await upsertBatched(client, "cases", cases.map(mapCase), "id");

  // 5. judge_articles
  process.stdout.write("[5/7] judge_articles\n");
  const judgeArticles = await readJson<JudgeArticleJson[]>(
    "judgeArticles.json"
  );
  await upsertBatched(
    client,
    "judge_articles",
    judgeArticles.map(mapJudgeArticle),
    "id"
  );

  // 6. case_votes
  process.stdout.write("[6/7] case_votes\n");
  const caseVotes = await readJson<CaseVoteJson[]>("caseVotes.json");
  await upsertBatched(client, "case_votes", caseVotes.map(mapCaseVote), "id");

  // 7. article_votes
  process.stdout.write("[7/7] article_votes\n");
  const articleVotes = await readJson<ArticleVoteJson[]>("articleVotes.json");
  await upsertBatched(
    client,
    "article_votes",
    articleVotes.map(mapArticleVote),
    "id"
  );

  process.stdout.write("seed 완료.\n");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`seed 실패: ${msg}\n`);
  process.exit(1);
});
