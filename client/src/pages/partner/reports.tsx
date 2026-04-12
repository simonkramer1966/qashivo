import AppShell from "@/components/layout/app-shell";
import { QEmptyState } from "@/components/ui/q-empty-state";
import { BarChart3, TrendingUp, Users, Clock } from "lucide-react";

const reportCards = [
  { title: "Portfolio Health", description: "Overall portfolio risk distribution and trends across all clients.", icon: BarChart3 },
  { title: "Collection Performance", description: "Comparative collection metrics, DSO trends, and recovery rates by client.", icon: TrendingUp },
  { title: "Cash Gap Analysis", description: "Aggregate cash flow gaps and working capital requirements across the portfolio.", icon: Clock },
  { title: "Controller Productivity", description: "Workload distribution, action completion rates, and response times per controller.", icon: Users },
];

export default function PartnerReports() {
  return (
    <AppShell title="Reports">
    <div className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-6"
            >
              <QEmptyState
                icon={<Icon className="w-8 h-8" />}
                title={card.title}
                description={card.description}
                action={
                  <span className="text-xs font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">
                    Coming soon
                  </span>
                }
              />
            </div>
          );
        })}
      </div>
    </div>
    </AppShell>
  );
}
