# Adaptive Collection Scheduler

**Last Updated:** October 20, 2025

## Overview

The Adaptive Collection Scheduler is a production-grade, AI-driven system that optimizes debt collection timing and channel selection using machine learning and portfolio-level DSO control. It balances individual customer behavior patterns with organizational cash flow targets to maximize payment conversion while minimizing collector workload and customer fatigue.

### Key Capabilities

- **Composite Scoring**: Multi-factor prioritization combining payment probability, friction cost, risk, and portfolio urgency
- **Portfolio DSO Control**: Nightly urgency rebalancing to hit organizational DSO targets (e.g., 45 days)
- **Behavioral Learning**: Learns from historical payment patterns to predict future behavior
- **Dynamic Channel Selection**: Chooses optimal communication channel (email, SMS, WhatsApp, voice) based on response rates
- **Safety Constraints**: Enforces quiet hours, frequency caps, dispute pauses, and manual overrides
- **Cold-Start Intelligence**: Uses segment priors for new customers without payment history
- **Explainable AI**: Every decision includes human-readable reasoning for transparency and trust

### Production Features

- **Automated Workflows**: Nightly DSO control (2am) and 6-hour action planning cycles
- **Manual Control**: Override system for special cases requiring human intervention
- **Real-time Monitoring**: Portfolio health dashboard with DSO metrics and urgency factors
- **Cross-Tenant Learning**: Data foundation for future machine learning improvements
- **Constraint Enforcement**: Prevents automation fatigue with daily limits and quiet hours

---

## System Architecture

### Phase 3: Portfolio-Level Optimization (Current)

The scheduler has evolved through multiple phases:

1. **Phase 1**: Static rule-based scheduling
2. **Phase 2**: Individual behavioral scoring
3. **Phase 3**: Portfolio DSO control with urgency adjustment ✅ **CURRENT**
4. **Phase 4**: Cross-tenant learning with reinforcement learning (planned)

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│               PORTFOLIO DSO CONTROLLER                  │
│  (Nightly: Adjust urgency ±10% based on projected DSO) │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│                  ACTION PLANNER                         │
│     (Every 6h: Score all overdue invoices → actions)   │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│              COMPOSITE SCORING ENGINE                   │
│  Score = α·P(pay) - β·Friction - γ·Risk + δ·Urgency    │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│               SAFETY CONSTRAINTS                        │
│  Quiet hours | Frequency caps | Overrides | Disputes   │
└─────────────────────┬───────────────────────────────────┘
                      ↓
                 CREATE ACTION
```

---

## Adaptive Scheduler Components

### 1. Composite Scoring Engine
**File:** `server/lib/adaptive-scheduler.ts`

The core intelligence uses a **composite scoring formula** that balances multiple objectives:

```typescript
Score = α·P(pay) - β·Friction - γ·Risk + δ·UrgencyBoost

where:
  P(pay)   = Payment probability (0-100)
  Friction = Customer friction cost (0-100)
  Risk     = Collection risk markers (0-100)
  Urgency  = Portfolio urgency factor × urgency weight
  
  α = 0.35  (payment probability weight)
  β = 0.25  (friction weight)
  γ = 0.20  (risk weight)
  δ = 0.20  (urgency weight, includes portfolio adjustment)
```

#### P(pay): Payment Probability Score
Estimates likelihood of payment based on customer behavior:

```typescript
P(pay) = 
  daysOverdueScore * 0.4 +        // More overdue = higher urgency
  behaviorDeviationScore * 0.3 +   // Deviating from pattern = needs attention
  amountSensitivityScore * 0.2 +   // Amount-specific payment speed
  trendScore * 0.1                 // Improving/declining trend

// Example: 45-day overdue invoice, customer usually pays in 30 days
P(pay) = 60 + 25 + 15 + 5 = 85
```

#### Friction: Customer Experience Cost
Penalizes actions that cause customer friction:

```typescript
Friction =
  contactRecencyPenalty +          // Penalty for recent contact
  channelIntrusivenessPenalty +    // Voice > SMS > Email
  frequencyPenalty                 // Penalty if contacted frequently

// Example: Last contact 2 days ago, voice call planned, 3 contacts in 7 days
Friction = 30 + 20 + 15 = 65 (reduces score)
```

#### Risk: Collection Risk Markers
Flags high-risk collection scenarios:

```typescript
Risk =
  disputeRisk * 40 +               // Active disputes block action
  promiseBreachRisk * 30 +         // Broken promises = higher risk
  partialPaymentRisk * 20 +        // Partial payers need special handling
  volatilityRisk * 10              // Unpredictable payment patterns

// Example: 1 dispute, 0 breaches, 2 partial payments
Risk = 40 + 0 + 40 + 5 = 85 (reduces score significantly)
```

#### Urgency: Portfolio Adjustment
Dynamic urgency factor adjusted nightly by Portfolio Controller:

```typescript
urgencyFactor ∈ [0.1, 1.0]  // Bounded to prevent automation shutdown

UrgencyBoost = urgencyFactor * urgencyWeight * 100

// Example: Portfolio behind target, urgency = 0.8
UrgencyBoost = 0.8 * 0.20 * 100 = 16 (increases all scores)
```

**Critical Safety**: Urgency bounded at `≥ 0.1` to prevent total automation shutdown when portfolio is ahead of DSO target.

---

### 2. Portfolio DSO Controller
**File:** `server/services/portfolioController.ts`

Controls collection intensity across the entire portfolio to meet DSO targets.

#### Control Loop (Runs Nightly at 2am)

```typescript
1. Calculate projected DSO for tenant
   projectedDSO = Σ(invoice_amount × expected_days_to_pay) / total_AR

2. Compare to target DSO (from workflow settings)
   deviation = projectedDSO - targetDSO

3. Adjust urgency factor:
   if (projectedDSO > targetDSO + 1):
     urgencyFactor = min(1.0, urgencyFactor + 0.1)  // Increase urgency
   
   elif (projectedDSO < targetDSO - 1):
     urgencyFactor = max(0.1, urgencyFactor - 0.1)  // Decrease urgency
   
   else:
     urgencyFactor = unchanged  // On target

4. Persist to scheduler_state table and workflow settings
```

#### Example Scenario

**Tenant**: ABC Corp  
**Target DSO**: 45 days  
**Current Projected DSO**: 52 days  

```
Night 1: DSO 52 → urgency 0.5 + 0.1 = 0.6 (increase pressure)
Night 2: DSO 50 → urgency 0.6 + 0.1 = 0.7 (continue increasing)
Night 3: DSO 46 → urgency 0.7 (hold steady)
Night 4: DSO 44 → urgency 0.7 - 0.1 = 0.6 (reduce pressure)
Night 5: DSO 45 → urgency 0.6 (on target)
```

**Benefits:**
- Automatic adjustment to market conditions
- Prevents over-collection (customer fatigue)
- Prevents under-collection (cash flow risk)
- Maintains DSO target without manual intervention

---

### 3. Action Planner
**File:** `server/services/actionPlanner.ts`

Orchestrates adaptive scheduling workflow with safety constraints.

#### Planning Flow (Every 6 Hours)

```typescript
async function planAdaptiveActions(tenantId, scheduleId) {
  // 1. Get all overdue invoices
  const invoices = await getOverdueInvoices(tenantId);
  
  // 2. Get current urgency factor from scheduler state
  const urgencyFactor = await getUrgencyFactor(tenantId, scheduleId);
  
  // 3. Score each invoice
  const scored = [];
  for (const invoice of invoices) {
    // Check safety constraints FIRST
    if (hasActiveDispute(invoice)) continue;        // Dispute pause
    if (hasManualOverride(invoice)) continue;       // Override protection
    if (recentAction(invoice, 24h)) continue;       // Frequency cap
    if (inQuietHours()) continue;                   // Quiet hours
    if (dailyLimitReached(invoice)) continue;       // Daily touch limit
    
    // Calculate composite score
    const score = await scheduleNextAction(
      invoice,
      contact,
      signals,
      urgencyFactor  // Portfolio adjustment
    );
    
    if (score.finalScore >= threshold) {
      scored.push({
        invoiceId: invoice.id,
        contactId: invoice.contactId,
        priority: score.finalScore,
        channel: score.bestChannel,
        reasoning: score.reasoning
      });
    }
  }
  
  // 4. Create actions for high-scoring invoices
  await createActions(scored);
  
  return {
    totalInvoices: invoices.length,
    actionsCreated: scored.length,
    avgScore: average(scored.map(s => s.priority))
  };
}
```

#### Constraint Enforcement

**Quiet Hours**: No contact between `quietHoursStart` and `quietHoursEnd`
```typescript
settings.quietHoursStart = "20:00"
settings.quietHoursEnd = "08:00"
// No actions created 8pm-8am
```

**Frequency Cap**: Max 3 contacts per customer per 7 days
```typescript
if (countRecentActions(contactId, 7days) >= 3) {
  return null; // Skip this invoice
}
```

**Daily Touch Limit**: Max `maxDailyTouches` per customer per day
```typescript
settings.maxDailyTouches = 2
if (countTodayActions(contactId) >= 2) {
  return null; // Skip this invoice
}
```

**Dispute Pause**: No automated contact for disputed invoices
```typescript
if (invoice.disputeStatus === 'under_review') {
  return null; // Human handling required
}
```

**Override Protection**: Manual overrides block automation
```typescript
if (invoice.collectionOverride === 'do_not_contact') {
  return null; // Respect manual override
}
```

---

### 4. Signal Collector
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

---

## Data Model

### Scheduler State
**Table:** `schedulerState`

Stores portfolio-level urgency factors and projected DSO per tenant/schedule.

```typescript
{
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  scheduleId: varchar("schedule_id"),  // Nullable for tenant-wide state
  
  // Portfolio metrics
  dsoProjected: varchar("dso_projected"),       // "52.3"
  urgencyFactor: varchar("urgency_factor"),     // "0.7" ∈ [0.1, 1.0]
  
  // Metadata
  lastComputedAt: timestamp("last_computed_at"),
  computationMetadata: jsonb("computation_metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}
```

**Computation Metadata Example:**
```json
{
  "totalInvoices": 247,
  "totalAR": 1250000,
  "weightedDaysSum": 65275000,
  "buckets": {
    "0-30": 120,
    "31-60": 80,
    "61-90": 35,
    "90+": 12
  }
}
```

### Workflows
**Table:** `workflows`

Defines scheduling configuration with adaptive settings.

```typescript
{
  id: varchar("id").primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  name: varchar("name").notNull(),
  
  // Scheduling Mode
  schedulerType: varchar("scheduler_type"),  // "static" | "adaptive"
  
  // Adaptive Configuration
  adaptiveSettings: jsonb("adaptive_settings")
}
```

**Adaptive Settings Schema:**
```json
{
  "targetDSO": 45,              // Target days sales outstanding
  "urgencyFactor": 0.7,          // Current urgency (synced from schedulerState)
  "maxDailyTouches": 2,          // Max contacts per customer/day
  "quietHoursStart": "20:00",    // No contact after 8pm
  "quietHoursEnd": "08:00",      // No contact before 8am
  "channelPreferences": [        // Allowed channels
    "email",
    "sms",
    "voice"
  ],
  "minScoreThreshold": 40,       // Min score to create action
  "enablePortfolioControl": true // Enable nightly DSO adjustment
}
```

### Customer Behavior Signals
**Table:** `customerBehaviorSignals`

Stores aggregated behavioral analytics per contact.

```typescript
{
  id: varchar("id").primaryKey(),
  contactId: varchar("contact_id").notNull(),
  tenantId: varchar("tenant_id").notNull(),
  
  // Payment Behavior
  medianDaysToPay: varchar("median_days_to_pay"),     // "14.5"
  p75DaysToPay: varchar("p75_days_to_pay"),           // "21.0"
  volatility: varchar("volatility"),                   // "5.2" (std dev)
  trend: varchar("trend"),                             // "-2.3" (negative = improving)
  amountSensitivity: jsonb("amount_sensitivity"),      // Days by amount bucket
  
  // Channel Effectiveness
  emailOpenRate: varchar("email_open_rate"),           // "0.65"
  emailClickRate: varchar("email_click_rate"),         // "0.32"
  emailReplyRate: varchar("email_reply_rate"),         // "0.15"
  smsReplyRate: varchar("sms_reply_rate"),             // "0.22"
  whatsappReplyRate: varchar("whatsapp_reply_rate"),   // "0.28"
  voiceAnswerRate: varchar("voice_answer_rate"),       // "0.40"
  
  // Risk Markers
  disputeCount: integer("dispute_count"),
  promiseBreachCount: integer("promise_breach_count"),
  partialPaymentCount: integer("partial_payment_count"),
  
  // Metadata
  invoiceCount: integer("invoice_count"),              // Sample size
  lastPaymentDate: timestamp("last_payment_date"),
  lastContactDate: timestamp("last_contact_date"),
  segmentPrior: varchar("segment_prior")               // "early_payer" | "moderate" | "late_payer"
}
```

---

## Adaptive Scheduling Algorithm

### Complete Scoring Flow

```typescript
async function scheduleNextAction(
  invoice: Invoice,
  contact: Contact,
  signals: BehaviorSignals,
  urgencyFactor: number  // From portfolio controller [0.1, 1.0]
): Promise<ScoringResult> {
  
  // 1. Calculate P(pay) - Payment Probability
  const daysOverdue = daysSince(invoice.dueDate);
  const expectedDays = signals.amountSensitivity[getBucket(invoice.amount)] 
                       || signals.medianDaysToPay;
  const deviation = daysOverdue - expectedDays;
  
  const ppay = 
    (daysOverdue / 90) * 40 +           // Urgency component
    (deviation / expectedDays) * 30 +   // Deviation from pattern
    (invoice.amount / avgAmount) * 20 + // Amount sensitivity
    (signals.trend < 0 ? 10 : -10);     // Trend bonus/penalty
  
  // 2. Calculate Friction - Customer Experience Cost
  const lastActionDays = daysSince(contact.lastActionDate);
  const recentActions = countActions(contact.id, 7days);
  
  const friction =
    (lastActionDays < 3 ? 30 : 0) +     // Recent contact penalty
    (channel === 'voice' ? 20 : 0) +    // Intrusive channel penalty
    (recentActions * 10);                // Frequency penalty
  
  // 3. Calculate Risk - Collection Risk Markers
  const risk =
    signals.disputeCount * 40 +
    signals.promiseBreachCount * 30 +
    signals.partialPaymentCount * 20 +
    signals.volatility * 1;
  
  // 4. Calculate Urgency Boost - Portfolio Adjustment
  const urgencyBoost = urgencyFactor * 20 * 100;  // Weight δ = 0.20
  
  // 5. Composite Score
  const finalScore = 
    ppay * 0.35 -       // α (maximize payment probability)
    friction * 0.25 -   // β (minimize friction)
    risk * 0.20 +       // γ (minimize risk)
    urgencyBoost;       // δ (portfolio urgency)
  
  // 6. Channel Selection
  const bestChannel = selectBestChannel(
    signals,
    settings.channelPreferences
  );
  
  return {
    finalScore,
    bestChannel,
    reasoning: {
      ppay,
      friction,
      risk,
      urgencyBoost,
      urgencyFactor,
      explanation: `Score ${finalScore.toFixed(1)}: ${daysOverdue}d overdue, ` +
                   `expected ${expectedDays}d, urgency ${urgencyFactor.toFixed(2)}`
    }
  };
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

## Automation & Cron Jobs

### Nightly Portfolio Control
**Schedule:** Every day at 2:00 AM  
**File:** `server/index.ts`

```typescript
cron.schedule('0 2 * * *', async () => {
  console.log('[Cron] Running nightly portfolio controller...');
  const result = await runNightly();  // portfolioController.runNightly()
  
  console.log(
    `[Cron] Portfolio control complete: ` +
    `${result.processedTenants} tenants, ` +
    `${result.adjustedTenants} adjusted`
  );
});
```

### Action Planning
**Schedule:** Every 6 hours (00:00, 06:00, 12:00, 18:00)  
**File:** `server/index.ts`

```typescript
cron.schedule('0 */6 * * *', async () => {
  console.log('[Cron] Running adaptive action planning...');
  
  // Find all active adaptive workflows
  const workflows = await getActiveAdaptiveWorkflows();
  
  for (const workflow of workflows) {
    const result = await planAdaptiveActions(
      workflow.tenantId,
      workflow.id
    );
    
    console.log(
      `[Cron] Planned ${result.actionsCreated} actions ` +
      `for ${workflow.name} (avg score: ${result.avgScore})`
    );
  }
});
```

---

## API Endpoints

### Portfolio Health
Get real-time DSO metrics and urgency factors.

```http
GET /health/portfolio?tenantId=<tenant_id>

Response:
{
  "tenantId": "tenant_123",
  "schedules": [
    {
      "scheduleId": "workflow_456",
      "scheduleName": "High-Value Adaptive",
      "targetDSO": 45,
      "projectedDSO": 48.3,
      "urgencyFactor": 0.7,
      "lastAdjusted": "2025-10-20T02:00:00Z",
      "metadata": {
        "totalInvoices": 247,
        "totalAR": 1250000
      }
    }
  ]
}
```

### Calculate Adaptive Actions
Manually trigger action planning for a schedule.

```http
POST /api/adaptive-scheduler/calculate-actions
Content-Type: application/json

{
  "tenantId": "tenant_123",
  "scheduleId": "workflow_456"
}

Response:
{
  "actions": [
    {
      "contactId": "contact_789",
      "invoiceId": "invoice_101",
      "priority": 72.4,
      "recommendedChannel": "sms",
      "suggestedDate": "2025-10-20T14:30:00Z",
      "reasoning": {
        "ppay": 65,
        "friction": 15,
        "risk": 25,
        "urgencyBoost": 14,
        "urgencyFactor": 0.7,
        "explanation": "Score 72.4: 45d overdue, expected 30d, urgency 0.70"
      }
    }
  ],
  "summary": {
    "totalInvoices": 247,
    "actionsCreated": 89,
    "avgScore": 68.2
  }
}
```

### Manual Override
Block or force automation for specific invoice.

```http
POST /api/invoices/:invoiceId/override
Content-Type: application/json

{
  "action": "do_not_contact",  // or "force_contact"
  "reason": "Customer requested no contact",
  "expiresAt": "2025-11-01T00:00:00Z"  // Optional
}

Response:
{
  "success": true,
  "invoiceId": "invoice_101",
  "override": {
    "action": "do_not_contact",
    "reason": "Customer requested no contact",
    "setBy": "user_456",
    "setAt": "2025-10-20T10:30:00Z"
  }
}
```

### Refresh Behavioral Signals
Manually refresh signals for contact or tenant.

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

---

## Manual Operation Scripts

### Plan Actions Once
Manually run action planning for testing.

```bash
npx tsx scripts/plan-once.ts <tenantId> <scheduleId>

# Example
npx tsx scripts/plan-once.ts tenant_123 workflow_456

Output:
✓ Loaded schedule: High-Value Adaptive (adaptive mode)
✓ Found 247 overdue invoices
✓ Created 89 recommended actions
  Avg score: 68.2
  Channel distribution: Email 45, SMS 32, Voice 12
```

### Run DSO Controller Once
Manually run portfolio controller for testing.

```bash
npx tsx scripts/controller-once.ts

Output:
✓ Processed 3 tenants
  tenant_123: DSO 48.3 / target 45, urgency 0.6 → 0.7
  tenant_456: DSO 42.1 / target 45, urgency 0.5 → 0.5 (on target)
  tenant_789: DSO 51.2 / target 50, urgency 0.8 → 0.9
```

---

## Configuration Guide

### Setting Up Adaptive Scheduling

**UI:** Collection Schedules Builder  
**Location:** `/workflows/schedules`

```typescript
// Create adaptive workflow
{
  name: "High-Value Adaptive",
  schedulerType: "adaptive",
  adaptiveSettings: {
    targetDSO: 45,              // Target days sales outstanding
    urgencyFactor: 0.5,          // Initial urgency (auto-adjusted nightly)
    maxDailyTouches: 2,          // Max 2 contacts/day per customer
    quietHoursStart: "20:00",    // No contact after 8pm
    quietHoursEnd: "08:00",      // No contact before 8am
    channelPreferences: [        // Allowed channels
      "email",
      "sms", 
      "voice"
    ],
    minScoreThreshold: 40,       // Only create actions >= score 40
    enablePortfolioControl: true // Enable nightly urgency adjustment
  }
}
```

### Tuning Parameters

**targetDSO**: Lower = more aggressive collection
- Conservative: 50-60 days
- Balanced: 40-50 days
- Aggressive: 30-40 days

**minScoreThreshold**: Higher = fewer, higher-priority actions
- Permissive: 30-40
- Balanced: 40-60
- Selective: 60-80

**maxDailyTouches**: Balance coverage vs. customer fatigue
- Low pressure: 1
- Moderate: 2-3
- High volume: 4-5

---

## Performance Considerations

### Scoring Performance
- Composite scoring: O(1) per invoice
- Typical tenant (1000 overdue invoices): ~200ms total
- Runs asynchronously in background jobs

### Portfolio Controller
- DSO calculation: O(n) where n = invoice count
- Typical tenant (1000 invoices): ~100ms
- Runs once nightly, minimal impact

### Database Queries
- `schedulerState` indexed on `(tenant_id, schedule_id)`
- `customerBehaviorSignals` indexed on `(contact_id, tenant_id)`
- `invoices` composite index on `(tenant_id, status, due_date)`
- Action creation uses batch inserts

---

## Monitoring & Observability

### Key Metrics

**Portfolio Health:**
- Projected DSO vs. target DSO
- Urgency factor trend
- Actions created per planning cycle
- Average action score

**Signal Quality:**
- % of contacts with behavioral signals
- Average sample size (invoice count) per signal
- Signal staleness (time since last update)

**Collection Effectiveness:**
- Payment rate by recommended channel
- Action completion rate by priority band
- DSO improvement over time

### Console Logging

```typescript
// Portfolio controller
[Portfolio Controller] Starting nightly run...
[Portfolio Controller] Found 3 tenants with adaptive scheduling
[Portfolio Controller] Tenant tenant_123: DSO 48.3 > target 45, increasing urgency 0.60 → 0.70
[Portfolio Controller] ✓ Tenant tenant_123: DSO 48.3 / target 45, urgency 0.70

// Action planner
[Action Planner] Planning actions for tenant_123 (workflow_456)
[Action Planner] Found 247 overdue invoices
[Action Planner] Urgency factor: 0.70
[Action Planner] Created 89 actions (avg score: 68.2)

// Adaptive scheduler
[Adaptive Scheduler] Scoring invoice invoice_101: 45d overdue, $2500
[Adaptive Scheduler] → Score 72.4: ppay=65, friction=15, risk=25, urgency=14
[Adaptive Scheduler] → Recommended: SMS (reply rate 0.28)
```

---

## Troubleshooting

### Urgency Factor Not Adjusting

**Symptoms:** `urgencyFactor` stays at 0.5 despite DSO deviation

**Causes:**
1. `enablePortfolioControl` set to `false`
2. Nightly cron job not running
3. No adaptive workflows found

**Solutions:**
```bash
# Check scheduler state
SELECT * FROM scheduler_state WHERE tenant_id = 'tenant_123';

# Manually run controller
npx tsx scripts/controller-once.ts

# Enable portfolio control
UPDATE workflows 
SET adaptive_settings = jsonb_set(
  adaptive_settings, 
  '{enablePortfolioControl}', 
  'true'
)
WHERE id = 'workflow_456';
```

### No Actions Created

**Symptoms:** Action planner runs but creates 0 actions

**Causes:**
1. All scores below `minScoreThreshold`
2. Safety constraints blocking all invoices
3. No overdue invoices
4. All invoices have active disputes/overrides

**Solutions:**
```bash
# Check overdue invoices
SELECT COUNT(*) FROM invoices 
WHERE tenant_id = 'tenant_123' 
AND status = 'outstanding'
AND due_date < NOW();

# Lower threshold temporarily
UPDATE workflows
SET adaptive_settings = jsonb_set(
  adaptive_settings,
  '{minScoreThreshold}',
  '30'
)
WHERE id = 'workflow_456';

# Run manually and check logs
npx tsx scripts/plan-once.ts tenant_123 workflow_456
```

### DSO Calculation Incorrect

**Symptoms:** Projected DSO doesn't match expected value

**Causes:**
1. Missing payment signals for contacts
2. Incorrect `medianDaysToPay` in signals
3. Invoice amounts in wrong currency format

**Solutions:**
```bash
# Check signal coverage
SELECT 
  COUNT(DISTINCT i.contact_id) AS total_contacts,
  COUNT(DISTINCT s.contact_id) AS contacts_with_signals
FROM invoices i
LEFT JOIN customer_behavior_signals s 
  ON i.contact_id = s.contact_id
WHERE i.tenant_id = 'tenant_123';

# Refresh signals
POST /api/signals/refresh
{
  "tenantId": "tenant_123"
}

# Check DSO metadata
GET /health/portfolio?tenantId=tenant_123
```

---

## Future Enhancements

### Phase 4: Cross-Tenant Learning (Planned)

**Reinforcement Learning:**
- Track actual payment outcomes for each recommended action
- Use outcome data to refine scoring weights (α, β, γ, δ)
- A/B test different scoring algorithms
- Learn optimal urgency adjustment rates

**Multi-Tenant Intelligence:**
- Segment priors learned from all tenants (privacy-preserved)
- Industry-specific payment behavior models
- Seasonal pattern detection across customer base

**Advanced Optimization:**
- Multi-invoice bundling for same customer
- Time-of-day optimization per contact
- Predictive payment propensity (ML model)
- Confidence intervals for DSO forecasts

### Research Areas

- **Contextual Bandits**: Dynamic channel selection with exploration/exploitation
- **Survival Analysis**: Model time-to-payment distributions
- **Causal Inference**: Measure true lift from automated actions vs. baseline

---

## Related Documentation

- [ADAPTIVE_SCHEDULER.md](./ADAPTIVE_SCHEDULER.md) - Technical implementation guide
- [PAYMENT_SIGNALS.md](./PAYMENT_SIGNALS.md) - Deep dive into signal collection system
- [SECURITY.md](./SECURITY.md) - Webhook security and authentication
- [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) - Code patterns and setup
- [replit.md](./replit.md) - System architecture overview

---

**Questions?** See [DEVELOPER_HANDOVER.md](./DEVELOPER_HANDOVER.md) for troubleshooting or contact the development team.
