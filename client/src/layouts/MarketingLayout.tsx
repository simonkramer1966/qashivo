import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import "@/styles/marketing.css";

interface MarketingLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

export default function MarketingLayout({ children, currentPage }: MarketingLayoutProps) {
  return (
    <div className="mkt-headline-tight bg-surface font-body text-on-surface antialiased min-h-screen flex flex-col">
      <MarketingNav currentPage={currentPage} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
