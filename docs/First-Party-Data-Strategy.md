# Qashivo First-Party Data Strategy

**Date:** February 2026  
**Purpose:** Define a compliant approach to building ML/AI capabilities using data captured directly within Qashivo, separate from Xero API restrictions.

---

## Executive Summary

Xero's Developer Platform Terms (effective December 2025) prohibit using API data for ML training or predictive analytics. However, data captured directly within Qashivo—through user interactions, communications, and debtor behaviour—is **first-party data** that we own and can freely use for ML/AI purposes.

This document outlines a strategy to build a proprietary intelligence layer that competitors cannot replicate, while remaining fully compliant with Xero's terms.

---

## The Compliance Boundary

### What We CANNOT Use for ML/AI

| Data Source | Example | Restriction |
|-------------|---------|-------------|
| Xero API Data | Invoice amounts, payment dates, customer details | Cannot train ML models |
| Xero Payment History | Historical payment patterns from Xero | Cannot use for predictive analytics |
| Xero Contact Data | Customer names, addresses from Xero sync | Cannot fine-tune LLMs |

### What We CAN Use for ML/AI

| Data Source | Example | Status |
|-------------|---------|--------|
| Qashivo Communication Data | Email opens, response times, call outcomes | ✅ First-party, fully usable |
| User-Entered Data | Customer tiers, notes, manual risk assessments | ✅ First-party, fully usable |
| Debtor Portal Behaviour | Login frequency, time on page, actions taken | ✅ First-party, fully usable |
| Charlie Voice AI Data | Call duration, sentiment, objections raised | ✅ First-party, fully usable |
| PTP/Outcome Data | Promises made, breach rates, resolution patterns | ✅ First-party, fully usable |

---

## First-Party Data Categories

### 1. Communication Outcomes

Data captured from all outbound and inbound communications within Qashivo.

**Email Communications:**
- Open rates and timestamps
- Click-through rates on payment links
- Reply rates and response times
- Bounce and spam complaint rates
- Forwarding patterns

**SMS Communications:**
- Delivery confirmation
- Response rates
- Opt-out rates
- Response content (for intent analysis)

**Voice Calls (Charlie):**
- Call answered vs voicemail
- Call duration
- Sentiment analysis (real-time, not trained)
- Outcome classification (promise, dispute, escalation)
- Best time to reach patterns

**ML Applications:**
- Predict optimal communication channel per customer
- Identify best day/time to contact
- Recommend message tone based on response patterns
- Score communication effectiveness

---

### 2. Promise to Pay (PTP) Data

Data captured when debtors make payment commitments.

**Captured Fields:**
- PTP date given
- PTP amount
- Channel of commitment (email, phone, portal)
- Actual payment date (when fulfilled)
- Breach indicator (if missed)
- Number of PTPs per customer
- PTP-to-payment conversion rate

**ML Applications:**
- PTP reliability scoring per customer
- Predict likelihood of PTP breach
- Recommend follow-up timing for PTPs
- Identify customers who habitually give false PTPs

---

### 3. Debtor Self-Service Portal Behaviour

Data captured when debtors interact with their payment portal.

**Captured Fields:**
- Login frequency
- Session duration
- Pages viewed (invoice list, specific invoices, payment options)
- Time spent on each invoice
- Dispute submission patterns
- Partial payment attempts
- Payment method selection
- Abandoned payment attempts

**ML Applications:**
- Predict payment intent from browsing behaviour
- Identify friction points in payment journey
- Score debtor engagement level
- Recommend proactive outreach for high-intent but non-converting visitors

---

### 4. User-Entered Classifications

Data provided by Qashivo users about their customers.

**Captured Fields:**
- Customer tier (A/B/C or custom)
- Risk classification (manual override)
- Relationship notes
- Industry/sector classification
- Payment terms preferences
- Communication preferences
- VIP or key account flags

**ML Applications:**
- Validate user classifications against actual behaviour
- Suggest reclassification when behaviour changes
- Identify patterns in successful vs unsuccessful accounts
- Recommend collection strategies by segment

---

### 5. Workflow Execution Data

Data captured from automated collection workflows.

**Captured Fields:**
- Workflow template used
- Steps executed vs skipped
- Time between steps
- Escalation triggers activated
- Workflow outcomes (paid, disputed, escalated)
- User interventions (pauses, overrides)
- A/B test assignments and results

**ML Applications:**
- Identify most effective workflow sequences
- Recommend workflow modifications
- Predict workflow success probability
- Optimise step timing based on response patterns

---

### 6. Action Centre Activity

Data captured from user interactions in the Action Centre.

**Captured Fields:**
- Actions approved vs rejected
- Time to approve/review
- Manual modifications made to AI suggestions
- Priority overrides
- Snooze patterns
- Batch approval rates
- User feedback on AI recommendations

**ML Applications:**
- Learn user preferences for action recommendations
- Improve AI suggestion quality
- Predict which actions users will approve
- Personalise AI behaviour per user

---

## Simple Metrics vs ML (The Compliance Line)

### Compliant: Simple Calculations on Xero Data

These are just arithmetic, not ML:

```
Average Days to Pay = SUM(payment_date - due_date) / COUNT(paid_invoices)
DSO = (AR Balance / Credit Sales) × Days
Aging Bucket Counts = COUNT by days_overdue ranges
```

We CAN use these calculations for:
- Displaying historical metrics
- Default estimates (Expected Payment = Due Date + Historical Average)
- Scenario-based forecasting

### Compliant: ML on First-Party Data

> **Critical Compliance Note:** ML features AND labels must be derived solely from Qashivo-captured events (portal payments, communications, PTP outcomes), NOT from Xero payment history. The label below uses portal payment completion, not Xero payment dates.

```python
# Example: Predict payment from communication patterns
model.train(
    features=[
        email_open_rate,           # First-party ✅
        avg_response_time,         # First-party ✅
        portal_login_frequency,    # First-party ✅
        ptp_reliability_score,     # First-party ✅
        call_answer_rate           # First-party ✅
    ],
    label=portal_payment_completed  # First-party ✅ (from debtor portal, NOT Xero)
)
```

---

## Data Capture Implementation

### Database Schema Additions

```sql
-- Communication events table
CREATE TABLE communication_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    invoice_id UUID,
    channel VARCHAR(20),  -- email, sms, voice, portal
    event_type VARCHAR(50),  -- sent, delivered, opened, clicked, replied, bounced
    event_timestamp TIMESTAMP,
    metadata JSONB,  -- channel-specific data
    created_at TIMESTAMP DEFAULT NOW()
);

-- PTP tracking table
CREATE TABLE ptp_records (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    invoice_id UUID,
    promised_date DATE,
    promised_amount DECIMAL(15,2),
    channel VARCHAR(20),
    actual_payment_date DATE,
    breach_detected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Portal session tracking
CREATE TABLE portal_sessions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,  -- Required for multi-tenant isolation
    debtor_id UUID NOT NULL,
    session_start TIMESTAMP,
    session_end TIMESTAMP,
    pages_viewed JSONB,
    actions_taken JSONB,
    payment_attempted BOOLEAN DEFAULT FALSE,
    payment_completed BOOLEAN DEFAULT FALSE  -- First-party payment signal for ML labels
);

-- Action Centre events (user decisions on AI recommendations)
CREATE TABLE action_centre_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action_id UUID,  -- Reference to the action being acted upon
    contact_id UUID,
    invoice_id UUID,
    event_type VARCHAR(50),  -- approved, rejected, modified, snoozed, bulk_approved
    original_recommendation JSONB,  -- What AI suggested
    user_modification JSONB,  -- What user changed (if any)
    time_to_decision_ms INTEGER,  -- How long user took to decide
    event_timestamp TIMESTAMP DEFAULT NOW()
);

-- User classification history
CREATE TABLE customer_classifications (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    classification_type VARCHAR(50),
    classification_value VARCHAR(100),
    classified_by UUID,  -- user who made classification
    classified_at TIMESTAMP,
    previous_value VARCHAR(100)
);
```

### Event Capture Points

| Touchpoint | Events to Capture | Implementation |
|------------|-------------------|----------------|
| SendGrid Webhooks | open, click, bounce, spam | Webhook handler in `/api/webhooks/sendgrid` |
| Vonage Webhooks | delivered, failed, inbound | Webhook handler in `/api/webhooks/vonage` |
| Charlie/Retell | call_started, call_ended, outcome | Post-call webhook processing |
| Debtor Portal | page_view, action, session | Client-side analytics + server logging |
| Action Centre | approve, reject, modify, snooze | Event logging on each action |

---

## ML Model Roadmap

### Phase 1: Data Collection (Months 1-3)
- Implement event capture infrastructure
- Begin logging all communication events
- Track PTP creation and outcomes
- Capture portal behaviour

### Phase 2: Feature Engineering (Months 3-4)
- Calculate per-customer engagement scores
- Build communication effectiveness metrics
- Create PTP reliability scores
- Aggregate portal behaviour patterns

### Phase 3: Initial Models (Months 4-6)
- **Model 1**: Optimal contact time prediction
- **Model 2**: Channel preference prediction
- **Model 3**: PTP reliability scoring
- **Model 4**: Payment intent from portal behaviour

### Phase 4: Advanced Intelligence (Months 6+)
- Workflow optimisation recommendations
- Personalised collection strategies
- Predictive escalation triggers
- Cross-customer pattern recognition

---

## Competitive Advantage

This first-party data strategy creates several moats:

1. **Unique Dataset**: Competitors can't replicate data we capture from our own platform
2. **Compounding Value**: ML improves as more data accumulates
3. **Xero-Compliant**: Fully within terms while competitors may need to strip features
4. **Behavioural Focus**: Captures intent signals that accounting data can't provide
5. **Cross-Tenant Insights**: Anonymised patterns across all customers (with consent)

---

## Privacy & Consent

### Data Ownership
- Communication data: Belongs to tenant, processed under their data controller relationship
- Portal behaviour: Captured under debtor portal terms of service
- Aggregated insights: Anonymised, no PII

### GDPR Considerations
- Lawful basis: Legitimate interest for collections, consent for portal tracking
- Data minimisation: Capture only what's needed for ML value
- Right to erasure: Must be able to delete customer data on request
- Transparency: Document data usage in privacy policy

### Cross-Tenant Model Training Requirements

For ML models trained on data across multiple tenants (to improve predictions for all customers):

1. **Explicit Opt-In Required**
   - Tenants must explicitly consent to contribute anonymised data to shared models
   - Default is OFF—single-tenant models only
   - Opt-in captured during onboarding or in settings

2. **Anonymisation Requirements**
   - Remove all PII before aggregation (names, emails, phone numbers)
   - Hash or remove contact/invoice IDs
   - Aggregate to statistical features only (e.g., "avg response time" not individual events)
   - Minimum k-anonymity threshold (data only included if pattern appears in N+ tenants)

3. **Data Governance**
   - Maintain audit log of which tenants contributed to which model versions
   - Ability to retrain models excluding a tenant's data upon opt-out
   - Regular review of cross-tenant data usage by data protection officer

---

## Summary

By focusing on first-party data captured within Qashivo, we can build a powerful ML/AI capability that:

1. **Complies** with Xero's API terms
2. **Differentiates** from competitors facing the same restrictions
3. **Improves** over time as data accumulates
4. **Provides** genuine predictive value beyond simple calculations

The key insight: Xero restricts what we can do with *their* data, but places no limits on what we can do with data we capture ourselves through our own platform interactions.

---

## Next Steps

1. Prioritise event capture implementation for SendGrid/Vonage webhooks
2. Add communication_events table to schema
3. Implement PTP tracking with breach detection
4. Plan portal analytics integration
5. Begin accumulating data for Phase 2 feature engineering
