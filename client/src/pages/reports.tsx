import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Download,
  Calendar,
  DollarSign,
  Users,
  Clock,
  Target,
  FileText,
  PieChart,
  Activity
} from "lucide-react";

export default function Reports() {
  const kpiCards = [
    {
      title: "Total Outstanding",
      value: "$543,210",
      change: "-12%",
      trend: "down",
      icon: DollarSign,
      description: "vs last month"
    },
    {
      title: "Collection Rate",
      value: "87%",
      change: "+5%", 
      trend: "up",
      icon: Target,
      description: "this month"
    },
    {
      title: "Average Days to Pay",
      value: "23 days",
      change: "-3 days",
      trend: "up",
      icon: Clock,
      description: "improvement"
    },
    {
      title: "Active Accounts",
      value: "1,247",
      change: "+8%",
      trend: "up",
      icon: Users,
      description: "this month"
    }
  ];

  const reports = [
    {
      title: "Monthly Collection Report",
      description: "Comprehensive overview of collection performance, payment trends, and outstanding balances",
      type: "Monthly",
      lastGenerated: "2 hours ago",
      format: "PDF",
      icon: BarChart3
    },
    {
      title: "Aging Analysis",
      description: "Detailed breakdown of accounts by age groups with payment probability scoring",
      type: "Weekly", 
      lastGenerated: "1 day ago",
      format: "Excel",
      icon: PieChart
    },
    {
      title: "AI Performance Dashboard",
      description: "Machine learning model performance, prediction accuracy, and recommendation effectiveness",
      type: "Real-time",
      lastGenerated: "Live",
      format: "Interactive",
      icon: Activity
    },
    {
      title: "Customer Communication Log",
      description: "Complete audit trail of all customer interactions, emails, calls, and responses",
      type: "Daily",
      lastGenerated: "6 hours ago", 
      format: "CSV",
      icon: FileText
    },
    {
      title: "Workflow Efficiency Report",
      description: "Analysis of collection workflow performance, bottlenecks, and optimization opportunities",
      type: "Weekly",
      lastGenerated: "3 days ago",
      format: "PDF",
      icon: TrendingUp
    },
    {
      title: "Compliance Audit Trail",
      description: "Regulatory compliance tracking, communication compliance, and audit-ready documentation",
      type: "Monthly",
      lastGenerated: "1 week ago",
      format: "PDF",
      icon: FileText
    }
  ];

  const quickStats = [
    { label: "This Week Collections", value: "$89,450", change: "+12%" },
    { label: "New Accounts", value: "47", change: "+23%" },
    { label: "Resolved Cases", value: "156", change: "+8%" },
    { label: "AI Suggestions Used", value: "89%", change: "+5%" }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="text-reports-title">
            Reports & Analytics
          </h1>
          <p className="text-gray-600" data-testid="text-reports-description">
            Comprehensive insights and detailed reporting for your debt recovery operations
          </p>
        </div>
        <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-export-all">
          <Download className="h-4 w-4 mr-2" />
          Export All Reports
        </Button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi, index) => (
          <Card key={index} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300" data-testid={`card-kpi-${index}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <kpi.icon className="h-5 w-5 text-[#17B6C3]" />
                </div>
                <div className={`flex items-center space-x-1 text-sm ${
                  kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {kpi.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{kpi.change}</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{kpi.value}</h3>
              <p className="text-sm font-medium text-gray-900 mb-1">{kpi.title}</p>
              <p className="text-xs text-gray-500">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <Card className="bg-gradient-to-r from-[#17B6C3]/5 to-purple-500/5 border-[#17B6C3]/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-[#17B6C3]" />
            <span>Quick Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {quickStats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
                <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  {stat.change}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reports Grid */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900" data-testid="text-available-reports">
          Available Reports
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {reports.map((report, index) => (
            <Card key={index} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300" data-testid={`card-report-${index}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <report.icon className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="secondary">{report.type}</Badge>
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                          {report.format}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-sm mt-3">
                  {report.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>Generated: {report.lastGenerated}</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" data-testid={`button-view-${index}`}>
                      View
                    </Button>
                    <Button 
                      className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
                      size="sm"
                      data-testid={`button-download-${index}`}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Report Scheduling */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-[#17B6C3]" />
            <span>Automated Report Scheduling</span>
          </CardTitle>
          <CardDescription>
            Set up automated report generation and delivery to keep your team informed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-gray-600">Configure automatic report delivery to your inbox or team channels</p>
            <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-schedule-reports">
              Schedule Reports
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}