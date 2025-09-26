import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  ArrowRight, 
  ArrowLeft, 
  Zap, 
  Building2, 
  Palette, 
  Brain,
  Loader2
} from "lucide-react";

// Phase Components (simplified for now, will be expanded)
import { TechnicalConnectionPhase } from "./onboarding/TechnicalConnectionPhase";
import BusinessSetupPhase from "./onboarding/BusinessSetupPhase";
import BrandCustomizationPhase from "./onboarding/BrandCustomizationPhase";
import AIReviewLaunchPhase from "./onboarding/AIReviewLaunchPhase";

export type OnboardingPhase = 'technical_connection' | 'business_setup' | 'brand_customization' | 'ai_review_launch';

interface OnboardingStats {
  currentPhase: OnboardingPhase;
  completedPhases: string[];
  totalPhases: number;
  progressPercentage: number;
  estimatedTimeRemaining: number;
}

interface OnboardingProgress {
  id: string;
  tenantId: string;
  currentPhase: OnboardingPhase;
  completedPhases: string[];
  phaseData: Record<string, any>;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface OnboardingData {
  progress: OnboardingProgress;
  stats: OnboardingStats;
}

const PHASE_CONFIG = {
  technical_connection: {
    title: "Technical Connection",
    description: "Connect your accounting system and import data",
    icon: Zap,
    estimatedTime: 2,
    color: "bg-blue-500"
  },
  business_setup: {
    title: "Business Setup", 
    description: "Configure your collections strategy and team",
    icon: Building2,
    estimatedTime: 20,
    color: "bg-green-500"
  },
  brand_customization: {
    title: "Brand Customization",
    description: "Personalize your customer experience",
    icon: Palette,
    estimatedTime: 5,
    color: "bg-purple-500"
  },
  ai_review_launch: {
    title: "AI Review & Launch",
    description: "Review AI recommendations and activate automation",
    icon: Brain,
    estimatedTime: 8,
    color: "bg-orange-500"
  }
} as const;

export function OnboardingWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch onboarding progress
  const { data: onboardingData, isLoading } = useQuery<OnboardingData>({
    queryKey: ['/api/onboarding/progress'],
    retry: 1
  });

  // Complete phase mutation
  const completePhase = useMutation({
    mutationFn: (phase: OnboardingPhase) => 
      fetch('/api/onboarding/complete-phase', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase })
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/progress'] });
      toast({
        title: "Phase Completed",
        description: "Great progress! Moving to the next phase."
      });
    }
  });

  // Update phase progress mutation
  const updateProgress = useMutation({
    mutationFn: ({ phase, data }: { phase: OnboardingPhase; data: any }) =>
      fetch('/api/onboarding/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, data })
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/progress'] });
    }
  });

  const phases = Object.keys(PHASE_CONFIG) as OnboardingPhase[];
  const currentPhase = phases[currentStepIndex];
  const progress = onboardingData?.progress;
  const stats = onboardingData?.stats;

  // Update current step based on progress
  useEffect(() => {
    if (stats && phases.indexOf(stats.currentPhase) !== currentStepIndex) {
      setCurrentStepIndex(phases.indexOf(stats.currentPhase));
    }
  }, [stats, phases, currentStepIndex]);

  const handlePhaseComplete = async () => {
    if (!currentPhase) return;
    
    try {
      await completePhase.mutateAsync(currentPhase);
      if (currentStepIndex < phases.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      }
    } catch (error) {
      toast({
        title: "Phase Completion Failed",
        description: "Please ensure all requirements are met.",
        variant: "destructive"
      });
    }
  };

  const handleUpdatePhaseData = (data: any) => {
    if (!currentPhase) return;
    updateProgress.mutate({ phase: currentPhase, data });
  };

  const renderPhaseComponent = () => {
    const commonProps = {
      onComplete: handlePhaseComplete,
      onUpdate: handleUpdatePhaseData,
      isCompleting: completePhase.isPending,
      phaseData: progress?.phaseData || {}
    };

    switch (currentPhase) {
      case 'technical_connection':
        return <TechnicalConnectionPhase {...commonProps} />;
      case 'business_setup':
        return <BusinessSetupPhase {...commonProps} />;
      case 'brand_customization':
        return <BrandCustomizationPhase {...commonProps} />;
      case 'ai_review_launch':
        return <AIReviewLaunchPhase {...commonProps} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8">
          <div className="flex items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#17B6C3]" />
            <div>
              <h2 className="text-xl font-bold">Loading Onboarding</h2>
              <p className="text-gray-600">Preparing your setup experience...</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Qashivo
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Let's get you set up in just 35 minutes
          </p>
          <Badge variant="secondary" className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
            The Only AI Collections Platform That Works From Day One
          </Badge>
        </div>

        {/* Progress Overview */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg mb-8">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Setup Progress</h2>
                <p className="text-gray-600">
                  {stats?.estimatedTimeRemaining || 0} minutes remaining
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#17B6C3]">
                  {stats?.progressPercentage || 0}%
                </div>
                <p className="text-sm text-gray-600">Complete</p>
              </div>
            </div>
            
            <Progress 
              value={stats?.progressPercentage || 0} 
              className="mb-6 h-3" 
            />

            {/* Phase Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {phases.map((phase, index) => {
                const config = PHASE_CONFIG[phase];
                const Icon = config.icon;
                const isCompleted = stats?.completedPhases?.includes(phase);
                const isCurrent = phase === stats?.currentPhase;
                const isAccessible = index <= currentStepIndex;

                return (
                  <div
                    key={phase}
                    className={`relative p-4 rounded-lg border transition-all duration-300 ${
                      isCurrent 
                        ? 'bg-[#17B6C3]/10 border-[#17B6C3] shadow-md' 
                        : isCompleted
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${config.color} text-white`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : isCurrent ? (
                          <Clock className="w-5 h-5 text-[#17B6C3]" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{config.title}</h3>
                    <p className="text-xs text-gray-600">{config.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      ~{config.estimatedTime} min
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Current Phase Content */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${PHASE_CONFIG[currentPhase]?.color} text-white`}>
                {PHASE_CONFIG[currentPhase]?.icon && 
                  (() => {
                    const Icon = PHASE_CONFIG[currentPhase].icon;
                    return <Icon className="w-6 h-6" />;
                  })()
                }
              </div>
              <div>
                <CardTitle className="text-xl">
                  {PHASE_CONFIG[currentPhase]?.title}
                </CardTitle>
                <CardDescription>
                  {PHASE_CONFIG[currentPhase]?.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-8">
            {renderPhaseComponent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex === 0}
            className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <Button
            onClick={() => setCurrentStepIndex(Math.min(phases.length - 1, currentStepIndex + 1))}
            disabled={currentStepIndex === phases.length - 1}
            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}