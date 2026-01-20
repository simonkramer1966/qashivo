export const SCORECARD_VERSION = "v1";

export interface ScorecardQuestion {
  key: string;
  text: string;
}

export interface ScorecardCategory {
  id: string;
  name: string;
  description: string;
  questions: ScorecardQuestion[];
}

export const SCORECARD_CATEGORIES: ScorecardCategory[] = [
  {
    id: "C1",
    name: "Client Fit & Pain",
    description: "Understanding your clients' receivables challenges",
    questions: [
      {
        key: "C1_Q1",
        text: "Do a meaningful portion of your SME clients experience late payment that materially impacts cashflow?",
      },
      {
        key: "C1_Q2",
        text: "Do clients frequently ask you for forward-looking cash visibility (not just aged debt reports)?",
      },
      {
        key: "C1_Q3",
        text: "Are you currently exposed to \"credit control drift\" (no one owns it; it's ad hoc, spreadsheet/inbox driven)?",
      },
      {
        key: "C1_Q4",
        text: "Do you have clients where a small number of overdue invoices represents a large share of working capital risk?",
      },
    ],
  },
  {
    id: "C2",
    name: "Delivery Leverage",
    description: "Non-linear headcount potential",
    questions: [
      {
        key: "C2_Q1",
        text: "Could one person in your firm realistically supervise (not manually run) receivables activity across multiple SME clients if the system handled the routine work?",
      },
      {
        key: "C2_Q2",
        text: "Is your current approach linear (more clients = more chasing time) and therefore hard to monetise?",
      },
      {
        key: "C2_Q3",
        text: "Would it be valuable if most routine follow-ups were executed consistently, while only exceptions (disputes, payment plans, edge cases) surfaced for judgement?",
      },
      {
        key: "C2_Q4",
        text: "Do you already have (or could you nominate) a light \"credit control owner\" who can run a daily/weekly cadence?",
      },
    ],
  },
  {
    id: "C3",
    name: "Trust, Controls & Risk",
    description: "Supervised autonomy requirements",
    questions: [
      {
        key: "C3_Q1",
        text: "Would your firm be more comfortable if nothing is sent without human approval (bulk approve included)?",
      },
      {
        key: "C3_Q2",
        text: "Do you need an auditable trail of who approved what, when, and why (for internal QA and client reassurance)?",
      },
      {
        key: "C3_Q3",
        text: "Do you avoid offering credit control today because it feels \"too operational / too risky / too messy\"?",
      },
      {
        key: "C3_Q4",
        text: "Would you only roll this out if the system stops automation immediately on disputes and flags payment-plan requests for review?",
      },
    ],
  },
  {
    id: "C4",
    name: "Cashflow Forecast Value",
    description: "Intent-aware visibility potential",
    questions: [
      {
        key: "C4_Q1",
        text: "Would your clients pay for a cash view based on real debtor intent (promised / delayed / disputed / silent), not just invoice aging?",
      },
      {
        key: "C4_Q2",
        text: "Do you currently make forecasts using averages/assumptions because you don't reliably capture outcomes from debtor conversations?",
      },
      {
        key: "C4_Q3",
        text: "Would it improve your advisory value if the forecast updated automatically as customers reply with dates or issues?",
      },
      {
        key: "C4_Q4",
        text: "Would you like to offer \"cashflow confidence\" as a recurring service (monthly) rather than a one-off exercise?",
      },
    ],
  },
  {
    id: "C5",
    name: "Commercial Readiness",
    description: "Add-on revenue without headcount",
    questions: [
      {
        key: "C5_Q1",
        text: "Do you have a packaging motion today (e.g., tiers / bundles) that you could extend with a receivables + cashflow add-on?",
      },
      {
        key: "C5_Q2",
        text: "Would a per-SME subscription that you can resell/roll out across your portfolio fit your commercial model?",
      },
      {
        key: "C5_Q3",
        text: "Could you confidently describe receivables + cashflow visibility as a monthly managed service deliverable (clear outputs + clear boundaries), rather than \"ad hoc chasing\"?",
      },
      {
        key: "C5_Q4",
        text: "Do you believe your best path to growth is recurring revenue that expands across your client base rather than hiring more delivery staff?",
      },
    ],
  },
];

export const ALL_QUESTION_KEYS = SCORECARD_CATEGORIES.flatMap((cat) =>
  cat.questions.map((q) => q.key)
);

export type ScorecardBand = "PERFECT_FIT" | "STRONG_FIT" | "CONDITIONAL_FIT" | "NOT_NOW";

export interface BandInfo {
  band: ScorecardBand;
  label: string;
  minScore: number;
  maxScore: number;
  color: string;
  description: string;
  nextSteps: string[];
}

export const SCORECARD_BANDS: BandInfo[] = [
  {
    band: "PERFECT_FIT",
    label: "Perfect Fit",
    minScore: 80,
    maxScore: 100,
    color: "#17B6C3",
    description: "Strong opportunity for a repeatable, high-margin add-on service.",
    nextSteps: [
      "Define your monthly deliverable package",
      "Identify 3-5 pilot clients to start with",
      "Schedule an onboarding call with Qashivo",
    ],
  },
  {
    band: "STRONG_FIT",
    label: "Strong Fit",
    minScore: 60,
    maxScore: 79,
    color: "#22C55E",
    description: "Good opportunity—likely best with a defined service package and owner.",
    nextSteps: [
      "Assign a credit control champion in your team",
      "Standardise your communication policy",
      "Book a demo to see the platform in action",
    ],
  },
  {
    band: "CONDITIONAL_FIT",
    label: "Conditional Fit",
    minScore: 40,
    maxScore: 59,
    color: "#F59E0B",
    description: "Potential is there, but needs clearer packaging/ownership to be repeatable.",
    nextSteps: [
      "Consider which client segment has the most pain",
      "Define clear boundaries for the service",
      "Start with a single pilot before scaling",
    ],
  },
  {
    band: "NOT_NOW",
    label: "Not Now",
    minScore: 0,
    maxScore: 39,
    color: "#94A3B8",
    description: "Lower near-term fit—revisit when client demand or cash pressure increases.",
    nextSteps: [
      "Focus on building client demand first",
      "Revisit when late payment issues become more pressing",
      "Consider other advisory services that fit your current model",
    ],
  },
];

export function calculateBand(totalScore: number): BandInfo {
  for (const band of SCORECARD_BANDS) {
    if (totalScore >= band.minScore && totalScore <= band.maxScore) {
      return band;
    }
  }
  return SCORECARD_BANDS[SCORECARD_BANDS.length - 1];
}

export function calculateCategoryScores(
  answers: { questionKey: string; score: number }[]
): Record<string, number> {
  const categoryScores: Record<string, number> = {};
  
  for (const category of SCORECARD_CATEGORIES) {
    const categoryAnswers = answers.filter((a) =>
      category.questions.some((q) => q.key === a.questionKey)
    );
    categoryScores[category.id] = categoryAnswers.reduce((sum, a) => sum + a.score, 0);
  }
  
  return categoryScores;
}

export function calculateTotalScore(answers: { questionKey: string; score: number }[]): number {
  return answers.reduce((sum, a) => sum + a.score, 0);
}
