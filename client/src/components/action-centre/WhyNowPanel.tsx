import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  Shield,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WhyNowPanelProps {
  actionMetadata?: any;
  compact?: boolean;
}

/**
 * WhyNowPanel - Displays AI decision explainability for action scheduling
 * 
 * Shows:
 * - Decision score
 * - Top 3 factors that influenced the scheduling decision
 * - Policy version (for A/B testing and audit trail)
 * - Guard status (frequency cap, quiet hours, etc.)
 * - Experiment variant (STATIC vs ADAPTIVE)
 */
export function WhyNowPanel({ actionMetadata, compact = false }: WhyNowPanelProps) {
  // Extract explainability data from action metadata
  const explainability = actionMetadata?.explainability || actionMetadata?.policyDecision;
  
  if (!explainability) {
    return null; // No explainability data available
  }

  const {
    score,
    factor1,
    factor2,
    factor3,
    policyVersion,
    guardStatus,
    guardReason,
    experimentVariant,
    decisionType,
  } = explainability;

  if (compact) {
    // Compact badge view for table rows
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              className="bg-purple-100 text-purple-800 border-purple-200 flex items-center gap-1 cursor-help"
              data-testid="badge-why-now"
            >
              <Brain className="h-3 w-3" />
              Why Now?
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-sm p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">Decision Score:</span>
                <Badge className="bg-green-100 text-green-800 border-0">
                  {score ? (score * 100).toFixed(0) : 'N/A'}%
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold">Top Factors:</p>
                {factor1 && <p className="text-xs">1. {factor1}</p>}
                {factor2 && <p className="text-xs">2. {factor2}</p>}
                {factor3 && <p className="text-xs">3. {factor3}</p>}
              </div>
              {experimentVariant && (
                <div className="flex items-center gap-1 text-xs">
                  <Info className="h-3 w-3" />
                  <span>{experimentVariant} scheduler</span>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full panel view
  return (
    <Card className="bg-purple-50/50 border-purple-200" data-testid="panel-why-now">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-600" />
          Why Now? Decision Explainability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Decision Score */}
        {score !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Decision Score:</span>
            <Badge className="bg-green-100 text-green-800 border-0">
              {(score * 100).toFixed(0)}%
            </Badge>
          </div>
        )}

        {/* Top 3 Factors */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Top Influencing Factors:
          </p>
          <div className="space-y-1.5 ml-5">
            {factor1 && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-purple-600 mt-0.5">1.</span>
                <p className="text-xs text-slate-700">{factor1}</p>
              </div>
            )}
            {factor2 && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-purple-600 mt-0.5">2.</span>
                <p className="text-xs text-slate-700">{factor2}</p>
              </div>
            )}
            {factor3 && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-purple-600 mt-0.5">3.</span>
                <p className="text-xs text-slate-700">{factor3}</p>
              </div>
            )}
          </div>
        </div>

        {/* Guard Status */}
        {guardStatus && (
          <div className="flex items-center justify-between pt-2 border-t border-purple-200">
            <span className="text-xs text-slate-600 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Compliance:
            </span>
            <Badge 
              className={
                guardStatus === 'allowed' 
                  ? 'bg-green-100 text-green-800 border-0 text-xs'
                  : 'bg-red-100 text-red-800 border-0 text-xs'
              }
            >
              {guardStatus === 'allowed' ? '✓ Passed' : `⚠ ${guardReason || 'Blocked'}`}
            </Badge>
          </div>
        )}

        {/* Policy Version & Experiment */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-purple-200">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Policy {policyVersion || 'v1.0'}</span>
          </div>
          {experimentVariant && (
            <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">
              {experimentVariant}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inline minimal version for table cells
 */
export function WhyNowBadge({ actionMetadata }: { actionMetadata?: any }) {
  return <WhyNowPanel actionMetadata={actionMetadata} compact={true} />;
}
