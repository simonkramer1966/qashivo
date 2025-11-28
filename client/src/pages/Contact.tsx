import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Check, Loader2, Mail, Phone, MapPin } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  company: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().min(10, "Please provide more details (at least 10 characters)"),
  enquiryType: z.enum(['demo', 'pricing', 'partnership', 'general'])
});

type ContactForm = z.infer<typeof contactSchema>;

export default function Contact() {
  const [, setLocation] = useLocation();
  const [formSubmitted, setFormSubmitted] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
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
    mutationFn: async (data: ContactForm) => {
      const response = await apiRequest('POST', '/api/public/sales-enquiry', data);
      return response;
    },
    onSuccess: () => {
      setFormSubmitted(true);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again or email us directly.",
        variant: "destructive"
      });
    }
  });
  
  const onSubmit = (data: ContactForm) => {
    submitMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <a href="/home" className="flex items-center space-x-2">
                <img src={logo} alt="Qashivo Logo" className="h-8 w-8" />
                <h1 className="text-2xl font-bold text-[#17B6C3]">Qashivo</h1>
              </a>
              <div className="hidden md:flex space-x-6">
                <a href="/home#features" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-features">
                  Features
                </a>
                <a href="/home#integrations" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-integrations">
                  Integrations
                </a>
                <a href="/home#pricing" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-pricing">
                  Pricing
                </a>
                <a href="/home#partners" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-partners">
                  Partners
                </a>
                <a href="/demo" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-demo">
                  Demo
                </a>
                <a href="/contact" className="text-[#17B6C3] font-medium" data-testid="link-nav-contact">
                  Contact
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
        className="relative overflow-hidden min-h-[400px] flex items-center"
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
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center w-full">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Let's Start a Conversation
          </h1>
          <p className="text-xl text-gray-200 max-w-2xl mx-auto">
            Whether you're ready to transform your cashflow management or just curious about what AI can do for your business, we'd love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Contact Info */}
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Get in Touch
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Have questions about Qashivo? We're here to help. Fill out the form and our team will get back to you within 24 hours.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="h-6 w-6 text-[#17B6C3]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Email Us</h3>
                    <p className="text-gray-600" data-testid="text-contact-email">hello@qashivo.com</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="h-6 w-6 text-[#17B6C3]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Call Us</h3>
                    <p className="text-gray-600" data-testid="text-contact-phone">+44 (0) 20 1234 5678</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-[#17B6C3]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Visit Us</h3>
                    <p className="text-gray-600" data-testid="text-contact-location">London, United Kingdom</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Form */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50">
              {formSubmitted ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
                  <p className="text-gray-600 mb-6">
                    We've received your message and will be in touch shortly.
                  </p>
                  <Button
                    onClick={() => setFormSubmitted(false)}
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                    data-testid="button-send-another"
                  >
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Your name" 
                                className="bg-white/70 border-gray-200/30"
                                {...field} 
                                data-testid="input-contact-name"
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
                                className="bg-white/70 border-gray-200/30"
                                {...field} 
                                data-testid="input-contact-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Company name"
                                className="bg-white/70 border-gray-200/30"
                                {...field} 
                                data-testid="input-contact-company"
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
                                className="bg-white/70 border-gray-200/30"
                                {...field} 
                                data-testid="input-contact-phone"
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
                              <SelectTrigger className="bg-white/70 border-gray-200/30" data-testid="select-contact-type">
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
                              className="min-h-[120px] bg-white/70 border-gray-200/30"
                              {...field} 
                              data-testid="textarea-contact-message"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button
                      type="submit"
                      disabled={submitMutation.isPending}
                      className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white py-6 text-lg"
                      data-testid="button-submit-contact"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Message"
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </div>
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
                <li><a href="/home#features" className="hover:text-[#17B6C3] transition-colors">Features</a></li>
                <li><a href="/home#integrations" className="hover:text-[#17B6C3] transition-colors">Integrations</a></li>
                <li><a href="/home#pricing" className="hover:text-[#17B6C3] transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/home#partners" className="hover:text-[#17B6C3] transition-colors">Partners</a></li>
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">About</a></li>
                <li><a href="/contact" className="hover:text-[#17B6C3] transition-colors">Contact</a></li>
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
            <p>&copy; 2025 Qashivo. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
