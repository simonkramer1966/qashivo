import { UserButton } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import HeaderSyncIndicator from "@/components/sync/HeaderSyncIndicator";
import { cn } from "@/lib/utils";

const MODE_STYLES: Record<string, { label: string; cls: string }> = {
  off: { label: "Comms Off", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  testing: { label: "Testing", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  soft_live: { label: "Soft Live", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  live: { label: "Live", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
};

interface HeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  mobileMenuButton?: React.ReactNode;
}

export default function Header({ title, subtitle, action, mobileMenuButton }: HeaderProps) {
  const { isAuthenticated } = useAuth();
  const { data: commData } = useQuery<{ mode: string }>({
    queryKey: ["/api/agent/communication-mode"],
    staleTime: 60_000,
    enabled: isAuthenticated,
  });

  return (
    <header className="sticky top-0 z-30 bg-[var(--q-bg-page)]">
      <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          {mobileMenuButton}
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate font-heading">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate hidden sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {action}
          {commData?.mode && (
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", MODE_STYLES[commData.mode]?.cls)}>
              {MODE_STYLES[commData.mode]?.label ?? commData.mode}
            </span>
          )}
          <HeaderSyncIndicator />
          <UserButton afterSignOutUrl="/login" />
        </div>
      </div>
    </header>
  );
}
