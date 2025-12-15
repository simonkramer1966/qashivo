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

## Part 5: Cashflow Forecasting

### Overview

Qashivo's Cashflow Forecasting module uses machine learning to predict when customers will pay, enabling business owners to plan cash positions with confidence.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CASHFLOW FORECASTING ENGINE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐                                                │
│  │ Payment History │                                                │
│  │ Per Customer    │                                                │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │  Pattern        │───▶│  ML Prediction  │───▶│  Cash Position  │ │
│  │  Analysis       │    │  Model          │    │  Forecast       │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│                                                                      │
│  Features Analyzed:                                                  │
│  ├── Historical payment timing (days from due date)                 │
│  ├── Seasonal patterns (month-end, quarter-end)                     │
│  ├── Customer segment behavior                                      │
│  ├── Invoice size correlation                                       │
│  └── Day-of-week patterns                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Prediction Outputs

| Output | Description |
|--------|-------------|
| **Expected Payment Date** | Per invoice, when we expect payment |
| **Confidence Interval** | 80% likely to pay within X-Y days |
| **30/60/90-Day Cash Position** | Projected AR balance over time |
| **At-Risk Amount** | Invoices unlikely to be collected |

### Customer Payment Profiles

Based on historical behavior, customers are classified:

| Profile | Typical Behavior | Prediction Confidence |
|---------|-----------------|----------------------|
| **Consistent** | Always pays within X days of due | High (90%+) |
| **Month-End** | Pays in batch at end of month | High (85%+) |
| **Variable** | Pays 5-30 days after due | Medium (70%) |
| **Chronic Late** | Regularly 30+ days late | Medium (60%) |
| **Unknown** | New customer, no history | Low (50%) |

### Business Value

- **Cash Planning**: Know what cash to expect each week
- **Credit Decisions**: Identify customers likely to pay late before extending more credit
- **Collection Prioritization**: Focus on invoices that won't pay without intervention
- **Variance Alerts**: Get notified when payment behavior changes

---

## Part 6: Invoice Financing Optimization

### Overview

Qashivo's Invoice Financing module analyzes which invoices to finance/factor, optimizing the cost-benefit tradeoff based on payment predictions and financing rates.

### The Decision Framework

```
┌─────────────────────────────────────────────────────────────────────┐
│                  INVOICE FINANCING DECISION                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  For each invoice, calculate:                                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Expected Collection Delay Cost                              │     │
│  │ = Invoice Amount × Daily Cost of Capital × Expected Days    │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          vs                                          │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Financing Cost                                              │     │
│  │ = Invoice Amount × Factoring Fee %                          │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  Decision Rule:                                                      │
│  IF Delay Cost > Financing Cost THEN Finance                        │
│  ELSE Wait for organic collection                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Decision Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| **Payment History Score** | High | Good payers = lower financing need |
| **Invoice Age** | High | Older = higher risk, may benefit from financing |
| **Invoice Size** | Medium | Larger invoices = higher absolute cost |
| **Customer Segment** | Medium | Enterprise = slower but reliable |
| **Financing Rate** | High | Compare to cost of capital |

### Example Analysis

| Invoice | Amount | Expected Days to Pay | Delay Cost* | Finance Fee | Recommendation |
|---------|--------|---------------------|-------------|-------------|----------------|
| INV-001 | £10,000 | 45 days | £370 | £250 (2.5%) | **Finance** |
| INV-002 | £5,000 | 14 days | £58 | £125 (2.5%) | **Wait** |
| INV-003 | £25,000 | 60 days | £1,233 | £625 (2.5%) | **Finance** |
| INV-004 | £3,000 | 7 days | £17 | £75 (2.5%) | **Wait** |

*Assuming 3% annual cost of capital

### Integration with Financing Partners

Qashivo can integrate with invoice financing platforms to:
- Automatically submit invoices meeting financing criteria
- Track financing status and costs
- Reconcile payments from financing vs organic collection
- Report on financing efficiency

### Business Value

- **Optimize Working Capital**: Finance only when economically advantageous
- **Reduce Financing Costs**: Avoid unnecessary fees on invoices that will pay quickly
- **Improve Cash Flow**: Accelerate receipt of high-delay invoices
- **Data-Driven Decisions**: Remove guesswork from financing decisions

---

## Part 7: Commercial Model

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

### Security

- OAuth 2.0 for all integrations
- Row-level security (multi-tenant)
- Encrypted credentials storage
- Webhook signature verification
- GDPR-compliant data handling

### Monitoring

- Action audit trail
- Delivery tracking (email opens, SMS delivery)
- Call recordings and transcripts
- Performance dashboards

---

*Document prepared for investor presentation — December 2025*

*Contact: [Qashivo Team]*
