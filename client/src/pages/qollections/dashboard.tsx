import Header from "@/components/layout/header";
import NewSidebar from "@/components/layout/new-sidebar";

export default function QollectionsDashboard() {
  return (
    <div className="flex h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Dashboard" subtitle="Qollections overview" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="text-muted-foreground">Qollections Dashboard — coming soon</div>
        </main>
      </div>
    </div>
  );
}
