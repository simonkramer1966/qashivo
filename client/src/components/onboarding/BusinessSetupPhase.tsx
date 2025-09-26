import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  Building2, 
  Users, 
  Settings,
  Globe,
  Clock,
  Shield,
  Loader2
} from "lucide-react";

interface BusinessSetupPhaseProps {
  onComplete: () => void;
  onUpdate: (data: any) => void;
  isCompleting: boolean;
  phaseData: any;
}

export function BusinessSetupPhase({ 
  onComplete, 
  onUpdate, 
  isCompleting, 
  phaseData 
}: BusinessSetupPhaseProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();
  
  const businessData = phaseData.business_setup || {};
  
  // Form state
  const [companyProfile, setCompanyProfile] = useState(
    businessData.companyProfile || {
      industry: '',
      companySize: '',
      businessType: '',
      primaryMarket: ''
    }
  );

  const [collectionsStrategy, setCollectionsStrategy] = useState(
    businessData.collectionsStrategy || {
      automationLevels: {
        newCustomers: 'semi-auto',
        establishedCustomers: 'semi-auto',
        highRiskCustomers: 'manual',
        vipCustomers: 'manual'
      },
      riskTolerance: {
        confidenceThreshold: 80,
        escalationTriggers: {
          amount: 1000,
          daysOverdue: 30
        }
      }
    }
  );

  const [communicationPreferences, setCommunicationPreferences] = useState(
    businessData.communicationPreferences || {
      preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      timeZone: 'UTC',
      businessHours: {
        start: '09:00',
        end: '17:00'
      }
    }
  );

  const handleSaveStep = () => {
    const updatedData = {
      business_setup: {
        companyProfile,
        collectionsStrategy,
        communicationPreferences,
        teamSetup: { members: [] } // Simplified for now
      }
    };
    
    onUpdate(updatedData);
    toast({
      title: "Progress Saved",
      description: "Your business setup preferences have been saved."
    });
  };

  const canComplete = companyProfile.industry && 
                     companyProfile.companySize && 
                     collectionsStrategy.automationLevels.newCustomers;

  const steps = [
    {
      title: "Company Profile",
      description: "Tell us about your business",
      icon: Building2
    },
    {
      title: "Collections Strategy", 
      description: "Configure automation preferences",
      icon: Settings
    },
    {
      title: "Communication",
      description: "Set timing and preferences",
      icon: Clock
    }
  ];

  return (
    <div className="space-y-6" data-testid="business-setup-phase">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Configure Your Business</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Help us understand your business so we can optimize collections for your specific needs.
        </p>
      </div>

      {/* Step Progress */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div key={index} className="flex items-center">
                <div className={`flex items-center gap-2 p-3 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-[#17B6C3]/10 border border-[#17B6C3]' 
                    : isCompleted 
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    isActive ? 'text-[#17B6C3]' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    isActive ? 'text-[#17B6C3]' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-px ${isCompleted ? 'bg-green-300' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 0 && (
        <Card className="bg-white/70 backdrop-blur-md border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#17B6C3]" />
              Company Profile
            </CardTitle>
            <CardDescription>
              Basic information about your business
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select 
                  value={companyProfile.industry} 
                  onValueChange={(value) => setCompanyProfile((prev: any) => ({ ...prev, industry: value }))}
                >
                  <SelectTrigger className="bg-white/70 border-gray-200/30">
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="construction">Construction</SelectItem>
                    <SelectItem value="professional-services">Professional Services</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-size">Company Size</Label>
                <Select 
                  value={companyProfile.companySize} 
                  onValueChange={(value) => setCompanyProfile((prev: typeof companyProfile) => ({ ...prev, companySize: value }))}
                >
                  <SelectTrigger className="bg-white/70 border-gray-200/30">
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="1-10">1-10 employees</SelectItem>
                    <SelectItem value="11-50">11-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-1000">201-1000 employees</SelectItem>
                    <SelectItem value="1000+">1000+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-type">Business Type</Label>
                <Select 
                  value={companyProfile.businessType} 
                  onValueChange={(value) => setCompanyProfile((prev: typeof companyProfile) => ({ ...prev, businessType: value }))}
                >
                  <SelectTrigger className="bg-white/70 border-gray-200/30">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="b2b">B2B</SelectItem>
                    <SelectItem value="b2c">B2C</SelectItem>
                    <SelectItem value="hybrid">Hybrid (B2B + B2C)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary-market">Primary Market</Label>
                <Select 
                  value={companyProfile.primaryMarket} 
                  onValueChange={(value) => setCompanyProfile((prev: typeof companyProfile) => ({ ...prev, primaryMarket: value }))}
                >
                  <SelectTrigger className="bg-white/70 border-gray-200/30">
                    <SelectValue placeholder="Select primary market" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 1 && (
        <Card className="bg-white/70 backdrop-blur-md border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#17B6C3]" />
              Collections Strategy
            </CardTitle>
            <CardDescription>
              Configure how aggressive you want automated collections to be
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-4">Automation Levels by Customer Type</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(collectionsStrategy.automationLevels).map(([customerType, level]) => (
                    <div key={customerType} className="space-y-3">
                      <Label className="capitalize">{customerType.replace(/([A-Z])/g, ' $1').trim()}</Label>
                      <RadioGroup 
                        value={level as string} 
                        onValueChange={(value) => 
                          setCollectionsStrategy((prev: typeof collectionsStrategy) => ({
                            ...prev,
                            automationLevels: {
                              ...prev.automationLevels,
                              [customerType]: value
                            }
                          }))
                        }
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="manual" id={`${customerType}-manual`} />
                          <Label htmlFor={`${customerType}-manual`}>Manual Only</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="semi-auto" id={`${customerType}-semi`} />
                          <Label htmlFor={`${customerType}-semi`}>Semi-Automated</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="full-auto" id={`${customerType}-full`} />
                          <Label htmlFor={`${customerType}-full`}>Fully Automated</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>AI Confidence Threshold (%)</Label>
                  <Input
                    type="number"
                    min="70"
                    max="95"
                    value={collectionsStrategy.riskTolerance.confidenceThreshold}
                    onChange={(e) => 
                      setCollectionsStrategy((prev: typeof collectionsStrategy) => ({
                        ...prev,
                        riskTolerance: {
                          ...prev.riskTolerance,
                          confidenceThreshold: parseInt(e.target.value)
                        }
                      }))
                    }
                    className="bg-white/70 border-gray-200/30"
                  />
                  <p className="text-xs text-gray-600">
                    Lower = more aggressive, Higher = more conservative
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Auto-escalate after (days overdue)</Label>
                  <Input
                    type="number"
                    min="7"
                    max="90"
                    value={collectionsStrategy.riskTolerance.escalationTriggers.daysOverdue}
                    onChange={(e) => 
                      setCollectionsStrategy((prev: typeof collectionsStrategy) => ({
                        ...prev,
                        riskTolerance: {
                          ...prev.riskTolerance,
                          escalationTriggers: {
                            ...prev.riskTolerance.escalationTriggers,
                            daysOverdue: parseInt(e.target.value)
                          }
                        }
                      }))
                    }
                    className="bg-white/70 border-gray-200/30"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card className="bg-white/70 backdrop-blur-md border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#17B6C3]" />
              Communication Preferences
            </CardTitle>
            <CardDescription>
              When and how should we contact your customers?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Business Hours Start</Label>
                <Input
                  type="time"
                  value={communicationPreferences.businessHours.start}
                  onChange={(e) => 
                    setCommunicationPreferences((prev: typeof communicationPreferences) => ({
                      ...prev,
                      businessHours: {
                        ...prev.businessHours,
                        start: e.target.value
                      }
                    }))
                  }
                  className="bg-white/70 border-gray-200/30"
                />
              </div>

              <div className="space-y-2">
                <Label>Business Hours End</Label>
                <Input
                  type="time"
                  value={communicationPreferences.businessHours.end}
                  onChange={(e) => 
                    setCommunicationPreferences((prev: typeof communicationPreferences) => ({
                      ...prev,
                      businessHours: {
                        ...prev.businessHours,
                        end: e.target.value
                      }
                    }))
                  }
                  className="bg-white/70 border-gray-200/30"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Preferred Contact Days</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox 
                      id={day}
                      checked={communicationPreferences.preferredDays.includes(day)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setCommunicationPreferences((prev: typeof communicationPreferences) => ({
                            ...prev,
                            preferredDays: [...prev.preferredDays, day]
                          }));
                        } else {
                          setCommunicationPreferences((prev: typeof communicationPreferences) => ({
                            ...prev,
                            preferredDays: prev.preferredDays.filter((d: string) => d !== day)
                          }));
                        }
                      }}
                    />
                    <Label htmlFor={day} className="text-sm">{day}</Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation and Completion */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
        >
          Previous Step
        </Button>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSaveStep}
            className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
          >
            Save Progress
          </Button>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
            >
              Next Step
            </Button>
          ) : (
            <Button 
              onClick={onComplete}
              disabled={!canComplete || isCompleting}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-complete-business-phase"
            >
              {isCompleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Complete Business Setup
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}