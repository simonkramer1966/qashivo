import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { 
  Mail, 
  Phone, 
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter
} from "lucide-react";

/**
 * Admin Outcomes Viewer
 * 
 * Shows all contact outcomes from webhooks:
 * - Email delivered/opened/clicked
 * - SMS delivered/failed
 * - Voice call answered/completed
 * 
 * Includes filters for channel, outcome type, and A/B variant
 */
export default function AdminOutcomes() {
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [variantFilter, setVariantFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: outcomes = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/outcomes', channelFilter, outcomeFilter, variantFilter],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const filteredOutcomes = outcomes.filter(outcome => {
    if (searchQuery && !outcome.contactName?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Calculate summary stats
  const totalOutcomes = filteredOutcomes.length;
  const successRate = totalOutcomes > 0
    ? (filteredOutcomes.filter(o => ['delivered', 'opened', 'clicked', 'answered', 'completed'].includes(o.outcome)).length / totalOutcomes * 100)
    : 0;

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <NewSidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Outcomes" subtitle="Contact Outcome Tracking" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Page Header with Filters */}
            <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Filter className="h-5 w-5 text-[#17B6C3]" />
                  Filter Outcomes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      placeholder="Search contact..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-contact"
                    />
                  </div>

                  {/* Channel Filter */}
                  <Select value={channelFilter} onValueChange={setChannelFilter}>
                    <SelectTrigger data-testid="select-channel-filter">
                      <SelectValue placeholder="All Channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="voice">Voice</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Outcome Filter */}
                  <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                    <SelectTrigger data-testid="select-outcome-filter">
                      <SelectValue placeholder="All Outcomes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outcomes</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="opened">Opened</SelectItem>
                      <SelectItem value="clicked">Clicked</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="bounced">Bounced</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Variant Filter */}
                  <Select value={variantFilter} onValueChange={setVariantFilter}>
                    <SelectTrigger data-testid="select-variant-filter">
                      <SelectValue placeholder="All Variants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Variants</SelectItem>
                      <SelectItem value="ADAPTIVE">Adaptive</SelectItem>
                      <SelectItem value="STATIC">Static</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-background/70 backdrop-blur-md border-0 shadow-xl">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Outcomes</p>
                  <p className="text-3xl font-bold text-foreground" data-testid="text-total-outcomes">
                    {totalOutcomes}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-background/70 backdrop-blur-md border-0 shadow-xl">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-3xl font-bold text-green-600" data-testid="text-success-rate">
                    {successRate.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-background/70 backdrop-blur-md border-0 shadow-xl">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Response Rate</p>
                  <p className="text-3xl font-bold text-[#17B6C3]" data-testid="text-response-rate">
                    {successRate.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Outcomes Table */}
            <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">Recent Contact Outcomes</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading outcomes...</p>
                ) : filteredOutcomes.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-muted-foreground">No outcomes recorded yet</p>
                    <p className="text-sm text-muted-foreground/60 mt-2">
                      Outcomes will appear as webhooks are received from communication providers
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Timestamp</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Contact</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Channel</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Outcome</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Variant</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Action ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOutcomes.slice(0, 50).map((outcome: any) => (
                          <tr 
                            key={outcome.id} 
                            className="border-b border-border hover:bg-muted"
                            data-testid={`row-outcome-${outcome.id}`}
                          >
                            <td className="px-4 py-3 text-sm text-foreground">
                              {new Date(outcome.eventTimestamp).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-foreground font-medium">
                              {outcome.contactName || outcome.contactId}
                            </td>
                            <td className="px-4 py-3">
                              {getChannelBadge(outcome.channel)}
                            </td>
                            <td className="px-4 py-3">
                              {getOutcomeBadge(outcome.outcome)}
                            </td>
                            <td className="px-4 py-3">
                              {outcome.experimentVariant && (
                                <Badge className="bg-blue-100 text-blue-800 text-xs">
                                  {outcome.experimentVariant}
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                              {outcome.actionId?.slice(0, 8)}...
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
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

function getChannelBadge(channel: string) {
  const config: Record<string, { icon: any; className: string }> = {
    email: { icon: Mail, className: "bg-blue-100 text-blue-800" },
    sms: { icon: MessageSquare, className: "bg-green-100 text-green-800" },
    voice: { icon: Phone, className: "bg-purple-100 text-purple-800" },
    whatsapp: { icon: MessageSquare, className: "bg-emerald-100 text-emerald-800" },
  };

  const { icon: Icon, className } = config[channel] || { icon: MessageSquare, className: "bg-muted text-foreground" };

  return (
    <Badge className={`${className} flex items-center gap-1 text-xs w-fit`}>
      <Icon className="h-3 w-3" />
      {channel.toUpperCase()}
    </Badge>
  );
}

function getOutcomeBadge(outcome: string) {
  const successOutcomes = ['delivered', 'opened', 'clicked', 'answered', 'completed'];
  const failureOutcomes = ['failed', 'bounced', 'expired', 'rejected'];

  if (successOutcomes.includes(outcome)) {
    return (
      <Badge className="bg-green-100 text-green-800 flex items-center gap-1 text-xs w-fit">
        <CheckCircle className="h-3 w-3" />
        {outcome}
      </Badge>
    );
  }

  if (failureOutcomes.includes(outcome)) {
    return (
      <Badge className="bg-red-100 text-red-800 flex items-center gap-1 text-xs w-fit">
        <XCircle className="h-3 w-3" />
        {outcome}
      </Badge>
    );
  }

  return (
    <Badge className="bg-muted text-foreground text-xs">
      {outcome}
    </Badge>
  );
}
