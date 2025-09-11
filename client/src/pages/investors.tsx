import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ChevronLeft, ChevronRight, Target, TrendingUp, Users, Zap, DollarSign, Calendar, Award, Shield, Globe, Smartphone, BarChart3, PieChart, LineChart } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import investorsHeroImage from "@assets/generated_images/Executive_business_boardroom_meeting_c8b67fac.png";

export default function Investors() {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const pitchSlides = [
    {
      id: 1,
      title: "Qashivo",
      subtitle: "Cashflow Simplified",
      content: (
        <div className="text-center space-y-8">
          <div className="w-24 h-24 bg-[#17B6C3]/10 rounded-3xl flex items-center justify-center mx-auto p-4">
            <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h3 className="text-4xl font-bold text-gray-900 mb-4">AI-Driven Credit Control & Embedded Finance</h3>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Transforming how UK SMEs manage cash flow through intelligent automation and embedded financial services</p>
          </div>
          <div className="flex justify-center space-x-8 text-center">
            <div>
              <div className="text-2xl font-bold text-[#17B6C3]">£250k</div>
              <div className="text-sm text-gray-600">SEIS Round</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#17B6C3]">£2.8B</div>
              <div className="text-sm text-gray-600">Market Size</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#17B6C3]">95%</div>
              <div className="text-sm text-gray-600">Automation</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: "The Problem",
      subtitle: "UK SMEs Are Drowning in Cash Flow Issues",
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-red-600 mb-2">£2.8B</div>
                <div className="text-gray-900 font-semibold mb-2">Late Payment Crisis</div>
                <div className="text-gray-600">Annual cost to UK SMEs from late payments and poor cash flow management</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-orange-600 mb-2">64%</div>
                <div className="text-gray-900 font-semibold mb-2">SMEs Affected</div>
                <div className="text-gray-600">Of UK small businesses struggle with late payments impacting cash flow</div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <h4 className="text-xl font-semibold text-gray-900">Key Pain Points:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Manual follow-up processes consuming 15+ hours/week</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Inconsistent collection strategies reducing recovery rates</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Lack of real-time cash flow visibility</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Limited access to embedded finance solutions</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 3,
      title: "Our Solution",
      subtitle: "AI-Powered Credit Control & Embedded Finance Platform",
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-fit">
                  <Zap className="h-6 w-6 text-[#17B6C3]" />
                </div>
                <CardTitle className="text-lg">AI Credit Control</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>• Automated collection workflows</li>
                  <li>• Smart communication strategies</li>
                  <li>• Predictive risk assessment</li>
                  <li>• Multi-channel outreach</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-fit">
                  <BarChart3 className="h-6 w-6 text-[#17B6C3]" />
                </div>
                <CardTitle className="text-lg">Cash Forecasting</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>• Real-time cash position tracking</li>
                  <li>• Predictive cash flow modeling</li>
                  <li>• Scenario planning tools</li>
                  <li>• Alert system for shortfalls</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-fit">
                  <DollarSign className="h-6 w-6 text-[#17B6C3]" />
                </div>
                <CardTitle className="text-lg">Embedded Finance</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>• Invoice financing integration</li>
                  <li>• Working capital solutions</li>
                  <li>• Open banking connectivity</li>
                  <li>• Alternative credit scoring</li>
                </ul>
              </CardContent>
            </Card>
          </div>
          <div className="bg-[#17B6C3]/5 rounded-xl p-6">
            <h4 className="text-lg font-semibold mb-4 text-center">Platform Benefits</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-[#17B6C3]">95%</div>
                <div className="text-sm">Process Automation</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#17B6C3]">40%</div>
                <div className="text-sm">Faster Collections</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#17B6C3]">25%</div>
                <div className="text-sm">Cost Reduction</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#17B6C3]">15hrs</div>
                <div className="text-sm">Weekly Time Savings</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: "Market Opportunity",
      subtitle: "£2.8B Addressable Market in UK SME Financial Services",
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">Total Addressable Market</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-[#17B6C3] mb-2">£2.8B</div>
                    <div className="text-gray-600">UK SME AR Management Market</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Credit Control Services</span>
                      <span className="font-semibold">£1.2B</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cash Flow Management</span>
                      <span className="font-semibold">£800M</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Embedded Finance</span>
                      <span className="font-semibold">£800M</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">Market Drivers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <TrendingUp className="h-5 w-5 text-[#17B6C3] mt-0.5" />
                    <div>
                      <div className="font-semibold">Growing Late Payment Crisis</div>
                      <div className="text-sm text-gray-600">64% of SMEs affected by payment delays</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Smartphone className="h-5 w-5 text-[#17B6C3] mt-0.5" />
                    <div>
                      <div className="font-semibold">Digital Transformation</div>
                      <div className="text-sm text-gray-600">SMEs adopting AI and automation tools</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Globe className="h-5 w-5 text-[#17B6C3] mt-0.5" />
                    <div>
                      <div className="font-semibold">Open Banking Growth</div>
                      <div className="text-sm text-gray-600">Enabling embedded finance solutions</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-[#17B6C3] mt-0.5" />
                    <div>
                      <div className="font-semibold">Regulatory Support</div>
                      <div className="text-sm text-gray-600">Government initiatives for SME finance</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="bg-gradient-to-r from-[#17B6C3]/10 to-blue-50 rounded-xl p-6">
            <h4 className="text-lg font-semibold mb-4 text-center">Target Market Segments</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#17B6C3]">500K+</div>
                <div className="text-sm font-semibold">Micro Enterprises (1-9 employees)</div>
                <div className="text-xs text-gray-600">Primary target for starter plans</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#17B6C3]">200K+</div>
                <div className="text-sm font-semibold">Small Businesses (10-49 employees)</div>
                <div className="text-xs text-gray-600">Core market for growth plans</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#17B6C3]">35K+</div>
                <div className="text-sm font-semibold">Medium Enterprises (50-249 employees)</div>
                <div className="text-xs text-gray-600">Enterprise solutions target</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 5,
      title: "Business Model",
      subtitle: "Scalable SaaS with Transaction-Based Revenue Streams",
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">Revenue Streams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">SaaS Subscriptions</span>
                      <span className="bg-[#17B6C3]/10 px-2 py-1 rounded text-[#17B6C3] font-semibold">70%</span>
                    </div>
                    <div className="text-sm text-gray-600">Monthly recurring revenue from platform access</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Transaction Fees</span>
                      <span className="bg-[#17B6C3]/10 px-2 py-1 rounded text-[#17B6C3] font-semibold">20%</span>
                    </div>
                    <div className="text-sm text-gray-600">Embedded finance and payment processing</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Premium Add-ons</span>
                      <span className="bg-[#17B6C3]/10 px-2 py-1 rounded text-[#17B6C3] font-semibold">10%</span>
                    </div>
                    <div className="text-sm text-gray-600">Voice AI, custom integrations, white-label</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">Pricing Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Starter (1-50 invoices)</span>
                      <span className="font-semibold">£29/month</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Growth (51-500 invoices)</span>
                      <span className="font-semibold">£99/month</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pro (501-2000 invoices)</span>
                      <span className="font-semibold">£199/month</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Enterprise (Unlimited)</span>
                      <span className="font-semibold">£399/month</span>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>• 30-day free trial</div>
                      <div>• No setup fees</div>
                      <div>• Monthly or annual billing</div>
                      <div>• Custom enterprise pricing</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
            <h4 className="text-lg font-semibold mb-4 text-center">Unit Economics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-emerald-600">£89</div>
                <div className="text-sm">Average Revenue Per User (Monthly)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">£23</div>
                <div className="text-sm">Customer Acquisition Cost</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">3.9x</div>
                <div className="text-sm">LTV:CAC Ratio</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">4.2mo</div>
                <div className="text-sm">Payback Period</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 6,
      title: "Financial Projections",
      subtitle: "Aggressive Growth with Clear Path to Profitability",
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">Revenue Forecast (£000s)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2 font-semibold border-b pb-2">
                    <span></span>
                    <span className="text-center">Year 1</span>
                    <span className="text-center">Year 2</span>
                    <span className="text-center">Year 3</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <span>Revenue</span>
                    <span className="text-center">£89</span>
                    <span className="text-center">£580</span>
                    <span className="text-center">£2,890</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <span>Customers</span>
                    <span className="text-center">85</span>
                    <span className="text-center">485</span>
                    <span className="text-center">2,350</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <span>ARPU (£/mo)</span>
                    <span className="text-center">£89</span>
                    <span className="text-center">£99</span>
                    <span className="text-center">£103</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 border-t pt-2 font-semibold">
                    <span>Net Profit</span>
                    <span className="text-center text-red-600">-£180</span>
                    <span className="text-center text-green-600">£95</span>
                    <span className="text-center text-green-600">£1,120</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">Key Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Break-even Month</span>
                    <span className="font-semibold text-[#17B6C3]">Month 5-6</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer Churn Rate</span>
                    <span className="font-semibold">3.5% monthly</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gross Margin</span>
                    <span className="font-semibold">85%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CAC Payback</span>
                    <span className="font-semibold">4.2 months</span>
                  </div>
                  <div className="flex justify-between">
                    <span>LTV:CAC Ratio</span>
                    <span className="font-semibold">3.9x</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Burn Rate (Year 1)</span>
                    <span className="font-semibold">£22k/month</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-6">
            <h4 className="text-lg font-semibold mb-4 text-center">Investment Returns</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-emerald-600">£250k</div>
                <div className="text-sm">Initial Investment</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">£2.5-5M</div>
                <div className="text-sm">Year 3 ARR Target</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">15-25x</div>
                <div className="text-sm">Projected ROI (5 years)</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 7,
      title: "Competitive Advantage",
      subtitle: "Unique Position in Fragmented Market",
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">Market Landscape</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="font-semibold text-red-600">Legacy Solutions</div>
                      <div className="text-sm text-gray-600">Manual, expensive, limited features</div>
                      <div className="text-xs text-gray-500">Examples: Traditional debt collection agencies</div>
                    </div>
                    <div>
                      <div className="font-semibold text-orange-600">Point Solutions</div>
                      <div className="text-sm text-gray-600">Single-feature tools, no integration</div>
                      <div className="text-xs text-gray-500">Examples: Chaser, Credit Hq</div>
                    </div>
                    <div>
                      <div className="font-semibold text-[#17B6C3]">Qashivo Platform</div>
                      <div className="text-sm text-gray-600">End-to-end AI-driven solution</div>
                      <div className="text-xs text-gray-500">Credit control + forecasting + embedded finance</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">Our Advantages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Zap className="h-5 w-5 text-[#17B6C3] mt-0.5" />
                    <div>
                      <div className="font-semibold">AI-First Architecture</div>
                      <div className="text-sm text-gray-600">Built-in machine learning, not bolted on</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Target className="h-5 w-5 text-[#17B6C3] mt-0.5" />
                    <div>
                      <div className="font-semibold">Complete Platform</div>
                      <div className="text-sm text-gray-600">Credit control + cash flow + embedded finance</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-[#17B6C3] mt-0.5" />
                    <div>
                      <div className="font-semibold">SME-Focused Design</div>
                      <div className="text-sm text-gray-600">Purpose-built for small business needs</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Globe className="h-5 w-5 text-[#17B6C3] mt-0.5" />
                    <div>
                      <div className="font-semibold">Open Banking Integration</div>
                      <div className="text-sm text-gray-600">Real-time financial data connectivity</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="bg-[#17B6C3]/5 rounded-xl p-6">
            <h4 className="text-lg font-semibold mb-4 text-center">Competitive Moats</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="p-3 bg-[#17B6C3]/10 rounded-xl mx-auto mb-3 w-fit">
                  <BarChart3 className="h-6 w-6 text-[#17B6C3]" />
                </div>
                <div className="font-semibold mb-2">Data Network Effects</div>
                <div className="text-sm text-gray-600">AI improves with more customers and transactions</div>
              </div>
              <div className="text-center">
                <div className="p-3 bg-[#17B6C3]/10 rounded-xl mx-auto mb-3 w-fit">
                  <Users className="h-6 w-6 text-[#17B6C3]" />
                </div>
                <div className="font-semibold mb-2">Customer Switching Costs</div>
                <div className="text-sm text-gray-600">Embedded workflows create high retention</div>
              </div>
              <div className="text-center">
                <div className="p-3 bg-[#17B6C3]/10 rounded-xl mx-auto mb-3 w-fit">
                  <Award className="h-6 w-6 text-[#17B6C3]" />
                </div>
                <div className="font-semibold mb-2">First-Mover Advantage</div>
                <div className="text-sm text-gray-600">Early AI + embedded finance integration</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 8,
      title: "Product Roadmap",
      subtitle: "Three-Phase Strategy to Market Leadership",
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-[#17B6C3]/10 to-blue-50 border-[#17B6C3]/20 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Phase 1: AI Credit Control</CardTitle>
                  <Badge className="bg-green-100 text-green-700">LIVE</Badge>
                </div>
                <p className="text-sm text-gray-600">Q4 2024 - Q2 2025</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Automated collection workflows</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">AI-powered email sequences</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Multi-channel communication</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm">Voice AI calling (Q1 2025)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm">Advanced reporting (Q2 2025)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Phase 2: Cash Forecasting</CardTitle>
                  <Badge className="bg-yellow-100 text-yellow-700">DEVELOPMENT</Badge>
                </div>
                <p className="text-sm text-gray-600">Q3 2025 - Q1 2026</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Real-time cash position tracking</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Predictive cash flow modeling</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Scenario planning tools</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Open banking integration</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Automated alerts & recommendations</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Phase 3: Embedded Finance</CardTitle>
                  <Badge className="bg-purple-100 text-purple-700">PLANNED</Badge>
                </div>
                <p className="text-sm text-gray-600">Q2 2026 - Q4 2026</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm">Invoice financing marketplace</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm">Working capital loans</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm">Alternative credit scoring</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm">Partnership integrations</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm">Revenue-based financing</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6">
            <h4 className="text-lg font-semibold mb-4 text-center">Expansion Strategy</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="font-semibold mb-3">Vertical Expansion</div>
                <div className="space-y-2 text-sm">
                  <div>• HR Management & Payroll (2027)</div>
                  <div>• Legal Services & Compliance (2028)</div>
                  <div>• Supply Chain Finance (2029)</div>
                </div>
              </div>
              <div>
                <div className="font-semibold mb-3">Geographic Expansion</div>
                <div className="space-y-2 text-sm">
                  <div>• Ireland & Netherlands (2027)</div>
                  <div>• Germany & France (2028)</div>
                  <div>• European Union rollout (2029)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 9,
      title: "Funding Ask",
      subtitle: "£250k SEIS Investment to Accelerate Growth",
      content: (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-[#17B6C3] mb-4">£250,000</div>
            <div className="text-2xl font-semibold text-gray-900 mb-2">SEIS Investment Round</div>
            <div className="text-lg text-gray-600">25% equity stake in rapidly growing fintech</div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">Use of Funds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Product Development</span>
                      <span className="font-semibold text-[#17B6C3]">40% | £100k</span>
                    </div>
                    <div className="text-sm text-gray-600 ml-4">
                      • AI model enhancement and training<br/>
                      • Voice AI calling development<br/>
                      • Advanced reporting features
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Sales & Marketing</span>
                      <span className="font-semibold text-[#17B6C3]">35% | £87.5k</span>
                    </div>
                    <div className="text-sm text-gray-600 ml-4">
                      • Digital marketing campaigns<br/>
                      • Sales team expansion<br/>
                      • Partner channel development
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Operations</span>
                      <span className="font-semibold text-[#17B6C3]">15% | £37.5k</span>
                    </div>
                    <div className="text-sm text-gray-600 ml-4">
                      • Customer success team<br/>
                      • Infrastructure scaling<br/>
                      • Quality assurance
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Working Capital</span>
                      <span className="font-semibold text-[#17B6C3]">10% | £25k</span>
                    </div>
                    <div className="text-sm text-gray-600 ml-4">
                      • General operating expenses<br/>
                      • Legal and compliance<br/>
                      • Contingency fund
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">SEIS Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-semibold">50% Tax Relief</div>
                      <div className="text-sm text-gray-600">Immediate income tax relief on investment</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Shield className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold">Capital Gains Exemption</div>
                      <div className="text-sm text-gray-600">No CGT on gains if held for 3+ years</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-semibold">Loss Relief</div>
                      <div className="text-sm text-gray-600">Tax relief on any losses against income</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <div className="font-semibold">IHT Relief</div>
                      <div className="text-sm text-gray-600">Inheritance tax relief after 2 years</div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <div className="font-semibold text-green-800 mb-2">Net Investment Cost</div>
                  <div className="text-2xl font-bold text-green-600">£125,000</div>
                  <div className="text-sm text-green-700">After 50% SEIS tax relief</div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="bg-gradient-to-r from-[#17B6C3]/10 to-blue-50 rounded-xl p-6">
            <h4 className="text-lg font-semibold mb-4 text-center">Key Milestones with Funding</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-[#17B6C3]">6 Months</div>
                <div className="text-sm font-semibold">Reach 200+ customers</div>
                <div className="text-xs text-gray-600">Launch voice AI calling</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#17B6C3]">12 Months</div>
                <div className="text-sm font-semibold">£50k+ monthly revenue</div>
                <div className="text-xs text-gray-600">Achieve break-even</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#17B6C3]">18 Months</div>
                <div className="text-sm font-semibold">Series A readiness</div>
                <div className="text-xs text-gray-600">£1M+ ARR target</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 10,
      title: "Investment Summary",
      subtitle: "High-Growth Opportunity with Exceptional Returns",
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-gradient-to-br from-[#17B6C3]/10 to-blue-50 border-[#17B6C3]/20 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">Investment Highlights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-1 bg-[#17B6C3]/20 rounded">
                      <Target className="h-4 w-4 text-[#17B6C3]" />
                    </div>
                    <div>
                      <div className="font-semibold">Massive Market</div>
                      <div className="text-sm text-gray-600">£2.8B UK SME financial services opportunity</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-1 bg-[#17B6C3]/20 rounded">
                      <Zap className="h-4 w-4 text-[#17B6C3]" />
                    </div>
                    <div>
                      <div className="font-semibold">AI-First Platform</div>
                      <div className="text-sm text-gray-600">Proprietary technology with strong moats</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-1 bg-[#17B6C3]/20 rounded">
                      <TrendingUp className="h-4 w-4 text-[#17B6C3]" />
                    </div>
                    <div>
                      <div className="font-semibold">Proven Traction</div>
                      <div className="text-sm text-gray-600">Growing customer base and revenue</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-1 bg-[#17B6C3]/20 rounded">
                      <Users className="h-4 w-4 text-[#17B6C3]" />
                    </div>
                    <div>
                      <div className="font-semibold">Experienced Team</div>
                      <div className="text-sm text-gray-600">Track record in fintech and AI</div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-1 bg-[#17B6C3]/20 rounded">
                      <DollarSign className="h-4 w-4 text-[#17B6C3]" />
                    </div>
                    <div>
                      <div className="font-semibold">SEIS Qualified</div>
                      <div className="text-sm text-gray-600">50% tax relief + capital gains exemption</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">Return Projections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-emerald-600 mb-2">15-25x</div>
                    <div className="text-lg font-semibold">Projected ROI</div>
                    <div className="text-sm text-gray-600">5-year investment horizon</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Year 3 Valuation</span>
                      <span className="font-semibold">£8-12M</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Year 5 Valuation</span>
                      <span className="font-semibold">£25-40M</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span>Your 25% Stake Value</span>
                      <span className="font-semibold text-emerald-600">£6.25-10M</span>
                    </div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-600 mb-1">Net Investment After SEIS</div>
                      <div className="text-2xl font-bold text-gray-900">£125,000</div>
                      <div className="text-xs text-gray-500">50% tax relief applied</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="bg-gradient-to-r from-[#17B6C3] to-[#1396A1] rounded-xl p-8 text-white text-center">
            <h3 className="text-3xl font-bold mb-4">Ready to Join the Future of SME Finance?</h3>
            <p className="text-xl text-white/90 mb-6 max-w-3xl mx-auto">
              Invest in Qashivo today and be part of transforming how UK small businesses manage their cash flow
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-2xl font-bold">£250k</div>
                <div className="text-white/80">Investment Size</div>
              </div>
              <div>
                <div className="text-2xl font-bold">25%</div>
                <div className="text-white/80">Equity Stake</div>
              </div>
              <div>
                <div className="text-2xl font-bold">SEIS</div>
                <div className="text-white/80">Tax Benefits</div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % pitchSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + pitchSlides.length) % pitchSlides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  return (
    <div className="min-h-screen page-gradient">
      {/* Premium Navigation Header */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200/20 fixed w-full z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo Section */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-[#17B6C3]/10 backdrop-blur-sm rounded-xl flex items-center justify-center p-2">
                <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-gray-900" data-testid="text-brand-name">
                  Qashivo
                </h1>
                <p className="text-xs text-[#17B6C3] font-medium tracking-wide uppercase">
                  Cashflow Simplified
                </p>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="hidden lg:flex items-center space-x-8">
              <Link href="/" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-home">
                Home
              </Link>
              <Link href="/features" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-features">
                Features
              </Link>
              <Link href="/ai-capabilities" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-ai">
                AI Capabilities
              </Link>
              <Link href="/pricing" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-pricing">
                Pricing
              </Link>
              <Link href="/about" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-about">
                About
              </Link>
              <Link href="/contact" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-contact">
                Contact
              </Link>
              <Link href="/investors" className="text-[#17B6C3] font-semibold" data-testid="link-nav-investors">
                Investors
              </Link>
            </div>

            {/* CTA Section */}
            <div className="flex items-center space-x-4">
              <Button 
                onClick={handleLogin}
                variant="ghost"
                className="text-gray-700 hover:text-[#17B6C3] hover:bg-[#17B6C3]/5 font-medium"
                data-testid="button-nav-login"
              >
                Sign In
              </Button>
              <Button 
                onClick={handleLogin}
                className="bg-gradient-to-r from-[#17B6C3] to-[#1396A1] hover:from-[#1396A1] hover:to-[#117A85] text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                data-testid="button-nav-get-started"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-700"
                data-testid="button-mobile-menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Background Image */}
      <section 
        className="relative pt-32 pb-20 bg-cover bg-center"
        style={{ backgroundImage: `url(${investorsHeroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#17B6C3]/85 via-[#1396A1]/80 to-slate-900/85"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-white/20 text-white border-white/30 mb-6 backdrop-blur-sm" data-testid="badge-investors-hero">
              Investment Opportunity
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-8" data-testid="text-investors-hero-title">
              Investors
            </h1>
            <p className="text-xl text-white/90 max-w-4xl mx-auto leading-relaxed" data-testid="text-investors-hero-description">
              Join us in revolutionizing SME financial management with AI-driven solutions. We're building the complete platform that transforms cash flow operations and embedded finance.
            </p>
          </div>

          {/* Investment Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-stat-market-size">£24B</div>
              <div className="text-white/80">UK SME AR Market</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-stat-automation">95%</div>
              <div className="text-white/80">Process Automation</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-stat-growth">3x</div>
              <div className="text-white/80">Revenue Growth Target</div>
            </div>
          </div>
        </div>
      </section>

      {/* Investor Pitch Deck */}
      <section className="py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Pitch Deck Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-pitch-deck-title">
              Investor Pitch Deck
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Comprehensive overview of Qashivo's market opportunity, solution, and investment proposition
            </p>
          </div>

          {/* Slide Navigation Dots */}
          <div className="flex justify-center mb-8">
            <div className="flex space-x-2">
              {pitchSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                    currentSlide === index ? 'bg-[#17B6C3]' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  data-testid={`button-slide-dot-${index}`}
                />
              ))}
            </div>
          </div>

          {/* Main Slide Display */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl min-h-[600px]" data-testid="card-pitch-slide">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-[#17B6C3]/5 to-blue-50/50">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-3xl font-bold text-gray-900" data-testid="text-slide-title">
                    {pitchSlides[currentSlide].title}
                  </CardTitle>
                  <p className="text-lg text-gray-600 mt-2" data-testid="text-slide-subtitle">
                    {pitchSlides[currentSlide].subtitle}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">
                    Slide {currentSlide + 1} of {pitchSlides.length}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {pitchSlides[currentSlide].content}
            </CardContent>
          </Card>

          {/* Navigation Controls */}
          <div className="flex justify-between items-center mt-8">
            <Button
              onClick={prevSlide}
              variant="outline"
              className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
              disabled={currentSlide === 0}
              data-testid="button-prev-slide"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex space-x-2">
              {pitchSlides.map((slide, index) => (
                <Button
                  key={slide.id}
                  onClick={() => goToSlide(index)}
                  variant={currentSlide === index ? "default" : "outline"}
                  className={
                    currentSlide === index
                      ? "bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                      : "border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                  }
                  size="sm"
                  data-testid={`button-slide-${index}`}
                >
                  {index + 1}
                </Button>
              ))}
            </div>

            <Button
              onClick={nextSlide}
              variant="outline"
              className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
              disabled={currentSlide === pitchSlides.length - 1}
              data-testid="button-next-slide"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {/* Call to Action Section */}
          <div className="mt-16 text-center">
            <Card className="bg-gradient-to-r from-[#17B6C3] to-[#1396A1] text-white border-0 shadow-xl">
              <CardContent className="p-8">
                <h3 className="text-3xl font-bold mb-4">Ready to Transform SME Finance?</h3>
                <p className="text-xl text-white/90 mb-6 max-w-3xl mx-auto">
                  Join us in building the future of AI-driven credit control and embedded finance for UK SMEs
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
                  <Button
                    className="bg-white text-[#17B6C3] hover:bg-gray-100 font-semibold px-8 py-3"
                    data-testid="button-download-deck"
                  >
                    Download Full Deck
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white text-white hover:bg-white/10 font-semibold px-8 py-3"
                    data-testid="button-schedule-meeting"
                  >
                    Schedule a Meeting
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2025 Qashivo Limited. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}