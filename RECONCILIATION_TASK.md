# Xero Data Reconciliation Task

## Context

We've compared the Xero Aged Receivables report (as at 31 March 2026) for **Datum Creative Media Limited** against the Qashivo Debtors page. The numbers are significantly wrong.

## The Problem

| Metric | Xero (truth) | Qashivo UI | Status |
|--------|-------------|------------|--------|
| Total Outstanding | £124,225.69 | £1,511.52 | ❌ CRITICAL — ~1.2% of real value |
| Total Debtors | 93 | 95 | ⚠️ 2 extra in Qashivo |
| Total Invoices | 200 | 212 | ⚠️ Close but off |

## Root Cause Evidence

### 1. Amounts appear to be divided by 100

**Cre8tive Input Limited** is the clearest proof:
- Xero: £8,818.10 outstanding (17 invoices)
- Qashivo: £88.18 outstanding (17 invoices) — **exactly Xero ÷ 100**
- Xero overdue (3 months bucket): £2,485.40
- Qashivo overdue: £24.85 — **exactly Xero ÷ 100**

This pattern suggests amounts are being divided by 100 somewhere in the pipeline — likely a pence-to-pounds conversion error, or pulling the wrong field from the Xero API response.

### 2. Known previous bug context

From the build log: _"root cause was amountDue field in insert object that doesn't exist in Drizzle schema, silently swallowed by catch block. Then cached_xero_invoices insert was also silently failing with a similar schema mismatch."_

This was supposedly fixed, but the fix may have introduced a unit conversion error or mapped the wrong field.

### 3. Contact merging issues

- **RBC Capital Markets**: 2 separate Xero contacts (RBC Capital Markets: 8 invoices, RBC BlueBay Asset Management: 1 invoice) appear as 1 Qashivo debtor with 9 invoices
- **Mentzendorff & Co Ltd**: 16 Xero entries (including 3 old credits from 2023/2024) → 14 in Qashivo
- **Brambletye School**: Appears in Qashivo (£76.78, 1 invoice) but is **NOT in the Xero Aged Receivables report** — phantom debtor

### 4. Invoices page broken

The Invoices page shows summary cards (212 invoices, £157,181.85 outstanding) but the table says "No invoices found" — this is the known Zod validation error where `dueDate` is not in the `sortBy` enum.

## What to Investigate

### Step 1: Find the amount mapping

Search the codebase for where Xero invoice amounts are stored. Key files likely include:
- Xero sync service/route handlers
- `cached_xero_invoices` table schema and insert logic
- The debtors aggregation query

Look for:
- Any division by 100 or multiplication by 0.01
- Fields like `amountDue`, `amountPaid`, `total`, `subtotal`, `amountCredited` from the Xero API
- The Xero API returns amounts in **pounds** (not pence) — so no conversion should be needed

### Step 2: Compare against the reference data

The file `xero_aged_receivables.json` (copy it to the repo root) contains the ground truth from Xero. Use it to:

1. Query the database for all debtors and their outstanding amounts
2. Compare debtor-by-debtor against the JSON
3. Query individual invoices by invoice number and check amounts

Example SQL to run against the Neon DB:
```sql
-- Get debtor totals from Qashivo
SELECT d.name, d.total_outstanding, d.total_overdue, d.invoice_count
FROM debtors d
ORDER BY d.total_outstanding DESC
LIMIT 20;

-- Check specific invoice amounts
SELECT invoice_number, amount_due, amount_paid, total, status
FROM cached_xero_invoices
WHERE invoice_number IN ('5208285', '5208277', '5208279')
ORDER BY invoice_number;

-- Check Cre8tive Input invoices specifically
SELECT cxi.invoice_number, cxi.amount_due, cxi.total, cxi.status
FROM cached_xero_invoices cxi
JOIN contacts c ON cxi.contact_id = c.xero_contact_id
WHERE c.name LIKE '%Cre8tive%';
```

### Step 3: Fix the Invoices page Zod error

The sortBy enum validation rejects `dueDate`. Find the Zod schema for the invoices list endpoint and add `dueDate` to the allowed sortBy values.

### Step 4: Verify the fix

After fixing the amount mapping:
- Trigger a Xero re-sync
- Compare the Debtors page totals against £124,225.69
- Spot-check Cre8tive Input (should show £8,818.10), RBC Capital Markets (£12,252.60), Mentzendorff (£10,804.48)

## Reference Data

The file `xero_aged_receivables.json` contains:
- `grandTotal`: £124,225.69
- `totalDebtors`: 93
- `totalInvoices`: 200
- `debtorSummary`: Per-debtor totals and invoice numbers
- `invoices`: Every individual invoice with debtor name, dates, invoice number, and amount

### Top 10 Debtors by Outstanding (ground truth)

| Debtor | Outstanding | Invoices |
|--------|-----------|----------|
| Royal Bank of Canada t/a RBC Capital Markets | £12,252.60 | 8 |
| Mentzendorff & Co Ltd | £10,804.48 | 16 |
| Cre8tive Input Limited | £8,818.10 | 17 |
| Swatch / Swatch UK Group | £7,653.30 | 2 |
| Uliving@Hertfordshire PLC | £5,688.60 | 1 |
| Uniphar Commercial (E4H) UK Limited | £5,329.18 | 1 |
| CRM Team Global Limited | £4,500.00 | 1 |
| Surrey & Borders NHS Trust (Commercial) | £3,600.00 | 1 |
| Cre8tive Input Limited | £8,818.10 | 17 |
| Ellis Training | £2,791.20 | 3 |
| Bright Instruments | £2,589.60 | 2 |

### Debtors with Credit Balances (negative amounts — valid)

| Debtor | Balance |
|--------|---------|
| Ramble Worldwide | -£498.00 |
| St Christopher School | -£128.40 |
| Surrey & Borders NHS Trust | -£65.00 |
| Mentzendorff & Co Ltd | Has 3 old credit entries within its total |
