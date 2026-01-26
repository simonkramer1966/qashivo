import { Link } from "wouter";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/homepage">
              <a className="flex items-center gap-3">
                <img 
                  src="/images/homepage/logo.webp" 
                  alt="Qashivo Logo" 
                  className="h-10 w-auto"
                />
              </a>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/homepage#how-it-works">
                <a className="text-gray-600 hover:text-gray-900 transition">How It Works</a>
              </Link>
              <Link href="/homepage#pricing">
                <a className="text-gray-600 hover:text-gray-900 transition">Pricing</a>
              </Link>
              <Link href="/homepage#features">
                <a className="text-gray-600 hover:text-gray-900 transition">Features</a>
              </Link>
              <Link href="/homepage#faq">
                <a className="text-gray-600 hover:text-gray-900 transition">FAQ</a>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 font-heading">Terms and Conditions</h1>
          <p className="text-gray-500 mb-12">Effective date: 1st December 2025</p>

          <div className="space-y-8 text-gray-600 leading-relaxed">
            <section>
              <p className="mb-4">
                These terms and conditions (the "Terms and Conditions") govern the use of www.qashivo.com (the "Site"). This Site is owned and operated by NEXUS KPI LTD. This Site is a news or media website.
              </p>
              <p>
                By using this Site, you indicate that you have read and understand these Terms and Conditions and agree to abide by them at all times.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Intellectual Property</h2>
              <p>
                All content published and made available on our Site is the property of NEXUS KPI LTD and the Site's creators. This includes, but is not limited to images, text, logos, documents, downloadable files and anything that contributes to the composition of our Site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Limitation of Liability</h2>
              <p>
                NEXUS KPI LTD and our directors, officers, agents, employees, subsidiaries, and affiliates will not be liable for any actions, claims, losses, damages, liabilities and expenses including legal fees from your use of the Site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Indemnity</h2>
              <p>
                Except where prohibited by law, by using this Site you indemnify and hold harmless NEXUS KPI LTD and our directors, officers, agents, employees, subsidiaries, and affiliates from any actions, claims, losses, damages, liabilities and expenses including legal fees arising out of your use of our Site or your violation of these Terms and Conditions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Applicable Law</h2>
              <p>
                These Terms and Conditions are governed by the laws of the Country of England.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Severability</h2>
              <p>
                If at any time any of the provisions set forth in these Terms and Conditions are found to be inconsistent or invalid under applicable laws, those provisions will be deemed void and will be removed from these Terms and Conditions. All other provisions will not be affected by the removal and the rest of these Terms and Conditions will still be considered valid.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes</h2>
              <p>
                These Terms and Conditions may be amended from time to time in order to maintain compliance with the law and to reflect any changes to the way we operate our Site and the way we expect users to behave on our Site. We will notify users by email of changes to these Terms and Conditions or post a notice on our Site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Details</h2>
              <p className="mb-4">Please contact us if you have any questions or concerns. Our contact details are as follows:</p>
              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p>02045 38393</p>
                <p>hello@qashivo.com</p>
                <p>27 Old Gloucester Street, London, WC1N 3AX</p>
              </div>
              <p className="mt-4">
                You can also contact us through the feedback form available on our Site.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 bg-gray-900 text-center">
        <div className="max-w-7xl mx-auto mb-6">
          <img 
            src="/images/homepage/logo.webp" 
            alt="Qashivo Logo" 
            className="h-12 w-auto mx-auto opacity-80"
          />
        </div>
        <div className="flex justify-center gap-6 mb-4">
          <Link href="/privacy">
            <a className="text-gray-400 hover:text-white transition text-sm">Privacy Policy</a>
          </Link>
          <Link href="/terms">
            <a className="text-gray-400 hover:text-white transition text-sm">Terms & Conditions</a>
          </Link>
        </div>
        <p className="text-gray-400">
          © 2026 Nexus KPI Limited. Built in London. Backed by innovation. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
