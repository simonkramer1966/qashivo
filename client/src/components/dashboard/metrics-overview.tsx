import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, AlertTriangle, Clock, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, DollarSign } from "lucide-react";

export default function MetricsOverview() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
    refetchOnMount: false,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-white border border-gray-200 shadow-sm animate-pulse">
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
      {metricsData.map((metric) => (
        <Card 
          key={metric.title} 
          className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" 
          data-testid={metric.testId}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <metric.icon className="h-4 w-4 text-[#17B6C3]" />
              </div>
              <div className={`flex items-center text-sm ${
                metric.changeType === 'increase' 
                  ? metric.title === 'Total Outstanding' ? 'text-red-600' : 'text-green-600'
                  : 'text-green-600'
              }`}>
                {metric.changeType === 'increase' ? (
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 mr-1" />
                )}
                <span className="font-medium" data-testid={`${metric.testId}-change`}>
                  {metric.change}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                {metric.title}
              </p>
              <p className="text-2xl font-bold text-gray-900" data-testid={`${metric.testId}-value`}>
                {metric.value}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}