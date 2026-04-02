import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Check, X, Clock, Mail, MessageSquare, Phone, ArrowRight, Loader2,
} from "lucide-react";

interface PreviewData {
  actionType: string;
  subject: string;
  content: string;
  invoices: Array<{
    invoiceNumber: string;
    amount: string;
    dueDate: string;
    daysOverdue: number;
  }>;
  contactName: string;
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  contactId: string;
  riskBand: string;
  totalOutstanding: string;
  totalOverdue: string;
  invoiceCount: number;
  isAiGenerated: boolean;
  confidenceScore: string | null;
  priority: number | null;
  agentReasoning: string | null;
  createdAt: string;
}

interface ApprovalPreviewSheetProps {
  actionId: string | null;
  actionType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDefer: (id: string) => void;
  approvePending?: boolean;
  rejectPending?: boolean;
  deferPending?: boolean;
}

function ChannelBadge({ type }: { type: string }) {
  const t = type?.toLowerCase() || "email";
  if (t === "sms") return <Badge variant="secondary" className="gap-1"><MessageSquare className="h-3 w-3" />SMS</Badge>;
  if (t === "voice" || t === "call") return <Badge variant="secondary" className="gap-1"><Phone className="h-3 w-3" />Call</Badge>;
  return <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" />Email</Badge>;
}

function RiskBadge({ band }: { band: string }) {
  if (!band) return null;
  const colors: Record<string, string> = {
    A: "bg-green-100 text-green-800",
    B: "bg-lime-100 text-lime-800",
    C: "bg-yellow-100 text-yellow-800",
    D: "bg-orange-100 text-orange-800",
    E: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${colors[band] || "bg-slate-100 text-slate-700"}`}>
      Risk {band}
    </span>
  );
}

export function ApprovalPreviewSheet({
  actionId,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onDefer,
  approvePending,
  rejectPending,
  deferPending,
}: ApprovalPreviewSheetProps) {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<PreviewData>({
    queryKey: [`/api/actions/${actionId}/preview`],
    enabled: open && !!actionId,
  });

  const channel = data?.actionType?.toLowerCase() || "email";
  const isEmail = channel === "email";
  const isSms = channel === "sms";
  const isVoice = channel === "voice" || channel === "call";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col bg-white border-l border-slate-100"
      >
        {isLoading || !data ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-4">
                {/* Header */}
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 leading-tight">
                    {data.companyName || data.contactName}
                  </h2>
                  {data.companyName && data.contactName && (
                    <p className="text-[13px] text-slate-500 mt-0.5">
                      {data.contactName}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <ChannelBadge type={data.actionType} />
                    {data.confidenceScore && (
                      <Badge variant={parseFloat(data.confidenceScore) >= 0.8 ? "default" : "secondary"}>
                        {Math.round(parseFloat(data.confidenceScore) * 100)}% confidence
                      </Badge>
                    )}
                    {data.priority != null && (
                      <span className="text-xs text-muted-foreground font-mono">P{data.priority}</span>
                    )}
                    {data.createdAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(data.createdAt).toLocaleString("en-GB", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Debtor summary strip */}
                <div className="rounded-md bg-slate-50 px-3 py-2 text-[12px] text-slate-600 flex items-center gap-3 flex-wrap">
                  <span>Outstanding <strong>{data.totalOutstanding}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Overdue <strong>{data.totalOverdue}</strong></span>
                  {data.riskBand && (
                    <>
                      <span className="text-slate-300">|</span>
                      <RiskBadge band={data.riskBand} />
                    </>
                  )}
                  {data.contactId && (
                    <button
                      className="ml-auto text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/qollections/debtors/${data.contactId}`);
                      }}
                    >
                      View debtor <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <Separator />

                {/* Email content */}
                {isEmail && (
                  <div className="space-y-3">
                    {(data.contactEmail) && (
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">To</span>
                        <p className="text-[13px] text-slate-700 mt-0.5">
                          {data.contactName} {data.contactEmail && <span className="text-slate-400">&lt;{data.contactEmail}&gt;</span>}
                        </p>
                      </div>
                    )}
                    {data.subject && (
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Subject</span>
                        <p className="text-[13px] text-slate-900 font-medium mt-0.5">{data.subject}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Body</span>
                      <div
                        className="text-[13px] text-slate-700 mt-1 leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: data.content }}
                      />
                    </div>
                  </div>
                )}

                {/* SMS content */}
                {isSms && (
                  <div className="space-y-3">
                    {data.contactPhone && (
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">To</span>
                        <p className="text-[13px] text-slate-700 mt-0.5">{data.contactPhone}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Message</span>
                      <div className="mt-1 rounded-md bg-slate-50 p-3 text-[13px] text-slate-800 whitespace-pre-wrap">
                        {data.content}
                      </div>
                    </div>
                  </div>
                )}

                {/* Voice content */}
                {isVoice && (
                  <div className="space-y-3">
                    {(data.contactName || data.contactPhone) && (
                      <div>
                        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">To</span>
                        <p className="text-[13px] text-slate-700 mt-0.5">
                          {data.contactName}{data.contactPhone && ` (${data.contactPhone})`}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Script</span>
                      <div className="mt-1 rounded-md bg-slate-50 p-3 text-[13px] text-slate-800 whitespace-pre-wrap">
                        {data.content || "No script generated yet."}
                      </div>
                    </div>
                  </div>
                )}

                {/* Invoices covered */}
                {data.invoices.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                        Invoices ({data.invoiceCount})
                      </span>
                      <div className="mt-1.5 space-y-1">
                        {data.invoices.map((inv, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-[12px] text-slate-600 py-0.5"
                          >
                            <span className="font-mono">{inv.invoiceNumber}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400">{inv.daysOverdue}d overdue</span>
                              <span className="font-mono tabular-nums">{inv.amount}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Agent reasoning */}
                {data.agentReasoning && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">AI Reasoning</span>
                      <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{data.agentReasoning}</p>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Footer actions */}
            {actionId && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => onDefer(actionId)}
                  disabled={deferPending}
                >
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  Snooze
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onReject(actionId)}
                  disabled={rejectPending}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Reject
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onApprove(actionId)}
                  disabled={approvePending}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Approve
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
