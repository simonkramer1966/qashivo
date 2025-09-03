import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Lightbulb, AlertTriangle, TrendingUp } from "lucide-react";

export default function AIInsights() {
  // For now, we'll use static data since we need invoice data to generate real suggestions
  // In a real implementation, this would call the AI suggestions API with current invoice data
  
  const mockInsights = [
    {
      type: "opportunity",
      priority: "high",
      title: "Collection Opportunity",
      description: "Acme Corp typically pays within 48 hours of phone follow-up. Consider calling today.",
      action: "Take Action →",
      icon: Lightbulb,
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      iconColor: "text-blue-600",
      titleColor: "text-blue-900",
      descColor: "text-blue-700",
      actionColor: "text-blue-600 hover:text-blue-800",
    },
    {
      type: "risk",
      priority: "high", 
      title: "Risk Alert",
      description: "TechStart Inc has 3 overdue invoices. Escalation recommended.",
      action: "Review →",
      icon: AlertTriangle,
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      iconColor: "text-amber-600",
      titleColor: "text-amber-900",
      descColor: "text-amber-700",
      actionColor: "text-amber-600 hover:text-amber-800",
    },
    {
      type: "strategy",
      priority: "medium",
      title: "Success Pattern",
      description: "Email reminders sent on Wednesdays show 23% higher response rates.",
      action: "Schedule →",
      icon: TrendingUp,
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      iconColor: "text-green-600",
      titleColor: "text-green-900",
      descColor: "text-green-700",
      actionColor: "text-green-600 hover:text-green-800",
    },
  ];

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center" data-testid="text-ai-insights-title">
          <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
            <Bot className="text-[#17B6C3] h-5 w-5" />
          </div>
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {mockInsights.map((insight, index) => (
          <div 
            key={index} 
            className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/50 hover:bg-slate-100/80 transition-colors"
            data-testid={`insight-${insight.type}-${index}`}
          >
            <div className="flex items-start space-x-3">
              <div className={`p-2 ${insight.bgColor} rounded-lg`}>
                <insight.icon className={`${insight.iconColor}`} size={16} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900" data-testid={`text-insight-title-${index}`}>
                  {insight.title}
                </h4>
                <p className={`text-sm ${insight.descColor} mt-1`} data-testid={`text-insight-description-${index}`}>
                  {insight.description}
                </p>
                <Button 
                  variant="ghost" 
                  className={`text-xs font-medium mt-2 p-0 h-auto ${insight.actionColor}`}
                  data-testid={`button-insight-action-${index}`}
                >
                  {insight.action}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
