import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, Clock, Zap, BarChart3, LineChart } from "lucide-react";

interface MLPatternsTabProps {
  seasonalPatterns?: any[];
}

export default function MLPatternsTab({ seasonalPatterns }: MLPatternsTabProps) {
  const patterns = seasonalPatterns || [
    { patternName: "Monday Payment Pattern", patternType: "daily", patternStrength: "0.75", averagePaymentDelay: 2, sampleSize: 45 },
    { patternName: "December Payment Pattern", patternType: "monthly", patternStrength: "0.68", averagePaymentDelay: 28, sampleSize: 32 },
    { patternName: "Q4 Payment Pattern", patternType: "quarterly", patternStrength: "0.62", averagePaymentDelay: 22, sampleSize: 89 },
    { patternName: "Week 1 of Month Pattern", patternType: "weekly", patternStrength: "0.58", averagePaymentDelay: 8, sampleSize: 67 },
    { patternName: "Annual Payment Trend", patternType: "yearly", patternStrength: "0.45", averagePaymentDelay: 15, sampleSize: 156 }
  ];

  return (
    <div className="space-y-6">
      {/* Pattern Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Patterns</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-active-patterns">
                  {patterns.length}
                </p>
              </div>
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <BarChart3 className="h-4 w-4 text-indigo-500 mr-1" />
                <span className="text-indigo-600">Temporal analysis</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Strongest Pattern</p>
                <p className="text-lg font-bold text-gray-900" data-testid="metric-strongest-pattern">
                  Monday
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <Zap className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">75% strength</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Seasonal Effect</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-seasonal-effect">
                  +12d
                </p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className="text-orange-600">Holiday impact</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Data Points</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="metric-data-points">
                  {patterns.reduce((sum, p) => sum + p.sampleSize, 0)}
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <LineChart className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className="text-blue-600">Analysis depth</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pattern Types */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-[#17B6C3]" />
            <span>Temporal Pattern Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Pattern Types</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Daily</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">Day-of-week patterns</p>
                </div>
                
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Weekly</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">Week-of-month cycles</p>
                </div>
                
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">Monthly</span>
                  </div>
                  <p className="text-sm text-purple-700 mt-1">Seasonal months</p>
                </div>
                
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="flex items-center space-x-2">
                    <LineChart className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">Quarterly</span>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">Business cycles</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Key Insights</h4>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Best Collection Day</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Mondays show fastest payment responses (2 days average)
                  </p>
                </div>
                
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">Seasonal Slowdown</span>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">
                    December payments average 28 days slower than typical
                  </p>
                </div>
                
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Quarter-End Effect</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    Q4 shows 22-day average delays due to budget cycles
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Pattern Performance */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle>Pattern Strength & Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {patterns.map((pattern, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-gray-50/80 hover:bg-gray-100/80 transition-colors" data-testid={`pattern-${index}`}>
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      pattern.patternType === 'daily' ? 'bg-blue-500' :
                      pattern.patternType === 'weekly' ? 'bg-green-500' :
                      pattern.patternType === 'monthly' ? 'bg-purple-500' :
                      pattern.patternType === 'quarterly' ? 'bg-orange-500' :
                      'bg-red-500'
                    }`}></div>
                    <h4 className="font-medium text-gray-900">{pattern.patternName}</h4>
                    <Badge variant="outline" className="text-xs capitalize">
                      {pattern.patternType}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Based on {pattern.sampleSize} payment observations
                  </p>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-center">
                    <p className="font-medium text-gray-900">
                      {(parseFloat(pattern.patternStrength) * 100).toFixed(0)}%
                    </p>
                    <p className="text-gray-500">Strength</p>
                  </div>
                  <div className="text-center">
                    <p className={`font-medium ${
                      pattern.averagePaymentDelay < 10 ? 'text-green-600' :
                      pattern.averagePaymentDelay < 20 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {pattern.averagePaymentDelay}d
                    </p>
                    <p className="text-gray-500">Avg Delay</p>
                  </div>
                  <Badge className={
                    parseFloat(pattern.patternStrength) > 0.7 ? "bg-green-100 text-green-700" :
                    parseFloat(pattern.patternStrength) > 0.5 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }>
                    {parseFloat(pattern.patternStrength) > 0.7 ? "Strong" :
                     parseFloat(pattern.patternStrength) > 0.5 ? "Moderate" : "Weak"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle>ML-Driven Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Timing Optimizations</h4>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm font-medium text-green-800">✓ Send reminders on Mondays</p>
                  <p className="text-xs text-green-600">2x faster response rate detected</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                  <p className="text-sm font-medium text-yellow-800">⚠ Avoid late December collections</p>
                  <p className="text-xs text-yellow-600">28-day average delay during holidays</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Seasonal Adjustments</h4>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm font-medium text-blue-800">📊 Intensify Q4 collections</p>
                  <p className="text-xs text-blue-600">Start 22 days earlier than normal</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <p className="text-sm font-medium text-purple-800">📅 Week 1 focus strategy</p>
                  <p className="text-xs text-purple-600">8-day average delay - optimal timing</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}