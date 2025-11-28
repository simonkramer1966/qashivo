import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, Brain, Zap, TrendingUp, Shield, Check, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@assets/generated_images/Advanced_AI_technology_center_4b230f51.png";
import logo from "@assets/Main Nexus Logo copy_1763392904110.png";
import xeroLogo from "@assets/Xero_software_logo.svg_1763402921236.png";
import quickbooksLogo from "@assets/quickbnooks_1763403237750.png";
import sageLogo from "@assets/sage_1763403374233.png";

const salesEnquirySchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  company: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().min(10, "Please provide more details (at least 10 characters)"),
  enquiryType: z.enum(['demo', 'pricing', 'partnership', 'general'])
});

type SalesEnquiryForm = z.infer<typeof salesEnquirySchema>;

export default function Home() {
  const [, setLocation] = useLocation();
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<SalesEnquiryForm>({
    resolver: zodResolver(salesEnquirySchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      phone: "",
      message: "",
      enquiryType: "general"
    }
  });
  
  const submitMutation = useMutation({
    mutationFn: async (data: SalesEnquiryForm) => {
      const response = await apiRequest('POST', '/api/public/sales-enquiry', data);
      return response;
    },
    onSuccess: () => {
      setFormSubmitted(true);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send enquiry",
        description: error.message || "Please try again or email us directly.",
        variant: "destructive"
      });
    }
  });
  
  const onSubmit = (data: SalesEnquiryForm) => {
    submitMutation.mutate(data);
  };
  
  const handleOpenSalesForm = (enquiryType: 'demo' | 'pricing' | 'partnership' | 'general' = 'general') => {
    form.setValue('enquiryType', enquiryType);
    setFormSubmitted(false);
    setShowSalesForm(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <img src={logo} alt="Qashivo Logo" className="h-8 w-8" />
                <h1 className="text-2xl font-bold text-[#17B6C3]">Qashivo</h1>
              </div>
              <div className="hidden md:flex space-x-6">
                <a href="#features" className="text-gray-700 hover:text-[#17B6C3] transition-colors">
                  Features
                </a>
                <a href="#integrations" className="text-gray-700 hover:text-[#17B6C3] transition-colors">
                  Integrations
                </a>
                <a href="#pricing" className="text-gray-700 hover:text-[#17B6C3] transition-colors">
                  Pricing
                </a>
                <a href="#partners" className="text-gray-700 hover:text-[#17B6C3] transition-colors">
                  Partners
                </a>
              </div>
            </div>
            <Button
              onClick={() => setLocation("/login")}
              variant="outline"
              className="border-[#17B6C3] text-[#17B6C3] hover:bg-[#17B6C3] hover:text-white"
              data-testid="button-login"
            >
              Login
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="relative overflow-hidden min-h-[600px] md:min-h-[700px] flex items-center"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/70"></div>
        
        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              We're Not Building Software for Credit Controllers.
            </h1>
            <h2 className="text-3xl md:text-4xl font-bold text-[#17B6C3] mb-6">
              Qashivo IS the credit controller.
            </h2>
            <p className="text-xl text-gray-200 mb-8">
              AI-first cashflow management that flips traditional software on its head.
              <br />
              From invoice to enforcement, turning compliance into cash.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8"
                onClick={() => setLocation("/signup")}
                data-testid="button-get-started"
              >
                See It In Action
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* The AI-First Difference */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              The AI-First Difference
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Accounts Receivable software is for Credit Controllers who chase invoices.
              <br />
              Qashivo is for people who would rather not.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Traditional Software */}
            <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-200">
              <div className="text-red-500 mb-4">
                <span className="text-2xl font-bold">❌</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Traditional Software</h3>
              <p className="text-gray-600 mb-6">Software with AI features</p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-gray-400 mr-3">•</span>
                  <span className="text-gray-700">Shows you dashboards of invoices you need to action</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gray-400 mr-3">•</span>
                  <span className="text-gray-700">AI suggests what to do next—you click and execute</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gray-400 mr-3">•</span>
                  <span className="text-gray-700">You review, approve, and manage every step</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gray-400 mr-3">•</span>
                  <span className="text-gray-700">You're still doing the work</span>
                </li>
              </ul>
            </div>

            {/* Qashivo AI-First */}
            <div className="bg-gradient-to-br from-[#17B6C3]/10 to-teal-50 rounded-2xl p-8 border-2 border-[#17B6C3]">
              <div className="text-[#17B6C3] mb-4">
                <span className="text-2xl font-bold">✓</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Qashivo AI-First</h3>
              <p className="text-[#17B6C3] font-semibold mb-6">AI that does the work</p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-3 h-5 w-5 mt-1 flex-shrink-0" />
                  <span className="text-gray-900 font-medium">"I collected £47K overnight, sent 23 follow-ups, updated your forecast"</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-3 h-5 w-5 mt-1 flex-shrink-0" />
                  <span className="text-gray-900 font-medium">AI sends collection emails automatically based on debtor behavior</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-3 h-5 w-5 mt-1 flex-shrink-0" />
                  <span className="text-gray-900 font-medium">You set rules, AI executes continuously</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-3 h-5 w-5 mt-1 flex-shrink-0" />
                  <span className="text-gray-900 font-medium">AI is doing the work—you supervise</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Two AIs, One Platform */}
      <section className="py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Two AIs, One Platform
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Meet your new finance team: THE Credit Controller + THE CFO
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* THE Credit Controller */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Brain className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">THE Credit Controller</h3>
              <p className="text-gray-600 mb-6">
                Autonomous collections that work 24/7. Not software for credit controllers—the AI is the credit controller.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <Zap className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Auto-sends personalized collection emails based on debtor history</span>
                </li>
                <li className="flex items-start">
                  <Zap className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Makes AI-powered voice calls to late payers</span>
                </li>
                <li className="flex items-start">
                  <Zap className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Detects broken payment promises and escalates automatically</span>
                </li>
              </ul>
            </div>

            {/* THE CFO */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">THE CFO</h3>
              <p className="text-gray-600 mb-6">
                Bayesian cashflow forecasting that learns from every invoice. AI-driven insights, not static reports.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <TrendingUp className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Predicts cashflow 90 days out with machine learning</span>
                </li>
                <li className="flex items-start">
                  <TrendingUp className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Analyzes debtor payment patterns to reduce debtor days</span>
                </li>
                <li className="flex items-start">
                  <TrendingUp className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Alerts you when you'll run short—before it happens</span>
                </li>
                <li className="flex items-start">
                  <TrendingUp className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Voice-driven: "What's my cashflow next month?"</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Late Payment Act Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 md:p-16 text-white">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center bg-[#17B6C3]/20 rounded-full px-4 py-2 mb-6">
                  <Shield className="h-5 w-5 text-[#17B6C3] mr-2" />
                  <span className="text-sm font-semibold text-[#17B6C3]">Regulatory Tailwind</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Built for the UK Late Payment Act
                </h2>
                <p className="text-xl text-gray-300 mb-8">
                  The UK Government's new Late Payment Act makes compliance mandatory. 
                  Qashivo turns this legal obligation into automation, cashflow, and profit.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-[#17B6C3]/20 rounded-lg p-2 mr-4">
                      <Check className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">Auto-Generated Statutory Notices</h4>
                      <p className="text-gray-400">Compliant Late Payment Notices ready for enforcement</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-[#17B6C3]/20 rounded-lg p-2 mr-4">
                      <Check className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">Automated Interest Calculations</h4>
                      <p className="text-gray-400">Apply statutory interest and compensation instantly</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-[#17B6C3]/20 rounded-lg p-2 mr-4">
                      <Check className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">Automated Dispute Handling</h4>
                      <p className="text-gray-400">AI manages invoice disputes and queries efficiently</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <div className="text-5xl font-bold text-[#17B6C3] mb-2">£11B</div>
                <p className="text-gray-300 mb-6">Lost to late payments each year in the UK</p>
                <div className="text-5xl font-bold text-[#17B6C3] mb-2">£26B</div>
                <p className="text-gray-300 mb-6">Outstanding in late payments at any given time</p>
                <div className="text-5xl font-bold text-[#17B6C3] mb-2">14K</div>
                <p className="text-gray-300">Business closures per year due to late payments</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Connects to Your Accounting Software
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              60-second connection to Xero, QuickBooks, or Sage. AI starts working immediately.
            </p>
          </div>
          <div className="flex justify-center items-center gap-12 flex-wrap">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50 hover:shadow-xl transition-shadow w-48 h-32 flex items-center justify-center">
              <img src={xeroLogo} alt="Xero" className="max-h-16 max-w-full object-contain" />
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50 hover:shadow-xl transition-shadow w-48 h-32 flex items-center justify-center">
              <img src={quickbooksLogo} alt="QuickBooks" className="max-h-16 max-w-full object-contain" />
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50 hover:shadow-xl transition-shadow w-48 h-32 flex items-center justify-center">
              <img src={sageLogo} alt="Sage" className="max-h-16 max-w-full object-contain" />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Pay for results, not seats. Our AI-first model means you pay based on value delivered.
            </p>
            <p className="text-sm text-gray-500 mt-4">Plus call & SMS charges apply</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Micro */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-[#17B6C3] transition-colors flex flex-col h-full">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Micro</h3>
              <p className="text-gray-600 mb-4 text-sm">For small businesses</p>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">£49</span>
                <span className="text-gray-600 text-sm">/month</span>
              </div>
              <ul className="space-y-2 mb-6 flex-grow">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Up to 100 invoices/month</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">AI collections automation</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Email automation</span>
                </li>
              </ul>
              <Button
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm"
                onClick={() => setLocation("/signup")}
                data-testid="button-pricing-micro"
              >
                Start Free Trial
              </Button>
            </div>

            {/* Starter */}
            <div className="bg-gradient-to-br from-[#17B6C3] to-teal-600 rounded-2xl p-6 text-white relative flex flex-col h-full">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-xs font-semibold">
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <p className="text-white/90 mb-4 text-sm">Growing SMEs</p>
              <div className="mb-4">
                <span className="text-3xl font-bold">£149</span>
                <span className="text-white/90 text-sm">/month</span>
              </div>
              <ul className="space-y-2 mb-6 flex-grow">
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Up to 500 invoices/month</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Everything in Micro</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">SMS automation</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">AI voice calling</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Dispute handling</span>
                </li>
              </ul>
              <Button
                className="w-full bg-white hover:bg-gray-100 text-[#17B6C3] text-sm"
                onClick={() => setLocation("/signup")}
                data-testid="button-pricing-starter"
              >
                Start Free Trial
              </Button>
            </div>

            {/* Professional */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-[#17B6C3] transition-colors flex flex-col h-full">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Professional</h3>
              <p className="text-gray-600 mb-4 text-sm">Established businesses</p>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">£499</span>
                <span className="text-gray-600 text-sm">/month</span>
              </div>
              <ul className="space-y-2 mb-6 flex-grow">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Up to 2,000 invoices/month</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Everything in Starter</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Debt Recovery</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">CFO Cashflow Forecasting</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Priority support</span>
                </li>
              </ul>
              <Button
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white text-sm"
                onClick={() => setLocation("/signup")}
                data-testid="button-pricing-professional"
              >
                Start Free Trial
              </Button>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-[#17B6C3] transition-colors flex flex-col h-full">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Enterprise</h3>
              <p className="text-gray-600 mb-4 text-sm">Custom solutions</p>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">Custom</span>
              </div>
              <ul className="space-y-2 mb-6 flex-grow">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Unlimited invoices</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Everything in Professional</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Multi-entity support</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Dedicated account manager</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Custom integrations</span>
                </li>
              </ul>
              <Button
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm"
                onClick={() => setLocation("/signup")}
                data-testid="button-pricing-enterprise"
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Partners */}
      <section id="partners" className="py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Partner with Qashivo
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Join our network of accounting firms and financial advisors offering AI-powered cashflow management to their clients.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Accountants */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 flex flex-col">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Brain className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Accounting Firms</h3>
              <p className="text-gray-600 mb-6">
                Offer your clients cutting-edge AI cashflow management. Earn recurring revenue while reducing client churn.
              </p>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">White-label partnership options</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Revenue share on client referrals</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Dedicated partner portal</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Training and support</span>
                </li>
              </ul>
              <Button
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white mt-auto"
                onClick={() => setLocation("/signup")}
                data-testid="button-partner-accountant"
              >
                Become a Partner
              </Button>
            </div>

            {/* Financial Advisors */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 flex flex-col">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Financial Advisors</h3>
              <p className="text-gray-600 mb-6">
                Help your SME clients improve cashflow and reduce financial stress with autonomous AI management.
              </p>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Referral commission program</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Client dashboard access</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Co-branded materials</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Ongoing partner education</span>
                </li>
              </ul>
              <Button
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white mt-auto"
                onClick={() => setLocation("/signup")}
                data-testid="button-partner-advisor"
              >
                Join as Advisor
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Ready to Let AI Run Your Cashflow?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join forward-thinking SMEs who've replaced manual credit control with autonomous AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8"
              onClick={() => setLocation("/signup")}
              data-testid="button-start-free"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-[#17B6C3] text-[#17B6C3] hover:bg-[#17B6C3] hover:text-white text-lg px-8"
              onClick={() => handleOpenSalesForm('general')}
              data-testid="button-talk-to-sales"
            >
              Talk to Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-[#17B6C3] mb-4">Qashivo</h3>
              <p className="text-gray-400">AI that gets you paid</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-[#17B6C3] transition-colors">Features</a></li>
                <li><a href="#integrations" className="hover:text-[#17B6C3] transition-colors">Integrations</a></li>
                <li><a href="#pricing" className="hover:text-[#17B6C3] transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#partners" className="hover:text-[#17B6C3] transition-colors">Partners</a></li>
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">About</a></li>
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>© 2025 Qashivo. All rights reserved.</p>
          </div>
        </div>
      </footer>
      
      {/* Sales Enquiry Dialog */}
      <Dialog open={showSalesForm} onOpenChange={setShowSalesForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              {formSubmitted ? "Thank You!" : "Talk to Our Team"}
            </DialogTitle>
            <DialogDescription>
              {formSubmitted 
                ? "We've received your enquiry and will be in touch shortly." 
                : "Fill in your details and we'll get back to you within 24 hours."}
            </DialogDescription>
          </DialogHeader>
          
          {formSubmitted ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-gray-600 mb-6">
                One of our team members will reach out to you soon.
              </p>
              <Button
                onClick={() => setShowSalesForm(false)}
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              >
                Close
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your name" 
                            {...field} 
                            data-testid="input-enquiry-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="you@company.com" 
                            {...field} 
                            data-testid="input-enquiry-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Company name" 
                            {...field} 
                            data-testid="input-enquiry-company"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="+44 ..." 
                            {...field} 
                            data-testid="input-enquiry-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="enquiryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What are you interested in?</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-enquiry-type">
                            <SelectValue placeholder="Select an option" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="demo">Product Demo</SelectItem>
                          <SelectItem value="pricing">Pricing Information</SelectItem>
                          <SelectItem value="partnership">Partnership Opportunities</SelectItem>
                          <SelectItem value="general">General Enquiry</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell us about your business and how we can help..."
                          className="min-h-[100px]"
                          {...field} 
                          data-testid="textarea-enquiry-message"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSalesForm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitMutation.isPending}
                    className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                    data-testid="button-submit-enquiry"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Enquiry"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
