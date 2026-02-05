# Qashivo Current Architecture

**Document Purpose:** Response to the "Qashivo Complete Workflow & System Architecture" proposal document, explaining how Qashivo is currently structured and where there are gaps or differences.

---

## Executive Summary

Qashivo is an AI-powered credit control platform with a **supervised autonomy model** where AI agents propose collection actions that can be reviewed before execution. The current implementation has significant overlap with the proposed architecture but differs in several key areas:

**What Exists Today:**
- Multi-channel communication (email, SMS, voice via Retell AI)
- AI-powered intent analysis of inbound communications
- Cash flow forecasting based on promises to pay, payment plans, and behavioral signals
- Multi-tenant architecture with partner/client hierarchy (B2B2B model)
- Xero integration with OAuth and sync
- Workflow engine with visual node-based design

**Key Gaps vs Proposal:**
- No Open Banking integration (TrueLayer) - relies on accounting software for payment data with sync lag
- Payment matching is done via accounting software allocation, not real-time bank feeds
- `outcomes` table exists but is not fully integrated - legacy tables (`detectedOutcomes`, `contactOutcomes`, `promisesToPay`) still in parallel use
- Attention items exist but routing logic differs from proposal

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        QASHIVO PLATFORM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Web App    │    │  API Server  │    │  Worker Jobs │          │
│  │   (React/    │◄──►│(Node/Express)│◄──►│  (Background │          │
│  │    Vite)     │    │              │    │   Services)  │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                    │                    │                  │
│         └────────────────────┴────────────────────┘                  │
│                              │                                        │
│                    ┌─────────▼─────────┐                            │
│                    │   PostgreSQL      │                            │
│                    │   (Neon)          │                            │
│                    └───────────────────┘                            │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Accounting   │    │  ❌ TrueLayer │    │   Retell AI  │
│ Platforms    │    │ (NOT YET     │    │  (Voice AI)  │
├──────────────┤    │ INTEGRATED)  │    ├──────────────┤
│ • Xero ✅    │    └──────────────┘    │ • Calls      │
│ • QuickBooks │                        │ • Transcripts│
│   (schema    │                        │ • Webhooks   │
│    ready)    │                        └──────────────┘
│ • Sage       │                               │
│   (schema    │                               │
│    ready)    │                               │
└──────────────┘                               │
        │                                      │
        └──────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Communication    │
                    │    Channels       │
                    ├───────────────────┤
                    │ • Vonage (SMS) ✅ │
                    │ • SendGrid ✅     │
                    │ • Retell (Voice)✅│
                    │ • WhatsApp        │
                    │   (via Vonage)    │
                    └───────────────────┘
```

---

## Database Schema Comparison

### Current Implementation: 119 Tables

The current schema is more extensive than the proposal, with 119 tables covering:

| Category | Tables | Status |
|----------|--------|--------|
| Core Entities | `users`, `tenants`, `partners`, `contacts`, `invoices` | ✅ Implemented |
| Actions & Communications | `actions`, `messageDrafts`, `inboundMessages`, `conversations`, `emailMessages` | ✅ Implemented |
| Outcomes | `outcomes` (unified), `detectedOutcomes`, `contactOutcomes`, `promisesToPay`, `paymentPromises` | ⚠️ Migration in progress |
| Workflows | `workflows`, `workflowNodes`, `workflowConnections`, `workflowTemplates` | ✅ Implemented |
| Attention Items | `attentionItems` | ✅ Implemented |
| Forecasting | `forecastSnapshots`, `forecastPoints`, `forecastVarianceTracking` | ✅ Implemented |
| Payment Events | `bankTransactions` (from accounting software sync - Xero/Sage/QuickBooks IDs) | ⚠️ No Open Banking |
| Partner Architecture | `partners`, `smeClients`, `partnerClientRelationships` | ✅ Implemented |

### Key Schema Differences from Proposal

#### 1. Partners Table (Current vs Proposed)
**Current:** Called `partners` with extensive white-labeling fields
```typescript
partners {
  id, name, slug, email, phone, website,
  logoUrl, brandColor, accentColor, brandName,
  emailFromName, emailReplyTo, emailFooterText,
  subscriptionPlanId, stripeCustomerId, stripeSubscriptionId,
  status, createdAt, updatedAt
}
```
**Proposal Gap:** Missing `accounting_credentials`, `truelayer_access_token`, `settings.voice_enabled`

#### 2. Debtors/Contacts (Current vs Proposed)
**Current:** Uses `contacts` table with behavioral fields
```typescript
contacts {
  id, tenantId, name, email, phone, companyName,
  role: 'customer' | 'vendor' | 'both',
  riskScore, riskBand,
  preferredContactMethod, paymentTerms, creditLimit,
  averageDaysToSettle, paymentReliabilityScore,
  vulnerabilityFlag, disputeHistory
}
```
**Matches Proposal:** `payment_reliability_score`, `average_days_to_pay`, `historical_disputes`, `preferred_channel`, `opted_out_voice`

#### 3. Invoices (Current vs Proposed)
**Current:**
```typescript
invoices {
  id, tenantId, contactId, xeroInvoiceId,
  invoiceNumber, amount, amountDue, currency,
  dueDate, issuedDate, status,
  outcomeOverride, // NEW: 'Silent' | 'Disputed' | 'Plan' | null
  createdAt, updatedAt
}
```
**Proposal Has:** `workflow_state`, `priority_score`, `last_chased_at`, `next_action_due`
**Current Uses:** `actions` table with `workState` and `inFlightState` fields instead

#### 4. Actions Table (Current - Matches Proposal Well)
```typescript
actions {
  id, tenantId, invoiceId, contactId, userId,
  type: 'email' | 'sms' | 'call' | 'whatsapp' | 'payment' | 'note',
  status: 'pending' | 'pending_approval' | 'scheduled' | 'executing' | 'completed' | 'failed',
  subject, content, scheduledFor, completedAt,
  
  // Supervised autonomy (matches proposal)
  approvedBy, approvedAt, confidenceScore, exceptionReason,
  
  // Intent detection
  intentType, intentConfidence, sentiment,
  
  // WorkState tracking (similar to proposal)
  workState: 'PLAN' | 'IN_FLIGHT' | 'ATTENTION' | 'RESOLVED',
  inFlightState: 'SCHEDULED' | 'SENT' | 'AWAITING_REPLY' | 'COOLDOWN' | 'ESCALATION_DUE',
  awaitingReplyUntil, cooldownUntil
}
```

#### 5. Outcomes (Current - Migration in Progress)
**Proposal:** Single `outcomes` table with structured `outcome_type` and `extracted` JSON
**Current:** Unified `outcomes` table exists with structured fields:
```typescript
outcomes {
  id, tenantId, debtorId, invoiceId,
  linkedInvoiceIds, // JSON array for multi-invoice outcomes
  type, confidence, confidenceBand, requiresHumanReview,
  effect, // FORECAST_UPDATED, ROUTED_TO_ATTENTION, MANUAL_REVIEW
  extracted: { // Structured JSON matching proposal
    promiseToPayDate?, promiseToPayAmount?, confirmedBy?,
    paymentPlanSchedule?, disputeCategory?, docsRequested?, oooUntil?
  },
  sourceChannel, sourceMessageId, rawSnippet
}
```
**Gap:** Legacy tables still in parallel use during migration:
- `detectedOutcomes` - AI-detected outcomes (older)
- `contactOutcomes` - Per-contact outcome history (older)
- `promisesToPay` - PTP records with breach detection
- `paymentPromises` - Alternate PTP tracking

#### 6. Payment Events (Current - MAJOR GAP)
**Proposal:** Dual-source from Open Banking + Accounting with real-time verification
**Current:** `bankTransactions` from accounting software sync only (no real-time bank feeds)
```typescript
bankTransactions {
  id, tenantId, bankAccountId,
  xeroTransactionId, sageTransactionId, quickBooksTransactionId, // Multi-provider IDs
  transactionDate, amount, type, description,
  isReconciled, reconciledAt
}
```
**Missing:** 
- Open Banking integration (TrueLayer) for real-time transaction feeds
- Real-time payment verification before accounting software sync
- Payment matching confidence scoring

#### 7. Attention Items (Current - Matches Proposal)
```typescript
attentionItems {
  id, tenantId, type, severity, status,
  invoiceId, contactId, actionId, inboundMessageId,
  title, description, payloadJson,
  assignedToUserId, resolvedByUserId, resolvedAt,
  resolutionNotes, resolutionAction
}
```

---

## Core Services Comparison

### 1. Intent Analyst ✅ IMPLEMENTED
**Location:** `server/services/intentAnalyst.ts`

**Capabilities:**
- Analyzes inbound email, SMS, and voice transcripts
- Uses OpenAI GPT-4o-mini for classification
- Detects intents: `payment_plan`, `dispute`, `promise_to_pay`, `payment_confirmation`, `vulnerability`, `callback_request`, `general_query`, `admin_issue`
- Extracts entities: amounts, dates, invoice references
- Creates follow-up actions automatically
- Flags for human review when confidence < 0.6 (CONFIDENCE_THRESHOLD), or when vulnerability/dispute detected, or explicit `requiresHumanReview` flag

**Matches Proposal:** Yes - core functionality aligns

### 2. Cash Flow Forecasting ✅ IMPLEMENTED
**Location:** `server/services/dashboardCashInflowService.ts`

**Data Sources Used:**
- Open invoices (pending/overdue status)
- Promises to Pay (from `promisesToPay` and `paymentPromises` tables)
- Payment Plans (from `paymentPlans` table)
- AI-detected intents (from `actions.intentType`)
- Contact risk bands (for confidence adjustment)

**Output:**
```typescript
interface CashInflowPoint {
  date: string;
  expectedAmount: number;
  confidenceWeightedAmount: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  invoiceCount: number;
}
```

**Gap vs Proposal:** No real-time payment verification from Open Banking

### 3. Workflow Engine ✅ IMPLEMENTED
**Location:** `server/services/workflowSeeder.ts`, `server/services/collectionsScheduler.ts`

**Architecture:**
- Visual node-based workflow editor
- Two-phase execution: Planner (hourly) → Executor (every 10 mins)
- Pre-built "Standard Collections Workflow" with 5 stages
- Adaptive scheduling based on customer behavior

**Standard Workflow Stages:**
1. Day -7: Pre-Due Reminder (Email)
2. Day 7: Polite Reminder (Email)
3. Day 14: Firm Follow-up (Email/SMS)
4. Day 21: Escalation Warning (Email/SMS)
5. Day 30: Final Notice (Voice Call)

### 4. AI Message Generator ✅ IMPLEMENTED
**Location:** `server/services/aiMessageGenerator.ts`

**Capabilities:**
- Generates personalized collection messages
- Adapts tone based on playbook stage
- Supports email, SMS, and voice scripts
- Uses OpenAI for dynamic content generation

### 5. Retell AI Voice ✅ IMPLEMENTED
**Location:** `server/retell-service.ts`

**Capabilities:**
- Initiates outbound voice calls
- Receives call transcripts via webhook
- Integrates with Intent Analyst for transcript analysis

### 6. Communication Channels ✅ IMPLEMENTED

| Channel | Service | Status |
|---------|---------|--------|
| Email | SendGrid | ✅ Production |
| SMS | Vonage | ✅ Production |
| WhatsApp | Vonage | ✅ Production |
| Voice | Retell AI | ✅ Production |

---

## Major Gaps vs Proposal

### 1. Open Banking (TrueLayer) ❌ NOT IMPLEMENTED
**Impact:** 
- No real-time payment verification
- Relies on Xero sync (up to 4-hour lag)
- Cannot verify payments before they appear in accounting software
- No instant cash position updates

**To Implement:**
- TrueLayer OAuth flow for business bank accounts
- Transaction polling/webhooks
- Payment matching algorithm
- Real-time forecast updates

### 2. Unified Outcomes Table ⚠️ TABLE EXISTS, MIGRATION NEEDED
**Current State:** `outcomes` table exists with correct schema including `extracted` JSONB and confidence fields, but legacy tables (`detectedOutcomes`, `contactOutcomes`, `promisesToPay`) are still used in parallel
**Impact:**
- Dual codepaths for outcome handling
- Harder to query complete outcome history
- Inconsistent forecast impact calculations

**To Implement:**
- Migrate services to use unified `outcomes` table exclusively
- Add `affects_forecast` and `forecast_adjustment` fields if missing
- Deprecate legacy outcome tables after migration
- Update Intent Analyst to write to `outcomes` table

### 3. Controlled Learning Loop ⚠️ PARTIAL
**Current:** 
- Actions require approval (supervised autonomy)
- Intent detection creates attention items
- No explicit outcome → training pipeline

**Missing:**
- Structured "conversation intent → payment outcome" correlation
- Model performance tracking
- A/B test framework for communication strategies

### 4. Audit Trail ⚠️ PARTIAL
**Current:** `activityLogs`, `permissionAuditLog`, `partnerAuditLog`
**Missing:** Unified `audit_events` table with before/after state snapshots

---

## Partner Architecture (B2B2B Model) ✅ IMPLEMENTED

### Current Structure

```
Partner (Accounting Firm)
    └── SME Clients (via partnerClientRelationships)
            └── Tenants (actual businesses)
                    └── Contacts/Invoices/Actions
```

### Tables
- `partners` - Accounting firms with white-labeling
- `smeClients` - Client businesses under partners
- `partnerClientRelationships` - Junction table
- `tenants` - Business workspaces with Xero connection
- `users` - With `partnerId` and `tenantId` for role-based access

### Access Control
- Role-based: `owner`, `admin`, `user`, `partner`, `client_owner`, `client_user`
- 50+ granular permissions in `permissions`, `rolePermissions`, `userPermissions` tables
- Session-based tenant switching

---

## What Would Need to Change

### To Implement Proposal Fully:

#### High Effort (Major Development)
1. **TrueLayer Integration** - OAuth flow, transaction sync, payment matching
2. **Outcomes Table Migration** - Migrate services to use existing `outcomes` table exclusively, deprecate legacy tables
3. **Controlled Learning Loop** - Build training data pipeline

#### Medium Effort
4. **Real-time Payment Verification** - Cross-reference bank + accounting
5. **Forecast Confidence Bands** - Add low/high confidence ranges
6. **Audit Events Consolidation** - Unified before/after tracking

#### Low Effort (Config/Minor)
7. **Extend Tenant Settings** - Add missing voice_enabled, escalation_policy
8. **Add Invoice Workflow State** - Move from actions table to invoices
9. **Debtor Metadata** - Add lifetime_value, opted_out_sms fields

### What Can Be Reused
- Core multi-tenant architecture
- Communication channels (email, SMS, voice)
- Intent Analyst service
- Workflow engine fundamentals
- Partner/client hierarchy
- Cash flow forecasting (base logic)
- Action approval workflow

---

## Recommendation

The current implementation provides a solid foundation. The **highest-value additions** would be:

1. **TrueLayer Open Banking** - Enables real-time payment verification, the core differentiator vs "blind message broadcasting"
2. **Outcomes Table Migration** - The schema exists; migrate services to use `outcomes` exclusively for simplified forecast calculations and ML training
3. **Outcome → Forecast Pipeline** - Makes the "conversation intent → payment outcome" correlation explicit

These three changes would bridge the main gaps between current state and the proposal vision.

---

*Document created: February 2026*
*Last updated: February 2026*
