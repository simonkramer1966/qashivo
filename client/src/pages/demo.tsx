import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, TrendingUp, Shield, Zap, CheckCircle, Brain, ArrowRight, Clock, DollarSign, Users, BarChart3, Target, Rocket, Menu, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SiXero, SiStripe, SiOpenai, SiQuickbooks } from "react-icons/si";
import { AIResultsDialog } from "@/components/AIResultsDialog";
import { Oscilloscope } from "@/components/Oscilloscope";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MessageSquare, PhoneOff } from "lucide-react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";
import dashboardScreenshot from "@assets/Screenshot_2026-01-20_at_16.41.29_1769100769786.png";
import xeroLogo from "@assets/Xero_software_logo.svg_1768974407536.png";
import quickbooksLogo from "@assets/quickbnooks_1768974664185.png";
import investorDeckPdf from "@assets/Qashivo - Investor Deck_1760520688174.pdf";

// Phone number sanitization function  
const sanitizePhoneNumber = (phone: string, countryCode: string): string => {
  // Remove all spaces, dashes, parentheses, and other formatting
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Handle international prefix "00" (e.g., 00447716273336)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  // Extract just the country code digits (e.g., "44" from "+44")
  const countryCodeDigits = countryCode.replace(/^\+/, '');
  
  // Check if number already starts with the country code
  if (cleaned.startsWith(countryCodeDigits)) {
    // Already has country code, just add + prefix
    return `+${cleaned}`;
  }
  
  // Remove leading 0 if present (national format like 07716273336)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Combine with country code - ensure no duplicate country code
  const result = `${countryCode}${cleaned}`;
  
  // Debug log for troubleshooting
  console.log('📱 Phone sanitization:', { original: phone, countryCode, cleaned, result });
  
  return result;
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

export default function InvestorDemo() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [leadData, setLeadData] = useState({ name: "", email: "" });
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [voicePhone, setVoicePhone] = useState("");
  const [voiceCountryCode, setVoiceCountryCode] = useState("+44");
  const [demoResults, setDemoResults] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [currentResults, setCurrentResults] = useState<any>(null);
  const [resultsType, setResultsType] = useState<"voice">("voice");
  const lastShownResultsRef = useRef<string>("");
  const lastShownAtRef = useRef<number>(0); // Track timestamp of currently displayed result
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTransitioningRef = useRef(false);
  
  // Demo processing states for progress and dialog locking
  const [voiceProgress, setVoiceProgress] = useState<string>("");
  const [isDemoProcessing, setIsDemoProcessing] = useState(false);
  
  // Active call tracking for status polling
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const callStatusPollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Investment call dialog state
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [investorFirstName, setInvestorFirstName] = useState("");
  const [investorLastName, setInvestorLastName] = useState("");
  const [investorPhone, setInvestorPhone] = useState("");
  const [investorEmail, setInvestorEmail] = useState("");
  const [isHighNetWorth, setIsHighNetWorth] = useState(false);
  const [acknowledgesRisk, setAcknowledgesRisk] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Video ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!leadId) return;

    // WebSocket for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/investor-demo?leadId=${leadId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🔌 WebSocket connected for real-time demo updates');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'demo_results') {
          console.log('📡 Received real-time demo results:', message.data);
          setDemoResults(message.data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
    };

    // Fallback polling every 1.5 seconds for fast updates (websockets unreliable in production multi-instance)
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

  // Poll Retell API directly for call status (fallback when webhook doesn't arrive)
  useEffect(() => {
    if (!activeCallId || !leadId) return;
    
    console.log(`📞 Starting call status polling for call: ${activeCallId}`);
    
    const pollCallStatus = async () => {
      try {
        const response = await fetch(`/api/investor/call-status/${activeCallId}?leadId=${leadId}`);
        if (!response.ok) {
          console.error('Failed to fetch call status');
          return;
        }
        
        const data = await response.json();
        console.log(`📞 Call status poll response:`, data);
        
        if (data.isEnded) {
          console.log(`✅ Call ended${data.processed ? ' and processed via polling!' : ' (already processed by webhook)'}`);
          // Clear the polling - call is done regardless of whether we processed it or webhook did
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
    
    // Poll every 3 seconds
    callStatusPollRef.current = setInterval(pollCallStatus, 3000);
    
    // Also poll immediately
    pollCallStatus();
    
    return () => {
      if (callStatusPollRef.current) {
        clearInterval(callStatusPollRef.current);
        callStatusPollRef.current = null;
      }
    };
  }, [activeCallId, leadId]);

  // Helper function to update voice results (inline panel, no dialog)
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

  // Auto-update results when they arrive
  useEffect(() => {
    if (!demoResults) return;

    // Don't process if we're currently transitioning
    if (isTransitioningRef.current) return;

    // Update voice results if available (inline panel, no dialog)
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
  }, [demoResults, toast, resultsDialogOpen]);

  // Cleanup on unmount - ensure all timeouts are cleared
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      isTransitioningRef.current = false;
    };
  }, []);

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
    if (!voicePhone) return;
    
    // Immediate feedback - set progress and lock dialog
    setVoiceProgress("Initiating...");
    setIsDemoProcessing(true);
    
    try {
      // Sanitize phone number
      const sanitizedPhone = sanitizePhoneNumber(voicePhone, voiceCountryCode);
      
      // Progress update
      setTimeout(() => setVoiceProgress("Connecting..."), 400);
      
      // Parallelize lead creation and demo setup
      let currentLeadId = leadId;
      
      const operations = [];
      
      // If no lead exists, create one in parallel
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
      
      // Wait for lead ID to be available
      const [resolvedLeadId] = await Promise.all(operations);
      
      // Progress update
      setTimeout(() => setVoiceProgress("In progress..."), 800);
      
      // Initiate the voice call
      const response = await fetch("/api/investor/voice-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: resolvedLeadId, phone: sanitizedPhone, name: voiceName }),
      });
      
      if (!response.ok) throw new Error("Failed to initiate call");
      
      // Get call ID from response for status polling
      const callData = await response.json();
      const callId = callData.callId;
      
      if (callId) {
        console.log(`📞 Voice call initiated with ID: ${callId}`);
        setActiveCallId(callId);
      }
      
      // Set analyzing state for inline panel (don't open dialog for voice)
      // Reset lastShownAtRef to 0 so any real results will always be considered newer
      lastShownAtRef.current = 0;
      lastShownResultsRef.current = "";
      setCurrentResults(null); // Clear results - inline panel will show "active call" state via isDemoProcessing
      setResultsType("voice");
      
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

  const handleInvestmentCall = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setFormErrors({});
    const errors: Record<string, string> = {};
    
    // Validate form fields
    if (!investorFirstName || investorFirstName.trim().length < 2) {
      errors.firstName = "Please enter your first name";
    }
    
    if (!investorLastName || investorLastName.trim().length < 2) {
      errors.lastName = "Please enter your last name";
    }
    
    if (!investorPhone || investorPhone.trim().length < 10) {
      errors.phone = "Please enter a valid phone number (min 10 digits)";
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!investorEmail || !emailRegex.test(investorEmail)) {
      errors.email = "Please enter a valid email address";
    }
    
    if (!isHighNetWorth) {
      errors.highNetWorth = "You must confirm the High Net Worth declaration to proceed";
    }
    
    if (!acknowledgesRisk) {
      errors.risk = "You must acknowledge the investment risks to proceed";
    }
    
    // If there are errors, display them and prevent submission
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast({
        title: "Validation Error",
        description: "Please correct the errors below",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/investor/schedule-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${investorFirstName.trim()} ${investorLastName.trim()}`,
          phone: investorPhone.trim(),
          email: investorEmail.trim(),
          isHighNetWorth,
          acknowledgesRisk
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle validation errors from backend
        if (data.errors) {
          const backendErrors: Record<string, string> = {};
          data.errors.forEach((err: any) => {
            if (err.path && err.path[0]) {
              backendErrors[err.path[0]] = err.message;
            }
          });
          setFormErrors(backendErrors);
        }
        throw new Error(data.message || "Failed to schedule call");
      }
      
      toast({
        title: "Thank you for your interest.",
        description: "Redirecting you to the full investment overview...",
      });
      
      // Reset form and close dialog
      setInvestorFirstName("");
      setInvestorLastName("");
      setInvestorPhone("");
      setInvestorEmail("");
      setIsHighNetWorth(false);
      setAcknowledgesRisk(false);
      setFormErrors({});
      setInvestmentDialogOpen(false);
      
      // Redirect to investor detail page after a brief delay
      setTimeout(() => {
        setLocation("/investor-detail");
      }, 1500);
    } catch (error) {
      // Only show generic error toast, form errors are already displayed inline
      if (Object.keys(formErrors).length === 0) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to schedule call. Please try again.",
          variant: "destructive",
        });
      }
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
                <span className="font-semibold text-[#0B0F17] tracking-tight text-[22px]">Qashivo</span>
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="/home" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Home
                </a>
                <a href="/product" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Product
                </a>
                <a href="/home#how-it-works" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  How it works
                </a>
                <a href="/partners" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Partners
                </a>
                <a href="/pricing" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Pricing
                </a>
                <a href="/contact" className="text-[15px] text-[#0B0F17] font-medium">
                  Contact
                </a>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <a href="/login" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                Sign in
              </a>
              <Button
                onClick={() => setLocation("/contact")}
                className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 px-5 rounded-full text-[15px] font-medium"
              >
                Book a demo
              </Button>
            </div>
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E6E8EC] bg-white px-6 py-4">
            <div className="flex flex-col gap-4">
              <a href="/home" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Home</a>
              <a href="/product" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Product</a>
              <a href="/home#how-it-works" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">How it works</a>
              <a href="/partners" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Partners</a>
              <a href="/pricing" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Pricing</a>
              <a href="/contact" className="text-[16px] text-[#0B0F17] font-medium py-2">Contact</a>
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
      {/* Hero Section */}
      <section className="pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Headlines */}
            <div>
              <div className="inline-block px-4 py-2 bg-[#12B8C4]/10 rounded-full mb-6">
                <span className="text-[#0B0F17] font-medium text-[14px]">SEIS-Eligible Investment Opportunity (HMRC Advance Assurance)</span>
              </div>
              <h1 className="text-[40px] md:text-[52px] font-semibold text-[#0B0F17] leading-[1.05] tracking-[-0.02em] mb-6">
                Automation That Turns Late Payments Into Predictable Cashflow
              </h1>
              <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.55] mb-4">
                The UK's first automated credit control platform built to transform the £11B late payment crisis into predictable revenue.
              </p>
              <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.55]">
                <strong className="text-[#0B0F17]">We're not just automating credit control. We're building the execution engine for SME collections.</strong>
              </p>
            </div>

            {/* Right: Video */}
            <div className="bg-[#F0F2F5] rounded-2xl p-3">
              <div className="aspect-video rounded-xl overflow-hidden border border-[#E6E8EC]">
                <video 
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                  onPlay={() => {
                    setIsVideoPlaying(true);
                    if (videoRef.current) {
                      videoRef.current.muted = false;
                    }
                  }}
                >
                  <source src="/media/QashivoIntrov2.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Trust Signals */}
      <section className="py-16 border-y border-[#E6E8EC] bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-center text-[18px] text-[#556070] mb-8">
            Integrated with your favourite accounting software ...
          </p>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-14">
            <img src={xeroLogo} alt="Xero" className="h-24 grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition-all" />
            <img src={quickbooksLogo} alt="QuickBooks" className="h-[108px] grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition-all" />
          </div>
        </div>
      </section>
      {/* The Solution */}
      <section className="py-16 md:py-24 border-y border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-[700px] mx-auto text-center mb-16">
            <h2 className="text-[40px] md:text-[48px] font-semibold text-[#0B0F17] leading-[1.1] tracking-[-0.02em] mb-6">The Qashivo Solution</h2>
            <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.55]">
              Supervised autonomous credit control that combines AI intent detection, multi-channel automation and real-time cashflow forecasting based upon individual debtor behaviour.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center">
                    <Brain className="w-6 h-6 text-[#12B8C4]" />
                  </div>
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-2">AI Intent Detection</h3>
                    <p className="text-[16px] text-[#556070] leading-[1.6]">
                      Every voice call, email, WhatsApp and SMS is analysed in real time. Qashivo detects payment intent, captures key details and creates the next actions, with anything uncertain routed for human review.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#12B8C4]" />
                  </div>
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-2">Multi Channel Communication</h3>
                    <p className="text-[16px] text-[#556070] leading-[1.6]">
                      Qashivo contacts debtors on their preferred channel across email, SMS, WhatsApp and voice, then captures responses into clear outcomes like promises to pay, payment plans, disputes and queries. It keeps every message consistent, polite and on-brand — protecting your most important asset: client relationships.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-[#12B8C4]" />
                  </div>
                  <div>
                    <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-2">Real-Time Cashflow</h3>
                    <p className="text-[16px] text-[#556070] leading-[1.6]">
                      Qashivo updates your cash-in forecast in real time as each debtor engages — not just from invoice ageing. It learns individual debtor payment behaviour and confirmed intent (like promises to pay or disputes), so your forecast reflects what customers are actually likely to do. In other words, Qashivo really does "know your customers".
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#F0F2F5] rounded-2xl p-6">
              <div className="rounded-xl overflow-hidden mb-6 border border-[#E6E8EC]">
                <img 
                  src={dashboardScreenshot} 
                  alt="Qashivo Dashboard - Overview" 
                  className="w-full h-auto"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center py-3" data-testid="card-solution-accuracy">
                  <p className="text-[24px] font-semibold text-[#12B8C4]" data-testid="text-accuracy-rate">3</p>
                  <p className="text-[13px] text-[#556070]">Scenario Options</p>
                </div>
                <div className="text-center py-3 border-x border-[#E6E8EC]" data-testid="card-solution-dso">
                  <p className="text-[24px] font-semibold text-[#0B0F17]" data-testid="text-dso-reduction">-40%</p>
                  <p className="text-[13px] text-[#556070]">DSO Reduction</p>
                </div>
                <div className="text-center py-3" data-testid="card-solution-time">
                  <p className="text-[24px] font-semibold text-[#12B8C4]" data-testid="text-time-saved">85%</p>
                  <p className="text-[13px] text-[#556070]">Time Saved</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Live AI Demo */}
      <section id="demos" className="py-16 md:py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-[700px] mx-auto text-center mb-12">
            <h2 className="text-[40px] md:text-[48px] font-semibold text-[#0B0F17] leading-[1.1] tracking-[-0.02em] mb-6">Experience Our AI Voice Agent</h2>
            <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.55]">
              Try our real-time AI voice agent. Receive an automated collection call and watch our AI detect intent and sentiment in real-time.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-stretch">
            {/* Left: Input Card */}
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-[#12B8C4]/10 rounded-xl">
                  <Phone className="w-6 h-6 text-[#12B8C4]" />
                </div>
                <div>
                  <h3 className="text-[24px] font-semibold text-[#0B0F17]">AI Voice Call Demo</h3>
                  <p className="text-[14px] text-[#556070]">Real-time intent detection</p>
                </div>
              </div>
              <p className="text-[16px] text-[#556070] leading-[1.6] mb-6">
                Receive an automated collection call. Our system analyses your responses in real-time, detecting intent, sentiment, commitment to pay and provides an accurate transcript of the call for system notes.
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
                    data-testid="input-voice-name"
                  />
                </div>
                <div>
                  <Label className="text-[#0B0F17] font-medium text-[14px]">Your Phone Number</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={voiceCountryCode} onValueChange={setVoiceCountryCode}>
                      <SelectTrigger className="w-[160px] bg-white border-[#E6E8EC]" data-testid="select-voice-country">
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
                      data-testid="input-voice-phone"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleVoiceDemo}
                  disabled={!voicePhone || isDemoProcessing}
                  className="w-full bg-[#12B8C4] hover:bg-[#0fa3ae] text-white text-[16px] h-12 rounded-full font-medium"
                  data-testid="button-start-voice-demo"
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
                <p className="text-[14px] text-[#556070] text-center">
                  You'll receive a call from +1 (586) 244-8999
                </p>
              </div>
            </div>

            {/* Right: Results Panel */}
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 bg-[#12B8C4]/10 rounded-xl ${isDemoProcessing ? 'animate-pulse' : ''}`}>
                  <Sparkles className="w-6 h-6 text-[#12B8C4]" />
                </div>
                <div>
                  <h3 className="text-[24px] font-semibold text-[#0B0F17]">
                    {isDemoProcessing ? "AI Analysis - In Progress" : currentResults ? "AI Analysis Complete" : "AI Analysis"}
                  </h3>
                  <p className="text-[14px] text-[#556070]">Voice Call Intelligence Report</p>
                </div>
              </div>

              {/* Oscilloscope */}
              <div className="relative h-20 mb-6 rounded-xl bg-[#0B0F17] border border-white/10 overflow-hidden">
                <Oscilloscope isActive={isDemoProcessing} />
                {isDemoProcessing && voiceProgress && (
                  <div className="absolute bottom-2 left-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#12B8C4] animate-pulse" />
                    <span className="text-xs text-[#12B8C4] font-medium">{voiceProgress}</span>
                  </div>
                )}
              </div>

              {/* Content Area */}
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
                    <div className="w-16 h-16 bg-[#12B8C4]/15 rounded-full flex items-center justify-center mb-4 animate-pulse">
                      <Brain className="w-8 h-8 text-[#12B8C4]" />
                    </div>
                    <p className="text-[#0B0F17] text-lg font-medium mb-2">Listening & Analyzing</p>
                    <p className="text-[#556070] text-sm">
                      Our AI is processing your conversation in real-time...
                    </p>
                  </div>
                )}

                {currentResults && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Call Terminated Warning */}
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

                    {/* Metrics Grid */}
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

                    {/* Summary */}
                    {currentResults.summary && (
                      <div className="p-3 bg-[#12B8C4]/5 border-l-4 border-[#12B8C4] rounded-r-lg">
                        <p className="text-xs font-semibold text-[#12B8C4] mb-1 uppercase tracking-wide">Summary</p>
                        <p className="text-sm text-[#0B0F17] leading-relaxed">{currentResults.summary}</p>
                      </div>
                    )}

                    {/* Key Insights */}
                    {currentResults.keyInsights && currentResults.keyInsights.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[#556070] uppercase tracking-wide flex items-center gap-2">
                          <Brain className="w-3 h-3 text-[#12B8C4]" />
                          Key Insights
                        </p>
                        <div className="space-y-1.5">
                          {currentResults.keyInsights.slice(0, 3).map((insight: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 p-2 bg-white border border-[#E6E8EC] rounded-lg">
                              <div className="w-5 h-5 rounded-full bg-[#12B8C4]/15 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-[#12B8C4]">{idx + 1}</span>
                              </div>
                              <p className="text-xs text-[#556070] leading-relaxed">{insight}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transcript Preview */}
                    {currentResults.transcript && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[#556070] uppercase tracking-wide flex items-center gap-2">
                          <MessageSquare className="w-3 h-3 text-[#12B8C4]" />
                          Transcript
                        </p>
                        <div className="p-3 bg-[#0B0F17] border border-[#E6E8EC] rounded-xl max-h-24 overflow-y-auto">
                          <p className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                            {currentResults.transcript}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Footer Badge */}
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <Badge variant="outline" className="bg-[#12B8C4]/10 border-[#12B8C4]/30 text-[#12B8C4] text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Powered by Qashivo AI
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Market Opportunity */}
      <section className="py-16 md:py-24 border-y border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-[700px] mx-auto text-center mb-16">
            <h2 className="text-[40px] md:text-[48px] font-semibold text-[#0B0F17] leading-[1.1] tracking-[-0.02em] mb-6">A £4.8B Market Made Mandatory by Law</h2>
            <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.55]">
              The Late Payment Act creates a massive, defensible opportunity with regulatory tailwinds
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-12 mb-16">
            <div className="text-center" data-testid="card-market-tam">
              <div className="w-14 h-14 bg-[#0B0F17]/10 rounded-xl flex items-center justify-center mb-6 mx-auto">
                <Target className="w-7 h-7 text-[#0B0F17]" />
              </div>
              <div className="text-[48px] font-semibold text-[#0B0F17] mb-2" data-testid="text-tam-count">2.7M</div>
              <p className="text-[20px] font-semibold text-[#0B0F17] mb-2">UK SMEs (TAM)</p>
              <p className="text-[16px] text-[#556070]" data-testid="text-tam-value">£4.8B Total Market</p>
              <p className="text-[14px] text-[#556070] mt-4">Every business needs credit control</p>
            </div>

            <div className="text-center" data-testid="card-market-sam">
              <div className="w-14 h-14 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center mb-6 mx-auto">
                <Users className="w-7 h-7 text-[#12B8C4]" />
              </div>
              <div className="text-[48px] font-semibold text-[#12B8C4] mb-2" data-testid="text-sam-count">800K</div>
              <p className="text-[20px] font-semibold text-[#0B0F17] mb-2">Cloud Accounting (SAM)</p>
              <p className="text-[16px] text-[#556070]" data-testid="text-sam-value">£1.4B Addressable</p>
              <p className="text-[14px] text-[#556070] mt-4">Xero + QuickBooks integration ready</p>
            </div>

            <div className="text-center" data-testid="card-market-som">
              <div className="w-14 h-14 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center mb-6 mx-auto">
                <Rocket className="w-7 h-7 text-[#12B8C4]" />
              </div>
              <div className="text-[48px] font-semibold text-[#12B8C4] mb-2" data-testid="text-som-count">4-8K</div>
              <p className="text-[20px] font-semibold text-[#0B0F17] mb-2">3-Year Target (SOM)</p>
              <p className="text-[16px] text-[#556070]" data-testid="text-som-value">£7-14M Revenue</p>
              <p className="text-[14px] text-[#556070] mt-4">200+ pre-launch inquiries</p>
            </div>
          </div>

          <div className="border-t border-[#E6E8EC] pt-12">
            <h3 className="text-[24px] font-semibold text-[#0B0F17] mb-10 text-center">Why We'll Win</h3>
            <div className="grid md:grid-cols-3 gap-10 md:gap-12">
              <div className="text-center">
                <div className="w-14 h-14 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-7 h-7 text-[#12B8C4]" />
                </div>
                <p className="font-semibold text-[#0B0F17] mb-2">Legal Moat</p>
                <p className="text-[14px] text-[#556070]">Built on the Late Payment Act - competitors can't replicate statutory compliance</p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-7 h-7 text-[#12B8C4]" />
                </div>
                <p className="font-semibold text-[#0B0F17] mb-2">AI Advantage</p>
                <p className="text-[14px] text-[#556070]">AI models developed using £70M+ pilot dataset</p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-7 h-7 text-[#12B8C4]" />
                </div>
                <p className="font-semibold text-[#0B0F17] mb-2">First Mover</p>
                <p className="text-[14px] text-[#556070]">No compliant AI solution exists - we own the category</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Traction */}
      <section className="py-16 md:py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-[700px] mx-auto text-center mb-16">
            <div className="inline-block px-4 py-2 bg-[#12B8C4]/10 rounded-full mb-4">
              <span className="text-[#12B8C4] font-medium text-[14px]">DEVELOPMENT PROGRESS</span>
            </div>
            <h2 className="text-[40px] md:text-[48px] font-semibold text-[#0B0F17] leading-[1.1] tracking-[-0.02em] mb-6">Market Validation</h2>
            <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.55]">
              Positive pilot feedback and strong market interest across target segments
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center" data-testid="card-traction-waitlist">
              <div className="w-12 h-12 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <TrendingUp className="w-6 h-6 text-[#12B8C4]" />
              </div>
              <div className="text-[36px] font-semibold text-[#12B8C4] mb-1" data-testid="text-waitlist-count">200+</div>
              <p className="text-[#0B0F17] font-medium">Product Inquiries</p>
            </div>

            <div className="text-center" data-testid="card-traction-customers">
              <div className="w-12 h-12 bg-[#0B0F17]/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Users className="w-6 h-6 text-[#0B0F17]" />
              </div>
              <div className="text-[36px] font-semibold text-[#0B0F17] mb-1" data-testid="text-beta-customers">12</div>
              <p className="text-[#0B0F17] font-medium">Development Testers</p>
            </div>

            <div className="text-center" data-testid="card-traction-invoices">
              <div className="w-12 h-12 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <DollarSign className="w-6 h-6 text-[#12B8C4]" />
              </div>
              <div className="text-[36px] font-semibold text-[#12B8C4] mb-1" data-testid="text-invoices-managed">£70M+</div>
              <p className="text-[#0B0F17] font-medium">Pilot Data Processed</p>
            </div>

            <div className="text-center" data-testid="card-traction-dso">
              <div className="w-12 h-12 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <BarChart3 className="w-6 h-6 text-[#12B8C4]" />
              </div>
              <div className="text-[36px] font-semibold text-[#12B8C4] mb-1" data-testid="text-avg-dso-reduction">40%</div>
              <p className="text-[#0B0F17] font-medium">Trial DSO Improvement</p>
            </div>
          </div>
        </div>
      </section>
      {/* Final CTA */}
      <section className="py-16 md:py-24 border-t border-[#E6E8EC]">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <h2 className="text-[40px] md:text-[52px] font-semibold text-[#0B0F17] leading-[1.1] tracking-[-0.02em] mb-6">
            Join the £4.8B Opportunity
          </h2>
          <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.55] mb-10">
            SEIS-eligible (HMRC Advance Assurance) | 200+ market inquiries | Xero integration ready
          </p>
          <Button
            className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white text-[18px] px-10 h-14 rounded-full font-medium"
            onClick={() => setLocation("/contact")}
            data-testid="button-contact-footer"
          >
            Get in Touch
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#E6E8EC] text-center">
        <p className="text-[14px] text-[#556070]">
          © 2026 Qashivo. Built in London. Backed by innovation.
        </p>
      </footer>
      {/* AI Results Dialog */}
      <AIResultsDialog
        key={resultsType} // Force remount when switching between voice/SMS
        open={resultsDialogOpen}
        onOpenChange={(open) => {
          setResultsDialogOpen(open);
          // Reset processing state when dialog closes
          if (!open) {
            setIsDemoProcessing(false);
          }
        }}
        results={currentResults}
        type={resultsType}
        isDemoProcessing={isDemoProcessing}
        progressMessage={voiceProgress}
      />
      {/* Investment Call Dialog */}
      <Dialog open={investmentDialogOpen} onOpenChange={setInvestmentDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white border border-[#E6E8EC]">
          <DialogHeader>
            <DialogTitle className="text-[24px] font-semibold text-[#0B0F17]">Download Full Investment Deck</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvestmentCall} className="space-y-5 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="investor-first-name" className="text-[#0B0F17] font-medium text-[14px]">First Name</Label>
                <Input
                  id="investor-first-name"
                  type="text"
                  value={investorFirstName}
                  onChange={(e) => {
                    setInvestorFirstName(e.target.value);
                    if (formErrors.firstName) {
                      setFormErrors({ ...formErrors, firstName: "" });
                    }
                  }}
                  placeholder="John"
                  className={`bg-white ${formErrors.firstName ? 'border-red-500' : 'border-[#E6E8EC]'}`}
                  data-testid="input-investor-first-name"
                  required
                />
                {formErrors.firstName && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.firstName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="investor-last-name" className="text-[#0B0F17] font-medium text-[14px]">Last Name</Label>
                <Input
                  id="investor-last-name"
                  type="text"
                  value={investorLastName}
                  onChange={(e) => {
                    setInvestorLastName(e.target.value);
                    if (formErrors.lastName) {
                      setFormErrors({ ...formErrors, lastName: "" });
                    }
                  }}
                  placeholder="Smith"
                  className={`bg-white ${formErrors.lastName ? 'border-red-500' : 'border-[#E6E8EC]'}`}
                  data-testid="input-investor-last-name"
                  required
                />
                {formErrors.lastName && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.lastName}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="investor-phone" className="text-[#0B0F17] font-medium text-[14px]">Phone Number</Label>
              <Input
                id="investor-phone"
                type="tel"
                value={investorPhone}
                onChange={(e) => {
                  setInvestorPhone(e.target.value);
                  if (formErrors.phone) {
                    setFormErrors({ ...formErrors, phone: "" });
                  }
                }}
                placeholder="+44 7715 254857"
                className={`bg-white ${formErrors.phone ? 'border-red-500' : 'border-[#E6E8EC]'}`}
                data-testid="input-investor-phone"
                required
              />
              {formErrors.phone && (
                <p className="text-xs text-red-600 mt-1">{formErrors.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="investor-email" className="text-[#0B0F17] font-medium text-[14px]">Email Address</Label>
              <Input
                id="investor-email"
                type="email"
                value={investorEmail}
                onChange={(e) => {
                  setInvestorEmail(e.target.value);
                  if (formErrors.email) {
                    setFormErrors({ ...formErrors, email: "" });
                  }
                }}
                placeholder="john@example.com"
                className={`bg-white ${formErrors.email ? 'border-red-500' : 'border-[#E6E8EC]'}`}
                data-testid="input-investor-email"
                required
              />
              {formErrors.email && (
                <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>
              )}
            </div>

            <div className="border-t border-[#E6E8EC] pt-4 space-y-4">
              <p className="text-[14px] font-semibold text-[#0B0F17]">Investment Compliance (FCA Requirements)</p>
              
              <div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="high-net-worth"
                    checked={isHighNetWorth}
                    onCheckedChange={(checked) => {
                      setIsHighNetWorth(checked as boolean);
                      if (formErrors.highNetWorth) {
                        setFormErrors({ ...formErrors, highNetWorth: "" });
                      }
                    }}
                    className="mt-1 flex-shrink-0 border-2 border-[#556070]"
                    data-testid="checkbox-high-net-worth"
                  />
                  <Label 
                    htmlFor="high-net-worth" 
                    className="text-[12px] text-[#556070] leading-tight cursor-pointer"
                  >
                    <strong>High Net Worth Declaration (COBS 4.12.6R):</strong> I declare that I am a certified high net worth individual for the purposes of the Financial Services and Markets Act 2000 (Financial Promotion) Order 2005. I understand that this means: (a) I can receive financial promotions that may not have been approved by an authorised person; (b) I accept that the investment to which the promotion relates may expose me to a significant risk of losing all of the money or other property invested. I am aware that it is open to me to seek advice from an authorised person who specialises in advising on investments of this kind.
                  </Label>
                </div>
                {formErrors.highNetWorth && (
                  <p className="text-xs text-red-600 mt-2 ml-7">{formErrors.highNetWorth}</p>
                )}
              </div>

              <div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="risk-acknowledgment"
                    checked={acknowledgesRisk}
                    onCheckedChange={(checked) => {
                      setAcknowledgesRisk(checked as boolean);
                      if (formErrors.risk) {
                        setFormErrors({ ...formErrors, risk: "" });
                      }
                    }}
                    className="mt-1 flex-shrink-0 border-2 border-[#556070]"
                    data-testid="checkbox-risk-acknowledgment"
                  />
                  <Label 
                    htmlFor="risk-acknowledgment" 
                    className="text-[12px] text-[#556070] leading-tight cursor-pointer"
                  >
                    <strong>Risk Warning:</strong> I understand and acknowledge that: (1) Investing in early-stage companies carries substantial risk and I may lose <strong>ALL</strong> of my investment; (2) Such investments are highly illiquid and I may not be able to sell my shares; (3) My investment is not protected by the Financial Services Compensation Scheme; (4) I should not invest more than I can afford to lose; (5) I have received and understood this statutory risk warning.
                  </Label>
                </div>
                {formErrors.risk && (
                  <p className="text-xs text-red-600 mt-2 ml-7">{formErrors.risk}</p>
                )}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#12B8C4] hover:bg-[#0fa3ae] text-white text-lg py-6 rounded-full"
              disabled={isSubmitting || !investorFirstName || !investorLastName || !investorPhone || !investorEmail || !isHighNetWorth || !acknowledgesRisk}
              data-testid="button-submit-investment-call"
            >
              {isSubmitting ? "Processing..." : "Download Full Investment Deck"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
