import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, TrendingUp, ShieldOff, Landmark, RefreshCw, Globe, Users, BarChart3, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

export default function WhySEISPage() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      <section className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <h1 className="text-[44px] font-semibold text-[#0B0F17] text-center mb-4">
            Why SEIS
          </h1>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-10">
            Invest in innovation &mdash; with meaningful downside protection
          </p>
          <div className="max-w-3xl mx-auto space-y-6">
            <p className="text-[16px] text-[#556070] leading-relaxed">
              Backing an early-stage company can be one of the most rewarding things you do &mdash; and one of the riskiest.
            </p>
            <p className="text-[16px] text-[#556070] leading-relaxed">
              That&rsquo;s exactly why the UK government created SEIS (the Seed Enterprise Investment Scheme): to help private investors fund the next generation of British innovation by offering some of the most generous tax incentives available anywhere for seed-stage investing.
            </p>
            <p className="text-[16px] text-[#0B0F17] font-medium leading-relaxed">
              SEIS doesn&rsquo;t remove risk &mdash; it changes the risk/return equation. It&rsquo;s designed to make it more rational to invest early, by cushioning the downside and amplifying the upside.
            </p>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-3xl mx-auto px-6">
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-semibold text-amber-800 mb-2">Risk warning (please read)</p>
                <p className="text-[14px] text-amber-700 leading-relaxed">
                  Early-stage investing is high risk. You could lose all the money you invest, and you are unlikely to be protected if something goes wrong. SEIS reliefs depend on your personal circumstances and the company remaining qualifying. Tax rules can change. Always seek independent financial and tax advice before investing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            What is SEIS?
          </h2>
          <div className="max-w-3xl mx-auto space-y-5">
            <p className="text-[16px] text-[#556070] leading-relaxed text-center">
              SEIS is a government-backed scheme that rewards investment into the UK&rsquo;s youngest, highest-potential companies.
            </p>
            <p className="text-[16px] text-[#556070] leading-relaxed text-center">
              It was introduced in 2012 to stimulate investment into innovative start-ups &mdash; the kind of businesses that can create outsized economic value, but carry meaningful execution risk.
            </p>
            <p className="text-[16px] text-[#556070] leading-relaxed text-center">
              SEIS exists because the UK wants more founders building ambitious companies &mdash; and more investors willing to back them early.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Why SEIS is powerful for investors
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-3xl mx-auto mb-6">
            If you&rsquo;re investing in a seed-stage company like Qashivo, you&rsquo;re doing something most capital never does: funding the moment before scale.
          </p>
          <p className="text-[16px] text-[#556070] text-center max-w-3xl mx-auto mb-14">
            SEIS recognises that and offers a set of benefits that, combined, can make early-stage investing dramatically more efficient.
          </p>

          <h3 className="text-[22px] font-semibold text-[#0B0F17] text-center mb-10">The core benefits</h3>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Shield className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <p className="text-[13px] text-[#17B6C3] font-medium mb-2">1</p>
              <h4 className="text-[18px] font-semibold text-[#0B0F17] mb-3">50% income tax relief</h4>
              <p className="text-[15px] text-[#556070] leading-relaxed mb-4">
                You can claim 50% income tax relief on the amount invested, up to £200,000 per tax year. That means a £20,000 investment could generate up to £10,000 of income tax relief (subject to your circumstances).
              </p>
              <p className="text-[13px] text-[#556070] italic">
                Carry back option: In many cases, you may be able to &ldquo;carry back&rdquo; relief to the previous tax year (subject to HMRC rules and limits).
              </p>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <TrendingUp className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <p className="text-[13px] text-[#17B6C3] font-medium mb-2">2</p>
              <h4 className="text-[18px] font-semibold text-[#0B0F17] mb-3">0% Capital Gains Tax on growth</h4>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                If shares are held for at least three years, any gains on a qualifying SEIS investment can be free from Capital Gains Tax. If Qashivo becomes a breakout success, SEIS is designed so you keep more of that upside.
              </p>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <ShieldOff className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <p className="text-[13px] text-[#17B6C3] font-medium mb-2">3</p>
              <h4 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Loss relief (real downside protection)</h4>
              <p className="text-[15px] text-[#556070] leading-relaxed mb-4">
                If the investment doesn&rsquo;t work out, you may be able to offset the loss (after income tax relief) against income tax at your marginal rate &mdash; materially reducing your net downside.
              </p>
              <p className="text-[14px] text-[#0B0F17] font-medium">
                In plain terms: SEIS can significantly reduce your effective risk on early-stage investments.
              </p>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Landmark className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <p className="text-[13px] text-[#17B6C3] font-medium mb-2">4</p>
              <h4 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Inheritance Tax relief</h4>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Provided qualifying conditions are met (including holding period rules), SEIS shares may qualify for Business Property Relief &mdash; potentially removing them from your estate for inheritance tax purposes.
              </p>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <RefreshCw className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <p className="text-[13px] text-[#17B6C3] font-medium mb-2">5</p>
              <h4 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Capital gains reinvestment relief</h4>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                SEIS can also allow investors to reduce certain capital gains liabilities by reinvesting into SEIS-qualifying shares (subject to HMRC rules).
              </p>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Globe className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <p className="text-[13px] text-[#17B6C3] font-medium mb-2">6</p>
              <h4 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Business Investment Relief</h4>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                UK residents who are non-UK domiciled may be able to invest via SEIS and bring overseas capital into the UK without a UK tax charge (subject to specialist advice).
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Why SEIS is relevant for Qashivo investors
          </h2>
          <div className="max-w-3xl mx-auto space-y-5 mb-12">
            <p className="text-[16px] text-[#556070] leading-relaxed">
              Qashivo is building intent-aware credit control and working capital intelligence for SMEs and accountants.
            </p>
            <p className="text-[16px] text-[#556070] leading-relaxed">
              Most &ldquo;collections&rdquo; tools track activity (emails sent, tasks created). Qashivo captures outcomes &mdash; the information that actually predicts cash:
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-12">
            <div className="bg-white border border-[#E6E8EC] rounded-lg p-5 text-center">
              <p className="text-[15px] text-[#0B0F17] font-medium">Promise-to-pay (with date)</p>
            </div>
            <div className="bg-white border border-[#E6E8EC] rounded-lg p-5 text-center">
              <p className="text-[15px] text-[#0B0F17] font-medium">Requests for more time / payment plans</p>
            </div>
            <div className="bg-white border border-[#E6E8EC] rounded-lg p-5 text-center">
              <p className="text-[15px] text-[#0B0F17] font-medium">Disputes / issues blocking payment</p>
            </div>
          </div>
          <div className="max-w-3xl mx-auto space-y-5">
            <p className="text-[16px] text-[#556070] leading-relaxed">
              Those outcomes instantly update a live, confidence-based cashflow forecast and adjust next actions, using a trust-first loop:
            </p>
            <div className="bg-white border border-[#E6E8EC] rounded-lg p-6">
              <p className="text-[15px] text-[#0B0F17] font-medium text-center">
                Plan &rarr; Human approval &rarr; Execute &rarr; Capture outcomes &rarr; Update forecast + strategy
              </p>
            </div>
            <p className="text-[16px] text-[#556070] leading-relaxed">
              This is how you turn credit control from an admin function into intelligent working capital: not just who owes you money &mdash; but what cash you can realistically expect, and when.
            </p>
            <p className="text-[16px] text-[#0B0F17] font-medium leading-relaxed">
              So SEIS isn&rsquo;t just a tax wrapper. It&rsquo;s a way to back a company attacking a massive, universal SME problem &mdash; getting paid on time &mdash; with a risk-adjusted structure designed for seed-stage investing.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            A brief history (and why it matters)
          </h2>
          <div className="max-w-3xl mx-auto space-y-5 mb-12">
            <p className="text-[16px] text-[#556070] leading-relaxed">
              SEIS was introduced after the financial crisis to encourage capital into the earliest stages of company-building &mdash; where traditional funding is scarce and risk is highest, but the upside can be enormous.
            </p>
            <p className="text-[16px] text-[#556070] leading-relaxed">
              The scheme has since channelled billions into UK startups and helped create jobs, new products, and long-term economic growth &mdash; a core reason the UK is one of Europe&rsquo;s most active startup markets.
            </p>
            <p className="text-[16px] text-[#556070] leading-relaxed">
              In 2023, SEIS was upgraded (&ldquo;SEIS 2.0&rdquo;) to better match modern seed rounds:
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="bg-[#FAFBFC] border border-[#E6E8EC] rounded-lg p-6 text-center">
              <p className="text-[28px] font-bold text-[#17B6C3] mb-2">£200k</p>
              <p className="text-[14px] text-[#556070]">Investor limit per year (up from £100k)</p>
            </div>
            <div className="bg-[#FAFBFC] border border-[#E6E8EC] rounded-lg p-6 text-center">
              <p className="text-[28px] font-bold text-[#17B6C3] mb-2">£250k</p>
              <p className="text-[14px] text-[#556070]">Company SEIS raise limit (up from £150k)</p>
            </div>
            <div className="bg-[#FAFBFC] border border-[#E6E8EC] rounded-lg p-6 text-center">
              <p className="text-[28px] font-bold text-[#17B6C3] mb-2">3 years</p>
              <p className="text-[14px] text-[#556070]">Qualifying trading window (up from 2 years)</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Eligibility &amp; limits
          </h2>
          <p className="text-[16px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            In plain English
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-5">Company rules (high level)</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed mb-4">
                SEIS is designed for very early-stage UK companies. In general, a company must be:
              </p>
              <ul className="text-[15px] text-[#556070] leading-relaxed space-y-3">
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>UK-based and carrying on a qualifying trade</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Trading for no more than 3 years</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Fewer than 25 employees</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Less than £350,000 in gross assets</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Unlisted, and meeting HMRC independence requirements</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Raising within SEIS limits (up to £250,000)</li>
              </ul>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-5">Investor rules (high level)</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed mb-4">
                To keep SEIS reliefs, investors typically must:
              </p>
              <ul className="text-[15px] text-[#556070] leading-relaxed space-y-3">
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Have UK tax liability</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Pay for shares upfront and meet HMRC conditions</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Hold shares for at least three years</li>
                <li className="flex gap-2"><span className="text-[#17B6C3] shrink-0">&bull;</span>Avoid certain &ldquo;connected&rdquo; relationships and arrangements</li>
              </ul>
              <p className="text-[13px] text-[#556070] mt-6 italic">
                These are simplified summaries &mdash; SEIS is technical and advice is recommended.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            How SEIS works after you invest
          </h2>
          <p className="text-[16px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            SEIS is not automatic. You must claim it.
          </p>
          <div className="max-w-3xl mx-auto">
            <p className="text-[16px] text-[#556070] leading-relaxed mb-8">
              After your investment, the company (or fund manager) will provide the SEIS documentation you need (typically SEIS3) so you can claim relief through your self-assessment return.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#FAFBFC] border border-[#E6E8EC] rounded-lg p-5 text-center relative">
                <p className="text-[28px] font-bold text-[#17B6C3] mb-2">1</p>
                <p className="text-[14px] text-[#556070]">Invest into the SEIS round</p>
                <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 text-[#E6E8EC] text-2xl">&rarr;</div>
              </div>
              <div className="bg-[#FAFBFC] border border-[#E6E8EC] rounded-lg p-5 text-center relative">
                <p className="text-[28px] font-bold text-[#17B6C3] mb-2">2</p>
                <p className="text-[14px] text-[#556070]">Company files compliance with HMRC and issues SEIS documentation</p>
                <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 text-[#E6E8EC] text-2xl">&rarr;</div>
              </div>
              <div className="bg-[#FAFBFC] border border-[#E6E8EC] rounded-lg p-5 text-center relative">
                <p className="text-[28px] font-bold text-[#17B6C3] mb-2">3</p>
                <p className="text-[14px] text-[#556070]">You claim relief via self-assessment (and/or carry back)</p>
                <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 text-[#E6E8EC] text-2xl">&rarr;</div>
              </div>
              <div className="bg-[#FAFBFC] border border-[#E6E8EC] rounded-lg p-5 text-center">
                <p className="text-[28px] font-bold text-[#17B6C3] mb-2">4</p>
                <p className="text-[14px] text-[#556070]">You track progress over time (seed investing is a long-term horizon)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-14">
            Direct investing vs. investing via a fund
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="bg-white border-[#E6E8EC] p-8 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#17B6C3] rounded-t-lg"></div>
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Users className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Direct investment (hands-on)</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed mb-4">
                You invest directly into a company like Qashivo.
              </p>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Best for investors who want direct exposure, conviction-based bets, and a closer relationship with the founders and thesis.
              </p>
            </Card>

            <Card className="bg-white border-[#E6E8EC] p-8 relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#556070]/30 rounded-t-lg"></div>
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <BarChart3 className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">SEIS funds (portfolio approach)</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed mb-4">
                A professional manager builds a diversified portfolio of SEIS companies.
              </p>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Best for investors who prefer built-in diversification and manager-led selection.
              </p>
            </Card>
          </div>
          <p className="text-[14px] text-[#556070] text-center mt-8 italic">
            Both routes can be valid &mdash; it depends on your time, access, and risk appetite.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-14">
            SEIS vs EIS vs VCT
          </h2>
          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#E6E8EC]">
                  <th className="text-left py-4 pr-6 text-[14px] font-semibold text-[#0B0F17]">Scheme</th>
                  <th className="text-left py-4 pr-6 text-[14px] font-semibold text-[#0B0F17]">Stage</th>
                  <th className="text-left py-4 pr-6 text-[14px] font-semibold text-[#0B0F17]">Income tax relief</th>
                  <th className="text-left py-4 text-[14px] font-semibold text-[#0B0F17]">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#E6E8EC] bg-[#17B6C3]/5">
                  <td className="py-4 pr-6 text-[14px] font-medium text-[#17B6C3]">SEIS</td>
                  <td className="py-4 pr-6 text-[14px] text-[#556070]">Earliest stage</td>
                  <td className="py-4 pr-6 text-[14px] text-[#556070]">50%</td>
                  <td className="py-4 text-[14px] text-[#556070]">Highest reliefs to reflect higher risk</td>
                </tr>
                <tr className="border-b border-[#E6E8EC]">
                  <td className="py-4 pr-6 text-[14px] font-medium text-[#0B0F17]">EIS</td>
                  <td className="py-4 pr-6 text-[14px] text-[#556070]">More established early-stage</td>
                  <td className="py-4 pr-6 text-[14px] text-[#556070]">30%</td>
                  <td className="py-4 text-[14px] text-[#556070]">Lower reliefs, higher annual limits</td>
                </tr>
                <tr>
                  <td className="py-4 pr-6 text-[14px] font-medium text-[#0B0F17]">VCT</td>
                  <td className="py-4 pr-6 text-[14px] text-[#556070]">Later-stage</td>
                  <td className="py-4 pr-6 text-[14px] text-[#556070]">30%</td>
                  <td className="py-4 text-[14px] text-[#556070]">Listed vehicles with different rules, often used for later-stage tax planning</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-6">
            The bottom line
          </h2>
          <div className="max-w-3xl mx-auto space-y-5 mb-14">
            <p className="text-[16px] text-[#556070] leading-relaxed text-center">
              SEIS is the UK&rsquo;s clearest &ldquo;yes&rdquo; to early-stage innovation. It&rsquo;s designed to help investors back high-growth companies earlier &mdash; with real tax incentives that can reduce downside and improve net returns.
            </p>
            <p className="text-[16px] text-[#0B0F17] font-medium leading-relaxed text-center">
              If you believe the biggest value is created before scale, SEIS is the scheme built for that moment.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="text-[26px] font-semibold text-[#0B0F17] mb-4">
            Interested in Qashivo&rsquo;s SEIS round?
          </h2>
          <p className="text-[16px] text-[#556070] max-w-2xl mx-auto mb-8">
            Request the investor pack, see the product loop, and understand how we&rsquo;re building intent-aware working capital intelligence for SMEs.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/investors/contact">
              <Button className="bg-[#17B6C3] hover:bg-[#139CA8] text-white h-12 px-7 rounded-lg text-[15px] font-medium">
                Request Investor Pack
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/investors/contact">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                Book a Call
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-[12px] text-[#556070] leading-relaxed text-center">
            This page is for information only and does not constitute an offer to sell securities or investment advice. Investing in early-stage companies is high risk and you may lose all the money you invest. Tax reliefs depend on individual circumstances, may change, and depend on the company maintaining qualifying status. You should seek independent financial and tax advice before investing.
          </p>
        </div>
      </section>

      <InvestorFooter />
    </div>
  );
}
