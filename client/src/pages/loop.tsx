import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import { useCurrency } from "@/hooks/useCurrency";
import { cn } from "@/lib/utils";
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  FileText,
  User,
  Send,
  Pause,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { DebtorPackRow, LoopStage } from "@shared/schema";

interface DebtorPacksResponse {
  debtorPacks: DebtorPackRow[];
  summary: {
    total: number;
    byStage: {
      PLANNED: number;
      IN_FLIGHT: number;
      ATTENTION: number;
    };
  };
}

const STAGE_CONFIG: Record<LoopStage, { label: string; color: string; icon: any; bgColor: string }> = {
  PLANNED: { 
    label: "Planned", 
    color: "text-blue-600", 
    icon: Clock, 
    bgColor: "bg-blue-50 dark:bg-blue-950/30" 
  },
  IN_FLIGHT: { 
    label: "In Flight", 
    color: "text-amber-600", 
    icon: Send, 
    bgColor: "bg-amber-50 dark:bg-amber-950/30" 
  },
  ATTENTION: { 
    label: "Attention", 
    color: "text-red-600", 
    icon: AlertTriangle, 
    bgColor: "bg-red-50 dark:bg-red-950/30" 
  },
  CLOSED: { 
    label: "Closed", 
    color: "text-green-600", 
    icon: CheckCircle2, 
    bgColor: "bg-green-50 dark:bg-green-950/30" 
  },
};

const IN_FLIGHT_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  SENT: "Sent",
  AWAITING_REPLY: "Awaiting Reply",
  COOLDOWN: "Cooldown",
  ESCALATION_DUE: "Escalation Due",
  DELIVERY_FAILED: "Delivery Failed",
};

const ATTENTION_LABELS: Record<string, string> = {
  DISPUTE: "Dispute",
  PAYMENT_PLAN_REQUEST: "Payment Plan Request",
  REQUEST_MORE_TIME: "More Time Requested",
  LOW_CONFIDENCE_OUTCOME: "Review Required",
  SYNC_MISMATCH: "Sync Issue",
  DATA_QUALITY: "Data Issue",
  PTP_BREACH: "PTP Breach",
  FIRST_CONTACT_HIGH_VALUE: "High Value First Contact",
  VIP_CUSTOMER: "VIP Customer",
  MANUAL_REVIEW: "Manual Review",
  NEEDS_ALLOCATION: "Needs Allocation",
  DELIVERY_FAILED: "Delivery Failed",
};

function StageChip({ stage }: { stage: LoopStage }) {
  const config = STAGE_CONFIG[stage];
  const Icon = config.icon;
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
      config.bgColor,
      config.color
    )}>
      <Icon className="w-3 h-3" />
      {config.label}
    </div>
  );
}

function SubstateBadge({ pack }: { pack: DebtorPackRow }) {
  if (pack.stage === 'IN_FLIGHT' && pack.inFlightState) {
    return (
      <Badge variant="outline" className="text-xs">
        {IN_FLIGHT_LABELS[pack.inFlightState] || pack.inFlightState}
      </Badge>
    );
  }
  if (pack.stage === 'ATTENTION' && pack.attentionType) {
    return (
      <Badge variant="destructive" className="text-xs">
        {ATTENTION_LABELS[pack.attentionType] || pack.attentionType}
      </Badge>
    );
  }
  return null;
}

function DebtorPackCard({ 
  pack, 
  isSelected,
  onSelect,
  onClick 
}: { 
  pack: DebtorPackRow;
  isSelected: boolean;
  onSelect: (packId: string, selected: boolean) => void;
  onClick: () => void;
}) {
  const { formatCurrency } = useCurrency();
  
  return (
    <div 
      className={cn(
        "p-3 border-b cursor-pointer transition-colors",
        isSelected ? "bg-blue-50 dark:bg-blue-950/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {pack.isBatchSelectable && (
          <Checkbox 
            checked={isSelected}
            onCheckedChange={(checked) => {
              onSelect(pack.packId, !!checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
          />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{pack.contactName}</span>
            <StageChip stage={pack.stage} />
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
            <span>{pack.invoiceCount} invoice{pack.invoiceCount !== 1 ? 's' : ''}</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {formatCurrency(pack.totalDue)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {pack.oldestDaysOverdue > 0 && (
              <span className={cn(
                "text-xs",
                pack.oldestDaysOverdue > 30 ? "text-red-600" : 
                pack.oldestDaysOverdue > 14 ? "text-amber-600" : "text-gray-500"
              )}>
                {pack.oldestDaysOverdue}d overdue
              </span>
            )}
            <SubstateBadge pack={pack} />
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}

function PackBuilder({ selectedPack }: { selectedPack: DebtorPackRow | null }) {
  const { formatCurrency } = useCurrency();

  if (!selectedPack) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a debtor to view pack details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <User className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <h2 className="font-semibold">{selectedPack.contactName}</h2>
            <div className="flex items-center gap-2">
              <StageChip stage={selectedPack.stage} />
              <SubstateBadge pack={selectedPack} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 text-center">
          <div>
            <div className="text-2xl font-semibold">{formatCurrency(selectedPack.totalDue)}</div>
            <div className="text-xs text-gray-500">Total Due</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{selectedPack.invoiceCount}</div>
            <div className="text-xs text-gray-500">Invoices</div>
          </div>
          <div>
            <div className={cn(
              "text-2xl font-semibold",
              selectedPack.oldestDaysOverdue > 30 ? "text-red-600" : 
              selectedPack.oldestDaysOverdue > 14 ? "text-amber-600" : ""
            )}>
              {selectedPack.oldestDaysOverdue}d
            </div>
            <div className="text-xs text-gray-500">Oldest Overdue</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <h3 className="font-medium text-sm mb-3">Included Invoices</h3>
        <div className="space-y-2">
          <div className="p-3 border rounded-lg text-sm text-gray-500 text-center">
            Invoice list will load here...
          </div>
        </div>

        <Separator className="my-4" />

        <h3 className="font-medium text-sm mb-3">Recommended Action</h3>
        <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
            <Mail className="w-4 h-4" />
            <span className="font-medium text-sm">Email Reminder</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Standard reminder email for overdue invoices
          </p>
        </div>
      </div>

      <div className="p-4 border-t bg-gray-50 dark:bg-gray-900">
        {selectedPack.stage === 'PLANNED' && (
          <div className="flex gap-2">
            <Button className="flex-1" size="sm">
              <Send className="w-4 h-4 mr-2" />
              Approve & Send
            </Button>
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule
            </Button>
          </div>
        )}
        {selectedPack.stage === 'IN_FLIGHT' && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" size="sm">
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
            <Button variant="outline" size="sm">
              <Phone className="w-4 h-4 mr-2" />
              Call
            </Button>
          </div>
        )}
        {selectedPack.stage === 'ATTENTION' && (
          <div className="flex gap-2">
            <Button variant="destructive" className="flex-1" size="sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              Resolve
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Timeline({ selectedPack }: { selectedPack: DebtorPackRow | null }) {
  if (!selectedPack) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a debtor to view timeline</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Activity Timeline</h3>
        <p className="text-xs text-gray-500">{selectedPack.contactName}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">Email sent</span>
                  <span className="text-xs text-gray-400">2 days ago</span>
                </div>
                <p className="text-xs text-gray-500">Reminder email for invoice INV-001</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">Reply received</span>
                  <span className="text-xs text-gray-400">1 day ago</span>
                </div>
                <p className="text-xs text-gray-500">"We'll pay by end of month"</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">PTP recorded</span>
                  <span className="text-xs text-gray-400">1 day ago</span>
                </div>
                <p className="text-xs text-gray-500">Expected payment: Jan 31, 2026</p>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Loop() {
  const [activeStageFilter, setActiveStageFilter] = useState<LoopStage | 'ALL'>('ALL');
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<DebtorPacksResponse>({
    queryKey: ['/api/debtor-packs'],
    refetchInterval: 30000,
  });

  const filteredPacks = useMemo(() => {
    if (!data?.debtorPacks) return [];
    if (activeStageFilter === 'ALL') return data.debtorPacks;
    return data.debtorPacks.filter(p => p.stage === activeStageFilter);
  }, [data?.debtorPacks, activeStageFilter]);

  const selectedPack = useMemo(() => {
    if (!selectedPackId || !data?.debtorPacks) return null;
    return data.debtorPacks.find(p => p.packId === selectedPackId) || null;
  }, [selectedPackId, data?.debtorPacks]);

  const handlePackSelect = (packId: string, selected: boolean) => {
    setSelectedPackIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(packId);
      } else {
        next.delete(packId);
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      <NewSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Debtor Queue */}
          <div className="w-80 border-r flex flex-col">
            <div className="p-3 border-b">
              <h1 className="font-semibold mb-3">Loop</h1>
              
              {/* Stage filter tabs */}
              <div className="flex gap-1">
                {(['ALL', 'PLANNED', 'IN_FLIGHT', 'ATTENTION'] as const).map(stage => (
                  <button
                    key={stage}
                    onClick={() => setActiveStageFilter(stage)}
                    className={cn(
                      "px-2 py-1 text-xs rounded transition-colors",
                      activeStageFilter === stage 
                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" 
                        : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    {stage === 'ALL' ? 'All' : STAGE_CONFIG[stage].label}
                    {stage !== 'ALL' && data?.summary?.byStage && (
                      <span className="ml-1 opacity-60">
                        ({data.summary.byStage[stage] || 0})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Batch actions bar */}
            {selectedPackIds.size > 0 && (
              <div className="p-2 border-b bg-blue-50 dark:bg-blue-950/30 flex items-center justify-between">
                <span className="text-xs text-blue-700 dark:text-blue-300">
                  {selectedPackIds.size} selected
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    Approve All
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 text-xs"
                    onClick={() => setSelectedPackIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              )}

              {error && (
                <div className="p-4 text-center text-red-500 text-sm">
                  Failed to load debtor packs
                </div>
              )}

              {!isLoading && !error && filteredPacks.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm">
                  No debtors in this queue
                </div>
              )}

              {filteredPacks.map(pack => (
                <DebtorPackCard
                  key={pack.packId}
                  pack={pack}
                  isSelected={selectedPackIds.has(pack.packId)}
                  onSelect={handlePackSelect}
                  onClick={() => setSelectedPackId(pack.packId)}
                />
              ))}
            </ScrollArea>
          </div>

          {/* Middle Pane: Pack Builder */}
          <div className="flex-1 border-r">
            <PackBuilder selectedPack={selectedPack} />
          </div>

          {/* Right Pane: Timeline */}
          <div className="w-80">
            <Timeline selectedPack={selectedPack} />
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}