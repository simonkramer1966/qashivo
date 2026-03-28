import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import MarketingLayout from "@/layouts/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  QUIZ_SECTIONS,
  QUIZ_QUESTIONS,
  COMPARISON_STATS,
  BOOK_CHAPTER_MAP,
  getTierForPercent,
  getTierForOverallScore,
  getTierMeta,
  getOverallResult,
  getSectionRecommendation,
  type SectionId,
  type TierKey,
  type QuizQuestion,
} from "@/content/marketing";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnswerRecord {
  questionId: string;
  sectionId: SectionId;
  answerId: string;
  score: number;
}

interface QuizResults {
  totalScore: number;
  creditControlScore: number;
  cashflowScore: number;
  financeScore: number;
  overallTier: TierKey;
  creditControlTier: TierKey;
  cashflowTier: TierKey;
  financeTier: TierKey;
  weakestSection: SectionId;
}

type Step =
  | { type: "landing" }
  | { type: "section_intro"; sectionIndex: number }
  | { type: "question"; questionIndex: number }
  | { type: "section_result"; sectionIndex: number }
  | { type: "loading" }
  | { type: "results" };

// ─── Design Token Maps ──────────────────────────────────────────────────────

const TIER_BADGE_STYLE: Record<TierKey, string> = {
  critical: "bg-error-container text-on-error-container",
  at_risk: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  good: "bg-secondary-fixed text-on-secondary-fixed-variant",
  excellent: "bg-secondary-fixed text-on-secondary-fixed-variant",
};

const TIER_BAR_BG: Record<TierKey, string> = {
  critical: "bg-[#ba1a1a]",
  at_risk: "bg-tertiary-fixed-dim",
  good: "bg-mkt-teal",
  excellent: "bg-mkt-teal",
};

const TIER_STROKE: Record<TierKey, string> = {
  critical: "#ba1a1a",
  at_risk: "#ffb95f",
  good: "#00687a",
  excellent: "#00687a",
};

const TIER_BORDER_LEFT: Record<TierKey, string> = {
  critical: "border-l-[#ba1a1a]",
  at_risk: "border-l-tertiary-fixed-dim",
  good: "border-l-mkt-teal",
  excellent: "border-l-mkt-teal",
};

const SECTION_ICONS: Record<SectionId, string> = {
  credit_control: "account_balance_wallet",
  cashflow: "trending_up",
  finance: "payments",
};

const SECTION_REC_META: Record<SectionId, { urgency: string; icon: string }> = {
  credit_control: { urgency: "Immediate Action", icon: "alarm" },
  cashflow: { urgency: "Strategic Shift", icon: "sync_alt" },
  finance: { urgency: "Growth Hedge", icon: "security" },
};

const ANSWER_LETTERS = ["A", "B", "C", "D"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getQuestionsForSection(sectionIndex: number): QuizQuestion[] {
  const section = QUIZ_SECTIONS[sectionIndex];
  return QUIZ_QUESTIONS.filter((q) => q.sectionId === section.id);
}

function getTotalSteps(): number {
  return 1 + QUIZ_SECTIONS.reduce((acc, _, i) => acc + 1 + getQuestionsForSection(i).length + 1, 0);
}

function getCurrentStepNumber(step: Step): number {
  if (step.type === "landing") return 0;

  let count = 1; // landing (with form)
  for (let si = 0; si < QUIZ_SECTIONS.length; si++) {
    const sectionQuestions = getQuestionsForSection(si);
    if (step.type === "section_intro" && step.sectionIndex === si) return count;
    count++;
    for (let qi = 0; qi < sectionQuestions.length; qi++) {
      const globalQi = QUIZ_QUESTIONS.indexOf(sectionQuestions[qi]);
      if (step.type === "question" && step.questionIndex === globalQi) return count;
      count++;
    }
    if (step.type === "section_result" && step.sectionIndex === si) return count;
    count++;
  }
  return count;
}

// ─── SVG Progress Ring ──────────────────────────────────────────────────────

function ProgressRing({ score, max, tier }: { score: number; max: number; tier: TierKey }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? score / max : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative w-[180px] h-[180px] flex items-center justify-center">
      <svg className="w-full h-full" viewBox="0 0 120 120">
        <circle
          className="text-surface-container-high"
          cx="60" cy="60" r={radius}
          fill="transparent" stroke="currentColor" strokeWidth="8"
        />
        <circle
          className="progress-ring__circle"
          cx="60" cy="60" r={radius}
          fill="transparent"
          stroke={TIER_STROKE[tier]}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-headline text-4xl font-extrabold tracking-tighter text-on-surface">
          {score} <span className="text-on-surface-variant/40 text-2xl">/ {max}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Animated Score Counter ─────────────────────────────────────────────────

function AnimatedScore({ target, max }: { target: number; max: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    let frame = 0;
    const totalFrames = 30;
    const interval = setInterval(() => {
      frame++;
      setCurrent(Math.round((frame / totalFrames) * target));
      if (frame >= totalFrames) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [target]);

  return (
    <span>
      {current} <span className="text-on-surface-variant/40 text-2xl">/ {max}</span>
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CashflowHealthCheckPage() {
  usePageMeta(
    "Cashflow Health Check — Qashivo",
    "Score your working capital cycle in 2 minutes. Find out where cash is leaking from your business and get a free copy of The Cash Gap.",
  );

  const [step, setStep] = useState<Step>({ type: "landing" });
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadEmail, setLeadEmail] = useState("");
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const totalSteps = getTotalSteps();
  const currentStepNum = getCurrentStepNumber(step);
  const progressPct = step.type === "landing" ? 0 : Math.round((currentStepNum / totalSteps) * 100);

  // ─── Lead form submit ──────────────────────────────────────────────────

  const handleLeadSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      companyName: (formData.get("companyName") as string) || undefined,
      role: (formData.get("role") as string) || undefined,
    };

    try {
      const res = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Something went wrong");
      }
      const { leadId: id } = await res.json();
      setLeadId(id);
      setLeadEmail(body.email);
      setStep({ type: "section_intro", sectionIndex: 0 });
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }, []);

  // ─── Answer selection ──────────────────────────────────────────────────

  const handleAnswer = useCallback((question: QuizQuestion, answerId: string, score: number) => {
    setSelectedAnswer(answerId);

    const record: AnswerRecord = {
      questionId: question.id,
      sectionId: question.sectionId,
      answerId,
      score,
    };
    const newAnswers = [...answers.filter((a) => a.questionId !== question.id), record];
    setAnswers(newAnswers);

    setTimeout(() => {
      setSelectedAnswer(null);
      const currentQIndex = QUIZ_QUESTIONS.indexOf(question);
      const nextQIndex = currentQIndex + 1;

      const currentSection = QUIZ_SECTIONS.findIndex((s) => s.id === question.sectionId);
      const sectionQuestions = getQuestionsForSection(currentSection);
      const isLastInSection = question.id === sectionQuestions[sectionQuestions.length - 1].id;

      if (isLastInSection) {
        setStep({ type: "section_result", sectionIndex: currentSection });
      } else {
        setStep({ type: "question", questionIndex: nextQIndex });
      }
    }, 500);
  }, [answers]);

  // ─── Quiz submission ───────────────────────────────────────────────────

  const submitQuiz = useCallback(async () => {
    setStep({ type: "loading" });
    try {
      const res = await fetch("/api/quiz/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, answers }),
      });
      if (!res.ok) throw new Error("Failed to submit quiz");
      const data = await res.json();
      setResults(data as QuizResults);
      setStep({ type: "results" });
    } catch {
      setFormError("Something went wrong submitting your quiz. Please try again.");
      setStep({ type: "landing" });
    }
  }, [leadId, answers]);

  // ─── Render helpers ────────────────────────────────────────────────────

  const sectionScoreFromAnswers = (sectionIndex: number): number => {
    const section = QUIZ_SECTIONS[sectionIndex];
    return answers
      .filter((a) => a.sectionId === section.id)
      .reduce((sum, a) => sum + a.score, 0);
  };

  const showProgress = step.type !== "landing" && step.type !== "results";

  // Current question number within its section (for question display)
  const getQuestionLabel = (questionIndex: number): string => {
    const q = QUIZ_QUESTIONS[questionIndex];
    const section = QUIZ_SECTIONS.find((s) => s.id === q.sectionId)!;
    const sectionQs = QUIZ_QUESTIONS.filter((qq) => qq.sectionId === q.sectionId);
    const posInSection = sectionQs.indexOf(q) + 1;
    const totalQsBefore = QUIZ_QUESTIONS.filter(
      (qq) => QUIZ_SECTIONS.findIndex((s) => s.id === qq.sectionId) < QUIZ_SECTIONS.findIndex((s) => s.id === q.sectionId)
    ).length;
    const globalPos = totalQsBefore + posInSection;
    return `Question ${globalPos} of ${QUIZ_QUESTIONS.length}`;
  };

  const getNextSectionName = (currentSectionIndex: number): string | null => {
    const next = currentSectionIndex + 1;
    if (next < QUIZ_SECTIONS.length) return QUIZ_SECTIONS[next].heading;
    return null;
  };

  // Section result summary text
  const getSectionSummary = (sectionIndex: number, tier: TierKey): string => {
    const section = QUIZ_SECTIONS[sectionIndex];
    const summaries: Record<SectionId, Record<TierKey, string>> = {
      credit_control: {
        critical: "Your credit control needs urgent attention — cash is being lost to late payments.",
        at_risk: "Your credit control has solid foundations — with room to optimise.",
        good: "Your credit control is performing well — fine-tuning will unlock more.",
        excellent: "Your credit control is best-in-class. Keep it up.",
      },
      cashflow: {
        critical: "Your cashflow visibility is dangerously low — surprises are inevitable.",
        at_risk: "Your cashflow has gaps — better forecasting will prevent surprises.",
        good: "Your cashflow management is solid — scenario planning is the next step.",
        excellent: "Your cashflow visibility is exceptional. You're ahead of the curve.",
      },
      finance: {
        critical: "Your finance strategy is reactive — you need to plan ahead.",
        at_risk: "Your finance approach has potential — quantifying costs will help.",
        good: "Your finance management is strong — pre-qualifying will give you speed.",
        excellent: "Your finance strategy is optimised. Focus on cost of capital next.",
      },
    };
    return summaries[section.id][tier];
  };

  return (
    <MarketingLayout currentPage="/cashflow-health-check">
      <div className="min-h-screen">
        {/* Progress bar */}
        {showProgress && (
          <div className="w-full bg-surface-variant">
            <div className="w-full h-1.5 bg-surface-variant relative overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-mkt-teal transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="max-w-4xl mx-auto px-6 py-6 flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-on-surface-variant font-label text-sm uppercase tracking-wider">Assessment Flow</span>
                {step.type === "question" && (
                  <p className="text-on-surface font-headline font-bold text-lg">
                    {getQuestionLabel(step.questionIndex)}
                  </p>
                )}
                {step.type === "section_intro" && (
                  <p className="text-on-surface font-headline font-bold text-lg">
                    {QUIZ_SECTIONS[step.sectionIndex].label}
                  </p>
                )}
                {step.type === "section_result" && (
                  <p className="text-on-surface font-headline font-bold text-lg">
                    {QUIZ_SECTIONS[step.sectionIndex].heading} — Results
                  </p>
                )}
              </div>
              {step.type === "question" && (
                <div className="flex items-center gap-2">
                  <span className="text-mkt-teal font-label text-xs font-bold tracking-[0.05em] uppercase">
                    {QUIZ_SECTIONS.find((s) => s.id === QUIZ_QUESTIONS[step.questionIndex].sectionId)?.heading}
                  </span>
                  <span className="material-symbols-outlined text-mkt-teal text-sm">shield_with_heart</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── LANDING (Hero + Form) ──────────────────────────────────── */}
        {step.type === "landing" && (
          <>
            {/* Hero Section */}
            <section className="max-w-7xl mx-auto px-8 pt-20 pb-16">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 pr-0 lg:pr-12">
                  <h1 className="font-headline font-extrabold text-5xl md:text-7xl tracking-[-0.02em] leading-[1.1] text-primary-container mb-8">
                    The Cashflow <br /><span className="text-mkt-teal">Health Check</span>
                  </h1>
                  <p className="text-xl text-on-surface-variant leading-relaxed mb-10 max-w-2xl">
                    Score your working capital cycle in 2 minutes. Find out where cash is leaking from your business — and get a free copy of <span className="font-semibold italic">The Cash Gap</span> to fix it.
                  </p>
                  <div className="flex flex-wrap gap-6 items-center text-sm font-label tracking-wide uppercase text-on-surface-variant/80">
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">schedule</span> Takes 2 minutes</span>
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">list_alt</span> 10 questions</span>
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">bolt</span> Instant results</span>
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">redeem</span> Free</span>
                  </div>
                </div>

                {/* Form Container */}
                <div className="lg:col-span-5">
                  <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm ghost-border">
                    <h2 className="font-headline font-bold text-2xl mb-6">Start Your Health Check</h2>
                    {formError && (
                      <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg mb-6 text-sm font-medium">
                        {formError}
                      </div>
                    )}
                    <form onSubmit={handleLeadSubmit} className="space-y-5">
                      <div>
                        <label className="block text-xs font-label font-bold uppercase tracking-wider text-on-surface-variant mb-2">Full Name</label>
                        <input
                          name="fullName"
                          required
                          className="w-full bg-surface-container-low border-none rounded-lg focus:ring-1 focus:ring-mkt-teal py-3 px-4 transition-all"
                          placeholder="Jane Doe"
                          type="text"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-label font-bold uppercase tracking-wider text-on-surface-variant mb-2">Work Email</label>
                        <input
                          name="email"
                          required
                          className="w-full bg-surface-container-low border-none rounded-lg focus:ring-1 focus:ring-mkt-teal py-3 px-4 transition-all"
                          placeholder="jane@company.com"
                          type="email"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-label font-bold uppercase tracking-wider text-on-surface-variant mb-2">Company Name</label>
                        <input
                          name="companyName"
                          className="w-full bg-surface-container-low border-none rounded-lg focus:ring-1 focus:ring-mkt-teal py-3 px-4 transition-all"
                          placeholder="Acme Holdings Ltd"
                          type="text"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-label font-bold uppercase tracking-wider text-on-surface-variant mb-2">Role</label>
                        <select
                          name="role"
                          className="w-full bg-surface-container-low border-none rounded-lg focus:ring-1 focus:ring-mkt-teal py-3 px-4 transition-all appearance-none"
                        >
                          <option value="">Select your role</option>
                          <option value="CEO / Founder">CEO / Founder</option>
                          <option value="CFO / Finance Director">CFO / Finance Director</option>
                          <option value="Operations Manager">Operations Manager</option>
                          <option value="Accountant">Accountant</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-mkt-teal text-white font-headline font-bold py-4 rounded-lg hover:brightness-110 transition-all flex justify-center items-center gap-2 mt-4 disabled:opacity-50"
                      >
                        {submitting ? "Starting..." : (
                          <>Check My Score <span className="material-symbols-outlined">arrow_forward</span></>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </section>

            {/* Preview Cards Section */}
            <section className="bg-surface-container-low py-20">
              <div className="max-w-7xl mx-auto px-8">
                <div className="grid md:grid-cols-3 gap-8">
                  {QUIZ_SECTIONS.map((section) => (
                    <div key={section.id} className="bg-surface-container-lowest p-10 rounded-xl ghost-border transition-all hover:translate-y-[-4px] duration-300">
                      <div className="w-12 h-12 bg-mkt-teal/10 rounded-full flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-mkt-teal" style={{ fontVariationSettings: "'FILL' 1" }}>{section.icon}</span>
                      </div>
                      <h3 className="font-headline font-bold text-xl mb-3">{section.heading}</h3>
                      <p className="text-on-surface-variant leading-relaxed">{section.subheading}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* What You'll Get Section */}
            <section className="max-w-7xl mx-auto px-8 py-24">
              <h2 className="font-headline font-extrabold text-3xl mb-16 text-center">What you'll receive upon completion</h2>
              <div className="grid md:grid-cols-3 gap-12 text-center">
                <div className="flex flex-col items-center">
                  <div className="mb-6 relative">
                    <div className="w-20 h-20 bg-mkt-teal rounded-2xl flex items-center justify-center transform rotate-3 shadow-lg">
                      <span className="material-symbols-outlined text-white text-4xl">grade</span>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary-container rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">AI</div>
                  </div>
                  <h4 className="font-headline font-bold text-lg mb-2">Personalised Score</h4>
                  <p className="text-on-surface-variant">A deep-dive benchmark against top-performing UK SMEs in your industry.</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="mb-6 relative">
                    <div className="w-20 h-20 bg-primary-container rounded-2xl flex items-center justify-center transform -rotate-3 shadow-lg">
                      <span className="material-symbols-outlined text-white text-4xl">lightbulb</span>
                    </div>
                  </div>
                  <h4 className="font-headline font-bold text-lg mb-2">Actionable Recommendations</h4>
                  <p className="text-on-surface-variant">Immediate steps to reduce your cash conversion cycle and release locked capital.</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="mb-6 relative">
                    <div className="w-20 h-20 bg-primary-container rounded-2xl flex items-center justify-center transform rotate-6 shadow-lg">
                      <span className="material-symbols-outlined text-white text-4xl">menu_book</span>
                    </div>
                  </div>
                  <h4 className="font-headline font-bold text-lg mb-2">Free Book</h4>
                  <p className="text-on-surface-variant">A digital copy of "The Cash Gap", the definitive guide to closing your working capital gap.</p>
                </div>
              </div>
            </section>

            {/* Bottom Trust Bar */}
            <section className="border-t border-outline-variant/10 py-12">
              <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-center gap-10">
                <div className="flex items-center gap-4 text-on-surface-variant font-medium">
                  <span className="text-mkt-teal font-bold text-2xl">4,200+</span>
                  <span>UK businesses have taken the Health Check</span>
                </div>
                <div className="h-8 w-px bg-outline-variant/20 hidden md:block" />
                <div className="flex items-center gap-8 opacity-40 grayscale contrast-125">
                  <span className="font-headline font-extrabold text-xl tracking-tighter">QASHIVO</span>
                  <span className="material-symbols-outlined">shield_with_heart</span>
                  <span className="font-label font-bold text-sm tracking-widest uppercase">Certified Intelligence</span>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ─── SECTION INTRO ──────────────────────────────────────────── */}
        {step.type === "section_intro" && (
          <main className="flex-grow flex flex-col items-center py-16 md:py-24 px-6">
            <section className="w-full max-w-4xl bg-surface-container rounded-3xl p-12 md:p-20 relative overflow-hidden">
              {/* Decorative blur */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-secondary-fixed/30 rounded-full blur-3xl" />
              <div className="relative z-10 flex flex-col items-start gap-6">
                <div className="p-4 bg-surface-container-lowest rounded-2xl shadow-sm">
                  <span className="material-symbols-outlined text-mkt-teal text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {QUIZ_SECTIONS[step.sectionIndex].icon}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-mkt-teal font-label text-sm font-bold tracking-[0.1em] uppercase">
                    {QUIZ_SECTIONS[step.sectionIndex].label}
                  </p>
                  <h2 className="font-headline font-extrabold text-4xl text-on-background">
                    {QUIZ_SECTIONS[step.sectionIndex].heading}
                  </h2>
                </div>
                <p className="text-xl text-on-surface-variant max-w-md leading-relaxed">
                  {QUIZ_SECTIONS[step.sectionIndex].subheading}
                </p>
                <button
                  onClick={() => {
                    const firstQ = getQuestionsForSection(step.sectionIndex)[0];
                    setStep({ type: "question", questionIndex: QUIZ_QUESTIONS.indexOf(firstQ) });
                  }}
                  className="mt-4 bg-mkt-teal text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all hover:gap-5 hover:brightness-110"
                >
                  Continue
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </section>
          </main>
        )}

        {/* ─── QUESTION ───────────────────────────────────────────────── */}
        {step.type === "question" && (
          <main className="flex-grow flex flex-col items-center py-16 md:py-24 px-6">
            {(() => {
              const question = QUIZ_QUESTIONS[step.questionIndex];
              return (
                <div className="w-full max-w-2xl text-center space-y-12">
                  <h1 className="font-headline font-extrabold text-3xl md:text-4xl text-on-background leading-tight tracking-[-0.02em]">
                    {question.text}
                  </h1>

                  {/* Answer Grid */}
                  <div className="space-y-4 w-full text-left">
                    {question.answers.map((answer, i) => {
                      const isSelected = selectedAnswer === answer.id;
                      return (
                        <button
                          key={answer.id}
                          onClick={() => handleAnswer(question, answer.id, answer.score)}
                          disabled={!!selectedAnswer}
                          className={`group w-full p-6 flex items-center gap-6 bg-surface-container-lowest rounded-xl transition-all duration-300 ${
                            isSelected
                              ? "answer-card-active shadow-xl shadow-on-surface/5"
                              : "answer-card hover:shadow-xl hover:shadow-on-surface/5"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                            isSelected
                              ? "bg-secondary-fixed text-on-secondary-fixed"
                              : "bg-surface-container-low text-on-surface-variant group-hover:bg-secondary-fixed group-hover:text-on-secondary-fixed"
                          }`}>
                            {ANSWER_LETTERS[i]}
                          </div>
                          <span className={`text-lg text-on-surface ${isSelected ? "font-bold" : "font-medium"}`}>
                            {answer.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Back button */}
                  {step.questionIndex > 0 && (
                    <div className="flex justify-start pt-4">
                      <button
                        onClick={() => {
                          const prevIndex = step.questionIndex - 1;
                          const prevQ = QUIZ_QUESTIONS[prevIndex];
                          const prevSection = QUIZ_SECTIONS.findIndex((s) => s.id === prevQ.sectionId);
                          const currentSection = QUIZ_SECTIONS.findIndex((s) => s.id === question.sectionId);
                          if (prevSection !== currentSection) {
                            // Going back to previous section intro
                            setStep({ type: "section_intro", sectionIndex: currentSection });
                          } else {
                            setStep({ type: "question", questionIndex: prevIndex });
                          }
                        }}
                        className="flex items-center gap-2 text-on-surface-variant hover:text-mkt-teal transition-colors font-medium"
                      >
                        <span className="material-symbols-outlined text-lg">arrow_back</span>
                        Back
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </main>
        )}

        {/* ─── SECTION MINI-RESULT ─────────────────────────────────────── */}
        {step.type === "section_result" && (
          <main className="min-h-[calc(100vh-180px)] flex flex-col items-center justify-center p-6">
            {(() => {
              const section = QUIZ_SECTIONS[step.sectionIndex];
              const score = sectionScoreFromAnswers(step.sectionIndex);
              const pct = Math.round((score / section.maxScore) * 100);
              const tier = getTierForPercent(pct);
              const tierMeta = getTierMeta(tier);
              const nextSectionName = getNextSectionName(step.sectionIndex);

              return (
                <div className="max-w-xl w-full text-center space-y-10">
                  {/* Section Label */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-mkt-teal font-label text-xs font-bold tracking-[0.15em] uppercase">
                      {section.heading}
                    </span>
                    <div className="w-8 h-[2px] bg-secondary-fixed" />
                  </div>

                  {/* Score Ring */}
                  <div className="relative flex flex-col items-center justify-center">
                    <ProgressRing score={score} max={section.maxScore} tier={tier} />
                  </div>

                  {/* Rating & Summary */}
                  <div className="space-y-4">
                    <div className={`inline-flex items-center px-4 py-1.5 rounded-full font-label text-sm font-semibold tracking-wide ${TIER_BADGE_STYLE[tier]}`}>
                      {tierMeta.label}
                    </div>
                    <h1 className="font-headline text-2xl md:text-3xl font-bold tracking-tight text-on-surface max-w-md mx-auto leading-tight">
                      {getSectionSummary(step.sectionIndex, tier)}
                    </h1>
                  </div>

                  {/* Continue Button */}
                  <div className="pt-6">
                    <button
                      onClick={() => {
                        const nextSection = step.sectionIndex + 1;
                        if (nextSection < QUIZ_SECTIONS.length) {
                          setStep({ type: "section_intro", sectionIndex: nextSection });
                        } else {
                          submitQuiz();
                        }
                      }}
                      className="group inline-flex items-center justify-center gap-3 bg-mkt-teal text-white px-8 py-4 rounded-xl font-headline font-bold text-lg shadow-sm transition-all duration-300 hover:brightness-110 hover:shadow-lg active:scale-95"
                    >
                      {nextSectionName ? `Next: ${nextSectionName}` : "See My Results"}
                      <span className="material-symbols-outlined transition-transform duration-300 group-hover:translate-x-1">arrow_forward</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Decorative elements */}
            <div className="fixed bottom-24 left-12 opacity-10 pointer-events-none hidden lg:block">
              <div className="w-48 h-48 rounded-full border-[1.5px] border-mkt-teal" />
            </div>
            <div className="fixed top-32 right-12 opacity-5 pointer-events-none hidden lg:block">
              <div className="w-64 h-64 rounded-full bg-secondary-fixed" />
            </div>
          </main>
        )}

        {/* ─── LOADING ─────────────────────────────────────────────────── */}
        {step.type === "loading" && (
          <main className="min-h-[calc(100vh-180px)] flex flex-col items-center justify-center p-6">
            <div className="animate-pulse text-center">
              <span className="material-symbols-outlined text-5xl text-mkt-teal mb-6">analytics</span>
              <h2 className="font-headline text-3xl font-extrabold text-on-background mb-4">
                Analysing your results...
              </h2>
              <p className="text-on-surface-variant">Calculating your cashflow health score</p>
            </div>
          </main>
        )}

        {/* ─── RESULTS ─────────────────────────────────────────────────── */}
        {step.type === "results" && results && (
          <div>
            {/* SECTION 1: SCORE HEADER */}
            <section className="bg-[#0F172A] text-white py-24 px-8">
              <div className="max-w-4xl mx-auto text-center">
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm mb-8 ${TIER_BADGE_STYLE[results.overallTier]}`}>
                  <span className="material-symbols-outlined text-sm">
                    {results.overallTier === "critical" || results.overallTier === "at_risk" ? "warning" : "verified"}
                  </span>
                  {getTierMeta(results.overallTier).label}
                </div>
                <h1 className="font-headline font-extrabold text-7xl md:text-9xl tracking-tighter mb-6">
                  {results.totalScore} <span className="text-secondary-fixed">/ 40</span>
                </h1>
                <h2 className="font-headline font-bold text-3xl md:text-5xl tracking-tight mb-6 max-w-2xl mx-auto">
                  {getOverallResult(results.totalScore).headline}
                </h2>
                <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                  {getOverallResult(results.totalScore).summary}
                </p>
              </div>
            </section>

            {/* SECTION 2: BREAKDOWN */}
            <section className="bg-surface-container-low py-24 px-8">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row gap-8">
                  {QUIZ_SECTIONS.map((section) => {
                    const score =
                      section.id === "credit_control" ? results.creditControlScore
                      : section.id === "cashflow" ? results.cashflowScore
                      : results.financeScore;
                    const tier =
                      section.id === "credit_control" ? results.creditControlTier
                      : section.id === "cashflow" ? results.cashflowTier
                      : results.financeTier;
                    const tierMeta = getTierMeta(tier);
                    const pct = Math.round((score / section.maxScore) * 100);
                    const rec = getSectionRecommendation(section.id, tier);

                    return (
                      <div key={section.id} className="flex-1 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
                        <div className="flex justify-between items-start mb-6">
                          <span className="material-symbols-outlined text-mkt-teal text-3xl">{SECTION_ICONS[section.id]}</span>
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${TIER_BADGE_STYLE[tier]}`}>
                            {tierMeta.label}
                          </span>
                        </div>
                        <h3 className="font-headline font-bold text-xl mb-1">{section.heading}</h3>
                        <div className="text-3xl font-extrabold mb-4">{score}/{section.maxScore}</div>
                        <div className="w-full bg-surface-container-high h-2 rounded-full mb-6">
                          <div className={`h-2 rounded-full transition-all duration-700 ${TIER_BAR_BG[tier]}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-on-surface-variant text-sm leading-relaxed">{rec.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* SECTION 3: BENCHMARKING */}
            <section className="bg-surface-container-lowest py-24 px-8 overflow-hidden">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-16 items-center">
                <div className="flex-1">
                  <h2 className="font-headline font-extrabold text-4xl tracking-tight mb-6">Benchmarking Success</h2>
                  <p className="text-on-surface-variant text-lg mb-8 leading-relaxed">
                    See how your financial health scores against the wider UK ecosystem. Qashivo users typically see a 15% improvement in score within 90 days.
                  </p>
                  <div className="space-y-8">
                    {/* Average UK SME */}
                    <div>
                      <div className="text-sm font-bold mb-2 uppercase tracking-wider text-on-surface-variant">Average UK SME</div>
                      <div className="w-full bg-surface-container h-12 rounded-lg relative overflow-hidden">
                        <div className="bg-outline-variant/40 h-full rounded-lg" style={{ width: `${(COMPARISON_STATS.avgUkSme / COMPARISON_STATS.maxScore) * 100}%` }} />
                        <span className="absolute inset-y-0 left-4 flex items-center font-bold text-on-surface-variant">{COMPARISON_STATS.avgUkSme} Points</span>
                      </div>
                    </div>
                    {/* Your Score */}
                    <div>
                      <div className="text-sm font-bold mb-2 uppercase tracking-wider text-on-surface">Your Score</div>
                      <div className="w-full bg-surface-container h-12 rounded-lg relative overflow-hidden ring-2 ring-tertiary-fixed-dim ring-offset-2">
                        <div className="bg-tertiary-fixed-dim h-full rounded-lg" style={{ width: `${(results.totalScore / COMPARISON_STATS.maxScore) * 100}%` }} />
                        <span className="absolute inset-y-0 left-4 flex items-center font-bold text-on-surface">{results.totalScore} Points</span>
                      </div>
                    </div>
                    {/* Qashivo Elite Users */}
                    <div>
                      <div className="text-sm font-bold mb-2 uppercase tracking-wider text-mkt-teal">Qashivo Elite Users</div>
                      <div className="w-full bg-surface-container h-12 rounded-lg relative overflow-hidden">
                        <div className="bg-mkt-teal h-full rounded-lg" style={{ width: `${(COMPARISON_STATS.avgQashivoUser / COMPARISON_STATS.maxScore) * 100}%` }} />
                        <span className="absolute inset-y-0 left-4 flex items-center font-bold text-white">{COMPARISON_STATS.avgQashivoUser} Points</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Testimonial Card */}
                <div className="flex-1 bg-surface-container p-12 rounded-3xl relative">
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-secondary-fixed rounded-full blur-3xl opacity-50" />
                  <div className="relative z-10 border-l-4 border-mkt-teal pl-8 py-4">
                    <span className="text-5xl font-extrabold font-headline block mb-4">+50%</span>
                    <p className="text-on-surface font-medium leading-relaxed italic">
                      "Qashivo helped us bridge the gap between our sales ledger and our actual bank balance. Our score went from 18 to 32 in just one quarter."
                    </p>
                    <p className="mt-4 font-bold text-mkt-teal">— CEO, TechSupply Ltd.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 4: RECOMMENDATIONS */}
            <section className="bg-surface-container-low py-24 px-8">
              <div className="max-w-7xl mx-auto">
                <div className="mb-16">
                  <h2 className="font-headline font-extrabold text-4xl tracking-tight">Priority Actions</h2>
                  <p className="text-on-surface-variant mt-2">Personalised strategies to improve your capital efficiency.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {QUIZ_SECTIONS.map((section) => {
                    const tier =
                      section.id === "credit_control" ? results.creditControlTier
                      : section.id === "cashflow" ? results.cashflowTier
                      : results.financeTier;
                    const rec = getSectionRecommendation(section.id, tier);
                    const meta = SECTION_REC_META[section.id];
                    const borderColor =
                      section.id === "credit_control" ? "border-l-[#ba1a1a]"
                      : section.id === "cashflow" ? "border-l-tertiary-fixed-dim"
                      : "border-l-mkt-teal";

                    return (
                      <div key={section.id} className={`bg-surface-container-lowest p-8 rounded-xl border-l-8 ${borderColor} shadow-sm`}>
                        <div className="flex items-center gap-4 mb-6">
                          <span className={`material-symbols-outlined ${
                            section.id === "credit_control" ? "text-[#ba1a1a]"
                            : section.id === "cashflow" ? "text-tertiary-fixed-dim"
                            : "text-mkt-teal"
                          }`}>{meta.icon}</span>
                          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{meta.urgency}</span>
                        </div>
                        <h3 className="font-headline font-bold text-xl mb-4 leading-tight">{rec.heading}</h3>
                        <p className="text-on-surface-variant text-sm leading-relaxed">{rec.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* SECTION 5: THE CASH GAP BOOK */}
            <section className="bg-surface-container-lowest py-32 px-8">
              <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-16">
                <div className="w-full md:w-1/2 flex justify-center">
                  <div className="relative group">
                    {/* Book Cover Mockup */}
                    <div className="w-72 h-[420px] bg-[#0F172A] rounded-r-2xl shadow-2xl flex flex-col p-8 border-l-8 border-[#1E293B] relative z-10 transition-transform hover:-rotate-2 duration-300">
                      <div className="flex-grow flex flex-col justify-center">
                        <h4 className="text-secondary-fixed font-headline font-extrabold text-5xl tracking-tighter leading-none mb-4">THE CASH GAP</h4>
                        <div className="h-1 w-24 bg-secondary-fixed mb-8" />
                        <p className="text-white/60 font-body text-sm uppercase tracking-widest">Mastering Liquid Intelligence for UK SMEs</p>
                      </div>
                      <div className="text-white font-bold text-lg tracking-tight">Simon Kramer</div>
                    </div>
                    <div className="absolute inset-0 bg-secondary-fixed/20 blur-3xl rounded-full scale-110 -z-10 group-hover:scale-125 transition-transform duration-700" />
                  </div>
                </div>
                <div className="w-full md:w-1/2">
                  <h2 className="font-headline font-extrabold text-4xl tracking-tight mb-6">Your Free Copy of The Cash Gap</h2>
                  <p className="text-on-surface-variant text-lg mb-8 leading-relaxed">
                    We've analyzed thousands of UK businesses to find the patterns of survival and growth. Based on your results,{" "}
                    <strong>{BOOK_CHAPTER_MAP[results.weakestSection]}</strong> are particularly relevant to your situation.
                  </p>
                  <div className="flex items-center gap-3 p-4 bg-secondary-container/20 rounded-xl border border-secondary-container/30">
                    <span className="material-symbols-outlined text-mkt-teal">check_circle</span>
                    <p className="font-bold text-on-secondary-container">Your copy is being sent to {leadEmail} now</p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 6: FINAL CTA */}
            <section className="bg-[#0F172A] editorial-grid-bg py-24 px-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A] via-transparent to-[#0F172A] pointer-events-none" />
              <div className="max-w-3xl mx-auto relative z-10">
                <h2 className="font-headline font-extrabold text-5xl tracking-tight text-white mb-8">Want to see your score improve?</h2>
                <p className="text-slate-400 text-xl mb-12">Connect your accounting software for a real-time, AI-powered health dashboard that never sleeps.</p>
                <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                  <Link
                    to="/contact"
                    className="w-full md:w-auto px-10 py-4 bg-secondary-fixed text-on-secondary-fixed font-headline font-extrabold rounded-lg hover:bg-white transition-colors duration-300 text-center"
                  >
                    Book a Demo
                  </Link>
                  <button className="w-full md:w-auto px-10 py-4 border-2 border-slate-700 text-white font-headline font-bold rounded-lg hover:bg-slate-800 transition-colors duration-300 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-xl">share</span>
                    Share on LinkedIn
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </MarketingLayout>
  );
}
