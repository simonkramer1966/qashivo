# Invoice Status & Outcomes Model

## Overview

Qashivo uses a simplified invoice status model (as of January 2026) that separates:
1. **Invoice Status** - The lifecycle status from the accounting software (Xero/QuickBooks)
2. **Outcome Override** - The debtor's response during collections, tracked by Qashivo
3. **Days Overdue** - A simple computed value from the due date

This model replaced a more complex "canonical" model that had multiple age bands and outcome tables.

---

## Invoice Status (Source of Truth: Accounting Software)

The invoice status comes directly from Xero or QuickBooks and is synced via the API middleware.

| Status | Description |
|--------|-------------|
| `OPEN` | Invoice is unpaid/outstanding |
| `PAID` | Invoice has been fully paid |
| `VOID` | Invoice was voided/cancelled |

### Database Column
```sql
invoices.invoice_status VARCHAR DEFAULT 'OPEN'
```

### Notes
- This is the **source of truth** - it comes from the accounting software
- Do not set this manually; it syncs from Xero/QB
- The old `WRITTEN_OFF` status has been removed

---

## Days Overdue (Computed)

Days overdue is computed at runtime, not stored:

```
daysOverdue = today - dueDate
```

| Value | Meaning |
|-------|---------|
| Negative | Invoice is not yet due (e.g., -7 means due in 7 days) |
| 0 | Due today |
| Positive | Days past due (e.g., 30 means 30 days overdue) |

### Usage
- Sort and filter invoices by severity
- Display aging information in the UI
- No complex age bands (DUE/PENDING/OVERDUE/etc.) - just use the raw number

---

## Outcome Override (Debtor Response Tracking)

The outcome override tracks what happened during collections. This is stored on the invoice and **persists after payment** for learning and analytics.

| Value | Description |
|-------|-------------|
| `null` | No action taken yet (default) |
| `Silent` | Collection action was taken, but debtor did not respond |
| `Disputed` | Debtor disputes the invoice |
| `Plan` | Payment plan in place (see Payment Plans section) |

### Database Column
```sql
invoices.outcome_override VARCHAR NULL
```

### Precedence
When displaying debtor status, use this precedence:
1. If `outcome_override = 'Disputed'` → Show as disputed
2. If `outcome_override = 'Plan'` → Show as plan/query
3. If `outcome_override = 'Silent'` → Show as no response
4. Otherwise → Use days overdue logic (overdue, due, etc.)

### Persistence
The outcome override is **not cleared when the invoice is paid**. This allows the system to learn patterns like:
- "Invoices that were Silent then eventually paid"
- "Invoices that had a Plan and paid on schedule"

---

## Payment Plans (Simplified for MVP)

Payment plans can cover multiple invoices. Breach detection uses plan-level outstanding comparison rather than individual installment tracking.

### Tables

#### payment_plans
Main plan record with breach detection fields.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR (UUID) | Primary key |
| tenant_id | VARCHAR | Tenant reference |
| contact_id | VARCHAR | Customer/debtor reference |
| total_amount | DECIMAL | Total amount of the plan |
| initial_payment_amount | DECIMAL | Initial payment (if any) |
| plan_start_date | TIMESTAMP | When the plan starts |
| payment_frequency | VARCHAR | `weekly`, `monthly`, `quarterly` |
| number_of_payments | INTEGER | Total number of payments |
| status | VARCHAR | `active`, `completed`, `defaulted`, `cancelled` |
| source | VARCHAR | `manual` (from UI) or `voice` (from voice agent) |
| outstanding_at_creation | DECIMAL | Snapshot of total outstanding when plan created |
| next_check_date | TIMESTAMP | When to check for payment activity |
| last_checked_outstanding | DECIMAL | Last verified total outstanding |
| last_checked_at | TIMESTAMP | When we last checked |
| created_by_user_id | VARCHAR | User who created (nullable for voice agent) |

#### payment_plan_invoices
Junction table linking invoices to plans (supports multi-invoice plans).

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR (UUID) | Primary key |
| payment_plan_id | VARCHAR | Reference to plan |
| invoice_id | VARCHAR | Reference to invoice |
| added_at | TIMESTAMP | When invoice was added |
| added_by_user_id | VARCHAR | User who added |

### Breach Detection

The system uses a simplified approach for MVP:

1. **When plan is created:**
   - Sum all outstanding balances from linked invoices
   - Store as `outstanding_at_creation` and `last_checked_outstanding`
   - Set `next_check_date` = planStartDate + frequency

2. **Daily breach detection job:**
   - Find active plans where `next_check_date < today`
   - For each plan: sum current outstanding across all linked invoices
   - If outstanding decreased → payment received, bump `next_check_date` by frequency
   - If outstanding unchanged → flag as potential breach, create follow-up action
   - If outstanding = 0 → mark plan as completed

### Plan Entry Points
1. **Customer Drawer (Manual)** - User selects invoices and defines payment terms
2. **Voice Agent** - Agrees plan for total outstanding (covers all open invoices)

---

## Display Logic (Cashboard)

The Cashboard uses `getDebtorStatus()` function with this logic:

```typescript
function getDebtorStatus(debtor) {
  // 1. Check if paid
  if (debtor.totalOutstanding === 0) return 'paid';
  
  // 2. Use outcomeOverride if set
  if (debtor.outcomeOverride === 'Disputed') return 'dispute';
  if (debtor.outcomeOverride === 'Plan') return 'query';
  if (debtor.outcomeOverride === 'Silent') return 'no_contact';
  
  // 3. Check flags (legacy compatibility)
  if (debtor.disputeFlag) return 'dispute';
  if (debtor.queryFlag) return 'query';
  if (debtor.brokenFlag) return 'broken';
  if (debtor.promiseFlag) return 'promised';
  
  // 4. Use days overdue
  if (debtor.oldestDaysOverdue > 0) {
    if (!debtor.lastActionAt) return 'overdue';
    // Check if action was recent
    const daysSinceAction = daysBetween(debtor.lastActionAt, now);
    if (daysSinceAction > 3) return 'no_contact';
    return 'overdue';
  }
  
  return 'due';
}
```

---

## Migration from Old Model

The old "canonical" model (removed) had:
- `outcomes` table - Append-only log of debtor responses
- `invoice_outcome_latest` table - Materialized view of latest outcome
- Complex age bands (DUE, PENDING, OVERDUE, CRITICAL, RECOVERY, LEGAL)
- Outcome types (PROMISE_TO_PAY, REQUEST_MORE_TIME, PAYMENT_PLAN, DISPUTE, NO_RESPONSE)
- `payment_plan_schedules` table - Individual installment tracking

This has been simplified to:
- `outcome_override` column on invoices (Silent, Disputed, Plan, or null)
- Simple computed `daysOverdue` value
- Payment plans tracked with breach detection at plan level (no installment-by-installment tracking)

---

## Key Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Database schema with `invoices.outcomeOverride`, `payment_plans` tables |
| `client/src/components/action-centre/types.ts` | TypeScript types including `OutcomeOverride` |
| `client/src/components/action-centre/utils.ts` | `getDebtorStatus()` function with outcome mapping |
| `client/src/pages/action-centre2.tsx` | Cashboard implementation |
| `server/services/ptpBreachDetector.ts` | PTP and Payment Plan breach detection service |
