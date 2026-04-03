import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useXeroSyncStatus } from "@/hooks/useXeroSyncStatus";
import { XeroSyncBanner } from "@/components/XeroSyncBanner";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  MoreVertical,
  Eye,
  UserPlus,
  StickyNote,
  PauseCircle,
  Star,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        className={`inline-flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

export default function SettingsDataHealth() {
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

  const { syncStatus, isSyncing } = useXeroSyncStatus([["/api/settings/data-health"]]);

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

  if (isLoading) {
    return (
      <AppShell title="Data Health">
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppShell>
    );
  }

  const summary = data?.summary ?? { total: 0, ready: 0, needsEmail: 0, genericEmail: 0, needsPhone: 0, needsAttention: 0 };

  const summaryCards = [
    { key: 'all' as FilterTab, label: 'Total Debtors', value: summary.total, icon: Users, color: 'text-slate-600' },
    { key: 'ready' as FilterTab, label: 'Ready', value: summary.ready, icon: CheckCircle2, color: 'text-green-600' },
    { key: 'needs_email' as FilterTab, label: 'Needs Email', value: summary.needsEmail, icon: Mail, color: 'text-red-600' },
    { key: 'generic_email' as FilterTab, label: 'Generic Email', value: summary.genericEmail, icon: MailWarning, color: 'text-amber-600' },
    { key: 'needs_phone' as FilterTab, label: 'Needs Phone', value: summary.needsPhone, icon: Phone, color: 'text-orange-600' },
  ];

  return (
    <AppShell title="Data Health">
      <div className="p-6 space-y-6">
        <XeroSyncBanner
          isSyncing={isSyncing}
          contactCount={syncStatus?.contactCount ?? 0}
          invoiceCount={syncStatus?.invoiceCount ?? 0}
        />
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {summaryCards.map(card => (
            <Card
              key={card.key}
              className={`cursor-pointer transition-all ${activeFilter === card.key ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
              onClick={() => setActiveFilter(card.key)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                  <span className={`text-2xl font-bold ${card.color}`}>{card.value}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, company, or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {activeFilter === 'all' ? 'All Debtors' : STATUS_CONFIG[activeFilter]?.label ?? 'Debtors'} ({filteredContacts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <DhSortTh field="name" label="Name" sort={sort} onSort={setSort} />
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Phone</th>
                    <DhSortTh field="totalOutstanding" label="Outstanding" sort={sort} onSort={setSort} className="text-right" />
                    <DhSortTh field="totalOverdue" label="Overdue" sort={sort} onSort={setSort} className="text-right" />
                    <DhSortTh field="oldestOverdueDays" label="Days" sort={sort} onSort={setSort} className="text-right" />
                    <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Edit</th>
                    <th className="w-10 py-3 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 px-3 text-muted-foreground">
                        No debtors found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map(contact => {
                      const config = STATUS_CONFIG[contact.readinessStatus];
                      const isEditing = editingId === contact.id;

                      return (
                        <tr key={contact.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/qollections/debtors/${contact.id}`)}>
                          <td className="py-3 px-3">
                            <div className="font-medium">{contact.name}</div>
                            {contact.companyName && (
                              <div className="text-xs text-muted-foreground">{contact.companyName}</div>
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
                              <span className={contact.missingFields.includes('email') ? 'text-red-500 italic' : contact.missingFields.includes('generic_email') ? 'text-amber-600' : ''}>
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
                              <span className={contact.missingFields.includes('phone') ? 'text-orange-500 italic' : ''}>
                                {contact.phone || 'Missing'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-medium">
                            {formatCurrency(contact.totalOutstanding)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {contact.totalOverdue > 0 ? (
                              <span className="text-red-600 font-medium">{formatCurrency(contact.totalOverdue)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {contact.oldestOverdueDays > 0 ? (
                              <span className={contact.oldestOverdueDays > 90 ? 'text-red-600 font-medium' : contact.oldestOverdueDays > 30 ? 'text-amber-600' : ''}>
                                {contact.oldestOverdueDays}d
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
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
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => navigate(`/qollections/debtors/${contact.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/qollections/debtors/${contact.id}`)}>
                                  <UserPlus className="h-4 w-4 mr-2" /> Add Contact
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/qollections/debtors/${contact.id}`)}>
                                  <StickyNote className="h-4 w-4 mr-2" /> Add Note
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <PauseCircle className="h-4 w-4 mr-2" /> Put On Hold
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Star className="h-4 w-4 mr-2" /> Mark as VIP
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
