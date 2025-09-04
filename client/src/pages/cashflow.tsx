import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Zap
} from "lucide-react";

export default function Cashflow() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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
    <div className="flex h-screen bg-white">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Cashflow Analytics" 
          subtitle="Monitor and forecast your business cash position"
        />
        
        <div className="p-8 space-y-8">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" data-testid="card-net-cashflow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Net Cashflow</CardTitle>
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-[#17B6C3]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900" data-testid="text-net-cashflow">$48,327</div>
                <div className="flex items-center text-sm">
                  <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-600">+12.5%</span>
                  <span className="text-gray-500 ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" data-testid="card-money-in">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Money In</CardTitle>
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <ArrowDownRight className="h-4 w-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900" data-testid="text-money-in">$187,450</div>
                <div className="flex items-center text-sm">
                  <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-600">+8.2%</span>
                  <span className="text-gray-500 ml-1">this period</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" data-testid="card-money-out">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Money Out</CardTitle>
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <ArrowUpRight className="h-4 w-4 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900" data-testid="text-money-out">$139,123</div>
                <div className="flex items-center text-sm">
                  <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
                  <span className="text-red-600">-3.1%</span>
                  <span className="text-gray-500 ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" data-testid="card-cash-runway">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Cash Runway</CardTitle>
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <Timer className="h-4 w-4 text-[#17B6C3]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900" data-testid="text-cash-runway">18.5 mo</div>
                <div className="flex items-center text-sm">
                  <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-600">Healthy</span>
                  <span className="text-gray-500 ml-1">burn rate</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cashflow Chart */}
            <div className="lg:col-span-2">
              <Card className="bg-white border border-gray-200 shadow-sm" data-testid="card-cashflow-chart">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold">Cashflow Trend</CardTitle>
                      <p className="text-sm text-gray-600">Monthly cash inflow vs outflow</p>
                    </div>
                    <Badge variant="outline" className="border-[#17B6C3]/20 text-[#17B6C3]">
                      Last 12 Months
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-80 bg-gradient-to-b from-[#17B6C3]/5 to-transparent rounded-lg p-6 flex items-center justify-center">
                    <div className="text-center">
                      <Activity className="h-12 w-12 text-[#17B6C3] mx-auto mb-4" />
                      <p className="text-gray-600">Interactive cashflow chart would be rendered here</p>
                      <p className="text-sm text-gray-500 mt-2">Showing monthly trends and projections</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Insights */}
            <div className="space-y-6">
              <Card className="bg-white border border-gray-200 shadow-sm" data-testid="card-quick-insights">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Quick Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Strong Collection Month</p>
                      <p className="text-xs text-gray-500">15% increase in payments received</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <Target className="h-4 w-4 text-[#17B6C3]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">On Track for Q1 Goal</p>
                      <p className="text-xs text-gray-500">82% of quarterly target achieved</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Calendar className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Large Payment Due</p>
                      <p className="text-xs text-gray-500">$25k expected by month-end</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm" data-testid="card-cash-position">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Cash Position</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Operating Account</span>
                      <span className="font-semibold" data-testid="text-operating-balance">$156,780</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Reserve Fund</span>
                      <span className="font-semibold" data-testid="text-reserve-balance">$89,450</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm font-medium">Total Available</span>
                      <span className="font-bold text-lg text-[#17B6C3]" data-testid="text-total-available">$246,230</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Forecast & Planning */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-white border border-gray-200 shadow-sm" data-testid="card-30day-forecast">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold">30-Day Forecast</CardTitle>
                    <p className="text-sm text-gray-600">Projected cash movements</p>
                  </div>
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <Zap className="h-5 w-5 text-[#17B6C3]" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm">Expected Collections</span>
                    <span className="font-semibold text-green-600" data-testid="text-expected-collections">+$127,500</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm">Planned Expenses</span>
                    <span className="font-semibold text-red-600" data-testid="text-planned-expenses">-$98,200</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm">Tax Payments</span>
                    <span className="font-semibold text-red-600" data-testid="text-tax-payments">-$15,750</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Net Change</span>
                      <span className="font-bold text-lg text-green-600" data-testid="text-net-change">+$13,550</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 shadow-sm" data-testid="card-payment-schedule">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold">Upcoming Payments</CardTitle>
                    <p className="text-sm text-gray-600">Key receivables this month</p>
                  </div>
                  <Badge variant="outline" className="border-[#17B6C3]/20 text-[#17B6C3]">
                    Next 30 Days
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-sm">TechCorp Solutions</p>
                      <p className="text-xs text-gray-500">Due in 5 days</p>
                    </div>
                    <span className="font-semibold text-[#17B6C3]" data-testid="text-payment-techcorp">$25,000</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-sm">Global Manufacturing</p>
                      <p className="text-xs text-gray-500">Due in 12 days</p>
                    </div>
                    <span className="font-semibold text-[#17B6C3]" data-testid="text-payment-global">$18,750</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-sm">Retail Partners Inc</p>
                      <p className="text-xs text-gray-500">Due in 18 days</p>
                    </div>
                    <span className="font-semibold text-[#17B6C3]" data-testid="text-payment-retail">$12,400</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-sm">Service Group LLC</p>
                      <p className="text-xs text-gray-500">Due in 25 days</p>
                    </div>
                    <span className="font-semibold text-[#17B6C3]" data-testid="text-payment-service">$8,950</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}