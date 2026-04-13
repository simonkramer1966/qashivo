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
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TrendingUp, Receipt, Download, Loader2, MoreHorizontal, Pause, Play, X, Clock, Settings,
} from "lucide-react";
import { format } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

interface BillingConfig {
  id: string;
  partnerId: string;
  defaultTier: string;
  billingCurrency: string;
  billingContactName: string | null;
  billingContactEmail: string | null;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingCity: string | null;
  billingPostalCode: string | null;
  billingCountry: string;
  companyRegistrationNumber: string | null;
  vatNumber: string | null;
  paymentMethod: string;
  paymentTermsDays: number;
  invoicePrefix: string;
  volumeDiscountPercent: string;
  volumeDiscountTier: string;
}

interface ClientBilling {
  id: string;
  partnerId: string;
  tenantId: string;
  tier: string;
  wholesalePricePence: number;
  retailPricePence: number | null;
  billingStatus: string;
  trialEndsAt: string | null;
  tenantName: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  subtotalPence: number;
  discountPence: number;
  vatPence: number;
  totalPence: number;
  currency: string;
  status: string;
  lineItems: Array<{ clientName: string; tier: string; tierLabel: string; wholesalePricePence: number }>;
  sentAt: string | null;
  paidAt: string | null;
  dueDate: string | null;
  createdAt: string;
}

interface RevenueData {
  snapshot: {
    mrr: number;
    wholesaleCost: number;
    margin: number;
    activeClients: number;
    trialClients: number;
    pausedClients: number;
    cancelledClients: number;
    volumeDiscountPercent: number;
    volumeDiscountTier: string;
  };
  timeSeries: Array<{ month: string; invoicedPence: number; discountPence: number; netPence: number }>;
}

interface RevenueEvent {
  id: string;
  eventType: string;
  amountPence: number | null;
  description: string | null;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
}

const TIER_LABELS: Record<string, string> = {
  qollect: "Qollect",
  qollect_pro: "Qollect Pro",
  qollect_qapital: "Qollect + Qapital",
};

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function formatPenceShort(pence: number): string {
  if (pence >= 100000) return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return formatPence(pence);
}

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  active: "success",
  trial: "warning",
  paused: "warning",
  cancelled: "destructive",
  draft: "default",
  sent: "default",
  paid: "success",
  overdue: "destructive",
  void: "destructive",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function PartnerBilling() {
  const [tab, setTab] = useState("revenue");

  const tabs = [
    { key: "revenue", label: "Revenue" },
    { key: "clients", label: "Clients" },
    { key: "invoices", label: "Invoices" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <AppShell title="Billing">
      <div className="space-y-6">
        <QFilterTabs options={tabs} activeKey={tab} onChange={setTab} />
        {tab === "revenue" && <RevenueTab />}
        {tab === "clients" && <ClientsTab />}
        {tab === "invoices" && <InvoicesTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </AppShell>
  );
}

// ── Revenue Tab ──────────────────────────────────────────────────────────────

function RevenueTab() {
  const { data, isLoading } = useQuery<RevenueData>({
    queryKey: ["/api/partner/billing/revenue"],
    queryFn: () => apiRequest("GET", "/api/partner/billing/revenue").then(r => r.json()),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const { snapshot: s, timeSeries } = data;
  const chartData = timeSeries.map(t => ({
    month: t.month,
    revenue: t.netPence / 100,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Monthly Retail Revenue" value={formatPenceShort(s.mrr)} />
        <MetricCard label="Qashivo Cost (after discount)" value={formatPenceShort(s.wholesaleCost)} />
        <MetricCard label="Partner Margin" value={formatPenceShort(s.margin)} highlight />
        <MetricCard
          label="Volume Discount"
          value={s.volumeDiscountPercent > 0 ? `${s.volumeDiscountPercent}%` : "None"}
          subtitle={s.volumeDiscountTier !== "none" ? `${s.volumeDiscountTier} clients` : `${s.activeClients} active`}
        />
      </div>

      {/* Client counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Active</div>
          <div className="text-2xl font-semibold mt-1">{s.activeClients}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Trial</div>
          <div className="text-2xl font-semibold mt-1">{s.trialClients}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Paused</div>
          <div className="text-2xl font-semibold mt-1">{s.pausedClients}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Cancelled</div>
          <div className="text-2xl font-semibold mt-1">{s.cancelledClients}</div>
        </div>
      </div>

      {/* Revenue chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium mb-4">Monthly Invoiced Revenue</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `£${v}`} />
              <Tooltip cursor={false} formatter={(value: number) => [`£${value.toFixed(2)}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#18181b" fill="#18181b" fillOpacity={0.08} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent events */}
      <RecentEventsSection />
    </div>
  );
}

function MetricCard({ label, value, subtitle, highlight }: { label: string; value: string; subtitle?: string; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-lg border p-4 ${highlight ? "ring-1 ring-zinc-900" : ""}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${highlight ? "text-zinc-900" : ""}`} style={{ fontFamily: "monospace" }}>{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
    </div>
  );
}

function RecentEventsSection() {
  const { data } = useQuery<{ events: RevenueEvent[] }>({
    queryKey: ["/api/partner/billing/events"],
    queryFn: () => apiRequest("GET", "/api/partner/billing/events?limit=10").then(r => r.json()),
  });

  if (!data?.events?.length) return null;

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-sm font-medium mb-4">Recent Activity</h3>
      <div className="space-y-2">
        {data.events.map(e => (
          <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-zinc-50 last:border-0">
            <span className="text-muted-foreground">{e.description || e.eventType}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(e.createdAt), "dd MMM HH:mm")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Clients Tab ──────────────────────────────────────────────────────────────

function ClientsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tierDialog, setTierDialog] = useState<ClientBilling | null>(null);
  const [priceDialog, setPriceDialog] = useState<ClientBilling | null>(null);
  const [trialDialog, setTrialDialog] = useState<ClientBilling | null>(null);

  const { data, isLoading } = useQuery<{ clients: ClientBilling[] }>({
    queryKey: ["/api/partner/billing/clients"],
    queryFn: () => apiRequest("GET", "/api/partner/billing/clients").then(r => r.json()),
  });

  const pauseMutation = useMutation({
    mutationFn: (tenantId: string) => apiRequest("POST", `/api/partner/billing/clients/${tenantId}/pause`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/partner/billing"] }); toast({ title: "Billing paused" }); },
  });

  const resumeMutation = useMutation({
    mutationFn: (tenantId: string) => apiRequest("POST", `/api/partner/billing/clients/${tenantId}/resume`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/partner/billing"] }); toast({ title: "Billing resumed" }); },
  });

  const cancelMutation = useMutation({
    mutationFn: (tenantId: string) => apiRequest("POST", `/api/partner/billing/clients/${tenantId}/cancel`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/partner/billing"] }); toast({ title: "Billing cancelled" }); },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const clients = data?.clients || [];
  if (clients.length === 0) return <QEmptyState icon={Receipt} title="No clients" description="Link clients to your partner account to manage billing." />;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Client</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Tier</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Wholesale</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Retail</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Margin</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => {
              const margin = c.retailPricePence != null ? c.retailPricePence - c.wholesalePricePence : null;
              return (
                <tr key={c.id} className="border-b last:border-0 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 font-medium">{c.tenantName}</td>
                  <td className="px-4 py-3"><QBadge variant="default">{TIER_LABELS[c.tier] || c.tier}</QBadge></td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{formatPence(c.wholesalePricePence)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {c.retailPricePence != null ? formatPence(c.retailPricePence) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {margin != null ? <span className={margin >= 0 ? "text-emerald-600" : "text-red-600"}>{formatPence(margin)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <QBadge variant={STATUS_VARIANT[c.billingStatus] || "default"}>{c.billingStatus}</QBadge>
                    {c.billingStatus === "trial" && c.trialEndsAt && (
                      <span className="text-xs text-muted-foreground ml-1">until {format(new Date(c.trialEndsAt), "dd MMM")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setTierDialog(c)}>Change tier</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPriceDialog(c)}>Set retail price</DropdownMenuItem>
                        {c.billingStatus === "active" && (
                          <>
                            <DropdownMenuItem onClick={() => pauseMutation.mutate(c.tenantId)}>
                              <Pause className="h-3 w-3 mr-2" />Pause billing
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTrialDialog(c)}>
                              <Clock className="h-3 w-3 mr-2" />Start trial
                            </DropdownMenuItem>
                          </>
                        )}
                        {c.billingStatus === "paused" && (
                          <DropdownMenuItem onClick={() => resumeMutation.mutate(c.tenantId)}>
                            <Play className="h-3 w-3 mr-2" />Resume billing
                          </DropdownMenuItem>
                        )}
                        {c.billingStatus !== "cancelled" && (
                          <DropdownMenuItem className="text-destructive" onClick={() => cancelMutation.mutate(c.tenantId)}>
                            <X className="h-3 w-3 mr-2" />Cancel billing
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ChangeTierDialog client={tierDialog} onClose={() => setTierDialog(null)} />
      <SetRetailPriceDialog client={priceDialog} onClose={() => setPriceDialog(null)} />
      <StartTrialDialog client={trialDialog} onClose={() => setTrialDialog(null)} />
    </div>
  );
}

// ── Client Dialogs ───────────────────────────────────────────────────────────

function ChangeTierDialog({ client, onClose }: { client: ClientBilling | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tier, setTier] = useState(client?.tier || "qollect");

  const mutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/partner/billing/clients/${client!.tenantId}/tier`, { tier }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/partner/billing"] }); toast({ title: "Tier updated" }); onClose(); },
  });

  return (
    <Dialog open={!!client} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Tier</DialogTitle>
          <DialogDescription>{client?.tenantName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Plan</Label>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="qollect">Qollect — £99/mo</SelectItem>
              <SelectItem value="qollect_pro">Qollect Pro — £199/mo</SelectItem>
              <SelectItem value="qollect_qapital">Qollect + Qapital — £349/mo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetRetailPriceDialog({ client, onClose }: { client: ClientBilling | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [price, setPrice] = useState(client?.retailPricePence != null ? String(client.retailPricePence / 100) : "");

  const mutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/partner/billing/clients/${client!.tenantId}/retail-price`, {
      retailPricePence: Math.round(parseFloat(price) * 100),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/partner/billing"] }); toast({ title: "Retail price updated" }); onClose(); },
  });

  return (
    <Dialog open={!!client} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Retail Price</DialogTitle>
          <DialogDescription>{client?.tenantName} — what you charge this client per month</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Monthly price (£)</Label>
          <Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 149.00" />
          {client && price && (
            <p className="text-xs text-muted-foreground">
              Margin: <span className="font-mono">{formatPence(Math.round(parseFloat(price) * 100) - client.wholesalePricePence)}</span> /mo
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !price}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StartTrialDialog({ client, onClose }: { client: ClientBilling | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [days, setDays] = useState("30");

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/partner/billing/clients/${client!.tenantId}/trial`, {
      trialDays: parseInt(days),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/partner/billing"] }); toast({ title: "Trial started" }); onClose(); },
  });

  return (
    <Dialog open={!!client} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Trial</DialogTitle>
          <DialogDescription>{client?.tenantName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Trial duration (days)</Label>
          <Input type="number" min="1" max="365" value={days} onChange={e => setDays(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Start Trial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Invoices Tab ─────────────────────────────────────────────────────────────

function InvoicesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["/api/partner/billing/invoices"],
    queryFn: () => apiRequest("GET", "/api/partner/billing/invoices").then(r => r.json()),
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/partner/billing/invoices/generate"),
    onSuccess: (_, __) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/billing"] });
      toast({ title: "Invoice generated" });
    },
    onError: () => toast({ title: "Failed to generate invoice", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const invoices = data?.invoices || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
          {generateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
          Generate Invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <QEmptyState icon={Receipt} title="No invoices" description="Invoices are generated monthly on the 1st, or you can generate one manually." />
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Period</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Subtotal</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Discount</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-xs">
                    {format(new Date(inv.periodStart), "MMM yyyy")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{formatPence(inv.subtotalPence)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {inv.discountPence > 0 ? <span className="text-emerald-600">-{formatPence(inv.discountPence)}</span> : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold">{formatPence(inv.totalPence)}</td>
                  <td className="px-4 py-3">
                    <QBadge variant={STATUS_VARIANT[inv.status] || "default"}>{inv.status}</QBadge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => window.open(`/api/partner/billing/invoices/${inv.id}/pdf`, '_blank')}
                    >
                      <Download className="h-4 w-4" />
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

// ── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ config: BillingConfig; tierLabels: Record<string, string>; tierPrices: Record<string, number> }>({
    queryKey: ["/api/partner/billing/config"],
    queryFn: () => apiRequest("GET", "/api/partner/billing/config").then(r => r.json()),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const config = data?.config;

  // Sync form with loaded config
  const initialized = config && Object.keys(form).length === 0;
  if (initialized) {
    // This will cause a re-render with the form populated
    setTimeout(() => setForm({
      defaultTier: config.defaultTier || "qollect",
      billingContactName: config.billingContactName || "",
      billingContactEmail: config.billingContactEmail || "",
      billingAddressLine1: config.billingAddressLine1 || "",
      billingAddressLine2: config.billingAddressLine2 || "",
      billingCity: config.billingCity || "",
      billingPostalCode: config.billingPostalCode || "",
      companyRegistrationNumber: config.companyRegistrationNumber || "",
      vatNumber: config.vatNumber || "",
      paymentTermsDays: String(config.paymentTermsDays || 30),
      invoicePrefix: config.invoicePrefix || "QP",
    }), 0);
  }

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/partner/billing/config", {
      ...form,
      paymentTermsDays: parseInt(form.paymentTermsDays) || 30,
      billingContactEmail: form.billingContactEmail || null,
      billingAddressLine1: form.billingAddressLine1 || null,
      billingAddressLine2: form.billingAddressLine2 || null,
      billingCity: form.billingCity || null,
      billingPostalCode: form.billingPostalCode || null,
      companyRegistrationNumber: form.companyRegistrationNumber || null,
      vatNumber: form.vatNumber || null,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/partner/billing"] }); toast({ title: "Settings saved" }); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!config) return null;

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="max-w-xl space-y-6">
      {/* Default Tier */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="text-sm font-medium">Default Tier</h3>
        <p className="text-xs text-muted-foreground">Applied to new clients when added.</p>
        <Select value={form.defaultTier || "qollect"} onValueChange={v => setForm(f => ({ ...f, defaultTier: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="qollect">Qollect — £99/mo</SelectItem>
            <SelectItem value="qollect_pro">Qollect Pro — £199/mo</SelectItem>
            <SelectItem value="qollect_qapital">Qollect + Qapital — £349/mo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Billing Contact */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="text-sm font-medium">Billing Contact</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="text-xs">Name</Label><Input value={form.billingContactName || ""} onChange={set("billingContactName")} /></div>
          <div><Label className="text-xs">Email</Label><Input type="email" value={form.billingContactEmail || ""} onChange={set("billingContactEmail")} /></div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="text-sm font-medium">Billing Address</h3>
        <div className="space-y-3">
          <Input placeholder="Address line 1" value={form.billingAddressLine1 || ""} onChange={set("billingAddressLine1")} />
          <Input placeholder="Address line 2" value={form.billingAddressLine2 || ""} onChange={set("billingAddressLine2")} />
          <div className="grid grid-cols-2 gap-4">
            <Input placeholder="City" value={form.billingCity || ""} onChange={set("billingCity")} />
            <Input placeholder="Postal code" value={form.billingPostalCode || ""} onChange={set("billingPostalCode")} />
          </div>
        </div>
      </div>

      {/* Company Details */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="text-sm font-medium">Company Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="text-xs">Registration Number</Label><Input value={form.companyRegistrationNumber || ""} onChange={set("companyRegistrationNumber")} /></div>
          <div><Label className="text-xs">VAT Number</Label><Input value={form.vatNumber || ""} onChange={set("vatNumber")} /></div>
        </div>
      </div>

      {/* Invoice Settings */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="text-sm font-medium">Invoice Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="text-xs">Invoice Prefix</Label><Input value={form.invoicePrefix || ""} onChange={set("invoicePrefix")} maxLength={10} /></div>
          <div><Label className="text-xs">Payment Terms (days)</Label><Input type="number" min="1" max="90" value={form.paymentTermsDays || "30"} onChange={set("paymentTermsDays")} /></div>
        </div>
      </div>

      {/* Volume Discount (read-only) */}
      <div className="bg-white rounded-lg border p-6 space-y-2">
        <h3 className="text-sm font-medium">Volume Discount</h3>
        <p className="text-xs text-muted-foreground">Automatically applied based on active client count.</p>
        <div className="text-sm">
          Current: <span className="font-semibold">{Number(config.volumeDiscountPercent) > 0 ? `${config.volumeDiscountPercent}%` : "None"}</span>
          {config.volumeDiscountTier !== "none" && <span className="text-muted-foreground ml-2">({config.volumeDiscountTier} tier)</span>}
        </div>
        <div className="text-xs text-muted-foreground space-y-1 mt-2">
          <div>10+ clients: 15% discount</div>
          <div>25+ clients: 20% discount</div>
          <div>50+ clients: 25% discount</div>
        </div>
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Settings
      </Button>
    </div>
  );
}
