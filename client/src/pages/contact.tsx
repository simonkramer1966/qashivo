import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowRight, 
  Mail, 
  Phone, 
  MapPin,
  Clock,
  Users,
  MessageSquare,
  Send,
  Calendar,
  Headphones,
  Globe,
  Building
} from "lucide-react";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import contactHeroImage from "@assets/generated_images/Professional_customer_service_center_c4e17bc2.png";
import { Link } from "wouter";

export default function Contact() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const contactMethods = [
    {
      icon: Mail,
      title: "Email Support",
      value: "support@nexusar.com",
      description: "Get help with technical questions and account issues",
      availability: "24/7 response within 4 hours"
    },
    {
      icon: Phone,
      title: "Phone Support",
      value: "+1 (555) 123-4567",
      description: "Speak directly with our support specialists",
      availability: "Mon-Fri, 6AM-6PM PST"
    },
    {
      icon: MessageSquare,
      title: "Live Chat",
      value: "Available in-app",
      description: "Instant chat support for quick questions",
      availability: "24/7 automated + live agents"
    },
    {
      icon: Calendar,
      title: "Schedule Demo",
      value: "Book a call",
      description: "Personalized demo with our solutions experts",
      availability: "Flexible scheduling"
    }
  ];

  const offices = [
    {
      city: "San Francisco",
      address: "123 Market Street, Suite 300",
      region: "San Francisco, CA 94105",
      phone: "+1 (555) 123-4567"
    },
    {
      city: "New York",
      address: "456 Broadway, Floor 12",
      region: "New York, NY 10013", 
      phone: "+1 (555) 234-5678"
    },
    {
      city: "London",
      address: "78 King Street, Suite 200",
      region: "London, EC2V 8NH, UK",
      phone: "+44 20 7123 4567"
    }
  ];

  return (
    <div className="min-h-screen page-gradient">
      {/* Premium Navigation Header */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200/20 fixed w-full z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo Section */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-[#17B6C3]/10 backdrop-blur-sm rounded-xl flex items-center justify-center p-2">
                <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-gray-900" data-testid="text-brand-name">
                  Qashivo
                </h1>
                <p className="text-xs text-[#17B6C3] font-medium tracking-wide uppercase">
                  Cashflow Simplified
                </p>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="hidden lg:flex items-center space-x-8">
              <Link href="/" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-home">
                Home
              </Link>
              <Link href="/features" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-features">
                Features
              </Link>
              <Link href="/ai-capabilities" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-ai">
                AI Capabilities
              </Link>
              <Link href="/pricing" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-pricing">
                Pricing
              </Link>
              <Link href="/about" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-about">
                About
              </Link>
              <Link href="/investors" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-investors">
                Investors
              </Link>
              <Link href="/contact" className="text-[#17B6C3] font-semibold" data-testid="link-nav-contact">
                Contact
              </Link>
            </div>

            {/* CTA Section */}
            <div className="flex items-center space-x-4">
              <Button 
                onClick={handleLogin}
                variant="ghost"
                className="text-gray-700 hover:text-[#17B6C3] hover:bg-[#17B6C3]/5 font-medium"
                data-testid="button-nav-login"
              >
                Sign In
              </Button>
              <Button 
                onClick={handleLogin}
                className="bg-gradient-to-r from-[#17B6C3] to-[#1396A1] hover:from-[#1396A1] hover:to-[#117A85] text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                data-testid="button-nav-get-started"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Background Image */}
      <section 
        className="relative pt-32 pb-20 bg-cover bg-center"
        style={{ backgroundImage: `url(${contactHeroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#17B6C3]/85 via-[#1396A1]/80 to-slate-900/85"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-white/20 text-white border-white/30 mb-6 backdrop-blur-sm" data-testid="badge-contact-hero">
              Get In Touch
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-8" data-testid="text-contact-hero-title">
              We're Here to Help
            </h1>
            <p className="text-xl text-white/90 max-w-4xl mx-auto leading-relaxed" data-testid="text-contact-hero-description">
              Have questions about Qashivo? Need a personalized demo? Our team of experts is ready to help 
              you transform your accounts receivable process.
            </p>
          </div>

          {/* Response Time Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-contact-stat-response">&lt; 1hr</div>
              <div className="text-white/80">Average Response Time</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-contact-stat-satisfaction">99%</div>
              <div className="text-white/80">Support Satisfaction</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-contact-stat-availability">24/7</div>
              <div className="text-white/80">Support Availability</div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form & Methods */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            
            {/* Contact Form */}
            <div>
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold flex items-center" data-testid="text-contact-form-title">
                    <Send className="h-6 w-6 text-[#17B6C3] mr-3" />
                    Send us a Message
                  </CardTitle>
                  <CardDescription className="text-base">
                    Fill out the form below and we'll get back to you within 24 hours
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input 
                        id="firstName"
                        placeholder="Enter your first name"
                        className="bg-white/70 border-gray-200/30"
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input 
                        id="lastName"
                        placeholder="Enter your last name"
                        className="bg-white/70 border-gray-200/30"
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Business Email</Label>
                    <Input 
                      id="email"
                      type="email"
                      placeholder="Enter your business email"
                      className="bg-white/70 border-gray-200/30"
                      data-testid="input-email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Company Name</Label>
                    <Input 
                      id="company"
                      placeholder="Enter your company name"
                      className="bg-white/70 border-gray-200/30"
                      data-testid="input-company"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone"
                      placeholder="Enter your phone number"
                      className="bg-white/70 border-gray-200/30"
                      data-testid="input-phone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input 
                      id="subject"
                      placeholder="How can we help you?"
                      className="bg-white/70 border-gray-200/30"
                      data-testid="input-subject"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea 
                      id="message"
                      placeholder="Tell us more about your needs..."
                      className="bg-white/70 border-gray-200/30 min-h-[120px]"
                      data-testid="input-message"
                    />
                  </div>

                  <Button 
                    className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white font-semibold py-3"
                    data-testid="button-send-message"
                  >
                    Send Message
                    <Send className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Contact Methods */}
            <div className="space-y-6">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4" data-testid="text-contact-methods-title">
                  Get in Touch
                </h2>
                <p className="text-xl text-gray-600" data-testid="text-contact-methods-description">
                  Choose the way that works best for you to connect with our team
                </p>
              </div>

              {contactMethods.map((method, index) => (
                <Card key={index} className="bg-white/70 backdrop-blur-md border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" data-testid={`card-contact-method-${index}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="p-3 bg-[#17B6C3]/10 rounded-xl flex-shrink-0">
                        <method.icon className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">{method.title}</h3>
                        <p className="text-[#17B6C3] font-semibold mb-2">{method.value}</p>
                        <p className="text-gray-600 text-sm mb-2">{method.description}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="h-3 w-3 mr-1" />
                          {method.availability}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Office Locations */}
      <section className="py-20 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20 mb-6" data-testid="badge-offices">
              Global Presence
            </Badge>
            <h2 className="text-4xl font-bold text-gray-900 mb-6" data-testid="text-offices-title">
              Our Offices
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" data-testid="text-offices-description">
              We have offices around the world to provide local support and expertise
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {offices.map((office, index) => (
              <Card key={index} className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105" data-testid={`card-office-${index}`}>
                <CardContent className="p-6 text-center">
                  <div className="p-3 bg-[#17B6C3]/10 rounded-xl mx-auto mb-4 w-fit">
                    <Building className="h-8 w-8 text-[#17B6C3]" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{office.city}</h3>
                  <div className="space-y-2 text-gray-600">
                    <div className="flex items-center justify-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      <div className="text-sm">
                        <p>{office.address}</p>
                        <p>{office.region}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <Phone className="h-4 w-4 mr-2" />
                      <p className="text-sm">{office.phone}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6" data-testid="text-contact-faq-title">
              Common Questions
            </h2>
            <p className="text-xl text-gray-600" data-testid="text-contact-faq-description">
              Quick answers to questions you might have before contacting us
            </p>
          </div>

          <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <h3 className="font-bold text-gray-900 mb-2">How quickly can we get started?</h3>
                <p className="text-gray-600">Most customers are up and running within 24-48 hours. Enterprise setups may take 1-2 weeks depending on integration complexity.</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <h3 className="font-bold text-gray-900 mb-2">Do you offer implementation support?</h3>
                <p className="text-gray-600">Yes! All plans include setup assistance, and our Customer Success team provides ongoing support to ensure you achieve your goals.</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <h3 className="font-bold text-gray-900 mb-2">Can you integrate with our existing systems?</h3>
                <p className="text-gray-600">We integrate with 50+ accounting, CRM, and business systems. If you don't see your system listed, our team can build custom integrations.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call-to-Action Section */}
      <section className="py-24 bg-gradient-to-r from-[#17B6C3] to-[#1396A1]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6" data-testid="text-contact-cta-title">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-white/90 mb-12" data-testid="text-contact-cta-description">
            Don't wait - transform your collections process today with our AI-powered platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="text-lg px-8 py-4 bg-white text-[#17B6C3] hover:bg-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300"
              data-testid="button-contact-cta-trial"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              onClick={handleLogin}
              variant="outline"
              size="lg"
              className="text-lg px-8 py-4 border-white text-white hover:bg-white hover:text-[#17B6C3] transition-all duration-300"
              data-testid="button-contact-cta-demo"
            >
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2025 Qashivo Limited. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}