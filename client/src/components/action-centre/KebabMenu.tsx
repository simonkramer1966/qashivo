import { useState, useRef, useEffect } from "react";
import { MoreVertical, MessageSquare, CheckCircle2, Clock, AlertTriangle, UserPlus, FileText } from "lucide-react";

interface KebabMenuProps {
  onCompose: () => void;
  onApprove: () => void;
  onSnooze: () => void;
  onEscalate?: () => void;
  onAssign?: () => void;
  onViewTimeline?: () => void;
}

export function KebabMenu({
  onCompose,
  onApprove,
  onSnooze,
  onEscalate,
  onAssign,
  onViewTimeline,
}: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--q-bg-surface)]/60 transition-colors"
        data-testid="kebab-menu-button"
      >
        <MoreVertical className="h-4 w-4 text-[var(--q-text-tertiary)]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 bg-[var(--q-bg-surface)]/90 backdrop-blur-md border border-white/50 rounded-xl shadow-xl z-50"
          data-testid="kebab-menu-dropdown"
        >
          <button
            role="menuitem"
            className="w-full px-4 py-2.5 text-left hover:bg-[#17B6C3]/10 transition-colors flex items-center gap-2 text-sm text-[var(--q-text-primary)] rounded-t-xl"
            onClick={() => handleAction(onCompose)}
            data-testid="menu-compose"
          >
            <MessageSquare className="h-4 w-4 text-[#17B6C3]" />
            Compose
          </button>

          <button
            role="menuitem"
            className="w-full px-4 py-2.5 text-left hover:bg-[var(--q-money-in-bg)] transition-colors flex items-center gap-2 text-sm text-[var(--q-text-primary)]"
            onClick={() => handleAction(onApprove)}
            data-testid="menu-approve"
          >
            <CheckCircle2 className="h-4 w-4 text-[var(--q-money-in-text)]" />
            Approve
          </button>

          <button
            role="menuitem"
            className="w-full px-4 py-2.5 text-left hover:bg-[var(--q-attention-bg)] transition-colors flex items-center gap-2 text-sm text-[var(--q-text-primary)]"
            onClick={() => handleAction(onSnooze)}
            data-testid="menu-snooze"
          >
            <Clock className="h-4 w-4 text-[var(--q-attention-text)]" />
            Snooze (7 days)
          </button>

          {onEscalate && (
            <button
              role="menuitem"
              className="w-full px-4 py-2.5 text-left hover:bg-[var(--q-risk-bg)] transition-colors flex items-center gap-2 text-sm text-[var(--q-risk-text)]"
              onClick={() => handleAction(onEscalate)}
              data-testid="menu-escalate"
            >
              <AlertTriangle className="h-4 w-4 text-[var(--q-risk-text)]" />
              Escalate
            </button>
          )}

          {onAssign && (
            <button
              role="menuitem"
              className="w-full px-4 py-2.5 text-left hover:bg-[var(--q-info-bg)] transition-colors flex items-center gap-2 text-sm text-[var(--q-text-primary)]"
              onClick={() => handleAction(onAssign)}
              data-testid="menu-assign"
            >
              <UserPlus className="h-4 w-4 text-[var(--q-info-text)]" />
              Assign…
            </button>
          )}

          {onViewTimeline && (
            <button
              role="menuitem"
              className="w-full px-4 py-2.5 text-left hover:bg-[var(--q-bg-surface-hover)] transition-colors flex items-center gap-2 text-sm text-[var(--q-text-primary)] rounded-b-xl"
              onClick={() => handleAction(onViewTimeline)}
              data-testid="menu-timeline"
            >
              <FileText className="h-4 w-4 text-[var(--q-text-tertiary)]" />
              View Timeline
            </button>
          )}
        </div>
      )}
    </div>
  );
}
