import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Mail,
  Phone,
  Target,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
} from "lucide-react";
import Header from "@/components/layout/header";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

interface ClientListItem {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  behavioralSegment: string;
  segmentColor: string;
  confidenceScore: number;
  prs: number;
  totalInteractions: number | null;
  totalPromisesMade: number | null;
  promisesKept: number | null;
  promisesBroken: number | null;
  preferredChannel: string | null;
}

interface ClientDetail {
  client: {
    id: string;
    name: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
  };
  learningProfile: {
    learningConfidence: string;
    promiseReliabilityScore: string;
    totalInteractions: number;
    totalPromisesMade: number;
    promisesKept: number;
    promisesBroken: number;
    prsLast30Days: string;
    prsLast90Days: string;
    prsLast12Months: string;
    emailEffectiveness: string;
    smsEffectiveness: string;
    voiceEffectiveness: string;
    averageResponseTime: number;
    preferredChannel: string;
  } | null;
  promises: Array<{
    id: string;
    promisedDate: Date;
    promisedAmount: number;
    status: string;
    createdAt: Date;
    sentiment: string;
  }>;
  channelStats: Array<{
    channel: string;
    count: number;
    avgSentiment: number;
  }>;
  behavioralFlags: {
    isSerialPromiser: boolean;
    isReliableLatePayer: boolean;
    isRelationshipDeteriorating: boolean;
    isNewCustomer: boolean;
  };
}

export default function ClientIntelligencePage() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const { data: clients = [], isLoading: isLoadingClients } = useQuery<ClientListItem[]>({
    queryKey: ["/api/client-intelligence/clients"],
  });

  const { data: selectedClientData, isLoading: isLoadingDetail } = useQuery<ClientDetail>({
    queryKey: ["/api/client-intelligence/clients", selectedClientId],
    enabled: !!selectedClientId,
  });

  // Auto-select first client if none selected
  useState(() => {
    if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  });

  // Prepare PRS trend data
  const prsTrendData = selectedClientData?.learningProfile
    ? [
        { period: "12M", prs: parseFloat(selectedClientData.learningProfile.prsLast12Months || "0") },
        { period: "90D", prs: parseFloat(selectedClientData.learningProfile.prsLast90Days || "0") },
        { period: "30D", prs: parseFloat(selectedClientData.learningProfile.prsLast30Days || "0") },
        { period: "Now", prs: parseFloat(selectedClientData.learningProfile.promiseReliabilityScore || "0") },
      ]
    : [];

  const confidenceScore = selectedClientData?.learningProfile
    ? parseFloat(selectedClientData.learningProfile.learningConfidence || "0.1")
    : 0.1;

  const getBehavioralSegment = () => {
    if (!selectedClientData) return { name: "Unknown", color: "#94a3b8" };
    const { behavioralFlags, learningProfile } = selectedClientData;

    if (behavioralFlags.isSerialPromiser) return { name: "Serial Promiser", color: "#f97316" };
    if (behavioralFlags.isRelationshipDeteriorating) return { name: "Deteriorating", color: "#be123c" };
    if (behavioralFlags.isReliableLatePayer) return { name: "Predictable Late", color: "#facc15" };
    if (learningProfile && parseFloat(learningProfile.promiseReliabilityScore || "0") >= 85)
      return { name: "Reliable", color: "#22c55e" };
    if (learningProfile && learningProfile.totalPromisesMade > 0)
      return { name: "Unpredictable Late", color: "#f59e0b" };

    return { name: "Unknown", color: "#94a3b8" };
  };

  const segment = getBehavioralSegment();

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      <main className="flex-1 overflow-hidden flex flex-col main-with-bottom-nav">
        <Header title="Client Intelligence" subtitle="AI learning progression for each customer" />

        <div className="flex-1 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 overflow-hidden">
          <div className="h-full flex flex-col p-6 gap-6 max-w-7xl mx-auto">
            {/* Top Half - Client Detail */}
            <div className="flex-1 min-h-0">
              {isLoadingDetail || !selectedClientData ? (
                <Card className="h-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-64" />
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg overflow-auto">
                  <CardHeader className="border-b border-gray-200/50 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl font-bold text-gray-900" data-testid="text-client-name">
                          {selectedClientData.client.name}
                        </CardTitle>
                        {selectedClientData.client.companyName && (
                          <p className="text-sm text-gray-600 mt-1" data-testid="text-company-name">
                            {selectedClientData.client.companyName}
                          </p>
                        )}
                      </div>
                      <Badge
                        style={{ backgroundColor: segment.color }}
                        className="text-white px-3 py-1"
                        data-testid="badge-behavioral-segment"
                      >
                        {segment.name}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-white/70 backdrop-blur-md border-0 shadow-xl rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-[#17B6C3]" />
                          <p className="text-xs text-gray-600">AI Confidence</p>
                        </div>
                        <p className="text-2xl font-bold text-[#17B6C3]" data-testid="text-confidence">
                          {Math.round(confidenceScore * 100)}%
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedClientData.learningProfile?.totalInteractions || 0} interactions
                        </p>
                      </div>

                      <div className="bg-white/70 backdrop-blur-md border-0 shadow-xl rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-blue-600" />
                          <p className="text-xs text-gray-600">Promise Reliability</p>
                        </div>
                        <p className="text-2xl font-bold text-blue-600" data-testid="text-prs">
                          {selectedClientData.learningProfile?.promiseReliabilityScore || 0}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {selectedClientData.learningProfile?.promisesKept || 0} kept
                          </span>
                          <span className="text-xs text-red-600 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            {selectedClientData.learningProfile?.promisesBroken || 0} broken
                          </span>
                        </div>
                      </div>

                      <div className="bg-white/70 backdrop-blur-md border-0 shadow-xl rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-purple-600" />
                          <p className="text-xs text-gray-600">Preferred Channel</p>
                        </div>
                        <p className="text-lg font-bold text-purple-600 capitalize" data-testid="text-channel">
                          {selectedClientData.learningProfile?.preferredChannel || "None"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Avg response: {selectedClientData.learningProfile?.averageResponseTime || 0}h
                        </p>
                      </div>

                      <div className="bg-white/70 backdrop-blur-md border-0 shadow-xl rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-green-600" />
                          <p className="text-xs text-gray-600">Total Promises</p>
                        </div>
                        <p className="text-2xl font-bold text-green-600" data-testid="text-promises">
                          {selectedClientData.learningProfile?.totalPromisesMade || 0}
                        </p>
                      </div>
                    </div>

                    {/* PRS Trend Chart */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        Promise Reliability Trend
                      </h3>
                      <div className="h-32 bg-white/50 rounded-lg p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={prsTrendData}>
                            <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="prs"
                              stroke="#17B6C3"
                              strokeWidth={2}
                              dot={{ fill: "#17B6C3", r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Channel Effectiveness */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Channel Effectiveness</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/50 rounded-lg p-3 text-center">
                          <Mail className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                          <p className="text-xs text-gray-600">Email</p>
                          <p className="text-lg font-bold text-blue-600">
                            {Math.round(parseFloat(selectedClientData.learningProfile?.emailEffectiveness || "0.5") * 100)}%
                          </p>
                        </div>
                        <div className="bg-white/50 rounded-lg p-3 text-center">
                          <MessageSquare className="w-5 h-5 mx-auto mb-1 text-green-600" />
                          <p className="text-xs text-gray-600">SMS</p>
                          <p className="text-lg font-bold text-green-600">
                            {Math.round(parseFloat(selectedClientData.learningProfile?.smsEffectiveness || "0.5") * 100)}%
                          </p>
                        </div>
                        <div className="bg-white/50 rounded-lg p-3 text-center">
                          <Phone className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                          <p className="text-xs text-gray-600">Voice</p>
                          <p className="text-lg font-bold text-purple-600">
                            {Math.round(parseFloat(selectedClientData.learningProfile?.voiceEffectiveness || "0.5") * 100)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Bottom Half - Client List */}
            <div className="flex-1 min-h-0">
              <Card className="h-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg flex flex-col">
                <CardHeader className="border-b border-gray-200/50 pb-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-gray-900">All Clients</CardTitle>
                    <Badge variant="outline" className="text-gray-600" data-testid="badge-client-count">
                      <Users className="w-3 h-3 mr-1" />
                      {clients.length} clients
                    </Badge>
                  </div>
                </CardHeader>

                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {isLoadingClients ? (
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {clients.map((client) => (
                          <motion.div
                            key={client.id}
                            whileHover={{ scale: 1.01 }}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedClientId === client.id
                                ? "bg-[#17B6C3]/10 border-[#17B6C3]"
                                : "bg-white/50 border-gray-200 hover:border-[#17B6C3]/50"
                            }`}
                            onClick={() => setSelectedClientId(client.id)}
                            data-testid={`row-client-${client.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-gray-900 truncate" data-testid={`text-name-${client.id}`}>
                                    {client.name}
                                  </p>
                                  <Badge
                                    style={{ backgroundColor: client.segmentColor }}
                                    className="text-white text-xs px-2 py-0"
                                    data-testid={`badge-segment-${client.id}`}
                                  >
                                    {client.behavioralSegment}
                                  </Badge>
                                </div>
                                {client.companyName && (
                                  <p className="text-xs text-gray-600 truncate">{client.companyName}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-4 ml-4">
                                <div className="text-right">
                                  <p className="text-xs text-gray-600">PRS</p>
                                  <p className="text-sm font-bold text-[#17B6C3]" data-testid={`text-prs-${client.id}`}>
                                    {client.prs}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-600">Confidence</p>
                                  <p className="text-sm font-bold text-blue-600" data-testid={`text-conf-${client.id}`}>
                                    {Math.round(client.confidenceScore * 100)}%
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-600">Interactions</p>
                                  <p className="text-sm font-bold text-gray-700">
                                    {client.totalInteractions || 0}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
