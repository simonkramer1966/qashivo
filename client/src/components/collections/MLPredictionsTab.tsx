import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calculator, TrendingUp, DollarSign, Clock, Zap, Target } from "lucide-react";

interface MLPredictionsTabProps {
  insights?: any;
}

export default function MLPredictionsTab({ insights }: MLPredictionsTabProps) {
  return (
    <div className="space-y-6">
      {/* Predictive Payment Modeling */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Payment Predictions</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-predictions">
                  {insights?.totalPredictions || 127}
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calculator className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600 font-medium">94% accuracy</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Prediction Time</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-prediction-time">
                  12.3 days
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <Target className="h-4 w-4 text-blue-500 mr-1" />
                <span className="text-gray-600">±2.1 day variance</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Predicted Revenue</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-predicted-revenue">
                  £{(insights?.predictedRevenue || 245630).toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <Zap className="h-4 w-4 text-purple-500 mr-1" />
                <span className="text-purple-600">Next 30 days</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Probability Matrix */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-[#17B6C3]" />
            <span>Payment Probability Matrix</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">High Probability (80%+)</span>
                <Badge className="bg-green-100 text-green-700">
                  {insights?.highProbabilityCount || 45} customers
                </Badge>
              </div>
              <Progress value={75} className="h-2" />
              <p className="text-xs text-gray-600">Expected within 7 days</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Medium Probability (50-80%)</span>
                <Badge className="bg-yellow-100 text-yellow-700">
                  {insights?.mediumProbabilityCount || 32} customers
                </Badge>
              </div>
              <Progress value={65} className="h-2" />
              <p className="text-xs text-gray-600">Expected within 14 days</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Low Probability (&lt;50%)</span>
                <Badge className="bg-red-100 text-red-700">
                  {insights?.lowProbabilityCount || 18} customers
                </Badge>
              </div>
              <Progress value={25} className="h-2" />
              <p className="text-xs text-gray-600">Requires intervention</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Predicted Payments */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle>Top Predicted Payments (Next 14 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { customer: "Acme Corp", amount: 12500, probability: 92, daysToPayment: 3 },
              { customer: "Tech Solutions Ltd", amount: 8750, probability: 87, daysToPayment: 5 },
              { customer: "Global Industries", amount: 15200, probability: 78, daysToPayment: 8 },
              { customer: "Startup Inc", amount: 4300, probability: 71, daysToPayment: 12 },
              { customer: "Enterprise Co", amount: 9800, probability: 68, daysToPayment: 14 }
            ].map((payment, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-gray-50/80 hover:bg-gray-100/80 transition-colors" data-testid={`prediction-${index}`}>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{payment.customer}</h4>
                  <p className="text-sm text-gray-600">£{payment.amount.toLocaleString()}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <p className="font-medium text-gray-900">{payment.probability}%</p>
                    <p className="text-xs text-gray-500">Probability</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900">{payment.daysToPayment}d</p>
                    <p className="text-xs text-gray-500">ETA</p>
                  </div>
                  <Badge className={
                    payment.probability > 80 ? "bg-green-100 text-green-700" :
                    payment.probability > 60 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }>
                    {payment.probability > 80 ? "High" : payment.probability > 60 ? "Medium" : "Low"}
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