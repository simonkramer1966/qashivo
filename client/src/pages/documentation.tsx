import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Mail, MessageSquare, Phone, Bot, Settings, TrendingUp, Shield, Workflow, Zap, Database, Lock, FileText, Code, Activity, RefreshCw } from "lucide-react";

export default function Documentation() {
  const { isAuthenticated } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sections = [
    { id: "overview", name: "System Overview", icon: BookOpen },
    { id: "customer-rating", name: "Customer Rating System", icon: Shield },
    { id: "email", name: "Email Communication", icon: Mail },
    { id: "sms", name: "SMS & WhatsApp", icon: MessageSquare },
    { id: "voice", name: "Voice & AI Calls", icon: Phone },
    { id: "collections", name: "Collections Automation", icon: Workflow },
    { id: "ai-learning", name: "Policy Execution System", icon: Bot },
    { id: "comm-modes", name: "Communication Modes", icon: Settings },
    { id: "xero", name: "Xero Integration", icon: Database },
    { id: "stripe", name: "Payment Processing", icon: Lock },
  ];

  const syncDocsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/documentation/sync', { baseBranch: 'HEAD~1' });
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.suggestions && data.suggestions.length > 0) {
        toast({
          title: "Documentation Sync Complete",
          description: `${data.suggestions.length} updates suggested. Review them in the Documentation Review page.`,
        });
      } else {
        toast({
          title: "No Updates Needed",
          description: data.message || "Documentation is already up to date with recent code changes.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/documentation/content'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync documentation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateDocs = () => {
    syncDocsMutation.mutate();
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <NewSidebar />
      
      <main className="flex-1 overflow-y-auto">
        <Header title="Documentation" subtitle="Complete system guide and reference" />
        
        <div className="container mx-auto px-6 py-6 max-w-7xl">
          {/* Page Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">System Documentation</h1>
              <p className="text-muted-foreground">
                Complete guide to understanding how Qashivo's AI-driven collections platform works
              </p>
            </div>
            <Button
              onClick={handleUpdateDocs}
              disabled={syncDocsMutation.isPending}
              className="bg-background/70 hover:bg-background/90 backdrop-blur-md border border-border/30 shadow-lg text-[#17B6C3] hover:text-[#1396A1] font-medium transition-all"
              data-testid="button-update-docs"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncDocsMutation.isPending ? 'animate-spin' : ''}`} />
              {syncDocsMutation.isPending ? 'Updating...' : 'Update Documentation'}
            </Button>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar Navigation */}
            <div className="col-span-3">
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg sticky top-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Contents</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <nav className="space-y-1">
                    {sections.map((section) => {
                      const Icon = section.icon;
                      return (
                        <button
                          key={section.id}
                          onClick={() => scrollToSection(section.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all ${
                            activeSection === section.id
                              ? 'bg-[#17B6C3]/10 border-l-4 border-[#17B6C3] text-[#17B6C3] font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                          data-testid={`nav-${section.id}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{section.name}</span>
                        </button>
                      );
                    })}
                  </nav>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="col-span-9 space-y-8">
              
              {/* System Overview */}
              <section id="overview">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <BookOpen className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">System Overview</CardTitle>
                    </div>
                    <CardDescription>
                      Understanding Qashivo's AI-driven accounts receivable platform
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">What is Qashivo?</h3>
                      <p className="text-gray-600 mb-4">
                        Qashivo is an intelligent accounts receivable and debt recovery platform that automates your collections process. 
                        The system executes your collection policies consistently across all channels, improving cash flow and reducing days sales outstanding (DSO).
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Core Features</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-sm">Multi-Channel Communication</span>
                          </div>
                          <p className="text-xs text-gray-600">Email, SMS, WhatsApp, and AI voice calls</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Bot className="h-4 w-4 text-purple-600" />
                            <span className="font-medium text-sm">Intent Detection Engine</span>
                          </div>
                          <p className="text-xs text-gray-600">Real-time response classification</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Workflow className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-sm">Automated Workflows</span>
                          </div>
                          <p className="text-xs text-gray-600">Scheduled collection sequences</p>
                        </div>
                        <div className="p-3 bg-teal-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-teal-600" />
                            <span className="font-medium text-sm">Real-time Analytics</span>
                          </div>
                          <p className="text-xs text-gray-600">Track effectiveness and trends</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Platform Architecture</h3>
                      <p className="text-gray-600 mb-3">
                        The system is built on three key pillars:
                      </p>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Data Integration Layer:</strong> Connects to Xero for real-time invoice and contact data synchronization</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>AI Decision Engine:</strong> Analyzes customer behavior and optimizes communication strategies</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Communication Gateway:</strong> Orchestrates multi-channel outreach with mode enforcement</span>
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Customer Rating System */}
              <section id="customer-rating">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Shield className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Customer Rating System</CardTitle>
                    </div>
                    <CardDescription>
                      How we calculate and categorize customer payment behavior
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Rating Categories</h3>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="p-4 bg-[#4FAD80]/10 border-2 border-[#4FAD80]/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-5 w-5 text-[#4FAD80] fill-[#4FAD80]" />
                            <span className="font-bold text-[#4FAD80]">Good</span>
                          </div>
                          <p className="text-sm text-gray-600">Score: 70-100</p>
                          <p className="text-xs text-gray-500 mt-1">Pays on time, reliable, responsive</p>
                        </div>
                        <div className="p-4 bg-[#E8A23B]/10 border-2 border-[#E8A23B]/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-5 w-5 text-[#E8A23B] fill-[#E8A23B]" />
                            <span className="font-bold text-[#E8A23B]">Average</span>
                          </div>
                          <p className="text-sm text-gray-600">Score: 40-69</p>
                          <p className="text-xs text-gray-500 mt-1">Occasional delays, needs reminders</p>
                        </div>
                        <div className="p-4 bg-[#C75C5C]/10 border-2 border-[#C75C5C]/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-5 w-5 text-[#C75C5C] fill-[#C75C5C]" />
                            <span className="font-bold text-[#C75C5C]">Poor</span>
                          </div>
                          <p className="text-sm text-gray-600">Score: 0-39</p>
                          <p className="text-xs text-gray-500 mt-1">Frequent delays, disputes, or non-payment</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Calculation Formula</h3>
                      <p className="text-gray-600 mb-3">
                        The customer rating is calculated using a weighted scoring system that considers four key factors:
                      </p>
                      
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <code className="text-sm font-mono">
                          Total Score = (Payment Timing × 0.35) + (Payment Reliability × 0.30) + (Response Rate × 0.20) + (Dispute History × 0.15)
                        </code>
                      </div>

                      <div className="space-y-4">
                        <div className="border-l-4 border-[#17B6C3] pl-4">
                          <h4 className="font-semibold mb-2">1. Payment Timing (35% weight)</h4>
                          <p className="text-sm text-gray-600 mb-2">
                            Measures average days to pay relative to due date. Earlier payments receive higher scores.
                          </p>
                          <div className="bg-blue-50 p-3 rounded text-sm">
                            <p className="font-medium mb-1">Scoring:</p>
                            <ul className="space-y-1 text-gray-600">
                              <li>• Paid early/on-time (≤0 days): 100 points</li>
                              <li>• 1-7 days late: 85 points</li>
                              <li>• 8-14 days late: 70 points</li>
                              <li>• 15-30 days late: 50 points</li>
                              <li>• 31-60 days late: 25 points</li>
                              <li>• 60+ days late: 0 points</li>
                            </ul>
                          </div>
                        </div>

                        <div className="border-l-4 border-purple-500 pl-4">
                          <h4 className="font-semibold mb-2">2. Payment Reliability (30% weight)</h4>
                          <p className="text-sm text-gray-600 mb-2">
                            Percentage of invoices that have been paid out of total invoices issued.
                          </p>
                          <div className="bg-purple-50 p-3 rounded text-sm">
                            <p className="font-medium mb-1">Formula:</p>
                            <code className="text-gray-700">(Paid Invoices / Total Invoices) × 100</code>
                            <p className="text-gray-600 mt-2">
                              A customer who pays 9 out of 10 invoices scores 90/100 for reliability.
                            </p>
                          </div>
                        </div>

                        <div className="border-l-4 border-[#4FAD80] pl-4">
                          <h4 className="font-semibold mb-2">3. Response Rate (20% weight)</h4>
                          <p className="text-sm text-gray-600 mb-2">
                            How often the customer responds to collection communications.
                          </p>
                          <div className="bg-[#4FAD80]/10 p-3 rounded text-sm">
                            <p className="font-medium mb-1">Formula:</p>
                            <code className="text-gray-700">(Response Actions / Communication Actions) × 100</code>
                            <p className="text-gray-600 mt-2">
                              Response actions include: email opened, SMS replied, call answered, payment promise made.
                            </p>
                          </div>
                        </div>

                        <div className="border-l-4 border-[#E8A23B] pl-4">
                          <h4 className="font-semibold mb-2">4. Dispute History (15% weight)</h4>
                          <p className="text-sm text-gray-600 mb-2">
                            Frequency of disputes or complaints relative to invoices.
                          </p>
                          <div className="bg-[#E8A23B]/10 p-3 rounded text-sm">
                            <p className="font-medium mb-1">Scoring:</p>
                            <ul className="space-y-1 text-gray-600">
                              <li>• No disputes: 100 points</li>
                              <li>• &lt;10% dispute rate: 75 points</li>
                              <li>• 10-25% dispute rate: 50 points</li>
                              <li>• 25-50% dispute rate: 25 points</li>
                              <li>• 50%+ dispute rate: 0 points</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Why This Formula?</h3>
                      <p className="text-gray-600 mb-3">
                        The weighted approach prioritizes the factors that most accurately predict future payment behavior:
                      </p>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">35%</Badge>
                          <span><strong>Payment Timing</strong> is weighted highest because it's the strongest predictor of cash flow impact and collection difficulty</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Badge className="bg-purple-500 text-white mt-0.5">30%</Badge>
                          <span><strong>Payment Reliability</strong> indicates overall creditworthiness and willingness to pay</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Badge className="bg-[#4FAD80] text-white mt-0.5">20%</Badge>
                          <span><strong>Response Rate</strong> shows engagement level and likelihood of successful collection</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Badge className="bg-[#E8A23B] text-white mt-0.5">15%</Badge>
                          <span><strong>Dispute History</strong> identifies problematic relationships requiring special handling</span>
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Email Communication */}
              <section id="email">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Mail className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Email Communication</CardTitle>
                    </div>
                    <CardDescription>
                      How the system sends, tracks, and measures email effectiveness
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Email Provider: SendGrid</h3>
                      <p className="text-gray-600 mb-3">
                        Qashivo uses SendGrid for reliable email delivery with comprehensive tracking capabilities. All emails are sent through SendGrid's API with built-in bounce handling, spam filtering, and delivery optimization.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Email Templates</h3>
                      <p className="text-gray-600 mb-3">
                        Templates are customizable and can include:
                      </p>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Dynamic fields:</strong> Customer name, invoice number, amount, due date, days overdue</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Payment links:</strong> Direct checkout URLs via Stripe integration</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Tone customization:</strong> Gentle reminder, firm notice, final warning</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Email Tracking</h3>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="font-medium mb-2">We track the following metrics:</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Delivery Metrics</p>
                            <ul className="text-sm text-gray-600 mt-1 space-y-1">
                              <li>• Sent successfully</li>
                              <li>• Delivery confirmed</li>
                              <li>• Bounced (hard/soft)</li>
                              <li>• Spam reported</li>
                            </ul>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">Engagement Metrics</p>
                            <ul className="text-sm text-gray-600 mt-1 space-y-1">
                              <li>• Email opened</li>
                              <li>• Links clicked</li>
                              <li>• Time to open</li>
                              <li>• Device/location</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Effectiveness Measurement</h3>
                      <div className="bg-gray-50 rounded-lg p-4 mb-3">
                        <code className="text-sm font-mono">
                          Email Effectiveness = (Successful Outcomes / Total Emails Sent) × 100
                        </code>
                      </div>
                      <p className="text-gray-600 mb-3">
                        <strong>Successful outcomes</strong> are defined as:
                      </p>
                      <ul className="space-y-1 text-gray-600">
                        <li>• Payment received within 7 days of email</li>
                        <li>• Payment promise made</li>
                        <li>• Customer contact initiated</li>
                      </ul>
                      <p className="text-gray-600 mt-3">
                        The system tracks this per customer to build individual email effectiveness scores, which are used by the AI to optimize future communication strategies.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">When Emails Are Sent</h3>
                      <p className="text-gray-600 mb-3">
                        Emails are triggered based on collection workflow schedules. The system checks:
                      </p>
                      <ol className="space-y-2 text-gray-600 list-decimal list-inside">
                        <li><strong>Invoice status:</strong> Must be overdue or approaching due date</li>
                        <li><strong>Last contact:</strong> Minimum time gap since previous communication (to avoid spam)</li>
                        <li><strong>Payment check:</strong> Verifies no recent payment has been received</li>
                        <li><strong>Communication mode:</strong> Ensures system is in Live or Soft Live mode</li>
                        <li><strong>Customer preference:</strong> AI-optimized channel selection</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* SMS & WhatsApp */}
              <section id="sms">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <MessageSquare className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">SMS & WhatsApp Communication</CardTitle>
                    </div>
                    <CardDescription>
                      Text-based messaging for immediate customer engagement
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Messaging Provider: Twilio</h3>
                      <p className="text-gray-600 mb-3">
                        Qashivo uses Twilio for SMS and WhatsApp messaging, providing global reach with high deliverability rates. Twilio's infrastructure ensures messages are delivered quickly and reliably across all major carriers.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">SMS vs WhatsApp</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-green-600" />
                            SMS
                          </h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Universal (works on all phones)</li>
                            <li>• 160 character limit per message</li>
                            <li>• Higher open rates (98%)</li>
                            <li>• Cost: ~£0.04 per message</li>
                            <li>• Best for: Urgent reminders</li>
                          </ul>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-[#25D366]" />
                            WhatsApp
                          </h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Requires WhatsApp app</li>
                            <li>• Rich media support</li>
                            <li>• Read receipts</li>
                            <li>• Cost: ~£0.01 per message</li>
                            <li>• Best for: Detailed updates</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Message Delivery Process</h3>
                      <ol className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">1</Badge>
                          <div>
                            <p className="font-medium">Template Selection</p>
                            <p className="text-sm">AI selects optimal message template based on customer profile and invoice status</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">2</Badge>
                          <div>
                            <p className="font-medium">Personalization</p>
                            <p className="text-sm">System populates dynamic fields (name, amount, payment link)</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">3</Badge>
                          <div>
                            <p className="font-medium">Twilio API Call</p>
                            <p className="text-sm">Message sent via Twilio with delivery tracking</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">4</Badge>
                          <div>
                            <p className="font-medium">Response Tracking</p>
                            <p className="text-sm">Webhook captures delivery status, read receipts, and customer replies</p>
                          </div>
                        </li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Response Tracking</h3>
                      <p className="text-gray-600 mb-3">
                        The system captures and analyzes:
                      </p>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Delivery confirmation:</strong> Message successfully reached the phone</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Read receipts:</strong> Customer opened the message (WhatsApp only)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Reply detection:</strong> Customer responded to the message</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Link clicks:</strong> Customer clicked payment or contact links</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Effectiveness Calculation</h3>
                      <div className="bg-gray-50 rounded-lg p-4 mb-3">
                        <code className="text-sm font-mono">
                          SMS Effectiveness = (Payment Actions + Engagement Actions) / Total SMS Sent × 100
                        </code>
                      </div>
                      <p className="text-gray-600">
                        <strong>Payment actions:</strong> Payment received within 3 days<br />
                        <strong>Engagement actions:</strong> Reply sent, link clicked, payment promise made
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Voice & AI Calls */}
              <section id="voice">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Phone className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Voice & AI Calls</CardTitle>
                    </div>
                    <CardDescription>
                      Automated phone conversations for complex collection scenarios
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Voice Platform: Retell AI</h3>
                      <p className="text-gray-600 mb-3">
                        Qashivo uses Retell AI for conversational AI phone calls. The system can conduct natural, context-aware conversations with customers, handling payment negotiations, promise collection, and dispute resolution.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Call Workflows</h3>
                      <p className="text-gray-600 mb-3">
                        Each AI call follows a structured workflow defined by:
                      </p>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                          <h4 className="font-medium mb-2 text-blue-900">1. Call Initiation</h4>
                          <ul className="text-sm text-gray-700 space-y-1">
                            <li>• System dials customer using Retell API</li>
                            <li>• Customer context loaded (invoice details, history, preferences)</li>
                            <li>• AI greeting personalized to customer relationship</li>
                          </ul>
                        </div>
                        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                          <h4 className="font-medium mb-2 text-purple-900">2. Conversation Flow</h4>
                          <ul className="text-sm text-gray-700 space-y-1">
                            <li>• AI explains purpose of call</li>
                            <li>• Customer can ask questions, negotiate, or make promises</li>
                            <li>• AI handles objections with pre-programmed responses</li>
                            <li>• Natural language understanding interprets intent</li>
                          </ul>
                        </div>
                        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                          <h4 className="font-medium mb-2 text-green-900">3. Outcome Capture</h4>
                          <ul className="text-sm text-gray-700 space-y-1">
                            <li>• Payment promise recorded with date</li>
                            <li>• Dispute details logged for human follow-up</li>
                            <li>• Call transcript saved for compliance</li>
                            <li>• Next action scheduled automatically</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">AI Conversation Handling</h3>
                      <p className="text-gray-600 mb-3">
                        The AI is trained to handle common scenarios:
                      </p>
                      <div className="space-y-2">
                        <div className="bg-white border rounded-lg p-3">
                          <p className="font-medium text-sm mb-1">Payment Negotiation</p>
                          <p className="text-xs text-gray-600">AI can offer payment plans, partial payment acceptance, or extended terms within pre-set parameters</p>
                        </div>
                        <div className="bg-white border rounded-lg p-3">
                          <p className="font-medium text-sm mb-1">Objection Handling</p>
                          <p className="text-xs text-gray-600">Common objections like "I never received the invoice" or "I thought I already paid" are addressed automatically</p>
                        </div>
                        <div className="bg-white border rounded-lg p-3">
                          <p className="font-medium text-sm mb-1">Escalation Protocol</p>
                          <p className="text-xs text-gray-600">Complex disputes or emotional customers are flagged for human agent callback</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Outcome Measurement</h3>
                      <div className="bg-gray-50 rounded-lg p-4 mb-3">
                        <code className="text-sm font-mono">
                          Call Effectiveness = (Successful Calls / Total Calls Made) × 100
                        </code>
                      </div>
                      <p className="text-gray-600 mb-3">
                        <strong>Successful call outcomes:</strong>
                      </p>
                      <ul className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <li>• Payment promise obtained</li>
                        <li>• Payment made immediately</li>
                        <li>• Payment plan agreed</li>
                        <li>• Dispute resolved</li>
                        <li>• Contact details updated</li>
                        <li>• Escalation to human agent</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Success Metrics</h3>
                      <p className="text-gray-600 mb-3">
                        The system tracks:
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-50 p-3 rounded">
                          <p className="text-2xl font-bold text-blue-700">87%</p>
                          <p className="text-xs text-gray-600">Connection rate</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded">
                          <p className="text-2xl font-bold text-purple-700">3.2m</p>
                          <p className="text-xs text-gray-600">Avg call duration</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded">
                          <p className="text-2xl font-bold text-green-700">64%</p>
                          <p className="text-xs text-gray-600">Success rate</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Collections Automation */}
              <section id="collections">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Workflow className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Collections Automation</CardTitle>
                    </div>
                    <CardDescription>
                      How workflows, schedules, and automation drive the collections process
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">What are Collection Workflows?</h3>
                      <p className="text-gray-600 mb-3">
                        A collection workflow is a predefined sequence of actions (emails, SMS, calls) that automatically execute based on invoice status and customer behavior. Think of it as a recipe for debt recovery that the AI follows and optimizes.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Default Schedule Assignment</h3>
                      <p className="text-gray-600 mb-3">
                        When a new customer is created or synced from Xero:
                      </p>
                      <ol className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">1</Badge>
                          <div>
                            <p className="font-medium">Check for Existing Rating</p>
                            <p className="text-sm">If customer has payment history, their rating (Good/Average/Poor) determines the initial schedule</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">2</Badge>
                          <div>
                            <p className="font-medium">Apply Default Rule</p>
                            <p className="text-sm">
                              • <strong>Good customers:</strong> Gentle reminder schedule (fewer touches, longer gaps)<br />
                              • <strong>Average customers:</strong> Standard collection schedule<br />
                              • <strong>Poor customers:</strong> Aggressive schedule (more frequent, escalating tone)<br />
                              • <strong>New customers:</strong> Standard schedule until rating is established
                            </p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">3</Badge>
                          <div>
                            <p className="font-medium">AI Optimization</p>
                            <p className="text-sm">After 5+ interactions, AI may recommend schedule changes based on effectiveness data</p>
                          </div>
                        </li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Manual Schedule Assignment</h3>
                      <p className="text-gray-600 mb-3">
                        Users can manually assign customers to specific schedules from the Customers page. This overrides the default assignment and AI recommendations until changed again.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">How Actions Are Triggered</h3>
                      <p className="text-gray-600 mb-3">
                        The collections scheduler runs every 60 minutes and follows this logic:
                      </p>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div>
                          <p className="font-medium mb-2">1. Invoice Status Check</p>
                          <code className="text-xs">
                            IF (invoice.status == 'overdue' OR invoice.status == 'pending') AND (invoice.dueDate &lt; currentDate)
                          </code>
                        </div>
                        <div>
                          <p className="font-medium mb-2">2. Schedule Action Lookup</p>
                          <p className="text-sm text-gray-600">
                            System finds the customer's assigned schedule and identifies the next action based on days overdue
                          </p>
                        </div>
                        <div>
                          <p className="font-medium mb-2">3. Duplicate Prevention</p>
                          <code className="text-xs">
                            IF lastAction.createdAt &gt; (currentTime - actionMinimumGap) THEN skip
                          </code>
                        </div>
                        <div>
                          <p className="font-medium mb-2">4. Payment Verification</p>
                          <p className="text-sm text-gray-600">
                            Check if payment has been received since last check (via Xero sync or Stripe webhook)
                          </p>
                        </div>
                        <div>
                          <p className="font-medium mb-2">5. AI Optimization</p>
                          <p className="text-sm text-gray-600">
                            AI may adjust action type or timing based on customer's historical channel effectiveness
                          </p>
                        </div>
                        <div>
                          <p className="font-medium mb-2">6. Execute Action</p>
                          <p className="text-sm text-gray-600">
                            Send communication via selected channel and log action in database
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Payment Check Logic</h3>
                      <p className="text-gray-600 mb-3">
                        Before sending any communication, the system verifies payment status:
                      </p>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Xero Sync:</strong> Invoice status is refreshed from Xero every 15 minutes</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Stripe Webhook:</strong> Immediate notification when payment is received via Stripe</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Manual Marking:</strong> Users can manually mark invoices as paid</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Partial Payments:</strong> System adjusts outstanding amount and continues appropriate collection sequence</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Example Workflow Schedule</h3>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-3 border-b">Days Overdue</th>
                              <th className="text-left p-3 border-b">Action</th>
                              <th className="text-left p-3 border-b">Channel</th>
                              <th className="text-left p-3 border-b">Tone</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            <tr className="border-b">
                              <td className="p-3">0 (Due today)</td>
                              <td className="p-3">Gentle reminder</td>
                              <td className="p-3">Email</td>
                              <td className="p-3">Friendly</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-3">3 days</td>
                              <td className="p-3">Follow-up</td>
                              <td className="p-3">Email</td>
                              <td className="p-3">Polite</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-3">7 days</td>
                              <td className="p-3">Urgent reminder</td>
                              <td className="p-3">SMS</td>
                              <td className="p-3">Direct</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-3">14 days</td>
                              <td className="p-3">Collection call</td>
                              <td className="p-3">Voice</td>
                              <td className="p-3">Firm</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-3">21 days</td>
                              <td className="p-3">Final notice</td>
                              <td className="p-3">Email + SMS</td>
                              <td className="p-3">Formal</td>
                            </tr>
                            <tr>
                              <td className="p-3">30+ days</td>
                              <td className="p-3">Escalation</td>
                              <td className="p-3">Human agent</td>
                              <td className="p-3">Legal tone</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Policy Execution System */}
              <section id="ai-learning">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Bot className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Policy Execution System</CardTitle>
                    </div>
                    <CardDescription>
                      How Qashivo executes and tracks your collection strategies
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Customer Learning Profiles</h3>
                      <p className="text-gray-600 mb-3">
                        Every customer has an AI learning profile stored in the <code className="bg-gray-100 px-2 py-1 rounded">customer_learning_profiles</code> table. This profile contains:
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">Channel Effectiveness</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Email effectiveness (0-1 score)</li>
                            <li>• SMS effectiveness (0-1 score)</li>
                            <li>• Voice effectiveness (0-1 score)</li>
                            <li>• Preferred channel</li>
                          </ul>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">Behavioral Data</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Average response time</li>
                            <li>• Payment reliability score</li>
                            <li>• Total interactions</li>
                            <li>• Successful actions count</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Learning Mechanism: Weighted Averaging</h3>
                      <p className="text-gray-600 mb-3">
                        The AI uses a <strong>weighted averaging approach (80/20 rule)</strong> to update effectiveness scores:
                      </p>
                      <div className="bg-gray-50 rounded-lg p-4 mb-3">
                        <code className="text-sm font-mono">
                          New Score = (Current Score × 0.80) + (New Outcome × 0.20)
                        </code>
                      </div>
                      <p className="text-gray-600 mb-3">
                        <strong>Why this formula?</strong>
                      </p>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <Badge className="bg-blue-500 text-white mt-0.5">80%</Badge>
                          <span><strong>Historical weight</strong> prevents drastic changes from single events, ensuring stability</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Badge className="bg-purple-500 text-white mt-0.5">20%</Badge>
                          <span><strong>New data weight</strong> allows gradual adaptation to changing customer behavior</span>
                        </li>
                      </ul>
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <p className="font-medium mb-2">Example:</p>
                        <p className="text-sm text-gray-700">
                          Customer has email effectiveness of 0.60 (60%). They receive an email and pay immediately (outcome = 1.0).<br />
                          <code className="bg-white px-2 py-1 rounded mt-1 inline-block">
                            New Score = (0.60 × 0.80) + (1.0 × 0.20) = 0.48 + 0.20 = 0.68 (68%)
                          </code>
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Confidence Scoring</h3>
                      <p className="text-gray-600 mb-3">
                        The learning confidence score indicates how reliable the AI's predictions are:
                      </p>
                      <div className="bg-gray-50 rounded-lg p-4 mb-3">
                        <code className="text-sm font-mono">
                          Confidence = min(Total Interactions / 20, 1.0)
                        </code>
                      </div>
                      <p className="text-gray-600 mb-3">
                        This means:
                      </p>
                      <ul className="space-y-1 text-gray-600">
                        <li>• <strong>0-5 interactions:</strong> Low confidence (0-25%) - AI uses defaults</li>
                        <li>• <strong>6-10 interactions:</strong> Medium confidence (30-50%) - AI begins optimization</li>
                        <li>• <strong>11-19 interactions:</strong> High confidence (55-95%) - AI actively optimizes</li>
                        <li>• <strong>20+ interactions:</strong> Maximum confidence (100%) - Full AI optimization</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Action Optimization Logic</h3>
                      <p className="text-gray-600 mb-3">
                        When generating collection actions, the AI:
                      </p>
                      <ol className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">1</Badge>
                          <div>
                            <p className="font-medium">Loads Customer Profile</p>
                            <p className="text-sm">Retrieves learning profile with effectiveness scores</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">2</Badge>
                          <div>
                            <p className="font-medium">Checks Confidence Level</p>
                            <p className="text-sm">If confidence &lt; 50%, use schedule defaults. If ≥50%, apply AI optimization</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">3</Badge>
                          <div>
                            <p className="font-medium">Selects Optimal Channel</p>
                            <p className="text-sm">Chooses channel with highest effectiveness score, or preferred channel if scores are close (within 0.15)</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">4</Badge>
                          <div>
                            <p className="font-medium">Adjusts Timing</p>
                            <p className="text-sm">Uses average response time to optimize send time (e.g., if customer responds faster to morning emails)</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">5</Badge>
                          <div>
                            <p className="font-medium">Creates Action</p>
                            <p className="text-sm">Generates optimized action with AI-selected channel and timing</p>
                          </div>
                        </li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">A/B Testing Framework</h3>
                      <p className="text-gray-600 mb-3">
                        The system runs continuous A/B tests stored in <code className="bg-gray-100 px-2 py-1 rounded">collection_ab_tests</code> table:
                      </p>
                      <div className="space-y-2">
                        <div className="bg-white border rounded-lg p-3">
                          <p className="font-medium text-sm mb-1">Template Testing</p>
                          <p className="text-xs text-gray-600">Different message templates tested against each other for same scenario</p>
                        </div>
                        <div className="bg-white border rounded-lg p-3">
                          <p className="font-medium text-sm mb-1">Timing Tests</p>
                          <p className="text-xs text-gray-600">Morning vs afternoon vs evening send times compared</p>
                        </div>
                        <div className="bg-white border rounded-lg p-3">
                          <p className="font-medium text-sm mb-1">Channel Mix Tests</p>
                          <p className="text-xs text-gray-600">Email-first vs SMS-first strategies evaluated</p>
                        </div>
                      </div>
                      <p className="text-gray-600 mt-3">
                        Results from these tests feed back into the learning algorithm, continuously improving system-wide effectiveness.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Why This Approach Works</h3>
                      <p className="text-gray-600 mb-3">
                        Our AI learning system is designed to:
                      </p>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Start conservatively:</strong> Uses proven workflows until it has enough data</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Learn gradually:</strong> 80/20 weighting prevents overreaction to outliers</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Optimize individually:</strong> Each customer gets personalized treatment</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Improve systematically:</strong> A/B tests benefit all customers over time</span>
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Communication Modes */}
              <section id="comm-modes">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Settings className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Communication Modes</CardTitle>
                    </div>
                    <CardDescription>
                      Safe testing and controlled rollout of automated communications
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">What are Communication Modes?</h3>
                      <p className="text-gray-600 mb-3">
                        Communication modes are safety controls that determine whether and how the system sends automated messages. This prevents accidental customer contact during testing or setup.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">The Four Modes</h3>
                      <div className="space-y-3">
                        <div className="border-l-4 border-gray-400 pl-4 bg-gray-50 p-4 rounded-r-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-gray-500">Comms Off</Badge>
                            <span className="font-semibold">Communications Disabled</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>What happens:</strong> No communications are sent. Actions are created but blocked.
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>When to use:</strong> System setup, testing workflows, importing customer data
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Activity logging:</strong> All blocked attempts are logged for review
                          </p>
                        </div>

                        <div className="border-l-4 border-blue-400 pl-4 bg-blue-50 p-4 rounded-r-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-blue-500">Testing</Badge>
                            <span className="font-semibold">Testing Mode</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>What happens:</strong> Communications are generated but not sent. Actions logged as "test".
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>When to use:</strong> Validating templates, checking action triggers, reviewing AI decisions
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Activity logging:</strong> Full details logged including would-be recipient and content
                          </p>
                        </div>

                        <div className="border-l-4 border-amber-400 pl-4 bg-amber-50 p-4 rounded-r-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-amber-500">Soft Live</Badge>
                            <span className="font-semibold">Limited Live Mode</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>What happens:</strong> Communications sent ONLY to designated test contacts. Real customers are blocked.
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>When to use:</strong> Final testing with real email/SMS/call delivery before full launch
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Recipient substitution:</strong> Customer email/phone replaced with test contact details
                          </p>
                          <div className="mt-3 p-3 bg-white rounded border border-amber-200">
                            <p className="text-xs font-medium mb-1">Test Contact Configuration:</p>
                            <ul className="text-xs text-gray-600 space-y-0.5">
                              <li>• Set in tenant settings</li>
                              <li>• Separate test email, phone, WhatsApp</li>
                              <li>• All production communications redirected here</li>
                            </ul>
                          </div>
                        </div>

                        <div className="border-l-4 border-green-400 pl-4 bg-green-50 p-4 rounded-r-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-green-500">Live</Badge>
                            <span className="font-semibold">Production Mode</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>What happens:</strong> Full system operation. All communications sent to actual customers.
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>When to use:</strong> After testing complete, ready for production collections
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Activity logging:</strong> All actions logged with full audit trail
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Mode Enforcement Architecture</h3>
                      <p className="text-gray-600 mb-3">
                        The system enforces modes through a centralized CommunicationsGateway:
                      </p>
                      <ol className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">1</Badge>
                          <div>
                            <p className="font-medium">Action Created</p>
                            <p className="text-sm">Collection scheduler or manual action creates communication intent</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">2</Badge>
                          <div>
                            <p className="font-medium">Mode Check</p>
                            <p className="text-sm">TenantConfigCache retrieves current communication mode setting</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">3</Badge>
                          <div>
                            <p className="font-medium">Enforcement Decision</p>
                            <p className="text-sm">
                              • <strong>Comms Off:</strong> Action blocked, logged<br />
                              • <strong>Testing:</strong> Action logged, not sent<br />
                              • <strong>Soft Live:</strong> Recipient substituted with test contact<br />
                              • <strong>Live:</strong> Action proceeds normally
                            </p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">4</Badge>
                          <div>
                            <p className="font-medium">Activity Logging</p>
                            <p className="text-sm">ActivityLogger records action with mode, outcome, and any substitutions</p>
                          </div>
                        </li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Recommended Rollout Process</h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <ol className="space-y-3 text-sm text-gray-700">
                          <li>
                            <strong>1. Comms Off:</strong> Import customers, configure workflows, set up templates (1-2 days)
                          </li>
                          <li>
                            <strong>2. Testing Mode:</strong> Validate action triggers, review AI decisions, check timing (2-3 days)
                          </li>
                          <li>
                            <strong>3. Soft Live:</strong> Send real emails/SMS to your test contacts, verify delivery and formatting (3-5 days)
                          </li>
                          <li>
                            <strong>4. Live (Pilot):</strong> Enable for small customer segment (10-20 customers), monitor closely (1-2 weeks)
                          </li>
                          <li>
                            <strong>5. Live (Full):</strong> Roll out to all customers after pilot success
                          </li>
                        </ol>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Xero Integration */}
              <section id="xero">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Database className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Xero Integration</CardTitle>
                    </div>
                    <CardDescription>
                      Real-time data synchronization with your accounting platform
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">OAuth Authentication Flow</h3>
                      <p className="text-gray-600 mb-3">
                        Qashivo uses OAuth 2.0 for secure, user-authorized access to Xero data:
                      </p>
                      <ol className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">1</Badge>
                          <div>
                            <p className="font-medium">Authorization Request</p>
                            <p className="text-sm">User clicks "Connect Xero" → redirected to Xero login</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">2</Badge>
                          <div>
                            <p className="font-medium">User Grants Permission</p>
                            <p className="text-sm">User authorizes Qashivo to access their Xero organization</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">3</Badge>
                          <div>
                            <p className="font-medium">Token Exchange</p>
                            <p className="text-sm">Xero redirects back with authorization code, exchanged for access token</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">4</Badge>
                          <div>
                            <p className="font-medium">Token Storage</p>
                            <p className="text-sm">Access and refresh tokens securely stored, encrypted at rest</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">5</Badge>
                          <div>
                            <p className="font-medium">Auto-Refresh</p>
                            <p className="text-sm">System automatically refreshes tokens before expiry (every 30 minutes)</p>
                          </div>
                        </li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Data Synchronization</h3>
                      <p className="text-gray-600 mb-3">
                        The system syncs the following data from Xero:
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">Invoices</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Invoice number, date, due date</li>
                            <li>• Amount due, paid amount</li>
                            <li>• Status (pending, paid, overdue)</li>
                            <li>• Line items and descriptions</li>
                          </ul>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">Contacts</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Name, company name</li>
                            <li>• Email addresses</li>
                            <li>• Phone numbers</li>
                            <li>• Billing address</li>
                          </ul>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">Payments</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Payment date and amount</li>
                            <li>• Payment method</li>
                            <li>• Applied to which invoice</li>
                            <li>• Bank account details</li>
                          </ul>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">Credit Notes</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Credit note number, amount</li>
                            <li>• Applied to invoice</li>
                            <li>• Remaining credit</li>
                            <li>• Date issued</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Sync Frequency</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                          <span className="text-sm font-medium">Initial Sync</span>
                          <Badge className="bg-[#17B6C3] text-white">On Connection</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                          <span className="text-sm font-medium">Invoice Updates</span>
                          <Badge className="bg-blue-500 text-white">Every 15 minutes</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                          <span className="text-sm font-medium">Contact Updates</span>
                          <Badge className="bg-purple-500 text-white">Every 30 minutes</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                          <span className="text-sm font-medium">Manual Sync</span>
                          <Badge className="bg-green-500 text-white">On Demand</Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Invoice & Contact Matching</h3>
                      <p className="text-gray-600 mb-3">
                        The system intelligently matches Xero data:
                      </p>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Unique IDs:</strong> Xero contact and invoice IDs are preserved for exact matching</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Duplicate Detection:</strong> Email and company name matching prevents duplicate contacts</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Update Priority:</strong> Xero data always takes precedence in conflicts</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Soft Deletes:</strong> Deleted items in Xero are marked inactive, not removed</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Reconciliation Process</h3>
                      <p className="text-gray-600 mb-3">
                        When a payment is recorded:
                      </p>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <ol className="space-y-2 text-sm text-gray-600">
                          <li><strong>1. Payment Detection:</strong> Xero webhook notifies Qashivo of new payment</li>
                          <li><strong>2. Invoice Update:</strong> Associated invoice status updated to "paid" or "partially paid"</li>
                          <li><strong>3. Collection Stop:</strong> Automated collections immediately suspended for that invoice</li>
                          <li><strong>4. Profile Update:</strong> Payment event recorded in customer profile</li>
                          <li><strong>5. Notification:</strong> User notified of payment, action removed from Action Centre</li>
                        </ol>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Stripe Integration */}
              <section id="stripe">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Lock className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Payment Processing (Stripe)</CardTitle>
                    </div>
                    <CardDescription>
                      Secure online payment collection and reconciliation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Stripe Integration Overview</h3>
                      <p className="text-gray-600 mb-3">
                        Qashivo integrates with Stripe to enable customers to pay invoices directly through secure payment links included in collection emails and SMS.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Payment Link Generation</h3>
                      <p className="text-gray-600 mb-3">
                        When an email or SMS is sent:
                      </p>
                      <ol className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">1</Badge>
                          <div>
                            <p className="font-medium">Stripe Checkout Session Created</p>
                            <p className="text-sm">System creates a unique Stripe checkout session for the invoice amount</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">2</Badge>
                          <div>
                            <p className="font-medium">Payment Link Generated</p>
                            <p className="text-sm">Secure, time-limited URL created (valid for 24 hours)</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">3</Badge>
                          <div>
                            <p className="font-medium">Embedded in Communication</p>
                            <p className="text-sm">Link included as "Pay Now" button in email/SMS</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">4</Badge>
                          <div>
                            <p className="font-medium">Customer Clicks</p>
                            <p className="text-sm">Redirected to Stripe-hosted checkout page (PCI compliant)</p>
                          </div>
                        </li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Payment Processing Flow</h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="font-medium mb-3">Customer Payment Journey:</p>
                        <ol className="space-y-2 text-sm text-gray-700">
                          <li>1. Customer receives email/SMS with payment link</li>
                          <li>2. Clicks "Pay Now" → redirected to Stripe Checkout</li>
                          <li>3. Enters card details (secured by Stripe, not stored by Qashivo)</li>
                          <li>4. Stripe processes payment, handles 3D Secure if needed</li>
                          <li>5. Success → customer redirected to confirmation page</li>
                          <li>6. Failure → shown error, can retry or use different payment method</li>
                        </ol>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Payment Plans</h3>
                      <p className="text-gray-600 mb-3">
                        Customers can set up payment plans for large invoices:
                      </p>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Subscription Creation:</strong> Stripe subscription created with installment schedule</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Auto-Charges:</strong> Stripe automatically charges on schedule dates</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Failed Payment Handling:</strong> Smart Retry logic, customer notified</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Reconciliation:</strong> Each payment applied to invoice, balance tracked</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Webhook Integration</h3>
                      <p className="text-gray-600 mb-3">
                        Stripe sends real-time webhooks for payment events:
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">payment_intent.succeeded</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Invoice marked as paid</li>
                            <li>• Collections stopped</li>
                            <li>• Customer notified</li>
                            <li>• Synced to Xero</li>
                          </ul>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">payment_intent.failed</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Customer notified</li>
                            <li>• Retry attempted</li>
                            <li>• Action logged</li>
                            <li>• Human follow-up flagged</li>
                          </ul>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">invoice.payment_succeeded</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Payment plan updated</li>
                            <li>• Next installment scheduled</li>
                            <li>• Balance recalculated</li>
                          </ul>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">charge.refunded</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Invoice reopened</li>
                            <li>• Collections may resume</li>
                            <li>• Xero notified</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Reconciliation with Xero</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="font-medium mb-3">When Stripe payment received:</p>
                        <ol className="space-y-2 text-sm text-gray-600">
                          <li><strong>1. Payment Captured:</strong> Stripe webhook confirms successful payment</li>
                          <li><strong>2. Qashivo Update:</strong> Invoice marked as paid in local database</li>
                          <li><strong>3. Xero Payment:</strong> Payment automatically recorded in Xero via API</li>
                          <li><strong>4. Reconciliation:</strong> Payment matched to invoice, balances updated</li>
                          <li><strong>5. Confirmation:</strong> User and customer receive payment confirmation</li>
                        </ol>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Security & Compliance</h3>
                      <p className="text-gray-600 mb-3">
                        Stripe handles all sensitive payment data:
                      </p>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>PCI DSS Level 1:</strong> Highest level of payment security certification</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>No Card Storage:</strong> Qashivo never stores or sees card numbers</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>Encrypted Transit:</strong> All data encrypted in transit (TLS 1.2+)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full mt-2" />
                          <span><strong>3D Secure:</strong> Additional authentication for high-value transactions</span>
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </section>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
