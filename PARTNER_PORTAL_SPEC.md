# QASHIVO — PARTNER PORTAL SPECIFICATION

**Version:** 1.0 — 11 April 2026
**Purpose:** Multi-client partner portal for accounting firms, enabling managed credit control, portfolio oversight, and revenue generation through Qashivo
**Status:** Specification — not yet built
**Prerequisites:** RBAC (Phases 1-4 complete), Accountant role defined, invitation flow working
**Competitive reference:** Xero HQ, Intuit Accountant Suite, Chaser Partner Central, Satago Portfolio Overview

---

## 1. VISION

The Qashivo Partner Portal is not a dashboard. It is mission control for a fleet of AI credit controllers. No other product gives an accounting firm this: a single screen showing every client's receivables health, an autonomous agent running collections for each one, predictive cashflow forecasting across the portfolio, and integrated invoice financing — all operated by the accountant's team with full delegation from the client.

**Why accountants will switch to this:**
- Satago gives them automated reminders. Qashivo gives them an AI credit controller that learns, escalates, and predicts.
- Chaser gives them cross-client health scores. Qashivo gives them per-debtor payment probability forecasts across the entire portfolio.
- Xero HQ gives them a client list. Qashivo gives them a revenue-generating managed service platform.

**The commercial model:** The accountant charges their clients for managed credit control (typically £200-500/month per client). Qashivo is the infrastructure. The accountant's margin is the difference between what they charge the client and what Qashivo costs. The partner portal makes this scalable — one credit controller at the firm can manage 30+ clients through Qashivo.

**Bank buyer value:** The partner portal creates a distribution moat. Every accounting firm running Qashivo brings 10-50 SME clients. The network effects compound — more clients means more data for the Collective Intelligence Engine, which makes Charlie smarter for everyone. An acquirer inherits a B2B2B distribution channel with built-in switching costs.

---

## 2. PARTNER ACCOUNT STRUCTURE

### 2.1 Partner Account

```
partnerAccounts
├── id: uuid PK
├── firmName: text NOT NULL ("Smith & Partners Chartered Accountants")
├── firmRegistrationNumber: text (ACCA/ICAEW/AAT number)
├── primaryContactId: uuid FK users
├── logoUrl: text (nullable — for future white-labelling)
├── brandColour: varchar (nullable — for future white-labelling)
├── website: text (nullable)
├── phone: text (nullable)
├── address: jsonb (nullable)
├── partnerTier: varchar DEFAULT 'standard'
│     -- 'standard' | 'silver' | 'gold' | 'platinum'
│     -- tier based on number of active clients
├── status: varchar DEFAULT 'active'
│     -- 'active' | 'suspended' | 'cancelled'
├── onboardedAt: timestamp
├── createdAt, updatedAt
```

### 2.2 Partner Users (Staff at the Firm)

```
partnerUsers
├── id: uuid PK
├── partnerId: uuid FK partnerAccounts
├── userId: uuid FK users
├── partnerRole: varchar NOT NULL
│     -- 'admin' | 'credit_controller'
├── status: varchar DEFAULT 'active'
│     -- 'active' | 'removed'
├── invitedBy: uuid FK users (nullable)
├── createdAt, updatedAt
```

**Two roles:**

| Role | Description | Sees |
|------|-------------|------|
| **Admin** | Manages the firm's Qashivo presence. Adds/removes staff, assigns controllers to clients, views all clients, manages billing. | All clients |
| **Credit Controller** | Operates credit control for assigned clients. Day-to-day debtor management, action approval, Riley conversations. | Only assigned clients |

### 2.3 Partner-Tenant Links

```
partnerTenantLinks
├── id: uuid PK
├── partnerId: uuid FK partnerAccounts
├── tenantId: uuid FK tenants
├── linkedAt: timestamp
├── linkedBy: uuid FK users
├── status: varchar DEFAULT 'active'
│     -- 'active' | 'pending' | 'revoked'
├── accessLevel: varchar DEFAULT 'full'
│     -- 'full' | 'view_only'
├── clientDisplayName: text (nullable — override for partner's internal naming)
├── clientNumber: varchar (nullable — partner's own client reference number)
├── notes: text (nullable — internal partner notes about this client)
├── createdAt, updatedAt
```

### 2.4 Controller Assignments

```
controllerAssignments
├── id: uuid PK
├── partnerId: uuid FK partnerAccounts
├── partnerUserId: uuid FK partnerUsers
├── tenantId: uuid FK tenants
├── assignedBy: uuid FK users
├── assignedAt: timestamp
├── removedAt: timestamp (nullable)
├── isActive: boolean DEFAULT true
├── UNIQUE(partnerId, partnerUserId, tenantId) WHERE isActive = true
```

Many-to-many: one controller can have multiple clients, one client can have multiple controllers.

---

## 3. NAVIGATION — THE ORG SWITCHER

### 3.1 Xero-Style Dropdown

Top-left of the sidebar, where the company name currently shows. Click to open a dropdown:

```
┌─────────────────────────────────────────┐
│ 🔍 Search clients...                   │
│                                         │
│ CLIENTS                                 │
│                                         │
│ 🟢 Datum Creative Media     £185k  50d │
│ 🟡 Bright Instruments Ltd   £42k   38d │
│ 🔴 Surrey Construction      £98k   72d │
│ 🟢 Mortgage Advice Bureau   £12k   22d │
│ ⚪ Kestronics Ltd           £8k    15d │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ + Add client                            │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ 🏢 Smith & Partners (Partner Portal)   │
└─────────────────────────────────────────┘
```

**Elements:**
- Search bar at top — filters client list as you type
- Each client row: status dot (health), company name, total outstanding, DSO — scannable at a glance
- Status dots: 🟢 healthy (DSO < terms), 🟡 attention (DSO 1-2x terms), 🔴 critical (DSO > 2x terms), ⚪ inactive/no data
- "+ Add client" link — opens the client onboarding flow
- Bottom: "Partner Portal" — returns to the portfolio view
- Credit controllers only see their assigned clients in this list

### 3.2 Context Switching

When you click a client:
- Sidebar changes to show that client's Qashivo (Qollections, Qashflow, Qapital, Settings)
- The company name in the top-left shows the client's name
- All data, pages, and actions are scoped to that client's tenant
- The user operates with Accountant permissions (as defined in RBAC spec)
- A small "back to portal" breadcrumb or icon persists so they can return

When you click "Partner Portal":
- Sidebar changes to the partner portal navigation
- Company name shows the firm name
- Portfolio-level views load

### 3.3 Keyboard Shortcut

`Cmd+K` (or `Ctrl+K`) opens the client switcher — same as Xero. Fast switching for power users managing 20+ clients.

---

## 4. PARTNER PORTAL PAGES

### 4.1 Portfolio Dashboard (Home)

The first thing the partner sees when they log in. Everything they need to know in 10 seconds.

**Row 1 — Portfolio Headline Metrics (6 cards):**

| Card | Value | Subtitle |
|------|-------|----------|
| Active Clients | 12 | 3 onboarding |
| Total AR Under Management | £1.2M | Across 12 clients |
| Portfolio DSO | 47 days | Weighted average |
| Total Overdue | £380k | 156 invoices |
| Collection Rate (30d) | 72% | Up 8% from last month |
| Cash Gaps Detected | 2 | Clients needing attention |

**Row 2 — Portfolio Health Heatmap:**

A visual grid showing every client as a tile. Tile size = total outstanding. Tile colour = health (green/amber/red based on DSO relative to terms, overdue %, and collection trend).

Click a tile → switches to that client's Qashivo.

This is more powerful than Satago's list view — you see the entire portfolio's health in one visual.

**Row 3 — Attention Required:**

Three panels (same pattern as the home dashboard):

| Panel | Content |
|------|---------|
| **Collections** | "X actions pending across Y clients" · "Z disputes raised this week" · "W promises broken" |
| **Cashflow** | "X clients have cash gaps" · "Y weekly reviews pending" · "Total portfolio inflow forecast: £Z" |
| **Financing** | "X clients pre-authorised" · "Y active drawdowns" · "£Z facility in use" |

**Row 4 — Client List Table:**

Sortable, searchable table — the operational view.

| Client | Outstanding | Overdue | DSO | Collection Rate | Charlie Status | Cash Gap | Actions Pending | Controller |
|--------|------------|---------|-----|----------------|---------------|----------|----------------|------------|
| Datum Creative | £185k | £76k | 50d | 68% | 🟢 Active | Week 5 | 12 | Tom Brown |
| Bright Instruments | £42k | £8k | 38d | 85% | 🟢 Active | None | 3 | Tom Brown |
| Surrey Construction | £98k | £45k | 72d | 52% | 🟡 Paused | Week 3 | 8 | Jane Smith |

Click any row → switches to that client's Qashivo.

Sort by any column. Filter by: controller assignment, health status, cash gap presence, Charlie status.

**Row 5 — Portfolio Trends:**

Two mini charts:
- Left: Portfolio DSO trend (last 90 days) — shows the firm's overall impact
- Right: Total collections by week (last 13 weeks) — shows money being collected

### 4.2 Client Onboarding (Add Client)

Two flows:

**Flow A — Partner adds a new client:**

```
Partner clicks "+ Add client"
  → Enter client details:
    - Company name
    - Contact email (the business owner)
    - Client reference number (partner's internal ID)
    - Assign controller (dropdown of firm staff)
    - Internal notes
  → Send invitation email to the client:
    "Your accountant [Firm Name] has set up Qashivo 
     for your business. Connect your Xero to get started."
  → Client clicks link → Xero OAuth → onboarding runs
  → Client appears in partner portal as "Onboarding"
  → Once sync completes → status changes to "Active"
```

**Flow B — Client invites their accountant (existing flow):**

```
Client goes to Settings → Team → Invite Accountant
  → Enters accountant's email
  → If email matches partner portal user → auto-link
  → If not → invitation to create partner account
  → Client appears in the partner's portal
```

**Bulk onboarding (from Satago's playbook):**

```
Partner clicks "Bulk import"
  → Upload CSV: company name, contact email, client ref
  → System sends invitation emails to all
  → Clients appear as "Pending" in the portal
  → Track onboarding progress per client
```

### 4.3 Staff Management

Settings page within the partner portal.

```
Partner Settings → Team

┌────────────────────────────────────────────────────┐
│ Staff                                   [Invite]   │
│                                                    │
│ Sarah Partners    Admin       All clients    ⋮     │
│ Tom Brown         Controller  4 clients      ⋮     │
│ Jane Smith        Controller  3 clients      ⋮     │
│ Mike Lee          Controller  5 clients      ⋮     │
└────────────────────────────────────────────────────┘
```

Click a staff member → expand to show assigned clients with add/remove.

Admin can:
- Invite new staff (email invite)
- Change roles (admin ↔ controller)
- Assign/unassign clients to controllers
- Remove staff
- View staff activity across their assigned clients

### 4.4 Client Assignment

Drag-and-drop or checkbox-based assignment interface:

```
Assign clients to: Tom Brown (Controller)

☑ Datum Creative Media         £185k outstanding
☑ Bright Instruments Ltd       £42k outstanding
☐ Surrey Construction          (assigned to Jane Smith)
☑ Mortgage Advice Bureau       £12k outstanding
☐ Kestronics Ltd              (unassigned)
                                              [Save]
```

Or from the client list: three-dot menu → "Assign controller" → dropdown of staff.

### 4.5 Portfolio Activity Feed

A unified timeline showing significant events across all clients:

```
Portfolio Activity

Today
  16:45  Datum Creative · Charlie sent 8 emails, 3 responses
  16:30  Surrey Construction · Dispute raised by ABC Builders
  15:00  Bright Instruments · £8,200 payment received from Acme Corp
  14:30  Datum Creative · Promise to pay from Mentzendorff (£10,203, 18 Apr)
  12:00  Mortgage Advice · Weekly CFO review ready

Yesterday
  17:00  Surrey Construction · Cash gap detected: £25k in Week 4
  15:30  Bright Instruments · Charlie escalated tone for 3 debtors
  ...
```

Filterable by: client, event type, date range, controller.

This is the "what happened across my portfolio today" view that no competitor offers at this level of granularity.

### 4.6 Portfolio Riley

Riley with cross-client context. Available as the floating chat widget within the partner portal.

Riley knows:
- All clients' AR positions, DSO, collection rates
- Which clients need attention and why
- Comparative performance ("Datum's DSO improved 8 days this month, but Surrey's got worse")
- Portfolio-level trends ("Your construction clients pay 15% slower than professional services")
- Actionable recommendations ("Surrey Construction has 3 broken promises this week — Tom should prioritise them tomorrow")

**Riley can:**
- Answer questions about any client or the portfolio as a whole
- Compare client performance
- Suggest which clients need attention
- Surface patterns across clients
- Help with onboarding questions

### 4.7 Portfolio Reports

Downloadable reports for the partner's own use and for client advisory meetings:

| Report | Content | Format |
|--------|---------|--------|
| **Portfolio Summary** | All clients, key metrics, health status, trends | PDF |
| **Client Report** | Single-client deep dive for advisory meetings | PDF |
| **Collection Performance** | Charlie's effectiveness across portfolio | PDF |
| **Revenue Report** | What the firm is earning from managed credit control | CSV/PDF |
| **Controller Productivity** | Actions per controller, response times, client coverage | PDF |

Reports use the partner's firm name and can include their logo (when white-labelling is enabled).

---

## 5. PARTNER PORTAL SIDEBAR

When in the partner portal context (not viewing a specific client):

```
🏢 Smith & Partners
   Partner Portal

   Portfolio Dashboard
   Activity Feed
   Reports
   
   Settings
     Staff & Assignments
     Firm Details
     Billing
```

When viewing a specific client (after clicking in the org switcher):

```
📋 Datum Creative Media    [← Portfolio]

   Home
   Qollections >
     Dashboard
     Action Centre
     Debtors
     ...
   Qashflow >
     ...
   Qapital >
     ...
   Settings >
     ...
```

The `[← Portfolio]` link returns to the partner portal.

---

## 6. CLIENT HEALTH SCORING

Each client gets a real-time health score that drives the status dots and the heatmap.

### 6.1 Health Score Components

| Component | Weight | Scoring |
|-----------|--------|---------|
| DSO relative to terms | 25% | On terms = 100, 1.5x terms = 50, 2x+ terms = 0 |
| Overdue percentage | 25% | 0% overdue = 100, 50%+ overdue = 0 |
| Collection rate (30d) | 20% | 80%+ = 100, 50% = 50, <30% = 0 |
| Charlie effectiveness | 15% | Response rate to agent comms |
| Cash gap presence | 15% | No gap = 100, gap within 4 weeks = 0 |

### 6.2 Health Bands

| Score | Status | Dot colour | Meaning |
|-------|--------|-----------|---------|
| 80-100 | Healthy | 🟢 Green | Collections running well |
| 60-79 | Attention | 🟡 Amber | Some areas need focus |
| 40-59 | At risk | 🟠 Orange | Significant issues |
| 0-39 | Critical | 🔴 Red | Immediate intervention needed |

### 6.3 Health Trend

Track health score weekly. Show improvement/deterioration arrows on the client list:
- ↑ Improved 5+ points this week
- → Stable
- ↓ Deteriorated 5+ points this week

This proves the accountant's value — "your health score improved from 52 to 78 since we started managing your credit control."

---

## 7. COMMERCIAL FEATURES

### 7.1 Revenue Tracking

The partner portal tracks what the accountant earns from managed credit control:

```
Revenue Dashboard

This Month
  Active managed clients: 8
  Average monthly fee: £350
  Total monthly revenue: £2,800
  Qashivo cost: 8 × £299 = £2,392
  Net margin: £408 (14.6%)

  Opportunity:
  4 clients on Qollect (£149) could upgrade to Pro (£299)
  → Additional revenue potential: £600/month
```

### 7.2 Partner Tiers

Based on active clients:

| Tier | Clients | Benefits |
|------|---------|----------|
| Standard | 1-5 | Base pricing |
| Silver | 6-15 | 10% volume discount |
| Gold | 16-30 | 15% discount + priority support |
| Platinum | 31+ | 20% discount + dedicated account manager + co-branded marketing |

### 7.3 Client Billing Options

Two models available:

**Direct billing:** Client pays Qashivo directly. Accountant operates the system as part of their advisory service.

**Partner billing:** Accountant pays Qashivo for all client licences at a volume discount. Accountant bills the client at whatever rate they choose. The margin is the accountant's revenue. Partner manages all billing from the portal.

---

## 8. ONBOARDING THE PARTNER

### 8.1 Partner Sign-Up Flow

```
Accountant visits qashivo.com/partners
  → "Start free trial" or "Book a demo"
  → Creates account:
    - Firm name
    - Registration number (ACCA/ICAEW/AAT)
    - Contact details
    - How many clients (1-5, 6-15, 16-30, 31+)
  → Partner account created
  → Guided setup:
    1. "Add your first client" (or bulk import)
    2. "Invite your team" (if applicable)
    3. "Connect your client's Xero"
  → Client onboarding runs
  → Partner portal populated with first client
  → Riley introduces herself and explains the portal
```

### 8.2 Riley Onboarding for Partners

Riley's first conversation with a new partner:

```
"Welcome to Qashivo, Sarah. I'm Riley — I'll help you 
manage credit control across all your clients.

Let's get your first client set up. I'll need their 
company name and the email address of whoever manages 
their Xero account.

Once they connect Xero, I'll:
- Analyse their debtor book
- Set up Charlie (the AI credit controller)
- Start learning about their key accounts
- Generate their first cashflow forecast

You'll see everything from your Portfolio Dashboard. 
Ready to add your first client?"
```

---

## 9. NOTIFICATIONS

### 9.1 Partner-Level Notifications

The partner receives aggregated notifications, not per-client noise:

| Trigger | Notification | Channel |
|---------|-------------|---------|
| Cash gap detected (any client) | "[Client] has a £X cash gap in Week Y" | In-app + email |
| Dispute raised (any client) | "[Client]: dispute raised by [Debtor]" | In-app |
| Multiple broken promises | "3 broken promises across your portfolio this week" | Weekly email digest |
| Client onboarding complete | "[Client] is ready — Charlie is live" | In-app + email |
| Weekly portfolio summary | "Your portfolio collected £X this week across Y clients" | Email (Monday AM) |
| Health score drop | "[Client] health dropped from 72 to 58 this week" | In-app |
| Controller workload alert | "Tom has 35 pending actions across 4 clients" | In-app (admin only) |

### 9.2 Notification Preferences

Configurable per partner user in Settings:
- Email digest frequency: real-time / daily / weekly
- In-app notification types: all / critical only / none
- SMS for cash gaps: on / off (with phone number)

---

## 10. DATA ISOLATION AND SECURITY

### 10.1 Fundamental Rule

The partner portal aggregates data for display but NEVER mixes client data. Each client's tenant remains fully isolated:

- Queries are per-tenant, results aggregated at the presentation layer
- No cross-tenant database queries
- No client can see another client's data
- The partner sees aggregated metrics but drill-down is always into a single tenant

### 10.2 Access Control

- Admin sees all clients linked to the partner account
- Credit Controller sees only assigned clients
- All access is through the Accountant role (RBAC spec), with delegations set per-client by the client's Owner
- If a client revokes accountant access, the client disappears from the portal immediately
- Audit log captures all partner actions within each client tenant

### 10.3 GDPR Considerations

- Partner account stores firm details only (no client PII)
- Client data stays in client tenants
- Partner viewing client data is covered by the accountant-client relationship (legitimate interest)
- If the partner-client relationship ends, access is revoked and no client data is retained in the partner account
- Data processing agreement between Qashivo and the partner covers the multi-tenant access model

---

## 11. API STRUCTURE

### 11.1 Partner-Level Endpoints

```
GET    /api/partner/portfolio           — Portfolio dashboard data (all clients' metrics)
GET    /api/partner/clients             — Client list with health scores
POST   /api/partner/clients             — Add new client (send invitation)
POST   /api/partner/clients/bulk        — Bulk import clients via CSV
GET    /api/partner/clients/:id         — Single client summary
PATCH  /api/partner/clients/:id         — Update client display name, reference, notes
DELETE /api/partner/clients/:id         — Unlink client

GET    /api/partner/staff               — Staff list with assignments
POST   /api/partner/staff/invite        — Invite new staff member
PATCH  /api/partner/staff/:id           — Change role
DELETE /api/partner/staff/:id           — Remove staff member

GET    /api/partner/assignments          — All controller-client assignments
POST   /api/partner/assignments          — Assign controller to client
DELETE /api/partner/assignments/:id      — Remove assignment

GET    /api/partner/activity             — Cross-client activity feed
GET    /api/partner/reports/:type        — Generate report
GET    /api/partner/notifications        — Partner notifications

POST   /api/partner/context/switch       — Switch to client context (sets active tenant)
POST   /api/partner/context/portal       — Return to partner portal context
```

### 11.2 Portfolio Data Aggregation

The portfolio endpoint calls each linked tenant's summary APIs in parallel and aggregates:

```typescript
async function getPortfolioData(partnerId: string): Promise<PortfolioData> {
  const links = await getActiveLinks(partnerId);
  const summaries = await Promise.all(
    links.map(link => getTenantSummary(link.tenantId))
  );
  return {
    clients: summaries.map(s => ({
      tenantId: s.tenantId,
      name: s.tenantName,
      outstanding: s.totalOutstanding,
      overdue: s.totalOverdue,
      dso: s.dso,
      collectionRate: s.collectionRate,
      healthScore: calculateHealthScore(s),
      cashGap: s.cashGapWeek,
      pendingActions: s.pendingActionCount,
      charlieStatus: s.agentStatus,
    })),
    totals: aggregateTotals(summaries),
  };
}
```

This preserves tenant isolation — each tenant's data is queried independently, then aggregated.

---

## 12. BUILD PHASES

### Phase 1: Data Model + Context Switching (foundation)
- Create partnerAccounts, partnerUsers, partnerTenantLinks, controllerAssignments tables
- Partner registration flow (basic — firm name, contact)
- Org switcher dropdown in sidebar
- Context switching between partner portal and client tenants
- "← Portfolio" back navigation
- Client list in switcher (filtered by controller assignment)

### Phase 2: Portfolio Dashboard
- Portfolio headline metrics (6 cards)
- Client list table (sortable, filterable, searchable)
- Client health scoring algorithm
- Health status dots in org switcher
- Portfolio trend mini-charts (DSO, collections)

### Phase 3: Client Onboarding
- "Add client" flow (single client invitation)
- Bulk import via CSV
- Client onboarding tracking (pending → active)
- Invitation emails to client owners
- Auto-link when client connects Xero

### Phase 4: Staff Management + Assignments
- Staff list page
- Invite staff (email flow)
- Admin/Controller role management
- Client assignment interface
- Controller-filtered views across the portal

### Phase 5: Activity Feed + Notifications
- Cross-client activity feed
- Notification system (in-app + email digest)
- Notification preferences
- Weekly portfolio summary email

### Phase 6: Portfolio Riley
- Riley with cross-client context
- Portfolio-level questions and answers
- Client comparison
- Recommendations across portfolio
- Riley onboarding for new partners

### Phase 7: Reports + Revenue Tracking
- Portfolio Summary report (PDF)
- Client Report for advisory meetings (PDF)
- Collection Performance report
- Revenue dashboard
- Controller productivity metrics

### Phase 8: Commercial Features
- Partner tiers (volume discounts)
- Partner billing (manage client licences)
- Partner Directory listing
- Co-branded marketing resources
- White-labelling (logo, colours)

---

## 13. WHAT MAKES THIS BETTER THAN COMPETITORS

| Capability | Xero HQ | Chaser | Satago | **Qashivo** |
|---|---|---|---|---|
| Client list with health scores | ✓ Basic | ✓ Health Score | ✓ Portfolio Overview | ✓ **Multi-factor health scoring with trends** |
| Org switcher | ✓ | ✗ | ✗ | ✓ **With health dots and AR summary** |
| AI agent per client | ✗ | ✗ | ✗ | ✓ **Charlie — autonomous, learning** |
| Portfolio-level AI assistant | ✗ | ✗ | ✗ | ✓ **Riley — cross-client intelligence** |
| Cashflow forecasting | ✗ | Basic | ✗ | ✓ **Bayesian per-debtor, 13-week** |
| Invoice financing | ✗ | ✗ | ✓ Basic | ✓ **P(Pay) optimised, knapsack selection** |
| Staff assignment | ✓ | ✗ | ✗ | ✓ **With filtered views** |
| Bulk onboarding | ✗ | ✗ | ✓ CSV | ✓ **CSV + auto-link** |
| Cross-client activity feed | ✗ | ✗ | ✗ | ✓ **Real-time, filterable** |
| Revenue tracking for partner | ✗ | ✗ | ✗ | ✓ **Margin calculator** |
| Portfolio heatmap | ✗ | ✗ | ✗ | ✓ **Visual health by outstanding** |
| Debtor payment prediction | ✗ | ✗ | ✗ | ✓ **Log-normal distributions per debtor** |
| Collective intelligence | ✗ | ✗ | ✗ | ✓ **Cross-tenant anonymised learning** |
| Weekly portfolio digest | ✗ | ✗ | ✗ | ✓ **Automated email to partner** |

The combination of AI agent + predictive forecasting + integrated financing + partner revenue model does not exist anywhere else. Each individual feature has a competitor. The integrated package does not.

---

## 14. DEMO PRIORITY

For the Monday demo, the minimum viable partner portal is:

1. Org switcher with 2-3 mock clients (Phase 1)
2. Portfolio dashboard with client list and health scores (Phase 2)
3. Context switch into a client's Qashivo (Phase 1)

Everything else enhances but is not blocking. The demo story is: "Here are your clients. Here's their health. Click one. You're inside their Qashivo. Charlie is running. The forecast is live. Click back. Here's the portfolio."

---

## 15. FUNDER PORTAL — OVERVIEW

The Funder Portal is a variant of the Partner Portal designed for invoice finance companies, factoring firms, and asset-based lenders. It shares the same underlying architecture (org switcher, context switching, staff management) but replaces the accountant's advisory dashboard with a lending portfolio dashboard.

**The funder's relationship with Qashivo is different from an accountant's:**

| Dimension | Accountant Portal | Funder Portal |
|---|---|---|
| Why they care | Advisory service revenue | Protecting deployed capital |
| What they look at | Client health, DSO, collection progress | Their exposure, ageing on their book, concentration risk |
| Charlie's role | Credit controller for the client | Debt collector protecting the funder's money |
| Urgency | Moderate | High — every day costs them interest |
| Invoice focus | All client invoices | Financed invoices only (with visibility of unfinanced for sales) |
| Persona | Sarah Mitchell (client's brand) | Configurable: client brand (confidential) or funder brand (disclosed) |
| Payment destination | Client's bank account | Funder's bank account (disclosed) or client remits (confidential) |
| Revenue model | Charges client for managed service | Qashivo reduces their cost of collection and improves recovery |

**Single funder per client.** An SME's invoices are financed by one funder only. This matches the Investec exclusive model and simplifies the data model.

---

## 16. FUNDER PORTAL — DATA MODEL

### 16.1 Funder Account

Extends `partnerAccounts` with funder-specific fields:

```
partnerAccounts (extended for funders)
├── partnerType: varchar NOT NULL DEFAULT 'accountant'
│     -- 'accountant' | 'funder'
├── funderConfig: jsonb (nullable)
│     -- {
│     --   defaultInterestRate: 3.5,      // % per month
│     --   facilityFeePerInvoice: 50,     // £ per drawdown
│     --   advanceRate: 80,               // % of invoice face value
│     --   retentionRate: 20,             // % held back
│     --   maxFacilityPerClient: 500000,  // £ default facility limit
│     --   minInvoiceAmount: 500,         // £ minimum financeable invoice
│     --   maxInvoiceAge: 90,             // days — won't finance older
│     --   concentrationLimit: 30,        // % max exposure to single debtor
│     --   disclosedFactoring: true,      // default: disclosed or confidential
│     -- }
```

### 16.2 Funded Positions

```
fundedPositions
├── id: uuid PK
├── partnerId: uuid FK partnerAccounts (the funder)
├── tenantId: uuid FK tenants (the client)
├── invoiceId: uuid FK invoices
├── invoiceNumber: varchar
├── debtorId: uuid FK contacts
├── debtorName: text
├── invoiceAmount: decimal(12,2)        -- face value
├── advanceAmount: decimal(12,2)        -- 80% of face value
├── retentionAmount: decimal(12,2)      -- 20% held back
├── interestRate: decimal(5,4)          -- rate applied to this drawdown
├── facilityFee: decimal(8,2)           -- one-off fee on drawdown
├── status: varchar NOT NULL DEFAULT 'active'
│     -- 'active' | 'collecting' | 'settled' | 'defaulted' | 
│        'disputed' | 'written_off'
├── advancedAt: timestamp               -- when funds were advanced
├── expectedCollectionDate: date        -- from P(Pay) model
├── actualCollectionDate: date (nullable)
├── daysActive: integer (computed)      -- advancedAt to now or settlement
├── interestAccrued: decimal(10,2)      -- running interest calculation
├── interestCharged: decimal(10,2)      -- final interest on settlement
├── retentionReleased: boolean DEFAULT false
├── retentionReleasedAt: timestamp (nullable)
├── retentionReleasedAmount: decimal(10,2) (nullable) -- retention minus interest
├── collectionMethod: varchar DEFAULT 'disclosed'
│     -- 'disclosed' | 'confidential'
├── pPayAtAdvance: decimal(5,4)         -- P(Pay) probability when advanced
├── pPayCurrent: decimal(5,4)           -- current P(Pay) — updates as time passes
├── riskScoreAtAdvance: integer         -- credit risk score when advanced
├── riskScoreCurrent: integer           -- current risk score
├── createdAt, updatedAt
```

### 16.3 Funder Facility Per Client

```
funderFacilities
├── id: uuid PK
├── partnerId: uuid FK partnerAccounts
├── tenantId: uuid FK tenants
├── facilityLimit: decimal(12,2)        -- max the funder will advance
├── currentDrawdown: decimal(12,2)      -- sum of active advances
├── availableHeadroom: decimal(12,2)    -- limit minus drawdown
├── interestRate: decimal(5,4)          -- client-specific rate
├── advanceRate: decimal(5,2) DEFAULT 80 -- % advanced
├── status: varchar DEFAULT 'active'
│     -- 'active' | 'suspended' | 'closed'
├── approvedAt: timestamp
├── approvedBy: uuid FK users
├── lastReviewedAt: timestamp
├── nextReviewDate: date
├── notes: text (nullable)
├── createdAt, updatedAt
```

---

## 17. FUNDER PORTAL — PAGES

### 17.1 Lending Book Dashboard (Home)

The funder's primary view — their deployed capital and risk position.

**Row 1 — Book Headline Metrics (6 cards):**

| Card | Value | Subtitle |
|------|-------|----------|
| Total Deployed | £2.4M | Across 38 clients |
| Active Positions | 412 | Funded invoices |
| Avg Duration | 34 days | Weighted by value |
| Interest Accruing | £28,400 | This month to date |
| Overdue Positions | 23 | Past expected collection |
| Default Risk | £45,000 | Positions flagged high risk |

**Row 2 — Risk Heatmap:**

Visual grid showing all funded positions. Each tile = one funded invoice (or grouped by debtor). Size = advance amount. Colour = risk level based on current P(Pay) and days active:

- 🟢 Green: collecting on schedule (within expected duration)
- 🟡 Amber: slower than expected (1.5x expected duration)
- 🔴 Red: significantly overdue (2x+ expected duration)
- ⚫ Black: dispute or default flag

Click a tile → drill into that position.

**Row 3 — Three operational panels:**

| Panel | Content |
|-------|---------|
| **Collections Today** | "X invoices being chased by Charlie today" · "Y debtor responses received" · "Z payments landed overnight" · "£W collected this week" |
| **Risk Alerts** | "X positions past expected collection" · "Y debtors deteriorating (P(Pay) dropping)" · "Z concentration breaches" · "W disputes active" |
| **Pipeline** | "X new applications pending review" · "Y pre-approved clients" · "£Z available to deploy" · "Pipeline value: £W" |

**Row 4 — Exposure Analysis Charts (two side by side):**

Left: **Concentration by Debtor** — horizontal bar chart showing top 10 debtors by total exposure across all clients. Highlights any debtor exceeding the concentration limit. A single debtor owing money to multiple clients, all financed by this funder, shows as one consolidated bar.

Right: **Ageing on Book** — how long capital has been deployed. Histogram of funded positions by days active: 0-15d, 16-30d, 31-45d, 46-60d, 60+d. The funder wants this skewed left (fast collections).

**Row 5 — Client List:**

| Client | Facility | Drawn | Available | Active Positions | Avg Duration | Collection Rate | Risk |
|--------|----------|-------|-----------|-----------------|-------------|----------------|------|
| Datum Creative | £100k | £28k | £72k | 3 | 24d | 92% | 🟢 |
| Surrey Construction | £200k | £180k | £20k | 12 | 48d | 68% | 🟡 |
| Bright Instruments | £50k | £0 | £50k | 0 | — | — | — |

Click a row → switches to that client's funded position detail.

### 17.2 Funded Position Detail (Per Client)

When the funder drills into a client:

**Header:**
```
Datum Creative Media Limited
Facility: £100,000 | Drawn: £28,450 | Available: £71,550
Status: Active | Interest rate: 3.5%/month | Next review: 30 Jun 2026
```

**Tab 1 — Active Positions:**

| Invoice | Debtor | Face Value | Advanced | Days Active | Interest | P(Pay) | Status | Charlie |
|---------|--------|-----------|----------|-------------|---------|--------|--------|---------|
| INV-5208270 | Mentzendorff | £10,203 | £8,162 | 24d | £285 | 72% | Collecting | Last chase: 2d ago |
| INV-5208299 | Swatch UK | £6,723 | £5,378 | 17d | £133 | 85% | Collecting | Response received |
| INV-5208354 | Pay By Phone | £17,487 | £13,990 | 10d | £175 | 68% | Collecting | Promise: 18 Apr |

Each row expandable to show:
- Charlie's communication timeline for this invoice
- Debtor's payment history and reliability score
- P(Pay) probability curve (when is payment most likely?)
- Promise tracking (if a PTP exists)

**Tab 2 — Settled Positions:**

Historical — shows every position that has been collected, with actual vs expected duration, interest charged, and whether the debtor paid on time.

**Tab 3 — Unfinanced Invoices (Sales Opportunity):**

All the client's outstanding invoices that are NOT currently financed. The funder can see what else could be advanced:

| Invoice | Debtor | Amount | Days Overdue | P(Pay) 30d | Risk | Eligible? |
|---------|--------|--------|-------------|-----------|------|-----------|
| INV-5208312 | Vintage | £6,788 | 15d | 78% | High 72 | ✅ Yes |
| INV-5208400 | ABC Ltd | £1,200 | 5d | 91% | High 88 | ✅ Yes |
| INV-5208450 | Acme | £450 | 30d | 45% | Med 52 | ❌ Below min |

This is the funder's pipeline — "what else can I lend against?" Sorted by eligibility and risk.

**Tab 4 — Transaction History:**

Full ledger for this client's facility:

| Date | Type | Invoice | Debtor | Amount | Interest | Fee | Balance |
|------|------|---------|--------|--------|----------|-----|---------|
| 1 Apr | Advance | INV-5208354 | Pay By Phone | +£13,990 | — | £50 | £28,450 |
| 25 Mar | Advance | INV-5208299 | Swatch UK | +£5,378 | — | £50 | £14,460 |
| 20 Mar | Settlement | INV-5208190 | Allan & Bertram | -£4,800 | £168 | — | £9,082 |
| 20 Mar | Retention release | INV-5208190 | Allan & Bertram | — | — | — | — |

### 17.3 Application Review (Underwriting)

When an SME client requests financing through the Bridge page, the funder sees the application in their portal:

```
┌─────────────────────────────────────────────────────────┐
│ New Application                              Pending ⏳ │
│                                                         │
│ Client: Datum Creative Media Limited                    │
│ Facility: £100,000 (£71,550 available)                  │
│                                                         │
│ Requested:                                              │
│                                                         │
│ Invoice     Debtor          Amount    P(Pay)30d  Risk   │
│ INV-5208270 Mentzendorff    £10,203   72%       High 82 │
│ INV-5208299 Swatch UK       £6,723    85%       High 80 │
│ INV-5208312 Vintage Assoc   £6,788    78%       High 72 │
│                                                         │
│ Total face value:    £23,714                            │
│ Total advance (80%): £18,971                            │
│ Est. interest:       £829 (avg 32 days @ 3.5%)          │
│ Facility fee:        £150                               │
│                                                         │
│ Qashivo risk assessment:                                │
│ ✅ All debtors have payment history                     │
│ ✅ No concentration limit breach                        │
│ ✅ All invoices within age limit                        │
│ ✅ Client pre-authorised                                │
│ ⚠️ Pay By Phone P(Pay) at 30d is only 68%             │
│                                                         │
│ Charlie's collection plan:                              │
│ Mentzendorff: Professional tone, email, expected W3     │
│ Swatch UK: Friendly tone, email, expected W2            │
│ Vintage: Friendly tone, email+SMS, expected W3          │
│                                                         │
│     [Decline]  [Modify]  [Approve]                      │
│                                                         │
│ Approve sends funds to: Client bank account             │
│ (or funder collects directly if disclosed)              │
└─────────────────────────────────────────────────────────┘
```

**Modify** allows the funder to:
- Remove specific invoices from the request
- Adjust the advance rate for specific invoices (e.g. 70% instead of 80% for riskier debtors)
- Add conditions ("advance subject to debtor confirmation")

**Approve** triggers:
1. `fundedPositions` records created for each invoice
2. Client's facility drawdown updated
3. Client notified: "Finance approved — £18,971 advancing"
4. Charlie adjusts collection priority for financed invoices (higher urgency)
5. Cashflow forecast updated on client's side
6. Audit log (financial category, 7-year retention)

**Decline** with reason:
- "Debtor risk too high"
- "Invoice age exceeds limit"
- "Concentration limit reached"
- Client notified with reason

### 17.4 Concentration Monitor

Real-time view of portfolio concentration risk:

**By Debtor (cross-client):**
```
Top Debtors by Exposure

Debtor              Clients  Total Exposure  % of Book  Limit  Status
Mentzendorff & Co   3        £45,000        8.2%       30%    ✅ Within
Pay By Phone        2        £38,000        6.9%       30%    ✅ Within
Surrey NHS Trust    4        £120,000       21.8%      30%    ⚠️ Approaching
Royal Bank Canada   1        £8,310         1.5%       30%    ✅ Within
```

A debtor appearing across multiple clients is a single point of failure for the funder. If that debtor defaults, the funder loses money across multiple client facilities.

**By Industry:**
```
Industry Exposure

Construction     £680,000    28%   ⚠️ High concentration
Professional     £450,000    18%   ✅ Within limits
Hospitality      £230,000    9%    ✅ Within limits
Healthcare       £180,000    7%    ✅ Within limits
Other            £860,000    35%   ✅ Diversified
```

**By Client:**
```
Client Concentration

Datum Creative     £28,450    1.2%   ✅
Surrey Const.      £180,000   7.5%   ✅
Bright Inst.       £0         0%     —
```

Configurable concentration limits with alerts when approaching or breaching.

### 17.5 Collection Performance

How effectively is Charlie collecting on the funder's book?

**KPIs:**

| Metric | Value | Trend |
|--------|-------|-------|
| Avg days to collection | 34 | ↓ Improving (was 38) |
| Collection rate (30d) | 82% | ↑ Up from 76% |
| Promise-to-pay conversion | 71% | → Stable |
| Disputes as % of book | 3.2% | ↓ Improving |
| Interest earned this month | £28,400 | ↑ Up 12% |
| Write-offs this month | £0 | — |
| Avg interest per position | £68 | — |

**Duration Analysis Chart:**
Histogram: how long funded positions stay active before settlement. Target distribution should cluster around 25-35 days.

**Channel Effectiveness on Funded Invoices:**
Which of Charlie's channels (email, SMS, voice) produces fastest collection on financed invoices specifically. This may differ from the general population because financed invoices may involve disclosed factoring notices.

### 17.6 Provision Calculator

Estimates expected credit losses for the funder's regulatory and management reporting:

```
Expected Loss Provision

Risk Band       Positions  Exposure    Loss Rate  Provision
Low risk        280        £1.6M      0.5%       £8,000
Medium risk     95         £520k      3.0%       £15,600
High risk       30         £240k      10.0%      £24,000
Dispute         7          £45k       25.0%      £11,250
─────────────────────────────────────────────────────
Total           412        £2.4M      2.4%       £58,850
```

Loss rates configurable by the funder. P(Pay) model informs the risk band assignment:
- Low risk: P(Pay) at 60d > 90%
- Medium risk: P(Pay) at 60d 70-90%
- High risk: P(Pay) at 60d < 70%
- Dispute: active dispute flag

**Provision trend chart:** Monthly provision amount over time. Decreasing provision = improving book quality.

### 17.7 Settlement Processing

When a debtor pays a financed invoice:

**Disclosed factoring (debtor pays funder directly):**
1. Payment lands in funder's account
2. Funder marks position as "settled" in the portal
3. System calculates: interest = advance × (rate/30) × days active
4. Retention release = retention amount - interest charged
5. Retention released to client
6. Position closed

**Confidential factoring (debtor pays client, client remits):**
1. Xero sync detects payment on the invoice
2. Charlie notifies funder: "Payment received on INV-5208270"
3. Funder confirms receipt of remittance from client
4. Settlement processed as above

**Portal settlement view:**

```
Settlement: INV-5208270 — Mentzendorff & Co

Invoice amount:      £10,203
Advanced:            £8,162 (80%)
Days active:         28 days
Interest charged:    £333 (3.5% × 28/30 × £8,162)
Facility fee:        £50 (charged at advance)
Retention held:      £2,041
Retention release:   £1,708 (£2,041 - £333 interest)

Net cost to client:  £383 (interest + fee)
Funder revenue:      £383

[Confirm settlement]
```

### 17.8 Charlie Configuration for Funders

The funder can set collection parameters that apply across all their clients:

```
Funder Collection Settings

Default mode:
  ○ Confidential (chase as client's persona)
  ● Disclosed (chase as funder's persona)

Disclosed persona:
  Name: [Collections Department          ]
  Title: [Credit Controller               ]
  Company: [Investec Invoice Finance       ]
  Email: [collections@investec.co.uk       ]

Escalation thresholds (days past expected):
  Day 0-7:   Standard chase (Friendly → Professional)
  Day 8-14:  Accelerated chase (Professional → Firm)
  Day 15-21: Formal notice
  Day 22-30: Legal warning
  Day 30+:   Refer to funder for manual action

Priority weighting:
  Financed invoices get [1.5x] priority multiplier
  in Charlie's action queue vs unfinanced invoices.

Notification triggers:
  ☑ Debtor responds to chase
  ☑ Promise to pay received
  ☑ Promise broken
  ☑ Dispute raised
  ☑ Payment received
  ☐ Each chase sent (too noisy for most funders)
```

**Per-client override:** The funder can set specific clients to confidential mode even if their default is disclosed. Each client's collection method is stored in `fundedPositions.collectionMethod`.

---

## 18. FUNDER PORTAL — RILEY FOR FUNDERS

Riley in the funder portal has a different personality — less friendly CFO, more portfolio risk analyst.

**Riley knows:**
- Total exposure by debtor, client, industry, region
- P(Pay) predictions across the entire funded book
- Which positions are ageing beyond expectations
- Concentration risks approaching limits
- Historical write-off patterns
- Charlie's collection effectiveness on funded invoices
- Settlement pipeline (what's expected to settle this week)

**Example conversations:**

User: "How's the book looking this week?"

Riley: "Your book is £2.4M deployed across 412 positions. 23 positions (£180k) are past their expected collection date. The biggest risk is Surrey NHS Trust — they owe £120k across 4 clients and P(Pay) has dropped from 85% to 62% in the last two weeks. Charlie escalated tone on all Surrey positions yesterday. I'd recommend reviewing their facility."

User: "Should I approve the Datum application?"

Riley: "The three invoices look solid. Mentzendorff has an 82% risk score and pays in 42 days average — well within your 90-day age limit. Swatch is your fastest-paying debtor at 25 days. The only concern is Pay By Phone — they've broken a promise recently. I'd approve Mentzendorff and Swatch, and hold Pay By Phone until they settle their current promise."

User: "What's my exposure to construction?"

Riley: "£680k, which is 28% of your book. Your concentration limit is 30%, so you're approaching the threshold. I'd hold off on new construction advances until some positions settle. Surrey Construction alone is £180k of that. Charlie collected £45k from construction clients last week, so the position should improve by next Friday."

---

## 19. FUNDER PORTAL — API ENDPOINTS

```
GET    /api/funder/book                  — Lending book dashboard data
GET    /api/funder/positions             — All funded positions (filterable)
GET    /api/funder/positions/:id         — Single position detail
PATCH  /api/funder/positions/:id/settle  — Mark position as settled
PATCH  /api/funder/positions/:id/status  — Update position status

GET    /api/funder/applications          — Pending finance applications
POST   /api/funder/applications/:id/approve  — Approve application
POST   /api/funder/applications/:id/decline  — Decline with reason
POST   /api/funder/applications/:id/modify   — Modify and approve

GET    /api/funder/concentration         — Concentration analysis
GET    /api/funder/provisions            — Provision calculator data
GET    /api/funder/performance           — Collection performance metrics
GET    /api/funder/settlements           — Settlement processing queue

GET    /api/funder/clients/:id/positions — Positions for a specific client
GET    /api/funder/clients/:id/facility  — Facility details for a client
PATCH  /api/funder/clients/:id/facility  — Update facility terms

GET    /api/funder/debtors/:id/exposure  — Cross-client exposure for a debtor

POST   /api/funder/settings/collection   — Update collection configuration
GET    /api/funder/reports/:type          — Generate funder report
```

---

## 20. FUNDER PORTAL — BUILD PHASES

### Phase F1: Data Model + Basic Views
- Create fundedPositions, funderFacilities tables
- Extend partnerAccounts with partnerType and funderConfig
- Funder-specific dashboard with lending book metrics
- Client list with facility utilisation
- Context switching to client (same as accountant portal)

### Phase F2: Position Management
- Funded position detail view (per client)
- Active, settled, unfinanced invoice tabs
- Position timeline (advance → collection → settlement)
- Transaction history ledger

### Phase F3: Application Review (Underwriting)
- Application queue from client Bridge requests
- Risk assessment display (P(Pay), credit score, Charlie's plan)
- Approve/modify/decline workflow
- Auto-creation of funded positions on approval
- Client notification on decision

### Phase F4: Concentration + Risk Monitoring
- Cross-client debtor exposure view
- Industry/client/debtor concentration analysis
- Configurable concentration limits with alerts
- Provision calculator with risk bands

### Phase F5: Settlement Processing
- Settlement workflow (disclosed + confidential)
- Interest calculation engine
- Retention release processing
- Settlement confirmation and audit trail

### Phase F6: Collection Configuration
- Funder persona management (for disclosed factoring)
- Confidential/disclosed toggle per client
- Escalation threshold configuration
- Priority weighting for financed invoices
- Notification preferences

### Phase F7: Riley + Reporting
- Riley with funder context (portfolio risk analyst)
- Lending book report (PDF)
- Collection performance report
- Provision report
- Concentration report
- Duration analysis report

---

## 21. SHARED ARCHITECTURE

The accountant portal and funder portal share:

| Component | Shared? |
|-----------|---------|
| Org switcher | ✅ Same component, filtered by partnerType |
| Context switching | ✅ Identical mechanism |
| partnerAccounts table | ✅ Differentiated by partnerType field |
| partnerUsers + roles | ✅ Same admin/controller structure |
| controllerAssignments | ✅ Same assignment model |
| Staff management UI | ✅ Same page |
| Client onboarding | ✅ Same flow (funder may add facility setup step) |
| Notifications | ✅ Same system, different trigger rules |
| Riley | ✅ Same chat widget, different system prompt |
| Dashboard | ❌ Different — advisory vs lending |
| Client detail view | ❌ Different tabs (funded positions vs full AR) |
| Reports | ❌ Different report types |
| Collection config | ❌ Funder-specific (persona, escalation, priority) |

This means ~60% of the code is shared. Building the accountant portal first means the funder portal is an incremental build, not a greenfield project.

---

*Specification version: 1.1 — 11 April 2026*
*Author: Simon Kramer / Claude*
*Status: Specification complete. Implementation follows Phase 1-8 (accountant) then F1-F7 (funder) order.*
*Dependencies: RBAC Phases 1-4 (complete), Accountant role (complete), invitation flow (complete), Qapital Bridge (complete)*
*Cross-references: RBAC_MULTI_USER_SPEC.md, CASHFLOW_FORECAST_SPEC_v2.md, CHARLIE_COLLECTIVE_INTELLIGENCE_SPEC.md*
