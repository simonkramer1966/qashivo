import Header from "@/components/layout/header";
import NewSidebar from "@/components/layout/new-sidebar";

export default function QollectionsDebtors() {
  return (
    <div className="flex h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Debtors" subtitle="Manage customer accounts" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="text-muted-foreground">Debtors — coming soon</div>
        </main>
      </div>
    </div>
  );
}
