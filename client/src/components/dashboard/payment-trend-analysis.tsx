import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Clock, 
  DollarSign,
  Target,
  Activity,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb,
  RefreshCw,
  Download,
  Filter,
  Zap,
  ChevronRight,
  FileText
} from "lucide-react";
import { formatDate } from "../../../../shared/utils/dateFormatter";

// TypeScript interfaces for payment trend analysis
interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  amountPaid: string;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate: string | null;
  contact: {
    name: string;
    email: string;
  };
}

interface MonthlyTrendData {
  month: string;
  year: number;
  fullDate: string;
  averageDaysToPayment: number;
  totalPayments: number;
  totalAmount: number;
  onTimePayments: number;
  latePayments: number;
  paymentSuccessRate: number;
  averageDelay: number;
}

interface SeasonalPattern {
  season: string;
  month: number;
  monthName: string;
  averageDaysToPayment: number;
  paymentVolume: number;
  paymentSuccessRate: number;
  totalAmount: number;
  trend: 'improving' | 'declining' | 'stable';
}

interface DayOfWeekPattern {
  dayName: string;
  dayNumber: number;
  paymentCount: number;
  averageAmount: number;
  successRate: number;
  percentage: number;
}

interface TimeOfMonthPattern {
  period: string;
  startDay: number;
  endDay: number;
  paymentCount: number;
  averageAmount: number;
  successRate: number;
  percentage: number;
}

interface PaymentTrendInsight {
  type: 'seasonal' | 'timing' | 'volume' | 'performance';
  title: string;
  description: string;
  actionable: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  dataSupported: boolean;
}

interface OptimalTimingRecommendation {
  action: string;
  bestDay: string;
  bestTime: string;
  expectedImprovement: string;
  reasoning: string;
  dataPoints: number;
}

interface PaymentTrendData {
  monthlyTrends: MonthlyTrendData[];
  seasonalPatterns: SeasonalPattern[];
  dayOfWeekPatterns: DayOfWeekPattern[];
  timeOfMonthPatterns: TimeOfMonthPattern[];
  insights: PaymentTrendInsight[];
  recommendations: OptimalTimingRecommendation[];
  summary: {
    totalInvoicesAnalyzed: number;
    averageDaysToPayment: number;
    paymentSuccessRate: number;
    bestPerformingMonth: string;
    worstPerformingMonth: string;
    trendDirection: 'improving' | 'declining' | 'stable';
    trendPercentage: number;
    seasonalVariation: number;
  };
}

// Time range options
const TIME_RANGE_OPTIONS = [
  { value: '6months', label: '6 Months', months: 6 },
  { value: '1year', label: '1 Year', months: 12 },
  { value: '2years', label: '2 Years', months: 24 },
  { value: 'all', label: 'All Time', months: 0 }
];

// Colors for different visualizations
const TREND_COLORS = {
  primary: '#17B6C3',
  secondary: '#10B981',
  tertiary: '#F59E0B',
  danger: '#EF4444',
  muted: '#6B7280'
};

const SEASONAL_COLORS = [
  '#17B6C3', '#10B981', '#F59E0B', '#8B5CF6', 
  '#F97316', '#06B6D4', '#84CC16', '#EC4899',
  '#6366F1', '#14B8A6', '#F472B6', '#A855F7'
];

// Helper functions for data processing
const getDateFromString = (dateStr: string): Date => new Date(dateStr);

const getDaysDifference = (startDate: Date, endDate: Date): number => {
  const timeDiff = endDate.getTime() - startDate.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

const getMonthName = (monthIndex: number): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[monthIndex];
};

const getSeasonName = (month: number): string => {
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
};

const getDayName = (dayIndex: number): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex];
};

// Custom tooltip components
interface TrendTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: MonthlyTrendData;
    value: number;
    name: string;
    color: string;
  }>;
  label?: string;
}

const TrendTooltip = ({ active, payload, label }: TrendTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  
  return (
    <div className="glass-card p-4 shadow-lg min-w-[300px]">
      <p className="font-semibold text-slate-900 mb-2">{label}</p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Avg Days to Payment:</span>
          <span className="font-medium text-[#17B6C3]">
            {data.averageDaysToPayment?.toFixed(1)} days
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Total Payments:</span>
          <span className="font-medium text-slate-900">{data.totalPayments}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Total Amount:</span>
          <span className="font-medium text-green-600">
            ${data.totalAmount?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Success Rate:</span>
          <span className={`font-medium ${data.paymentSuccessRate >= 80 ? 'text-green-600' : data.paymentSuccessRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
            {data.paymentSuccessRate?.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">On-Time Payments:</span>
          <span className="font-medium text-slate-900">{data.onTimePayments}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Late Payments:</span>
          <span className="font-medium text-slate-900">{data.latePayments}</span>
        </div>
        {data.averageDelay > 0 && (
          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
            <span className="text-slate-600">Avg Delay:</span>
            <span className="font-medium text-red-600">{data.averageDelay?.toFixed(1)} days</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface PatternTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: DayOfWeekPattern | TimeOfMonthPattern;
    value: number;
    name: string;
    color: string;
  }>;
  label?: string;
}

const PatternTooltip = ({ active, payload, label }: PatternTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const isDayPattern = 'dayName' in data;
  
  return (
    <div className="glass-card p-4 shadow-lg min-w-[280px]">
      <p className="font-semibold text-slate-900 mb-2">{label}</p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Payment Count:</span>
          <span className="font-medium text-slate-900">{data.paymentCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Average Amount:</span>
          <span className="font-medium text-[#17B6C3]">
            ${data.averageAmount?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Success Rate:</span>
          <span className={`font-medium ${data.successRate >= 80 ? 'text-green-600' : data.successRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
            {data.successRate?.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Percentage of Total:</span>
          <span className="font-medium text-slate-900">{data.percentage?.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};

export default function PaymentTrendAnalysis() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('1year');
  const [selectedView, setSelectedView] = useState<'trends' | 'patterns' | 'insights'>('trends');

  const { data: invoices = [], isLoading, error } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    refetchOnMount: false,
  });

  // Data processing - calculate payment trends and patterns
  const trendData = useMemo<PaymentTrendData>(() => {
    if (!invoices || invoices.length === 0) {
      return {
        monthlyTrends: [],
        seasonalPatterns: [],
        dayOfWeekPatterns: [],
        timeOfMonthPatterns: [],
        insights: [],
        recommendations: [],
        summary: {
          totalInvoicesAnalyzed: 0,
          averageDaysToPayment: 0,
          paymentSuccessRate: 0,
          bestPerformingMonth: '',
          worstPerformingMonth: '',
          trendDirection: 'stable',
          trendPercentage: 0,
          seasonalVariation: 0,
        }
      };
    }

    // Filter paid invoices and apply time range filter
    const paidInvoices = invoices.filter(invoice => 
      invoice.status === 'paid' && invoice.paidDate
    );

    const timeRangeMonths = TIME_RANGE_OPTIONS.find(opt => opt.value === selectedTimeRange)?.months || 0;
    const cutoffDate = timeRangeMonths > 0 
      ? new Date(Date.now() - (timeRangeMonths * 30 * 24 * 60 * 60 * 1000))
      : new Date(0);

    const filteredInvoices = paidInvoices.filter(invoice => 
      new Date(invoice.paidDate!) >= cutoffDate
    );

    // Process monthly trends
    const monthlyData = new Map<string, {
      invoices: Invoice[];
      totalAmount: number;
      onTimeCount: number;
      lateCount: number;
      totalDaysToPayment: number;
      totalDelayDays: number;
    }>();

    filteredInvoices.forEach(invoice => {
      const paidDate = getDateFromString(invoice.paidDate!);
      const issueDate = getDateFromString(invoice.issueDate);
      const dueDate = getDateFromString(invoice.dueDate);
      
      const monthKey = `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, '0')}`;
      const daysToPayment = getDaysDifference(issueDate, paidDate);
      const isOnTime = paidDate <= dueDate;
      const delayDays = isOnTime ? 0 : getDaysDifference(dueDate, paidDate);
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          invoices: [],
          totalAmount: 0,
          onTimeCount: 0,
          lateCount: 0,
          totalDaysToPayment: 0,
          totalDelayDays: 0,
        });
      }
      
      const monthEntry = monthlyData.get(monthKey)!;
      monthEntry.invoices.push(invoice);
      monthEntry.totalAmount += parseFloat(invoice.amount);
      monthEntry.totalDaysToPayment += daysToPayment;
      monthEntry.totalDelayDays += delayDays;
      
      if (isOnTime) {
        monthEntry.onTimeCount++;
      } else {
        monthEntry.lateCount++;
      }
    });

    const monthlyTrends: MonthlyTrendData[] = Array.from(monthlyData.entries())
      .map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-').map(Number);
        const totalPayments = data.invoices.length;
        const averageDaysToPayment = data.totalDaysToPayment / totalPayments;
        const paymentSuccessRate = (data.onTimeCount / totalPayments) * 100;
        const averageDelay = data.lateCount > 0 ? data.totalDelayDays / data.lateCount : 0;
        
        return {
          month: getMonthName(month - 1),
          year,
          fullDate: `${year}-${String(month).padStart(2, '0')}`,
          averageDaysToPayment,
          totalPayments,
          totalAmount: data.totalAmount,
          onTimePayments: data.onTimeCount,
          latePayments: data.lateCount,
          paymentSuccessRate,
          averageDelay,
        };
      })
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

    // Process seasonal patterns
    const seasonalData = new Map<number, {
      invoices: Invoice[];
      totalAmount: number;
      totalDaysToPayment: number;
      onTimeCount: number;
    }>();

    filteredInvoices.forEach(invoice => {
      const paidDate = getDateFromString(invoice.paidDate!);
      const issueDate = getDateFromString(invoice.issueDate);
      const dueDate = getDateFromString(invoice.dueDate);
      const month = paidDate.getMonth();
      const daysToPayment = getDaysDifference(issueDate, paidDate);
      const isOnTime = paidDate <= dueDate;
      
      if (!seasonalData.has(month)) {
        seasonalData.set(month, {
          invoices: [],
          totalAmount: 0,
          totalDaysToPayment: 0,
          onTimeCount: 0,
        });
      }
      
      const monthEntry = seasonalData.get(month)!;
      monthEntry.invoices.push(invoice);
      monthEntry.totalAmount += parseFloat(invoice.amount);
      monthEntry.totalDaysToPayment += daysToPayment;
      
      if (isOnTime) {
        monthEntry.onTimeCount++;
      }
    });

    const seasonalPatterns: SeasonalPattern[] = Array.from(seasonalData.entries())
      .map(([month, data]) => {
        const totalPayments = data.invoices.length;
        const averageDaysToPayment = data.totalDaysToPayment / totalPayments;
        const paymentSuccessRate = (data.onTimeCount / totalPayments) * 100;
        
        // Determine trend (simplified - could be enhanced with more sophisticated analysis)
        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (paymentSuccessRate > 80) trend = 'improving';
        else if (paymentSuccessRate < 60) trend = 'declining';
        
        return {
          season: getSeasonName(month),
          month,
          monthName: getMonthName(month),
          averageDaysToPayment,
          paymentVolume: totalPayments,
          paymentSuccessRate,
          totalAmount: data.totalAmount,
          trend,
        };
      })
      .sort((a, b) => a.month - b.month);

    // Process day of week patterns
    const dayOfWeekData = new Map<number, {
      payments: number;
      totalAmount: number;
      onTimeCount: number;
    }>();

    filteredInvoices.forEach(invoice => {
      const paidDate = getDateFromString(invoice.paidDate!);
      const dueDate = getDateFromString(invoice.dueDate);
      const dayOfWeek = paidDate.getDay();
      const isOnTime = paidDate <= dueDate;
      
      if (!dayOfWeekData.has(dayOfWeek)) {
        dayOfWeekData.set(dayOfWeek, {
          payments: 0,
          totalAmount: 0,
          onTimeCount: 0,
        });
      }
      
      const dayEntry = dayOfWeekData.get(dayOfWeek)!;
      dayEntry.payments++;
      dayEntry.totalAmount += parseFloat(invoice.amount);
      
      if (isOnTime) {
        dayEntry.onTimeCount++;
      }
    });

    const totalPayments = filteredInvoices.length;
    const dayOfWeekPatterns: DayOfWeekPattern[] = Array.from(dayOfWeekData.entries())
      .map(([dayNumber, data]) => ({
        dayName: getDayName(dayNumber),
        dayNumber,
        paymentCount: data.payments,
        averageAmount: data.totalAmount / data.payments,
        successRate: (data.onTimeCount / data.payments) * 100,
        percentage: (data.payments / totalPayments) * 100,
      }))
      .sort((a, b) => a.dayNumber - b.dayNumber);

    // Process time of month patterns
    const timeOfMonthData = [
      { period: 'Early (1-10)', startDay: 1, endDay: 10, payments: 0, totalAmount: 0, onTimeCount: 0 },
      { period: 'Mid (11-20)', startDay: 11, endDay: 20, payments: 0, totalAmount: 0, onTimeCount: 0 },
      { period: 'Late (21-31)', startDay: 21, endDay: 31, payments: 0, totalAmount: 0, onTimeCount: 0 }
    ];

    filteredInvoices.forEach(invoice => {
      const paidDate = getDateFromString(invoice.paidDate!);
      const dueDate = getDateFromString(invoice.dueDate);
      const dayOfMonth = paidDate.getDate();
      const isOnTime = paidDate <= dueDate;
      
      let periodIndex = 0;
      if (dayOfMonth >= 11 && dayOfMonth <= 20) periodIndex = 1;
      else if (dayOfMonth >= 21) periodIndex = 2;
      
      timeOfMonthData[periodIndex].payments++;
      timeOfMonthData[periodIndex].totalAmount += parseFloat(invoice.amount);
      
      if (isOnTime) {
        timeOfMonthData[periodIndex].onTimeCount++;
      }
    });

    const timeOfMonthPatterns: TimeOfMonthPattern[] = timeOfMonthData.map(period => ({
      period: period.period,
      startDay: period.startDay,
      endDay: period.endDay,
      paymentCount: period.payments,
      averageAmount: period.payments > 0 ? period.totalAmount / period.payments : 0,
      successRate: period.payments > 0 ? (period.onTimeCount / period.payments) * 100 : 0,
      percentage: (period.payments / totalPayments) * 100,
    }));

    // Generate insights and recommendations
    const insights: PaymentTrendInsight[] = [];
    const recommendations: OptimalTimingRecommendation[] = [];

    // Seasonal insight
    if (seasonalPatterns.length > 0) {
      const bestMonth = seasonalPatterns.reduce((best, current) => 
        current.paymentSuccessRate > best.paymentSuccessRate ? current : best
      );
      
      const worstMonth = seasonalPatterns.reduce((worst, current) => 
        current.paymentSuccessRate < worst.paymentSuccessRate ? current : worst
      );

      if (bestMonth.paymentSuccessRate - worstMonth.paymentSuccessRate > 15) {
        insights.push({
          type: 'seasonal',
          title: 'Strong Seasonal Payment Patterns',
          description: `${bestMonth.monthName} shows ${bestMonth.paymentSuccessRate.toFixed(1)}% success rate vs ${worstMonth.monthName}'s ${worstMonth.paymentSuccessRate.toFixed(1)}%`,
          actionable: `Focus collection efforts during ${worstMonth.monthName} and adjust cash flow planning for seasonal variations`,
          impact: 'high',
          confidence: 85,
          dataSupported: true,
        });
      }
    }

    // Day of week insight
    if (dayOfWeekPatterns.length > 0) {
      const bestDay = dayOfWeekPatterns.reduce((best, current) => 
        current.successRate > best.successRate ? current : best
      );
      
      recommendations.push({
        action: 'Optimize reminder timing',
        bestDay: bestDay.dayName,
        bestTime: 'Morning (9-11 AM)',
        expectedImprovement: `+${(bestDay.successRate - 70).toFixed(1)}% success rate`,
        reasoning: `${bestDay.dayName} shows highest payment activity with ${bestDay.paymentCount} payments and ${bestDay.successRate.toFixed(1)}% success rate`,
        dataPoints: bestDay.paymentCount,
      });
    }

    // Volume trend insight
    if (monthlyTrends.length >= 3) {
      const recentAvg = monthlyTrends.slice(-3).reduce((sum, month) => sum + month.totalPayments, 0) / 3;
      const olderAvg = monthlyTrends.slice(0, 3).reduce((sum, month) => sum + month.totalPayments, 0) / 3;
      const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

      if (Math.abs(changePercent) > 10) {
        insights.push({
          type: 'volume',
          title: changePercent > 0 ? 'Payment Volume Increasing' : 'Payment Volume Declining',
          description: `Payment volume has ${changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercent).toFixed(1)}% in recent months`,
          actionable: changePercent > 0 ? 'Consider increasing collection capacity' : 'Review collection processes for efficiency improvements',
          impact: Math.abs(changePercent) > 20 ? 'high' : 'medium',
          confidence: 75,
          dataSupported: true,
        });
      }
    }

    // Calculate summary statistics
    const totalInvoicesAnalyzed = filteredInvoices.length;
    const averageDaysToPayment = filteredInvoices.length > 0 
      ? filteredInvoices.reduce((sum, invoice) => {
          const issueDate = getDateFromString(invoice.issueDate);
          const paidDate = getDateFromString(invoice.paidDate!);
          return sum + getDaysDifference(issueDate, paidDate);
        }, 0) / filteredInvoices.length
      : 0;

    const onTimePaymentsCount = filteredInvoices.filter(invoice => {
      const paidDate = getDateFromString(invoice.paidDate!);
      const dueDate = getDateFromString(invoice.dueDate);
      return paidDate <= dueDate;
    }).length;

    const paymentSuccessRate = totalInvoicesAnalyzed > 0 
      ? (onTimePaymentsCount / totalInvoicesAnalyzed) * 100 
      : 0;

    const bestPerformingMonth = seasonalPatterns.length > 0 
      ? seasonalPatterns.reduce((best, current) => 
          current.paymentSuccessRate > best.paymentSuccessRate ? current : best
        ).monthName
      : '';

    const worstPerformingMonth = seasonalPatterns.length > 0 
      ? seasonalPatterns.reduce((worst, current) => 
          current.paymentSuccessRate < worst.paymentSuccessRate ? current : worst
        ).monthName
      : '';

    // Determine overall trend direction
    let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
    let trendPercentage = 0;
    
    if (monthlyTrends.length >= 6) {
      const recentMonths = monthlyTrends.slice(-3);
      const earlierMonths = monthlyTrends.slice(0, 3);
      
      const recentAvgSuccessRate = recentMonths.reduce((sum, month) => sum + month.paymentSuccessRate, 0) / 3;
      const earlierAvgSuccessRate = earlierMonths.reduce((sum, month) => sum + month.paymentSuccessRate, 0) / 3;
      
      trendPercentage = recentAvgSuccessRate - earlierAvgSuccessRate;
      
      if (trendPercentage > 5) trendDirection = 'improving';
      else if (trendPercentage < -5) trendDirection = 'declining';
    }

    const seasonalVariation = seasonalPatterns.length > 0 
      ? Math.max(...seasonalPatterns.map(s => s.paymentSuccessRate)) - 
        Math.min(...seasonalPatterns.map(s => s.paymentSuccessRate))
      : 0;

    return {
      monthlyTrends,
      seasonalPatterns,
      dayOfWeekPatterns,
      timeOfMonthPatterns,
      insights,
      recommendations,
      summary: {
        totalInvoicesAnalyzed,
        averageDaysToPayment,
        paymentSuccessRate,
        bestPerformingMonth,
        worstPerformingMonth,
        trendDirection,
        trendPercentage,
        seasonalVariation,
      }
    };
  }, [invoices, selectedTimeRange]);

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3 animate-pulse">
              <TrendingUp className="text-[#17B6C3] h-5 w-5" />
            </div>
            Payment Trend Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Loading Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="glass-card p-4 animate-pulse">
                  <div className="h-16 bg-muted/30 rounded" />
                </div>
              ))}
            </div>
            {/* Loading Chart */}
            <div className="glass-card p-6 animate-pulse">
              <div className="h-96 bg-muted/30 rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-red-100 rounded-lg mr-3">
              <AlertTriangle className="text-red-600 h-5 w-5" />
            </div>
            Payment Trend Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-lg font-semibold text-slate-900 mb-2">Unable to load payment trends</p>
            <p className="text-sm text-muted-foreground">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!trendData.summary.totalInvoicesAnalyzed) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
              <TrendingUp className="text-[#17B6C3] h-5 w-5" />
            </div>
            Payment Trend Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-8 w-8 text-[#17B6C3]" />
            </div>
            <p className="text-lg font-semibold text-slate-900 mb-2">No payment data available</p>
            <p className="text-sm text-muted-foreground">Complete some payments to see trend analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const summaryMetrics = [
    {
      title: "Analyzed Invoices",
      value: trendData.summary.totalInvoicesAnalyzed.toLocaleString(),
      change: selectedTimeRange === '1year' ? '12 months' : TIME_RANGE_OPTIONS.find(opt => opt.value === selectedTimeRange)?.label || 'All time',
      changeType: "neutral" as const,
      icon: FileText,
      testId: "metric-total-analyzed"
    },
    {
      title: "Avg Days to Payment",
      value: `${trendData.summary.averageDaysToPayment.toFixed(1)}`,
      change: trendData.summary.trendDirection === 'improving' ? 'Improving' : trendData.summary.trendDirection === 'declining' ? 'Declining' : 'Stable',
      changeType: trendData.summary.trendDirection === 'improving' ? 'positive' as const : trendData.summary.trendDirection === 'declining' ? 'negative' as const : 'neutral' as const,
      icon: Clock,
      testId: "metric-avg-days"
    },
    {
      title: "Payment Success Rate",
      value: `${trendData.summary.paymentSuccessRate.toFixed(1)}%`,
      change: `${Math.abs(trendData.summary.trendPercentage).toFixed(1)}% ${trendData.summary.trendPercentage >= 0 ? 'increase' : 'decrease'}`,
      changeType: trendData.summary.trendPercentage >= 0 ? 'positive' as const : 'negative' as const,
      icon: Target,
      testId: "metric-success-rate"
    },
    {
      title: "Seasonal Variation",
      value: `${trendData.summary.seasonalVariation.toFixed(1)}%`,
      change: `${trendData.summary.bestPerformingMonth} best month`,
      changeType: "neutral" as const,
      icon: Activity,
      testId: "metric-seasonal-variation"
    },
  ];

  return (
    <Card className="glass-card" data-testid="card-payment-trend-analysis">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center" data-testid="text-payment-trends-title">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
              <TrendingUp className="text-[#17B6C3] h-5 w-5" />
            </div>
            Payment Trend Analysis
          </CardTitle>
          <div className="flex items-center space-x-3">
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange} data-testid="select-time-range">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5" data-testid="button-export-trends">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryMetrics.map((metric) => (
            <div 
              key={metric.title} 
              className="glass-card p-4"
              data-testid={metric.testId}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <metric.icon className="h-4 w-4 text-[#17B6C3]" />
                </div>
                {metric.changeType === 'positive' && (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                )}
                {metric.changeType === 'negative' && (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {metric.title}
                </p>
                <p className="text-lg font-bold text-gray-900" data-testid={`${metric.testId}-value`}>
                  {metric.value}
                </p>
                <p className={`text-xs ${
                  metric.changeType === 'positive' ? 'text-green-600' : 
                  metric.changeType === 'negative' ? 'text-red-600' : 
                  'text-muted-foreground'
                }`} data-testid={`${metric.testId}-change`}>
                  {metric.change}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Tabs */}
        <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)} className="w-full" data-testid="tabs-payment-analysis">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trends" data-testid="tab-trends">Payment Trends</TabsTrigger>
            <TabsTrigger value="patterns" data-testid="tab-patterns">Timing Patterns</TabsTrigger>
            <TabsTrigger value="insights" data-testid="tab-insights">Insights & Actions</TabsTrigger>
          </TabsList>

          {/* Payment Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            {/* Monthly Payment Trends */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900" data-testid="text-monthly-trends-title">
                  Monthly Payment Performance
                </h3>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-[#17B6C3] rounded-full"></div>
                    <span className="text-slate-600">Avg Days to Payment</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-[#10B981] rounded-full"></div>
                    <span className="text-slate-600">Success Rate</span>
                  </div>
                </div>
              </div>
              <div className="h-80" data-testid="chart-monthly-trends">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData.monthlyTrends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#6B7280"
                      fontSize={12}
                    />
                    <YAxis 
                      yAxisId="days"
                      stroke="#6B7280"
                      fontSize={12}
                    />
                    <YAxis 
                      yAxisId="rate"
                      orientation="right"
                      stroke="#6B7280"
                      fontSize={12}
                    />
                    <Tooltip content={<TrendTooltip />} />
                    <Legend />
                    <Line 
                      yAxisId="days"
                      type="monotone" 
                      dataKey="averageDaysToPayment" 
                      stroke={TREND_COLORS.primary}
                      strokeWidth={3}
                      dot={{ fill: TREND_COLORS.primary, strokeWidth: 2, r: 4 }}
                      name="Avg Days to Payment"
                    />
                    <Line 
                      yAxisId="rate"
                      type="monotone" 
                      dataKey="paymentSuccessRate" 
                      stroke={TREND_COLORS.secondary}
                      strokeWidth={3}
                      dot={{ fill: TREND_COLORS.secondary, strokeWidth: 2, r: 4 }}
                      name="Success Rate %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Seasonal Patterns */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900" data-testid="text-seasonal-patterns-title">
                  Seasonal Payment Patterns
                </h3>
                <Badge 
                  variant={trendData.summary.seasonalVariation > 20 ? 'destructive' : trendData.summary.seasonalVariation > 10 ? 'secondary' : 'default'}
                  data-testid="badge-seasonal-variation"
                >
                  {trendData.summary.seasonalVariation.toFixed(1)}% variation
                </Badge>
              </div>
              <div className="h-80" data-testid="chart-seasonal-patterns">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData.seasonalPatterns} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="monthName" 
                      stroke="#6B7280"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="#6B7280"
                      fontSize={12}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="glass-card p-4 shadow-lg min-w-[250px]">
                            <p className="font-semibold text-slate-900 mb-2">{label}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-600">Success Rate:</span>
                                <span className="font-medium text-[#17B6C3]">{data.paymentSuccessRate?.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-600">Payment Volume:</span>
                                <span className="font-medium text-slate-900">{data.paymentVolume}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-600">Avg Days:</span>
                                <span className="font-medium text-slate-900">{data.averageDaysToPayment?.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-600">Total Amount:</span>
                                <span className="font-medium text-green-600">${data.totalAmount?.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="paymentSuccessRate" 
                      stroke={TREND_COLORS.primary}
                      fill={`${TREND_COLORS.primary}20`}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* Timing Patterns Tab */}
          <TabsContent value="patterns" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Day of Week Patterns */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4" data-testid="text-day-patterns-title">
                  Day of Week Patterns
                </h3>
                <div className="h-80" data-testid="chart-day-patterns">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData.dayOfWeekPatterns} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="dayName" 
                        stroke="#6B7280"
                        fontSize={11}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis stroke="#6B7280" fontSize={12} />
                      <Tooltip content={<PatternTooltip />} />
                      <Bar 
                        dataKey="paymentCount" 
                        fill={TREND_COLORS.primary}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  {trendData.dayOfWeekPatterns.slice(0, 2).map((day) => (
                    <div key={day.dayName} className="bg-[#17B6C3]/5 p-3 rounded-lg">
                      <div className="font-medium text-slate-900">{day.dayName}</div>
                      <div className="text-slate-600">{day.paymentCount} payments</div>
                      <div className="text-[#17B6C3] font-medium">{day.successRate.toFixed(1)}% success</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time of Month Patterns */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4" data-testid="text-time-patterns-title">
                  Time of Month Patterns
                </h3>
                <div className="h-80" data-testid="chart-time-patterns">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={trendData.timeOfMonthPatterns}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="paymentCount"
                      >
                        {trendData.timeOfMonthPatterns.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={SEASONAL_COLORS[index % SEASONAL_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PatternTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {trendData.timeOfMonthPatterns.map((period, index) => (
                    <div key={period.period} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: SEASONAL_COLORS[index] }}
                        ></div>
                        <span className="font-medium text-slate-900">{period.period}</span>
                      </div>
                      <div className="text-slate-600">{period.successRate.toFixed(1)}% success</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Insights & Actions Tab */}
          <TabsContent value="insights" className="space-y-6">
            {/* Key Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <Lightbulb className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900" data-testid="text-insights-title">
                    Key Insights
                  </h3>
                </div>
                <div className="space-y-4">
                  {trendData.insights.length > 0 ? (
                    trendData.insights.map((insight, index) => (
                      <div 
                        key={index}
                        className="border border-slate-200 rounded-lg p-4 bg-white/50"
                        data-testid={`insight-${index}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={insight.impact === 'high' ? 'destructive' : insight.impact === 'medium' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {insight.impact} impact
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {insight.confidence}% confidence
                            </Badge>
                          </div>
                          {insight.type === 'seasonal' && <Calendar className="h-4 w-4 text-slate-400" />}
                          {insight.type === 'timing' && <Clock className="h-4 w-4 text-slate-400" />}
                          {insight.type === 'volume' && <BarChart3 className="h-4 w-4 text-slate-400" />}
                          {insight.type === 'performance' && <Target className="h-4 w-4 text-slate-400" />}
                        </div>
                        <div className="mb-2">
                          <h4 className="font-medium text-slate-900 mb-1">{insight.title}</h4>
                          <p className="text-sm text-slate-600 mb-2">{insight.description}</p>
                        </div>
                        <div className="bg-[#17B6C3]/5 border-l-4 border-[#17B6C3] pl-3 py-2">
                          <p className="text-sm font-medium text-[#17B6C3]">Action Required:</p>
                          <p className="text-sm text-slate-700">{insight.actionable}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <Info className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">More data needed for detailed insights</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommendations */}
              <div className="glass-card p-6">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-green-100 rounded-lg mr-3">
                    <Zap className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900" data-testid="text-recommendations-title">
                    Optimization Recommendations
                  </h3>
                </div>
                <div className="space-y-4">
                  {trendData.recommendations.length > 0 ? (
                    trendData.recommendations.map((rec, index) => (
                      <div 
                        key={index}
                        className="border border-slate-200 rounded-lg p-4 bg-white/50"
                        data-testid={`recommendation-${index}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-slate-900">{rec.action}</h4>
                          <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                            {rec.expectedImprovement}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Best Day:</span>
                            <span className="font-medium text-slate-900">{rec.bestDay}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Best Time:</span>
                            <span className="font-medium text-slate-900">{rec.bestTime}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Data Points:</span>
                            <span className="font-medium text-slate-900">{rec.dataPoints}</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-sm text-slate-600">{rec.reasoning}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <Target className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Recommendations will appear as more data is collected</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Items */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900" data-testid="text-action-items-title">
                  Next Actions
                </h3>
                <Badge variant="secondary" className="text-xs" data-testid="badge-total-actions">
                  {trendData.insights.length + trendData.recommendations.length} items
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Seasonal Action */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4" data-testid="action-seasonal">
                  <div className="flex items-center mb-2">
                    <Calendar className="h-4 w-4 text-blue-600 mr-2" />
                    <span className="font-medium text-blue-900">Seasonal Planning</span>
                  </div>
                  <p className="text-sm text-blue-800 mb-3">
                    Adjust collection strategies for {trendData.summary.worstPerformingMonth} low performance periods
                  </p>
                  <Button variant="outline" size="sm" className="text-blue-600 border-blue-300 hover:bg-blue-100 w-full" data-testid="button-seasonal-action">
                    Create Seasonal Plan
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                {/* Timing Action */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4" data-testid="action-timing">
                  <div className="flex items-center mb-2">
                    <Clock className="h-4 w-4 text-green-600 mr-2" />
                    <span className="font-medium text-green-900">Timing Optimization</span>
                  </div>
                  <p className="text-sm text-green-800 mb-3">
                    Optimize reminder scheduling based on successful payment patterns
                  </p>
                  <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-100 w-full" data-testid="button-timing-action">
                    Update Schedules
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                {/* Performance Action */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4" data-testid="action-performance">
                  <div className="flex items-center mb-2">
                    <Target className="h-4 w-4 text-orange-600 mr-2" />
                    <span className="font-medium text-orange-900">Performance Review</span>
                  </div>
                  <p className="text-sm text-orange-800 mb-3">
                    Review collection processes for {trendData.summary.paymentSuccessRate.toFixed(1)}% success rate
                  </p>
                  <Button variant="outline" size="sm" className="text-orange-600 border-orange-300 hover:bg-orange-100 w-full" data-testid="button-performance-action">
                    Review Process
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}