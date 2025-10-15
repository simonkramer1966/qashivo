import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Phone, MessageSquare, TrendingUp, Shield, Zap, CheckCircle, Brain, Activity, ArrowRight, Clock, DollarSign, Users, BarChart3, Target, Rocket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SiXero, SiStripe, SiOpenai } from "react-icons/si";
import qashivoLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import dashboardScreenshot from "@assets/Screenshot 2025-10-13 at 13.19.17_1760519077630.png";
import investorDeckPdf from "@assets/Qashivo - Investor Deck_1760520688174.pdf";

export default function InvestorDemo() {
  const { toast } = useToast();
  const [leadData, setLeadData] = useState({ name: "", email: "" });
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [voicePhone, setVoicePhone] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [demoResults, setDemoResults] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!leadId) return;

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
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [leadId]);

  const handleLeadCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/investor/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadData),
      });
      
      if (!response.ok) throw new Error("Failed to capture lead");
      
      const lead = await response.json();
      setLeadId(lead.id);
      setLeadCaptured(true);
      
      toast({
        title: "Welcome!",
        description: "Scroll down to experience the AI demos",
      });
      
      setTimeout(() => {
        document.getElementById('demos')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceDemo = async () => {
    if (!leadId || !voicePhone) return;
    
    try {
      const response = await fetch("/api/investor/voice-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, phone: voicePhone }),
      });
      
      if (!response.ok) throw new Error("Failed to initiate call");
      
      toast({
        title: "Initiating AI Voice Call",
        description: "You'll receive a call in a few seconds...",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate call. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSMSDemo = async () => {
    if (!leadId || !smsPhone) return;
    
    try {
      const response = await fetch("/api/investor/sms-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, phone: smsPhone }),
      });
      
      if (!response.ok) throw new Error("Failed to send SMS");
      
      toast({
        title: "SMS Sent!",
        description: "Reply to experience AI intent detection",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send SMS. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={qashivoLogo} 
              alt="Qashivo Logo" 
              className="h-10 w-auto"
              data-testid="img-qashivo-logo"
            />
            <span className="text-2xl font-bold text-gray-900">Qashivo</span>
          </div>
          <Button 
            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
            data-testid="button-header-cta"
          >
            Schedule Investment Call
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-6 bg-gradient-to-br from-blue-50 via-white to-teal-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-4 py-2 bg-[#17B6C3]/10 rounded-full mb-6">
                <span className="text-[#17B6C3] font-semibold">SEIS-Eligible Investment Opportunity</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                AI That Turns Late Payments Into{" "}
                <span className="text-[#17B6C3]">Automated Cashflow</span>
              </h1>
              <p className="text-xl text-gray-600 mb-4 leading-relaxed">
                The UK's first AI-powered credit control platform built on statutory rights. 
                Transforming the £4.8B late payment crisis into predictable revenue.
              </p>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                <strong>We're not just automating credit control. We're creating a learning brain for SME finance.</strong>
              </p>
              
              <div className="flex gap-4">
                <Button 
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8 py-6"
                  onClick={() => document.getElementById('demos')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="button-try-demo"
                >
                  Try Live Demo <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl shadow-2xl flex items-center justify-center border border-gray-300">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#17B6C3] flex items-center justify-center">
                    <Zap className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-gray-700 font-semibold text-lg">AI Avatar Video</p>
                  <p className="text-gray-500 text-sm mt-1">Simon Kramer, Founder & CEO</p>
                </div>
              </div>
              
              <div className="absolute -bottom-8 -right-8 bg-white p-4 rounded-xl shadow-lg border border-gray-200" data-testid="card-revenue-target">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900" data-testid="text-revenue-amount">£7-14M</p>
                    <p className="text-sm text-gray-600">3-Year Revenue Target</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-12 px-6 border-y border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm text-gray-500 mb-6">POWERED BY ENTERPRISE-GRADE INTEGRATIONS</p>
          <div className="flex items-center justify-center gap-12 flex-wrap">
            <div className="flex items-center gap-2 text-gray-600">
              <SiXero className="w-8 h-8" />
              <span className="font-semibold">Xero</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <SiStripe className="w-8 h-8" />
              <span className="font-semibold">Stripe</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <SiOpenai className="w-8 h-8" />
              <span className="font-semibold">OpenAI</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <MessageSquare className="w-8 h-8" />
              <span className="font-semibold">Vonage</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="w-8 h-8" />
              <span className="font-semibold">Retell AI</span>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">The £2.8 Billion Problem</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Late payments are killing UK SMEs. Manual credit control is inefficient, non-compliant, and emotionally draining.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 border-2 border-red-200 bg-red-50" data-testid="card-problem-cost">
              <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-problem-amount">£2.8B Lost</h3>
              <p className="text-gray-600 mb-4">Annual cost to UK SMEs from late payments</p>
              <div className="text-4xl font-bold text-red-600" data-testid="text-failures-count">50,000</div>
              <p className="text-sm text-gray-500">Businesses fail each year</p>
            </Card>

            <Card className="p-8 border-2 border-orange-200 bg-orange-50" data-testid="card-problem-dso">
              <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-dso-days">64 Days</h3>
              <p className="text-gray-600 mb-4">Average DSO for UK SMEs</p>
              <div className="text-4xl font-bold text-orange-600" data-testid="text-payment-multiplier">2x</div>
              <p className="text-sm text-gray-500">Payment terms exceeded</p>
            </Card>

            <Card className="p-8 border-2 border-yellow-200 bg-yellow-50" data-testid="card-problem-compliance">
              <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-compliance-rate">100% Must Comply</h3>
              <p className="text-gray-600 mb-4">Late Payment Act becomes mandatory</p>
              <div className="text-4xl font-bold text-yellow-600" data-testid="text-solutions-count">0</div>
              <p className="text-sm text-gray-500">Current compliant solutions</p>
            </Card>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className="py-24 px-6 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">The Qashivo Solution</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              AI-powered credit control that combines behavioural intelligence, statutory compliance, and multi-channel automation
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
            <div>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#17B6C3] rounded-lg flex items-center justify-center">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">AI Intent Detection</h3>
                    <p className="text-gray-600">
                      Every call, email, and SMS is analyzed in real-time. Our AI detects payment intent, 
                      sentiment, and automatically creates next actions.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#17B6C3] rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Intelligent Forecasting</h3>
                    <p className="text-gray-600">
                      ARD-based sales conversion with irregular buffer smoothing. Know exactly when 
                      you'll get paid with 95% accuracy.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#17B6C3] rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Statutory Compliance</h3>
                    <p className="text-gray-600">
                      Built on the Late Payment Act. Automated interest calculations, debt recovery 
                      notices, and legal escalation pathways.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
              <div className="rounded-lg overflow-hidden mb-4">
                <img 
                  src={dashboardScreenshot} 
                  alt="Qashivo Dashboard - Intelligent Forecast View" 
                  className="w-full h-auto"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg" data-testid="card-solution-accuracy">
                  <p className="text-2xl font-bold text-green-600" data-testid="text-accuracy-rate">95%</p>
                  <p className="text-xs text-gray-600">Forecast Accuracy</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg" data-testid="card-solution-dso">
                  <p className="text-2xl font-bold text-blue-600" data-testid="text-dso-reduction">-40%</p>
                  <p className="text-xs text-gray-600">DSO Reduction</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg" data-testid="card-solution-time">
                  <p className="text-2xl font-bold text-purple-600" data-testid="text-time-saved">85%</p>
                  <p className="text-xs text-gray-600">Time Saved</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live AI Demos */}
      <section id="demos" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-purple-100 rounded-full mb-4">
              <span className="text-purple-700 font-semibold">LIVE DEMONSTRATION</span>
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Experience the AI in Real-Time</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See how Qashivo's AI analyzes every customer interaction and extracts actionable intelligence
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
              {/* Voice Demo */}
              <Card className="p-8 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-purple-600 rounded-xl">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">AI Voice Call</h3>
                    <p className="text-sm text-gray-600">Real-time intent detection</p>
                  </div>
                </div>
                <p className="text-gray-700 mb-6">
                  Receive an AI-powered collection call. Our AI analyzes your responses in real-time, 
                  detecting intent, sentiment, and commitment to pay.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-700 font-medium">Your Phone Number</Label>
                    <Input
                      type="tel"
                      value={voicePhone}
                      onChange={(e) => setVoicePhone(e.target.value)}
                      placeholder="+44 7700 900123"
                      className="mt-1 bg-white border-gray-300"
                      data-testid="input-voice-phone"
                    />
                  </div>
                  <Button
                    onClick={handleVoiceDemo}
                    disabled={!voicePhone}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white text-lg py-6"
                    data-testid="button-start-voice-demo"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Call Me Now
                  </Button>
                </div>
              </Card>

              {/* SMS Demo */}
              <Card className="p-8 border-2 border-green-200 bg-gradient-to-br from-green-50 to-teal-50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-green-600 rounded-xl">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">AI SMS Analysis</h3>
                    <p className="text-sm text-gray-600">Intelligent text processing</p>
                  </div>
                </div>
                <p className="text-gray-700 mb-6">
                  Reply to our SMS and watch our AI instantly extract payment intent, sentiment, 
                  and recommended next actions from your message.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-700 font-medium">Your Phone Number</Label>
                    <Input
                      type="tel"
                      value={smsPhone}
                      onChange={(e) => setSmsPhone(e.target.value)}
                      placeholder="+44 7700 900123"
                      className="mt-1 bg-white border-gray-300"
                      data-testid="input-sms-phone"
                    />
                  </div>
                  <Button
                    onClick={handleSMSDemo}
                    disabled={!smsPhone}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
                    data-testid="button-start-sms-demo"
                  >
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Send SMS Now
                  </Button>
                  <p className="text-sm text-gray-600 text-center">
                    You'll receive an SMS from +44 7418 317011
                  </p>
                </div>
              </Card>
            </div>

          {/* Demo Results */}
          {demoResults && (demoResults.voiceDemoCompleted || demoResults.smsDemoCompleted) && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full mb-4">
                  <Activity className="w-5 h-5" />
                  <span className="font-semibold">Real-Time AI Analysis Complete</span>
                </div>
              </div>

              {/* Voice Results */}
              {demoResults.voiceDemoCompleted && demoResults.voiceDemoResults && (
                <Card className="p-8 border-2 border-purple-300 bg-white" data-testid="card-voice-results">
                  <div className="flex items-center gap-3 mb-6">
                    <Phone className="w-8 h-8 text-purple-600" />
                    <h4 className="text-2xl font-bold text-gray-900">Voice Call Analysis</h4>
                  </div>
                  <div className="grid md:grid-cols-3 gap-6 mb-6">
                    <div className="p-4 bg-purple-50 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Intent Detected</p>
                      <p className="text-2xl font-bold text-purple-900 capitalize" data-testid="text-voice-intent">
                        {demoResults.voiceDemoResults.intent}
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Sentiment</p>
                      <p className="text-2xl font-bold text-blue-900 capitalize" data-testid="text-voice-sentiment">
                        {demoResults.voiceDemoResults.sentiment}
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Confidence</p>
                      <p className="text-2xl font-bold text-green-900" data-testid="text-voice-confidence">
                        {demoResults.voiceDemoResults.confidence}%
                      </p>
                    </div>
                  </div>
                  {demoResults.voiceDemoResults.transcript && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Conversation Transcript</p>
                      <p className="text-gray-600">{demoResults.voiceDemoResults.transcript}</p>
                    </div>
                  )}
                </Card>
              )}

              {/* SMS Results */}
              {demoResults.smsDemoCompleted && demoResults.smsDemoResults && (
                <Card className="p-8 border-2 border-green-300 bg-white" data-testid="card-sms-results">
                  <div className="flex items-center gap-3 mb-6">
                    <MessageSquare className="w-8 h-8 text-green-600" />
                    <h4 className="text-2xl font-bold text-gray-900">SMS Response Analysis</h4>
                  </div>
                  <div className="grid md:grid-cols-3 gap-6 mb-6">
                    <div className="p-4 bg-green-50 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Intent Detected</p>
                      <p className="text-2xl font-bold text-green-900 capitalize" data-testid="text-sms-intent">
                        {demoResults.smsDemoResults.intent}
                      </p>
                    </div>
                    <div className="p-4 bg-teal-50 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Sentiment</p>
                      <p className="text-2xl font-bold text-teal-900 capitalize" data-testid="text-sms-sentiment">
                        {demoResults.smsDemoResults.sentiment}
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Confidence</p>
                      <p className="text-2xl font-bold text-blue-900" data-testid="text-sms-confidence">
                        {demoResults.smsDemoResults.confidence}%
                      </p>
                    </div>
                  </div>
                  {demoResults.smsDemoResults.responseText && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Customer Response</p>
                      <p className="text-gray-600">{demoResults.smsDemoResults.responseText}</p>
                    </div>
                  )}
                </Card>
              )}

              {/* AI Capability Banner */}
              <Card className="p-6 bg-gradient-to-r from-[#17B6C3] to-teal-600 border-0">
                <div className="flex items-center gap-4 text-white">
                  <Brain className="w-12 h-12" />
                  <div>
                    <p className="text-xl font-bold">This happens automatically for every interaction</p>
                    <p className="text-blue-100">AI-powered intent detection, sentiment analysis, and intelligent next-action recommendations</p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* Market Opportunity */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">A £4.8B Market Made Mandatory by Law</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              The Late Payment Act creates a massive, defensible opportunity with regulatory tailwinds
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="p-8 text-center border-2 border-blue-200 bg-white" data-testid="card-market-tam">
              <Target className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <div className="text-5xl font-bold text-blue-600 mb-2" data-testid="text-tam-count">2.7M</div>
              <p className="text-xl font-semibold text-gray-900 mb-2">UK SMEs (TAM)</p>
              <p className="text-gray-600" data-testid="text-tam-value">£4.8B Total Market</p>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">Every business needs credit control</p>
              </div>
            </Card>

            <Card className="p-8 text-center border-2 border-purple-200 bg-white" data-testid="card-market-sam">
              <Users className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <div className="text-5xl font-bold text-purple-600 mb-2" data-testid="text-sam-count">800K</div>
              <p className="text-xl font-semibold text-gray-900 mb-2">Cloud Accounting (SAM)</p>
              <p className="text-gray-600" data-testid="text-sam-value">£1.4B Addressable</p>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">Xero + QuickBooks integration ready</p>
              </div>
            </Card>

            <Card className="p-8 text-center border-2 border-[#17B6C3] bg-white" data-testid="card-market-som">
              <Rocket className="w-12 h-12 text-[#17B6C3] mx-auto mb-4" />
              <div className="text-5xl font-bold text-[#17B6C3] mb-2" data-testid="text-som-count">4-8K</div>
              <p className="text-xl font-semibold text-gray-900 mb-2">3-Year Target (SOM)</p>
              <p className="text-gray-600" data-testid="text-som-value">£7-14M Revenue</p>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">200+ businesses on waitlist</p>
              </div>
            </Card>
          </div>

          <Card className="p-8 bg-white border-2 border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Why We'll Win</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-semibold text-gray-900 mb-2">Legal Moat</p>
                <p className="text-sm text-gray-600">Built on the Late Payment Act - competitors can't replicate statutory compliance</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-8 h-8 text-purple-600" />
                </div>
                <p className="font-semibold text-gray-900 mb-2">AI Advantage</p>
                <p className="text-sm text-gray-600">Proprietary intent detection trained on £70M+ invoice data</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-8 h-8 text-blue-600" />
                </div>
                <p className="font-semibold text-gray-900 mb-2">First Mover</p>
                <p className="text-sm text-gray-600">No compliant AI solution exists - we own the category</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Traction */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-green-100 rounded-full mb-4">
              <span className="text-green-700 font-semibold">EARLY TRACTION</span>
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Validated Demand</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Strong early indicators with product-market fit across multiple customer segments
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <Card className="p-6 text-center bg-gradient-to-br from-green-50 to-emerald-50 border-green-200" data-testid="card-traction-waitlist">
              <TrendingUp className="w-10 h-10 text-green-600 mx-auto mb-3" />
              <div className="text-4xl font-bold text-green-600 mb-1" data-testid="text-waitlist-count">200+</div>
              <p className="text-gray-700 font-medium">Waitlist Signups</p>
            </Card>

            <Card className="p-6 text-center bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200" data-testid="card-traction-customers">
              <Users className="w-10 h-10 text-blue-600 mx-auto mb-3" />
              <div className="text-4xl font-bold text-blue-600 mb-1" data-testid="text-beta-customers">12</div>
              <p className="text-gray-700 font-medium">Beta Customers</p>
            </Card>

            <Card className="p-6 text-center bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200" data-testid="card-traction-invoices">
              <DollarSign className="w-10 h-10 text-purple-600 mx-auto mb-3" />
              <div className="text-4xl font-bold text-purple-600 mb-1" data-testid="text-invoices-managed">£70M+</div>
              <p className="text-gray-700 font-medium">Invoices Managed</p>
            </Card>

            <Card className="p-6 text-center bg-gradient-to-br from-orange-50 to-red-50 border-orange-200" data-testid="card-traction-dso">
              <BarChart3 className="w-10 h-10 text-orange-600 mx-auto mb-3" />
              <div className="text-4xl font-bold text-orange-600 mb-1" data-testid="text-avg-dso-reduction">40%</div>
              <p className="text-gray-700 font-medium">Avg DSO Reduction</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#17B6C3] to-teal-700">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-white mb-6">
            Join the £4.8B Opportunity
          </h2>
          <p className="text-2xl text-blue-100 mb-8">
            SEIS-eligible investment | 200+ SMEs on waitlist | Xero integration live
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              className="bg-white text-[#17B6C3] hover:bg-gray-100 text-xl px-12 py-7 shadow-xl"
              data-testid="button-schedule-call"
            >
              Schedule Investment Call
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              className="border-2 border-white bg-transparent text-white hover:bg-white hover:text-[#17B6C3] text-xl px-12 py-7"
              onClick={() => {
                const link = document.createElement('a');
                link.href = investorDeckPdf;
                link.download = 'Qashivo-Investor-Deck.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              data-testid="button-download-deck"
            >
              Download Full Deck
            </Button>
          </div>
          <p className="text-blue-100 mt-8 text-sm">
            Raising £1.5mn seed round | 20% allocated to strategic investors
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-gray-900 text-center">
        <p className="text-gray-400">
          © 2025 Qashivo. Built in London. Backed by innovation.
        </p>
      </footer>
    </div>
  );
}
