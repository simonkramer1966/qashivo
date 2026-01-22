import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";
import overviewScreenshot from "@assets/Screenshot_2026-01-20_at_16.41.29_1768927459381.png";

type Stage = "signup" | "scorecard" | "results";

interface Answer {
  questionKey: string;
  score: number;
  comment?: string;
}

interface CategoryResult {
  id: string;
  name: string;
  description: string;
  score: number;
  maxScore: number;
  questions: {
    key: string;
    text: string;
    score: number;
    comment: string | null;
  }[];
}

interface ScorecardResult {
  prospect: {
    firstName: string;
    lastName: string;
    email: string;
    companyName: string;
  };
  submission: {
    id: string;
    totalScore: number;
    band: string;
    bandLabel: string;
    bandColor: string;
    bandDescription: string;
    nextSteps: string[];
    categoryScores: Record<string, number>;
  };
  categories: CategoryResult[];
}

const CATEGORIES = [
  {
    id: "C1",
    name: "Client Fit & Pain",
    description: "Understanding your clients' receivables challenges",
    questions: [
      { key: "C1_Q1", text: "Do a meaningful portion of your SME clients experience late payment that materially impacts cashflow?" },
      { key: "C1_Q2", text: "Do clients frequently ask you for forward-looking cash visibility (not just aged debt reports)?" },
      { key: "C1_Q3", text: "Are you currently exposed to \"credit control drift\" (no one owns it; it's ad hoc, spreadsheet/inbox driven)?" },
      { key: "C1_Q4", text: "Do you have clients where a small number of overdue invoices represents a large share of working capital risk?" },
    ],
  },
  {
    id: "C2",
    name: "Delivery Leverage",
    description: "Non-linear headcount potential",
    questions: [
      { key: "C2_Q1", text: "Could one person in your firm realistically supervise (not manually run) receivables activity across multiple SME clients if the system handled the routine work?" },
      { key: "C2_Q2", text: "Is your current approach linear (more clients = more chasing time) and therefore hard to monetise?" },
      { key: "C2_Q3", text: "Would it be valuable if most routine follow-ups were executed consistently, while only exceptions surfaced for judgement?" },
      { key: "C2_Q4", text: "Do you already have (or could you nominate) a light \"credit control owner\" who can run a daily/weekly cadence?" },
    ],
  },
  {
    id: "C3",
    name: "Trust, Controls & Risk",
    description: "Supervised autonomy requirements",
    questions: [
      { key: "C3_Q1", text: "Would your firm be more comfortable if nothing is sent without human approval (bulk approve included)?" },
      { key: "C3_Q2", text: "Do you need an auditable trail of who approved what, when, and why (for internal QA and client reassurance)?" },
      { key: "C3_Q3", text: "Do you avoid offering credit control today because it feels \"too operational / too risky / too messy\"?" },
      { key: "C3_Q4", text: "Would you only roll this out if the system stops automation immediately on disputes and flags payment-plan requests for review?" },
    ],
  },
  {
    id: "C4",
    name: "Cashflow Forecast Value",
    description: "Intent-aware visibility potential",
    questions: [
      { key: "C4_Q1", text: "Would your clients pay for a cash view based on real debtor intent (promised / delayed / disputed / silent), not just invoice aging?" },
      { key: "C4_Q2", text: "Do you currently make forecasts using averages/assumptions because you don't reliably capture outcomes from debtor conversations?" },
      { key: "C4_Q3", text: "Would it improve your advisory value if the forecast updated automatically as customers reply with dates or issues?" },
      { key: "C4_Q4", text: "Would you like to offer \"cashflow confidence\" as a recurring service (monthly) rather than a one-off exercise?" },
    ],
  },
  {
    id: "C5",
    name: "Commercial Readiness",
    description: "Add-on revenue without headcount",
    questions: [
      { key: "C5_Q1", text: "Do you have a packaging motion today (e.g., tiers / bundles) that you could extend with a receivables + cashflow add-on?" },
      { key: "C5_Q2", text: "Would a per-SME subscription that you can resell/roll out across your portfolio fit your commercial model?" },
      { key: "C5_Q3", text: "Could you confidently describe receivables + cashflow visibility as a monthly managed service deliverable, rather than \"ad hoc chasing\"?" },
      { key: "C5_Q4", text: "Do you believe your best path to growth is recurring revenue that expands across your client base rather than hiring more delivery staff?" },
    ],
  },
];

const SCORE_LABELS = [
  { value: 1, label: "Not true" },
  { value: 2, label: "Rarely" },
  { value: 3, label: "Mixed" },
  { value: 4, label: "Often" },
  { value: 5, label: "True & repeatable" },
];

export default function PartnerScorecard() {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>("signup");
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(CATEGORIES.map(c => c.id));
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ScorecardResult | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    jobTitle: "",
  });
  const [enlargedImage, setEnlargedImage] = useState<{ src: string; alt: string } | null>(null);

  const signupMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/prospect/signup", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setProspectId(data.prospectId);
        setStage("scorecard");
      } else {
        toast({ title: "Error", description: data.error || "Failed to sign up", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
    },
  });

  const scorecardMutation = useMutation({
    mutationFn: async (answerData: Answer[]) => {
      const response = await apiRequest("POST", `/api/prospect/${prospectId}/scorecard`, { answers: answerData });
      return response.json();
    },
    onSuccess: async (data) => {
      if (data.success) {
        const resultResponse = await fetch(`/api/prospect/${prospectId}/scorecard/result`);
        const resultData = await resultResponse.json();
        if (resultData.success) {
          setResult(resultData.result);
          setStage("results");
        }
      } else {
        toast({ title: "Error", description: data.error || "Failed to submit scorecard", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit scorecard. Please try again.", variant: "destructive" });
    },
  });

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.companyName) {
      toast({ title: "Required fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    signupMutation.mutate(formData);
  };

  const handleScorecardSubmit = () => {
    const answerArray: Answer[] = Object.entries(answers).map(([questionKey, score]) => ({
      questionKey,
      score,
    }));
    
    const allQuestionKeys = CATEGORIES.flatMap(c => c.questions.map(q => q.key));
    const missingAnswers = allQuestionKeys.filter(key => !answers[key]);
    
    if (missingAnswers.length > 0) {
      toast({ 
        title: "Incomplete", 
        description: `Please answer all questions. ${missingAnswers.length} remaining.`, 
        variant: "destructive" 
      });
      return;
    }
    
    scorecardMutation.mutate(answerArray);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const setAnswer = (questionKey: string, score: number) => {
    setAnswers(prev => ({ ...prev, [questionKey]: score }));
  };

  const totalAnswered = Object.keys(answers).length;
  const totalQuestions = CATEGORIES.reduce((sum, c) => sum + c.questions.length, 0);
  const currentScore = Object.values(answers).reduce((sum, s) => sum + s, 0);

  return (
    <div className="min-h-screen bg-[#FBFBFC]">
      {stage === "signup" && (
        <>
          <section className="pt-16 pb-20 md:pt-24 md:pb-28">
            <div className="max-w-[1200px] mx-auto px-6">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                <div className="order-2 lg:order-1">
                  <div className="bg-[#F0F2F5] rounded-2xl p-3">
                    <img 
                      src={overviewScreenshot} 
                      alt="Qashivo Dashboard" 
                      className="w-full rounded-xl border border-[#E6E8EC] cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setEnlargedImage({ src: overviewScreenshot, alt: "Qashivo Dashboard" })}
                    />
                  </div>
                </div>
                
                <div className="order-1 lg:order-2">
                  <div className="flex items-center gap-2 mb-8">
                    <img src={logo} alt="Qashivo" className="h-8 w-8" />
                    <span className="font-semibold text-[#0B0F17] tracking-tight text-[22px]">Qashivo</span>
                  </div>
                  
                  <h1 className="text-[36px] md:text-[44px] font-semibold text-[#0B0F17] leading-[1.1] tracking-[-0.02em] mb-4">
                    Find out if you're leaving revenue on the table
                  </h1>
                  <p className="text-[17px] text-[#556070] leading-[1.55] mb-8">
                    Take our 5-minute Partner Opportunity Scorecard to see how much recurring revenue potential your practice has in receivables and cashflow advisory.
                  </p>
                  
                  <form onSubmit={handleSignupSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName" className="text-[14px] text-[#0B0F17] font-medium">First name *</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                          className="mt-1.5 h-11 rounded-lg border-[#E6E8EC]"
                          placeholder="Jamie"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="text-[14px] text-[#0B0F17] font-medium">Last name *</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                          className="mt-1.5 h-11 rounded-lg border-[#E6E8EC]"
                          placeholder="Smith"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="email" className="text-[14px] text-[#0B0F17] font-medium">Work email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="mt-1.5 h-11 rounded-lg border-[#E6E8EC]"
                        placeholder="jamie@yourfirm.com"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="companyName" className="text-[14px] text-[#0B0F17] font-medium">Firm name *</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        className="mt-1.5 h-11 rounded-lg border-[#E6E8EC]"
                        placeholder="Acme Accounting"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone" className="text-[14px] text-[#0B0F17] font-medium">Phone</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          className="mt-1.5 h-11 rounded-lg border-[#E6E8EC]"
                          placeholder="+44 7700 900000"
                        />
                      </div>
                      <div>
                        <Label htmlFor="jobTitle" className="text-[14px] text-[#0B0F17] font-medium">Job title</Label>
                        <Input
                          id="jobTitle"
                          value={formData.jobTitle}
                          onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                          className="mt-1.5 h-11 rounded-lg border-[#E6E8EC]"
                          placeholder="Partner"
                        />
                      </div>
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={signupMutation.isPending}
                      className="w-full bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 rounded-xl text-[16px] font-medium mt-2"
                    >
                      {signupMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                      ) : (
                        <>Start scorecard <ArrowRight className="ml-2 h-4 w-4" /></>
                      )}
                    </Button>
                    
                    <p className="text-[13px] text-[#556070] text-center">
                      Takes about 5 minutes. Your results are private.
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </section>
          
          <section className="py-16 border-t border-[#E6E8EC] bg-white">
            <div className="max-w-[1200px] mx-auto px-6">
              <h2 className="text-[24px] font-semibold text-[#0B0F17] text-center mb-12">What you'll discover</h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-[#12B8C4]/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-[18px] font-semibold text-[#12B8C4]">1</span>
                  </div>
                  <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">Your opportunity score</h3>
                  <p className="text-[15px] text-[#556070]">A clear number showing how much revenue potential exists in your practice</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-[#12B8C4]/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-[18px] font-semibold text-[#12B8C4]">2</span>
                  </div>
                  <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">Category breakdown</h3>
                  <p className="text-[15px] text-[#556070]">See where you're strongest and where the biggest gains lie</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-[#12B8C4]/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-[18px] font-semibold text-[#12B8C4]">3</span>
                  </div>
                  <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">Recommended next steps</h3>
                  <p className="text-[15px] text-[#556070]">Actionable guidance tailored to your specific situation</p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {stage === "scorecard" && (
        <section className="py-12 md:py-16">
          <div className="max-w-[800px] mx-auto px-6">
            <div className="flex items-center gap-2 mb-8">
              <img src={logo} alt="Qashivo" className="h-7 w-7" />
              <span className="font-semibold text-[#0B0F17] tracking-tight text-[18px]">Qashivo</span>
            </div>
            
            <h1 className="text-[28px] md:text-[32px] font-semibold text-[#0B0F17] leading-[1.15] mb-3">
              Partner Opportunity Scorecard
            </h1>
            <p className="text-[16px] text-[#556070] mb-8">
              Rate each statement from 1 (not true) to 5 (true and repeatable). Be honest - the more accurate your answers, the more useful your results.
            </p>
            
            <div className="space-y-4 pb-24">
              {CATEGORIES.map((category) => (
                <div key={category.id} className="bg-white rounded-xl border border-[#E6E8EC] overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="text-left">
                      <h3 className="text-[16px] font-semibold text-[#0B0F17]">{category.name}</h3>
                      <p className="text-[13px] text-[#556070]">{category.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] text-[#556070]">
                        {category.questions.filter(q => answers[q.key]).length}/{category.questions.length}
                      </span>
                      {expandedCategories.includes(category.id) ? (
                        <ChevronUp className="w-5 h-5 text-[#556070]" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[#556070]" />
                      )}
                    </div>
                  </button>
                  
                  {expandedCategories.includes(category.id) && (
                    <div className="px-5 pb-5 space-y-5 border-t border-[#E6E8EC]">
                      {category.questions.map((question, qIndex) => (
                        <div key={question.key} className="pt-5">
                          <p className="text-[15px] text-[#0B0F17] mb-4 leading-[1.5]">
                            <span className="font-medium text-[#556070] mr-2">{qIndex + 1}.</span>
                            {question.text}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {SCORE_LABELS.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => setAnswer(question.key, option.value)}
                                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                                  answers[question.key] === option.value
                                    ? "bg-[#12B8C4] text-white"
                                    : "bg-[#F0F2F5] text-[#556070] hover:bg-[#E6E8EC]"
                                }`}
                              >
                                {option.value}: {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E6E8EC] px-6 py-4">
              <div className="max-w-[800px] mx-auto flex items-center justify-between">
                <div>
                  <p className="text-[14px] text-[#556070]">
                    {totalAnswered}/{totalQuestions} answered
                  </p>
                  {totalAnswered === totalQuestions && (
                    <p className="text-[13px] text-[#12B8C4]">
                      Current score: {currentScore}/100
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleScorecardSubmit}
                  disabled={scorecardMutation.isPending || totalAnswered < totalQuestions}
                  className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 px-6 rounded-xl text-[15px] font-medium"
                >
                  {scorecardMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating...</>
                  ) : (
                    <>Get my results <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {stage === "results" && result && (
        <section className="py-12 md:py-16">
          <div className="max-w-[800px] mx-auto px-6">
            <div className="flex items-center gap-2 mb-8">
              <img src={logo} alt="Qashivo" className="h-7 w-7" />
              <span className="font-semibold text-[#0B0F17] tracking-tight text-[18px]">Qashivo</span>
            </div>
            
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8 mb-8">
              <div className="text-center mb-8">
                <p className="text-[14px] text-[#556070] mb-2">Your opportunity score</p>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <span className="text-[64px] font-bold" style={{ color: result.submission.bandColor }}>
                    {result.submission.totalScore}
                  </span>
                  <span className="text-[24px] text-[#94A3B8]">/100</span>
                </div>
                <div 
                  className="inline-block px-4 py-2 rounded-full text-[15px] font-medium"
                  style={{ backgroundColor: `${result.submission.bandColor}20`, color: result.submission.bandColor }}
                >
                  {result.submission.bandLabel}
                </div>
              </div>
              
              <div className="border-t border-[#E6E8EC] pt-6">
                <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">What this suggests</h3>
                <p className="text-[16px] text-[#556070] leading-[1.6]">
                  {result.submission.bandDescription}
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8 mb-8">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-6">Category breakdown</h3>
              <div className="space-y-4">
                {result.categories.map((category) => {
                  const percentage = (category.score / category.maxScore) * 100;
                  return (
                    <div key={category.id}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[14px] font-medium text-[#0B0F17]">{category.name}</span>
                        <span className="text-[14px] text-[#556070]">{category.score}/{category.maxScore}</span>
                      </div>
                      <div className="h-2 bg-[#F0F2F5] rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: percentage >= 75 ? '#17B6C3' : percentage >= 50 ? '#22C55E' : percentage >= 25 ? '#F59E0B' : '#94A3B8'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8 mb-8">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-4">Recommended next steps</h3>
              <ul className="space-y-3">
                {result.submission.nextSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                    <span className="text-[15px] text-[#556070]">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-[#12B8C4]/5 rounded-2xl p-8 text-center">
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Ready to explore further?</h3>
              <p className="text-[15px] text-[#556070] mb-6 max-w-[500px] mx-auto">
                Book a call with our partnership team to discuss how Qashivo can help you build a receivables advisory service.
              </p>
              <Button
                onClick={() => window.location.href = '/contact'}
                className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-8 rounded-xl text-[16px] font-medium"
              >
                Book a call <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            
            <p className="text-[13px] text-[#556070] text-center mt-8">
              A confirmation email with your results has been sent to {result.prospect.email}
            </p>
          </div>
        </section>
      )}
      
      <footer className="py-8 border-t border-[#E6E8EC] bg-white mt-auto">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Qashivo" className="h-6 w-6" />
              <span className="text-[14px] font-medium text-[#0B0F17]">Qashivo</span>
            </div>
            <p className="text-[13px] text-[#556070]">
              © 2026 Nexus KPI Limited. Built in London. Backed by innovation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-0 bg-transparent shadow-none">
          {enlargedImage && (
            <img 
              src={enlargedImage.src} 
              alt={enlargedImage.alt}
              className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
