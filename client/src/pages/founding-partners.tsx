import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import heroVideo from "@assets/Hero-Animation-Feb-25-10-10-55_1772704261589.mp4";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";
import simonPic from "@assets/Simon_Pic_1772705100283.avif";
import officeImg from "@assets/image_1772706665154.png";
import smeOwnerImg from "@assets/image_1772706996989.png";
import {
  Check, ChevronRight, Database, Calendar, UserCheck, Play, BarChart2,
  RefreshCw, Shield, FileText, Lock, AlertCircle, Users, Clock,
  Building, Link, TrendingUp, MessageSquare, Mail,
} from "lucide-react";

interface WaitlistFormData {
  fullName: string;
  email: string;
  firmName: string;
  mobile: string;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  q4other: string;
  q5: string;
  website: string;
}

const TEAL = "#0EA5A0";

export default function FoundingPartners() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<WaitlistFormData>({ defaultValues: { q4other: "", website: "" } });

  const q4Value = watch("q4");

  const onSubmit = async (data: WaitlistFormData) => {
    if (data.website) return;
    setIsSubmitting(true);
    try {
      const payload = {
        fullName: data.fullName,
        email: data.email,
        firmName: data.firmName,
        mobile: data.mobile,
        q1: data.q1,
        q2: data.q2,
        q3: data.q3,
        q4: data.q4 === "Other" && data.q4other ? `Other: ${data.q4other}` : data.q4,
        q5: data.q5,
        website: data.website,
        sourcePath: "/founding-partners",
      };
      const res = await fetch("/api/public/partner-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Server error");
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast({
        title: "Something went wrong",
        description: "Please try again or email us at partners@qashivo.com",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { icon: Database, label: "Receivables Data" },
    { icon: Calendar, label: "Daily Plan" },
    { icon: UserCheck, label: "Human Approves" },
    { icon: Play, label: "Execute" },
    { icon: BarChart2, label: "Capture Outcomes" },
    { icon: RefreshCw, label: "Adjust" },
  ];

  const trustItems = [
    { icon: UserCheck, label: "Human approval required" },
    { icon: FileText, label: "Full audit trail" },
    { icon: Lock, label: "Data minimised" },
    { icon: AlertCircle, label: "Exceptions-first workflow" },
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Sticky Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center h-16">
          <a href="/home" className="flex items-center gap-2">
              <img src={logo} alt="Qashivo" className="h-8 w-8" />
              <span className="font-semibold text-[#0B0F17] tracking-tight text-[22px]">Qashivo</span>
            </a>
          <div className="flex items-center gap-4">
            <a href="/signin" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Sign in</a>
            <a href="/demo">
              <Button size="sm" style={{ backgroundColor: TEAL }} className="text-white hover:opacity-90">
                Book a demo
              </Button>
            </a>
          </div>
        </div>
      </nav>
      {/* Hero */}
      <section className="py-20 md:py-28 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-0 items-center">
            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-5 px-3 py-1 rounded-full border border-gray-200 text-gray-500">
                Launching: Founding Team (UK Accounting Firms)
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight text-gray-900 mb-5">
                Hi, we're launching Qashivo
              </h1>
              <p className="text-lg font-semibold text-gray-800 mb-6">
                Helping clients get paid faster, without adding headcount.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Early access to the Partner platform",
                  "Direct input into what we build next (your workflow becomes the blueprint)",
                  "Private Founding Team WhatsApp group",
                  "Lifetime founding discount (locked in)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700">
                    <Check className="h-5 w-5 mt-0.5 shrink-0" style={{ color: TEAL }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <a href="#apply">
                  <Button size="lg" style={{ backgroundColor: TEAL }} className="text-white hover:opacity-90 font-semibold px-6">
                    Join the Founding Team Waitlist
                  </Button>
                </a>
                <a href="#how-it-works">
                  <Button size="lg" variant="ghost" className="text-gray-600 hover:text-gray-900 font-medium">
                    See how it works <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </a>
              </div>
              <p className="text-sm text-gray-400 mt-3">
                Applications are reviewed weekly. If you're a fit, you'll get an invite to the WhatsApp group + next steps.
              </p>
            </div>

            {/* Right: Hero video */}
            <div className="aspect-square overflow-hidden">
              <video
                src={heroVideo}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>
      {/* Credibility Badges */}
      <section className="py-6 border-b border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { icon: Users, label: "Built for Accountants" },
              { icon: UserCheck, label: "Human Approval Layer" },
              { icon: FileText, label: "Full Audit Trail" },
              { icon: MessageSquare, label: "Outcome Capture (Intent)" },
              { icon: TrendingUp, label: "Cash-in Confidence" },
              { icon: Mail, label: "Email + SMS + Voice" },
              { icon: Link, label: "Xero / QuickBooks", comingSoon: true },
              { icon: Building, label: "Open Banking", comingSoon: true },
            ].map(({ icon: Icon, label, comingSoon }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="text-xs font-medium whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Built for accounting partners */}
      <section className="py-16 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Built for accounting partners</h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Whether you already offer credit control or want to add it, Qashivo helps you deliver it consistently, at scale, with minimal extra resource.
              </p>
              <ul className="space-y-3">
                {[
                  "Add a packaged credit control service without hiring",
                  "Standardise the workflow across your client portfolio",
                  "Offer something clients actually value: cash-in confidence",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700">
                    <Check className="h-5 w-5 mt-0.5 shrink-0" style={{ color: TEAL }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl overflow-hidden aspect-[4/3]">
              <img src={officeImg} alt="Accounting team at work" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>
      {/* Problems we're solving */}
      <section className="py-20 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="rounded-xl overflow-hidden aspect-[4/3] order-2 lg:order-1">
              <img src={smeOwnerImg} alt="SME owner reviewing invoices" className="w-full h-full object-cover" />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl font-bold text-gray-900 mb-5">The problems we're solving</h2>
              <p className="text-lg text-gray-600 mb-4 leading-relaxed">
                SMEs don't have an invoice problem. They have a follow-up and outcomes problem. Promises to pay, requests for more time, and disputes live in messy inbox threads, so cash stays uncertain.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                For accounting firms, credit control is hard to scale because it's manual, inconsistent, and outcome-blind. Qashivo captures intent as structured outcomes so the next action is obvious, and the cashflow forecast updates immediately.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* How It Works */}
      <section id="how-it-works" className="py-20 border-b border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">How it works</h2>
          <p className="text-center text-gray-500 mb-12 text-base">The supervised autonomy loop</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-0 flex-wrap">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center px-4 py-2">
                  <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center mb-2 bg-white" style={{ borderColor: TEAL }}>
                    <step.icon className="h-5 w-5" style={{ color: TEAL }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center max-w-[80px] leading-tight">{step.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className="h-5 w-5 text-gray-300 hidden sm:block shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Selection Criteria */}
      <section className="py-20 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-10">Who we're choosing first</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-10">
            <div>
              <h3 className="text-lg font-semibold mb-5" style={{ color: TEAL }}>This is a fit if you're:</h3>
              <ul className="space-y-3">
                {[
                  "An accounting firm serving SMEs where late payment is a recurring issue",
                  "Either already offering credit control or ready to launch it as a packaged service",
                  "Comfortable giving feedback as we iterate",
                  "Serious about trust and process (approval layer, audit trail)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700">
                    <Check className="h-5 w-5 mt-0.5 shrink-0" style={{ color: TEAL }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-500 mb-5">This probably isn't a fit if you want:</h3>
              <ul className="space-y-3">
                {[
                  "Fully autonomous chasing with no approval",
                  "A generic reminder tool",
                  "A 'set and forget' approach with no learning loop",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-600">
                    <span className="mt-1 shrink-0 text-red-400 font-bold leading-none">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-lg text-gray-600 mb-8 text-center">
            If you're building a modern accounting firm where outcomes matter, you'll feel at home here.
          </p>
          <div className="rounded-xl border-l-4 bg-gray-50 px-6 py-5" style={{ borderLeftColor: TEAL }}>
            <p className="font-semibold text-gray-900 italic text-[18px] text-center">
              "You're not joining a list. You're joining the inner circle that builds the new standard for credit control."
            </p>
          </div>
        </div>
      </section>
      {/* Trust & Controls */}
      <section className="py-16 border-b border-gray-100 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {trustItems.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-3 p-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${TEAL}15` }}>
                  <Icon className="h-6 w-6" style={{ color: TEAL }} />
                </div>
                <span className="text-sm font-medium text-gray-700 leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Join and get exclusive access */}
      <section className="py-16 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Join and get exclusive access</h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Founding Team members get early access, the private WhatsApp group, weekly playbooks, and a lifetime founding discount, locked to your firm.
          </p>
        </div>
      </section>
      {/* WhatsApp Cohort Placeholder */}
      <section className="py-12 border-b border-gray-100">
        <div className="max-w-sm mx-auto px-6">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Founding Team WhatsApp Group</p>
                <p className="text-xs text-gray-500">10 members max</p>
              </div>
            </div>
            <div className="px-4 py-4 space-y-3">
              {[
                { side: "right", width: "w-48", color: "bg-green-100" },
                { side: "left", width: "w-40", color: "bg-gray-100" },
                { side: "right", width: "w-36", color: "bg-green-100" },
              ].map((bubble, i) => (
                <div key={i} className={`flex ${bubble.side === "right" ? "justify-end" : "justify-start"}`}>
                  <div className={`${bubble.width} h-8 rounded-xl ${bubble.color}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      {/* Waitlist Form */}
      <section id="apply" className="py-20 border-b border-gray-100 bg-gray-50">
        <div className="max-w-xl mx-auto px-6">
          {submitted ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: `${TEAL}20` }}>
                <Check className="h-8 w-8" style={{ color: TEAL }} />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Application received</h2>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                Thanks. We review applications weekly. If you're a fit, you'll receive an invite to the Founding Team WhatsApp group and next steps.
              </p>
              <a href="/demo">
                <Button size="lg" style={{ backgroundColor: TEAL }} className="text-white hover:opacity-90 font-semibold">
                  Book a demo
                </Button>
              </a>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Join the Founding Team</h2>
                <p className="text-gray-600">
                  Answer 5 quick questions and you'll receive a WhatsApp invite and next steps.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Honeypot — hidden from real users */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  style={{ display: "none" }}
                  {...register("website")}
                />

                {/* Contact fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name <span className="text-red-500">*</span></label>
                    <Input
                      {...register("fullName", { required: "Full name is required" })}
                      placeholder="Jane Smith"
                      className={errors.fullName ? "border-red-400" : ""}
                    />
                    {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work email <span className="text-red-500">*</span></label>
                    <Input
                      type="email"
                      {...register("email", { required: "Email is required", pattern: { value: /\S+@\S+\.\S+/, message: "Enter a valid email" } })}
                      placeholder="jane@yourfirm.co.uk"
                      className={errors.email ? "border-red-400" : ""}
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firm name <span className="text-red-500">*</span></label>
                    <Input
                      {...register("firmName", { required: "Firm name is required" })}
                      placeholder="Smith & Associates Ltd"
                      className={errors.firmName ? "border-red-400" : ""}
                    />
                    {errors.firmName && <p className="text-xs text-red-500 mt-1">{errors.firmName.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile number (for WhatsApp) <span className="text-red-500">*</span></label>
                    <Input
                      type="tel"
                      {...register("mobile", { required: "Mobile number is required" })}
                      placeholder="+44 7700 900000"
                      className={errors.mobile ? "border-red-400" : ""}
                    />
                    {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile.message}</p>}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <p className="font-semibold text-gray-700 mb-4 text-[16px]">Tell us a bit more about you ...</p>

                  {/* Q1 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      1. How many SME clients do you currently support? <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      name="q1"
                      control={control}
                      rules={{ required: "Please select an answer" }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className={errors.q1 ? "border-red-400" : ""}>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {["1–25", "26–100", "101–300", "301–1,000", "1,000+"].map(o => (
                              <SelectItem key={o} value={o}>{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.q1 && <p className="text-xs text-red-500 mt-1">{errors.q1.message}</p>}
                  </div>

                  {/* Q2 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      2. Do you currently offer a credit control / debtor chasing service? <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      name="q2"
                      control={control}
                      rules={{ required: "Please select an answer" }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className={errors.q2 ? "border-red-400" : ""}>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {["Yes (core service)", "Yes (ad-hoc)", "Not yet but planning to", "No"].map(o => (
                              <SelectItem key={o} value={o}>{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.q2 && <p className="text-xs text-red-500 mt-1">{errors.q2.message}</p>}
                  </div>

                  {/* Q3 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      3. Roughly how many of your clients struggle with late payment each month? <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      name="q3"
                      control={control}
                      rules={{ required: "Please select an answer" }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className={errors.q3 ? "border-red-400" : ""}>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {["A few", "Around half", "Most", "Nearly all"].map(o => (
                              <SelectItem key={o} value={o}>{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.q3 && <p className="text-xs text-red-500 mt-1">{errors.q3.message}</p>}
                  </div>

                  {/* Q4 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      4. What's your current credit control setup today? <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      name="q4"
                      control={control}
                      rules={{ required: "Please select an answer" }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className={errors.q4 ? "border-red-400" : ""}>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {["Spreadsheet + inbox", "Reminder tool", "Dedicated internal team", "Outsourced service", "Other"].map(o => (
                              <SelectItem key={o} value={o}>{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.q4 && <p className="text-xs text-red-500 mt-1">{errors.q4.message}</p>}
                    {q4Value === "Other" && (
                      <div className="mt-2">
                        <Input
                          {...register("q4other", { required: q4Value === "Other" ? "Please describe your setup" : false })}
                          placeholder="Please describe..."
                          className={errors.q4other ? "border-red-400" : ""}
                        />
                        {errors.q4other && <p className="text-xs text-red-500 mt-1">{errors.q4other.message}</p>}
                      </div>
                    )}
                  </div>

                  {/* Q5 */}
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      5. If Qashivo worked as described, how quickly could you pilot with 1–3 clients? <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      name="q5"
                      control={control}
                      rules={{ required: "Please select an answer" }}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className={errors.q5 ? "border-red-400" : ""}>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {["Immediately (this month)", "Next 30 days", "Next 60–90 days", "Not sure yet"].map(o => (
                              <SelectItem key={o} value={o}>{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.q5 && <p className="text-xs text-red-500 mt-1">{errors.q5.message}</p>}
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  style={{ backgroundColor: TEAL }}
                  className="w-full text-white hover:opacity-90 font-semibold text-base py-6"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 animate-spin" /> Submitting...
                    </span>
                  ) : (
                    "Join the Founding Team Waitlist"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
      {/* Founder Signature */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="w-48 h-48 rounded-full mx-auto mb-6 overflow-hidden">
            <img src={simonPic} alt="Simon" className="w-full h-full object-cover object-top" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-5">A quick note from the founder</h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-6">
            I'm building Qashivo with a small group of accounting firms first, so we get the workflow right and the outcomes are real.
            <br /><br />
            If you want to offer credit control that scales and automated cashflow without adding headcount, I'd love to have you on the founding team.
          </p>
          <p className="text-lg font-semibold text-gray-900">Simon</p>
          <p className="text-sm text-gray-400 mt-1">Founder, Qashivo</p>
        </div>
      </section>
      {/* Footer */}
      <footer className="py-6 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} Nexus KPI Limited · <a href="/privacy" className="hover:underline">Privacy</a> · <a href="/terms" className="hover:underline">Terms</a>
        </p>
      </footer>
    </div>
  );
}
