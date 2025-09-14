import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, CheckCircle, TrendingUp, Users, Gauge } from "lucide-react";

interface MLRiskScoringTabProps {
  riskAnalytics?: any;
}

export default function MLRiskScoringTab({ riskAnalytics }: MLRiskScoringTabProps) {
  const riskData = riskAnalytics || {
    totalCustomers: 95,
    averageRiskScore: 42.5,
    riskDistribution: { critical: 8, high: 15, medium: 45, low: 27 },
    riskPercentages: { critical: 8.4, high: 15.8, medium: 47.4, low: 28.4 }
  };

  return (
    <div className="space-y-6">
      {/* Risk Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Risk Score</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-avg-risk">
                  {riskData.averageRiskScore.toFixed(1)}
                </p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Gauge className="h-5 w-5 text-orange-600" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={riskData.averageRiskScore} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">Risk assessment scale</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical Risk</p>
                <p className="text-2xl font-bold text-red-600" data-testid="metric-critical-risk">
                  {riskData.riskDistribution.critical}
                </p>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className="text-red-600 font-medium">{riskData.riskPercentages.critical.toFixed(1)}% of portfolio</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Risk</p>
                <p className="text-2xl font-bold text-green-600" data-testid="metric-low-risk">
                  {riskData.riskDistribution.low}
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className="text-green-600 font-medium">{riskData.riskPercentages.low.toFixed(1)}% of portfolio</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Assessed</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-total-assessed">
                  {riskData.totalCustomers}
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-blue-500 mr-1" />
                <span className="text-blue-600">Active monitoring</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution Chart */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-[#17B6C3]" />
            <span>Risk Distribution Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Risk Categories</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium">Critical Risk (80-100)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{riskData.riskDistribution.critical} customers</span>
                    <Badge className="bg-red-100 text-red-700">
                      {riskData.riskPercentages.critical.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-sm font-medium">High Risk (60-80)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{riskData.riskDistribution.high} customers</span>
                    <Badge className="bg-orange-100 text-orange-700">
                      {riskData.riskPercentages.high.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm font-medium">Medium Risk (40-60)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{riskData.riskDistribution.medium} customers</span>
                    <Badge className="bg-yellow-100 text-yellow-700">
                      {riskData.riskPercentages.medium.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Low Risk (0-40)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{riskData.riskDistribution.low} customers</span>
                    <Badge className="bg-green-100 text-green-700">
                      {riskData.riskPercentages.low.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Risk Insights</h4>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">High Risk Alert</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">
                    {riskData.riskDistribution.critical + riskData.riskDistribution.high} customers require immediate attention
                  </p>
                </div>
                
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Stable Portfolio</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    {((riskData.riskPercentages.low + riskData.riskPercentages.medium)).toFixed(1)}% of customers are in acceptable risk range
                  </p>
                </div>
                
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Risk Trending</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    Risk scores are recalculated daily based on payment behavior
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Highest Risk Customers */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle>Highest Risk Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { customer: "Problem Corp", riskScore: 92, factors: ["Payment history", "Communication issues"], trend: "increasing" },
              { customer: "Slow Payer Ltd", riskScore: 87, factors: ["Overdue invoices", "Delayed responses"], trend: "stable" },
              { customer: "Unstable Inc", riskScore: 81, factors: ["Credit limit exceeded", "Erratic payments"], trend: "increasing" },
              { customer: "Declining Co", riskScore: 78, factors: ["Payment delays", "Relationship issues"], trend: "decreasing" },
              { customer: "Risky Business", riskScore: 74, factors: ["Multiple overdue", "Poor communication"], trend: "stable" }
            ].map((customer, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-gray-50/80 hover:bg-gray-100/80 transition-colors" data-testid={`high-risk-customer-${index}`}>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{customer.customer}</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {customer.factors.map((factor, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {factor}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <p className="font-bold text-red-600">{customer.riskScore}</p>
                    <p className="text-xs text-gray-500">Risk Score</p>
                  </div>
                  <Badge className={
                    customer.trend === "increasing" ? "bg-red-100 text-red-700" :
                    customer.trend === "decreasing" ? "bg-green-100 text-green-700" :
                    "bg-yellow-100 text-yellow-700"
                  }>
                    {customer.trend}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}