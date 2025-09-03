import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export default function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            {title}
          </h2>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Xero Sync Status */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-muted rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground">Xero Synced</span>
            <span className="text-xs text-muted-foreground" data-testid="text-last-sync">
              2 min ago
            </span>
          </div>
          {action}
        </div>
      </div>
    </header>
  );
}
