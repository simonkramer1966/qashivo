import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, AlertTriangle, Clock, TrendingUp, Calendar } from "lucide-react";

export default function MetricsOverview() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded" />
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
      icon: AlertTriangle,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      testId: "metric-total-outstanding"
    },
    {
      title: "Overdue Invoices",
      value: ((metrics as any)?.overdueCount || 0).toString(),
      change: "-8%",
      changeType: "decrease" as const,
      icon: Clock,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      testId: "metric-overdue-count"
    },
    {
      title: "Collection Rate",
      value: `${(metrics as any)?.collectionRate || 0}%`,
      change: "+3.2%",
      changeType: "increase" as const,
      icon: TrendingUp,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      testId: "metric-collection-rate"
    },
    {
      title: "Avg Days to Pay",
      value: ((metrics as any)?.avgDaysToPay || 0).toString(),
      change: "-5 days",
      changeType: "decrease" as const,
      icon: Calendar,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      testId: "metric-avg-days"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metricsData.map((metric) => (
        <Card key={metric.title} className="metric-card" data-testid={metric.testId}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </p>
                <p className="text-3xl font-bold text-foreground" data-testid={`${metric.testId}-value`}>
                  {metric.value}
                </p>
                <p className={`text-sm flex items-center mt-1 ${
                  metric.changeType === 'increase' 
                    ? metric.title === 'Total Outstanding' ? 'text-destructive' : 'text-green-600'
                    : 'text-green-600'
                }`}>
                  {metric.changeType === 'increase' ? (
                    <ArrowUp className="mr-1 h-4 w-4" />
                  ) : (
                    <ArrowDown className="mr-1 h-4 w-4" />
                  )}
                  <span data-testid={`${metric.testId}-change`}>{metric.change}</span>
                  <span className="text-muted-foreground ml-1">vs last month</span>
                </p>
              </div>
              <div className={`w-12 h-12 ${metric.iconBg} rounded-lg flex items-center justify-center`}>
                <metric.icon className={`${metric.iconColor} text-xl`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
