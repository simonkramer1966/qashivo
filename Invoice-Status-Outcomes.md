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

## Payment Plans

Payment plans can cover multiple invoices and have multiple installments.

### Tables

#### payment_plans
Main plan record.

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

#### payment_plan_schedules
Individual installments.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR (UUID) | Primary key |
| payment_plan_id | VARCHAR | Reference to plan |
| payment_number | INTEGER | 1, 2, 3, etc. |
| due_date | TIMESTAMP | When this payment is due |
| amount | DECIMAL | Amount due |
| status | VARCHAR | `pending`, `paid`, `overdue`, `skipped` |
| payment_date | TIMESTAMP | When actually paid (if paid) |
| payment_reference | VARCHAR | Reference from accounting system |
| payment_method | VARCHAR | `bank_transfer`, `credit_card`, etc. |

### Plan Entry Points
1. **Customer Drawer (Manual)** - User selects invoices and defines payment terms
2. **Voice Agent** - Agrees plan for total outstanding (covers all open invoices)

---

## Forecasting with Payment Plans

When forecasting expected cash:

```sql
-- Expected cash from non-plan invoices
SELECT due_date, balance FROM invoices 
WHERE invoice_status = 'OPEN' 
  AND (outcome_override IS NULL OR outcome_override != 'Plan')

UNION ALL

-- Expected cash from payment plans
SELECT due_date, amount FROM payment_plan_schedules
WHERE status = 'pending'
```

**Important:** Do not double-count invoices that are in a payment plan.

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

This has been simplified to:
- `outcome_override` column on invoices (Silent, Disputed, Plan, or null)
- Simple computed `daysOverdue` value
- Payment plans tracked in dedicated tables

---

## Key Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Database schema with `invoices.outcomeOverride`, `payment_plans` tables |
| `client/src/components/action-centre/types.ts` | TypeScript types including `OutcomeOverride` |
| `client/src/components/action-centre/utils.ts` | `getDebtorStatus()` function with outcome mapping |
| `client/src/pages/action-centre2.tsx` | Cashboard implementation |
