# QASHIVO — REPORTS & ALERTS SPECIFICATION

**Version:** 1.0 — 12 April 2026
**Purpose:** Role-based reporting, automated PDF distribution, and configurable alerts
**Status:** Specification — not yet built

---

## 1. PHILOSOPHY

Reports and alerts serve different people at different frequencies with different depth. A credit controller doesn't need a board pack. An MD doesn't need a daily chase summary. The system must understand who is asking and give them exactly what they need — no more, no less.

**Three principles:**

1. **Reports are stories, not data dumps.** Every report answers a specific question. "Will we have enough cash?" not "Here are 47 metrics." Riley generates the narrative; the data supports it.

2. **Alerts are triggers, not noise.** An alert means something changed that requires attention or action. If nothing changed, nothing is sent. The worst alert system is one people learn to ignore.

3. **Automated by default, customisable for exceptions.** Reports run on schedule with sensible defaults. Users adjust frequency, recipients, and thresholds — they don't build reports from scratch.

---

## 2. REPORT AUDIENCES

### 2.1 Stakeholder map

| Role | What they care about | How often | Depth | Format |
|------|---------------------|-----------|-------|--------|
| **Business owner / MD** | Cash position, will I make payroll, are we getting paid, big risks | Weekly | Headlines + narrative | PDF email, Riley summary |
| **Finance director / CFO** | AR ageing, forecast accuracy, DSO trend, cash management, debtor concentration | Weekly + monthly | Detailed with drill-down | PDF email, in-app |
| **Credit controller** | Who to chase today, what happened yesterday, promises due, exceptions | Daily | Operational, actionable | In-app, email digest |
| **Bookkeeper / accountant** | Reconciliation, payment matching, period-end AR, disputed invoices | Weekly + month-end | Transactional | PDF email, CSV export |
| **Accounting partner** | Portfolio health, cross-client trends, revenue from managed service | Weekly | Portfolio summary | PDF email, partner portal |
| **Funder** | Exposure, ageing on book, concentration, collections on funded invoices | Daily + weekly | Risk-focused | PDF email, funder portal |

### 2.2 Role-to-report mapping

Each user's role (Owner, Manager, Controller, Accountant) determines their default report subscriptions. Users can adjust but cannot access reports above their permission level.

| Report | Owner | Manager | Controller | Accountant | Partner Admin | Funder Admin |
|--------|-------|---------|------------|------------|---------------|-------------|
| Daily activity digest | ○ | ○ | ● | ○ | ○ | ● |
| Weekly CFO review | ● | ● | ○ | ● | ● | ○ |
| Weekly collections summary | ● | ● | ● | ○ | ● | ● |
| Monthly board pack | ● | ● | ○ | ● | ● | ○ |
| Monthly AR reconciliation | ○ | ● | ○ | ● | ○ | ○ |
| Cash forecast report | ● | ● | ○ | ● | ● | ○ |
| Debtor risk report | ● | ● | ● | ○ | ● | ● |
| Collection effectiveness | ● | ● | ● | ○ | ● | ● |
| Late payment interest statement | ○ | ● | ○ | ● | ○ | ○ |
| Portfolio health (partner) | — | — | — | — | ● | — |
| Lending book report (funder) | — | — | — | — | — | ● |

● = subscribed by default  ○ = available but not subscribed  — = not available

---

## 3. REPORT CATALOGUE

### 3.1 Daily activity digest

**Question answered:** "What did Charlie do yesterday and what needs my attention today?"

**Generated:** Daily at 07:00 (configurable)
**Audience:** Credit controllers, funders
**Delivery:** Email + in-app notification

**Content:**
- Communications sent yesterday (count by channel: email/SMS/voice)
- Responses received (count, highlights)
- Payments received (count, total £, largest)
- Promises made (count, total £, due dates)
- Promises broken (count, total £, debtor names)
- Exceptions raised (count by category)
- Approvals pending (count, total £, oldest)
- Today's planned actions (what Charlie will do today if approved)

**Format:** Short email — 2 screen lengths maximum. No PDF attachment for daily. Links to in-app pages for drill-down.

### 3.2 Weekly CFO review

**Question answered:** "What's my cash position, what's coming in, and what should I worry about?"

**Generated:** User's chosen day/time (from Riley onboarding)
**Audience:** Owners, CFOs, accountants, partners
**Delivery:** PDF email + in-app (Qashflow > Weekly Review)

**Content:**
- **Executive summary** (3-4 paragraphs, Riley-generated narrative)
- **Cash position** — opening balance, expected inflows, expected outflows, closing forecast
- **13-week outlook** — which weeks are tight, when is the next pressure point
- **AR movement** — new invoices raised, payments received, net change in outstanding
- **DSO trend** — current DSO, 30-day trend, 90-day trend, vs target
- **Collections progress** — what Charlie achieved this week (emails sent, responses, payments collected)
- **Debtor focus** — top 5 debtors by risk (who to worry about and why)
- **Promises due** — payments promised for next week
- **Cash gap warning** — if pessimistic scenario breaches safety threshold, when and by how much
- **Recommended actions** — Riley's top 3 suggestions for the coming week
- **Forecast accuracy** — last week's forecast vs actual, rolling 4-week accuracy

**Format:** Branded PDF, 2-3 pages. Professional enough to share with a bank or board.

### 3.3 Weekly collections summary

**Question answered:** "How is the credit control operation performing?"

**Generated:** Monday 08:00 (configurable)
**Audience:** Owners, managers, credit controllers, partners, funders
**Delivery:** PDF email

**Content:**
- **Headline metrics** — total outstanding, total overdue, overdue %, DSO, collection rate
- **Week-on-week change** — each metric vs last week with directional arrows
- **Communications summary** — sent, delivered, opened, responded (by channel)
- **Payment breakdown** — how much collected, from whom, average days to pay
- **Ageing analysis** — current, 1-30d, 31-60d, 61-90d, 90+d with £ amounts and counts
- **Top movers** — debtors who improved (paid) and deteriorated (went more overdue)
- **Promise tracker** — promises kept/broken/pending this week
- **Exception summary** — disputes, unresponsive debtors, compliance blocks

**Format:** PDF, 1-2 pages. Dense but scannable — designed to be reviewed in 2 minutes.

### 3.4 Monthly board pack

**Question answered:** "What's the full picture of our receivables and cash position for the board?"

**Generated:** 3rd business day of each month (configurable)
**Audience:** Owners, CFOs, accountants, partners
**Delivery:** PDF email

**Content:**
- **Executive summary** — Riley-generated 1-page narrative of the month
- **Cash position** — month-end balance, inflows, outflows, net movement
- **AR summary** — total outstanding, total overdue, overdue %, DSO at month-end
- **Ageing waterfall** — how the ageing profile changed month-on-month
- **DSO trend** — 12-month DSO chart with moving average
- **Collection effectiveness** — £ collected, collection rate, emails-to-payment ratio
- **Bad debt provisions** — invoices > 90 days, > 120 days, recommended provisions
- **Top 10 debtors** — outstanding, overdue, DSO, risk score, trend
- **Debtor concentration** — % of AR in top 3/5/10 debtors
- **Forecast accuracy** — 4-week rolling accuracy, per-debtor accuracy league table
- **Late payment interest** — total LPI accrued, collected, outstanding
- **Financing summary** (if Qapital active) — drawdowns, repayments, interest paid, facility utilisation
- **Key risks and recommendations** — Riley's risk assessment and suggested actions

**Format:** PDF, 4-6 pages. Board-quality. Includes charts and tables.

### 3.5 Monthly AR reconciliation

**Question answered:** "Does our AR balance agree and are payments correctly allocated?"

**Generated:** 5th business day of each month
**Audience:** CFOs, bookkeepers, accountants
**Delivery:** PDF + CSV email

**Content:**
- **Opening AR balance** (start of month)
- **New invoices raised** (total, count)
- **Credit notes issued** (total, count)
- **Payments received** (total, count)
- **Closing AR balance** (end of month)
- **Reconciliation check** — opening + invoices - credits - payments = closing (flags if not)
- **Unallocated payments** — payments received but not matched to invoices
- **Disputed invoices** — open disputes with amounts and ages
- **Credit notes pending** — approved but not yet issued in Xero
- **Aged trial balance** — full debtor-by-debtor breakdown (CSV attachment)

**Format:** PDF summary (1 page) + CSV aged trial balance attachment.

### 3.6 Cash forecast report

**Question answered:** "What does the 13-week forecast look like right now?"

**Generated:** On demand + optionally weekly
**Audience:** Owners, CFOs, accountants, partners
**Delivery:** PDF email + in-app

**Content:**
- **Opening balance** and source
- **13-week summary table** — weekly inflows, outflows, net, running balance (three scenarios)
- **Collections bar chart** — expected cash receipts by week
- **Running balance chart** — with confidence band and safety threshold
- **Layer breakdown** — AR collections, recurring revenue, pipeline
- **Key assumptions** — outflows entered, pipeline items, recurring patterns
- **Risk factors** — concentration risk, slow payers impacting forecast, seasonal adjustments
- **Cash gap warnings** — which weeks, how much, financing options

**Format:** PDF, 2-3 pages. Charts render server-side for PDF.

### 3.7 Debtor risk report

**Question answered:** "Which debtors should I be worried about?"

**Generated:** Weekly or on demand
**Audience:** Owners, managers, controllers, partners, funders
**Delivery:** PDF email

**Content:**
- **Risk-ranked debtor list** — sorted by risk score (highest risk first)
- Each debtor shows: outstanding, overdue, DSO, risk score, payment trend, promise reliability, days since last contact, days since last payment
- **Deteriorating debtors** — debtors whose risk score worsened in the last 30 days
- **Unresponsive debtors** — no response to last 3+ contacts
- **Broken promises** — debtors who broke promises in the last 30 days
- **Recommended actions** — per debtor, what Riley suggests

**Format:** PDF, 1-3 pages depending on debtor count.

### 3.8 Collection effectiveness report

**Question answered:** "How well is the AI agent performing?"

**Generated:** Monthly or on demand
**Audience:** Owners, managers, controllers, partners, funders
**Delivery:** PDF email

**Content:**
- **Headline** — £ collected this period, emails-to-payment conversion rate
- **Channel effectiveness** — response rates and payment rates by email/SMS/voice
- **Tone effectiveness** — which tone levels are driving payments
- **Timing analysis** — best day of week, best time of day for responses
- **Chase sequence** — how many touches to payment (average, by debtor segment)
- **Promise tracking** — promises made, kept rate, average days late on kept promises
- **Before/after** — DSO before Qashivo vs current, £ collected trend
- **ROI calculation** — Qashivo subscription cost vs additional £ collected and DSO improvement

**Format:** PDF, 2-3 pages.

### 3.9 Late payment interest statement

**Question answered:** "How much statutory interest are we owed?"

**Generated:** Monthly or on demand
**Audience:** CFOs, bookkeepers, accountants
**Delivery:** PDF email

**Content:**
- **Total LPI accrued** this period
- **Total LPI outstanding** (all time)
- **Per-debtor breakdown** — debtor name, invoice, days late, LPI amount, base rate used
- **LPI collected** — if any debtors paid interest
- **Per-debtor statement** (optional) — printable statement to send to a debtor showing their LPI liability

**Format:** PDF, 1-2 pages + optional per-debtor statement PDFs.

### 3.10 Portfolio health report (partner only)

**Question answered:** "How are all my clients doing?"

**Generated:** Weekly
**Audience:** Partner admins
**Delivery:** PDF email

**Content:**
- **Portfolio summary** — total clients, total AR under management, portfolio DSO, total overdue
- **Client-by-client table** — client name, outstanding, overdue, DSO, collection rate, Charlie status, cash gap, trend
- **Best/worst performers** — clients improving and deteriorating
- **Controller productivity** — actions per controller, clients per controller
- **Revenue summary** — what the firm is earning from managed credit control
- **Cross-client patterns** — debtors appearing across multiple clients, industry trends

**Format:** PDF, 2-3 pages.

### 3.11 Lending book report (funder only)

**Question answered:** "What's the state of my lending book?"

**Generated:** Daily summary + weekly detail
**Audience:** Funder admins
**Delivery:** PDF email

**Content:**
- **Book summary** — total deployed, active positions, avg duration, interest accruing
- **Ageing on book** — positions by days active (0-15, 16-30, 31-45, 46-60, 60+)
- **Concentration** — top debtors by exposure, any limit breaches
- **Collections** — £ collected on funded invoices this period, Charlie's effectiveness
- **Overdue positions** — positions past expected collection date
- **Risk movements** — P(Pay) changes, risk score changes
- **Pipeline** — pending applications, pre-approved clients
- **Settlements** — positions settled this period, interest charged, retention released
- **Provision recommendation** — risk-banded provision calculation

**Format:** PDF, 3-4 pages.

---

## 4. REPORT DISTRIBUTION

### 4.1 Schema

```
reportSubscriptions
├── id: uuid PK
├── tenantId: uuid FK tenants (null for partner-level reports)
├── partnerId: uuid FK partnerAccounts (null for tenant-level reports)
├── userId: uuid FK users
├── reportType: varchar NOT NULL
│     -- 'daily_digest' | 'weekly_cfo' | 'weekly_collections' |
│     -- 'monthly_board' | 'monthly_reconciliation' | 'cash_forecast' |
│     -- 'debtor_risk' | 'collection_effectiveness' | 'lpi_statement' |
│     -- 'portfolio_health' | 'lending_book'
├── frequency: varchar NOT NULL
│     -- 'daily' | 'weekly' | 'monthly' | 'on_demand'
├── dayOfWeek: integer (0-6, for weekly reports)
├── dayOfMonth: integer (1-28, for monthly reports)
├── timeOfDay: varchar DEFAULT '08:00'
├── timezone: varchar DEFAULT 'Europe/London'
├── deliveryMethod: varchar DEFAULT 'email'
│     -- 'email' | 'in_app' | 'both'
├── isActive: boolean DEFAULT true
├── lastGeneratedAt: timestamp
├── lastSentAt: timestamp
├── createdAt, updatedAt
```

```
reportRecipients
├── id: uuid PK
├── subscriptionId: uuid FK reportSubscriptions
├── recipientType: varchar NOT NULL
│     -- 'user' | 'external'
├── userId: uuid FK users (if recipientType = 'user')
├── externalName: text (if recipientType = 'external')
├── externalEmail: text (if recipientType = 'external')
├── createdAt
```

```
generatedReports
├── id: uuid PK
├── subscriptionId: uuid FK reportSubscriptions
├── tenantId: uuid FK tenants (nullable)
├── partnerId: uuid FK partnerAccounts (nullable)
├── reportType: varchar NOT NULL
├── generatedAt: timestamp NOT NULL
├── periodStart: date
├── periodEnd: date
├── pdfUrl: text (S3 or Railway storage URL)
├── csvUrl: text (nullable, for reconciliation reports)
├── metadata: jsonb (headline metrics for quick display in-app)
├── generatedBy: varchar DEFAULT 'scheduled'
│     -- 'scheduled' | 'manual' | 'riley'
├── createdAt
```

### 4.2 External recipients

Reports can be sent to people who don't have Qashivo accounts. This is critical for:
- Board members who need the monthly pack
- External accountants who need the reconciliation
- Bank managers who need the forecast
- Business advisors

External recipients are added per-report: name + email. They receive the PDF by email only (no in-app access).

### 4.3 Report generation pipeline

```
Cron scheduler (runs every 15 minutes)
  → Check reportSubscriptions where nextDueAt <= now
  → For each due subscription:
    1. Assemble data context (tenant or partner scope)
    2. Call Claude API with report-specific prompt + data
    3. Claude generates narrative sections
    4. Render PDF with data + narrative + charts
    5. Store PDF in generatedReports
    6. Send email with PDF attachment to all recipients
    7. Create in-app notification if deliveryMethod includes 'in_app'
    8. Update lastGeneratedAt and calculate nextDueAt
```

### 4.4 PDF generation

Use the existing PDF skill (server-side). Each report has a branded template:
- Qashivo logo top-left
- Report title and date range
- Tenant/partner name
- Generated timestamp
- Charts rendered server-side (Recharts to SVG to PDF)
- Footer: "Generated by Qashivo · qashivo.com"

---

## 5. ALERTS SYSTEM

### 5.1 Philosophy

Alerts are not reports. A report is scheduled information delivery. An alert is a trigger: something happened (or is about to happen) that requires attention or action NOW.

The threshold for sending an alert is: "Would a competent credit controller want to know about this immediately, or can it wait for the next report?"

### 5.2 Alert catalogue

#### Financial alerts

| Alert | Trigger | Default threshold | Channels | Default recipients |
|-------|---------|-------------------|----------|-------------------|
| **Cash gap detected** | Pessimistic scenario crosses safety threshold | Any breach | Email + SMS | Owner, CFO |
| **Large payment received** | Single payment above threshold | > £5,000 | Email | Owner, CFO, Controller |
| **Large payment missed** | Expected payment (from promise) not received by due date | > £5,000 | Email | Owner, Controller |
| **Cash position low** | Current/projected balance below threshold | < £10,000 | Email + SMS | Owner, CFO |
| **Invoice concentration** | Single debtor exceeds % of total AR | > 25% | Email | Owner, CFO |

#### Collections alerts

| Alert | Trigger | Default threshold | Channels | Default recipients |
|-------|---------|-------------------|----------|-------------------|
| **Promise broken** | Debtor missed promised payment date | Any | Email | Controller |
| **Debtor deteriorating** | Risk score dropped significantly | > 15 points in 7 days | Email | Controller, Manager |
| **Debtor unresponsive** | No response after N consecutive contacts | 3 contacts | Email | Controller |
| **Dispute raised** | New dispute flagged by debtor or user | Any | Email | Controller, Manager |
| **Collection milestone** | DSO improved by N days | 5 days improvement | Email | Owner |
| **First payment from new debtor** | New debtor makes first payment | Any | Email | Controller |

#### Operational alerts

| Alert | Trigger | Default threshold | Channels | Default recipients |
|-------|---------|-------------------|----------|-------------------|
| **Xero sync failed** | Sync error or token expired | Any failure | Email | Owner, Manager |
| **Approvals backlog** | Pending approvals older than threshold | > 24 hours | Email | Controller, Manager |
| **Email delivery failures** | Bounce rate above threshold | > 10% in a day | Email | Manager |
| **Compliance block** | Charlie blocked from sending due to compliance | Any | Email | Controller |

#### Forecast alerts

| Alert | Trigger | Default threshold | Channels | Default recipients |
|-------|---------|-------------------|----------|-------------------|
| **Forecast variance** | Actual collections significantly different from forecast | > 20% variance | Email | Owner, CFO |
| **Pipeline item expiring** | User-entered pipeline item approaching expiry | 7 days before | Email | Owner |
| **Recurring pattern break** | Detected recurring revenue pattern missed | 1.5x expected frequency | Email | Owner, CFO |

#### Financing alerts (if Qapital active)

| Alert | Trigger | Default threshold | Channels | Default recipients |
|-------|---------|-------------------|----------|-------------------|
| **Facility utilisation high** | Drawdown exceeds % of facility | > 80% | Email | Owner, CFO |
| **Funded invoice past expected** | Financed invoice past P(Pay) expected date | Any | Email | Owner, Funder |
| **Finance application decision** | Funder approved/declined application | Any | Email + SMS | Owner |

### 5.3 Schema

```
alertConfigurations
├── id: uuid PK
├── tenantId: uuid FK tenants
├── alertType: varchar NOT NULL (from catalogue above)
├── isEnabled: boolean DEFAULT true
├── threshold: jsonb
│     -- { value: 5000, unit: 'gbp' }
│     -- { value: 25, unit: 'percent' }
│     -- { value: 3, unit: 'count' }
│     -- { value: 24, unit: 'hours' }
├── channels: varchar[] DEFAULT ['email']
│     -- ['email'] | ['sms'] | ['email', 'sms']
├── cooldownMinutes: integer DEFAULT 60
│     -- minimum gap between repeat alerts of same type
├── createdAt, updatedAt
```

```
alertRecipients
├── id: uuid PK
├── alertConfigId: uuid FK alertConfigurations
├── recipientType: varchar NOT NULL
│     -- 'user' | 'external'
├── userId: uuid FK users (if user)
├── externalName: text (if external)
├── externalEmail: text (if external)
├── externalPhone: text (if external — for SMS alerts)
├── createdAt
```

```
alertHistory
├── id: uuid PK
├── tenantId: uuid FK tenants
├── alertConfigId: uuid FK alertConfigurations
├── alertType: varchar NOT NULL
├── triggeredAt: timestamp NOT NULL
├── deliveredAt: timestamp
├── channel: varchar (email/sms)
├── recipientEmail: text
├── recipientPhone: text
├── subject: text
├── body: text
├── metadata: jsonb (trigger data — debtor, amount, etc.)
├── status: varchar DEFAULT 'sent'
│     -- 'sent' | 'delivered' | 'failed' | 'suppressed_cooldown'
├── createdAt
```

### 5.4 Alert delivery

Alerts fire in near-real-time. When a trigger condition is detected:

1. Check alertConfigurations for this tenantId + alertType
2. If not enabled, skip
3. Check cooldown — if last alert of this type was < cooldownMinutes ago, suppress
4. Render alert message (template with data)
5. Send via configured channels (email and/or SMS)
6. Log to alertHistory

**Email alerts:** Short, actionable. Subject line states what happened. Body has 2-3 sentences max + a link to the relevant page in Qashivo.

**SMS alerts:** Single message, < 160 chars. Example: "Qashivo: Cash gap of £15,422 detected in Week 7. Log in to review financing options."

### 5.5 External recipients for alerts

Unlike reports (which only support external email), alerts support both email and phone for external recipients. This covers:

- Business owner's personal mobile for SMS cash gap alerts
- Board member's email for large payment notifications
- Accountant's email for sync failure alerts
- External CFO's phone for cash position warnings

---

## 6. REPORTS & ALERTS UI

### 6.1 Reports page — in-app

**Location:** Top-level nav item "Reports" (already exists in Qollections sidebar)

**AppShell title:** "Reports" / "Manage and view your reports"

**Page structure:**

```
Reports                                    [+ Generate report]

Available | Scheduled | History

┌──────────────────────────────────────────────────────────────┐
│ Weekly CFO review                                    Weekly  │
│ Cash position, forecast, risks, and recommendations         │
│ Next: Monday 14 Apr 08:00 · Recipients: Simon Kramer        │
│                                                   [Manage]  │
├──────────────────────────────────────────────────────────────┤
│ Weekly collections summary                           Weekly  │
│ AR metrics, communications, payments, ageing                 │
│ Next: Monday 14 Apr 08:00 · Recipients: Simon Kramer        │
│                                                   [Manage]  │
├──────────────────────────────────────────────────────────────┤
│ Monthly board pack                                 Monthly  │
│ Full AR and cashflow review for board/advisory               │
│ Next: 3 May 08:00 · Recipients: Simon Kramer, Mark Penn...  │
│                                                   [Manage]  │
└──────────────────────────────────────────────────────────────┘
```

**Tabs (using QFilterTabs):**
- **Available** — all reports the user can subscribe to, with toggle to enable
- **Scheduled** — active subscriptions with next run date, recipients, manage link
- **History** — past generated reports, downloadable PDFs, with date filter

**"Manage" opens a settings panel:**
- Frequency (daily/weekly/monthly)
- Day and time
- Delivery method (email/in-app/both)
- Recipients list — add/remove users and external emails
- Preview button — generates the report now without sending

**"+ Generate report" button:**
- Dropdown of available report types
- Click to generate immediately
- Option to send to recipients or just download

### 6.2 Report history table

Standard table treatment (matching Debtors list):

| Report | Period | Generated | Pages | Recipients | Status | |
|--------|--------|-----------|-------|------------|--------|---|
| Weekly CFO review | 7-13 Apr | 14 Apr 08:00 | 3 | 2 sent | Delivered | [Download] |

### 6.3 Alerts page

**Location:** Sub-tab within Reports, or separate Settings section

**AppShell title:** "Alerts" / "Configure notifications and thresholds"

**Page structure:**

```
Reports                                              
                                              
Available | Scheduled | History | Alerts

┌──────────────────────────────────────────────────────────────┐
│ Financial alerts                                             │
├──────────────────────────────────────────────────────────────┤
│ Cash gap detected              [On]  Email + SMS             │
│ Triggers when forecast shows cash gap                        │
│ Recipients: Simon Kramer (+44...), Mark Pennington            │
│ Threshold: Any breach                          [Configure]   │
├──────────────────────────────────────────────────────────────┤
│ Large payment received         [On]  Email                   │
│ Triggers when a single payment exceeds threshold             │
│ Recipients: Simon Kramer                                     │
│ Threshold: > £5,000                            [Configure]   │
├──────────────────────────────────────────────────────────────┤
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Collections alerts                                           │
├──────────────────────────────────────────────────────────────┤
│ Promise broken                 [On]  Email                   │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

**Grouped by category:** Financial, Collections, Operational, Forecast, Financing

**Each alert shows:**
- Name and description
- On/off toggle
- Active channels (Email, SMS, or both) — clickable to change
- Current recipients with names and contact info
- Current threshold — clickable to adjust
- [Configure] button opens settings panel

**Configure panel:**
- Enable/disable toggle
- Threshold input (amount, percentage, count, or hours depending on alert type)
- Channels checkboxes (Email, SMS)
- Recipients list:
  - Add from existing users (dropdown)
  - Add external: name, email, phone (phone required for SMS alerts)
  - Remove with × button
- Cooldown period (minimum minutes between repeat alerts)
- Test button — sends a test alert to verify delivery

### 6.4 Alert history

Table within the Alerts section showing fired alerts:

| Alert | Triggered | Channel | Recipient | Status |
|-------|-----------|---------|-----------|--------|
| Cash gap detected | 12 Apr 14:30 | SMS | Simon (+44...) | Delivered |
| Promise broken | 11 Apr 09:15 | Email | Simon Kramer | Delivered |
| Xero sync failed | 10 Apr 22:00 | Email | Simon Kramer | Delivered |

Standard table treatment. QBadge for status (Delivered=ready, Failed=risk, Suppressed=neutral).

---

## 7. BUILD PHASES

### Phase R1: Schema + report settings UI
- Create reportSubscriptions, reportRecipients, generatedReports tables
- Reports page with Available/Scheduled/History tabs
- Subscription management (enable/disable, frequency, recipients)
- No PDF generation yet — just the configuration UI

### Phase R2: PDF generation engine
- Server-side PDF rendering (charts as SVG, tables, narrative)
- Branded template with Qashivo header/footer
- Claude API integration for narrative sections
- Storage (S3 or Railway persistent storage)
- Manual "Generate now" button works

### Phase R3: Automated scheduling
- Cron job checking subscriptions
- Email delivery with PDF attachment (SendGrid)
- In-app notification when report is ready
- Delivery tracking and retry logic

### Phase R4: Alert schema + settings UI
- Create alertConfigurations, alertRecipients, alertHistory tables
- Alerts tab within Reports page
- Configure panel for each alert type
- External recipient management (name, email, phone)

### Phase R5: Alert triggers
- Wire each alert type to its trigger point in the codebase
- Email alert templates
- SMS alert delivery (Vonage)
- Cooldown enforcement
- Alert history logging

### Phase R6: Partner and funder reports
- Portfolio health report (partner)
- Lending book report (funder)
- Partner-level alert configurations
- Cross-client aggregation for partner reports

---

*Specification version: 1.0 — 12 April 2026*
*Author: Simon Kramer / Claude*
*Status: Specification — awaiting approval*
