import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Menu, X, Check, Lightbulb, Handshake, ClipboardCheck, BarChart3, Shield, Eye, FileCheck, Cloud, ArrowRight, Phone, Mail, Users, Target, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

interface DesignPartnerFormData {
  name: string;
  firmName: string;
  email: string;
  phone: string;
  role: string;
  clientCount: string;
  clientProfile: string;
  currentApproach: string;
  canNominateClients: string;
  improvementGoal: string;
}

export default function DesignPartner() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<DesignPartnerFormData>();

  const onSubmit = async (data: DesignPartnerFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/public/sales-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          company: data.firmName,
          phone: data.phone,
          message: `Role: ${data.role}\nApprox SME clients: ${data.clientCount}\nTypical client profile: ${data.clientProfile}\nCurrent approach: ${data.currentApproach}\nCan nominate 1-3 clients: ${data.canNominateClients}\nWants to improve: ${data.improvementGoal}`,
          enquiryType: 'design-partnership'
        })
      });

      if (!response.ok) throw new Error('Failed to submit');

      toast({
        title: "Application received",
        description: "We'll respond within 24 hours.",
      });
      reset();
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: "Please try again or email us directly at partners@qashivo.com",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-10">
              <a href="/home" className="flex items-center gap-2">
                <img src={logo} alt="Qashivo" className="h-8 w-8" />
                <span className="text-[22px] font-semibold text-[#0B0F17] tracking-tight">Qashivo</span>
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="/home" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Home</a>
                <a href="/product" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Product</a>
                <a href="/partners" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Partners</a>
                <a href="/pricing" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Pricing</a>
                <a href="/contact" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Contact</a>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <a href="/login" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Sign in</a>
              <Button
                onClick={() => setLocation("/contact")}
                className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 px-5 rounded-full text-[15px] font-medium"
              >
                Book a demo
              </Button>
            </div>
            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E6E8EC] bg-white px-6 py-4">
            <div className="flex flex-col gap-4">
              <a href="/home" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Home</a>
              <a href="/product" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Product</a>
              <a href="/partners" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Partners</a>
              <a href="/pricing" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Pricing</a>
              <a href="/contact" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Contact</a>
              <div className="border-t border-[#E6E8EC] pt-4 mt-2 flex flex-col gap-3">
                <a href="/login" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Sign in</a>
                <Button
                  onClick={() => setLocation("/contact")}
                  className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 rounded-xl text-[15px] font-medium w-full"
                >
                  Book a demo
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="py-16 md:py-24 border-b border-[#E6E8EC]">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div className="text-left">
              <span className="inline-block text-[12px] font-semibold text-[#12B8C4] uppercase tracking-wider bg-[#E0F7FA] px-3 py-1.5 rounded-full mb-5">Design Partner Program (Limited places)</span>
              <h1 className="text-[32px] md:text-[42px] font-semibold text-[#0B0F17] leading-[1.15] tracking-tight mb-6">
                Become a Founding Design Partner for Supervised Credit Control
              </h1>
              <p className="text-[16px] md:text-[17px] text-[#556070] leading-relaxed mb-6">
                Qashivo helps SMEs get paid faster by turning debtor replies into outcomes (promise to pay, more time, dispute) — updating cash expectations immediately. Nothing is sent without approval.
              </p>
              <div className="space-y-3 text-[15px] text-[#556070] mb-6">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                  <span>Daily chase plan generated for you</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                  <span>Human approval before anything is sent</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                  <span>Outcome capture from debtor replies</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                  <span>Full audit trail of every action</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                  <span>Cash expectations updated from debtor intent</span>
                </div>
              </div>
              <p className="text-[13px] text-[#9CA3AF] italic">
                We'll share detailed roadmap and workflow documentation after an NDA.
              </p>
            </div>

            {/* Application Form */}
            <div className="bg-[#F8FAFB] p-6 md:p-8 rounded-xl border border-[#E6E8EC]">
              <h2 className="text-[20px] font-semibold text-[#0B0F17] mb-2">Apply to become a Design Partner</h2>
              <p className="text-[14px] text-[#556070] mb-6">We'll respond within 24 hours.</p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#0B0F17] mb-1.5">Your name *</label>
                    <Input
                      {...register("name", { required: "Name is required" })}
                      placeholder="Jane Smith"
                      className="h-11 bg-white border-[#E6E8EC] rounded-lg text-[14px] placeholder:text-[#9CA3AF]"
                    />
                    {errors.name && <p className="text-red-500 text-[12px] mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#0B0F17] mb-1.5">Firm name *</label>
                    <Input
                      {...register("firmName", { required: "Firm name is required" })}
                      placeholder="Smith & Co Accountants"
                      className="h-11 bg-white border-[#E6E8EC] rounded-lg text-[14px] placeholder:text-[#9CA3AF]"
                    />
                    {errors.firmName && <p className="text-red-500 text-[12px] mt-1">{errors.firmName.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#0B0F17] mb-1.5">Email *</label>
                    <Input
                      {...register("email", {
                        required: "Email is required",
                        pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: "Invalid email" }
                      })}
                      type="email"
                      placeholder="jane@smithco.com"
                      className="h-11 bg-white border-[#E6E8EC] rounded-lg text-[14px] placeholder:text-[#9CA3AF]"
                    />
                    {errors.email && <p className="text-red-500 text-[12px] mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#0B0F17] mb-1.5">Phone</label>
                    <Input
                      {...register("phone")}
                      type="tel"
                      placeholder="+44 7700 900000"
                      className="h-11 bg-white border-[#E6E8EC] rounded-lg text-[14px] placeholder:text-[#9CA3AF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#0B0F17] mb-1.5">Your role / title</label>
                  <Input
                    {...register("role")}
                    placeholder="e.g. Partner, Practice Manager, Director"
                    className="h-11 bg-white border-[#E6E8EC] rounded-lg text-[14px] placeholder:text-[#9CA3AF]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#0B0F17] mb-1.5">Approx. number of SME clients</label>
                    <Input
                      {...register("clientCount")}
                      placeholder="e.g. 50, 100+"
                      className="h-11 bg-white border-[#E6E8EC] rounded-lg text-[14px] placeholder:text-[#9CA3AF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#0B0F17] mb-1.5">Typical client size / industry</label>
                    <Input
                      {...register("clientProfile")}
                      placeholder="e.g. 5-50 employees, construction"
                      className="h-11 bg-white border-[#E6E8EC] rounded-lg text-[14px] placeholder:text-[#9CA3AF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#0B0F17] mb-1.5">Current tools / approach for credit control</label>
                  <Input
                    {...register("currentApproach")}
                    placeholder="e.g. Xero statements, manual emails, Chaser"
                    className="h-11 bg-white border-[#E6E8EC] rounded-lg text-[14px] placeholder:text-[#9CA3AF]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#0B0F17] mb-1.5">Could you nominate 1-3 clients for the pilot?</label>
                  <Controller
                    name="canNominateClients"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="h-11 bg-white border-[#E6E8EC] rounded-lg text-[14px]">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes, I have clients in mind</SelectItem>
                          <SelectItem value="likely">Likely, need to discuss with them first</SelectItem>
                          <SelectItem value="not-sure">Not sure yet</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#0B0F17] mb-1.5">What do you most want to improve? *</label>
                  <Textarea
                    {...register("improvementGoal", {
                      required: "Please tell us what you'd like to improve",
                      minLength: { value: 10, message: "Please provide a bit more detail" }
                    })}
                    placeholder="e.g. Clients take too long to chase debtors, we want to offer credit control as an advisory service..."
                    rows={3}
                    className="bg-white border-[#E6E8EC] rounded-lg text-[14px] placeholder:text-[#9CA3AF] resize-none"
                  />
                  {errors.improvementGoal && <p className="text-red-500 text-[12px] mt-1">{errors.improvementGoal.message}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 rounded-lg text-[14px] font-medium"
                >
                  {isSubmitting ? "Submitting..." : "Submit application"}
                </Button>

                <p className="text-[12px] text-[#9CA3AF] text-center">
                  Prefer email? <a href="mailto:partners@qashivo.com" className="text-[#12B8C4] hover:underline">partners@qashivo.com</a>
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Now / Next / Later Roadmap */}
      <section className="py-16 border-b border-[#E6E8EC]">
        <div className="max-w-[900px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-10 text-center">Product Direction</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border-l-4 border-[#22C55E] pl-5 py-1">
              <span className="inline-block text-[11px] font-semibold text-white bg-[#22C55E] px-2.5 py-1 rounded-full mb-3">NOW</span>
              <ul className="space-y-2 text-[14px] text-[#556070]">
                <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[#22C55E] mt-0.5 flex-shrink-0" /> CSV import</li>
                <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[#22C55E] mt-0.5 flex-shrink-0" /> Plan, approve, send (email first)</li>
                <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[#22C55E] mt-0.5 flex-shrink-0" /> Reply capture + outcomes</li>
                <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[#22C55E] mt-0.5 flex-shrink-0" /> Action timeline</li>
                <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-[#22C55E] mt-0.5 flex-shrink-0" /> Cash expectations updated</li>
              </ul>
            </div>

            <div className="border-l-4 border-[#F59E0B] pl-5 py-1">
              <span className="inline-block text-[11px] font-semibold text-white bg-[#F59E0B] px-2.5 py-1 rounded-full mb-3">NEXT</span>
              <ul className="space-y-2 text-[14px] text-[#556070]">
                <li className="flex items-start gap-2"><ArrowRight className="w-3.5 h-3.5 text-[#F59E0B] mt-0.5 flex-shrink-0" /> SMS templates</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3.5 h-3.5 text-[#F59E0B] mt-0.5 flex-shrink-0" /> Read-only accounting sync</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3.5 h-3.5 text-[#F59E0B] mt-0.5 flex-shrink-0" /> Payment plans & disputes</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3.5 h-3.5 text-[#F59E0B] mt-0.5 flex-shrink-0" /> Confidence indicators</li>
              </ul>
            </div>

            <div className="border-l-4 border-[#12B8C4] pl-5 py-1">
              <span className="inline-block text-[11px] font-semibold text-white bg-[#12B8C4] px-2.5 py-1 rounded-full mb-3">LATER</span>
              <ul className="space-y-2 text-[14px] text-[#556070]">
                <li className="flex items-start gap-2"><ArrowRight className="w-3.5 h-3.5 text-[#12B8C4] mt-0.5 flex-shrink-0" /> Portfolio insights + scenarios</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-3.5 h-3.5 text-[#12B8C4] mt-0.5 flex-shrink-0" /> Working capital recommendations</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* What you'll help us design */}
      <section className="py-16 bg-[#F8FAFB] border-b border-[#E6E8EC]">
        <div className="max-w-[900px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-10 text-center">What You'll Help Us Design</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DesignCard
              icon={<ClipboardCheck className="w-5 h-5" />}
              title="Daily Plan"
              description="A prioritised list of who to chase today, with suggested actions and context — ready for you to review and approve."
            />
            <DesignCard
              icon={<Eye className="w-5 h-5" />}
              title="Approval + Audit"
              description="Nothing goes out without your say-so. Every action is logged with a full audit trail for compliance and visibility."
            />
            <DesignCard
              icon={<Target className="w-5 h-5" />}
              title="Outcome Capture"
              description="When a debtor replies, we detect the intent — promise to pay, request for more time, dispute — and update the record automatically."
            />
            <DesignCard
              icon={<BarChart3 className="w-5 h-5" />}
              title="Cashflow Confidence"
              description="Cash expectations update in real time as outcomes are captured, giving you a clearer picture of what's likely to land and when."
            />
          </div>
        </div>
      </section>

      {/* Why become a Founding Design Partner */}
      <section className="py-16 border-b border-[#E6E8EC]">
        <div className="max-w-[900px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-10 text-center">Why Become a Founding Design Partner?</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BenefitCard
              icon={<Pencil className="w-5 h-5" />}
              title="Influence the Product"
              description="Direct input into what we build next. Your workflows and your clients' pain points shape the roadmap."
            />
            <BenefitCard
              icon={<Users className="w-5 h-5" />}
              title="White-Glove Onboarding"
              description="Hands-on setup and training from our team. We'll work alongside you to get your first clients live."
            />
            <BenefitCard
              icon={<Handshake className="w-5 h-5" />}
              title="Preferential Terms"
              description="Founding partners receive preferential pricing that reflects the value of your early commitment and feedback."
            />
            <BenefitCard
              icon={<FileCheck className="w-5 h-5" />}
              title="Optional Case Study"
              description="If results are strong and you're comfortable, we'll co-create a case study that positions your firm as an innovator."
            />
          </div>
        </div>
      </section>

      {/* What we ask from Design Partners */}
      <section className="py-16 border-b border-[#E6E8EC]">
        <div className="max-w-[800px] mx-auto px-6">
          <div className="border-l-4 border-[#F59E0B] bg-[#FFFBEB] p-6 rounded-r-lg">
            <h3 className="text-[20px] font-semibold text-[#92400E] mb-4">What We Ask From Design Partners</h3>

            <div className="space-y-4 text-[15px] text-[#78350F]">
              <div>
                <p className="font-medium mb-2">Commitment over 6 weeks:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-[14px]">
                  <li>Nominate 1-3 SME clients with overdue invoices</li>
                  <li>60-minute kickoff session with our team</li>
                  <li>~30 minutes per week reviewing outcomes and giving feedback</li>
                  <li>Share outcome metrics (DSO movement, response rates, time saved)</li>
                </ul>
              </div>

              <p className="text-[14px] font-medium mt-4">
                No outbound communication is ever sent without your explicit approval.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who we're looking for */}
      <section className="py-16 border-b border-[#E6E8EC]">
        <div className="max-w-[800px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-6 text-center">Who We're Looking For</h2>
          <p className="text-[16px] text-[#556070] leading-relaxed mb-8 text-center">
            We're seeking accounting and bookkeeping firms who are:
          </p>

          <div className="space-y-4 mb-8">
            <CheckItem text="Serving SME clients who struggle with late payments or inconsistent credit control" />
            <CheckItem text="Interested in offering credit control as an advisory or managed service" />
            <CheckItem text="Willing to test with 1-3 real clients and share honest feedback" />
            <CheckItem text="Comfortable with cloud-based tools and integrations (Xero, QuickBooks, etc.)" />
            <CheckItem text="Excited to shape a product alongside the team building it" />
          </div>

          <div className="p-4 bg-[#FEF2F2] rounded-lg border border-[#FECACA]">
            <p className="text-[14px] text-[#991B1B] font-medium mb-2">Probably not the right fit if:</p>
            <ul className="space-y-1 text-[13px] text-[#991B1B]">
              <li>- You need a fully finished product today (we're building together)</li>
              <li>- You're looking for a white-label solution to resell immediately</li>
              <li>- You don't have SME clients with receivables to manage</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Trust-first by design */}
      <section className="py-16 bg-[#F8FAFB] border-b border-[#E6E8EC]">
        <div className="max-w-[900px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-10 text-center">Trust-First by Design</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TrustCard
              icon={<Shield className="w-5 h-5" />}
              title="Human Approval Required"
              description="Every outbound message requires explicit approval. The AI suggests, you decide."
            />
            <TrustCard
              icon={<FileCheck className="w-5 h-5" />}
              title="Full Audit Trail"
              description="Every action, approval, and outcome is logged with timestamps and user attribution."
            />
            <TrustCard
              icon={<Users className="w-5 h-5" />}
              title="Role-Based Access"
              description="Control who can view, approve, and send. Designed for multi-user teams and partner oversight."
            />
            <TrustCard
              icon={<Cloud className="w-5 h-5" />}
              title="Secure Cloud Hosting"
              description="Hosted on Google Cloud with encryption at rest and in transit. Detailed security documentation available after NDA."
            />
          </div>
        </div>
      </section>

      {/* What happens next */}
      <section className="py-16 border-b border-[#E6E8EC]">
        <div className="max-w-[700px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-10 text-center">What Happens Next</h2>

          <div className="space-y-0">
            <StepItem number={1} title="Apply" description="Fill in the form on this page. Takes 2 minutes." />
            <StepItem number={2} title="15-minute fit call" description="A quick conversation to understand your practice and clients." />
            <StepItem number={3} title="NDA" description="We share detailed product documentation, workflows, and roadmap." />
            <StepItem number={4} title="Onboard" description="White-glove setup with your first 1-3 clients. We do the heavy lifting." />
            <StepItem number={5} title="Weekly check-ins" description="Short feedback sessions over 6 weeks to iterate together." isLast />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-[700px] mx-auto px-6 text-center">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] mb-4">Ready to Shape the Future of Credit Control?</h2>
          <p className="text-[16px] text-[#556070] leading-relaxed mb-8">
            Places are limited so we can give every Design Partner the attention they deserve.
            Apply today and we'll be in touch within 24 hours.
          </p>
          <Button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-8 rounded-full text-[15px] font-medium mb-6"
          >
            Apply now
          </Button>
          <p className="text-[14px] text-[#556070]">
            Questions? Email us at <a href="mailto:partners@qashivo.com" className="font-medium text-[#12B8C4] hover:underline">partners@qashivo.com</a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E6E8EC] py-12">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Qashivo" className="h-6 w-6" />
              <span className="text-[15px] font-medium text-[#0B0F17]">Qashivo</span>
            </div>
            <div className="flex items-center gap-8 text-[14px] text-[#556070]">
              <a href="/privacy" className="hover:text-[#0B0F17] transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-[#0B0F17] transition-colors">Terms</a>
              <span>&copy; 2026 Nexus KPI Limited. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DesignCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-5 rounded-lg border border-[#E6E8EC]">
      <div className="w-9 h-9 bg-[#E0F7FA] rounded-lg flex items-center justify-center text-[#12B8C4] mb-3">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-[#0B0F17] mb-2">{title}</h3>
      <p className="text-[13px] text-[#556070] leading-relaxed">{description}</p>
    </div>
  );
}

function BenefitCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-[#F8FAFB] p-5 rounded-lg border border-[#E6E8EC]">
      <div className="w-9 h-9 bg-[#E0F7FA] rounded-lg flex items-center justify-center text-[#12B8C4] mb-3">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-[#0B0F17] mb-2">{title}</h3>
      <p className="text-[13px] text-[#556070] leading-relaxed">{description}</p>
    </div>
  );
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 bg-[#E0F7FA] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <Check className="w-3 h-3 text-[#12B8C4]" />
      </div>
      <p className="text-[15px] text-[#556070] leading-relaxed">{text}</p>
    </div>
  );
}

function TrustCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-5 rounded-lg border border-[#E6E8EC]">
      <div className="w-9 h-9 bg-[#F0FDF4] rounded-lg flex items-center justify-center text-[#22C55E] mb-3">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-[#0B0F17] mb-2">{title}</h3>
      <p className="text-[13px] text-[#556070] leading-relaxed">{description}</p>
    </div>
  );
}

function StepItem({ number, title, description, isLast = false }: { number: number; title: string; description: string; isLast?: boolean }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 bg-[#12B8C4] rounded-full flex items-center justify-center text-white text-[14px] font-semibold flex-shrink-0">
          {number}
        </div>
        {!isLast && <div className="w-px h-8 bg-[#E6E8EC]" />}
      </div>
      <div className={isLast ? "pb-0" : "pb-4"}>
        <h4 className="text-[15px] font-semibold text-[#0B0F17]">{title}</h4>
        <p className="text-[14px] text-[#556070]">{description}</p>
      </div>
    </div>
  );
}
