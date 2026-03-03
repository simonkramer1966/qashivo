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
import { BookOpen, Mail, MessageSquare, Phone, Bot, Settings, TrendingUp, Shield, Workflow, Zap, Database, Lock, FileText, Code, Activity, RefreshCw, CheckCircle2 } from "lucide-react";

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
              <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg sticky top-6">
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
                              : 'text-muted-foreground hover:bg-muted'
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
                <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
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
                      <p className="text-muted-foreground mb-4">
                        Qashivo is an intelligent accounts receivable and debt recovery platform that automates your collections process. 
                        The system executes your collection policies consistently across all channels, improving cash flow and reducing days sales outstanding (DSO).
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Core Features</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="font-medium text-sm text-foreground">Multi-Channel Communication</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Email, SMS, WhatsApp, and AI voice calls</p>
                        </div>
                        <div className="p-3 bg-purple-500/10 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span className="font-medium text-sm text-foreground">Intent Detection Engine</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Real-time response classification</p>
                        </div>
                        <div className="p-3 bg-green-500/10 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Workflow className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="font-medium text-sm text-foreground">Automated Workflows</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Scheduled collection sequences</p>
                        </div>
                        <div className="p-3 bg-teal-500/10 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                            <span className="font-medium text-sm text-foreground">Real-time Analytics</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Track effectiveness and trends</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Platform Architecture</h3>
                      <p className="text-muted-foreground mb-3">
                        The system is built on three key pillars:
                      </p>
                      <ul className="space-y-2 text-muted-foreground">
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
                <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
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
                          <p className="text-sm text-muted-foreground">Score: 70-100</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Pays on time, reliable, responsive</p>
                        </div>
                        <div className="p-4 bg-[#E8A23B]/10 border-2 border-[#E8A23B]/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-5 w-5 text-[#E8A23B] fill-[#E8A23B]" />
                            <span className="font-bold text-[#E8A23B]">Average</span>
                          </div>
                          <p className="text-sm text-muted-foreground">Score: 40-69</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Occasional delays, needs reminders</p>
                        </div>
                        <div className="p-4 bg-[#C75C5C]/10 border-2 border-[#C75C5C]/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-5 w-5 text-[#C75C5C] fill-[#C75C5C]" />
                            <span className="font-bold text-[#C75C5C]">Poor</span>
                          </div>
                          <p className="text-sm text-muted-foreground">Score: 0-39</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Frequent delays, disputes, or non-payment</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Calculation Formula</h3>
                      <p className="text-muted-foreground mb-3">
                        The customer rating is calculated using a weighted scoring system that considers four key factors:
                      </p>
                      
                      <div className="bg-muted rounded-lg p-4 mb-4 border border-border">
                        <code className="text-sm font-mono text-foreground">
                          Total Score = (Payment Timing × 0.35) + (Payment Reliability × 0.30) + (Response Rate × 0.20) + (Dispute History × 0.15)
                        </code>
                      </div>

                      <div className="space-y-4">
                        <div className="border-l-4 border-[#17B6C3] pl-4">
                          <h4 className="font-semibold mb-2 text-foreground">1. Payment Timing (35% weight)</h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            Measures average days to pay relative to due date. Earlier payments receive higher scores.
                          </p>
                          <div className="bg-blue-500/10 p-3 rounded text-sm border border-blue-500/20">
                            <p className="font-medium mb-1 text-foreground">Scoring:</p>
                            <ul className="space-y-1 text-muted-foreground">
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
                          <h4 className="font-semibold mb-2 text-foreground">2. Payment Reliability (30% weight)</h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            Percentage of invoices that have been paid out of total invoices issued.
                          </p>
                          <div className="bg-purple-500/10 p-3 rounded text-sm border border-purple-500/20">
                            <p className="font-medium mb-1 text-foreground">Formula:</p>
                            <code className="text-foreground">(Paid Invoices / Total Invoices) × 100</code>
                            <p className="text-muted-foreground mt-2">
                              A customer who pays 9 out of 10 invoices scores 90/100 for reliability.
                            </p>
                          </div>
                        </div>

                        <div className="border-l-4 border-[#4FAD80] pl-4">
                          <h4 className="font-semibold mb-2 text-foreground">3. Response Rate (20% weight)</h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            How often the customer responds to collection communications.
                          </p>
                          <div className="bg-[#4FAD80]/10 p-3 rounded text-sm border border-[#4FAD80]/20">
                            <p className="font-medium mb-1 text-foreground">Formula:</p>
                            <code className="text-foreground">(Response Actions / Communication Actions) × 100</code>
                            <p className="text-muted-foreground mt-2">
                              Response actions include: email opened, SMS replied, call answered, payment promise made.
                            </p>
                          </div>
                        </div>

                        <div className="border-l-4 border-[#E8A23B] pl-4">
                          <h4 className="font-semibold mb-2 text-foreground">4. Dispute History (15% weight)</h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            Frequency of disputes or complaints relative to invoices.
                          </p>
                          <div className="bg-[#E8A23B]/10 p-3 rounded text-sm border border-[#E8A23B]/20">
                            <p className="font-medium mb-1 text-foreground">Scoring:</p>
                            <ul className="space-y-1 text-muted-foreground">
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
                      <p className="text-muted-foreground mb-3">
                        The weighted approach prioritizes the factors that most accurately predict future payment behavior:
                      </p>
                      <ul className="space-y-2 text-muted-foreground">
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
                <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
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
                      <p className="text-muted-foreground mb-3">
                        Qashivo uses SendGrid for reliable email delivery with comprehensive tracking capabilities. All emails are sent through SendGrid's API with built-in bounce handling, spam filtering, and delivery optimization.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Email Templates</h3>
                      <p className="text-muted-foreground mb-3">
                        Templates are customizable and can include:
                      </p>
                      <ul className="space-y-2 text-muted-foreground">
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
                      <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                        <p className="font-medium mb-2 text-foreground">We track the following metrics:</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">Delivery Metrics</p>
                            <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                              <li>• Sent successfully</li>
                              <li>• Delivery confirmed</li>
                              <li>• Bounced (hard/soft)</li>
                              <li>• Spam reported</li>
                            </ul>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Engagement Metrics</p>
                            <ul className="text-sm text-muted-foreground mt-1 space-y-1">
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
                      <div className="bg-muted rounded-lg p-4 mb-3 border border-border">
                        <code className="text-sm font-mono text-foreground">
                          Email Effectiveness = (Open Rate × 0.4) + (Click Rate × 0.6)
                        </code>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        This metric helps determine which templates and subject lines perform best for different debtor profiles.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* SMS & WhatsApp */}
              <section id="sms">
                <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <MessageSquare className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">SMS & WhatsApp</CardTitle>
                    </div>
                    <CardDescription>
                      Short message orchestration and mobile engagement
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">SMS Provider: Twilio</h3>
                      <p className="text-muted-foreground mb-3">
                        Twilio handles all SMS traffic, providing global reach and high deliverability. SMS is used for urgent reminders and when email engagement is low.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="border border-border rounded-lg p-4 bg-muted/30">
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-foreground">
                          <MessageSquare className="h-4 w-4 text-blue-500" />
                          SMS
                        </h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Universal (works on all phones)</li>
                          <li>• 160 character limit per message</li>
                          <li>• Higher open rates (98%)</li>
                          <li>• Cost: ~£0.04 per message</li>
                          <li>• Best for: Urgent reminders</li>
                        </ul>
                      </div>
                      <div className="border border-border rounded-lg p-4 bg-muted/30">
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-foreground">
                          <MessageSquare className="h-4 w-4 text-[#25D366]" />
                          WhatsApp
                        </h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Requires WhatsApp app</li>
                          <li>• Rich media support</li>
                          <li>• Read receipts</li>
                          <li>• Cost: ~£0.01 per message</li>
                          <li>• Best for: Detailed updates</li>
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Message Delivery Process</h3>
                      <ol className="space-y-3 text-muted-foreground">
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">1</Badge>
                          <div>
                            <p className="font-medium text-foreground">Template Selection</p>
                            <p className="text-sm">AI selects optimal message template based on customer profile and invoice status</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">2</Badge>
                          <div>
                            <p className="font-medium text-foreground">Personalization</p>
                            <p className="text-sm">System populates dynamic fields (name, amount, payment link)</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">3</Badge>
                          <div>
                            <p className="font-medium text-foreground">Twilio API Call</p>
                            <p className="text-sm">Message sent via Twilio with delivery tracking</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <Badge className="bg-[#17B6C3] text-white mt-0.5">4</Badge>
                          <div>
                            <p className="font-medium text-foreground">Response Tracking</p>
                            <p className="text-sm">Webhook captures delivery status, read receipts, and customer replies</p>
                          </div>
                        </li>
                      </ol>
                    </div>

                    <div className="p-4 bg-amber-500/10 border-l-4 border-amber-500 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5 text-amber-500" />
                        <span className="font-bold text-amber-600">Compliance Notice</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        All SMS and WhatsApp messages comply with TCPA and local regulations. Opt-out requests are handled automatically by the platform.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Voice & AI Calls */}
              <section id="voice">
                <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
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
                      <p className="text-muted-foreground mb-3">
                        Qashivo uses Retell AI for conversational AI phone calls. The system can conduct natural, context-aware conversations with customers, handling payment negotiations, promise collection, and dispute resolution.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-4">
                        <h4 className="font-medium mb-2 text-blue-600 dark:text-blue-400">1. Call Initiation</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• System dials customer using Retell API</li>
                          <li>• Customer context loaded (invoice details, history, preferences)</li>
                          <li>• AI greeting personalized to customer relationship</li>
                        </ul>
                      </div>
                      <div className="border border-purple-500/20 bg-purple-500/5 rounded-lg p-4">
                        <h4 className="font-medium mb-2 text-purple-600 dark:text-purple-400">2. Conversation Flow</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• AI explains purpose of call</li>
                          <li>• Customer can ask questions, negotiate, or make promises</li>
                          <li>• AI handles objections with pre-programmed responses</li>
                          <li>• Natural language understanding interprets intent</li>
                        </ul>
                      </div>
                      <div className="border border-green-500/20 bg-green-500/5 rounded-lg p-4">
                        <h4 className="font-medium mb-2 text-green-600 dark:text-green-400">3. Outcome Capture</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Payment promise recorded with date</li>
                          <li>• Dispute details logged for human follow-up</li>
                          <li>• Call transcript saved for compliance</li>
                          <li>• Next action scheduled automatically</li>
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">AI Conversation Handling</h3>
                      <p className="text-muted-foreground mb-3">
                        The AI is trained to handle common scenarios:
                      </p>
                      <div className="space-y-2">
                        <div className="bg-background border border-border rounded-lg p-3">
                          <p className="font-medium text-sm mb-1 text-foreground">Payment Negotiation</p>
                          <p className="text-xs text-muted-foreground">AI can offer payment plans, partial payment acceptance, or extended terms within pre-set parameters</p>
                        </div>
                        <div className="bg-background border border-border rounded-lg p-3">
                          <p className="font-medium text-sm mb-1 text-foreground">Objection Handling</p>
                          <p className="text-xs text-muted-foreground">Common objections like "I never received the invoice" or "I thought I already paid" are addressed automatically</p>
                        </div>
                        <div className="bg-background border border-border rounded-lg p-3">
                          <p className="font-medium text-sm mb-1 text-foreground">Escalation Protocol</p>
                          <p className="text-xs text-muted-foreground">Complex disputes or emotional customers are flagged for human agent callback</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Outcome Measurement</h3>
                      <div className="bg-muted rounded-lg p-4 mb-3 border border-border">
                        <code className="text-sm font-mono text-foreground">
                          Call Effectiveness = (Successful Calls / Total Calls Made) × 100
                        </code>
                      </div>
                      <p className="text-muted-foreground mb-3 font-medium">Successful call outcomes:</p>
                      <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
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
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-500/10 p-3 rounded border border-blue-500/20">
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">87%</p>
                          <p className="text-xs text-muted-foreground">Connection rate</p>
                        </div>
                        <div className="bg-purple-500/10 p-3 rounded border border-purple-500/20">
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">3.2m</p>
                          <p className="text-xs text-muted-foreground">Avg call duration</p>
                        </div>
                        <div className="bg-green-500/10 p-3 rounded border border-green-500/20">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">64%</p>
                          <p className="text-xs text-muted-foreground">Success rate</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Collections Automation */}
              <section id="collections">
                <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
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
                      <h3 className="font-semibold text-lg mb-3">The Automation Engine</h3>
                      <p className="text-muted-foreground mb-4">
                        Qashivo's automation engine is the core of the platform. It orchestrates all collection activities based on predefined workflows and real-time debtor behavior.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Workflow Stages</h3>
                      <div className="relative pl-8 border-l-2 border-border space-y-6">
                        <div className="relative">
                          <div className="absolute -left-10 top-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-background" />
                          <h4 className="font-bold text-foreground">1. Pre-due Reminders</h4>
                          <p className="text-sm text-muted-foreground">Sent 3-5 days before the invoice is due. Tone: Helpful and informative.</p>
                        </div>
                        <div className="relative">
                          <div className="absolute -left-10 top-0 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
                          <h4 className="font-bold text-foreground">2. Day 1 Overdue</h4>
                          <p className="text-sm text-muted-foreground">Sent immediately when an invoice becomes past due. Tone: Polite reminder.</p>
                        </div>
                        <div className="relative">
                          <div className="absolute -left-10 top-0 w-4 h-4 rounded-full bg-amber-500 border-2 border-background" />
                          <h4 className="font-bold text-foreground">3. Mid-Stage Follow-ups</h4>
                          <p className="text-sm text-muted-foreground">Days 7-21. Multi-channel escalation including SMS and initial AI calls. Tone: Assertive.</p>
                        </div>
                        <div className="relative">
                          <div className="absolute -left-10 top-0 w-4 h-4 rounded-full bg-red-500 border-2 border-background" />
                          <h4 className="font-bold text-foreground">4. Final Notice / Legal</h4>
                          <p className="text-sm text-muted-foreground">Day 30+. Formal warnings and preparation for debt recovery. Tone: Strict and formal.</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-[#17B6C3]/10 rounded-lg border border-[#17B6C3]/20">
                      <h4 className="font-semibold text-[#17B6C3] mb-2 flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Intelligent Escalation
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        The system doesn't just follow a static timeline. If a high-risk debtor misses a payment promise, the system can automatically skip stages and escalate to a phone call immediately.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">How Actions Are Triggered</h3>
                      <p className="text-muted-foreground mb-3">
                        The collections scheduler runs every 60 minutes and follows this logic:
                      </p>
                      <div className="bg-muted rounded-lg p-4 space-y-3 border border-border">
                        <div>
                          <p className="font-medium mb-2 text-foreground">1. Invoice Status Check</p>
                          <code className="text-xs text-muted-foreground">
                            IF (invoice.status == 'overdue' OR invoice.status == 'pending') AND (invoice.dueDate &lt; currentDate)
                          </code>
                        </div>
                        <div>
                          <p className="font-medium mb-2 text-foreground">2. Schedule Action Lookup</p>
                          <p className="text-sm text-muted-foreground">
                            System finds the customer's assigned schedule and identifies the next action based on days overdue
                          </p>
                        </div>
                        <div>
                          <p className="font-medium mb-2 text-foreground">3. Duplicate Prevention</p>
                          <code className="text-xs text-muted-foreground">
                            IF lastAction.createdAt &gt; (currentTime - actionMinimumGap) THEN skip
                          </code>
                        </div>
                        <div>
                          <p className="font-medium mb-2 text-foreground">4. Payment Verification</p>
                          <p className="text-sm text-muted-foreground">
                            Check if payment has been received since last check (via Xero sync or Stripe webhook)
                          </p>
                        </div>
                        <div>
                          <p className="font-medium mb-2 text-foreground">5. AI Optimization</p>
                          <p className="text-sm text-muted-foreground">
                            AI may adjust action type or timing based on customer's historical channel effectiveness
                          </p>
                        </div>
                        <div>
                          <p className="font-medium mb-2 text-foreground">6. Execute Action</p>
                          <p className="text-sm text-muted-foreground">
                            Send communication via selected channel and log action in database
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Example Workflow Schedule</h3>
                      <div className="border border-border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-3 border-b border-border text-foreground">Days Overdue</th>
                              <th className="text-left p-3 border-b border-border text-foreground">Action</th>
                              <th className="text-left p-3 border-b border-border text-foreground">Channel</th>
                              <th className="text-left p-3 border-b border-border text-foreground">Tone</th>
                            </tr>
                          </thead>
                          <tbody className="bg-background">
                            <tr className="border-b border-border">
                              <td className="p-3 text-muted-foreground">0 (Due today)</td>
                              <td className="p-3 text-muted-foreground">Gentle reminder</td>
                              <td className="p-3 text-muted-foreground">Email</td>
                              <td className="p-3 text-muted-foreground">Friendly</td>
                            </tr>
                            <tr className="border-b border-border">
                              <td className="p-3 text-muted-foreground">3 days</td>
                              <td className="p-3 text-muted-foreground">Follow-up</td>
                              <td className="p-3 text-muted-foreground">Email</td>
                              <td className="p-3 text-muted-foreground">Polite</td>
                            </tr>
                            <tr className="border-b border-border">
                              <td className="p-3 text-muted-foreground">7 days</td>
                              <td className="p-3 text-muted-foreground">Urgent reminder</td>
                              <td className="p-3 text-muted-foreground">SMS</td>
                              <td className="p-3 text-muted-foreground">Direct</td>
                            </tr>
                            <tr className="border-b border-border">
                              <td className="p-3 text-muted-foreground">14 days</td>
                              <td className="p-3 text-muted-foreground">Collection call</td>
                              <td className="p-3 text-muted-foreground">Voice</td>
                              <td className="p-3 text-muted-foreground">Firm</td>
                            </tr>
                            <tr className="border-b border-border">
                              <td className="p-3 text-muted-foreground">21 days</td>
                              <td className="p-3 text-muted-foreground">Final notice</td>
                              <td className="p-3 text-muted-foreground">Email + SMS</td>
                              <td className="p-3 text-muted-foreground">Formal</td>
                            </tr>
                            <tr>
                              <td className="p-3 text-muted-foreground">30+ days</td>
                              <td className="p-3 text-muted-foreground">Escalation</td>
                              <td className="p-3 text-muted-foreground">Human agent</td>
                              <td className="p-3 text-muted-foreground">Legal tone</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* AI Learning System */}
              <section id="ai-learning">
                <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Bot className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Policy Execution System</CardTitle>
                    </div>
                    <CardDescription>
                      Advanced AI models for behavioral prediction and strategy optimization
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Continuous Learning</h3>
                      <p className="text-muted-foreground mb-3">
                        Qashivo's AI models are constantly refined based on every interaction across the platform. This allows the system to build increasingly accurate profiles of debtor behavior.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-4 w-4 text-[#17B6C3]" />
                          <h4 className="font-semibold text-foreground">Pattern Recognition</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">Identifies common traits among late payers and detects emerging risk trends early.</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <RefreshCw className="h-4 w-4 text-purple-600" />
                          <h4 className="font-semibold text-foreground">Strategy Refinement</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">Automatically tests different communication approaches to find the most effective sequence.</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Intent Detection Engine</h3>
                      <p className="text-muted-foreground mb-3">
                        Our LLM-based intent engine classifies debtor responses into actionable categories:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          "Payment Confirmation", "Dispute / Issue", "Promise to Pay",
                          "Hardship Claim", "Wrong Recipient", "Technical Issue",
                          "Request for Info", "Unsubscribe", "Explicit Refusal"
                        ].map((intent, idx) => (
                          <Badge key={idx} variant="outline" className="justify-center py-1 font-normal text-muted-foreground">
                            {intent}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Communication Modes */}
              <section id="comm-modes">
                <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Settings className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Communication Modes</CardTitle>
                    </div>
                    <CardDescription>
                      Fine-grained control over how automation interacts with customers
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 border-2 border-green-500/20 bg-green-500/5 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <h4 className="font-bold text-green-600 dark:text-green-400">Autonomous</h4>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Full AI control. The system makes decisions, sends messages, and places calls without human intervention.
                        </p>
                      </div>
                      <div className="p-4 border-2 border-amber-500/20 bg-amber-500/5 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          <h4 className="font-bold text-amber-600 dark:text-amber-400">Pilot</h4>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          AI proposes actions, but a human must approve them before they are executed. Best for sensitive accounts.
                        </p>
                      </div>
                      <div className="p-4 border-2 border-red-500/20 bg-red-500/5 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <h4 className="font-bold text-red-600 dark:text-red-400">Manual</h4>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Automation is disabled. All communication must be initiated and handled by the finance team.
                        </p>
                      </div>
                    </div>

                    <div className="bg-muted p-4 rounded-lg border border-border">
                      <h4 className="font-semibold text-foreground mb-2">Mode Inheritance</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Modes can be set at the <strong>Global</strong>, <strong>Workflow</strong>, or <strong>Customer</strong> level. 
                        Customer settings always override Workflow settings, which override Global settings.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Xero Integration */}
              <section id="xero">
                <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Database className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Xero Integration</CardTitle>
                    </div>
                    <CardDescription>
                      Real-time synchronization with your accounting software
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">What We Sync</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium text-foreground">Invoices (All Statuses)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium text-foreground">Contacts & Primary Emails</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium text-foreground">Credit Notes & Adjustments</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium text-foreground">Payments & Bank Feeds</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium text-foreground">Tracking Categories</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium text-foreground">Currency Settings</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
                      <h4 className="font-semibold text-foreground mb-1">Two-Way Sync</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Qashivo doesn't just read from Xero. When an AI agent secures a payment promise or records a dispute, this information is synced back to Xero as notes or status updates.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Stripe Payment Processing */}
              <section id="stripe">
                <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Lock className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                      <CardTitle className="text-2xl">Payment Processing</CardTitle>
                    </div>
                    <CardDescription>
                      Secure and integrated payments via Stripe
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      Every communication sent by Qashivo includes a secure, one-click payment link. We use Stripe to ensure the highest level of security and a frictionless checkout experience for your customers.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg border border-border">
                        <h4 className="font-semibold text-foreground mb-2">Payment Methods</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Credit/Debit Cards</li>
                          <li>• Apple Pay / Google Pay</li>
                          <li>• Direct Debit (SEPA/BACS)</li>
                          <li>• Bank Transfers (Open Banking)</li>
                        </ul>
                      </div>
                      <div className="p-4 bg-muted rounded-lg border border-border">
                        <h4 className="font-semibold text-foreground mb-2">Reconciliation</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Automatic Xero matching</li>
                          <li>• Instant status updates</li>
                          <li>• Fee calculation</li>
                          <li>• Multi-currency support</li>
                        </ul>
                      </div>
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
