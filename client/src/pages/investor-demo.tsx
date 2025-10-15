import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Phone, MessageSquare, TrendingUp, Shield, Zap, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function InvestorDemo() {
  const { toast } = useToast();
  const [leadData, setLeadData] = useState({ name: "", email: "" });
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [voicePhone, setVoicePhone] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [demoResults, setDemoResults] = useState<any>(null);

  const handleLeadCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Save to database
    console.log("Lead captured:", leadData);
    setLeadCaptured(true);
    
    toast({
      title: "Welcome!",
      description: "Experience Qashivo's AI in action below",
    });
    
    // Scroll to demos
    document.getElementById('demos')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleVoiceDemo = async () => {
    toast({
      title: "Initiating AI Voice Call",
      description: "You'll receive a call in a few seconds...",
    });
    // TODO: Trigger Retell call
  };

  const handleSMSDemo = async () => {
    toast({
      title: "SMS Sent!",
      description: "Reply to experience AI intent detection",
    });
    // TODO: Send SMS via Vonage
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-teal-900">
      {/* Hero Section with AI Avatar Video */}
      <section className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              AI That Gets You Paid
            </h1>
            <p className="text-2xl text-blue-200 mb-8">
              Turn the £4.8B late payment crisis into automated cashflow
            </p>
          </div>

          {/* AI Avatar Video Placeholder */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="aspect-video bg-black/50 backdrop-blur-sm rounded-2xl border border-white/20 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-[#17B6C3]/20 flex items-center justify-center">
                  <Zap className="w-12 h-12 text-[#17B6C3]" />
                </div>
                <p className="text-white text-lg">AI Avatar Video</p>
                <p className="text-gray-400 text-sm mt-2">
                  Simon Kramer | Founder & CEO
                </p>
              </div>
            </div>
          </div>

          {/* Lead Capture Form */}
          {!leadCaptured ? (
            <Card className="max-w-2xl mx-auto p-8 bg-white/10 backdrop-blur-md border-white/20">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Experience the Demo
              </h3>
              <form onSubmit={handleLeadCapture} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-white">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={leadData.name}
                    onChange={(e) => setLeadData({ ...leadData, name: e.target.value })}
                    className="bg-white/20 border-white/30 text-white placeholder:text-gray-400"
                    placeholder="Simon Kramer"
                    required
                    data-testid="input-investor-name"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-white">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={leadData.email}
                    onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                    className="bg-white/20 border-white/30 text-white placeholder:text-gray-400"
                    placeholder="simon@qashivo.com"
                    required
                    data-testid="input-investor-email"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg py-6"
                  data-testid="button-capture-lead"
                >
                  See It In Action →
                </Button>
              </form>
            </Card>
          ) : (
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-white text-xl">Welcome, {leadData.name}! 👇 Try the demos below</p>
            </div>
          )}
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 px-6 bg-black/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-8 text-center">The Problem</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">£2.8 Billion Crisis</h3>
              <p className="text-gray-300">
                Late payments cost UK SMEs £2.8 billion each year. Manual credit control is 
                non-compliant, inefficient, and emotionally draining.
              </p>
            </Card>
            <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Compliance Gap</h3>
              <p className="text-gray-300">
                The Late Payment Act makes compliance mandatory, but no platform connects 
                behaviour, credit risk, and statutory rights with automation.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Interactive Demos */}
      <section id="demos" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-12 text-center">
            Experience Qashivo's AI
          </h2>

          {leadCaptured && (
            <div className="grid md:grid-cols-2 gap-8">
              {/* Voice Call Demo */}
              <Card className="p-8 bg-white/10 backdrop-blur-md border-white/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-[#17B6C3]/20 rounded-lg">
                    <Phone className="w-6 h-6 text-[#17B6C3]" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">AI Voice Call Demo</h3>
                </div>
                <p className="text-gray-300 mb-6">
                  Receive an AI-powered collection call. Our AI detects intent and sentiment in real-time.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="voice-phone" className="text-white">Your Phone Number</Label>
                    <Input
                      id="voice-phone"
                      type="tel"
                      value={voicePhone}
                      onChange={(e) => setVoicePhone(e.target.value)}
                      className="bg-white/20 border-white/30 text-white placeholder:text-gray-400"
                      placeholder="+44 7700 900123"
                      data-testid="input-voice-phone"
                    />
                  </div>
                  <Button
                    onClick={handleVoiceDemo}
                    disabled={!voicePhone}
                    className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                    data-testid="button-start-voice-demo"
                  >
                    Call Me Now
                  </Button>
                </div>
              </Card>

              {/* SMS Demo */}
              <Card className="p-8 bg-white/10 backdrop-blur-md border-white/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-[#17B6C3]/20 rounded-lg">
                    <MessageSquare className="w-6 h-6 text-[#17B6C3]" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">AI SMS Demo</h3>
                </div>
                <p className="text-gray-300 mb-6">
                  Reply to our SMS and watch AI extract intent and sentiment from your response.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="sms-phone" className="text-white">Your Phone Number</Label>
                    <Input
                      id="sms-phone"
                      type="tel"
                      value={smsPhone}
                      onChange={(e) => setSmsPhone(e.target.value)}
                      className="bg-white/20 border-white/30 text-white placeholder:text-gray-400"
                      placeholder="+44 7700 900123"
                      data-testid="input-sms-phone"
                    />
                  </div>
                  <Button
                    onClick={handleSMSDemo}
                    disabled={!smsPhone}
                    className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                    data-testid="button-start-sms-demo"
                  >
                    Send SMS
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Demo Results */}
          {demoResults && (
            <Card className="mt-8 p-8 bg-green-900/20 backdrop-blur-md border-green-400/30">
              <h3 className="text-2xl font-bold text-white mb-6">AI Analysis Results</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-400">Intent Detected</p>
                  <p className="text-xl font-bold text-white">{demoResults.intent}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Sentiment</p>
                  <p className="text-xl font-bold text-white">{demoResults.sentiment}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Confidence</p>
                  <p className="text-xl font-bold text-white">{demoResults.confidence}%</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* The Solution */}
      <section className="py-20 px-6 bg-black/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-8 text-center">From Invoice to Enforcement</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20">
              <TrendingUp className="w-12 h-12 text-[#17B6C3] mb-4" />
              <h3 className="text-xl font-bold text-white mb-3">Credit Control</h3>
              <p className="text-gray-300">
                AI-driven voice, SMS, and email with personalised tone and timing
              </p>
            </Card>
            <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20">
              <Shield className="w-12 h-12 text-[#17B6C3] mb-4" />
              <h3 className="text-xl font-bold text-white mb-3">Auto Interest</h3>
              <p className="text-gray-300">
                Statutory interest and compensation applied instantly for overdue invoices
              </p>
            </Card>
            <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20">
              <Zap className="w-12 h-12 text-[#17B6C3] mb-4" />
              <h3 className="text-xl font-bold text-white mb-3">Enforcement API</h3>
              <p className="text-gray-300">
                Qompliance files CCJs through HMCTS bulk APIs in seconds
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Market Opportunity */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-8">A £4.8B Market Made Mandatory by Law</h2>
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div>
              <p className="text-5xl font-bold text-[#17B6C3] mb-2">2.7M</p>
              <p className="text-white text-xl">UK SMEs (TAM)</p>
              <p className="text-gray-400">£4.8B Total Market</p>
            </div>
            <div>
              <p className="text-5xl font-bold text-[#17B6C3] mb-2">800K</p>
              <p className="text-white text-xl">Cloud Accounting Users (SAM)</p>
              <p className="text-gray-400">£1.4B Addressable</p>
            </div>
            <div>
              <p className="text-5xl font-bold text-[#17B6C3] mb-2">4-8K</p>
              <p className="text-white text-xl">3-Year Target (SOM)</p>
              <p className="text-gray-400">£7-14M Revenue</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-[#17B6C3]/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Join the £4.8B Opportunity
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            SEIS-eligible investment | 200+ SMEs on waitlist | Xero integration ready
          </p>
          <Button
            className="bg-white text-[#17B6C3] hover:bg-gray-100 text-xl px-12 py-6"
            data-testid="button-schedule-call"
          >
            Schedule Investment Call
          </Button>
        </div>
      </section>
    </div>
  );
}
