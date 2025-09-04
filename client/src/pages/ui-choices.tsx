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
import businessOffice from "@assets/generated_images/Modern_business_office_workspace_8347230b.png";
import abstractGrowth from "@assets/generated_images/Abstract_financial_growth_background_8c4d9d52.png";

export default function UIChoices() {
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
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="UI Test - Xero Style" 
          subtitle="Clean Business Interface Design" 
          noBorder={false}
          titleSize="text-2xl"
          subtitleSize="text-base"
        />
        
        <div className="p-6 space-y-6 bg-white">
          {/* Key Metrics - Xero Style Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Total Outstanding */}
            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-xs text-green-600 font-medium">+12.5%</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Outstanding</p>
                  <p className="text-2xl font-semibold text-gray-900">${sampleMetrics.totalOutstanding.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Overdue Amount */}
            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <span className="text-xs text-red-600 font-medium">+5.2%</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Overdue Amount</p>
                  <p className="text-2xl font-semibold text-gray-900">${sampleMetrics.overdueAmount.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Collected This Month */}
            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-xs text-green-600 font-medium">+18.3%</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Collected This Month</p>
                  <p className="text-2xl font-semibold text-gray-900">${sampleMetrics.collectedThisMonth.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Average DSO */}
            <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-xs text-green-600 font-medium">-2.1 days</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Average DSO</p>
                  <p className="text-2xl font-semibold text-gray-900">{sampleMetrics.averageDSO} <span className="text-base font-normal text-gray-600">days</span></p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Overview Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Collection Performance */}
            <Card className="lg:col-span-2 bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Collection Performance</CardTitle>
                    <CardDescription className="text-sm mt-1 text-gray-600">Monthly collection rates and trends</CardDescription>
                  </div>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Collection Rate</p>
                      <p className="text-xl font-semibold text-gray-900">{sampleMetrics.collectionRate}%</p>
                    </div>
                    <Badge className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-50">
                      Above Target
                    </Badge>
                  </div>
                  <Progress value={sampleMetrics.collectionRate} className="h-2 bg-gray-100" />
                  
                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <div className="text-center p-3 bg-gray-50 rounded border">
                      <p className="text-xl font-semibold text-gray-900">{sampleMetrics.totalInvoices}</p>
                      <p className="text-xs text-gray-600">Total Invoices</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded border">
                      <p className="text-xl font-semibold text-gray-900">{sampleMetrics.averagePaymentTime}</p>
                      <p className="text-xs text-gray-600">Avg Payment Time</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
                <CardDescription className="text-sm text-gray-600">Common collection tasks</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <Button className="w-full justify-start text-left h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                  <Mail className="mr-3 h-4 w-4" />
                  <div>
                    <p className="font-medium text-sm">Send Payment Reminders</p>
                    <p className="text-xs text-blue-100">23 overdue invoices</p>
                  </div>
                </Button>
                
                <Button variant="outline" className="w-full justify-start text-left h-12 border-gray-300 hover:bg-gray-50">
                  <Phone className="mr-3 h-4 w-4 text-gray-600" />
                  <div>
                    <p className="font-medium text-sm text-gray-900">Schedule Follow-ups</p>
                    <p className="text-xs text-gray-600">12 contacts pending</p>
                  </div>
                </Button>
                
                <Button variant="outline" className="w-full justify-start text-left h-12 border-gray-300 hover:bg-gray-50">
                  <MessageSquare className="mr-3 h-4 w-4 text-gray-600" />
                  <div>
                    <p className="font-medium text-sm text-gray-900">SMS Campaigns</p>
                    <p className="text-xs text-gray-600">Create new campaign</p>
                  </div>
                </Button>
                
                <Button variant="outline" className="w-full justify-start text-left h-12 border-gray-300 hover:bg-gray-50">
                  <Target className="mr-3 h-4 w-4 text-gray-600" />
                  <div>
                    <p className="font-medium text-sm text-gray-900">AI Recommendations</p>
                    <p className="text-xs text-gray-600">View suggestions</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity Section */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Recent Activity</CardTitle>
                  <CardDescription className="text-sm mt-1 text-gray-600">Latest collection actions and responses</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {[
                  { action: "Payment received", contact: "Acme Corp", amount: "$12,450", time: "2 hours ago", status: "success" },
                  { action: "Email reminder sent", contact: "TechStart Inc", amount: "$8,920", time: "4 hours ago", status: "pending" },
                  { action: "Phone call completed", contact: "Global Solutions", amount: "$15,670", time: "6 hours ago", status: "follow-up" },
                  { action: "SMS reminder sent", contact: "Innovation Labs", amount: "$5,230", time: "1 day ago", status: "pending" }
                ].map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        activity.status === 'success' ? 'bg-green-100' :
                        activity.status === 'pending' ? 'bg-yellow-100' :
                        'bg-blue-100'
                      }`}>
                        {activity.status === 'success' ? 
                          <CheckCircle2 className="h-3 w-3 text-green-600" /> :
                          activity.status === 'pending' ?
                          <Clock className="h-3 w-3 text-yellow-600" /> :
                          <Calendar className="h-3 w-3 text-blue-600" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                        <p className="text-xs text-gray-600">{activity.contact} • {activity.amount}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">{activity.time}</p>
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