import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { Loader2, CheckCircle, Users, Clock, CreditCard, Building } from 'lucide-react';

const clientRegistrationSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  contactName: z.string().min(2, 'Contact name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  website: z.string().url('Please enter a valid website URL').optional().or(z.literal('')),
  monthlyRevenue: z.string().min(1, 'Please select your monthly revenue range')
});

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

  const form = useForm<ClientRegistrationForm>({
    resolver: zodResolver(clientRegistrationSchema),
    defaultValues: {
      companyName: '',
      contactName: '',
      email: '',
      phone: '',
      website: '',
      monthlyRevenue: ''
    }
  });

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
        <Card className="w-full max-w-2xl bg-white/80 backdrop-blur-sm border-white/50 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="p-4 bg-green-500/10 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Welcome to Qashivo!</h1>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Your 30-day trial has started successfully. You'll receive an email with login details and next steps 
              to start automating your debt collection and improving cash flow.
            </p>
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Start Your Free Trial</h1>
          <p className="text-lg text-slate-600">
            Get paid 2 weeks faster with automated debt collection - £29/month after trial
          </p>
        </div>

        {/* Benefits Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl text-center">
            <CardContent className="p-6">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-fit mx-auto mb-4">
                <Clock className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <CardTitle className="text-lg mb-2">30-Day Free Trial</CardTitle>
              <p className="text-slate-600 text-sm">
                Full access to all features. No credit card required.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl text-center">
            <CardContent className="p-6">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-fit mx-auto mb-4">
                <Building className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <CardTitle className="text-lg mb-2">Simple Setup</CardTitle>
              <p className="text-slate-600 text-sm">
                Connect your Xero account in 60 seconds and start automating.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl text-center">
            <CardContent className="p-6">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-fit mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <CardTitle className="text-lg mb-2">Get Paid Faster</CardTitle>
              <p className="text-slate-600 text-sm">
                Reduce overdue invoices by 60% and improve cash flow.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Registration Form */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl font-bold">Company Information</CardTitle>
            <CardDescription className="text-slate-600">
              Tell us about your business to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-slate-700">Company Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your Company Ltd" 
                            className="bg-white/70 border-gray-200/30"
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
                        <FormLabel className="font-medium text-slate-700">Contact Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="John Smith" 
                            className="bg-white/70 border-gray-200/30"
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
                        <FormLabel className="font-medium text-slate-700">Email Address *</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="john@yourcompany.com" 
                            className="bg-white/70 border-gray-200/30"
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
                        <FormLabel className="font-medium text-slate-700">Phone Number *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="+44 123 456 7890" 
                            className="bg-white/70 border-gray-200/30"
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
                        <FormLabel className="font-medium text-slate-700">Website (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://yourcompany.com" 
                            className="bg-white/70 border-gray-200/30"
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
                        <FormLabel className="font-medium text-slate-700">Monthly Revenue *</FormLabel>
                        <FormControl>
                          <select 
                            className="w-full p-2 bg-white/70 border border-gray-200/30 rounded-md"
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

                <div className="pt-6 border-t border-slate-200/50">
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
                  
                  <p className="text-center text-sm text-slate-500 mt-4">
                    By signing up, you agree to our Terms of Service and Privacy Policy.<br/>
                    30-day free trial, then £29/month. Cancel anytime.
                  </p>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-slate-600">
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