// Shared types for Health Dashboard functionality

export interface HealthMetrics {
  totalInvoices: number;
  healthyInvoices: number;
  atRiskInvoices: number;
  criticalInvoices: number;
  averageHealthScore: number;
  totalOutstanding: number;
  predictedCollectionRate: number;
}

export interface InvoiceHealthScore {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  dueDate: string;
  status: string;
  healthScore: number;
  riskLevel: string;
  keyRiskFactors: string[];
  paymentLikelihood: number;
}

export interface HealthDashboardData {
  metrics: HealthMetrics;
  invoiceHealthScores: InvoiceHealthScore[];
  lastUpdated: string;
}

export interface HealthTrend {
  date: string;
  averageScore: number;
  invoiceCount: number;
  scoreDistribution: {
    healthy: number;
    atRisk: number;
    critical: number;
  };
}

export interface HealthAnalyticsTrends {
  trends: HealthTrend[];
  summary: {
    totalAnalyzed: number;
    averageHealthScore: number;
    riskDistribution: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'healthy' | 'at_risk';

export interface BulkAnalysisResult {
  success: boolean;
  processedCount: number;
  results: Array<{
    invoiceId: string;
    invoiceNumber: string;
    healthScore?: number;
    riskLevel?: string;
    error?: string;
  }>;
}