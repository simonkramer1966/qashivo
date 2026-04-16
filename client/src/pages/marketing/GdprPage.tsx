import { Link } from "wouter";
import MarketingLayout from "@/layouts/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function GdprPage() {
  usePageMeta(
    "GDPR & Data Protection — Qashivo",
    "How Qashivo complies with UK GDPR and the Data Protection Act 2018, including our approach to data security, sub-processors, and your rights."
  );

  return (
    <MarketingLayout currentPage="/gdpr">
      <main className="pt-32 pb-20">
        {/* Hero */}
        <section className="bg-brand-navy py-20 mb-16">
          <div className="max-w-4xl mx-auto px-6">
            <h1 className="font-headline text-6xl md:text-8xl font-extrabold tracking-tighter text-white leading-[0.95] mb-6">
              GDPR &amp; Data Protection
            </h1>
            <p className="text-xl text-white/70 font-bold">
              Our commitment to protecting your data under UK law.
            </p>
            <p className="text-sm text-white/50 mt-4 font-medium">Last updated: March 2026</p>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 space-y-12">

          {/* 1. Commitment */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">1. Our Commitment</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Qashivo (operated by Nexus KPI Limited) is committed to protecting personal data in accordance with the <strong>UK General Data Protection Regulation (UK GDPR)</strong> and the <strong>Data Protection Act 2018</strong>. Data protection is embedded into our platform design, our operational processes, and the way we engage with sub-processors.
            </p>
          </section>

          {/* 2. Controller vs Processor */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">2. Our Role: Controller and Processor</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">Qashivo operates in two data protection roles depending on the type of data:</p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li><strong>Data Controller</strong> — for your user account data (name, email, login credentials). We determine the purposes and means of processing this data.</li>
              <li><strong>Data Processor</strong> — for customer, invoice, and accounts receivable data that you import from your accounting platform. You (our customer) are the controller of this data. We process it on your behalf and solely in accordance with your instructions to provide the Service.</li>
            </ul>
          </section>

          {/* 3. DPA */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">3. Data Processing Agreement</h2>
            <p className="text-on-surface-variant leading-relaxed">
              We provide a Data Processing Agreement (DPA) to all customers on request. Our DPA covers the scope of processing, security obligations, sub-processor management, breach notification, and data subject rights assistance. To request a copy, contact us at{" "}
              <a href="mailto:privacy@qashivo.com" className="text-brand-navy underline font-semibold">privacy@qashivo.com</a>.
            </p>
          </section>

          {/* 4. Sub-processors */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">4. Sub-processors</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">
              We engage the following sub-processors to deliver the Qashivo service. Each is bound by a data processing agreement with appropriate technical and organisational safeguards:
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

          {/* 5. International Transfers */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">5. International Data Transfers</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Several of our sub-processors are based outside the UK. For all international transfers of personal data, we rely on the UK International Data Transfer Agreement (UK IDTA) or UK adequacy decisions as the legal mechanism. We assess the data protection laws of recipient countries and implement supplementary measures where necessary.
            </p>
          </section>

          {/* 6. Data Residency */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">6. Data Residency</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Qashivo's primary infrastructure is currently hosted in the US (Railway) and EU/US (Neon). Our roadmap includes a transition to EU-only data residency for all customer data. We will notify customers when this transition is complete.
            </p>
          </section>

          {/* 7. Security */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">7. Security Measures</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">
              We implement appropriate technical and organisational measures to protect personal data, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li><strong>Encryption in transit</strong> — all data transmitted to and from Qashivo is encrypted using TLS.</li>
              <li><strong>Authentication</strong> — user authentication is managed by Clerk with support for multi-factor authentication.</li>
              <li><strong>Multi-tenant isolation</strong> — all customer data is logically isolated by tenant. Queries are scoped to the authenticated tenant at every layer.</li>
              <li><strong>Communication mode enforcement</strong> — all outbound communications (email, SMS, voice) pass through a centralised enforcement wrapper that fails closed on errors, preventing unintended sends.</li>
              <li><strong>Access controls</strong> — role-based access control (RBAC) with six permission tiers governs access to data within each tenant.</li>
              <li><strong>Regular reviews</strong> — we conduct periodic security reviews of our codebase, infrastructure, and sub-processor relationships.</li>
            </ul>
          </section>

          {/* 8. Retention and Deletion */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">8. Data Retention and Deletion</h2>
            <p className="text-on-surface-variant leading-relaxed">
              We retain personal data only for as long as necessary to fulfil the purposes for which it was collected. When you cancel your subscription, your data is retained for up to 90 days to allow for export, after which it is permanently deleted. You may request earlier deletion at any time by contacting{" "}
              <a href="mailto:privacy@qashivo.com" className="text-brand-navy underline font-semibold">privacy@qashivo.com</a>.
              For full retention periods, see our{" "}
              <Link href="/privacy" className="text-brand-navy underline font-semibold">Privacy Policy</Link>.
            </p>
          </section>

          {/* 9. Breach Notification */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">9. Breach Notification</h2>
            <p className="text-on-surface-variant leading-relaxed">
              In the event of a personal data breach that is likely to result in a risk to the rights and freedoms of individuals, we will notify the Information Commissioner's Office (ICO) within <strong>72 hours</strong> of becoming aware of the breach, as required by UK GDPR Article 33. Where a breach is likely to result in a high risk, we will also notify affected data subjects without undue delay.
            </p>
          </section>

          {/* 10. Your Rights */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">10. Your Rights</h2>
            <p className="text-on-surface-variant leading-relaxed mb-4">
              Under UK GDPR, you have rights including access, rectification, erasure, portability, restriction of processing, and the right to object. For a full description of your rights, see our{" "}
              <Link href="/privacy" className="text-brand-navy underline font-semibold">Privacy Policy</Link>.
            </p>
            <p className="text-on-surface-variant leading-relaxed">
              To exercise any right, contact us at{" "}
              <a href="mailto:privacy@qashivo.com" className="text-brand-navy underline font-semibold">privacy@qashivo.com</a>.
              We will respond within one calendar month.
            </p>
          </section>

          {/* 11. ICO Registration */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">11. ICO Registration</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Nexus KPI Limited is registered with the Information Commissioner's Office as required by UK data protection law. If you wish to verify our registration or lodge a complaint, visit{" "}
              <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-brand-navy underline font-semibold">ico.org.uk</a>.
            </p>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 className="font-headline text-2xl font-extrabold text-brand-navy mb-4">12. Contact</h2>
            <p className="text-on-surface-variant leading-relaxed">
              For any data protection queries or to request our Data Processing Agreement:
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
