# Adaptive Collection Scheduler

**Last Updated:** October 19, 2025

## Overview

The Adaptive Collection Scheduler is an intelligent, AI-driven system that optimizes debt collection timing and channel selection based on customer payment behavior. It uses machine learning signals to predict optimal contact moments, reducing collector workload while maximizing payment conversion rates.

### Key Capabilities

- **Behavioral Learning**: Learns from historical payment patterns to predict future behavior
- **Dynamic Channel Selection**: Chooses optimal communication channel (email, SMS, WhatsApp, voice) based on response rates
- **Target DSO Optimization**: Automatically adjusts contact frequency to hit organizational DSO targets
- **Static + Adaptive Modes**: Supports traditional rule-based scheduling alongside intelligent adaptive scheduling
- **Cold-Start Intelligence**: Uses segment priors for new customers without payment history

---

## System Architecture

### Dual Scheduling Modes

The system supports two scheduling approaches that can be used independently or together:

#### 1. Static Scheduling (Traditional)
- Rule-based sequences defined manually by collections teams
- Fixed timing (e.g., "Day 7: Email, Day 14: SMS, Day 21: Call")
- Predictable, consistent contact patterns
- Best for: Regulatory compliance, standardized workflows

#### 2. Adaptive Scheduling (AI-Driven)
- Behavior-based contact optimization using customer signals
- Dynamic timing adjusted to payment patterns
- Channel selection based on effectiveness
- Best for: Maximizing cash collection, reducing DSO

### High-Level Flow

```
Invoice Overdue
     ↓
Check Schedule Assignment
     ↓
┌────────────────┬────────────────┐
│  Static Mode   │ Adaptive Mode  │
│  (Rules-Based) │ (AI-Driven)    │
└────────────────┴────────────────┘
     ↓                   ↓
Static Sequence    Scoring Engine
     ↓                   ↓
Next Action        Optimal Action
```

---

## Adaptive Scheduler Components

### 1. Scoring Engine
**File:** `server/lib/adaptive-scheduler.ts`

The core intelligence that calculates priority scores for each contact.

**Scoring Factors:**
- **Payment Urgency**: Days overdue × amount owed
- **Historical Behavior**: Median days to pay, volatility, trends
- **Channel Effectiveness**: Response rates by channel for this customer
- **Amount Sensitivity**: How invoice size affects payment speed
- **Risk Markers**: Dispute history, promise breaches, partial payments

**Score Calculation:**
```typescript
finalScore = (
  urgencyScore * 0.40 +
  behaviorScore * 0.30 +
  channelScore * 0.20 +
  riskScore * 0.10
)
```

### 2. Signal Collector
**File:** `server/lib/signal-collector.ts`

Collects and aggregates behavioral signals from payment and communication events.

**Payment Signals:**
- Median days to pay
- 75th percentile payment lag
- Payment volatility (standard deviation)
- Payment trend (improving/declining)
- Amount sensitivity by invoice size bucket
- Partial payment frequency

**Channel Signals:**
- Email open/click/reply rates
- SMS reply rates
- WhatsApp reply rates
- Voice call answer rates

**Risk Markers:**
- Dispute count
- Promise breach count
- Partial payment count

### 3. Signal Refresh Job
**File:** `server/lib/signal-refresh-job.ts`

Background job that recalculates behavioral signals from historical data.

**Use Cases:**
- Initial data migration
- Periodic signal recalculation
- Fixing corrupted signal data
- Backfilling after system updates

### 4. Action Planner
**File:** `server/services/actionPlanner.ts`

Orchestrates the adaptive scheduling workflow:
1. Fetches overdue invoices for tenant
2. Gets behavioral signals for each contact
3. Calculates priority scores using scoring engine
4. Generates recommended actions with optimal timing/channel
5. Creates actions in database for collectors to execute

---

## Data Model

### Collection Schedules
**Table:** `collectionSchedules`

Defines scheduling configuration per tenant/workflow.

```typescript
{
  id: string;
  tenantId: string;
  name: string;
  description: string;
  isActive: boolean;
  
  // Scheduling Mode
  schedulerType: 'static' | 'adaptive';
  
  // Static Mode (rule-based sequences)
  sequence: ScheduleStep[];
  
  // Adaptive Mode (AI configuration)
  adaptiveSettings: {
    enabled: boolean;
    targetDSO: number;              // Target days sales outstanding
    maxDailyTouches: number;         // Max contacts per customer/day
    quietHoursStart: string;         // e.g., "20:00"
    quietHoursEnd: string;           // e.g., "08:00"
    channelPreferences: string[];    // Allowed channels
    minScoreThreshold: number;       // Min score to trigger action
  };
}
```

### Customer Behavior Signals
**Table:** `customerBehaviorSignals`

Stores aggregated behavioral analytics per contact.

```typescript
{
  id: string;
  contactId: string;
  tenantId: string;
  
  // Payment Behavior
  medianDaysToPay: string;          // "14.5"
  p75DaysToPay: string;             // "21.0"
  volatility: string;               // "5.2" (std dev)
  trend: string;                    // "-2.3" (negative = improving)
  amountSensitivity: {              // Days to pay by amount bucket
    "<1000": 10,
    "1000-5000": 15,
    "5000-20000": 25,
    ">20000": 35
  };
  
  // Channel Effectiveness
  emailOpenRate: string;            // "0.65"
  emailClickRate: string;           // "0.32"
  emailReplyRate: string;           // "0.15"
  smsReplyRate: string;             // "0.22"
  whatsappReplyRate: string;        // "0.28"
  voiceAnswerRate: string;          // "0.40"
  
  // Risk Markers
  disputeCount: number;
  promiseBreachCount: number;
  partialPaymentCount: number;
  
  // Metadata
  invoiceCount: number;             // Sample size
  lastPaymentDate: Date;
  lastContactDate: Date;
  segmentPrior: string;             // "early_payer" | "moderate" | "late_payer"
}
```

---

## Adaptive Scheduling Algorithm

### Step 1: Calculate Urgency Score

```typescript
urgencyScore = (
  daysOverdue * 0.6 +
  amountRatio * 0.4
) * 100

where:
  daysOverdue = current date - invoice due date
  amountRatio = invoice amount / average invoice amount
```

### Step 2: Calculate Behavior Score

```typescript
// Get expected days to pay based on amount bucket
expectedDays = signal.amountSensitivity[bucket] || signal.medianDaysToPay

// Calculate deviation from expected
deviation = daysOverdue - expectedDays

// Higher score if customer is deviating from pattern
behaviorScore = (
  (deviation / expectedDays) * 50 +
  (signal.volatility * 10) +
  (signal.trend < 0 ? -20 : 20) // Bonus if improving
)
```

### Step 3: Calculate Channel Score

```typescript
// Get response rates for allowed channels
channelScores = {
  email: signal.emailReplyRate * 100,
  sms: signal.smsReplyRate * 100,
  whatsapp: signal.whatsappReplyRate * 100,
  voice: signal.voiceAnswerRate * 100
}

// Select best channel
bestChannel = maxBy(channelScores, allowedChannels)
channelScore = channelScores[bestChannel]
```

### Step 4: Calculate Risk Score

```typescript
riskScore = (
  signal.disputeCount * -30 +
  signal.promiseBreachCount * 40 +
  signal.partialPaymentCount * 10
)
```

### Step 5: Combine & Threshold

```typescript
finalScore = (
  urgencyScore * 0.40 +
  behaviorScore * 0.30 +
  channelScore * 0.20 +
  riskScore * 0.10
)

if (finalScore >= settings.minScoreThreshold) {
  createAction({
    contactId,
    invoiceId,
    priority: finalScore,
    channel: bestChannel,
    suggestedDate: calculateOptimalTiming(signal)
  })
}
```

---

## Cold-Start Strategy

For new customers without payment history, the system uses **segment priors**:

### Segment Classification
```typescript
export const SEGMENT_PRIORS = {
  early_payer: {
    medianDaysToPay: 5,
    p75DaysToPay: 10,
    volatility: 2,
    trend: -1,
    emailReplyRate: 0.35,
    smsReplyRate: 0.25,
    voiceAnswerRate: 0.45
  },
  moderate: {
    medianDaysToPay: 15,
    p75DaysToPay: 25,
    volatility: 5,
    trend: 0,
    emailReplyRate: 0.25,
    smsReplyRate: 0.20,
    voiceAnswerRate: 0.35
  },
  late_payer: {
    medianDaysToPay: 35,
    p75DaysToPay: 50,
    volatility: 10,
    trend: 2,
    emailReplyRate: 0.15,
    smsReplyRate: 0.15,
    voiceAnswerRate: 0.25
  }
}
```

**Assignment Logic:**
1. New customer receives default segment: `moderate`
2. After first payment, system calculates actual behavior
3. Segment adjusts based on observed payment lag
4. Signals gradually replace segment priors with real data

---

## Signal Collection Integration

### Payment Signal Sources

Behavioral signals are collected from **three payment sources**:

#### 1. Stripe Webhooks
**File:** `server/index.ts`

When customers pay through the Debtor Self-Service Portal:
```typescript
stripe.webhooks.constructEvent(payload, signature);

// On payment_intent.succeeded
signalCollector.recordPaymentEvent({
  contactId,
  tenantId,
  invoiceId,
  amountPaid,
  invoiceAmount,
  dueDate,
  paidDate,
  isPartial
});
```

#### 2. Xero Invoice Sync
**File:** `server/services/dataTypeHandlers.ts`

When payment data arrives from Xero accounting system:
```typescript
InvoicesHandler.upsert(transformedData) {
  // ... insert/update invoice
  
  if (hasPaymentData && contactId) {
    signalCollector.recordPaymentEvent({
      contactId,
      tenantId,
      invoiceId,
      amountPaid,
      invoiceAmount,
      dueDate,
      paidDate,
      isPartial
    });
  }
}
```

#### 3. Manual Mark-Paid
**File:** `server/routes.ts`

When collectors manually mark invoices as paid:
```typescript
app.post("/api/invoices/:id/mark-paid", async (req, res) => {
  await storage.updateInvoice(invoiceId, { 
    status: 'paid',
    paidDate: new Date() 
  });
  
  signalCollector.recordPaymentEvent({
    contactId,
    tenantId,
    invoiceId,
    amountPaid: invoiceAmount,
    invoiceAmount,
    dueDate,
    paidDate: new Date(),
    isPartial: false
  });
});
```

### Communication Signal Sources

Channel effectiveness signals collected from **webhooks**:

#### 1. SendGrid Email Events
**File:** `server/routes/webhooks.ts`

```typescript
app.post("/webhooks/sendgrid", (req, res) => {
  for (const event of req.body) {
    if (['open', 'click', 'reply'].includes(event.event)) {
      signalCollector.recordChannelEvent({
        contactId: event.contactId,
        tenantId: event.tenantId,
        channel: 'email',
        eventType: event.event,
        timestamp: new Date(event.timestamp * 1000)
      });
    }
  }
});
```

#### 2. Vonage SMS/WhatsApp Events
**File:** `server/routes/webhooks.ts`

```typescript
app.post("/webhooks/vonage/inbound-sms", (req, res) => {
  signalCollector.recordChannelEvent({
    contactId: message.contactId,
    tenantId: message.tenantId,
    channel: 'sms',
    eventType: 'replied',
    timestamp: new Date()
  });
});
```

#### 3. Retell Voice Events
**File:** `server/routes/webhooks.ts`

```typescript
app.post("/webhooks/retell/transcript", (req, res) => {
  if (callData.answered) {
    signalCollector.recordChannelEvent({
      contactId: callData.contactId,
      tenantId: callData.tenantId,
      channel: 'voice',
      eventType: 'answered',
      timestamp: new Date()
    });
  }
});
```

---

## Workflow Integration

### Schedule Assignment

Contacts can be assigned to specific schedules:

**Table:** `customerScheduleAssignments`
```typescript
{
  id: string;
  contactId: string;
  scheduleId: string;
  tenantId: string;
  assignedAt: Date;
  assignedBy: string;
}
```

### Action Planning Flow

1. **Background Job** runs periodically (e.g., every 6 hours)
2. **Action Planner** fetches overdue invoices
3. For each invoice:
   - Get contact's schedule assignment
   - Load behavioral signals
   - Calculate priority score
   - Determine optimal channel & timing
   - Create recommended action
4. **Collectors** review and execute actions in Action Centre

---

## Configuration Guide

### Setting Up Adaptive Scheduling

**UI:** Collection Schedules Builder
**Location:** `/workflows/schedules`

```typescript
// Create adaptive schedule
{
  name: "High-Value Adaptive",
  schedulerType: "adaptive",
  adaptiveSettings: {
    enabled: true,
    targetDSO: 30,              // Aim for 30-day DSO
    maxDailyTouches: 2,          // Max 2 contacts/day per customer
    quietHoursStart: "20:00",    // No contact after 8pm
    quietHoursEnd: "08:00",      // No contact before 8am
    channelPreferences: [        // Allowed channels
      "email",
      "sms", 
      "voice"
    ],
    minScoreThreshold: 50        // Only create actions >= score 50
  }
}
```

### Setting Up Static Scheduling

```typescript
{
  name: "Standard Collection Flow",
  schedulerType: "static",
  sequence: [
    {
      dayOffset: 7,
      channel: "email",
      templateId: "friendly-reminder"
    },
    {
      dayOffset: 14,
      channel: "sms",
      templateId: "payment-reminder"
    },
    {
      dayOffset: 21,
      channel: "voice",
      templateId: "urgent-follow-up"
    }
  ]
}
```

---

## API Endpoints

### Calculate Next Actions (Adaptive)
```http
POST /api/adaptive-scheduler/calculate-actions
Content-Type: application/json

{
  "tenantId": "tenant_123",
  "scheduleId": "schedule_456"
}

Response:
{
  "actions": [
    {
      "contactId": "contact_789",
      "invoiceId": "invoice_101",
      "priority": 85.4,
      "recommendedChannel": "sms",
      "suggestedDate": "2025-10-20T14:30:00Z",
      "reasoning": {
        "urgencyScore": 72,
        "behaviorScore": 45,
        "channelScore": 28,
        "riskScore": 10
      }
    }
  ]
}
```

### Refresh Behavioral Signals
```http
POST /api/signals/refresh
Content-Type: application/json

{
  "tenantId": "tenant_123",
  "contactId": "contact_789"  // Optional: specific contact
}

Response:
{
  "success": true,
  "contactsProcessed": 1,
  "signalsUpdated": 1
}
```

### Get Contact Signals
```http
GET /api/contacts/:contactId/signals

Response:
{
  "contactId": "contact_789",
  "medianDaysToPay": "14.5",
  "emailReplyRate": "0.22",
  "smsReplyRate": "0.18",
  "segmentPrior": "moderate",
  "lastUpdated": "2025-10-19T10:30:00Z"
}
```

---

## Performance Considerations

### Scoring Performance
- Scoring calculation is O(1) per invoice
- Typical tenant (1000 overdue invoices): ~200ms total
- Runs asynchronously in background jobs

### Signal Collection
- All signal recording is asynchronous (fire-and-forget)
- Webhook handlers return 200 OK immediately
- Signal calculation batched for efficiency

### Database Queries
- Signals table indexed on `contactId` and `tenantId`
- Invoices query optimized with composite index on `(tenantId, status, dueDate)`
- Action creation uses batch inserts

---

## Monitoring & Observability

### Key Metrics

**Signal Quality:**
- % of contacts with behavioral signals
- Average sample size (invoice count) per signal
- Signal staleness (time since last update)

**Scheduler Performance:**
- Actions generated per run
- Average priority score
- Score distribution by urgency/behavior/channel/risk

**Collection Effectiveness:**
- DSO trend (actual vs target)
- Payment rate by recommended channel
- Action completion rate by priority band

### Console Logging

```typescript
// Signal collection
📊 Recording payment signal for contact abc123
✅ Updated payment signals for contact abc123: { medianDaysToPay: 15, p75: 22, ... }

// Channel events
📞 Recording channel event: email replied by contact abc123

// Adaptive scheduler
🎯 Calculating adaptive actions for 47 overdue invoices
💡 Generated 32 recommended actions (avg score: 68.4)
```

---

## Troubleshooting

### No Signals Generated

**Symptoms:** `customerBehaviorSignals` table empty

**Causes:**
1. No payment webhooks configured
2. No paid invoices in database
3. Signal collector errors (check logs)

**Solutions:**
```bash
# Run signal refresh job manually
POST /api/signals/refresh
{
  "tenantId": "tenant_123"
}

# Check for paid invoices
SELECT COUNT(*) FROM invoices 
WHERE tenant_id = 'tenant_123' 
AND CAST(COALESCE(amount_paid, '0') AS DECIMAL) > 0;
```

### Low Priority Scores

**Symptoms:** All scores below threshold, no actions created

**Causes:**
1. Threshold too high (`minScoreThreshold`)
2. Poor behavioral signals (all customers pay early)
3. Recent contact attempts (cooling period)

**Solutions:**
1. Lower `minScoreThreshold` (try 30-40)
2. Check signal distribution in database
3. Adjust scoring weights in `adaptive-scheduler.ts`

### Wrong Channel Selected

**Symptoms:** Adaptive scheduler recommends unexpected channel

**Causes:**
1. Channel preferences misconfigured
2. Signal data stale or inaccurate
3. Insufficient sample size for channel metrics

**Solutions:**
1. Verify `channelPreferences` in schedule settings
2. Refresh signals: `POST /api/signals/refresh`
3. Check `invoiceCount` in signals (need 5+ for reliability)

---

## Future Enhancements

### Planned Features

1. **Reinforcement Learning**
   - Use actual payment outcomes to refine scoring weights
   - A/B test different scoring algorithms

2. **Multi-Invoice Optimization**
   - Optimize contact strategy across all customer invoices
   - Bundle communications for customers with multiple overdue invoices

3. **Time-of-Day Optimization**
   - Learn optimal contact times per customer
   - Adjust for timezone and working hours

4. **Seasonal Adjustment**
   - Detect seasonal payment patterns
   - Adjust expectations during holidays/month-end

5. **Predictive Payment Propensity**
   - ML model to predict payment probability
   - Generate confidence intervals for DSO forecasts

### Research Areas

- **Contextual Bandits**: Dynamic channel selection with exploration
- **Survival Analysis**: Model time-to-payment distributions
- **Graph Neural Networks**: Leverage payment network effects

---

## Related Documentation

- [PAYMENT_SIGNALS.md](./PAYMENT_SIGNALS.md) - Deep dive into signal collection system
- [SECURITY.md](./SECURITY.md) - Webhook security and authentication
- [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) - Code patterns and setup
- [replit.md](./replit.md) - System architecture overview

---

**Questions?** See [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) for troubleshooting or contact the development team.
