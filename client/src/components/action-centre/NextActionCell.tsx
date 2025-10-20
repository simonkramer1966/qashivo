/**
 * NextActionCell Component
 * 
 * Sprint 1: Exception-first Action Centre UI
 * Displays AI recommendation with inline triage controls
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  CheckCircle2, 
  Edit3, 
  Clock, 
  AlertTriangle,
  HelpCircle,
  Zap,
  TrendingUp
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getActionReasons, deriveExceptionTags, type Reason } from "@/lib/action-centre-helpers";

interface Action {
  id: string;
  type: string;
  scheduledFor: string | null;
  status: string;
  subject?: string | null;
  content?: string | null;
  metadata?: {
    recommended?: {
      channel?: string;
      sendAt?: string;
      priority?: number;
      reasons?: Reason[];
    };
    priority?: number;
    bundled?: boolean;
    invoiceCount?: number;
  };
  invoiceIds?: string[];
  contactName?: string | null;
}

const CHANNEL_ICONS = {
  email: { icon: Mail, label: "Email", color: "text-blue-500" },
  sms: { icon: MessageSquare, label: "SMS", color: "text-green-500" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "text-green-600" },
  voice: { icon: Phone, label: "Call", color: "text-purple-500" },
  manual_call: { icon: Phone, label: "Manual Call", color: "text-purple-500" },
};

const REASON_ICONS = {
  overdue: AlertTriangle,
  payment_history: TrendingUp,
  channel: Zap,
  urgency: Clock,
};

export function NextActionCell({ action }: { action: Action }) {
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSnoozeDialogOpen, setIsSnoozeDialogOpen] = useState(false);
  
  // Edit form state
  const [editChannel, setEditChannel] = useState(action.type);
  const [editSendAt, setEditSendAt] = useState(
    action.scheduledFor ? new Date(action.scheduledFor).toISOString().slice(0, 16) : ""
  );
  const [editSubject, setEditSubject] = useState(action.subject || "");
  const [editContent, setEditContent] = useState(action.content || "");
  
  // Snooze form state
  const [snoozeUntil, setSnoozeUntil] = useState("");
  const [snoozeReason, setSnoozeReason] = useState("");

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/actions/${action.id}/approve`),
    onSuccess: () => {
      toast({ title: "Action approved", description: "Action has been scheduled" });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve action", variant: "destructive" });
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: (data: { channel: string; sendAt: string; subject: string; content: string }) =>
      apiRequest("PATCH", `/api/actions/${action.id}/edit`, data),
    onSuccess: () => {
      toast({ title: "Action updated", description: "Changes saved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update action", variant: "destructive" });
    },
  });

  // Snooze mutation
  const snoozeMutation = useMutation({
    mutationFn: (data: { snoozeUntil: string; reason: string }) =>
      apiRequest("POST", `/api/actions/${action.id}/snooze`, data),
    onSuccess: () => {
      toast({ title: "Action snoozed", description: "Action has been postponed" });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      setIsSnoozeDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to snooze action", variant: "destructive" });
    },
  });

  const channelConfig = CHANNEL_ICONS[action.type as keyof typeof CHANNEL_ICONS] || CHANNEL_ICONS.email;
  const ChannelIcon = channelConfig.icon;
  
  const recommendedPriority = action.metadata?.recommended?.priority || action.metadata?.priority || 50;
  const reasons = getActionReasons(action); // Use helper to get/derive reasons
  const exceptions = deriveExceptionTags(action);
  const isBundled = action.metadata?.bundled || false;
  const invoiceCount = action.metadata?.invoiceCount || 1;

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "Now";
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 0) return "Overdue";
    if (diffHours === 0) return "Now";
    if (diffHours < 24) return `In ${diffHours}h`;
    const diffDays = Math.round(diffHours / 24);
    return `In ${diffDays}d`;
  };

  const handleApprove = () => {
    approveMutation.mutate();
  };

  const handleEdit = () => {
    editMutation.mutate({
      channel: editChannel,
      sendAt: editSendAt,
      subject: editSubject,
      content: editContent,
    });
  };

  const handleSnooze = () => {
    if (!snoozeUntil) {
      toast({ title: "Error", description: "Please select a snooze date", variant: "destructive" });
      return;
    }
    snoozeMutation.mutate({
      snoozeUntil,
      reason: snoozeReason,
    });
  };

  return (
    <div className="flex items-center gap-2" data-testid={`action-cell-${action.id}`}>
      {/* CTA Button with popover - Glassmorphic design */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="gap-2 bg-gradient-to-r from-[#17B6C3] to-[#1396A1] hover:from-[#1396A1] hover:to-[#117A83] text-white shadow-lg backdrop-blur-sm border border-white/10"
            data-testid={`button-cta-${action.id}`}
          >
            <ChannelIcon className="h-4 w-4" />
            <span className="font-medium">
              {channelConfig.label} {formatTime(action.scheduledFor)}
            </span>
            {isBundled && (
              <Badge variant="secondary" className="ml-1 bg-white/20 text-white border-0 backdrop-blur-sm">
                {invoiceCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-2xl" align="start">
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-[#17B6C3]" />
                  Why this action?
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-xs text-gray-500">
                    AI confidence:
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      recommendedPriority > 70 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : recommendedPriority > 40
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    {recommendedPriority.toFixed(0)}%
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Exception tags */}
            {exceptions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {exceptions.map((tag, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline" 
                    className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            
            {reasons.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {reasons.map((reason, idx) => {
                  const ReasonIcon = REASON_ICONS[reason.icon as keyof typeof REASON_ICONS] || AlertTriangle;
                  return (
                    <li key={idx} className="flex items-start gap-2">
                      <ReasonIcon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{reason.label}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">
                <p className="flex items-start gap-2">
                  <Zap className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Adaptive scheduler selected {channelConfig.label.toLowerCase()} based on customer behavior</span>
                </p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Inline Triage Controls */}
      {action.status === "pending" && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={handleApprove}
            disabled={approveMutation.isPending}
            data-testid={`button-approve-${action.id}`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">Approve</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={() => setIsEditDialogOpen(true)}
            data-testid={`button-edit-${action.id}`}
          >
            <Edit3 className="h-4 w-4" />
            <span className="text-xs">Edit</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
            onClick={() => setIsSnoozeDialogOpen(true)}
            data-testid={`button-snooze-${action.id}`}
          >
            <Clock className="h-4 w-4" />
            <span className="text-xs">Snooze</span>
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid={`dialog-edit-${action.id}`}>
          <DialogHeader>
            <DialogTitle>Edit Action</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-channel">Channel</Label>
              <Select value={editChannel} onValueChange={setEditChannel}>
                <SelectTrigger id="edit-channel" data-testid="select-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="voice">Call</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-sendAt">Send At</Label>
              <Input
                id="edit-sendAt"
                type="datetime-local"
                value={editSendAt}
                onChange={(e) => setEditSendAt(e.target.value)}
                data-testid="input-sendAt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject</Label>
              <Input
                id="edit-subject"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="Email subject or SMS preview"
                data-testid="input-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Message content"
                rows={4}
                data-testid="textarea-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={editMutation.isPending}
              className="bg-[#17B6C3] hover:bg-[#1396A1]"
              data-testid="button-save-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snooze Dialog */}
      <Dialog open={isSnoozeDialogOpen} onOpenChange={setIsSnoozeDialogOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid={`dialog-snooze-${action.id}`}>
          <DialogHeader>
            <DialogTitle>Snooze Action</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="snooze-until">Snooze Until</Label>
              <Input
                id="snooze-until"
                type="datetime-local"
                value={snoozeUntil}
                onChange={(e) => setSnoozeUntil(e.target.value)}
                data-testid="input-snoozeUntil"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="snooze-reason">Reason (optional)</Label>
              <Textarea
                id="snooze-reason"
                value={snoozeReason}
                onChange={(e) => setSnoozeReason(e.target.value)}
                placeholder="Why are you snoozing this action?"
                rows={3}
                data-testid="textarea-snoozeReason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSnoozeDialogOpen(false)}
              data-testid="button-cancel-snooze"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSnooze}
              disabled={snoozeMutation.isPending}
              className="bg-[#17B6C3] hover:bg-[#1396A1]"
              data-testid="button-confirm-snooze"
            >
              Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
