import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Rocket, Brain, Shield } from "lucide-react";
import { Link } from "wouter";

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      <section className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <h1 className="text-[44px] font-semibold text-[#0B0F17] text-center mb-4">
            Roadmap
          </h1>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto">
            A disciplined roadmap to scalable, AI-driven execution. New capabilities are introduced only when they improve outcomes and reduce manual effort.
          </p>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white border-[#E6E8EC] p-8 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#17B6C3] rounded-t-lg"></div>
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Target className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <p className="text-[13px] text-[#17B6C3] font-medium mb-2">Now &rarr; Accountex</p>
              <h3 className="text-[22px] font-semibold text-[#0B0F17] mb-3">Phase 1: Core Credit Control</h3>
              <p className="text-[14px] text-[#556070] mb-5">Prove trust, reliability, and value</p>
              <ul className="text-[14px] text-[#556070] leading-relaxed space-y-3">
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>AI-driven prioritisation and daily planning</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Human approval and supervised execution</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Two-way outcome capture (promises, delays, disputes)</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Clear, behaviour-based cashflow visibility</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Email and SMS as default channels, with voice piloted under supervision</li>
              </ul>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#556070]/30 rounded-t-lg"></div>
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Rocket className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <p className="text-[13px] text-[#556070] font-medium mb-2">Post-launch</p>
              <h3 className="text-[22px] font-semibold text-[#0B0F17] mb-3">Phase 2: Scaled Execution</h3>
              <p className="text-[14px] text-[#556070] mb-5">Reduce manual effort, increase leverage</p>
              <ul className="text-[14px] text-[#556070] leading-relaxed space-y-3">
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Deeper learning from outcome history</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Supervised AI voice execution to improve outcomes and operational leverage</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Improved partner tooling and multi-client workflows</li>
              </ul>
              <p className="text-[13px] text-[#556070] mt-5 italic">
                Voice is not a feature. It is a high-signal execution layer that compounds data quality, trust, and decision intelligence over time.
              </p>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#556070]/20 rounded-t-lg"></div>
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Brain className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <p className="text-[13px] text-[#556070] font-medium mb-2">Longer term</p>
              <h3 className="text-[22px] font-semibold text-[#0B0F17] mb-3">Phase 3: Receivables Intelligence</h3>
              <p className="text-[14px] text-[#556070] mb-5">Expand into decision intelligence</p>
              <ul className="text-[14px] text-[#556070] leading-relaxed space-y-3">
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Predictive cash confidence at portfolio level</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Insights for accountants and finance teams</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Optional extensions into adjacent receivables workflows</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Platform becomes system of record for AR behaviour</li>
              </ul>
            </Card>
          </div>
          <p className="text-[14px] text-[#556070] text-center mt-10 italic">
            Voice increases recovery quality without linear headcount, improving both margins and predictability as scale increases.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Use of funds
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Funding disciplined growth across product, partnerships, and operations. The focus is on validation and repeatability, not rapid burn.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="bg-white border-[#E6E8EC] p-8 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#8B2635] rounded-t-lg"></div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#8B2635]/10 rounded-full mb-5">
                <Shield className="w-3.5 h-3.5 text-[#8B2635]" />
                <span className="text-[#8B2635] font-medium text-[12px]">SEIS Eligible</span>
              </div>
              <h3 className="text-[22px] font-semibold text-[#0B0F17] mb-2">First Close &mdash; £250k</h3>
              <p className="text-[14px] text-[#17B6C3] font-medium mb-5">Ship MVP + prove partner-led pilots</p>
              <ul className="text-[14px] text-[#556070] leading-relaxed space-y-2 mb-6">
                <li>Build the supervised loop MVP (Plan &rarr; Approve &rarr; Execute &rarr; Outcome &rarr; Forecast)</li>
                <li>Xero read-only sync (invoices, contacts, payments + sync health)</li>
                <li>Comms + inbound capture (email/SMS sending + reply capture + outcome extraction)</li>
                <li>Pilot delivery (onboarding + templates + success reporting for partner firms)</li>
                <li>Security basics + audit trail (roles, permissions, activity logs)</li>
              </ul>
              <div className="p-4 bg-[#FAFBFC] rounded-lg">
                <p className="text-[13px] font-semibold text-[#0B0F17] mb-2">Allocation</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#556070]">Product & Engineering</span>
                    <span className="text-[#0B0F17] font-medium">70%</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#556070]">Pilot delivery & customer success</span>
                    <span className="text-[#0B0F17] font-medium">20%</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#556070]">Ops / legal / finance / contingency</span>
                    <span className="text-[#0B0F17] font-medium">10%</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#17B6C3] rounded-t-lg"></div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#17B6C3]/10 rounded-full mb-5">
                <span className="text-[#17B6C3] font-medium text-[12px]">EIS Eligible</span>
              </div>
              <h3 className="text-[22px] font-semibold text-[#0B0F17] mb-2">Extension &mdash; up to £1.0m</h3>
              <p className="text-[14px] text-[#17B6C3] font-medium mb-5">Scale product, integrations, and go-to-market</p>
              <ul className="text-[14px] text-[#556070] leading-relaxed space-y-2 mb-6">
                <li>Team build (engineering + product + customer success)</li>
                <li>Production-grade integrations (Xero deepening + QuickBooks follow-on)</li>
                <li>Automation depth (better intent classification, confidence UX, escalation rules)</li>
                <li>Partner GTM (enablement kit, rollout playbooks, onboarding ops)</li>
                <li>Compliance hardening (data retention, permissions, audit, messaging governance)</li>
              </ul>
              <div className="p-4 bg-[#FAFBFC] rounded-lg">
                <p className="text-[13px] font-semibold text-[#0B0F17] mb-2">Allocation</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#556070]">Product & Engineering</span>
                    <span className="text-[#0B0F17] font-medium">60%</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#556070]">GTM (partner enablement + onboarding)</span>
                    <span className="text-[#0B0F17] font-medium">20%</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#556070]">Integrations & infrastructure</span>
                    <span className="text-[#0B0F17] font-medium">10%</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#556070]">Ops / legal / compliance / contingency</span>
                    <span className="text-[#0B0F17] font-medium">10%</span>
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-[#556070] mt-4">
                Extension deployed against milestones: MVP shipped &bull; 5 pilot firms live &bull; 10,000 outcomes captured
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            The Ask
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Raising capital to complete commercial launch and early scale. The focus is disciplined execution and validation, not maximising capital raised.
          </p>
          <div className="max-w-2xl mx-auto text-center space-y-10">
            <div>
              <p className="text-[14px] text-[#556070] mb-2">First close (SEIS eligible, priced now)</p>
              <p className="text-[56px] font-bold text-[#8B2635]">£250k</p>
              <p className="text-[16px] text-[#556070]">Ship MVP and launch pilots with accounting partner firms</p>
            </div>
            <div className="w-16 h-px bg-[#E6E8EC] mx-auto"></div>
            <div>
              <p className="text-[14px] text-[#556070] mb-2">Stage 2 (EIS, priced after milestones) up to</p>
              <p className="text-[56px] font-bold text-[#17B6C3]">£1.0m</p>
              <p className="text-[16px] text-[#556070]">Scale product, integrations, and go-to-market</p>
            </div>
            <div className="pt-4">
              <p className="text-[16px] text-[#556070]">
                Total raise up to <span className="font-semibold text-[#0B0F17]">£1.25m</span> (£250k SEIS + up to £1.0m EIS)
              </p>
              <p className="text-[14px] text-[#556070] mt-2">
                Stage 2 triggered by: MVP shipped &bull; 5 pilot firms live &bull; 10,000 outcomes captured
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/investors/financials">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                View Financial Detail
              </Button>
            </Link>
            <Link href="/investors/contact">
              <Button className="bg-[#8B2635] hover:bg-[#6f1f2b] text-white h-12 px-7 rounded-lg text-[15px] font-medium">
                Get in Touch
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <InvestorFooter />
    </div>
  );
}
