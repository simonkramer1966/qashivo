import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, 
  Phone, 
  MessageSquare, 
  Mic, 
  StickyNote,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Plus,
  ChevronDown,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TimelineItem, TimelineResponse, TimelineFilters, TimelineChannel, TimelineDirection } from "@shared/types/timeline";

interface TimelineProps {
  customerId: string;
  invoiceId?: string;
  compact?: boolean;
  initialData?: TimelineResponse;
}

const channelIcons: Partial<Record<TimelineChannel, typeof Mail>> = {
  email: Mail,
  sms: MessageSquare,
  voice: Mic,
  note: StickyNote
};

const channelColors: Partial<Record<TimelineChannel, string>> = {
  email: "text-blue-500",
  sms: "text-green-500",
  voice: "text-purple-500",
  note: "text-amber-500"
};

const channelLabels: Partial<Record<TimelineChannel, string>> = {
  email: "Email",
  sms: "SMS",
  voice: "Voice",
  note: "Note"
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  sent: CheckCircle2,
  delivered: CheckCircle2,
  received: CheckCircle2,
  transcribed: CheckCircle2
};

const confidenceLabels: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence", 
  low: "Needs review"
};

function getConfidenceLabel(score: number): string {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

export function Timeline({ customerId, invoiceId, compact = false, initialData }: TimelineProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<TimelineFilters>({});
  const [accumulatedItems, setAccumulatedItems] = useState<TimelineItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TimelineItem | null>(null);
  const [showItemDrawer, setShowItemDrawer] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);

  const buildQueryParams = useCallback(() => {
    const params: Record<string, any> = {};
    if (invoiceId) params.invoiceId = invoiceId;
    if (filters.channel?.length) params.channel = filters.channel.join(",");
    if (filters.direction?.length) params.direction = filters.direction.join(",");
    if (filters.outcomesOnly) params.outcomesOnly = "true";
    if (filters.needsReviewOnly) params.needsReviewOnly = "true";
    return params;
  }, [invoiceId, filters]);

  const baseQueryKey = [`/api/contacts/${customerId}/timeline`, buildQueryParams()];

  // Skip the query if we have initialData and no filters have been applied
  const shouldSkipQuery = !!initialData && !hasAppliedFilters && !invoiceId;

  const { data, isLoading } = useQuery<TimelineResponse>({
    queryKey: baseQueryKey,
    enabled: !!customerId && !shouldSkipQuery,
  });

  // Use initialData on first load, then switch to query data when filters change
  const effectiveData = shouldSkipQuery ? initialData : data;

  useEffect(() => {
    if (effectiveData) {
      setAccumulatedItems(effectiveData.items);
      setNextCursor(effectiveData.nextCursor);
      setHasMore(effectiveData.hasMore);
    }
  }, [effectiveData]);

  // Track when filters are applied so we know to use the query
  useEffect(() => {
    const hasFilters = !!(filters.channel?.length || filters.direction?.length || filters.outcomesOnly || filters.needsReviewOnly);
    if (hasFilters) {
      setHasAppliedFilters(true);
    }
  }, [filters]);

  useEffect(() => {
    setAccumulatedItems([]);
    setNextCursor(undefined);
    setHasMore(false);
  }, [customerId, invoiceId, filters]);

  const createNoteMutation = useMutation({
    mutationFn: (body: string) => 
      apiRequest("POST", `/api/contacts/${customerId}/timeline/notes`, { body, invoiceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${customerId}/timeline`] });
      setNoteText("");
      setShowNoteInput(false);
      toast({ title: "Note added" });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    }
  });

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const params = buildQueryParams();
      params.cursor = nextCursor;
      
      const queryString = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString();
      
      const response = await fetch(`/api/contacts/${customerId}/timeline?${queryString}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const nextPage: TimelineResponse = await response.json();
        setAccumulatedItems(prev => [...prev, ...nextPage.items]);
        setNextCursor(nextPage.nextCursor);
        setHasMore(nextPage.hasMore);
      }
    } catch (error) {
      toast({ title: "Failed to load more", variant: "destructive" });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleItemClick = (item: TimelineItem) => {
    setSelectedItem(item);
    setShowItemDrawer(true);
  };

  const handleFilterChange = (newFilters: Partial<TimelineFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = 
    (filters.channel?.length || 0) > 0 || 
    (filters.direction?.length || 0) > 0 || 
    filters.outcomesOnly || 
    filters.needsReviewOnly;

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { 
      weekday: "short",
      day: "numeric", 
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with Filter + Add Note */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TimelineFilterPopover 
            filters={filters} 
            onChange={handleFilterChange}
            hasActiveFilters={!!hasActiveFilters}
          />
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-muted-foreground"
            >
              Clear
            </Button>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNoteInput(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add note
        </Button>
      </div>

      {/* Note Input */}
      {showNoteInput && (
        <div className="space-y-2 p-3 bg-muted rounded-lg border border-border/50">
          <Textarea
            placeholder="Add a note about this customer..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="min-h-[80px] text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNoteInput(false);
                setNoteText("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createNoteMutation.mutate(noteText)}
              disabled={!noteText.trim() || createNoteMutation.isPending}
            >
              {createNoteMutation.isPending && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Timeline Items */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : accumulatedItems.length > 0 ? (
        <div className="space-y-0">
          {accumulatedItems.map((item, idx) => (
            <TimelineItemRow
              key={item.id}
              item={item}
              compact={compact}
              onClick={() => handleItemClick(item)}
              isLast={idx === accumulatedItems.length - 1 && !hasMore}
            />
          ))}
          
          {hasMore && (
            <div className="pt-4 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="text-muted-foreground"
              >
                {isLoadingMore ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-1" />
                )}
                Load more
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No activity yet
        </div>
      )}

      {/* Item Detail Drawer */}
      <Sheet open={showItemDrawer} onOpenChange={setShowItemDrawer}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-border/50">
            <SheetTitle className="text-base font-medium text-foreground">
              {selectedItem ? channelLabels[selectedItem.channel] : "Activity Detail"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Full details of this communication
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="flex-1">
            {selectedItem && (
              <div className="p-6 space-y-6">
                {/* Meta */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {selectedItem.direction === "outbound" && (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                    {selectedItem.direction === "inbound" && (
                      <ArrowDownLeft className="h-4 w-4" />
                    )}
                    <span className="capitalize">{selectedItem.direction}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {formatFullDate(selectedItem.occurredAt)}
                  </span>
                </div>

                {/* Subject */}
                {selectedItem.subject && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Subject</p>
                    <p className="text-sm text-foreground">{selectedItem.subject}</p>
                  </div>
                )}

                {/* Body */}
                {selectedItem.body && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Content</p>
                    <div className="text-sm text-foreground whitespace-pre-wrap bg-muted p-3 rounded-lg">
                      {selectedItem.body}
                    </div>
                  </div>
                )}

                {/* Participants */}
                {selectedItem.participants && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Participants</p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {selectedItem.participants.from && (
                        <p>From: {selectedItem.participants.from}</p>
                      )}
                      {selectedItem.participants.to && (
                        <p>To: {selectedItem.participants.to.join(", ")}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Outcome */}
                {selectedItem.outcome && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Detected Outcome</p>
                    <div className="bg-muted p-3 rounded-lg space-y-2">
                      <p className="text-sm font-medium text-foreground capitalize">
                        {selectedItem.outcome.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {confidenceLabels[getConfidenceLabel(selectedItem.outcome.confidence)]}
                      </p>
                      {selectedItem.outcome.extracted && Object.keys(selectedItem.outcome.extracted).length > 0 && (
                        <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                          {Object.entries(selectedItem.outcome.extracted).map(([key, value]) => (
                            <p key={key}>
                              <span className="font-medium">{key}:</span> {String(value)}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Status */}
                {selectedItem.status && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                    <div className="flex items-center gap-1.5">
                      {statusIcons[selectedItem.status] && (
                        (() => {
                          const StatusIcon = statusIcons[selectedItem.status!];
                          const iconColor = "text-green-500";
                          return <StatusIcon className={`h-4 w-4 ${iconColor}`} />;
                        })()
                      )}
                      <span className="text-sm text-foreground capitalize">{selectedItem.status}</span>
                    </div>
                  </div>
                )}

                {/* Created By */}
                {selectedItem.createdBy && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Created By</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedItem.createdBy.name || (selectedItem.createdBy.type === "system" ? "Qashivo AI" : "Unknown")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface TimelineItemRowProps {
  item: TimelineItem;
  compact?: boolean;
  onClick: () => void;
  isLast: boolean;
}

function TimelineItemRow({ item, compact, onClick, isLast }: TimelineItemRowProps) {
  const ChannelIcon = channelIcons[item.channel] || Mail;
  const channelColor = channelColors[item.channel] || "text-muted-foreground";
  
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <div 
      className={`py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
        !isLast ? 'border-b border-border/50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          <ChannelIcon className={`h-4 w-4 ${channelColor}`} />
          {item.direction === "outbound" && (
            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
          )}
          {item.direction === "inbound" && (
            <ArrowDownLeft className="h-3 w-3 text-muted-foreground" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-foreground ${compact ? 'line-clamp-1' : 'line-clamp-2'} text-sm`}>
            {item.summary}
          </p>
          
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground">
              {formatTimeAgo(item.occurredAt)}
            </span>
            
            {item.outcome && (
              <span className={`text-xs ${
                getConfidenceLabel(item.outcome.confidence) === "low" 
                  ? "text-amber-600" 
                  : "text-muted-foreground"
              }`}>
                {item.outcome.type.replace(/_/g, " ")}
              </span>
            )}
            
            {item.status && item.status !== "sent" && item.status !== "delivered" && (
              <span className="text-xs text-muted-foreground">
                {item.status}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimelineFilterPopoverProps {
  filters: TimelineFilters;
  onChange: (filters: Partial<TimelineFilters>) => void;
  hasActiveFilters: boolean;
}

function TimelineFilterPopover({ filters, onChange, hasActiveFilters }: TimelineFilterPopoverProps) {
  const channels: TimelineChannel[] = ["email", "sms", "voice", "note"];
  const directions: TimelineDirection[] = ["outbound", "inbound", "internal"];

  const toggleChannel = (channel: TimelineChannel) => {
    const current = filters.channel || [];
    const updated = current.includes(channel)
      ? current.filter(c => c !== channel)
      : [...current, channel];
    onChange({ channel: updated.length > 0 ? updated : undefined });
  };

  const toggleDirection = (direction: TimelineDirection) => {
    const current = filters.direction || [];
    const updated = current.includes(direction)
      ? current.filter(d => d !== direction)
      : [...current, direction];
    onChange({ direction: updated.length > 0 ? updated : undefined });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`text-muted-foreground ${hasActiveFilters ? 'bg-muted' : ''}`}
        >
          <Filter className="h-4 w-4 mr-1" />
          Filter
          {hasActiveFilters && (
            <span className="ml-1 text-xs bg-[#17B6C3] text-white rounded-full px-1.5">
              {(filters.channel?.length || 0) + (filters.direction?.length || 0) + (filters.outcomesOnly ? 1 : 0) + (filters.needsReviewOnly ? 1 : 0)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" align="start">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Channel</p>
            <div className="space-y-2">
              {channels.map(channel => (
                <label key={channel} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={filters.channel?.includes(channel) || false}
                    onCheckedChange={() => toggleChannel(channel)}
                  />
                  <span className="text-sm text-foreground capitalize">{channel}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Direction</p>
            <div className="space-y-2">
              {directions.map(direction => (
                <label key={direction} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={filters.direction?.includes(direction) || false}
                    onCheckedChange={() => toggleDirection(direction)}
                  />
                  <span className="text-sm text-foreground capitalize">{direction}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={filters.outcomesOnly || false}
                onCheckedChange={(checked) => onChange({ outcomesOnly: !!checked })}
              />
              <span className="text-sm text-foreground">With outcomes only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={filters.needsReviewOnly || false}
                onCheckedChange={(checked) => onChange({ needsReviewOnly: !!checked })}
              />
              <span className="text-sm text-foreground">Needs review</span>
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
