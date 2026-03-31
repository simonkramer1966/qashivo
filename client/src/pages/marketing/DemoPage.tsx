import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import MarketingLayout from "@/layouts/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

// ─── Types ──────────────────────────────────────────────────────────────────────

type CallState = "pre-call" | "during-call" | "post-call" | "fallback";

interface Badge {
  label: string;
  type: "teal" | "amber" | "green";
  icon: string;
}

interface TranscriptMessage {
  role: "agent" | "debtor";
  text: string;
  timestamp: string;
  badges?: Badge[];
}

interface CashflowImpact {
  amount: number;
  currency: string;
  expectedDays: number;
  signal: string;
}

interface ActionCard {
  type: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

interface CallResults {
  callId: string;
  status: string;
  callerName: string;
  transcript: TranscriptMessage[];
  intentScore: number;
  sentiment: string;
  commitmentLevel: string;
  cashflowImpact: CashflowImpact;
  recommendedActions: ActionCard[];
  riskInsights: string;
  callDurationSeconds: number;
}

// ─── Sample data for pre-call / fallback ────────────────────────────────────────

const SAMPLE_DATA: CallResults = {
  callId: "CALL-8829-QX",
  status: "completed",
  callerName: "Demo",
  transcript: [
    {
      role: "agent",
      text: "Good afternoon, this is Qashivo calling on behalf of Apex Logistics regarding invoice #AX-902 for \u00a312,450. I'm calling to see if you have a scheduled payment date for this?",
      timestamp: "14:32:04 UTC",
    },
    {
      role: "debtor",
      text: "Yes, hello. We've had some internal delays with the new ERP system. I was looking at the ledger this morning and we were planning to process this by the end of next week.",
      timestamp: "14:32:15 UTC",
      badges: [
        { label: "Intent Detected", type: "teal", icon: "check_circle" },
        { label: "System Delay Noted", type: "amber", icon: "warning" },
      ],
    },
    {
      role: "agent",
      text: "I understand system migrations can be challenging. To ensure this doesn't slip, could we lock in Friday the 1st for the transfer? I can send over a direct payment link to bypass the ERP manual entry if that helps.",
      timestamp: "14:32:45 UTC",
    },
    {
      role: "debtor",
      text: "That would actually be helpful. If you send the link, I can authorize it through the backup portal on Friday morning.",
      timestamp: "14:33:10 UTC",
      badges: [
        { label: "Positive Shift", type: "green", icon: "trending_up" },
        { label: "Settlement Commitment", type: "teal", icon: "payments" },
      ],
    },
  ],
  intentScore: 78,
  sentiment: "Cooperative",
  commitmentLevel: "Medium High",
  cashflowImpact: {
    amount: 12450,
    currency: "GBP",
    expectedDays: 14,
    signal: "RECOVERY_SIGNAL",
  },
  recommendedActions: [
    {
      type: "Automated",
      title: "Confirmation Dispatched",
      description:
        "Summary of commitment and secure payment link sent to registered email.",
      icon: "mail",
      color: "teal",
    },
    {
      type: "Scheduled",
      title: "Escalation Trigger",
      description:
        "Automated re-check scheduled for Nov 1st, 10:00 AM if funds are not settled.",
      icon: "calendar_month",
      color: "amber",
    },
  ],
  riskInsights:
    '"ERP Migration" has been cited 3 times in 12 months. Recurring friction point. Transition to Direct Debit suggested.',
  callDurationSeconds: 96,
};

// ─── Waveform component ─────────────────────────────────────────────────────────

function Waveform({ active, settled }: { active: boolean; settled: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);
  const rafRef = useRef<number>();
  const BAR_COUNT = 64;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";
    barsRef.current = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const bar = document.createElement("div");
      bar.className = "wave-bar";
      container.appendChild(bar);
      barsRef.current.push(bar);
    }
  }, []);

  useEffect(() => {
    if (settled) {
      barsRef.current.forEach((bar) => {
        bar.style.height = "4px";
        bar.style.opacity = "0.1";
        bar.style.transition = "all 1.2s cubic-bezier(0.4, 0, 0.2, 1)";
      });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    if (!active) {
      // Dormant state — gentle idle
      barsRef.current.forEach((bar, i) => {
        bar.style.transition = "all 0.3s ease";
        const h = 12 + Math.sin(i * 0.2) * 6;
        bar.style.height = `${h}px`;
        bar.style.opacity = "0.25";
      });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    // Active animation
    function animate() {
      barsRef.current.forEach((bar, i) => {
        const t = Date.now() / 1000;
        const w1 = Math.sin(t * 2 + i * 0.1) * 30;
        const w2 = Math.sin(t * 1.5 + i * 0.15) * 20;
        const w3 = Math.cos(t * 3 + i * 0.05) * 15;
        const jitter = Math.random() * 15;
        const h = 40 + w1 + w2 + w3 + jitter;
        bar.style.height = `${Math.max(8, h)}px`;
        bar.style.opacity = String((h / 100) + 0.2);
        bar.style.transition = "none";
      });
      rafRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, settled]);

  return <div ref={containerRef} className="wave-container" />;
}

// ─── Animated number counter ────────────────────────────────────────────────────

function AnimatedNumber({
  value,
  duration = 1500,
  trigger,
}: {
  value: number;
  duration?: number;
  trigger: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!trigger || startedRef.current) return;
    startedRef.current = true;
    const start = performance.now();
    function step(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.floor(progress * value));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [trigger, value, duration]);

  // Reset when trigger becomes false
  useEffect(() => {
    if (!trigger) {
      startedRef.current = false;
      setDisplay(0);
    }
  }, [trigger]);

  return <>{display}</>;
}

// ─── Badge colors ───────────────────────────────────────────────────────────────

function badgeClasses(type: string) {
  switch (type) {
    case "teal":
      return "border-brand-teal/30 bg-brand-teal/5 text-brand-teal";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "green":
      return "border-green-200 bg-green-50 text-green-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function DemoPage() {
  usePageMeta(
    "Live Demo \u2014 Experience Qashivo's Credit Controller",
    "Receive a live credit control call from Qashivo's AI. See real-time intelligence extraction, sentiment analysis, and cashflow impact."
  );

  const [callState, setCallState] = useState<CallState>("pre-call");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [callId, setCallId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [results, setResults] = useState<CallResults>(SAMPLE_DATA);
  const [fallbackMsg, setFallbackMsg] = useState("");

  const reportRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Poll call status during call
  useEffect(() => {
    if (callState !== "during-call" || !callId) return;

    // Start duration timer
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);

    // Poll status
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/demo/call-status/${callId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "completed") {
          clearInterval(pollRef.current!);
          clearInterval(timerRef.current!);
          // Fetch full results
          const resResults = await fetch(`/api/demo/call-results/${callId}`);
          if (resResults.ok) {
            const fullResults = await resResults.json();
            setResults(fullResults);
          }
          setCallState("post-call");
          // Scroll to report
          setTimeout(() => {
            reportRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 500);
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!);
          clearInterval(timerRef.current!);
          setFallbackMsg(
            "We couldn't connect the call right now. Here's a sample intelligence report from a recent Qashivo call."
          );
          setCallState("fallback");
        }
        if (data.duration) setCallDuration(data.duration);
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => {
      clearInterval(pollRef.current!);
      clearInterval(timerRef.current!);
    };
  }, [callState, callId]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleSubmit = useCallback(async () => {
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!phone.trim() || phone.replace(/\D/g, "").length < 6)
      newErrors.phone = "Enter a valid phone number";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setCallDuration(0);
    setCallState("during-call");

    try {
      const res = await fetch("/api/demo/start-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phoneNumber: phone.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFallbackMsg(data.message || "Something went wrong.");
        setCallState("fallback");
        return;
      }

      setCallId(data.callId);

      if (data.fallback || data.status === "completed") {
        // Server returned sample data immediately
        const resResults = await fetch(`/api/demo/call-results/${data.callId}`);
        if (resResults.ok) {
          setResults(await resResults.json());
        }
        setCallState("post-call");
        setTimeout(() => {
          reportRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 500);
      }
    } catch {
      setFallbackMsg(
        "We couldn't connect the call right now. Here's a sample intelligence report from a recent Qashivo call."
      );
      setCallState("fallback");
    }
  }, [name, phone]);

  const handleRetry = () => {
    setCallState("pre-call");
    setFallbackMsg("");
    setCallId(null);
    setCallDuration(0);
  };

  const showReport = callState === "post-call" || callState === "fallback";

  return (
    <MarketingLayout currentPage="/demo">
      <main className="pt-24 pb-20 max-w-7xl mx-auto px-6 md:px-12">
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className="mb-24">
          <div className="mb-12 max-w-3xl">
            <span className="text-[11px] text-brand-teal font-bold tracking-[0.2em] uppercase mb-4 block font-headline">
              Interactive Demo
            </span>
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-6 leading-[1.1] font-headline">
              The future of{" "}
              <span className="text-brand-teal">automated recovery</span>.
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed font-medium">
              Experience our AI-powered credit controller first-hand. No setup,
              no commitment—just a real-time conversation.
            </p>
          </div>

          {/* ── Two-column: Form + Visualiser ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-stretch">
            {/* Left: Call Form */}
            <div className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-brand-teal/10 flex items-center justify-center text-brand-teal">
                    <span className="material-symbols-outlined text-3xl">
                      phone_in_talk
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-headline tracking-tight">
                      Experience Qashivo
                    </h3>
                    <p className="text-slate-500 text-sm font-medium">
                      Live credit control call simulation
                    </p>
                  </div>
                </div>
                <p className="text-slate-600 text-[15px] mb-8 leading-relaxed">
                  You're about to receive a credit control call from Qashivo.
                  Play the part of the debtor and respond however you like.
                  <span className="block mt-4 text-xs font-bold italic text-slate-400 uppercase tracking-wide">
                    The conversation handles objections and payment plans
                    autonomously.
                  </span>
                </p>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Smith"
                      disabled={callState === "during-call"}
                      className={`w-full px-6 py-4 bg-slate-50 rounded-xl border transition-all text-sm focus:ring-brand-teal focus:border-brand-teal ${
                        errors.name ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                    {errors.name && (
                      <p className="text-red-500 text-xs">{errors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Your Phone Number
                    </label>
                    <div className="flex">
                      <div className="flex items-center gap-2 px-5 py-4 bg-slate-50 rounded-l-xl border border-r-0 border-slate-200">
                        <span className="text-sm font-bold text-slate-700">
                          +44
                        </span>
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="7700 900000"
                        disabled={callState === "during-call"}
                        className={`flex-1 px-6 py-4 bg-slate-50 rounded-r-xl border transition-all text-sm focus:ring-brand-teal focus:border-brand-teal ${
                          errors.phone ? "border-red-400" : "border-slate-200"
                        }`}
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-red-500 text-xs">{errors.phone}</p>
                    )}
                  </div>
                  {callState === "during-call" ? (
                    <button
                      disabled
                      className="w-full bg-slate-400 text-white py-5 rounded-xl font-bold text-lg flex items-center justify-center gap-3"
                    >
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Call in Progress...
                    </button>
                  ) : callState === "fallback" ? (
                    <button
                      onClick={handleRetry}
                      className="w-full bg-brand-teal hover:brightness-105 text-white py-5 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-brand-teal/20"
                    >
                      <span className="material-symbols-outlined">refresh</span>
                      Try Again
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      className="w-full bg-brand-teal hover:brightness-105 text-white py-5 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-brand-teal/20"
                    >
                      <span className="material-symbols-outlined">call</span>
                      Call Me Now
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 flex items-center gap-2 font-medium">
                  <span className="material-symbols-outlined text-[14px]">
                    lock
                  </span>
                  Compliant data handling. Your number is never stored for
                  marketing.
                </p>
              </div>
            </div>

            {/* Right: Visualiser + indicators */}
            <div className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-brand-teal/10 flex items-center justify-center text-brand-teal">
                  <span className="material-symbols-outlined text-3xl">
                    auto_awesome
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold font-headline tracking-tight">
                    Credit Control Insights
                  </h3>
                  <p className="text-slate-500 text-sm font-medium">
                    Voice Call Intelligence Monitoring
                  </p>
                </div>
              </div>

              {/* Visualiser window */}
              <div className="w-full aspect-[16/10] bg-brand-navy rounded-2xl mb-8 relative overflow-hidden flex flex-col items-center justify-center p-8 dot-grid border border-slate-800">
                {callState === "during-call" ? (
                  <Waveform active={true} settled={false} />
                ) : callState === "post-call" ? (
                  <>
                    <Waveform active={false} settled={true} />
                    <div className="absolute inset-0 flex items-center justify-center bg-brand-navy/90 backdrop-blur-md z-20">
                      <div className="text-center">
                        <div className="w-24 h-24 bg-brand-teal rounded-full flex items-center justify-center animate-bounce-in mx-auto shadow-[0_0_60px_rgba(6,182,212,0.4)]">
                          <span className="material-symbols-outlined text-white text-5xl">
                            check_circle
                          </span>
                        </div>
                        <p className="text-white font-headline font-bold mt-8 text-2xl tracking-tight">
                          Intelligence Report Generated
                        </p>
                        <p className="text-slate-400 text-sm mt-2">
                          All signals verified and recorded.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full border-2 border-brand-teal/30 flex items-center justify-center mb-6 text-brand-teal/40">
                      <span className="material-symbols-outlined text-4xl">
                        phone_callback
                      </span>
                    </div>
                    <h3 className="text-white text-lg font-bold mb-2 font-headline">
                      Ready to Analyze
                    </h3>
                    <p className="text-slate-400 text-[13px] max-w-[240px]">
                      Start a call to see live linguistic extraction and
                      sentiment mapping.
                    </p>
                  </div>
                )}
              </div>

              {/* Mini indicators */}
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div className="p-5 bg-slate-50 rounded-xl border-l-4 border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Intent Detection
                  </span>
                  <div className="text-slate-900 font-bold text-sm mt-1">
                    {callState === "during-call"
                      ? "Analyzing..."
                      : callState === "post-call"
                      ? `${results.intentScore}% Detected`
                      : "Pending Connection"}
                  </div>
                </div>
                <div className="p-5 bg-slate-50 rounded-xl border-l-4 border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Sentiment Analysis
                  </span>
                  <div className="text-slate-900 font-bold text-sm mt-1">
                    {callState === "during-call"
                      ? "Analyzing..."
                      : callState === "post-call"
                      ? results.sentiment
                      : "Waiting..."}
                  </div>
                </div>
                <div className="p-5 bg-slate-50 rounded-xl border-l-4 border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Commitment Level
                  </span>
                  <div className="text-slate-900 font-bold text-sm mt-1">
                    {callState === "during-call"
                      ? "Analyzing..."
                      : callState === "post-call"
                      ? results.commitmentLevel
                      : "\u2014"}
                  </div>
                </div>
                <div className="p-5 bg-slate-50 rounded-xl border-l-4 border-slate-200 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Call Duration
                  </span>
                  <div className="text-slate-900 font-bold text-sm mt-1">
                    {callState === "during-call"
                      ? formatDuration(callDuration)
                      : callState === "post-call"
                      ? formatDuration(results.callDurationSeconds)
                      : "00:00"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Fallback message ─────────────────────────────────────────────── */}
        {callState === "fallback" && fallbackMsg && (
          <div className="mb-12 bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <p className="text-amber-800 font-medium">{fallbackMsg}</p>
          </div>
        )}

        {/* ── CALL INTELLIGENCE REPORT ─────────────────────────────────────── */}
        <section ref={reportRef}>
          {/* Header bar */}
          <div className="bg-[#F8FAFC] border border-slate-200/60 rounded-3xl p-10 mb-10 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm">
            <div>
              <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
                Call Intelligence Report
              </h2>
              <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">
                    calendar_today
                  </span>
                  {new Date().toLocaleDateString("en-GB", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="font-bold text-brand-teal">
                  ID: {results.callId?.substring(0, 13) || "CALL-8829-QX"}
                </span>
              </div>
            </div>
            <div className="mt-6 md:mt-0 flex gap-4">
              <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-all">
                <span className="material-symbols-outlined text-lg">
                  download
                </span>
                Export
              </button>
              <button className="flex items-center gap-2 px-6 py-3 bg-brand-navy text-white text-sm font-bold rounded-xl shadow-sm hover:opacity-90 transition-all">
                <span className="material-symbols-outlined text-lg">
                  share
                </span>
                Share Report
              </button>
            </div>
          </div>

          {/* ── Metric Cards ───────────────────────────────────────────────── */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16 ${
              showReport ? "stagger-load" : ""
            }`}
          >
            {/* Payment Intent (gauge) */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[240px]">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Payment Intent
              </span>
              <div className="flex items-center gap-6 mt-4">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      className="text-slate-100"
                      cx="48"
                      cy="48"
                      r="42"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="8"
                    />
                    <circle
                      className="text-brand-teal transition-all duration-[1.5s] ease-out"
                      cx="48"
                      cy="48"
                      r="42"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray="263.8"
                      strokeDashoffset={
                        showReport
                          ? 263.8 - 263.8 * (results.intentScore / 100)
                          : 263.8
                      }
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-headline font-extrabold text-2xl text-slate-900">
                    <AnimatedNumber
                      value={results.intentScore}
                      trigger={showReport}
                    />
                    %
                  </div>
                </div>
                <div>
                  <span className="text-brand-teal font-bold text-sm block">
                    High Conf.
                  </span>
                  <p className="text-[11px] text-slate-500 leading-normal mt-1">
                    Confirmed liquidity for Friday settlement.
                  </p>
                </div>
              </div>
            </div>

            {/* Speaker Sentiment (slider) */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[240px]">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Speaker Sentiment
              </span>
              <div className="mt-6 space-y-6">
                <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                  <span>Resistant</span>
                  <span className="text-brand-teal">Cooperative</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full relative">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-brand-teal rounded-full ring-4 ring-brand-teal/20 transition-all duration-[1.5s] ease-out shadow-lg shadow-brand-teal/30"
                    style={{ left: showReport ? "82%" : "50%" }}
                  />
                </div>
                <p className="text-xs text-slate-500 italic leading-relaxed">
                  "Switching to backup portal for faster auth."
                </p>
              </div>
            </div>

            {/* Commitment Level (bar chart) */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[240px]">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Commitment Level
              </span>
              <div className="mt-6 space-y-4">
                <div className="flex items-end gap-1.5 h-16">
                  <div className="w-full bg-slate-100 rounded-t-lg h-1/3" />
                  <div className="w-full bg-brand-teal rounded-t-lg h-2/3 shadow-lg shadow-brand-teal/20" />
                  <div className="w-full bg-slate-100 rounded-t-lg h-full" />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-900 font-extrabold text-sm uppercase">
                    {results.commitmentLevel}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    Verbal Promise
                  </span>
                </div>
              </div>
            </div>

            {/* Treasury Forecast (cashflow card with teal glow) */}
            <div
              className={`bg-white p-8 rounded-3xl border-2 border-transparent shadow-md flex flex-col justify-between min-h-[240px] ${
                showReport
                  ? "animate-breath-glow-teal scale-105 z-10"
                  : ""
              }`}
            >
              <span className="text-[10px] uppercase tracking-widest text-brand-teal font-extrabold">
                Treasury Forecast
              </span>
              <div className="mt-6">
                <div className="text-3xl font-headline font-black text-slate-900 tracking-tight">
                  {"\u00a3"}
                  {results.cashflowImpact.amount.toLocaleString("en-GB", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div className="mt-4 inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
                  <span className="material-symbols-outlined text-[14px] mr-1">
                    trending_up
                  </span>
                  RECOVERY SIGNAL
                </div>
                <p className="text-[11px] text-slate-500 mt-4 leading-relaxed font-medium">
                  Expected realization within {results.cashflowImpact.expectedDays}{" "}
                  days based on historical behavior.
                </p>
              </div>
            </div>
          </div>

          {/* ── Transcript + Actions ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            {/* Transcript */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200/60">
                <h2 className="font-headline text-2xl font-bold tracking-tight text-slate-900">
                  Intelligence Transcript
                </h2>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Analyzed Real-time
                  </span>
                </div>
              </div>
              <div className="space-y-10 max-h-[700px] overflow-y-auto scroll-custom pr-4">
                {results.transcript.map((msg, i) => (
                  <div
                    key={i}
                    className={`space-y-3 ${
                      showReport ? "fade-in-entry" : ""
                    }`}
                    style={
                      showReport
                        ? { animationDelay: `${i * 0.6}s` }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-black uppercase tracking-[0.15em] ${
                          msg.role === "agent"
                            ? "text-brand-teal"
                            : "text-slate-900"
                        }`}
                      >
                        {msg.role === "agent"
                          ? "Qashivo AI Agent"
                          : "Counterparty (Debtor)"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {msg.timestamp}
                      </span>
                    </div>
                    <div
                      className={`p-6 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
                        msg.role === "agent"
                          ? "bg-slate-50 border border-slate-100 rounded-tl-none text-slate-700"
                          : "bg-white border border-slate-200 rounded-tr-none text-slate-900"
                      }`}
                    >
                      {msg.text}
                      {msg.badges && msg.badges.length > 0 && (
                        <div className="mt-6 flex flex-wrap gap-3">
                          {msg.badges.map((badge, j) => (
                            <span
                              key={j}
                              className={`inline-flex items-center px-2 py-1 border text-[9px] font-bold rounded uppercase tracking-wider ${
                                showReport ? "badge-slide" : ""
                              } ${badgeClasses(badge.type)}`}
                              style={
                                showReport
                                  ? {
                                      animationDelay: `${
                                        i * 0.6 + (j + 1) * 0.3
                                      }s`,
                                    }
                                  : undefined
                              }
                            >
                              <span className="material-symbols-outlined text-[12px] mr-1">
                                {badge.icon}
                              </span>
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Intelligence Actions */}
            <div className="space-y-8">
              <h2 className="font-headline text-2xl font-bold tracking-tight text-slate-900 mb-8 pb-4 border-b border-slate-200/60">
                Intelligence Actions
              </h2>
              <div className="space-y-4">
                {results.recommendedActions.map((action, i) => (
                  <div
                    key={i}
                    className={`bg-white p-6 rounded-2xl border-l-4 shadow-sm ${
                      action.color === "amber"
                        ? "border-amber-400"
                        : "border-brand-teal"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span
                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded tracking-widest uppercase ${
                          action.color === "amber"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-brand-teal/10 text-brand-teal"
                        }`}
                      >
                        {action.type}
                      </span>
                      <span className="material-symbols-outlined text-slate-400 text-lg">
                        {action.icon}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {action.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                ))}

                {/* AI Risk Insight */}
                <div className="bg-brand-navy p-8 rounded-[2rem] text-white mt-12 relative overflow-hidden shadow-2xl">
                  <div className="relative z-10">
                    <div className="w-10 h-10 bg-brand-teal rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-brand-teal/20">
                      <span className="material-symbols-outlined text-white">
                        lightbulb
                      </span>
                    </div>
                    <h4 className="font-headline font-bold text-lg mb-3">
                      AI Risk Insight
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {results.riskInsights}
                    </p>
                  </div>
                  <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-brand-teal/10 rounded-full blur-[80px]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── BOTTOM CTA ───────────────────────────────────────────────────── */}
        <section className="mt-28 rounded-[4rem] bg-brand-navy text-white p-12 md:p-24 text-center dot-grid relative overflow-hidden border border-slate-800">
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="font-headline text-4xl md:text-6xl font-black tracking-tighter mb-8 leading-[1.1]">
              Imagine This Working on Every Overdue Invoice. Automatically.
            </h2>
            <p className="text-slate-400 text-xl mb-12 font-medium leading-relaxed">
              Qashivo handles credit control calls, extracts intelligence, and
              updates your cashflow forecast. All without you picking up the
              phone.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link href="/contact">
                <span className="inline-block bg-brand-teal text-white px-10 py-5 rounded-2xl font-bold text-lg hover:brightness-110 transition-all shadow-xl shadow-brand-teal/20 cursor-pointer">
                  Book a Demo
                </span>
              </Link>
              <Link href="/cashflow-health-check">
                <span className="inline-block border border-slate-700 bg-slate-900/50 backdrop-blur-sm text-white px-10 py-5 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all cursor-pointer">
                  Take the Health Check
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
