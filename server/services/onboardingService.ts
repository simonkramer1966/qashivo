import { db } from "../db";
import { onboardingProgress, tenants, type OnboardingProgress, type InsertOnboardingProgress } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface OnboardingPhaseData {
  technical_connection?: {
    xeroConnected: boolean;
    dataImported: boolean;
    recordsImported: {
      contacts: number;
      invoices: number;
      payments: number;
    };
  };
  business_setup?: {
    companyProfile: {
      industry: string;
      industrySubcategory: string;
      companySize: string;
      businessType: string;
      yearsInBusiness: string;
      annualRevenue: string;
      customerBase: string;
      primaryMarket: string;
      geographicCoverage: string;
      businessModel: string;
    };
    collectionsStrategy: {
      automationLevels: {
        newCustomers: 'manual' | 'conservative' | 'balanced' | 'aggressive';
        establishedCustomers: 'manual' | 'conservative' | 'balanced' | 'aggressive';
        highRiskCustomers: 'manual' | 'conservative' | 'balanced' | 'aggressive';
        vipCustomers: 'manual' | 'conservative' | 'balanced' | 'aggressive' | 'white-glove';
      };
      collectionChannels: {
        email: boolean;
        sms: boolean;
        phone: boolean;
        letters: boolean;
      };
      escalationWorkflow: {
        firstReminder: number;
        secondReminder: number;
        finalNotice: number;
        collectionAgency: number;
      };
      communicationTone: 'friendly' | 'professional' | 'firm';
    };
    paymentTerms: {
      defaultTerms: string;
      earlyPaymentDiscount: {
        enabled: boolean;
        percentage: number;
        days: number;
      };
      latePaymentFees: {
        enabled: boolean;
        type: 'percentage' | 'fixed';
        amount: number;
      };
      acceptedPaymentMethods: string[];
    };
    riskAssessment: {
      creditLimits: {
        newCustomer: number;
        establishedCustomer: number;
        requireCreditCheck: boolean;
      };
      riskFactors: {
        industryRisk: 'low' | 'medium' | 'high';
        paymentHistory: 'low' | 'medium' | 'high';
        creditScore: 'low' | 'medium' | 'high';
      };
      writeOffPolicy: {
        threshold: number;
        requireApproval: boolean;
      };
    };
    communicationPreferences: {
      preferredDays: string[];
      timeZone: string;
      businessHours: {
        start: string;
        end: string;
      };
      teamNotifications: {
        newOverdue: boolean;
        paymentReceived: boolean;
        escalations: boolean;
      };
    };
    completedSteps?: number;
  };
  brand_customization?: {
    branding: {
      logoUrl?: string;
      primaryColor: string;
      secondaryColor: string;
      communicationTone: 'professional' | 'friendly' | 'firm';
    };
    customerExperience: {
      portalCustomization: boolean;
      emailBranding: boolean;
    };
  };
  ai_review_launch?: {
    aiProfiles: {
      generated: number;
      reviewed: number;
      approved: number;
    };
    workflowRecommendations: Array<{
      type: string;
      confidence: number;
      approved: boolean;
    }>;
    automationActivated: boolean;
    firstCollectionScheduled: boolean;
  };
}

export type OnboardingPhase = 'technical_connection' | 'business_setup' | 'brand_customization' | 'ai_review_launch';

export class OnboardingService {
  /**
   * Initialize onboarding for a new tenant
   */
  async initializeOnboarding(tenantId: string): Promise<OnboardingProgress> {
    const [existing] = await db
      .select()
      .from(onboardingProgress)
      .where(eq(onboardingProgress.tenantId, tenantId));

    if (existing) {
      return existing;
    }

    const [progress] = await db
      .insert(onboardingProgress)
      .values({
        tenantId,
        currentPhase: 'technical_connection',
        completedPhases: [],
        phaseData: {}
      })
      .returning();

    return progress;
  }

  /**
   * Get current onboarding progress for a tenant
   */
  async getOnboardingProgress(tenantId: string): Promise<OnboardingProgress | null> {
    const [progress] = await db
      .select()
      .from(onboardingProgress)
      .where(eq(onboardingProgress.tenantId, tenantId));

    return progress || null;
  }

  /**
   * Update phase progress with new data
   */
  async updatePhaseProgress(
    tenantId: string, 
    phase: OnboardingPhase, 
    data: Partial<OnboardingPhaseData>
  ): Promise<void> {
    const currentProgress = await this.getOnboardingProgress(tenantId);
    
    if (!currentProgress) {
      throw new Error(`No onboarding progress found for tenant ${tenantId}`);
    }

    // Merge new data with existing phase data
    const updatedPhaseData = {
      ...currentProgress.phaseData as OnboardingPhaseData,
      [phase]: {
        ...(currentProgress.phaseData as OnboardingPhaseData)?.[phase],
        ...data[phase]
      }
    };

    await db
      .update(onboardingProgress)
      .set({
        phaseData: updatedPhaseData,
        updatedAt: new Date()
      })
      .where(eq(onboardingProgress.tenantId, tenantId));
  }

  /**
   * Mark a phase as completed and advance to next phase
   */
  async completePhase(tenantId: string, phase: OnboardingPhase): Promise<void> {
    const currentProgress = await this.getOnboardingProgress(tenantId);
    
    if (!currentProgress) {
      throw new Error(`No onboarding progress found for tenant ${tenantId}`);
    }

    const completedPhases = [...(currentProgress.completedPhases as string[]), phase];
    const nextPhase = this.getNextPhase(phase);

    await db
      .update(onboardingProgress)
      .set({
        currentPhase: nextPhase,
        completedPhases,
        updatedAt: new Date()
      })
      .where(eq(onboardingProgress.tenantId, tenantId));
  }

  /**
   * Complete the entire onboarding process
   */
  async completeOnboarding(tenantId: string): Promise<void> {
    // Mark onboarding as completed in both tables
    await Promise.all([
      db
        .update(onboardingProgress)
        .set({
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(onboardingProgress.tenantId, tenantId)),
      
      db
        .update(tenants)
        .set({
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(tenants.id, tenantId))
    ]);
  }

  /**
   * Check if onboarding is completed for a tenant
   */
  async isOnboardingCompleted(tenantId: string): Promise<boolean> {
    const [tenant] = await db
      .select({ onboardingCompleted: tenants.onboardingCompleted })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    return tenant?.onboardingCompleted || false;
  }

  /**
   * Get onboarding statistics for dashboard
   */
  async getOnboardingStats(tenantId: string): Promise<{
    currentPhase: OnboardingPhase;
    completedPhases: string[];
    totalPhases: number;
    progressPercentage: number;
    estimatedTimeRemaining: number; // minutes
  }> {
    const progress = await this.getOnboardingProgress(tenantId);
    
    if (!progress) {
      return {
        currentPhase: 'technical_connection',
        completedPhases: [],
        totalPhases: 4,
        progressPercentage: 0,
        estimatedTimeRemaining: 35
      };
    }

    const completedPhases = progress.completedPhases as string[];
    const totalPhases = 4;
    const progressPercentage = Math.round((completedPhases.length / totalPhases) * 100);
    
    // Estimate remaining time based on phase
    const phaseTimeEstimates = {
      'technical_connection': 2,
      'business_setup': 20,
      'brand_customization': 5,
      'ai_review_launch': 8
    };
    
    const estimatedTimeRemaining = this.calculateRemainingTime(
      progress.currentPhase as OnboardingPhase,
      completedPhases,
      phaseTimeEstimates
    );

    return {
      currentPhase: progress.currentPhase as OnboardingPhase,
      completedPhases,
      totalPhases,
      progressPercentage,
      estimatedTimeRemaining
    };
  }

  /**
   * Validate if a phase can be completed based on required data
   */
  async validatePhaseCompletion(tenantId: string, phase: OnboardingPhase): Promise<{
    canComplete: boolean;
    missingRequirements: string[];
  }> {
    const progress = await this.getOnboardingProgress(tenantId);
    const phaseData = progress?.phaseData as OnboardingPhaseData;

    switch (phase) {
      case 'technical_connection':
        return this.validateTechnicalConnection(phaseData?.technical_connection);
      
      case 'business_setup':
        return this.validateBusinessSetup(phaseData?.business_setup);
      
      case 'brand_customization':
        return this.validateBrandCustomization(phaseData?.brand_customization);
      
      case 'ai_review_launch':
        return this.validateAIReviewLaunch(phaseData?.ai_review_launch);
      
      default:
        return { canComplete: false, missingRequirements: ['Invalid phase'] };
    }
  }

  // Private helper methods
  private getNextPhase(currentPhase: OnboardingPhase): OnboardingPhase {
    const phases: OnboardingPhase[] = [
      'technical_connection',
      'business_setup', 
      'brand_customization',
      'ai_review_launch'
    ];
    
    const currentIndex = phases.indexOf(currentPhase);
    const nextIndex = currentIndex + 1;
    
    return nextIndex < phases.length ? phases[nextIndex] : 'ai_review_launch';
  }

  private calculateRemainingTime(
    currentPhase: OnboardingPhase,
    completedPhases: string[],
    phaseTimeEstimates: Record<OnboardingPhase, number>
  ): number {
    const allPhases: OnboardingPhase[] = [
      'technical_connection',
      'business_setup',
      'brand_customization', 
      'ai_review_launch'
    ];

    let remainingTime = 0;
    let foundCurrent = false;

    for (const phase of allPhases) {
      if (phase === currentPhase) {
        foundCurrent = true;
      }
      
      if (foundCurrent && !completedPhases.includes(phase)) {
        remainingTime += phaseTimeEstimates[phase];
      }
    }

    return remainingTime;
  }

  private validateTechnicalConnection(data?: OnboardingPhaseData['technical_connection']) {
    const missingRequirements: string[] = [];
    
    if (!data?.xeroConnected) {
      missingRequirements.push('Xero connection required');
    }
    
    if (!data?.dataImported) {
      missingRequirements.push('Data import must be completed');
    }

    return {
      canComplete: missingRequirements.length === 0,
      missingRequirements
    };
  }

  private validateBusinessSetup(data?: OnboardingPhaseData['business_setup']) {
    const missingRequirements: string[] = [];
    
    // Company Profile Requirements
    if (!data?.companyProfile?.industry) {
      missingRequirements.push('Company industry selection required');
    }
    
    if (!data?.companyProfile?.companySize) {
      missingRequirements.push('Company size selection required');
    }
    
    if (!data?.companyProfile?.businessType) {
      missingRequirements.push('Business type selection required');
    }
    
    // Collections Strategy Requirements
    if (!data?.collectionsStrategy?.automationLevels) {
      missingRequirements.push('Automation level preferences required');
    }
    
    // Payment Terms Requirements
    if (!data?.paymentTerms?.defaultTerms) {
      missingRequirements.push('Default payment terms required');
    }

    return {
      canComplete: missingRequirements.length === 0,
      missingRequirements
    };
  }

  private validateBrandCustomization(data?: OnboardingPhaseData['brand_customization']) {
    const missingRequirements: string[] = [];
    
    if (!data?.branding?.communicationTone) {
      missingRequirements.push('Communication tone selection required');
    }

    return {
      canComplete: missingRequirements.length === 0,
      missingRequirements
    };
  }

  private validateAIReviewLaunch(data?: OnboardingPhaseData['ai_review_launch']) {
    const missingRequirements: string[] = [];
    
    if (!data?.aiProfiles?.approved || data.aiProfiles.approved === 0) {
      missingRequirements.push('AI profile approval required');
    }
    
    if (!data?.automationActivated) {
      missingRequirements.push('Automation activation required');
    }

    return {
      canComplete: missingRequirements.length === 0,
      missingRequirements
    };
  }
}

export const onboardingService = new OnboardingService();