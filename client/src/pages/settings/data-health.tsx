import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { QFilterTabs } from "@/components/ui/q-filter-tabs";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Mail,
  Phone,
  Search,
  Save,
  X,
  Pencil,
  Users,
  ShieldAlert,
  MailWarning,
} from "lucide-react";
import { useLocation } from "wouter";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { type SortState, nextSortState } from "@/components/ui/sortable-header";

interface ContactHealth {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  arContactName: string | null;
  arContactEmail: string | null;
  arContactPhone: string | null;
  readinessStatus: string;
  missingFields: string[];
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
  oldestOverdueDays: number;
}

interface DataHealthResponse {
  summary: {
    total: number;
    ready: number;
    needsEmail: number;
    genericEmail: number;
    needsPhone: number;
    needsAttention: number;
  };
  contacts: ContactHealth[];
}

type FilterTab = 'all' | 'ready' | 'needs_email' | 'generic_email' | 'needs_phone' | 'needs_attention';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ready: { label: 'Ready', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  needs_email: { label: 'Needs Email', color: 'bg-red-100 text-red-800', icon: Mail },
  generic_email: { label: 'Generic Email', color: 'bg-amber-100 text-amber-800', icon: MailWarning },
  needs_phone: { label: 'Needs Phone', color: 'bg-orange-100 text-orange-800', icon: Phone },
  needs_attention: { label: 'Needs Attention', color: 'bg-red-100 text-red-800', icon: ShieldAlert },
};

function DhSortTh({ field, label, sort, onSort, className = "" }: {
  field: string; label: string; sort: SortState; onSort: (s: SortState) => void; className?: string;
}) {
  const active = sort.field === field && sort.dir !== null;
  return (
    <th className={`py-3 px-3 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(nextSortState(sort, field))}
        className={`inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.3px] transition-colors cursor-pointer ${active ? "text-[var(--q-text-primary)]" : "text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)]"}`}
      >
        {label}
        {active && sort.dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : active && sort.dir === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}


export function DataHealthContent() {
  return <SettingsDataHealth embedded />;
}

export default function SettingsDataHealth({ embedded }: { embedded?: boolean }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ email: string; phone: string }>({ email: '', phone: '' });
  const [sort, setSort] = useState<SortState>({ field: "totalOutstanding", dir: "desc" });

  const { data, isLoading } = useQuery<DataHealthResponse>({
    queryKey: ["/api/settings/data-health"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, email, phone }: { id: string; email: string; phone: string }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}/ar-details`, {
        arContactEmail: email || null,
        arContactPhone: phone || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/data-health"] });
      setEditingId(null);
      toast({ title: "Contact updated", description: "AR details saved successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact.", variant: "destructive" });
    },
  });

  const filteredContacts = useMemo(() => {
    if (!data?.contacts) return [];
    let filtered = data.contacts;
    if (activeFilter !== 'all') {
      filtered = filtered.filter(c => c.readinessStatus === activeFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    if (sort.dir && sort.field) {
      const mul = sort.dir === "asc" ? 1 : -1;
      filtered = [...filtered].sort((a, b) => {
        const aVal = (a as any)[sort.field] ?? '';
        const bVal = (b as any)[sort.field] ?? '';
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return mul * (aVal - bVal);
        }
        return mul * String(aVal).localeCompare(String(bVal));
      });
    }
    return filtered;
  }, [data?.contacts, activeFilter, searchQuery, sort]);

  const startEdit = (contact: ContactHealth) => {
    setEditingId(contact.id);
    setEditValues({
      email: contact.arContactEmail || contact.email || '',
      phone: contact.arContactPhone || contact.phone || '',
    });
  };

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, email: editValues.email, phone: editValues.phone });
  };

  const loadingSkeleton = (
    <div className="space-y-[var(--q-space-2xl)]">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-96" />
    </div>
  );

  if (isLoading) {
    if (embedded) return loadingSkeleton;
    return (
      <AppShell title="Data Health">
        {loadingSkeleton}
      </AppShell>
    );
  }

  const summary = data?.summary ?? { total: 0, ready: 0, needsEmail: 0, genericEmail: 0, needsPhone: 0, needsAttention: 0 };

  const summaryCards = [
    { key: 'all' as FilterTab, label: 'Total Debtors', value: summary.total, icon: Users, color: 'text-[var(--q-text-tertiary)]' },
    { key: 'ready' as FilterTab, label: 'Ready', value: summary.ready, icon: CheckCircle2, color: 'text-[var(--q-money-in-text)]' },
    { key: 'needs_email' as FilterTab, label: 'Needs Email', value: summary.needsEmail, icon: Mail, color: 'text-[var(--q-risk-text)]' },
    { key: 'generic_email' as FilterTab, label: 'Generic Email', value: summary.genericEmail, icon: MailWarning, color: 'text-[var(--q-attention-text)]' },
    { key: 'needs_phone' as FilterTab, label: 'Needs Phone', value: summary.needsPhone, icon: Phone, color: 'text-[var(--q-attention-text)]' },
  ];

  const content = (
    <div className="space-y-[var(--q-space-2xl)]">
      {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-[var(--q-space-md)]">
          {summaryCards.map(card => (
            <div
              key={card.key}
              className={`cursor-pointer transition-all rounded-[var(--q-radius-lg)] border bg-[var(--q-bg-surface)] p-[var(--q-space-xl)] ${activeFilter === card.key ? 'border-[var(--q-accent)] ring-1 ring-[var(--q-accent)]' : 'border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)]'}`}
              onClick={() => setActiveFilter(card.key)}
            >
              <div className="flex items-center justify-between">
                <card.icon className={`h-5 w-5 ${card.color}`} />
                <span className={`text-[28px] font-semibold q-mono ${card.color}`}>{card.value}</span>
              </div>
              <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Search + filter tabs */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--q-text-tertiary)]" />
            <Input
              placeholder="Search by name, company, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <QFilterTabs
          options={[
            { key: "all", label: "All debtors", count: summary.total },
            { key: "ready", label: "Ready", count: summary.ready },
            { key: "needs_email", label: "Needs email", count: summary.needsEmail },
            { key: "generic_email", label: "Generic email", count: summary.genericEmail },
            { key: "needs_phone", label: "Needs phone", count: summary.needsPhone },
          ]}
          activeKey={activeFilter}
          onChange={(v) => setActiveFilter(v as FilterTab)}
        />

        {/* Table */}
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--q-border-default)]">
            <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">
              {activeFilter === 'all' ? 'All Debtors' : STATUS_CONFIG[activeFilter]?.label ?? 'Debtors'} ({filteredContacts.length})
            </h3>
          </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--q-border-default)] bg-[var(--q-bg-surface-alt)]/30">
                    <DhSortTh field="name" label="Name" sort={sort} onSort={setSort} />
                    <th className="w-[100px] text-left py-3 px-3 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">Status</th>
                    <th className="w-[220px] text-left py-3 px-3 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">Email</th>
                    <th className="w-[160px] text-left py-3 px-3 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">Phone</th>
                    <th className="w-[60px] text-center py-3 px-3 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 px-3 text-[var(--q-text-tertiary)]">
                        No debtors found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map(contact => {
                      const config = STATUS_CONFIG[contact.readinessStatus];
                      const isEditing = editingId === contact.id;

                      return (
                        <tr key={contact.id} className="border-b border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)] cursor-pointer h-12" onClick={() => navigate(`/qollections/debtors/${contact.id}`)}>
                          <td className="py-3 px-3">
                            <div className="font-medium truncate">{contact.name}</div>
                            {contact.companyName && (
                              <div className="text-xs text-[var(--q-text-tertiary)] truncate">{contact.companyName}</div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {config && (
                              <Badge variant="secondary" className={config.color}>
                                {config.label}
                              </Badge>
                            )}
                          </td>
                          <td className="p-3" onClick={(e) => isEditing && e.stopPropagation()}>
                            {isEditing ? (
                              <Input
                                value={editValues.email}
                                onChange={e => setEditValues(v => ({ ...v, email: e.target.value }))}
                                className="h-8 text-sm"
                                placeholder="email@example.com"
                              />
                            ) : (
                              <span className={contact.missingFields.includes('email') ? 'text-[var(--q-risk-text)] italic' : contact.missingFields.includes('generic_email') ? 'text-[var(--q-attention-text)]' : ''}>
                                {contact.email || 'Missing'}
                              </span>
                            )}
                          </td>
                          <td className="p-3" onClick={(e) => isEditing && e.stopPropagation()}>
                            {isEditing ? (
                              <Input
                                value={editValues.phone}
                                onChange={e => setEditValues(v => ({ ...v, phone: e.target.value }))}
                                className="h-8 text-sm"
                                placeholder="+44..."
                              />
                            ) : (
                              <span className={contact.missingFields.includes('phone') ? 'text-[var(--q-attention-text)] italic' : ''}>
                                {contact.phone || 'Missing'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => saveEdit(contact.id)}
                                  disabled={updateMutation.isPending}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingId(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEdit(contact)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
        </div>
    </div>
  );

  if (embedded) return content;

  return (
    <AppShell title="Data Health">
      {content}
    </AppShell>
  );
}
