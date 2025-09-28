import { useQuery } from "@tanstack/react-query";
import { 
  Heart, 
  CreditCard, 
  Activity, 
  Users, 
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Mail,
  Phone,
  UserCheck
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ClientHealthScore {
  tenantId: string;
  tenantName: string;
  overallScore: number;
  paymentHealthScore: number;
  usageHealthScore: number;
  supportHealthScore: number;
  subscriptionHealthScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastCalculatedAt: Date;
}

interface ClientHealthDetails {
  client: {
    id: string;
    name: string;
    createdAt: string;
    metadata: {
      billingEmail: string;
      subscriptionStatus: string;
      tenantType: string;
      isInTrial: boolean;
      trialEndDate: string | null;
    } | null;
  };
  healthScore: ClientHealthScore;
  paymentMetrics: {
    totalInvoices: number;
    paidOnTime: number;
    overdue: number;
    averageDaysToPay: number;
    totalOutstanding: number;
  };
  usageMetrics: {
    lastLoginDate: Date | null;
    loginFrequency: number;
    featuresUsed: string[];
    invoicesProcessed: number;
  };
  subscriptionMetrics: {
    planName: string;
    planType: string;
    subscriptionStatus: string;
    trialDaysRemaining: number | null;
    monthlyRevenue: number;
  };
  partnerInfo: {
    partnerId: string | null;
    partnerName: string | null;
    assignedDate: Date | null;
  };
}

const CHART_COLORS = {
  primary: "#17B6C3",
  secondary: "#1396A1", 
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  neutral: "#6B7280"
};

const chartConfig = {
  paymentHealth: {
    label: "Payment Health",
    color: CHART_COLORS.primary,
  },
  usageHealth: {
    label: "Usage Health",
    color: CHART_COLORS.secondary,
  },
  subscriptionHealth: {
    label: "Subscription Health",
    color: CHART_COLORS.success,
  },
  supportHealth: {
    label: "Support Health",
    color: CHART_COLORS.warning,
  }
};

function HealthScoreCard({ 
  title, 
  score, 
  icon: Icon, 
  description,
  color 
}: {
  title: string;
  score: number;
  icon: any;
  description: string;
  color: string;
}) {
  return (
    <Card className="glass-card-light">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-800 mb-2">{score}%</div>
        <Progress value={score} className="mb-2" />
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function HealthScorePieChart({ healthScore }: { healthScore: ClientHealthScore }) {
  const data = [
    { name: 'Payment Health', value: healthScore.paymentHealthScore, fill: CHART_COLORS.primary },
    { name: 'Usage Health', value: healthScore.usageHealthScore, fill: CHART_COLORS.secondary },
    { name: 'Subscription Health', value: healthScore.subscriptionHealthScore, fill: CHART_COLORS.success },
    { name: 'Support Health', value: healthScore.supportHealthScore, fill: CHART_COLORS.warning }
  ];

  return (
    <Card className="glass-card-light">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Health Score Breakdown
        </CardTitle>
        <CardDescription>
          Overall Score: {healthScore.overallScore}% ({healthScore.riskLevel} risk)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function PaymentMetricsCard({ paymentMetrics }: { paymentMetrics: ClientHealthDetails['paymentMetrics'] }) {
  const onTimeRate = paymentMetrics.totalInvoices > 0 ? 
    (paymentMetrics.paidOnTime / paymentMetrics.totalInvoices) * 100 : 0;
  const overdueRate = paymentMetrics.totalInvoices > 0 ? 
    (paymentMetrics.overdue / paymentMetrics.totalInvoices) * 100 : 0;

  const paymentData = [
    { name: 'Paid On Time', value: paymentMetrics.paidOnTime, fill: CHART_COLORS.success },
    { name: 'Overdue', value: paymentMetrics.overdue, fill: CHART_COLORS.danger },
    { name: 'Other', value: paymentMetrics.totalInvoices - paymentMetrics.paidOnTime - paymentMetrics.overdue, fill: CHART_COLORS.neutral }
  ];

  return (
    <Card className="glass-card-light">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{onTimeRate.toFixed(1)}%</div>
            <div className="text-sm text-slate-600">On-Time Payments</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-800">{paymentMetrics.averageDaysToPay.toFixed(0)}</div>
            <div className="text-sm text-slate-600">Avg Days to Pay</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Total Invoices</span>
            <span className="font-medium">{paymentMetrics.totalInvoices}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Outstanding Amount</span>
            <span className="font-medium text-red-600">
              ${paymentMetrics.totalOutstanding.toLocaleString()}
            </span>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={paymentData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function SubscriptionCard({ subscriptionMetrics, client }: { 
  subscriptionMetrics: ClientHealthDetails['subscriptionMetrics'];
  client: ClientHealthDetails['client'];
}) {
  return (
    <Card className="glass-card-light">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Subscription Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-slate-600">Current Plan</div>
            <div className="font-medium text-slate-800">{subscriptionMetrics.planName}</div>
          </div>
          <div>
            <div className="text-sm text-slate-600">Monthly Revenue</div>
            <div className="font-medium text-slate-800">
              ${subscriptionMetrics.monthlyRevenue.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Status</span>
            <Badge 
              variant={subscriptionMetrics.subscriptionStatus === 'active' ? 'default' : 'secondary'}
              className={cn(
                subscriptionMetrics.subscriptionStatus === 'active' && 'bg-green-100 text-green-800',
                client.metadata?.isInTrial && 'bg-blue-100 text-blue-800'
              )}
            >
              {client.metadata?.isInTrial ? 'Trial' : subscriptionMetrics.subscriptionStatus}
            </Badge>
          </div>

          {client.metadata?.isInTrial && subscriptionMetrics.trialDaysRemaining !== null && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Trial Days Remaining</span>
              <span className={cn(
                "font-medium",
                subscriptionMetrics.trialDaysRemaining <= 7 ? "text-red-600" : "text-slate-800"
              )}>
                {subscriptionMetrics.trialDaysRemaining} days
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Plan Type</span>
            <span className="font-medium text-slate-800 capitalize">
              {subscriptionMetrics.planType}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PartnerInfoCard({ partnerInfo }: { partnerInfo: ClientHealthDetails['partnerInfo'] }) {
  return (
    <Card className="glass-card-light">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Partner Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {partnerInfo.partnerName ? (
          <div className="space-y-3">
            <div>
              <div className="text-sm text-slate-600">Assigned Partner</div>
              <div className="font-medium text-slate-800">{partnerInfo.partnerName}</div>
            </div>
            {partnerInfo.assignedDate && (
              <div>
                <div className="text-sm text-slate-600">Assignment Date</div>
                <div className="font-medium text-slate-800">
                  {new Date(partnerInfo.assignedDate).toLocaleDateString()}
                </div>
              </div>
            )}
            <Badge variant="outline" className="flex items-center gap-1 w-fit">
              <CheckCircle className="h-3 w-3 text-green-600" />
              Active Assignment
            </Badge>
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-2" />
            <div className="font-medium text-slate-800 mb-1">No Partner Assigned</div>
            <div className="text-sm text-slate-600">
              This client is currently unassigned and may need partner allocation.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClientHealthDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="glass-card-light">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-2 w-full mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

interface ClientHealthDetailsProps {
  tenantId: string;
}

export default function ClientHealthDetails({ tenantId }: ClientHealthDetailsProps) {
  const { data: healthDetails, isLoading, error } = useQuery<ClientHealthDetails>({
    queryKey: ['/api/business/clients', tenantId, 'health'],
    queryFn: () => fetch(`/api/business/clients/${tenantId}/health`).then(res => res.json()),
    enabled: !!tenantId
  });

  if (isLoading) {
    return <ClientHealthDetailsSkeleton />;
  }

  if (error || !healthDetails) {
    return (
      <Card className="glass-card-light">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Client Health</h3>
            <p className="text-sm text-slate-600">Failed to load client health information.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800" data-testid="title-client-health">
            {healthDetails.client.name} - Health Details
          </h2>
          <p className="text-slate-600 mt-1">
            Comprehensive health assessment and risk analysis
          </p>
        </div>
        
        <Badge 
          variant="outline" 
          className={cn(
            "text-lg px-3 py-1",
            healthDetails.healthScore.riskLevel === 'low' && 'bg-green-100 text-green-800 border-green-200',
            healthDetails.healthScore.riskLevel === 'medium' && 'bg-yellow-100 text-yellow-800 border-yellow-200',
            healthDetails.healthScore.riskLevel === 'high' && 'bg-orange-100 text-orange-800 border-orange-200',
            healthDetails.healthScore.riskLevel === 'critical' && 'bg-red-100 text-red-800 border-red-200'
          )}
          data-testid="badge-overall-health"
        >
          {healthDetails.healthScore.overallScore}% Overall Health
        </Badge>
      </div>

      {/* Health Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <HealthScoreCard
          title="Payment Health"
          score={healthDetails.healthScore.paymentHealthScore}
          icon={CreditCard}
          description="Based on payment history and timeliness"
          color={CHART_COLORS.primary}
        />
        <HealthScoreCard
          title="Usage Health"
          score={healthDetails.healthScore.usageHealthScore}
          icon={Activity}
          description="Platform engagement and feature adoption"
          color={CHART_COLORS.secondary}
        />
        <HealthScoreCard
          title="Subscription Health"
          score={healthDetails.healthScore.subscriptionHealthScore}
          icon={Users}
          description="Plan status and billing health"
          color={CHART_COLORS.success}
        />
        <HealthScoreCard
          title="Support Health"
          score={healthDetails.healthScore.supportHealthScore}
          icon={Heart}
          description="Support interaction quality"
          color={CHART_COLORS.warning}
        />
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Payments</TabsTrigger>
          <TabsTrigger value="subscription" data-testid="tab-subscription">Subscription</TabsTrigger>
          <TabsTrigger value="partner" data-testid="tab-partner">Partner</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HealthScorePieChart healthScore={healthDetails.healthScore} />
            <PaymentMetricsCard paymentMetrics={healthDetails.paymentMetrics} />
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <PaymentMetricsCard paymentMetrics={healthDetails.paymentMetrics} />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionCard 
            subscriptionMetrics={healthDetails.subscriptionMetrics}
            client={healthDetails.client}
          />
        </TabsContent>

        <TabsContent value="partner">
          <PartnerInfoCard partnerInfo={healthDetails.partnerInfo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}