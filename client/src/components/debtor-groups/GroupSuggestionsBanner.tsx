import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { X, Lightbulb } from "lucide-react";

interface Suggestion {
  suggestedGroupName: string;
  reason: string;
  contactIds: string[];
  contactNames: string[];
}

interface GroupSuggestionsBannerProps {
  onCreateFromSuggestion: (contactIds: string[], groupName: string) => void;
}

export default function GroupSuggestionsBanner({ onCreateFromSuggestion }: GroupSuggestionsBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const { data: suggestions } = useQuery<Suggestion[]>({
    queryKey: ["/api/debtor-groups/suggestions"],
  });

  if (dismissed || !suggestions || suggestions.length === 0) return null;

  return (
    <div className="bg-[var(--q-info-bg)] border border-[var(--q-info-border,var(--q-border-default))] rounded-[var(--q-radius-lg)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <Lightbulb className="h-4 w-4 text-[var(--q-info-text)] mt-0.5 shrink-0" />
          <div className="space-y-2 flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--q-text-primary)]">
              Group suggestions
            </p>
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 bg-[var(--q-bg-surface)] rounded-[var(--q-radius-sm)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--q-text-primary)] truncate">
                      {s.suggestedGroupName}
                    </p>
                    <p className="text-xs text-[var(--q-text-tertiary)]">{s.reason}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onCreateFromSuggestion(s.contactIds, s.suggestedGroupName)}
                  >
                    Create Group
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button
          className="p-1 hover:bg-[var(--q-bg-surface-hover)] rounded shrink-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4 text-[var(--q-text-tertiary)]" />
        </button>
      </div>
    </div>
  );
}
