# Payment & Communication Behavioral Signals

**Last Updated:** October 19, 2025

## Overview

The Payment Signals system is a behavioral analytics engine that tracks customer payment patterns and communication preferences to power the Adaptive Collection Scheduler. It automatically learns from every payment and interaction, building a detailed profile of each customer's behavior.

### Purpose

Enable intelligent, data-driven collection decisions by:
- **Learning** payment timing patterns from historical data
- **Tracking** channel effectiveness (email, SMS, WhatsApp, voice)
- **Detecting** risk signals (disputes, promise breaches, partial payments)
- **Predicting** optimal contact strategies for each customer

---

## System Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│           Signal Collection Sources                 │
├──────────────┬──────────────┬──────────────────────┤
│ Stripe       │ Xero Sync    │ Manual Mark-Paid     │
│ Webhooks     │              │                      │
└──────┬───────┴──────┬───────┴──────────┬───────────┘
       │              │                  │
       v              v                  v
┌─────────────────────────────────────────────────────┐
│            SignalCollector Service                  │
│  • recordPaymentEvent()                             │
│  • recordChannelEvent()                             │
│  • getOrCreateSignal()                              │
│  • calculateStatistics()                            │
└──────────────────┬──────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────┐
│       customerBehaviorSignals Database              │
│  • Payment patterns (median, P75, volatility)       │
│  • Channel metrics (open/click/reply rates)         │
│  • Risk markers (disputes, breaches, partials)      │
└──────────────────┬──────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────┐
│          Adaptive Scheduler                         │
│  • Calculates priority scores                       │
│  • Selects optimal channels                         │
│  • Generates recommended actions                    │
└─────────────────────────────────────────────────────┘
```

---

## Signal Collector Service

**File:** `server/lib/signal-collector.ts`

The core service responsible for collecting, aggregating, and storing behavioral signals.

### Key Methods

#### `recordPaymentEvent()`

Records a payment and recalculates all payment-related signals.

```typescript
interface PaymentEvent {
  contactId: string;
  tenantId: string;
  invoiceId: string;
  amountPaid: number;
  invoiceAmount: number;
  dueDate: Date;
  paidDate: Date;
  isPartial: boolean;
}

await signalCollector.recordPaymentEvent({
  contactId: "contact_123",
  tenantId: "tenant_456",
  invoiceId: "invoice_789",
  amountPaid: 2500.00,
  invoiceAmount: 2500.00,
  dueDate: new Date("2025-10-01"),
  paidDate: new Date("2025-10-15"),
  isPartial: false
});
```

**What it does:**
1. Fetches last 100 paid invoices for contact
2. Calculates payment lags (days between due date and paid date)
3. Computes statistical measures (median, P75, volatility, trend)
4. Analyzes amount sensitivity by invoice size bucket
5. Updates `customerBehaviorSignals` table

#### `recordChannelEvent()`

Records a communication event and updates channel effectiveness metrics.

```typescript
interface ChannelEvent {
  contactId: string;
  tenantId: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'voice';
  eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'answered' | 'failed';
  timestamp: Date;
}

await signalCollector.recordChannelEvent({
  contactId: "contact_123",
  tenantId: "tenant_456",
  channel: "email",
  eventType: "replied",
  timestamp: new Date()
});
```

**What it does:**
1. Queries `actions` table for sent messages
2. Queries `inboundMessages` table for replies/responses
3. Calculates response rates: (inbound / outbound)
4. Updates channel-specific metrics in `customerBehaviorSignals`

---

## Data Collection Sources

### 1. Payment Signal Collection

#### Stripe Webhook Integration
**File:** `server/index.ts`

Captures payments made through the Debtor Self-Service Portal.

```typescript
app.post('/webhooks/stripe', async (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body, 
    signature, 
    process.env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === 'payment_intent.succeeded') {
    const { metadata } = event.data.object;
    
    // Update invoice payment status
    await storage.updateInvoice(metadata.invoiceId, {
      status: isPaid ? 'paid' : 'partial',
      amountPaid: metadata.principalAmount,
      paidDate: isPaid ? new Date() : null
    });

    // Collect behavioral signal
    await signalCollector.recordPaymentEvent({
      contactId: metadata.contactId,
      tenantId: metadata.tenantId,
      invoiceId: metadata.invoiceId,
      amountPaid: parseFloat(metadata.principalAmount),
      invoiceAmount: parseFloat(invoice.amount),
      dueDate: new Date(invoice.dueDate),
      paidDate: new Date(),
      isPartial: !isPaid
    });
  }

  res.json({ received: true });
});
```

**Triggers:**
- Full payment via Stripe checkout
- Partial payment via Stripe checkout
- Payment plan installments

#### Xero Sync Integration
**File:** `server/services/dataTypeHandlers.ts`

Captures payment data synced from Xero accounting software.

```typescript
class InvoicesHandler {
  async upsert(transformedData: any, provider: string) {
    // Insert or update invoice in database
    const invoiceId = await db.insert(invoices).values(transformedData);

    // Check if invoice has payment data
    const hasPaymentData = 
      (transformedData.amountPaid && parseFloat(transformedData.amountPaid) > 0) || 
      transformedData.paidDate;

    if (hasPaymentData && transformedData.contactId) {
      // Trigger signal collection
      signalCollector.recordPaymentEvent({
        contactId: transformedData.contactId,
        tenantId: transformedData.tenantId,
        invoiceId: invoiceId,
        amountPaid: parseFloat(transformedData.amountPaid || '0'),
        invoiceAmount: parseFloat(transformedData.amount),
        dueDate: new Date(transformedData.dueDate),
        paidDate: transformedData.paidDate ? new Date(transformedData.paidDate) : new Date(),
        isPartial: parseFloat(transformedData.amountPaid || '0') < parseFloat(transformedData.amount)
      }).catch((err: Error) => {
        console.error('❌ Failed to record payment signal from Xero sync:', err);
      });

      console.log(`📊 Triggered payment signal collection for invoice ${invoiceId} from Xero sync`);
    }
  }
}
```

**Triggers:**
- Scheduled Xero sync (every 6-24 hours)
- Manual sync triggered by user
- Webhook from Xero (if configured)

#### Manual Mark-Paid Integration
**File:** `server/routes.ts`

Captures manual payment updates by collectors.

```typescript
app.post("/api/invoices/:id/mark-paid", async (req, res) => {
  const invoice = await storage.getInvoice(invoiceId, tenantId);

  // Update invoice status
  await storage.updateInvoice(invoiceId, tenantId, {
    status: 'paid',
    paidDate: new Date(),
    amountPaid: invoice.amount
  });

  // Trigger signal collection
  signalCollector.recordPaymentEvent({
    contactId: invoice.contactId,
    tenantId: user.tenantId,
    invoiceId: invoice.id,
    amountPaid: parseFloat(invoice.amount),
    invoiceAmount: parseFloat(invoice.amount),
    dueDate: new Date(invoice.dueDate),
    paidDate: new Date(),
    isPartial: false
  }).catch((err: Error) => {
    console.error('❌ Failed to record payment signal from manual mark-paid:', err);
  });

  console.log(`📊 Triggered payment signal collection for invoice ${invoice.id} from manual mark-paid`);

  res.json({ success: true });
});
```

**Triggers:**
- Collector marks invoice as paid in Action Centre
- Bulk mark-paid operations
- Payment confirmation from bank reconciliation

---

### 2. Channel Signal Collection

#### SendGrid Email Events
**File:** `server/routes/webhooks.ts`

Tracks email opens, clicks, and replies via SendGrid webhook.

```typescript
app.post("/webhooks/sendgrid", async (req, res) => {
  const events = req.body;

  for (const event of events) {
    // Parse metadata from email headers
    const metadata = JSON.parse(event.metadata || '{}');

    // Track engagement events
    if (['open', 'click'].includes(event.event)) {
      await signalCollector.recordChannelEvent({
        contactId: metadata.contactId,
        tenantId: metadata.tenantId,
        channel: 'email',
        eventType: event.event === 'open' ? 'opened' : 'clicked',
        timestamp: new Date(event.timestamp * 1000)
      });
    }

    // Track reply (inbound email)
    if (event.event === 'inbound') {
      await signalCollector.recordChannelEvent({
        contactId: metadata.contactId,
        tenantId: metadata.tenantId,
        channel: 'email',
        eventType: 'replied',
        timestamp: new Date()
      });
    }
  }

  res.status(200).send('OK');
});
```

**Events Tracked:**
- `open`: Customer opened email
- `click`: Customer clicked link in email
- `inbound`: Customer replied to email

#### Vonage SMS Events
**File:** `server/routes/webhooks.ts`

Tracks SMS replies via Vonage inbound webhook.

```typescript
app.post("/webhooks/vonage/inbound-sms", async (req, res) => {
  const { from, to, text } = req.body;

  // Find contact by phone number
  const contact = await storage.getContactByPhone(from, tenantId);

  // Store inbound message
  await db.insert(inboundMessages).values({
    tenantId,
    contactId: contact.id,
    channel: 'sms',
    from,
    to,
    content: text,
    receivedAt: new Date()
  });

  // Record channel signal
  await signalCollector.recordChannelEvent({
    contactId: contact.id,
    tenantId,
    channel: 'sms',
    eventType: 'replied',
    timestamp: new Date()
  });

  res.status(200).send('OK');
});
```

**Events Tracked:**
- `replied`: Customer replied to SMS

#### Vonage WhatsApp Events
**File:** `server/routes/webhooks.ts`

Tracks WhatsApp replies via Vonage inbound webhook.

```typescript
app.post("/webhooks/vonage/inbound-whatsapp", async (req, res) => {
  const { from, to, message } = req.body;

  // Find contact by phone number
  const contact = await storage.getContactByPhone(from, tenantId);

  // Store inbound message
  await db.insert(inboundMessages).values({
    tenantId,
    contactId: contact.id,
    channel: 'whatsapp',
    from,
    to,
    content: message.content.text,
    receivedAt: new Date()
  });

  // Record channel signal
  await signalCollector.recordChannelEvent({
    contactId: contact.id,
    tenantId,
    channel: 'whatsapp',
    eventType: 'replied',
    timestamp: new Date()
  });

  res.status(200).send('OK');
});
```

**Events Tracked:**
- `replied`: Customer replied to WhatsApp message

#### Retell Voice Events
**File:** `server/routes/webhooks.ts`

Tracks voice call outcomes via Retell AI transcript webhook.

```typescript
app.post("/webhooks/retell/transcript", async (req, res) => {
  const callData = req.body;

  // Store call record
  await db.insert(voiceCalls).values({
    tenantId: callData.tenantId,
    contactId: callData.contactId,
    invoiceId: callData.invoiceId,
    retellCallId: callData.call_id,
    transcript: callData.transcript,
    duration: callData.duration,
    outcome: callData.outcome,
    callType: 'outbound'
  });

  // Record channel signal if call was answered
  if (callData.answered) {
    await signalCollector.recordChannelEvent({
      contactId: callData.contactId,
      tenantId: callData.tenantId,
      channel: 'voice',
      eventType: 'answered',
      timestamp: new Date()
    });
  }

  res.status(200).send('OK');
});
```

**Events Tracked:**
- `answered`: Customer answered voice call
- `failed`: Call not answered or failed

---

## Statistical Calculations

### Payment Lag Calculation

```typescript
// For each paid invoice
const paymentLag = Math.floor(
  (paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
);

// Example: Due Oct 1, Paid Oct 15 = +14 days (late)
// Example: Due Oct 15, Paid Oct 10 = -5 days (early)
```

**Handling Partial Payments:**
- If `paidDate` is set: use actual payment date
- If `paidDate` is null (partial payment ongoing): use current date
- This captures "payment in progress" behavior

### Median Days to Pay

```typescript
const sortedLags = [...paymentLags].sort((a, b) => a - b);
const medianDaysToPay = sortedLags[Math.floor(sortedLags.length / 2)];
```

**Interpretation:**
- `medianDaysToPay = 5`: Customer typically pays 5 days after due date
- `medianDaysToPay = -3`: Customer typically pays 3 days before due date
- `medianDaysToPay = 20`: Customer typically pays 20 days late

### P75 Days to Pay (75th Percentile)

```typescript
const p75Index = Math.floor(sortedLags.length * 0.75);
const p75DaysToPay = sortedLags[p75Index];
```

**Interpretation:**
- `p75DaysToPay = 25`: 75% of payments occur within 25 days of due date
- Useful for setting realistic expectations
- Helps detect outlier invoices needing escalation

### Payment Volatility (Standard Deviation)

```typescript
const mean = paymentLags.reduce((a, b) => a + b, 0) / paymentLags.length;
const squaredDiffs = paymentLags.map(lag => Math.pow(lag - mean, 2));
const volatility = Math.sqrt(
  squaredDiffs.reduce((a, b) => a + b, 0) / paymentLags.length
);
```

**Interpretation:**
- `volatility = 2`: Very consistent payment timing
- `volatility = 10`: Highly variable, unpredictable
- High volatility = higher risk, needs closer monitoring

### Payment Trend

```typescript
// Simple linear regression slope
const n = paymentLags.length;
const xMean = (n - 1) / 2; // Time index mean
const yMean = mean; // Payment lag mean

let numerator = 0;
let denominator = 0;

paymentLags.forEach((lag, index) => {
  numerator += (index - xMean) * (lag - yMean);
  denominator += Math.pow(index - xMean, 2);
});

const trend = numerator / denominator;
```

**Interpretation:**
- `trend = -2`: Improving by ~2 days per payment (getting faster)
- `trend = 0`: Stable payment pattern
- `trend = +3`: Declining by ~3 days per payment (getting slower)

### Amount Sensitivity

Groups invoices by size and calculates average payment lag per bucket.

```typescript
const buckets = {
  '<1000': [],
  '1000-5000': [],
  '5000-20000': [],
  '>20000': []
};

invoices.forEach(inv => {
  const amount = parseFloat(inv.amount);
  const lagDays = calculateLag(inv);

  if (amount < 1000) buckets['<1000'].push(lagDays);
  else if (amount < 5000) buckets['1000-5000'].push(lagDays);
  else if (amount < 20000) buckets['5000-20000'].push(lagDays);
  else buckets['>20000'].push(lagDays);
});

const amountSensitivity = {};
Object.entries(buckets).forEach(([bucket, lags]) => {
  if (lags.length > 0) {
    amountSensitivity[bucket] = Math.round(
      lags.reduce((a, b) => a + b, 0) / lags.length
    );
  }
});
```

**Example Output:**
```json
{
  "<1000": 8,
  "1000-5000": 15,
  "5000-20000": 25,
  ">20000": 40
}
```

**Interpretation:**
- Customer pays small invoices (~£500) in 8 days
- Large invoices (~£25k) take 40 days
- Clear amount sensitivity: larger invoices need earlier contact

### Channel Response Rates

```typescript
// Email open rate
const emailSentCount = await db
  .select({ count: count() })
  .from(actions)
  .where(and(
    eq(actions.contactId, contactId),
    eq(actions.type, 'email')
  ));

const emailOpenCount = await db
  .select({ count: count() })
  .from(actions)
  .where(and(
    eq(actions.contactId, contactId),
    eq(actions.type, 'email'),
    sql`metadata->>'opened' = 'true'`
  ));

const emailOpenRate = emailSentCount > 0 
  ? emailOpenCount / emailSentCount 
  : 0;
```

**Response Rate Calculation:**
```typescript
// Outbound: messages sent from actions table
const sentCount = await db
  .select({ count: count() })
  .from(actions)
  .where(and(
    eq(actions.contactId, contactId),
    eq(actions.type, channel)
  ));

// Inbound: replies from inboundMessages table
const replyCount = await db
  .select({ count: count() })
  .from(inboundMessages)
  .where(and(
    eq(inboundMessages.contactId, contactId),
    eq(inboundMessages.channel, channel)
  ));

const replyRate = sentCount > 0 ? replyCount / sentCount : 0;
```

**Example Metrics:**
```json
{
  "emailOpenRate": 0.65,      // 65% of emails opened
  "emailClickRate": 0.32,     // 32% clicked links
  "emailReplyRate": 0.15,     // 15% replied
  "smsReplyRate": 0.22,       // 22% replied to SMS
  "whatsappReplyRate": 0.28,  // 28% replied to WhatsApp
  "voiceAnswerRate": 0.40     // 40% answered calls
}
```

---

## Database Schema

### customerBehaviorSignals Table

```typescript
export const customerBehaviorSignals = pgTable("customer_behavior_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  
  // Payment Behavior Metrics
  medianDaysToPay: varchar("median_days_to_pay"),           // "14.5"
  p75DaysToPay: varchar("p75_days_to_pay"),                 // "22.0"
  volatility: varchar("volatility"),                        // "5.3"
  trend: varchar("trend"),                                  // "-1.2" (improving)
  amountSensitivity: json("amount_sensitivity").$type<{     // By invoice size
    "<1000"?: number;
    "1000-5000"?: number;
    "5000-20000"?: number;
    ">20000"?: number;
  }>(),
  
  // Channel Effectiveness Metrics
  emailOpenRate: varchar("email_open_rate"),                // "0.65"
  emailClickRate: varchar("email_click_rate"),              // "0.32"
  emailReplyRate: varchar("email_reply_rate"),              // "0.15"
  smsReplyRate: varchar("sms_reply_rate"),                  // "0.22"
  whatsappReplyRate: varchar("whatsapp_reply_rate"),        // "0.28"
  voiceAnswerRate: varchar("voice_answer_rate"),            // "0.40"
  
  // Risk Markers
  disputeCount: integer("dispute_count").default(0),
  promiseBreachCount: integer("promise_breach_count").default(0),
  partialPaymentCount: integer("partial_payment_count").default(0),
  
  // Metadata
  invoiceCount: integer("invoice_count").default(0),        // Sample size
  lastPaymentDate: timestamp("last_payment_date"),
  lastContactDate: timestamp("last_contact_date"),
  segmentPrior: varchar("segment_prior"),                   // "moderate"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
```

**Indexes:**
```sql
CREATE INDEX idx_signals_contact ON customer_behavior_signals(contact_id);
CREATE INDEX idx_signals_tenant ON customer_behavior_signals(tenant_id);
CREATE INDEX idx_signals_updated ON customer_behavior_signals(updated_at);
```

---

## Signal Refresh Job

**File:** `server/lib/signal-refresh-job.ts`

Background job for recalculating signals from historical data.

### Use Cases

1. **Initial Setup**: Generate signals for existing contacts
2. **Data Migration**: Rebuild signals after schema changes
3. **Periodic Refresh**: Keep signals up-to-date with latest data
4. **Error Recovery**: Fix corrupted or missing signals

### Running the Job

```typescript
import { SignalRefreshJob } from './lib/signal-refresh-job';

// Refresh signals for entire tenant
await SignalRefreshJob.refreshTenantSignals('tenant_123');

// Refresh signals for specific contact
await SignalRefreshJob.refreshContactSignals('tenant_123', 'contact_456');
```

### Algorithm

```typescript
async refreshContactSignals(tenantId: string, contactId: string) {
  // Find latest paid invoice
  const latestPaidInvoice = await db
    .select()
    .from(invoices)
    .where(and(
      eq(invoices.contactId, contactId),
      eq(invoices.tenantId, tenantId),
      sql`CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL) > 0`
    ))
    .orderBy(desc(invoices.paidDate))
    .limit(1);

  if (!latestPaidInvoice || !latestPaidInvoice.paidDate) {
    console.log(`⚠️ No paid invoices for contact ${contactId}, skipping`);
    return;
  }

  // Record this payment event (which recalculates all stats)
  await signalCollector.recordPaymentEvent({
    contactId,
    tenantId,
    invoiceId: latestPaidInvoice.id,
    amountPaid: parseFloat(latestPaidInvoice.amountPaid || latestPaidInvoice.amount),
    invoiceAmount: parseFloat(latestPaidInvoice.amount),
    dueDate: new Date(latestPaidInvoice.dueDate),
    paidDate: new Date(latestPaidInvoice.paidDate),
    isPartial: parseFloat(latestPaidInvoice.amountPaid || '0') < parseFloat(latestPaidInvoice.amount)
  });
}
```

**Performance:**
- Processes ~10 contacts/second
- Tenant with 1000 contacts: ~100 seconds
- Run as async background job to avoid blocking requests

---

## API Endpoints

### Refresh Signals
```http
POST /api/signals/refresh
Authorization: Bearer <token>
Content-Type: application/json

{
  "tenantId": "tenant_123",
  "contactId": "contact_456"  // Optional
}

Response 200:
{
  "success": true,
  "contactsProcessed": 1,
  "signalsUpdated": 1,
  "duration": "1.2s"
}
```

### Get Contact Signals
```http
GET /api/contacts/:contactId/signals
Authorization: Bearer <token>

Response 200:
{
  "contactId": "contact_456",
  "medianDaysToPay": "14.5",
  "p75DaysToPay": "22.0",
  "volatility": "5.3",
  "trend": "-1.2",
  "amountSensitivity": {
    "<1000": 8,
    "1000-5000": 15,
    "5000-20000": 25
  },
  "emailOpenRate": "0.65",
  "emailReplyRate": "0.15",
  "smsReplyRate": "0.22",
  "invoiceCount": 24,
  "lastPaymentDate": "2025-10-15T10:30:00Z",
  "lastUpdated": "2025-10-19T14:22:00Z"
}
```

### Get Tenant Signal Coverage
```http
GET /api/signals/coverage
Authorization: Bearer <token>

Response 200:
{
  "totalContacts": 1250,
  "contactsWithSignals": 987,
  "coverage": 0.789,              // 78.9%
  "avgSampleSize": 18.4,           // Avg invoices per signal
  "staleness": {
    "upToDate": 823,              // Updated < 7 days ago
    "stale": 164,                 // Updated 7-30 days ago
    "veryStale": 0                // Updated > 30 days ago
  }
}
```

---

## Monitoring & Debugging

### Console Logs

```typescript
// Payment signal recording
📊 Recording payment signal for contact abc123
📈 Fetched 24 paid invoices for analysis
💡 Calculated signals: median=14.5 days, P75=22.0 days, volatility=5.3
✅ Updated payment signals for contact abc123

// Channel signal recording
📞 Recording channel event: email replied by contact abc123
📊 Updated channel signals: emailReplyRate=0.18 (6/33 messages)

// Signal refresh job
🔄 Starting signal refresh for tenant xyz789
✅ Processed 127 contacts in 12.3s
⚠️ Skipped 23 contacts (no payment history)
```

### Health Checks

```sql
-- Contacts without signals (need refresh)
SELECT COUNT(*) 
FROM contacts c
LEFT JOIN customer_behavior_signals s ON c.id = s.contact_id
WHERE s.id IS NULL
AND c.tenant_id = 'tenant_123';

-- Signals with low sample size (< 5 invoices)
SELECT contact_id, invoice_count
FROM customer_behavior_signals
WHERE invoice_count < 5
AND tenant_id = 'tenant_123';

-- Stale signals (not updated in 30+ days)
SELECT contact_id, updated_at
FROM customer_behavior_signals
WHERE updated_at < NOW() - INTERVAL '30 days'
AND tenant_id = 'tenant_123';
```

---

## Best Practices

### Signal Quality

1. **Minimum Sample Size**: Require 5+ paid invoices for reliable signals
2. **Recency**: Refresh signals when payment patterns change
3. **Cold-Start**: Use segment priors for new customers
4. **Outlier Detection**: Flag extreme volatility or unusual patterns

### Performance

1. **Async Collection**: All signal recording is fire-and-forget
2. **Batch Processing**: Refresh job processes contacts in batches
3. **Index Optimization**: Ensure indexes on `contactId`, `tenantId`
4. **Webhook Reliability**: Implement retry logic for failed webhooks

### Data Integrity

1. **Validation**: Check for null/invalid dates before calculating lags
2. **Partial Payments**: Handle ongoing payments correctly (use current date)
3. **Edge Cases**: Account for early payments (negative lags)
4. **Historical Accuracy**: Preserve original payment dates from source systems

---

## Troubleshooting

### Signals Not Updating

**Symptoms:** `customerBehaviorSignals` table not updating after payments

**Check:**
1. Webhook endpoints receiving events (check logs)
2. Signal collector catching errors (check error logs)
3. Payment events triggering correctly (add debug logs)

**Solution:**
```bash
# Manually trigger signal refresh
curl -X POST https://your-app.com/api/signals/refresh \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"tenantId": "tenant_123"}'
```

### Incorrect Payment Lags

**Symptoms:** Median days to pay seems wrong

**Check:**
1. Invoice `dueDate` and `paidDate` are correct
2. Timezone issues (all dates should be UTC)
3. Partial payments being handled correctly

**Debug:**
```sql
-- Inspect raw payment data
SELECT 
  invoice_number,
  due_date,
  paid_date,
  EXTRACT(DAY FROM paid_date - due_date) as days_to_pay
FROM invoices
WHERE contact_id = 'contact_123'
AND CAST(COALESCE(amount_paid, '0') AS DECIMAL) > 0
ORDER BY paid_date DESC
LIMIT 20;
```

### Low Channel Response Rates

**Symptoms:** All channel rates showing 0% or very low

**Check:**
1. Webhook endpoints configured correctly
2. `inboundMessages` table receiving replies
3. `actions` table recording sent messages

**Debug:**
```sql
-- Check outbound vs inbound ratio
SELECT 
  'outbound' as direction,
  type as channel,
  COUNT(*) as count
FROM actions
WHERE contact_id = 'contact_123'
GROUP BY type

UNION ALL

SELECT 
  'inbound' as direction,
  channel,
  COUNT(*) as count
FROM inbound_messages
WHERE contact_id = 'contact_123'
GROUP BY channel;
```

---

## Related Documentation

- [SCHEDULER.md](./SCHEDULER.md) - Adaptive scheduler using these signals
- [SECURITY.md](./SECURITY.md) - Webhook security implementation
- [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) - Code setup and patterns
- [replit.md](./replit.md) - System architecture overview

---

**Questions?** See [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) or contact the development team.
