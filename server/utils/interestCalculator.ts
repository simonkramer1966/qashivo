interface InterestCalculationParams {
  principalAmount: number;
  dueDate: Date;
  currentDate?: Date;
  boeBaseRate: number; // Bank of England base rate as percentage (e.g., 5.00 for 5%)
  interestMarkup: number; // Additional markup as percentage (e.g., 8.00 for 8%)
  gracePeriod: number; // Days before interest starts accruing
}

interface InterestCalculationResult {
  principalAmount: number;
  daysOverdue: number;
  daysAccruing: number; // Days actually accruing interest (after grace period)
  annualRate: number; // Combined rate (BoE + markup)
  dailyRate: number;
  interestAmount: number;
  totalAmountDue: number;
  gracePeriodRemaining: number; // Days remaining in grace period (0 if past)
}

export function calculateLatePaymentInterest(params: InterestCalculationParams): InterestCalculationResult {
  const {
    principalAmount,
    dueDate,
    currentDate = new Date(),
    boeBaseRate,
    interestMarkup,
    gracePeriod
  } = params;

  // Calculate days overdue
  const daysOverdue = Math.max(0, Math.floor((currentDate.getTime() - dueDate.getTime()) / (1000 * 3600 * 24)));
  
  // Calculate grace period remaining
  const gracePeriodRemaining = Math.max(0, gracePeriod - daysOverdue);
  
  // Calculate days actually accruing interest (after grace period)
  const daysAccruing = Math.max(0, daysOverdue - gracePeriod);
  
  // Calculate combined annual rate (BoE base rate + markup)
  const annualRate = boeBaseRate + interestMarkup;
  
  // Calculate daily interest rate (annual rate / 365)
  const dailyRate = annualRate / 365;
  
  // Calculate interest amount: Principal × Daily Rate × Days Accruing
  const interestAmount = daysAccruing > 0 
    ? (principalAmount * (dailyRate / 100) * daysAccruing)
    : 0;
  
  // Total amount due (principal + interest)
  const totalAmountDue = principalAmount + interestAmount;
  
  return {
    principalAmount,
    daysOverdue,
    daysAccruing,
    annualRate,
    dailyRate,
    interestAmount: Math.round(interestAmount * 100) / 100, // Round to 2 decimal places
    totalAmountDue: Math.round(totalAmountDue * 100) / 100,
    gracePeriodRemaining
  };
}

export function formatInterestBreakdown(result: InterestCalculationResult): string {
  if (result.daysOverdue === 0) {
    return "Invoice not yet overdue";
  }
  
  if (result.gracePeriodRemaining > 0) {
    return `${result.daysOverdue} days overdue (${result.gracePeriodRemaining} days remaining in grace period)`;
  }
  
  if (result.daysAccruing === 0) {
    return "Grace period just ended - no interest accrued yet";
  }
  
  return [
    `${result.daysOverdue} days overdue`,
    `${result.daysAccruing} days accruing interest`,
    `Annual rate: ${result.annualRate.toFixed(2)}%`,
    `Daily rate: ${result.dailyRate.toFixed(4)}%`,
    `Interest: £${result.interestAmount.toFixed(2)}`
  ].join(' | ');
}
