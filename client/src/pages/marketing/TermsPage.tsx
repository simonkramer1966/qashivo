import { Link } from "wouter";
import MarketingLayout from "@/layouts/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function TermsPage() {
  usePageMeta(
    "Terms of Service — Qashivo",
    "Terms and conditions governing use of the Qashivo platform, operated by Nexus KPI Limited."
  );

  return (
    <MarketingLayout currentPage="/terms">
      <main className="pt-32 pb-20">
        {/* Hero */}
        <section className="bg-brand-navy py-20 mb-16">
          <div className="max-w-4xl mx-auto px-6">
            <h1 className="font-headline text-6xl md:text-8xl font-extrabold tracking-tighter text-white leading-[0.95] mb-6">
              Terms of Service
            </h1>
            <p className="text-xl text-white/70 font-bold">
              The agreement between you and Qashivo.
            </p>
            <p className="text-sm text-white/50 mt-4 font-medium">Last updated: March 2026</p>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 space-y-12">

          {/* 1. Acceptance */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">1. Acceptance of Terms</h2>
            <p className="text-on-surface-variant leading-relaxed">
              By accessing or using the Qashivo platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of a business, you represent that you have authority to bind that business to these Terms. If you do not agree, you must not use the Service.
            </p>
          </section>

          {/* 2. Description */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">2. Description of Service</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Qashivo is an autonomous credit control and cashflow management platform. The Service integrates with your accounting software to automate customer communications, monitor accounts receivable, provide AI-assisted insights, and help you manage cashflow. The Service is provided by Nexus KPI Limited, a company registered in England and Wales.
            </p>
          </section>

          {/* 3. Account Registration */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">3. Account Registration and Responsibilities</h2>
            <p className="text-on-surface-variant leading-relaxed">
              You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorised access or security breach.
            </p>
          </section>

          {/* 4. Acceptable Use */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">4. Acceptable Use</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations.</li>
              <li>Attempt to gain unauthorised access to the Service, other accounts, or any related systems.</li>
              <li>Use the Service to send harassing, abusive, or deceptive communications to any person.</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
              <li>Use the Service in any manner that could damage, disable, or impair the platform.</li>
              <li>Upload or transmit malicious code, viruses, or other harmful material.</li>
            </ul>
          </section>

          {/* 5. Subscription and Payment */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">5. Subscription and Payment</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">
              Access to the Service requires a paid subscription. Payment is processed by Stripe. By subscribing, you authorise us to charge your chosen payment method on a recurring basis.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li><strong>Free trials</strong> — where offered, trials provide full access for the stated period. You will be charged at the end of the trial unless you cancel beforehand.</li>
              <li><strong>Cancellation</strong> — you may cancel your subscription at any time via your account settings. Access continues until the end of your current billing period.</li>
              <li><strong>Refunds</strong> — refunds are provided at our discretion. Contact us at <a href="mailto:hello@qashivo.com" className="text-brand-navy underline font-semibold">hello@qashivo.com</a> for refund requests.</li>
              <li><strong>Price changes</strong> — we may change pricing with 30 days' written notice. Continued use after the change constitutes acceptance.</li>
            </ul>
          </section>

          {/* 6. Data Ownership */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">6. Data Ownership</h2>
            <p className="text-on-surface-variant leading-relaxed">
              You retain full ownership of all data you upload to or generate through the Service ("Your Data"). We do not claim ownership over Your Data. We use Your Data solely to provide and improve the Service in accordance with our{" "}
              <Link href="/privacy" className="text-brand-navy underline font-semibold">Privacy Policy</Link>.
              Upon termination, you may request export of Your Data within 90 days, after which it will be permanently deleted.
            </p>
          </section>

          {/* 7. Accounting Integration */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">7. Accounting Platform Integration</h2>
            <p className="text-on-surface-variant leading-relaxed">
              The Service integrates with third-party accounting platforms such as Xero. You are responsible for authorising and maintaining the connection between your accounting platform and Qashivo. We are not responsible for data accuracy, availability, or errors originating from your accounting platform. You should ensure your accounting records are accurate and up to date.
            </p>
          </section>

          {/* 8. AI Content Disclaimer */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">8. AI-Generated Content</h2>
            <p className="text-on-surface-variant leading-relaxed">
              The Service uses artificial intelligence to generate communications (emails, SMS, voice calls) and insights on your behalf. While we strive for accuracy and appropriateness, <strong>you are ultimately responsible for reviewing all AI-generated content before it is sent to your customers</strong>. Qashivo provides controls to review, edit, and approve communications before delivery. We strongly recommend using approval workflows, particularly during initial setup.
            </p>
          </section>

          {/* 9. Not Legal Advice */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">9. No Legal or Financial Advice</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Qashivo provides credit control tooling and automation only. <strong>Nothing in the Service constitutes legal, financial, or debt collection advice.</strong> The Service does not replace professional legal counsel. You are responsible for ensuring that your use of the Service complies with all applicable laws, including the Late Payment of Commercial Debts (Interest) Act 1998 and any relevant regulatory requirements.
            </p>
          </section>

          {/* 10. Service Availability */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">10. Service Availability</h2>
            <p className="text-on-surface-variant leading-relaxed">
              We use reasonable endeavours to maintain the availability of the Service. However, the Service is provided on an "as is" and "as available" basis. We do not guarantee uninterrupted or error-free operation. We may perform scheduled maintenance with reasonable notice. During the beta or early-access period, service levels may vary.
            </p>
          </section>

          {/* 11. Intellectual Property */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">11. Intellectual Property</h2>
            <p className="text-on-surface-variant leading-relaxed">
              All intellectual property rights in the Service (including software, design, branding, and AI models) remain the property of Nexus KPI Limited. Your subscription grants you a limited, non-exclusive, non-transferable licence to use the Service for the duration of your subscription. You retain ownership of Your Data as described in Section 6.
            </p>
          </section>

          {/* 12. Limitation of Liability */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">12. Limitation of Liability</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">
              To the fullest extent permitted by law:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li>Nexus KPI Limited shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.</li>
              <li>Our total liability for any claim arising from or relating to the Service shall not exceed the amount paid by you to us in the 12 months preceding the claim.</li>
              <li>Nothing in these Terms excludes or limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded under English law.</li>
            </ul>
          </section>

          {/* 13. Governing Law */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">13. Governing Law</h2>
            <p className="text-on-surface-variant leading-relaxed">
              These Terms are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from these Terms or the Service shall be subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          {/* 14. Changes */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">14. Changes to These Terms</h2>
            <p className="text-on-surface-variant leading-relaxed">
              We may update these Terms from time to time. Material changes will be communicated via email or a prominent notice within the Service at least 30 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.
            </p>
          </section>

          {/* 15. Contact */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">15. Contact</h2>
            <p className="text-on-surface-variant leading-relaxed">
              If you have any questions about these Terms, please contact us:
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-2">
              <strong>Nexus KPI Limited</strong> (trading as Qashivo)<br />
              Email:{" "}
              <a href="mailto:hello@qashivo.com" className="text-brand-navy underline font-semibold">hello@qashivo.com</a>
            </p>
          </section>

        </div>
      </main>
    </MarketingLayout>
  );
}
