import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { QFilterTabs } from "@/components/ui/q-filter-tabs";
import { QEmptyState } from "@/components/ui/q-empty-state";
import { QBadge } from "@/components/ui/q-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart3, TrendingUp, Users, FileText, Download, Plus, Trash2, Loader2, Bell, Calendar,
} from "lucide-react";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface Subscription {
  id: string;
  reportType: string;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  timezone: string;
  recipientEmails: string[];
  isActive: boolean;
  lastGeneratedAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

interface GeneratedReport {
  id: string;
  reportType: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  metadata: Record<string, unknown>;
  distributedAt: string | null;
  distributionRecipients: string[] | null;
  createdAt: string;
}

const REPORT_TYPES = {
  portfolio_health: { label: "Portfolio Health Summary", description: "Total AR, overdue, DSO, ageing analysis, and per-client comparison across your portfolio.", icon: BarChart3 },
  collections_performance: { label: "Collections Performance", description: "Actions sent by channel, completion rates, payments received, and per-client activity breakdown.", icon: TrendingUp },
  controller_productivity: { label: "Controller Productivity", description: "Per-staff workload analysis: clients assigned, actions generated, and completion rates.", icon: Users },
} as const;

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── Component ────────────────────────────────────────────────────────────────

export default function PartnerReports() {
  const [tab, setTab] = useState("catalogue");
  const [generateDialog, setGenerateDialog] = useState<string | null>(null);
  const [subscriptionDialog, setSubscriptionDialog] = useState(false);

  const tabs = [
    { key: "catalogue", label: "Report Catalogue" },
    { key: "subscriptions", label: "Subscriptions" },
    { key: "history", label: "Report History" },
    { key: "alerts", label: "Alerts" },
  ];

  return (
    <AppShell title="Reports">
      <div className="space-y-6">
        <QFilterTabs options={tabs} activeKey={tab} onChange={setTab} />

        {tab === "catalogue" && <CatalogueTab onGenerate={setGenerateDialog} />}
        {tab === "subscriptions" && <SubscriptionsTab onNew={() => setSubscriptionDialog(true)} />}
        {tab === "history" && <HistoryTab />}
        {tab === "alerts" && <AlertsTab />}

        <GenerateDialog reportType={generateDialog} onClose={() => setGenerateDialog(null)} />
        <NewSubscriptionDialog open={subscriptionDialog} onClose={() => setSubscriptionDialog(false)} />
      </div>
    </AppShell>
  );
}

// ── Catalogue Tab ────────────────────────────────────────────────────────────

function CatalogueTab({ onGenerate }: { onGenerate: (type: string) => void }) {
  const { data: subsData } = useQuery<{ subscriptions: Subscription[] }>({
    queryKey: ["/api/partner/reports/subscriptions"],
    staleTime: 60_000,
  });

  const subsByType = new Map<string, Subscription>();
  for (const sub of subsData?.subscriptions || []) {
    if (sub.isActive) subsByType.set(sub.reportType, sub);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Object.entries(REPORT_TYPES).map(([key, info]) => {
        const Icon = info.icon;
        const activeSub = subsByType.get(key);
        return (
          <div key={key} className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[var(--q-bg-page)]">
                <Icon className="w-5 h-5 text-[var(--q-text-secondary)]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">{info.label}</h3>
                <p className="text-xs text-[var(--q-text-tertiary)] mt-1 leading-relaxed">{info.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-auto pt-2">
              {activeSub ? (
                <QBadge variant="success" size="sm">
                  {FREQUENCY_LABELS[activeSub.frequency]} subscription
                </QBadge>
              ) : (
                <span className="text-xs text-[var(--q-text-muted)]">No subscription</span>
              )}
              <Button size="sm" variant="outline" onClick={() => onGenerate(key)}>
                Generate Now
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Generate Dialog ──────────────────────────────────────────────────────────

function GenerateDialog({ reportType, onClose }: { reportType: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [periodDays, setPeriodDays] = useState("30");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - Number(periodDays));
      const res = await apiRequest("POST", "/api/partner/reports/generate", {
        reportType,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Report generated", description: data.title });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/reports/history"] });
      onClose();
    },
    onError: () => {
      toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
    },
  });

  if (!reportType) return null;
  const info = REPORT_TYPES[reportType as keyof typeof REPORT_TYPES];
  if (!info) return null;

  return (
    <Dialog open={!!reportType} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate {info.label}</DialogTitle>
          <DialogDescription>Choose the reporting period and generate a PDF report.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Period (days)</Label>
            <Select value={periodDays} onValueChange={setPeriodDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Subscriptions Tab ────────────────────────────────────────────────────────

function SubscriptionsTab({ onNew }: { onNew: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ subscriptions: Subscription[] }>({
    queryKey: ["/api/partner/reports/subscriptions"],
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/partner/reports/subscriptions/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/reports/subscriptions"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/partner/reports/subscriptions/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Subscription deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/reports/subscriptions"] });
    },
  });

  const subs = data?.subscriptions || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--q-text-secondary)]">{subs.length} subscription{subs.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={onNew}>
          <Plus className="w-4 h-4 mr-1" /> New Subscription
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[var(--q-text-muted)]" /></div>
      ) : subs.length === 0 ? (
        <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-8">
          <QEmptyState
            icon={<Calendar className="w-8 h-8" />}
            title="No subscriptions"
            description="Set up recurring reports to be generated and emailed automatically."
            action={<Button size="sm" onClick={onNew}><Plus className="w-4 h-4 mr-1" /> Create Subscription</Button>}
          />
        </div>
      ) : (
        <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--q-border-default)]">
                <th className="text-left p-3 text-xs font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">Report</th>
                <th className="text-left p-3 text-xs font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">Frequency</th>
                <th className="text-left p-3 text-xs font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">Next Run</th>
                <th className="text-left p-3 text-xs font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">Recipients</th>
                <th className="text-center p-3 text-xs font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">Active</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {subs.map(sub => (
                <tr key={sub.id} className="border-b border-[var(--q-border-default)] last:border-b-0">
                  <td className="p-3 font-medium text-[var(--q-text-primary)]">
                    {REPORT_TYPES[sub.reportType as keyof typeof REPORT_TYPES]?.label || sub.reportType}
                  </td>
                  <td className="p-3 text-[var(--q-text-secondary)]">
                    {FREQUENCY_LABELS[sub.frequency] || sub.frequency}
                    {sub.frequency === 'weekly' && sub.dayOfWeek !== null && ` (${DAY_LABELS[sub.dayOfWeek]})`}
                    {sub.frequency === 'monthly' && sub.dayOfMonth !== null && ` (day ${sub.dayOfMonth})`}
                  </td>
                  <td className="p-3 text-[var(--q-text-secondary)]">
                    {sub.nextRunAt ? format(new Date(sub.nextRunAt), "dd MMM yyyy HH:mm") : "—"}
                  </td>
                  <td className="p-3 text-[var(--q-text-secondary)]">
                    {(sub.recipientEmails || []).length} recipient{(sub.recipientEmails || []).length !== 1 ? 's' : ''}
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={sub.isActive}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: sub.id, isActive: checked })}
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => deleteMutation.mutate(sub.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-[var(--q-text-muted)]" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── New Subscription Dialog ──────────────────────────────────────────────────

function NewSubscriptionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState("portfolio_health");
  const [frequency, setFrequency] = useState("weekly");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [timeOfDay, setTimeOfDay] = useState("08:00");
  const [emails, setEmails] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const recipientEmails = emails.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
      if (recipientEmails.length === 0) throw new Error("At least one recipient email required");

      await apiRequest("POST", "/api/partner/reports/subscriptions", {
        reportType,
        frequency,
        dayOfWeek: frequency !== 'monthly' ? Number(dayOfWeek) : undefined,
        dayOfMonth: frequency === 'monthly' ? Number(dayOfMonth) : undefined,
        timeOfDay,
        recipientEmails,
      });
    },
    onSuccess: () => {
      toast({ title: "Subscription created" });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/reports/subscriptions"] });
      onClose();
      setEmails("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create subscription", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Report Subscription</DialogTitle>
          <DialogDescription>Set up automatic report generation and email delivery.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REPORT_TYPES).map(([key, info]) => (
                  <SelectItem key={key} value={key}>{info.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="fortnightly">Fortnightly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {frequency !== 'monthly' && (
            <div>
              <Label>Day of Week</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_LABELS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {frequency === 'monthly' && (
            <div>
              <Label>Day of Month</Label>
              <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Time</Label>
            <Input type="time" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} />
          </div>
          <div>
            <Label>Recipient Emails (comma-separated)</Label>
            <Input
              placeholder="alice@example.com, bob@example.com"
              value={emails}
              onChange={e => setEmails(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data, isLoading } = useQuery<{ reports: GeneratedReport[] }>({
    queryKey: ["/api/partner/reports/history"],
    staleTime: 30_000,
  });

  const reports = data?.reports || [];

  const handleDownload = async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/partner/reports/${id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Toast handled by caller
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[var(--q-text-muted)]" /></div>;
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-8">
        <QEmptyState
          icon={<FileText className="w-8 h-8" />}
          title="No reports generated"
          description="Generate your first report from the Report Catalogue tab."
        />
      </div>
    );
  }

  return (
    <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--q-border-default)]">
            <th className="text-left p-3 text-xs font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">Report</th>
            <th className="text-left p-3 text-xs font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">Period</th>
            <th className="text-left p-3 text-xs font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">Generated</th>
            <th className="text-center p-3 text-xs font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">Status</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id} className="border-b border-[var(--q-border-default)] last:border-b-0">
              <td className="p-3 font-medium text-[var(--q-text-primary)]">{r.title}</td>
              <td className="p-3 text-[var(--q-text-secondary)]">
                {format(new Date(r.periodStart), "dd MMM")} – {format(new Date(r.periodEnd), "dd MMM yyyy")}
              </td>
              <td className="p-3 text-[var(--q-text-secondary)]">
                {r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy HH:mm") : "—"}
              </td>
              <td className="p-3 text-center">
                {r.status === 'generating' && <QBadge variant="default" size="sm"><Loader2 className="w-3 h-3 animate-spin mr-1" />Generating</QBadge>}
                {r.status === 'completed' && <QBadge variant="success" size="sm">Completed</QBadge>}
                {r.status === 'failed' && <QBadge variant="danger" size="sm">Failed</QBadge>}
              </td>
              <td className="p-3 text-right">
                {r.status === 'completed' && (
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(r.id, r.title)}>
                    <Download className="w-4 h-4" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Alerts Tab (placeholder) ─────────────────────────────────────────────────

function AlertsTab() {
  return (
    <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-8">
      <QEmptyState
        icon={<Bell className="w-8 h-8" />}
        title="Alerts coming soon"
        description="Configure threshold-based alerts for your portfolio. Get notified when DSO exceeds targets, overdue AR breaches limits, or client health deteriorates."
        action={
          <span className="text-xs font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">
            Phase 7B
          </span>
        }
      />
    </div>
  );
}
