import { UserButton } from "@clerk/clerk-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  mobileMenuButton?: React.ReactNode;
}

export default function Header({ title, subtitle, action, mobileMenuButton }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
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
          <UserButton afterSignOutUrl="/login" />
        </div>
      </div>
    </header>
  );
}
