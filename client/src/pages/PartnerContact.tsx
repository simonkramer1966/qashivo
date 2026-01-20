import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

interface ContactFormData {
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
}

export default function PartnerContact() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactFormData>();

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Message sent",
        description: "We'll be in touch within 24 hours.",
      });
      reset();
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: "Please try again or email us directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-10">
              <a href="/home" className="flex items-center gap-2">
                <img src={logo} alt="Qashivo" className="h-8 w-8" />
                <span className="text-[18px] font-semibold text-[#0B0F17] tracking-tight">Qashivo</span>
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="/product" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Product
                </a>
                <a href="/home#how-it-works" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  How it works
                </a>
                <a href="/partners" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Partners
                </a>
                <a href="/pricing" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Pricing
                </a>
                <a href="/contact" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
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
                className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 px-5 rounded-xl text-[15px] font-medium"
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
              <a href="/product" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Product</a>
              <a href="/home#how-it-works" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">How it works</a>
              <a href="/partners" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Partners</a>
              <a href="/pricing" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Pricing</a>
              <a href="/contact" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Contact</a>
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
            Partner with Qashivo
          </h1>
          <p className="text-[18px] md:text-[20px] text-[#556070] leading-relaxed">
            Tell us about your practice. We'll get back to you within 24 hours to discuss how we can work together.
          </p>
        </div>
      </section>

      {/* Contact Form */}
      <section className="pb-24">
        <div className="max-w-[520px] mx-auto px-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">
                  Your name
                </label>
                <Input
                  {...register("name", { required: "Name is required" })}
                  placeholder="Jane Smith"
                  className="h-12 bg-white border-[#E6E8EC] rounded-xl text-[15px] placeholder:text-[#9CA3AF]"
                />
                {errors.name && (
                  <p className="text-red-500 text-[13px] mt-1">{errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">
                  Company
                </label>
                <Input
                  {...register("company", { required: "Company is required" })}
                  placeholder="Smith & Co Accountants"
                  className="h-12 bg-white border-[#E6E8EC] rounded-xl text-[15px] placeholder:text-[#9CA3AF]"
                />
                {errors.company && (
                  <p className="text-red-500 text-[13px] mt-1">{errors.company.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">
                  Email
                </label>
                <Input
                  {...register("email", { 
                    required: "Email is required",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address"
                    }
                  })}
                  type="email"
                  placeholder="jane@smithco.com"
                  className="h-12 bg-white border-[#E6E8EC] rounded-xl text-[15px] placeholder:text-[#9CA3AF]"
                />
                {errors.email && (
                  <p className="text-red-500 text-[13px] mt-1">{errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">
                  Phone
                </label>
                <Input
                  {...register("phone")}
                  type="tel"
                  placeholder="+44 7700 900000"
                  className="h-12 bg-white border-[#E6E8EC] rounded-xl text-[15px] placeholder:text-[#9CA3AF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">
                How can we help?
              </label>
              <Textarea
                {...register("message", { required: "Message is required" })}
                placeholder="Tell us about your practice and what you're looking for..."
                rows={5}
                className="bg-white border-[#E6E8EC] rounded-xl text-[15px] placeholder:text-[#9CA3AF] resize-none"
              />
              {errors.message && (
                <p className="text-red-500 text-[13px] mt-1">{errors.message.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 rounded-xl text-[15px] font-medium"
            >
              {isSubmitting ? "Sending..." : "Send message"}
            </Button>
          </form>
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
              <span>© 2026 Qashivo Ltd</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
