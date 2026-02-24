import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Phone, Globe, MapPin, Send } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ContactPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    interest: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const mailtoLink = `mailto:hello@qashivo.com?subject=Investor Enquiry from ${encodeURIComponent(formData.name)}&body=${encodeURIComponent(
        `Name: ${formData.name}\nEmail: ${formData.email}\nCompany: ${formData.company}\nInterest: ${formData.interest}\n\nMessage:\n${formData.message}`
      )}`;
      window.location.href = mailtoLink;

      toast({
        title: "Opening email client",
        description: "Your default email client should open with the enquiry details pre-filled.",
      });

      setFormData({ name: "", email: "", company: "", interest: "", message: "" });
    } catch {
      toast({
        title: "Error",
        description: "Please email us directly at hello@qashivo.com",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      <section className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <h1 className="text-[44px] font-semibold text-[#0B0F17] text-center mb-4">
            Let's Talk
          </h1>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto">
            Investor conversations, partnerships, and next steps. We're building Qashivo fast, lean, and smart&mdash;a company that learns faster than it grows.
          </p>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-8">
                Get in touch
              </h2>
              <div className="space-y-6 mb-10">
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-[#17B6C3]" />
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-[#0B0F17] mb-1">Email</p>
                    <a href="mailto:hello@qashivo.com" className="text-[15px] text-[#17B6C3] hover:underline">hello@qashivo.com</a>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-[#17B6C3]" />
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-[#0B0F17] mb-1">Phone</p>
                    <a href="tel:+442045383931" className="text-[15px] text-[#17B6C3] hover:underline">+44 20 4538 3931</a>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-[#17B6C3]" />
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-[#0B0F17] mb-1">Website</p>
                    <a href="https://www.qashivo.com" target="_blank" rel="noopener noreferrer" className="text-[15px] text-[#17B6C3] hover:underline">www.qashivo.com</a>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-[#17B6C3]" />
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-[#0B0F17] mb-1">Location</p>
                    <p className="text-[15px] text-[#556070]">United Kingdom</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white border border-[#E6E8EC] rounded-xl">
                <p className="text-[16px] text-[#0B0F17] font-medium mb-3 italic">
                  "This is not a five-year journey. It's a three-year sprint to value."
                </p>
                <p className="text-[14px] text-[#556070]">
                  &mdash; Simon Kramer, Founder & CEO
                </p>
              </div>
            </div>

            <Card className="bg-white border-[#E6E8EC] p-8">
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-6">Send us a message</h3>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your full name"
                    className="border-[#E6E8EC]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    className="border-[#E6E8EC]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">Company / Fund</label>
                  <Input
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Your company or fund name"
                    className="border-[#E6E8EC]"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">I'm interested in</label>
                  <select
                    value={formData.interest}
                    onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-[#E6E8EC] text-[14px] text-[#0B0F17] bg-white"
                  >
                    <option value="">Select an option</option>
                    <option value="SEIS Investment">SEIS Investment (First Close)</option>
                    <option value="EIS Investment">EIS Investment (Extension)</option>
                    <option value="Partnership">Partnership opportunity</option>
                    <option value="Product Demo">Product demo / walkthrough</option>
                    <option value="General Enquiry">General enquiry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us about your interest and any questions you have..."
                    className="w-full px-3 py-2 rounded-md border border-[#E6E8EC] text-[14px] text-[#0B0F17] bg-white min-h-[120px] resize-y"
                    rows={5}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#8B2635] hover:bg-[#6f1f2b] text-white h-11 px-6 rounded-lg text-[15px] font-medium w-full"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {submitting ? "Opening email..." : "Send Message"}
                </Button>
                <p className="text-[12px] text-[#556070] text-center">
                  This opens your email client with the details pre-filled. Alternatively, email us directly at hello@qashivo.com
                </p>
              </form>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-[14px] text-[#556070]">
            Conversations focused on long-term value and disciplined execution.
          </p>
        </div>
      </section>

      <InvestorFooter />
    </div>
  );
}
