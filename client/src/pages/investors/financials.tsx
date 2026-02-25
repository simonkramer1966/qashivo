import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import { FloatingInvestWidget } from "@/components/investors/FloatingInvestWidget";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Calculator, ArrowRight, Lock, Database, Users, Mic } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function FinancialsPage() {
  const [investment, setInvestment] = useState(25000);
  const [subscribers, setSubscribers] = useState(500);
  const [monthlyPrice, setMonthlyPrice] = useState(117);
  const [exitMultiple, setExitMultiple] = useState(5);

  const preMoneyValuation = 1500000;
  const raiseAmount = 250000;
  const postMoneyValuation = preMoneyValuation + raiseAmount;
  const arr = subscribers * monthlyPrice * 12;
  const companyValuationAtExit = arr * exitMultiple;
  const ownershipPercent = (investment / postMoneyValuation) * 100;
  const exitValue = (ownershipPercent / 100) * companyValuationAtExit;
  const roi = ((exitValue - investment) / investment) * 100;
  const seisRelief = investment * 0.5;
  const eisRelief = investment * 0.3;
  const effectiveInvestmentSEIS = investment - seisRelief;
  const effectiveInvestmentEIS = investment - eisRelief;
  const roiOnNetCashSEIS = ((exitValue - effectiveInvestmentSEIS) / effectiveInvestmentSEIS) * 100;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
  };

  const formatPercent = (value: number) => {
    return value.toFixed(1) + '%';
  };

  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      <section className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#17B6C3]/10 rounded-full mb-8">
              <Shield className="w-4 h-4 text-[#17B6C3]" />
              <span className="text-[#17B6C3] font-medium text-sm">SEIS Eligible &middot; HMRC Advance Assurance</span>
            </div>
            <h1 className="text-[44px] font-semibold text-[#0B0F17] mb-4">
              Financials & Investment
            </h1>
            <p className="text-[18px] text-[#556070]">
              A focused starting market, recurring revenue, and a clear path to building a large business. Capital-light with early traction that can quickly increase company value.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Unit economics that work, even in a conservative case
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Enabled by partner-led acquisition, multi-client expansion, and fast CAC payback at scale. Even the downside case clears "good SaaS" economics.
          </p>

          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="bg-white border-[#E6E8EC] p-6 overflow-x-auto">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-4">Scenario table</h3>
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b-2 border-[#E6E8EC]">
                    <th className="text-left py-3 pr-4 font-semibold text-[#0B0F17]">Metric</th>
                    <th className="text-center py-3 px-3 font-semibold text-[#556070]">Downside</th>
                    <th className="text-center py-3 px-3 font-semibold text-[#17B6C3]">Base</th>
                    <th className="text-center py-3 px-3 font-semibold text-[#556070]">Upside</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { metric: "ARPU (per SME)", down: "£117/mo", base: "£117/mo", up: "£117/mo" },
                    { metric: "Gross margin", down: "80%", base: "80%", up: "80%" },
                    { metric: "Trial → paid conversion", down: "10%", base: "15%", up: "20%" },
                    { metric: "Fully loaded CAC", down: "£350", base: "£275", up: "£225" },
                    { metric: "Monthly churn", down: "7.1%", base: "4%", up: "2.9%" },
                    { metric: "Avg lifetime (months)", down: "14", base: "25", up: "35" },
                    { metric: "SMEs per partner firm", down: "2", base: "3", up: "4" },
                  ].map((row) => (
                    <tr key={row.metric} className="border-b border-[#E6E8EC]">
                      <td className="py-3 pr-4 font-medium text-[#0B0F17]">{row.metric}</td>
                      <td className="py-3 px-3 text-center text-[#556070]">{row.down}</td>
                      <td className="py-3 px-3 text-center text-[#17B6C3] font-medium">{row.base}</td>
                      <td className="py-3 px-3 text-center text-[#556070]">{row.up}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-6 overflow-x-auto">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-4">The outcomes that matter</h3>
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b-2 border-[#E6E8EC]">
                    <th className="text-left py-3 pr-4 font-semibold text-[#0B0F17]">Metric</th>
                    <th className="text-center py-3 px-3 font-semibold text-[#556070]">Downside</th>
                    <th className="text-center py-3 px-3 font-semibold text-[#17B6C3]">Base</th>
                    <th className="text-center py-3 px-3 font-semibold text-[#556070]">Upside</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { metric: "Revenue per firm/month", down: "£235", base: "£352", up: "£469" },
                    { metric: "Gross profit per month", down: "£188", base: "£282", up: "£375" },
                    { metric: "LTV", down: "£3.3k", base: "£8.8k", up: "£16.4k" },
                    { metric: "LTV:CAC", down: "9.4x", base: "32x", up: "73x" },
                    { metric: "CAC payback", down: "1.9mo", base: "1.0mo", up: "0.6mo" },
                  ].map((row) => (
                    <tr key={row.metric} className="border-b border-[#E6E8EC]">
                      <td className="py-3 pr-4 font-medium text-[#0B0F17]">{row.metric}</td>
                      <td className="py-3 px-3 text-center text-[#556070]">{row.down}</td>
                      <td className="py-3 px-3 text-center text-[#17B6C3] font-medium">{row.base}</td>
                      <td className="py-3 px-3 text-center text-[#556070]">{row.up}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
          <p className="text-[14px] text-[#556070] text-center mt-6 italic">
            Base case is exceptional and driven by expansion, not pricing tricks. These unit economics enable Qashivo to scale via partners without proportional increases in sales or support headcount.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Financial trajectory & investor outcomes
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Built to reach profitability early, with additional upside through disciplined execution. Margins expand through partner-led distribution and standardised onboarding.
          </p>
          <div className="grid lg:grid-cols-2 gap-8">
            <Card className="bg-white border-[#E6E8EC] p-6 overflow-x-auto">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-4">Illustrative scaling outcomes</h3>
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b-2 border-[#E6E8EC]">
                    <th className="text-left py-3 font-semibold text-[#0B0F17]"></th>
                    <th className="text-center py-3 px-2 font-semibold text-[#556070]">Subscribers</th>
                    <th className="text-center py-3 px-2 font-semibold text-[#556070]">ARR</th>
                    <th className="text-center py-3 px-2 font-semibold text-[#556070]">EBITDA Margin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#E6E8EC]">
                    <td className="py-3 font-medium text-[#0B0F17]">Year 1</td>
                    <td className="py-3 px-2 text-center text-[#556070]">300 &ndash; 500</td>
                    <td className="py-3 px-2 text-center text-[#556070]">£0.5 &ndash; £0.8m</td>
                    <td className="py-3 px-2 text-center text-[#17B6C3]">-36%</td>
                  </tr>
                  <tr className="border-b border-[#E6E8EC]">
                    <td className="py-3 font-medium text-[#0B0F17]">Year 2</td>
                    <td className="py-3 px-2 text-center text-[#556070]">1,500 &ndash; 2,000</td>
                    <td className="py-3 px-2 text-center text-[#556070]">£2 &ndash; £3m</td>
                    <td className="py-3 px-2 text-center text-[#17B6C3]">19%</td>
                  </tr>
                  <tr className="border-b border-[#E6E8EC]">
                    <td className="py-3 font-medium text-[#0B0F17]">Year 3</td>
                    <td className="py-3 px-2 text-center text-[#17B6C3] font-medium">3,000</td>
                    <td className="py-3 px-2 text-center text-[#17B6C3] font-medium">£4 &ndash; £5m</td>
                    <td className="py-3 px-2 text-center text-[#17B6C3] font-medium">23%</td>
                  </tr>
                </tbody>
              </table>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-6 overflow-x-auto">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-4">Illustrative exit outcomes (Yr 3)</h3>
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b-2 border-[#E6E8EC]">
                    <th className="text-left py-3 font-semibold text-[#0B0F17]">Scenario</th>
                    <th className="text-center py-3 px-2 font-semibold text-[#556070]">ARR</th>
                    <th className="text-center py-3 px-2 font-semibold text-[#556070]">Exit Multiple</th>
                    <th className="text-center py-3 px-2 font-semibold text-[#556070]">Exit Value</th>
                    <th className="text-center py-3 px-2 font-semibold text-[#556070]">Investor ROI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#E6E8EC]">
                    <td className="py-3 font-medium text-[#0B0F17]">Conservative</td>
                    <td className="py-3 px-2 text-center text-[#556070]">£2&ndash;3m</td>
                    <td className="py-3 px-2 text-center text-[#556070]">2&ndash;3x</td>
                    <td className="py-3 px-2 text-center text-[#556070]">£6&ndash;9m</td>
                    <td className="py-3 px-2 text-center text-[#556070]">0.9&ndash;1.5x</td>
                  </tr>
                  <tr className="border-b border-[#E6E8EC]">
                    <td className="py-3 font-medium text-[#17B6C3]">Base</td>
                    <td className="py-3 px-2 text-center text-[#17B6C3]">£4&ndash;5m</td>
                    <td className="py-3 px-2 text-center text-[#17B6C3]">4x</td>
                    <td className="py-3 px-2 text-center text-[#17B6C3]">£16&ndash;20m</td>
                    <td className="py-3 px-2 text-center text-[#17B6C3] font-medium">2.5&ndash;3x</td>
                  </tr>
                  <tr className="border-b border-[#E6E8EC]">
                    <td className="py-3 font-medium text-[#0B0F17]">Upside</td>
                    <td className="py-3 px-2 text-center text-[#556070]">£7&ndash;8m</td>
                    <td className="py-3 px-2 text-center text-[#556070]">5&ndash;6x</td>
                    <td className="py-3 px-2 text-center text-[#556070]">£35&ndash;45m</td>
                    <td className="py-3 px-2 text-center text-[#556070]">5&ndash;7x</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[12px] text-[#556070] mt-4">
                These are not forecasts. They are examples based on comparable UK SaaS businesses.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            What a £100k investment could deliver
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Ownership, net cash at risk, and return scenarios under SEIS and EIS.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-5">Indicative ownership</h3>
              <div className="space-y-4">
                <div className="p-4 bg-[#FAFBFC] rounded-lg">
                  <p className="text-[14px] font-medium text-[#0B0F17] mb-1">Stage 1 (SEIS)</p>
                  <p className="text-[14px] text-[#556070]">£1.5m pre / £250k raise &rarr; £1.75m post</p>
                  <p className="text-[14px] text-[#17B6C3] font-medium">£100k = 5.7% post-money</p>
                </div>
                <div className="p-4 bg-[#FAFBFC] rounded-lg">
                  <p className="text-[14px] font-medium text-[#0B0F17] mb-1">Stage 2 (EIS)</p>
                  <p className="text-[14px] text-[#556070]">£6.0m pre / £1.0m raise &rarr; £7.0m post</p>
                  <p className="text-[14px] text-[#17B6C3] font-medium">£100k = 1.4% post-money</p>
                </div>
              </div>
              <div className="mt-6 p-4 bg-[#17B6C3]/10 rounded-lg">
                <h4 className="text-[14px] font-semibold text-[#17B6C3] mb-2">Tax relief</h4>
                <p className="text-[14px] text-[#556070]">SEIS: 50% income tax relief &rarr; £100k costs ~£50k net</p>
                <p className="text-[14px] text-[#556070]">EIS: 30% income tax relief &rarr; £100k costs ~£70k net</p>
              </div>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-5">Return scenarios</h3>
              <div className="space-y-6">
                <div className="p-4 bg-[#FAFBFC] rounded-lg">
                  <p className="text-[16px] font-semibold text-[#0B0F17] mb-2">3x outcome</p>
                  <p className="text-[14px] text-[#556070]">£100k &rarr; £300k gross proceeds</p>
                  <div className="mt-2 flex gap-4">
                    <span className="text-[14px] text-[#17B6C3] font-medium">SEIS: 6.0x</span>
                    <span className="text-[14px] text-[#556070]">EIS: 4.3x</span>
                  </div>
                  <p className="text-[12px] text-[#556070] mt-1">Return on net cash at risk after tax relief</p>
                </div>
                <div className="p-4 bg-[#FAFBFC] rounded-lg">
                  <p className="text-[16px] font-semibold text-[#0B0F17] mb-2">5x outcome</p>
                  <p className="text-[14px] text-[#556070]">£100k &rarr; £500k gross proceeds</p>
                  <div className="mt-2 flex gap-4">
                    <span className="text-[14px] text-[#17B6C3] font-medium">SEIS: 10.0x</span>
                    <span className="text-[14px] text-[#556070]">EIS: 7.1x</span>
                  </div>
                  <p className="text-[12px] text-[#556070] mt-1">Return on net cash at risk after tax relief</p>
                </div>
              </div>
              <p className="text-[12px] text-[#556070] mt-4">
                Ownership dilutes with future rounds/option pools. Tax relief depends on eligibility and holding period. Investors should take independent advice.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Calculator className="w-6 h-6 text-[#17B6C3]" />
            <h2 className="text-[32px] font-semibold text-[#0B0F17]">
              SEIS Investment Calculator
            </h2>
          </div>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-12">
            Model potential returns based on your investment amount and growth projections.
          </p>

          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-6">Inputs</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-[14px] font-medium text-[#0B0F17] mb-3">
                    Investment Amount: {formatCurrency(investment)}
                  </label>
                  <Slider
                    value={[investment]}
                    onValueChange={(value) => setInvestment(value[0])}
                    min={5000}
                    max={100000}
                    step={1000}
                    className="[&_[role=slider]]:bg-[#17B6C3] [&_[role=slider]]:border-[#17B6C3] [&_.bg-primary]:bg-[#17B6C3]"
                  />
                  <div className="flex justify-between mt-1 text-[12px] text-[#556070]">
                    <span>£5,000</span>
                    <span>£100,000</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">
                    Projected SME subscribers at exit
                  </label>
                  <Input
                    type="number"
                    value={subscribers}
                    onChange={(e) => setSubscribers(parseInt(e.target.value) || 0)}
                    className="border-[#E6E8EC]"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">
                    Average monthly subscription (£)
                  </label>
                  <Input
                    type="number"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(parseInt(e.target.value) || 0)}
                    className="border-[#E6E8EC]"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">
                    Exit multiple (ARR)
                  </label>
                  <Select value={exitMultiple.toString()} onValueChange={(value) => setExitMultiple(parseInt(value))}>
                    <SelectTrigger className="border-[#E6E8EC]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2x ARR (Conservative)</SelectItem>
                      <SelectItem value="3">3x ARR</SelectItem>
                      <SelectItem value="4">4x ARR (Base)</SelectItem>
                      <SelectItem value="5">5x ARR</SelectItem>
                      <SelectItem value="6">6x ARR (Upside)</SelectItem>
                      <SelectItem value="8">8x ARR</SelectItem>
                      <SelectItem value="10">10x ARR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="bg-[#FAFBFC] border-[#E6E8EC] p-8">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-6">Projected returns</h3>
              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b border-[#E6E8EC]">
                  <span className="text-[14px] text-[#556070]">Annual Recurring Revenue (ARR)</span>
                  <span className="text-[14px] font-semibold text-[#0B0F17]">{formatCurrency(arr)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[#E6E8EC]">
                  <span className="text-[14px] text-[#556070]">Company valuation at exit</span>
                  <span className="text-[14px] font-semibold text-[#0B0F17]">{formatCurrency(companyValuationAtExit)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[#E6E8EC]">
                  <span className="text-[14px] text-[#556070]">Your ownership (SEIS round)</span>
                  <span className="text-[14px] font-semibold text-[#0B0F17]">{formatPercent(ownershipPercent)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[#E6E8EC]">
                  <span className="text-[14px] text-[#556070]">Your exit value</span>
                  <span className="text-[14px] font-semibold text-[#17B6C3]">{formatCurrency(exitValue)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[#E6E8EC]">
                  <span className="text-[14px] text-[#556070]">Gross ROI</span>
                  <span className="text-[14px] font-semibold text-[#17B6C3]">{formatPercent(roi)}</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-[#17B6C3]/10 rounded-lg">
                <h4 className="text-[14px] font-semibold text-[#17B6C3] mb-3">SEIS tax relief impact</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[13px] text-[#556070]">50% income tax relief</span>
                    <span className="text-[13px] font-semibold text-[#17B6C3]">{formatCurrency(seisRelief)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[13px] text-[#556070]">Effective investment (net cash at risk)</span>
                    <span className="text-[13px] font-semibold text-[#0B0F17]">{formatCurrency(effectiveInvestmentSEIS)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[13px] text-[#556070]">ROI on net cash at risk</span>
                    <span className="text-[13px] font-semibold text-[#17B6C3]">{formatPercent(roiOnNetCashSEIS)}</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#556070] mt-4">
                Pre-money valuation: £1.5m (SEIS round). Post-money: £1.75m. Projections are illustrative only and not guaranteed. Ownership dilutes with future rounds.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Defensibility built into workflow, data, and distribution
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Qashivo's defensibility compounds as it becomes embedded in how SMEs and accountants manage receivables. Switching tools means losing context, not just software.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Database className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Outcome history</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Qashivo builds a longitudinal record of customer responses, promises, delays, and outcomes. This history directly improves prioritisation, timing, and cashflow visibility. It can't be replicated by a new entrant.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Users className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Partner stickiness</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Accountants embed Qashivo into their internal credit control process. Each firm typically rolls the system out across many SME clients. Replacing Qashivo means retraining staff and migrating multiple customers.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Lock className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">AI-native architecture</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Most tools automate reminders or reporting. Qashivo was designed from day one around interpreting responses and outcomes&mdash;built specifically for SME complexity, not adapted from enterprise AR tools.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Mic className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">AI Voice as compounding advantage</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Voice captures intent beyond text&mdash;tone, hesitation, objections, and urgency. Supervised AI voice deploys with human approval and auditability. Voice outcomes compound system intelligence across all channels.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <Card className="bg-white border-[#E6E8EC] p-8 max-w-4xl mx-auto">
            <h3 className="text-[16px] font-semibold text-[#0B0F17] mb-3">Important Disclaimer</h3>
            <p className="text-[12px] text-[#556070] leading-relaxed">
              The content of this page has not been approved by an authorised person within the meaning of the Financial Services and Markets Act 2000. Reliance on this information for the purpose of engaging in any investment activity may expose an individual to a significant risk of losing all of the property or other assets invested. This investment opportunity is only available to investors who qualify as high-net-worth individuals or sophisticated investors. Past performance is not indicative of future results. All projections are illustrative and not guaranteed.
            </p>
          </Card>
        </div>
      </section>

      <section className="py-16 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/investors/roadmap">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                Why SEIS
              </Button>
            </Link>
            <Link href="/investors/contact">
              <Button className="bg-[#17B6C3] hover:bg-[#139CA8] text-white h-12 px-7 rounded-lg text-[15px] font-medium">
                Get in Touch
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <FloatingInvestWidget />
      <InvestorFooter />
    </div>
  );
}
