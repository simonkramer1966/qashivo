import { Link } from "wouter";

export default function Privacy() {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2 font-heading">Privacy Policy</h1>
          <p className="text-gray-500 mb-12">Effective date: 1st December 2025</p>

          <div className="space-y-8 text-gray-600 leading-relaxed">
            <section>
              <p className="mb-4">
                www.qashivo.com (the "Site") is owned and operated by NEXUS KPI LTD. NEXUS KPI LTD is the data controller and can be contacted at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p>hello@qashivo.com</p>
                <p>02045 38393</p>
                <p>27 Old Gloucester Street, London, WC1N 3AX</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Purpose</h2>
              <p className="mb-4">The purpose of this privacy policy is to inform users of our Site of the following:</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>The personal data we will collect</li>
                <li>Use of collected data</li>
                <li>Who has access to the data collected</li>
                <li>The rights of Site users</li>
                <li>The Site's cookie policy</li>
              </ol>
              <p className="mt-4">This Privacy Policy applies in addition to the terms and conditions of our Site.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">GDPR</h2>
              <p className="mb-4">
                For users in the European Union, we adhere to the Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016, known as the General Data Protection Regulation (the "GDPR"). For users in the United Kingdom, we adhere to the GDPR as enshrined in the Data Protection Act 2018.
              </p>
              <p>
                We have not appointed a Data Protection Officer as we do not fall within the categories of controllers and processors required to appoint a Data Protection Officer under Article 37 of the GDPR.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Consent</h2>
              <p className="mb-4">By using our Site users agree that they consent to the conditions set out in this Privacy Policy.</p>
              <p className="mb-4">
                When the legal basis for us processing your personal data is that you have provided your consent to that processing, you may withdraw your consent at any time. If you withdraw your consent, it will not make processing which we completed before you withdrew your consent unlawful.
              </p>
              <p>You can withdraw your consent by contacting hello@qashivo.com.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Legal Basis for Processing</h2>
              <p className="mb-4">
                We collect and process personal data about users in the EU only when we have a legal basis for doing so under Article 6 of the GDPR.
              </p>
              <p className="mb-4">We rely on the following legal bases to collect and process the personal data of users in the EU:</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Users have provided their consent to the processing of their data for one or more specific purposes</li>
                <li>Processing of user personal data is necessary to a task carried out in the public interest or in the exercise of our official authority</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">How We Use Personal Data</h2>
              <p>
                Data collected on our Site will only be used for the purposes specified in this Privacy Policy or indicated on the relevant pages of our Site. We will not use your data beyond what we disclose in this Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Who We Share Personal Data With</h2>
              <h3 className="font-medium text-gray-800 mb-2">Employees</h3>
              <p className="mb-4">
                We may disclose user data to any member of our organisation who reasonably needs access to user data to achieve the purposes set out in this Privacy Policy.
              </p>
              <h3 className="font-medium text-gray-800 mb-2">Other Disclosures</h3>
              <p className="mb-4">We will not sell or share your data with other third parties, except in the following cases:</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>If the law requires it</li>
                <li>If it is required for any legal proceeding</li>
                <li>To prove or protect our legal rights</li>
                <li>To buyers or potential buyers of this company in the event that we seek to sell the company</li>
              </ol>
              <p className="mt-4">
                If you follow hyperlinks from our Site to another Site, please note that we are not responsible for and have no control over their privacy policies and practices.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">How Long We Store Personal Data</h2>
              <p className="mb-4">
                User data will be stored until the purpose the data was collected for has been achieved. You will be notified if your data is kept for longer than this period.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">How We Protect Your Personal Data</h2>
              <p className="mb-4">
                In order to protect your security, we use the strongest available browser encryption and store all of our data on servers in secure facilities. All data is only accessible to our employees. Our employees are bound by strict confidentiality agreements and a breach of this agreement would result in the employee's termination.
              </p>
              <p>
                While we take all reasonable precautions to ensure that user data is secure and that users are protected, there always remains the risk of harm. The Internet as a whole can be insecure at times and therefore we are unable to guarantee the security of user data beyond what is reasonably practical.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Rights as a User</h2>
              <p className="mb-4">Under the GDPR, you have the following rights:</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Right to be informed</li>
                <li>Right of access</li>
                <li>Right to rectification</li>
                <li>Right to erasure</li>
                <li>Right to restrict processing</li>
                <li>Right to data portability</li>
                <li>Right to object</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Children</h2>
              <p>
                We do not knowingly collect or use personal data from children under 16 years of age. If we learn that we have collected personal data from a child under 16 years of age, the personal data will be deleted as soon as possible. If a child under 16 years of age has provided us with personal data their parent or guardian may contact our privacy officer.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">How to Access, Modify, Delete, or Challenge the Data Collected</h2>
              <p className="mb-4">
                If you would like to know if we have collected your personal data, how we have used your personal data, if we have disclosed your personal data and to who we disclosed your personal data, if you would like your data to be deleted or modified in any way, or if you would like to exercise any of your other rights under the GDPR, please contact our privacy officer:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p className="font-medium">Simon Kramer</p>
                <p>hello@qashivo.com</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">How to Opt-Out of Data Collection, Use or Disclosure</h2>
              <p>
                You can opt-out of the use of your personal data for marketing emails by clicking "unsubscribe" on the bottom of any marketing email or updating your email preferences under "Your Account".
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookie Policy</h2>
              <p className="mb-4">
                A cookie is a small file, stored on a user's hard drive by a website. Its purpose is to collect data relating to the user's browsing habits. You can choose to be notified each time a cookie is transmitted. You can also choose to disable cookies entirely in your internet browser, but this may decrease the quality of your user experience.
              </p>
              <p className="mb-4">We use the following types of cookies on our Site:</p>
              <ol className="list-decimal list-inside space-y-4 ml-4">
                <li>
                  <span className="font-medium">Functional cookies</span>
                  <p className="ml-6 mt-1">Functional cookies are used to remember the selections you make on our Site so that your selections are saved for your next visits.</p>
                </li>
                <li>
                  <span className="font-medium">Analytical cookies</span>
                  <p className="ml-6 mt-1">Analytical cookies allow us to improve the design and functionality of our Site by collecting data on how you access our Site, for example data on the content you access, how long you stay on our Site, etc.</p>
                </li>
                <li>
                  <span className="font-medium">Targeting cookies</span>
                  <p className="ml-6 mt-1">Targeting cookies collect data on how you use the Site and your preferences. This allows us to personalise the information you see on our Site for you.</p>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Modifications</h2>
              <p>
                This Privacy Policy may be amended from time to time in order to maintain compliance with the law and to reflect any changes to our data collection process. When we amend this Privacy Policy we will update the "Effective Date" at the top of this Privacy Policy. We recommend that our users periodically review our Privacy Policy to ensure that they are notified of any updates. If necessary, we may notify users by email of changes to this Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Complaints</h2>
              <p className="mb-4">
                If you have any complaints about how we process your personal data, please contact us through the contact methods listed in the Contact Information section so that we can, where possible, resolve the issue.
              </p>
              <p>
                If you feel we have not addressed your concern in a satisfactory manner you may contact a supervisory authority. You also have the right to directly make a complaint to a supervisory authority. You can lodge a complaint with a supervisory authority by contacting the Information Commissioner's Office in the UK, Data Protection Commission in Ireland.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Information</h2>
              <p className="mb-4">If you have any questions, concerns or complaints, you can contact our privacy officer, Simon Kramer, at:</p>
              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p>hello@qashivo.com</p>
              </div>
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
