export type CourtType =
  | "supreme"
  | "high"
  | "district"
  | "family"
  | "administrative";

export interface Court {
  id: string;
  name: string;
  type: CourtType;
  region: string;
  address: string;
  latitude: number;
  longitude: number;
  judgeCount: number;
}

export interface Judge {
  id: string;
  name: string;
  courtId: string;
  court: string;
  courtRegion: string;
  position: string;
  appointmentYear: number;
  careerSummary: string;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  aiSummary: string;
  collectedAt: string;
}

export interface JudgeArticle {
  id: string;
  judgeId: string;
  articleId: string;
  relevanceScore: number;
}

export type CaseType = "민사" | "형사" | "행정" | "가사";

export interface Case {
  id: string;
  caseNumber: string;
  court: string;
  judgeId: string;
  caseType: CaseType;
  decisionDate: string;
  aiSummary: string;
  sourceUrl: string;
  decisionResult: string;
  isAppealed: boolean;
  appealResult: string | null;
}

export interface JudgeWithStats extends Judge {
  articleCount: number;
  caseCount: number;
}

export interface ArticleWithJudges extends Article {
  judges: { id: string; name: string; court: string }[];
}

export type VoteCategory = "decision_agreement" | "sentencing_fairness";

export type VoteValue =
  | "agree"
  | "disagree"
  | "appropriate"
  | "too_light"
  | "too_heavy";

export interface CaseVote {
  id: string;
  userId: string | null;
  caseId: string;
  voteCategory: VoteCategory;
  voteValue: VoteValue;
  createdAt: string;
}

export interface ArticleVote {
  id: string;
  userId: string | null;
  articleId: string;
  voteType: "useful" | "not_useful";
  createdAt: string;
}

export interface CaseVoteSummary {
  agreement: { agree: number; disagree: number; total: number; rate: number };
  sentencing?: {
    appropriate: number;
    tooLight: number;
    tooHeavy: number;
    total: number;
    appropriateRate: number;
  };
}

export interface JudgeAgreementStat {
  rate: number; // 0~1
  totalVotes: number;
  totalCases: number;
}

export interface JudgeAppealStat {
  appealedCount: number;
  reversedCount: number;
  rate: number; // 파기율 0~1
  courtAverage: number; // 같은 법원 평균
}

export interface MonthlyCount {
  month: string; // "2026-04"
  count: number;
}

export interface ArticleVoteSummary {
  useful: number;
  notUseful: number;
  total: number;
  rate: number;
}
