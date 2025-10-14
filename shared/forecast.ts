/**
 * Qashivo Cashflow Forecast Engine
 * 
 * Comprehensive 13-week cashflow forecasting system that processes real accounting data
 * from all providers (Xero, Sage, QuickBooks) to generate accurate cash flow predictions.
 * 
 * Features:
 * - Multi-scenario modeling (base, optimistic, pessimistic, custom)
 * - Accounts Receivable processing with aging analysis
 * - Accounts Payable optimization and scheduling
 * - Budget integration for planned transactions
 * - Multi-currency support with FX impact modeling
 * - Advanced analytics: DSO, DPO, cash runway calculations
 * - Payment probability curves and risk assessment
 * - Seasonal adjustments and pattern recognition
 */

import { z } from "zod";

// =============================================
// CORE FORECAST TYPES AND CONFIGURATION
// =============================================

/**
 * Forecast scenario types
 */
export type ForecastScenario = 'base' | 'optimistic' | 'pessimistic' | 'custom';

/**
 * Forecast mode types
 * - 'total': Traditional AR/AP approach (sum of existing receivables/payables)
 * - 'inflow': Sales-driven approach (includes future sales forecasts with ARD conversion)
 */
export type ForecastMode = 'total' | 'inflow';

/**
 * Risk assessment levels
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Currency code type
 */
export type CurrencyCode = string; // ISO 4217 currency codes (USD, EUR, GBP, etc.)

/**
 * Payment probability curve - defines likelihood of payment based on age
 */
export interface PaymentProbabilityCurve {
  dayRanges: Array<{
    fromDay: number;
    toDay: number;
    probability: number; // 0-1
  }>;
}

/**
 * Seasonal adjustment factors
 */
export interface SeasonalAdjustments {
  monthlyFactors: Record<number, number>; // 1-12 month number to factor (1.0 = normal)
  weeklyFactors: Record<number, number>; // 0-6 day of week to factor
  holidayFactors: Record<string, number>; // date string to factor
}

/**
 * Forecast configuration parameters
 */
export interface ForecastConfig {
  // Basic settings
  forecastWeeks: number;
  baseCurrency: CurrencyCode;
  includeWeekends: boolean;
  
  // Forecast mode
  mode?: ForecastMode; // 'total' (default) or 'inflow' (sales-driven)
  
  // Scenario parameters
  scenario: ForecastScenario;
  
  // AR Collection parameters
  arCollectionConfig: {
    paymentProbabilityCurve: PaymentProbabilityCurve;
    collectionAccelerationFactor: number; // 0.5-2.0 (1.0 = normal)
    badDebtThreshold: number; // Days after which debt is considered uncollectable
    seasonalAdjustments: SeasonalAdjustments;
  };
  
  // AP Payment parameters
  apPaymentConfig: {
    paymentDelayFactor: number; // 0.5-2.0 (1.0 = normal, >1.0 = delay payments)
    earlyPaymentDiscountThreshold: number; // Percentage discount to justify early payment
    prioritizeVendorsByTerms: boolean;
    cashReserveTarget: number; // Minimum cash to maintain
  };
  
  // Budget integration
  budgetConfig: {
    includePlannedTransactions: boolean;
    budgetConfidenceFactor: number; // 0-1 reliability of budget data
    distributionMethod: 'linear' | 'seasonal' | 'historical';
  };
  
  // Risk and uncertainty
  riskConfig: {
    confidenceInterval: number; // 0.80, 0.90, 0.95
    monteCarloIterations: number;
    includeStressTest: boolean;
  };
  
  // FX settings
  fxConfig: {
    hedgingStrategy: 'none' | 'forward' | 'options';
    volatilityFactor: number; // Expected FX volatility
    hedgeRatio: number; // 0-1 percentage of exposure to hedge
  };
  
  // Intelligent forecast settings (for 'inflow' mode)
  intelligentConfig?: {
    averageReceivableDays: number; // ARD to shift sales forecasts
    irregularBufferBeta: number; // Smoothing coefficient for one-off expenses
    salesForecastConfidence: number; // 0-1 confidence multiplier for sales data
    includeIrregularBuffer: boolean; // Apply irregular expense buffer
  };
}

/**
 * Default forecast configuration
 */
export const DEFAULT_FORECAST_CONFIG: ForecastConfig = {
  forecastWeeks: 13,
  baseCurrency: 'USD',
  includeWeekends: false,
  mode: 'total', // Default to traditional AR/AP mode
  scenario: 'base',
  
  arCollectionConfig: {
    paymentProbabilityCurve: {
      dayRanges: [
        { fromDay: 0, toDay: 30, probability: 0.95 },
        { fromDay: 31, toDay: 60, probability: 0.85 },
        { fromDay: 61, toDay: 90, probability: 0.70 },
        { fromDay: 91, toDay: 120, probability: 0.50 },
        { fromDay: 121, toDay: 180, probability: 0.30 },
        { fromDay: 181, toDay: 365, probability: 0.15 },
        { fromDay: 366, toDay: 999999, probability: 0.05 }
      ]
    },
    collectionAccelerationFactor: 1.0,
    badDebtThreshold: 365,
    seasonalAdjustments: {
      monthlyFactors: {
        1: 0.9, 2: 0.95, 3: 1.0, 4: 1.05, 5: 1.0, 6: 1.0,
        7: 0.9, 8: 0.95, 9: 1.05, 10: 1.1, 11: 1.05, 12: 0.85
      },
      weeklyFactors: {
        0: 0.7, 1: 1.0, 2: 1.1, 3: 1.1, 4: 1.0, 5: 0.8, 6: 0.5
      },
      holidayFactors: {}
    }
  },
  
  apPaymentConfig: {
    paymentDelayFactor: 1.0,
    earlyPaymentDiscountThreshold: 0.02,
    prioritizeVendorsByTerms: true,
    cashReserveTarget: 50000
  },
  
  budgetConfig: {
    includePlannedTransactions: true,
    budgetConfidenceFactor: 0.85,
    distributionMethod: 'seasonal'
  },
  
  riskConfig: {
    confidenceInterval: 0.90,
    monteCarloIterations: 1000,
    includeStressTest: true
  },
  
  fxConfig: {
    hedgingStrategy: 'none',
    volatilityFactor: 0.15,
    hedgeRatio: 0.0
  }
};

/**
 * Scenario-specific configuration overrides
 */
export const SCENARIO_CONFIGS: Record<ForecastScenario, Partial<ForecastConfig>> = {
  base: {},
  
  optimistic: {
    arCollectionConfig: {
      paymentProbabilityCurve: {
        dayRanges: [
          { fromDay: 0, toDay: 30, probability: 0.98 },
          { fromDay: 31, toDay: 60, probability: 0.92 },
          { fromDay: 61, toDay: 90, probability: 0.80 },
          { fromDay: 91, toDay: 120, probability: 0.65 },
          { fromDay: 121, toDay: 180, probability: 0.45 },
          { fromDay: 181, toDay: 365, probability: 0.25 },
          { fromDay: 366, toDay: 999999, probability: 0.10 }
        ]
      },
      collectionAccelerationFactor: 1.2,
      badDebtThreshold: 365,
      seasonalAdjustments: {
        monthlyFactors: {
          1: 0.95, 2: 1.0, 3: 1.05, 4: 1.1, 5: 1.05, 6: 1.05,
          7: 0.95, 8: 1.0, 9: 1.1, 10: 1.15, 11: 1.1, 12: 0.9
        },
        weeklyFactors: {
          0: 0.8, 1: 1.05, 2: 1.15, 3: 1.15, 4: 1.05, 5: 0.9, 6: 0.6
        },
        holidayFactors: {}
      }
    },
    apPaymentConfig: {
      paymentDelayFactor: 1.15,
      earlyPaymentDiscountThreshold: 0.015,
      prioritizeVendorsByTerms: true,
      cashReserveTarget: 30000
    }
  },
  
  pessimistic: {
    arCollectionConfig: {
      paymentProbabilityCurve: {
        dayRanges: [
          { fromDay: 0, toDay: 30, probability: 0.90 },
          { fromDay: 31, toDay: 60, probability: 0.75 },
          { fromDay: 61, toDay: 90, probability: 0.55 },
          { fromDay: 91, toDay: 120, probability: 0.35 },
          { fromDay: 121, toDay: 180, probability: 0.20 },
          { fromDay: 181, toDay: 365, probability: 0.10 },
          { fromDay: 366, toDay: 999999, probability: 0.02 }
        ]
      },
      collectionAccelerationFactor: 0.8,
      badDebtThreshold: 180,
      seasonalAdjustments: {
        monthlyFactors: {
          1: 0.85, 2: 0.9, 3: 0.95, 4: 1.0, 5: 0.95, 6: 0.95,
          7: 0.85, 8: 0.9, 9: 1.0, 10: 1.05, 11: 1.0, 12: 0.8
        },
        weeklyFactors: {
          0: 0.6, 1: 0.95, 2: 1.05, 3: 1.05, 4: 0.95, 5: 0.7, 6: 0.4
        },
        holidayFactors: {}
      }
    },
    apPaymentConfig: {
      paymentDelayFactor: 0.85,
      earlyPaymentDiscountThreshold: 0.025,
      prioritizeVendorsByTerms: true,
      cashReserveTarget: 75000
    }
  },
  
  custom: {} // Will be overridden by user
};

// =============================================
// DATA INPUT TYPES
// =============================================

/**
 * Invoice data for AR processing
 */
export interface ForecastInvoice {
  id: string;
  contactId: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  currency: CurrencyCode;
  issueDate: Date;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'on-hold';
  paymentTerms: number; // days
  collectionStage: string;
  isOnHold: boolean;
  contactPaymentHistory?: {
    averageDaysToPayment: number;
    paymentReliability: number; // 0-1
    totalTransactions: number;
  };
}

/**
 * Bill data for AP processing
 */
export interface ForecastBill {
  id: string;
  vendorId: string;
  billNumber: string;
  amount: number;
  amountPaid: number;
  currency: CurrencyCode;
  issueDate: Date;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paymentTerms: number; // days
  vendorPaymentTerms?: {
    earlyPaymentDiscount: number; // percentage
    earlyPaymentDays: number;
    lateFeeRate: number; // percentage
    lateFeeDays: number;
  };
}

/**
 * Bank account data
 */
export interface ForecastBankAccount {
  id: string;
  name: string;
  currency: CurrencyCode;
  currentBalance: number;
  accountType: 'checking' | 'savings' | 'credit_card' | 'cash';
  isActive: boolean;
  creditLimit?: number; // For credit cards
}

/**
 * Budget line item data
 */
export interface ForecastBudgetLine {
  id: string;
  category: 'income' | 'expense' | 'asset' | 'liability';
  subcategory: string;
  budgetedAmount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  currency: CurrencyCode;
  startDate: Date;
  endDate: Date;
  isRecurring: boolean;
  distributionPattern?: 'linear' | 'seasonal' | 'front_loaded' | 'back_loaded';
}

/**
 * Exchange rate data
 */
export interface ForecastExchangeRate {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  rateDate: Date;
  volatility?: number; // Historical volatility for risk modeling
}

/**
 * Historical transaction data for pattern analysis
 */
export interface HistoricalTransaction {
  date: Date;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  currency: CurrencyCode;
  contactId?: string;
}

/**
 * Sales forecast data (for intelligent 'inflow' mode)
 */
export interface ForecastSalesData {
  forecastMonth: string; // YYYY-MM
  committedAmount: number;
  uncommittedAmount: number;
  stretchAmount: number;
  committedConfidence: number;
  uncommittedConfidence: number;
  stretchConfidence: number;
}

/**
 * Complete forecast input data
 */
export interface ForecastInputData {
  invoices: ForecastInvoice[];
  bills: ForecastBill[];
  bankAccounts: ForecastBankAccount[];
  budgetLines: ForecastBudgetLine[];
  exchangeRates: ForecastExchangeRate[];
  historicalTransactions: HistoricalTransaction[];
  forecastDate: Date; // Starting date for forecast
  
  // Sales forecasts (for 'inflow' mode)
  salesForecasts?: ForecastSalesData[];
}

// =============================================
// OUTPUT TYPES
// =============================================

/**
 * Daily cash flow item
 */
export interface DailyCashFlowItem {
  date: Date;
  type: 'ar_collection' | 'ap_payment' | 'budget_income' | 'budget_expense' | 'fx_impact' | 'sales_inflow' | 'irregular_buffer';
  amount: number;
  currency: CurrencyCode;
  description: string;
  confidence: number; // 0-1
  sourceId?: string; // ID of invoice, bill, or budget line
  probability?: number; // For probabilistic items
  category?: 'committed' | 'uncommitted' | 'stretch'; // For sales forecasts
}

/**
 * Daily cash position
 */
export interface DailyCashPosition {
  date: Date;
  openingBalance: number;
  totalInflows: number;
  totalOutflows: number;
  netCashFlow: number;
  closingBalance: number;
  currency: CurrencyCode;
  
  // Detailed breakdowns
  arCollections: number;
  apPayments: number;
  budgetIncome: number;
  budgetExpenses: number;
  fxImpact: number;
  
  // Intelligent forecast breakdowns (for 'inflow' mode)
  salesInflows?: number;
  irregularBuffer?: number;
  
  // Risk metrics
  confidenceInterval: [number, number]; // [lower, upper] bounds
  riskLevel: RiskLevel;
  
  // Analytics
  daysOfCashRemaining?: number;
  cashBurnRate?: number; // 7-day rolling average
}

/**
 * Weekly cash flow summary
 */
export interface WeeklyCashFlowSummary {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  openingBalance: number;
  closingBalance: number;
  netCashFlow: number;
  averageDailyBalance: number;
  
  // Inflows breakdown
  totalInflows: number;
  arCollections: number;
  budgetIncome: number;
  
  // Outflows breakdown
  totalOutflows: number;
  apPayments: number;
  budgetExpenses: number;
  
  // Risk metrics
  minDailyBalance: number;
  maxDailyBalance: number;
  volatility: number;
  riskLevel: RiskLevel;
}

/**
 * Key financial metrics
 */
export interface ForecastMetrics {
  // Liquidity metrics
  averageCashBalance: number;
  minCashBalance: number;
  maxCashBalance: number;
  cashRunway: number; // Days until cash depletion
  
  // Working capital metrics
  dso: number; // Days Sales Outstanding
  dpo: number; // Days Payable Outstanding
  ccc: number; // Cash Conversion Cycle
  
  // Risk metrics
  cashAtRisk: number; // VaR calculation
  stressTestResult: number; // Worst-case scenario balance
  
  // Efficiency metrics
  collectionEfficiency: number; // Percentage of receivables collected on time
  paymentOptimization: number; // Savings from payment timing optimization
  
  // FX metrics
  fxExposure: number;
  fxImpact: number;
  hedgingCost?: number;
}

/**
 * Scenario comparison results
 */
export interface ScenarioComparison {
  scenarios: Record<ForecastScenario, {
    finalCashBalance: number;
    minCashBalance: number;
    cashRunway: number;
    totalCollections: number;
    totalPayments: number;
    netCashFlow: number;
    riskLevel: RiskLevel;
  }>;
  
  // Cross-scenario analytics
  balanceVariance: number;
  worstCaseGap: number; // Difference between pessimistic and base
  upside: number; // Difference between optimistic and base
  
  recommendations: string[];
}

/**
 * Actionable recommendations
 */
export interface CashFlowRecommendation {
  type: 'collection' | 'payment' | 'financing' | 'fx_hedge' | 'working_capital';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: number; // Estimated cash impact
  effort: 'low' | 'medium' | 'high';
  timeline: string; // Implementation timeline
  risks: string[];
  
  // Specific action items
  actionItems?: Array<{
    task: string;
    owner?: string;
    dueDate?: Date;
  }>;
}

/**
 * Complete forecast output
 */
export interface ForecastOutput {
  // Metadata
  generatedAt: Date;
  forecastPeriod: {
    startDate: Date;
    endDate: Date;
    weeks: number;
  };
  config: ForecastConfig;
  baseCurrency: CurrencyCode;
  
  // Core forecast data
  dailyPositions: DailyCashPosition[];
  weeklyPositions: WeeklyCashFlowSummary[];
  cashFlowItems: DailyCashFlowItem[];
  
  // Analytics
  metrics: ForecastMetrics;
  scenarioComparison?: ScenarioComparison;
  recommendations: CashFlowRecommendation[];
  
  // Risk analysis
  confidenceBands: Array<{
    date: Date;
    confidence: number; // 0.80, 0.90, 0.95
    lowerBound: number;
    upperBound: number;
  }>;
  
  // Stress testing
  stressTestResults?: Array<{
    scenario: string;
    description: string;
    impact: number;
    probability: number;
  }>;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

export const ForecastConfigSchema = z.object({
  forecastWeeks: z.number().min(1).max(52),
  baseCurrency: z.string().length(3),
  includeWeekends: z.boolean(),
  scenario: z.enum(['base', 'optimistic', 'pessimistic', 'custom']),
  
  arCollectionConfig: z.object({
    paymentProbabilityCurve: z.object({
      dayRanges: z.array(z.object({
        fromDay: z.number().min(0),
        toDay: z.number().min(0),
        probability: z.number().min(0).max(1)
      }))
    }),
    collectionAccelerationFactor: z.number().min(0.1).max(3.0),
    badDebtThreshold: z.number().min(30).max(999999),
    seasonalAdjustments: z.object({
      monthlyFactors: z.record(z.number()),
      weeklyFactors: z.record(z.number()),
      holidayFactors: z.record(z.number())
    })
  }),
  
  apPaymentConfig: z.object({
    paymentDelayFactor: z.number().min(0.1).max(3.0),
    earlyPaymentDiscountThreshold: z.number().min(0).max(0.1),
    prioritizeVendorsByTerms: z.boolean(),
    cashReserveTarget: z.number().min(0)
  }),
  
  budgetConfig: z.object({
    includePlannedTransactions: z.boolean(),
    budgetConfidenceFactor: z.number().min(0).max(1),
    distributionMethod: z.enum(['linear', 'seasonal', 'historical'])
  }),
  
  riskConfig: z.object({
    confidenceInterval: z.number().min(0.5).max(0.99),
    monteCarloIterations: z.number().min(100).max(10000),
    includeStressTest: z.boolean()
  }),
  
  fxConfig: z.object({
    hedgingStrategy: z.enum(['none', 'forward', 'options']),
    volatilityFactor: z.number().min(0).max(1),
    hedgeRatio: z.number().min(0).max(1)
  })
});

export const ForecastInputDataSchema = z.object({
  invoices: z.array(z.object({
    id: z.string(),
    contactId: z.string(),
    amount: z.number(),
    amountPaid: z.number(),
    currency: z.string(),
    issueDate: z.date(),
    dueDate: z.date(),
    status: z.enum(['pending', 'paid', 'overdue', 'cancelled', 'on-hold']),
    paymentTerms: z.number(),
    collectionStage: z.string(),
    isOnHold: z.boolean()
  })),
  bills: z.array(z.object({
    id: z.string(),
    vendorId: z.string(),
    amount: z.number(),
    amountPaid: z.number(),
    currency: z.string(),
    issueDate: z.date(),
    dueDate: z.date(),
    status: z.enum(['pending', 'paid', 'overdue', 'cancelled']),
    paymentTerms: z.number()
  })),
  bankAccounts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    currency: z.string(),
    currentBalance: z.number(),
    accountType: z.enum(['checking', 'savings', 'credit_card', 'cash']),
    isActive: z.boolean()
  })),
  budgetLines: z.array(z.object({
    id: z.string(),
    category: z.enum(['income', 'expense', 'asset', 'liability']),
    subcategory: z.string(),
    budgetedAmount: z.number(),
    period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
    currency: z.string(),
    startDate: z.date(),
    endDate: z.date(),
    isRecurring: z.boolean()
  })),
  exchangeRates: z.array(z.object({
    fromCurrency: z.string(),
    toCurrency: z.string(),
    rate: z.number(),
    rateDate: z.date()
  })),
  historicalTransactions: z.array(z.object({
    date: z.date(),
    amount: z.number(),
    type: z.enum(['income', 'expense']),
    category: z.string(),
    currency: z.string()
  })),
  forecastDate: z.date()
});

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Create a forecast configuration with scenario-specific overrides
 */
export function createForecastConfig(
  scenario: ForecastScenario,
  customOverrides?: Partial<ForecastConfig>
): ForecastConfig {
  const baseConfig = { ...DEFAULT_FORECAST_CONFIG };
  const scenarioConfig = SCENARIO_CONFIGS[scenario];
  
  // Deep merge configurations
  const mergedConfig = deepMerge(baseConfig, scenarioConfig, customOverrides || {}) as ForecastConfig;
  
  // Validate the final configuration
  try {
    ForecastConfigSchema.parse(mergedConfig);
  } catch (error) {
    console.warn('Configuration validation failed, using defaults:', error);
  }
  
  return mergedConfig;
}

/**
 * Deep merge utility for configuration objects
 */
function deepMerge(target: any, ...sources: any[]): any {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Calculate days between two dates
 */
export function daysBetween(startDate: Date, endDate: Date): number {
  const timeDiff = endDate.getTime() - startDate.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Generate date range for forecast period
 */
export function generateDateRange(startDate: Date, weeks: number, includeWeekends: boolean = true): Date[] {
  const dates: Date[] = [];
  const endDate = addDays(startDate, weeks * 7);
  
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    if (includeWeekends || (currentDate.getDay() !== 0 && currentDate.getDay() !== 6)) {
      dates.push(new Date(currentDate));
    }
    currentDate = addDays(currentDate, 1);
  }
  
  return dates;
}

/**
 * Get payment probability based on aging and curve
 */
export function getPaymentProbability(
  daysOverdue: number,
  curve: PaymentProbabilityCurve
): number {
  const range = curve.dayRanges.find(r => 
    daysOverdue >= r.fromDay && daysOverdue <= r.toDay
  );
  
  return range ? range.probability : 0.05; // Default to 5% for very old debt
}

/**
 * Apply seasonal adjustment to amount
 */
export function applySeasonalAdjustment(
  amount: number,
  date: Date,
  adjustments: SeasonalAdjustments
): number {
  const month = date.getMonth() + 1; // 1-12
  const dayOfWeek = date.getDay(); // 0-6
  const dateString = date.toISOString().split('T')[0];
  
  let adjustedAmount = amount;
  
  // Apply monthly factor
  if (adjustments.monthlyFactors[month]) {
    adjustedAmount *= adjustments.monthlyFactors[month];
  }
  
  // Apply weekly factor
  if (adjustments.weeklyFactors[dayOfWeek]) {
    adjustedAmount *= adjustments.weeklyFactors[dayOfWeek];
  }
  
  // Apply holiday factor if exists
  if (adjustments.holidayFactors[dateString]) {
    adjustedAmount *= adjustments.holidayFactors[dateString];
  }
  
  return adjustedAmount;
}

/**
 * Convert amount between currencies
 */
export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  exchangeRates: ForecastExchangeRate[]
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  // Find direct rate
  let rate = exchangeRates.find(r => 
    r.fromCurrency === fromCurrency && r.toCurrency === toCurrency
  );
  
  if (rate) {
    return amount * rate.rate;
  }
  
  // Find inverse rate
  rate = exchangeRates.find(r => 
    r.fromCurrency === toCurrency && r.toCurrency === fromCurrency
  );
  
  if (rate) {
    return amount / rate.rate;
  }
  
  // TODO: Implement cross-currency conversion via USD base
  console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
  return amount;
}

/**
 * Calculate risk level based on cash position and volatility
 */
export function calculateRiskLevel(
  cashBalance: number,
  cashReserveTarget: number,
  volatility: number
): RiskLevel {
  const reserveRatio = cashBalance / cashReserveTarget;
  
  if (reserveRatio < 0.5 || volatility > 0.3) {
    return 'critical';
  } else if (reserveRatio < 1.0 || volatility > 0.2) {
    return 'high';
  } else if (reserveRatio < 2.0 || volatility > 0.1) {
    return 'medium';
  } else {
    return 'low';
  }
}

// =============================================
// CORE FORECAST ENGINE IMPLEMENTATION
// =============================================

/**
 * Comprehensive 13-Week Cashflow Forecast Engine
 * 
 * This class processes real accounting data to generate sophisticated cash flow forecasts
 * with support for multiple scenarios, risk analysis, and optimization recommendations.
 */
export class ForecastEngine {
  private config: ForecastConfig;
  private inputData: ForecastInputData;
  
  constructor(config: ForecastConfig, inputData: ForecastInputData) {
    this.config = config;
    this.inputData = inputData;
    
    // Validate input data
    ForecastInputDataSchema.parse(inputData);
  }
  
  /**
   * Generate complete forecast output
   */
  public async generateForecast(): Promise<ForecastOutput> {
    const startTime = Date.now();
    
    try {
      // Generate forecast dates
      const forecastDates = generateDateRange(
        this.inputData.forecastDate,
        this.config.forecastWeeks,
        this.config.includeWeekends
      );
      
      // Process all cash flow components
      const arCollections = await this.processAccountsReceivable(forecastDates);
      const apPayments = await this.processAccountsPayable(forecastDates);
      const budgetItems = await this.processBudgetData(forecastDates);
      const fxImpacts = await this.processForeignExchangeImpacts(forecastDates);
      
      // Combine all cash flow items
      const allCashFlowItems = [
        ...arCollections,
        ...apPayments,
        ...budgetItems,
        ...fxImpacts
      ].sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Calculate daily positions
      const dailyPositions = this.calculateDailyPositions(forecastDates, allCashFlowItems);
      
      // Calculate weekly summaries
      const weeklyPositions = this.calculateWeeklyPositions(dailyPositions);
      
      // Calculate metrics
      const metrics = this.calculateForecastMetrics(dailyPositions, allCashFlowItems);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(dailyPositions, metrics);
      
      // Generate confidence bands if Monte Carlo is enabled
      const confidenceBands = this.config.riskConfig.monteCarloIterations > 0 
        ? await this.generateConfidenceBands(forecastDates)
        : [];
      
      // Run stress tests if enabled
      const stressTestResults = this.config.riskConfig.includeStressTest
        ? await this.runStressTests(dailyPositions)
        : [];
      
      return {
        generatedAt: new Date(),
        forecastPeriod: {
          startDate: forecastDates[0],
          endDate: forecastDates[forecastDates.length - 1],
          weeks: this.config.forecastWeeks
        },
        config: this.config,
        baseCurrency: this.config.baseCurrency,
        dailyPositions,
        weeklyPositions,
        cashFlowItems: allCashFlowItems,
        metrics,
        recommendations,
        confidenceBands,
        stressTestResults
      };
      
    } catch (error) {
      console.error('Forecast generation failed:', error);
      throw new Error(`Forecast generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process Accounts Receivable with aging analysis and payment probability
   */
  private async processAccountsReceivable(forecastDates: Date[]): Promise<DailyCashFlowItem[]> {
    const arItems: DailyCashFlowItem[] = [];
    const config = this.config.arCollectionConfig;
    
    for (const invoice of this.inputData.invoices) {
      // Skip if invoice is paid, cancelled, or on hold
      if (invoice.status === 'paid' || invoice.status === 'cancelled' || invoice.isOnHold) {
        continue;
      }
      
      const outstandingAmount = invoice.amount - invoice.amountPaid;
      if (outstandingAmount <= 0) continue;
      
      // Convert to base currency
      const baseAmount = convertCurrency(
        outstandingAmount,
        invoice.currency,
        this.config.baseCurrency,
        this.inputData.exchangeRates
      );
      
      // Calculate days from issue date to forecast start
      const daysFromIssue = daysBetween(invoice.issueDate, this.inputData.forecastDate);
      const daysOverdue = Math.max(0, daysBetween(invoice.dueDate, this.inputData.forecastDate));
      
      // Get base payment probability
      const baseProbability = getPaymentProbability(daysOverdue, config.paymentProbabilityCurve);
      
      // Apply customer payment history if available
      let adjustedProbability = baseProbability;
      if (invoice.contactPaymentHistory) {
        const reliabilityFactor = invoice.contactPaymentHistory.paymentReliability;
        adjustedProbability = baseProbability * (0.5 + 0.5 * reliabilityFactor);
      }
      
      // Apply collection acceleration factor based on scenario
      adjustedProbability = Math.min(1.0, adjustedProbability * config.collectionAccelerationFactor);
      
      // Determine expected payment date
      let expectedPaymentDate: Date;
      
      if (invoice.contactPaymentHistory && invoice.contactPaymentHistory.averageDaysToPayment > 0) {
        // Use historical payment pattern
        expectedPaymentDate = addDays(invoice.dueDate, invoice.contactPaymentHistory.averageDaysToPayment);
      } else {
        // Use payment terms with some delay based on aging
        const delayDays = Math.min(30, Math.max(0, daysOverdue * 0.1));
        expectedPaymentDate = addDays(invoice.dueDate, delayDays);
      }
      
      // Apply seasonal adjustments
      const seasonalAmount = applySeasonalAdjustment(
        baseAmount,
        expectedPaymentDate,
        config.seasonalAdjustments
      );
      
      // Only include if payment date is within forecast period
      if (expectedPaymentDate >= forecastDates[0] && expectedPaymentDate <= forecastDates[forecastDates.length - 1]) {
        arItems.push({
          date: expectedPaymentDate,
          type: 'ar_collection',
          amount: seasonalAmount * adjustedProbability,
          currency: this.config.baseCurrency,
          description: `Invoice ${invoice.invoiceNumber} collection (${Math.round(adjustedProbability * 100)}% probability)`,
          confidence: adjustedProbability,
          sourceId: invoice.id,
          probability: adjustedProbability
        });
      }
      
      // For partially probable payments, add uncertainty variations
      if (adjustedProbability < 0.9 && this.config.riskConfig.monteCarloIterations > 0) {
        // Add optimistic scenario (earlier payment)
        const optimisticDate = addDays(expectedPaymentDate, -7);
        if (optimisticDate >= forecastDates[0]) {
          arItems.push({
            date: optimisticDate,
            type: 'ar_collection',
            amount: seasonalAmount * (1.0 - adjustedProbability) * 0.3,
            currency: this.config.baseCurrency,
            description: `Invoice ${invoice.invoiceNumber} early collection (optimistic)`,
            confidence: (1.0 - adjustedProbability) * 0.3,
            sourceId: invoice.id,
            probability: (1.0 - adjustedProbability) * 0.3
          });
        }
        
        // Add pessimistic scenario (later payment)
        const pessimisticDate = addDays(expectedPaymentDate, 14);
        if (pessimisticDate <= forecastDates[forecastDates.length - 1]) {
          arItems.push({
            date: pessimisticDate,
            type: 'ar_collection',
            amount: seasonalAmount * (1.0 - adjustedProbability) * 0.4,
            currency: this.config.baseCurrency,
            description: `Invoice ${invoice.invoiceNumber} delayed collection (pessimistic)`,
            confidence: (1.0 - adjustedProbability) * 0.4,
            sourceId: invoice.id,
            probability: (1.0 - adjustedProbability) * 0.4
          });
        }
      }
    }
    
    return arItems;
  }
  
  /**
   * Process Accounts Payable with payment optimization
   */
  private async processAccountsPayable(forecastDates: Date[]): Promise<DailyCashFlowItem[]> {
    const apItems: DailyCashFlowItem[] = [];
    const config = this.config.apPaymentConfig;
    
    // Sort bills by priority (due date, early payment discounts, vendor importance)
    const prioritizedBills = this.prioritizeBills(this.inputData.bills);
    
    for (const bill of prioritizedBills) {
      // Skip if bill is paid or cancelled
      if (bill.status === 'paid' || bill.status === 'cancelled') {
        continue;
      }
      
      const outstandingAmount = bill.amount - bill.amountPaid;
      if (outstandingAmount <= 0) continue;
      
      // Convert to base currency
      const baseAmount = convertCurrency(
        outstandingAmount,
        bill.currency,
        this.config.baseCurrency,
        this.inputData.exchangeRates
      );
      
      // Determine optimal payment date
      const paymentDate = this.calculateOptimalPaymentDate(bill, config);
      
      // Only include if payment date is within forecast period
      if (paymentDate >= forecastDates[0] && paymentDate <= forecastDates[forecastDates.length - 1]) {
        // Check for early payment discount opportunity
        let finalAmount = baseAmount;
        let description = `Bill ${bill.billNumber} payment`;
        
        if (bill.vendorPaymentTerms?.earlyPaymentDiscount) {
          const earlyPaymentDate = addDays(bill.issueDate, bill.vendorPaymentTerms.earlyPaymentDays);
          const discountRate = bill.vendorPaymentTerms.earlyPaymentDiscount / 100;
          
          if (paymentDate <= earlyPaymentDate && discountRate >= config.earlyPaymentDiscountThreshold) {
            finalAmount = baseAmount * (1 - discountRate);
            description += ` (${(discountRate * 100).toFixed(1)}% early payment discount)`;
          }
        }
        
        apItems.push({
          date: paymentDate,
          type: 'ap_payment',
          amount: -finalAmount, // Negative because it's an outflow
          currency: this.config.baseCurrency,
          description,
          confidence: 0.95, // AP payments are generally more predictable
          sourceId: bill.id
        });
      }
    }
    
    return apItems;
  }
  
  /**
   * Process budget data for planned income and expenses
   */
  private async processBudgetData(forecastDates: Date[]): Promise<DailyCashFlowItem[]> {
    const budgetItems: DailyCashFlowItem[] = [];
    const config = this.config.budgetConfig;
    
    if (!config.includePlannedTransactions) {
      return budgetItems;
    }
    
    for (const budgetLine of this.inputData.budgetLines) {
      // Skip if budget line is not within forecast period
      if (budgetLine.endDate < forecastDates[0] || budgetLine.startDate > forecastDates[forecastDates.length - 1]) {
        continue;
      }
      
      // Convert to base currency
      const baseAmount = convertCurrency(
        budgetLine.budgetedAmount,
        budgetLine.currency,
        this.config.baseCurrency,
        this.inputData.exchangeRates
      );
      
      // Apply confidence factor
      const adjustedAmount = baseAmount * config.budgetConfidenceFactor;
      
      // Distribute amount across forecast period based on distribution method
      const distributedAmounts = this.distributeBudgetAmount(
        adjustedAmount,
        budgetLine,
        forecastDates,
        config.distributionMethod
      );
      
      // Create cash flow items
      const distributedEntries = Array.from(distributedAmounts.entries());
      for (const [date, amount] of distributedEntries) {
        if (Math.abs(amount) > 0.01) { // Only include non-zero amounts
          const flowType = budgetLine.category === 'income' ? 'budget_income' : 'budget_expense';
          const flowAmount = budgetLine.category === 'income' ? amount : -amount;
          
          budgetItems.push({
            date,
            type: flowType,
            amount: flowAmount,
            currency: this.config.baseCurrency,
            description: `${budgetLine.subcategory} (${budgetLine.category})`,
            confidence: config.budgetConfidenceFactor,
            sourceId: budgetLine.id
          });
        }
      }
    }
    
    return budgetItems;
  }
  
  /**
   * Process foreign exchange impacts
   */
  private async processForeignExchangeImpacts(forecastDates: Date[]): Promise<DailyCashFlowItem[]> {
    const fxItems: DailyCashFlowItem[] = [];
    const config = this.config.fxConfig;
    
    if (config.hedgingStrategy === 'none') {
      return fxItems; // No FX hedging, impacts will be reflected in natural conversion
    }
    
    // Calculate FX exposures by currency
    const exposures = this.calculateFXExposures();
    
    for (const [currency, exposure] of Object.entries(exposures)) {
      if (currency === this.config.baseCurrency || Math.abs(exposure) < 1000) {
        continue; // Skip base currency and small exposures
      }
      
      // Find current exchange rate
      const currentRate = this.inputData.exchangeRates.find(r => 
        r.fromCurrency === currency && r.toCurrency === this.config.baseCurrency
      );
      
      if (!currentRate) continue;
      
      // Calculate hedging cost based on strategy
      const hedgingCost = this.calculateHedgingCost(exposure, currency, config);
      
      if (hedgingCost > 0) {
        // Add hedging cost as an expense on first day
        fxItems.push({
          date: forecastDates[0],
          type: 'fx_impact',
          amount: -hedgingCost,
          currency: this.config.baseCurrency,
          description: `FX hedging cost for ${currency} exposure`,
          confidence: 0.9,
          sourceId: `fx_hedge_${currency}`
        });
      }
    }
    
    return fxItems;
  }
  
  /**
   * Calculate daily cash positions from all cash flow items
   */
  private calculateDailyPositions(
    forecastDates: Date[],
    cashFlowItems: DailyCashFlowItem[]
  ): DailyCashPosition[] {
    const positions: DailyCashPosition[] = [];
    
    // Calculate initial cash balance from bank accounts
    const initialBalance = this.inputData.bankAccounts
      .filter(account => account.isActive && account.currency === this.config.baseCurrency)
      .reduce((sum, account) => sum + account.currentBalance, 0);
    
    let runningBalance = initialBalance;
    
    for (let i = 0; i < forecastDates.length; i++) {
      const date = forecastDates[i];
      const dayItems = cashFlowItems.filter(item => 
        item.date.toDateString() === date.toDateString()
      );
      
      // Calculate daily flows by category
      const arCollections = dayItems
        .filter(item => item.type === 'ar_collection')
        .reduce((sum, item) => sum + item.amount, 0);
      
      const apPayments = dayItems
        .filter(item => item.type === 'ap_payment')
        .reduce((sum, item) => sum + item.amount, 0);
      
      const budgetIncome = dayItems
        .filter(item => item.type === 'budget_income')
        .reduce((sum, item) => sum + item.amount, 0);
      
      const budgetExpenses = dayItems
        .filter(item => item.type === 'budget_expense')
        .reduce((sum, item) => sum + item.amount, 0);
      
      const fxImpact = dayItems
        .filter(item => item.type === 'fx_impact')
        .reduce((sum, item) => sum + item.amount, 0);
      
      const totalInflows = arCollections + budgetIncome + (fxImpact > 0 ? fxImpact : 0);
      const totalOutflows = Math.abs(apPayments) + Math.abs(budgetExpenses) + (fxImpact < 0 ? Math.abs(fxImpact) : 0);
      const netCashFlow = totalInflows - totalOutflows;
      
      const openingBalance = runningBalance;
      const closingBalance = openingBalance + netCashFlow;
      runningBalance = closingBalance;
      
      // Calculate cash burn rate (7-day rolling average)
      const cashBurnRate = i >= 6 ? this.calculateCashBurnRate(positions.slice(-6)) : 0;
      
      // Calculate days of cash remaining
      const daysOfCashRemaining = cashBurnRate > 0 ? Math.max(0, closingBalance / cashBurnRate) : 999;
      
      // Calculate risk level
      const volatility = this.calculateVolatility(positions.slice(-7));
      const riskLevel = calculateRiskLevel(
        closingBalance,
        this.config.apPaymentConfig.cashReserveTarget,
        volatility
      );
      
      positions.push({
        date,
        openingBalance,
        totalInflows,
        totalOutflows,
        netCashFlow,
        closingBalance,
        currency: this.config.baseCurrency,
        arCollections,
        apPayments,
        budgetIncome,
        budgetExpenses,
        fxImpact,
        confidenceInterval: [closingBalance * 0.85, closingBalance * 1.15], // Simplified confidence band
        riskLevel,
        daysOfCashRemaining,
        cashBurnRate
      });
    }
    
    return positions;
  }
  
  /**
   * Calculate weekly cash flow summaries
   */
  private calculateWeeklyPositions(dailyPositions: DailyCashPosition[]): WeeklyCashFlowSummary[] {
    const weeklyPositions: WeeklyCashFlowSummary[] = [];
    
    for (let weekNum = 0; weekNum < this.config.forecastWeeks; weekNum++) {
      const startIdx = weekNum * 7;
      const endIdx = Math.min(startIdx + 7, dailyPositions.length);
      const weekPositions = dailyPositions.slice(startIdx, endIdx);
      
      if (weekPositions.length === 0) continue;
      
      const firstDay = weekPositions[0];
      const lastDay = weekPositions[weekPositions.length - 1];
      
      const totalInflows = weekPositions.reduce((sum, pos) => sum + pos.totalInflows, 0);
      const totalOutflows = weekPositions.reduce((sum, pos) => sum + pos.totalOutflows, 0);
      const arCollections = weekPositions.reduce((sum, pos) => sum + pos.arCollections, 0);
      const apPayments = weekPositions.reduce((sum, pos) => sum + Math.abs(pos.apPayments), 0);
      const budgetIncome = weekPositions.reduce((sum, pos) => sum + pos.budgetIncome, 0);
      const budgetExpenses = weekPositions.reduce((sum, pos) => sum + Math.abs(pos.budgetExpenses), 0);
      
      const balances = weekPositions.map(pos => pos.closingBalance);
      const minDailyBalance = Math.min(...balances);
      const maxDailyBalance = Math.max(...balances);
      const averageDailyBalance = balances.reduce((sum, bal) => sum + bal, 0) / balances.length;
      
      // Calculate weekly volatility
      const meanBalance = averageDailyBalance;
      const variance = balances.reduce((sum, bal) => sum + Math.pow(bal - meanBalance, 2), 0) / balances.length;
      const volatility = Math.sqrt(variance) / meanBalance;
      
      // Calculate weekly risk level
      const riskLevel = calculateRiskLevel(
        averageDailyBalance,
        this.config.apPaymentConfig.cashReserveTarget,
        volatility
      );
      
      weeklyPositions.push({
        weekNumber: weekNum + 1,
        startDate: firstDay.date,
        endDate: lastDay.date,
        openingBalance: firstDay.openingBalance,
        closingBalance: lastDay.closingBalance,
        netCashFlow: totalInflows - totalOutflows,
        averageDailyBalance,
        totalInflows,
        arCollections,
        budgetIncome,
        totalOutflows,
        apPayments,
        budgetExpenses,
        minDailyBalance,
        maxDailyBalance,
        volatility,
        riskLevel
      });
    }
    
    return weeklyPositions;
  }
  
  /**
   * Calculate comprehensive forecast metrics
   */
  private calculateForecastMetrics(
    dailyPositions: DailyCashPosition[],
    cashFlowItems: DailyCashFlowItem[]
  ): ForecastMetrics {
    const balances = dailyPositions.map(pos => pos.closingBalance);
    const averageCashBalance = balances.reduce((sum, bal) => sum + bal, 0) / balances.length;
    const minCashBalance = Math.min(...balances);
    const maxCashBalance = Math.max(...balances);
    
    // Calculate cash runway
    const avgDailyBurn = dailyPositions
      .slice(-7)
      .reduce((sum, pos) => sum + Math.abs(pos.totalOutflows - pos.totalInflows), 0) / 7;
    const cashRunway = avgDailyBurn > 0 ? Math.max(0, averageCashBalance / avgDailyBurn) : 999;
    
    // Calculate DSO (Days Sales Outstanding)
    const totalReceivables = this.inputData.invoices
      .filter(inv => inv.status === 'pending' || inv.status === 'overdue')
      .reduce((sum, inv) => sum + (inv.amount - inv.amountPaid), 0);
    const dailySales = cashFlowItems
      .filter(item => item.type === 'ar_collection')
      .reduce((sum, item) => sum + item.amount, 0) / this.config.forecastWeeks / 7;
    const dso = dailySales > 0 ? totalReceivables / dailySales : 0;
    
    // Calculate DPO (Days Payable Outstanding)
    const totalPayables = this.inputData.bills
      .filter(bill => bill.status === 'pending' || bill.status === 'overdue')
      .reduce((sum, bill) => sum + (bill.amount - bill.amountPaid), 0);
    const dailyPayments = Math.abs(cashFlowItems
      .filter(item => item.type === 'ap_payment')
      .reduce((sum, item) => sum + item.amount, 0)) / this.config.forecastWeeks / 7;
    const dpo = dailyPayments > 0 ? totalPayables / dailyPayments : 0;
    
    // Cash Conversion Cycle
    const ccc = dso - dpo;
    
    // Calculate cash at risk (simplified VaR)
    const sortedBalances = [...balances].sort((a, b) => a - b);
    const varIndex = Math.floor(sortedBalances.length * (1 - this.config.riskConfig.confidenceInterval));
    const cashAtRisk = averageCashBalance - sortedBalances[varIndex];
    
    // Calculate collection efficiency
    const onTimeCollections = cashFlowItems
      .filter(item => item.type === 'ar_collection' && item.confidence && item.confidence > 0.8)
      .reduce((sum, item) => sum + item.amount, 0);
    const totalCollections = cashFlowItems
      .filter(item => item.type === 'ar_collection')
      .reduce((sum, item) => sum + item.amount, 0);
    const collectionEfficiency = totalCollections > 0 ? onTimeCollections / totalCollections : 0;
    
    // Calculate FX exposure
    const fxExposure = Object.values(this.calculateFXExposures())
      .reduce((sum, exposure) => sum + Math.abs(exposure), 0);
    
    const fxImpact = cashFlowItems
      .filter(item => item.type === 'fx_impact')
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);
    
    return {
      averageCashBalance,
      minCashBalance,
      maxCashBalance,
      cashRunway,
      dso,
      dpo,
      ccc,
      cashAtRisk,
      stressTestResult: minCashBalance,
      collectionEfficiency,
      paymentOptimization: 0, // TODO: Calculate savings from payment optimization
      fxExposure,
      fxImpact
    };
  }
  
  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    dailyPositions: DailyCashPosition[],
    metrics: ForecastMetrics
  ): CashFlowRecommendation[] {
    const recommendations: CashFlowRecommendation[] = [];
    
    // Cash runway recommendation
    if (metrics.cashRunway < 30) {
      recommendations.push({
        type: 'financing',
        priority: 'high',
        title: 'Critical Cash Flow Alert',
        description: `Cash runway is only ${Math.round(metrics.cashRunway)} days. Immediate action required to secure additional funding or accelerate collections.`,
        impact: metrics.minCashBalance,
        effort: 'high',
        timeline: 'Immediate (1-7 days)',
        risks: ['Business continuity risk', 'Vendor payment delays', 'Credit rating impact'],
        actionItems: [
          { task: 'Contact bank for emergency credit line', dueDate: addDays(new Date(), 2) },
          { task: 'Accelerate collection activities', dueDate: addDays(new Date(), 1) },
          { task: 'Defer non-essential payments', dueDate: addDays(new Date(), 1) }
        ]
      });
    } else if (metrics.cashRunway < 60) {
      recommendations.push({
        type: 'financing',
        priority: 'medium',
        title: 'Cash Flow Planning Required',
        description: `Cash runway is ${Math.round(metrics.cashRunway)} days. Consider securing additional financing or improving working capital.`,
        impact: metrics.averageCashBalance * 0.2,
        effort: 'medium',
        timeline: '2-4 weeks',
        risks: ['Potential cash constraints', 'Limited operational flexibility'],
        actionItems: [
          { task: 'Review financing options', dueDate: addDays(new Date(), 14) },
          { task: 'Optimize payment terms', dueDate: addDays(new Date(), 7) }
        ]
      });
    }
    
    // Collection efficiency recommendation
    if (metrics.collectionEfficiency < 0.7) {
      recommendations.push({
        type: 'collection',
        priority: 'high',
        title: 'Improve Collection Efficiency',
        description: `Collection efficiency is ${(metrics.collectionEfficiency * 100).toFixed(1)}%. Focus on accelerating receivables collection.`,
        impact: metrics.dso * 1000, // Estimated impact based on DSO
        effort: 'medium',
        timeline: '2-6 weeks',
        risks: ['Customer relationship strain', 'Administrative overhead'],
        actionItems: [
          { task: 'Implement automated reminder system', dueDate: addDays(new Date(), 14) },
          { task: 'Review payment terms with slow-paying customers', dueDate: addDays(new Date(), 7) },
          { task: 'Consider factoring for large receivables', dueDate: addDays(new Date(), 21) }
        ]
      });
    }
    
    // DSO optimization
    if (metrics.dso > 45) {
      recommendations.push({
        type: 'working_capital',
        priority: 'medium',
        title: 'Reduce Days Sales Outstanding',
        description: `DSO is ${Math.round(metrics.dso)} days. Consider offering early payment discounts or tightening credit terms.`,
        impact: metrics.dso * 500, // Estimated daily sales impact
        effort: 'low',
        timeline: '1-4 weeks',
        risks: ['Reduced sales', 'Customer dissatisfaction'],
        actionItems: [
          { task: 'Implement 2% 10 net 30 terms', dueDate: addDays(new Date(), 7) },
          { task: 'Review customer credit limits', dueDate: addDays(new Date(), 14) }
        ]
      });
    }
    
    // FX hedging recommendation
    if (metrics.fxExposure > metrics.averageCashBalance * 0.1) {
      recommendations.push({
        type: 'fx_hedge',
        priority: 'medium',
        title: 'Consider FX Hedging',
        description: `FX exposure is ${(metrics.fxExposure / metrics.averageCashBalance * 100).toFixed(1)}% of average cash balance. Consider hedging strategy.`,
        impact: metrics.fxImpact,
        effort: 'medium',
        timeline: '1-2 weeks',
        risks: ['FX rate volatility', 'Hedging costs'],
        actionItems: [
          { task: 'Evaluate forward contract options', dueDate: addDays(new Date(), 14) },
          { task: 'Review natural hedging opportunities', dueDate: addDays(new Date(), 7) }
        ]
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
  
  // =============================================
  // HELPER METHODS
  // =============================================
  
  /**
   * Prioritize bills for payment optimization
   */
  private prioritizeBills(bills: ForecastBill[]): ForecastBill[] {
    return bills.sort((a, b) => {
      // First priority: Early payment discounts
      const aDiscount = a.vendorPaymentTerms?.earlyPaymentDiscount || 0;
      const bDiscount = b.vendorPaymentTerms?.earlyPaymentDiscount || 0;
      
      if (aDiscount !== bDiscount) {
        return bDiscount - aDiscount; // Higher discount first
      }
      
      // Second priority: Due date
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }
  
  /**
   * Calculate optimal payment date for a bill
   */
  private calculateOptimalPaymentDate(bill: ForecastBill, config: typeof this.config.apPaymentConfig): Date {
    let optimalDate = bill.dueDate;
    
    // Apply payment delay factor
    if (config.paymentDelayFactor !== 1.0) {
      const delayDays = (config.paymentDelayFactor - 1.0) * bill.paymentTerms;
      optimalDate = addDays(optimalDate, Math.round(delayDays));
    }
    
    // Consider early payment discount
    if (bill.vendorPaymentTerms?.earlyPaymentDiscount) {
      const discountRate = bill.vendorPaymentTerms.earlyPaymentDiscount / 100;
      const earlyPaymentDate = addDays(bill.issueDate, bill.vendorPaymentTerms.earlyPaymentDays);
      
      if (discountRate >= config.earlyPaymentDiscountThreshold) {
        optimalDate = earlyPaymentDate;
      }
    }
    
    return optimalDate;
  }
  
  /**
   * Distribute budget amount across forecast period
   */
  private distributeBudgetAmount(
    totalAmount: number,
    budgetLine: ForecastBudgetLine,
    forecastDates: Date[],
    distributionMethod: 'linear' | 'seasonal' | 'historical'
  ): Map<Date, number> {
    const distribution = new Map<Date, number>();
    
    // Filter dates within budget period
    const relevantDates = forecastDates.filter(date => 
      date >= budgetLine.startDate && date <= budgetLine.endDate
    );
    
    if (relevantDates.length === 0) {
      return distribution;
    }
    
    switch (budgetLine.period) {
      case 'daily':
        relevantDates.forEach(date => {
          distribution.set(date, totalAmount);
        });
        break;
        
      case 'weekly':
        // Distribute on first day of each week
        const weekStarts = this.getWeekStartDates(relevantDates);
        const weeklyAmount = totalAmount / weekStarts.length;
        weekStarts.forEach(date => {
          distribution.set(date, weeklyAmount);
        });
        break;
        
      case 'monthly':
        // Distribute on first day of each month
        const monthStarts = this.getMonthStartDates(relevantDates);
        const monthlyAmount = totalAmount / monthStarts.length;
        monthStarts.forEach(date => {
          distribution.set(date, monthlyAmount);
        });
        break;
        
      case 'quarterly':
        // Distribute on first day of each quarter
        const quarterStarts = this.getQuarterStartDates(relevantDates);
        const quarterlyAmount = totalAmount / quarterStarts.length;
        quarterStarts.forEach(date => {
          distribution.set(date, quarterlyAmount);
        });
        break;
        
      case 'yearly':
        // Distribute on first date
        distribution.set(relevantDates[0], totalAmount);
        break;
        
      default:
        // Linear distribution
        const dailyAmount = totalAmount / relevantDates.length;
        relevantDates.forEach(date => {
          distribution.set(date, dailyAmount);
        });
    }
    
    return distribution;
  }
  
  /**
   * Calculate FX exposures by currency
   */
  private calculateFXExposures(): Record<CurrencyCode, number> {
    const exposures: Record<CurrencyCode, number> = {};
    
    // Calculate AR exposure
    this.inputData.invoices.forEach(invoice => {
      if (invoice.currency !== this.config.baseCurrency && invoice.status === 'pending') {
        const outstanding = invoice.amount - invoice.amountPaid;
        exposures[invoice.currency] = (exposures[invoice.currency] || 0) + outstanding;
      }
    });
    
    // Calculate AP exposure (negative)
    this.inputData.bills.forEach(bill => {
      if (bill.currency !== this.config.baseCurrency && bill.status === 'pending') {
        const outstanding = bill.amount - bill.amountPaid;
        exposures[bill.currency] = (exposures[bill.currency] || 0) - outstanding;
      }
    });
    
    return exposures;
  }
  
  /**
   * Calculate hedging cost based on strategy
   */
  private calculateHedgingCost(
    exposure: number,
    currency: CurrencyCode,
    config: typeof this.config.fxConfig
  ): number {
    const hedgeAmount = Math.abs(exposure) * config.hedgeRatio;
    
    switch (config.hedgingStrategy) {
      case 'forward':
        // Forward contract cost (typically 0.1-0.5% of notional)
        return hedgeAmount * 0.002;
        
      case 'options':
        // Options premium (typically 1-3% of notional)
        return hedgeAmount * 0.02;
        
      default:
        return 0;
    }
  }
  
  /**
   * Calculate cash burn rate from recent positions
   */
  private calculateCashBurnRate(recentPositions: DailyCashPosition[]): number {
    if (recentPositions.length < 2) return 0;
    
    const netFlows = recentPositions.map(pos => pos.totalOutflows - pos.totalInflows);
    const avgBurn = netFlows.reduce((sum, flow) => sum + Math.max(0, flow), 0) / netFlows.length;
    
    return avgBurn;
  }
  
  /**
   * Calculate volatility from recent positions
   */
  private calculateVolatility(recentPositions: DailyCashPosition[]): number {
    if (recentPositions.length < 2) return 0;
    
    const balances = recentPositions.map(pos => pos.closingBalance);
    const mean = balances.reduce((sum, bal) => sum + bal, 0) / balances.length;
    const variance = balances.reduce((sum, bal) => sum + Math.pow(bal - mean, 2), 0) / balances.length;
    
    return Math.sqrt(variance) / mean;
  }
  
  /**
   * Generate confidence bands using Monte Carlo simulation
   */
  private async generateConfidenceBands(forecastDates: Date[]): Promise<Array<{
    date: Date;
    confidence: number;
    lowerBound: number;
    upperBound: number;
  }>> {
    // Simplified confidence bands - in a full implementation, this would run Monte Carlo simulations
    const confidenceBands: Array<{
      date: Date;
      confidence: number;
      lowerBound: number;
      upperBound: number;
    }> = [];
    
    const confidence = this.config.riskConfig.confidenceInterval;
    
    // For now, return simplified bands
    forecastDates.forEach(date => {
      confidenceBands.push({
        date,
        confidence,
        lowerBound: 0, // Placeholder
        upperBound: 0  // Placeholder
      });
    });
    
    return confidenceBands;
  }
  
  /**
   * Run stress tests
   */
  private async runStressTests(dailyPositions: DailyCashPosition[]): Promise<Array<{
    scenario: string;
    description: string;
    impact: number;
    probability: number;
  }>> {
    const stressTests = [
      {
        scenario: 'Collection Delay',
        description: '50% of receivables delayed by 30 days',
        impact: -dailyPositions[dailyPositions.length - 1].closingBalance * 0.3,
        probability: 0.15
      },
      {
        scenario: 'Major Customer Default',
        description: 'Largest customer defaults on payment',
        impact: -dailyPositions[dailyPositions.length - 1].closingBalance * 0.4,
        probability: 0.05
      },
      {
        scenario: 'Economic Downturn',
        description: 'General economic slowdown affects all collections',
        impact: -dailyPositions[dailyPositions.length - 1].closingBalance * 0.25,
        probability: 0.20
      }
    ];
    
    return stressTests;
  }
  
  /**
   * Get week start dates from date range
   */
  private getWeekStartDates(dates: Date[]): Date[] {
    const weekStarts: Date[] = [];
    const seen = new Set<string>();
    
    dates.forEach(date => {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Get Sunday
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!seen.has(weekKey)) {
        weekStarts.push(weekStart);
        seen.add(weekKey);
      }
    });
    
    return weekStarts.sort((a, b) => a.getTime() - b.getTime());
  }
  
  /**
   * Get month start dates from date range
   */
  private getMonthStartDates(dates: Date[]): Date[] {
    const monthStarts: Date[] = [];
    const seen = new Set<string>();
    
    dates.forEach(date => {
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthKey = `${monthStart.getFullYear()}-${monthStart.getMonth()}`;
      
      if (!seen.has(monthKey)) {
        monthStarts.push(monthStart);
        seen.add(monthKey);
      }
    });
    
    return monthStarts.sort((a, b) => a.getTime() - b.getTime());
  }
  
  /**
   * Get quarter start dates from date range
   */
  private getQuarterStartDates(dates: Date[]): Date[] {
    const quarterStarts: Date[] = [];
    const seen = new Set<string>();
    
    dates.forEach(date => {
      const quarter = Math.floor(date.getMonth() / 3);
      const quarterStart = new Date(date.getFullYear(), quarter * 3, 1);
      const quarterKey = `${quarterStart.getFullYear()}-Q${quarter + 1}`;
      
      if (!seen.has(quarterKey)) {
        quarterStarts.push(quarterStart);
        seen.add(quarterKey);
      }
    });
    
    return quarterStarts.sort((a, b) => a.getTime() - b.getTime());
  }
}