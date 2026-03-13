import AppShell from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2 } from "lucide-react";

const featurePreviews = [
  "Plan management",
  "Invoice history",
  "Payment methods",
];

export default function SettingsBilling() {
  return (
    <AppShell title="Billing" subtitle="Subscription and payment management">
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardContent className="flex flex-col items-center text-center pt-10 pb-10">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Billing & Subscription</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Manage your subscription plan, payment methods, and billing history.
            </p>
            <Badge variant="secondary" className="mb-8">
              Coming in Q2 2026
            </Badge>
            <div className="w-full max-w-xs space-y-3 text-left">
              {featurePreviews.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
