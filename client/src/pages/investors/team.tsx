import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import simonImg from "@assets/Simon_Pic_v1_1771947378518.jpg";
import mikeImg from "@assets/Mike_Pic_1771947269210.jpg";
import jamieImg from "@assets/Jamie_Pic_1771947389478.jpg";
import angelaImg from "@assets/image_1771948650513.png";
import iolaImg from "@assets/image_1771947104481.png";

const leadership = [
  {
    name: "Simon Kramer",
    role: "Founder & CEO",
    image: simonImg,
    bio: "Simon brings over 30 years of experience in finance leadership, accounting, and SaaS product development. He has founded and led businesses serving SMEs and professional services firms, with deep expertise in cashflow management and forecasting. His first-hand understanding of how collections, customer behaviour, and partner relationships work in practice directly informs Qashivo's product strategy and growth model.",
    highlights: ["30+ years in finance & accounting", "Serial SaaS founder", "Cashflow management specialist", "Partner-led growth architect"],
  },
  {
    name: "Michael Coe",
    role: "Chief Technology Officer",
    image: mikeImg,
    bio: "Michael brings over 30 years of experience in enterprise architecture and large-scale systems delivery, having led multi-million-pound technology transformations across financial services and regulated industries. His expertise in secure, scalable infrastructure underpins Qashivo's platform reliability, AI integration, and long-term technical roadmap. He ensures the system is built for trust, auditability, and production-grade performance from day one.",
    highlights: ["30+ years in enterprise architecture", "Led multi-million-pound transformations", "Secure, scalable systems expert", "Financial services background"],
  },
  {
    name: "Jamie Carter",
    role: "Chief Marketing Officer",
    image: jamieImg,
    bio: "Jamie brings over 25 years of experience in digital marketing, demand generation, and growth strategy. He has founded and led agencies focused on measurable revenue outcomes, building deep expertise in marketing automation, conversion optimisation, and partner enablement. His understanding of what drives customer acquisition and retention at scale shapes Qashivo's go-to-market execution and partner activation strategy.",
    highlights: ["25+ years in digital marketing", "Revenue-focused agency founder", "Marketing automation expert", "Partner enablement strategist"],
  },
];

const team = [
  {
    name: "Angela Putzier",
    role: "Operations Manager",
    image: angelaImg,
    bio: "Angela manages all investor relationships and key client partnerships, ensuring seamless communication and operational excellence across the business. She oversees day-to-day platform operations including vendor management, process optimisation, compliance coordination, and internal workflows. Her structured approach to SaaS operations keeps Qashivo running efficiently as the team and customer base scale.",
    highlights: ["Investor & client relationship management", "Operational process design", "Vendor & compliance coordination", "Cross-functional team operations"],
  },
  {
    name: "Iola Redhead",
    role: "Customer Success Manager",
    image: iolaImg,
    bio: "Iola is responsible for ensuring every partner and customer has a world-class onboarding experience and continues to get maximum value from the platform. She works closely with accounting firms during initial setup, monitors adoption and engagement metrics, identifies expansion opportunities, and acts as the voice of the customer internally. Her focus on proactive success management drives retention, satisfaction, and partner advocacy.",
    highlights: ["Partner & customer onboarding", "Adoption & engagement tracking", "Proactive success management", "Voice of the customer"],
  },
];

function PersonBio({ person }: { person: typeof leadership[0] }) {
  return (
    <div>
      <h3 className="text-[24px] font-semibold text-[#0B0F17] mb-1">{person.name}</h3>
      <p className="text-[16px] text-[#17B6C3] font-medium mb-4">{person.role}</p>
      <p className="text-[15px] text-[#556070] leading-relaxed mb-6">{person.bio}</p>
      <div className="flex flex-wrap gap-2">
        {person.highlights.map((h) => (
          <span key={h} className="text-[12px] text-[#556070] bg-white border border-[#E6E8EC] rounded-full px-3 py-1">{h}</span>
        ))}
      </div>
    </div>
  );
}

function PersonPhoto({ person }: { person: typeof leadership[0]; }) {
  return (
    <img
      src={person.image}
      alt={person.name}
      className="w-[280px] h-[340px] object-cover object-top rounded-xl grayscale"
    />
  );
}

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      <section className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <h1 className="text-[44px] font-semibold text-[#0B0F17] text-center mb-4">
            Team
          </h1>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto">
            Built by operators with deep finance, product, and SME experience. A lean, hands-on team combining credit control expertise with production-grade AI systems.
          </p>
        </div>
      </section>

      <section className="py-16 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] text-center mb-14">
            Leadership
          </h2>
          <div className="space-y-16">
            {leadership.map((person, index) => {
              const imageOnRight = index % 2 === 1;
              return (
                <div
                  key={person.name}
                  className={`grid gap-10 items-start ${
                    imageOnRight
                      ? "md:grid-cols-[1fr_280px]"
                      : "md:grid-cols-[280px_1fr]"
                  }`}
                >
                  {imageOnRight ? (
                    <>
                      <PersonBio person={person} />
                      <div className="flex justify-center md:justify-end">
                        <PersonPhoto person={person} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-center md:justify-start">
                        <PersonPhoto person={person} />
                      </div>
                      <PersonBio person={person} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] text-center mb-14">
            Operations & Customer Success
          </h2>
          <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto">
            {team.map((person) => (
              <div key={person.name} className="flex flex-col items-center text-center">
                <img
                  src={person.image}
                  alt={person.name}
                  className="w-[240px] h-[280px] object-cover object-top rounded-xl grayscale mb-6"
                />
                <h3 className="text-[22px] font-semibold text-[#0B0F17] mb-1">{person.name}</h3>
                <p className="text-[15px] text-[#17B6C3] font-medium mb-4">{person.role}</p>
                <p className="text-[14px] text-[#556070] leading-relaxed mb-5 max-w-sm">{person.bio}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {person.highlights.map((h) => (
                    <span key={h} className="text-[12px] text-[#556070] bg-[#FAFBFC] border border-[#E6E8EC] rounded-full px-3 py-1">{h}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-[18px] text-[#556070] mb-8 italic">
            "A team optimised for trust, execution, and long-term adoption&mdash;not demos."
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/investors/why">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                Why Qashivo
              </Button>
            </Link>
            <Link href="/investors/contact">
              <Button className="bg-[#17B6C3] hover:bg-[#139CA8] text-white h-12 px-7 rounded-lg text-[15px] font-medium">
                Get in Touch
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <InvestorFooter />
    </div>
  );
}
