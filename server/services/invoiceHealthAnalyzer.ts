import OpenAI from "openai";
import { storage } from "../storage";
import { 
  InvoiceHealthScore, 
  InsertInvoiceHealthScore,
  HealthAnalyticsSnapshot,
  InsertHealthAnalyticsSnapshot 
} from "../../shared/schema";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

interface InvoiceAnalysisData {
  invoice: {
    id: string;
    amount: number;
    daysPastDue: number;
    dueDate: Date;
    issueDate: Date;
    status: string;
    reminderCount: number;
    lastReminderSent?: Date;
    collectionStage: string;
  };
  contact: {
    id: string;
    name: string;
    paymentTerms: number;
    paymentHistory: Array<{
      amount: number;
      daysTaken: number;
      wasOnTime: boolean;
    }>;
    communicationResponsiveness: number; // 0-1 scale
    totalOutstanding: number;
    creditLimit?: number;
  };
  tenantMetrics: {
    averagePaymentDays: number;
    collectionSuccessRate: number;
    industryBenchmarks: {
      averagePaymentDays: number;
      collectionRate: number;
    };
  };
}

interface RiskAnalysisResult {
  overallRiskScore: number; // 0-100
  paymentProbability: number; // 0-1
  timeRiskScore: number;
  amountRiskScore: number;
  customerRiskScore: number;
  communicationRiskScore: number;
  healthStatus: 'healthy' | 'at_risk' | 'critical' | 'emergency';
  healthScore: number;
  predictedPaymentDate?: Date;
  collectionDifficulty: 'easy' | 'moderate' | 'difficult' | 'very_difficult';
  recommendedActions: Array<{
    type: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    urgency: number; // days
  }>;
  aiConfidence: number;
  trends: {
    riskTrend: 'improving' | 'stable' | 'declining';
    paymentPattern: string;
    seasonalFactors: string[];
  };
}

/**
 * Core AI-powered risk scoring algorithm
 */
export class InvoiceHealthAnalyzer {
  private modelVersion = "1.0";

  /**
   * Analyze a single invoice and generate comprehensive health scoring
   */
  async analyzeInvoice(invoiceId: string, tenantId: string): Promise<RiskAnalysisResult | null> {
    try {
      // Get comprehensive invoice data
      const analysisData = await this.gatherAnalysisData(invoiceId, tenantId);
      if (!analysisData) {
        console.error(`Failed to gather analysis data for invoice ${invoiceId}`);
        return null;
      }

      // Calculate component risk scores
      const timeRisk = this.calculateTimeRiskScore(analysisData);
      const amountRisk = this.calculateAmountRiskScore(analysisData);
      const customerRisk = this.calculateCustomerRiskScore(analysisData);
      const communicationRisk = this.calculateCommunicationRiskScore(analysisData);
      
      // Debug: Log calculated risk scores
      console.log(`Risk scores for invoice ${invoiceId}: time=${timeRisk}, amount=${amountRisk}, customer=${customerRisk}, communication=${communicationRisk}`);

      // Calculate overall risk using weighted algorithm
      const overallRisk = this.calculateOverallRiskScore({
        timeRisk,
        amountRisk,
        customerRisk,
        communicationRisk
      });

      // Get AI-enhanced insights
      const aiInsights = await this.getAIEnhancedInsights(analysisData, {
        timeRisk,
        amountRisk,
        customerRisk,
        communicationRisk,
        overallRisk
      });
      
      // Debug: Log AI insights
      console.log(`AI insights for invoice ${invoiceId}:`, {
        paymentProbability: aiInsights.paymentProbability,
        collectionDifficulty: aiInsights.collectionDifficulty,
        confidence: aiInsights.confidence
      });

      const result = {
        overallRiskScore: overallRisk,
        paymentProbability: aiInsights.paymentProbability,
        timeRiskScore: timeRisk,
        amountRiskScore: amountRisk,
        customerRiskScore: customerRisk,
        communicationRiskScore: communicationRisk,
        healthStatus: this.determineHealthStatus(overallRisk),
        healthScore: 100 - overallRisk, // Inverse of risk
        predictedPaymentDate: aiInsights.predictedPaymentDate,
        collectionDifficulty: aiInsights.collectionDifficulty,
        recommendedActions: aiInsights.recommendedActions,
        aiConfidence: aiInsights.confidence,
        trends: aiInsights.trends
      };
      
      console.log(`Final analysis result for invoice ${invoiceId}:`, {
        overallRiskScore: result.overallRiskScore,
        communicationRiskScore: result.communicationRiskScore,
        healthStatus: result.healthStatus,
        collectionDifficulty: result.collectionDifficulty,
        aiConfidence: result.aiConfidence
      });
      
      return result;

    } catch (error) {
      console.error(`Error analyzing invoice ${invoiceId}:`, error);
      return null;
    }
  }

  /**
   * Calculate time-based risk score (0-100)
   */
  private calculateTimeRiskScore(data: InvoiceAnalysisData): number {
    const { daysPastDue } = data.invoice;
    const { paymentTerms } = data.contact;

    // Base score on days past due
    let timeRisk = 0;

    if (daysPastDue <= 0) {
      timeRisk = 10; // Low risk for current invoices
    } else if (daysPastDue <= 7) {
      timeRisk = 25; // Slightly elevated
    } else if (daysPastDue <= 30) {
      timeRisk = 50; // Moderate risk
    } else if (daysPastDue <= 60) {
      timeRisk = 75; // High risk
    } else {
      timeRisk = 95; // Very high risk
    }

    // Adjust based on payment terms
    const termsFactor = Math.min(paymentTerms / 30, 2); // Normalize to 30-day standard
    timeRisk = Math.min(100, timeRisk * (1 + (termsFactor - 1) * 0.3));

    return Math.round(timeRisk);
  }

  /**
   * Calculate amount-based risk score (0-100)
   */
  private calculateAmountRiskScore(data: InvoiceAnalysisData): number {
    const { amount } = data.invoice;
    const { creditLimit, totalOutstanding } = data.contact;

    let amountRisk = 20; // Base risk

    // Risk increases with amount size
    if (amount > 50000) {
      amountRisk += 30;
    } else if (amount > 10000) {
      amountRisk += 20;
    } else if (amount > 5000) {
      amountRisk += 10;
    }

    // Risk increases if close to credit limit
    if (creditLimit && totalOutstanding > creditLimit * 0.8) {
      amountRisk += 25;
    } else if (creditLimit && totalOutstanding > creditLimit * 0.6) {
      amountRisk += 15;
    }

    return Math.min(100, Math.round(amountRisk));
  }

  /**
   * Calculate customer-based risk score (0-100)
   */
  private calculateCustomerRiskScore(data: InvoiceAnalysisData): number {
    const { paymentHistory } = data.contact;

    if (paymentHistory.length === 0) {
      return 60; // Moderate risk for unknown customers
    }

    const onTimeRate = paymentHistory.filter(p => p.wasOnTime).length / paymentHistory.length;
    const avgDaysLate = paymentHistory.reduce((sum, p) => sum + Math.max(0, p.daysTaken - 30), 0) / paymentHistory.length;

    let customerRisk = 50; // Base risk

    // Adjust based on on-time payment rate
    customerRisk -= (onTimeRate - 0.5) * 80; // -40 to +40 adjustment

    // Adjust based on average days late
    customerRisk += Math.min(30, avgDaysLate * 2);

    return Math.max(0, Math.min(100, Math.round(customerRisk)));
  }

  /**
   * Calculate communication-based risk score (0-100)
   */
  private calculateCommunicationRiskScore(data: InvoiceAnalysisData): number {
    const { reminderCount, lastReminderSent } = data.invoice;
    const { communicationResponsiveness } = data.contact;

    let commRisk = 20; // Base risk

    // Risk increases with reminder count
    commRisk += Math.min(40, (reminderCount || 0) * 10);

    // Risk increases based on responsiveness
    const responsiveness = communicationResponsiveness || 0.7; // Default if undefined
    commRisk += (1 - responsiveness) * 30;

    // Risk increases if recent reminders were ignored
    if (lastReminderSent) {
      const daysSinceReminder = Math.floor((Date.now() - lastReminderSent.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceReminder > 7) {
        commRisk += 15;
      }
    }

    const result = Math.min(100, Math.round(commRisk));
    console.log(`Communication risk calculation: reminderCount=${reminderCount}, responsiveness=${responsiveness}, result=${result}`);
    return result;
  }

  /**
   * Calculate overall weighted risk score
   */
  private calculateOverallRiskScore(componentScores: {
    timeRisk: number;
    amountRisk: number;
    customerRisk: number;
    communicationRisk: number;
  }): number {
    // Weighted average with time being most important
    const weights = {
      time: 0.4,
      customer: 0.3,
      communication: 0.2,
      amount: 0.1
    };

    const weightedScore = 
      componentScores.timeRisk * weights.time +
      componentScores.customerRisk * weights.customer +
      componentScores.communicationRisk * weights.communication +
      componentScores.amountRisk * weights.amount;

    return Math.round(weightedScore);
  }

  /**
   * Get AI-enhanced insights and predictions
   */
  private async getAIEnhancedInsights(
    data: InvoiceAnalysisData, 
    scores: any
  ): Promise<{
    paymentProbability: number;
    predictedPaymentDate?: Date;
    collectionDifficulty: 'easy' | 'moderate' | 'difficult' | 'very_difficult';
    recommendedActions: Array<any>;
    confidence: number;
    trends: any;
  }> {
    try {
      const prompt = `
Analyze this invoice situation and provide detailed collection insights:

Invoice Details:
- Amount: $${data.invoice.amount}
- Days Past Due: ${data.invoice.daysPastDue}
- Collection Stage: ${data.invoice.collectionStage}
- Reminder Count: ${data.invoice.reminderCount}

Customer Profile:
- Payment History: ${data.contact.paymentHistory.length} invoices
- On-time Rate: ${data.contact.paymentHistory.filter(p => p.wasOnTime).length / Math.max(1, data.contact.paymentHistory.length) * 100}%
- Communication Responsiveness: ${data.contact.communicationResponsiveness * 100}%
- Total Outstanding: $${data.contact.totalOutstanding}

Risk Scores:
- Overall Risk: ${scores.overallRisk}/100
- Time Risk: ${scores.timeRisk}/100
- Customer Risk: ${scores.customerRisk}/100

Provide analysis in JSON format:
{
  "paymentProbability": 0.75,
  "predictedDaysUntilPayment": 14,
  "collectionDifficulty": "moderate",
  "recommendedActions": [
    {
      "type": "communication",
      "description": "Send personalized payment reminder",
      "priority": "high",
      "urgency": 3
    }
  ],
  "confidence": 0.85,
  "trends": {
    "riskTrend": "stable",
    "paymentPattern": "Typically pays within 45 days",
    "seasonalFactors": ["End of quarter payment delays"]
  }
}
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert accounts receivable analyst with 15+ years of experience in debt collection and payment behavior prediction."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        paymentProbability: result.paymentProbability || 0.5,
        predictedPaymentDate: result.predictedDaysUntilPayment ? 
          new Date(Date.now() + result.predictedDaysUntilPayment * 24 * 60 * 60 * 1000) : 
          undefined,
        collectionDifficulty: result.collectionDifficulty || 'moderate',
        recommendedActions: result.recommendedActions || [],
        confidence: result.confidence || 0.7,
        trends: result.trends || {
          riskTrend: 'stable',
          paymentPattern: 'Unknown pattern',
          seasonalFactors: []
        }
      };

    } catch (error) {
      console.error("Error getting AI insights:", error);
      return {
        paymentProbability: 0.5,
        predictedPaymentDate: undefined,
        collectionDifficulty: 'moderate',
        recommendedActions: [],
        confidence: 0.5,
        trends: {
          riskTrend: 'stable',
          paymentPattern: 'Analysis unavailable',
          seasonalFactors: []
        }
      };
    }
  }

  /**
   * Determine health status based on risk score
   */
  private determineHealthStatus(riskScore: number): 'healthy' | 'at_risk' | 'critical' | 'emergency' {
    if (riskScore <= 25) return 'healthy';
    if (riskScore <= 50) return 'at_risk';
    if (riskScore <= 75) return 'critical';
    return 'emergency';
  }

  /**
   * Gather comprehensive analysis data for an invoice
   */
  private async gatherAnalysisData(invoiceId: string, tenantId: string): Promise<InvoiceAnalysisData | null> {
    try {
      // Get invoice with contact data
      const invoice = await storage.getInvoice(invoiceId, tenantId);
      if (!invoice || !invoice.contact) {
        return null;
      }

      // Calculate days past due
      const today = new Date();
      const dueDate = new Date(invoice.dueDate);
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Get customer payment history
      const customerInvoices = await storage.getInvoicesByContact(invoice.contact.id, tenantId);
      const paymentHistory = customerInvoices
        .filter((inv: any) => inv.status === 'paid' && inv.paidDate)
        .map((inv: any) => {
          const issueDate = new Date(inv.issueDate);
          const paidDate = new Date(inv.paidDate!);
          const daysTaken = Math.floor((paidDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
          const paymentTerms = invoice.contact.paymentTerms || 30;
          
          return {
            amount: Number(inv.amount),
            daysTaken,
            wasOnTime: daysTaken <= paymentTerms
          };
        });

      // Calculate total outstanding for customer
      const totalOutstanding = customerInvoices
        .filter((inv: any) => inv.status !== 'paid' && inv.status !== 'cancelled')
        .reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);

      // Get tenant metrics (simplified for now)
      const tenantInvoices = await storage.getInvoices(tenantId);
      const paidInvoices = tenantInvoices.filter(inv => inv.status === 'paid' && inv.paidDate);
      const avgPaymentDays = paidInvoices.length > 0 ? 
        paidInvoices.reduce((sum, inv) => {
          const issueDate = new Date(inv.issueDate);
          const paidDate = new Date(inv.paidDate!);
          return sum + Math.floor((paidDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / paidInvoices.length : 35;

      return {
        invoice: {
          id: invoice.id,
          amount: Number(invoice.amount),
          daysPastDue,
          dueDate: new Date(invoice.dueDate),
          issueDate: new Date(invoice.issueDate),
          status: invoice.status,
          reminderCount: invoice.reminderCount || 0,
          lastReminderSent: invoice.lastReminderSent ? new Date(invoice.lastReminderSent) : undefined,
          collectionStage: invoice.collectionStage || 'initial'
        },
        contact: {
          id: invoice.contact.id,
          name: invoice.contact.name,
          paymentTerms: invoice.contact.paymentTerms || 30,
          paymentHistory,
          communicationResponsiveness: 0.7, // Default value, could be calculated from actions
          totalOutstanding,
          creditLimit: invoice.contact.creditLimit ? Number(invoice.contact.creditLimit) : undefined
        },
        tenantMetrics: {
          averagePaymentDays: avgPaymentDays,
          collectionSuccessRate: 0.85, // Default value
          industryBenchmarks: {
            averagePaymentDays: 35,
            collectionRate: 0.90
          }
        }
      };

    } catch (error) {
      console.error(`Error gathering analysis data for invoice ${invoiceId}:`, error);
      return null;
    }
  }

  /**
   * Store health analysis results in database
   */
  async storeHealthAnalysis(
    invoiceId: string, 
    tenantId: string, 
    contactId: string,
    analysis: RiskAnalysisResult
  ): Promise<boolean> {
    try {
      const healthScoreData: InsertInvoiceHealthScore = {
        tenantId,
        invoiceId,
        contactId,
        overallRiskScore: analysis.overallRiskScore,
        paymentProbability: analysis.paymentProbability.toString(),
        timeRiskScore: analysis.timeRiskScore,
        amountRiskScore: analysis.amountRiskScore,
        customerRiskScore: analysis.customerRiskScore,
        communicationRiskScore: analysis.communicationRiskScore,
        healthStatus: analysis.healthStatus,
        healthScore: analysis.healthScore,
        predictedPaymentDate: analysis.predictedPaymentDate,
        collectionDifficulty: analysis.collectionDifficulty,
        recommendedActions: analysis.recommendedActions,
        aiConfidence: analysis.aiConfidence.toString(),
        modelVersion: this.modelVersion,
        lastAnalysis: new Date(),
        trends: analysis.trends
      };

      await storage.createInvoiceHealthScore(healthScoreData);
      return true;

    } catch (error) {
      console.error(`Error storing health analysis for invoice ${invoiceId}:`, error);
      return false;
    }
  }

  /**
   * Analyze all invoices for a tenant and update health scores
   */
  async analyzeAllInvoices(tenantId: string): Promise<{
    analyzed: number;
    successful: number;
    errors: number;
  }> {
    const results = { analyzed: 0, successful: 0, errors: 0 };

    try {
      const invoices = await storage.getInvoices(tenantId);
      
      for (const invoice of invoices) {
        // Only analyze unpaid invoices
        if (invoice.status === 'paid' || invoice.status === 'cancelled') {
          continue;
        }

        results.analyzed++;

        try {
          const analysis = await this.analyzeInvoice(invoice.id, tenantId);
          if (analysis) {
            const stored = await this.storeHealthAnalysis(
              invoice.id, 
              tenantId, 
              invoice.contactId,
              analysis
            );
            if (stored) {
              results.successful++;
            } else {
              results.errors++;
            }
          } else {
            results.errors++;
          }
        } catch (error) {
          console.error(`Error analyzing invoice ${invoice.id}:`, error);
          results.errors++;
        }
      }

      console.log(`Health analysis completed for tenant ${tenantId}: ${results.successful}/${results.analyzed} successful`);
      return results;

    } catch (error) {
      console.error(`Error analyzing invoices for tenant ${tenantId}:`, error);
      return results;
    }
  }
}

// Export singleton instance
export const invoiceHealthAnalyzer = new InvoiceHealthAnalyzer();