import Header from "@/components/layout/header";
import NewSidebar from "@/components/layout/new-sidebar";

export default function Qashflow() {
  return (
    <div className="flex h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Qashflow" subtitle="Cash flow forecasting" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="text-muted-foreground">Qashflow — coming soon</div>
        </main>
      </div>
    </div>
  );
}
