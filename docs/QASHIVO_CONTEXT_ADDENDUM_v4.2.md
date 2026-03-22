# QASHIVO CONTEXT DOCUMENT — ADDENDUM v4.2

**Date:** 15 March 2026
**Purpose:** Extends QASHIVO_CONTEXT.md v4.1 with Riley AI Assistant architecture, Data Health system, and enhanced onboarding flow. This addendum should be appended to the main context document or read alongside it.

---

## 20. RILEY — AI ASSISTANT & SYSTEM BRAIN

### 20.1 Overview

Riley is Qashivo's always-available AI assistant — the intelligence layer across all three pillars (Qollections, Qashflow, Qapital). Riley serves as:

- **Onboarding guide**: Conversational setup assistant during initial customer onboarding
- **Business intelligence gatherer**: Learns about the customer's business through natural conversation
- **Virtual CFO**: Weekly cashflow advisory and proactive financial insights
- **System help**: Answers questions about Qashivo features and the customer's data
- **Action taker**: Can execute safe operations (pause debtors, add notes, update settings)

Riley is NOT a chatbot with canned responses. Every response is LLM-generated with full context of the customer's business, their data, and their conversation history. Riley gets smarter with every interaction.

### 20.2 Riley's Capabilities by Pillar

**Qollections (Credit Control):**
- Learns debtor relationships, sensitivities, preferred channels
- Identifies key accounts, difficult payers, special arrangements
- Captures internal politics ("Don't chase Acme — CEO is friends with our MD")
- Understands industry norms ("Recruitment clients always pay 15 days late")
- Recommends which debtors to prioritise
- Explains agent decisions and actions
- Can pause/resume chasing, change tone overrides, add AR notes

**Qashflow (Cashflow Forecasting):**
- Captures forecast inputs conversationally (replacing forms)
- Learns seasonal patterns ("December is always slow")
- Records planned costs, hiring, revenue changes
- Conducts weekly CFO review (see Section 20.5)
- Explains forecast variances in plain English
- Connects debtor behaviour to cashflow impact

**Qapital (Working Capital Finance):**
- Learns finance preferences ("Won't finance invoices under £5k")
- Understands risk tolerance and provider preferences
- Recommends finance activation when cashflow gaps appear
- Explains eligibility and improvement paths

### 20.3 Business Intelligence Gathering

Riley actively learns about the business through two phases:

**Phase 1 — Onboarding Intelligence (concentrated):**
After Xero sync completes, Riley reviews the top debtors by outstanding amount and asks targeted questions:
- "Mentzendorff has £1,479 outstanding across 68 invoices. What's your relationship with them — key client, standard, or difficult?"
- "Any specific contact I should chase there, or is the accounts@ email fine?"
- "Anything I should know — payment quirks, disputes, sensitivities?"

Riley categorises answers into: relationship tier, preferred tone, preferred channel, special instructions, named contacts.

**Phase 2 — Ongoing Learning (2-3 questions per day):**
- Before first contact with new debtors: "I'm about to email Surrey NHS Trust. Anything I should know?"
- After unexpected behaviour: "Cre8tive Input ignored their third email. Is this unusual?"
- After broken promises: "Marwood promised to pay Friday but didn't. Escalate or give them time?"
- Periodic check-ins: "It's been a month chasing Uliving. Want to change approach?"

All intelligence feeds directly into the Collections Agent's prompts, making every communication smarter.

### 20.4 Storage Architecture

**Layer 1 — Conversation History (raw):**
```
rileyConversations
├── id (PK)
├── tenantId (FK)
├── userId (FK — who was talking)
├── messages (JSONB array: [{role, content, timestamp}])
├── topic ("debtor_intel" | "forecast_input" | "system_help" | "onboarding" | "weekly_review")
├── relatedEntityType ("debtor" | "invoice" | "forecast" | "settings" | null)
├── relatedEntityId (contactId, invoiceId, etc.)
├── createdAt, updatedAt
```

**Layer 2 — Extracted Business Intelligence (structured):**
Uses existing `aiFacts` table, extended with:
```
aiFacts (extended)
├── category: "debtor_relationship" | "payment_behaviour" | "business_context" |
│             "seasonal_pattern" | "cashflow_input" | "finance_preference" |
│             "industry_norm" | "internal_policy" | "contact_intel"
├── entityType: "debtor" | "tenant" | "invoice" | "forecast" | null
├── entityId: contactId or null (tenant-wide facts have no entityId)
├── factKey: structured key (e.g., "relationship_tier", "tone_override", "payment_quirk")
├── factValue: the intelligence (text)
├── confidence: 0-1 (user stated directly = 1.0, inferred = 0.7)
├── source: "riley_onboarding" | "riley_conversation" | "riley_inferred" | "user_manual"
├── sourceConversationId: FK → rileyConversations
├── expiresAt: timestamp (some facts expire — seasonal patterns, capex estimates)
├── isActive: boolean (user can correct/retract)
├── createdAt, updatedAt
```

**Layer 3 — Forecast Inputs (from conversations):**
```
forecastUserAdjustments
├── id (PK)
├── tenantId (FK)
├── category: "revenue_change" | "cost_change" | "hiring" | "capex" | "tax" | "other"
├── description: text (e.g., "December bonuses")
├── amount: decimal
├── timingType: "one_off_date" | "date_range" | "recurring_monthly"
├── startDate, endDate
├── enteredDate, expiryDate (default 3 months)
├── lastConfirmedDate
├── expired: boolean
├── affects: "inflows" | "outflows"
├── source: "riley_conversation" | "manual_ui"
├── sourceConversationId: FK → rileyConversations
├── materialityScore: decimal (amount / monthly_revenue)
├── followUpPriority: "high" | "medium" | "low" | "none"
├── followUpStatus: "pending" | "asked" | "confirmed" | "cancelled" | "auto_resolved"
├── lastFollowUpAt: timestamp
├── followUpCount: integer (max 2 follow-ups)
├── autoResolved: boolean (true if Open Banking detected the payment)
├── createdAt, updatedAt
```

**Materiality-based follow-up logic:**
- materialityScore > 0.10 (>10% monthly flow) → high priority, ask immediately on expiry
- materialityScore > 0.03 (3-10%) → medium priority, batch into weekly check-in
- materialityScore > 0.01 (1-3%) → low priority, silently expire
- Below 0.01 → none, never ask
- If Open Banking detects matching payment → auto-resolve, no need to ask

**Layer 4 — Working Memory (per session, in-memory):**
Assembled into each Claude API call:
- Current page user is on
- Debtor/invoice being viewed
- Recent conversation messages (last 20)
- Relevant aiFacts for the topic
- Current data snapshots (AR summary, overdue count, cash position)

### 20.5 Weekly CFO Review

Riley conducts a weekly cashflow advisory review, displayed as a dedicated tab in the Qashflow section.

**Scheduling:**
- User chooses preferred day and time during onboarding
- Stored in tenant settings: rileyReviewDay, rileyReviewTime, rileyReviewTimezone
- Cron job generates the review at scheduled time
- User receives notification: "Your weekly cashflow review is ready"

**Review page structure (Qashflow > Weekly Review tab):**
- Header: "Week of [date] — prepared by Riley" with last/next review dates
- Summary: 3-4 paragraphs of plain English analysis covering this week, next 2-3 weeks, risks, recommendations
- Key numbers cards: Cash Position, Expected In, Expected Out, Net Position, Pressure Points
- Debtor focus list: Who matters most to cash this week — expected payments, risks, late payers
- User input section: "Anything changed since last week?" — conversational input, Riley processes and updates forecast
- History: Previous weekly reviews scrollable — track how the picture evolved

**Review content covers:**
- This week's expected inflows and outflows
- Upcoming pressure points (large outflows, concentrated debtor payments)
- Debtor collection progress and risks
- Variances from last week's predictions
- Recommended actions ("Push harder on X", "Consider financing Y")
- Forecast accuracy tracking
- Follow-up on expiring forecast items

**Pre-Bayesian implementation (MVP v1):**
Riley can deliver value before the full Bayesian engine by using:
- Current AR data (who owes what, when due)
- Known outflows from user inputs and detected patterns
- Debtor payment history for timing estimates
- Three-scenario framing (optimistic/expected/pessimistic)

### 20.6 UI — Floating Chat Widget

Riley lives in a floating chat bubble (bottom-right corner), available on every page.

**States:**
- Collapsed: Small circular bubble with Riley's avatar, optional notification badge
- Expanded: Chat panel (400px wide, 600px tall) with message history, input field, typing indicator
- During onboarding: Full-screen guided experience (not the floating widget)

**Context awareness:**
Riley knows which page the user is on and adapts:
- On Debtors page: "I see you're looking at your debtor list. Need help with anyone specific?"
- On Data Health: "12 debtors need email addresses. Want me to help prioritise which to fix first?"
- On Agent Activity: "The agent sent 8 emails today. 3 got responses — want a summary?"

**Proactive messages:**
Riley can initiate conversations based on triggers:
- "3 debtors broke their payment promises this week"
- "Your DSO improved by 4 days this month"
- "8 new invoices synced from Xero, 5 already overdue"
- "6 emails waiting for your approval"
- Weekly review ready notification

### 20.7 Intelligence Extraction

After each meaningful conversation, Riley runs a secondary Claude call to extract structured data:

```
System: "Given this conversation between Riley and the user, extract any structured 
business intelligence. Return JSON with:
- facts[]: {category, entityType, entityId, factKey, factValue, confidence}
- forecastInputs[]: {category, description, amount, timing, affects}  
- debtorUpdates[]: {contactId, field, value}
- actionRequests[]: {type, entityId, details}"
```

This ensures natural conversation produces structured data that feeds all system agents.

---

## 21. DATA HEALTH SYSTEM

### 21.1 Purpose

The Data Health system assesses debtor readiness for automated collections. It categorises every debtor by whether the AI agent has sufficient data to start chasing.

### 21.2 Readiness Categories

| Status | Criteria | Agent Can | Colour |
|--------|----------|-----------|--------|
| **Ready** | Has valid named email + has overdue invoices | Chase immediately via email | Green |
| **Needs Email** | Has overdue invoices, no email address | Cannot contact | Red |
| **Generic Email** | Has email matching generic patterns (info@, accounts@, admin@, office@, finance@, hello@, enquiries@, contact@, billing@, sales@, support@, reception@) | Can email but response rates will be low | Amber |
| **Needs Phone** | Has email + overdue invoices, no phone number | Can email but not SMS/call | Yellow |
| **Needs Attention** | Contact name missing, email format invalid, or other data quality issues | Cannot contact reliably | Red |
| **No Outstanding** | All invoices paid or zero balance | Nothing to chase | Grey (hidden by default) |

### 21.3 UI Location

Settings > Data Health (new sidebar item).

Page structure:
- Summary cards at top (clickable to filter): Ready, Needs Email, Generic Email, Needs Phone, Needs Attention
- Search bar
- Sortable data table: Customer Name, Email, Phone, Outstanding, Overdue, Invoices, Days Overdue, Status badge
- Inline editing: click empty email/phone field to add — saves to AR overlay fields (arContactEmail, arContactPhone), NOT back to Xero
- AR overlay indicator showing which data is from Xero vs manually entered in Qashivo

### 21.4 AR Overlay Principle

User-entered data in Qashivo (arContactEmail, arContactPhone, arContactName, arNotes) is NEVER overwritten by Xero sync. This data exists only in Qashivo and represents the user's curated credit control intelligence. This is a key stickiness factor and a data asset for the bank buyer.

---

## 22. ENHANCED ONBOARDING WITH RILEY

### 22.1 Onboarding Steps (Revised)

| Step | What Happens | Riley's Role |
|------|-------------|-------------|
| 1. Welcome | Riley introduces herself and Qashivo | Conversational, warm, explains what's about to happen |
| 2. Connect Xero | OAuth flow | Riley explains why, handles errors, shows sync progress |
| 3. Connect Open Banking | Consent flow (placeholder v1) | Riley explains the value, answers questions about safety |
| 4. Create Agent Persona | Name, title, signature, tone | Riley asks "What should your credit controller be called?" — guides with suggestions |
| 5. Communication Preferences | Autonomy level, hours, limits | Riley explains options in plain English, recommends Semi-Auto |
| 6. Review Debtors | Data Health readiness assessment | Riley summarises: "I found 62 debtors, 45 ready to chase, 12 need email. Let's fix those." |
| 7. Business Intelligence | Riley asks about top 5 debtors | "Before we go live, tell me about your key accounts" — concentrated learning |
| 8. Weekly Review Setup | Choose day/time for CFO review | "When would you like your weekly cashflow catch-up?" |
| 9. Go Live | Enable Collections Agent | Riley confirms everything, explains what happens next |

### 22.2 Background Sync During Onboarding

Xero sync runs in background during steps 4-5. Sync status polled via GET /api/xero/sync-status. By step 6, data is ready. If sync is still running, Riley shows progress and the user can proceed to step 7 while it completes.

### 22.3 Post-Onboarding

Riley transitions from onboarding guide to always-available assistant. The floating chat widget appears on all pages. Riley continues business intelligence gathering with 2-3 questions per day. Weekly CFO review starts on the user's chosen schedule.

---

## 23. XERO INTEGRATION — PRODUCTION ARCHITECTURE

### 23.1 Sync Strategy

**Invoice-first approach:** Fetch invoices → extract contacts from invoice data → batch-fetch contact details.

**Date filter:** Only invoices from last 24 months OR currently open (AUTHORISED/SUBMITTED). Avoids pulling decades of history.

**Rate limiting:** 1.5 second delay between paginated API calls. 429 retry with 60 second wait.

**Two sync modes:**
- INITIAL: Clean sweep (delete dependent records in FK order) + fresh insert. Used on first connection.
- ONGOING: Upsert by xeroInvoiceId/xeroContactId. New records added, existing updated, paid invoices marked. AR overlay fields never overwritten. Used for scheduled background syncs.

### 23.2 Token Management

- OAuth scopes include `offline_access` for 60-day refresh tokens
- Proactive token refresh: check expiry (with 2-minute buffer) before every API call
- Reactive 401 retry: if API returns 401, refresh token and retry once
- Failed refresh: mark connection as "expired", prompt user to reconnect
- Redirect URI: configured via APP_URL environment variable (not platform-specific)

### 23.3 Data Flow

```
Xero → Invoices table + Contacts table (main tables, queried by all pages)
     → cached_xero_invoices (raw cache for reference)
     → AR overlay fields preserved (never overwritten by sync)
     → Data Health assessment recalculated after each sync
     → Debtor scoring job queued after sync
```

---

*Addendum version: 4.2 — 15 March 2026*
*Extends QASHIVO_CONTEXT.md v4.1 with Sections 20-23*
*Key additions: Riley AI Assistant, Data Health system, enhanced onboarding, production Xero architecture*
