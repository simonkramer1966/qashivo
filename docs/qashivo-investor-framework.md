# Qashivo: AI-First Autonomous Cashflow Management

## Executive Summary

Qashivo is an AI-first autonomous cashflow management platform for UK SMEs. Our core positioning: **"Qashivo IS the credit controller"** — autonomous AI agents that execute collections work while business owners supervise. Unlike traditional credit control software where users spend 2-3 hours daily executing tasks, Qashivo users spend just 10 minutes daily supervising AI-driven collections.

**Target Market**: UK SMEs using cloud accounting (Xero)  
**Launch Target**: MVP ready December 15, 2025; 10 paying customers by mid-January 2026

---

## Part 1: Platform Overview

### The Problem

Small and medium businesses lose significant revenue to late payments. The traditional approach requires:
- **Manual effort**: 2-3 hours daily chasing invoices
- **Inconsistent follow-up**: Important invoices fall through the cracks
- **Delayed escalation**: Slow to identify and act on problem accounts
- **Poor visibility**: No clear view of collection performance

### The Qashivo Solution

Qashivo transforms credit control from a labor-intensive chore into a supervised AI operation:

| Traditional Model | Qashivo Model |
|-------------------|---------------|
| User executes manually | AI executes autonomously |
| 2-3 hours daily | 10 minutes daily supervision |
| Reactive follow-up | Proactive, systematic coverage |
| Inconsistent messaging | Professional, escalating tone |
| Manual channel switching | Intelligent multi-channel orchestration |

### Key Differentiators

1. **60-Second Xero Connect**: Instant sync with one-click OAuth, immediate AI analysis of outstanding invoices
2. **Supervised Autonomy**: AI plans overnight → User approves daily → AI executes throughout the day
3. **Multi-Channel Execution**: Email, SMS, and AI voice calls with consistent messaging
4. **Intelligent Prioritization**: Risk-based scoring ensures the right invoices get attention first

---

## Part 2: Charlie AI — The Decision Engine

Charlie is Qashivo's autonomous credit control AI. Charlie doesn't just recommend actions — Charlie IS the credit controller, executing collections work while users supervise.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CHARLIE AI ENGINE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │  State Machine  │───▶│ Decision Engine │───▶│ Action Executor │ │
│  │  (12 States)    │    │ (Prioritization)│    │ (Multi-Channel) │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│           │                      │                      │           │
│           ▼                      ▼                      ▼           │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ Invoice Intake  │    │   Playbook      │    │ Outcome Capture │ │
│  │ (Xero Sync)     │    │ (Templates/Tone)│    │ (Intent Analysis)│ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### The 12-State Invoice Machine

Every invoice follows a defined lifecycle managed by Charlie's state machine:

| State | Description | Automation |
|-------|-------------|------------|
| `issued` | Invoice sent, awaiting acknowledgment | ✅ Automated |
| `delivered` | Customer confirmed receipt | ✅ Automated |
| `due_soon` | Pre-due reminder (high value/new customers) | ✅ Automated |
| `due` | Payment due date reached | ✅ Automated |
| `overdue` | Past due, in collection cadence | ✅ Automated |
| `admin_blocked` | Missing PO, wrong address, etc. | ⏸️ Paused |
| `disputed` | Customer raised a dispute | ⏸️ Human Review |
| `ptp` | Promise to Pay received | ✅ Monitoring |
| `ptp_met` | Payment received as promised | ✅ Terminal |
| `ptp_missed` | PTP deadline passed without payment | ✅ Escalation |
| `final_demand` | Pre-action letter sent | 👤 Human Approval |
| `debt_recovery` | Passed to collections/legal | 👤 Human-Led |

**State Transitions**: Charlie automatically transitions invoices between states based on:
- Time (due dates, PTP deadlines)
- Customer responses (disputes, promises)
- Payment events (Xero sync)
- User actions (manual overrides)

### Customer Segmentation

Charlie adapts its approach based on customer segment:

| Segment | Characteristics | Approach |
|---------|-----------------|----------|
| `new_customer` | < 90 days relationship | Tighter follow-up, confirm AP process |
| `good_payer` | High behavioral score (80+) | Friendly tone, assume admin slip |
| `chronic_late_payer` | Low behavioral score (< 30) | Shorter cadence, earlier escalation |
| `enterprise` | Credit limit > £50K | Process-driven, PO/portal focus |
| `small_business` | Credit limit < £5K | Phone effective, cashflow-driven |

### Priority Scoring

Charlie calculates priority scores (0-100) using multiple factors:

**Priority Tiers:**
- **Critical (95+)**: Missed PTP — requires immediate follow-up
- **High (75-94)**: 60+ days overdue high value, or 30-60 days moderate value
- **Medium (50-74)**: Newly overdue high value, or new customer invoices
- **Low (< 50)**: Standard follow-up cadence

**Scoring Factors:**
- Days overdue (weight: 40 points max)
- Invoice value (weight: 15 points for high value)
- Contact recency (weight: 15 points if no contact in 14+ days)
- Escalation stage (weight: 20 points for final demand)

### Channel Selection Logic

Charlie follows a mandated progression: **Email → SMS → Voice**

```
Step 1: First Touch
└── Always Email (audit trail)
    └── If no email: SMS

Step 2: No Response (48-72 hours)
└── SMS nudge
    └── If no phone: Follow-up email

Step 3: Extended Non-Response (5+ days)
└── Voice call (if high value or 30+ days overdue)
    └── Otherwise: Continue SMS

Voice Calls Allowed When:
├── Missed PTP (after prior contact attempts)
├── Extended non-response with 2+ prior attempts
└── High value/aged debt with prior attempts
```

### Tone Progression

Charlie escalates tone based on invoice state:

| Stage | Tone Profile | Voice Tone |
|-------|--------------|------------|
| Due Soon → Early Overdue | Friendly, helpful | Calm, collaborative |
| Mid Overdue | Professional, firm | Matter-of-fact |
| Late Overdue → Final | Formal, direct | Serious, formal |

### Cadence Rules

Minimum intervals between contacts (by channel):

| Segment | Email | SMS | Voice | Max Weekly |
|---------|-------|-----|-------|------------|
| Standard | 3 days | 2 days | 5 days | 5 contacts |
| Good Payer | 5 days | 3 days | 7 days | 3 contacts |
| Chronic Late | 2 days | 1 day | 3 days | 7 contacts |
| Enterprise | 5 days | 4 days | 7 days | 3 contacts |

---

## Part 3: Supervised Autonomy Model

### The Key Differentiator

**Traditional Credit Control Software**: User executes tasks, software assists
**Qashivo**: AI executes tasks, user supervises

This is not semantic — it's a fundamental shift in the operating model.

### Daily Workflow Comparison

| Time | Traditional (2-3 hours) | Qashivo (10 minutes) |
|------|------------------------|----------------------|
| Morning | Review overdue list, plan calls | Review AI's daily plan, approve |
| Throughout Day | Make calls, send emails, log notes | AI executes approved actions |
| End of Day | Update records, plan tomorrow | Review AI results, handle exceptions |

### The Supervised Autonomy Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DAILY AUTONOMY CYCLE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│     ┌──────────────┐                                                │
│     │   OVERNIGHT  │                                                │
│     │  Charlie     │                                                │
│     │  generates   │                                                │
│     │  daily plan  │                                                │
│     └──────┬───────┘                                                │
│            │                                                         │
│            ▼                                                         │
│     ┌──────────────┐        ┌──────────────┐                        │
│     │   MORNING    │        │  Exception?  │──Yes──▶ Human Review   │
│     │  User reviews│───────▶│  Flagged?    │                        │
│     │  & approves  │        └──────────────┘                        │
│     └──────┬───────┘               │ No                             │
│            │                       ▼                                 │
│            │              ┌──────────────┐                          │
│            └─────────────▶│  ALL DAY     │                          │
│                           │  Charlie     │                          │
│                           │  executes    │                          │
│                           │  actions     │                          │
│                           └──────┬───────┘                          │
│                                  │                                   │
│                                  ▼                                   │
│                           ┌──────────────┐                          │
│                           │   EVENING    │                          │
│                           │  Results &   │                          │
│                           │  outcomes    │                          │
│                           │  captured    │                          │
│                           └──────────────┘                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Approval Modes

Users can configure their preferred level of oversight:

| Mode | Description | Best For |
|------|-------------|----------|
| **Approve All** | Every action requires approval | New users, high-risk accounts |
| **Approve Exceptions** | Only flagged items need review | Confident users |
| **Full Autonomy** | AI executes within policy limits | Trusted, established flow |

### Exception Flagging

Charlie automatically flags actions for human review when:

- **First contact with high-value customer** (> £10K)
- **Disputed invoices** (all disputes require human input)
- **VIP/sensitive accounts** (marked by user)
- **Low confidence decisions** (< 70% confidence score)
- **Escalation to final demand** (requires approval)
- **Repeated non-response** (pattern change detection)

### Policy Configuration

Users set guardrails for Charlie's autonomy:

```typescript
AutomationPolicy {
  approvalMode: 'approve_all' | 'approve_exceptions' | 'full_autonomy'
  executionTime: '09:00' // When AI starts executing
  dailyLimits: {
    maxEmails: 50,
    maxSms: 25,
    maxCalls: 10
  }
  minConfidence: 0.7 // Actions below this are flagged
  exceptionRules: [
    { type: 'first_contact_high_value', threshold: 10000 },
    { type: 'dispute', always: true },
    { type: 'escalation', always: true }
  ]
}
```

---

## Part 4: Integration Architecture

### Overview

Qashivo integrates with best-in-class services for each channel:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INTEGRATION ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐                              ┌─────────────┐       │
│  │    XERO     │◀────── Accounting Data ─────▶│   Qashivo   │       │
│  │  (OAuth 2)  │        Invoice Sync          │   Platform  │       │
│  └─────────────┘        Payment Detection     └──────┬──────┘       │
│                                                      │               │
│                                                      │               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │               │
│  │  SendGrid   │  │   Vonage    │  │  Retell AI  │  │               │
│  │   (Email)   │  │ (SMS/WhatsApp)│ │  (Voice)   │◀─┘               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         │                │                │                          │
│         ▼                ▼                ▼                          │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │                     CUSTOMERS                            │        │
│  │   Email + SMS + Voice → Consistent Multi-Channel         │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                      │
│  ┌─────────────┐                              ┌─────────────┐       │
│  │   Stripe    │◀────── Payment Processing ──▶│ Debtor      │       │
│  │  (Payments) │        Self-Service Portal   │ Portal      │       │
│  └─────────────┘                              └─────────────┘       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Xero Integration

**Purpose**: Sync invoices, contacts, and payment data

| Feature | Description |
|---------|-------------|
| OAuth 2.0 | Secure one-click connection |
| Real-time sync | Invoice and payment updates |
| Two-way | Read invoices, write notes |
| Multi-org | Support for multiple Xero organizations |

**Data Synced:**
- Invoices (outstanding, overdue, paid)
- Contacts (name, email, phone)
- Payments (for PTP resolution)
- Credit notes and adjustments

### SendGrid (Email)

**Purpose**: Professional email delivery with tracking

| Feature | Description |
|---------|-------------|
| Template support | Dynamic personalization |
| Delivery tracking | Open, click, bounce |
| Reputation management | Sender authentication |
| Scheduled sending | Optimal timing |

### Vonage (SMS/WhatsApp)

**Purpose**: Direct mobile messaging

| Feature | Description |
|---------|-------------|
| SMS delivery | Global reach |
| WhatsApp Business | Rich messaging (roadmap) |
| Delivery reports | Read receipts |
| Two-way | Inbound response capture |

### Retell AI (Voice)

**Purpose**: AI-powered voice calls with natural conversation

| Feature | Description |
|---------|-------------|
| Natural language | Conversational AI agent |
| Dynamic scripts | Adapt to invoice context |
| Intent capture | Detect PTP, disputes, objections |
| Call recording | Compliance and audit trail |

**Voice Script Variables:**
- Customer name
- Invoice number and amount
- Days overdue
- Previous contact history
- Payment options

### Stripe (Payments)

**Purpose**: Enable immediate payment through debtor portal

| Feature | Description |
|---------|-------------|
| Card payments | Instant settlement |
| Bank transfer | ACH/BACS support |
| Payment links | One-click pay from email/SMS |
| Partial payments | Flexible payment plans |

---

## Part 5: Bayesian Cashflow Forecasting

### The Problem with Traditional Cashflow Forecasting

Most SME owners either:
- **Don't forecast at all** — too complex, requires spreadsheet expertise
- **Use static spreadsheets** — manually updated, quickly outdated, time-consuming
- **Hire accountants** — expensive, still requires regular input and meetings

What they need: **Accurate forecasts that update automatically without ongoing effort.**

### The Qashivo Approach: Bayesian Forecasting + Machine Learning

Qashivo ingests **all Xero data** and applies Bayesian statistical models combined with machine learning to forecast both **cash inflows** and **cash outflows** — providing a complete picture of future cash position.

```
┌─────────────────────────────────────────────────────────────────────┐
│              BAYESIAN CASHFLOW FORECASTING ENGINE                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    XERO DATA INGESTION                       │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │    │
│  │  │ Invoices │  │  Bills   │  │  Bank    │  │ Recurring│    │    │
│  │  │   (AR)   │  │  (AP)    │  │  Trans   │  │  Items   │    │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │    │
│  └───────┼─────────────┼─────────────┼─────────────┼──────────┘    │
│          │             │             │             │                 │
│          ▼             ▼             ▼             ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              BAYESIAN PATTERN RECOGNITION                    │    │
│  │                                                              │    │
│  │  • Customer payment timing distributions                     │    │
│  │  • Supplier payment patterns                                 │    │
│  │  • Overhead recurrence detection                             │    │
│  │  • Seasonal trend identification                             │    │
│  │  • Uncertainty quantification (confidence bands)             │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    FORECAST OUTPUTS                           │   │
│  │                                                               │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │   │
│  │  │   INFLOWS   │    │  OUTFLOWS   │    │ NET CASH    │      │   │
│  │  │  (When $    │    │  (When $    │    │  POSITION   │      │   │
│  │  │  comes in)  │    │  goes out)  │    │  Over Time  │      │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘      │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Bayesian?

Traditional forecasting gives you a single number. Bayesian forecasting gives you **probability distributions** — meaning you know not just *what* to expect, but *how confident* to be.

| Approach | Output | Limitation |
|----------|--------|------------|
| **Spreadsheet** | "We'll have £50K on March 1" | No uncertainty measure |
| **Bayesian** | "80% likely £45K-£55K, 95% likely £40K-£60K" | Accounts for real-world variability |

This matters because business decisions require knowing the **range of outcomes**, not just the average.

### Data Sources from Xero

Qashivo pulls **everything** from Xero to build the forecast:

| Data Type | Used For |
|-----------|----------|
| **Sales Invoices** | Predicting when customers will pay (AR inflows) |
| **Bills/Purchase Orders** | Predicting when suppliers need payment (AP outflows) |
| **Bank Transactions** | Detecting recurring payments, historical patterns |
| **Repeating Invoices** | Future revenue projections |
| **Repeating Bills** | Fixed overhead commitments |
| **Credit Notes** | Adjustments to expected inflows |
| **Contact History** | Per-customer/supplier payment behavior |

### The "Static State" Assumption

By default, the forecast assumes **current patterns continue** — this is the static state:
- Customers keep ordering at similar rates
- Overheads stay consistent
- Payment behaviors remain stable

This works surprisingly well for most SMEs because:
- 80% of cashflow is predictable recurring patterns
- Major changes (new contracts, staff changes) are infrequent
- The model self-corrects as new data arrives

### Simple Adjustments for Change

When things *do* change, users can make **simple adjustments** without spreadsheet complexity:

| Scenario | User Action | System Response |
|----------|-------------|-----------------|
| **New contract signed** | "Add £5K/month starting February" | Adjusts inflow forecast |
| **Losing a customer** | "Remove ABC Ltd from forecast" | Removes their pattern from projections |
| **Hiring new staff** | "Add £3K/month payroll from March" | Increases overhead projection |
| **Rent increase** | "Increase rent to £2K from April" | Updates recurring outflow |
| **Seasonal adjustment** | "Q4 revenue typically +30%" | Applies seasonal modifier |

These are **plain-language inputs**, not spreadsheet formulas. No accountant required.

### Inflow Forecasting (Money Coming In)

**What we predict:**
- When each outstanding invoice will be paid
- Expected revenue from recurring customers
- Confidence intervals for each prediction

**How it works:**

```
For each customer, the model learns:
├── Average days to pay (mean)
├── Variability in payment timing (standard deviation)
├── Month-end vs continuous payment behavior
├── Response to collection activities
└── Seasonal patterns (e.g., slow in August)

Combined with:
├── Outstanding invoice values
├── Recurring invoice patterns
└── Historical revenue trends
```

**Output**: Daily/weekly/monthly expected inflows with confidence bands

### Outflow Forecasting (Money Going Out)

**What we predict:**
- When bills need to be paid
- Recurring overhead timing and amounts
- Variable costs correlated with revenue

**Categories detected automatically:**

| Category | Detection Method | Example |
|----------|-----------------|---------|
| **Fixed Overheads** | Recurring bank debits, same amount monthly | Rent, insurance, subscriptions |
| **Variable Overheads** | Recurring but varying amount | Utilities, phone bills |
| **Payroll** | Monthly pattern, consistent timing | Staff salaries |
| **Supplier Bills** | Bills from Xero, payment terms | Stock, materials |
| **Tax Payments** | Quarterly/annual patterns | VAT, corporation tax |
| **One-off Payments** | Scheduled bills, known commitments | Equipment purchases |

### Forecast Outputs

| Timeframe | View | Use Case |
|-----------|------|----------|
| **7-Day** | Daily breakdown | Immediate cash needs |
| **30-Day** | Weekly summary | Short-term planning |
| **90-Day** | Monthly projection | Quarter planning |
| **12-Month** | Quarterly view | Annual planning, loan applications |

Each view shows:
- Expected inflows (with confidence range)
- Expected outflows (by category)
- Net cash position (with risk bands)
- Low cash alerts (when position may go negative)

### Accuracy Without Effort

| Traditional Approach | Time Required | Accuracy |
|---------------------|---------------|----------|
| No forecasting | 0 hours | 0% (no visibility) |
| Basic spreadsheet | 4-8 hours setup, 2 hours/month maintenance | 50-60% |
| Detailed spreadsheet | 20+ hours setup, 5 hours/month maintenance | 70-80% |
| Accountant-managed | Ongoing retainer fees | 75-85% |
| **Qashivo Bayesian** | **5 minutes (Xero connect)** | **80-90%** |

The model improves automatically as more data accumulates — no ongoing maintenance required.

### Business Value

- **Sleep better**: Know your cash position 90 days out with confidence bands
- **Spot problems early**: Alerts when projected cash drops below safe levels
- **Plan with confidence**: Make hiring/investment decisions with data, not gut feel
- **Skip the spreadsheets**: No formulas, no manual updates, no accountant meetings
- **Automatic improvement**: Forecasts get more accurate as the system learns your patterns

---

## Part 6: Invoice Financing Intelligence

### The SME Funding Reality

Most SMEs don't have the financing options that larger businesses take for granted:

| Financing Option | Enterprise Access | SME Reality |
|-----------------|-------------------|-------------|
| Bank overdraft | Standard facility | Often unavailable or withdrawn |
| Credit lines | Multiple options | Limited or none |
| Trade credit | Negotiable terms | Fixed supplier terms |
| Invoice factoring | Multiple providers | Often the **only** option |

**The implication**: When an SME faces a cash gap, the question isn't "is factoring cheaper than my overdraft?" — it's "do I factor this invoice or miss payroll?"

### Qashivo's Approach: Cash Gap Prevention

Rather than optimizing financing costs (which assumes alternatives exist), Qashivo focuses on **preventing cash gaps before they happen** and **making factoring decisions simple** when needed.

```
┌─────────────────────────────────────────────────────────────────────┐
│              INVOICE FINANCING INTELLIGENCE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  CASH GAP DETECTION                          │    │
│  │                                                              │    │
│  │  Using Bayesian Cashflow Forecasting (Part 5), detect:       │    │
│  │  • When projected cash drops below safe threshold            │    │
│  │  • How much additional cash is needed                        │    │
│  │  • When the gap occurs and how long it lasts                 │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              FINANCING RECOMMENDATION                        │    │
│  │                                                              │    │
│  │  "You'll need £15K by March 10th to cover payroll.          │    │
│  │   Here are 3 invoices that could bridge the gap:"           │    │
│  │                                                              │    │
│  │   INV-042  £8,500   ABC Ltd    (Expected pay: March 25)     │    │
│  │   INV-039  £4,200   XYZ Corp   (Expected pay: March 20)     │    │
│  │   INV-044  £3,800   DEF Inc    (Expected pay: March 18)     │    │
│  │                                                              │    │
│  │   Total available: £16,500                                   │    │
│  │   Financing cost @ 2.5%: £412                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### The Decision Framework

Qashivo helps SMEs answer three questions:

**1. Do I need financing at all?**
- Cashflow forecast shows if/when cash gaps occur
- Early warning means more time to collect organically
- Better collections (via Charlie) reduces financing need

**2. Which invoices should I factor?**
- Prioritize invoices from **reliable payers** (lower factoring risk = better rates)
- Match invoice timing to cash gap timing
- Avoid factoring invoices that will pay before the gap hits

**3. How much will it cost?**
- Clear visibility of factoring fees
- Compare to the cost of *not* having the cash (missed opportunities, late payment penalties, supplier relationship damage)

### Invoice Selection for Factoring

When financing is needed, Qashivo recommends which invoices to factor:

| Factor | Why It Matters |
|--------|----------------|
| **Customer payment history** | Reliable payers = lower factoring risk = better rates |
| **Invoice size** | Match to cash gap size (don't over-finance) |
| **Expected payment date** | Factor invoices that won't pay in time naturally |
| **Customer relationship** | Some businesses prefer not to factor certain clients |
| **Concentration limits** | Factors limit exposure to single customers |

### Practical Example

**Scenario**: Business forecasts £12K shortfall on March 15th

| Invoice | Amount | Customer | Payment Score | Expected Pay | Recommendation |
|---------|--------|----------|---------------|--------------|----------------|
| INV-101 | £8,000 | ABC Ltd | 85 (reliable) | March 28 | **Factor** — won't arrive in time, low risk |
| INV-102 | £5,000 | XYZ Corp | 45 (variable) | March 20 | **Factor** — higher fee but needed |
| INV-103 | £6,000 | DEF Inc | 90 (reliable) | March 12 | **Wait** — will arrive before gap |
| INV-104 | £3,000 | New Co | 50 (unknown) | March 25 | **Avoid** — new customer, higher risk |

**Result**: Factor INV-101 and INV-102 (£13K) to cover £12K gap. Cost: ~£325 at 2.5%.

### Integration with Financing Partners

Qashivo can connect with invoice financing platforms to:

- **One-click submission**: Send selected invoices to factor
- **Rate comparison**: See offers from multiple providers (roadmap)
- **Status tracking**: Monitor which invoices are financed vs organic
- **Reconciliation**: Automatically match factored payments

### The Bigger Picture: Reducing Financing Need

The best financing is the financing you don't need. Qashivo reduces reliance on factoring by:

1. **Faster collections** — Charlie's autonomous follow-up accelerates payment
2. **Earlier visibility** — Bayesian forecasting spots gaps weeks in advance
3. **Better customer selection** — Payment scoring informs credit decisions
4. **Proactive management** — Address slow payers before they cause cash gaps

### Business Value

- **Avoid crisis financing**: See cash gaps coming weeks ahead, not days
- **Finance smarter**: Factor the right invoices at the right time
- **Reduce financing costs**: Better collections = less factoring needed
- **Simple decisions**: Clear recommendations, not complex spreadsheets
- **Preserve relationships**: Choose which customers to factor (or not)

---

## Part 7: Partner Channels

### Go-to-Market Strategy: B2B2B

While direct SME sales are viable, **partner channels** offer faster scaling with lower customer acquisition costs. One partner relationship can unlock dozens or hundreds of SME clients.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PARTNER CHANNEL MODEL                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│   │  Accounting │     │   Invoice   │     │  Industry   │          │
│   │  Partners   │     │  Finance    │     │  Verticals  │          │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘          │
│          │                   │                   │                   │
│          ▼                   ▼                   ▼                   │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                      QASHIVO                             │       │
│   │            Autonomous Credit Control                     │       │
│   └─────────────────────────────────────────────────────────┘       │
│          │                   │                   │                   │
│          ▼                   ▼                   ▼                   │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│   │  Their SME  │     │  Their SME  │     │  Their SME  │          │
│   │  Clients    │     │  Clients    │     │  Members    │          │
│   └─────────────┘     └─────────────┘     └─────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Channel 1: Accounting Partners

**The Opportunity**: Accounting firms manage finances for multiple SME clients but rarely offer credit control services.

| Factor | Detail |
|--------|--------|
| **Partner Profile** | Accountancy practices with 20-500 SME clients |
| **Their Pain** | Clients ask for help with cashflow; accountants aren't equipped to chase invoices |
| **Qashivo Value** | White-label credit control they can offer as an add-on service |
| **Revenue Model** | Partner margin on subscriptions (20-30%) or referral fees |

**Scale Potential**: One accounting firm = 50-200 potential Qashivo users

**Go-to-Market**: 
- Partner with Xero/accounting software communities
- Attend accountancy conferences (Accountex, etc.)
- Content marketing targeting practice owners

---

### Channel 2: Invoice Finance Companies

**The Opportunity**: Invoice finance companies fund receivables — they have direct financial interest in those invoices getting collected quickly.

| Factor | Detail |
|--------|--------|
| **Partner Profile** | Factoring companies, invoice discounters, asset-based lenders |
| **Their Pain** | Credit control is a cost centre; inconsistent collection across client portfolio |
| **Qashivo Value** | Autonomous collection across entire funded portfolio; reduces bad debt |
| **Revenue Model** | Per-client fee, per-invoice fee, or portfolio license |

**Scale Potential**: One invoice finance company = 50-300 funded clients

**Why They Care**:
- Faster collection = faster repayment = better margins
- Consistent professional chasing protects their reputation
- Visibility across entire portfolio from one dashboard
- Reduces manual collection staff costs

**Go-to-Market**:
- Direct outreach to invoice finance brokers and providers
- Partner with invoice finance platforms (MarketFinance, Kriya, etc.)
- Integrate with their existing systems

---

### Channel 3: Wholesale & Distribution

**The Industry Problem**: 
- Squeezed between suppliers (must pay quickly) and retailers (pay slowly)
- High volume, low margins — can't afford dedicated credit control staff
- 52+ day average payment times devastating for thin-margin businesses

| Factor | Detail |
|--------|--------|
| **Partner Profile** | Trade associations, buying groups, wholesale platforms |
| **Their Pain** | Members struggling with cashflow; late payments causing business failures |
| **Qashivo Value** | Affordable autonomous credit control for members |
| **Revenue Model** | Member benefit pricing, group discounts, or platform integration |

**Scale Potential**: One wholesale buying group = 100-1,000 member businesses

**Go-to-Market**:
- Partner with trade associations (Federation of Wholesale Distributors, etc.)
- Integrate with wholesale B2B platforms
- Industry-specific messaging around margin protection

---

### Channel 4: Manufacturing

**The Industry Problem**:
- Slowest-paying sector in the UK
- Average manufacturer owed £76,000 in unpaid invoices
- 61% report customers paying slower than last year
- Long payment terms (60-90 days) built into contracts

| Factor | Detail |
|--------|--------|
| **Partner Profile** | Manufacturing trade bodies, ERP vendors, industry consultants |
| **Their Pain** | Members/clients chronically struggling with late payments |
| **Qashivo Value** | Systematic follow-up that respects contract terms but enforces payment |
| **Revenue Model** | Association partnerships, ERP integrations, direct vertical sales |

**Scale Potential**: Manufacturing sector = high-value invoices, repeat customers, process-driven (ideal for automation)

**Go-to-Market**:
- Partner with Make UK, Manufacturing NI, Scottish Engineering
- Integrate with manufacturing ERP systems
- Case studies showing DSO improvement

---

### Channel 5: Recruitment & Staffing

**The Industry Problem**:
- Classic timing mismatch: pay contractors weekly, get paid monthly
- Notorious for cashflow stress — many already use invoice finance
- High volume of invoices, often to same clients repeatedly

| Factor | Detail |
|--------|--------|
| **Partner Profile** | Recruitment industry bodies, back-office providers, payroll/timesheet platforms |
| **Their Pain** | Agencies spending hours chasing the same clients every month |
| **Qashivo Value** | Automated weekly/monthly chase cycles tailored to recruitment billing patterns |
| **Revenue Model** | Industry-specific pricing, integration with recruitment software |

**Scale Potential**: 30,000+ recruitment agencies in UK; concentrated market with clear industry bodies

**Go-to-Market**:
- Partner with REC (Recruitment & Employment Confederation)
- Integrate with recruitment back-office systems (ETZ, Boomerang, etc.)
- Target recruitment finance providers as channel partners

---

### Partner Channel Summary

| Channel | Reach per Partner | Sales Cycle | Revenue Potential |
|---------|-------------------|-------------|-------------------|
| **Accounting Partners** | 50-200 clients | Medium | Recurring referrals |
| **Invoice Finance** | 50-300 clients | Long | High-value contracts |
| **Wholesale** | 100-1,000 members | Medium | Volume play |
| **Manufacturing** | Varies | Long | High-value invoices |
| **Recruitment** | Industry-wide | Short | Quick adoption |

**Strategic Priority**: Invoice Finance and Accounting Partners offer the fastest path to scale with aligned incentives.

---

## Part 8: Commercial Model

### Pricing Tiers

| Tier | Monthly Price | Invoices/Month | Key Features |
|------|--------------|----------------|--------------|
| **Micro** | £49 | Up to 50 | Email only, basic automation |
| **Starter** | £149 | Up to 200 | Email + SMS, supervised autonomy |
| **Professional** | £499 | Up to 1,000 | Full multi-channel, advanced analytics |
| **Enterprise** | Custom | Unlimited | API access, custom integrations |

### Target: Starter Tier (£149/month)

Primary target for first 10 customers:
- SMEs with £100K-£1M annual AR
- Currently spending 10+ hours/month on collections
- Using Xero for accounting
- Value: Save 8+ hours/month = £20+/hour equivalent

### Risk Reduction: 90-Day DSO Guarantee

To reduce purchase friction, Qashivo offers a 90-day DSO improvement guarantee:

> *"If your Days Sales Outstanding doesn't improve within 90 days, we'll refund your subscription."*

This puts our money where our mouth is and aligns our success with customer outcomes.

### Unit Economics

| Metric | Target |
|--------|--------|
| Monthly Subscription (Starter) | £149 |
| Customer Acquisition Cost | < £300 |
| Payback Period | < 2 months |
| Target LTV | £2,500+ (18+ month retention) |
| Gross Margin | 80%+ (SaaS delivery) |

---

## Appendix: Technical Stack

### Infrastructure

| Component | Technology |
|-----------|------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Neon Serverless) |
| ORM | Drizzle ORM |
| Authentication | Replit Auth (OpenID Connect) |
| Hosting | Replit Deployments |

### Security & Compliance

#### Infrastructure Security

| Layer | Implementation |
|-------|----------------|
| **Cloud Provider** | Google Cloud Platform (GCP) |
| **Database** | Neon Serverless PostgreSQL (SOC 2 Type II certified) |
| **Hosting** | Replit Deployments (enterprise-grade infrastructure) |
| **CDN/Edge** | Cloudflare (DDoS protection, WAF) |

#### Certifications & Compliance (Roadmap)

| Certification | Status | Target |
|---------------|--------|--------|
| **SOC 2 Type I** | In Progress | Q2 2026 |
| **SOC 2 Type II** | Planned | Q4 2026 |
| **ISO 27001** | Planned | 2027 |
| **GDPR Compliant** | ✅ Active | Current |
| **ICO Registered** | ✅ Active | Current |

#### Data Protection

| Control | Description |
|---------|-------------|
| **Encryption at Rest** | AES-256 encryption for all stored data |
| **Encryption in Transit** | TLS 1.3 for all API communications |
| **Credential Storage** | Secrets encrypted with customer-specific keys |
| **Data Residency** | UK/EU data centres (GDPR requirement) |
| **Backup & Recovery** | Automated daily backups, 30-day retention |

#### Application Security

| Control | Implementation |
|---------|----------------|
| **Authentication** | OAuth 2.0 / OpenID Connect (no password storage) |
| **Multi-Tenancy** | Row-level security with tenant isolation |
| **API Security** | Rate limiting, request validation, CORS policies |
| **Webhook Security** | HMAC signature verification on all inbound webhooks |
| **Session Management** | Secure, HTTP-only cookies with automatic expiry |

#### Third-Party Security

All integration partners maintain enterprise security standards:

| Partner | Security Posture |
|---------|------------------|
| **Xero** | SOC 1 & SOC 2 Type II, ISO 27001 |
| **SendGrid** | SOC 2 Type II, ISO 27001 |
| **Vonage** | SOC 2 Type II, ISO 27001, PCI DSS |
| **Stripe** | PCI DSS Level 1, SOC 2 Type II |
| **OpenAI** | SOC 2 Type II |
| **Retell AI** | SOC 2 Type II |

#### Access Controls

- **Role-Based Access Control (RBAC)**: 50+ granular permissions
- **Audit Logging**: All user actions logged with timestamps
- **Admin Separation**: Platform admin access isolated from tenant data
- **API Key Management**: Scoped tokens with automatic rotation

#### Incident Response

- 24-hour security incident response commitment
- Automated alerting for anomalous access patterns
- Regular penetration testing (planned quarterly from Q2 2026)
- Vulnerability disclosure programme

### Monitoring

- Action audit trail
- Delivery tracking (email opens, SMS delivery)
- Call recordings and transcripts
- Performance dashboards

---

*Document Prepared — December 2025*
