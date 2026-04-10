import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarDays,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  PoundSterling,
} from "lucide-react";
import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";

interface KeyNumbers {
  optimistic: { expectedIn: number; pressurePoints: string[] };
  expected: { expectedIn: number; pressurePoints: string[] };
  pessimistic: { expectedIn: number; pressurePoints: string[] };
}

interface DebtorFocusItem {
  contactId: string;
  contactName: string;
  totalOwed: number;
  invoiceCount: number;
  risk: "low" | "medium" | "high";
  note: string;
}

interface WeeklyReviewData {
  id: string;
  tenantId: string;
  weekStartDate: string;
  weekEndDate: string;
  generatedAt: string;
  summaryText: string;
  keyNumbers: KeyNumbers | null;
  debtorFocus: DebtorFocusItem[] | null;
  forecastAdjustmentsUsed: unknown;
  previousReviewId: string | null;
  createdAt: string;
}

function formatCurrency(amount: number): string {
  return `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function riskColor(risk: string): string {
  switch (risk) {
    case "high": return "destructive";
    case "medium": return "secondary";
    default: return "outline";
  }
}

export default function WeeklyReview() {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [userInput, setUserInput] = useState("");

  const { data: review, isLoading, error } = useQuery<WeeklyReviewData>({
    queryKey: ["/api/weekly-review/latest"],
  });

  const { data: history } = useQuery<WeeklyReviewData[]>({
    queryKey: ["/api/weekly-review/history"],
    enabled: showHistory,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/weekly-review/generate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-review/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-review/history"] });
    },
  });

  // Must be above early returns to satisfy React's rules of hooks
  const cleanedSummary = useMemo(() => {
    if (!review?.summaryText) return "";
    return review.summaryText
      .replace(/^#+ .*(?:review|summary|collection).*\n*/i, "")
      .trim();
  }, [review?.summaryText]);

  if (isLoading) {
    return (
      <AppShell title="Qashflow" subtitle="Weekly review">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error && !review) {
    return (
      <AppShell title="Qashflow" subtitle="Weekly review">
        <div className="space-y-4">
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No weekly review available yet.</p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                "Generate Your First Review"
              )}
            </Button>
            {generateMutation.error && (
              <p className="text-destructive text-sm mt-2">
                {(generateMutation.error as Error).message}
              </p>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!review) return null;

  const keyNumbers = review.keyNumbers;
  const debtorFocus = review.debtorFocus || [];

  return (
    <AppShell title="Qashflow" subtitle="Weekly review">
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Week of {formatDate(review.weekStartDate)}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Prepared by Riley &middot; Generated {formatDate(review.generatedAt)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Regenerate
        </Button>
      </div>

      {generateMutation.error && (
        <p className="text-destructive text-sm">
          {(generateMutation.error as Error).message}
        </p>
      )}

      {/* ── Summary ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{cleanedSummary}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* ── Key Numbers (Three Scenarios) ──────────── */}
      {keyNumbers && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5 text-green-700 dark:text-green-400">
                <TrendingUp className="h-4 w-4" />
                Optimistic Collection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Inflows</span>
                <span className="font-semibold text-green-700 dark:text-green-400">
                  {formatCurrency(keyNumbers.optimistic?.expectedIn ?? 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                <PoundSterling className="h-4 w-4" />
                Expected Collection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Inflows</span>
                <span className="font-semibold text-blue-700 dark:text-blue-400">
                  {formatCurrency(keyNumbers.expected?.expectedIn ?? 0)}
                </span>
              </div>
              {(keyNumbers.expected?.pressurePoints ?? []).length > 0 && (
                <div className="mt-2 pt-2 border-t space-y-1">
                  {(keyNumbers.expected?.pressurePoints ?? []).map((p, i) => (
                    <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                      {p}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5 text-red-700 dark:text-red-400">
                <TrendingDown className="h-4 w-4" />
                Pessimistic Collection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Inflows</span>
                <span className="font-semibold text-red-700 dark:text-red-400">
                  {formatCurrency(keyNumbers.pessimistic?.expectedIn ?? 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Debtor Focus ───────────────────────────── */}
      {debtorFocus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Debtor Focus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {debtorFocus.map((d, i) => (
                <div
                  key={d.contactId || i}
                  className="flex items-start justify-between p-3 rounded-md border"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{d.contactName}</span>
                      <Badge variant={riskColor(d.risk) as any}>{d.risk}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.note}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-sm">{formatCurrency(d.totalOwed)}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.invoiceCount} invoice{d.invoiceCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── User Input ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anything changed since last week?</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Tell Riley about new contracts, expected payments, upcoming expenses, or any changes to your cashflow outlook..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Riley will process this into forecast adjustments for your next review.
          </p>
        </CardContent>
      </Card>

      {/* ── History ────────────────────────────────── */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className="mb-2"
        >
          {showHistory ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
          Previous Reviews
        </Button>

        {showHistory && history && (
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {history.map((r) => (
                <Card key={r.id} className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      Week of {formatDate(r.weekStartDate)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(r.generatedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {r.summaryText}
                  </p>
                </Card>
              ))}
              {history.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No previous reviews yet.
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
    </AppShell>
  );
}
