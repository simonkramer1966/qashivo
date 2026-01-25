import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Info, Eye } from "lucide-react";
import { useState } from "react";

interface InvoiceSchemaMapping {
  invoiceId: string;
  invoiceNumber: string;
  contactId: string;
  amount: string;
  amountPaid: string;
  dueDate: string;
  legacy: {
    status: string | null;
    stage: string | null;
    workflowState: string | null;
    pauseState: string | null;
  };
  canonical: {
    invoiceStatus: string;
    balanceDue: number;
    dueDate: string;
    daysToDue: number;
    daysPastDue: number;
    collectionsCondition: string;
    ageBandCondition: string;
    inCollections: boolean;
    latestOutcome: {
      outcomeType: string | null;
      promiseToPayDate: string | null;
      confidence: number | null;
      updatedAt: string | null;
    } | null;
    conditionExplanation: string;
  };
  mapping: {
    legacyStatus: string | null;
    legacyStage: string | null;
    legacyWorkflowState: string | null;
    legacyPauseState: string | null;
    mappedInvoiceStatus: string;
    mappedCondition: string;
    conflicts: string[];
  };
}

interface SchemaMappingResponse {
  count: number;
  invoices: InvoiceSchemaMapping[];
}

function getConditionBadgeColor(condition: string): string {
  switch (condition) {
    case 'DUE':
      return 'bg-blue-100 text-blue-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'OVERDUE':
      return 'bg-orange-100 text-orange-800';
    case 'CRITICAL':
      return 'bg-red-100 text-red-800';
    case 'RECOVERY':
      return 'bg-red-200 text-red-900';
    case 'LEGAL':
      return 'bg-purple-100 text-purple-800';
    case 'DISPUTED':
      return 'bg-amber-100 text-amber-800';
    case 'PROMISED':
      return 'bg-teal-100 text-teal-800';
    case 'PLAN_REQUESTED':
      return 'bg-indigo-100 text-indigo-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'bg-blue-100 text-blue-800';
    case 'PAID':
      return 'bg-green-100 text-green-800';
    case 'VOID':
      return 'bg-slate-100 text-slate-800';
    case 'WRITTEN_OFF':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

function ExplainDrawer({ invoice }: { invoice: InvoiceSchemaMapping }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Invoice {invoice.invoiceNumber}</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Canonical State</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Invoice Status:</span>
                <Badge className={getStatusBadgeColor(invoice.canonical.invoiceStatus)}>
                  {invoice.canonical.invoiceStatus}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Collections Condition:</span>
                <Badge className={getConditionBadgeColor(invoice.canonical.collectionsCondition)}>
                  {invoice.canonical.collectionsCondition}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Age Band (before override):</span>
                <Badge variant="outline">
                  {invoice.canonical.ageBandCondition}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Balance Due:</span>
                <span className="text-sm font-medium">£{invoice.canonical.balanceDue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Days to Due:</span>
                <span className="text-sm font-medium">{invoice.canonical.daysToDue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Days Past Due:</span>
                <span className="text-sm font-medium">{invoice.canonical.daysPastDue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">In Collections:</span>
                <Badge className={invoice.canonical.inCollections ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}>
                  {invoice.canonical.inCollections ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Condition Explanation</h3>
            <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">{invoice.canonical.conditionExplanation}</p>
            </div>
          </div>

          {invoice.canonical.latestOutcome && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Latest Outcome</h3>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Type:</span>
                  <span className="text-sm font-medium">{invoice.canonical.latestOutcome.outcomeType || 'None'}</span>
                </div>
                {invoice.canonical.latestOutcome.promiseToPayDate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Promise Date:</span>
                    <span className="text-sm font-medium">
                      {new Date(invoice.canonical.latestOutcome.promiseToPayDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {invoice.canonical.latestOutcome.confidence && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Confidence:</span>
                    <span className="text-sm font-medium">
                      {(invoice.canonical.latestOutcome.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Legacy Fields</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">status:</span>
                <code className="text-xs bg-slate-200 px-2 py-0.5 rounded">
                  {invoice.legacy.status || 'null'}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">stage:</span>
                <code className="text-xs bg-slate-200 px-2 py-0.5 rounded">
                  {invoice.legacy.stage || 'null'}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">workflowState:</span>
                <code className="text-xs bg-slate-200 px-2 py-0.5 rounded">
                  {invoice.legacy.workflowState || 'null'}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">pauseState:</span>
                <code className="text-xs bg-slate-200 px-2 py-0.5 rounded">
                  {invoice.legacy.pauseState || 'null'}
                </code>
              </div>
            </div>
          </div>

          {invoice.mapping.conflicts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Conflicts Detected
              </h3>
              <div className="bg-amber-50 rounded-lg p-4 space-y-2">
                {invoice.mapping.conflicts.map((conflict, idx) => (
                  <p key={idx} className="text-sm text-amber-800">{conflict}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AdminSchema() {
  const { data, isLoading } = useQuery<SchemaMappingResponse>({
    queryKey: ['/api/admin/schema-mapping'],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const conflictCount = data?.invoices.filter(inv => inv.mapping.conflicts.length > 0).length || 0;

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <div className="hidden md:block">
        <NewSidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Schema" subtitle="Canonical Model Mapping" />
        
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Invoice Schema Mapping
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Developer panel showing legacy fields mapped to canonical invoice status model
                </p>
              </div>
              <div className="flex items-center gap-4">
                {conflictCount > 0 ? (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {conflictCount} conflicts
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    No conflicts
                  </Badge>
                )}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Canonical Status Model Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Invoice Status (Stored)</h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getStatusBadgeColor('OPEN')}>OPEN</Badge>
                      <Badge className={getStatusBadgeColor('PAID')}>PAID</Badge>
                      <Badge className={getStatusBadgeColor('VOID')}>VOID</Badge>
                      <Badge className={getStatusBadgeColor('WRITTEN_OFF')}>WRITTEN_OFF</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Stable truth - does not change with time</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Collections Condition (Computed)</h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getConditionBadgeColor('DUE')}>DUE</Badge>
                      <Badge className={getConditionBadgeColor('PENDING')}>PENDING</Badge>
                      <Badge className={getConditionBadgeColor('OVERDUE')}>OVERDUE</Badge>
                      <Badge className={getConditionBadgeColor('CRITICAL')}>CRITICAL</Badge>
                      <Badge className={getConditionBadgeColor('RECOVERY')}>RECOVERY</Badge>
                      <Badge className={getConditionBadgeColor('LEGAL')}>LEGAL</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge className={getConditionBadgeColor('DISPUTED')}>DISPUTED</Badge>
                      <Badge className={getConditionBadgeColor('PROMISED')}>PROMISED</Badge>
                      <Badge className={getConditionBadgeColor('PLAN_REQUESTED')}>PLAN_REQUESTED</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Derived from due_date + outcome overrides</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invoice Status Mapping ({data?.count || 0} invoices)</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Invoice #</TableHead>
                          <TableHead className="w-[100px]">Amount</TableHead>
                          <TableHead className="w-[100px]">Legacy Status</TableHead>
                          <TableHead className="w-[100px]">Invoice Status</TableHead>
                          <TableHead className="w-[120px]">Collections Condition</TableHead>
                          <TableHead className="w-[80px]">Days Past Due</TableHead>
                          <TableHead className="w-[60px]">Conflicts</TableHead>
                          <TableHead className="w-[60px]">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.invoices.map((invoice) => (
                          <TableRow key={invoice.invoiceId}>
                            <TableCell className="font-mono text-xs">
                              {invoice.invoiceNumber}
                            </TableCell>
                            <TableCell>
                              £{parseFloat(invoice.amount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                                {invoice.legacy.status || 'null'}
                              </code>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusBadgeColor(invoice.canonical.invoiceStatus)}>
                                {invoice.canonical.invoiceStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getConditionBadgeColor(invoice.canonical.collectionsCondition)}>
                                {invoice.canonical.collectionsCondition}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {invoice.canonical.daysPastDue > 0 ? (
                                <span className="text-red-600 font-medium">
                                  {invoice.canonical.daysPastDue}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {invoice.mapping.conflicts.length > 0 ? (
                                <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                              )}
                            </TableCell>
                            <TableCell>
                              <ExplainDrawer invoice={invoice} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
