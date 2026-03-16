import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, TrendingDown, CheckCircle2, Eye } from "lucide-react";
import { formatRelativeTime } from "./utils";

interface ExceptionAction {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  actionSummary: string | null;
  exceptionReason: string | null;
  agentReasoning: string | null;
  createdAt: string;
}

interface RejectionPattern {
  id: string;
  category: string;
  actionType: string | null;
  occurrences: number | null;
  lastOccurredAt: string | null;
  suggestedAdjustment: string | null;
  status: string | null;
}

export default function ExceptionsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{
    exceptionActions: ExceptionAction[];
    rejectionPatterns: RejectionPattern[];
    totalExceptions: number;
    totalPatterns: number;
  }>({
    queryKey: ["/api/action-centre/exceptions"],
    refetchInterval: 30_000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (patternId: string) =>
      apiRequest("POST", `/api/rejection-patterns/${patternId}/acknowledge`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/exceptions"] });
      toast({ title: "Pattern acknowledged" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const exceptions = data?.exceptionActions ?? [];
  const patterns = data?.rejectionPatterns ?? [];
  const isEmpty = exceptions.length === 0 && patterns.length === 0;

  if (isEmpty) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
          <h3 className="text-lg font-semibold">No exceptions</h3>
          <p className="text-sm text-muted-foreground">All actions are running smoothly.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rejection Patterns */}
      {patterns.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-amber-600" />
              Rejection Patterns ({patterns.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Suggestion</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patterns.map((pattern) => (
                  <TableRow key={pattern.id}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {pattern.category.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">
                      {pattern.actionType || "all"}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-bold text-amber-600">
                        {pattern.occurrences}x
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {pattern.suggestedAdjustment}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeMutation.mutate(pattern.id)}
                        disabled={acknowledgeMutation.isPending}
                      >
                        Acknowledge
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Exception Actions */}
      {exceptions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Exception Actions ({exceptions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Exception Reason</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {action.actionSummary || action.subject || `${action.type} action`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-xs">
                        {action.exceptionReason?.replace(/_/g, " ") || "flagged"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(action.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
