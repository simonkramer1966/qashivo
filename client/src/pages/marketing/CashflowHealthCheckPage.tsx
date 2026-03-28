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
  | { type: "lead_form" }
  | { type: "section_intro"; sectionIndex: number }
  | { type: "question"; questionIndex: number }
  | { type: "section_result"; sectionIndex: number }
  | { type: "loading" }
  | { type: "results" };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIER_BG: Record<TierKey, string> = {
  critical: "bg-red-500",
  at_risk: "bg-amber-500",
  good: "bg-cyan-500",
  excellent: "bg-emerald-500",
};

const TIER_TEXT: Record<TierKey, string> = {
  critical: "text-red-500",
  at_risk: "text-amber-500",
  good: "text-cyan-500",
  excellent: "text-emerald-500",
};

const TIER_BORDER: Record<TierKey, string> = {
  critical: "border-red-500",
  at_risk: "border-amber-500",
  good: "border-cyan-500",
  excellent: "border-emerald-500",
};

function getQuestionsForSection(sectionIndex: number): QuizQuestion[] {
  const section = QUIZ_SECTIONS[sectionIndex];
  return QUIZ_QUESTIONS.filter((q) => q.sectionId === section.id);
}

// Total steps for progress bar: landing(1) + form(1) + 3×(intro+questions+result)
function getTotalSteps(): number {
  // landing + form + per-section: (intro + questions + result)
  return 2 + QUIZ_SECTIONS.reduce((acc, _, i) => acc + 1 + getQuestionsForSection(i).length + 1, 0);
}

function getCurrentStepNumber(step: Step): number {
  if (step.type === "landing") return 0;
  if (step.type === "lead_form") return 1;

  let count = 2; // landing + form
  for (let si = 0; si < QUIZ_SECTIONS.length; si++) {
    const sectionQuestions = getQuestionsForSection(si);
    if (step.type === "section_intro" && step.sectionIndex === si) return count;
    count++; // intro
    for (let qi = 0; qi < sectionQuestions.length; qi++) {
      const globalQi = QUIZ_QUESTIONS.indexOf(sectionQuestions[qi]);
      if (step.type === "question" && step.questionIndex === globalQi) return count;
      count++;
    }
    if (step.type === "section_result" && step.sectionIndex === si) return count;
    count++; // result
  }
  return count;
}

// ─── Animated Counter ────────────────────────────────────────────────────────

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
      {current} / {max}
    </span>
  );
}

// ─── Score Bar ───────────────────────────────────────────────────────────────

function ScoreBar({ score, max, tier }: { score: number; max: number; tier: TierKey }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${TIER_BG[tier]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Comparison Bar ──────────────────────────────────────────────────────────

function ComparisonBar({ label, score, maxScore, colour }: { label: string; score: number; maxScore: number; colour: string }) {
  const pct = Math.round((score / maxScore) * 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-bold">
        <span>{label}</span>
        <span>{score} / {maxScore}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: colour }} />
      </div>
    </div>
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

  // ─── Lead form submit ────────────────────────────────────────────────────

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

  // ─── Answer selection ────────────────────────────────────────────────────

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

    // Auto-advance after brief delay
    setTimeout(() => {
      setSelectedAnswer(null);
      const currentQIndex = QUIZ_QUESTIONS.indexOf(question);
      const nextQIndex = currentQIndex + 1;

      // Check if this was the last question in the section
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

  // ─── Section result auto-advance ─────────────────────────────────────────

  useEffect(() => {
    if (step.type !== "section_result") return;
    const timer = setTimeout(() => {
      const nextSection = step.sectionIndex + 1;
      if (nextSection < QUIZ_SECTIONS.length) {
        setStep({ type: "section_intro", sectionIndex: nextSection });
      } else {
        // All sections done — submit
        submitQuiz();
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [step]);

  // ─── Quiz submission ─────────────────────────────────────────────────────

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

  // ─── Render helpers ──────────────────────────────────────────────────────

  const sectionScoreFromAnswers = (sectionIndex: number): number => {
    const section = QUIZ_SECTIONS[sectionIndex];
    return answers
      .filter((a) => a.sectionId === section.id)
      .reduce((sum, a) => sum + a.score, 0);
  };

  // ─── Progress Bar ────────────────────────────────────────────────────────

  const showProgress = step.type !== "landing" && step.type !== "results";

  return (
    <MarketingLayout currentPage="/cashflow-health-check">
      <div className="pt-24 min-h-screen">
        {/* Progress bar */}
        {showProgress && (
          <div className="fixed top-[72px] left-0 right-0 z-40 h-1 bg-slate-100">
            <div
              className="h-full bg-brand-teal transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {/* ─── LANDING ─────────────────────────────────────────────────── */}
        {step.type === "landing" && (
          <section className="max-w-4xl mx-auto px-6 py-24 lg:py-32 text-center">
            <div className="mb-8">
              <span className="inline-block text-[12px] font-extrabold tracking-[0.2em] text-mkt-secondary uppercase mb-6">
                FREE ASSESSMENT
              </span>
              <h1 className="font-headline text-5xl lg:text-7xl font-extrabold text-on-background mb-8 leading-tight">
                The Cashflow{" "}
                <span className="text-mkt-secondary">Health Check</span>
              </h1>
              <p className="font-body text-xl text-on-surface-variant leading-relaxed max-w-2xl mx-auto font-medium mb-12">
                Score your working capital cycle in 2 minutes. Find out where
                cash is leaking from your business — and get a free copy of{" "}
                <em>The Cash Gap</em> by Simon Kramer.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 max-w-3xl mx-auto">
              {QUIZ_SECTIONS.map((section) => (
                <div
                  key={section.id}
                  className="p-6 border border-slate-200 rounded bg-white text-center"
                >
                  <span className="material-symbols-outlined text-3xl text-mkt-secondary mb-3">
                    {section.icon}
                  </span>
                  <h4 className="font-headline font-extrabold text-brand-navy">
                    {section.heading}
                  </h4>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep({ type: "lead_form" })}
              className="bg-brand-teal text-white px-12 py-5 rounded font-headline font-extrabold text-lg hover:bg-cyan-500 transition-all"
            >
              Start My Health Check
            </button>
          </section>
        )}

        {/* ─── LEAD FORM ───────────────────────────────────────────────── */}
        {step.type === "lead_form" && (
          <section className="max-w-lg mx-auto px-6 py-24">
            <h2 className="font-headline text-3xl font-extrabold text-brand-navy mb-4 text-center">
              Before we begin
            </h2>
            <p className="text-on-surface-variant font-medium text-center mb-10">
              We'll send your results and free book to this email.
            </p>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 text-sm font-medium">
                {formError}
              </div>
            )}
            <form onSubmit={handleLeadSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-brand-navy mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="fullName"
                  required
                  className="w-full border border-slate-200 rounded px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-brand-navy mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full border border-slate-200 rounded px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
                  placeholder="jane@company.co.uk"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-brand-navy mb-1.5">
                  Company Name
                </label>
                <input
                  name="companyName"
                  className="w-full border border-slate-200 rounded px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
                  placeholder="Acme Ltd"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-brand-navy mb-1.5">
                  Role
                </label>
                <input
                  name="role"
                  className="w-full border border-slate-200 rounded px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
                  placeholder="Finance Director"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-teal text-white py-4 rounded font-headline font-extrabold text-base hover:bg-cyan-500 transition-all disabled:opacity-50"
              >
                {submitting ? "Starting..." : "Continue"}
              </button>
            </form>
          </section>
        )}

        {/* ─── SECTION INTRO ───────────────────────────────────────────── */}
        {step.type === "section_intro" && (
          <section className="max-w-2xl mx-auto px-6 py-32 text-center">
            <span className="material-symbols-outlined text-5xl text-mkt-secondary mb-6">
              {QUIZ_SECTIONS[step.sectionIndex].icon}
            </span>
            <p className="text-[12px] font-extrabold tracking-[0.2em] text-on-surface-variant uppercase mb-4">
              {QUIZ_SECTIONS[step.sectionIndex].label}
            </p>
            <h2 className="font-headline text-4xl font-extrabold text-brand-navy mb-4">
              {QUIZ_SECTIONS[step.sectionIndex].heading}
            </h2>
            <p className="text-on-surface-variant font-medium text-lg mb-12">
              {QUIZ_SECTIONS[step.sectionIndex].subheading}
            </p>
            <button
              onClick={() => {
                const firstQ = getQuestionsForSection(step.sectionIndex)[0];
                setStep({ type: "question", questionIndex: QUIZ_QUESTIONS.indexOf(firstQ) });
              }}
              className="bg-brand-navy text-white px-10 py-4 rounded font-headline font-extrabold hover:bg-slate-800 transition-all"
            >
              Begin
            </button>
          </section>
        )}

        {/* ─── QUESTION ────────────────────────────────────────────────── */}
        {step.type === "question" && (
          <section className="max-w-2xl mx-auto px-6 py-24">
            {(() => {
              const question = QUIZ_QUESTIONS[step.questionIndex];
              const section = QUIZ_SECTIONS.find((s) => s.id === question.sectionId)!;
              return (
                <>
                  <p className="text-[11px] font-extrabold tracking-[0.2em] text-mkt-secondary uppercase mb-8">
                    {section.heading}
                  </p>
                  <h3 className="font-headline text-2xl lg:text-3xl font-extrabold text-brand-navy mb-10 leading-snug">
                    {question.text}
                  </h3>
                  <div className="space-y-3">
                    {question.answers.map((answer) => {
                      const isSelected = selectedAnswer === answer.id;
                      return (
                        <button
                          key={answer.id}
                          onClick={() => handleAnswer(question, answer.id, answer.score)}
                          disabled={!!selectedAnswer}
                          className={`w-full text-left p-5 rounded border transition-all duration-200 ${
                            isSelected
                              ? "border-l-4 border-brand-teal bg-brand-teal/5 border-y-brand-teal border-r-brand-teal"
                              : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <span className="text-sm font-medium text-on-surface leading-relaxed">
                            {answer.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </section>
        )}

        {/* ─── SECTION MINI-RESULT ─────────────────────────────────────── */}
        {step.type === "section_result" && (
          <section className="max-w-2xl mx-auto px-6 py-32 text-center">
            {(() => {
              const section = QUIZ_SECTIONS[step.sectionIndex];
              const score = sectionScoreFromAnswers(step.sectionIndex);
              const pct = Math.round((score / section.maxScore) * 100);
              const tier = getTierForPercent(pct);
              const tierMeta = getTierMeta(tier);
              return (
                <>
                  <p className="text-[12px] font-extrabold tracking-[0.2em] text-on-surface-variant uppercase mb-4">
                    {section.heading}
                  </p>
                  <div className={`text-6xl font-extrabold mb-4 ${TIER_TEXT[tier]}`}>
                    <AnimatedScore target={score} max={section.maxScore} />
                  </div>
                  <div
                    className={`inline-block px-4 py-1.5 rounded text-white text-sm font-bold ${TIER_BG[tier]}`}
                  >
                    {tierMeta.label}
                  </div>
                  <div className="mt-8 max-w-xs mx-auto">
                    <ScoreBar score={score} max={section.maxScore} tier={tier} />
                  </div>
                </>
              );
            })()}
          </section>
        )}

        {/* ─── LOADING ─────────────────────────────────────────────────── */}
        {step.type === "loading" && (
          <section className="max-w-2xl mx-auto px-6 py-32 text-center">
            <div className="animate-pulse">
              <span className="material-symbols-outlined text-5xl text-mkt-secondary mb-6">
                analytics
              </span>
              <h2 className="font-headline text-3xl font-extrabold text-brand-navy mb-4">
                Analysing your results...
              </h2>
            </div>
          </section>
        )}

        {/* ─── RESULTS ─────────────────────────────────────────────────── */}
        {step.type === "results" && results && (
          <div className="pb-20">
            {/* Score Header */}
            <section className="bg-brand-navy text-white py-20">
              <div className="max-w-4xl mx-auto px-6 text-center">
                <p className="text-[12px] font-extrabold tracking-[0.2em] text-brand-teal uppercase mb-6">
                  YOUR RESULTS
                </p>
                <div className={`text-7xl font-extrabold mb-4 ${TIER_TEXT[results.overallTier]}`}>
                  {results.totalScore} / 40
                </div>
                <div
                  className={`inline-block px-5 py-2 rounded text-white text-sm font-bold mb-8 ${TIER_BG[results.overallTier]}`}
                >
                  {getTierMeta(results.overallTier).label}
                </div>
                <h2 className="font-headline text-3xl font-extrabold text-white leading-snug max-w-2xl mx-auto">
                  {getOverallResult(results.totalScore).headline}
                </h2>
                <p className="text-white/60 font-medium mt-6 max-w-2xl mx-auto leading-relaxed">
                  {getOverallResult(results.totalScore).summary}
                </p>
              </div>
            </section>

            {/* Section Breakdown Cards */}
            <section className="max-w-5xl mx-auto px-6 -mt-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {QUIZ_SECTIONS.map((section) => {
                  const score =
                    section.id === "credit_control"
                      ? results.creditControlScore
                      : section.id === "cashflow"
                        ? results.cashflowScore
                        : results.financeScore;
                  const tier =
                    section.id === "credit_control"
                      ? results.creditControlTier
                      : section.id === "cashflow"
                        ? results.cashflowTier
                        : results.financeTier;
                  return (
                    <div
                      key={section.id}
                      className={`bg-white border-t-4 rounded shadow-lg p-8 ${TIER_BORDER[tier]}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-headline font-extrabold text-brand-navy">
                          {section.heading}
                        </h4>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded text-white ${TIER_BG[tier]}`}
                        >
                          {getTierMeta(tier).label}
                        </span>
                      </div>
                      <div className="text-3xl font-extrabold text-brand-navy mb-3">
                        {score} / {section.maxScore}
                      </div>
                      <ScoreBar score={score} max={section.maxScore} tier={tier} />
                    </div>
                  );
                })}
              </div>
            </section>

            {/* How You Compare */}
            <section className="max-w-3xl mx-auto px-6 py-20">
              <h3 className="font-headline text-2xl font-extrabold text-brand-navy mb-8 text-center">
                How You Compare
              </h3>
              <div className="space-y-6">
                <ComparisonBar
                  label="Your Score"
                  score={results.totalScore}
                  maxScore={COMPARISON_STATS.maxScore}
                  colour={getTierMeta(results.overallTier).hex}
                />
                <ComparisonBar
                  label="Average UK SME"
                  score={COMPARISON_STATS.avgUkSme}
                  maxScore={COMPARISON_STATS.maxScore}
                  colour="#94a3b8"
                />
                <ComparisonBar
                  label="Qashivo Users"
                  score={COMPARISON_STATS.avgQashivoUser}
                  maxScore={COMPARISON_STATS.maxScore}
                  colour="#06B6D4"
                />
              </div>
            </section>

            {/* Personalised Recommendations */}
            <section className="bg-slate-50 py-20 border-y border-slate-200">
              <div className="max-w-5xl mx-auto px-6">
                <h3 className="font-headline text-2xl font-extrabold text-brand-navy mb-10 text-center">
                  Your Personalised Recommendations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {QUIZ_SECTIONS.map((section) => {
                    const tier =
                      section.id === "credit_control"
                        ? results.creditControlTier
                        : section.id === "cashflow"
                          ? results.cashflowTier
                          : results.financeTier;
                    const rec = getSectionRecommendation(section.id, tier);
                    return (
                      <div
                        key={section.id}
                        className="bg-white border border-slate-200 rounded p-8"
                      >
                        <span className="material-symbols-outlined text-2xl text-mkt-secondary mb-4">
                          {section.icon}
                        </span>
                        <p className="text-[10px] font-extrabold tracking-[0.2em] text-on-surface-variant uppercase mb-2">
                          {section.heading}
                        </p>
                        <h4 className="font-headline font-extrabold text-brand-navy text-lg mb-3">
                          {rec.heading}
                        </h4>
                        <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                          {rec.body}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Book Section */}
            <section className="max-w-4xl mx-auto px-6 py-20">
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-10 items-center">
                <div className="bg-slate-100 border border-slate-200 rounded aspect-[3/4] flex items-center justify-center">
                  <div className="text-center p-4">
                    <p className="font-headline text-lg font-extrabold text-brand-navy">
                      The Cash Gap
                    </p>
                    <p className="text-xs text-on-surface-variant font-medium mt-1">
                      Simon Kramer
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">
                    Your Free Copy of The Cash Gap
                  </h3>
                  <p className="text-on-surface-variant font-medium leading-relaxed mb-4">
                    <em>The Cash Gap</em> by Simon Kramer is the essential guide
                    to closing the working capital gap in your business. Based on
                    your Health Check results,{" "}
                    <strong>
                      {BOOK_CHAPTER_MAP[results.weakestSection]}
                    </strong>{" "}
                    are particularly relevant to your situation.
                  </p>
                  <p className="text-sm text-on-surface-variant font-medium">
                    Your copy is being sent to{" "}
                    <strong className="text-brand-navy">{leadEmail}</strong> now.
                  </p>
                </div>
              </div>
            </section>

            {/* Final CTA */}
            <section className="bg-brand-teal py-20 text-white text-center">
              <div className="max-w-3xl mx-auto px-6">
                <h2 className="font-headline text-4xl font-extrabold mb-6">
                  Want to see your score improve?
                </h2>
                <p className="text-white/80 text-lg font-medium mb-10 max-w-xl mx-auto">
                  Book a 15-minute demo and we'll show you how Qashivo closes
                  the gaps in your working capital cycle.
                </p>
                <Link
                  to="/contact"
                  className="inline-block bg-white text-brand-navy px-12 py-5 rounded font-headline font-extrabold text-lg hover:bg-slate-100 transition-all"
                >
                  Book a Demo
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </MarketingLayout>
  );
}
