import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  Clock, 
  DollarSign, 
  Users, 
  AlertTriangle,
  TrendingUp,
  Calendar,
  Target,
  Phone,
  Mail,
  CheckCircle,
  Info
} from "lucide-react";
import { formatDate } from "../../../../shared/utils/dateFormatter";

interface CustomerBreakdown {
  name: string;
  amount: number;
}

interface AgingBucket {
  bucket: string;
  amount: number;
  count: number;
  percentage: number;
  countPercentage: number;
  averageAmount: number;
  topCustomers: CustomerBreakdown[];
}

interface AgingSummary {
  totalOutstanding: number;
  totalInvoices: number;
  averageAge: number;
  oldestInvoice: number;
}

interface AgingAnalysisData {
  aging: AgingBucket[];
  summary: AgingSummary;
}

// Color scheme for aging buckets - green to red intensity
const AGING_COLORS = {
  "0-30 days": "#22c55e",      // Green - current
  "31-60 days": "#eab308",     // Yellow - attention needed  
  "61-90 days": "#f97316",     // Orange - concerning
  "90+ days": "#ef4444"        // Red - critical
};

// Custom tooltip for aging chart
interface AgingTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: AgingBucket;
  }>;
  label?: string;
}

const AgingTooltip = ({ active, payload, label }: AgingTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="glass-card p-4 shadow-lg min-w-[280px]">
      <p className="font-semibold text-slate-900 mb-2">{data.bucket}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Total Amount:</span>
          <span className="font-medium text-[#17B6C3]">
            ${data.amount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Invoice Count:</span>
          <span className="font-medium text-slate-900">{data.count}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Average Amount:</span>
          <span className="font-medium text-slate-900">
            ${data.averageAmount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">% of Total:</span>
          <span className="font-medium text-slate-900">{data.percentage}%</span>
        </div>
        {data.topCustomers.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-slate-600 text-xs mb-1">Top Customer:</p>
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900 text-xs truncate mr-2">
                {data.topCustomers[0].name}
              </span>
              <span className="font-medium text-[#17B6C3] text-xs">
                ${data.topCustomers[0].amount.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function AgingAnalysisHeatmap() {
  const { data, isLoading, error } = useQuery<AgingAnalysisData>({
    queryKey: ["/api/analytics/aging-analysis"],
    refetchOnMount: false,
  });

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3 animate-pulse">
              <Clock className="text-[#17B6C3] h-5 w-5" />
            </div>
            Aging Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Loading Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="glass-card p-4 animate-pulse">
                  <div className="h-16 bg-muted/30 rounded" />
                </div>
              ))}
            </div>
            {/* Loading Chart */}
            <div className="glass-card p-6 animate-pulse">
              <div className="h-80 bg-muted/30 rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-red-100 rounded-lg mr-3">
              <AlertTriangle className="text-red-600 h-5 w-5" />
            </div>
            Aging Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-lg font-semibold text-slate-900 mb-2">Unable to load aging analysis</p>
            <p className="text-sm text-muted-foreground">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.aging?.length) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
              <Clock className="text-[#17B6C3] h-5 w-5" />
            </div>
            Aging Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-[#17B6C3]" />
            </div>
            <p className="text-lg font-semibold text-slate-900 mb-2">No aging data available</p>
            <p className="text-sm text-muted-foreground">All invoices are current or paid</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { aging, summary } = data;

  // Prepare chart data with colors
  const chartData = aging.map(bucket => ({
    ...bucket,
    fill: AGING_COLORS[bucket.bucket as keyof typeof AGING_COLORS] || "#94a3b8",
    name: bucket.bucket
  }));

  // Prepare pie chart data for percentage visualization  
  const pieData = aging.filter(bucket => bucket.percentage > 0).map(bucket => ({
    name: bucket.bucket,
    value: bucket.percentage,
    amount: bucket.amount,
    count: bucket.count,
    fill: AGING_COLORS[bucket.bucket as keyof typeof AGING_COLORS] || "#94a3b8"
  }));

  // Calculate risk metrics
  const criticalAmount = aging.filter(bucket => 
    bucket.bucket === "61-90 days" || bucket.bucket === "90+ days"
  ).reduce((sum, bucket) => sum + bucket.amount, 0);

  const criticalPercentage = summary.totalOutstanding > 0 
    ? Math.round((criticalAmount / summary.totalOutstanding) * 100) 
    : 0;

  // Summary metrics
  const summaryMetrics = [
    {
      title: "Total Outstanding",
      value: `$${summary.totalOutstanding.toLocaleString()}`,
      change: `${summary.totalInvoices} invoices`,
      changeType: "neutral" as const,
      icon: DollarSign,
      testId: "metric-total-outstanding"
    },
    {
      title: "Average Age",
      value: `${summary.averageAge} days`,
      change: summary.averageAge > 45 ? "Above target" : "On track",
      changeType: summary.averageAge > 45 ? "negative" : "positive",
      icon: Clock,
      testId: "metric-average-age"
    },
    {
      title: "Critical Risk",
      value: `${criticalPercentage}%`,
      change: `$${criticalAmount.toLocaleString()}`,
      changeType: criticalPercentage > 30 ? "negative" : "positive",
      icon: AlertTriangle,
      testId: "metric-critical-risk"
    },
    {
      title: "Oldest Invoice",
      value: `${summary.oldestInvoice} days`,
      change: summary.oldestInvoice > 120 ? "Needs attention" : "Manageable",
      changeType: summary.oldestInvoice > 120 ? "negative" : "neutral",
      icon: Calendar,
      testId: "metric-oldest-invoice"
    },
  ];

  // Get action recommendations
  const getActionRecommendations = () => {
    const recommendations = [];
    
    if (criticalPercentage > 30) {
      recommendations.push({
        priority: "high",
        action: "Escalate 60+ day accounts",
        reason: `${criticalPercentage}% of outstanding is critically overdue`,
        testId: "action-escalate-critical"
      });
    }

    const overdue90 = aging.find(b => b.bucket === "90+ days");
    if (overdue90 && overdue90.amount > 10000) {
      recommendations.push({
        priority: "high", 
        action: "Legal review for 90+ days",
        reason: `$${overdue90.amount.toLocaleString()} in 90+ day accounts`,
        testId: "action-legal-review"
      });
    }

    if (summary.averageAge > 60) {
      recommendations.push({
        priority: "medium",
        action: "Review collection processes",
        reason: `Average age of ${summary.averageAge} days is above target`,
        testId: "action-review-processes"
      });
    }

    const currentBucket = aging.find(b => b.bucket === "0-30 days");
    if (currentBucket && currentBucket.percentage < 60) {
      recommendations.push({
        priority: "medium",
        action: "Improve early-stage collection",
        reason: `Only ${currentBucket.percentage}% of receivables are current`,
        testId: "action-improve-early-collection"
      });
    }

    return recommendations;
  };

  const recommendations = getActionRecommendations();

  return (
    <Card className="glass-card" data-testid="card-aging-analysis">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center" data-testid="text-aging-title">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
              <Clock className="text-[#17B6C3] h-5 w-5" />
            </div>
            Accounts Receivable Aging Analysis
          </CardTitle>
          <div className="flex items-center space-x-2">
            {criticalPercentage > 30 && (
              <Badge variant="destructive" className="text-xs" data-testid="badge-critical-risk">
                {criticalPercentage}% critically overdue
              </Badge>
            )}
            <Badge 
              variant={summary.averageAge <= 45 ? 'default' : 'secondary'} 
              className={`text-xs ${summary.averageAge <= 45 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
              data-testid="badge-aging-status"
            >
              Avg {summary.averageAge} days
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryMetrics.map((metric) => (
            <div 
              key={metric.title} 
              className="glass-card p-4"
              data-testid={metric.testId}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${
                  metric.changeType === 'negative' 
                    ? 'bg-red-100' 
                    : metric.changeType === 'positive' 
                    ? 'bg-green-100' 
                    : 'bg-[#17B6C3]/10'
                }`}>
                  <metric.icon className={`h-4 w-4 ${
                    metric.changeType === 'negative' 
                      ? 'text-red-600' 
                      : metric.changeType === 'positive' 
                      ? 'text-green-600' 
                      : 'text-[#17B6C3]'
                  }`} />
                </div>
                {metric.changeType === 'negative' && (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                {metric.changeType === 'positive' && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {metric.title}
                </p>
                <p className="text-lg font-bold text-gray-900" data-testid={`${metric.testId}-value`}>
                  {metric.value}
                </p>
                <p className={`text-xs ${
                  metric.changeType === 'negative' 
                    ? 'text-red-600' 
                    : metric.changeType === 'positive' 
                    ? 'text-green-600' 
                    : 'text-muted-foreground'
                }`} data-testid={`${metric.testId}-change`}>
                  {metric.change}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Visualization Tabs */}
        <Tabs defaultValue="bar-chart" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bar-chart" data-testid="tab-bar-chart">Amount Breakdown</TabsTrigger>
            <TabsTrigger value="pie-chart" data-testid="tab-pie-chart">Percentage View</TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">Top Customers</TabsTrigger>
          </TabsList>

          <TabsContent value="bar-chart">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900" data-testid="text-bar-chart-title">
                  Outstanding Amount by Age Bucket
                </h3>
                <div className="flex items-center space-x-4 text-sm">
                  {aging.map((bucket) => (
                    <div key={bucket.bucket} className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: AGING_COLORS[bucket.bucket as keyof typeof AGING_COLORS] }}
                      ></div>
                      <span className="text-slate-600">{bucket.bucket}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-80" data-testid="chart-aging-bar">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis 
                      dataKey="bucket" 
                      stroke="#64748b"
                      fontSize={12}
                      tick={{ fill: '#64748b' }}
                    />
                    <YAxis 
                      stroke="#64748b"
                      fontSize={12}
                      tick={{ fill: '#64748b' }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<AgingTooltip />} />
                    <Bar 
                      dataKey="amount" 
                      radius={[4, 4, 0, 0]}
                      name="Outstanding Amount"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pie-chart">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900" data-testid="text-pie-chart-title">
                  Distribution by Percentage
                </h3>
              </div>

              <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-8">
                <div className="h-80 w-full lg:w-1/2" data-testid="chart-aging-pie">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({bucket, percentage}) => `${bucket}: ${percentage}%`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any, name: string, props: any) => [
                        `${value}% ($${props.payload.amount.toLocaleString()})`,
                        name
                      ]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full lg:w-1/2 space-y-3">
                  {aging.map((bucket) => (
                    <div 
                      key={bucket.bucket} 
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200"
                      data-testid={`bucket-summary-${bucket.bucket.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: AGING_COLORS[bucket.bucket as keyof typeof AGING_COLORS] }}
                        />
                        <div>
                          <p className="font-medium text-slate-900">{bucket.bucket}</p>
                          <p className="text-xs text-slate-600">{bucket.count} invoices</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">${bucket.amount.toLocaleString()}</p>
                        <p className="text-xs text-slate-600">{bucket.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="customers">
            <div className="space-y-4">
              {aging.filter(bucket => bucket.topCustomers.length > 0).map((bucket) => (
                <div key={bucket.bucket} className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: AGING_COLORS[bucket.bucket as keyof typeof AGING_COLORS] }}
                      />
                      {bucket.bucket} - Top Customers
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      ${bucket.amount.toLocaleString()} total
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bucket.topCustomers.map((customer, index) => (
                      <div 
                        key={`${bucket.bucket}-${customer.name}`}
                        className="p-4 rounded-lg border border-slate-200 hover:border-[#17B6C3] transition-colors"
                        data-testid={`customer-${bucket.bucket.replace(/\s+/g, '-').toLowerCase()}-${index}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-slate-600" />
                            <span className="text-xs text-slate-600">#{index + 1}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0"
                              data-testid={`button-call-customer-${index}`}
                            >
                              <Phone className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0"
                              data-testid={`button-email-customer-${index}`}
                            >
                              <Mail className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="font-medium text-slate-900 truncate mb-1" title={customer.name}>
                          {customer.name}
                        </p>
                        <p className="text-lg font-bold text-[#17B6C3]">
                          ${customer.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-600">
                          {Math.round((customer.amount / bucket.amount) * 100)}% of bucket
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Recommendations */}
        {recommendations.length > 0 && (
          <div className="glass-card p-4 border-l-4 border-amber-500" data-testid="section-recommendations">
            <div className="flex items-center space-x-2 mb-3">
              <Target className="h-5 w-5 text-amber-600" />
              <h4 className="font-semibold text-amber-900">Recommended Actions</h4>
            </div>
            <div className="space-y-2">
              {recommendations.map((rec, index) => (
                <div 
                  key={index}
                  className="flex items-start justify-between p-3 bg-amber-50 rounded-lg"
                  data-testid={rec.testId}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge 
                        variant={rec.priority === 'high' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {rec.priority.toUpperCase()}
                      </Badge>
                      <p className="font-medium text-amber-900">{rec.action}</p>
                    </div>
                    <p className="text-sm text-amber-800">{rec.reason}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-amber-700 border-amber-300 hover:bg-amber-100 ml-4"
                    data-testid={`${rec.testId}-button`}
                  >
                    Take Action
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {recommendations.length === 0 && (
          <div className="glass-card p-4 border-l-4 border-green-500" data-testid="success-healthy-aging">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-green-900">Healthy Aging Profile</h4>
            </div>
            <p className="text-sm text-green-800 mt-1">
              Your accounts receivable aging is within acceptable parameters. Continue monitoring for changes.
            </p>
          </div>
        )}

        {/* Aging Insights */}
        <div className="glass-card p-4">
          <div className="flex items-start space-x-2">
            <Info className="h-4 w-4 text-[#17B6C3] mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-700">
              <p className="font-medium mb-1">Aging Analysis Insights</p>
              <p>
                This analysis categorizes your outstanding receivables by overdue periods. 
                Focus collection efforts on accounts in the 61-90 and 90+ day buckets to minimize bad debt risk.
                Industry benchmark: Keep 60+ day receivables under 25% of total outstanding.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}