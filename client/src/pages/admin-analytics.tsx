import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { 
  TrendingUp, 
  Mail, 
  Phone, 
  MessageSquare,
  BarChart3,
  Target
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

/**
 * Admin Analytics Dashboard
 * 
 * Shows channel effectiveness metrics including:
 * - Response rates by channel (email, SMS, voice)
 * - Performance by days overdue bands
 * - A/B test results (STATIC vs ADAPTIVE scheduler)
 * 
 * Data comes from contactOutcomes table
 */
export default function AdminAnalytics() {
  const [timeRange, setTimeRange] = useState('30d');

  // Fetch channel effectiveness data
  const { data: analytics, isLoading } = useQuery<any>({
    queryKey: ['/api/admin/analytics/channels', timeRange],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <NewSidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Analytics" subtitle="Channel Performance" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
                  Channel Effectiveness Analytics
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Response rates and A/B test performance across communication channels
                </p>
              </div>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px]" data-testid="select-time-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Channel Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ChannelCard
                channel="Email"
                icon={Mail}
                responseRate={analytics?.channels?.email?.responseRate || 0}
                totalSent={analytics?.channels?.email?.totalSent || 0}
                isLoading={isLoading}
              />
              <ChannelCard
                channel="SMS"
                icon={MessageSquare}
                responseRate={analytics?.channels?.sms?.responseRate || 0}
                totalSent={analytics?.channels?.sms?.totalSent || 0}
                isLoading={isLoading}
              />
              <ChannelCard
                channel="Voice"
                icon={Phone}
                responseRate={analytics?.channels?.voice?.responseRate || 0}
                totalSent={analytics?.channels?.voice?.totalSent || 0}
                isLoading={isLoading}
              />
            </div>

            {/* A/B Test Results */}
            <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Target className="h-5 w-5 text-[#17B6C3]" />
                  A/B Test: Adaptive vs Static Scheduler
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ABTestVariantCard
                      variant="ADAPTIVE"
                      responseRate={analytics?.abTest?.adaptive?.responseRate || 0}
                      totalActions={analytics?.abTest?.adaptive?.totalActions || 0}
                      avgDaysToPayment={analytics?.abTest?.adaptive?.avgDaysToPayment || 0}
                    />
                    <ABTestVariantCard
                      variant="STATIC"
                      responseRate={analytics?.abTest?.static?.responseRate || 0}
                      totalActions={analytics?.abTest?.static?.totalActions || 0}
                      avgDaysToPayment={analytics?.abTest?.static?.avgDaysToPayment || 0}
                      baseline={true}
                    />
                  </div>
                )}
                
                {analytics?.abTest?.lift && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <p className="text-sm font-semibold text-green-900">
                        Adaptive scheduler shows {analytics.abTest.lift.toFixed(1)}% improvement in response rate
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance by Overdue Band */}
            <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#17B6C3]" />
                  Response Rates by Days Overdue
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div className="space-y-3">
                    <OverdueBandRow
                      label="0-30 days"
                      responseRate={analytics?.overdueBands?.['0-30']?.responseRate || 0}
                      count={analytics?.overdueBands?.['0-30']?.count || 0}
                    />
                    <OverdueBandRow
                      label="31-60 days"
                      responseRate={analytics?.overdueBands?.['31-60']?.responseRate || 0}
                      count={analytics?.overdueBands?.['31-60']?.count || 0}
                    />
                    <OverdueBandRow
                      label="61-90 days"
                      responseRate={analytics?.overdueBands?.['61-90']?.responseRate || 0}
                      count={analytics?.overdueBands?.['61-90']?.count || 0}
                    />
                    <OverdueBandRow
                      label="90+ days"
                      responseRate={analytics?.overdueBands?.['90+']?.responseRate || 0}
                      count={analytics?.overdueBands?.['90+']?.count || 0}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* No data placeholder */}
            {!isLoading && !analytics && (
              <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
                <CardContent className="p-12 text-center">
                  <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-muted-foreground">No analytics data available yet</p>
                  <p className="text-sm text-muted-foreground/60 mt-2">
                    Data will appear once contact outcomes are collected
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

function ChannelCard({ 
  channel, 
  icon: Icon, 
  responseRate, 
  totalSent, 
  isLoading 
}: { 
  channel: string; 
  icon: any; 
  responseRate: number; 
  totalSent: number; 
  isLoading: boolean;
}) {
  return (
    <Card className="bg-background/70 backdrop-blur-md border-0 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
            <Icon className="h-4 w-4 text-[#17B6C3]" />
          </div>
          {channel}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <p className="text-3xl font-bold text-foreground" data-testid={`text-${channel.toLowerCase()}-response-rate`}>
              {responseRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalSent} contacts sent
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ABTestVariantCard({
  variant,
  responseRate,
  totalActions,
  avgDaysToPayment,
  baseline = false,
}: {
  variant: string;
  responseRate: number;
  totalActions: number;
  avgDaysToPayment: number;
  baseline?: boolean;
}) {
  return (
    <div className={`p-4 rounded-lg border ${baseline ? 'bg-muted border-border' : 'bg-[#17B6C3]/5 border-[#17B6C3]/20'}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-foreground">{variant} Scheduler</h4>
        {baseline && <Badge className="bg-slate-200 text-foreground text-xs">Baseline</Badge>}
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-2xl font-bold text-foreground" data-testid={`text-${variant.toLowerCase()}-response`}>
            {responseRate.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">Response Rate</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="font-semibold text-foreground">{totalActions}</p>
            <p className="text-xs text-muted-foreground">Actions</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">{avgDaysToPayment.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Avg Days</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverdueBandRow({ label, responseRate, count }: { label: string; responseRate: number; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{count} invoices</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-32 bg-slate-200 rounded-full h-2">
          <div 
            className="bg-[#17B6C3] h-2 rounded-full" 
            style={{ width: `${Math.min(responseRate, 100)}%` }}
          />
        </div>
        <p className="text-sm font-semibold text-foreground w-12 text-right">
          {responseRate.toFixed(0)}%
        </p>
      </div>
    </div>
  );
}
