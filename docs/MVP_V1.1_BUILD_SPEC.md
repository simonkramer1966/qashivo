# QASHIVO — MVP v1.1 BUILD SPECIFICATION

**Version:** 1.1 — 15 March 2026
**Scope:** Post-MVP v1 sprint — Riley AI Assistant, Data Health, Xero production hardening
**Reference:** QASHIVO_CONTEXT_ADDENDUM_v4.2.md (Sections 20-23)
**Prerequisite:** MVP v1 (Sprints 0-4) complete

---

## OVERVIEW

MVP v1 delivered the core Collections Agent pipeline (LLM email generation, compliance, approval queue, intent extraction, tone escalation). MVP v1.1 adds:

1. **Xero production hardening** — reliable sync, token refresh, invoice-first approach
2. **Data Health system** — debtor readiness assessment with inline editing
3. **Debtor Detail page** — full profile with multi-contact management
4. **Riley AI Assistant** — the system brain, onboarding guide, and virtual CFO
5. **Weekly CFO Review** — cashflow advisory tab in Qashflow

---

## SPRINT 5: XERO PRODUCTION + DATA HEALTH (Current)

### 5.1 Xero Foundations Fix

| Task | Detail |
|------|--------|
| Fix redirect URI | Replace REPLIT_DOMAINS in xero.ts constructor with APP_URL env var. Add APP_URL to Railway. |
| Remove old sync code | Delete syncContactsToDatabase if unused. Invoice-first sync in xeroSync.ts is the correct path. |
| Fix invoice sync | syncInvoicesAndContacts must write to BOTH cached_xero_invoices AND main invoices table. Map all fields correctly. |
| Token refresh | Verify offline_access in scopes, proactive refresh before API calls, 401 retry, mark expired on failure. |
| Sync status API | GET /api/xero/sync-status returning { status, invoiceCount, contactCount } for onboarding polling. |
| Sync banner | Show "Sync in progress" banner on Debtors/Data Health pages that auto-refreshes on completion. |
| Background sync mode | Ensure scheduled 4-hour sync uses mode='ongoing' (upsert, never delete). AR overlay fields never overwritten. |

### 5.2 Data Health Page

| Task | Detail |
|------|--------|
| API endpoint | GET /api/settings/data-health — categorise contacts by readiness (ready, needs_email, generic_email, needs_phone, needs_attention, no_outstanding) |
| Generic email detection | Flag 12 patterns: info@, accounts@, admin@, office@, finance@, hello@, enquiries@, contact@, billing@, sales@, support@, reception@ |
| Page UI | Settings > Data Health. Summary cards (clickable filters) + search + sortable table + inline email/phone editing |
| AR overlay saves | Inline edits save to arContactEmail/arContactPhone — Qashivo data, not synced back to Xero |
| Onboarding integration | Step 6 (Review Debtors) uses same data-health API and readiness assessment |

### 5.3 Communication Test Mode

| Task | Detail |
|------|--------|
| Settings UI | Add to Autonomy & Rules: communicationMode radio (Off/Testing/Soft Live/Live), testContactName, testEmails, testPhones |
| Pipeline integration | When mode=testing, ALL outbound emails redirect to test addresses. Subject prefixed with [TEST]. Body includes "Original recipient: {real_email}" |
| Default | New tenants default to "testing" mode |

---

## SPRINT 6: DEBTOR DETAIL PAGE

### 6.1 Debtor Record (/qollections/debtors/:id)

| Section | Detail |
|---------|--------|
| Header | Company name, readiness badge, total outstanding, total overdue, DSO, risk tag, back button |
| Contacts | All customerContactPersons. Add/edit/remove. Flag Primary AR Contact and Escalation Contact (one each). Collections Agent uses Primary AR Contact email by default. |
| Invoices | All invoices for debtor. Expandable rows show agent communication timeline per invoice. |
| Agent Activity | Recent actions — emails, replies, intent signals, compliance checks. Most recent first. |
| AR Notes | Timestamped notes with user name. Free-text using arNotes field. |

### 6.2 Navigation — Row Click + Three-Dot Menu

Apply to ALL debtor list pages (Debtors, Data Health, Dashboard, Onboarding step 6):

| Element | Behaviour |
|---------|-----------|
| Row click | Navigate to /qollections/debtors/:id. Hover state with pointer cursor. |
| Three-dot menu | Quick actions without navigation: View Details, Add Contact, Add Note, Put On Hold, Mark as VIP. stopPropagation on menu click. |

---

## SPRINT 7: RILEY AI ASSISTANT

### 7.1 Core Infrastructure

| Task | Detail |
|------|--------|
| rileyConversations table | id, tenantId, userId, messages (JSONB), topic, relatedEntityType, relatedEntityId, timestamps |
| Extend aiFacts table | Add: category, entityType, entityId, factKey, factValue, confidence, source, sourceConversationId, expiresAt, isActive |
| forecastUserAdjustments table | Per spec Section 20.4 Layer 3. Category, amount, timing, materiality score, follow-up tracking. |
| Tenant settings | Add: rileyReviewDay, rileyReviewTime, rileyReviewTimezone |
| Riley service | server/agents/rileyAssistant.ts — prompt assembly, context building, response generation, intelligence extraction |

### 7.2 Riley System Prompt Assembly

Each Riley API call includes:

```
SYSTEM PROMPT:
├── Riley's identity and personality (friendly, knowledgeable, proactive)
├── Qashivo product knowledge (features, how things work, terminology)
├── Current user's role and permissions
├── Current page context
│
CONTEXT (dynamic per conversation):
├── Tenant data snapshot (AR summary, debtor count, overdue amount, DSO)
├── Recent aiFacts for the topic being discussed
├── Relevant debtor data (if discussing a specific debtor)
├── Forecast data (if discussing cashflow)
├── Recent agent activity summary
├── Conversation history (last 20 messages)
│
INSTRUCTIONS:
├── Respond naturally and conversationally
├── If you learn something about the business, note it for extraction
├── If the user asks about data, query it and explain in plain English
├── If the user wants to take an action, confirm before executing
├── Connect insights across pillars (debtors → cashflow → finance)
```

### 7.3 Floating Chat Widget

| Task | Detail |
|------|--------|
| React component | FloatingRileyChat.tsx — bottom-right, all pages. Collapsed (bubble + badge) / expanded (chat panel 400x600). |
| Message persistence | Load from rileyConversations. New conversation per topic/session. |
| Context awareness | Pass current route/page to Riley. She adapts greetings and suggestions. |
| API endpoint | POST /api/riley/message — sends user message + page context, returns Riley response |
| Streaming | Use Claude streaming API for real-time response display |
| Typing indicator | Show while Claude generates response |

### 7.4 Intelligence Extraction Pipeline

After each meaningful exchange (not simple greetings), run secondary Claude call:

```
POST to Claude with conversation context:
"Extract structured business intelligence from this conversation.
Return JSON: { facts[], forecastInputs[], debtorUpdates[], actionRequests[] }"
```

Results written to:
- facts[] → aiFacts table
- forecastInputs[] → forecastUserAdjustments table
- debtorUpdates[] → contacts AR overlay fields / customerPreferences
- actionRequests[] → queued for execution (with confirmation if destructive)

### 7.5 Onboarding Mode

During onboarding, Riley operates in guided mode (full-screen, not floating widget):

| Step | Riley's Script |
|------|---------------|
| Welcome | Introduction, explain the process |
| After Xero sync | "I found X debtors. Y are ready to chase. Let me ask about your top accounts." |
| Business intel (top 5 debtors) | For each: relationship, sensitivities, contact preferences, special instructions |
| Weekly review setup | "When would you like your weekly cashflow catch-up?" → save day/time |
| Go live | "Everything's set. Your agent [persona name] will start reaching out in Semi-Auto mode." |

### 7.6 Proactive Suggestions

Riley initiates conversations based on data triggers:

| Trigger | Riley Message |
|---------|--------------|
| 3+ broken promises this week | "3 debtors broke their payment promises this week — want me to show you?" |
| DSO improvement | "Your DSO improved by X days since you started — nice work" |
| New invoices synced | "8 new invoices synced from Xero. 5 are already overdue." |
| Pending approvals | "6 emails waiting for your approval" |
| Weekly review ready | "Your weekly cashflow review is ready" |
| Forecast item expiring | "The £15k bonus payment was expected last week. Did it go through?" |
| Debtor deteriorating | "Acme's payment pattern is getting slower — they've gone from 15 to 30 days average" |

---

## SPRINT 8: WEEKLY CFO REVIEW

### 8.1 Qashflow Navigation Update

```
Qashflow
├── Weekly Review (Riley's CFO analysis — built now)
├── 13-Week Forecast (placeholder → MVP v2)
├── Scenarios (placeholder → MVP v2)  
├── Changes (placeholder → MVP v2, Riley captures conversationally)
└── Accuracy Tracking (placeholder → MVP v2)
```

### 8.2 Weekly Review Page

| Section | Detail |
|---------|--------|
| Header | "Week of [date] — prepared by Riley" + last/next review dates |
| Summary | 3-4 paragraphs plain English: this week, next 2-3 weeks, risks, recommendations. Generated by Claude with full data context. |
| Key numbers | Cards: Cash Position (if Open Banking), Expected In, Expected Out, Net Position, Pressure Points |
| Debtor focus | Which debtors matter most to cash this week — expected payments, risks, late payers. Linked to debtor records. |
| User input | "Anything changed since last week?" — text input, Riley processes into forecastUserAdjustments |
| History | Previous reviews scrollable. Track how picture evolved week to week. |

### 8.3 Review Generation

Scheduled cron job at user's preferred time:
1. Assemble data context: AR summary, overdue debtors, recent payments, known outflows, forecast adjustments, previous review
2. Call Claude with CFO review prompt
3. Store generated review in new `weeklyReviews` table
4. Create proactive Riley notification
5. User sees "Your weekly review is ready" in the chat widget and on the Qashflow tab

### 8.4 Pre-Bayesian Forecast (simplified for v1.1)

Without the full Bayesian engine, Riley's review uses:
- Current AR data (who owes what, when due)
- Debtor payment history (average days to pay per debtor from historical invoices)
- Known recurring outflows from user inputs via Riley conversations
- Three-scenario framing: optimistic (debtors pay on time), expected (pay at historic average), pessimistic (pay 50% later than average)

---

## SCHEMA CHANGES SUMMARY (v1.1)

### New Tables

| Table | Purpose |
|-------|---------|
| rileyConversations | Conversation history between Riley and users |
| forecastUserAdjustments | Cashflow inputs captured from Riley conversations |
| weeklyReviews | Generated weekly CFO review content |

### Extended Tables

| Table | Changes |
|-------|---------|
| aiFacts | Add: category, entityType, entityId, factKey, confidence, source, sourceConversationId, expiresAt, isActive |
| tenants | Add: rileyReviewDay, rileyReviewTime, rileyReviewTimezone |

### New Environment Variables

| Variable | Purpose |
|----------|---------|
| APP_URL | Production domain for Xero redirect URI (e.g., https://qashivo-production.up.railway.app) |

---

## BUILD ORDER (v1.1)

```
SPRINT 5 (Current):  Xero production hardening + Data Health + communication test mode
SPRINT 6:            Debtor Detail page + row navigation + three-dot menus
SPRINT 7:            Riley core — chat widget, conversations, intelligence extraction, onboarding mode
SPRINT 8:            Weekly CFO Review — Qashflow tab, review generation, proactive notifications
```

**MVP v1.1 is complete when:**
1. Xero syncs reliably with token auto-refresh and invoice-first approach
2. Data Health shows debtor readiness with inline editing
3. Debtor Detail page shows full profile with multi-contact management
4. Riley is available on every page as a floating chat assistant
5. Riley gathers business intelligence during onboarding and ongoing
6. Weekly CFO Review generates and displays in Qashflow tab
7. Communication test mode prevents accidental live sends

---

*This spec extends MVP_V1_BUILD_SPEC.md v1.0. Read both together for the complete implementation plan.*
