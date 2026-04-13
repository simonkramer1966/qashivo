# QASHIVO — 13-WEEK CASHFLOW FORECAST SPECIFICATION

**Version:** 2.0 — 10 April 2026
**Purpose:** Rolling 13-week cashflow forecast with Bayesian per-debtor inflow modelling, recurring revenue detection, user pipeline, outflow planning, dual-chart visualisation, expanding input grid, manual roll-forward, and accuracy tracking
**Status:** Specification — phased implementation
**Supersedes:** CASHFLOW_INFLOW_FORECAST_SPEC.md v1.0
**Future expansion:** Full Open Banking integration, Xero AP sync for outflows, CIE segment priors, Qapital invoice financing triggers

---

## 1. VISION

The 13-week cashflow forecast is Qashivo's second pillar (Qashflow). It answers the most critical question for any SME: "Will I have enough cash over the next 13 weeks, and if not, when and why?"

The forecast is built bottom-up from individual invoices and debtor payment behaviour, combined with user inputs for outflows and pipeline revenue. Every number traces back to a specific source. Nothing is averaged across the portfolio. The model improves automatically with every payment observed.

**Two views answer two questions:**
1. **Weekly collections bar chart:** "How much cash will I collect this week?" — the operational view
2. **Running balance line chart:** "What will my bank balance look like?" — the strategic view

When the balance line approaches the safety threshold, Qapital triggers: "You have a £15k cash gap in Week 7. Finance 3 invoices to bridge it."

**Bank buyer value:** A self-improving cashflow prediction engine with auditable accuracy tracking. Every week of forecast-vs-actual data proves the model works. This is a proprietary data asset that compounds over time.

---

## 2. FORECAST LAYERS

### 2.1 Layer 1 — Existing AR Collections (Bayesian, per-debtor)

**What it covers:** Invoices already raised in Xero — when will they be paid?

**Data source:** Per-debtor payment history from Xero (up to 24 months). For every PAID invoice: `daysToPayment = paidDate - invoiceDate`. This single number, repeated across all historical invoices per debtor, is the forecast foundation.

**Methodology:**
- For each debtor with payment history, fit a log-normal distribution: `mu = mean(ln(payments))`, `sigma = stddev(ln(payments))`
- For each outstanding invoice (AUTHORISED, amountDue > 0), calculate the probability of payment landing in each of the next 13 weeks: `P(pay in week W) = CDF(endOfWeekDays) - CDF(startOfWeekDays)`
- Three scenarios read different points on the same distribution:
  - Optimistic: `mu - 0.675 * sigma` (25th percentile — debtors pay fast)
  - Expected: `mu` (median — typical speed)
  - Pessimistic: `mu + 0.675 * sigma` (75th percentile — debtors pay slow)

**Confidence levels based on data quality:**
- 0 payments: LOW (using system defaults: mu=3.69/40 days, sigma=0.50)
- 1-2 payments: LOW (fitted but wide distribution)
- 3-9 payments: MEDIUM (reasonable pattern visible)
- 10+ payments: HIGH (well-fitted, tight distribution)

**Promise override:** If a debtor has an active promise to pay, the distribution is overridden:
- High reliability debtor (PRS > 70%): promise week gets 70%, week after 20%, remainder 10%
- Medium reliability (PRS 50-70%): promise week 55%, week after 22%, remainder 23%
- Low reliability (PRS < 50%): promise week 40%, week after 25%, remainder 35%

**Unallocated payment adjustment:** If a debtor has unallocated payments confirmed by the user, their outstanding is reduced proportionally before forecasting. Cash already received is not future inflow.

**Constraints:**
- Total forecast across 13 weeks per invoice ≤ amountDue
- Remainder after Week 13 = P(paid after 13 weeks or never) — reported as "unforecast"
- Invoices > 120 days overdue get a non-payment discount
- Only AUTHORISED invoices — DRAFT and SUBMITTED excluded

### 2.2 Layer 2 — Recurring Revenue Projection (auto-detected patterns)

**What it covers:** Invoices not yet raised but expected based on historical invoicing patterns.

**Critical boundary rule:** If an invoice exists in Xero (status AUTHORISED or SUBMITTED), it belongs to Layer 1. Layer 2 only forecasts invoices that have not yet been raised. When Layer 2 projects a recurring invoice for a given week, it checks whether that invoice already exists in Xero. If it does, Layer 2 skips it. Deduplication runs on (contactId, approximate amount ±20%, date within the expected frequency window). No double-counting ever.

**Pattern detection algorithm:**
For each debtor with 3+ invoices:
1. Sort invoices by date, calculate gaps between consecutive invoices
2. Detect frequency: weekly (5-9 day gap), fortnightly (12-16), monthly (26-35), quarterly (80-100)
3. Check amount consistency: CV < 0.15 = high confidence, 0.15-0.40 = medium, > 0.40 = not recurring
4. Check recency: last invoice within 1.5x frequency = active, beyond 2x = lapsed
5. Calculate nextExpectedDate from lastInvoiceDate + frequency

**Human validation (mandatory):** Auto-detected patterns must be confirmed by the user before being projected forward. Riley presents detected patterns and asks the user to confirm or reject each one. Only confirmed patterns enter the forecast. Riley re-asks when a confirmed pattern breaks, a new pattern is detected, or on quarterly review.

**Projection logic:** For each confirmed recurring debtor, project invoices of averageAmount at frequency intervals across weeks 1-13. Apply the SAME debtor's payment timing distribution to the projected invoices — when the invoice is raised, this debtor will pay it in their typical timeframe.

### 2.3 Layer 3 — User Pipeline (manual input, confidence-weighted)

**What it covers:** Known future revenue the system can't detect — new contracts, projects, ad hoc work.

**Three confidence levels:**

| Level | Label | Meaning | Scenario treatment |
|-------|-------|---------|-------------------|
| 1 | **Committed** | Client has agreed. Specific amount, specific timing, specific client. Verbal or written commitment received. | All three scenarios |
| 2 | **Uncommitted** | Confident based on relationship or history, but client hasn't explicitly committed. Business development judgement. | Optimistic + expected only |
| 3 | **Stretch** | Revenue is plausible but source is uncertain. General expectation not tied to a specific client. Stretch target. | Optimistic only |

**Pipeline item fields:**
- Description (required)
- Client (optional — search existing debtors or enter new name)
- Amount (required)
- Timing: one-off in week / spread across weeks / recurring monthly / recurring weekly
- Confidence: committed / uncommitted / stretch
- Payment timing: use client's history (if known) / system average / custom days

**Auto-conversion:** After each Xero sync, check pipeline items against new invoices. If a matching invoice appears (same client, amount within 20%, date within 2 weeks), mark the pipeline item as "converted" and link to the real invoice. The user sees their pipeline turning into reality.

### 2.4 Layer 4 — Time-Series Envelope (post-launch, background validation)

**What it covers:** Historical weekly collection run-rate projected forward as a sanity check.

**Purpose:** Flags when Layers 1-3 produce results significantly above or below the historical reality. Not shown directly in the UI — used as a background validation that feeds into Riley's commentary.

**Implementation:** Take 13-26 weeks of actual weekly inflows, calculate mean and standard deviation, flag forecast weeks that fall outside 1.5 standard deviations. Riley says: "Your forecast for Week 5 is 15% above your historical average — this is driven by the committed pipeline item from Acme Corp."

**Timing:** Build after 4+ weeks of forecast-vs-actual data exists.

---

## 3. OUTFLOW CATEGORIES

All outflows are user-input via the expanding grid (Section 6). Future enhancement: Xero AP sync auto-detects supplier payment patterns.

| Category | Sub-lines (expand to show) | Typical frequency |
|----------|---------------------------|-------------------|
| **Payroll** | Net pay, PAYE/NI to HMRC, Pension contributions | Monthly |
| **Overheads** | Rent, utilities, insurance, subscriptions | Monthly |
| **VAT** | VAT payment to HMRC | Quarterly |
| **Corporation tax** | CT payment to HMRC | Quarterly or annual |
| **Supplier payments** | Individual supplier lines | Variable |
| **Debt payments** | Loans, HP, leasing | Monthly |
| **Fixed assets / capex** | Equipment, vehicles, fit-out | One-off / planned |
| **Directors' drawings** | Dividends, drawings | Monthly or quarterly |
| **CIS deductions** | Construction industry scheme (if applicable) | Monthly |
| **Professional fees** | Accountant, solicitor | Ad hoc |
| **Other / exceptional** | Anything not above | Ad hoc |

Outflow amounts are the same across all three scenarios — they are the user's own assumptions about their expenditure. The variation between scenarios comes entirely from the inflow timing (how fast debtors pay), not from outflow assumptions.

---

## 4. OPENING BALANCE

The opening cash balance is the starting point of the entire forecast. It is the first element on the forecast page, positioned above both charts and above the input grid.

**Display:**
```
Opening cash balance                              [Edit]
£42,000  ·  Manual entry as of 7 April
            Connect Open Banking for real-time →
```

**Sources (in order of preference):**
1. Open Banking — real-time bank balance (when connected)
2. Last closed week — closing balance of the most recently completed week
3. Manual entry — user enters the figure

**Behaviour:**
- Editable at any time (manual override)
- When a week is closed via roll-forward, the opening balance automatically updates to the closing balance of the completed week (opening + net cashflow)
- The source is displayed alongside the figure so the user knows where it came from
- A prompt to connect Open Banking is shown when the source is manual

---

## 5. DUAL CHART VISUALISATION

### 5.1 Chart 1 — Weekly Collections Bar Chart

**Question answered:** "How much cash will I collect this week?"

**Design:**
- X-axis: 13 weeks (labelled "w/c 14 Apr" etc.)
- Y-axis: £ amount
- Completed weeks: solid blue bars (actual collections)
- Forecast weeks: expected bars with optimistic/pessimistic range shown as thin error bars or a subtle band
- Recurring revenue shown as a dashed green baseline within the bars
- Hover tooltip: breakdown by AR collections, recurring, pipeline

**Purpose:** Operational — identifies low collection weeks so the user can investigate why and take action (chase harder, pull a promise forward, add pipeline).

### 5.2 Chart 2 — Running Balance Line Chart

**Question answered:** "What will my bank balance look like?"

**Design:**
- X-axis: 13 weeks (same as Chart 1, vertically aligned)
- Y-axis: £ running balance
- Opening balance as dashed horizontal reference line
- Expected balance: solid blue line with points
- Confidence band: shaded area between optimistic and pessimistic lines, widening over time
- Safety threshold: dashed red horizontal line with subtle red shading below
- Completed weeks: solid points (actuals locked in)
- Hover tooltip: balance, weekly inflow, weekly outflow, net change

**Purpose:** Strategic — shows whether cash will be adequate. When the pessimistic band dips toward the safety threshold, Qapital triggers.

**Safety threshold:** User-configurable (default £20,000 or 2 weeks of average outflows). Displayed as a dashed red line. When the pessimistic scenario crosses this line, Riley generates a proactive alert with financing suggestions.

### 5.3 Chart alignment

Both charts share the same x-axis (13 weeks) and are stacked vertically on the page. The user's eye naturally connects "low collection bar in Week 7" (Chart 1) to "balance dipping in Week 7" (Chart 2).

---

## 6. EXPANDING INPUT GRID

The input grid sits below both charts. It is the primary interface for viewing and editing the forecast assumptions.

### 6.1 Structure

```
Opening cash balance: £42,000                     [Edit]

[Chart 1: Weekly collections]
[Chart 2: Running balance]

─── CASH INFLOWS ──────────────────────────────────────
▸ AR collections          auto   £6,200  £9,500  ...  £82,100
▸ Recurring revenue    detected  £2,000  £2,000  ...  £26,400
▸ Pipeline              + Add    —       —       ...  £0
                        ─────── ─────── ───────       ────────
  Total inflows                  £8,200  £11,500 ...  £108,500

─── CASH OUTFLOWS ─────────────────────────────────────
▸ Payroll                        [    ] [22,000] ...  £44,000
▸ Overheads                      [3,500] [    ] ...  £14,000
▸ VAT                            [    ] [    ]  ...  £0
▸ Corporation tax                [    ] [    ]  ...  £0
▸ Supplier payments              [    ] [    ]  ...  £0
▸ Debt payments                  [    ] [    ]  ...  £0
▸ Fixed assets / capex           [    ] [    ]  ...  £0
▸ Directors' drawings            [    ] [    ]  ...  £0
▸ CIS deductions                 [    ] [    ]  ...  £0
▸ Professional fees              [    ] [    ]  ...  £0
▸ Other / exceptional            [    ] [    ]  ...  £0
                        ─────── ─────── ───────       ────────
  Total outflows                 £3,500 £22,000 ...  £58,000

═══════════════════════════════════════════════════════
  Net cashflow                   £4,700 -£10,500...  £50,500
  Running balance               £46,700 £36,200 ...  £92,500
```

### 6.2 Expanding row behaviour

**Click a parent row** → expands to show sub-lines:

AR collections expands to show per-debtor breakdown (auto-populated, read-only):
```
▾ AR collections                 £6,200  £9,500  ...
    Mentzendorff & Co            £828    £2,400  ...
    Pay By Phone                 —       —       ...
    Other (78 debtors)           £5,372  £7,100  ...
```

Payroll expands to show components (editable):
```
▾ Payroll                        [    ] [22,000] ...
    Net pay                      [    ] [15,400] ...
    PAYE/NI to HMRC              [    ] [5,200]  ...
    Pension                      [    ] [1,400]  ...
```

**Input cells:** Empty cells show a dash placeholder. Click to enter a number. Tab between cells. Values auto-save on blur. Currency formatting applied automatically.

**Auto-populated cells** (Layer 1 and confirmed Layer 2) are displayed in blue text with no input field — read-only. They update automatically when the forecast engine recalculates.

### 6.3 Grid columns

The grid shows 13 weekly columns plus a 13-week total column. On narrow screens, the grid scrolls horizontally with the category labels pinned to the left.

Column headers show week number and date:
```
Wk 1     Wk 2     Wk 3     ...   Wk 13    13-wk
14 Apr   21 Apr   28 Apr   ...   7 Jul    Total
```

### 6.4 Net cashflow and running balance rows

Calculated automatically from inflows minus outflows:
- **Net cashflow:** per-week inflow total minus outflow total. Positive in default text colour. Negative in red.
- **Running balance:** opening balance plus cumulative net cashflow. Shows the same trajectory as Chart 2's expected line. Negative or below-threshold values shown in red.

---

## 7. ROLLING WINDOW MECHANICS

### 7.1 Manual roll-forward (explicit user action)

The weekly roll-forward is NOT automatic. It requires the user to click "Review & close week."

**When a week is eligible for closing** (the calendar week has passed), a banner appears on the forecast page and Riley sends a notification:

```
Riley: "Week 1 (w/c 7 April) is ready to close.

Forecast: £20,200
Actual collections: £20,500
Variance: +£300 (1.5%)

Opening balance: £42,000
Closing balance: £62,500

[Review & close week]  [Not yet]"
```

**Click "Review & close week"** → modal shows:
- Forecast vs actual for each layer (AR, recurring, pipeline)
- Variance breakdown: which debtors were early/late, which pipeline items converted
- Updated opening balance for next week
- New Week 13 preview (recurring revenue auto-populated)

**Click "Confirm & roll forward"** → locks the week:
1. Week 1 actuals stored permanently in forecastSnapshots
2. Opening balance updates to closing balance of completed week
3. Everything shifts left by one week
4. New Week 13 appears, auto-populated with confirmed recurring revenue
5. Pipeline items spanning into Week 13 carry forward
6. Forecast recalculates for all remaining weeks

**If the user doesn't close the week:** forecast stays as-is with Week 1 still showing forecast numbers. Riley reminds daily. No data is lost — actuals are captured from Xero regardless; the roll-forward is about the user confirming and locking the record.

### 7.2 Actuals capture

Regardless of whether the user has closed the week, the system captures actuals in the background:
- AR collections: sum of amountPaid on invoices where paidDate falls in the week (from Xero sync)
- New invoices raised: sum of amount on invoices where invoiceDate falls in the week
- These are stored and ready for the close-week review

---

## 8. ACCURACY TRACKING

### 8.1 Per-week metrics (after closing)

```
Week 1 (w/c 7 April) — CLOSED

                    Forecast    Actual     Variance
AR collections      £6,200      £6,800     +£600 (+9.7%)
Recurring revenue   £2,000      £1,800     -£200 (-10.0%)
Pipeline            £0          £0         —
Total inflow        £8,200      £8,600     +£400 (+4.9%)

Outflows            £3,500      £3,500     £0
Net cashflow        £4,700      £5,100     +£400

Variance drivers:
- Mentzendorff paid 3 days early (+£560)
- Vintage Associates recurring invoice £200 less than average
```

### 8.2 Rolling metrics

- 4-week rolling accuracy percentage
- 13-week average accuracy
- Accuracy trend (improving / stable / declining)
- Per-debtor forecast accuracy (identifies consistently early/late payers)
- Best forecast horizon (which weeks-ahead are most accurate)

### 8.3 Riley variance narrative

After each week close, Riley generates a plain-English explanation:

```
"Last week's forecast was 95.1% accurate.

Mentzendorff paid 3 days early, bringing in £560 ahead 
of schedule. I've updated their payment model — average 
has moved from 42 to 41 days.

Vintage Associates' recurring invoice was £200 less than 
expected (£1,000 vs £1,200 average). Might be worth 
checking whether their scope has changed.

Your 4-week rolling accuracy is 94.2% — the model is 
performing well."
```

---

## 9. TRANSPARENCY AND DRILL-DOWN

### 9.1 Level 1 — Headline (13-week summary cards)

```
Total expected (13 wks)  |  This week  |  Next week  |  Peak week  |  Lowest week
£108,500                 |  £8,200     |  £11,500    |  Wk 5       |  Wk 13
58.5% of outstanding     |  8 invoices |  12 invoices|  £18,200    |  £1,800
```

Plus insight cards:
```
Forecast recovery  |  Concentration risk  |  Data quality  |  Accuracy
76.7% of £185k     |  Top 3 = 58%         |  62% High      |  94.2%
outstanding        |  of forecast          |  25% Med       |  Last 4 wks
                   |                       |  13% Low       |
```

### 9.2 Level 2 — Weekly breakdown (click into a week)

Shows every invoice contributing to that week's forecast:

```
Mentzendorff    INV-5208270  £266.76   92% likely this week
  Why: 15 historical payments, avg 42 days. Invoice is 
  38 days old. Peak probability window.

Pay By Phone    INV-5208354  £17,487   35% likely this week
  Why: Only 2 historical payments. Conservative estimate. 
  Peak expected Week 5.
```

### 9.3 Level 3 — Debtor payment profile (click into a debtor)

```
Mentzendorff & Co Ltd — Payment profile

Historical payments: 15 over 12 months
Average days to pay: 42 (vs 30-day terms)
Fastest: 28 days | Slowest: 67 days
Pattern: Typically late by 12 days
Payment day preference: End of month (68%)
Trend: Improving (was 48 days 6 months ago)
Reliability score: 72%
Confidence: High (15 data points)
```

### 9.4 Level 4 — Methodology card

Always accessible "How this forecast works" explainer in plain English.

---

## 10. QAPITAL TRIGGER

When the pessimistic scenario in Chart 2 crosses below the safety threshold:

```
Riley: "Your pessimistic scenario shows a potential 
£15k cash gap in Week 7. This is driven by:
- Pay By Phone (£17,487) only 15% likely before then
- Payroll of £22,000 due that week

Options:
1. Finance 3 invoices via Qapital (£23k available)
   → Mentzendorff INV-5208270 (£10,203)
   → Swatch INV-5208299 (£6,723)  
   → Vintage INV-5208312 (£6,788)
2. Chase Pay By Phone harder (currently Friendly tone)
3. Request early payment from Mentzendorff

Want me to explore any of these?"
```

This closes the Qollections → Qashflow → Qapital loop.

---

## 11. RILEY INTEGRATION

### 11.1 Forecast context in conversation brief

```
=== CASHFLOW FORECAST ===
13-week expected inflow: £108,500 (76.7% of £185,491)
This week expected: £8,200
Concentration risk: Top 3 debtors = 58% of forecast
Rolling accuracy: 94.2% (last 4 weeks)
Safety threshold: £20,000 — not breached in any scenario
Promise impact: +£10,000 shifted to Week 3
Pipeline: £37,500 (£15,000 committed, £14,500 uncommitted, £8,000 stretch)
```

### 11.2 Per-debtor forecast in brief

```
=== PAYMENT FORECAST ===
Most likely payment window: Week 3 (w/c 28 April)
P(pay within 2 weeks): 35%
P(pay within 4 weeks): 68%
P(pay within 8 weeks): 91%
Based on: 15 historical payments, avg 42 days
Trend: Improving (was 48 days 6 months ago)
```

### 11.3 Weekly narrative

After each week close, Riley generates a summary covering accuracy, variance drivers, model updates, and the outlook for the coming week.

---

## 12. DETERMINISTIC RULES

These rules govern the forecast engine. They are the guardrails within which the probabilistic modelling operates.

1. Every outstanding invoice results in one of three outcomes: paid in full, paid partially, or never paid. The forecast accounts for all three.
2. The best predictor of when a debtor will pay is when they've paid before. Historical payment timing is the foundation.
3. When there's no history, use conservative defaults (40 days for SMEs, 50 for enterprises). These are deliberately cautious.
4. A promise overrides the statistical model, weighted by the debtor's reliability score. Unreliable debtors get less weight on their promise date.
5. Uncertainty widens with time. Near-term forecasts are more reliable than distant ones. The confidence band reflects this.
6. Very overdue invoices are less likely to be paid at all. The model applies a non-payment discount beyond 120 days.
7. Payments cluster around specific days (end of month, Fridays). The model reflects observed patterns.
8. Seasonal patterns adjust timing when enough data exists (2+ years). Without sufficient data, seasonality is ignored.
9. Unallocated payments reduce the forecast. Cash already received is not future inflow.
10. Total forecast across 13 weeks per invoice cannot exceed amountDue.
11. The three scenarios are mathematically derived from the same per-debtor distribution, not three separate guesses.
12. The forecast improves automatically with every payment observed. More data = tighter distributions = more accurate forecasts.

---

## 13. SCHEMA

### 13.1 recurringRevenuePatterns

```
id: uuid PK
tenantId: uuid FK tenants
contactId: uuid FK contacts
frequency: varchar (weekly/fortnightly/monthly/quarterly)
averageAmount: decimal(12,2)
amountVariance: decimal(5,4)
invoiceCount: integer
firstInvoiceDate: date
lastInvoiceDate: date
nextExpectedDate: date
status: varchar DEFAULT 'detected'
  -- detected | confirmed | rejected | lapsed | paused
confidence: varchar (high/medium/low)
validatedByUser: boolean DEFAULT false
validatedAt: timestamp
validatedBy: uuid FK users
rejectedReason: text
lastCheckedAt: timestamp
breakCount: integer DEFAULT 0
createdAt, updatedAt
```

### 13.2 pipelineItems

```
id: uuid PK
tenantId: uuid FK tenants
description: text NOT NULL
contactId: uuid FK contacts (nullable)
contactName: text (for new clients)
amount: decimal(12,2) NOT NULL
timingType: varchar NOT NULL
  -- one_off | spread | recurring_monthly | recurring_weekly
startWeek: date NOT NULL
endWeek: date (for spread items)
confidence: varchar NOT NULL DEFAULT 'uncommitted'
  -- committed | uncommitted | stretch
useDebtorHistory: boolean DEFAULT true
customPaymentDays: integer (nullable)
status: varchar DEFAULT 'active'
  -- active | converted | cancelled | expired
convertedInvoiceId: uuid FK invoices (nullable)
convertedAt: timestamp
createdAt, updatedAt
expiresAt: timestamp
```

### 13.3 forecastSnapshots

```
id: uuid PK
tenantId: uuid FK tenants
weekStarting: date NOT NULL
snapshotDate: date NOT NULL
layer1ArCollections: jsonb
layer2RecurringRevenue: jsonb
layer3Pipeline: jsonb
totalForecast: jsonb
invoiceBreakdown: jsonb
recurringBreakdown: jsonb
pipelineBreakdown: jsonb
actualCollections: decimal(12,2)
actualInvoicesRaised: decimal(12,2)
actualOutflows: decimal(12,2)
openingBalance: decimal(12,2)
closingBalance: decimal(12,2)
varianceAmount: decimal(12,2)
variancePercent: decimal(5,2)
varianceDrivers: jsonb
isCompleted: boolean DEFAULT false
completedAt: timestamp
completedBy: uuid FK users
createdAt, updatedAt
UNIQUE(tenantId, weekStarting, snapshotDate)
```

### 13.4 forecastOutflows

```
id: uuid PK
tenantId: uuid FK tenants
category: varchar NOT NULL
  -- payroll_net | payroll_paye | payroll_pension |
  -- overheads | vat | corporation_tax | suppliers |
  -- debt_payments | capex | directors_drawings |
  -- cis | professional_fees | other
description: text (nullable — for sub-line detail)
weekStarting: date NOT NULL
amount: decimal(12,2) NOT NULL
isRecurring: boolean DEFAULT false
recurringFrequency: varchar (nullable)
  -- weekly | monthly | quarterly
parentCategory: varchar (nullable)
  -- e.g. 'payroll' for net/paye/pension sub-lines
createdAt, updatedAt
```

### 13.5 Tenant settings (extend tenants table)

```
forecastOpeningBalance: decimal(12,2)
forecastOpeningBalanceDate: date
forecastOpeningBalanceSource: varchar DEFAULT 'manual'
  -- manual | open_banking | last_closed_week
forecastSafetyThreshold: decimal(12,2) DEFAULT 20000
```

---

## 14. BUILD PHASES

### Phase 1: Core Forecast Engine + AR Layer + Charts
- Extend paymentDistribution.ts with weeklyPaymentProbabilities()
- cashflowForecastService.ts (Layer 1 aggregation, promise override, cold start)
- cashflowRoutes.ts (API endpoints)
- Forecast page with both charts (Recharts), summary cards, weekly breakdown table
- Opening balance field
- Conversation brief integration (payment forecast section)
- Safety threshold line on Chart 2

### Phase 2: Recurring Revenue Detection (Layer 2)
- recurringRevenuePatterns table
- recurringRevenueService.ts (pattern detection algorithm)
- Riley validation flow
- Integration into forecast aggregation
- Deduplication against existing AR (Layer 1/2 boundary)
- Recurring breakdown in expanding grid (auto-populated, read-only)

### Phase 3: Outflow Grid + Net Cashflow
- forecastOutflows table
- Outflow CRUD API
- Expanding input grid UI (all outflow categories with sub-lines)
- Net cashflow calculation row
- Running balance row
- Chart 2 updated to include outflows

### Phase 4: User Pipeline (Layer 3)
- pipelineItems table
- Pipeline CRUD API
- Add/edit/delete pipeline UI in expanding grid
- Three confidence levels (committed/uncommitted/stretch)
- Scenario treatment by confidence
- Auto-conversion detection after Xero sync

### Phase 5: Rolling Window + Accuracy Tracking
- forecastSnapshots table
- Manual roll-forward flow (review & close week)
- Actuals capture from Xero
- Variance calculation and drivers
- Accuracy history section
- Riley weekly narrative
- Daily reminder for unclosed weeks

### Phase 6: Time-Series Envelope (Layer 4)
- Historical run-rate calculation
- Divergence flagging
- Riley commentary integration

---

*Specification version: 2.0 — 10 April 2026*
*Author: Simon Kramer / Claude*
*Status: Specification complete. Implementation follows Phase 1-6 order.*
*Dependencies: paymentDistribution.ts (exists), Xero sync (exists), promise tracking (exists), conversation state machine (exists)*
