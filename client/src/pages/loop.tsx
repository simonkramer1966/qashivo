import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import { useCurrency } from "@/hooks/useCurrency";
import { cn } from "@/lib/utils";
import { 
  Loader2,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  FileText,
  Send,
  Pause,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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

const STAGE_CONFIG: Record<LoopStage, { label: string; color: string }> = {
  PLANNED: { label: "Planned", color: "text-teal-600 dark:text-teal-400" },
  IN_FLIGHT: { label: "In Flight", color: "text-amber-600 dark:text-amber-400" },
  ATTENTION: { label: "Attention", color: "text-red-600 dark:text-red-400" },
  CLOSED: { label: "Closed", color: "text-emerald-600 dark:text-emerald-400" },
};

const IN_FLIGHT_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  SENT: "Sent",
  AWAITING_REPLY: "Awaiting",
  COOLDOWN: "Cooldown",
  ESCALATION_DUE: "Escalation",
  DELIVERY_FAILED: "Failed",
};

const ATTENTION_LABELS: Record<string, string> = {
  DISPUTE: "Dispute",
  PAYMENT_PLAN_REQUEST: "Plan Req",
  REQUEST_MORE_TIME: "More Time",
  LOW_CONFIDENCE_OUTCOME: "Review",
  SYNC_MISMATCH: "Sync",
  DATA_QUALITY: "Data",
  PTP_BREACH: "PTP Breach",
  FIRST_CONTACT_HIGH_VALUE: "High Value",
  VIP_CUSTOMER: "VIP",
  MANUAL_REVIEW: "Review",
  NEEDS_ALLOCATION: "Allocate",
  DELIVERY_FAILED: "Failed",
};

function DebtorPackRow({ 
  pack, 
  isSelected,
  isActive,
  onSelect,
  onClick 
}: { 
  pack: DebtorPackRow;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (packId: string, selected: boolean) => void;
  onClick: () => void;
}) {
  const { formatCurrency } = useCurrency();
  const stageConfig = STAGE_CONFIG[pack.stage];
  
  const substateLabel = pack.stage === 'IN_FLIGHT' && pack.inFlightState
    ? IN_FLIGHT_LABELS[pack.inFlightState] || pack.inFlightState
    : pack.stage === 'ATTENTION' && pack.attentionType
      ? ATTENTION_LABELS[pack.attentionType] || pack.attentionType
      : null;

  const overdueColor = pack.oldestDaysOverdue > 30 
    ? "text-red-600 dark:text-red-400" 
    : pack.oldestDaysOverdue > 14 
      ? "text-amber-600 dark:text-amber-400" 
      : "text-gray-500 dark:text-gray-400";

  return (
    <div 
      className={cn(
        "px-3 py-2 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors",
        isActive && "bg-gray-50 dark:bg-gray-900"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {pack.isBatchSelectable && (
          <Checkbox 
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(pack.packId, !!checked)}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5"
          />
        )}
        
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
            {pack.contactName}
          </span>
          <span className={cn("text-xs font-medium", stageConfig.color)}>
            {stageConfig.label}
          </span>
          {substateLabel && (
            <span className="text-xs text-gray-400">
              {substateLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs tabular-nums">
          <span className="text-gray-500 dark:text-gray-400">
            {pack.invoiceCount}
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100 w-20 text-right">
            {formatCurrency(pack.totalDue)}
          </span>
          {pack.oldestDaysOverdue > 0 && (
            <span className={cn("w-12 text-right", overdueColor)}>
              {pack.oldestDaysOverdue}d
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PackBuilder({ selectedPack }: { selectedPack: DebtorPackRow | null }) {
  const { formatCurrency } = useCurrency();

  if (!selectedPack) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-gray-400">Select a debtor</p>
      </div>
    );
  }

  const stageConfig = STAGE_CONFIG[selectedPack.stage];
  const overdueColor = selectedPack.oldestDaysOverdue > 30 
    ? "text-red-600" 
    : selectedPack.oldestDaysOverdue > 14 
      ? "text-amber-600" 
      : "";

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-baseline gap-2 mb-1">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {selectedPack.contactName}
          </h2>
          <span className={cn("text-xs font-medium", stageConfig.color)}>
            {stageConfig.label}
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(selectedPack.totalDue)}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Invoices </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {selectedPack.invoiceCount}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Oldest </span>
            <span className={cn("font-semibold", overdueColor || "text-gray-900 dark:text-gray-100")}>
              {selectedPack.oldestDaysOverdue}d
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3">
        <div className="mb-4">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Invoices
          </h3>
          <p className="text-xs text-gray-400">Invoice list loads here...</p>
        </div>

        <div>
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Recommended
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-teal-600" />
            <span className="text-gray-900 dark:text-gray-100">Email Reminder</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            Standard reminder for overdue invoices
          </p>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
        {selectedPack.stage === 'PLANNED' && (
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 text-xs">
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Approve
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              Schedule
            </Button>
          </div>
        )}
        {selectedPack.stage === 'IN_FLIGHT' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">
              <Pause className="w-3.5 h-3.5 mr-1.5" />
              Pause
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Phone className="w-3.5 h-3.5 mr-1.5" />
              Call
            </Button>
          </div>
        )}
        {selectedPack.stage === 'ATTENTION' && (
          <Button variant="destructive" size="sm" className="w-full h-8 text-xs">
            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
            Resolve
          </Button>
        )}
      </div>
    </div>
  );
}

function Timeline({ selectedPack }: { selectedPack: DebtorPackRow | null }) {
  if (!selectedPack) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-gray-400">Select a debtor</p>
      </div>
    );
  }

  const events = [
    { type: 'email', label: 'Email sent', detail: 'Reminder for INV-001', time: '2d ago', color: 'text-teal-600' },
    { type: 'reply', label: 'Reply received', detail: '"Will pay by month end"', time: '1d ago', color: 'text-emerald-600' },
    { type: 'ptp', label: 'PTP recorded', detail: 'Expected: Jan 31', time: '1d ago', color: 'text-amber-600' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Timeline</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{selectedPack.contactName}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-3">
          <div className="space-y-3">
            {events.map((event, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-1 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0 relative">
                  <div className={cn("absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-current", event.color)} />
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.label}</span>
                    <span className="text-xs text-gray-400">{event.time}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{event.detail}</p>
                </div>
              </div>
            ))}
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

  const stageFilters = ['ALL', 'PLANNED', 'IN_FLIGHT', 'ATTENTION'] as const;

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      <NewSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Debtor Queue */}
          <div className="flex-1 border-r border-gray-100 dark:border-gray-800 flex flex-col">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Loop</h1>
                <span className="text-xs text-gray-400 tabular-nums">
                  {data?.summary?.total || 0}
                </span>
              </div>
              
              <div className="flex gap-0.5">
                {stageFilters.map(stage => {
                  const count = stage === 'ALL' 
                    ? data?.summary?.total 
                    : data?.summary?.byStage?.[stage];
                  return (
                    <button
                      key={stage}
                      onClick={() => setActiveStageFilter(stage)}
                      className={cn(
                        "px-2 py-1 text-xs transition-colors rounded",
                        activeStageFilter === stage 
                          ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 font-medium" 
                          : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                      )}
                    >
                      {stage === 'ALL' ? 'All' : STAGE_CONFIG[stage].label}
                      {count !== undefined && count > 0 && (
                        <span className="ml-1 opacity-60">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPackIds.size > 0 && (
              <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {selectedPackIds.size} selected
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2">
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 text-xs px-2"
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
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}

              {error && (
                <div className="px-3 py-4 text-center text-xs text-red-600 dark:text-red-400">
                  Failed to load
                </div>
              )}

              {!isLoading && !error && filteredPacks.length === 0 && (
                <div className="px-3 py-8 text-center text-xs text-gray-400">
                  No debtors
                </div>
              )}

              {filteredPacks.map(pack => (
                <DebtorPackRow
                  key={pack.packId}
                  pack={pack}
                  isSelected={selectedPackIds.has(pack.packId)}
                  isActive={selectedPackId === pack.packId}
                  onSelect={handlePackSelect}
                  onClick={() => setSelectedPackId(pack.packId)}
                />
              ))}
            </ScrollArea>
          </div>

          {/* Middle Pane: Pack Builder */}
          <div className="flex-1 border-r border-gray-100 dark:border-gray-800">
            <PackBuilder selectedPack={selectedPack} />
          </div>

          {/* Right Pane: Timeline */}
          <div className="flex-1">
            <Timeline selectedPack={selectedPack} />
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
