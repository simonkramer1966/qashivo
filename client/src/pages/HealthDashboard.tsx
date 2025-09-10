import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
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

function InvoiceHealthList({ invoices, isLoading }: { invoices: InvoiceHealthScore[]; isLoading?: boolean }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Calculate pagination
  const totalPages = Math.ceil(invoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentInvoices = invoices.slice(startIndex, endIndex);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
            <BarChart3 className="h-5 w-5 text-[#17B6C3]" />
          </div>
          Invoice Health Scores
        </CardTitle>
        <CardDescription>
          Invoices sorted by health score (lowest risk first) • Showing {startIndex + 1}-{Math.min(endIndex, invoices.length)} of {invoices.length}
          {isLoading && <span className="text-blue-600 ml-2">• Refreshing AI analysis...</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {currentInvoices.map((invoice) => (
            <div
              key={invoice.invoiceId}
              className="flex items-center justify-between p-3 rounded-lg border bg-white/50 hover:bg-white/70 transition-colors"
              data-testid={`invoice-health-${invoice.invoiceId}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900 text-sm truncate">
                    {invoice.invoiceNumber}
                  </h4>
                  <Badge className={`text-xs px-1.5 py-0.5 ${getRiskColor(invoice.riskLevel)}`}>
                    {invoice.riskLevel.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className="text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate pr-2">{invoice.customerName}</span>
                    <span className="whitespace-nowrap">
                      {formatCurrency(invoice.amount)} • Due: {new Date(invoice.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {invoice.keyRiskFactors.length > 0 && (
                  <div className="mt-1">
                    <div className="flex flex-wrap gap-1">
                      {invoice.keyRiskFactors.slice(0, 2).map((factor: string, index: number) => (
                        <span
                          key={index}
                          className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600"
                        >
                          {typeof factor === 'string' ? factor : factor.description || factor.type || 'Risk Factor'}
                        </span>
                      ))}
                      {invoice.keyRiskFactors.length > 2 && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                          +{invoice.keyRiskFactors.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right ml-4">
                <div className={`text-xl font-bold ${getHealthScoreColor(invoice.healthScore)}`}>
                  {invoice.healthScore}
                </div>
                <div className="text-xs text-gray-500">Health Score</div>
                <div className="text-xs font-medium text-gray-700">
                  {invoice.paymentLikelihood}% likely
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                data-testid="button-prev-page"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
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
      <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <NewSidebar />
        <main className="flex-1 overflow-y-auto">
          <Header 
            title="Invoice Health Dashboard" 
            subtitle="AI-powered risk assessment and payment likelihood prediction" 
          />
          <div className="p-8">
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
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Invoice Health Dashboard" 
          subtitle="AI-powered risk assessment and payment likelihood prediction" 
        />
        <div className="p-8 space-y-8">
          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
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
              <InvoiceHealthList invoices={healthData.invoiceHealthScores} isLoading={isLoading} />
            )}

            {/* Last Updated */}
            <div className="text-center text-sm text-gray-500">
              Last updated: {new Date(healthData.lastUpdated).toLocaleString()}
            </div>
          </>
        )}
        </div>
      </main>
    </div>
  );
}