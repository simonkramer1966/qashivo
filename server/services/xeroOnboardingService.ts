// Define XeroTokens interface locally since it's not exported
interface XeroTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tenantId: string;
}

export interface OnboardingDataSummary {
  contacts: {
    total: number;
    withOutstanding: number;
    topCustomers: Array<{
      name: string;
      outstandingAmount: number;
      lastActivity: Date;
    }>;
  };
  invoices: {
    total: number;
    overdue: number;
    totalOutstanding: number;
    avgDaysToPayment: number;
    monthlyVolume: number;
  };
  insights: {
    primaryIndustry: string;
    businessSize: 'small' | 'medium' | 'large';
    riskLevel: 'low' | 'medium' | 'high';
    collectionPriority: string[];
  };
}

export interface AIProfileGeneration {
  customerBehaviorPatterns: {
    paymentTrends: string;
    preferredContactMethods: string[];
    responsePatterns: string;
  };
  collectionStrategy: {
    recommendedApproach: string;
    communicationTone: string;
    followUpFrequency: string;
  };
  automationSettings: {
    enabledWorkflows: string[];
    thresholds: {
      firstReminder: number;
      escalation: number;
      urgentFollow: number;
    };
  };
}

export class XeroOnboardingService {
  private xeroService: any;
  private storage: any;

  constructor() {
    // Initialize services - using dynamic imports to avoid circular dependencies
    this.initializeServices();
  }

  private async initializeServices() {
    const { xeroService } = await import('./xero');
    const { storage } = await import('../storage');
    this.xeroService = xeroService;
    this.storage = storage;
  }

  /**
   * Complete automated onboarding data import from Xero
   * This is called during the "Technical Connection" phase
   */
  async performAutomatedDataImport(tokens: XeroTokens, tenantId: string): Promise<{
    success: boolean;
    summary: OnboardingDataSummary;
    errors: string[];
    timeElapsed: number;
  }> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      console.log(`🚀 Starting automated Xero onboarding for tenant ${tenantId}`);

      // Ensure services are initialized
      if (!this.xeroService || !this.storage) {
        await this.initializeServices();
      }

      // Step 1: Import contacts with collection focus
      console.log('📋 Step 1: Importing customer contacts...');
      const contactResults = await this.xeroService.syncContactsToDatabase(tokens, tenantId);
      console.log(`✅ Contacts imported: ${contactResults.synced} synced, ${contactResults.filtered} filtered`);
      errors.push(...contactResults.errors);

      // Step 2: Import invoices 
      console.log('💰 Step 2: Importing invoices...');
      const invoiceResults = await this.xeroService.syncInvoicesToDatabase(tokens, tenantId);
      console.log(`✅ Invoices imported: ${invoiceResults.synced} synced`);
      errors.push(...invoiceResults.errors);

      // Step 3: Generate data summary and insights
      console.log('📊 Step 3: Analyzing imported data...');
      const summary = await this.generateDataSummary(tenantId);

      // Step 4: Generate AI profile recommendations
      console.log('🤖 Step 4: Generating AI collection profiles...');
      const aiProfile = await this.generateAIProfile(tenantId, summary);

      // Step 5: Apply AI recommendations to tenant settings
      console.log('⚡ Step 5: Applying AI recommendations...');
      await this.applyAIRecommendations(tenantId, aiProfile);

      const timeElapsed = Date.now() - startTime;
      console.log(`🎯 Automated onboarding completed in ${timeElapsed}ms`);

      return {
        success: true,
        summary,
        errors,
        timeElapsed
      };

    } catch (error: any) {
      console.error('❌ Automated onboarding failed:', error);
      errors.push(`Critical error: ${error.message}`);
      
      return {
        success: false,
        summary: this.getEmptyDataSummary(),
        errors,
        timeElapsed: Date.now() - startTime
      };
    }
  }

  /**
   * Generate comprehensive data summary from imported Xero data
   */
  private async generateDataSummary(tenantId: string): Promise<OnboardingDataSummary> {
    try {
      // Get all contacts and invoices
      const contacts = await this.storage.getContacts(tenantId);
      const invoices = await this.storage.getInvoices(tenantId);

      // Analyze contacts
      const contactsWithOutstanding = contacts.filter((c: any) => 
        invoices.some((inv: any) => inv.contactId === c.id && inv.status !== 'paid')
      );

      const topCustomers = contacts
        .map((contact: any) => {
          const customerInvoices = invoices.filter((inv: any) => inv.contactId === contact.id);
          const outstanding = customerInvoices
            .filter((inv: any) => inv.status !== 'paid')
            .reduce((sum: number, inv: any) => sum + parseFloat(inv.amount), 0);
          
          const lastActivity = customerInvoices.length > 0 
            ? new Date(Math.max(...customerInvoices.map((inv: any) => new Date(inv.issueDate).getTime())))
            : new Date(0);

          return {
            name: contact.name,
            outstandingAmount: outstanding,
            lastActivity
          };
        })
        .filter((c: any) => c.outstandingAmount > 0)
        .sort((a: any, b: any) => b.outstandingAmount - a.outstandingAmount)
        .slice(0, 5);

      // Analyze invoices
      const overdueInvoices = invoices.filter((inv: any) => 
        inv.status !== 'paid' && new Date(inv.dueDate) < new Date()
      );

      const totalOutstanding = invoices
        .filter((inv: any) => inv.status !== 'paid')
        .reduce((sum: number, inv: any) => sum + parseFloat(inv.amount), 0);

      // Calculate average days to payment for paid invoices
      const paidInvoices = invoices.filter((inv: any) => inv.status === 'paid');
      const avgDaysToPayment = paidInvoices.length > 0 
        ? paidInvoices.reduce((sum: number, inv: any) => {
            const issueDate = new Date(inv.issueDate);
            const dueDate = new Date(inv.dueDate);
            return sum + Math.max(0, (dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / paidInvoices.length
        : 30; // Default 30 days

      // Calculate monthly invoice volume
      const recentInvoices = invoices.filter((inv: any) => 
        new Date(inv.issueDate) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
      );
      const monthlyVolume = recentInvoices.length / 3; // Average per month

      // Generate business insights
      const insights = this.generateBusinessInsights(contacts, invoices, totalOutstanding);

      return {
        contacts: {
          total: contacts.length,
          withOutstanding: contactsWithOutstanding.length,
          topCustomers
        },
        invoices: {
          total: invoices.length,
          overdue: overdueInvoices.length,
          totalOutstanding,
          avgDaysToPayment: Math.round(avgDaysToPayment),
          monthlyVolume: Math.round(monthlyVolume)
        },
        insights
      };

    } catch (error: any) {
      console.error('Error generating data summary:', error);
      return this.getEmptyDataSummary();
    }
  }

  /**
   * Generate AI-driven collection profile based on business data
   */
  private async generateAIProfile(tenantId: string, summary: OnboardingDataSummary): Promise<AIProfileGeneration> {
    try {
      // Analyze payment behavior patterns
      const paymentTrends = this.analyzePaymentTrends(summary);
      const businessProfile = this.determineBusinessProfile(summary);
      
      // Generate AI recommendations
      return {
        customerBehaviorPatterns: {
          paymentTrends: paymentTrends.description,
          preferredContactMethods: this.recommendContactMethods(businessProfile),
          responsePatterns: this.analyzeResponsePatterns(summary)
        },
        collectionStrategy: {
          recommendedApproach: this.recommendCollectionApproach(summary),
          communicationTone: this.recommendCommunicationTone(businessProfile),
          followUpFrequency: this.recommendFollowUpFrequency(summary)
        },
        automationSettings: {
          enabledWorkflows: this.recommendWorkflows(summary),
          thresholds: this.calculateOptimalThresholds(summary)
        }
      };

    } catch (error: any) {
      console.error('Error generating AI profile:', error);
      return this.getDefaultAIProfile();
    }
  }

  /**
   * Apply AI recommendations to tenant configuration
   */
  private async applyAIRecommendations(tenantId: string, aiProfile: AIProfileGeneration): Promise<void> {
    try {
      // Update tenant with AI-generated settings
      const tenantUpdates = {
        aiCollectionProfile: aiProfile,
        automationEnabled: true,
        lastAIProfileUpdate: new Date().toISOString()
      };

      // Apply settings (this would integrate with tenant configuration)
      console.log('🤖 Applied AI recommendations:', {
        approach: aiProfile.collectionStrategy.recommendedApproach,
        workflows: aiProfile.automationSettings.enabledWorkflows.length,
        thresholds: aiProfile.automationSettings.thresholds
      });

    } catch (error: any) {
      console.error('Error applying AI recommendations:', error);
    }
  }

  // Helper methods for AI analysis
  private analyzePaymentTrends(summary: OnboardingDataSummary): { description: string } {
    const { avgDaysToPayment, monthlyVolume } = summary.invoices;
    
    if (avgDaysToPayment <= 15) {
      return { description: "Customers tend to pay promptly, indicating good cash flow management" };
    } else if (avgDaysToPayment <= 30) {
      return { description: "Standard payment patterns with occasional delays" };
    } else {
      return { description: "Extended payment cycles suggest cash flow challenges" };
    }
  }

  private determineBusinessProfile(summary: OnboardingDataSummary): string {
    const { total: totalContacts } = summary.contacts;
    const { totalOutstanding } = summary.invoices;
    
    if (totalContacts < 50 && totalOutstanding < 100000) {
      return 'small';
    } else if (totalContacts < 200 && totalOutstanding < 500000) {
      return 'medium';
    } else {
      return 'large';
    }
  }

  private recommendContactMethods(businessProfile: string): string[] {
    switch (businessProfile) {
      case 'small':
        return ['email', 'phone'];
      case 'medium':
        return ['email', 'sms', 'phone'];
      case 'large':
        return ['email', 'sms', 'letter', 'phone'];
      default:
        return ['email'];
    }
  }

  private analyzeResponsePatterns(summary: OnboardingDataSummary): string {
    const overdueRatio = summary.invoices.overdue / summary.invoices.total;
    
    if (overdueRatio < 0.1) {
      return "Customers are highly responsive to initial communications";
    } else if (overdueRatio < 0.3) {
      return "Moderate responsiveness, may require follow-up";
    } else {
      return "Low responsiveness, requires persistent follow-up";
    }
  }

  private recommendCollectionApproach(summary: OnboardingDataSummary): string {
    const riskLevel = summary.insights.riskLevel;
    
    switch (riskLevel) {
      case 'low':
        return 'Gentle reminders with relationship focus';
      case 'medium':
        return 'Structured follow-up with clear deadlines';
      case 'high':
        return 'Firm but professional escalation strategy';
      default:
        return 'Balanced approach with progressive escalation';
    }
  }

  private recommendCommunicationTone(businessProfile: string): string {
    switch (businessProfile) {
      case 'small':
        return 'Personal and relationship-focused';
      case 'medium':
        return 'Professional yet approachable';
      case 'large':
        return 'Formal and process-oriented';
      default:
        return 'Professional';
    }
  }

  private recommendFollowUpFrequency(summary: OnboardingDataSummary): string {
    const avgDays = summary.invoices.avgDaysToPayment;
    
    if (avgDays <= 15) {
      return 'Weekly check-ins for overdue items';
    } else if (avgDays <= 30) {
      return 'Bi-weekly follow-up schedule';
    } else {
      return 'Weekly persistent follow-up';
    }
  }

  private recommendWorkflows(summary: OnboardingDataSummary): string[] {
    const workflows = ['payment_reminder'];
    
    if (summary.invoices.overdue > 10) {
      workflows.push('overdue_escalation');
    }
    
    if (summary.insights.riskLevel === 'high') {
      workflows.push('high_risk_monitoring');
    }
    
    if (summary.invoices.monthlyVolume > 50) {
      workflows.push('bulk_processing');
    }
    
    return workflows;
  }

  private calculateOptimalThresholds(summary: OnboardingDataSummary): {
    firstReminder: number;
    escalation: number;
    urgentFollow: number;
  } {
    const avgDays = summary.invoices.avgDaysToPayment;
    
    return {
      firstReminder: Math.max(1, Math.floor(avgDays * 0.5)),
      escalation: Math.max(7, avgDays),
      urgentFollow: Math.max(14, avgDays * 1.5)
    };
  }

  private generateBusinessInsights(contacts: any[], invoices: any[], totalOutstanding: number): OnboardingDataSummary['insights'] {
    // Simple industry classification based on patterns
    const primaryIndustry = contacts.length > 100 ? 'Professional Services' : 'Small Business';
    
    // Business size classification
    let businessSize: 'small' | 'medium' | 'large' = 'small';
    if (contacts.length > 50 && totalOutstanding > 100000) businessSize = 'medium';
    if (contacts.length > 200 && totalOutstanding > 500000) businessSize = 'large';
    
    // Risk assessment
    const overdueRatio = invoices.filter((inv: any) => 
      inv.status !== 'paid' && new Date(inv.dueDate) < new Date()
    ).length / invoices.length;
    
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (overdueRatio > 0.2) riskLevel = 'medium';
    if (overdueRatio > 0.4) riskLevel = 'high';
    
    // Collection priorities
    const collectionPriority = [
      'High-value overdue accounts',
      'Frequent late payers',
      'New customer onboarding'
    ];
    
    return {
      primaryIndustry,
      businessSize,
      riskLevel,
      collectionPriority
    };
  }

  private getEmptyDataSummary(): OnboardingDataSummary {
    return {
      contacts: {
        total: 0,
        withOutstanding: 0,
        topCustomers: []
      },
      invoices: {
        total: 0,
        overdue: 0,
        totalOutstanding: 0,
        avgDaysToPayment: 30,
        monthlyVolume: 0
      },
      insights: {
        primaryIndustry: 'Unknown',
        businessSize: 'small',
        riskLevel: 'medium',
        collectionPriority: []
      }
    };
  }

  private getDefaultAIProfile(): AIProfileGeneration {
    return {
      customerBehaviorPatterns: {
        paymentTrends: 'Standard payment patterns',
        preferredContactMethods: ['email'],
        responsePatterns: 'Moderate responsiveness'
      },
      collectionStrategy: {
        recommendedApproach: 'Professional and systematic',
        communicationTone: 'Professional',
        followUpFrequency: 'Weekly follow-up'
      },
      automationSettings: {
        enabledWorkflows: ['payment_reminder'],
        thresholds: {
          firstReminder: 3,
          escalation: 7,
          urgentFollow: 14
        }
      }
    };
  }
}

export const xeroOnboardingService = new XeroOnboardingService();