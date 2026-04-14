import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  User,
  Bot,
  MessageSquare,
  Settings,
  Handshake,
  CheckCheck,
  Search,
} from "lucide-react";
import { useLocation } from "wouter";

interface Note {
  id: string;
  tenantId: string;
  contactId?: string | null;
  content: string;
  source: string;
  trigger?: string | null;
  priority: string;
  isRead: boolean;
  readAt?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  contactName?: string | null;
  createdByName?: string | null;
}

const SOURCE_ICONS: Record<string, typeof User> = {
  user: User,
  charlie: Bot,
  riley: MessageSquare,
  system: Settings,
  partner: Handshake,
};

const SOURCE_LABELS: Record<string, string> = {
  user: "User",
  charlie: "Charlie",
  riley: "Riley",
  system: "System",
  partner: "Partner",
};

const TRIGGER_LABELS: Record<string, string> = {
  chase_cycle: "Chase cycle",
  promise_received: "Promise received",
  promise_broken: "Promise broken",
  payment_received: "Payment received",
  dispute_raised: "Dispute raised",
  unresponsive: "Unresponsive",
  tone_escalation: "Tone escalation",
  first_contact: "First contact",
  status_change: "Status change",
  weekly_summary: "Weekly summary",
  manual: "Manual note",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type SourceFilter = "all" | "user" | "charlie";

interface ContactOption {
  id: string;
  name: string;
}

export default function NotesTab() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [contactSearch, setContactSearch] = useState("");

  // Debounce search
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    const timer = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(timer);
  }, []);

  // Fetch contacts for the picker
  const { data: contactsData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/contacts", { limit: 100 }],
    queryFn: async () => {
      const r = await fetch("/api/contacts?limit=100", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
    select: (data: any) => {
      // API might return { contacts: [...] } or just [...]
      const list = Array.isArray(data) ? data : data?.contacts ?? [];
      return list.map((c: any) => ({ id: c.id, name: c.name }));
    },
  });

  const filteredContacts = (contactsData ?? []).filter(
    (c) => !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  // Build query params
  const queryParams = new URLSearchParams();
  if (sourceFilter !== "all") queryParams.set("source", sourceFilter);
  if (debouncedSearch) queryParams.set("search", debouncedSearch);

  const { data: notesData, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<{
    notes: Note[];
    nextCursor: string | null;
  }>({
    queryKey: ["/api/notes", { source: sourceFilter, search: debouncedSearch }],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (pageParam) params.set("cursor", pageParam as string);
      const r = await fetch(`/api/notes?${params}`, { credentials: "include" });
      if (!r.ok) return { notes: [], nextCursor: null };
      const data = await r.json();
      return { notes: Array.isArray(data?.notes) ? data.notes : [], nextCursor: data?.nextCursor ?? null };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });

  const allNotes = notesData?.pages.flatMap((p) => p.notes ?? []).filter(Boolean) ?? [];

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notes/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes/unread-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notes/mark-all-read", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes/unread-count"] });
    },
  });

  const createNote = useMutation({
    mutationFn: (data: { content: string; contactId?: string }) =>
      apiRequest("POST", "/api/notes", data),
    onSuccess: () => {
      setNewNoteContent("");
      setSelectedContactId("");
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes/unread-count"] });
    },
  });

  const handleAddNote = () => {
    if (!newNoteContent.trim()) return;
    createNote.mutate({
      content: newNoteContent.trim(),
      ...(selectedContactId ? { contactId: selectedContactId } : {}),
    });
  };

  return (
    <div className="space-y-4">
      {/* Quick-add note */}
      <div className="bg-q-bg-surface rounded-lg border border-q-border p-3">
        <div className="flex items-center gap-2">
          <select
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
            className="h-9 rounded-md border border-q-border bg-q-bg-page px-2 text-sm text-q-text-primary min-w-[140px] max-w-[200px]"
          >
            <option value="">General note</option>
            {(contactsData ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Write a note..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={!newNoteContent.trim() || createNote.isPending}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-q-bg-surface rounded-lg border border-q-border p-0.5">
          {(["all", "user", "charlie"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                sourceFilter === s
                  ? "bg-q-bg-surface-alt text-q-text-primary"
                  : "text-q-text-tertiary hover:text-q-text-secondary"
              )}
            >
              {s === "all" ? "All Notes" : s === "user" ? "My Notes" : "Charlie Notes"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-q-text-tertiary" />
          <Input
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            Mark all read
          </Button>
        </div>
      </div>

      {/* Notes feed */}
      {isLoading && (
        <p className="text-sm text-q-text-tertiary text-center py-8">Loading notes...</p>
      )}

      {!isLoading && allNotes.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-q-text-tertiary">No notes yet</p>
          <p className="text-xs text-q-text-tertiary mt-1">Add a note above to get started</p>
        </div>
      )}

      <div className="space-y-2">
        {allNotes.map((note) => {
          const SourceIcon = SOURCE_ICONS[note.source] ?? Settings;
          return (
            <div
              key={note.id}
              className={cn(
                "bg-q-bg-surface rounded-lg border border-q-border px-4 py-3 transition-colors",
                !note.isRead && "border-l-2 border-l-q-accent cursor-pointer"
              )}
              onClick={() => {
                if (!note.isRead) markRead.mutate(note.id);
              }}
            >
              <div className="flex items-start gap-3">
                <SourceIcon className="w-4 h-4 mt-0.5 shrink-0 text-q-text-tertiary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-q-text-tertiary">
                    <span className="font-medium">
                      {note.createdByName ?? SOURCE_LABELS[note.source] ?? note.source}
                    </span>
                    {note.contactName && (
                      <>
                        <span>&middot;</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (note.contactId) navigate(`/qollections/debtors/${note.contactId}`);
                          }}
                          className="text-q-accent hover:underline"
                        >
                          {note.contactName}
                        </button>
                      </>
                    )}
                    {note.trigger && (
                      <>
                        <span>&middot;</span>
                        <span>{TRIGGER_LABELS[note.trigger] ?? note.trigger}</span>
                      </>
                    )}
                    <span className="ml-auto">{formatTime(note.createdAt)}</span>
                  </div>
                  <p className="text-sm text-q-text-primary mt-1 whitespace-pre-wrap">{note.content}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasNextPage && (
        <div className="text-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
