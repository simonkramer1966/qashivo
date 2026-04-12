import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Wallet, Clock } from "lucide-react";

export default function Financing() {
  return (
    <div className="flex min-h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Financing" subtitle="Invoice Financing Options" />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-2xl mx-auto mt-20">
            <div className="rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface)]/80 backdrop-blur-sm shadow-lg">
              <div className="p-6 text-center border-b border-[var(--q-border-default)]">
                <div className="mx-auto w-16 h-16 bg-[var(--q-accent)]/10 rounded-full flex items-center justify-center mb-4">
                  <Wallet className="w-8 h-8 text-[var(--q-accent)]" />
                </div>
                <h2 className="text-2xl font-bold text-[var(--q-text-primary)]">Invoice Financing</h2>
                <p className="text-base text-[var(--q-text-tertiary)] mt-1">
                  Unlock cash tied up in unpaid invoices
                </p>
              </div>
              <div className="p-6 text-center">
                <div className="flex items-center justify-center gap-2 text-[var(--q-attention-text)] bg-[var(--q-attention-bg)] rounded-lg py-3 px-4">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Coming Soon</span>
                </div>
                <p className="mt-4 text-[var(--q-text-tertiary)]">
                  Access invoice financing options to improve your working capital.
                  Get paid faster on outstanding invoices while Qashivo handles collections.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
