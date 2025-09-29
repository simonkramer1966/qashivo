import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
import { Loader2, CheckCircle, Users, Clock, CreditCard } from 'lucide-react';

const partnerRegistrationSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  contactName: z.string().min(2, 'Contact name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  website: z.string().url('Please enter a valid website URL').optional().or(z.literal('')),
  expectedClients: z.string().min(1, 'Please estimate number of expected clients')
});

type PartnerRegistrationForm = z.infer<typeof partnerRegistrationSchema>;

const partnerRegistrationMutation = async (data: PartnerRegistrationForm) => {
  const response = await fetch('/api/partner/register', {
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

export default function PartnerRegistration() {
  const { toast } = useToast();
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<PartnerRegistrationForm>({
    resolver: zodResolver(partnerRegistrationSchema),
    defaultValues: {
      companyName: '',
      contactName: '',
      email: '',
      phone: '',
      website: '',
      expectedClients: ''
    }
  });

  const registration = useMutation({
    mutationFn: partnerRegistrationMutation,
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: "Welcome to Qashivo Partners!",
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

  const onSubmit = (data: PartnerRegistrationForm) => {
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
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Welcome to Qashivo Partners!</h1>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Your 30-day trial has started successfully. You'll receive an email with login details and next steps 
              to start adding clients and managing collections.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-login"
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Join Qashivo Partners</h1>
          <p className="text-lg text-slate-600">
            Start your 30-day free trial and help your clients recover more revenue
          </p>
        </div>

        {/* Benefits Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardContent className="p-6 text-center">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <Clock className="h-6 w-6 text-[#17B6C3]" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">30-Day Free Trial</h3>
              <p className="text-sm text-slate-600">No credit card required. Full access to all partner features.</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardContent className="p-6 text-center">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <Users className="h-6 w-6 text-[#17B6C3]" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Manage Multiple Clients</h3>
              <p className="text-sm text-slate-600">Unified dashboard to oversee all your clients' collections.</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardContent className="p-6 text-center">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-[#17B6C3]" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Wholesale Pricing</h3>
              <p className="text-sm text-slate-600">Generous affiliate partner pricing giving better margins for your business.</p>
            </CardContent>
          </Card>
        </div>

        {/* Registration Form */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-slate-900">Create Your Partner Account</CardTitle>
            <CardDescription>
              Tell us about your business and start helping clients recover revenue
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
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
                        <FormLabel>Contact Name *</FormLabel>
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
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="john@company.com" 
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
                        <FormLabel>Phone Number *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="+44 1234 567890" 
                            className="bg-white/70 border-gray-200/30"
                            data-testid="input-phone"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://company.com" 
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
                    name="expectedClients"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Number of Clients *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="5-10" 
                            className="bg-white/70 border-gray-200/30"
                            data-testid="input-expected-clients"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white py-3 text-lg"
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
                
                <p className="text-xs text-slate-500 text-center">
                  By creating an account, you agree to our Terms of Service and Privacy Policy. 
                  No credit card required for the 30-day trial.
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}