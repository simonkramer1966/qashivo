import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import heroVideo from "@assets/Hero-Animation-Feb-25-10-10-55_1772704261589.mp4";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";
import simonPic from "@assets/Simon_Pic_1772705100283.avif";
import officeImg from "@assets/image_1772706665154.png";
import smeOwnerImg from "@assets/image_1772706996989.png";
import {
  Check, ChevronRight, Database, Calendar, UserCheck, Play, BarChart2,
  RefreshCw, Shield, FileText, Lock, Users, Clock,
  Building, Link, TrendingUp, MessageSquare, Mail, LayoutDashboard,
} from "lucide-react";

interface WaitlistFormData {
  fullName: string;
  email: string;
  firmName: string;
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
    formState: { errors },
  } = useForm<WaitlistFormData>({ defaultValues: { website: "" } });

  const onSubmit = async (data: WaitlistFormData) => {
    if (data.website) return;
    setIsSubmitting(true);
    try {
      const payload = {
        fullName: data.fullName,
        email: data.email,
        firmName: data.firmName,
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
    { icon: Database, label: "Import Receivables" },
    { icon: Calendar, label: "Create Daily Plan" },
    { icon: UserCheck, label: "Human Approves" },
    { icon: Play, label: "Execute Outreach" },
    { icon: BarChart2, label: "Capture Outcomes" },
    { icon: RefreshCw, label: "Update Cash View" },
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
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
                Turn cashflow advisory into a scalable service
              </h1>
              <p className="text-lg font-semibold text-gray-800 mb-6">
                Qashivo helps accounting firms become the working capital partner for SME clients — combining managed receivables, payment-intent capture, and live cashflow visibility in one accountant-led workflow.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Launch a new cashflow advisory service without adding headcount",
                  "Manage receivables and client cash visibility in one partner workspace",
                  "Turn debtor responses into structured outcomes that improve forecasts",
                  "Join early and help shape the accountant-led working capital model",
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
                    Join the Founding Partners Waitlist
                  </Button>
                </a>
                <a href="#how-it-works">
                  <Button size="lg" variant="ghost" className="text-gray-600 hover:text-gray-900 font-medium">
                    See how it works <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </a>
              </div>
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
          <div className="grid grid-cols-5 gap-3">
            {[
              { icon: Users, label: "Built for Accounting Firms" },
              { icon: UserCheck, label: "Accountant-Led Advisory" },
              { icon: Shield, label: "Human Approval Layer" },
              { icon: FileText, label: "Full Audit Trail" },
              { icon: MessageSquare, label: "Outcome Capture" },
              { icon: TrendingUp, label: "Live Cashflow Visibility" },
              { icon: Mail, label: "Email + SMS + Voice" },
              { icon: Link, label: "Xero / QuickBooks" },
              { icon: Building, label: "Open Banking Ready" },
              { icon: LayoutDashboard, label: "Multi-Client Workspace" },
            ].map(({ icon: Icon, label }) => (
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
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Built for firms that want to offer more than compliance</h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Qashivo gives your firm the infrastructure to offer accountant-led working capital support to SME clients. Whether you already provide credit control support or want to launch a packaged cashflow advisory service, Qashivo helps you deliver it consistently, clearly, and at scale.
              </p>
              <ul className="space-y-3">
                {[
                  "Add a cashflow advisory service without building a credit control team",
                  "Standardise receivables workflows across your client portfolio",
                  "Give clients something they truly value: more confidence in when cash will land",
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
              <h2 className="text-3xl font-bold text-gray-900 mb-5">The real problem is not invoices. It's cash uncertainty.</h2>
              <p className="text-lg text-gray-600 mb-4 leading-relaxed">
                SMEs rarely struggle because they cannot issue invoices. They struggle because follow-up is inconsistent, debtor intent is hidden inside inboxes and calls, and cashflow forecasts are built on assumptions instead of real outcomes.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                Accounting firms see this every day, but delivering help has historically been too manual to scale. Qashivo changes that. We capture what debtors actually say — promises to pay, requests for more time, disputes, and silence — and turn those signals into structured workflow outcomes that update the next action and expected cash position.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* How It Works */}
      <section id="how-it-works" className="py-20 border-b border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">How accountant-led working capital management works</h2>
          <p className="text-center text-gray-500 mb-12 text-base">A supervised workflow that helps firms manage receivables and improve cash visibility across clients</p>
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
      {/* Join and get exclusive access */}
      <section className="py-16 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Launch a new service line for your firm</h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Qashivo is designed to help firms move beyond reporting on cashflow and start actively improving it. Founding Partners will be first to shape a platform that enables managed receivables, intent-aware follow-up, and live client cashflow visibility all under firm control.
          </p>
        </div>
      </section>
      {/* WhatsApp Chat Examples */}
      <section className="py-12 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                key: "promise",
                messages: [
                  { side: "right", text: "What happens when a debtor promises to pay on a specific date?" },
                  { side: "left",  text: "We capture the payment date, pause unnecessary chasing, update expected cash, and schedule the right follow-up automatically." },
                  { side: "right", text: "That's exactly the kind of signal clients ask us for." },
                ],
              },
              {
                key: "disputes",
                messages: [
                  { side: "right", text: "What if the debtor raises a dispute or invoice issue?" },
                  { side: "left",  text: "We classify it as a dispute, remove it from the chase flow, and surface it for your team to review." },
                  { side: "right", text: "That saves a lot of manual inbox checking." },
                ],
              },
              {
                key: "moretime",
                messages: [
                  { side: "right", text: "Can Qashivo handle requests for more time or a payment plan?" },
                  { side: "left",  text: "Yes, we detect the request, record the proposed arrangement, and adjust the workflow so the next action reflects the new reality." },
                  { side: "right", text: "That's much closer to real-world credit control." },
                ],
              },
              {
                key: "plans",
                messages: [
                  { side: "right", text: "How does this help with cashflow advisory?" },
                  { side: "left",  text: "Every captured outcome improves visibility on what is likely to be paid, when, and with what level of confidence." },
                  { side: "right", text: "That makes the forecast far more useful in client conversations." },
                ],
              },
            ].map((chat) => (
              <div key={chat.key} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <Users className="h-3.5 w-3.5 text-white" />
                  </div>
                  <p className="font-semibold text-gray-700 text-[15px]">Qashivo Founding Team</p>
                </div>
                <div className="px-3 py-3 space-y-2 flex-1">
                  {chat.messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.side === "right" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-snug ${
                          msg.side === "right"
                            ? "bg-green-100 text-gray-800 rounded-br-sm"
                            : "bg-gray-100 text-gray-700 rounded-bl-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Join the Founding Partners team</h2>
                <p className="text-gray-600">
                  Fill in your details and you'll receive a WhatsApp invite and next steps.
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
                    "Join the Founding Partners Waitlist"
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
