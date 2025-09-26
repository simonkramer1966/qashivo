import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  Brain, 
  Eye,
  Zap,
  TrendingUp,
  Users,
  MessageSquare,
  Calendar,
  Loader2,
  Sparkles
} from "lucide-react";

interface AIReviewLaunchPhaseProps {
  onComplete: () => void;
  onUpdate: (data: any) => void;
  isCompleting: boolean;
  phaseData: any;
}

export function AIReviewLaunchPhase({ 
  onComplete, 
  onUpdate, 
  isCompleting, 
  phaseData 
}: AIReviewLaunchPhaseProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActivating, setIsActivating] = useState(false);
  const { toast } = useToast();
  
  const aiData = phaseData.ai_review_launch || {};
  
  // Simulated AI analysis data
  const [aiProfiles] = useState(
    aiData.aiProfiles || {
      generated: 42,
      reviewed: 35,
      approved: 0
    }
  );

  const [workflowRecommendations] = useState(
    aiData.workflowRecommendations || [
      {
        type: "Email Sequence Optimization",
        confidence: 92,
        approved: false,
        description: "AI suggests a 3-email sequence for new customers based on your industry patterns"
      },
      {
        type: "Payment Reminder Timing",
        confidence: 87,
        approved: false,
        description: "Optimal reminder timing: Day 1, Day 7, Day 14 after due date"
      },
      {
        type: "Customer Segmentation Rules",
        confidence: 95,
        approved: false,
        description: "Automatic risk scoring based on payment history and industry patterns"
      },
      {
        type: "Escalation Triggers", 
        confidence: 89,
        approved: false,
        description: "Auto-escalate to phone calls for invoices >$500 after 21 days"
      }
    ]
  );

  const [automationSettings, setAutomationSettings] = useState({
    automationActivated: aiData.automationActivated || false,
    firstCollectionScheduled: aiData.firstCollectionScheduled || false
  });

  const handleApproveRecommendation = (index: number) => {
    const updatedRecommendations = [...workflowRecommendations];
    updatedRecommendations[index].approved = !updatedRecommendations[index].approved;
    
    // Update phase data
    onUpdate({
      ai_review_launch: {
        ...aiData,
        workflowRecommendations: updatedRecommendations,
        aiProfiles: {
          ...aiProfiles,
          approved: aiProfiles.approved + (updatedRecommendations[index].approved ? 1 : -1)
        }
      }
    });

    toast({
      title: updatedRecommendations[index].approved ? "Recommendation Approved" : "Approval Removed",
      description: "AI recommendations updated successfully."
    });
  };

  const handleActivateAutomation = async () => {
    setIsActivating(true);
    
    // Simulate automation activation
    setTimeout(() => {
      setAutomationSettings({
        automationActivated: true,
        firstCollectionScheduled: true
      });
      
      onUpdate({
        ai_review_launch: {
          ...aiData,
          automationActivated: true,
          firstCollectionScheduled: true,
          aiProfiles: {
            ...aiProfiles,
            approved: workflowRecommendations.filter((r: any) => r.approved).length
          }
        }
      });
      
      setIsActivating(false);
      toast({
        title: "🚀 Automation Activated!",
        description: "Your AI collections system is now live and working."
      });
    }, 2000);
  };

  const approvedCount = workflowRecommendations.filter((r: any) => r.approved).length;
  const canComplete = automationSettings.automationActivated && automationSettings.firstCollectionScheduled;

  return (
    <div className="space-y-6" data-testid="ai-review-launch-phase">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">AI Analysis & Launch</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Our AI has analyzed your data and generated personalized recommendations. 
          Review these suggestions and activate your automated collections system.
        </p>
      </div>

      {/* AI Analysis Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            AI Analysis Complete
          </CardTitle>
          <CardDescription>
            Based on your imported data and business setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white/50 rounded-lg">
              <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{aiProfiles.generated}</div>
              <div className="text-sm text-gray-600">Customer Profiles</div>
              <div className="text-xs text-gray-500">Generated from Xero data</div>
            </div>
            <div className="text-center p-4 bg-white/50 rounded-lg">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-green-600">4</div>
              <div className="text-sm text-gray-600">AI Recommendations</div>
              <div className="text-xs text-gray-500">Customized for your business</div>
            </div>
            <div className="text-center p-4 bg-white/50 rounded-lg">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-bold text-purple-600">91%</div>
              <div className="text-sm text-gray-600">Avg Confidence</div>
              <div className="text-xs text-gray-500">High accuracy predictions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <Card className="bg-white/70 backdrop-blur-md border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#17B6C3]" />
            Review AI Recommendations
          </CardTitle>
          <CardDescription>
            Approve the AI suggestions that make sense for your business
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflowRecommendations.map((recommendation: any, index: number) => (
            <div 
              key={index}
              className={`p-4 rounded-lg border transition-all ${
                recommendation.approved 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-white border-gray-200 hover:border-[#17B6C3]/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold">{recommendation.type}</h4>
                    <Badge 
                      variant="secondary" 
                      className={`${
                        recommendation.confidence >= 90 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {recommendation.confidence}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {recommendation.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`recommendation-${index}`}
                      checked={recommendation.approved}
                      onCheckedChange={() => handleApproveRecommendation(index)}
                    />
                    <Label htmlFor={`recommendation-${index}`} className="text-sm">
                      {recommendation.approved ? 'Approved' : 'Approve this recommendation'}
                    </Label>
                  </div>
                </div>
                {recommendation.approved && (
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-1" />
                )}
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {approvedCount} of {workflowRecommendations.length} recommendations approved
              </span>
              <Progress value={(approvedCount / workflowRecommendations.length) * 100} className="w-32 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automation Activation */}
      <Card className="bg-white/70 backdrop-blur-md border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#17B6C3]" />
            Activate Collections Automation
          </CardTitle>
          <CardDescription>
            Launch your AI-powered collections system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!automationSettings.automationActivated ? (
            <div className="text-center py-8">
              <div className="p-4 bg-blue-50 rounded-lg inline-block mb-4">
                <Zap className="w-12 h-12 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Ready to Launch!</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Your AI collections system is configured and ready. Click below to activate 
                automation and start improving your cash flow.
              </p>
              
              <Button
                onClick={handleActivateAutomation}
                disabled={isActivating || approvedCount === 0}
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white px-8 py-3 text-lg"
                data-testid="button-activate-automation"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Activating Automation...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Activate AI Collections
                  </>
                )}
              </Button>
              
              {approvedCount === 0 && (
                <p className="text-sm text-amber-600 mt-3">
                  Please approve at least one AI recommendation before activating
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <div>
                  <h4 className="font-semibold text-green-800">Automation Activated!</h4>
                  <p className="text-sm text-green-700">
                    Your AI collections system is now live and processing overdue accounts.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-blue-600 mb-2" />
                  <h5 className="font-medium text-blue-800">Email Automation</h5>
                  <p className="text-sm text-blue-700">Active and sending personalized reminders</p>
                </div>
                
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-purple-600 mb-2" />
                  <h5 className="font-medium text-purple-800">Next Collection Run</h5>
                  <p className="text-sm text-purple-700">Scheduled for tomorrow at 9:00 AM</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion */}
      {canComplete && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500 text-white rounded-lg">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">
                  🎉 Onboarding Complete!
                </h3>
                <p className="text-green-700 text-sm">
                  Your AI collections platform is fully configured and operational. 
                  You're now ready to improve cash flow automatically!
                </p>
              </div>
              <Button 
                onClick={onComplete}
                disabled={isCompleting}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-complete-ai-phase"
              >
                {isCompleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Complete Onboarding
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AIReviewLaunchPhase;