/**
 * Credit Scoring Service
 * Implements Qashivo's risk assessment algorithm with explainable scoring
 */

export interface CreditSignals {
  companyAgeMonths: number;
  filingsOnTime: boolean;
  adverseCount: number;
  directorChanges12m: number;
  sectorRisk: 'low' | 'medium' | 'high';
  bureauScore: number; // 0-100
  dbtDays: number; // Days beyond terms
  internalLateCount12m: number;
}

export interface TradingProfile {
  estimatedMonthlySales: number;
  avgInvoiceValue: number;
  peakExposure: number;
  paymentMethodPref: 'bank_transfer' | 'card' | 'direct_debit' | 'other';
  buyerType: 'end_customer' | 'reseller' | 'agency' | 'other';
}

export interface RiskScore {
  value: number; // 0-100
  band: 'A' | 'B' | 'C' | 'D' | 'E';
  explain: string[]; // Top 3 drivers
}

export interface CreditRecommendation {
  score: RiskScore;
  creditLimit: number;
  paymentTerms: string; // e.g., "NET30", "NET14", "Due on receipt"
  conditions: string[];
}

/**
 * Calculate risk score based on credit signals
 * Score = sum(weights × features), capped 0–100
 */
export function calculateRiskScore(signals: CreditSignals): RiskScore {
  let score = 0;
  const explanations: Array<{ text: string; points: number }> = [];

  // Company age: ≥3y +10; 1–3y +4; <1y 0
  if (signals.companyAgeMonths >= 36) {
    score += 10;
    explanations.push({ text: 'Established company (3+ years)', points: 10 });
  } else if (signals.companyAgeMonths >= 12) {
    score += 4;
    explanations.push({ text: 'Growing company (1-3 years)', points: 4 });
  } else {
    explanations.push({ text: 'Young company (<1 year)', points: 0 });
  }

  // Filings on time: Yes +8; No -6
  if (signals.filingsOnTime) {
    score += 8;
    explanations.push({ text: 'All filings on time', points: 8 });
  } else {
    score -= 6;
    explanations.push({ text: 'Late filings', points: -6 });
  }

  // Legal/adverse (CCJs): None +8; Minor (<=1, paid) 0; Active -20
  if (signals.adverseCount === 0) {
    score += 8;
    explanations.push({ text: 'No adverse filings', points: 8 });
  } else if (signals.adverseCount === 1) {
    explanations.push({ text: 'Minor adverse filing', points: 0 });
  } else {
    score -= 20;
    explanations.push({ text: 'Active adverse filings', points: -20 });
  }

  // Bureau score (0–100): Normalize to 0–30 points
  const bureauPoints = Math.round((signals.bureauScore / 100) * 30);
  score += bureauPoints;
  if (bureauPoints > 20) {
    explanations.push({ text: `Strong bureau score (${signals.bureauScore})`, points: bureauPoints });
  } else if (bureauPoints > 10) {
    explanations.push({ text: `Moderate bureau score (${signals.bureauScore})`, points: bureauPoints });
  } else {
    explanations.push({ text: `Low bureau score (${signals.bureauScore})`, points: bureauPoints });
  }

  // Director churn (12m): 0–1 changes +4; ≥2 changes -6
  if (signals.directorChanges12m <= 1) {
    score += 4;
    explanations.push({ text: 'Stable management', points: 4 });
  } else {
    score -= 6;
    explanations.push({ text: 'High director turnover', points: -6 });
  }

  // Sector risk (benchmark PD): Low +6; Medium 0; High -8
  if (signals.sectorRisk === 'low') {
    score += 6;
    explanations.push({ text: 'Low-risk sector', points: 6 });
  } else if (signals.sectorRisk === 'high') {
    score -= 8;
    explanations.push({ text: 'High-risk sector', points: -8 });
  } else {
    explanations.push({ text: 'Medium-risk sector', points: 0 });
  }

  // Trade payment behaviour (DBT): Early/On time +10; 1–10 DBT +4; >10 DBT -8
  if (signals.dbtDays <= 0) {
    score += 10;
    explanations.push({ text: 'Excellent payment history', points: 10 });
  } else if (signals.dbtDays <= 10) {
    score += 4;
    explanations.push({ text: 'Good payment timing', points: 4 });
  } else {
    score -= 8;
    explanations.push({ text: `Late payments (avg ${signals.dbtDays} days)`, points: -8 });
  }

  // Internal payment history: None 0; 1–2 late -4; >2 late -10
  if (signals.internalLateCount12m === 0) {
    score += 0;
  } else if (signals.internalLateCount12m <= 2) {
    score -= 4;
    explanations.push({ text: '1-2 late payments', points: -4 });
  } else {
    score -= 10;
    explanations.push({ text: 'Multiple late payments', points: -10 });
  }

  // Cap score at 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine risk band
  let band: 'A' | 'B' | 'C' | 'D' | 'E';
  if (score >= 80) band = 'A';
  else if (score >= 65) band = 'B';
  else if (score >= 50) band = 'C';
  else if (score >= 35) band = 'D';
  else band = 'E';

  // Get top 3 explanations by absolute points value
  const topExplanations = explanations
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 3)
    .map(e => e.text);

  return {
    value: score,
    band,
    explain: topExplanations,
  };
}

/**
 * Calculate recommended credit limit based on trading profile and risk band
 */
export function calculateCreditLimit(
  tradingProfile: TradingProfile,
  riskBand: 'A' | 'B' | 'C' | 'D' | 'E',
  policyCap: number = 100000
): number {
  // BaseLimit = min(1.5 × AvgMonthlySales, PolicyCap)
  const baseLimit = Math.min(tradingProfile.estimatedMonthlySales * 1.5, policyCap);

  // Multiplier by band: A 1.2×, B 1.0×, C 0.6×, D 0.3×, E 0×
  const multipliers: Record<string, number> = {
    A: 1.2,
    B: 1.0,
    C: 0.6,
    D: 0.3,
    E: 0,
  };

  const multiplier = multipliers[riskBand];
  const finalLimit = Math.round((baseLimit * multiplier) / 100) * 100; // Round to nearest 100

  return finalLimit;
}

/**
 * Determine payment terms based on risk band
 */
export function getPaymentTerms(riskBand: 'A' | 'B' | 'C' | 'D' | 'E'): string {
  const termsMap: Record<string, string> = {
    A: 'NET30',
    B: 'NET30', // Could be NET14-30
    C: 'NET14',
    D: 'NET7',
    E: 'Prepaid',
  };

  return termsMap[riskBand];
}

/**
 * Determine conditions based on band and trading profile
 */
export function getConditions(
  riskBand: 'A' | 'B' | 'C' | 'D' | 'E',
  tradingProfile: TradingProfile,
  signals: CreditSignals
): string[] {
  const conditions: string[] = [];

  // Band C and AvgInvoice > £10k → 25% deposit
  if (riskBand === 'C' && tradingProfile.avgInvoiceValue > 10000) {
    conditions.push('25% deposit required');
  }

  // Band D and DBT > 15 → DD required + limit ≤ £2k
  if (riskBand === 'D' && signals.dbtDays > 15) {
    conditions.push('Direct Debit mandate required');
  }

  // Any legal adverse open → manual review
  if (signals.adverseCount > 1) {
    conditions.push('Manual review required');
  }

  // Band E
  if (riskBand === 'E') {
    conditions.push('Prepayment required for all orders');
  }

  if (conditions.length === 0) {
    conditions.push('None');
  }

  return conditions;
}

/**
 * Generate complete credit recommendation
 */
export function generateCreditRecommendation(
  signals: CreditSignals,
  tradingProfile: TradingProfile,
  policyCap: number = 100000
): CreditRecommendation {
  const score = calculateRiskScore(signals);
  const creditLimit = calculateCreditLimit(tradingProfile, score.band, policyCap);
  const paymentTerms = getPaymentTerms(score.band);
  const conditions = getConditions(score.band, tradingProfile, signals);

  return {
    score,
    creditLimit,
    paymentTerms,
    conditions,
  };
}
