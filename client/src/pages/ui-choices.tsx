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
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header title="UI Choices" subtitle="Premium SaaS Dashboard Design Exploration" />
        
        <div className="p-8 space-y-8">
          {/* Hero Metrics - Glassmorphism Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            {/* Total Outstanding */}
            <Card className="relative overflow-hidden bg-white/70 backdrop-blur-md border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-[#17B6C3]/10 to-transparent"></div>
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-[#17B6C3]/20 rounded-xl">
                    <DollarSign className="h-6 w-6 text-[#17B6C3]" />
                  </div>
                  <div className="flex items-center text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">+12.5%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Outstanding</p>
                  <p className="text-3xl font-bold text-foreground">${sampleMetrics.totalOutstanding.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Overdue Amount */}
            <Card className="relative overflow-hidden bg-white/70 backdrop-blur-md border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent"></div>
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-500/20 rounded-xl">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="flex items-center text-red-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">+5.2%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Overdue Amount</p>
                  <p className="text-3xl font-bold text-foreground">${sampleMetrics.overdueAmount.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Collected This Month */}
            <Card className="relative overflow-hidden bg-white/70 backdrop-blur-md border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent"></div>
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-500/20 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="flex items-center text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">+18.3%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Collected This Month</p>
                  <p className="text-3xl font-bold text-foreground">${sampleMetrics.collectedThisMonth.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Average DSO */}
            <Card className="relative overflow-hidden bg-white/70 backdrop-blur-md border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent"></div>
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <Clock className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="flex items-center text-green-600">
                    <ArrowDownRight className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">-2.1 days</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Average DSO</p>
                  <p className="text-3xl font-bold text-foreground">{sampleMetrics.averageDSO} <span className="text-lg font-normal text-muted-foreground">days</span></p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Overview Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Collection Performance */}
            <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold">Collection Performance</CardTitle>
                    <CardDescription className="text-base mt-1">Monthly collection rates and trends</CardDescription>
                  </div>
                  <div className="p-3 bg-[#17B6C3]/10 rounded-xl">
                    <BarChart3 className="h-6 w-6 text-[#17B6C3]" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Collection Rate</p>
                      <p className="text-2xl font-bold text-[#17B6C3]">{sampleMetrics.collectionRate}%</p>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                      Above Target
                    </Badge>
                  </div>
                  <Progress value={sampleMetrics.collectionRate} className="h-3 bg-slate-100" />
                  
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className="text-2xl font-bold text-slate-700">{sampleMetrics.totalInvoices}</p>
                      <p className="text-sm text-muted-foreground">Total Invoices</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className="text-2xl font-bold text-slate-700">{sampleMetrics.averagePaymentTime}</p>
                      <p className="text-sm text-muted-foreground">Avg Payment Time</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold">Quick Actions</CardTitle>
                <CardDescription>Common collection tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full justify-start text-left h-14 bg-[#17B6C3] hover:bg-[#1396A1] text-white shadow-md">
                  <Mail className="mr-3 h-5 w-5" />
                  <div>
                    <p className="font-medium">Send Payment Reminders</p>
                    <p className="text-xs text-white/80">23 overdue invoices</p>
                  </div>
                </Button>
                
                <Button variant="outline" className="w-full justify-start text-left h-14 border-[#17B6C3]/20 hover:bg-[#17B6C3]/5">
                  <Phone className="mr-3 h-5 w-5 text-[#17B6C3]" />
                  <div>
                    <p className="font-medium">Schedule Follow-ups</p>
                    <p className="text-xs text-muted-foreground">12 contacts pending</p>
                  </div>
                </Button>
                
                <Button variant="outline" className="w-full justify-start text-left h-14 border-[#17B6C3]/20 hover:bg-[#17B6C3]/5">
                  <MessageSquare className="mr-3 h-5 w-5 text-[#17B6C3]" />
                  <div>
                    <p className="font-medium">SMS Campaigns</p>
                    <p className="text-xs text-muted-foreground">Create new campaign</p>
                  </div>
                </Button>
                
                <Button variant="outline" className="w-full justify-start text-left h-14 border-[#17B6C3]/20 hover:bg-[#17B6C3]/5">
                  <Target className="mr-3 h-5 w-5 text-[#17B6C3]" />
                  <div>
                    <p className="font-medium">AI Recommendations</p>
                    <p className="text-xs text-muted-foreground">View suggestions</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity Section */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold">Recent Activity</CardTitle>
                  <CardDescription className="text-base mt-1">Latest collection actions and responses</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5">
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
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl hover:bg-slate-100/80 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${
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
                        <p className="font-medium text-foreground">{activity.action}</p>
                        <p className="text-sm text-muted-foreground">{activity.contact} • {activity.amount}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{activity.time}</p>
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