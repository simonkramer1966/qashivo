import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

export default function Privacy() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
              <a href="/home" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Home</a>
              <a href="/product" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Product</a>
              <a href="/home#how-it-works" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2" onClick={() => setMobileMenuOpen(false)}>How it works</a>
              <a href="/demo" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Demo</a>
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

      {/* Content */}
      <main className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-[36px] font-semibold text-[#0B0F17] mb-2">Privacy Policy</h1>
          <p className="text-[#556070] mb-12">Effective date: 1st December 2025</p>

          <div className="space-y-8 text-[#556070] leading-relaxed">
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
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Purpose</h2>
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
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">GDPR</h2>
              <p className="mb-4">
                For users in the European Union, we adhere to the Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016, known as the General Data Protection Regulation (the "GDPR"). For users in the United Kingdom, we adhere to the GDPR as enshrined in the Data Protection Act 2018.
              </p>
              <p>
                We have not appointed a Data Protection Officer as we do not fall within the categories of controllers and processors required to appoint a Data Protection Officer under Article 37 of the GDPR.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Consent</h2>
              <p className="mb-4">By using our Site users agree that they consent to the conditions set out in this Privacy Policy.</p>
              <p className="mb-4">When the legal basis for us processing your personal data is that you have provided your consent to that processing, you may withdraw your consent at any time. If you withdraw your consent, it will not make processing which we completed before you withdrew your consent unlawful.</p>
              <p>You can withdraw your consent by contacting the Privacy Officer.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Legal Basis for Processing</h2>
              <p className="mb-4">We collect and process personal data about users in the EU only when we have a legal basis for doing so under Article 6 of the GDPR. We rely on the following legal bases to collect and process the personal data of users in the EU:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Users have provided their consent to the processing of their data for one or more specific purposes</li>
                <li>Processing of user personal data is necessary for us or a third party to pursue a legitimate interest. Our legitimate interests are to distribute educational content to our users. The legitimate interests of a third party are currently not applicable.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Personal Data We Collect</h2>
              <p className="mb-4">We only collect data that helps us achieve the purpose set out in this Privacy Policy. We will not collect any additional data beyond the data listed below without notifying you first.</p>
              <p className="font-medium text-[#0B0F17] mb-2">Data Collected Automatically:</p>
              <p className="mb-4">When you visit and use our Site, we may automatically collect and store the following information: IP address, Location, Hardware and software details, Clicked links, Content viewed.</p>
              <p className="font-medium text-[#0B0F17] mb-2">Data Collected in a Non-Automatic Way:</p>
              <p>We may also collect the following data when you perform certain functions on our Site: First and last name, Email address, Phone number, Address, Payment information.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">How We Use Personal Data</h2>
              <p className="mb-4">Data collected on our Site will only be used for the purposes specified in this Privacy Policy or indicated on the relevant pages of our Site. We will not use your data beyond what we disclose in this Privacy Policy.</p>
              <p className="mb-4">The data we collect automatically is used for the following purposes: Statistics and Analytics, Demographic information for advertising.</p>
              <p>The data we collect when the user performs certain functions may be used for the following purposes: Communication, Product and service delivery, Market research.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Who We Share Personal Data With</h2>
              <p className="mb-4"><strong>Employees:</strong> We may disclose user data to any member of our organisation who reasonably needs access to user data to achieve the purposes set out in this Privacy Policy.</p>
              <p className="mb-4"><strong>Third Parties:</strong> We may share user data with the following third parties: Third party service providers (e.g. cloud storage providers, data processors, marketing or communications agencies). We may share the following user data with third parties: Anonymised customer data.</p>
              <p><strong>Other Disclosures:</strong> We will not sell or share your data with other third parties, except in the following cases: if the law requires it, if it is required for any legal proceeding, to prove or protect our legal rights, to buyers or potential buyers of this company in the event that we seek to sell the company.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">How Long We Store Personal Data</h2>
              <p>User data will be stored until the purpose the data was collected for has been achieved. You will be notified if your data is kept for longer than this period.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">How We Protect Your Personal Data</h2>
              <p className="mb-4">We use recognised security measures to protect your data including cloud security (AWS, GCP), encryption, secure communication channels, access control, and regular backups. While we take all reasonable precautions to ensure that user data is secure and that users are protected, there always remains some risk of harm. The Internet as a whole can be insecure at times and therefore we are unable to guarantee the security of user data beyond what is reasonably practical.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">International Data Transfers</h2>
              <p>We may transfer user personal data to the following countries: United States of America. When we transfer user personal data we will protect that data as described in this Privacy Policy and comply with applicable legal requirements for transferring personal data internationally. If you are located in the United Kingdom or the European Union, we will only transfer your personal data if:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>The country your personal data is being transferred to has been deemed to have adequate data protection by the European Commission or, if you are in the United Kingdom, by the United Kingdom adequacy regulations; or</li>
                <li>We have implemented appropriate safeguards in respect of the transfer.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Your Rights as a User</h2>
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
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Children</h2>
              <p>We do not knowingly collect or use personal data from children under 16 years of age. If we learn that we have collected personal data from a child under 16 years of age, the personal data will be deleted as soon as possible. If a child under 16 years of age has provided us with personal data their parent or guardian may contact our privacy officer.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Cookies</h2>
              <p className="mb-4">A cookie is a small file, stored on a user's hard drive by a website. Its purpose is to collect data relating to the user's browsing habits. You can choose to be notified each time a cookie is transmitted. You can also choose to disable cookies entirely in your internet browser, but this may decrease the quality of your user experience.</p>
              <p className="mb-4">We use the following types of cookies on our Site:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Functional cookies:</strong> Used to remember the selections you make on our Site so that your selections are saved for your next visits.</li>
                <li><strong>Analytical cookies:</strong> Allow us to improve the design and functionality of our Site by collecting data on how you access our Site.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Modifications</h2>
              <p>
                This Privacy Policy may be amended from time to time in order to maintain compliance with the law and to reflect any changes to our data collection process. When we amend this Privacy Policy we will update the "Effective Date" at the top of this Privacy Policy. We recommend that our users periodically review our Privacy Policy to ensure that they are notified of any updates. If necessary, we may notify users by email of changes to this Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Complaints</h2>
              <p className="mb-4">
                If you have any complaints about how we process your personal data, please contact us through the contact methods listed in the Contact Information section so that we can, where possible, resolve the issue.
              </p>
              <p>
                If you feel we have not addressed your concern in a satisfactory manner you may contact a supervisory authority. You also have the right to directly make a complaint to a supervisory authority. You can lodge a complaint with a supervisory authority by contacting the Information Commissioner's Office in the UK, Data Protection Commission in Ireland.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Contact Information</h2>
              <p className="mb-4">If you have any questions, concerns or complaints, you can contact our privacy officer, Simon Kramer, at:</p>
              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p>hello@qashivo.com</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-16 border-t border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 md:col-span-1">
              <a href="/home" className="flex items-center gap-2 mb-4">
                <img src={logo} alt="Qashivo" className="h-7 w-7" />
                <span className="text-[16px] font-semibold text-[#0B0F17]">Qashivo</span>
              </a>
              <p className="text-[13px] text-[#556070]">
                Always on. Never calls in sick.<br />
                Never forgets. Always follows up.
              </p>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-[#0B0F17] uppercase tracking-wide mb-4">Product</h4>
              <ul className="space-y-3">
                <li><a href="/product" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Overview</a></li>
                <li><a href="/product#attention" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Attention</a></li>
                <li><a href="/product#cashflow" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Cash Flow</a></li>
                <li><a href="/product#followups" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Follow-ups</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-[#0B0F17] uppercase tracking-wide mb-4">Partners</h4>
              <ul className="space-y-3">
                <li><a href="/partners" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Partner program</a></li>
                <li><a href="/partners#refer" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Refer a client</a></li>
                <li><a href="/partner-contact" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Become a partner</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-[#0B0F17] uppercase tracking-wide mb-4">Company</h4>
              <ul className="space-y-3">
                <li><a href="/about" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">About</a></li>
                <li><a href="/contact" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-[#0B0F17] uppercase tracking-wide mb-4">Legal</h4>
              <ul className="space-y-3">
                <li><a href="/privacy" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Privacy</a></li>
                <li><a href="/terms" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Terms</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-[#E6E8EC]">
            <p className="text-[13px] text-[#556070] text-center">
              © 2026 Nexus KPI Limited. Built in London. Backed by innovation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
