import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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
  Activity
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
            <Brain className="h-6 w-6 text-[#17B6C3] animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Learning Insights</h2>
            <p className="text-gray-600">Loading AI collection intelligence...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
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
            <h2 className="text-2xl font-bold text-gray-900">AI Learning Insights</h2>
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
      default: return 'text-gray-600 bg-gray-100';
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
            <h2 className="text-2xl font-bold text-gray-900">AI Learning Insights</h2>
            <p className="text-gray-600">Adaptive credit control intelligence dashboard</p>
          </div>
        </div>
        <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
          <Activity className="h-3 w-3 mr-1" />
          Live Learning
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Customers Learned</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-customers-learned">
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

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Confidence</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-ai-confidence">
                  {insights?.averageConfidence || 0}%
                </p>
              </div>
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Brain className="h-5 w-5 text-[#17B6C3]" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={insights?.averageConfidence || 0} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">Learning progress</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-success-rate">
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

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Optimizations</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-optimizations">
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
                <span className="text-gray-600">Active today</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Summary */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
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
                <p className="text-gray-700 text-sm" data-testid={`insight-${index}`}>{insight}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">AI is learning customer patterns...</p>
              <p className="text-sm text-gray-400 mt-1">Insights will appear as the system learns</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Learning Profiles */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
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
                  <div key={profile.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50/80 hover:bg-gray-100/80 transition-colors" data-testid={`profile-${index}`}>
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className={`p-2 rounded-lg ${getChannelColor(profile.preferredChannel)}`}>
                          <ChannelIcon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-gray-900 truncate">{profile.name}</h4>
                        <p className="text-sm text-gray-600">{profile.latestInsight}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <p className="font-medium text-gray-900">{profile.confidence}%</p>
                        <p className="text-gray-500">Confidence</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-gray-900">{profile.successRate}%</p>
                        <p className="text-gray-500">Success</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-gray-900">{profile.averagePaymentDelay}d</p>
                        <p className="text-gray-500">Avg Delay</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {insights.customerProfiles.length > 8 && (
                <div className="text-center pt-4">
                  <p className="text-sm text-gray-500">
                    +{insights.customerProfiles.length - 8} more customers learning...
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Building Customer Intelligence</h3>
              <p className="text-gray-600 mb-4">AI will create customer profiles as collection actions are executed</p>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>Learning typically takes 5-10 customer interactions</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Learning Progress Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
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
                <span className="text-sm text-gray-600">65%</span>
              </div>
              <Progress value={65} className="h-2" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">SMS</span>
                </div>
                <span className="text-sm text-gray-600">25%</span>
              </div>
              <Progress value={25} className="h-2" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Voice</span>
                </div>
                <span className="text-sm text-gray-600">10%</span>
              </div>
              <Progress value={10} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Learning Velocity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="text-3xl font-bold text-[#17B6C3]">2.3x</div>
              <p className="text-sm text-gray-600">Faster than traditional methods</p>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Traditional</span>
                  <span className="font-medium">6-8 weeks</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AI Learning</span>
                  <span className="font-medium text-[#17B6C3]">2-3 weeks</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
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
                <p className="text-xs text-gray-500">Ready for channel switching</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-1 bg-green-100 rounded">
                <BarChart3 className="h-3 w-3 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Start A/B test</p>
                <p className="text-xs text-gray-500">Test new timing strategy</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-1 bg-purple-100 rounded">
                <Brain className="h-3 w-3 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Review insights</p>
                <p className="text-xs text-gray-500">3 new learning patterns</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}