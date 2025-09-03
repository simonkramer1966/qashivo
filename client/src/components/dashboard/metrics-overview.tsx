import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, AlertTriangle, Clock, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, DollarSign } from "lucide-react";

export default function MetricsOverview() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="relative overflow-hidden bg-white/70 backdrop-blur-md border-white/20 shadow-xl animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted/30 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metricsData = [
    {
      title: "Total Outstanding",
      value: `$${((metrics as any)?.totalOutstanding || 0).toLocaleString()}`,
      change: "+12%",
      changeType: "increase" as const,
      icon: DollarSign,
      gradientFrom: "[#17B6C3]/10",
      iconColor: "text-[#17B6C3]",
      testId: "metric-total-outstanding"
    },
    {
      title: "Overdue Invoices", 
      value: ((metrics as any)?.overdueCount || 0).toString(),
      change: "-8%",
      changeType: "decrease" as const,
      icon: AlertTriangle,
      gradientFrom: "red-500/10",
      iconColor: "text-red-500",
      testId: "metric-overdue-count"
    },
    {
      title: "Collection Rate",
      value: `${(metrics as any)?.collectionRate || 0}%`,
      change: "+3.2%", 
      changeType: "increase" as const,
      icon: TrendingUp,
      gradientFrom: "green-500/10",
      iconColor: "text-green-500",
      testId: "metric-collection-rate"
    },
    {
      title: "Avg Days to Pay",
      value: ((metrics as any)?.avgDaysToPay || 0).toString(),
      change: "-5 days",
      changeType: "decrease" as const,
      icon: Clock,
      gradientFrom: "blue-500/10", 
      iconColor: "text-blue-500",
      testId: "metric-avg-days"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
      {metricsData.map((metric) => (
        <Card 
          key={metric.title} 
          className="relative overflow-hidden bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 metric-card" 
          data-testid={metric.testId}
        >
          <div className={`absolute inset-0 bg-gradient-to-br from-${metric.gradientFrom} to-transparent`}></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 bg-${metric.gradientFrom.replace('/10', '/20')} rounded-xl`}>
                <metric.icon className={`h-6 w-6 ${metric.iconColor}`} />
              </div>
              <div className={`flex items-center ${
                metric.changeType === 'increase' 
                  ? metric.title === 'Total Outstanding' ? 'text-red-600' : 'text-green-600'
                  : 'text-green-600'
              }`}>
                {metric.changeType === 'increase' ? (
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 mr-1" />
                )}
                <span className="text-sm font-medium" data-testid={`${metric.testId}-change`}>
                  {metric.change}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {metric.title}
              </p>
              <p className="text-3xl font-bold text-foreground" data-testid={`${metric.testId}-value`}>
                {metric.value}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}