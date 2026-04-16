import MarketingLayout from "@/layouts/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function PrivacyPage() {
  usePageMeta(
    "Privacy Policy — Qashivo",
    "How Nexus KPI Limited (trading as Qashivo) collects, uses, and protects your personal data under UK GDPR."
  );

  return (
    <MarketingLayout currentPage="/privacy">
      <main className="pt-32 pb-20">
        {/* Hero */}
        <section className="bg-brand-navy py-20 mb-16">
          <div className="max-w-4xl mx-auto px-6">
            <h1 className="font-headline text-6xl md:text-8xl font-extrabold tracking-tighter text-white leading-[0.95] mb-6">
              Privacy Policy
            </h1>
            <p className="text-xl text-white/70 font-bold">
              How we collect, use, and protect your data.
            </p>
            <p className="text-sm text-white/50 mt-4 font-medium">Last updated: March 2026</p>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 space-y-12">

          {/* 1. Who We Are */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">1. Who We Are</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Qashivo is a trading name of <strong>Nexus KPI Limited</strong>, a company registered in England and Wales. We are the data controller for the personal data described in this policy. If you have any questions about how we handle your data, contact us at{" "}
              <a href="mailto:privacy@qashivo.com" className="text-brand-navy underline font-semibold">privacy@qashivo.com</a>.
            </p>
          </section>

          {/* 2. Data We Collect */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">2. Data We Collect</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">
              We collect the following categories of personal data when you use the Qashivo platform:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li><strong>Account data</strong> — your name, email address, and authentication credentials (managed by our authentication provider, Clerk).</li>
              <li><strong>Business data</strong> — invoices, customer/contact records, and accounts receivable information synced from your connected accounting platform (e.g. Xero).</li>
              <li><strong>Communication data</strong> — emails, SMS messages, and voice call transcripts generated or received through the Qashivo platform on your behalf.</li>
              <li><strong>Usage data</strong> — browser type, IP address, pages visited, and interaction patterns collected via analytics to improve the service.</li>
              <li><strong>Payment data</strong> — billing details processed by Stripe. We do not store full card numbers on our servers.</li>
            </ul>
          </section>

          {/* 3. Legal Basis */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">3. Legal Basis for Processing</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">We process personal data under the following lawful bases:</p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li><strong>Contract performance</strong> — processing necessary to provide the Qashivo service to you under our Terms of Service.</li>
              <li><strong>Legitimate interests</strong> — improving our platform, preventing fraud, and ensuring service security, where those interests are not overridden by your rights.</li>
              <li><strong>Legal obligation</strong> — where we are required to retain or disclose data to comply with applicable law.</li>
              <li><strong>Consent</strong> — for optional analytics cookies and marketing communications, where applicable. You may withdraw consent at any time.</li>
            </ul>
          </section>

          {/* 4. Data Retention */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">4. Data Retention</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">We retain personal data only as long as necessary for the purposes described in this policy:</p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li><strong>Account data</strong> — retained for the duration of your account and up to 30 days after account deletion.</li>
              <li><strong>Business data</strong> — retained for the duration of your subscription. On cancellation, data is deleted within 90 days unless you request earlier deletion.</li>
              <li><strong>Communication data</strong> — retained for 12 months after creation for audit and compliance purposes, then automatically purged.</li>
              <li><strong>Usage and analytics data</strong> — retained in anonymised or aggregated form for up to 24 months.</li>
            </ul>
          </section>

          {/* 5. Sub-processors */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">5. Sub-processors</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">
              We use the following third-party sub-processors to deliver the Qashivo service. All sub-processors are bound by data processing agreements and appropriate safeguards:
            </p>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-bold text-brand-navy">Provider</th>
                    <th className="text-left px-4 py-3 font-bold text-brand-navy">Purpose</th>
                    <th className="text-left px-4 py-3 font-bold text-brand-navy">Location</th>
                  </tr>
                </thead>
                <tbody className="text-on-surface-variant">
                  <tr className="border-b border-slate-100"><td className="px-4 py-3">Anthropic</td><td className="px-4 py-3">AI processing</td><td className="px-4 py-3">US</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-4 py-3">Railway</td><td className="px-4 py-3">Application hosting</td><td className="px-4 py-3">US</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-4 py-3">Clerk</td><td className="px-4 py-3">Authentication</td><td className="px-4 py-3">US</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-4 py-3">SendGrid (Twilio)</td><td className="px-4 py-3">Email delivery</td><td className="px-4 py-3">US</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-4 py-3">Vonage</td><td className="px-4 py-3">SMS</td><td className="px-4 py-3">UK / US</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-4 py-3">Retell AI</td><td className="px-4 py-3">Voice AI</td><td className="px-4 py-3">US</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-4 py-3">Neon</td><td className="px-4 py-3">Database hosting</td><td className="px-4 py-3">US</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-4 py-3">Stripe</td><td className="px-4 py-3">Payment processing</td><td className="px-4 py-3">US</td></tr>
                  <tr><td className="px-4 py-3">Xero</td><td className="px-4 py-3">Accounting integration</td><td className="px-4 py-3">NZ / AU</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. International Transfers */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">6. International Data Transfers</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Some of our sub-processors are based outside the UK. Where personal data is transferred internationally, we ensure appropriate safeguards are in place, including the UK International Data Transfer Agreement (UK IDTA) or reliance on UK adequacy decisions where applicable. We review the data protection practices of all sub-processors before engagement and on an ongoing basis.
            </p>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">7. Your Rights Under UK GDPR</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">Under the UK General Data Protection Regulation, you have the following rights:</p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li><strong>Right of access</strong> — request a copy of the personal data we hold about you.</li>
              <li><strong>Right to rectification</strong> — request correction of inaccurate or incomplete data.</li>
              <li><strong>Right to erasure</strong> — request deletion of your personal data where there is no compelling reason for continued processing.</li>
              <li><strong>Right to data portability</strong> — receive your data in a structured, commonly used, machine-readable format.</li>
              <li><strong>Right to restrict processing</strong> — request that we limit how we use your data.</li>
              <li><strong>Right to object</strong> — object to processing based on legitimate interests or for direct marketing.</li>
              <li><strong>Rights related to automated decision-making</strong> — the right not to be subject to decisions based solely on automated processing that produce legal or similarly significant effects.</li>
            </ul>
          </section>

          {/* 8. Exercising Your Rights */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">8. How to Exercise Your Rights</h2>
            <p className="text-on-surface-variant leading-relaxed">
              To exercise any of the rights described above, contact us at{" "}
              <a href="mailto:privacy@qashivo.com" className="text-brand-navy underline font-semibold">privacy@qashivo.com</a>.
              We will respond to your request within one calendar month. In complex cases, we may extend this by a further two months, and will notify you if so. We may ask you to verify your identity before processing your request.
            </p>
          </section>

          {/* 9. Complaints */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">9. Complaints</h2>
            <p className="text-on-surface-variant leading-relaxed">
              If you are unhappy with how we have handled your personal data, you have the right to lodge a complaint with the Information Commissioner's Office (ICO). You can contact the ICO at{" "}
              <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-brand-navy underline font-semibold">ico.org.uk</a>{" "}
              or by calling 0303 123 1113. We would appreciate the opportunity to address your concerns before you approach the ICO, so please contact us first.
            </p>
          </section>

          {/* 10. Cookies */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">10. Cookies</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Qashivo uses essential cookies required for authentication and session management. We may also use analytics cookies to understand how the platform is used. Analytics cookies are only set with your consent. You can manage cookie preferences in your browser settings at any time.
            </p>
          </section>

          {/* 11. Changes */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">11. Changes to This Policy</h2>
            <p className="text-on-surface-variant leading-relaxed">
              We may update this policy from time to time. Material changes will be communicated via email or a notice within the platform. The "Last updated" date at the top of this page reflects the most recent revision.
            </p>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">12. Contact</h2>
            <p className="text-on-surface-variant leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-2">
              <strong>Nexus KPI Limited</strong> (trading as Qashivo)<br />
              Email:{" "}
              <a href="mailto:privacy@qashivo.com" className="text-brand-navy underline font-semibold">privacy@qashivo.com</a>
            </p>
          </section>

        </div>
      </main>
    </MarketingLayout>
  );
}
