// ─── Cashflow Health Check — Quiz Content Config ─────────────────────────────
// All quiz content lives here. Edit questions, answers, scoring, and results
// copy without touching components.

export type TierKey = "critical" | "at_risk" | "good" | "excellent";
export type SectionId = "credit_control" | "cashflow" | "finance";

// ─── Sections ────────────────────────────────────────────────────────────────

export interface QuizSection {
  id: SectionId;
  label: string;
  number: number;
  heading: string;
  subheading: string;
  icon: string; // material-symbols-outlined icon name
  maxScore: number;
}

export const QUIZ_SECTIONS: QuizSection[] = [
  {
    id: "credit_control",
    label: "SECTION 1 OF 3",
    number: 1,
    heading: "Credit Control",
    subheading: "How do you chase and collect what you're owed?",
    icon: "mail",
    maxScore: 16,
  },
  {
    id: "cashflow",
    label: "SECTION 2 OF 3",
    number: 2,
    heading: "Cashflow",
    subheading: "How well do you see and forecast your cash position?",
    icon: "trending_up",
    maxScore: 12,
  },
  {
    id: "finance",
    label: "SECTION 3 OF 3",
    number: 3,
    heading: "Finance",
    subheading: "How do you fund gaps and manage your working capital?",
    icon: "account_balance",
    maxScore: 12,
  },
];

// ─── Questions ───────────────────────────────────────────────────────────────

export interface QuizAnswer {
  id: string;
  text: string;
  score: number;
}

export interface QuizQuestion {
  id: string;
  sectionId: SectionId;
  text: string;
  answers: QuizAnswer[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // Section 1: Credit Control
  {
    id: "q1",
    sectionId: "credit_control",
    text: "How do you currently chase overdue invoices?",
    answers: [
      { id: "q1a", text: "We don't really chase. We wait and hope", score: 1 },
      { id: "q1b", text: "We send a manual email when we remember", score: 2 },
      { id: "q1c", text: "We follow a template email sequence", score: 3 },
      { id: "q1d", text: "We have a structured multi-channel process with escalation across email, SMS, and phone", score: 4 },
    ],
  },
  {
    id: "q2",
    sectionId: "credit_control",
    text: "How quickly do you follow up when an invoice becomes overdue?",
    answers: [
      { id: "q2a", text: "We usually don't notice for weeks", score: 1 },
      { id: "q2b", text: "Within a week or two", score: 2 },
      { id: "q2c", text: "Within a few days", score: 3 },
      { id: "q2d", text: "Automatically on the day it's due", score: 4 },
    ],
  },
  {
    id: "q3",
    sectionId: "credit_control",
    text: "When a debtor replies with a dispute, query, or promise to pay, what happens?",
    answers: [
      { id: "q3a", text: "It probably gets lost in someone's inbox", score: 1 },
      { id: "q3b", text: "We deal with it but there's no real system", score: 2 },
      { id: "q3c", text: "We track it but follow-up is inconsistent", score: 3 },
      { id: "q3d", text: "It's logged, categorised, and followed up systematically. Complex cases get escalated to a human", score: 4 },
    ],
  },
  {
    id: "q4",
    sectionId: "credit_control",
    text: "How many communication channels do you use to chase debtors?",
    answers: [
      { id: "q4a", text: "Just email", score: 1 },
      { id: "q4b", text: "Email and occasional phone calls", score: 2 },
      { id: "q4c", text: "Email, phone, and sometimes SMS", score: 3 },
      { id: "q4d", text: "Multiple channels, and we know which one works best for each debtor", score: 4 },
    ],
  },
  // Section 2: Cashflow
  {
    id: "q5",
    sectionId: "cashflow",
    text: "How well do you know your cash position right now?",
    answers: [
      { id: "q5a", text: "I'd have to check my bank account and guess", score: 1 },
      { id: "q5b", text: "I have a rough idea from my accounting software", score: 2 },
      { id: "q5c", text: "I review a cashflow report weekly", score: 3 },
      { id: "q5d", text: "I have real-time visibility on cash in, cash out, and projected gaps", score: 4 },
    ],
  },
  {
    id: "q6",
    sectionId: "cashflow",
    text: "Do you forecast your cashflow?",
    answers: [
      { id: "q6a", text: "No. We deal with problems as they come", score: 1 },
      { id: "q6b", text: "We have a spreadsheet but it's usually out of date by Tuesday", score: 2 },
      { id: "q6c", text: "We update a forecast monthly", score: 3 },
      { id: "q6d", text: "We have a rolling forecast that updates automatically from live accounting data", score: 4 },
    ],
  },
  {
    id: "q7",
    sectionId: "cashflow",
    text: "When did you last have an unexpected cashflow shortfall?",
    answers: [
      { id: "q7a", text: "Almost every month", score: 1 },
      { id: "q7b", text: "In the last month", score: 2 },
      { id: "q7c", text: "In the last 6 months", score: 3 },
      { id: "q7d", text: "Can't remember. We always see them coming", score: 4 },
    ],
  },
  // Section 3: Finance
  {
    id: "q8",
    sectionId: "finance",
    text: "When a cashflow gap appears, what do you do?",
    answers: [
      { id: "q8a", text: "Panic, delay payments, or dip into personal funds", score: 1 },
      { id: "q8b", text: "Wait and hope a big invoice gets paid in time", score: 2 },
      { id: "q8c", text: "Use an overdraft or existing credit facility", score: 3 },
      { id: "q8d", text: "We have pre-arranged working capital options matched to our debtor book and cash cycle", score: 4 },
    ],
  },
  {
    id: "q9",
    sectionId: "finance",
    text: "Do you know how much working capital your late-paying debtors are costing you?",
    answers: [
      { id: "q9a", text: "No idea", score: 1 },
      { id: "q9b", text: "I know it's a problem but haven't quantified it", score: 2 },
      { id: "q9c", text: "I have a rough estimate", score: 3 },
      { id: "q9d", text: "Yes. I know the exact cash impact of every overdue day", score: 4 },
    ],
  },
  {
    id: "q10",
    sectionId: "finance",
    text: "How do you decide which finance products are right for your business?",
    answers: [
      { id: "q10a", text: "I don't really understand the options", score: 1 },
      { id: "q10b", text: "I ask my bank or accountant when things get tight", score: 2 },
      { id: "q10c", text: "I've researched options but find it hard to compare", score: 3 },
      { id: "q10d", text: "I have clear visibility on what's available, what I qualify for, and the right product for each situation", score: 4 },
    ],
  },
];

// ─── Scoring Tiers ───────────────────────────────────────────────────────────

export interface ScoreTier {
  key: TierKey;
  label: string;
  minPercent: number;
  maxPercent: number;
  colour: string; // Tailwind class
  hex: string;
}

export const SCORE_TIERS: ScoreTier[] = [
  { key: "critical", label: "Critical", minPercent: 0, maxPercent: 25, colour: "text-red-500", hex: "#EF4444" },
  { key: "at_risk", label: "At Risk", minPercent: 26, maxPercent: 50, colour: "text-amber-500", hex: "#F59E0B" },
  { key: "good", label: "Good", minPercent: 51, maxPercent: 75, colour: "text-cyan-500", hex: "#06B6D4" },
  { key: "excellent", label: "Excellent", minPercent: 76, maxPercent: 100, colour: "text-emerald-500", hex: "#10B981" },
];

// ─── Overall Results ─────────────────────────────────────────────────────────

export interface OverallResult {
  tier: TierKey;
  minScore: number;
  maxScore: number;
  headline: string;
  summary: string;
}

export const OVERALL_RESULTS: OverallResult[] = [
  {
    tier: "critical",
    minScore: 10,
    maxScore: 15,
    headline: "Your working capital cycle has serious gaps",
    summary:
      "Your credit control is mostly reactive, your cashflow visibility is limited, and you don't have structured options for funding gaps. Late payments are silently costing you real money. The good news? The biggest improvements come from starting the basics. You'll see results within weeks.",
  },
  {
    tier: "at_risk",
    minScore: 16,
    maxScore: 24,
    headline: "Your working capital cycle has room to improve",
    summary:
      "You have some processes in place, but gaps in your credit control, forecasting, or finance strategy mean cash is leaking through. You're ahead of most UK businesses. There's a real opportunity to tighten up and free working capital you didn't know you had.",
  },
  {
    tier: "good",
    minScore: 25,
    maxScore: 32,
    headline: "Your working capital cycle is solid, with gaps to close",
    summary:
      "You've built good foundations. The next step is connecting the pieces. Link your collection activity to your forecast, find the right channel for each debtor, and make sure your finance options match your actual cash cycle.",
  },
  {
    tier: "excellent",
    minScore: 33,
    maxScore: 40,
    headline: "Your working capital cycle is best-in-class",
    summary:
      "You're ahead of the vast majority of UK businesses. The remaining opportunity is automation. Let the system handle routine conversations while your team focuses on strategy and the relationships that matter most.",
  },
];

// ─── Section Recommendations ─────────────────────────────────────────────────

export interface SectionRecommendation {
  sectionId: SectionId;
  tier: TierKey;
  heading: string;
  body: string;
}

export const SECTION_RECOMMENDATIONS: SectionRecommendation[] = [
  // Credit Control
  {
    sectionId: "credit_control",
    tier: "critical",
    heading: "Start chasing consistently",
    body: "You're leaving cash on the table by not following up. Even a basic automated email sequence on overdue invoices will recover funds that are currently being written off by default.",
  },
  {
    sectionId: "credit_control",
    tier: "at_risk",
    heading: "Add structure to your chasing",
    body: "You're chasing, but inconsistently. A multi-step escalation sequence (friendly reminder, firm follow-up, final notice) with the right timing will dramatically improve collection rates.",
  },
  {
    sectionId: "credit_control",
    tier: "good",
    heading: "Improve your channel mix",
    body: "Your process is solid. The next step is understanding which debtors respond to which channels and automating the coordination between email, SMS, and phone.",
  },
  {
    sectionId: "credit_control",
    tier: "excellent",
    heading: "Automate and focus on exceptions",
    body: "Your credit control is strong. Consider fully automating routine chasing so your team only handles disputes, high-value accounts, and escalations.",
  },
  // Cashflow
  {
    sectionId: "cashflow",
    tier: "critical",
    heading: "Get visibility on your cash",
    body: "You can't manage what you can't see. Connecting your accounting data to a live cashflow view is the single highest-impact change you can make right now.",
  },
  {
    sectionId: "cashflow",
    tier: "at_risk",
    heading: "Move from static to rolling forecasts",
    body: "Your current forecasting is reactive. A rolling 13-week forecast that updates from live data will show you problems 4 to 6 weeks before they hit your bank account.",
  },
  {
    sectionId: "cashflow",
    tier: "good",
    heading: "Add scenario planning",
    body: "You have good visibility. The next step is modelling best-case, expected, and worst-case scenarios so you can plan ahead and never be caught off guard.",
  },
  {
    sectionId: "cashflow",
    tier: "excellent",
    heading: "Link collection to forecast",
    body: "Your forecasting is strong. Connect it directly to your collection activity. When you speed up chasing on key invoices, your forecast improves automatically. That closes the loop.",
  },
  // Finance
  {
    sectionId: "finance",
    tier: "critical",
    heading: "Understand your options before you need them",
    body: "When a cashflow gap hits, you shouldn't be scrambling. Know what finance products exist (invoice factoring, credit lines, asset finance) before you need them. That puts you in control.",
  },
  {
    sectionId: "finance",
    tier: "at_risk",
    heading: "Quantify the cost of late payments",
    body: "Every day a debtor pays late costs you money. Calculating the exact working capital impact of your debtor book will help you make better decisions about when to chase harder and when to seek finance.",
  },
  {
    sectionId: "finance",
    tier: "good",
    heading: "Pre-qualify for working capital",
    body: "You understand the landscape. The next step is getting pre-qualified for the right products so that when a gap appears, you can act in hours not weeks.",
  },
  {
    sectionId: "finance",
    tier: "excellent",
    heading: "Lower your cost of capital",
    body: "You have strong financial management. The next step is continuously matching the cheapest available finance to your actual cash cycle, so you reduce the cost of bridging gaps.",
  },
];

// ─── Book Chapter Mapping ────────────────────────────────────────────────────

export const BOOK_CHAPTER_MAP: Record<SectionId, string> = {
  credit_control:
    "Chapters 3 to 5 on building a systematic collections process and multi-channel chasing",
  cashflow:
    "Chapters 6 to 8 on cashflow forecasting, visibility, and early warning systems",
  finance:
    "Chapters 9 to 11 on working capital options, invoice finance, and bridging gaps",
};

// ─── Comparison Stats ────────────────────────────────────────────────────────

export const COMPARISON_STATS = {
  avgUkSme: 17,
  avgQashivoUser: 34,
  maxScore: 40,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getTierForPercent(percent: number): TierKey {
  if (percent <= 25) return "critical";
  if (percent <= 50) return "at_risk";
  if (percent <= 75) return "good";
  return "excellent";
}

export function getTierForOverallScore(score: number): TierKey {
  if (score <= 15) return "critical";
  if (score <= 24) return "at_risk";
  if (score <= 32) return "good";
  return "excellent";
}

export function getTierMeta(tier: TierKey): ScoreTier {
  return SCORE_TIERS.find((t) => t.key === tier)!;
}

export function getOverallResult(score: number): OverallResult {
  const tier = getTierForOverallScore(score);
  return OVERALL_RESULTS.find((r) => r.tier === tier)!;
}

export function getSectionRecommendation(
  sectionId: SectionId,
  tier: TierKey,
): SectionRecommendation {
  return SECTION_RECOMMENDATIONS.find(
    (r) => r.sectionId === sectionId && r.tier === tier,
  )!;
}
