import { Button } from "@/components/ui/button";
import { Check, Shield, FileCheck, Users, Cloud, ArrowLeft } from "lucide-react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";



export default function DesignPartnerThankYou() {

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <a href="/home" className="flex items-center gap-2">
              <img src={logo} alt="Qashivo" className="h-8 w-8" />
              <span className="text-[22px] font-semibold text-[#0B0F17] tracking-tight">Qashivo</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 md:py-24 border-b border-[#E6E8EC]">
        <div className="max-w-[700px] mx-auto px-6 text-center">
          <span className="inline-block text-[12px] font-semibold text-[#22C55E] uppercase tracking-wider bg-[#F0FDF4] px-3 py-1.5 rounded-full mb-5">Application Received</span>
          <h1 className="text-[32px] md:text-[42px] font-semibold text-[#0B0F17] leading-[1.15] tracking-tight mb-6">
            Thanks — we've received your Design Partner application
          </h1>
          <p className="text-[16px] md:text-[17px] text-[#556070] leading-relaxed mb-4">
            We'll review it and respond within 24 hours. If it's a fit, we'll invite you to a short 15-minute call.
          </p>
          <p className="text-[13px] text-[#9CA3AF] italic">
            Nothing is ever sent without approval.
          </p>
        </div>
      </section>

      {/* What happens next */}
      <section className="py-16 border-b border-[#E6E8EC]">
        <div className="max-w-[700px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-10 text-center">What Happens Next</h2>

          <div className="space-y-0">
            <StepItem number={1} title="Review (today)" description="We review your application and client fit." />
            <StepItem number={2} title="15-minute fit call" description="Confirm goals, clients, and how you run credit control today." />
            <StepItem number={3} title="NDA" description="We share detailed workflow documentation and onboarding plan." />
            <StepItem number={4} title="Onboard" description="White-glove setup for your first 1-3 clients." isLast />
          </div>
        </div>
      </section>



      {/* Trust strip */}
      <section className="py-16 bg-[#F8FAFB] border-b border-[#E6E8EC]">
        <div className="max-w-[700px] mx-auto px-6 text-center">
          <h2 className="text-[20px] font-semibold text-[#0B0F17] mb-6">Trust-First by Design</h2>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            <TrustItem icon={<Shield className="w-4 h-4" />} text="Human approval required" />
            <TrustItem icon={<FileCheck className="w-4 h-4" />} text="Full audit trail" />
            <TrustItem icon={<Users className="w-4 h-4" />} text="Role-based access" />
            <TrustItem icon={<Cloud className="w-4 h-4" />} text="Secure cloud hosting (Google Cloud)" />
          </div>
        </div>
      </section>

      {/* Footer links */}
      <section className="py-12">
        <div className="max-w-[700px] mx-auto px-6 text-center space-y-4">
          <a
            href="/design-partner"
            className="inline-flex items-center gap-2 text-[15px] text-[#12B8C4] hover:text-[#0fa3ae] font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Design Partner page
          </a>
          <p className="text-[14px] text-[#556070]">
            Questions? Email <a href="mailto:partners@qashivo.com" className="font-medium text-[#12B8C4] hover:underline">partners@qashivo.com</a>
          </p>
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
              <span>&copy; 2026 Nexus KPI Limited. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StepItem({ number, title, description, isLast = false }: { number: number; title: string; description: string; isLast?: boolean }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 bg-[#12B8C4] rounded-full flex items-center justify-center text-white text-[14px] font-semibold flex-shrink-0">
          {number}
        </div>
        {!isLast && <div className="w-px h-8 bg-[#E6E8EC]" />}
      </div>
      <div className={isLast ? "pb-0" : "pb-4"}>
        <h4 className="text-[15px] font-semibold text-[#0B0F17]">{title}</h4>
        <p className="text-[14px] text-[#556070]">{description}</p>
      </div>
    </div>
  );
}


function TrustItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[14px] text-[#556070]">
      <span className="text-[#22C55E]">{icon}</span>
      {text}
    </div>
  );
}
