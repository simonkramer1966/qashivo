import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, Users, Clock, CreditCard, Building } from 'lucide-react';

const clientRegistrationSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  contactName: z.string().min(2, 'Contact name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  website: z.string().url('Please enter a valid website URL').optional().or(z.literal('')),
  monthlyRevenue: z.string().min(1, 'Please select your monthly revenue range'),
  selectedPlan: z.enum(['standard', 'premium'], { required_error: 'Please select a plan' })
});

const PLAN_DETAILS = {
  standard: {
    name: 'Standard',
    price: '£49',
    features: ['Automated invoicing', 'Basic collections', 'Email integration', 'Monthly reports']
  },
  premium: {
    name: 'Premium', 
    price: '£99',
    features: ['Everything in Standard', 'Advanced AI collections', 'SMS integration', 'Real-time analytics', 'Priority support']
  }
} as const;

type ClientRegistrationForm = z.infer<typeof clientRegistrationSchema>;

const clientRegistrationMutation = async (data: ClientRegistrationForm) => {
  const response = await fetch('/api/client/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Registration failed');
  }
  
  return response.json();
};

export default function ClientRegistration() {
  const { toast } = useToast();
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'standard' | 'premium'>('standard');

  const form = useForm<ClientRegistrationForm>({
    resolver: zodResolver(clientRegistrationSchema),
    defaultValues: {
      companyName: '',
      contactName: '',
      email: '',
      phone: '',
      website: '',
      monthlyRevenue: '',
      selectedPlan: 'standard'
    }
  });

  // Get plan from URL parameters and sync with form
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const planParam = urlParams.get('plan');
    if (planParam === 'standard' || planParam === 'premium') {
      setSelectedPlan(planParam);
      form.setValue('selectedPlan', planParam);
    }
  }, [form]);

  const registration = useMutation({
    mutationFn: clientRegistrationMutation,
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: "Welcome to Qashivo!",
        description: "Your 30-day trial has started. Check your email for next steps.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "There was a problem creating your account. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: ClientRegistrationForm) => {
    registration.mutate(data);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-background/80 backdrop-blur-sm border-white/50 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="p-4 bg-green-500/10 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-4">Welcome to Qashivo!</h1>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Your 30-day {PLAN_DETAILS[selectedPlan].name} plan trial has started successfully. You'll receive an email with login details and next steps 
              to start automating your debt collection and improving cash flow.
            </p>
            <div className="bg-muted rounded-lg p-4 mb-6">
              <h3 className="font-medium text-foreground mb-2">Your Plan: {PLAN_DETAILS[selectedPlan].name}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                After your trial, you'll be billed {PLAN_DETAILS[selectedPlan].price}/month
              </p>
              <div className="text-xs text-muted-foreground">
                Features: {PLAN_DETAILS[selectedPlan].features.slice(0, 2).join(', ')}...
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => window.location.href = '/signin'}
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-signin"
              >
                Sign In to Dashboard
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/'}
                className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                data-testid="button-home"
              >
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Start Your Free Trial</h1>
          <p className="text-lg text-muted-foreground">
            Get paid 2 weeks faster with automated debt collection - {PLAN_DETAILS[selectedPlan].price}/month after trial
          </p>
          <div className="inline-flex items-center bg-background/60 backdrop-blur-sm border border-white/40 rounded-full px-4 py-2 mt-2">
            <span className="text-sm font-medium text-foreground">
              Selected: {PLAN_DETAILS[selectedPlan].name} Plan ({PLAN_DETAILS[selectedPlan].price}/month)
            </span>
          </div>
        </div>

        {/* Benefits Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-background/70 backdrop-blur-md border-0 shadow-xl text-center">
            <CardContent className="p-6">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-fit mx-auto mb-4">
                <Clock className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <CardTitle className="text-lg mb-2">30-Day Free Trial</CardTitle>
              <p className="text-muted-foreground text-sm">
                Full access to all features. No credit card required.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background/70 backdrop-blur-md border-0 shadow-xl text-center">
            <CardContent className="p-6">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-fit mx-auto mb-4">
                <Building className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <CardTitle className="text-lg mb-2">Simple Setup</CardTitle>
              <p className="text-muted-foreground text-sm">
                Connect your Xero account in 60 seconds and start automating.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background/70 backdrop-blur-md border-0 shadow-xl text-center">
            <CardContent className="p-6">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-fit mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <CardTitle className="text-lg mb-2">Get Paid Faster</CardTitle>
              <p className="text-muted-foreground text-sm">
                Reduce overdue invoices by 60% and improve cash flow.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Registration Form */}
        <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-xl">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl font-bold">Company Information</CardTitle>
            <CardDescription className="text-muted-foreground">
              Tell us about your business to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Plan Selection */}
                <div className="mb-8 p-6 bg-muted/50 rounded-lg border border-border/30">
                  <FormField
                    control={form.control}
                    name="selectedPlan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-foreground text-base">Select Your Plan *</FormLabel>
                        <FormControl>
                          <Select 
                            value={field.value} 
                            onValueChange={(value: 'standard' | 'premium') => {
                              field.onChange(value);
                              setSelectedPlan(value);
                            }}
                            data-testid="select-plan"
                          >
                            <SelectTrigger className="bg-background border-border">
                              <SelectValue placeholder="Choose your plan" />
                            </SelectTrigger>
                            <SelectContent className="bg-background">
                              <SelectItem value="standard">
                                <div className="flex items-center justify-between w-full">
                                  <div>
                                    <div className="font-medium">Standard Plan</div>
                                    <div className="text-sm text-muted-foreground">Perfect for small businesses</div>
                                  </div>
                                  <div className="ml-4 font-bold text-foreground">£49/month</div>
                                </div>
                              </SelectItem>
                              <SelectItem value="premium">
                                <div className="flex items-center justify-between w-full">
                                  <div>
                                    <div className="font-medium">Premium Plan</div>
                                    <div className="text-sm text-muted-foreground">Advanced features & priority support</div>
                                  </div>
                                  <div className="ml-4 font-bold text-foreground">£99/month</div>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                        
                        {/* Plan Features */}
                        <div className="mt-4 p-4 bg-background/60 rounded-lg border border-border/20">
                          <h4 className="font-medium text-foreground mb-2">
                            {PLAN_DETAILS[selectedPlan].name} Plan Includes:
                          </h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {PLAN_DETAILS[selectedPlan].features.map((feature, index) => (
                              <li key={index} className="flex items-center">
                                <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-3 pt-3 border-t border-border/30">
                            <p className="text-sm font-medium text-foreground">
                              30-day free trial, then {PLAN_DETAILS[selectedPlan].price}/month
                            </p>
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-foreground">Company Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your Company Ltd" 
                            className="bg-background/70 border-border/30"
                            data-testid="input-company-name"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-foreground">Contact Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="John Smith" 
                            className="bg-background/70 border-border/30"
                            data-testid="input-contact-name"
                            {...field} 
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
                        <FormLabel className="font-medium text-foreground">Email Address *</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="john@yourcompany.com" 
                            className="bg-background/70 border-border/30"
                            data-testid="input-email"
                            {...field} 
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
                        <FormLabel className="font-medium text-foreground">Phone Number *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="+44 123 456 7890" 
                            className="bg-background/70 border-border/30"
                            data-testid="input-phone"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-foreground">Website (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://yourcompany.com" 
                            className="bg-background/70 border-border/30"
                            data-testid="input-website"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="monthlyRevenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-foreground">Monthly Revenue *</FormLabel>
                        <FormControl>
                          <select 
                            className="w-full p-2 bg-background/70 border border-border/30 rounded-md"
                            data-testid="select-monthly-revenue"
                            {...field}
                          >
                            <option value="">Select revenue range</option>
                            <option value="0-10k">£0 - £10,000</option>
                            <option value="10k-50k">£10,000 - £50,000</option>
                            <option value="50k-100k">£50,000 - £100,000</option>
                            <option value="100k-500k">£100,000 - £500,000</option>
                            <option value="500k+">£500,000+</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="pt-6 border-t border-border/50">
                  <Button 
                    type="submit" 
                    className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white font-semibold py-3 text-lg"
                    disabled={registration.isPending}
                    data-testid="button-register"
                  >
                    {registration.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating Your Account...
                      </>
                    ) : (
                      'Start Free Trial'
                    )}
                  </Button>
                  
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    By signing up, you agree to our Terms of Service and Privacy Policy.<br/>
                    30-day free trial, then {PLAN_DETAILS[selectedPlan].price}/month. Cancel anytime.
                  </p>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <a href="/signin" className="text-[#17B6C3] hover:underline font-medium">
              Sign in here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}