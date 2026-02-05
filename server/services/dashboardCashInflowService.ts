import { db } from '../db';
import { invoices, contacts, actions, promisesToPay, forecastPoints, paymentPromises, paymentPlans, paymentPlanInvoices, outcomes } from '@shared/schema';
import { eq, and, or, inArray, desc, gte, sql } from 'drizzle-orm';

// Outcome types that affect forecasts
type OutcomeExtracted = {
  promiseToPayDate?: string;
  promiseToPayAmount?: number;
  confirmedBy?: string;
  paymentPlanSchedule?: Array<{ date: string; amount: number }>;
  paymentProcessWindow?: { earliest?: string; latest?: string };
  disputeCategory?: 'PRICING' | 'DELIVERY' | 'QUALITY' | 'OTHER';
  docsRequested?: Array<'INVOICE_COPY' | 'STATEMENT' | 'REMITTANCE' | 'PO'>;
  oooUntil?: string;
  freeTextNotes?: string;
};

export type CashInflowPoint = {
  date: string;
  expectedAmount: number;
  confidenceWeightedAmount: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  invoiceCount: number;
};

export type CashInflowResponse = {
  rangeDays: number;
  bucket: "day" | "week";
  points: CashInflowPoint[];
  asOf: string;
};

interface InvoiceForecast {
  invoiceId: string;
  remaining: number;
  expectedDate: Date;
  confidence: number;
  reason: string;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function adjustConfidenceByRiskBand(baseConfidence: number, riskBand: string | null): number {
  let adjustment = 0;
  switch (riskBand?.toUpperCase()) {
    case 'A':
      adjustment = 0.10;
      break;
    case 'B':
      adjustment = 0.05;
      break;
    case 'C':
      adjustment = 0.00;
      break;
    case 'D':
      adjustment = -0.10;
      break;
    case 'E':
      adjustment = -0.15;
      break;
    default:
      adjustment = 0;
  }
  
  const adjusted = baseConfidence + adjustment;
  return Math.max(0.10, Math.min(0.95, adjusted));
}

export async function computeCashInflow(
  tenantId: string,
  rangeDays: number = 60,
  bucket: "day" | "week" = "week"
): Promise<CashInflowResponse> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const openInvoices = await db
    .select({
      invoice: invoices,
      contact: contacts,
    })
    .from(invoices)
    .leftJoin(contacts, eq(invoices.contactId, contacts.id))
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        or(
          eq(invoices.status, 'pending'),
          eq(invoices.status, 'overdue')
        )
      )
    );

  const invoiceIds = openInvoices.map(r => r.invoice.id);
  const contactIds = Array.from(new Set(openInvoices.map(r => r.invoice.contactId)));
  
  // Consolidated PTP lookup from BOTH tables
  // promisesToPay: active statuses are 'pending', 'active'
  // paymentPromises: active status is 'open'
  let latestPtpByInvoice: Map<string, { promisedDate: Date; status: string; createdAt: Date; source: string }> = new Map();
  
  if (invoiceIds.length > 0) {
    // Query promisesToPay table (older table)
    const ptpRecords = await db
      .select()
      .from(promisesToPay)
      .where(
        and(
          eq(promisesToPay.tenantId, tenantId),
          inArray(promisesToPay.invoiceId, invoiceIds)
        )
      )
      .orderBy(desc(promisesToPay.createdAt));
    
    for (const ptp of ptpRecords) {
      const existing = latestPtpByInvoice.get(ptp.invoiceId);
      const createdAt = ptp.createdAt ? new Date(ptp.createdAt) : new Date(0);
      if (!existing || createdAt > existing.createdAt) {
        latestPtpByInvoice.set(ptp.invoiceId, {
          promisedDate: new Date(ptp.promisedDate),
          status: ptp.status,
          createdAt,
          source: 'promisesToPay'
        });
      }
    }
    
    // Query paymentPromises table (newer table - where drawer PTPs go)
    const paymentPromiseRecords = await db
      .select()
      .from(paymentPromises)
      .where(
        and(
          eq(paymentPromises.tenantId, tenantId),
          inArray(paymentPromises.invoiceId, invoiceIds)
        )
      )
      .orderBy(desc(paymentPromises.createdAt));
    
    for (const ptp of paymentPromiseRecords) {
      const existing = latestPtpByInvoice.get(ptp.invoiceId);
      const createdAt = ptp.createdAt ? new Date(ptp.createdAt) : new Date(0);
      // Use the most recent PTP from either table
      if (!existing || createdAt > existing.createdAt) {
        // Map 'open' status to 'pending' for consistent handling
        const normalizedStatus = ptp.status === 'open' ? 'pending' : ptp.status;
        latestPtpByInvoice.set(ptp.invoiceId, {
          promisedDate: new Date(ptp.promisedDate),
          status: normalizedStatus,
          createdAt,
          source: 'paymentPromises'
        });
      }
    }
  }
  
  // Query payment_plans for multi-invoice payment plans
  let paymentPlanByInvoice: Map<string, { planStartDate: Date; status: string; numberOfPayments: number; frequency: string }> = new Map();
  if (invoiceIds.length > 0) {
    // Get active payment plans that include any of our invoices
    const planInvoiceLinks = await db
      .select({
        plan: paymentPlans,
        invoiceId: paymentPlanInvoices.invoiceId
      })
      .from(paymentPlanInvoices)
      .innerJoin(paymentPlans, eq(paymentPlanInvoices.paymentPlanId, paymentPlans.id))
      .where(
        and(
          eq(paymentPlans.tenantId, tenantId),
          eq(paymentPlans.status, 'active'),
          inArray(paymentPlanInvoices.invoiceId, invoiceIds)
        )
      );
    
    for (const link of planInvoiceLinks) {
      if (!paymentPlanByInvoice.has(link.invoiceId)) {
        paymentPlanByInvoice.set(link.invoiceId, {
          planStartDate: new Date(link.plan.planStartDate),
          status: link.plan.status,
          numberOfPayments: link.plan.numberOfPayments,
          frequency: link.plan.paymentFrequency
        });
      }
    }
  }

  // Query unified outcomes table - PRIMARY source of truth for forecast-affecting signals
  // This includes PTP, payment plans, disputes, and other intent outcomes from ALL channels
  let latestOutcomeByInvoice: Map<string, { 
    type: string; 
    extracted: OutcomeExtracted; 
    confidence: number;
    confidenceBand: string;
    createdAt: Date;
  }> = new Map();
  
  // Also check for debtor-level outcomes (outcomes linked to contact, not specific invoice)
  let latestOutcomeByDebtor: Map<string, { 
    type: string; 
    extracted: OutcomeExtracted; 
    confidence: number;
    confidenceBand: string;
    createdAt: Date;
  }> = new Map();
  
  if (invoiceIds.length > 0 || contactIds.length > 0) {
    // Get outcomes for these invoices or contacts
    // Build where conditions safely - avoid undefined in or()
    const orConditions = [];
    if (invoiceIds.length > 0) {
      orConditions.push(inArray(outcomes.invoiceId, invoiceIds));
    }
    if (contactIds.length > 0) {
      orConditions.push(inArray(outcomes.debtorId, contactIds));
    }
    
    const outcomeRecords = orConditions.length > 0 
      ? await db
          .select()
          .from(outcomes)
          .where(
            and(
              eq(outcomes.tenantId, tenantId),
              or(...orConditions)
            )
          )
          .orderBy(desc(outcomes.createdAt))
      : [];
    
    for (const outcome of outcomeRecords) {
      const createdAt = outcome.createdAt ? new Date(outcome.createdAt) : new Date(0);
      const confidence = Number(outcome.confidence) || 0;
      const extracted = (outcome.extracted || {}) as OutcomeExtracted;
      
      // Store by invoice if linked to specific invoice
      if (outcome.invoiceId) {
        const existing = latestOutcomeByInvoice.get(outcome.invoiceId);
        if (!existing || createdAt > existing.createdAt) {
          latestOutcomeByInvoice.set(outcome.invoiceId, {
            type: outcome.type,
            extracted,
            confidence,
            confidenceBand: outcome.confidenceBand,
            createdAt
          });
        }
      }
      
      // Also store by debtor for debtor-level outcomes
      if (outcome.debtorId) {
        const existing = latestOutcomeByDebtor.get(outcome.debtorId);
        if (!existing || createdAt > existing.createdAt) {
          latestOutcomeByDebtor.set(outcome.debtorId, {
            type: outcome.type,
            extracted,
            confidence,
            confidenceBand: outcome.confidenceBand,
            createdAt
          });
        }
      }
    }
  }

  let latestIntentByInvoice: Map<string, { intentType: string; createdAt: Date }> = new Map();
  if (invoiceIds.length > 0) {
    const recentActions = await db
      .select()
      .from(actions)
      .where(
        and(
          eq(actions.tenantId, tenantId),
          inArray(actions.invoiceId, invoiceIds)
        )
      )
      .orderBy(desc(actions.createdAt));
    
    for (const action of recentActions) {
      if (action.intentType && action.invoiceId && !latestIntentByInvoice.has(action.invoiceId)) {
        latestIntentByInvoice.set(action.invoiceId, {
          intentType: action.intentType,
          createdAt: action.createdAt ? new Date(action.createdAt) : new Date()
        });
      }
    }
  }

  const forecasts: InvoiceForecast[] = [];
  
  for (const row of openInvoices) {
    const inv = row.invoice;
    const contact = row.contact;
    
    const amount = Number(inv.amount) || 0;
    const amountPaid = Number(inv.amountPaid) || 0;
    const remaining = amount - amountPaid;
    
    if (remaining <= 0) continue;

    if (inv.pauseState === 'dispute') {
      continue;
    }

    let expectedDate: Date;
    let baseConfidence: number;
    let reason: string;

    // Get all data sources
    const ptp = latestPtpByInvoice.get(inv.id);
    const paymentPlan = paymentPlanByInvoice.get(inv.id);
    const intent = latestIntentByInvoice.get(inv.id);
    const invoiceOutcome = latestOutcomeByInvoice.get(inv.id);
    const debtorOutcome = inv.contactId ? latestOutcomeByDebtor.get(inv.contactId) : undefined;
    
    // Use invoice-level outcome first, fall back to debtor-level
    const outcome = invoiceOutcome || debtorOutcome;

    // NEW Priority: 
    // 1) Unified Outcomes (HIGHEST - includes structured PTP dates from email/voice/SMS)
    // 2) Legacy PTP tables
    // 3) Payment Plans
    // 4) Invoice pause state
    // 5) Intent from actions
    // 6) outcomeOverride
    // 7) Due date
    
    // Check for dispute outcomes first - exclude from forecast
    if (outcome?.type === 'DISPUTE' || inv.outcomeOverride === 'Disputed') {
      continue;
    }
    
    // 1) Unified Outcomes - HIGHEST PRIORITY with structured extracted data
    if (outcome?.type === 'PROMISE_TO_PAY' && outcome.extracted?.promiseToPayDate) {
      expectedDate = new Date(outcome.extracted.promiseToPayDate);
      // Use confidence band from outcome
      baseConfidence = outcome.confidenceBand === 'HIGH' ? 0.90 : 
                       outcome.confidenceBand === 'MEDIUM' ? 0.80 : 0.65;
      reason = 'Promise to Pay (outcome)';
    } else if (outcome?.type === 'PAYMENT_CONFIRMATION') {
      expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() + 2);
      baseConfidence = 0.92;
      reason = 'Payment Confirmation (outcome)';
    } else if (outcome?.type === 'PAYMENT_PLAN' && outcome.extracted?.paymentPlanSchedule?.length) {
      // Use first scheduled payment date
      expectedDate = new Date(outcome.extracted.paymentPlanSchedule[0].date);
      baseConfidence = 0.82;
      reason = 'Payment Plan (outcome)';
    } else if (outcome?.type === 'PROMISE_TO_PAY') {
      // PTP outcome without specific date - use 7-day default
      expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() + 7);
      baseConfidence = outcome.confidenceBand === 'HIGH' ? 0.85 : 0.75;
      reason = 'Promise to Pay (outcome, no date)';
    } else if (outcome?.type === 'VULNERABILITY' || outcome?.type === 'ADMIN_BLOCKER') {
      // Lower confidence, push out expected date
      expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() + 30);
      baseConfidence = 0.35;
      reason = outcome.type === 'VULNERABILITY' ? 'Vulnerability (review required)' : 'Admin Blocker';
    // 2) Legacy PTP tables
    } else if (ptp && (ptp.status === 'pending' || ptp.status === 'active')) {
      expectedDate = ptp.promisedDate;
      baseConfidence = 0.85;
      reason = `Promise to Pay (${ptp.source})`;
    // 3) Payment Plans
    } else if (paymentPlan && paymentPlan.status === 'active') {
      expectedDate = paymentPlan.planStartDate;
      baseConfidence = 0.80;
      reason = 'Payment Plan';
    // 4) Invoice pause state
    } else if (inv.pauseState === 'ptp' && inv.pausedUntil) {
      expectedDate = new Date(inv.pausedUntil);
      baseConfidence = 0.85;
      reason = 'Promise to Pay (pause)';
    // 5) Intent from actions (legacy fallback)
    } else if (intent?.intentType === 'promise_to_pay') {
      expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() + 7);
      baseConfidence = 0.80;
      reason = 'Promise to Pay (intent)';
    } else if (intent?.intentType === 'payment_confirmation') {
      expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() + 2);
      baseConfidence = 0.90;
      reason = 'Payment Confirmation';
    } else if (intent?.intentType === 'payment_plan') {
      expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() + 14);
      baseConfidence = 0.70;
      reason = 'Payment Plan (intent)';
    } else if (intent?.intentType === 'query' || intent?.intentType === 'general_query') {
      expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() + 14);
      baseConfidence = 0.55;
      reason = 'Request More Time';
    } else if (intent?.intentType === 'dispute') {
      continue;
    // 6) outcomeOverride
    } else if (inv.outcomeOverride === 'Plan') {
      expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() + 14);
      baseConfidence = 0.70;
      reason = 'Payment Plan (outcome)';
    } else if (inv.outcomeOverride === 'Silent') {
      // Action taken but no response - lower confidence
      const dueDate = new Date(inv.dueDate);
      expectedDate = dueDate < today ? new Date(today) : dueDate;
      expectedDate.setDate(expectedDate.getDate() + 7);
      baseConfidence = 0.30;
      reason = 'Silent (no response)';
    } else {
      const dueDate = new Date(inv.dueDate);
      if (dueDate < today) {
        expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() + 7);
        baseConfidence = 0.35;
        reason = 'Overdue (no response)';
      } else {
        expectedDate = dueDate;
        baseConfidence = 0.50;
        reason = 'Due Date';
      }
    }

    const confidence = adjustConfidenceByRiskBand(baseConfidence, contact?.riskBand || null);

    forecasts.push({
      invoiceId: inv.id,
      remaining,
      expectedDate,
      confidence,
      reason
    });
  }

  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + rangeDays);

  const bucketMap = new Map<string, CashInflowPoint>();

  if (bucket === 'day') {
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      bucketMap.set(key, {
        date: key,
        expectedAmount: 0,
        confidenceWeightedAmount: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        invoiceCount: 0
      });
    }
  } else {
    const weekStart = getWeekStart(today);
    for (let i = 0; i < Math.ceil(rangeDays / 7); i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i * 7);
      if (d > rangeEnd) break;
      const key = d.toISOString().split('T')[0];
      bucketMap.set(key, {
        date: key,
        expectedAmount: 0,
        confidenceWeightedAmount: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        invoiceCount: 0
      });
    }
  }

  for (const forecast of forecasts) {
    if (forecast.expectedDate < today || forecast.expectedDate > rangeEnd) {
      continue;
    }

    let bucketKey: string;
    if (bucket === 'day') {
      bucketKey = forecast.expectedDate.toISOString().split('T')[0];
    } else {
      const ws = getWeekStart(forecast.expectedDate);
      bucketKey = ws.toISOString().split('T')[0];
    }

    let point = bucketMap.get(bucketKey);
    if (!point) {
      if (bucket === 'week') {
        const keys = Array.from(bucketMap.keys()).sort();
        const lastKey = keys[keys.length - 1];
        if (lastKey) {
          point = bucketMap.get(lastKey);
        }
      }
      if (!point) continue;
    }

    point.expectedAmount += forecast.remaining;
    point.confidenceWeightedAmount += forecast.remaining * forecast.confidence;
    point.invoiceCount += 1;

    if (forecast.confidence >= 0.7) {
      point.highConfidence += forecast.remaining;
    } else if (forecast.confidence >= 0.4) {
      point.mediumConfidence += forecast.remaining;
    } else {
      point.lowConfidence += forecast.remaining;
    }
  }

  const points = Array.from(bucketMap.values()).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return {
    rangeDays,
    bucket,
    points,
    asOf: now.toISOString()
  };
}

export async function persistForecastPoints(
  tenantId: string,
  points: CashInflowPoint[],
  bucket: "day" | "week",
  triggerEvent: string = "MANUAL"
): Promise<number> {
  const now = new Date();
  let persisted = 0;

  for (const point of points) {
    const dateBucket = new Date(point.date);
    
    await db.insert(forecastPoints)
      .values({
        tenantId,
        dateBucket,
        bucketType: bucket.toUpperCase(),
        highAmount: point.highConfidence.toFixed(2),
        mediumAmount: point.mediumConfidence.toFixed(2),
        lowAmount: point.lowConfidence.toFixed(2),
        highInvoiceCount: Math.round(point.invoiceCount * 0.3),
        mediumInvoiceCount: Math.round(point.invoiceCount * 0.4),
        lowInvoiceCount: Math.round(point.invoiceCount * 0.3),
        excludedAmount: "0",
        excludedInvoiceCount: 0,
        computedAt: now,
        triggerEvent,
      })
      .onConflictDoUpdate({
        target: [forecastPoints.tenantId, forecastPoints.dateBucket, forecastPoints.bucketType],
        set: {
          highAmount: point.highConfidence.toFixed(2),
          mediumAmount: point.mediumConfidence.toFixed(2),
          lowAmount: point.lowConfidence.toFixed(2),
          highInvoiceCount: Math.round(point.invoiceCount * 0.3),
          mediumInvoiceCount: Math.round(point.invoiceCount * 0.4),
          lowInvoiceCount: Math.round(point.invoiceCount * 0.3),
          computedAt: now,
          triggerEvent,
        },
      });
    
    persisted++;
  }

  console.log(`📊 Persisted ${persisted} forecast points for tenant ${tenantId}`);
  return persisted;
}

export async function computeAndPersistCashInflow(
  tenantId: string,
  rangeDays: number = 60,
  bucket: "day" | "week" = "week",
  triggerEvent: string = "MANUAL"
): Promise<CashInflowResponse> {
  const result = await computeCashInflow(tenantId, rangeDays, bucket);
  
  try {
    await persistForecastPoints(tenantId, result.points, bucket, triggerEvent);
  } catch (error) {
    console.warn(`Failed to persist forecast points for tenant ${tenantId}:`, error);
  }
  
  return result;
}

export async function getPersistedForecastPoints(
  tenantId: string,
  rangeDays: number = 90,
  bucket: "day" | "week" = "week"
): Promise<{
  points: Array<{
    date: string;
    highAmount: number;
    mediumAmount: number;
    lowAmount: number;
    totalAmount: number;
    invoiceCount: number;
  }>;
  asOf: string | null;
}> {
  const now = new Date();
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + rangeDays);

  const storedPoints = await db.query.forecastPoints.findMany({
    where: and(
      eq(forecastPoints.tenantId, tenantId),
      eq(forecastPoints.bucketType, bucket.toUpperCase()),
      gte(forecastPoints.dateBucket, now),
      sql`${forecastPoints.dateBucket} <= ${rangeEnd}`
    ),
    orderBy: [forecastPoints.dateBucket],
  });

  if (storedPoints.length === 0) {
    return { points: [], asOf: null };
  }

  const latestComputed = storedPoints.reduce((latest, p) => {
    if (!latest || (p.computedAt && new Date(p.computedAt) > new Date(latest))) {
      return p.computedAt?.toISOString() || null;
    }
    return latest;
  }, null as string | null);

  return {
    points: storedPoints.map(p => ({
      date: p.dateBucket.toISOString().split('T')[0],
      highAmount: parseFloat(p.highAmount || "0"),
      mediumAmount: parseFloat(p.mediumAmount || "0"),
      lowAmount: parseFloat(p.lowAmount || "0"),
      totalAmount: parseFloat(p.highAmount || "0") + parseFloat(p.mediumAmount || "0") + parseFloat(p.lowAmount || "0"),
      invoiceCount: (p.highInvoiceCount || 0) + (p.mediumInvoiceCount || 0) + (p.lowInvoiceCount || 0),
    })),
    asOf: latestComputed,
  };
}
