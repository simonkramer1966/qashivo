import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { Menu, X, Check, Loader2, Mail, Phone, MapPin } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  company: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().min(10, "Please provide more details (at least 10 characters)"),
  enquiryType: z.enum(['demo', 'pricing', 'partnership', 'investment', 'general'])
});

type ContactForm = z.infer<typeof contactSchema>;

export default function Contact() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-10">
              <a href="/home" className="flex items-center gap-2">
                <img src={logo} alt="Qashivo" className="h-8 w-8" />
                <span className="font-semibold text-[#0B0F17] tracking-tight text-[22px]">Qashivo</span>
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="/home" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Home
                </a>
                <a href="/product" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Product
                </a>
                <a href="/home#how-it-works" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  How it works
                </a>
                <a href="/demo" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Demo
                </a>
                <a href="/partners" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Partners
                </a>
                <a href="/pricing" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Pricing
                </a>
                <a href="/contact" className="text-[15px] text-[#0B0F17] font-medium">
                  Contact
                </a>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <a href="/login" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                Sign in
              </a>
              <Button
                onClick={() => setLocation("/contact")}
                className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 px-5 rounded-full text-[15px] font-medium"
              >
                Book a demo
              </Button>
            </div>
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E6E8EC] bg-white px-6 py-4">
            <div className="flex flex-col gap-4">
              <a href="/home" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Home</a>
              <a href="/product" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Product</a>
              <a href="/home#how-it-works" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">How it works</a>
              <a href="/demo" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Demo</a>
              <a href="/partners" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Partners</a>
              <a href="/pricing" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Pricing</a>
              <a href="/contact" className="text-[16px] text-[#0B0F17] font-medium py-2">Contact</a>
              <div className="border-t border-[#E6E8EC] pt-4 mt-2 flex flex-col gap-3">
                <a href="/login" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Sign in</a>
                <Button
                  onClick={() => setLocation("/contact")}
                  className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 rounded-xl text-[15px] font-medium w-full"
                >
                  Book a demo
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>
      {/* Hero */}
      <section className="py-20 md:py-28">
        <div className="max-w-[600px] mx-auto px-6 text-center">
          <h1 className="text-[40px] md:text-[52px] font-semibold text-[#0B0F17] leading-[1.1] tracking-tight mb-6">
            Get in touch
          </h1>
          <p className="text-[18px] md:text-[20px] text-[#556070] leading-relaxed">
            Questions about Qashivo? We're here to help. Send us a message and we'll respond within 24 hours.
          </p>
        </div>
      </section>
      {/* Contact Section */}
      <section className="pb-24">
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-12 md:gap-16">
            {/* Contact Info */}
            <div className="md:col-span-2 space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-[#12B8C4]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-medium text-[#0B0F17] mb-1">Email</h3>
                  <p className="text-[15px] text-[#556070]">hello@qashivo.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-[#12B8C4]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-medium text-[#0B0F17] mb-1">Phone</h3>
                  <p className="text-[15px] text-[#556070]">+44 (0) 20 4538 3931</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-[#12B8C4]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-medium text-[#0B0F17] mb-1">Location</h3>
                  <p className="text-[15px] text-[#556070]">London, United Kingdom</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="md:col-span-3">
              {formSubmitted ? (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                    <Check className="h-7 w-7 text-green-600" />
                  </div>
                  <h3 className="text-[24px] font-semibold text-[#0B0F17] mb-2">Thank you</h3>
                  <p className="text-[16px] text-[#556070] mb-6">
                    We've received your message and will be in touch shortly.
                  </p>
                  <Button
                    onClick={() => setFormSubmitted(false)}
                    className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 px-6 rounded-full text-[15px] font-medium"
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[14px] font-medium text-[#0B0F17]">Your name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Jane Smith"
                                className="h-12 bg-white border-[#E6E8EC] rounded-xl text-[15px] placeholder:text-[#9CA3AF]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[14px] font-medium text-[#0B0F17]">Company</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Your company"
                                className="h-12 bg-white border-[#E6E8EC] rounded-xl text-[15px] placeholder:text-[#9CA3AF]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[14px] font-medium text-[#0B0F17]">Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="jane@company.com"
                                className="h-12 bg-white border-[#E6E8EC] rounded-xl text-[15px] placeholder:text-[#9CA3AF]"
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
                            <FormLabel className="text-[14px] font-medium text-[#0B0F17]">Phone</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="+44 7700 900000"
                                className="h-12 bg-white border-[#E6E8EC] rounded-xl text-[15px] placeholder:text-[#9CA3AF]"
                                {...field}
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
                          <FormLabel className="text-[14px] font-medium text-[#0B0F17]">What are you interested in?</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12 bg-white border-[#E6E8EC] rounded-xl text-[15px]">
                                <SelectValue placeholder="Select an option" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="demo">Product demo</SelectItem>
                              <SelectItem value="pricing">Pricing information</SelectItem>
                              <SelectItem value="partnership">Partnership opportunities</SelectItem>
                              <SelectItem value="investment">Investment</SelectItem>
                              <SelectItem value="general">General enquiry</SelectItem>
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
                          <FormLabel className="text-[14px] font-medium text-[#0B0F17]">How can we help?</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell us about your business and what you're looking for..."
                              rows={5}
                              className="bg-white border-[#E6E8EC] rounded-xl text-[15px] placeholder:text-[#9CA3AF] resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={submitMutation.isPending}
                      className="w-full bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 rounded-full text-[15px] font-medium"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send message"
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
      <footer className="border-t border-[#E6E8EC] py-12">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Qashivo" className="h-6 w-6" />
              <span className="text-[15px] font-medium text-[#0B0F17]">Qashivo</span>
            </div>
            <div className="flex items-center gap-8 text-[14px] text-[#556070]">
              <a href="/privacy" className="hover:text-[#0B0F17] transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-[#0B0F17] transition-colors">Terms</a>
              <span>© 2026 Nexus KPI Limited. Built in London. Backed by innovation. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
