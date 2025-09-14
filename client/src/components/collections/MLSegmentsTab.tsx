import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Layers, Users, Target, TrendingUp, PieChart, CheckCircle2 } from "lucide-react";

interface MLSegmentsTabProps {
  customerSegments?: any[];
}

export default function MLSegmentsTab({ customerSegments }: MLSegmentsTabProps) {
  const segments = customerSegments || [
    { segmentName: "Reliable Payers", segmentType: "behavioral", memberCount: 42, percentOfCustomers: "44.2", paymentSuccessRate: "0.92", averagePaymentTime: 3 },
    { segmentName: "Slow but Steady", segmentType: "behavioral", memberCount: 31, percentOfCustomers: "32.6", paymentSuccessRate: "0.78", averagePaymentTime: 18 },
    { segmentName: "Email Responders", segmentType: "communication", memberCount: 28, percentOfCustomers: "29.5", paymentSuccessRate: "0.71", averagePaymentTime: 12 },
    { segmentName: "High Risk", segmentType: "risk_based", memberCount: 15, percentOfCustomers: "15.8", paymentSuccessRate: "0.43", averagePaymentTime: 45 },
    { segmentName: "Early Payers", segmentType: "payment_pattern", memberCount: 23, percentOfCustomers: "24.2", paymentSuccessRate: "0.95", averagePaymentTime: -2 }
  ];

  return (
    <div className="space-y-6">
      {/* Segment Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Segments</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-total-segments">
                  {segments.length}
                </p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Layers className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <PieChart className="h-4 w-4 text-purple-500 mr-1" />
                <span className="text-purple-600">Active clustering</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Segmented Customers</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-segmented-customers">
                  {segments.reduce((sum, seg) => sum + seg.memberCount, 0)}
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">100% coverage</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Best Segment</p>
                <p className="text-lg font-bold text-gray-900" data-testid="metric-best-segment">
                  Early Payers
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">95% success rate</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Confidence</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-avg-confidence">
                  87%
                </p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={87} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">Segmentation quality</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segment Types */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-[#17B6C3]" />
            <span>Customer Segment Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Segment Distribution</h4>
              <div className="space-y-3">
                {segments.map((segment, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        segment.segmentType === 'behavioral' ? 'bg-blue-500' :
                        segment.segmentType === 'risk_based' ? 'bg-red-500' :
                        segment.segmentType === 'communication' ? 'bg-green-500' :
                        'bg-purple-500'
                      }`}></div>
                      <span className="text-sm font-medium">{segment.segmentName}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{segment.memberCount} customers</span>
                      <Badge className="bg-gray-100 text-gray-700">
                        {parseFloat(segment.percentOfCustomers).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Segment Types</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-blue-800">Behavioral</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">Payment patterns & behavior</p>
                </div>
                
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium text-red-800">Risk-Based</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">Credit risk assessment</p>
                </div>
                
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-800">Communication</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">Channel preferences</p>
                </div>
                
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-sm font-medium text-purple-800">Payment Pattern</span>
                  </div>
                  <p className="text-sm text-purple-700 mt-1">Timing & frequency</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Segment Performance */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle>Segment Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {segments.map((segment, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-gray-50/80 hover:bg-gray-100/80 transition-colors" data-testid={`segment-${index}`}>
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      segment.segmentType === 'behavioral' ? 'bg-blue-500' :
                      segment.segmentType === 'risk_based' ? 'bg-red-500' :
                      segment.segmentType === 'communication' ? 'bg-green-500' :
                      'bg-purple-500'
                    }`}></div>
                    <h4 className="font-medium text-gray-900">{segment.segmentName}</h4>
                    <Badge variant="outline" className="text-xs">
                      {segment.segmentType}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {segment.memberCount} customers ({parseFloat(segment.percentOfCustomers).toFixed(1)}% of portfolio)
                  </p>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-center">
                    <p className="font-medium text-gray-900">
                      {(parseFloat(segment.paymentSuccessRate) * 100).toFixed(0)}%
                    </p>
                    <p className="text-gray-500">Success Rate</p>
                  </div>
                  <div className="text-center">
                    <p className={`font-medium ${
                      segment.averagePaymentTime < 0 ? 'text-green-600' :
                      segment.averagePaymentTime < 15 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {segment.averagePaymentTime < 0 ? 
                        `${Math.abs(segment.averagePaymentTime)}d early` :
                        `${segment.averagePaymentTime}d late`
                      }
                    </p>
                    <p className="text-gray-500">Avg Payment</p>
                  </div>
                  <Badge className={
                    parseFloat(segment.paymentSuccessRate) > 0.8 ? "bg-green-100 text-green-700" :
                    parseFloat(segment.paymentSuccessRate) > 0.6 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }>
                    {parseFloat(segment.paymentSuccessRate) > 0.8 ? "Excellent" :
                     parseFloat(segment.paymentSuccessRate) > 0.6 ? "Good" : "Needs Attention"}
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