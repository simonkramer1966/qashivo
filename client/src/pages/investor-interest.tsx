import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronRight, TrendingUp, Brain, Shield, Users } from 'lucide-react';
import overviewImg from '@assets/Screenshot_2026-01-20_at_16.41.29_1769015667354.png';
import customerProfileImg from '@assets/Screenshot_2026-01-20_at_17.44.39_1769015667358.png';
import customersImg from '@assets/Screenshot_2026-01-20_at_17.48.14_1769015667358.png';
import cashboardImg from '@assets/Screenshot_2026-01-20_at_21.57.35_1769015667358.png';
import forecastImg from '@assets/Screenshot_2026-01-20_at_21.58.10_1769015667358.png';
import actionCentreImg from '@assets/Screenshot_2026-01-20_at_22.11.45_1769015667358.png';

const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone number is required'),
  investorConfirmation: z.boolean().refine(val => val === true, 'You must confirm your investor status'),
});

type FormData = z.infer<typeof formSchema>;

export default function InvestorInterest() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      investorConfirmation: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest('POST', '/api/investor-interest', data);
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: 'Interest registered',
        description: 'Thank you for your interest. We will be in touch shortly.',
      });
    },
    onError: () => {
      toast({
        title: 'Something went wrong',
        description: 'Please try again or contact us directly.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="py-20 px-6 border-b border-slate-100">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-6">
            <svg viewBox="0 0 40 40" className="w-12 h-12 mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 5C11.716 5 5 11.716 5 20C5 28.284 11.716 35 20 35C28.284 35 35 28.284 35 20C35 11.716 28.284 5 20 5Z" stroke="#17B6C3" strokeWidth="2.5" fill="none"/>
              <path d="M15 20L18 23L25 16" stroke="#17B6C3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-light text-slate-900 mb-4 tracking-tight">
            AI that helps you get paid
          </h1>
          <p className="text-xl text-slate-500 mb-8 font-light max-w-2xl mx-auto">
            Supervised AI for credit control, cashflow visibility, and predictable SME payments
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm">
            <Shield className="w-4 h-4" />
            SEIS/EIS eligible · HMRC advance assurance granted
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-16 px-6 border-b border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">The Market</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Late payments cost UK businesses £11 billion each year, causing 14,000 business closures annually. SMEs need better cashflow visibility.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center mb-4">
                <Brain className="w-5 h-5 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">The Technology</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Supervised AI that plans credit control work, captures customer intent from conversations, and executes with human oversight. Context that learns from every interaction.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">The Opportunity</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                £4.8B market with partner-led distribution through accountants. SEIS/EIS eligible with up to 50% tax relief and CGT exemption after 3 years.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Screenshots */}
      <section className="py-16 px-6 border-b border-slate-100 bg-slate-50/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-light text-slate-900 text-center mb-4">The Platform</h2>
          <p className="text-slate-500 text-center mb-12 max-w-2xl mx-auto">
            Qashivo transforms credit control from manual chasing into supervised, intelligent workflows with clearer cashflow visibility.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-slate-100">
              <img src={overviewImg} alt="Dashboard Overview" className="w-full h-48 object-cover object-top" />
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-900">Dashboard Overview</h4>
                <p className="text-xs text-slate-500 mt-1">Real-time cashflow visibility and forecasting</p>
              </div>
            </div>
            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-slate-100">
              <img src={actionCentreImg} alt="Action Centre" className="w-full h-48 object-cover object-top" />
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-900">Action Centre</h4>
                <p className="text-xs text-slate-500 mt-1">AI plans daily work for human approval</p>
              </div>
            </div>
            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-slate-100">
              <img src={forecastImg} alt="Cash Forecast" className="w-full h-48 object-cover object-top" />
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-900">Cash Forecast</h4>
                <p className="text-xs text-slate-500 mt-1">Predictive weekly cash inflow projections</p>
              </div>
            </div>
            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-slate-100">
              <img src={cashboardImg} alt="Cashboard" className="w-full h-48 object-cover object-top" />
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-900">Cashboard</h4>
                <p className="text-xs text-slate-500 mt-1">Invoice status at a glance by customer</p>
              </div>
            </div>
            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-slate-100">
              <img src={customersImg} alt="Customer Behaviour" className="w-full h-48 object-cover object-top" />
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-900">Customer Behaviour</h4>
                <p className="text-xs text-slate-500 mt-1">Payment patterns and reliability scoring</p>
              </div>
            </div>
            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-slate-100">
              <img src={customerProfileImg} alt="Customer Profile" className="w-full h-48 object-cover object-top" />
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-900">Customer Profile</h4>
                <p className="text-xs text-slate-500 mt-1">Communication preferences and history</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="py-16 px-6 border-b border-slate-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-light text-slate-900 text-center mb-4">Financial Trajectory</h2>
          <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">
            Built to reach profitability early with partner-led, capital-efficient growth
          </p>
          
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-light text-slate-900 mb-1">£4.2M</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">ARR by Year 3</div>
            </div>
            <div>
              <div className="text-3xl font-light text-slate-900 mb-1">3,000</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">SME Subscribers</div>
            </div>
            <div>
              <div className="text-3xl font-light text-slate-900 mb-1">23%</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">EBITDA Margin</div>
            </div>
            <div>
              <div className="text-3xl font-light text-slate-900 mb-1">32×</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">LTV:CAC Ratio</div>
            </div>
          </div>

          <div className="mt-12 p-6 bg-slate-50 rounded-lg">
            <h3 className="text-sm font-medium text-slate-900 mb-4">Illustrative Investor Outcomes (Year 3)</h3>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <div className="text-slate-500 mb-1">Conservative</div>
                <div className="text-slate-900">£2-3M ARR · 2-3× exit · 0-50% ROI</div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Base Case</div>
                <div className="text-slate-900">£4-5M ARR · 4× exit · 150-200% ROI</div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Upside</div>
                <div className="text-slate-900">£7-8M ARR · 5-6× exit · 500-600% ROI</div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              These are illustrative examples, not forecasts. SEIS/EIS investors also receive up to 50% tax relief and CGT exemption.
            </p>
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-light text-slate-900 text-center mb-2">Register Interest</h2>
          <p className="text-slate-500 text-center mb-8">
            Receive the investment deck and updates on this SEIS/EIS opportunity
          </p>

          {submitted ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-medium text-slate-900 mb-2">Thank you for your interest</h3>
              <p className="text-slate-500">We'll send the investment deck to your email shortly.</p>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">First Name</label>
                  <input
                    {...form.register('firstName')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                    placeholder="First name"
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Last Name</label>
                  <input
                    {...form.register('lastName')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                    placeholder="Last name"
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-600 mb-1">Email</label>
                <input
                  {...form.register('email')}
                  type="email"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  placeholder="email@example.com"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Phone</label>
                <input
                  {...form.register('phone')}
                  type="tel"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  placeholder="+44 7xxx xxxxxx"
                />
                {form.formState.errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.phone.message}</p>
                )}
              </div>

              <div className="flex items-start gap-3 pt-2">
                <input
                  {...form.register('investorConfirmation')}
                  type="checkbox"
                  className="mt-1 w-4 h-4 text-[#17B6C3] border-slate-300 rounded focus:ring-[#17B6C3]"
                />
                <label className="text-xs text-slate-500 leading-relaxed">
                  I confirm that I am a <strong>High Net Worth</strong> or <strong>Self-Certified Sophisticated Investor</strong> and consent to receiving communications from Qashivo regarding this investment opportunity.
                </label>
              </div>
              {form.formState.errors.investorConfirmation && (
                <p className="text-xs text-red-500">{form.formState.errors.investorConfirmation.message}</p>
              )}

              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full py-3 bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {mutation.isPending ? 'Submitting...' : 'Register Interest'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Risk Disclaimer */}
      <section className="py-8 px-6 border-t border-slate-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-slate-400 text-center leading-relaxed">
            <strong>Important Risk Disclaimer:</strong> Investing in early-stage companies carries risk including total loss of capital. Past performance is not indicative of future results. SEIS/EIS tax reliefs depend on investor circumstances and HMRC approval. The content of this document has not been approved by an authorised person within the meaning of the Financial Services and Markets Act 2000.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-slate-100">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs text-slate-400">
          <div>© 2026 Nexus KPI Limited. Built in London. Backed by innovation. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <a href="mailto:hello@qashivo.com" className="hover:text-slate-600">hello@qashivo.com</a>
            <span>·</span>
            <a href="https://www.qashivo.com" className="hover:text-slate-600">www.qashivo.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
