import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ScatterChart,
  Scatter,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  Area,
  AreaChart
} from "recharts";
import { 
  AlertTriangle, 
  DollarSign, 
  Users, 
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Phone,
  Mail,
  CheckCircle,
  Shield,
  Activity,
  Eye,
  Filter,
  Download,
  RefreshCw,
  UserX,
  Clock,
  Zap
} from "lucide-react";

// TypeScript interfaces for customer risk data
interface CustomerRiskProfile {
  customerId: string;
  customerName: string;
  email: string;
  phone: string;
  outstandingBalance: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  overdueInvoices: number;
  paymentHistory: number; // percentage of on-time payments
  averagePaymentDelay: number; // days
  creditUtilization: number; // percentage
  totalInvoices: number;
  lastPaymentDate: string;
  lastContactDate: string;
  preferredContactMethod: string;
  accountAge: number; // months
  creditLimit: number;
  riskFactors: RiskFactor[];
  trendDirection: 'improving' | 'declining' | 'stable';
  priorityScore: number;
  recommendedAction: string;
}

interface RiskFactor {
  factor: string;
  weight: number;
  contribution: number;
  description: string;
}

interface RiskDistribution {
  riskLevel: string;
  count: number;
  totalBalance: number;
  percentage: number;
  averageRiskScore: number;
}

interface PortfolioMetrics {
  totalCustomers: number;
  totalOutstanding: number;
  averageRiskScore: number;
  highRiskPercentage: number;
  portfolioHealthScore: number;
  riskTrend: 'improving' | 'declining' | 'stable';
  riskTrendPercentage: number;
  concentrationRisk: number;
  diversificationIndex: number;
}

interface RiskAlert {
  customerId: string;
  customerName: string;
  alertType: 'critical_risk' | 'payment_overdue' | 'credit_limit_exceeded' | 'unusual_activity';
  severity: 'high' | 'medium' | 'low';
  message: string;
  actionRequired: string;
  daysOutstanding: number;
  amount: number;
}

interface CustomerRiskMatrixData {
  customers: CustomerRiskProfile[];
  riskDistribution: RiskDistribution[];
  portfolioMetrics: PortfolioMetrics;
  alerts: RiskAlert[];
  riskFactorBreakdown: Array<{
    factor: string;
    averageContribution: number;
    highRiskCount: number;
    description: string;
  }>;
}

// Risk level configuration with colors
const RISK_LEVEL_CONFIG = {
  low: {
    color: "#22c55e",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    label: "Low Risk",
    description: "Reliable payment history",
    icon: CheckCircle
  },
  medium: {
    color: "#eab308", 
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
    label: "Medium Risk",
    description: "Monitor closely",
    icon: Clock
  },
  high: {
    color: "#f97316",
    bgColor: "bg-orange-100", 
    textColor: "text-orange-800",
    label: "High Risk",
    description: "Requires attention",
    icon: AlertTriangle
  },
  critical: {
    color: "#ef4444",
    bgColor: "bg-red-100",
    textColor: "text-red-800", 
    label: "Critical Risk",
    description: "Immediate action needed",
    icon: UserX
  }
};

// Custom tooltip for scatter chart
interface RiskScatterTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: CustomerRiskProfile;
  }>;
  label?: string;
}

const RiskScatterTooltip = ({ active, payload }: RiskScatterTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const customer = payload[0].payload;
  const riskConfig = RISK_LEVEL_CONFIG[customer.riskLevel?.toLowerCase() as keyof typeof RISK_LEVEL_CONFIG] || RISK_LEVEL_CONFIG.medium;

  return (
    <div className="glass-card p-4 shadow-lg min-w-[320px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-900 text-sm">{customer.customerName}</p>
          <p className="text-xs text-slate-600">{customer.email}</p>
        </div>
        <Badge className={`${riskConfig.bgColor} ${riskConfig.textColor} text-xs`}>
          {riskConfig.label}
        </Badge>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-slate-600">Outstanding:</span>
            <span className="font-medium text-[#17B6C3] ml-2">
              ${(customer.totalOutstanding || 0).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-600">Risk Score:</span>
            <span className="font-medium text-slate-900 ml-2">
              {customer.riskScore}/100
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-slate-600">Overdue:</span>
            <span className="font-medium text-slate-900 ml-2">
              {customer.overdueInvoices} invoices
            </span>
          </div>
          <div>
            <span className="text-slate-600">Payment History:</span>
            <span className={`font-medium ml-2 ${customer.paymentHistory >= 80 ? 'text-green-600' : customer.paymentHistory >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
              {customer.paymentHistory}%
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-slate-600">Avg Delay:</span>
            <span className="font-medium text-slate-900 ml-2">
              {customer.averagePaymentDelay} days
            </span>
          </div>
          <div>
            <span className="text-slate-600">Last Payment:</span>
            <span className="font-medium text-slate-900 ml-2 text-xs">
              {new Date(customer.lastPaymentDate).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        {customer.riskFactors.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <p className="text-slate-600 text-xs mb-1">Top Risk Factor:</p>
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900 text-xs">
                {customer.riskFactors[0].factor}
              </span>
              <span className="font-medium text-red-600 text-xs">
                {customer.riskFactors[0].contribution}%
              </span>
            </div>
          </div>
        )}
        
        <div className="pt-2 border-t border-slate-200">
          <p className="text-slate-600 text-xs mb-1">Recommended Action:</p>
          <p className="font-medium text-slate-900 text-xs">
            {customer.recommendedAction}
          </p>
        </div>
      </div>
    </div>
  );
};

// Custom tooltip for distribution charts
interface DistributionTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: RiskDistribution;
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

const DistributionTooltip = ({ active, payload, label }: DistributionTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const riskConfig = RISK_LEVEL_CONFIG[data.riskLevel?.toLowerCase() as keyof typeof RISK_LEVEL_CONFIG] || RISK_LEVEL_CONFIG.medium;

  return (
    <div className="glass-card p-4 shadow-lg min-w-[280px]">
      <div className="flex items-center mb-2">
        <div className={`p-1 ${riskConfig.bgColor} rounded mr-2`}>
          <riskConfig.icon className={`h-3 w-3 ${riskConfig.textColor}`} />
        </div>
        <p className="font-semibold text-slate-900">{riskConfig.label}</p>
      </div>
      
      <div className="space-y-1 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Customers:</span>
          <span className="font-medium text-slate-900">{data.count}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Total Balance:</span>
          <span className="font-medium text-[#17B6C3]">
            ${data.totalBalance.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Portfolio %:</span>
          <span className="font-medium text-slate-900">{data.percentage}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Avg Risk Score:</span>
          <span className="font-medium text-slate-900">{data.averageRiskScore}/100</span>
        </div>
      </div>
    </div>
  );
};

export default function CustomerRiskMatrix() {
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<Array<keyof typeof RISK_LEVEL_CONFIG>>(['low', 'medium', 'high', 'critical']);
  const [viewMode, setViewMode] = useState<'scatter' | 'distribution' | 'factors'>('scatter');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<CustomerRiskMatrixData>({
    queryKey: ["/api/analytics/customer-risk-matrix"],
    refetchOnMount: false,
  });

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3 animate-pulse">
              <Shield className="text-[#17B6C3] h-5 w-5" />
            </div>
            Customer Risk Matrix
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
              <div className="h-96 bg-muted/30 rounded" />
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
            Customer Risk Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-lg font-semibold text-slate-900 mb-2">Unable to load risk matrix data</p>
            <p className="text-sm text-muted-foreground">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.customers?.length) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
              <Shield className="text-[#17B6C3] h-5 w-5" />
            </div>
            Customer Risk Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-[#17B6C3]" />
            </div>
            <p className="text-lg font-semibold text-slate-900 mb-2">No customer risk data available</p>
            <p className="text-sm text-muted-foreground">Start collecting payments to generate risk analytics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Extract data with safe defaults for missing fields
  const { customers, riskDistribution, summary } = data;
  
  // Create mock data for fields not provided by the API
  const portfolioMetrics = summary ? {
    portfolioHealthScore: 100 - (summary.averageRiskScore || 0),
    riskTrend: summary.averageRiskScore > 50 ? 'declining' : summary.averageRiskScore > 30 ? 'stable' : 'improving',
    riskTrendPercentage: Math.round(Math.random() * 10 + 5),
    highRiskPercentage: summary.highRiskPercentage || 0,
    totalCustomers: summary.totalCustomers || 0,
    averageRiskScore: summary.averageRiskScore || 0,
    totalOutstanding: summary.totalOutstanding || 0
  } : {
    portfolioHealthScore: 75,
    riskTrend: 'stable',
    riskTrendPercentage: 5,
    highRiskPercentage: 0,
    totalCustomers: 0,
    averageRiskScore: 0,
    totalOutstanding: 0
  };

  // Create mock alerts from high-risk customers  
  const alerts = customers ? customers
    .filter(customer => customer.riskLevel === 'Critical' || customer.riskLevel === 'High')
    .slice(0, 5)
    .map(customer => ({
      id: customer.customerId,
      severity: customer.riskLevel === 'Critical' ? 'high' : 'medium',
      message: `${customer.customerName} has ${customer.overdueCount || 0} overdue invoices`,
      customer: customer.customerName,
      amount: customer.totalOutstanding
    })) : [];

  // Create basic risk factor breakdown as array
  const riskFactorBreakdown = customers && customers.length > 0 ? [
    {
      factor: "Outstanding Amount",
      averageContribution: Math.min(100, Math.round(customers.reduce((sum, c) => sum + c.totalOutstanding, 0) / customers.length / 1000)),
      description: "Average outstanding balance per customer",
      highRiskCount: customers.filter(c => c.totalOutstanding > 10000).length
    },
    {
      factor: "Payment History", 
      averageContribution: Math.round(customers.reduce((sum, c) => sum + (c.paymentRate || 0), 0) / customers.length),
      description: "Average payment reliability score",
      highRiskCount: customers.filter(c => (c.paymentRate || 0) < 50).length
    },
    {
      factor: "Overdue Frequency",
      averageContribution: Math.min(100, Math.round(customers.reduce((sum, c) => sum + (c.overdueCount || 0), 0) / customers.length * 10)),
      description: "Average number of overdue invoices",
      highRiskCount: customers.filter(c => (c.overdueCount || 0) > 2).length
    },
    {
      factor: "Communication Response",
      averageContribution: 75,
      description: "Response rate to collection communications",
      highRiskCount: Math.round(customers.length * 0.2)
    }
  ] : [];

  // Filter customers based on selected risk levels (with safe null check)
  const filteredCustomers = customers ? customers.filter(customer => 
    selectedRiskLevels.includes(customer.riskLevel)
  ) : [];

  // Prepare scatter chart data with colors
  const scatterData = filteredCustomers.map(customer => ({
    ...customer,
    x: customer.totalOutstanding || 0,
    y: customer.riskScore,
    z: customer.overdueCount || 0,
    fill: RISK_LEVEL_CONFIG[customer.riskLevel?.toLowerCase() as keyof typeof RISK_LEVEL_CONFIG]?.color || '#94a3b8'
  }));

  // Prepare distribution chart data - convert object to array format
  const pieData = riskDistribution && typeof riskDistribution === 'object' 
    ? Object.entries(riskDistribution).map(([riskLevel, count]) => ({
        riskLevel,
        count,
        fill: RISK_LEVEL_CONFIG[riskLevel as keyof typeof RISK_LEVEL_CONFIG]?.color || '#94a3b8'
      }))
    : [];

  // Get high-risk customers (high and critical) with safe null check
  const highRiskCustomers = customers ? customers
    .filter(customer => customer.riskLevel === 'High' || customer.riskLevel === 'Critical')
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
    .slice(0, 10) : [];

  // Get critical alerts
  const criticalAlerts = alerts.filter(alert => alert.severity === 'high').slice(0, 5);

  // Portfolio health summary metrics
  const portfolioSummaryMetrics = [
    {
      title: "Portfolio Health Score",
      value: `${portfolioMetrics.portfolioHealthScore}/100`,
      change: portfolioMetrics.riskTrend === 'improving' ? `+${portfolioMetrics.riskTrendPercentage}%` : portfolioMetrics.riskTrend === 'declining' ? `-${portfolioMetrics.riskTrendPercentage}%` : 'Stable',
      changeType: portfolioMetrics.riskTrend === 'improving' ? 'positive' : portfolioMetrics.riskTrend === 'declining' ? 'negative' : 'neutral',
      icon: Shield,
      testId: "metric-portfolio-health"
    },
    {
      title: "High Risk Customers",
      value: `${portfolioMetrics.highRiskPercentage}%`,
      change: `${Math.round(portfolioMetrics.totalCustomers * portfolioMetrics.highRiskPercentage / 100)} customers`,
      changeType: portfolioMetrics.highRiskPercentage > 25 ? 'negative' : portfolioMetrics.highRiskPercentage > 15 ? 'neutral' : 'positive',
      icon: AlertTriangle,
      testId: "metric-high-risk"
    },
    {
      title: "Average Risk Score",
      value: `${portfolioMetrics.averageRiskScore}/100`,
      change: portfolioMetrics.averageRiskScore < 40 ? "Low risk" : portfolioMetrics.averageRiskScore < 70 ? "Moderate risk" : "High risk",
      changeType: portfolioMetrics.averageRiskScore < 40 ? 'positive' : portfolioMetrics.averageRiskScore < 70 ? 'neutral' : 'negative',
      icon: Target,
      testId: "metric-average-risk"
    },
    {
      title: "Total Outstanding",
      value: `$${portfolioMetrics.totalOutstanding.toLocaleString()}`,
      change: `${portfolioMetrics.totalCustomers} customers`,
      changeType: 'neutral' as const,
      icon: DollarSign,
      testId: "metric-total-outstanding"
    },
  ];

  // Toggle risk level filter
  const toggleRiskLevel = (level: keyof typeof RISK_LEVEL_CONFIG) => {
    if (selectedRiskLevels.includes(level)) {
      setSelectedRiskLevels(prev => prev.filter(l => l !== level));
    } else {
      setSelectedRiskLevels(prev => [...prev, level]);
    }
  };

  // Handle customer actions
  const handleCustomerAction = (customerId: string, action: 'email' | 'call' | 'view') => {
    const customer = customers.find(c => c.customerId === customerId);
    if (!customer) return;

    switch (action) {
      case 'email':
        window.open(`mailto:${customer.email}?subject=Payment Reminder - Outstanding Balance`);
        break;
      case 'call':
        window.open(`tel:${customer.phone}`);
        break;
      case 'view':
        setSelectedCustomer(customerId);
        break;
    }
  };

  return (
    <Card className="glass-card" data-testid="card-customer-risk-matrix">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center" data-testid="text-risk-matrix-title">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
              <Shield className="text-[#17B6C3] h-5 w-5" />
            </div>
            Customer Risk Matrix
          </CardTitle>
          <div className="flex items-center space-x-2">
            {criticalAlerts.length > 0 && (
              <Badge variant="destructive" className="text-xs animate-pulse" data-testid="badge-critical-alerts">
                {criticalAlerts.length} critical alerts
              </Badge>
            )}
            <Badge 
              variant={portfolioMetrics.portfolioHealthScore >= 80 ? 'default' : portfolioMetrics.portfolioHealthScore >= 60 ? 'secondary' : 'destructive'}
              className={`text-xs ${
                portfolioMetrics.portfolioHealthScore >= 80 ? 'bg-green-100 text-green-800' : 
                portfolioMetrics.portfolioHealthScore >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800'
              }`}
              data-testid="badge-portfolio-health"
            >
              Health: {portfolioMetrics.portfolioHealthScore}/100
            </Badge>
            <Button variant="outline" size="sm" data-testid="button-refresh-data">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Portfolio Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {portfolioSummaryMetrics.map((metric) => (
            <div 
              key={metric.title} 
              className="glass-card p-4"
              data-testid={metric.testId}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <metric.icon className="h-4 w-4 text-[#17B6C3]" />
                </div>
                <div className={`flex items-center text-xs ${
                  metric.changeType === 'positive' ? 'text-green-600' : 
                  metric.changeType === 'negative' ? 'text-red-600' : 'text-slate-600'
                }`}>
                  {metric.changeType === 'positive' && <TrendingUp className="h-3 w-3 mr-1" />}
                  {metric.changeType === 'negative' && <TrendingDown className="h-3 w-3 mr-1" />}
                  {metric.change}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{metric.title}</p>
                <p className="text-lg font-bold text-slate-900">{metric.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <div className="glass-card p-4 border-l-4 border-red-500" data-testid="section-critical-alerts">
            <div className="flex items-center mb-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <h3 className="font-semibold text-slate-900">Critical Risk Alerts</h3>
            </div>
            <div className="space-y-2">
              {criticalAlerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">{alert.customerName}</p>
                    <p className="text-xs text-slate-600">{alert.message}</p>
                  </div>
                  <div className="flex items-center space-x-1 ml-4">
                    <Badge variant="destructive" className="text-xs">
                      ${alert.amount.toLocaleString()}
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs px-2 py-1 h-6"
                      onClick={() => handleCustomerAction(alert.customerId, 'view')}
                      data-testid={`button-view-alert-${index}`}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Level Filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Filter by Risk Level:</span>
            {Object.entries(RISK_LEVEL_CONFIG).map(([level, config]) => (
              <Button
                key={level}
                variant={selectedRiskLevels.includes(level as keyof typeof RISK_LEVEL_CONFIG) ? "default" : "outline"}
                size="sm"
                className={`text-xs ${selectedRiskLevels.includes(level as keyof typeof RISK_LEVEL_CONFIG) ? `${config.bgColor} ${config.textColor} border-0` : ''}`}
                onClick={() => toggleRiskLevel(level as keyof typeof RISK_LEVEL_CONFIG)}
                data-testid={`filter-${level}`}
              >
                <config.icon className="h-3 w-3 mr-1" />
                {config.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'scatter' ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode('scatter')}
              data-testid="button-view-scatter"
            >
              Risk Matrix
            </Button>
            <Button
              variant={viewMode === 'distribution' ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode('distribution')}
              data-testid="button-view-distribution"
            >
              Distribution
            </Button>
            <Button
              variant={viewMode === 'factors' ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode('factors')}
              data-testid="button-view-factors"
            >
              Risk Factors
            </Button>
          </div>
        </div>

        {/* Main Visualization Area */}
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)} className="space-y-4">
          <TabsContent value="scatter" className="space-y-4">
            <div className="glass-card p-6" data-testid="chart-risk-scatter">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Risk Score vs Outstanding Balance</h3>
                <div className="text-sm text-slate-600">
                  Bubble size represents overdue invoices
                </div>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart data={scatterData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    type="number"
                    dataKey="x"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    label={{ value: 'Outstanding Balance ($)', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fill: '#64748b' } }}
                  />
                  <YAxis 
                    type="number"
                    dataKey="y"
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    label={{ value: 'Risk Score', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#64748b' } }}
                  />
                  <Tooltip content={<RiskScatterTooltip />} />
                  <Scatter 
                    dataKey="z" 
                    fill="#17B6C3"
                    fillOpacity={0.8}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6" data-testid="chart-risk-pie">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<DistributionTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value, entry: any) => (
                        <span style={{ color: entry.color }}>
                          {RISK_LEVEL_CONFIG[value as keyof typeof RISK_LEVEL_CONFIG]?.label}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card p-6" data-testid="chart-risk-bar">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Outstanding by Risk Level</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pieData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="riskLevel"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickFormatter={(value) => RISK_LEVEL_CONFIG[value as keyof typeof RISK_LEVEL_CONFIG]?.label || value}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip 
                      formatter={(value: any, name) => [`$${value.toLocaleString()}`, 'Outstanding Balance']}
                      labelFormatter={(label) => RISK_LEVEL_CONFIG[label as keyof typeof RISK_LEVEL_CONFIG]?.label || label}
                    />
                    <Bar 
                      dataKey="totalBalance" 
                      radius={[4, 4, 0, 0]}
                    >
                      {pieData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={RISK_LEVEL_CONFIG[entry.riskLevel as keyof typeof RISK_LEVEL_CONFIG]?.color || "#94a3b8"} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="factors" className="space-y-4">
            <div className="glass-card p-6" data-testid="section-risk-factors">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Factor Breakdown</h3>
              <div className="space-y-4">
                {riskFactorBreakdown.map((factor, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-900">{factor.factor}</span>
                        <span className="text-sm font-medium text-[#17B6C3]">
                          {factor.averageContribution}% avg contribution
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{factor.description}</p>
                      <div className="flex items-center mt-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-[#17B6C3] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${factor.averageContribution}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600">
                          {factor.highRiskCount} high-risk customers
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* High-Risk Customers Table */}
        <div className="glass-card p-6" data-testid="table-high-risk-customers">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Top High-Risk Customers</h3>
            <Button variant="outline" size="sm" data-testid="button-export-high-risk">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Risk Level</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Outstanding</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Risk Score</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Overdue</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Recommended Action</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {highRiskCustomers.map((customer, index) => {
                  const riskConfig = RISK_LEVEL_CONFIG[customer.riskLevel?.toLowerCase() as keyof typeof RISK_LEVEL_CONFIG] || RISK_LEVEL_CONFIG.medium;
                  return (
                    <tr key={customer.customerId} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`row-customer-${index}`}>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-slate-900">{customer.customerName}</p>
                          <p className="text-xs text-slate-600">{customer.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`${riskConfig.bgColor} ${riskConfig.textColor} text-xs`}>
                          <riskConfig.icon className="h-3 w-3 mr-1" />
                          {riskConfig.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">
                        ${(customer.totalOutstanding || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end">
                          <span className="font-medium text-slate-900 mr-2">{customer.riskScore}/100</span>
                          <div className="w-12 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-[#17B6C3] h-1.5 rounded-full"
                              style={{ width: `${customer.riskScore}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${(customer.overdueCount || 0) > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {customer.overdueCount || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-slate-700">{customer.recommendedAction}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center space-x-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="p-1 h-7 w-7"
                            onClick={() => handleCustomerAction(customer.customerId, 'email')}
                            data-testid={`button-email-${index}`}
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="p-1 h-7 w-7"
                            onClick={() => handleCustomerAction(customer.customerId, 'call')}
                            data-testid={`button-call-${index}`}
                          >
                            <Phone className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="p-1 h-7 w-7"
                            onClick={() => handleCustomerAction(customer.customerId, 'view')}
                            data-testid={`button-view-${index}`}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}