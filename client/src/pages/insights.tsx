import { useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TrendingUp, Users, Brain, BarChart3, CheckCircle, XCircle, Clock, AlertTriangle, TrendingDown, Shuffle } from "lucide-react";

// Mock data for 6 behavioral segments based on LearningDemo seed data
const behavioralSegments = [
  {
    id: "reliable",
    name: "Reliable",
    icon: CheckCircle,
    color: "#10b981",
    description: "These customers consistently keep their payment promises and pay on time.",
    avgPRS: 0.92,
    avgSentiment: 0.8,
    trend: [
      { month: "Jan", score: 0.89 },
      { month: "Feb", score: 0.90 },
      { month: "Mar", score: 0.91 },
      { month: "Apr", score: 0.91 },
      { month: "May", score: 0.92 },
      { month: "Jun", score: 0.92 },
      { month: "Jul", score: 0.93 },
      { month: "Aug", score: 0.93 },
      { month: "Sep", score: 0.94 },
      { month: "Oct", score: 0.94 },
      { month: "Nov", score: 0.95 },
      { month: "Dec", score: 0.95 }
    ],
    customerCount: 40,
    confidenceGrowth: "+15%"
  },
  {
    id: "serial_promiser",
    name: "Serial Promiser",
    icon: XCircle,
    color: "#f97316",
    description: "Frequent promise-makers who rarely follow through. High communication, low delivery.",
    avgPRS: 0.35,
    avgSentiment: -0.2,
    trend: [
      { month: "Jan", score: 0.42 },
      { month: "Feb", score: 0.41 },
      { month: "Mar", score: 0.40 },
      { month: "Apr", score: 0.39 },
      { month: "May", score: 0.38 },
      { month: "Jun", score: 0.37 },
      { month: "Jul", score: 0.36 },
      { month: "Aug", score: 0.35 },
      { month: "Sep", score: 0.34 },
      { month: "Oct", score: 0.34 },
      { month: "Nov", score: 0.33 },
      { month: "Dec", score: 0.33 }
    ],
    customerCount: 40,
    confidenceGrowth: "+28%"
  },
  {
    id: "predictable_late",
    name: "Predictable Late",
    icon: Clock,
    color: "#f59e0b",
    description: "Consistently pay 7-14 days late but eventually settle. Pattern-driven behavior.",
    avgPRS: 0.70,
    avgSentiment: 0.5,
    trend: [
      { month: "Jan", score: 0.68 },
      { month: "Feb", score: 0.69 },
      { month: "Mar", score: 0.69 },
      { month: "Apr", score: 0.70 },
      { month: "May", score: 0.70 },
      { month: "Jun", score: 0.71 },
      { month: "Jul", score: 0.71 },
      { month: "Aug", score: 0.72 },
      { month: "Sep", score: 0.72 },
      { month: "Oct", score: 0.73 },
      { month: "Nov", score: 0.73 },
      { month: "Dec", score: 0.73 }
    ],
    customerCount: 40,
    confidenceGrowth: "+22%"
  },
  {
    id: "unpredictable_late",
    name: "Unpredictable Late",
    icon: Shuffle,
    color: "#06b6d4",
    description: "Inconsistent payment patterns. No clear timeline, making collection challenging.",
    avgPRS: 0.55,
    avgSentiment: 0.1,
    trend: [
      { month: "Jan", score: 0.52 },
      { month: "Feb", score: 0.58 },
      { month: "Mar", score: 0.51 },
      { month: "Apr", score: 0.59 },
      { month: "May", score: 0.53 },
      { month: "Jun", score: 0.57 },
      { month: "Jul", score: 0.54 },
      { month: "Aug", score: 0.56 },
      { month: "Sep", score: 0.55 },
      { month: "Oct", score: 0.58 },
      { month: "Nov", score: 0.54 },
      { month: "Dec", score: 0.56 }
    ],
    customerCount: 40,
    confidenceGrowth: "+19%"
  },
  {
    id: "disputer",
    name: "Disputer",
    icon: AlertTriangle,
    color: "#8b5cf6",
    description: "Frequently dispute invoices. May have legitimate concerns or delay tactics.",
    avgPRS: 0.50,
    avgSentiment: -0.4,
    trend: [
      { month: "Jan", score: 0.52 },
      { month: "Feb", score: 0.52 },
      { month: "Mar", score: 0.51 },
      { month: "Apr", score: 0.51 },
      { month: "May", score: 0.50 },
      { month: "Jun", score: 0.50 },
      { month: "Jul", score: 0.49 },
      { month: "Aug", score: 0.48 },
      { month: "Sep", score: 0.47 },
      { month: "Oct", score: 0.46 },
      { month: "Nov", score: 0.45 },
      { month: "Dec", score: 0.45 }
    ],
    customerCount: 40,
    confidenceGrowth: "+31%"
  },
  {
    id: "deteriorating",
    name: "Deteriorating",
    icon: TrendingDown,
    color: "#be123c",
    description: "Payment behavior worsening over time. Started reliable, now showing risk signals.",
    avgPRS: 0.40,
    avgSentiment: -0.6,
    trend: [
      { month: "Jan", score: 0.58 },
      { month: "Feb", score: 0.56 },
      { month: "Mar", score: 0.54 },
      { month: "Apr", score: 0.52 },
      { month: "May", score: 0.50 },
      { month: "Jun", score: 0.48 },
      { month: "Jul", score: 0.46 },
      { month: "Aug", score: 0.44 },
      { month: "Sep", score: 0.42 },
      { month: "Oct", score: 0.40 },
      { month: "Nov", score: 0.38 },
      { month: "Dec", score: 0.40 }
    ],
    customerCount: 40,
    confidenceGrowth: "+45%"
  }
];

// Prepare combined trend data for the main chart
const combinedTrendData = behavioralSegments[0].trend.map((_, index) => {
  const dataPoint: any = { month: behavioralSegments[0].trend[index].month };
  behavioralSegments.forEach(segment => {
    dataPoint[segment.id] = segment.trend[index].score;
  });
  return dataPoint;
});

// Calculate overall metrics
const totalCustomers = behavioralSegments.reduce((sum, seg) => sum + seg.customerCount, 0);
const avgPRS = (behavioralSegments.reduce((sum, seg) => sum + seg.avgPRS * seg.customerCount, 0) / totalCustomers).toFixed(2);
const avgConfidenceGrowth = Math.round(behavioralSegments.reduce((sum, seg) => sum + parseInt(seg.confidenceGrowth), 0) / behavioralSegments.length);

export default function InsightsPage() {
  const [selectedSegment, setSelectedSegment] = useState<typeof behavioralSegments[0] | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Hero Header with Metric Tiles */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#17B6C3] to-blue-600 bg-clip-text text-transparent mb-2">
              AI Behavioural Insights
            </h1>
            <p className="text-gray-600 text-lg">
              How Qashivo learns to understand every customer
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-metric-customers">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Customers</p>
                    <p className="text-3xl font-bold text-[#17B6C3]" data-testid="text-total-customers">{totalCustomers}</p>
                  </div>
                  <Users className="w-12 h-12 text-[#17B6C3]/30" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-metric-prs">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Avg Promise Reliability</p>
                    <p className="text-3xl font-bold text-[#17B6C3]" data-testid="text-avg-prs">{avgPRS}</p>
                  </div>
                  <Brain className="w-12 h-12 text-[#17B6C3]/30" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-metric-confidence">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">System Confidence Growth</p>
                    <p className="text-3xl font-bold text-green-600" data-testid="text-confidence-growth">+{avgConfidenceGrowth}%</p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-green-600/30" />
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Trend Visualization Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-trend-chart">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-[#17B6C3]" />
                Promise Reliability Score Trends (12 Months)
              </CardTitle>
              <CardDescription>
                How different customer segments perform over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={combinedTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis domain={[0, 1]} stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '13px' }} />
                  {behavioralSegments.map((segment) => (
                    <Line
                      key={segment.id}
                      type="monotone"
                      dataKey={segment.id}
                      name={segment.name}
                      stroke={segment.color}
                      strokeWidth={2}
                      dot={{ fill: segment.color, r: 4 }}
                      activeDot={{ r: 6 }}
                      animationDuration={1500}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Behavioral Segment Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Behavioural Segments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {behavioralSegments.map((segment, index) => {
              const Icon = segment.icon;
              return (
                <motion.div
                  key={segment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 * index }}
                >
                  <Card 
                    className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
                    onClick={() => setSelectedSegment(segment)}
                    data-testid={`card-segment-${segment.id}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg" style={{ backgroundColor: `${segment.color}20` }}>
                            <Icon className="w-6 h-6" style={{ color: segment.color }} />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg" data-testid={`text-segment-name-${segment.id}`}>{segment.name}</h3>
                            <p className="text-sm text-gray-600" data-testid={`text-segment-count-${segment.id}`}>{segment.customerCount} customers</p>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-4" data-testid={`text-segment-description-${segment.id}`}>
                        {segment.description}
                      </p>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Promise Reliability:</span>
                          <span className="font-semibold" style={{ color: segment.color }} data-testid={`text-segment-prs-${segment.id}`}>
                            {(segment.avgPRS * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Avg Sentiment:</span>
                          <span className={`font-semibold ${segment.avgSentiment >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`text-segment-sentiment-${segment.id}`}>
                            {segment.avgSentiment >= 0 ? '+' : ''}{segment.avgSentiment.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      {/* Mini Sparkline */}
                      <div className="mt-4 h-16">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={segment.trend}>
                            <defs>
                              <linearGradient id={`gradient-${segment.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={segment.color} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={segment.color} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <Area 
                              type="monotone" 
                              dataKey="score" 
                              stroke={segment.color} 
                              strokeWidth={2}
                              fill={`url(#gradient-${segment.id})`}
                              animationDuration={1000}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-[#17B6C3] font-medium" data-testid={`text-segment-confidence-${segment.id}`}>
                          AI Confidence: {segment.confidenceGrowth} this quarter
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Quote Banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center py-8"
        >
          <p className="text-lg text-gray-600 italic max-w-3xl mx-auto" data-testid="text-quote-banner">
            "Each dot on these charts represents a customer interaction that Qashivo has learned from."
          </p>
        </motion.div>
      </div>

      {/* Segment Detail Modal */}
      <Dialog open={!!selectedSegment} onOpenChange={() => setSelectedSegment(null)}>
        <DialogContent className="max-w-2xl" data-testid="modal-segment-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedSegment && (
                <>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${selectedSegment.color}20` }}>
                    {(() => {
                      const Icon = selectedSegment.icon;
                      return <Icon className="w-6 h-6" style={{ color: selectedSegment.color }} />;
                    })()}
                  </div>
                  <span data-testid="text-modal-segment-name">{selectedSegment.name}</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription data-testid="text-modal-segment-description">
              {selectedSegment?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSegment && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Customer Count</p>
                  <p className="text-2xl font-bold text-[#17B6C3]" data-testid="text-modal-customer-count">{selectedSegment.customerCount}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Promise Reliability Score</p>
                  <p className="text-2xl font-bold" style={{ color: selectedSegment.color }} data-testid="text-modal-prs">
                    {(selectedSegment.avgPRS * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Average Sentiment</p>
                  <p className={`text-2xl font-bold ${selectedSegment.avgSentiment >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-modal-sentiment">
                    {selectedSegment.avgSentiment >= 0 ? '+' : ''}{selectedSegment.avgSentiment.toFixed(1)}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">AI Confidence Growth</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-modal-confidence">{selectedSegment.confidenceGrowth}</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Next Steps:</strong> This segment detail view will be enhanced with real customer examples from the LearningDemo dataset, showing specific customers, their PRS history, and recent interactions.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
