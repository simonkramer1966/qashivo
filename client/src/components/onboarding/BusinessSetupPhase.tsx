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
  Loader2,
  CreditCard,
  Target,
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare,
  DollarSign,
  Calendar,
  TrendingUp,
  FileText,
  Zap
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
  
  // Enhanced Form State
  const [companyProfile, setCompanyProfile] = useState(
    businessData.companyProfile || {
      industry: '',
      industrySubcategory: '',
      companySize: '',
      businessType: '',
      yearsInBusiness: '',
      annualRevenue: '',
      customerBase: '',
      primaryMarket: '',
      geographicCoverage: '',
      businessModel: ''
    }
  );

  const [collectionsStrategy, setCollectionsStrategy] = useState(
    businessData.collectionsStrategy || {
      automationLevels: {
        newCustomers: 'conservative',
        establishedCustomers: 'balanced',
        highRiskCustomers: 'manual',
        vipCustomers: 'white-glove'
      },
      collectionChannels: {
        email: true,
        sms: true,
        phone: false,
        letters: false
      },
      escalationWorkflow: {
        firstReminder: 7,
        secondReminder: 14,
        finalNotice: 30,
        collectionAgency: 60
      },
      communicationTone: 'professional'
    }
  );

  const [paymentTerms, setPaymentTerms] = useState(
    businessData.paymentTerms || {
      defaultTerms: 'net-30',
      earlyPaymentDiscount: {
        enabled: false,
        percentage: 2,
        days: 10
      },
      latePaymentFees: {
        enabled: true,
        type: 'percentage',
        amount: 1.5
      },
      acceptedPaymentMethods: ['bank-transfer', 'credit-card', 'check']
    }
  );

  const [riskAssessment, setRiskAssessment] = useState(
    businessData.riskAssessment || {
      creditLimits: {
        newCustomer: 5000,
        establishedCustomer: 25000,
        requireCreditCheck: true
      },
      riskFactors: {
        industryRisk: 'medium',
        paymentHistory: 'high',
        creditScore: 'high'
      },
      writeOffPolicy: {
        threshold: 180,
        requireApproval: true
      }
    }
  );

  const [communicationPreferences, setCommunicationPreferences] = useState(
    businessData.communicationPreferences || {
      preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      timeZone: 'America/New_York',
      businessHours: {
        start: '09:00',
        end: '17:00'
      },
      teamNotifications: {
        newOverdue: true,
        paymentReceived: true,
        escalations: true
      }
    }
  );

  const handleSaveStep = () => {
    const updatedData = {
      business_setup: {
        companyProfile,
        collectionsStrategy,
        paymentTerms,
        riskAssessment,
        communicationPreferences,
        completedSteps: currentStep + 1
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
                     companyProfile.businessType &&
                     paymentTerms.defaultTerms &&
                     collectionsStrategy.automationLevels.newCustomers;

  const steps = [
    {
      title: "Company Profile",
      description: "Business details and market position",
      icon: Building2
    },
    {
      title: "Collections Strategy", 
      description: "Automation and workflow configuration",
      icon: Target
    },
    {
      title: "Payment Terms",
      description: "Terms, discounts, and fees",
      icon: CreditCard
    },
    {
      title: "Risk Assessment",
      description: "Credit limits and risk policies",
      icon: Shield
    },
    {
      title: "Communication",
      description: "Channels and team preferences",
      icon: MessageSquare
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
        <div className="space-y-6">
          {/* Company Profile */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <Building2 className="w-5 h-5 text-[#17B6C3]" />
                </div>
                Company Profile
              </CardTitle>
              <CardDescription>
                Tell us about your business and market position
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry *</Label>
                  <Select 
                    value={companyProfile.industry} 
                    onValueChange={(value) => setCompanyProfile((prev: any) => ({ ...prev, industry: value, industrySubcategory: '' }))}
                  >
                    <SelectTrigger className="bg-white/70 border-gray-200/30">
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="technology">Technology & Software</SelectItem>
                      <SelectItem value="healthcare">Healthcare & Medical</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing & Industrial</SelectItem>
                      <SelectItem value="retail">Retail & E-commerce</SelectItem>
                      <SelectItem value="construction">Construction & Real Estate</SelectItem>
                      <SelectItem value="professional-services">Professional Services</SelectItem>
                      <SelectItem value="financial">Financial Services</SelectItem>
                      <SelectItem value="education">Education & Training</SelectItem>
                      <SelectItem value="hospitality">Hospitality & Tourism</SelectItem>
                      <SelectItem value="transportation">Transportation & Logistics</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {companyProfile.industry && (
                  <div className="space-y-2">
                    <Label htmlFor="industry-subcategory">Industry Specialization</Label>
                    <Select 
                      value={companyProfile.industrySubcategory} 
                      onValueChange={(value) => setCompanyProfile((prev: any) => ({ ...prev, industrySubcategory: value }))}
                    >
                      <SelectTrigger className="bg-white/70 border-gray-200/30">
                        <SelectValue placeholder="Select specialization" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {companyProfile.industry === 'technology' && (
                          <>
                            <SelectItem value="saas">SaaS/Cloud Software</SelectItem>
                            <SelectItem value="consulting">IT Consulting</SelectItem>
                            <SelectItem value="hardware">Hardware/Electronics</SelectItem>
                            <SelectItem value="mobile">Mobile Apps</SelectItem>
                          </>
                        )}
                        {companyProfile.industry === 'professional-services' && (
                          <>
                            <SelectItem value="accounting">Accounting</SelectItem>
                            <SelectItem value="legal">Legal</SelectItem>
                            <SelectItem value="marketing">Marketing/Advertising</SelectItem>
                            <SelectItem value="consulting">Business Consulting</SelectItem>
                          </>
                        )}
                        {companyProfile.industry === 'healthcare' && (
                          <>
                            <SelectItem value="clinic">Medical Practice</SelectItem>
                            <SelectItem value="dental">Dental</SelectItem>
                            <SelectItem value="equipment">Medical Equipment</SelectItem>
                            <SelectItem value="pharma">Pharmaceuticals</SelectItem>
                          </>
                        )}
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="company-size">Company Size *</Label>
                  <Select 
                    value={companyProfile.companySize} 
                    onValueChange={(value) => setCompanyProfile((prev: typeof companyProfile) => ({ ...prev, companySize: value }))}
                  >
                    <SelectTrigger className="bg-white/70 border-gray-200/30">
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="1-10">1-10 employees (Small)</SelectItem>
                      <SelectItem value="11-50">11-50 employees (Medium)</SelectItem>
                      <SelectItem value="51-200">51-200 employees (Large)</SelectItem>
                      <SelectItem value="201-1000">201-1000 employees (Enterprise)</SelectItem>
                      <SelectItem value="1000+">1000+ employees (Corporation)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business-type">Business Type *</Label>
                  <Select 
                    value={companyProfile.businessType} 
                    onValueChange={(value) => setCompanyProfile((prev: typeof companyProfile) => ({ ...prev, businessType: value }))}
                  >
                    <SelectTrigger className="bg-white/70 border-gray-200/30">
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="b2b">B2B (Business to Business)</SelectItem>
                      <SelectItem value="b2c">B2C (Business to Consumer)</SelectItem>
                      <SelectItem value="hybrid">Hybrid (B2B + B2C)</SelectItem>
                      <SelectItem value="marketplace">Marketplace/Platform</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="years-in-business">Years in Business</Label>
                  <Select 
                    value={companyProfile.yearsInBusiness} 
                    onValueChange={(value) => setCompanyProfile((prev: typeof companyProfile) => ({ ...prev, yearsInBusiness: value }))}
                  >
                    <SelectTrigger className="bg-white/70 border-gray-200/30">
                      <SelectValue placeholder="How long have you been in business?" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="startup">Startup (&lt; 1 year)</SelectItem>
                      <SelectItem value="1-3">1-3 years</SelectItem>
                      <SelectItem value="3-5">3-5 years</SelectItem>
                      <SelectItem value="5-10">5-10 years</SelectItem>
                      <SelectItem value="10+">10+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="annual-revenue">Annual Revenue Range</Label>
                  <Select 
                    value={companyProfile.annualRevenue} 
                    onValueChange={(value) => setCompanyProfile((prev: typeof companyProfile) => ({ ...prev, annualRevenue: value }))}
                  >
                    <SelectTrigger className="bg-white/70 border-gray-200/30">
                      <SelectValue placeholder="Select revenue range" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="under-100k">Under $100K</SelectItem>
                      <SelectItem value="100k-500k">$100K - $500K</SelectItem>
                      <SelectItem value="500k-1m">$500K - $1M</SelectItem>
                      <SelectItem value="1m-5m">$1M - $5M</SelectItem>
                      <SelectItem value="5m-25m">$5M - $25M</SelectItem>
                      <SelectItem value="25m+">$25M+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="customer-base">Customer Base Size</Label>
                  <Select 
                    value={companyProfile.customerBase} 
                    onValueChange={(value) => setCompanyProfile((prev: typeof companyProfile) => ({ ...prev, customerBase: value }))}
                  >
                    <SelectTrigger className="bg-white/70 border-gray-200/30">
                      <SelectValue placeholder="How many customers do you have?" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="under-50">Under 50</SelectItem>
                      <SelectItem value="50-200">50-200</SelectItem>
                      <SelectItem value="200-1000">200-1,000</SelectItem>
                      <SelectItem value="1000-5000">1,000-5,000</SelectItem>
                      <SelectItem value="5000+">5,000+</SelectItem>
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
                      <SelectItem value="local">Local/Regional</SelectItem>
                      <SelectItem value="national">National</SelectItem>
                      <SelectItem value="international">International</SelectItem>
                      <SelectItem value="global">Global</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Collections Strategy */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <Target className="w-5 h-5 text-[#17B6C3]" />
                </div>
                Collections Strategy
              </CardTitle>
              <CardDescription>
                Configure your automated collections approach for different customer types
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#17B6C3]" />
                    Automation Levels by Customer Type
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(collectionsStrategy.automationLevels).map(([customerType, level]) => (
                      <div key={customerType} className="space-y-3 p-4 bg-gray-50/50 rounded-lg border border-gray-200/30">
                        <Label className="font-medium capitalize">
                          {customerType.replace(/([A-Z])/g, ' $1').trim()}
                        </Label>
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
                            <Label htmlFor={`${customerType}-manual`} className="text-sm">
                              <span className="font-medium">Manual Only</span>
                              <p className="text-xs text-gray-600 mt-1">Full human oversight required</p>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="conservative" id={`${customerType}-conservative`} />
                            <Label htmlFor={`${customerType}-conservative`} className="text-sm">
                              <span className="font-medium">Conservative</span>
                              <p className="text-xs text-gray-600 mt-1">Gentle reminders only</p>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="balanced" id={`${customerType}-balanced`} />
                            <Label htmlFor={`${customerType}-balanced`} className="text-sm">
                              <span className="font-medium">Balanced</span>
                              <p className="text-xs text-gray-600 mt-1">Moderate automation with escalation</p>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="aggressive" id={`${customerType}-aggressive`} />
                            <Label htmlFor={`${customerType}-aggressive`} className="text-sm">
                              <span className="font-medium">Aggressive</span>
                              <p className="text-xs text-gray-600 mt-1">Frequent follow-ups and escalation</p>
                            </Label>
                          </div>
                          {customerType === 'vipCustomers' && (
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="white-glove" id={`${customerType}-white-glove`} />
                              <Label htmlFor={`${customerType}-white-glove`} className="text-sm">
                                <span className="font-medium">White-Glove</span>
                                <p className="text-xs text-gray-600 mt-1">Personal, relationship-focused approach</p>
                              </Label>
                            </div>
                          )}
                        </RadioGroup>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#17B6C3]" />
                    Collection Channels
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(collectionsStrategy.collectionChannels).map(([channel, enabled]) => (
                      <div key={channel} className="flex items-center space-x-2 p-3 bg-gray-50/50 rounded-lg border border-gray-200/30">
                        <Checkbox 
                          id={channel}
                          checked={enabled as boolean}
                          onCheckedChange={(checked) => {
                            setCollectionsStrategy((prev: typeof collectionsStrategy) => ({
                              ...prev,
                              collectionChannels: {
                                ...prev.collectionChannels,
                                [channel]: checked
                              }
                            }));
                          }}
                        />
                        <Label htmlFor={channel} className="text-sm capitalize flex items-center gap-1">
                          {channel === 'email' && <Mail className="w-3 h-3" />}
                          {channel === 'sms' && <MessageSquare className="w-3 h-3" />}
                          {channel === 'phone' && <Phone className="w-3 h-3" />}
                          {channel === 'letters' && <FileText className="w-3 h-3" />}
                          {channel.charAt(0).toUpperCase() + channel.slice(1)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#17B6C3]" />
                    Escalation Timeline (Days After Due Date)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">First Reminder</Label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={collectionsStrategy.escalationWorkflow.firstReminder}
                        onChange={(e) => 
                          setCollectionsStrategy((prev: typeof collectionsStrategy) => ({
                            ...prev,
                            escalationWorkflow: {
                              ...prev.escalationWorkflow,
                              firstReminder: parseInt(e.target.value)
                            }
                          }))
                        }
                        className="bg-white/70 border-gray-200/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Second Reminder</Label>
                      <Input
                        type="number"
                        min="7"
                        max="45"
                        value={collectionsStrategy.escalationWorkflow.secondReminder}
                        onChange={(e) => 
                          setCollectionsStrategy((prev: typeof collectionsStrategy) => ({
                            ...prev,
                            escalationWorkflow: {
                              ...prev.escalationWorkflow,
                              secondReminder: parseInt(e.target.value)
                            }
                          }))
                        }
                        className="bg-white/70 border-gray-200/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Final Notice</Label>
                      <Input
                        type="number"
                        min="14"
                        max="60"
                        value={collectionsStrategy.escalationWorkflow.finalNotice}
                        onChange={(e) => 
                          setCollectionsStrategy((prev: typeof collectionsStrategy) => ({
                            ...prev,
                            escalationWorkflow: {
                              ...prev.escalationWorkflow,
                              finalNotice: parseInt(e.target.value)
                            }
                          }))
                        }
                        className="bg-white/70 border-gray-200/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Collection Agency</Label>
                      <Input
                        type="number"
                        min="30"
                        max="180"
                        value={collectionsStrategy.escalationWorkflow.collectionAgency}
                        onChange={(e) => 
                          setCollectionsStrategy((prev: typeof collectionsStrategy) => ({
                            ...prev,
                            escalationWorkflow: {
                              ...prev.escalationWorkflow,
                              collectionAgency: parseInt(e.target.value)
                            }
                          }))
                        }
                        className="bg-white/70 border-gray-200/30"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-4">Communication Tone</h4>
                  <RadioGroup 
                    value={collectionsStrategy.communicationTone} 
                    onValueChange={(value) => 
                      setCollectionsStrategy((prev: typeof collectionsStrategy) => ({
                        ...prev,
                        communicationTone: value
                      }))
                    }
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2 p-3 bg-gray-50/50 rounded-lg border border-gray-200/30">
                        <RadioGroupItem value="friendly" id="tone-friendly" />
                        <Label htmlFor="tone-friendly" className="text-sm">
                          <span className="font-medium">Friendly</span>
                          <p className="text-xs text-gray-600 mt-1">Warm and understanding tone</p>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 bg-gray-50/50 rounded-lg border border-gray-200/30">
                        <RadioGroupItem value="professional" id="tone-professional" />
                        <Label htmlFor="tone-professional" className="text-sm">
                          <span className="font-medium">Professional</span>
                          <p className="text-xs text-gray-600 mt-1">Business-like and direct</p>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 bg-gray-50/50 rounded-lg border border-gray-200/30">
                        <RadioGroupItem value="firm" id="tone-firm" />
                        <Label htmlFor="tone-firm" className="text-sm">
                          <span className="font-medium">Firm</span>
                          <p className="text-xs text-gray-600 mt-1">Assertive and urgent</p>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Payment Terms */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <CreditCard className="w-5 h-5 text-[#17B6C3]" />
                </div>
                Payment Terms & Policies
              </CardTitle>
              <CardDescription>
                Configure your standard payment terms, discounts, and fee structures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="default-terms">Default Payment Terms *</Label>
                  <Select 
                    value={paymentTerms.defaultTerms} 
                    onValueChange={(value) => setPaymentTerms((prev: typeof paymentTerms) => ({ ...prev, defaultTerms: value }))}
                  >
                    <SelectTrigger className="bg-white/70 border-gray-200/30">
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="net-15">Net 15 (15 days)</SelectItem>
                      <SelectItem value="net-30">Net 30 (30 days)</SelectItem>
                      <SelectItem value="net-45">Net 45 (45 days)</SelectItem>
                      <SelectItem value="net-60">Net 60 (60 days)</SelectItem>
                      <SelectItem value="due-on-receipt">Due on Receipt</SelectItem>
                      <SelectItem value="2-10-net-30">2/10 Net 30</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Early Payment Discount</Label>
                    <Checkbox 
                      checked={paymentTerms.earlyPaymentDiscount.enabled}
                      onCheckedChange={(checked) => 
                        setPaymentTerms((prev: typeof paymentTerms) => ({
                          ...prev,
                          earlyPaymentDiscount: {
                            ...prev.earlyPaymentDiscount,
                            enabled: checked as boolean
                          }
                        }))
                      }
                    />
                  </div>
                  {paymentTerms.earlyPaymentDiscount.enabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Discount %</Label>
                        <Input
                          type="number"
                          min="0.5"
                          max="10"
                          step="0.5"
                          value={paymentTerms.earlyPaymentDiscount.percentage}
                          onChange={(e) => 
                            setPaymentTerms((prev: typeof paymentTerms) => ({
                              ...prev,
                              earlyPaymentDiscount: {
                                ...prev.earlyPaymentDiscount,
                                percentage: parseFloat(e.target.value)
                              }
                            }))
                          }
                          className="bg-white/70 border-gray-200/30"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Within Days</Label>
                        <Input
                          type="number"
                          min="5"
                          max="30"
                          value={paymentTerms.earlyPaymentDiscount.days}
                          onChange={(e) => 
                            setPaymentTerms((prev: typeof paymentTerms) => ({
                              ...prev,
                              earlyPaymentDiscount: {
                                ...prev.earlyPaymentDiscount,
                                days: parseInt(e.target.value)
                              }
                            }))
                          }
                          className="bg-white/70 border-gray-200/30"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Late Payment Fees</Label>
                  <Checkbox 
                    checked={paymentTerms.latePaymentFees.enabled}
                    onCheckedChange={(checked) => 
                      setPaymentTerms((prev: typeof paymentTerms) => ({
                        ...prev,
                        latePaymentFees: {
                          ...prev.latePaymentFees,
                          enabled: checked as boolean
                        }
                      }))
                    }
                  />
                </div>
                {paymentTerms.latePaymentFees.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Fee Type</Label>
                      <Select 
                        value={paymentTerms.latePaymentFees.type} 
                        onValueChange={(value) => 
                          setPaymentTerms((prev: typeof paymentTerms) => ({
                            ...prev,
                            latePaymentFees: {
                              ...prev.latePaymentFees,
                              type: value as 'percentage' | 'fixed'
                            }
                          }))
                        }
                      >
                        <SelectTrigger className="bg-white/70 border-gray-200/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step={paymentTerms.latePaymentFees.type === 'percentage' ? '0.5' : '5'}
                        value={paymentTerms.latePaymentFees.amount}
                        onChange={(e) => 
                          setPaymentTerms((prev: typeof paymentTerms) => ({
                            ...prev,
                            latePaymentFees: {
                              ...prev.latePaymentFees,
                              amount: parseFloat(e.target.value)
                            }
                          }))
                        }
                        className="bg-white/70 border-gray-200/30"
                      />
                    </div>
                    <div className="flex items-end">
                      <p className="text-sm text-gray-600 pb-2">
                        {paymentTerms.latePaymentFees.type === 'percentage' 
                          ? `${paymentTerms.latePaymentFees.amount}% per month`
                          : `$${paymentTerms.latePaymentFees.amount} flat fee`
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>Accepted Payment Methods</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { value: 'bank-transfer', label: 'Bank Transfer/ACH', icon: Building2 },
                    { value: 'credit-card', label: 'Credit Card', icon: CreditCard },
                    { value: 'check', label: 'Check', icon: FileText },
                    { value: 'wire', label: 'Wire Transfer', icon: Zap },
                    { value: 'paypal', label: 'PayPal', icon: DollarSign },
                    { value: 'crypto', label: 'Cryptocurrency', icon: TrendingUp }
                  ].map(method => {
                    const Icon = method.icon;
                    return (
                      <div key={method.value} className="flex items-center space-x-2 p-3 bg-gray-50/50 rounded-lg border border-gray-200/30">
                        <Checkbox 
                          id={method.value}
                          checked={paymentTerms.acceptedPaymentMethods.includes(method.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPaymentTerms((prev: typeof paymentTerms) => ({
                                ...prev,
                                acceptedPaymentMethods: [...prev.acceptedPaymentMethods, method.value]
                              }));
                            } else {
                              setPaymentTerms((prev: typeof paymentTerms) => ({
                                ...prev,
                                acceptedPaymentMethods: prev.acceptedPaymentMethods.filter((m: string) => m !== method.value)
                              }));
                            }
                          }}
                        />
                        <Label htmlFor={method.value} className="text-sm flex items-center gap-1">
                          <Icon className="w-3 h-3" />
                          {method.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Risk Assessment */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <Shield className="w-5 h-5 text-[#17B6C3]" />
                </div>
                Risk Assessment & Credit Policy
              </CardTitle>
              <CardDescription>
                Configure credit limits, risk factors, and write-off policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#17B6C3]" />
                  Credit Limits
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>New Customer Credit Limit ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      value={riskAssessment.creditLimits.newCustomer}
                      onChange={(e) => 
                        setRiskAssessment((prev: typeof riskAssessment) => ({
                          ...prev,
                          creditLimits: {
                            ...prev.creditLimits,
                            newCustomer: parseInt(e.target.value)
                          }
                        }))
                      }
                      className="bg-white/70 border-gray-200/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Established Customer Credit Limit ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="5000"
                      value={riskAssessment.creditLimits.establishedCustomer}
                      onChange={(e) => 
                        setRiskAssessment((prev: typeof riskAssessment) => ({
                          ...prev,
                          creditLimits: {
                            ...prev.creditLimits,
                            establishedCustomer: parseInt(e.target.value)
                          }
                        }))
                      }
                      className="bg-white/70 border-gray-200/30"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="credit-check"
                      checked={riskAssessment.creditLimits.requireCreditCheck}
                      onCheckedChange={(checked) => 
                        setRiskAssessment((prev: typeof riskAssessment) => ({
                          ...prev,
                          creditLimits: {
                            ...prev.creditLimits,
                            requireCreditCheck: checked as boolean
                          }
                        }))
                      }
                    />
                    <Label htmlFor="credit-check" className="text-sm">
                      Require credit check for new customers above credit limit
                    </Label>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#17B6C3]" />
                  Risk Factor Weights
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Industry Risk Weight</Label>
                    <Select 
                      value={riskAssessment.riskFactors.industryRisk} 
                      onValueChange={(value) => 
                        setRiskAssessment((prev: typeof riskAssessment) => ({
                          ...prev,
                          riskFactors: {
                            ...prev.riskFactors,
                            industryRisk: value as 'low' | 'medium' | 'high'
                          }
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white/70 border-gray-200/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="low">Low Risk Industry</SelectItem>
                        <SelectItem value="medium">Medium Risk Industry</SelectItem>
                        <SelectItem value="high">High Risk Industry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment History Weight</Label>
                    <Select 
                      value={riskAssessment.riskFactors.paymentHistory} 
                      onValueChange={(value) => 
                        setRiskAssessment((prev: typeof riskAssessment) => ({
                          ...prev,
                          riskFactors: {
                            ...prev.riskFactors,
                            paymentHistory: value as 'low' | 'medium' | 'high'
                          }
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white/70 border-gray-200/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="low">Low Importance</SelectItem>
                        <SelectItem value="medium">Medium Importance</SelectItem>
                        <SelectItem value="high">High Importance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Credit Score Weight</Label>
                    <Select 
                      value={riskAssessment.riskFactors.creditScore} 
                      onValueChange={(value) => 
                        setRiskAssessment((prev: typeof riskAssessment) => ({
                          ...prev,
                          riskFactors: {
                            ...prev.riskFactors,
                            creditScore: value as 'low' | 'medium' | 'high'
                          }
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white/70 border-gray-200/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="low">Low Importance</SelectItem>
                        <SelectItem value="medium">Medium Importance</SelectItem>
                        <SelectItem value="high">High Importance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Write-Off Policy</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Write-off after (days)</Label>
                    <Input
                      type="number"
                      min="90"
                      max="365"
                      value={riskAssessment.writeOffPolicy.threshold}
                      onChange={(e) => 
                        setRiskAssessment((prev: typeof riskAssessment) => ({
                          ...prev,
                          writeOffPolicy: {
                            ...prev.writeOffPolicy,
                            threshold: parseInt(e.target.value)
                          }
                        }))
                      }
                      className="bg-white/70 border-gray-200/30"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="require-approval"
                        checked={riskAssessment.writeOffPolicy.requireApproval}
                        onCheckedChange={(checked) => 
                          setRiskAssessment((prev: typeof riskAssessment) => ({
                            ...prev,
                            writeOffPolicy: {
                              ...prev.writeOffPolicy,
                              requireApproval: checked as boolean
                            }
                          }))
                        }
                      />
                      <Label htmlFor="require-approval" className="text-sm">
                        Require manager approval for write-offs
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-6">
          {/* Enhanced Communication Preferences */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-[#17B6C3]" />
                </div>
                Communication Preferences
              </CardTitle>
              <CardDescription>
                Configure when and how to contact customers, plus team notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#17B6C3]" />
                  Business Hours & Schedule
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Time Zone</Label>
                    <Select 
                      value={communicationPreferences.timeZone} 
                      onValueChange={(value) => setCommunicationPreferences((prev: typeof communicationPreferences) => ({ ...prev, timeZone: value }))}
                    >
                      <SelectTrigger className="bg-white/70 border-gray-200/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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

                <div className="mt-4">
                  <Label className="mb-3 block">Preferred Contact Days</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                      <div key={day} className="flex items-center space-x-2 p-3 bg-gray-50/50 rounded-lg border border-gray-200/30">
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
              </div>

              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#17B6C3]" />
                  Team Notifications
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg border border-gray-200/30">
                    <div>
                      <Label className="font-medium">New Overdue Invoices</Label>
                      <p className="text-sm text-gray-600">Notify team when invoices become overdue</p>
                    </div>
                    <Checkbox 
                      checked={communicationPreferences.teamNotifications.newOverdue}
                      onCheckedChange={(checked) => 
                        setCommunicationPreferences((prev: typeof communicationPreferences) => ({
                          ...prev,
                          teamNotifications: {
                            ...prev.teamNotifications,
                            newOverdue: checked as boolean
                          }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg border border-gray-200/30">
                    <div>
                      <Label className="font-medium">Payment Received</Label>
                      <p className="text-sm text-gray-600">Notify team when payments are received</p>
                    </div>
                    <Checkbox 
                      checked={communicationPreferences.teamNotifications.paymentReceived}
                      onCheckedChange={(checked) => 
                        setCommunicationPreferences((prev: typeof communicationPreferences) => ({
                          ...prev,
                          teamNotifications: {
                            ...prev.teamNotifications,
                            paymentReceived: checked as boolean
                          }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg border border-gray-200/30">
                    <div>
                      <Label className="font-medium">Escalations</Label>
                      <p className="text-sm text-gray-600">Notify team when collections escalate</p>
                    </div>
                    <Checkbox 
                      checked={communicationPreferences.teamNotifications.escalations}
                      onCheckedChange={(checked) => 
                        setCommunicationPreferences((prev: typeof communicationPreferences) => ({
                          ...prev,
                          teamNotifications: {
                            ...prev.teamNotifications,
                            escalations: checked as boolean
                          }
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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

export default BusinessSetupPhase;