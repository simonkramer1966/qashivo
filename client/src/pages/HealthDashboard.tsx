import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  DollarSign, 
  Activity,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Shield,
  Target,
  Zap
} from "lucide-react";
import { 
  HealthDashboardData, 
  InvoiceHealthScore, 
  HealthMetrics,
  RiskLevel 
} from "../../../shared/healthTypes";

// Utility function for currency formatting
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

function getRiskColor(riskLevel: string): string {
  switch (riskLevel.toLowerCase()) {
    case 'low':
    case 'healthy':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'medium':
    case 'at_risk':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'high':
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getHealthScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function HealthMetricCard({ title, value, change, icon: Icon, color = "text-blue-600" }: {
  title: string;
  value: string | number;
  change?: { value: number; isPositive: boolean };
  icon: React.ComponentType<any>;
  color?: string;
}) {
  return (
    <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className={`p-2 bg-[#17B6C3]/10 rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <div className={`text-xs flex items-center mt-1 ${
            change.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {change.isPositive ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {Math.abs(change.value)}% from last week
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceHealthList({ invoices }: { invoices: InvoiceHealthScore[] }) {
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
            <BarChart3 className="h-5 w-5 text-[#17B6C3]" />
          </div>
          Invoice Health Scores
        </CardTitle>
        <CardDescription>
          Invoices sorted by health score (lowest risk first)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div
              key={invoice.invoiceId}
              className="flex items-center justify-between p-4 rounded-lg border bg-white/50 hover:bg-white/70 transition-colors"
              data-testid={`invoice-health-${invoice.invoiceId}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-semibold text-gray-900">
                    {invoice.invoiceNumber}
                  </h4>
                  <Badge className={getRiskColor(invoice.riskLevel)}>
                    {invoice.riskLevel.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600">
                  <p className="font-medium">{invoice.customerName}</p>
                  <p>
                    {formatCurrency(invoice.amount)} • Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                </div>
                {invoice.keyRiskFactors.length > 0 && (
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1">
                      {invoice.keyRiskFactors.slice(0, 2).map((factor: string, index: number) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600"
                        >
                          {typeof factor === 'string' ? factor : factor.description || factor.type || 'Risk Factor'}
                        </span>
                      ))}
                      {invoice.keyRiskFactors.length > 2 && (
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                          +{invoice.keyRiskFactors.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${getHealthScoreColor(invoice.healthScore)}`}>
                  {invoice.healthScore}
                </div>
                <div className="text-sm text-gray-500">Health Score</div>
                <div className="text-sm font-medium text-gray-700 mt-1">
                  {invoice.paymentLikelihood}% likely to pay
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function HealthDashboard() {
  const { data: healthData, isLoading, error, refetch } = useQuery<HealthDashboardData>({
    queryKey: ['/api/health/dashboard'],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-red-50 border-red-200">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Error Loading Health Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-700">
                Failed to load health dashboard data. Please try again.
              </p>
              <Button 
                onClick={() => refetch()} 
                className="mt-4 bg-red-600 hover:bg-red-700"
                data-testid="button-retry"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoice Health Dashboard</h1>
            <p className="text-gray-600 mt-1">
              AI-powered risk assessment and payment likelihood prediction
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh"
              className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-bulk-analyze"
            >
              <Zap className="h-4 w-4 mr-2" />
              Run Full Analysis
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
                  <CardHeader>
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-20 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Skeleton className="h-96" />
              <Skeleton className="h-96" />
            </div>
          </div>
        )}

        {/* Dashboard Content */}
        {healthData && (
          <>
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <HealthMetricCard
                title="Total Outstanding"
                value={formatCurrency(healthData.metrics.totalOutstanding)}
                icon={DollarSign}
                color="text-green-600"
              />
              <HealthMetricCard
                title="Average Health Score"
                value={`${healthData.metrics.averageHealthScore}/100`}
                icon={Activity}
                color="text-blue-600"
              />
              <HealthMetricCard
                title="Collection Rate Prediction"
                value={`${healthData.metrics.predictedCollectionRate}%`}
                icon={Target}
                color="text-purple-600"
              />
              <HealthMetricCard
                title="At-Risk Invoices"
                value={healthData.metrics.atRiskInvoices + healthData.metrics.criticalInvoices}
                icon={AlertTriangle}
                color="text-red-600"
              />
            </div>

            {/* Risk Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <Shield className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    Risk Distribution
                  </CardTitle>
                  <CardDescription>
                    Overview of invoice health across your portfolio
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Healthy</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {healthData.metrics.healthyInvoices} invoices
                      </span>
                    </div>
                    <Progress 
                      value={(healthData.metrics.healthyInvoices / healthData.metrics.totalInvoices) * 100} 
                      className="h-2 bg-green-100"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span className="text-sm font-medium">At Risk</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {healthData.metrics.atRiskInvoices} invoices
                      </span>
                    </div>
                    <Progress 
                      value={(healthData.metrics.atRiskInvoices / healthData.metrics.totalInvoices) * 100} 
                      className="h-2 bg-yellow-100"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-medium">Critical</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {healthData.metrics.criticalInvoices} invoices
                      </span>
                    </div>
                    <Progress 
                      value={(healthData.metrics.criticalInvoices / healthData.metrics.totalInvoices) * 100} 
                      className="h-2 bg-red-100"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    AI Insights
                  </CardTitle>
                  <CardDescription>
                    Key findings from AI analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                      <div className="p-1 bg-blue-100 rounded">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-800">Collection Opportunity</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Focus on the {healthData.metrics.atRiskInvoices} at-risk invoices for immediate attention. 
                          Predicted to recover {healthData.metrics.predictedCollectionRate}% with proper action.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-3">
                      <div className="p-1 bg-amber-100 rounded">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-amber-800">Risk Alert</h4>
                        <p className="text-sm text-amber-700 mt-1">
                          {healthData.metrics.criticalInvoices} invoices require immediate intervention. 
                          Consider escalating collection efforts.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full justify-between border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                    data-testid="button-detailed-insights"
                  >
                    View Detailed Analytics
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Invoice Health Scores */}
            {healthData.invoiceHealthScores.length > 0 && (
              <InvoiceHealthList invoices={healthData.invoiceHealthScores} />
            )}

            {/* Last Updated */}
            <div className="text-center text-sm text-gray-500">
              Last updated: {new Date(healthData.lastUpdated).toLocaleString()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}