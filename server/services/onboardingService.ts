import { db } from "../db";
import { onboardingProgress, tenants, analysisJobs, invoices, contacts, type OnboardingProgress, type AnalysisJob } from "@shared/schema";
import { eq, and, gt, desc, sql, isNotNull } from "drizzle-orm";

export type StepStatus = "NOT_STARTED" | "COMPLETED" | "SKIPPED" | "RUNNING";

export interface CompanyDetails {
  subscriberFirstName: string;
  subscriberLastName: string;
  companyName: string;
  companyAddress: {
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postcode: string;
    country: string;
  };
}

export interface AgedDebtorsSummary {
  buckets: {
    label: string;
    minDays: number;
    maxDays: number | null;
    count: number;
    totalValue: number;
  }[];
  totalOverdue: number;
  totalOverdueCount: number;
  topDebtors: {
    contactId: string;
    contactName: string;
    totalOverdue: number;
    oldestDaysOverdue: number;
  }[];
  summary: string;
}

export interface ContactDataSummary {
  totalContacts: number;
  missingName: number;
  missingEmail: number;
  missingPhone: number;
  missingMobile: number;
  contactsWithIssues: {
    contactId: string;
    contactName: string;
    missingFields: string[];
  }[];
}

export interface OnboardingStatusResponse {
  step1Status: StepStatus;
  step2Status: StepStatus;
  step3Status: StepStatus;
  step4Status: StepStatus;
  step5Status: StepStatus;
  step6Status: StepStatus;
  companyDetails: CompanyDetails | null;
  smsMobileOptIn: boolean;
  agedDebtorsSummary: AgedDebtorsSummary | null;
  contactDataSummary: ContactDataSummary | null;
  lastAnalysisAt: Date | null;
  onboardingCompleted: boolean;
  xeroConnected: boolean;
  emailConnected: boolean;
  emailConnectedAddress: string | null;
}

export class OnboardingService {
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
        phaseData: {},
        step1Status: "NOT_STARTED",
        step2Status: "NOT_STARTED",
        step3Status: "NOT_STARTED",
        step4Status: "NOT_STARTED",
        step5Status: "NOT_STARTED",
        step6Status: "NOT_STARTED",
      })
      .returning();

    return progress;
  }

  async getOnboardingProgress(tenantId: string): Promise<OnboardingProgress | null> {
    const [progress] = await db
      .select()
      .from(onboardingProgress)
      .where(eq(onboardingProgress.tenantId, tenantId));

    return progress || null;
  }

  async getFullStatus(tenantId: string): Promise<OnboardingStatusResponse> {
    const progress = await this.getOnboardingProgress(tenantId);
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));

    const xeroConnected = !!(tenant?.xeroAccessToken && tenant?.xeroTenantId);
    const emailConnected = !!(tenant?.emailConnectionStatus === 'connected');

    if (!progress) {
      return {
        step1Status: "NOT_STARTED",
        step2Status: "NOT_STARTED",
        step3Status: "NOT_STARTED",
        step4Status: "NOT_STARTED",
        step5Status: "NOT_STARTED",
        step6Status: "NOT_STARTED",
        companyDetails: null,
        smsMobileOptIn: false,
        agedDebtorsSummary: null,
        contactDataSummary: null,
        lastAnalysisAt: null,
        onboardingCompleted: false,
        xeroConnected,
        emailConnected,
        emailConnectedAddress: tenant?.emailConnectedAddress || null,
      };
    }

    return {
      step1Status: (progress.step1Status as StepStatus) || "NOT_STARTED",
      step2Status: (progress.step2Status as StepStatus) || "NOT_STARTED",
      step3Status: (progress.step3Status as StepStatus) || "NOT_STARTED",
      step4Status: (progress.step4Status as StepStatus) || "NOT_STARTED",
      step5Status: (progress.step5Status as StepStatus) || "NOT_STARTED",
      step6Status: (progress.step6Status as StepStatus) || "NOT_STARTED",
      companyDetails: progress.companyDetails as CompanyDetails | null,
      smsMobileOptIn: progress.smsMobileOptIn || false,
      agedDebtorsSummary: progress.agedDebtorsSummary as AgedDebtorsSummary | null,
      contactDataSummary: progress.contactDataSummary as ContactDataSummary | null,
      lastAnalysisAt: progress.lastAnalysisAt,
      onboardingCompleted: tenant?.onboardingCompleted || false,
      xeroConnected,
      emailConnected,
      emailConnectedAddress: tenant?.emailConnectedAddress || null,
    };
  }

  async saveCompanyDetails(tenantId: string, details: CompanyDetails): Promise<void> {
    await this.ensureProgress(tenantId);

    await db
      .update(onboardingProgress)
      .set({
        companyDetails: details,
        step1Status: "COMPLETED",
        updatedAt: new Date(),
      })
      .where(eq(onboardingProgress.tenantId, tenantId));

    await db
      .update(tenants)
      .set({
        companyName: details.companyName,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));
  }

  async updateStepStatus(tenantId: string, step: number, status: StepStatus): Promise<void> {
    await this.ensureProgress(tenantId);

    const stepField = `step${step}Status` as keyof typeof onboardingProgress;
    const columnMap: Record<number, any> = {
      1: onboardingProgress.step1Status,
      2: onboardingProgress.step2Status,
      3: onboardingProgress.step3Status,
      4: onboardingProgress.step4Status,
      5: onboardingProgress.step5Status,
      6: onboardingProgress.step6Status,
    };

    const column = columnMap[step];
    if (!column) throw new Error(`Invalid step: ${step}`);

    await db
      .update(onboardingProgress)
      .set({
        [stepField]: status,
        updatedAt: new Date(),
      })
      .where(eq(onboardingProgress.tenantId, tenantId));
  }

  async restartOnboarding(tenantId: string): Promise<void> {
    const progress = await this.getOnboardingProgress(tenantId);
    if (!progress) return;

    const hasCompanyDetails = !!(progress.companyDetails as CompanyDetails)?.companyName;

    await db
      .update(onboardingProgress)
      .set({
        step1Status: hasCompanyDetails ? "COMPLETED" : "NOT_STARTED",
        step2Status: "NOT_STARTED",
        step3Status: "NOT_STARTED",
        step4Status: "NOT_STARTED",
        step5Status: "NOT_STARTED",
        step6Status: "NOT_STARTED",
        agedDebtorsSummary: null,
        contactDataSummary: null,
        lastAnalysisAt: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(onboardingProgress.tenantId, tenantId));

    await db
      .update(tenants)
      .set({
        onboardingCompleted: false,
        onboardingCompletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));
  }

  async setSmsMobileOptIn(tenantId: string, enabled: boolean): Promise<void> {
    await this.ensureProgress(tenantId);

    await db
      .update(onboardingProgress)
      .set({
        smsMobileOptIn: enabled,
        updatedAt: new Date(),
      })
      .where(eq(onboardingProgress.tenantId, tenantId));
  }

  async runAnalysis(tenantId: string): Promise<{ agedDebtors: AgedDebtorsSummary; contactData: ContactDataSummary }> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.xeroAccessToken) {
      throw new Error("Xero not connected. Connect Xero to run analysis.");
    }

    const allInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId));

    const allContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.tenantId, tenantId));

    const contactsOnInvoices = new Set(
      allInvoices.map(inv => inv.contactId).filter(Boolean)
    );
    const relevantContacts = allContacts.filter(c => contactsOnInvoices.has(c.id));

    const agedDebtors = this.computeAgedDebtors(allInvoices, relevantContacts);
    const contactData = this.computeContactDataSummary(relevantContacts);

    await this.ensureProgress(tenantId);
    await db
      .update(onboardingProgress)
      .set({
        agedDebtorsSummary: agedDebtors,
        contactDataSummary: contactData,
        lastAnalysisAt: new Date(),
        step5Status: "COMPLETED",
        step6Status: "COMPLETED",
        updatedAt: new Date(),
      })
      .where(eq(onboardingProgress.tenantId, tenantId));

    return { agedDebtors, contactData };
  }

  async isOnboardingCompleted(tenantId: string): Promise<boolean> {
    const [tenant] = await db
      .select({ onboardingCompleted: tenants.onboardingCompleted })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    return tenant?.onboardingCompleted || false;
  }

  isAllStepsFinished(status: OnboardingStatusResponse): boolean {
    const step1Done = status.step1Status === "COMPLETED";
    const otherStepsDone = [
      status.step2Status,
      status.step3Status,
      status.step4Status,
      status.step5Status,
      status.step6Status,
    ].every(s => s === "COMPLETED" || s === "SKIPPED" || s === "RUNNING");
    return step1Done && otherStepsDone;
  }

  async tryCompleteOnboarding(tenantId: string): Promise<boolean> {
    const status = await this.getFullStatus(tenantId);
    if (this.isAllStepsFinished(status) && !status.onboardingCompleted) {
      await db
        .update(onboardingProgress)
        .set({ completedAt: new Date(), updatedAt: new Date() })
        .where(eq(onboardingProgress.tenantId, tenantId));

      await db
        .update(tenants)
        .set({
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));
      return true;
    }
    return false;
  }

  async getLatestScoringJob(tenantId: string): Promise<AnalysisJob | null> {
    const [job] = await db
      .select()
      .from(analysisJobs)
      .where(and(eq(analysisJobs.tenantId, tenantId), eq(analysisJobs.type, "DEBTOR_SCORING")))
      .orderBy(desc(analysisJobs.createdAt))
      .limit(1);
    return job || null;
  }

  async enqueueDebtorScoring(tenantId: string, triggeredBy: string): Promise<AnalysisJob> {
    const existing = await this.getLatestScoringJob(tenantId);
    if (existing && (existing.status === "QUEUED" || existing.status === "RUNNING")) {
      return existing;
    }

    const [job] = await db
      .insert(analysisJobs)
      .values({
        tenantId,
        type: "DEBTOR_SCORING",
        status: "QUEUED",
        progressCurrent: 0,
        progressTotal: 0,
        triggeredBy,
      })
      .returning();

    await this.updateStepStatus(tenantId, 5, "RUNNING");
    return job;
  }

  private async ensureProgress(tenantId: string): Promise<void> {
    const existing = await this.getOnboardingProgress(tenantId);
    if (!existing) {
      await this.initializeOnboarding(tenantId);
    }
  }

  private computeAgedDebtors(allInvoices: any[], relevantContacts: any[]): AgedDebtorsSummary {
    const now = new Date();
    const overdueInvoices = allInvoices.filter(inv => {
      const amountDue = parseFloat(inv.amountDue || '0');
      return amountDue > 0 && inv.dueDate && new Date(inv.dueDate) < now;
    });

    const buckets = [
      { label: "1-30 days", minDays: 1, maxDays: 30, count: 0, totalValue: 0 },
      { label: "31-60 days", minDays: 31, maxDays: 60, count: 0, totalValue: 0 },
      { label: "61-90 days", minDays: 61, maxDays: 90, count: 0, totalValue: 0 },
      { label: "90+ days", minDays: 91, maxDays: null as number | null, count: 0, totalValue: 0 },
    ];

    const debtorTotals = new Map<string, { total: number; oldestDays: number }>();

    for (const inv of overdueInvoices) {
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      const amount = parseFloat(inv.amountDue || '0');

      for (const bucket of buckets) {
        if (daysOverdue >= bucket.minDays && (bucket.maxDays === null || daysOverdue <= bucket.maxDays)) {
          bucket.count++;
          bucket.totalValue += amount;
          break;
        }
      }

      if (inv.contactId) {
        const existing = debtorTotals.get(inv.contactId) || { total: 0, oldestDays: 0 };
        existing.total += amount;
        existing.oldestDays = Math.max(existing.oldestDays, daysOverdue);
        debtorTotals.set(inv.contactId, existing);
      }
    }

    const contactMap = new Map(relevantContacts.map(c => [c.id, c]));
    const topDebtors = Array.from(debtorTotals.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([contactId, data]) => ({
        contactId,
        contactName: contactMap.get(contactId)?.name || contactMap.get(contactId)?.companyName || "Unknown",
        totalOverdue: Math.round(data.total * 100) / 100,
        oldestDaysOverdue: data.oldestDays,
      }));

    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + parseFloat(inv.amountDue || '0'), 0);

    const summary = `${overdueInvoices.length} overdue invoices totalling ${this.formatCurrency(totalOverdue)}. ` +
      `${buckets[3].count} invoices (${this.formatCurrency(buckets[3].totalValue)}) are 90+ days overdue.`;

    return {
      buckets,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      totalOverdueCount: overdueInvoices.length,
      topDebtors,
      summary,
    };
  }

  private computeContactDataSummary(relevantContacts: any[]): ContactDataSummary {
    let missingName = 0;
    let missingEmail = 0;
    let missingPhone = 0;
    let missingMobile = 0;
    const contactsWithIssues: ContactDataSummary["contactsWithIssues"] = [];

    for (const contact of relevantContacts) {
      const missing: string[] = [];
      if (!contact.name && !contact.companyName) { missingName++; missing.push("name"); }
      if (!contact.email) { missingEmail++; missing.push("email"); }
      if (!contact.phone) { missingPhone++; missing.push("phone"); }
      if (!contact.phone) { missingMobile++; missing.push("mobile"); }

      if (missing.length > 0) {
        contactsWithIssues.push({
          contactId: contact.id,
          contactName: contact.name || contact.companyName || "Unknown",
          missingFields: missing,
        });
      }
    }

    return {
      totalContacts: relevantContacts.length,
      missingName,
      missingEmail,
      missingPhone,
      missingMobile,
      contactsWithIssues,
    };
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  }

  async getOnboardingStats(tenantId: string): Promise<{
    currentPhase: string;
    completedPhases: string[];
    totalPhases: number;
    progressPercentage: number;
    estimatedTimeRemaining: number;
  }> {
    const status = await this.getFullStatus(tenantId);
    const steps = [status.step1Status, status.step2Status, status.step3Status, status.step4Status, status.step5Status, status.step6Status];
    const completedCount = steps.filter(s => s === "COMPLETED" || s === "SKIPPED").length;

    const firstIncomplete = steps.findIndex(s => s === "NOT_STARTED" || s === "RUNNING");
    const currentStep = firstIncomplete === -1 ? 6 : firstIncomplete + 1;

    return {
      currentPhase: `step_${currentStep}`,
      completedPhases: steps.map((s, i) => (s === "COMPLETED" || s === "SKIPPED") ? `step_${i+1}` : "").filter(Boolean),
      totalPhases: 6,
      progressPercentage: Math.round((completedCount / 6) * 100),
      estimatedTimeRemaining: (6 - completedCount) * 3,
    };
  }

  async completeOnboarding(tenantId: string): Promise<void> {
    await Promise.all([
      db
        .update(onboardingProgress)
        .set({ completedAt: new Date(), updatedAt: new Date() })
        .where(eq(onboardingProgress.tenantId, tenantId)),
      db
        .update(tenants)
        .set({
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId)),
    ]);
  }

  async updatePhaseProgress(tenantId: string, phase: string, data: any): Promise<void> {
    const currentProgress = await this.getOnboardingProgress(tenantId);
    if (!currentProgress) {
      throw new Error(`No onboarding progress found for tenant ${tenantId}`);
    }

    const updatedPhaseData = {
      ...(currentProgress.phaseData as any),
      [phase]: {
        ...((currentProgress.phaseData as any)?.[phase]),
        ...data[phase]
      }
    };

    await db
      .update(onboardingProgress)
      .set({ phaseData: updatedPhaseData, updatedAt: new Date() })
      .where(eq(onboardingProgress.tenantId, tenantId));
  }

  async completePhase(tenantId: string, phase: string): Promise<void> {
    const currentProgress = await this.getOnboardingProgress(tenantId);
    if (!currentProgress) {
      throw new Error(`No onboarding progress found for tenant ${tenantId}`);
    }
    const completedPhases = [...(currentProgress.completedPhases as string[]), phase];
    await db
      .update(onboardingProgress)
      .set({ completedPhases, updatedAt: new Date() })
      .where(eq(onboardingProgress.tenantId, tenantId));
  }

  async validatePhaseCompletion(_tenantId: string, _phase: string): Promise<{ canComplete: boolean; missingRequirements: string[] }> {
    return { canComplete: true, missingRequirements: [] };
  }
}

export const onboardingService = new OnboardingService();
