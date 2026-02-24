import { useState, useEffect, useRef } from "react";
import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mic, Play, MessageSquare, Brain, Shield, ArrowRight, Phone, Volume2, CheckCircle, Sparkles, PhoneOff } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Oscilloscope } from "@/components/Oscilloscope";

const sanitizePhoneNumber = (phone: string, countryCode: string): string => {
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  const countryCodeDigits = countryCode.replace(/^\+/, '');
  if (cleaned.startsWith(countryCodeDigits)) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return `${countryCode}${cleaned}`;
};

const COUNTRY_CODES = [
  { value: "+44", label: "🇬🇧 UK (+44)" },
  { value: "+1", label: "🇺🇸 US/Canada (+1)" },
  { value: "+91", label: "🇮🇳 India (+91)" },
  { value: "+61", label: "🇦🇺 Australia (+61)" },
  { value: "+49", label: "🇩🇪 Germany (+49)" },
  { value: "+33", label: "🇫🇷 France (+33)" },
  { value: "+34", label: "🇪🇸 Spain (+34)" },
  { value: "+39", label: "🇮🇹 Italy (+39)" },
];

export default function VoiceDemoPage() {
  const { toast } = useToast();
  const [leadId, setLeadId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [voicePhone, setVoicePhone] = useState("");
  const [voiceCountryCode, setVoiceCountryCode] = useState("+44");
  const [demoResults, setDemoResults] = useState<any>(null);
  const [currentResults, setCurrentResults] = useState<any>(null);
  const [voiceProgress, setVoiceProgress] = useState<string>("");
  const [isDemoProcessing, setIsDemoProcessing] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const lastShownResultsRef = useRef<string>("");
  const lastShownAtRef = useRef<number>(0);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTransitioningRef = useRef(false);
  const callStatusPollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!leadId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/investor-demo?leadId=${leadId}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'demo_results') {
          setDemoResults(message.data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/investor/lead/${leadId}/results`);
        if (response.ok) {
          const results = await response.json();
          setDemoResults(results);
        }
      } catch (error) {
        console.error("Error polling results:", error);
      }
    }, 1500);

    return () => {
      ws.close();
      clearInterval(pollInterval);
    };
  }, [leadId]);

  useEffect(() => {
    if (!activeCallId || !leadId) return;

    const pollCallStatus = async () => {
      try {
        const response = await fetch(`/api/investor/call-status/${activeCallId}?leadId=${leadId}`);
        if (!response.ok) return;
        const data = await response.json();
        if (data.isEnded) {
          setActiveCallId(null);
          if (callStatusPollRef.current) {
            clearInterval(callStatusPollRef.current);
            callStatusPollRef.current = null;
          }
        }
      } catch (error) {
        console.error('Error polling call status:', error);
      }
    };

    callStatusPollRef.current = setInterval(pollCallStatus, 3000);
    pollCallStatus();

    return () => {
      if (callStatusPollRef.current) {
        clearInterval(callStatusPollRef.current);
        callStatusPollRef.current = null;
      }
    };
  }, [activeCallId, leadId]);

  const updateVoiceResults = (results: any, resultKey: string, analyzedAt: number) => {
    setCurrentResults(results);
    setVoiceProgress("");
    setIsDemoProcessing(false);
    lastShownResultsRef.current = resultKey;
    lastShownAtRef.current = analyzedAt;
    isTransitioningRef.current = false;

    toast({
      title: "AI Analysis Complete",
      description: "View the results in the panel",
    });
  };

  useEffect(() => {
    if (!demoResults) return;
    if (isTransitioningRef.current) return;

    if (demoResults.voiceDemoCompleted && demoResults.voiceDemoResults) {
      let analyzedAtMs = demoResults.voiceDemoResults.analyzedAt
        ? new Date(demoResults.voiceDemoResults.analyzedAt).getTime()
        : Date.now();
      if (!Number.isFinite(analyzedAtMs)) {
        analyzedAtMs = Date.now();
      }
      const resultKey = `voice-${analyzedAtMs}`;

      if (analyzedAtMs > lastShownAtRef.current && lastShownResultsRef.current !== resultKey) {
        updateVoiceResults(demoResults.voiceDemoResults, resultKey, analyzedAtMs);
      }
    }

    return () => {
      if (transitionTimeoutRef.current && !isTransitioningRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, [demoResults, toast]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      isTransitioningRef.current = false;
    };
  }, []);

  const handleVoiceDemo = async () => {
    if (!voicePhone) return;

    setVoiceProgress("Initiating...");
    setIsDemoProcessing(true);

    try {
      const sanitizedPhone = sanitizePhoneNumber(voicePhone, voiceCountryCode);

      setTimeout(() => setVoiceProgress("Connecting..."), 400);

      let currentLeadId = leadId;
      const operations = [];

      if (!currentLeadId) {
        const leadPromise = fetch("/api/investor/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: voiceName || "Anonymous Investor",
            email: `demo-${Date.now()}@investor.demo`
          }),
        }).then(async (res) => {
          if (!res.ok) throw new Error("Failed to create lead");
          const lead = await res.json();
          currentLeadId = lead.id;
          setLeadId(lead.id);
          return lead.id;
        });
        operations.push(leadPromise);
      } else {
        operations.push(Promise.resolve(currentLeadId));
      }

      const [resolvedLeadId] = await Promise.all(operations);

      setTimeout(() => setVoiceProgress("In progress..."), 800);

      const response = await fetch("/api/investor/voice-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: resolvedLeadId, phone: sanitizedPhone, name: voiceName }),
      });

      if (!response.ok) throw new Error("Failed to initiate call");

      const callData = await response.json();
      const callId = callData.callId;

      if (callId) {
        setActiveCallId(callId);
      }

      lastShownAtRef.current = 0;
      lastShownResultsRef.current = "";
      setCurrentResults(null);

      toast({
        title: "AI Voice Call Started",
        description: "You'll receive a call shortly...",
      });
    } catch (error) {
      setVoiceProgress("");
      setIsDemoProcessing(false);
      toast({
        title: "Error",
        description: "Failed to initiate call. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      <section className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#17B6C3]/10 rounded-full mb-8">
              <Mic className="w-4 h-4 text-[#17B6C3]" />
              <span className="text-[#17B6C3] font-medium text-sm">Supervised AI Voice</span>
            </div>
            <h1 className="text-[44px] font-semibold text-[#0B0F17] mb-4">
              Meet your AI Credit Controller
            </h1>
            <p className="text-[18px] text-[#556070] max-w-2xl mx-auto mb-4">
              Try Qashivo, the real-time AI credit controller. Receive an automated collections call and see intent, sentiment, and payment commitment detected live.
            </p>
            <p className="text-[18px] text-[#0B0F17] font-semibold">
              Always on. Never calls in sick. Never forgets. Always follows up.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8 items-stretch">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-[#17B6C3]/10 rounded-xl">
                  <Phone className="w-6 h-6 text-[#17B6C3]" />
                </div>
                <div>
                  <h3 className="text-[24px] font-semibold text-[#0B0F17]">AI Credit Controller Demo</h3>
                  <p className="text-[14px] text-[#556070]">Real-time intent detection</p>
                </div>
              </div>
              <p className="text-[15px] text-[#556070] leading-relaxed mb-6">
                Receive an automated credit control call and see how Qashivo detects intent, sentiment, and payment commitment in real time &mdash; then generates an accurate transcript and ready-to-use call notes.
              </p>
              <div className="space-y-4">
                <div>
                  <Label className="text-[#0B0F17] font-medium text-[14px]">Your Name</Label>
                  <Input
                    type="text"
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    placeholder="John Smith"
                    className="mt-1 bg-white border-[#E6E8EC]"
                  />
                </div>
                <div>
                  <Label className="text-[#0B0F17] font-medium text-[14px]">Your Phone Number</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={voiceCountryCode} onValueChange={setVoiceCountryCode}>
                      <SelectTrigger className="w-[160px] bg-white border-[#E6E8EC]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="tel"
                      value={voicePhone}
                      onChange={(e) => setVoicePhone(e.target.value)}
                      placeholder="07715 254857"
                      className="flex-1 bg-white border-[#E6E8EC]"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleVoiceDemo}
                  disabled={!voicePhone || isDemoProcessing}
                  className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white text-[16px] h-12 rounded-lg font-medium"
                >
                  {isDemoProcessing ? (
                    <>
                      <div className="w-5 h-5 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Call in Progress...
                    </>
                  ) : (
                    <>
                      <Phone className="w-5 h-5 mr-2" />
                      Call Me Now
                    </>
                  )}
                </Button>
                <p className="text-[13px] text-[#556070] text-center">
                  You'll receive a call from +1 (586) 244-8999
                </p>
              </div>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 bg-[#17B6C3]/10 rounded-xl ${isDemoProcessing ? 'animate-pulse' : ''}`}>
                  <Sparkles className="w-6 h-6 text-[#17B6C3]" />
                </div>
                <div>
                  <h3 className="text-[24px] font-semibold text-[#0B0F17]">
                    {isDemoProcessing ? "AI Credit Control Insights - In Progress" : "AI Credit Control Insights"}
                  </h3>
                  <p className="text-[14px] text-[#556070]">Voice Call Intelligence Report</p>
                </div>
              </div>

              <div className="relative h-20 mb-6 rounded-xl bg-[#0B0F17] border border-white/10 overflow-hidden">
                <Oscilloscope isActive={isDemoProcessing} />
                {isDemoProcessing && voiceProgress && (
                  <div className="absolute bottom-2 left-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#17B6C3] animate-pulse" />
                    <span className="text-xs text-[#17B6C3] font-medium">{voiceProgress}</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {!currentResults && !isDemoProcessing && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-[#E6E8EC]/50 rounded-full flex items-center justify-center mb-4">
                      <Phone className="w-8 h-8 text-[#556070]" />
                    </div>
                    <p className="text-[#0B0F17] text-lg font-medium mb-2">Ready to Analyze</p>
                    <p className="text-[#556070] text-sm max-w-[280px]">
                      Enter your details and start a call to see real-time AI analysis
                    </p>
                  </div>
                )}

                {isDemoProcessing && !currentResults && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-16 h-16 bg-[#17B6C3]/15 rounded-full flex items-center justify-center mb-4 animate-pulse">
                      <Brain className="w-8 h-8 text-[#17B6C3]" />
                    </div>
                    <p className="text-[#0B0F17] text-lg font-medium mb-2">Listening & Analyzing</p>
                    <p className="text-[#556070] text-sm">
                      Our AI is processing your conversation in real-time...
                    </p>
                  </div>
                )}

                {currentResults && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {currentResults.terminatedByCustomer && (
                      <div className="p-3 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg">
                        <div className="flex items-start gap-2">
                          <PhoneOff className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-orange-700">Call Terminated by Customer</p>
                            <p className="text-xs text-orange-600/80">Follow-up call recommended</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-white border border-[#E6E8EC] rounded-xl">
                        <p className="text-xs text-[#556070] uppercase tracking-wide mb-1">Intent</p>
                        <p className="text-sm font-bold text-[#0B0F17] capitalize">
                          {currentResults.intent?.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className={`p-3 border rounded-xl ${
                        currentResults.sentiment === 'positive' ? 'bg-green-50 border-green-200 text-green-700' :
                        currentResults.sentiment === 'cooperative' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                        currentResults.sentiment === 'negative' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                        'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        <p className="text-xs uppercase tracking-wide mb-1 opacity-80">Sentiment</p>
                        <p className="text-sm font-bold capitalize">{currentResults.sentiment}</p>
                      </div>
                      <div className="p-3 bg-white border border-[#E6E8EC] rounded-xl">
                        <p className="text-xs text-[#556070] uppercase tracking-wide mb-1">Confidence</p>
                        <p className={`text-sm font-bold ${
                          (currentResults.confidence || 0) >= 80 ? 'text-green-600' :
                          (currentResults.confidence || 0) >= 60 ? 'text-blue-600' : 'text-orange-600'
                        }`}>
                          {currentResults.confidence}%
                        </p>
                      </div>
                    </div>

                    {currentResults.summary && (
                      <div className="p-3 bg-[#17B6C3]/5 border-l-4 border-[#17B6C3] rounded-r-lg">
                        <p className="text-xs font-semibold text-[#17B6C3] mb-1 uppercase tracking-wide">Summary</p>
                        <p className="text-sm text-[#0B0F17] leading-relaxed">{currentResults.summary}</p>
                      </div>
                    )}

                    {currentResults.keyInsights && currentResults.keyInsights.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[#556070] uppercase tracking-wide flex items-center gap-2">
                          <Brain className="w-3 h-3 text-[#17B6C3]" />
                          Key Insights
                        </p>
                        <div className="space-y-1.5">
                          {currentResults.keyInsights.slice(0, 3).map((insight: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 p-2 bg-white border border-[#E6E8EC] rounded-lg">
                              <div className="w-5 h-5 rounded-full bg-[#17B6C3]/15 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-[#17B6C3]">{idx + 1}</span>
                              </div>
                              <p className="text-xs text-[#556070] leading-relaxed">{insight}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentResults.transcript && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[#556070] uppercase tracking-wide flex items-center gap-2">
                          <MessageSquare className="w-3 h-3 text-[#17B6C3]" />
                          Transcript
                        </p>
                        <div className="p-3 bg-[#0B0F17] border border-[#E6E8EC] rounded-xl max-h-24 overflow-y-auto">
                          <p className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                            {currentResults.transcript}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-2 pt-2">
                      <Badge variant="outline" className="bg-[#17B6C3]/10 border-[#17B6C3]/30 text-[#17B6C3] text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Powered by Qashivo AI
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Why voice matters for credit control
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Most credit control happens over email. But the highest-value interactions&mdash;the ones that actually resolve invoices&mdash;happen on the phone.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Phone className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Real conversations</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                AI conducts natural, contextual phone calls with debtors. Each call is personalised based on invoice history, previous outcomes, and debtor behaviour patterns.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Brain className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Intent extraction</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                The AI doesn't just transcribe&mdash;it interprets. Promises to pay, requests for time, disputes, and payment plans are captured as structured outcomes.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Shield className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Supervised deployment</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Voice is technically live but deployment is gated by trust, compliance, and partner adoption. Every call requires human approval. Escalation happens automatically.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] text-center mb-14">
            What happens during a voice call
          </h2>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-6">
              {[
                { step: "1", title: "Context loading", desc: "Before the call begins, the AI reviews the debtor's full history\u2014invoice details, previous promises, communication timeline, and behaviour score." },
                { step: "2", title: "Natural conversation", desc: "The AI conducts a warm, professional conversation. It can explain invoice details, discuss payment timelines, and respond to questions in real-time." },
                { step: "3", title: "Outcome capture", desc: "During and after the call, the system extracts structured outcomes: promise dates, dispute details, requests for payment plans, or escalation triggers." },
                { step: "4", title: "Follow-up generation", desc: "A personalised follow-up email is automatically generated and sent, confirming what was discussed and any commitments made." },
                { step: "5", title: "System update", desc: "The cashflow forecast updates immediately. If a promise was made, chasing pauses. If a dispute was raised, it escalates to a human." },
              ].map((item) => (
                <div key={item.step} className="flex gap-5">
                  <div className="w-10 h-10 bg-[#17B6C3] rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-white text-[16px] font-bold">{item.step}</span>
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#0B0F17] mb-1">{item.title}</h3>
                    <p className="text-[15px] text-[#556070] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] text-center mb-14">
            Voice as a compounding advantage
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="space-y-6">
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Voice outcomes compound system intelligence across all channels&mdash;not just phone</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Captures signals invisible to text: tone, hesitation, urgency, and genuine difficulty</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Increases recovery quality without linear headcount growth</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Improves both margins and predictability as scale increases</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Every call generates a personalised follow-up email automatically</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Full transcript and outcome audit trail for compliance</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Supervised deployment with human approval gates</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Respects tenant-specific channel cooldowns and touch limits</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-[16px] text-[#556070] mb-8">
            Questions about the voice capability? Our team is available to walk you through any aspect.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/investors/how-it-works">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                How It All Works
              </Button>
            </Link>
            <Link href="/investors/contact">
              <Button className="bg-[#17B6C3] hover:bg-[#139CA8] text-white h-12 px-7 rounded-lg text-[15px] font-medium">
                Get in Touch
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <InvestorFooter />
    </div>
  );
}
