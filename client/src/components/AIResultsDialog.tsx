import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Brain, TrendingUp, CheckCircle2, AlertCircle, MessageSquare, Phone, UserCheck, Search, PhoneCall } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AIResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: {
    intent?: string;
    sentiment?: string;
    confidence?: number;
    keyInsights?: string[];
    actionItems?: string[];
    summary?: string;
    transcript?: string;
  } | null;
  type: "voice" | "sms";
}

const sentimentColors = {
  positive: "from-green-500/20 to-emerald-500/10 border-green-500/50 text-green-400",
  cooperative: "from-blue-500/20 to-cyan-500/10 border-blue-500/50 text-blue-400",
  neutral: "from-slate-500/20 to-gray-500/10 border-slate-500/50 text-slate-400",
  negative: "from-orange-500/20 to-amber-500/10 border-orange-500/50 text-orange-400",
  hostile: "from-red-500/20 to-rose-500/10 border-red-500/50 text-red-400",
};

const intentIcons = {
  payment_plan: TrendingUp,
  dispute: AlertCircle,
  promise_to_pay: CheckCircle2,
  general_query: MessageSquare,
  paid: CheckCircle2,
  unknown: Brain,
};

export function AIResultsDialog({ open, onOpenChange, results, type }: AIResultsDialogProps) {
  const [animatedConfidence, setAnimatedConfidence] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (open && results) {
      // Animate confidence meter
      const targetConfidence = results.confidence || 0;
      let current = 0;
      const increment = targetConfidence / 50;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= targetConfidence) {
          setAnimatedConfidence(targetConfidence);
          clearInterval(timer);
        } else {
          setAnimatedConfidence(Math.floor(current));
        }
      }, 20);

      // Show content with delay
      setTimeout(() => setShowContent(true), 300);

      return () => {
        clearInterval(timer);
        setShowContent(false);
        setAnimatedConfidence(0);
      };
    }
  }, [open, results]);

  if (!results) return null;

  const sentiment = results.sentiment || "neutral";
  const sentimentColor = sentimentColors[sentiment as keyof typeof sentimentColors] || sentimentColors.neutral;
  const IntentIcon = intentIcons[results.intent as keyof typeof intentIcons] || Brain;
  const confidenceColor = animatedConfidence >= 80 ? "text-green-400" : animatedConfidence >= 60 ? "text-blue-400" : "text-orange-400";
  
  // Check if analysis is still in progress
  const inProgressStates = ["analyzing", "listening", "waiting"];
  const isInProgress = results.intent && inProgressStates.includes(results.intent);
  const dialogTitle = isInProgress ? "AI Analysis - In Progress" : "AI Analysis Complete";

  // Define AI Next Actions based on intent
  const nextActions: Record<string, { icon: any; title: string; description: string; color: string; type: string }> = {
    payment_plan: {
      icon: Phone,
      title: "AI Call Scheduled",
      description: "Automated call to negotiate payment plan terms and establish feasible schedule",
      color: "from-[#17B6C3]/20 to-[#17B6C3]/5 border-[#17B6C3]/40",
      type: "AI Automation"
    },
    paid: {
      icon: Search,
      title: "AI Verification Queued",
      description: "Cross-checking payment against Xero invoices and bank statements via Open Banking",
      color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40",
      type: "AI Verification"
    },
    dispute: {
      icon: UserCheck,
      title: "Human Escalation Created",
      description: "Dispute flagged for personal follow-up to preserve customer relationship and resolve concerns",
      color: "from-amber-500/20 to-amber-500/5 border-amber-500/40",
      type: "Human Required"
    },
    unknown: {
      icon: PhoneCall,
      title: "AI Call Required",
      description: "Intent unclear - automated call scheduled to clarify customer needs and capture accurate information",
      color: "from-blue-500/20 to-blue-500/5 border-blue-500/40",
      type: "AI Clarification"
    },
    general_query: {
      icon: PhoneCall,
      title: "AI Call Required",
      description: "General query detected - automated call to understand and address customer question",
      color: "from-blue-500/20 to-blue-500/5 border-blue-500/40",
      type: "AI Clarification"
    }
  };

  const currentAction = nextActions[results.intent as string] || nextActions.unknown;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-[#17B6C3]/30 shadow-2xl shadow-[#17B6C3]/20"
        data-testid="dialog-ai-results"
      >
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(23,182,195,0.1),transparent)]" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#17B6C3] to-transparent animate-pulse" />
        </div>

        <DialogHeader className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-[#17B6C3]/20 rounded-xl border border-[#17B6C3]/30">
              <Sparkles className="w-6 h-6 text-[#17B6C3]" data-testid="icon-sparkles" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-white" data-testid="text-dialog-title">
                {dialogTitle}
              </DialogTitle>
              <p className="text-sm text-slate-400 mt-1" data-testid="text-analysis-type">
                {type === "voice" ? "Voice Call" : "SMS"} Intelligence Report
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className={cn(
          "relative space-y-6 transition-all duration-700",
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>
          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-3 gap-4">
            {/* Intent Card */}
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:border-[#17B6C3]/30 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <IntentIcon className="w-5 h-5 text-[#17B6C3]" data-testid="icon-intent" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Intent</span>
              </div>
              <p className="text-lg font-bold text-white capitalize" data-testid="text-intent-value">
                {results.intent?.replace(/_/g, " ")}
              </p>
            </div>

            {/* Sentiment Card */}
            <div className={cn(
              "p-4 backdrop-blur-sm border rounded-xl bg-gradient-to-br transition-all duration-500",
              sentimentColor
            )}>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5" data-testid="icon-sentiment" />
                <span className="text-xs font-medium uppercase tracking-wide opacity-80">Sentiment</span>
              </div>
              <p className="text-lg font-bold capitalize" data-testid="text-sentiment-value">
                {sentiment}
              </p>
            </div>

            {/* Confidence Card */}
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-[#17B6C3]" data-testid="icon-confidence" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Confidence</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-2xl font-bold", confidenceColor)} data-testid="text-confidence-value">
                  {animatedConfidence}%
                </span>
                <Progress 
                  value={animatedConfidence} 
                  className="flex-1 h-2 bg-white/10"
                  data-testid="progress-confidence"
                />
              </div>
            </div>
          </div>

          {/* AI Next Action */}
          {!isInProgress && currentAction && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#17B6C3]" />
                AI Next Action
              </h3>
              <div className={cn(
                "relative p-4 backdrop-blur-sm border rounded-xl bg-gradient-to-br transition-all duration-500 animate-pulse",
                currentAction.color
              )}
              data-testid="next-action-card">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/10 rounded-lg flex-shrink-0">
                    <currentAction.icon className="w-5 h-5 text-white" data-testid="icon-next-action" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-lg font-bold text-white" data-testid="text-next-action-title">
                        {currentAction.title}
                      </h4>
                      <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs" data-testid="badge-action-type">
                        {currentAction.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed" data-testid="text-next-action-description">
                      {currentAction.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span className="text-xs text-white/60 font-medium">Queued</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {results.summary && (
            <div className="p-4 bg-gradient-to-r from-[#17B6C3]/10 to-transparent border-l-4 border-[#17B6C3] rounded-r-xl">
              <h3 className="text-sm font-semibold text-[#17B6C3] mb-2 uppercase tracking-wide" data-testid="text-summary-title">
                Executive Summary
              </h3>
              <p className="text-white/90 leading-relaxed" data-testid="text-summary-content">
                {results.summary}
              </p>
            </div>
          )}

          {/* Key Insights */}
          {results.keyInsights && results.keyInsights.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#17B6C3]" />
                Key Insights
              </h3>
              <div className="space-y-2">
                {results.keyInsights.map((insight, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                    data-testid={`insight-item-${idx}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#17B6C3]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-[#17B6C3]">{idx + 1}</span>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed" data-testid={`text-insight-${idx}`}>
                      {insight}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {results.actionItems && results.actionItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#17B6C3]" />
                Recommended Actions
              </h3>
              <div className="space-y-2">
                {results.actionItems.map((action, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-500/10 to-transparent border-l-2 border-emerald-500/50 rounded-r-lg"
                    data-testid={`action-item-${idx}`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-sm text-white/80" data-testid={`text-action-${idx}`}>
                      {action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript Preview */}
          {results.transcript && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#17B6C3]" />
                Transcript
              </h3>
              <div className="p-4 bg-black/30 border border-white/10 rounded-xl max-h-32 overflow-y-auto custom-scrollbar">
                <p className="text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap" data-testid="text-transcript">
                  {results.transcript}
                </p>
              </div>
            </div>
          )}

          {/* Tech Badge */}
          <div className="flex items-center justify-center gap-2 pt-4 border-t border-white/10">
            <Badge variant="outline" className="bg-[#17B6C3]/10 border-[#17B6C3]/30 text-[#17B6C3] text-xs" data-testid="badge-tech">
              <Sparkles className="w-3 h-3 mr-1" />
              Powered by GPT-4o-mini
            </Badge>
            <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300 text-xs" data-testid="badge-realtime">
              Real-time Analysis
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
