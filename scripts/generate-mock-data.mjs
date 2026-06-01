import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");

const judges = JSON.parse(fs.readFileSync(path.join(dataDir, "judges.json"), "utf8"));
const courts = JSON.parse(fs.readFileSync(path.join(dataDir, "courts.json"), "utf8"));

function rand(n) {
  return Math.floor(Math.random() * n);
}
function pick(arr) {
  return arr[rand(arr.length)];
}
function pickN(arr, n) {
  const copy = arr.slice();
  const out = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = rand(copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}
function chance(p) {
  return Math.random() < p;
}

const SOURCES = [
  "한겨레",
  "조선일보",
  "중앙일보",
  "동아일보",
  "연합뉴스",
  "뉴시스",
  "KBS",
  "MBC",
  "SBS",
  "JTBC",
  "YTN",
  "매일경제",
  "한국경제",
  "오마이뉴스",
  "프레시안",
];

const CIVIL_TOPICS = [
  { key: "횡령", body: "기업 자금 횡령 혐의" },
  { key: "사기", body: "투자 사기 사건" },
  { key: "명예훼손", body: "온라인 명예훼손" },
  { key: "부동산 분쟁", body: "재개발 조합 분쟁" },
  { key: "노동 분쟁", body: "부당해고 청구" },
  { key: "임대차", body: "상가 임대차 분쟁" },
  { key: "손해배상", body: "교통사고 손해배상" },
  { key: "지식재산권", body: "특허 침해 분쟁" },
  { key: "주주대표소송", body: "이사회 결정 위반" },
  { key: "부정경쟁행위", body: "영업비밀 유출 의혹" },
];

const CRIMINAL_TOPICS = [
  { key: "뇌물수수", body: "공무원 뇌물수수 사건" },
  { key: "조세포탈", body: "법인 조세포탈 혐의" },
  { key: "마약 거래", body: "대규모 마약 유통 사건" },
  { key: "성범죄", body: "디지털 성범죄 사건" },
  { key: "공직선거법 위반", body: "선거법 위반 사건" },
  { key: "업무상 과실치사", body: "현장 안전관리 사고" },
  { key: "특정경제범죄가중처벌", body: "수백억 원대 특경법 사건" },
];

const ADMIN_TOPICS = [
  { key: "행정처분 취소", body: "영업정지 처분 취소 청구" },
  { key: "조세부과처분", body: "세무서 부과처분 다툼" },
  { key: "정보공개거부", body: "정보공개 거부 처분" },
  { key: "허가취소", body: "건축허가 취소 사건" },
];

const FAMILY_TOPICS = [
  { key: "이혼", body: "재산분할 이혼 청구" },
  { key: "친권", body: "친권자 변경 심판" },
  { key: "상속", body: "상속재산 분할" },
  { key: "양육비", body: "양육비 청구" },
];

const TOPICS = {
  민사: CIVIL_TOPICS,
  형사: CRIMINAL_TOPICS,
  행정: ADMIN_TOPICS,
  가사: FAMILY_TOPICS,
};

const HEADLINE_TEMPLATES = [
  ({ judge, topic, court, outcome }) =>
    `${court} ${judge.name} 판사, ${topic.body} 1심 ${outcome}`,
  ({ judge, topic, court }) =>
    `"${topic.key} 의혹" ${court} ${judge.name} 부장판사 재판부, 다음 달 선고`,
  ({ judge, topic }) =>
    `${judge.name} 판사 "${topic.body}, 양측 입장 신중히 검토 필요"`,
  ({ judge, topic, court }) =>
    `${court} ${judge.name} 재판부, ${topic.body} 항소심 심리 종결`,
  ({ judge, court }) =>
    `${court} ${judge.name} ${judge.position}, 신임 재판부 합류`,
  ({ judge, topic, outcome }) =>
    `${topic.body}…${judge.name} 판사 "${outcome}"`,
  ({ judge, topic, court }) =>
    `${court} ${judge.name} 판사, ${topic.key} 관련 가처분 신청 인용`,
  ({ judge, topic }) =>
    `${judge.name} 부장판사, ${topic.body} 핵심 증거 채택 결정`,
  ({ judge, court }) =>
    `${court} ${judge.name} ${judge.position}, 법조인의 길 30년… 인터뷰`,
  ({ judge, topic }) =>
    `${judge.name} 판사 재판부, ${topic.body} 조정 권고`,
  ({ judge, court, topic }) =>
    `[단독] ${court} ${judge.name} 판사, ${topic.body} 무죄 취지 판단`,
  ({ judge, topic }) =>
    `"${topic.body} 책임 분명" ${judge.name} 재판부 판단`,
];

const OUTCOMES_CRIMINAL = [
  "징역 3년 선고",
  "집행유예 판결",
  "무죄 선고",
  "징역 5년 실형",
  "벌금형",
  "공소기각",
];

const OUTCOMES_CIVIL = [
  "원고 일부 승소",
  "원고 청구 기각",
  "조정 권고",
  "피고 일부 승소",
  "강제집행정지",
];

const SUMMARY_TEMPLATES = [
  ({ judge, topic, court, outcome }) =>
    `${court} ${judge.name} ${judge.position}가 담당한 ${topic.body}에 대해 ${outcome} 결정이 내려졌다. 재판부는 사건 기록과 관련 증거를 종합적으로 검토했다고 밝혔다. 법조계는 이번 판단이 유사 사건에 미칠 영향을 주목하고 있다.`,
  ({ judge, topic }) =>
    `${judge.name} 부장판사 재판부는 ${topic.body}와 관련해 양측의 주장을 정리했다. ${judge.name} 판사는 신중한 심리가 필요하다고 강조했다. 다음 기일은 추후 지정될 예정이다.`,
  ({ judge, topic, court }) =>
    `${court}는 ${topic.body}를 심리한 결과 핵심 쟁점에 대한 판단을 내놓았다. ${judge.name} ${judge.position}가 재판장을 맡은 이번 사건은 사회적 관심이 높았다. 항소 가능성이 거론된다.`,
  ({ judge, topic }) =>
    `${judge.name} 판사가 담당한 ${topic.body}에서 새로운 증거가 채택됐다. 법원은 향후 추가 심리를 진행한다는 입장이다. 사건의 향방에 관심이 모아지고 있다.`,
  ({ judge, court }) =>
    `${court} ${judge.name} ${judge.position}가 신임 재판부에 합류해 본격적인 사건 심리를 시작한다. 임관 이래 다양한 분야의 사건을 다뤄왔다는 평가다.`,
];

const TODAY = new Date("2026-04-28T00:00:00Z");
const SIX_MONTHS_AGO = new Date(TODAY);
SIX_MONTHS_AGO.setMonth(SIX_MONTHS_AGO.getMonth() - 6);

function randomDateInRange(from, to) {
  const t = from.getTime() + Math.random() * (to.getTime() - from.getTime());
  return new Date(t);
}

function isoZ(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

const articles = [];
const judgeArticles = [];

const ARTICLE_COUNT = 130;
for (let i = 1; i <= ARTICLE_COUNT; i++) {
  const numJudges = chance(0.65) ? 1 : chance(0.85) ? 2 : 3;
  const linkedJudges = pickN(judges, numJudges);
  const primary = linkedJudges[0];
  const court = courts.find((c) => c.id === primary.courtId) || courts[0];
  const caseTypes = ["민사", "형사", "행정", "가사"];
  const caseType =
    primary.court === "서울행정법원"
      ? "행정"
      : primary.court === "서울가정법원"
        ? "가사"
        : pick(caseTypes);
  const topic = pick(TOPICS[caseType]);
  const outcome =
    caseType === "형사" ? pick(OUTCOMES_CRIMINAL) : pick(OUTCOMES_CIVIL);
  const headlineFn = pick(HEADLINE_TEMPLATES);
  const title = headlineFn({
    judge: primary,
    topic,
    court: primary.court,
    outcome,
  });
  const summaryFn = pick(SUMMARY_TEMPLATES);
  const aiSummary = summaryFn({
    judge: primary,
    topic,
    court: primary.court,
    outcome,
  });
  const publishedAt = randomDateInRange(SIX_MONTHS_AGO, TODAY);
  const collectedAt = new Date(publishedAt);
  collectedAt.setHours(collectedAt.getHours() + Math.floor(Math.random() * 48));
  const article = {
    id: `article-${i}`,
    title,
    url: `https://example.com/news/article-${i}`,
    source: pick(SOURCES),
    publishedAt: isoZ(publishedAt),
    aiSummary,
    collectedAt: isoZ(collectedAt > TODAY ? TODAY : collectedAt),
  };
  articles.push(article);
  linkedJudges.forEach((j, idx) => {
    judgeArticles.push({
      id: `ja-${judgeArticles.length + 1}`,
      judgeId: j.id,
      articleId: article.id,
      relevanceScore: idx === 0 ? 0.85 + Math.random() * 0.15 : 0.5 + Math.random() * 0.3,
    });
  });
}

const articlesPerJudge = new Map();
for (const ja of judgeArticles) {
  articlesPerJudge.set(ja.judgeId, (articlesPerJudge.get(ja.judgeId) ?? 0) + 1);
}

const heavyJudges = pickN(judges, 8);
const heavyIds = new Set(heavyJudges.map((j) => j.id));
for (const j of heavyJudges) {
  const extra = 4 + Math.floor(Math.random() * 8);
  for (let k = 0; k < extra; k++) {
    const articleNum = articles.length + 1;
    const caseTypes = ["민사", "형사", "행정", "가사"];
    const caseType = pick(caseTypes);
    const topic = pick(TOPICS[caseType]);
    const outcome =
      caseType === "형사" ? pick(OUTCOMES_CRIMINAL) : pick(OUTCOMES_CIVIL);
    const title = pick(HEADLINE_TEMPLATES)({
      judge: j,
      topic,
      court: j.court,
      outcome,
    });
    const aiSummary = pick(SUMMARY_TEMPLATES)({
      judge: j,
      topic,
      court: j.court,
      outcome,
    });
    const publishedAt = randomDateInRange(SIX_MONTHS_AGO, TODAY);
    const collectedAt = new Date(publishedAt);
    collectedAt.setHours(
      collectedAt.getHours() + Math.floor(Math.random() * 48)
    );
    const article = {
      id: `article-${articleNum}`,
      title,
      url: `https://example.com/news/article-${articleNum}`,
      source: pick(SOURCES),
      publishedAt: isoZ(publishedAt),
      aiSummary,
      collectedAt: isoZ(collectedAt > TODAY ? TODAY : collectedAt),
    };
    articles.push(article);
    judgeArticles.push({
      id: `ja-${judgeArticles.length + 1}`,
      judgeId: j.id,
      articleId: article.id,
      relevanceScore: 0.8 + Math.random() * 0.2,
    });
  }
}

const cases = [];
const CASE_COUNT_TARGET = 100;
const judgeCaseLoad = new Map();

const DECISION_RESULTS = {
  민사: [
    "원고 승소",
    "원고 일부 승소",
    "피고 승소",
    "조정 권고",
    "강제집행정지",
    "원고 청구 기각",
  ],
  형사: [
    "징역 1년",
    "징역 2년",
    "징역 3년",
    "징역 5년",
    "집행유예",
    "벌금형",
    "무죄",
    "공소기각",
  ],
  행정: ["원고 승소", "원고 일부 승소", "청구 기각"],
  가사: ["조정 성립", "화해 권고", "양육비 결정", "친권자 변경"],
};

const APPEAL_RESULTS = ["원심유지", "파기환송", "파기자판"];

function pickAppealResult() {
  const r = Math.random();
  if (r < 0.5) return "원심유지";
  if (r < 0.8) return "파기환송";
  return "파기자판";
}

const activeJudges = pickN(
  judges,
  Math.min(judges.length, 30)
);

function caseNumber(year, type) {
  if (type === "민사") {
    const sub = chance(0.5) ? "가합" : "가단";
    return `${year}${sub}${10000 + rand(89999)}`;
  }
  if (type === "형사") {
    const sub = pick(["노", "고합", "고단"]);
    return `${year}${sub}${100 + rand(9999)}`;
  }
  if (type === "행정") {
    const sub = chance(0.6) ? "구합" : "구단";
    return `${year}${sub}${100 + rand(9999)}`;
  }
  return `${year}${chance(0.5) ? "드단" : "드합"}${100 + rand(9999)}`;
}

const CASE_SUMMARY = [
  ({ topic, outcome }) =>
    `원고는 ${topic.body}를 주장하며 소송을 제기했다. 재판부는 제출된 증거와 양측의 주장을 면밀히 검토했다. 결론적으로 ${outcome} 판단을 내렸으며, 양측 모두에게 일부 책임이 인정됐다. 본 판결은 향후 유사 사건의 참고가 될 것으로 보인다.`,
  ({ topic }) =>
    `${topic.body}에서 쟁점이 된 것은 양측 간의 계약 해석 문제였다. 재판부는 신의성실 원칙을 강조하며 양측의 주장을 정리했다. 일부 청구는 기각되었으나 핵심 쟁점에서는 원고의 손을 들어주었다. 항소가 제기될 가능성이 있다.`,
  ({ topic }) =>
    `피고인은 ${topic.body}로 기소되었다. 재판부는 증인 신문과 증거기록 검토를 통해 사실관계를 확정했다. 양형에 있어 피고인의 반성과 합의 여부가 고려되었다. 사회적 파장이 큰 사건인 만큼 항소심 결과도 주목된다.`,
  ({ topic }) =>
    `${topic.body}에 관한 본 사건에서 재판부는 행정처분의 적법성 여부를 중점적으로 살펴보았다. 처분의 근거가 된 사실관계와 법령 해석이 쟁점이 되었다. 결과적으로 처분의 일부는 위법한 것으로 인정되었다.`,
  ({ topic }) =>
    `${topic.body}와 관련해 가족 구성원 간 이해관계 조정이 핵심이었다. 재판부는 미성년 자녀의 복리를 최우선으로 고려했다. 양측 합의에 도달할 수 있도록 조정을 적극 권고했다.`,
];

for (let i = 1; i <= CASE_COUNT_TARGET; i++) {
  const j = pick(activeJudges);
  const court = courts.find((c) => c.id === j.courtId);
  let caseType = "민사";
  if (j.court === "서울행정법원") caseType = "행정";
  else if (j.court === "서울가정법원") caseType = "가사";
  else caseType = pick(["민사", "민사", "형사", "형사", "행정", "가사"]);
  const topic = pick(TOPICS[caseType]);
  const decisionDate = randomDateInRange(
    new Date("2023-01-01T00:00:00Z"),
    TODAY
  );
  const year = decisionDate.getUTCFullYear();
  const number = caseNumber(year, caseType);
  const outcome =
    caseType === "형사" ? pick(OUTCOMES_CRIMINAL) : pick(OUTCOMES_CIVIL);
  const summary = pick(CASE_SUMMARY)({ topic, outcome });
  const decisionResult = pick(DECISION_RESULTS[caseType]);
  const isAppealed = chance(0.2);
  const appealResult = isAppealed ? pickAppealResult() : null;
  cases.push({
    id: `case-${i}`,
    caseNumber: number,
    court: j.court,
    judgeId: j.id,
    caseType,
    decisionDate: decisionDate.toISOString().slice(0, 10),
    aiSummary: summary,
    sourceUrl: `https://example.com/cases/case-${i}`,
    decisionResult,
    isAppealed,
    appealResult,
  });
  judgeCaseLoad.set(j.id, (judgeCaseLoad.get(j.id) ?? 0) + 1);
}

// ===========================================================================
// Case Votes (decision_agreement + sentencing_fairness)
// ===========================================================================

const caseVotes = [];

// Distribution buckets for agreement votes:
// - consensus (~30%): 80:20 or 90:10
// - split (~50%): 60:40, 50:50, 40:60
// - controversial (~20%): 20:80, 30:70
const CONSENSUS_PATTERNS = [
  [0.8, 0.2],
  [0.9, 0.1],
];
const SPLIT_PATTERNS = [
  [0.6, 0.4],
  [0.5, 0.5],
  [0.4, 0.6],
];
const CONTROVERSIAL_PATTERNS = [
  [0.2, 0.8],
  [0.3, 0.7],
];

function pickAgreementPattern() {
  const r = Math.random();
  if (r < 0.3) return pick(CONSENSUS_PATTERNS);
  if (r < 0.8) return pick(SPLIT_PATTERNS);
  return pick(CONTROVERSIAL_PATTERNS);
}

const SENTENCING_PATTERNS = [
  // [appropriate, tooLight, tooHeavy]
  [0.6, 0.25, 0.15],
  [0.5, 0.3, 0.2],
  [0.4, 0.4, 0.2],
  [0.3, 0.5, 0.2],
  [0.4, 0.2, 0.4],
  [0.5, 0.15, 0.35],
  [0.7, 0.15, 0.15],
];

function dateAfter(iso, maxDays) {
  const base = new Date(iso);
  const offset = Math.floor(Math.random() * maxDays);
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  d.setHours(Math.floor(Math.random() * 24));
  d.setMinutes(Math.floor(Math.random() * 60));
  return isoZ(d);
}

let cvCounter = 0;
for (const c of cases) {
  // decision_agreement votes (5 ~ 15 per case, average ~6 to hit ~800 total)
  // weighted toward lower end so total ≈ 800 across 100 cases
  const agreementCount = 5 + Math.floor(Math.pow(Math.random(), 2) * 11);
  const [agreeRatio] = pickAgreementPattern();
  const agreeN = Math.round(agreementCount * agreeRatio);
  const disagreeN = agreementCount - agreeN;
  for (let k = 0; k < agreeN; k++) {
    cvCounter++;
    caseVotes.push({
      id: `cv-${cvCounter}`,
      userId: null,
      caseId: c.id,
      voteCategory: "decision_agreement",
      voteValue: "agree",
      createdAt: dateAfter(c.decisionDate, 180),
    });
  }
  for (let k = 0; k < disagreeN; k++) {
    cvCounter++;
    caseVotes.push({
      id: `cv-${cvCounter}`,
      userId: null,
      caseId: c.id,
      voteCategory: "decision_agreement",
      voteValue: "disagree",
      createdAt: dateAfter(c.decisionDate, 180),
    });
  }

  // sentencing_fairness votes — 형사 only (3 ~ 10 per case, weighted lower)
  if (c.caseType === "형사") {
    const sentencingCount = 3 + Math.floor(Math.pow(Math.random(), 2) * 8);
    const [appropriate, tooLight, tooHeavy] = pick(SENTENCING_PATTERNS);
    const appN = Math.round(sentencingCount * appropriate);
    const lightN = Math.round(sentencingCount * tooLight);
    const heavyN = Math.max(0, sentencingCount - appN - lightN);
    for (let k = 0; k < appN; k++) {
      cvCounter++;
      caseVotes.push({
        id: `cv-${cvCounter}`,
        userId: null,
        caseId: c.id,
        voteCategory: "sentencing_fairness",
        voteValue: "appropriate",
        createdAt: dateAfter(c.decisionDate, 180),
      });
    }
    for (let k = 0; k < lightN; k++) {
      cvCounter++;
      caseVotes.push({
        id: `cv-${cvCounter}`,
        userId: null,
        caseId: c.id,
        voteCategory: "sentencing_fairness",
        voteValue: "too_light",
        createdAt: dateAfter(c.decisionDate, 180),
      });
    }
    for (let k = 0; k < heavyN; k++) {
      cvCounter++;
      caseVotes.push({
        id: `cv-${cvCounter}`,
        userId: null,
        caseId: c.id,
        voteCategory: "sentencing_fairness",
        voteValue: "too_heavy",
        createdAt: dateAfter(c.decisionDate, 180),
      });
    }
  }
}

// ===========================================================================
// Article Votes — 500 total, long-tail distribution
// Top 30% of articles get 50% of votes
// ===========================================================================

const articleVotes = [];
const ARTICLE_VOTE_TARGET = 500;

const shuffledArticles = articles.slice().sort(() => Math.random() - 0.5);
const topThreshold = Math.ceil(shuffledArticles.length * 0.3);
const topArticles = shuffledArticles.slice(0, topThreshold);
const tailArticles = shuffledArticles.slice(topThreshold);

const topVotesTarget = Math.floor(ARTICLE_VOTE_TARGET * 0.5);
const tailVotesTarget = ARTICLE_VOTE_TARGET - topVotesTarget;

function emitArticleVote(article) {
  // 70:30 useful:not_useful average
  const voteType = chance(0.7) ? "useful" : "not_useful";
  const baseDate = new Date(article.publishedAt);
  const offset = Math.floor(Math.random() * 180);
  const d = new Date(baseDate);
  d.setDate(d.getDate() + offset);
  d.setHours(Math.floor(Math.random() * 24));
  d.setMinutes(Math.floor(Math.random() * 60));
  articleVotes.push({
    id: `av-${articleVotes.length + 1}`,
    userId: null,
    articleId: article.id,
    voteType,
    createdAt: isoZ(d),
  });
}

for (let i = 0; i < topVotesTarget; i++) {
  emitArticleVote(pick(topArticles));
}
for (let i = 0; i < tailVotesTarget; i++) {
  emitArticleVote(pick(tailArticles));
}

fs.writeFileSync(
  path.join(dataDir, "articles.json"),
  JSON.stringify(articles, null, 2)
);
fs.writeFileSync(
  path.join(dataDir, "judgeArticles.json"),
  JSON.stringify(judgeArticles, null, 2)
);
fs.writeFileSync(
  path.join(dataDir, "cases.json"),
  JSON.stringify(cases, null, 2)
);
fs.writeFileSync(
  path.join(dataDir, "caseVotes.json"),
  JSON.stringify(caseVotes, null, 2)
);
fs.writeFileSync(
  path.join(dataDir, "articleVotes.json"),
  JSON.stringify(articleVotes, null, 2)
);

console.log("Generated:");
console.log(`  articles: ${articles.length}`);
console.log(`  judgeArticles: ${judgeArticles.length}`);
console.log(`  cases: ${cases.length}`);
console.log(`  caseVotes: ${caseVotes.length}`);
console.log(`  articleVotes: ${articleVotes.length}`);
console.log(
  `  judges with articles: ${new Set(judgeArticles.map((j) => j.judgeId)).size}`
);
console.log(
  `  judges with cases: ${new Set(cases.map((c) => c.judgeId)).size}`
);
console.log(
  `  cases with appeals: ${cases.filter((c) => c.isAppealed).length}`
);
