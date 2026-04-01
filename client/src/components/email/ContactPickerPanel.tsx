import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus } from "lucide-react";
import type { Suggestion } from "./RecipientChipInput";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactPickerPanelProps {
  suggestions: Suggestion[];
  selectedEmails: string[];
  otherFieldEmails: string[];
  otherFieldLabel: string;
  onConfirm: (emails: string[]) => void;
  onCancel: () => void;
}

const SECTION_ORDER = ["Primary AR Contact", "Escalation Contact", "Other Contacts"] as const;

function getSectionKey(role?: string): (typeof SECTION_ORDER)[number] {
  if (role === "Primary" || role === "AR Contact") return "Primary AR Contact";
  if (role === "Escalation") return "Escalation Contact";
  return "Other Contacts";
}

export default function ContactPickerPanel({
  suggestions,
  selectedEmails,
  otherFieldEmails,
  otherFieldLabel,
  onConfirm,
  onCancel,
}: ContactPickerPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingSelection, setPendingSelection] = useState<Set<string>>(
    () => new Set(selectedEmails.map((e) => e.toLowerCase()))
  );

  const otherSet = useMemo(
    () => new Set(otherFieldEmails.map((e) => e.toLowerCase())),
    [otherFieldEmails]
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return suggestions;
    const q = searchQuery.toLowerCase();
    return suggestions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [suggestions, searchQuery]);

  const sections = useMemo(() => {
    const grouped = new Map<string, Suggestion[]>();
    for (const s of filtered) {
      const key = getSectionKey(s.role);
      const arr = grouped.get(key) || [];
      arr.push(s);
      grouped.set(key, arr);
    }
    return SECTION_ORDER.filter((key) => grouped.has(key)).map((key) => ({
      label: key,
      contacts: grouped.get(key)!,
    }));
  }, [filtered]);

  // Show "add custom email" row if query looks like an email and isn't in suggestions
  const showAddCustom = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q.includes("@") || !EMAIL_RE.test(q)) return false;
    return !suggestions.some((s) => s.email.toLowerCase() === q);
  }, [searchQuery, suggestions]);

  const toggleEmail = (email: string) => {
    const key = email.toLowerCase();
    const next = new Set(pendingSelection);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPendingSelection(next);
  };

  const addCustomEmail = () => {
    const email = searchQuery.trim().toLowerCase();
    if (email && !pendingSelection.has(email)) {
      setPendingSelection(new Set([...pendingSelection, email]));
    }
    setSearchQuery("");
  };

  const selectedCount = pendingSelection.size;

  return (
    <div className="w-80">
      {/* Search */}
      <div className="relative px-2 pt-2 pb-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search contacts or type email…"
          className="w-full rounded-md border border-input bg-background pl-8 pr-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          autoFocus
        />
      </div>

      {/* Contact list */}
      <ScrollArea className="max-h-[280px]">
        <div className="px-1 py-1">
          {sections.map((section, i) => (
            <div key={section.label}>
              {i > 0 && <Separator className="my-1" />}
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">
                {section.label}
              </p>
              {section.contacts.map((s) => {
                const emailKey = s.email.toLowerCase();
                const inOther = otherSet.has(emailKey);
                const checked = pendingSelection.has(emailKey);

                return (
                  <div
                    key={s.email}
                    role="button"
                    tabIndex={inOther ? -1 : 0}
                    onClick={() => !inOther && toggleEmail(s.email)}
                    onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !inOther) { e.preventDefault(); toggleEmail(s.email); } }}
                    className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted cursor-pointer ${inOther ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={inOther}
                      tabIndex={-1}
                      className="pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[13px] truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    </div>
                    {inOther ? (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        Already in {otherFieldLabel}
                      </span>
                    ) : s.role ? (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {s.role}
                      </Badge>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Add custom email */}
          {showAddCustom && (
            <>
              {sections.length > 0 && <Separator className="my-1" />}
              <button
                type="button"
                onClick={addCustomEmail}
                className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted text-sm"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  Add <span className="font-medium">{searchQuery.trim()}</span> as recipient
                </span>
              </button>
            </>
          )}

          {filtered.length === 0 && !showAddCustom && (
            <p className="text-xs text-muted-foreground text-center py-3">No contacts found</p>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <Separator />
      <div className="flex items-center justify-end gap-2 px-2 py-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onConfirm(Array.from(pendingSelection))}
          className="h-7 text-xs"
        >
          Add {selectedCount} selected
        </Button>
      </div>
    </div>
  );
}
