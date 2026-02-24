import InvestorNav from "@/components/investors/InvestorNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Calculator, Mail, ArrowRight, CheckCircle } from "lucide-react";
import { useState } from "react";

export default function InvestPage() {
  const [investment, setInvestment] = useState(25000);
  const [subscribers, setSubscribers] = useState(500);
  const [monthlyPrice, setMonthlyPrice] = useState(99);
  const [exitMultiple, setExitMultiple] = useState(8);

  const preMoneyValuation = 500000;
  const arr = subscribers * monthlyPrice * 12;
  const companyValuationAtExit = arr * exitMultiple;
  const ownershipPercent = (investment / preMoneyValuation) * 100;
  const exitValue = (ownershipPercent / 100) * companyValuationAtExit;
  const roi = ((exitValue - investment) / investment) * 100;
  const seisRelief = investment * 0.5;
  const effectiveInvestment = investment - seisRelief;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
  };

  const formatPercent = (value: number) => {
    return value.toFixed(2) + '%';
  };

  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />
      
      <section className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#17B6C3]/10 rounded-full mb-6">
              <Shield className="w-4 h-4 text-[#17B6C3]" />
              <span className="text-[#17B6C3] font-medium text-sm">SEIS Eligible Investment</span>
            </div>
            <h1 className="text-[44px] font-semibold text-[#0B0F17] mb-4">
              Investment Opportunity
            </h1>
            <p className="text-[18px] text-[#556070]">
              Join our SEIS-eligible funding round and benefit from significant tax advantages.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            SEIS Tax Benefits
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-12">
            The Seed Enterprise Investment Scheme offers substantial tax relief for investors.
          </p>
          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <Card className="bg-white border-[#E6E8EC] p-6 text-center">
              <p className="text-[36px] font-bold text-[#17B6C3] mb-2">50%</p>
              <p className="text-[14px] text-[#556070]">Income Tax Relief</p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-6 text-center">
              <p className="text-[36px] font-bold text-[#17B6C3] mb-2">0%</p>
              <p className="text-[14px] text-[#556070]">Capital Gains Tax on Profits</p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-6 text-center">
              <p className="text-[36px] font-bold text-[#17B6C3] mb-2">50%</p>
              <p className="text-[14px] text-[#556070]">CGT Reinvestment Relief</p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-6 text-center">
              <p className="text-[36px] font-bold text-[#17B6C3] mb-2">100%</p>
              <p className="text-[14px] text-[#556070]">Loss Relief</p>
            </Card>
          </div>
          <div className="mt-8 text-center">
            <p className="text-[14px] text-[#556070]">
              SEIS Reference: <span className="font-medium text-[#0B0F17]">WMBC/I&R/1183827082/VCRT</span>
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Calculator className="w-6 h-6 text-[#17B6C3]" />
            <h2 className="text-[32px] font-semibold text-[#0B0F17]">
              Investment Calculator
            </h2>
          </div>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-12">
            Model potential returns based on growth projections.
          </p>

          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-6">Inputs</h3>
              
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
                    Projected SME Subscribers at Exit
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
                    Average Monthly Subscription (£)
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
                    Exit Multiple (ARR)
                  </label>
                  <Select value={exitMultiple.toString()} onValueChange={(value) => setExitMultiple(parseInt(value))}>
                    <SelectTrigger className="border-[#E6E8EC]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3x ARR</SelectItem>
                      <SelectItem value="5">5x ARR</SelectItem>
                      <SelectItem value="8">8x ARR</SelectItem>
                      <SelectItem value="10">10x ARR</SelectItem>
                      <SelectItem value="15">15x ARR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="bg-[#FAFBFC] border-[#E6E8EC] p-8">
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-6">Projected Returns</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b border-[#E6E8EC]">
                  <span className="text-[14px] text-[#556070]">Annual Recurring Revenue (ARR)</span>
                  <span className="text-[14px] font-semibold text-[#0B0F17]">{formatCurrency(arr)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[#E6E8EC]">
                  <span className="text-[14px] text-[#556070]">Company Valuation at Exit</span>
                  <span className="text-[14px] font-semibold text-[#0B0F17]">{formatCurrency(companyValuationAtExit)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[#E6E8EC]">
                  <span className="text-[14px] text-[#556070]">Your Ownership %</span>
                  <span className="text-[14px] font-semibold text-[#0B0F17]">{formatPercent(ownershipPercent)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[#E6E8EC]">
                  <span className="text-[14px] text-[#556070]">Your Exit Value</span>
                  <span className="text-[14px] font-semibold text-[#17B6C3]">{formatCurrency(exitValue)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[#E6E8EC]">
                  <span className="text-[14px] text-[#556070]">ROI (before tax relief)</span>
                  <span className="text-[14px] font-semibold text-[#17B6C3]">{formatPercent(roi)}</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-[#17B6C3]/10 rounded-lg">
                <h4 className="text-[14px] font-semibold text-[#17B6C3] mb-3">SEIS Tax Relief</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[13px] text-[#556070]">50% Income Tax Relief</span>
                    <span className="text-[13px] font-semibold text-[#17B6C3]">{formatCurrency(seisRelief)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[13px] text-[#556070]">Effective Investment</span>
                    <span className="text-[13px] font-semibold text-[#0B0F17]">{formatCurrency(effectiveInvestment)}</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#556070] mt-4">
                Pre-money valuation: £500,000. Projections are illustrative only and not guaranteed.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <Mail className="w-12 h-12 text-[#17B6C3] mx-auto mb-6" />
            <h2 className="text-[32px] font-semibold text-[#0B0F17] mb-4">
              Ready to Invest?
            </h2>
            <p className="text-[18px] text-[#556070] mb-8">
              Contact us to discuss the investment opportunity, receive detailed documentation, and arrange a call with the founders.
            </p>
            <a href="mailto:hello@qashivo.com">
              <Button className="bg-[#17B6C3] hover:bg-[#139CA8] text-white h-12 px-8 rounded-lg text-[16px] font-medium">
                Contact: hello@qashivo.com
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <Card className="bg-white border-[#E6E8EC] p-8 max-w-4xl mx-auto">
            <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-4">Important Disclaimer</h3>
            <p className="text-[13px] text-[#556070] leading-relaxed">
              The content of this page has not been approved by an authorised person within the meaning of the Financial Services and Markets Act 2000. Reliance on this information for the purpose of engaging in any investment activity may expose an individual to a significant risk of losing all of the property or other assets invested. This investment opportunity is only available to investors who qualify as high-net-worth individuals or sophisticated investors. Past performance is not indicative of future results. All projections are illustrative and not guaranteed.
            </p>
          </Card>
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
