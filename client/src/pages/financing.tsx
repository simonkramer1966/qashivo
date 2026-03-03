import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Clock } from "lucide-react";

export default function Financing() {
  return (
    <div className="flex min-h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Financing" subtitle="Invoice Financing Options" />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-2xl mx-auto mt-20">
            <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mb-4">
                  <Wallet className="w-8 h-8 text-[#17B6C3]" />
                </div>
                <CardTitle className="text-2xl font-bold text-foreground">Invoice Financing</CardTitle>
                <CardDescription className="text-base">
                  Unlock cash tied up in unpaid invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-lg py-3 px-4">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Coming Soon</span>
                </div>
                <p className="mt-4 text-muted-foreground">
                  Access invoice financing options to improve your working capital. 
                  Get paid faster on outstanding invoices while Qashivo handles collections.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
