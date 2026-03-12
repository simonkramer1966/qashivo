import Header from "@/components/layout/header";
import NewSidebar from "@/components/layout/new-sidebar";

export default function SettingsAutonomyRules() {
  return (
    <div className="flex h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Autonomy & Rules" subtitle="Set agent decision boundaries and escalation rules" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="text-muted-foreground">Autonomy & Rules — coming soon</div>
        </main>
      </div>
    </div>
  );
}
