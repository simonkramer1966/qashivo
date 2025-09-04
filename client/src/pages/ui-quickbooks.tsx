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

export default function UIQuickBooks() {
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
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="UI Test - QuickBooks Style" 
          subtitle="Modern Financial Interface Design" 
          noBorder={false}
          titleSize="text-2xl"
          subtitleSize="text-base"
        />
        
        <div className="p-6 space-y-6 bg-slate-50">
          {/* Key Metrics - QuickBooks Style Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Total Outstanding */}
            <Card className="bg-white border-0 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    <span className="text-xs font-semibold">+12.5%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-2">Total Outstanding</p>
                  <p className="text-2xl font-bold text-slate-800">${sampleMetrics.totalOutstanding.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Overdue Amount */}
            <Card className="bg-white border-0 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex items-center text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    <span className="text-xs font-semibold">+5.2%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-2">Overdue Amount</p>
                  <p className="text-2xl font-bold text-slate-800">${sampleMetrics.overdueAmount.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Collected This Month */}
            <Card className="bg-white border-0 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    <span className="text-xs font-semibold">+18.3%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-2">Collected This Month</p>
                  <p className="text-2xl font-bold text-slate-800">${sampleMetrics.collectedThisMonth.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Average DSO */}
            <Card className="bg-white border-0 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Clock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                    <span className="text-xs font-semibold">-2.1 days</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-2">Average DSO</p>
                  <p className="text-2xl font-bold text-slate-800">{sampleMetrics.averageDSO} <span className="text-base font-normal text-slate-600">days</span></p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Overview Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Collection Performance */}
            <Card className="lg:col-span-2 bg-white border-0 rounded-xl shadow-md">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800">Collection Performance</CardTitle>
                    <CardDescription className="text-sm mt-1 text-slate-600">Monthly collection rates and trends</CardDescription>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Collection Rate</p>
                      <p className="text-2xl font-bold text-green-600">{sampleMetrics.collectionRate}%</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-0 px-3 py-1 rounded-lg font-semibold">
                      Above Target
                    </Badge>
                  </div>
                  <Progress value={sampleMetrics.collectionRate} className="h-3 bg-slate-100" />
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className="text-xl font-bold text-slate-800">{sampleMetrics.totalInvoices}</p>
                      <p className="text-sm text-slate-600">Total Invoices</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className="text-xl font-bold text-slate-800">{sampleMetrics.averagePaymentTime}</p>
                      <p className="text-sm text-slate-600">Avg Payment Time</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-white border-0 rounded-xl shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold text-slate-800">Quick Actions</CardTitle>
                <CardDescription className="text-sm text-slate-600">Common collection tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full justify-start text-left h-14 bg-green-600 hover:bg-green-700 text-white shadow-md rounded-xl font-semibold">
                  <Mail className="mr-3 h-5 w-5" />
                  <div>
                    <p className="font-semibold">Send Payment Reminders</p>
                    <p className="text-xs text-green-100">23 overdue invoices</p>
                  </div>
                </Button>
                
                <Button className="w-full justify-start text-left h-14 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl">
                  <Phone className="mr-3 h-5 w-5 text-slate-600" />
                  <div>
                    <p className="font-semibold">Schedule Follow-ups</p>
                    <p className="text-xs text-slate-600">12 contacts pending</p>
                  </div>
                </Button>
                
                <Button className="w-full justify-start text-left h-14 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl">
                  <MessageSquare className="mr-3 h-5 w-5 text-slate-600" />
                  <div>
                    <p className="font-semibold">SMS Campaigns</p>
                    <p className="text-xs text-slate-600">Create new campaign</p>
                  </div>
                </Button>
                
                <Button className="w-full justify-start text-left h-14 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl">
                  <Target className="mr-3 h-5 w-5 text-slate-600" />
                  <div>
                    <p className="font-semibold">AI Recommendations</p>
                    <p className="text-xs text-slate-600">View suggestions</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity Section */}
          <Card className="bg-white border-0 rounded-xl shadow-md">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-slate-800">Recent Activity</CardTitle>
                  <CardDescription className="text-sm mt-1 text-slate-600">Latest collection actions and responses</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { action: "Payment received", contact: "Acme Corp", amount: "$12,450", time: "2 hours ago", status: "success" },
                  { action: "Email reminder sent", contact: "TechStart Inc", amount: "$8,920", time: "4 hours ago", status: "pending" },
                  { action: "Phone call completed", contact: "Global Solutions", amount: "$15,670", time: "6 hours ago", status: "follow-up" },
                  { action: "SMS reminder sent", contact: "Innovation Labs", amount: "$5,230", time: "1 day ago", status: "pending" }
                ].map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        activity.status === 'success' ? 'bg-green-100' :
                        activity.status === 'pending' ? 'bg-yellow-100' :
                        'bg-blue-100'
                      }`}>
                        {activity.status === 'success' ? 
                          <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                          activity.status === 'pending' ?
                          <Clock className="h-4 w-4 text-yellow-600" /> :
                          <Calendar className="h-4 w-4 text-blue-600" />
                        }
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{activity.action}</p>
                        <p className="text-sm text-slate-600">{activity.contact} • {activity.amount}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500">{activity.time}</p>
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