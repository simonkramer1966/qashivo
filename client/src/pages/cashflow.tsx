import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  Target,
  Activity,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Shield,
  Settings,
  RefreshCw,
  Lightbulb,
  TrendingDown as TrendingDownIcon
} from "lucide-react";

export default function Cashflow() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // State management for Command Center
  const [activeTab, setActiveTab] = useState<string>("scenario");
  const [criticalActions] = useState(3);
  const [scenarioInputs, setScenarioInputs] = useState({
    collectionRate: [75], // percentage
    paymentDelays: [15], // days
    newInvoices: [25000], // dollar amount
    expenseChanges: [0] // percentage change
  });

  // Mock data for realistic scenarios
  const currentCashData = {
    totalAvailable: 246230,
    operatingAccount: 156780,
    reserveAccount: 89450,
    netCashflow: 48327,
    cashRunway: 18.5,
    criticalPayments: 65100,
    status: "healthy" // healthy, warning, critical
  };

  // Smart defaults logic - auto-select most relevant view based on cash runway
  useEffect(() => {
    if (currentCashData.cashRunway < 6) {
      setActiveTab("risk"); // Critical cash runway - focus on risk analysis
    } else if (currentCashData.cashRunway < 12) {
      setActiveTab("collection"); // Medium runway - focus on collections
    } else {
      setActiveTab("scenario"); // Healthy runway - focus on scenario planning
    }
  }, []);

  // Calculate scenario impact
  const calculateScenarioImpact = () => {
    const baseCollection = 127500;
    const baseExpenses = 98200;
    
    const adjustedCollection = baseCollection * (scenarioInputs.collectionRate[0] / 100);
    const adjustedExpenses = baseExpenses * (1 + scenarioInputs.expenseChanges[0] / 100);
    const delayImpact = scenarioInputs.paymentDelays[0] * 1000; // rough calculation
    
    return {
      projectedInflow: adjustedCollection + scenarioInputs.newInvoices[0],
      projectedOutflow: adjustedExpenses,
      netImpact: (adjustedCollection + scenarioInputs.newInvoices[0]) - adjustedExpenses - delayImpact,
      newRunway: currentCashData.cashRunway + ((adjustedCollection - adjustedExpenses) / 10000)
    };
  };

  const scenarioImpact = calculateScenarioImpact();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="flex h-screen page-gradient">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Cash Flow Command Center" 
          subtitle="Real-time cash management and scenario planning"
        />
        
        {/* Command Center Header - Sticky */}
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Real-time Cash Position */}
              <Card className="relative overflow-hidden bg-gradient-to-r from-[#17B6C3]/10 to-[#17B6C3]/5 border-[#17B6C3]/20" data-testid="header-cash-position">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Available</p>
                      <p className="text-2xl font-bold text-[#17B6C3]" data-testid="text-header-cash-total">
                        ${currentCashData.totalAvailable.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <DollarSign className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                  </div>
                  <div className="flex items-center mt-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">Healthy Position</span>
                  </div>
                </CardContent>
              </Card>

              {/* Critical Actions Counter */}
              <Card className="relative overflow-hidden" data-testid="header-critical-actions">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Critical Actions</p>
                      <p className="text-2xl font-bold text-orange-600" data-testid="text-header-critical-count">
                        {criticalActions}
                      </p>
                    </div>
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                    </div>
                  </div>
                  <div className="flex items-center mt-2">
                    <Clock className="h-4 w-4 text-orange-500 mr-1" />
                    <span className="text-sm text-orange-600">Need attention</span>
                  </div>
                </CardContent>
              </Card>

              {/* Cash Runway */}
              <Card className="relative overflow-hidden" data-testid="header-cash-runway">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Cash Runway</p>
                      <p className="text-2xl font-bold text-gray-900" data-testid="text-header-runway">
                        {currentCashData.cashRunway.toFixed(1)} mo
                      </p>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <Timer className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">Stable runway</span>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="relative overflow-hidden" data-testid="header-quick-actions">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-600">Quick Actions</p>
                    <RefreshCw className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full text-xs h-7"
                      data-testid="button-sync-data"
                    >
                      Sync Data
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="w-full text-xs h-7"
                      data-testid="button-export-report"
                    >
                      Export Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Tabbed Workspace */}
        <div className="p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3" data-testid="tabs-command-center">
              <TabsTrigger value="scenario" className="flex items-center gap-2" data-testid="tab-scenario">
                <BarChart3 className="h-4 w-4" />
                Scenario Planning
              </TabsTrigger>
              <TabsTrigger value="collection" className="flex items-center gap-2" data-testid="tab-collection">
                <Target className="h-4 w-4" />
                Collection Strategy
              </TabsTrigger>
              <TabsTrigger value="risk" className="flex items-center gap-2" data-testid="tab-risk">
                <Shield className="h-4 w-4" />
                Risk Analysis
              </TabsTrigger>
            </TabsList>

            {/* Scenario Planning Tab */}
            <TabsContent value="scenario" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Scenario Builder */}
                <Card className="card-glass" data-testid="card-scenario-builder">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-[#17B6C3]" />
                          What-If Scenario Builder
                        </CardTitle>
                        <p className="text-sm text-gray-600">Adjust parameters to see immediate impact</p>
                      </div>
                      <Button variant="outline" size="sm" data-testid="button-reset-scenario">
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Collection Rate Slider */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">Collection Rate</label>
                        <span className="text-sm text-[#17B6C3] font-semibold">{scenarioInputs.collectionRate[0]}%</span>
                      </div>
                      <Slider
                        value={scenarioInputs.collectionRate}
                        onValueChange={(value) => setScenarioInputs(prev => ({...prev, collectionRate: value}))}
                        max={100}
                        min={50}
                        step={5}
                        className="w-full"
                        data-testid="slider-collection-rate"
                      />
                      <p className="text-xs text-gray-500">Expected percentage of invoices collected</p>
                    </div>

                    {/* Payment Delays Slider */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">Average Payment Delays</label>
                        <span className="text-sm text-orange-600 font-semibold">{scenarioInputs.paymentDelays[0]} days</span>
                      </div>
                      <Slider
                        value={scenarioInputs.paymentDelays}
                        onValueChange={(value) => setScenarioInputs(prev => ({...prev, paymentDelays: value}))}
                        max={60}
                        min={0}
                        step={5}
                        className="w-full"
                        data-testid="slider-payment-delays"
                      />
                      <p className="text-xs text-gray-500">Days beyond due date for payment collection</p>
                    </div>

                    {/* New Invoices Slider */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">New Invoice Volume</label>
                        <span className="text-sm text-green-600 font-semibold">${scenarioInputs.newInvoices[0].toLocaleString()}</span>
                      </div>
                      <Slider
                        value={scenarioInputs.newInvoices}
                        onValueChange={(value) => setScenarioInputs(prev => ({...prev, newInvoices: value}))}
                        max={50000}
                        min={5000}
                        step={5000}
                        className="w-full"
                        data-testid="slider-new-invoices"
                      />
                      <p className="text-xs text-gray-500">Additional monthly invoice volume</p>
                    </div>

                    {/* Expense Changes Slider */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">Expense Changes</label>
                        <span className={`text-sm font-semibold ${scenarioInputs.expenseChanges[0] >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {scenarioInputs.expenseChanges[0] >= 0 ? '+' : ''}{scenarioInputs.expenseChanges[0]}%
                        </span>
                      </div>
                      <Slider
                        value={scenarioInputs.expenseChanges}
                        onValueChange={(value) => setScenarioInputs(prev => ({...prev, expenseChanges: value}))}
                        max={50}
                        min={-25}
                        step={5}
                        className="w-full"
                        data-testid="slider-expense-changes"
                      />
                      <p className="text-xs text-gray-500">Percentage change in operating expenses</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Scenario Impact Visualization */}
                <Card className="card-glass" data-testid="card-scenario-impact">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <Activity className="h-5 w-5 text-[#17B6C3]" />
                      Impact Analysis
                    </CardTitle>
                    <p className="text-sm text-gray-600">Real-time scenario outcomes</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Net Impact */}
                    <div className="text-center p-6 bg-gradient-to-b from-[#17B6C3]/5 to-transparent rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Net Cash Impact</p>
                      <p className={`text-3xl font-bold ${scenarioImpact.netImpact >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-scenario-net-impact">
                        {scenarioImpact.netImpact >= 0 ? '+' : ''}${Math.round(scenarioImpact.netImpact).toLocaleString()}
                      </p>
                      <div className="flex items-center justify-center mt-2">
                        {scenarioImpact.netImpact >= 0 ? 
                          <TrendingUp className="h-4 w-4 text-green-500 mr-1" /> : 
                          <TrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
                        }
                        <span className={`text-sm ${scenarioImpact.netImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          vs current projection
                        </span>
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm">Projected Inflow</span>
                        <span className="font-semibold text-green-600" data-testid="text-scenario-inflow">
                          +${Math.round(scenarioImpact.projectedInflow).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm">Projected Outflow</span>
                        <span className="font-semibold text-red-600" data-testid="text-scenario-outflow">
                          -${Math.round(scenarioImpact.projectedOutflow).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm">New Cash Runway</span>
                        <span className="font-semibold text-[#17B6C3]" data-testid="text-scenario-runway">
                          {scenarioImpact.newRunway.toFixed(1)} months
                        </span>
                      </div>
                    </div>

                    {/* Action Recommendation */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Recommendation</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            {scenarioImpact.netImpact >= 0 
                              ? "This scenario improves your cash position. Consider implementing these changes." 
                              : "This scenario has negative impact. Review and adjust parameters before implementing."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Collection Strategy Tab */}
            <TabsContent value="collection" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Existing forecast content moved here */}
                <div className="lg:col-span-2">
                  <Card className="card-glass" data-testid="card-collection-strategy">
                    <CardHeader>
                      <CardTitle className="text-xl font-bold">Collection Performance</CardTitle>
                      <p className="text-sm text-gray-600">Track and optimize collection strategies</p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80 bg-gradient-to-b from-[#17B6C3]/5 to-transparent rounded-lg p-6 flex items-center justify-center">
                        <div className="text-center">
                          <Target className="h-12 w-12 text-[#17B6C3] mx-auto mb-4" />
                          <p className="text-gray-600">Collection strategy dashboard would be rendered here</p>
                          <p className="text-sm text-gray-500 mt-2">Showing collection rates and optimization opportunities</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  {/* Upcoming Payments Card */}
                  <Card className="card-glass" data-testid="card-collection-payments">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold">Upcoming Payments</CardTitle>
                      <p className="text-sm text-gray-600">Key receivables this month</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-medium text-sm">TechCorp Solutions</p>
                            <p className="text-xs text-gray-500">Due in 5 days</p>
                          </div>
                          <span className="font-semibold text-[#17B6C3]" data-testid="text-collection-techcorp">$25,000</span>
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-medium text-sm">Global Manufacturing</p>
                            <p className="text-xs text-gray-500">Due in 12 days</p>
                          </div>
                          <span className="font-semibold text-[#17B6C3]" data-testid="text-collection-global">$18,750</span>
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-medium text-sm">Retail Partners Inc</p>
                            <p className="text-xs text-gray-500">Due in 18 days</p>
                          </div>
                          <span className="font-semibold text-[#17B6C3]" data-testid="text-collection-retail">$12,400</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Risk Analysis Tab */}
            <TabsContent value="risk" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="card-glass" data-testid="card-risk-analysis">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <Shield className="h-5 w-5 text-red-500" />
                      Risk Assessment
                    </CardTitle>
                    <p className="text-sm text-gray-600">Monitor potential cash flow risks</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80 bg-gradient-to-b from-red-500/5 to-transparent rounded-lg p-6 flex items-center justify-center">
                      <div className="text-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <p className="text-gray-600">Risk analysis dashboard would be rendered here</p>
                        <p className="text-sm text-gray-500 mt-2">Showing risk factors and mitigation strategies</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-glass" data-testid="card-risk-factors">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Risk Factors</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Concentration Risk</p>
                        <p className="text-xs text-gray-500">Top 3 customers = 45% of receivables</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <Timer className="h-4 w-4 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Aging Receivables</p>
                        <p className="text-xs text-gray-500">$89k overdue by 30+ days</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-yellow-500/10 rounded-lg">
                        <TrendingDownIcon className="h-4 w-4 text-yellow-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Seasonal Variance</p>
                        <p className="text-xs text-gray-500">Q4 collections typically 15% lower</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}