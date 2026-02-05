# Qashivo Complete Workflow & System Architecture

## Executive Summary

Qashivo is a supervised autonomous credit control platform that combines AI-driven multi-channel communication (voice, email, SMS) with real-time cash flow forecasting. The system operates as a **controlled learning loop** where human approval gates autonomous actions, and structured outcomes (not messages) drive system behavior.

**Core Value Proposition:**
- Conversational AI that actually **hears** what debtors say (vs blind message broadcasting)
- Real-time payment verification via Open Banking (bypassing accounting software lag)
- Cash flow forecasting based on **actual payment behavior** not just aging reports
- Proprietary training data: conversation intent → payment outcome correlation

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        QASHIVO PLATFORM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Web App    │    │  API Server  │    │  Worker Jobs │          │
│  │  (Next.js)   │◄──►│(Node/Express)│◄──►│  (Background)│          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                    │                    │                  │
│         └────────────────────┴────────────────────┘                  │
│                              │                                        │
│                    ┌─────────▼─────────┐                            │
│                    │   PostgreSQL      │                            │
│                    │   (Neon/Supabase) │                            │
│                    └───────────────────┘                            │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Accounting   │    │  TrueLayer   │    │   Retell AI  │
│ Platforms    │    │(Open Banking)│    │  (Voice AI)  │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ • Xero       │    │ • Data API   │    │ • Calls      │
│ • QuickBooks │    │ • Payments   │    │ • Transcripts│
│ • Sage       │    │ • Verification│   │ • Webhooks   │
└──────────────┘    └──────────────┘    └──────────────┘
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Communication    │
                    │    Channels       │
                    ├───────────────────┤
                    │ • Twilio (SMS)    │
                    │ • SendGrid/Email  │
                    │ • Twilio (Voice#) │
                    └───────────────────┘
```

---

## Core Database Schema

### Primary Entities

```typescript
// Partners (Qashivo Clients)
table partners {
  id: uuid
  company_name: string
  accounting_platform: 'xero' | 'quickbooks' | 'sage'
  accounting_credentials: encrypted_json
  truelayer_access_token: encrypted_string
  truelayer_refresh_token: encrypted_string
  status: 'active' | 'paused' | 'churned'
  settings: json {
    voice_enabled: boolean
    auto_approval_threshold: number
    escalation_policy: json
    working_hours: json
  }
  created_at: timestamp
}

// Debtors (Customers who owe money)
table debtors {
  id: uuid
  partner_id: uuid → partners
  external_id: string // ID from accounting system
  company_name: string
  contact_name: string
  email: string
  phone: string
  mobile: string
  
  // Behavioral data
  segment: 'high_value' | 'regular' | 'risky' | 'new'
  payment_reliability_score: float // 0-100
  average_days_to_pay: integer
  historical_disputes: integer
  total_lifetime_value: decimal
  
  // Preferences
  preferred_channel: 'email' | 'sms' | 'voice' | null
  opted_out_voice: boolean
  opted_out_sms: boolean
  
  metadata: json
  created_at: timestamp
  updated_at: timestamp
}

// Invoices (from accounting platforms)
table invoices {
  id: uuid
  partner_id: uuid → partners
  debtor_id: uuid → debtors
  external_id: string // Invoice number from accounting system
  
  amount: decimal
  currency: string
  due_date: date
  issued_date: date
  
  status: 'open' | 'overdue' | 'paid' | 'partially_paid' | 'written_off'
  amount_outstanding: decimal
  
  // Workflow state
  workflow_state: 'awaiting_action' | 'scheduled' | 'in_progress' | 'awaiting_reply' | 'cooldown' | 'escalation_due' | 'resolved'
  
  priority_score: float // Calculated daily
  last_chased_at: timestamp
  next_action_due: timestamp
  
  metadata: json // Original invoice data from accounting platform
  synced_at: timestamp
  created_at: timestamp
  updated_at: timestamp
}

// Actions (proposed or executed communications)
table actions {
  id: uuid
  partner_id: uuid → partners
  invoice_id: uuid → invoices
  debtor_id: uuid → debtors
  
  action_type: 'email' | 'sms' | 'voice_call'
  message_template: string
  scheduled_for: timestamp
  
  // Approval workflow
  status: 'proposed' | 'approved' | 'declined' | 'sent' | 'delivered' | 'failed' | 'completed'
  proposed_at: timestamp
  approved_at: timestamp
  approved_by: uuid → users
  executed_at: timestamp
  
  // Channel-specific data
  external_id: string // e.g., Retell call_id, Twilio message SID
  retell_call_id: string
  recording_url: string
  transcript: text
  
  // Timers for workflow
  awaiting_reply_until: timestamp
  cooldown_until: timestamp
  
  metadata: json
  created_at: timestamp
}

// Outcomes (structured results from actions)
table outcomes {
  id: uuid
  action_id: uuid → actions
  invoice_id: uuid → invoices
  debtor_id: uuid → debtors
  
  outcome_type: 'promise_to_pay' | 'request_time' | 'dispute' | 'payment_plan_request' | 'unreachable' | 'refused' | 'no_answer' | 'voicemail'
  confidence: float // 0-100 from AI classification
  
  // Structured data
  promise_date: date // if outcome_type = promise_to_pay
  requested_extension_days: integer // if outcome_type = request_time
  dispute_reason: text
  
  // Impact on forecast
  affects_forecast: boolean
  forecast_adjustment: json {
    expected_payment_date: date
    expected_amount: decimal
    confidence_band: { low: date, high: date }
  }
  
  extracted_at: timestamp
  created_at: timestamp
}

// Payment Events (from Open Banking + Accounting)
table payment_events {
  id: uuid
  partner_id: uuid → partners
  invoice_id: uuid → invoices // nullable - for unmatched payments
  debtor_id: uuid → debtors
  
  source: 'open_banking' | 'accounting_allocation'
  
  // Open Banking data
  ob_transaction_id: string
  ob_amount: decimal
  ob_timestamp: timestamp
  ob_reference: string
  ob_payer_account: string
  
  // Accounting allocation data
  accounting_payment_id: string
  allocated_amount: decimal
  allocated_at: timestamp
  
  // Matching
  matched: boolean
  matched_at: timestamp
  match_confidence: float
  
  created_at: timestamp
}

// Attention Items (exceptions requiring human judgment)
table attention_items {
  id: uuid
  partner_id: uuid → partners
  invoice_id: uuid → invoices
  debtor_id: uuid → debtors
  action_id: uuid → actions // nullable
  
  priority: 'urgent' | 'high' | 'medium' | 'low'
  reason: 'low_confidence_outcome' | 'dispute_detected' | 'payment_plan_request' | 'delivery_failure' | 'escalation_threshold' | 'unusual_pattern'
  
  status: 'pending' | 'in_review' | 'resolved' | 'dismissed'
  
  context: json // All relevant data for decision-making
  assigned_to: uuid → users
  resolved_at: timestamp
  resolution_notes: text
  
  created_at: timestamp
}

// Forecast Snapshots (daily cash flow predictions)
table forecast_snapshots {
  id: uuid
  partner_id: uuid → partners
  snapshot_date: date
  
  // Predictions for next 30/60/90 days
  forecast_data: json {
    daily_predictions: [
      {
        date: date,
        expected_inflow: decimal,
        confidence_low: decimal,
        confidence_high: decimal,
        expected_outflow: decimal,
        net_position: decimal
      }
    ],
    assumptions: {
      open_invoices_count: integer,
      pending_promises: integer,
      high_confidence_payments: integer,
      medium_confidence_payments: integer,
      low_confidence_payments: integer
    }
  }
  
  created_at: timestamp
}

// Audit Events (comprehensive audit trail)
table audit_events {
  id: uuid
  partner_id: uuid → partners
  user_id: uuid → users // nullable for system events
  
  event_type: string // 'action_approved', 'outcome_extracted', 'payment_matched', etc.
  entity_type: 'invoice' | 'action' | 'outcome' | 'payment'
  entity_id: uuid
  
  before_state: json
  after_state: json
  changes: json
  
  created_at: timestamp
}

// Integration Events (raw webhooks/API responses)
table integration_events {
  id: uuid
  source: 'retell' | 'twilio' | 'xero' | 'quickbooks' | 'sage' | 'truelayer'
  event_type: string
  raw_payload: json
  processed: boolean
  processed_at: timestamp
  error: text
  created_at: timestamp
}

// Users (credit controllers)
table users {
  id: uuid
  partner_id: uuid → partners
  email: string
  name: string
  role: 'admin' | 'controller' | 'viewer'
  created_at: timestamp
}
```

---

## Complete Workflow Processes

### 1. Partner Onboarding Workflow

```
┌─────────────────────────────────────────────────────────┐
│ PARTNER ONBOARDING                                      │
└─────────────────────────────────────────────────────────┘

Step 1: Account Creation
→ Partner signs up via web app
→ Create partner record with status='onboarding'
→ Send email verification

Step 2: Accounting Platform Connection
→ Partner selects accounting platform (Xero/QuickBooks/Sage)
→ OAuth flow to authorize Qashivo
  - Xero: OAuth 2.0 flow → get access_token + refresh_token
  - QuickBooks: OAuth 2.0 flow → get access_token + refresh_token
  - Sage: API key or OAuth depending on product
→ Store encrypted credentials in partner.accounting_credentials
→ Test connection with GET /invoices?limit=1

Step 3: Open Banking Connection (TrueLayer)
→ Generate TrueLayer auth link for partner's business bank account
→ Partner connects bank account via TrueLayer consent flow
→ Store access_token + refresh_token in partner record
→ Fetch initial account + transaction history
→ Create payment_events records from historical transactions

Step 4: Initial Data Sync
→ Background job: sync_accounting_data(partner_id)
  - Fetch all open/overdue invoices
  - Fetch all customers (debtors)
  - Create invoice + debtor records
  - Calculate initial priority_scores
→ Match historical TrueLayer transactions to invoice allocations
→ Build initial debtor payment reliability scores

Step 5: Communication Setup
→ Configure Twilio phone number for voice calls
→ Setup email domain/sender (SendGrid)
→ Configure SMS sender ID
→ Map partner → Twilio number in system

Step 6: Settings Configuration
→ Partner configures:
  - Voice enabled: yes/no
  - Auto-approval threshold: £X (actions below this auto-approve)
  - Escalation policy: custom or use default
  - Working hours: when to send communications
  - Channel preferences by debtor segment
→ Update partner.settings

Step 7: Onboarding Complete
→ Update partner.status = 'active'
→ Schedule daily jobs:
  - sync_invoices_job(partner_id) - every 6 hours
  - generate_action_plan_job(partner_id) - daily at 6am
  - sync_payments_job(partner_id) - every 2 hours
→ Send welcome email with dashboard link
```

### 2. Daily Action Planning Workflow

```
┌─────────────────────────────────────────────────────────┐
│ DAILY ACTION PLAN GENERATION (runs 6am daily)          │
└─────────────────────────────────────────────────────────┘

Job: generate_action_plan_job(partner_id)

Step 1: Refresh Invoice Data
→ Sync latest invoices from accounting platform
→ Update invoice statuses (paid, partially_paid, overdue)
→ Calculate days_overdue for each invoice

Step 2: Calculate Priority Scores
For each open/overdue invoice:
→ priority_score = weighted_formula(
    age_factor: days_overdue * 2,
    value_factor: amount_outstanding / 1000,
    debtor_risk: (100 - debtor.payment_reliability_score),
    recent_contact: -10 if contacted in last 7 days else 0,
    promised_date: -20 if outcome.promise_date is upcoming else 0
  )
→ Update invoice.priority_score

Step 3: Filter Eligible Invoices
→ Exclude invoices where:
  - workflow_state = 'cooldown' AND now() < cooldown_until
  - workflow_state = 'awaiting_reply' AND now() < awaiting_reply_until
  - last_chased_at < 3 days ago (minimum gap between contacts)
  - invoice in attention_items with status='pending'
  - debtor opted_out for all channels

Step 4: Rank and Select Top Actions
→ Sort eligible invoices by priority_score DESC
→ Select top N invoices (configurable, default 50)
→ For each selected invoice, determine recommended channel:

Channel Selection Logic:
```typescript
function recommendChannel(invoice, debtor) {
  const daysOverdue = invoice.days_overdue;
  const amount = invoice.amount_outstanding;
  const previousAttempts = countActionsByInvoice(invoice.id);
  
  // Default escalation path
  if (daysOverdue <= 3) {
    return 'email'; // Gentle reminder
  } else if (daysOverdue <= 7) {
    return previousAttempts === 0 ? 'email' : 'sms';
  } else if (daysOverdue <= 14) {
    if (debtor.opted_out_voice || !partner.voice_enabled) {
      return 'sms';
    }
    return amount > 5000 ? 'voice_call' : 'sms';
  } else if (daysOverdue <= 21) {
    return 'voice_call'; // Escalation
  } else {
    // Day 30+ → manual attention
    createAttentionItem({
      reason: 'escalation_threshold',
      priority: 'high',
      invoice_id: invoice.id
    });
    return null; // Don't auto-propose action
  }
}
```

Step 5: Generate Proposed Actions
For each selected invoice:
→ Create action record with:
  - status = 'proposed'
  - action_type = recommended channel
  - message_template = select appropriate template
  - scheduled_for = calculate optimal send time (within working hours)
  - metadata = { priority_score, reasoning }
→ Generate message content using templates + invoice data

Step 6: Auto-Approval (Optional)
If partner.settings.auto_approval_threshold is set:
→ For actions where invoice.amount_outstanding < threshold:
  - Update action.status = 'approved'
  - action.approved_at = now()
  - action.approved_by = 'system'
  - Add to execution queue

Step 7: Notify Credit Controller
→ Send email/Slack notification:
  "Your daily action plan is ready: X actions need approval"
→ Link to approval dashboard
```

### 3. Human Approval Workflow

```
┌─────────────────────────────────────────────────────────┐
│ CREDIT CONTROLLER APPROVAL PROCESS                      │
└─────────────────────────────────────────────────────────┘

UI: Daily Approval Dashboard

View: List of Proposed Actions (grouped by channel)

For each action, display:
┌────────────────────────────────────────────┐
│ 🔴 Priority: High (Score: 87)              │
│ Invoice: INV-1234 | £5,000 | 14 days overdue│
│ Debtor: ABC Construction Ltd              │
│ Contact: John Smith (john@abc.com)        │
│                                            │
│ Recommended: Voice Call                    │
│ Reason: High value, no response to 2 emails│
│                                            │
│ Previous attempts:                         │
│ • Day 3: Email sent, no reply             │
│ • Day 7: SMS sent, no reply               │
│                                            │
│ Call Script Preview:                       │
│ "Hi John, this is Alex from Qashivo       │
│  calling about Invoice 1234 for £5,000..." │
│                                            │
│ [Approve] [Modify] [Decline] [Defer]      │
└────────────────────────────────────────────┘

User Actions:

1. Approve
   → action.status = 'approved'
   → action.approved_at = now()
   → action.approved_by = current_user.id
   → Add to execution queue
   → Log audit_event

2. Modify
   → Open modal to edit:
     - Change channel (email → sms)
     - Edit message content
     - Adjust scheduled_for time
     - Add notes
   → Save modified action
   → Require re-approval or auto-approve if minor change

3. Decline
   → action.status = 'declined'
   → Prompt for reason (dropdown + notes)
   → Log audit_event
   → Remove from plan
   → Optional: mark invoice for manual handling

4. Defer
   → Set action.scheduled_for = tomorrow (or selected date)
   → Keep status = 'proposed'
   → Will reappear in tomorrow's approval queue

Bulk Actions:
→ Select multiple actions → Approve All, Decline All
→ Filter by channel, priority, debtor segment
→ "Approve all email actions" (common workflow)
```

### 4. Action Execution Workflow

```
┌─────────────────────────────────────────────────────────┐
│ ACTION EXECUTION (runs every 5 minutes)                 │
└─────────────────────────────────────────────────────────┘

Job: execute_approved_actions_job()

Step 1: Query Approved Actions
→ SELECT * FROM actions
  WHERE status = 'approved'
  AND scheduled_for <= now()
  ORDER BY scheduled_for ASC
  LIMIT 100

Step 2: Execute by Channel

2a. EMAIL EXECUTION
→ For action_type = 'email':
  - Render email template with invoice/debtor data
  - Send via SendGrid API
  - Store message_id in action.external_id
  - Update action.status = 'sent'
  - Update action.executed_at = now()
  - Set action.awaiting_reply_until = now() + 48 hours
  - Update invoice.workflow_state = 'awaiting_reply'

2b. SMS EXECUTION
→ For action_type = 'sms':
  - Render SMS template (max 160 chars)
  - Send via Twilio SMS API
  - Store SID in action.external_id
  - Update action.status = 'sent'
  - Set action.awaiting_reply_until = now() + 48 hours
  - Update invoice.workflow_state = 'awaiting_reply'

2c. VOICE CALL EXECUTION
→ For action_type = 'voice_call':
  - Create Retell AI call via API:
    POST /v1/call
    {
      "agent_id": "qashivo_credit_control_agent",
      "phone_number": debtor.phone,
      "from_number": partner.twilio_number,
      "metadata": {
        "partner_id": partner.id,
        "invoice_id": invoice.id,
        "action_id": action.id,
        "debtor_name": debtor.contact_name,
        "amount": invoice.amount_outstanding,
        "days_overdue": invoice.days_overdue
      },
      "dynamic_variables": {
        "debtor_name": debtor.contact_name,
        "invoice_number": invoice.external_id,
        "amount_due": formatCurrency(invoice.amount_outstanding),
        "due_date": formatDate(invoice.due_date)
      }
    }
  - Store call_id in action.retell_call_id
  - Update action.status = 'in_progress'
  - Update invoice.workflow_state = 'in_progress'
  
  Note: Retell handles the actual call + conversation
  Qashivo receives webhooks for call events

Step 3: Error Handling
→ If SendGrid/Twilio/Retell API fails:
  - Update action.status = 'failed'
  - Store error in action.metadata.error
  - Create attention_item:
    reason: 'delivery_failure'
    priority: 'medium'
  - Retry logic: 3 attempts with exponential backoff

Step 4: Update Invoice State
→ invoice.last_chased_at = now()
→ invoice.workflow_state updated based on action type
→ Log audit_event
```

### 5. Retell Voice Call Workflow

```
┌─────────────────────────────────────────────────────────┐
│ RETELL AI VOICE CONVERSATION                           │
└─────────────────────────────────────────────────────────┘

Retell Agent Configuration:
→ Agent name: "Qashivo Credit Control"
→ Voice: Professional, friendly but firm
→ Language model: GPT-4
→ Instructions:
  "You are calling on behalf of {company_name} regarding 
   an overdue invoice. Your goal is to:
   1. Confirm the debtor is aware of the invoice
   2. Understand why payment hasn't been made
   3. Secure a commitment to pay (date + amount)
   4. Capture any disputes or requests for more time
   
   Be professional, empathetic, but clear about the 
   outstanding amount and urgency.
   
   If they make a promise to pay, confirm:
   - Exact date they will pay
   - Full amount or partial?
   - Payment method
   
   If they dispute, capture:
   - Specific issue with invoice
   - What needs to be resolved
   
   If they request time, capture:
   - How much time needed
   - Reason for delay
   - When they expect to have funds"

Call Flow:

1. CALL INITIATED
→ Retell webhook: call.started
→ Update action.status = 'in_progress'

2. CONVERSATION HAPPENS
→ Retell handles real-time conversation
→ Uses dynamic_variables to personalize
→ Example dialogue:
  
  AI: "Hello, may I speak with John Smith please?"
  Debtor: "Speaking"
  AI: "Hi John, this is Alex calling from Qashivo on behalf 
       of XYZ Limited regarding Invoice 1234 for £5,000 
       which was due on January 15th. Are you aware of this 
       invoice?"
  Debtor: "Yes, sorry, we've been waiting for a large 
           customer payment to come through"
  AI: "I understand cash flow can be tight. When do you 
       expect that payment to arrive?"
  Debtor: "Should be end of this week, so I can pay you 
           by next Monday"
  AI: "Perfect. So to confirm, you'll pay the full £5,000 
       by Monday, February 12th?"
  Debtor: "Yes, that's correct"
  AI: "Great, I've noted that down. We'll send you a 
       confirmation email. Is there anything else you 
       need from us?"
  Debtor: "No, that's all"
  AI: "Thank you John, have a great day"

3. CALL ENDS
→ Retell webhook: call.ended
  Payload includes:
  {
    "call_id": "call_abc123",
    "status": "completed", // or "no_answer", "failed", "voicemail"
    "duration": 142,
    "transcript": "full conversation text...",
    "recording_url": "https://...",
    "metadata": { action_id, invoice_id, ... }
  }

4. PROCESS WEBHOOK
→ Receive webhook at POST /webhooks/retell
→ Validate signature
→ Store raw payload in integration_events
→ Extract call outcome:

Outcome Extraction (using GPT-4):
```typescript
async function extractOutcome(transcript: string) {
  const prompt = `
    Analyze this credit control call transcript and extract 
    structured outcome data.
    
    Transcript:
    ${transcript}
    
    Return JSON with:
    {
      "outcome_type": "promise_to_pay" | "request_time" | 
                      "dispute" | "unreachable" | "refused" | 
                      "no_answer" | "voicemail",
      "confidence": 0-100,
      "promise_date": "YYYY-MM-DD" or null,
      "promise_amount": number or null,
      "requested_extension_days": number or null,
      "dispute_reason": "string" or null,
      "sentiment": "positive" | "neutral" | "negative",
      "key_phrases": ["quote1", "quote2"],
      "follow_up_needed": boolean,
      "notes": "summary"
    }
  `;
  
  const result = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });
  
  return JSON.parse(result.choices[0].message.content);
}
```

5. CREATE OUTCOME RECORD
→ Insert into outcomes table with extracted data
→ Link to action_id, invoice_id, debtor_id

6. ROUTE OUTCOME

High Confidence Promise to Pay (confidence > 80):
→ Update invoice.workflow_state = 'awaiting_payment'
→ Set next_action_due = promise_date + 1 day (follow-up if not paid)
→ Update forecast with promised payment
→ Send confirmation email to debtor + credit controller
→ action.status = 'completed'

Low Confidence or Ambiguous (confidence < 80):
→ Create attention_item:
  reason: 'low_confidence_outcome'
  priority: 'medium'
  context: { transcript, extracted_outcome }
→ Require human review to confirm interpretation
→ action.status = 'completed' (but outcome pending review)

Dispute Detected:
→ Create attention_item:
  reason: 'dispute_detected'
  priority: 'urgent'
→ Pause all automation for this invoice
→ invoice.workflow_state = 'escalation_due'
→ action.status = 'completed'

No Answer / Voicemail:
→ outcome_type = 'no_answer'
→ Schedule retry:
  - Create new proposed action for tomorrow
  - Different time of day
  - Max 3 voice attempts before escalating
→ action.status = 'completed'

7. UPDATE FORECAST
→ If promise_to_pay: update daily forecast
→ Adjust expected_payment_date for this invoice
→ Recalculate confidence bands
→ Regenerate forecast_snapshot

8. STORE ARTIFACTS
→ Upload recording to S3/R2
→ Store transcript in action.transcript
→ Update action.recording_url
→ Log audit_event
```

### 6. Payment Verification Workflow

```
┌─────────────────────────────────────────────────────────┐
│ PAYMENT MATCHING & VERIFICATION                        │
└─────────────────────────────────────────────────────────┘

Job: sync_payments_job(partner_id) - runs every 2 hours

Step 1: Fetch New Payments from TrueLayer
→ GET /data/v1/accounts/{account_id}/transactions
  ?from={last_sync_time}&to={now}
→ For each incoming transaction (amount > 0):
  - Create payment_event record:
    source: 'open_banking'
    ob_transaction_id: transaction.id
    ob_amount: transaction.amount
    ob_timestamp: transaction.timestamp
    ob_reference: transaction.description
    ob_payer_account: transaction.meta.counterparty_account_id
    matched: false

Step 2: Fetch Payment Allocations from Accounting
→ Xero: GET /api.xro/2.0/Payments
→ QuickBooks: GET /v3/company/{id}/payment
→ Sage: GET /accounts/v3.1/payments
→ For each payment allocation:
  - Create payment_event record:
    source: 'accounting_allocation'
    accounting_payment_id: payment.id
    allocated_amount: payment.amount
    allocated_at: payment.date
    invoice_id: matched via payment.invoice_id
    matched: false

Step 3: Match Open Banking → Accounting Allocations
Matching Algorithm:
```typescript
async function matchPayments(partner_id: string) {
  // Get unmatched OB payments
  const obPayments = await getUnmatchedOBPayments(partner_id);
  
  // Get unmatched accounting allocations
  const accountingPayments = await getUnmatchedAccountingPayments(partner_id);
  
  for (const obPayment of obPayments) {
    // Try to find matching accounting payment
    const match = accountingPayments.find(ap => 
      // Amount matches exactly or within £0.01
      Math.abs(ap.allocated_amount - obPayment.ob_amount) < 0.01 &&
      
      // Timestamp within 48 hours
      Math.abs(ap.allocated_at - obPayment.ob_timestamp) < 48 * 3600 * 1000 &&
      
      // Debtor matches (if available from reference)
      debtorMatches(obPayment.ob_reference, ap.debtor_id)
    );
    
    if (match) {
      // High confidence match
      await linkPayments(obPayment.id, match.id, confidence: 95);
      
      // Update both records
      await updatePaymentEvent(obPayment.id, {
        matched: true,
        matched_at: now(),
        invoice_id: match.invoice_id,
        debtor_id: match.debtor_id
      });
      
      await updatePaymentEvent(match.id, {
        matched: true,
        matched_at: now()
      });
      
    } else {
      // No exact match - try fuzzy matching
      const fuzzyMatch = await fuzzyMatchPayment(obPayment);
      
      if (fuzzyMatch && fuzzyMatch.confidence > 70) {
        // Create attention item for manual review
        await createAttentionItem({
          reason: 'payment_match_review',
          priority: 'medium',
          context: {
            ob_payment: obPayment,
            suggested_match: fuzzyMatch,
            confidence: fuzzyMatch.confidence
          }
        });
      }
    }
  }
}
```

Step 4: Update Invoice Status
For matched payments:
→ Update invoice.amount_outstanding -= payment.amount
→ If amount_outstanding == 0:
  - invoice.status = 'paid'
  - invoice.workflow_state = 'resolved'
  - Cancel any pending actions
  - Send "thank you" email to debtor
→ If amount_outstanding > 0:
  - invoice.status = 'partially_paid'
  - Adjust next actions accordingly

Step 5: Verify Promises
→ Check for invoices with outcome.promise_date = today
→ Check if matching payment received
→ If YES:
  - Update debtor.payment_reliability_score += 10
  - Create positive outcome: 'promise_kept'
  - Send internal notification: "ABC Ltd paid as promised"
→ If NO:
  - Create attention_item: 'broken_promise'
  - Schedule follow-up action
  - Update debtor.payment_reliability_score -= 5

Step 6: Training Data Generation
For each matched payment + outcome pair:
→ Create training record:
  {
    conversation_date: action.executed_at,
    outcome_type: outcome.outcome_type,
    promise_date: outcome.promise_date,
    actual_payment_date: payment.ob_timestamp,
    days_delta: daysBetween(promise_date, actual_payment_date),
    debtor_segment: debtor.segment,
    invoice_amount: invoice.amount,
    conversation_sentiment: outcome.sentiment,
    promise_kept: days_delta <= 2 // tolerance
  }
→ Store for ML model training (NOT in Xero, this is YOUR data)

Step 7: Update Cash Flow Forecast
→ Remove paid invoice from forecast
→ Recalculate expected inflows for next 30/60/90 days
→ Update confidence bands based on recent payment accuracy
→ Regenerate forecast_snapshot
```

### 7. Cash Flow Forecasting Workflow

```
┌─────────────────────────────────────────────────────────┐
│ CASH FLOW FORECASTING (Bayesian Model)                 │
└─────────────────────────────────────────────────────────┘

Job: generate_forecast_job(partner_id) - runs daily at 7am

Step 1: Gather Input Data

Inflows (Receivables):
→ All open invoices with:
  - amount_outstanding
  - due_date (or promise_date if available)
  - debtor payment reliability score
  - recent outcomes (promises, disputes)
  - workflow_state

Outflows (Payables):
→ From Open Banking transaction history:
  - Recurring outflows (payroll, rent, subscriptions)
  - Average supplier payment patterns
  - Seasonal patterns
→ From accounting system:
  - Unpaid bills with due dates

Step 2: Build Bayesian Payment Probability Model

For each open invoice, calculate probability distribution 
of payment date:

```python
import numpy as np
from scipy import stats

def forecast_payment_date(invoice, debtor, outcomes):
    """
    Returns probability distribution of payment date
    """
    
    # Prior: based on debtor's historical payment pattern
    if debtor.average_days_to_pay:
        prior_mean = invoice.due_date + debtor.average_days_to_pay
        prior_std = 7  # days uncertainty
    else:
        # New debtor: use industry average
        prior_mean = invoice.due_date + 14
        prior_std = 10
    
    # Update with recent outcome
    if latest_outcome = outcomes.filter(invoice_id=invoice.id).first():
        if latest_outcome.outcome_type == 'promise_to_pay':
            # Strong signal: shift distribution toward promise_date
            likelihood_mean = latest_outcome.promise_date
            likelihood_std = 3  # High confidence in promise
            
            # Adjust by debtor's promise-keeping history
            promise_reliability = calculate_promise_reliability(debtor)
            likelihood_std *= (1 - promise_reliability)  # Less reliable = more uncertainty
            
        elif latest_outcome.outcome_type == 'dispute':
            # Dispute: push payment later
            likelihood_mean = invoice.due_date + 30
            likelihood_std = 15
        
        elif latest_outcome.outcome_type == 'request_time':
            # Requested extension
            likelihood_mean = invoice.due_date + latest_outcome.requested_extension_days
            likelihood_std = 5
        
        else:
            # No strong signal: rely on prior
            likelihood_mean = prior_mean
            likelihood_std = prior_std
        
        # Bayesian update: combine prior + likelihood
        posterior_precision = (1/prior_std**2) + (1/likelihood_std**2)
        posterior_std = np.sqrt(1/posterior_precision)
        posterior_mean = (
            (prior_mean / prior_std**2) + 
            (likelihood_mean / likelihood_std**2)
        ) / posterior_precision
        
    else:
        # No outcome yet: use prior
        posterior_mean = prior_mean
        posterior_std = prior_std
    
    # Return distribution
    return stats.norm(loc=posterior_mean, scale=posterior_std)

# For invoice INV-1234:
payment_dist = forecast_payment_date(invoice, debtor, outcomes)

# Probability invoice is paid by specific date
prob_paid_by_feb_15 = payment_dist.cdf(date('2024-02-15'))

# 80% confidence interval
confidence_low = payment_dist.ppf(0.10)  # 10th percentile
confidence_high = payment_dist.ppf(0.90)  # 90th percentile
```

Step 3: Monte Carlo Simulation for Daily Cash Position

```python
def simulate_cash_flow(partner, n_simulations=10000):
    """
    Run Monte Carlo simulation to generate daily cash forecasts
    """
    
    # Get all open invoices
    invoices = get_open_invoices(partner.id)
    
    # Get recurring outflows from OB history
    recurring_outflows = detect_recurring_payments(partner.truelayer_data)
    
    # Simulation matrix: [n_simulations x 90_days]
    daily_inflows = np.zeros((n_simulations, 90))
    daily_outflows = np.zeros((n_simulations, 90))
    
    for sim in range(n_simulations):
        # For each invoice, sample payment date from distribution
        for invoice in invoices:
            payment_dist = forecast_payment_date(invoice, invoice.debtor, invoice.outcomes)
            sampled_payment_date = int(payment_dist.rvs())  # Random sample
            
            # Add to inflow on that day
            if 0 <= sampled_payment_date < 90:
                daily_inflows[sim, sampled_payment_date] += invoice.amount_outstanding
        
        # Add recurring outflows
        for outflow in recurring_outflows:
            for day in outflow.scheduled_days:  # e.g., [0, 30, 60] for monthly
                if day < 90:
                    daily_outflows[sim, day] += outflow.amount
    
    # Calculate net position for each day
    net_flows = daily_inflows - daily_outflows
    cumulative_position = np.cumsum(net_flows, axis=1)
    
    # Aggregate statistics across simulations
    forecast = []
    for day in range(90):
        forecast.append({
            'date': today + timedelta(days=day),
            'expected_inflow': np.mean(daily_inflows[:, day]),
            'expected_outflow': np.mean(daily_outflows[:, day]),
            'expected_net': np.mean(net_flows[:, day]),
            'cumulative_position': np.mean(cumulative_position[:, day]),
            'confidence_low': np.percentile(cumulative_position[:, day], 10),
            'confidence_high': np.percentile(cumulative_position[:, day], 90),
            'probability_negative': np.mean(cumulative_position[:, day] < 0)
        })
    
    return forecast
```

Step 4: Generate Forecast Snapshot
→ Run simulation for partner
→ Create forecast_snapshot record with results
→ Store assumptions (which invoices, which outcomes, etc.)

Step 5: Identify Cash Risks
→ Scan forecast for days where probability_negative > 20%
→ Create attention_items for upcoming cash shortfalls:
  "Week of Feb 12: 35% chance of cash shortfall due to 
   payroll (£45k) + low confidence on ABC Ltd payment (£20k)"

Step 6: Prioritize Collections
→ Invoices that are critical to avoid cash shortfall get 
  higher priority_scores
→ Example: "We need £30k by Feb 15 for payroll" 
  → prioritize largest invoices due before Feb 15

Step 7: Dashboard Updates
→ Update partner dashboard with:
  - Next 7/30/90 day cash forecast chart
  - Confidence bands visualization
  - Risk alerts
  - Key dependencies ("Cash position depends on ABC Ltd paying £20k")
```

---

## Integration Architecture

### Xero Integration

```typescript
// OAuth 2.0 Setup
const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
const XERO_REDIRECT_URI = 'https://app.qashivo.com/integrations/xero/callback';

// Authorization flow
app.get('/integrations/xero/connect', (req, res) => {
  const authUrl = `https://login.xero.com/identity/connect/authorize?` +
    `response_type=code&` +
    `client_id=${XERO_CLIENT_ID}&` +
    `redirect_uri=${XERO_REDIRECT_URI}&` +
    `scope=accounting.transactions.read accounting.contacts.read offline_access`;
  res.redirect(authUrl);
});

app.get('/integrations/xero/callback', async (req, res) => {
  const { code } = req.query;
  
  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);
  
  // Store encrypted in partner record
  await updatePartner(req.session.partner_id, {
    accounting_platform: 'xero',
    accounting_credentials: encrypt({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000)
    })
  });
  
  res.redirect('/dashboard?xero_connected=true');
});

// Data sync functions
async function syncXeroInvoices(partner_id: string) {
  const partner = await getPartner(partner_id);
  const tokens = decrypt(partner.accounting_credentials);
  
  // Refresh token if expired
  if (Date.now() > tokens.expires_at) {
    tokens = await refreshXeroToken(tokens.refresh_token);
    await updatePartnerTokens(partner_id, tokens);
  }
  
  // Fetch invoices
  const response = await fetch(
    'https://api.xero.com/api.xro/2.0/Invoices?Statuses=AUTHORISED,SUBMITTED',
    {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'xero-tenant-id': tokens.tenant_id,
        'Accept': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  
  // Process invoices
  for (const xeroInvoice of data.Invoices) {
    await upsertInvoice({
      partner_id,
      external_id: xeroInvoice.InvoiceNumber,
      debtor_id: await getOrCreateDebtor(partner_id, xeroInvoice.Contact),
      amount: xeroInvoice.Total,
      currency: xeroInvoice.CurrencyCode,
      due_date: xeroInvoice.DueDate,
      issued_date: xeroInvoice.Date,
      status: mapXeroStatus(xeroInvoice.Status),
      amount_outstanding: xeroInvoice.AmountDue,
      metadata: xeroInvoice
    });
  }
  
  // Fetch payment allocations
  const paymentsResponse = await fetch(
    'https://api.xero.com/api.xro/2.0/Payments',
    {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'xero-tenant-id': tokens.tenant_id,
        'Accept': 'application/json'
      }
    }
  );
  
  const paymentsData = await paymentsResponse.json();
  
  // Create payment events for allocations
  for (const payment of paymentsData.Payments) {
    await createPaymentEvent({
      partner_id,
      source: 'accounting_allocation',
      accounting_payment_id: payment.PaymentID,
      invoice_id: await findInvoiceByExternalId(payment.Invoice.InvoiceNumber),
      allocated_amount: payment.Amount,
      allocated_at: payment.Date
    });
  }
}

// Note: We use Xero data for REFERENCE only
// We do NOT train ML models on Xero API patterns
// Training happens on OB payment data + our outcome data
```

### TrueLayer Integration

```typescript
// Setup auth link for partner
async function createTrueLayerAuthLink(partner_id: string) {
  const response = await fetch('https://auth.truelayer.com/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: process.env.TRUELAYER_CLIENT_ID,
      scope: 'accounts balance transactions offline_access',
      redirect_uri: 'https://app.qashivo.com/integrations/truelayer/callback',
      response_mode: 'form_post',
      providers: ['uk-ob-all', 'uk-oauth-all'],
      state: partner_id  // To identify partner on callback
    })
  });
  
  const { auth_uri } = await response.json();
  return auth_uri;
}

// Handle callback
app.post('/integrations/truelayer/callback', async (req, res) => {
  const { code, state } = req.body;
  const partner_id = state;
  
  // Exchange code for access token
  const tokenResponse = await fetch('https://auth.truelayer.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.TRUELAYER_CLIENT_ID,
      client_secret: process.env.TRUELAYER_CLIENT_SECRET,
      redirect_uri: 'https://app.qashivo.com/integrations/truelayer/callback',
      code
    })
  });
  
  const tokens = await tokenResponse.json();
  
  // Store tokens
  await updatePartner(partner_id, {
    truelayer_access_token: encrypt(tokens.access_token),
    truelayer_refresh_token: encrypt(tokens.refresh_token)
  });
  
  // Initial data sync
  await syncTrueLayerData(partner_id);
  
  res.redirect('/dashboard?open_banking_connected=true');
});

// Sync banking data
async function syncTrueLayerData(partner_id: string) {
  const partner = await getPartner(partner_id);
  const access_token = decrypt(partner.truelayer_access_token);
  
  // Get accounts
  const accountsResponse = await fetch('https://api.truelayer.com/data/v1/accounts', {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  
  const { results: accounts } = await accountsResponse.json();
  
  // For each account, fetch transactions
  for (const account of accounts) {
    const transactionsResponse = await fetch(
      `https://api.truelayer.com/data/v1/accounts/${account.account_id}/transactions?from=${getLastSyncDate()}&to=${today()}`,
      {
        headers: { 'Authorization': `Bearer ${access_token}` }
      }
    );
    
    const { results: transactions } = await transactionsResponse.json();
    
    // Create payment events for inflows
    for (const tx of transactions) {
      if (tx.amount > 0) {  // Inflow
        await createPaymentEvent({
          partner_id,
          source: 'open_banking',
          ob_transaction_id: tx.transaction_id,
          ob_amount: tx.amount,
          ob_timestamp: tx.timestamp,
          ob_reference: tx.description,
          ob_payer_account: tx.meta?.counterparty_account_id,
          matched: false
        });
      }
      
      // Also track outflows for cash flow forecasting
      if (tx.amount < 0) {  // Outflow
        await createOutflowEvent({
          partner_id,
          transaction_id: tx.transaction_id,
          amount: Math.abs(tx.amount),
          timestamp: tx.timestamp,
          description: tx.description,
          category: categorizeOutflow(tx.description)  // ML categorization
        });
      }
    }
  }
  
  // Match payments
  await matchPayments(partner_id);
}

// THIS data (OB transactions) is YOUR training data
// You can legally use this to train ML models because:
// 1. It's accessed via TrueLayer (FCA regulated)
// 2. Your client consented to share it with you
// 3. It's not Xero's API data
```

### Retell AI Integration

```typescript
// Agent configuration
const RETELL_AGENT_CONFIG = {
  agent_name: "Qashivo Credit Control",
  voice_id: "professional_british_female",  // Choose appropriate voice
  language: "en-GB",
  llm_websocket_url: "wss://your-server.com/retell/llm",  // For custom LLM
  
  // Or use Retell's managed LLM:
  llm_provider: "openai",
  model: "gpt-4",
  
  general_prompt: `You are a professional credit control assistant calling on behalf of {company_name}.

Your goal is to:
1. Confirm the contact is aware of the overdue invoice
2. Understand why payment hasn't been made yet
3. Secure a specific commitment to pay (date + amount)
4. Maintain a friendly but firm professional tone

Key information:
- Invoice number: {invoice_number}
- Amount due: {amount_due}
- Original due date: {due_date}
- Days overdue: {days_overdue}

If they commit to paying:
- Confirm the EXACT date they will pay
- Confirm if paying full amount or partial
- Thank them and confirm you'll send an email summary

If they dispute the invoice:
- Listen to their concern
- Acknowledge the issue
- Explain you'll escalate to resolve the dispute
- Don't negotiate - just capture the issue

If they request more time:
- Ask how much time they need
- Ask why they need the extension
- Confirm when they expect to have funds

Always be empathetic but clear about the urgency.
End calls professionally.`,

  begin_message: "Hello, may I speak with {debtor_name} please?",
  
  // Webhook for call events
  webhook_url: "https://app.qashivo.com/webhooks/retell",
  
  // Enable recording
  enable_recording: true,
  
  // Max call duration
  max_call_duration: 600  // 10 minutes
};

// Create agent (one-time setup)
async function createRetellAgent() {
  const response = await fetch('https://api.retellai.com/v1/agent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(RETELL_AGENT_CONFIG)
  });
  
  const { agent_id } = await response.json();
  return agent_id;
}

// Initiate call
async function makeRetellCall(action: Action) {
  const invoice = await getInvoice(action.invoice_id);
  const debtor = await getDebtor(action.debtor_id);
  const partner = await getPartner(action.partner_id);
  
  const response = await fetch('https://api.retellai.com/v1/call', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: process.env.RETELL_AGENT_ID,
      phone_number: debtor.phone,
      from_number: partner.twilio_number,
      
      // Dynamic variables for personalization
      dynamic_variables: {
        company_name: partner.company_name,
        debtor_name: debtor.contact_name,
        invoice_number: invoice.external_id,
        amount_due: formatCurrency(invoice.amount_outstanding),
        due_date: formatDate(invoice.due_date),
        days_overdue: calculateDaysOverdue(invoice.due_date)
      },
      
      // Metadata to track
      metadata: {
        partner_id: partner.id,
        action_id: action.id,
        invoice_id: invoice.id,
        debtor_id: debtor.id
      }
    })
  });
  
  const { call_id } = await response.json();
  
  // Update action with call ID
  await updateAction(action.id, {
    retell_call_id: call_id,
    status: 'in_progress'
  });
  
  return call_id;
}

// Webhook handler
app.post('/webhooks/retell', async (req, res) => {
  const event = req.body;
  
  // Validate signature
  const signature = req.headers['x-retell-signature'];
  if (!validateRetellSignature(signature, req.body)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Store raw event
  await createIntegrationEvent({
    source: 'retell',
    event_type: event.event,
    raw_payload: event
  });
  
  // Process based on event type
  if (event.event === 'call_started') {
    await handleCallStarted(event);
  } else if (event.event === 'call_ended') {
    await handleCallEnded(event);
  } else if (event.event === 'call_analyzed') {
    // Retell can optionally provide AI analysis
    await handleCallAnalyzed(event);
  }
  
  res.status(200).send('OK');
});

async function handleCallEnded(event: any) {
  const { call_id, metadata, call_analysis } = event;
  const action = await getActionByRetellCallId(call_id);
  
  // Extract outcome from transcript
  const outcome = await extractOutcome(event.transcript);
  
  // Create outcome record
  await createOutcome({
    action_id: action.id,
    invoice_id: metadata.invoice_id,
    debtor_id: metadata.debtor_id,
    outcome_type: outcome.outcome_type,
    confidence: outcome.confidence,
    promise_date: outcome.promise_date,
    requested_extension_days: outcome.requested_extension_days,
    dispute_reason: outcome.dispute_reason
  });
  
  // Store recording
  const recording_url = await uploadRecording(event.recording_url, call_id);
  
  // Update action
  await updateAction(action.id, {
    status: 'completed',
    transcript: event.transcript,
    recording_url,
    metadata: {
      ...action.metadata,
      call_duration: event.call_duration,
      call_analysis: call_analysis
    }
  });
  
  // Route outcome
  await routeOutcome(outcome, action);
  
  // Update forecast if promise made
  if (outcome.outcome_type === 'promise_to_pay') {
    await updateForecast(metadata.partner_id);
  }
  
  // Log audit event
  await createAuditEvent({
    partner_id: metadata.partner_id,
    event_type: 'call_completed',
    entity_type: 'action',
    entity_id: action.id,
    changes: { outcome: outcome.outcome_type }
  });
}

// Outcome extraction using GPT-4
async function extractOutcome(transcript: string) {
  // Use GPT-4 to analyze transcript
  // (Implementation shown in earlier section)
  
  // This extracted data is YOUR proprietary training data
  // It's the link between conversation → payment outcome
  // NOT Xero data, so fully trainable
}
```

---

## MVP Feature Prioritization

Based on your ranking:

### Phase 1: Voice + Email/SMS Automation (MVP Launch - Month 1-3)

**Core Features:**
- ✅ Partner onboarding with Xero/QuickBooks/Sage OAuth
- ✅ Invoice sync from accounting platforms
- ✅ Daily action plan generation
- ✅ Human approval dashboard (web app)
- ✅ Email sending (SendGrid)
- ✅ SMS sending (Twilio)
- ✅ Retell AI voice calls (supervised)
- ✅ Call transcript storage
- ✅ Basic outcome extraction (promise to pay, dispute, etc.)
- ✅ Debtor timeline view
- ✅ Audit trail

**What to SKIP in Phase 1:**
- ❌ Open Banking integration (save for Phase 2)
- ❌ Cash flow forecasting (save for Phase 3)
- ❌ Advanced ML-driven timing optimization
- ❌ Payment matching
- ❌ Auto-approval (require manual approval for all)

**Success Metrics:**
- 10 partners onboarded
- 1000+ invoices processed
- 500+ voice calls completed
- 70%+ outcome extraction accuracy
- 80%+ user approval rate (users approve most suggested actions)

### Phase 2: Payment Verification (Month 4-6)

**Add:**
- ✅ TrueLayer Open Banking integration
- ✅ Payment event tracking (OB + accounting)
- ✅ Payment matching algorithm
- ✅ Promise verification ("they said they'd pay Friday, did they?")
- ✅ Debtor reliability scoring
- ✅ Enhanced outcome routing (low confidence → attention queue)

**Success Metrics:**
- 80%+ payment matching accuracy
- Real-time payment verification working
- Debtor reliability scores improving collection timing

### Phase 3: Cash Flow Forecasting (Month 7-9)

**Add:**
- ✅ Bayesian forecasting model
- ✅ Monte Carlo simulation
- ✅ Outflow tracking from OB data
- ✅ Cash position dashboard
- ✅ Risk alerts
- ✅ Collection prioritization based on cash needs

**Success Metrics:**
- Forecast accuracy within ±10% for 7-day horizon
- ±20% for 30-day horizon
- 5+ partners using forecasting actively

### Phase 4: ML Optimization & Scale (Month 10-12)

**Add:**
- ✅ ML models for optimal timing
- ✅ Channel selection AI
- ✅ Debtor segmentation automation
- ✅ Conversation strategy learning
- ✅ API for integrations
- ✅ Mobile app (optional)

---

## Technology Stack Recommendations

### Backend (Node.js/TypeScript)
```
- Framework: Express.js or Fastify
- ORM: Prisma (excellent TypeScript support + Postgres)
- Job Queue: BullMQ (Redis-based, great for scheduled jobs)
- Background Workers: Separate Node processes
- API Docs: OpenAPI/Swagger
```

### Frontend (Web Dashboard)
```
- Framework: Next.js 14 (App Router)
- UI Components: shadcn/ui (excellent for dashboards)
- Charts: Recharts or Chart.js
- State Management: React Query + Zustand
- Auth: NextAuth.js
```

### Database
```
- Primary: PostgreSQL 15+ (via Neon or Supabase)
- Caching: Redis (for job queue + session store)
- Object Storage: Cloudflare R2 or AWS S3 (for recordings)
```

### Infrastructure
```
- Hosting: Vercel (Next.js) + Render/Fly.io (API server)
- Database: Neon (serverless Postgres)
- Job Workers: Render background workers
- Monitoring: Sentry (errors) + PostHog (analytics)
- Logging: Axiom or Betterstack
```

### External Services
```
- Voice AI: Retell AI
- SMS/Voice Numbers: Twilio
- Email: SendGrid or Resend
- Open Banking: TrueLayer
- Accounting: Xero/QuickBooks/Sage APIs
- Auth: Clerk or NextAuth
```

---

## Pricing Strategy Recommendation

### Tiered Pricing (Competitive with ChaserHQ)

**Starter: £99/month**
- Up to 100 invoices/month
- Email + SMS automation
- Basic reporting
- 1 user
- Email support

**Professional: £249/month** (SWEET SPOT for SMBs)
- Up to 500 invoices/month
- Email + SMS + Voice AI (supervised)
- Open Banking payment verification
- Debtor insights + reliability scoring
- 3 users
- Priority email support
- Most popular for SMBs (£500k-£2m revenue)

**Business: £499/month** (For mid-market)
- Up to 2000 invoices/month
- Full feature set
- Cash flow forecasting
- Advanced analytics
- API access
- 10 users
- Phone + email support
- Dedicated onboarding

**Enterprise: Custom**
- Unlimited invoices
- White-label option
- Multi-entity support
- Custom integrations
- SLA
- Dedicated account manager

### Add-ons
- Extra users: £25/month per user
- Additional invoices: £50 per 100/month
- Premium support: £99/month

### Competitive Positioning
- ChaserHQ: £95-£350/month (but no conversational AI, no OB, no forecasting)
- Your advantage: "Pay slightly more, get 10x more intelligence"
- Lead with ROI: "Customers who switch collect 23% faster on average"

---

## Next Steps for Development

### Week 1-2: Foundation
1. Set up monorepo structure (Next.js + API)
2. Configure Postgres schema (Prisma)
3. Build OAuth flows for Xero/QuickBooks
4. Basic partner dashboard

### Week 3-4: Invoice Sync
1. Implement accounting platform sync jobs
2. Build invoice/debtor data models
3. Create daily action plan algorithm
4. Build approval dashboard UI

### Week 5-6: Communication
1. Integrate SendGrid (email)
2. Integrate Twilio (SMS)
3. Build message template system
4. Action execution workers

### Week 7-8: Voice AI
1. Set up Retell AI account
2. Configure agents
3. Build call initiation flow
4. Webhook handlers
5. Transcript storage

### Week 9-10: Outcome Processing
1. Build GPT-4 outcome extraction
2. Create outcome routing logic
3. Attention items system
4. Audit trail

### Week 11-12: Polish & Testing
1. End-to-end testing
2. Security audit
3. Beta user onboarding
4. Documentation

---

This is your complete Qashivo workflow! Would you like me to dive deeper into any specific section?
