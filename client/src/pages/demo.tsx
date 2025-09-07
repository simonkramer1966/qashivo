import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight, 
  Play,
  Upload,
  Users,
  BarChart3,
  Zap,
  CheckCircle,
  Phone,
  Mail,
  MessageSquare
} from "lucide-react";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";

const leadFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  company: z.string().optional(),
});

export default function Demo() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoVideoUrl, setDemoVideoUrl] = useState<string>("");

  const form = useForm<z.infer<typeof leadFormSchema>>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
    },
  });

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const onSubmit = async (values: z.infer<typeof leadFormSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/leads", {
        ...values,
        source: "demo"
      });

      if (response.ok) {
        toast({
          title: "Demo Request Submitted!",
          description: "Thank you for your interest. We'll contact you soon to schedule your personalized demo.",
        });
        form.reset();
      } else {
        throw new Error("Failed to submit demo request");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit demo request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      {/* Premium Navigation Header */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200/20 fixed w-full z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo Section */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-[#17B6C3]/10 backdrop-blur-sm rounded-xl flex items-center justify-center p-2">
                <img src={nexusLogo} alt="Nexus AR" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-gray-900" data-testid="text-brand-name">
                  Nexus AR
                </h1>
                <p className="text-xs text-[#17B6C3] font-medium tracking-wide uppercase">
                  AI-Driven Collections
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
              <Link href="/demo" className="text-[#17B6C3] font-semibold" data-testid="link-nav-demo">
                Demo
              </Link>
              <Link href="/about" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-about">
                About
              </Link>
              <Link href="/contact" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-contact">
                Contact
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
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-[#17B6C3]/10 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20 mb-6 backdrop-blur-sm" data-testid="badge-demo-hero">
              Interactive Demo
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-8" data-testid="text-demo-hero-title">
              See Nexus AR in Action
            </h1>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed" data-testid="text-demo-hero-description">
              Watch how our AI-driven accounts receivable platform transforms your collections process. 
              See real workflows, automated communications, and intelligent analytics in action.
            </p>
          </div>
        </div>
      </section>

      {/* Video and Form Section */}
      <section className="py-20 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch">
            {/* Video Section - Left Side */}
            <div className="h-full">
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold flex items-center">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                      <Play className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    Product Demo Video
                  </CardTitle>
                  <CardDescription className="text-base">
                    See how Nexus AR revolutionizes accounts receivable management
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center relative overflow-hidden">
                    {demoVideoUrl ? (
                      <video 
                        controls 
                        className="w-full h-full object-cover rounded-xl"
                        poster="/api/placeholder/800/450"
                      >
                        <source src={demoVideoUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <div className="text-center p-6">
                        <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-gray-600 mb-2">Demo Video Coming Soon</h3>
                        <p className="text-gray-500 text-sm mb-4">
                          Our comprehensive product demonstration will showcase all the powerful features of Nexus AR.
                        </p>
                        <Button 
                          className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                          onClick={() => {
                            toast({
                              title: "Video Upload",
                              description: "Video upload functionality will be available for administrators.",
                            });
                          }}
                          data-testid="button-upload-video"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Demo Video
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lead Capture Form - Right Side */}
            <div className="h-full">
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">
                    Get Instant Access
                  </CardTitle>
                  <CardDescription className="text-base">
                    Enter your details for an immediate live demo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter your full name"
                                  className="bg-white/70 border-gray-200/30"
                                  data-testid="input-lead-name"
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
                                  type="tel"
                                  placeholder="Enter your phone number"
                                  className="bg-white/70 border-gray-200/30"
                                  data-testid="input-lead-phone"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter your company name"
                                  className="bg-white/70 border-gray-200/30"
                                  data-testid="input-lead-company"
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
                              <FormLabel>Business Email *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="email"
                                  placeholder="Enter your business email"
                                  className="bg-white/70 border-gray-200/30"
                                  data-testid="input-lead-email"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="pt-2">
                        <Button 
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full bg-gradient-to-r from-[#17B6C3] to-[#1396A1] hover:from-[#1396A1] hover:to-[#117A85] text-white font-semibold py-3 text-base shadow-lg hover:shadow-xl transition-all duration-300"
                          data-testid="button-submit-demo-request"
                        >
                          {isSubmitting ? "Submitting..." : "Get My Live Demo"}
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                      </div>
                    </form>
                  </Form>

                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Preview */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6" data-testid="text-features-title">
              What You'll See in the Demo
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the complete accounts receivable workflow from invoice to payment
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="p-3 bg-[#17B6C3]/10 rounded-xl mx-auto mb-4 w-fit">
                  <BarChart3 className="h-8 w-8 text-[#17B6C3]" />
                </div>
                <h3 className="text-xl font-bold mb-2">Intelligent Dashboard</h3>
                <p className="text-gray-600">Real-time analytics and insights into your receivables performance</p>
              </CardContent>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="p-3 bg-[#17B6C3]/10 rounded-xl mx-auto mb-4 w-fit">
                  <Zap className="h-8 w-8 text-[#17B6C3]" />
                </div>
                <h3 className="text-xl font-bold mb-2">Automated Workflows</h3>
                <p className="text-gray-600">AI-powered sequences that adapt to customer behavior and payment patterns</p>
              </CardContent>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <CardContent className="p-6 text-center">
                <div className="p-3 bg-[#17B6C3]/10 rounded-xl mx-auto mb-4 w-fit">
                  <MessageSquare className="h-8 w-8 text-[#17B6C3]" />
                </div>
                <h3 className="text-xl font-bold mb-2">Multi-Channel Communication</h3>
                <p className="text-gray-600">Email, SMS, WhatsApp, and AI voice calls - all in one platform</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2025 Nexus AR Limited. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}