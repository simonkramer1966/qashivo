import Header from "@/components/layout/header";
import NewSidebar from "@/components/layout/new-sidebar";

export default function SettingsIntegrations() {
  return (
    <div className="flex h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Integrations" subtitle="Connect Xero, Open Banking, and other services" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="text-muted-foreground">Integrations — coming soon</div>
        </main>
      </div>
    </div>
  );
}
