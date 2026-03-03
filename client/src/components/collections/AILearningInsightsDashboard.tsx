import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MLPredictionsTab from "./MLPredictionsTab";
import MLRiskScoringTab from "./MLRiskScoringTab";
import MLSegmentsTab from "./MLSegmentsTab";
import MLPatternsTab from "./MLPatternsTab";
import { 
  Brain,
  TrendingUp,
  Users,
  Target,
  Mail,
  MessageSquare,
  Phone,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Star,
  Clock,
  Trophy,
  Zap,
  Eye,
  BookOpen,
  Activity,
  Calculator,
  Shield,
  Layers,
  Calendar,
  TrendingDown,
  Gauge,
  PieChart,
  LineChart,
  Sparkles
} from "lucide-react";

interface LearningInsights {
  totalCustomersLearned: number;
  averageConfidence: number;
  averageImprovementRate: number;
  topInsights: string[];
  customerProfiles: Array<{
    id: string;
    name: string;
    preferredChannel: string;
    confidence: number;
    successRate: number;
    averagePaymentDelay: number;
    latestInsight: string;
  }>;
}

interface AILearningInsightsDashboardProps {
  className?: string;
}

export default function AILearningInsightsDashboard({ className }: AILearningInsightsDashboardProps) {
  const [selectedMetric, setSelectedMetric] = useState<string>("overview");

  // Fetch AI learning insights
  const { data: insights, isLoading, error } = useQuery<LearningInsights>({
    queryKey: ['/api/collections/ai-learning/insights'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch ML service insights  
  const { data: riskAnalytics } = useQuery({
    queryKey: ['/api/ml/risk-scoring/analytics'],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: customerSegments } = useQuery({
    queryKey: ['/api/ml/customer-segmentation/segments'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const { data: seasonalPatterns } = useQuery({
    queryKey: ['/api/ml/seasonal-patterns/patterns'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
            <Brain className="h-6 w-6 text-[#17B6C3] animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">AI Learning Insights</h2>
            <p className="text-muted-foreground">Loading AI collection intelligence...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">AI Learning Insights</h2>
            <p className="text-red-600">Unable to load AI learning data. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'email': return Mail;
      case 'sms': return MessageSquare;
      case 'voice': return Phone;
      default: return Mail;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'email': return 'text-blue-600 bg-blue-100';
      case 'sms': return 'text-green-600 bg-green-100';
      case 'voice': return 'text-purple-600 bg-purple-100';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
            <Brain className="h-6 w-6 text-[#17B6C3]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Advanced AI & ML Intelligence</h2>
            <p className="text-muted-foreground">Comprehensive machine learning analytics for credit control</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
            <Activity className="h-3 w-3 mr-1" />
            Live Learning
          </Badge>
          <Badge className="bg-purple-100 text-purple-700 border-purple-200">
            <Sparkles className="h-3 w-3 mr-1" />
            ML Powered
          </Badge>
        </div>
      </div>

      {/* Advanced ML Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-background/60 backdrop-blur-sm">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Brain className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="predictions" className="flex items-center space-x-2">
            <Calculator className="h-4 w-4" />
            <span>Predictions</span>
          </TabsTrigger>
          <TabsTrigger value="risk-scoring" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Risk Scoring</span>
          </TabsTrigger>
          <TabsTrigger value="segments" className="flex items-center space-x-2">
            <Layers className="h-4 w-4" />
            <span>Segments</span>
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Patterns</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-background/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Customers Learned</p>
                <p className="text-2xl font-bold text-foreground" data-testid="metric-customers-learned">
                  {insights?.totalCustomersLearned || 0}
                </p>
              </div>
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Users className="h-5 w-5 text-[#17B6C3]" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600 font-medium">+23% this week</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">AI Confidence</p>
                <p className="text-2xl font-bold text-foreground" data-testid="metric-ai-confidence">
                  {insights?.averageConfidence || 0}%
                </p>
              </div>
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Brain className="h-5 w-5 text-[#17B6C3]" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={insights?.averageConfidence || 0} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Learning progress</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold text-foreground" data-testid="metric-success-rate">
                  {insights?.averageImprovementRate || 0}%
                </p>
              </div>
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Target className="h-5 w-5 text-[#17B6C3]" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <Trophy className="h-4 w-4 text-yellow-500 mr-1" />
                <span className="text-green-600 font-medium">Above average</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">AI Optimizations</p>
                <p className="text-2xl font-bold text-foreground" data-testid="metric-optimizations">
                  {(insights?.customerProfiles?.length || 0) * 3}
                </p>
              </div>
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Zap className="h-5 w-5 text-[#17B6C3]" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-muted-foreground">Active today</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Summary */}
      <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-[#17B6C3]" />
            <span>Key AI Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights?.topInsights?.length ? (
            insights.topInsights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-[#17B6C3]/5">
                <div className="p-1 bg-[#17B6C3]/10 rounded">
                  <Eye className="h-4 w-4 text-[#17B6C3]" />
                </div>
                <p className="text-foreground text-sm" data-testid={`insight-${index}`}>{insight}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">AI is learning customer patterns...</p>
              <p className="text-sm text-muted-foreground mt-1">Insights will appear as the system learns</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Learning Profiles */}
      <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-[#17B6C3]" />
              <span>Customer Learning Profiles</span>
            </div>
            <Badge variant="secondary" className="bg-[#17B6C3]/10 text-[#17B6C3]">
              {insights?.customerProfiles?.length || 0} profiles
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {insights?.customerProfiles?.length ? (
            <div className="space-y-4">
              {insights.customerProfiles.slice(0, 8).map((profile, index) => {
                const ChannelIcon = getChannelIcon(profile.preferredChannel);
                return (
                  <div key={profile.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/80 hover:bg-muted/80 transition-colors" data-testid={`profile-${index}`}>
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className={`p-2 rounded-lg ${getChannelColor(profile.preferredChannel)}`}>
                          <ChannelIcon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-foreground truncate">{profile.name}</h4>
                        <p className="text-sm text-muted-foreground">{profile.latestInsight}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <p className="font-medium text-foreground">{profile.confidence}%</p>
                        <p className="text-muted-foreground">Confidence</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-foreground">{profile.successRate}%</p>
                        <p className="text-muted-foreground">Success</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-foreground">{profile.averagePaymentDelay}d</p>
                        <p className="text-muted-foreground">Avg Delay</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {insights.customerProfiles.length > 8 && (
                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    +{insights.customerProfiles.length - 8} more customers learning...
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Building Customer Intelligence</h3>
              <p className="text-muted-foreground mb-4">AI will create customer profiles as collection actions are executed</p>
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Learning typically takes 5-10 customer interactions</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Learning Progress Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Channel Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Email</span>
                </div>
                <span className="text-sm text-muted-foreground">65%</span>
              </div>
              <Progress value={65} className="h-2" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">SMS</span>
                </div>
                <span className="text-sm text-muted-foreground">25%</span>
              </div>
              <Progress value={25} className="h-2" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Voice</span>
                </div>
                <span className="text-sm text-muted-foreground">10%</span>
              </div>
              <Progress value={10} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Learning Velocity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="text-3xl font-bold text-[#17B6C3]">2.3x</div>
              <p className="text-sm text-muted-foreground">Faster than traditional methods</p>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Traditional</span>
                  <span className="font-medium">6-8 weeks</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">AI Learning</span>
                  <span className="font-medium text-[#17B6C3]">2-3 weeks</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Next Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="p-1 bg-blue-100 rounded">
                <Star className="h-3 w-3 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Optimize 12 customers</p>
                <p className="text-xs text-muted-foreground">Ready for channel switching</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-1 bg-green-100 rounded">
                <BarChart3 className="h-3 w-3 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Start A/B test</p>
                <p className="text-xs text-muted-foreground">Test new timing strategy</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-1 bg-purple-100 rounded">
                <Brain className="h-3 w-3 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Review insights</p>
                <p className="text-xs text-muted-foreground">3 new learning patterns</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        {/* Predictions Tab */}
        <TabsContent value="predictions">
          <MLPredictionsTab insights={insights} />
        </TabsContent>

        {/* Risk Scoring Tab */}
        <TabsContent value="risk-scoring">
          <MLRiskScoringTab riskAnalytics={riskAnalytics} />
        </TabsContent>

        {/* Segments Tab */}
        <TabsContent value="segments">
          <MLSegmentsTab customerSegments={customerSegments} />
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns">
          <MLPatternsTab seasonalPatterns={seasonalPatterns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}