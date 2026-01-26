import InvestorNav from "@/components/investors/InvestorNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink, Play, Monitor, MessageSquare, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function InvestorDemoPage() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />
      
      <section className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <h1 className="text-[44px] font-semibold text-[#0B0F17] text-center mb-4">
            See Qashivo in Action
          </h1>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-12">
            Experience the supervised autonomy workflow with real data and interactions.
          </p>

          <Card className="bg-[#FAFBFC] border-[#E6E8EC] p-12 text-center max-w-3xl mx-auto mb-16">
            <div className="w-20 h-20 bg-[#17B6C3] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Play className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-4">
              Interactive Product Demo
            </h2>
            <p className="text-[16px] text-[#556070] mb-8 max-w-xl mx-auto">
              Walk through the full Qashivo experience—from daily plan approval to two-way outcome capture and real-time cashflow forecasting.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/demo" target="_blank" rel="noopener noreferrer">
                <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white h-12 px-8 rounded-lg text-[16px] font-medium">
                  Launch Demo
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="/investor-demo-qashivo" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="h-12 px-8 rounded-lg text-[16px] font-medium border-[#E6E8EC]">
                  Investor-Specific Demo
                </Button>
              </a>
            </div>
          </Card>

          <h2 className="text-[28px] font-semibold text-[#0B0F17] text-center mb-8">
            What the Demo Shows
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Monitor className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Daily Plan Approval</h3>
              <p className="text-[#556070] leading-relaxed">
                See how Qashivo generates a prioritized action list and how approval works with a single click.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <MessageSquare className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Two-Way Outcomes</h3>
              <p className="text-[#556070] leading-relaxed">
                Watch debtor responses get captured and parsed automatically—promises, disputes, and payments.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <TrendingUp className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Cashflow Forecasting</h3>
              <p className="text-[#556070] leading-relaxed">
                See real-time forecast updates based on debtor behaviour and collected outcomes.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-4">
            Questions About What You See?
          </h2>
          <p className="text-[16px] text-[#556070] mb-8">
            Our team is available to walk you through any aspect of the product.
          </p>
          <a href="mailto:hello@qashivo.com">
            <Button variant="outline" className="h-12 px-8 rounded-lg text-[16px] font-medium border-[#E6E8EC]">
              Contact Us: hello@qashivo.com
            </Button>
          </a>
        </div>
      </section>

      <footer className="border-t border-[#E6E8EC] py-8">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-sm text-[#556070]">
            © 2026 Qashivo. SEIS Eligible · Ref: WMBC/I&R/1183827082/VCRT
          </p>
        </div>
      </footer>
    </div>
  );
}
