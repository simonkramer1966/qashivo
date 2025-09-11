import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Clock, 
  Users, 
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Target,
  Calendar,
  Mail,
  Phone,
  MessageSquare
} from "lucide-react";

export default function UISage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Sample data for demonstration
  const { data: metrics } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
    enabled: isAuthenticated,
  });

  const sampleMetrics = {
    totalOutstanding: 485672.50,
    overdueAmount: 127834.25,
    collectedThisMonth: 342567.80,
    averageDSO: 34,
    totalInvoices: 156,
    overdueCount: 23,
    collectionRate: 87.5,
    averagePaymentTime: 28
  };

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
    return <div className="min-h-screen page-gradient" />;
  }

  return (
    <div className="flex h-screen page-gradient">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="UI Test - Sage Style" 
          subtitle="Professional Enterprise Interface Design" 
          noBorder={false}
          titleSize="text-2xl"
          subtitleSize="text-base"
        />
        
        <div className="p-6 space-y-6">
          {/* Key Metrics - Sage Style Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Total Outstanding */}
            <Card className="metrics-card border border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    <span className="text-xs font-bold">+12.5%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-600 mb-2 uppercase tracking-wide">Total Outstanding</p>
                  <p className="text-3xl font-bold text-blue-900">${sampleMetrics.totalOutstanding.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Overdue Amount */}
            <Card className="metrics-card border border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-md">
                    <AlertCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    <span className="text-xs font-bold">+5.2%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-600 mb-2 uppercase tracking-wide">Overdue Amount</p>
                  <p className="text-3xl font-bold text-blue-900">${sampleMetrics.overdueAmount.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Collected This Month */}
            <Card className="metrics-card border border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    <span className="text-xs font-bold">+18.3%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-600 mb-2 uppercase tracking-wide">Collected This Month</p>
                  <p className="text-3xl font-bold text-blue-900">${sampleMetrics.collectedThisMonth.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Average DSO */}
            <Card className="metrics-card border border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                    <span className="text-xs font-bold">-2.1 days</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-600 mb-2 uppercase tracking-wide">Average DSO</p>
                  <p className="text-3xl font-bold text-blue-900">{sampleMetrics.averageDSO} <span className="text-lg font-normal text-blue-700">days</span></p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Overview Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Collection Performance */}
            <Card className="lg:col-span-2 card-glass border border-blue-200">
              <CardHeader className="pb-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold">Collection Performance</CardTitle>
                    <CardDescription className="text-blue-100 text-sm mt-1">Monthly collection rates and trends</CardDescription>
                  </div>
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Collection Rate</p>
                      <p className="text-3xl font-bold text-blue-900">{sampleMetrics.collectionRate}%</p>
                    </div>
                    <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0 px-4 py-2 rounded-full font-bold shadow-lg">
                      Above Target
                    </Badge>
                  </div>
                  <Progress value={sampleMetrics.collectionRate} className="h-4 bg-blue-100" />
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <p className="text-2xl font-bold text-blue-900">{sampleMetrics.totalInvoices}</p>
                      <p className="text-sm font-semibold text-blue-600">Total Invoices</p>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <p className="text-2xl font-bold text-blue-900">{sampleMetrics.averagePaymentTime}</p>
                      <p className="text-sm font-semibold text-blue-600">Avg Payment Time</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="card-glass border border-blue-200">
              <CardHeader className="pb-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-lg">
                <CardTitle className="text-xl font-bold">Quick Actions</CardTitle>
                <CardDescription className="text-orange-100 text-sm">Common collection tasks</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <Button className="w-full justify-start text-left h-16 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg font-bold">
                  <Mail className="mr-3 h-5 w-5" />
                  <div>
                    <p className="font-bold">Send Payment Reminders</p>
                    <p className="text-xs text-blue-100">23 overdue invoices</p>
                  </div>
                </Button>
                
                <Button className="w-full justify-start text-left h-16 bg-gradient-to-r from-blue-100 to-blue-200 hover:from-blue-200 hover:to-blue-300 text-blue-900 font-bold border border-blue-300">
                  <Phone className="mr-3 h-5 w-5" />
                  <div>
                    <p className="font-bold">Schedule Follow-ups</p>
                    <p className="text-xs text-blue-700">12 contacts pending</p>
                  </div>
                </Button>
                
                <Button className="w-full justify-start text-left h-16 bg-gradient-to-r from-blue-100 to-blue-200 hover:from-blue-200 hover:to-blue-300 text-blue-900 font-bold border border-blue-300">
                  <MessageSquare className="mr-3 h-5 w-5" />
                  <div>
                    <p className="font-bold">SMS Campaigns</p>
                    <p className="text-xs text-blue-700">Create new campaign</p>
                  </div>
                </Button>
                
                <Button className="w-full justify-start text-left h-16 bg-gradient-to-r from-blue-100 to-blue-200 hover:from-blue-200 hover:to-blue-300 text-blue-900 font-bold border border-blue-300">
                  <Target className="mr-3 h-5 w-5" />
                  <div>
                    <p className="font-bold">AI Recommendations</p>
                    <p className="text-xs text-blue-700">View suggestions</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity Section */}
          <Card className="card-glass border border-blue-200">
            <CardHeader className="pb-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Recent Activity</CardTitle>
                  <CardDescription className="text-blue-100 text-sm mt-1">Latest collection actions and responses</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/20 font-bold">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[
                  { action: "Payment received", contact: "Acme Corp", amount: "$12,450", time: "2 hours ago", status: "success" },
                  { action: "Email reminder sent", contact: "TechStart Inc", amount: "$8,920", time: "4 hours ago", status: "pending" },
                  { action: "Phone call completed", contact: "Global Solutions", amount: "$15,670", time: "6 hours ago", status: "follow-up" },
                  { action: "SMS reminder sent", contact: "Innovation Labs", amount: "$5,230", time: "1 day ago", status: "pending" }
                ].map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 hover:from-blue-100 hover:to-blue-200 transition-all duration-300">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                        activity.status === 'success' ? 'bg-gradient-to-br from-green-400 to-green-500' :
                        activity.status === 'pending' ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                        'bg-gradient-to-br from-blue-400 to-blue-500'
                      }`}>
                        {activity.status === 'success' ? 
                          <CheckCircle2 className="h-5 w-5 text-white" /> :
                          activity.status === 'pending' ?
                          <Clock className="h-5 w-5 text-white" /> :
                          <Calendar className="h-5 w-5 text-white" />
                        }
                      </div>
                      <div>
                        <p className="font-bold text-blue-900">{activity.action}</p>
                        <p className="text-sm text-blue-700">{activity.contact} • {activity.amount}</p>
                      </div>
                    </div>
                    <p className="text-sm text-blue-600 font-semibold">{activity.time}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}