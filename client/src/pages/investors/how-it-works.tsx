import InvestorNav from "@/components/investors/InvestorNav";
import { Card } from "@/components/ui/card";
import { ArrowRight, Database, CalendarCheck, CheckCircle, Play, MessageSquare, RefreshCw, Clock, ThumbsUp, AlertTriangle } from "lucide-react";

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />
      
      <section className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <h1 className="text-[44px] font-semibold text-[#0B0F17] text-center mb-4">
            How Qashivo Works
          </h1>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-16">
            A complete supervised autonomy workflow from receivables data to cash collection.
          </p>

          <div className="grid md:grid-cols-6 gap-4 mb-20">
            {[
              { icon: Database, label: "Receivables Data", desc: "Sync invoices from your accounting system" },
              { icon: CalendarCheck, label: "Daily Plan", desc: "AI generates prioritized action list" },
              { icon: CheckCircle, label: "Approve", desc: "One-click approval or adjustments" },
              { icon: Play, label: "Execute", desc: "Automated emails, SMS, voice calls" },
              { icon: MessageSquare, label: "Capture Outcomes", desc: "Two-way response capture" },
              { icon: RefreshCw, label: "Adjust", desc: "Real-time plan optimization" },
            ].map((step, index) => (
              <div key={step.label} className="relative">
                <Card className="bg-white border-[#E6E8EC] p-5 h-full">
                  <div className="w-10 h-10 bg-[#17B6C3] rounded-lg flex items-center justify-center mb-4">
                    <step.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#0B0F17] mb-2">{step.label}</h3>
                  <p className="text-[13px] text-[#556070]">{step.desc}</p>
                </Card>
                {index < 5 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-4 h-4 text-[#17B6C3]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Two-Way Outcomes
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-12">
            Every debtor response becomes actionable data that updates your cashflow forecast in real-time.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <ThumbsUp className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Promises to Pay</h3>
              <p className="text-[#556070] leading-relaxed">
                Debtor commits to payment date. System tracks and follows up if missed. Forecast updates automatically.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Clock className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Requests for Time</h3>
              <p className="text-[#556070] leading-relaxed">
                Debtor needs more time. System captures new expected date and adjusts collection strategy accordingly.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#8B2635]/10 rounded-lg flex items-center justify-center mb-5">
                <AlertTriangle className="w-6 h-6 text-[#8B2635]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Disputes</h3>
              <p className="text-[#556070] leading-relaxed">
                Debtor raises an issue. System escalates to human, pauses collection, and tracks resolution.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Competitive Comparison
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-12">
            See how Qashivo compares to manual processes and basic reminder automation.
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-[#E6E8EC]">
                  <th className="text-left py-4 px-4 text-[15px] font-semibold text-[#0B0F17]">Capability</th>
                  <th className="text-center py-4 px-4 text-[15px] font-semibold text-[#556070]">Manual / Spreadsheets</th>
                  <th className="text-center py-4 px-4 text-[15px] font-semibold text-[#556070]">Reminder Automation</th>
                  <th className="text-center py-4 px-4 text-[15px] font-semibold text-[#17B6C3]">Qashivo</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { capability: "Execution", manual: "Staff-dependent", reminder: "Scheduled emails only", qashivo: "Multi-channel (email, SMS, voice)" },
                  { capability: "Two-way responses", manual: "Lost in email", reminder: "None", qashivo: "Automated capture & parsing" },
                  { capability: "Customer interaction depth", manual: "Inconsistent", reminder: "One-way broadcast", qashivo: "Conversational, contextual" },
                  { capability: "Decision intelligence", manual: "Human judgment only", reminder: "Rule-based", qashivo: "AI-optimized priorities" },
                  { capability: "Cashflow visibility", manual: "Manual tracking", reminder: "Basic reports", qashivo: "Real-time forecast updates" },
                  { capability: "Scalability", manual: "Linear with headcount", reminder: "Limited by rules", qashivo: "10x volume, same team" },
                ].map((row) => (
                  <tr key={row.capability} className="border-b border-[#E6E8EC]">
                    <td className="py-4 px-4 text-[14px] font-medium text-[#0B0F17]">{row.capability}</td>
                    <td className="py-4 px-4 text-[14px] text-[#556070] text-center">{row.manual}</td>
                    <td className="py-4 px-4 text-[14px] text-[#556070] text-center">{row.reminder}</td>
                    <td className="py-4 px-4 text-[14px] text-[#17B6C3] font-medium text-center">{row.qashivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
