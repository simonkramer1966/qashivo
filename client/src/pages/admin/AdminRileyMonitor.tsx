import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminFilters } from "./AdminOpsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";

// --- Types ---

interface RileyStats {
  conversationsToday: number;
  totalConversations: number;
  factsExtracted: number;
  factsByCategory: Record<string, number>;
  topTopics: Array<{ topic: string | null; count: number }>;
}

interface ConversationListItem {
  id: string;
  tenantId: string;
  tenantName: string | null;
  userId: string;
  userName: string | null;
  topic: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ConversationDetail {
  conversation: {
    id: string;
    tenantName: string | null;
    userName: string | null;
    messages: Array<{ role: string; content: string; timestamp?: string }>;
    topic: string | null;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  extractedFacts: Array<{
    id: string;
    category: string;
    factKey: string | null;
    factValue: string | null;
    confidence: string | null;
  }>;
  llmLogs: Array<{
    id: string;
    caller: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costUsd: string;
    error: string | null;
    createdAt: string;
  }>;
}

interface FactListItem {
  id: string;
  tenantId: string;
  category: string;
  title: string;
  content: string;
  factKey: string | null;
  factValue: string | null;
  confidence: string | null;
  source: string | null;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  sourceConversationId: string | null;
  isActive: boolean | null;
  expiresAt: string | null;
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- Helpers ---

const TOPIC_BADGE: Record<string, string> = {
  debtor_intel: "bg-purple-100 text-purple-800",
  forecast_input: "bg-teal-100 text-teal-800",
  system_help: "bg-blue-100 text-blue-800",
  onboarding: "bg-green-100 text-green-800",
  weekly_review: "bg-amber-100 text-amber-800",
};

const CATEGORY_BADGE: Record<string, string> = {
  payment_behaviour: "bg-purple-100 text-purple-800",
  seasonal_pattern: "bg-teal-100 text-teal-800",
  debtor_relationship: "bg-blue-100 text-blue-800",
  business_context: "bg-amber-100 text-amber-800",
  contact_intel: "bg-green-100 text-green-800",
  cashflow_input: "bg-cyan-100 text-cyan-800",
  finance_preference: "bg-indigo-100 text-indigo-800",
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function confidenceColor(val: string | null): string {
  if (!val) return "text-muted-foreground";
  const n = parseFloat(val) * 100;
  if (n >= 80) return "text-green-700";
  if (n >= 50) return "text-amber-700";
  return "text-red-700";
}

// --- Component ---

export default function AdminRileyMonitor() {
  return (
    <Tabs defaultValue="conversations" className="space-y-6">
      <TabsList>
        <TabsTrigger value="conversations">Conversations</TabsTrigger>
        <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
      </TabsList>
      <TabsContent value="conversations">
        <ConversationsTab />
      </TabsContent>
      <TabsContent value="intelligence">
        <IntelligenceTab />
      </TabsContent>
    </Tabs>
  );
}

// --- Conversations tab ---

function ConversationsTab() {
  const { tenantId, from, to, refetchInterval } = useAdminFilters();
  const [page, setPage] = useState(1);
  const [topicFilter, setTopicFilter] = useState("__all__");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
    const timeout = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(timeout);
  }, []);

  const { data: stats } = useQuery<RileyStats>({
    queryKey: ["/api/admin/riley/stats", { tenantId, from, to }],
    refetchInterval,
  });

  const { data: listData, isLoading } = useQuery<PaginatedResponse<ConversationListItem>>({
    queryKey: [
      "/api/admin/riley/conversations",
      {
        page,
        limit: 20,
        tenantId,
        from,
        to,
        topic: topicFilter === "__all__" ? undefined : topicFilter,
        search: debouncedSearch || undefined,
      },
    ],
    refetchInterval,
  });

  const topTopic = stats?.topTopics?.[0]?.topic ?? "—";

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Today" value={stats?.conversationsToday ?? 0} />
        <StatCard label="Total Conversations" value={stats?.totalConversations ?? 0} />
        <StatCard label="Facts Extracted" value={stats?.factsExtracted ?? 0} />
        <StatCard label="Top Topic" value={topTopic} small />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={topicFilter} onValueChange={(v) => { setTopicFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-8 text-[13px]">
            <SelectValue placeholder="Topic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All topics</SelectItem>
            <SelectItem value="debtor_intel">Debtor Intel</SelectItem>
            <SelectItem value="forecast_input">Forecast Input</SelectItem>
            <SelectItem value="system_help">System Help</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
            <SelectItem value="weekly_review">Weekly Review</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-[200px] h-8 text-[13px]"
        />

        {listData && (
          <span className="text-[12px] text-muted-foreground ml-auto">
            {listData.total} conversation{listData.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Conversation list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {listData?.data.length === 0 && (
            <p className="text-[13px] text-muted-foreground text-center py-12">No conversations found</p>
          )}
          {listData?.data.map((conv) => (
            <ConversationCard
              key={conv.id}
              conv={conv}
              isExpanded={expandedId === conv.id}
              onToggle={() => setExpandedId(expandedId === conv.id ? null : conv.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {listData && listData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-[13px] text-muted-foreground">Page {page} of {listData.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= listData.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function ConversationCard({ conv, isExpanded, onToggle }: { conv: ConversationListItem; isExpanded: boolean; onToggle: () => void }) {
  const topicClass = TOPIC_BADGE[conv.topic ?? ""] ?? "bg-gray-100 text-gray-600";

  return (
    <Card className="overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            <span className="font-medium text-[14px]">{conv.userName || "Unknown user"}</span>
            {conv.topic && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${topicClass}`}>
                {conv.topic.replace(/_/g, " ")}
              </Badge>
            )}
            {conv.relatedEntityType && (
              <span className="text-[11px] text-muted-foreground">{conv.relatedEntityType}</span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-muted-foreground">{conv.messageCount} msg{conv.messageCount !== 1 ? "s" : ""}</span>
            <span className="text-[11px] text-muted-foreground">{relativeTime(conv.updatedAt)}</span>
          </div>
        </div>
      </div>
      {isExpanded && <ConversationDetailPanel conversationId={conv.id} />}
    </Card>
  );
}

function ConversationDetailPanel({ conversationId }: { conversationId: string }) {
  const { data, isLoading } = useQuery<ConversationDetail>({
    queryKey: [`/api/admin/riley/conversations/${conversationId}`],
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="px-4 pb-4 border-t"><Skeleton className="h-32 w-full mt-3" /></div>;
  if (!data?.conversation) return <div className="px-4 pb-4 border-t"><p className="text-[13px] text-muted-foreground py-4">Failed to load</p></div>;

  const { conversation, extractedFacts, llmLogs } = data;
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];

  return (
    <div className="border-t px-4 pb-4 space-y-4 pt-3">
      {/* Message thread */}
      <div>
        <p className="text-[12px] font-medium text-muted-foreground mb-2">Conversation</p>
        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div key={idx} className={`rounded-lg p-3 ${isUser ? "bg-muted" : "bg-blue-50"}`}>
                <p className="text-[10px] text-muted-foreground font-medium mb-1">
                  {isUser ? "User" : "Riley"}
                  {msg.timestamp && <span className="ml-2">{relativeTime(msg.timestamp)}</span>}
                </p>
                <p className="text-[13px] whitespace-pre-wrap">{msg.content}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Extracted facts */}
      {extractedFacts.length > 0 && (
        <div>
          <p className="text-[12px] font-medium text-muted-foreground mb-2">Extracted Intelligence</p>
          <div className="space-y-1">
            {extractedFacts.map((fact) => (
              <div key={fact.id} className="flex items-center gap-3 text-[12px]">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${CATEGORY_BADGE[fact.category] ?? "bg-gray-100 text-gray-600"}`}>
                  {fact.category.replace(/_/g, " ")}
                </Badge>
                <span className="text-muted-foreground">{fact.factKey}</span>
                <span className="truncate flex-1">{fact.factValue}</span>
                {fact.confidence && (
                  <span className={`shrink-0 ${confidenceColor(fact.confidence)}`}>
                    {Math.round(parseFloat(fact.confidence) * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LLM calls */}
      {llmLogs.length > 0 && (
        <div>
          <p className="text-[12px] font-medium text-muted-foreground mb-2">LLM Calls</p>
          <div className="space-y-1">
            {llmLogs.map((call) => (
              <p key={call.id} className="text-[11px] text-muted-foreground">
                {call.caller} &middot; {call.model} &middot; {call.inputTokens} in / {call.outputTokens} out
                &middot; {call.latencyMs}ms &middot; ${parseFloat(call.costUsd || "0").toFixed(4)}
                {call.error && <span className="text-red-600 ml-2">Error: {call.error}</span>}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Intelligence tab ---

function IntelligenceTab() {
  const { tenantId, from, to, refetchInterval } = useAdminFilters();
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [entityTypeFilter, setEntityTypeFilter] = useState("__all__");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
    const timeout = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(timeout);
  }, []);

  const { data: factsData, isLoading } = useQuery<PaginatedResponse<FactListItem>>({
    queryKey: [
      "/api/admin/riley/facts",
      {
        page,
        limit: 25,
        tenantId,
        from,
        to,
        category: categoryFilter === "__all__" ? undefined : categoryFilter,
        entityType: entityTypeFilter === "__all__" ? undefined : entityTypeFilter,
        search: debouncedSearch || undefined,
      },
    ],
    refetchInterval,
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] h-8 text-[13px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            <SelectItem value="payment_behaviour">Payment Behaviour</SelectItem>
            <SelectItem value="seasonal_pattern">Seasonal Pattern</SelectItem>
            <SelectItem value="debtor_relationship">Debtor Relationship</SelectItem>
            <SelectItem value="business_context">Business Context</SelectItem>
            <SelectItem value="contact_intel">Contact Intel</SelectItem>
            <SelectItem value="cashflow_input">Cashflow Input</SelectItem>
            <SelectItem value="finance_preference">Finance Preference</SelectItem>
          </SelectContent>
        </Select>

        <Select value={entityTypeFilter} onValueChange={(v) => { setEntityTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-8 text-[13px]">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All entities</SelectItem>
            <SelectItem value="debtor">Debtor</SelectItem>
            <SelectItem value="tenant">Tenant</SelectItem>
            <SelectItem value="invoice">Invoice</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search facts..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-[200px] h-8 text-[13px]"
        />

        {factsData && (
          <span className="text-[12px] text-muted-foreground ml-auto">
            {factsData.total} fact{factsData.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Facts list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {factsData?.data.length === 0 && (
              <p className="text-[13px] text-muted-foreground text-center py-12">No facts found</p>
            )}
            <div className="divide-y">
              {factsData?.data.map((fact) => (
                <div key={fact.id} className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${CATEGORY_BADGE[fact.category] ?? "bg-gray-100 text-gray-600"}`}>
                    {fact.category.replace(/_/g, " ")}
                  </Badge>
                  {(fact.entityType || fact.entityName) && (
                    <span className="text-muted-foreground shrink-0">
                      {fact.entityType}{fact.entityName ? `: ${fact.entityName}` : ""}
                    </span>
                  )}
                  <span className="font-medium shrink-0">{fact.factKey}</span>
                  <span className="truncate flex-1" title={fact.factValue ?? undefined}>
                    {fact.factValue ? (fact.factValue.length > 100 ? fact.factValue.slice(0, 100) + "..." : fact.factValue) : "—"}
                  </span>
                  {fact.confidence && (
                    <span className={`shrink-0 font-medium ${confidenceColor(fact.confidence)}`}>
                      {Math.round(parseFloat(fact.confidence) * 100)}%
                    </span>
                  )}
                  {fact.source && (
                    <span className="text-muted-foreground shrink-0">{fact.source.replace(/_/g, " ")}</span>
                  )}
                  <span className="text-muted-foreground shrink-0">{relativeTime(fact.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {factsData && factsData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-[13px] text-muted-foreground">Page {page} of {factsData.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= factsData.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// --- Shared ---

function StatCard({ label, value, small, className }: { label: string; value: string | number; small?: boolean; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className={`${small ? "text-[14px]" : "text-[22px]"} font-semibold mt-1 ${className ?? "text-foreground"} truncate`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
