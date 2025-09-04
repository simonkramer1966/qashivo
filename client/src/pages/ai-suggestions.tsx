import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Bot, 
  Brain, 
  Target, 
  TrendingUp,
  Lightbulb,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Mail,
  Phone,
  MessageSquare,
  Sparkles
} from "lucide-react";

export default function AiSuggestions() {
  const suggestions = [
    {
      id: 1,
      type: "High Priority",
      title: "Focus on Acme Corp Payment",
      description: "AI predicts 87% chance of payment within 3 days if contacted via phone call",
      action: "Call Now",
      priority: "high",
      icon: Phone,
      confidence: 87,
      amount: "$15,420"
    },
    {
      id: 2,
      type: "Email Strategy",
      title: "Send Gentle Reminder to TechStart Inc",
      description: "Customer has 95% positive response rate to friendly email reminders",
      action: "Send Email",
      priority: "medium", 
      icon: Mail,
      confidence: 95,
      amount: "$8,750"
    },
    {
      id: 3,
      type: "Workflow Optimization",
      title: "Update Collection Strategy for Digital Solutions",
      description: "Switch to SMS-first approach - 3x higher response rate for this customer segment",
      action: "Update Workflow",
      priority: "medium",
      icon: MessageSquare,
      confidence: 78,
      amount: "$12,300"
    },
    {
      id: 4,
      type: "Risk Alert",
      title: "Monitor BuildRight Ltd Closely",
      description: "Payment behavior changed - AI detects 65% risk of delayed payment",
      action: "Review Account",
      priority: "high",
      icon: AlertTriangle,
      confidence: 65,
      amount: "$22,100"
    }
  ];

  const insights = [
    {
      title: "Best Contact Time",
      value: "2:00 PM - 4:00 PM",
      description: "Highest response rates based on historical data"
    },
    {
      title: "Optimal Communication Channel",
      value: "Email + Phone Combo",
      description: "Email followed by phone call within 2 hours"
    },
    {
      title: "Payment Prediction",
      value: "73% by Week End",
      description: "Based on current outstanding invoices"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="text-ai-suggestions-title">
          AI Suggestions
        </h1>
        <p className="text-gray-600" data-testid="text-ai-suggestions-description">
          Intelligent recommendations powered by machine learning to optimize your collection process
        </p>
      </div>

      {/* AI Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {insights.map((insight, index) => (
          <Card key={index} className="bg-white border border-gray-200 shadow-sm" data-testid={`card-insight-${index}`}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-3">
                <Brain className="h-5 w-5 text-[#17B6C3]" />
                <h3 className="font-semibold text-gray-900">{insight.title}</h3>
              </div>
              <p className="text-2xl font-bold text-[#17B6C3] mb-2">{insight.value}</p>
              <p className="text-sm text-gray-600">{insight.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Suggestions */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900" data-testid="text-suggestions-title">
            Smart Recommendations
          </h2>
          <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Powered
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-suggestion-${suggestion.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      suggestion.priority === 'high' ? 'bg-red-100' : 'bg-yellow-100'
                    }`}>
                      <suggestion.icon className={`h-5 w-5 ${
                        suggestion.priority === 'high' ? 'text-red-600' : 'text-yellow-600'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                        <Badge variant={suggestion.priority === 'high' ? 'destructive' : 'secondary'}>
                          {suggestion.type}
                        </Badge>
                      </div>
                      <CardDescription className="text-base">
                        {suggestion.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{suggestion.amount}</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <Target className="h-3 w-3 text-[#17B6C3]" />
                      <span className="text-sm text-[#17B6C3] font-medium">{suggestion.confidence}% confidence</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>Suggested now</span>
                    </div>
                  </div>
                  <Button 
                    className={`${
                      suggestion.priority === 'high' 
                        ? 'bg-[#17B6C3] hover:bg-[#1396A1] text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}
                    data-testid={`button-suggestion-${suggestion.id}`}
                  >
                    {suggestion.action}
                    <CheckCircle className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* AI Performance Stats */}
      <Card className="bg-gradient-to-r from-[#17B6C3]/5 to-purple-500/5 border-[#17B6C3]/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-[#17B6C3]" />
            <span>AI Performance This Month</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-[#17B6C3] mb-2">94%</p>
              <p className="text-sm text-gray-600">Prediction Accuracy</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-[#17B6C3] mb-2">$127K</p>
              <p className="text-sm text-gray-600">Additional Collections</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-[#17B6C3] mb-2">35%</p>
              <p className="text-sm text-gray-600">Faster Resolution</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-[#17B6C3] mb-2">156</p>
              <p className="text-sm text-gray-600">Suggestions Generated</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}