# Xero Sync Strategy & Initial Cadence Engine

## Overview

Implement a lean Xero sync that brings over the minimum data needed for credit control, with an initial cadence assignment engine that works without payment history. This must be extensible for future intelligence sources (Open Banking, Riley AI, Qashivo's own collected data).

## IMPORTANT: Xero API Data Restrictions

Xero's Developer Terms (effective 2 March 2026) prohibit using API Data to train, fine tune, adapt, or enhance any AI Models including predictive analytics tools. Therefore:
- We ONLY use Xero data for operational credit control (displaying invoices, tracking status, chasing)
- We do NOT compute payment behaviour metrics from Xero data (days-to-pay, payment patterns, trend analysis)
- Payment intelligence will come from Open Banking in a future phase
- Any debtor profiling from Xero must be limited to current-state observations (what's overdue right now), not historical pattern analysis

## Part 1: Lean First Sync

### What to fetch from Xero

On first connect, fetch ALL ACCREC invoices (no date filter) but only store what we need:

**cached_xero_invoices — fields to store:**
- xero_invoice_id (conflict key for upsert)
- xero_contact_id
- invoice_number
- reference
- status (AUTHORISED, SUBMITTED, PAID, VOIDED, DELETED, DRAFT)
- invoice_date
- due_date
- amount (total invoice amount)
- amount_due (outstanding amount)
- amount_paid
- currency_code
- updated_date_utc (for modifiedSince on subsequent syncs)
- tenant_id
- synced_at

**Do NOT store:** line items, descriptions, tax breakdowns, attachments, or any other invoice detail. Keep it lean.

**cached_xero_contacts — fields to store:**
- xero_contact_id
- name
- email_address
- first_name, last_name
- phone (if available)
- contact_status (ACTIVE, ARCHIVED)
- is_customer, is_supplier
- tenant_id
- synced_at

### Sync flow

1. On signup/first Xero connect:
   - Clear any existing cached data for this tenant
   - Fetch all ACCREC invoices (all statuses, no date filter)
   - Fetch all contacts
   - Insert into cached tables
   - Process into invoices and debtors tables (only non-PAID, non-VOIDED, non-DELETED, non-DRAFT for outstanding calculations)
   - Record `lastSuccessfulSync` on tenant record
   - Trigger cadence assignment (Part 2 below)

2. Subsequent syncs:
   - Use `modifiedSince=lastSuccessfulSync` — Xero returns anything that changed
   - Include ALL statuses in the request so we catch invoices that moved to PAID/VOIDED
   - Upsert into cached tables (match on xero_invoice_id)
   - Re-process affected debtors (recalculate outstanding, update status)
   - Update `lastSuccessfulSync` on success
   - Re-evaluate cadence for affected debtors (Part 2 below)

## Part 2: Initial Cadence Assignment Engine

### Concept

Every debtor gets assigned a `chasing_strategy` that determines the cadence and tone of collection communications. The strategy is set initially based on observable data and then adapts as Qashivo collects more intelligence.

### Strategy determination — three sources (priority order)

**Source 1: Riley overrides (highest priority, future Sprint 7)**
- If Riley has gathered intelligence about a debtor (stored in `ai_facts`), it overrides the default
- Example: accountant tells Riley "Marwood always pays late but they always pay" → patient strategy
- Not built yet, but the data model must accommodate it

**Source 2: Current-state assessment (built now)**
- Based on what the first sync reveals about each debtor's CURRENT outstanding invoices
- This is not historical analysis — it's observing the present state
- Logic below

**Source 3: Default template (fallback)**
- For brand new debtors with no outstanding invoices at time of sync
- Applied when a new invoice is created in Xero and synced for the first time

### Current-state assessment logic

On first sync, for each debtor with outstanding (AUTHORISED/SUBMITTED) invoices, assess:

```
inputs:
  - total_outstanding: sum of amount_due across all outstanding invoices
  - oldest_overdue_days: max(today - due_date) for invoices past due, 0 if none overdue
  - overdue_invoice_count: count of invoices past their due date
  - total_invoice_count: count of all outstanding invoices
  - overdue_percentage: overdue_invoice_count / total_invoice_count
  - largest_invoice_amount: max amount_due across outstanding invoices
```

**Strategy assignment rules:**

```
IF oldest_overdue_days > 90 OR (overdue_percentage > 0.7 AND total_outstanding > 1000):
  → strategy: "escalated"
  → cadence: every 5 days
  → tone: firm
  → rationale: "Significant overdue debt requiring immediate attention"

ELSE IF oldest_overdue_days > 60:
  → strategy: "persistent"  
  → cadence: every 7 days
  → tone: firm but professional
  → rationale: "Extended overdue period"

ELSE IF oldest_overdue_days > 30:
  → strategy: "active"
  → cadence: every 10 days
  → tone: professional
  → rationale: "Moderately overdue"

ELSE IF oldest_overdue_days > 7:
  → strategy: "standard"
  → cadence: every 14 days
  → tone: friendly-professional
  → rationale: "Recently overdue"

ELSE IF oldest_overdue_days > 0:
  → strategy: "gentle"
  → cadence: every 21 days  
  → tone: friendly reminder
  → rationale: "Newly overdue"

ELSE (nothing overdue):
  → strategy: "monitoring"
  → cadence: no active chasing, trigger on due date
  → tone: n/a
  → rationale: "All invoices within terms"
```

### Default template (for new debtors)

When a new invoice syncs for a debtor with no prior history in Qashivo:

```
→ strategy: "standard"
→ cadence: reminder at 3 days before due, then 7, 14, 30, 45, 60 days overdue
→ tone: escalating from friendly to firm
→ rationale: "Default new debtor strategy"
```

### Data model

**debtor_strategy table:**
```sql
CREATE TABLE debtor_strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  debtor_id UUID NOT NULL REFERENCES debtors(id),
  
  -- Current strategy
  strategy_code VARCHAR(20) NOT NULL DEFAULT 'standard',
  cadence_days INTEGER NOT NULL DEFAULT 14,
  tone VARCHAR(20) NOT NULL DEFAULT 'professional',
  
  -- How was this strategy determined?
  source VARCHAR(20) NOT NULL DEFAULT 'default',  -- 'default', 'assessment', 'riley', 'manual', 'open_banking'
  rationale TEXT,
  
  -- Assessment inputs (snapshot of what we observed)
  assessed_total_outstanding DECIMAL(12,2),
  assessed_oldest_overdue_days INTEGER,
  assessed_overdue_count INTEGER,
  assessed_at TIMESTAMP WITH TIME ZONE,
  
  -- Override tracking
  manually_overridden BOOLEAN DEFAULT FALSE,
  overridden_by UUID REFERENCES users(id),
  overridden_at TIMESTAMP WITH TIME ZONE,
  override_reason TEXT,
  
  -- Extensibility for future intelligence sources
  confidence_score DECIMAL(3,2),  -- 0.00 to 1.00, NULL until we have payment intelligence
  next_review_date DATE,          -- when to re-assess this strategy
  metadata JSONB DEFAULT '{}',    -- flexible store for future signals
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tenant_id, debtor_id)
);
```

Key design decisions:
- `source` field tracks WHERE the strategy came from — critical for audit trail and for knowing when better intelligence should override
- `confidence_score` is NULL initially — populated later when Open Banking or Riley provides intelligence
- `metadata` JSONB is the extensibility escape hatch — future signals (Riley facts, Open Banking profiles, Qashivo's own collection outcome data) can be stored here without schema changes
- `next_review_date` allows periodic re-assessment as new data comes in
- Manual override always wins (accountant knows best)

### Re-assessment triggers

The strategy should be re-evaluated when:
1. A sync updates invoice statuses for this debtor (invoice paid, new invoice appears)
2. Riley gathers new intelligence about the debtor (future)
3. Open Banking payment data arrives (future)
4. A collection action gets a response (debtor replies, disputes, promises to pay)
5. The `next_review_date` is reached
6. The accountant manually overrides

For now (MVP v1), only implement triggers 1 and 6. The others are hooks for future sprints.

## Part 3: Implementation approach

1. Update the Xero sync service to implement the lean sync flow (Part 1)
2. Create the `debtor_strategy` table with migration
3. Build the cadence assessment function that runs after first sync and after each subsequent sync
4. Add a manual override endpoint (PATCH /api/debtors/:id/strategy) for accountant overrides
5. Ensure the Debtors page UI can display the current strategy and allow overrides
6. Write the default strategy seeding for new debtors

Before implementing, review this design and flag any concerns or edge cases. In particular:
- Does the debtor_strategy table need any additional fields for the existing agent/compliance engine to work?
- Are there any conflicts with the existing default_strategies or strategy tables already in the codebase?
- Is the assessment logic sensible for real-world credit control?

## Part 4: Document Delivery Architecture (Statements & Invoices)

### Principle

Qashivo is the intelligence and orchestration layer — it decides WHEN to chase, WHAT TONE to use, and WHAT TO SAY. Xero is the document system that produces the financial artefacts (statements, invoice PDFs). Each system does what it's best at. We do NOT build a statement generator or store PDFs.

### Statement Delivery (Primary Collection Tool)

**Design principle:** You never chase an invoice, you chase a BALANCE. The most effective collection communication puts the full picture in front of the debtor: everything they owe, due dates, what's overdue. A statement does this. An individual invoice doesn't.

**Flow for automated chase emails:**

```
1. Agent decides to chase debtor (based on cadence engine)
2. Fetch fresh statement PDF from Xero API for this contact
   - Endpoint: GET /api.xro/2.0/Contacts/{ContactID}/Statements
   - Or: Use the Xero statement report endpoint
   - The statement reflects the LATEST position in Xero (if a payment landed an hour ago, it won't show as outstanding)
3. Attach statement PDF to the chase email via SendGrid
4. Discard the PDF after sending — no persistent document storage
5. Log the communication event (date, type, debtor, strategy, outcome)
```

**Why fetch-at-send-time, not pre-fetch:**
- Statements go stale immediately — a payment could land between fetch and send
- No document storage needed — reduces complexity and data footprint
- One Xero API call per chase communication — manageable volume since you're not chasing every debtor daily
- The statement is always accurate to the moment of sending

**Chase email structure:**
```
Subject: Outstanding balance — {debtor_name} — {total_outstanding}
Body: [Agent-generated content based on tone/strategy]
Attachment: Statement PDF from Xero (fresh fetch)
```

For debtors with a SINGLE outstanding invoice, the statement still works — it just shows one line item. Consistent approach, no branching logic needed.

### Individual Invoice Delivery (Secondary — On Request Only)

When a debtor replies asking for a specific invoice copy:

**Option A (preferred): Trigger send via Xero API**
```
POST /api.xro/2.0/Invoices/{InvoiceID}/Email
```
- The debtor receives the invoice email from Xero, formatted as the business normally sends
- Looks professional, consistent with what they're used to receiving
- One API call, no PDF handling on our side

**Option B (fallback): Deep link to Xero**
- Provide the accountant with a direct link to the invoice in Xero
- URL format: https://go.xero.com/app/{shortcode}/invoicing/view/{xero_invoice_id}
- The accountant clicks through and sends manually from Xero
- Used when API send fails or accountant wants to review before sending

### Accountant Escape Hatch

The Debtor Detail page (Sprint 6) should include:
- "View in Xero" deep link for each invoice — opens the invoice directly in Xero
- "Resend Invoice" button — triggers Option A (Xero API send)
- "Send Statement" button — fetches statement PDF, opens email compose with attachment
- All actions logged in the communication timeline

### What NOT to Build

- Do NOT build a statement/invoice PDF generator inside Qashivo
- Do NOT cache or persistently store any PDF documents
- Do NOT batch-fetch statements for all debtors on sync
- Do NOT replicate Xero's invoice email templates

### API Considerations

- Xero rate limits: 60 calls per minute. Statement fetches during a batch chase run need throttling (same 1.5s delay pattern already used in sync)
- If the Xero token is expired at chase-time, refresh it first (existing token refresh logic handles this)
- If Xero API is unavailable, queue the chase for retry rather than sending without the statement
- The statement fetch is a read operation — safe to retry on failure

### Data Model Addition

Add to the existing communication/activity log:

```sql
-- No new table needed, but ensure the agent_activities or communications table has:
-- document_type: 'statement' | 'invoice' | 'none'
-- document_fetched_at: timestamp of when the PDF was fetched from Xero
-- xero_api_status: 'success' | 'failed' | 'token_expired' | 'rate_limited'
-- These fields support audit trail and debugging of document delivery issues
```

### Future Enhancement (Not MVP)

When the debtor portal is built (existing in codebase but not yet active), debtors could view their statement online via a secure link rather than as a PDF attachment. This gives you open/view tracking and a path to online payment. But for MVP, PDF attachment via email is the proven approach that every accountant and debtor understands.
