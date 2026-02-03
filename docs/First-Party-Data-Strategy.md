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
| **Qashivo Payment Portal Data** | Payment completions, amounts, timing, method chosen | ✅ **First-party, fully usable** |
| Qashivo Communication Data | Email opens, response times, call outcomes | ✅ First-party, fully usable |
| User-Entered Data | Customer tiers, notes, manual risk assessments | ✅ First-party, fully usable |
| Debtor Portal Behaviour | Login frequency, time on page, actions taken | ✅ First-party, fully usable |
| Charlie Voice AI Data | Call duration, sentiment, objections raised | ✅ First-party, fully usable |
| PTP/Outcome Data | Promises made, breach rates, resolution patterns | ✅ First-party, fully usable |

> **Strategic Insight:** The Qashivo Payment Portal is the single most valuable first-party data source because it captures **actual payment behaviour**—the ultimate ground truth for ML predictions. By routing payments through our portal (via Stripe), we own the complete payment event chain, not Xero.

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

### 3. Payment Portal Transaction Data (THE KEY ASSET)

**Why This Matters Most:**

When debtors pay through the Qashivo payment portal (powered by Stripe), the payment event occurs within our system—not Xero. This creates first-party payment data that is completely separate from Xero API restrictions.

**Data Ownership Chain:**
```
Debtor → Qashivo Portal → Stripe → Qashivo Database → (syncs to) Xero
                ↑                        ↑
         First-party payment      First-party record
         intent signals           of payment completion
```

The critical distinction: we capture payment events as they happen in our system, then push the result to Xero. The payment data originates in Qashivo, not from Xero's API.

**Captured Fields (All First-Party):**
- Payment timestamp (when debtor completed payment)
- Payment amount
- Payment method (card, bank transfer, partial)
- Invoices paid (which invoices selected)
- Partial payment flag
- Payment attempts (including failures)
- Time from portal login to payment
- Device/browser used
- Geographic location
- Session before payment (pages viewed, time spent)

**ML Applications (Fully Compliant):**
- **Payment Likelihood Scoring**: Train on actual payment completions vs. non-payments
- **Expected Payment Date Prediction**: Model based on time-to-payment after communication
- **Optimal Communication Timing**: When to chase based on when payments happen
- **Payment Method Preferences**: Predict which payment options to highlight per customer
- **Partial Payment Patterns**: Identify customers likely to pay in installments

---

### 4. Debtor Self-Service Portal Behaviour

Data captured when debtors interact with their payment portal (before payment).

**Captured Fields:**
- Login frequency
- Session duration
- Pages viewed (invoice list, specific invoices, payment options)
- Time spent on each invoice
- Dispute submission patterns
- Partial payment attempts
- Payment method selection
- Abandoned payment attempts
- Payment page drop-off points

**ML Applications:**
- Predict payment intent from browsing behaviour
- Identify friction points in payment journey
- Score debtor engagement level
- Recommend proactive outreach for high-intent but non-converting visitors
- Predict which invoices will be paid first (based on viewing patterns)

---

### 5. User-Entered Classifications

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

### 6. Workflow Execution Data

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

### 7. Action Centre Activity

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

-- Portal payments (THE KEY ML ASSET - First-party payment data from Stripe)
CREATE TABLE portal_payments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    debtor_id UUID NOT NULL,
    session_id UUID REFERENCES portal_sessions(id),
    stripe_payment_intent_id VARCHAR(100),
    
    -- Payment details (all first-party!)
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    payment_method VARCHAR(50),  -- card, bank_transfer, etc.
    card_brand VARCHAR(20),  -- visa, mastercard, amex
    card_last_four VARCHAR(4),
    
    -- Invoice linkage
    invoices_paid JSONB,  -- Array of {invoice_id, amount_applied}
    is_partial_payment BOOLEAN DEFAULT FALSE,
    
    -- Timing signals (critical for ML)
    payment_initiated_at TIMESTAMP,
    payment_completed_at TIMESTAMP,
    time_from_link_click_ms INTEGER,  -- Time from email/SMS link to payment
    time_on_payment_page_ms INTEGER,
    
    -- Context
    device_type VARCHAR(20),  -- mobile, desktop, tablet
    browser VARCHAR(50),
    country_code VARCHAR(2),
    
    -- Outcome
    status VARCHAR(20),  -- succeeded, failed, refunded
    failure_reason VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for ML feature extraction
CREATE INDEX idx_portal_payments_debtor ON portal_payments(tenant_id, debtor_id);
CREATE INDEX idx_portal_payments_timing ON portal_payments(payment_completed_at);

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

## The Payment Portal Imperative

### Why Payment Portal is the #1 Priority

The Qashivo payment portal isn't just a convenience for debtors—it's the foundation of our entire ML strategy. Without it, we have no compliant source of payment ground truth.

**Without Payment Portal:**
- Can only use Xero payment dates for display (not ML)
- Limited to communication/engagement signals for predictions
- Predictions have no ground truth to validate against

**With Payment Portal:**
- Own complete payment event data
- Can build true predictive models (intent → payment)
- Can measure and improve prediction accuracy
- Can personalise collection strategies based on proven patterns

### Adoption Strategy

To maximise first-party payment data, we must drive payment portal adoption:

1. **Convenience**: Make portal the easiest way to pay (save cards, one-click payments)
2. **Incentives**: Consider early payment discounts for portal users
3. **Visibility**: Prominent "Pay Now" buttons in all communications
4. **Friction Reduction**: Magic links, no password required, mobile-optimised
5. **Partial Payments**: Allow flexibility that bank transfers don't

### Metrics to Track

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Portal Payment Rate | >50% of payments | More data = better models |
| Portal Adoption (unique debtors) | >70% of contacted debtors | Breadth of behavioural data |
| Time from Link to Payment | Decreasing trend | Measures friction reduction |
| Payment Completion Rate | >80% of attempts | Conversion optimisation |

---

## Summary

By focusing on first-party data captured within Qashivo, we can build a powerful ML/AI capability that:

1. **Complies** with Xero's API terms
2. **Differentiates** from competitors facing the same restrictions
3. **Improves** over time as data accumulates
4. **Provides** genuine predictive value beyond simple calculations

**The key insight:** Xero restricts what we can do with *their* data, but places no limits on what we can do with data we capture ourselves through our own platform interactions.

**The strategic priority:** The payment portal is not optional—it is the single most important feature for enabling ML capabilities. Every payment that happens outside the portal is data we can't use for training.

---

## Next Steps

1. **PRIORITY: Maximise payment portal adoption** - This is the linchpin of the entire strategy
2. Add portal_payments table to capture all Stripe payment events
3. Implement communication_events table for engagement tracking
4. Implement PTP tracking with breach detection
5. Build portal analytics for session behaviour
6. Begin accumulating data for Phase 2 feature engineering
