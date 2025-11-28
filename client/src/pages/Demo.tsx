import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowRight, 
  Brain, 
  TrendingUp, 
  Phone, 
  MessageSquare, 
  Check, 
  Banknote,
  Zap,
  Clock,
  Shield,
  BarChart3,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AIResultsDialog } from "@/components/AIResultsDialog";
import logo from "@assets/Main Nexus Logo copy_1763392904110.png";
import heroImage from "@assets/generated_images/Advanced_AI_technology_center_4b230f51.png";

const sanitizePhoneNumber = (phone: string, countryCode: string): string => {
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  const countryCodeDigits = countryCode.replace(/^\+/, '');
  if (cleaned.startsWith(countryCodeDigits)) return `+${cleaned}`;
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  return `${countryCode}${cleaned}`;
};

const COUNTRY_CODES = [
  { value: "+44", label: "UK (+44)" },
  { value: "+1", label: "US/Canada (+1)" },
  { value: "+91", label: "India (+91)" },
  { value: "+61", label: "Australia (+61)" },
  { value: "+49", label: "Germany (+49)" },
  { value: "+33", label: "France (+33)" },
];

export default function Demo() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [leadId, setLeadId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [voicePhone, setVoicePhone] = useState("");
  const [voiceCountryCode, setVoiceCountryCode] = useState("+44");
  const [smsName, setSmsName] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [smsCountryCode, setSmsCountryCode] = useState("+44");
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [currentResults, setCurrentResults] = useState<any>(null);
  const [resultsType, setResultsType] = useState<"voice" | "sms">("voice");
  const [voiceProgress, setVoiceProgress] = useState<string>("");
  const [smsProgress, setSmsProgress] = useState<string>("");
  const [isDemoProcessing, setIsDemoProcessing] = useState(false);
  const [activeDemo, setActiveDemo] = useState<"voice" | "sms" | null>(null);
  const [demoStartTime, setDemoStartTime] = useState<number | null>(null);
  
  const [invoiceAmount, setInvoiceAmount] = useState("10000");
  const [fundingDays, setFundingDays] = useState("30");
  const [invoiceError, setInvoiceError] = useState("");
  
  useEffect(() => {
    if (!leadId || !activeDemo || !demoStartTime) return;
    
    const POLL_TIMEOUT_MS = 120000;
    const MIN_WAIT_MS = 3000;

    const pollInterval = setInterval(async () => {
      const elapsed = Date.now() - demoStartTime;
      
      if (elapsed > POLL_TIMEOUT_MS) {
        setVoiceProgress("");
        setSmsProgress("");
        setActiveDemo(null);
        setDemoStartTime(null);
        setIsDemoProcessing(false);
        toast({
          title: "Timeout",
          description: "The demo didn't complete in time. Please try again.",
          variant: "destructive",
        });
        clearInterval(pollInterval);
        return;
      }
      
      if (elapsed < MIN_WAIT_MS) {
        return;
      }
      
      try {
        const response = await fetch(`/api/investor/lead/${leadId}/results`);
        if (response.ok) {
          const results = await response.json();
          
          if (activeDemo === "voice" && results.voiceDemoResults && results.voiceDemoCompleted) {
            setCurrentResults(results.voiceDemoResults);
            setResultsType("voice");
            setVoiceProgress("");
            setIsDemoProcessing(false);
            setActiveDemo(null);
            setDemoStartTime(null);
            setResultsDialogOpen(true);
          }
          
          if (activeDemo === "sms" && results.smsDemoResults && results.smsDemoCompleted) {
            setCurrentResults(results.smsDemoResults);
            setResultsType("sms");
            setSmsProgress("");
            setIsDemoProcessing(false);
            setActiveDemo(null);
            setDemoStartTime(null);
            setResultsDialogOpen(true);
          }
        }
      } catch (error) {
        console.error("Error polling results:", error);
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [leadId, activeDemo, demoStartTime, toast]);

  const handleVoiceDemo = async () => {
    if (!voicePhone) return;
    
    setResultsDialogOpen(false);
    setCurrentResults(null);
    setSmsProgress("");
    setActiveDemo(null);
    setDemoStartTime(null);
    
    setVoiceProgress("Initiating...");
    setIsDemoProcessing(true);
    
    try {
      const sanitizedPhone = sanitizePhoneNumber(voicePhone, voiceCountryCode);
      let currentLeadId = leadId;
      
      if (!currentLeadId) {
        const leadRes = await fetch("/api/investor/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: voiceName || "Demo User", 
            email: `demo-${Date.now()}@demo.qashivo.com` 
          }),
        });
        if (!leadRes.ok) throw new Error("Failed to create lead");
        const lead = await leadRes.json();
        currentLeadId = lead.id;
        setLeadId(lead.id);
      }
      
      setTimeout(() => setVoiceProgress("Connecting..."), 400);
      
      const response = await fetch("/api/investor/voice-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: currentLeadId, phone: sanitizedPhone, name: voiceName }),
      });
      
      if (!response.ok) throw new Error("Failed to initiate call");
      
      setDemoStartTime(Date.now());
      setActiveDemo("voice");
      
      setCurrentResults({
        intent: "analyzing",
        sentiment: "listening",
        confidence: 0,
        keyInsights: ["AI is listening to the conversation..."],
        actionItems: ["Analysis will appear in real-time"],
        summary: "Live call in progress - AI analysis will populate as the conversation develops",
        transcript: ""
      });
      setResultsType("voice");
      setResultsDialogOpen(true);
      
      toast({
        title: "AI Voice Call Started",
        description: "You'll receive a call shortly...",
      });
    } catch (error) {
      setVoiceProgress("");
      setIsDemoProcessing(false);
      setActiveDemo(null);
      toast({
        title: "Error",
        description: "Failed to initiate call. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSMSDemo = async () => {
    if (!smsPhone) return;
    
    setResultsDialogOpen(false);
    setCurrentResults(null);
    setVoiceProgress("");
    setActiveDemo(null);
    setDemoStartTime(null);
    
    setSmsProgress("Initiating...");
    setIsDemoProcessing(true);
    
    try {
      const sanitizedPhone = sanitizePhoneNumber(smsPhone, smsCountryCode);
      let currentLeadId = leadId;
      
      if (!currentLeadId) {
        const leadRes = await fetch("/api/investor/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: smsName || "Demo User", 
            email: `demo-${Date.now()}@demo.qashivo.com` 
          }),
        });
        if (!leadRes.ok) throw new Error("Failed to create lead");
        const lead = await leadRes.json();
        currentLeadId = lead.id;
        setLeadId(lead.id);
      }
      
      setTimeout(() => setSmsProgress("Sending..."), 400);
      
      const response = await fetch("/api/investor/sms-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: currentLeadId, phone: sanitizedPhone, name: smsName }),
      });
      
      if (!response.ok) throw new Error("Failed to send SMS");
      
      setDemoStartTime(Date.now());
      setActiveDemo("sms");
      
      setCurrentResults({
        intent: "waiting",
        sentiment: "pending",
        confidence: 0,
        keyInsights: ["Waiting for your SMS reply..."],
        actionItems: ["AI will analyze your response instantly"],
        summary: "SMS sent - Reply to see real-time AI intent detection and sentiment analysis",
        responseText: ""
      });
      setResultsType("sms");
      setResultsDialogOpen(true);
      
      toast({
        title: "SMS Sent!",
        description: "Reply to experience AI intent detection",
      });
    } catch (error) {
      setSmsProgress("");
      setIsDemoProcessing(false);
      setActiveDemo(null);
      toast({
        title: "Error",
        description: "Failed to send SMS. Please try again.",
        variant: "destructive",
      });
    }
  };

  const calculateFunding = () => {
    const rawAmount = invoiceAmount.replace(/[^0-9.]/g, '');
    const amount = Math.max(0, Math.min(parseFloat(rawAmount) || 0, 10000000));
    const days = parseInt(fundingDays) || 30;
    const advanceRate = 0.85;
    const dailyFee = 0.0005;
    const advanceAmount = amount * advanceRate;
    const totalFee = amount * dailyFee * days;
    const netReceived = advanceAmount - totalFee;
    const isValid = amount > 0;
    return { advanceAmount, totalFee, netReceived, advanceRate, isValid, amount };
  };

  const funding = calculateFunding();
  
  const formatCurrency = (value: number): string => {
    if (isNaN(value) || !isFinite(value)) return "£0";
    return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <a href="/home" className="flex items-center space-x-2">
                <img src={logo} alt="Qashivo Logo" className="h-8 w-8" />
                <h1 className="text-2xl font-bold text-[#17B6C3]">Qashivo</h1>
              </a>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                className="border-[#17B6C3] text-[#17B6C3] hover:bg-[#17B6C3] hover:text-white"
                onClick={() => setLocation("/login")}
                data-testid="button-demo-login"
              >
                Login
              </Button>
              <Button
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                onClick={() => setLocation("/signup")}
                data-testid="button-demo-signup"
              >
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="relative overflow-hidden min-h-[400px] md:min-h-[500px] flex items-center"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/70"></div>
        
        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <div className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Zap className="h-4 w-4 text-[#17B6C3] mr-2" />
            <span className="text-sm font-semibold text-white">Interactive Demo</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Experience Qashivo <span className="text-[#17B6C3]">in Action</span>
          </h1>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto mb-8">
            Explore our three core pillars: autonomous credit control, intelligent cashflow forecasting, 
            and instant invoice financing. Try our live AI demos below.
          </p>
        </div>
      </section>

      {/* Three Pillars Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Three Pillars of Cashflow Excellence
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              A complete AI-powered platform that handles collections, predicts cashflow, and provides instant funding.
            </p>
          </div>

          <Tabs defaultValue="credit-control" className="w-full">
            <TabsList className="flex flex-col sm:grid sm:grid-cols-3 w-full mb-8 h-auto gap-2 sm:gap-0 bg-transparent sm:bg-muted p-0 sm:p-1 rounded-lg">
              <TabsTrigger 
                value="credit-control" 
                className="flex items-center justify-center py-3 px-4 sm:py-4 sm:px-6 text-sm sm:text-base data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white rounded-lg sm:rounded-md"
                data-testid="tab-credit-control"
              >
                <Brain className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="whitespace-nowrap">Credit Control</span>
              </TabsTrigger>
              <TabsTrigger 
                value="cashflow" 
                className="flex items-center justify-center py-3 px-4 sm:py-4 sm:px-6 text-sm sm:text-base data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white rounded-lg sm:rounded-md"
                data-testid="tab-cashflow"
              >
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="whitespace-nowrap">Cashflow</span>
              </TabsTrigger>
              <TabsTrigger 
                value="capital" 
                className="flex items-center justify-center py-3 px-4 sm:py-4 sm:px-6 text-sm sm:text-base data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white rounded-lg sm:rounded-md"
                data-testid="tab-capital"
              >
                <Banknote className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span className="whitespace-nowrap">Capital</span>
              </TabsTrigger>
            </TabsList>

            {/* Credit Control Tab */}
            <TabsContent value="credit-control" className="space-y-8">
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                {/* Left: Description */}
                <div className="space-y-6">
                  <div className="inline-flex items-center bg-[#17B6C3]/10 rounded-full px-4 py-2">
                    <Brain className="h-5 w-5 text-[#17B6C3] mr-2" />
                    <span className="font-semibold text-[#17B6C3]">THE Credit Controller</span>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">
                    AI That Chases Invoices So You Don't Have To
                  </h3>
                  <p className="text-lg text-gray-600">
                    Not software for credit controllers — the AI <em>is</em> the credit controller. 
                    It works 24/7, detecting payment intent, sending personalized follow-ups, 
                    and escalating when needed.
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <div className="bg-[#17B6C3]/10 rounded-lg p-2 mr-4 flex-shrink-0">
                        <Check className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">AI Voice Calls</h4>
                        <p className="text-gray-600">Automated calls that detect intent and sentiment in real-time</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-[#17B6C3]/10 rounded-lg p-2 mr-4 flex-shrink-0">
                        <Check className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Smart SMS & Email</h4>
                        <p className="text-gray-600">Personalized messages timed to maximize response rates</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-[#17B6C3]/10 rounded-lg p-2 mr-4 flex-shrink-0">
                        <Check className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Broken Promise Detection</h4>
                        <p className="text-gray-600">Auto-escalates when payment commitments aren't met</p>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Right: Live Demo */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 border border-gray-200">
                    <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                      <Zap className="w-5 h-5 text-[#17B6C3] mr-2" />
                      Try It Live
                    </h4>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Voice Demo Card */}
                      <Card className="p-6 border-2 border-[#17B6C3]/30 bg-white">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-[#17B6C3] rounded-lg">
                            <Phone className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h5 className="font-bold text-gray-900">AI Voice Call</h5>
                            <p className="text-xs text-gray-500">Real-time intent detection</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm">Your Name</Label>
                            <Input
                              value={voiceName}
                              onChange={(e) => setVoiceName(e.target.value)}
                              placeholder="John Smith"
                              className="mt-1"
                              data-testid="input-demo-voice-name"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Phone Number</Label>
                            <div className="flex gap-2 mt-1">
                              <Select value={voiceCountryCode} onValueChange={setVoiceCountryCode}>
                                <SelectTrigger className="w-[100px]" data-testid="select-demo-voice-country">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COUNTRY_CODES.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="tel"
                                value={voicePhone}
                                onChange={(e) => setVoicePhone(e.target.value)}
                                placeholder="07700 900000"
                                className="flex-1"
                                data-testid="input-demo-voice-phone"
                              />
                            </div>
                          </div>
                          <Button
                            onClick={handleVoiceDemo}
                            disabled={!voicePhone || isDemoProcessing}
                            className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                            data-testid="button-demo-voice-call"
                          >
                            {voiceProgress ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {voiceProgress}
                              </>
                            ) : (
                              <>
                                <Phone className="w-4 h-4 mr-2" />
                                Call Me Now
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>

                      {/* SMS Demo Card */}
                      <Card className="p-6 border-2 border-[#17B6C3]/30 bg-white">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-[#17B6C3] rounded-lg">
                            <MessageSquare className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h5 className="font-bold text-gray-900">AI SMS Analysis</h5>
                            <p className="text-xs text-gray-500">Instant text processing</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm">Your Name</Label>
                            <Input
                              value={smsName}
                              onChange={(e) => setSmsName(e.target.value)}
                              placeholder="John Smith"
                              className="mt-1"
                              data-testid="input-demo-sms-name"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Phone Number</Label>
                            <div className="flex gap-2 mt-1">
                              <Select value={smsCountryCode} onValueChange={setSmsCountryCode}>
                                <SelectTrigger className="w-[100px]" data-testid="select-demo-sms-country">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COUNTRY_CODES.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="tel"
                                value={smsPhone}
                                onChange={(e) => setSmsPhone(e.target.value)}
                                placeholder="07700 900000"
                                className="flex-1"
                                data-testid="input-demo-sms-phone"
                              />
                            </div>
                          </div>
                          <Button
                            onClick={handleSMSDemo}
                            disabled={!smsPhone || isDemoProcessing}
                            className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                            data-testid="button-demo-sms"
                          >
                            {smsProgress ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {smsProgress}
                              </>
                            ) : (
                              <>
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Send SMS Now
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Cashflow Tab */}
            <TabsContent value="cashflow" className="space-y-8">
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                {/* Left: Description */}
                <div className="space-y-6">
                  <div className="inline-flex items-center bg-[#17B6C3]/10 rounded-full px-4 py-2">
                    <TrendingUp className="h-5 w-5 text-[#17B6C3] mr-2" />
                    <span className="font-semibold text-[#17B6C3]">THE CFO</span>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">
                    Bayesian Cashflow Forecasting That Learns
                  </h3>
                  <p className="text-lg text-gray-600">
                    Predict your cashflow 90 days out with machine learning that gets smarter with every invoice. 
                    Know exactly when you'll get paid — before it happens.
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <div className="bg-[#17B6C3]/10 rounded-lg p-2 mr-4 flex-shrink-0">
                        <BarChart3 className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">90-Day Forecast</h4>
                        <p className="text-gray-600">ML-powered predictions with 95% accuracy</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-[#17B6C3]/10 rounded-lg p-2 mr-4 flex-shrink-0">
                        <Clock className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Payment Behavior Analysis</h4>
                        <p className="text-gray-600">Learns each debtor's payment patterns over time</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-[#17B6C3]/10 rounded-lg p-2 mr-4 flex-shrink-0">
                        <Shield className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Early Warning Alerts</h4>
                        <p className="text-gray-600">Get notified before you run short on cash</p>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Right: Forecast Preview */}
                <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 border border-gray-200">
                  <h4 className="text-xl font-bold text-gray-900 mb-6">Sample Forecast Preview</h4>
                  
                  <div className="bg-white rounded-xl p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-gray-500">Next 30 Days Projection</span>
                      <span className="text-sm font-semibold text-green-600">+£47,250 expected</span>
                    </div>
                    <div className="h-32 bg-gradient-to-r from-[#17B6C3]/10 via-[#17B6C3]/30 to-[#17B6C3]/10 rounded-lg flex items-end justify-around px-4 pb-4">
                      {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
                        <div
                          key={i}
                          className="w-8 bg-[#17B6C3] rounded-t-md transition-all hover:bg-[#1396A1]"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                      <span>Week 1</span>
                      <span>Week 2</span>
                      <span>Week 3</span>
                      <span>Week 4</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-white rounded-lg">
                      <div className="text-2xl font-bold text-[#17B6C3]">95%</div>
                      <div className="text-xs text-gray-500">Forecast Accuracy</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg">
                      <div className="text-2xl font-bold text-green-600">-40%</div>
                      <div className="text-xs text-gray-500">DSO Reduction</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg">
                      <div className="text-2xl font-bold text-[#17B6C3]">90</div>
                      <div className="text-xs text-gray-500">Days Visibility</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Capital Tab */}
            <TabsContent value="capital" className="space-y-8">
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                {/* Left: Description */}
                <div className="space-y-6">
                  <div className="inline-flex items-center bg-[#17B6C3]/10 rounded-full px-4 py-2">
                    <Banknote className="h-5 w-5 text-[#17B6C3] mr-2" />
                    <span className="font-semibold text-[#17B6C3]">Invoice Financing</span>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">
                    Turn Approved Invoices Into Cash Within 24 Hours
                  </h3>
                  <p className="text-lg text-gray-600">
                    Don't wait 60+ days to get paid. Get up to 85% of your invoice value immediately, 
                    with transparent fees and no hidden costs.
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <div className="bg-[#17B6C3]/10 rounded-lg p-2 mr-4 flex-shrink-0">
                        <Zap className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">24-Hour Funding</h4>
                        <p className="text-gray-600">Get cash in your account within one business day</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-[#17B6C3]/10 rounded-lg p-2 mr-4 flex-shrink-0">
                        <Check className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">85% Advance Rate</h4>
                        <p className="text-gray-600">Receive most of your invoice value upfront</p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-[#17B6C3]/10 rounded-lg p-2 mr-4 flex-shrink-0">
                        <Shield className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Transparent Pricing</h4>
                        <p className="text-gray-600">Simple daily fee with no hidden costs</p>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Right: Funding Calculator */}
                <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 border border-gray-200">
                  <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                    <Banknote className="w-5 h-5 text-[#17B6C3] mr-2" />
                    Funding Calculator
                  </h4>
                  
                  <div className="space-y-4 mb-6">
                    <div>
                      <Label className="text-sm font-medium">Invoice Amount (£)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={invoiceAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInvoiceAmount(val);
                          if (val && !/^\d+(\.\d{0,2})?$/.test(val.replace(/,/g, ''))) {
                            setInvoiceError("Please enter a valid amount");
                          } else if (parseFloat(val.replace(/,/g, '') || "0") <= 0) {
                            setInvoiceError("Amount must be greater than zero");
                          } else if (parseFloat(val.replace(/,/g, '') || "0") > 10000000) {
                            setInvoiceError("Maximum amount is £10,000,000");
                          } else {
                            setInvoiceError("");
                          }
                        }}
                        placeholder="10000"
                        className={`mt-1 text-lg ${invoiceError ? 'border-red-500' : ''}`}
                        data-testid="input-funding-amount"
                      />
                      {invoiceError && (
                        <p className="text-xs text-red-500 mt-1">{invoiceError}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Expected Payment (Days)</Label>
                      <Select value={fundingDays} onValueChange={setFundingDays}>
                        <SelectTrigger className="mt-1" data-testid="select-funding-days">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 space-y-4">
                    {!funding.isValid && (
                      <div className="text-center py-4 text-gray-500">
                        Enter an invoice amount to calculate funding
                      </div>
                    )}
                    {funding.isValid && (
                      <>
                        <div className="flex justify-between items-center pb-3 border-b">
                          <span className="text-gray-600">Invoice Amount</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(funding.amount)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b">
                          <span className="text-gray-600">Advance Rate ({(funding.advanceRate * 100).toFixed(0)}%)</span>
                          <span className="font-semibold text-[#17B6C3]">{formatCurrency(funding.advanceAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b">
                          <span className="text-gray-600">Fee (0.05%/day × {fundingDays} days)</span>
                          <span className="font-semibold text-orange-600">-{formatCurrency(funding.totalFee)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-lg font-semibold text-gray-900">You Receive Today</span>
                          <span className="text-2xl font-bold text-green-600">{formatCurrency(funding.netReceived)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mt-4 text-center">
                    *Indicative calculation. Actual rates subject to credit assessment.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#17B6C3] to-teal-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Let AI Run Your Cashflow?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join forward-thinking SMEs who've replaced manual credit control with autonomous AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white hover:bg-gray-100 text-[#17B6C3] text-lg px-8"
              onClick={() => setLocation("/signup")}
              data-testid="button-demo-cta-trial"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-[#17B6C3] text-lg px-8"
              onClick={() => setLocation("/home")}
              data-testid="button-demo-cta-learn"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <img src={logo} alt="Qashivo Logo" className="h-6 w-6" />
              <span className="text-xl font-bold text-[#17B6C3]">Qashivo</span>
            </div>
            <p className="text-gray-400 text-sm">© 2025 Qashivo. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* AI Results Dialog */}
      <AIResultsDialog
        open={resultsDialogOpen}
        onOpenChange={setResultsDialogOpen}
        results={currentResults}
        type={resultsType}
        isDemoProcessing={isDemoProcessing}
        progressMessage={resultsType === "voice" ? voiceProgress : smsProgress}
      />
    </div>
  );
}
