import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, MessageSquare, TrendingUp, Shield, Zap, CheckCircle, Brain, Activity, ArrowRight, Clock, DollarSign, Users, BarChart3, Target, Rocket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SiXero, SiStripe, SiOpenai, SiQuickbooks } from "react-icons/si";
import { AIResultsDialog } from "@/components/AIResultsDialog";
import qashivoLogo from "@assets/WhatsApp Image 2025-10-28 at 12.49.53_1761652236575.jpeg";
import dashboardScreenshot from "@assets/Screenshot 2025-10-13 at 13.19.17_1760519077630.png";
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
  const [smsName, setSmsName] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [smsCountryCode, setSmsCountryCode] = useState("+44");
  const [demoResults, setDemoResults] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [currentResults, setCurrentResults] = useState<any>(null);
  const [resultsType, setResultsType] = useState<"voice" | "sms">("voice");
  const lastShownResultsRef = useRef<string>("");
  const lastShownAtRef = useRef<number>(0); // Track timestamp of currently displayed result
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTransitioningRef = useRef(false);
  
  // Demo processing states for progress and dialog locking
  const [voiceProgress, setVoiceProgress] = useState<string>("");
  const [smsProgress, setSmsProgress] = useState<string>("");
  const [isDemoProcessing, setIsDemoProcessing] = useState(false);
  
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

  // Helper function to open dialog with results (avoids code duplication)
  const openDialogWithResults = (results: any, type: "voice" | "sms", resultKey: string, analyzedAt: number) => {
    setCurrentResults(results);
    setResultsType(type);
    if (type === "voice") {
      setVoiceProgress("");
    } else {
      setSmsProgress("");
    }
    setIsDemoProcessing(false);
    lastShownResultsRef.current = resultKey;
    lastShownAtRef.current = analyzedAt; // Track when this result was created
    isTransitioningRef.current = false;
    setResultsDialogOpen(true);
    
    toast({
      title: "AI Analysis Complete",
      description: `View the results of the ${type === "voice" ? "voice call" : "SMS"} analysis`,
    });
  };

  // Auto-update results when they arrive
  useEffect(() => {
    if (!demoResults) return;

    // Don't process if we're currently transitioning
    if (isTransitioningRef.current) return;

    // Update voice results if available
    if (demoResults.voiceDemoCompleted && demoResults.voiceDemoResults) {
      // Convert ISO string to numeric timestamp for comparison
      let analyzedAtMs = demoResults.voiceDemoResults.analyzedAt 
        ? new Date(demoResults.voiceDemoResults.analyzedAt).getTime()
        : Date.now();
      // Guard against invalid timestamps
      if (!Number.isFinite(analyzedAtMs)) {
        analyzedAtMs = Date.now();
      }
      const resultKey = `voice-${analyzedAtMs}`;
      
      // CRITICAL: Only process if this result is newer than what's currently displayed
      // This prevents showing old voice results after SMS has completed
      if (analyzedAtMs > lastShownAtRef.current && lastShownResultsRef.current !== resultKey) {
        // If dialog is open with different type, transition to new type
        if (resultsDialogOpen && resultsType === "sms") {
          // Clear any pending transition
          if (transitionTimeoutRef.current) {
            clearTimeout(transitionTimeoutRef.current);
          }
          
          // Mark as transitioning to prevent duplicate updates
          isTransitioningRef.current = true;
          setResultsDialogOpen(false);
          
          // Wait for dialog to close before showing new one
          transitionTimeoutRef.current = setTimeout(() => {
            openDialogWithResults(demoResults.voiceDemoResults, "voice", resultKey, analyzedAtMs);
          }, 400);
        } else if (resultsDialogOpen && resultsType === "voice") {
          // Same type already open - update results without closing
          setCurrentResults(demoResults.voiceDemoResults);
          setVoiceProgress("");
          setIsDemoProcessing(false);
          lastShownResultsRef.current = resultKey;
          lastShownAtRef.current = analyzedAtMs;
          // No toast for same-type updates to avoid spam
        } else {
          // Dialog is closed, open immediately
          openDialogWithResults(demoResults.voiceDemoResults, "voice", resultKey, analyzedAtMs);
        }
      }
    }
    
    // Update SMS results if available
    if (demoResults.smsDemoCompleted && demoResults.smsDemoResults) {
      // Convert ISO string to numeric timestamp for comparison
      let analyzedAtMs = demoResults.smsDemoResults.analyzedAt 
        ? new Date(demoResults.smsDemoResults.analyzedAt).getTime()
        : Date.now();
      // Guard against invalid timestamps
      if (!Number.isFinite(analyzedAtMs)) {
        analyzedAtMs = Date.now();
      }
      const resultKey = `sms-${analyzedAtMs}`;
      
      // CRITICAL: Only process if this result is newer than what's currently displayed
      // This prevents the dialog from flickering between old and new results
      if (analyzedAtMs > lastShownAtRef.current && lastShownResultsRef.current !== resultKey) {
        // If dialog is open with different type, transition to new type
        if (resultsDialogOpen && resultsType === "voice") {
          // Clear any pending transition
          if (transitionTimeoutRef.current) {
            clearTimeout(transitionTimeoutRef.current);
          }
          
          // Mark as transitioning to prevent duplicate updates
          isTransitioningRef.current = true;
          setResultsDialogOpen(false);
          
          // Wait for dialog to close before showing new one
          transitionTimeoutRef.current = setTimeout(() => {
            openDialogWithResults(demoResults.smsDemoResults, "sms", resultKey, analyzedAtMs);
          }, 400);
        } else if (resultsDialogOpen && resultsType === "sms") {
          // Same type already open - update results without closing
          setCurrentResults(demoResults.smsDemoResults);
          setSmsProgress("");
          setIsDemoProcessing(false);
          lastShownResultsRef.current = resultKey;
          lastShownAtRef.current = analyzedAtMs;
          // No toast for same-type updates to avoid spam
        } else {
          // Dialog is closed, open immediately
          openDialogWithResults(demoResults.smsDemoResults, "sms", resultKey, analyzedAtMs);
        }
      }
    }
    
    // Cleanup function - only clear timeouts if NOT transitioning
    // (during transition, let the timeout complete)
    return () => {
      if (transitionTimeoutRef.current && !isTransitioningRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, [demoResults, toast, resultsDialogOpen, resultsType]);

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
    
    // Clear any SMS results to prevent interference
    setDemoResults((prev: any) => prev ? {...prev, smsDemoResults: null, smsDemoCompleted: false} : null);
    
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
      
      // Open results dialog immediately with "analyzing" state
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
      toast({
        title: "Error",
        description: "Failed to initiate call. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSMSDemo = async () => {
    if (!smsPhone) return;
    
    // Clear any Voice results to prevent interference
    setDemoResults((prev: any) => prev ? {...prev, voiceDemoResults: null, voiceDemoCompleted: false} : null);
    
    // Immediate feedback - set progress and lock dialog
    setSmsProgress("Initiating...");
    setIsDemoProcessing(true);
    
    try {
      // Sanitize phone number
      const sanitizedPhone = sanitizePhoneNumber(smsPhone, smsCountryCode);
      
      // Progress update
      setTimeout(() => setSmsProgress("Connecting..."), 400);
      
      // Parallelize lead creation and demo setup
      let currentLeadId = leadId;
      
      const operations = [];
      
      // If no lead exists, create one in parallel
      if (!currentLeadId) {
        const leadPromise = fetch("/api/investor/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: smsName || "Anonymous Investor", 
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
      setTimeout(() => setSmsProgress("In progress..."), 800);
      
      // Initiate the SMS
      const response = await fetch("/api/investor/sms-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: resolvedLeadId, phone: sanitizedPhone, name: smsName }),
      });
      
      if (!response.ok) throw new Error("Failed to send SMS");
      
      // Open results dialog immediately with "waiting" state
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
      toast({
        title: "Error",
        description: "Failed to send SMS. Please try again.",
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
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-start">
            <div className="flex items-center gap-3">
              <img 
                src={qashivoLogo} 
                alt="Qashivo Logo" 
                className="h-10 w-auto"
                data-testid="img-qashivo-logo"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 md:pt-20 pb-16 md:pb-32 px-6 bg-gradient-to-br from-[#0E131F]/5 via-white to-[#17B6C3]/10">
        <div className="max-w-7xl mx-auto">
          {/* Centered Hero Content */}
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-[#17B6C3]/10 rounded-full mb-6">
              <span className="text-[#17B6C3] font-semibold">SEIS-Eligible Investment Opportunity (pending HMRC approval)</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              AI That Turns Late Payments Into<br />
              <span className="text-[#17B6C3]">Automated Cashflow</span>
            </h1>
            <p className="text-xl text-gray-600 mb-4 leading-relaxed max-w-4xl mx-auto">
              The UK's first AI-powered credit control platform built on statutory rights. 
              Transforming the £11B late payment crisis into predictable revenue.
            </p>
            <p className="text-xl text-gray-600 mb-[40px] leading-relaxed max-w-4xl mx-auto">
              <strong>We're not just automating credit control. We're creating a learning brain for SME finance.</strong>
            </p>
          </div>

          {/* Two-column layout: Video left, Form right */}
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Video */}
            <div className="relative space-y-6">
              <div className="aspect-video rounded-2xl shadow-2xl overflow-hidden border border-gray-300">
                <video 
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                  onPlay={() => {
                    setIsVideoPlaying(true);
                    // Always unmute when video plays (handles both autoplay and manual play)
                    if (videoRef.current) {
                      videoRef.current.muted = false;
                    }
                  }}
                >
                  <source src="/media/QashivoIntrov2.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Compelling Copy Section */}
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  The Future of B2B Credit Control
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  This is more than automation; it's intelligent learning that gets smarter with every interaction. 
                  Our AI doesn't just send reminders; it detects intent, predicts payment behavior, and creates 
                  statutory-compliant escalation paths automatically. The result? <strong>40% faster collections</strong>, 
                  <strong>95% forecast accuracy</strong>, and <strong>zero manual intervention</strong>.
                </p>
              </div>
            </div>

            {/* Form */}
            <div id="dataroom-form" className="relative space-y-4">
              <h3 className="text-2xl font-bold text-gray-900 text-center">
                Access Investment Dataroom
              </h3>
              <div className="rounded-2xl shadow-2xl overflow-hidden bg-white" style={{ minHeight: '544px' }}>
                <iframe
                  src="https://api.leadconnectorhq.com/widget/form/NRFTMQnqftGVqumexWwm"
                  style={{ width: '100%', height: '100%', minHeight: '544px', border: 'none', borderRadius: '3px' }}
                  id="inline-NRFTMQnqftGVqumexWwm" 
                  data-layout="{'id':'INLINE'}"
                  data-trigger-type="alwaysShow"
                  data-trigger-value=""
                  data-activation-type="alwaysActivated"
                  data-activation-value=""
                  data-deactivation-type="neverDeactivate"
                  data-deactivation-value=""
                  data-form-name="Qashivo.ai form page for dataroom"
                  data-height="544"
                  data-layout-iframe-id="inline-NRFTMQnqftGVqumexWwm"
                  data-form-id="NRFTMQnqftGVqumexWwm"
                  title="Qashivo.ai form page for dataroom"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-6 md:py-12 px-6 border-y border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm text-gray-500 mb-6">BUILT WITH ENTERPRISE-GRADE INTEGRATIONS</p>
          <div className="flex items-center justify-center gap-12 flex-wrap">
            <div className="flex items-center gap-2 text-gray-600">
              <SiXero className="w-8 h-8" />
              <span className="font-semibold">Xero</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <SiQuickbooks className="w-8 h-8" />
              <span className="font-semibold">QuickBooks</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <SiStripe className="w-8 h-8" />
              <span className="font-semibold">Stripe</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <SiOpenai className="w-8 h-8" />
              <span className="font-semibold">OpenAI</span>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-12 md:py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">The £11 Billion Problem</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Late payments are killing UK SMEs. Manual credit control is inefficient, non-compliant, and emotionally draining.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 border-2 border-[#8B2635]/30 bg-[#8B2635]/5 text-center" data-testid="card-problem-cost">
              <div className="w-12 h-12 bg-[#8B2635] rounded-lg flex items-center justify-center mb-4 mx-auto">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-problem-amount">£11B Lost</h3>
              <p className="text-gray-600 mb-4">Annual cost to UK SMEs from late payments</p>
              <div className="text-4xl font-bold text-[#8B2635]" data-testid="text-failures-count">14,000</div>
              <p className="text-sm text-gray-500">Businesses fail each year due to late payments</p>
            </Card>

            <Card className="p-8 border-2 border-[#8B2635]/30 bg-[#8B2635]/5 text-center" data-testid="card-problem-dso">
              <div className="w-12 h-12 bg-[#8B2635] rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-dso-days">64 Days</h3>
              <p className="text-gray-600 mb-4">Average DSO for UK SMEs</p>
              <div className="text-4xl font-bold text-[#8B2635]" data-testid="text-payment-multiplier">2x</div>
              <p className="text-sm text-gray-500">Payment terms exceeded</p>
            </Card>

            <Card className="p-8 border-2 border-[#A98743]/30 bg-[#A98743]/5 text-center" data-testid="card-problem-compliance">
              <div className="w-12 h-12 bg-[#A98743] rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-compliance-rate">100% Must Comply</h3>
              <p className="text-gray-600 mb-4">Late Payment Act becomes mandatory</p>
              <div className="text-4xl font-bold text-[#A98743]" data-testid="text-solutions-count">0</div>
              <p className="text-sm text-gray-500">Current compliant solutions</p>
            </Card>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className="py-12 md:py-24 px-6 bg-gradient-to-br from-gray-50 to-[#0E131F]/5">
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
                      Built on the Late Payment Act and the most recent updates. Automated interest calculations, statutory notices, and escalation pathways.
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
                <div className="text-center p-3 bg-[#A98743]/5 rounded-lg" data-testid="card-solution-accuracy">
                  <p className="text-2xl font-bold text-[#A98743]" data-testid="text-accuracy-rate">95%</p>
                  <p className="text-xs text-gray-600">Forecast Accuracy</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg" data-testid="card-solution-dso">
                  <p className="text-2xl font-bold text-[#0E131F]" data-testid="text-dso-reduction">-40%</p>
                  <p className="text-xs text-gray-600">DSO Reduction</p>
                </div>
                <div className="text-center p-3 bg-[#8B2635]/5 rounded-lg" data-testid="card-solution-time">
                  <p className="text-2xl font-bold text-[#8B2635]" data-testid="text-time-saved">85%</p>
                  <p className="text-xs text-gray-600">Time Saved</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live AI Demos */}
      <section id="demos" className="py-12 md:py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 mb-12">
              {/* Voice Demo */}
              <Card className="p-8 border-2 border-[#8B2635]/30 bg-gradient-to-br from-[#8B2635]/5 to-blue-50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-[#8B2635] rounded-xl">
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-gray-700 font-medium">First Name</Label>
                      <Input
                        type="text"
                        value={voiceName.split(' ')[0] || ''}
                        onChange={(e) => {
                          const lastName = voiceName.split(' ').slice(1).join(' ');
                          setVoiceName(lastName ? `${e.target.value} ${lastName}` : e.target.value);
                        }}
                        placeholder="John"
                        className="mt-1 bg-white border-gray-300"
                        data-testid="input-voice-first-name"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-700 font-medium">Last Name</Label>
                      <Input
                        type="text"
                        value={voiceName.split(' ').slice(1).join(' ') || ''}
                        onChange={(e) => {
                          const firstName = voiceName.split(' ')[0] || '';
                          setVoiceName(`${firstName} ${e.target.value}`.trim());
                        }}
                        placeholder="Smith"
                        className="mt-1 bg-white border-gray-300"
                        data-testid="input-voice-last-name"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-700 font-medium">Your Phone Number</Label>
                    <div className="flex gap-2 mt-1">
                      <Select value={voiceCountryCode} onValueChange={setVoiceCountryCode}>
                        <SelectTrigger className="w-[160px] bg-white border-gray-300" data-testid="select-voice-country">
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
                        className="flex-1 bg-white border-gray-300"
                        data-testid="input-voice-phone"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleVoiceDemo}
                    disabled={!voicePhone}
                    className="w-full bg-[#8B2635] hover:bg-purple-700 text-white text-lg py-6"
                    data-testid="button-start-voice-demo"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Call Me Now
                  </Button>
                  <p className="text-sm text-gray-600 text-center">
                    You'll receive a call from +1 (586) 244-8999
                  </p>
                </div>
              </Card>

              {/* SMS Demo */}
              <Card className="p-8 border-2 border-[#A98743]/30 bg-gradient-to-br from-[#A98743]/5 to-teal-50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-[#A98743] rounded-xl">
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
                    <Label className="text-gray-700 font-medium">Your Name</Label>
                    <Input
                      type="text"
                      value={smsName}
                      onChange={(e) => setSmsName(e.target.value)}
                      placeholder="John Smith"
                      className="mt-1 bg-white border-gray-300"
                      data-testid="input-sms-name"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 font-medium">Your Phone Number</Label>
                    <div className="flex gap-2 mt-1">
                      <Select value={smsCountryCode} onValueChange={setSmsCountryCode}>
                        <SelectTrigger className="w-[160px] bg-white border-gray-300" data-testid="select-sms-country">
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
                        value={smsPhone}
                        onChange={(e) => setSmsPhone(e.target.value)}
                        placeholder="07715 254857"
                        className="flex-1 bg-white border-gray-300"
                        data-testid="input-sms-phone"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSMSDemo}
                    disabled={!smsPhone}
                    className="w-full bg-[#A98743] hover:bg-green-700 text-white text-lg py-6"
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

        </div>
      </section>

      {/* Market Opportunity */}
      <section className="py-12 md:py-24 px-6 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">A £4.8B Market Made Mandatory by Law</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              The Late Payment Act creates a massive, defensible opportunity with regulatory tailwinds
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="p-8 text-center border-2 border-blue-200 bg-white" data-testid="card-market-tam">
              <Target className="w-12 h-12 text-[#0E131F] mx-auto mb-4" />
              <div className="text-5xl font-bold text-[#0E131F] mb-2" data-testid="text-tam-count">2.7M</div>
              <p className="text-xl font-semibold text-gray-900 mb-2">UK SMEs (TAM)</p>
              <p className="text-gray-600" data-testid="text-tam-value">£4.8B Total Market</p>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">Every business needs credit control</p>
              </div>
            </Card>

            <Card className="p-8 text-center border-2 border-purple-200 bg-white" data-testid="card-market-sam">
              <Users className="w-12 h-12 text-[#8B2635] mx-auto mb-4" />
              <div className="text-5xl font-bold text-[#8B2635] mb-2" data-testid="text-sam-count">800K</div>
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
                <p className="text-sm text-gray-500">200+ pre-launch inquiries</p>
              </div>
            </Card>
          </div>

          <Card className="p-8 bg-white border-2 border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Why We'll Win</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#A98743]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-8 h-8 text-[#A98743]" />
                </div>
                <p className="font-semibold text-gray-900 mb-2">Legal Moat</p>
                <p className="text-sm text-gray-600">Built on the Late Payment Act - competitors can't replicate statutory compliance</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-8 h-8 text-[#8B2635]" />
                </div>
                <p className="font-semibold text-gray-900 mb-2">AI Advantage</p>
                <p className="text-sm text-gray-600">AI models developed using £70M+ pilot dataset</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-8 h-8 text-[#0E131F]" />
                </div>
                <p className="font-semibold text-gray-900 mb-2">First Mover</p>
                <p className="text-sm text-gray-600">No compliant AI solution exists - we own the category</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Traction */}
      <section className="py-12 md:py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-[#A98743]/10 rounded-full mb-4">
              <span className="text-[#A98743] font-semibold">DEVELOPMENT PROGRESS</span>
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Market Validation</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Positive pilot feedback and strong market interest across target segments
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <Card className="p-6 text-center bg-gradient-to-br from-[#A98743]/5 to-[#A98743]/10 border-[#A98743]/30" data-testid="card-traction-waitlist">
              <TrendingUp className="w-10 h-10 text-[#A98743] mx-auto mb-3" />
              <div className="text-4xl font-bold text-[#A98743] mb-1" data-testid="text-waitlist-count">200+</div>
              <p className="text-gray-700 font-medium">Product Inquiries</p>
            </Card>

            <Card className="p-6 text-center bg-gradient-to-br from-[#0E131F]/5 to-[#17B6C3]/10 border-[#0E131F]/30" data-testid="card-traction-customers">
              <Users className="w-10 h-10 text-[#0E131F] mx-auto mb-3" />
              <div className="text-4xl font-bold text-[#0E131F] mb-1" data-testid="text-beta-customers">12</div>
              <p className="text-gray-700 font-medium">Development Testers</p>
            </Card>

            <Card className="p-6 text-center bg-gradient-to-br from-[#8B2635]/5 to-[#8B2635]/10 border-[#8B2635]/30" data-testid="card-traction-invoices">
              <DollarSign className="w-10 h-10 text-[#8B2635] mx-auto mb-3" />
              <div className="text-4xl font-bold text-[#8B2635] mb-1" data-testid="text-invoices-managed">£70M+</div>
              <p className="text-gray-700 font-medium">Pilot Data Processed</p>
            </Card>

            <Card className="p-6 text-center bg-gradient-to-br from-orange-50 to-red-50 border-[#8B2635]/30" data-testid="card-traction-dso">
              <BarChart3 className="w-10 h-10 text-[#8B2635] mx-auto mb-3" />
              <div className="text-4xl font-bold text-[#8B2635] mb-1" data-testid="text-avg-dso-reduction">40%</div>
              <p className="text-gray-700 font-medium">Trial DSO Improvement</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-12 md:py-24 px-6 bg-gradient-to-br from-[#17B6C3] to-teal-700">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-white mb-6">
            Join the £4.8B Opportunity
          </h2>
          <p className="text-2xl text-blue-100 mb-8">
            SEIS-eligible (pending HMRC approval) | 200+ market inquiries | Xero integration ready
          </p>
          <div className="flex justify-center">
            <Button
              className="bg-[#A98743] hover:bg-[#8B7035] text-white text-xl px-12 py-7 shadow-xl"
              onClick={() => {
                const element = document.getElementById('dataroom-form');
                if (element) {
                  const headerOffset = 100; // Account for sticky header + some padding
                  const elementPosition = element.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }
              }}
              data-testid="button-access-dataroom-footer"
            >
              Access Investment Dataroom
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-gray-900 text-center">
        <p className="text-gray-400">
          © 2025 Qashivo. Built in London. Backed by innovation.
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
        progressMessage={resultsType === "voice" ? voiceProgress : smsProgress}
      />

      {/* Investment Call Dialog */}
      <Dialog open={investmentDialogOpen} onOpenChange={setInvestmentDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">Download Full Investment Deck</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvestmentCall} className="space-y-5 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="investor-first-name" className="text-gray-700 font-medium">First Name</Label>
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
                  className={`bg-white ${formErrors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                  data-testid="input-investor-first-name"
                  required
                />
                {formErrors.firstName && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.firstName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="investor-last-name" className="text-gray-700 font-medium">Last Name</Label>
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
                  className={`bg-white ${formErrors.lastName ? 'border-red-500' : 'border-gray-300'}`}
                  data-testid="input-investor-last-name"
                  required
                />
                {formErrors.lastName && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.lastName}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="investor-phone" className="text-gray-700 font-medium">Phone Number</Label>
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
                className={`bg-white ${formErrors.phone ? 'border-red-500' : 'border-gray-300'}`}
                data-testid="input-investor-phone"
                required
              />
              {formErrors.phone && (
                <p className="text-xs text-red-600 mt-1">{formErrors.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="investor-email" className="text-gray-700 font-medium">Email Address</Label>
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
                className={`bg-white ${formErrors.email ? 'border-red-500' : 'border-gray-300'}`}
                data-testid="input-investor-email"
                required
              />
              {formErrors.email && (
                <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-4">
              <p className="text-sm font-semibold text-gray-900">Investment Compliance (FCA Requirements)</p>
              
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
                    className="mt-1 flex-shrink-0 border-2 border-gray-600"
                    data-testid="checkbox-high-net-worth"
                  />
                  <Label 
                    htmlFor="high-net-worth" 
                    className="text-xs text-gray-700 leading-tight cursor-pointer"
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
                    className="mt-1 flex-shrink-0 border-2 border-gray-600"
                    data-testid="checkbox-risk-acknowledgment"
                  />
                  <Label 
                    htmlFor="risk-acknowledgment" 
                    className="text-xs text-gray-700 leading-tight cursor-pointer"
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
              className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg py-6"
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
