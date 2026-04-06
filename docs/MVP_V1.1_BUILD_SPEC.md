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

## SPRINT 5: XERO PRODUCTION + DATA HEALTH + COLLECTIONS HARDENING (Current)

*Updated: 5 April 2026 — significant scope expansion beyond original Sprint 5 plan. Collections pipeline hardening, two-phase model, and Action Centre restructure pulled forward from backlog.*

### 5.1 Xero Foundations Fix

| Task | Detail | Status |
|------|--------|--------|
| Fix redirect URI | Replace REPLIT_DOMAINS in xero.ts constructor with APP_URL env var. Add APP_URL to Railway. | ⬜ Pending |
| Remove old sync code | Delete syncContactsToDatabase if unused. Invoice-first sync in xeroSync.ts is the correct path. | ⬜ Pending |
| Fix invoice sync | syncInvoicesAndContacts must write to BOTH cached_xero_invoices AND main invoices table. Map all fields correctly. | ⬜ Pending |
| Token refresh | Verify offline_access in scopes, proactive refresh before API calls, 401 retry, mark expired on failure. | ⬜ Pending |
| Sync status API | GET /api/xero/sync-status returning { status, invoiceCount, contactCount } for onboarding polling. | ⬜ Pending |
| Sync banner | Show "Sync in progress" banner on Debtors/Data Health pages that auto-refreshes on completion. | ⬜ Pending |
| Background sync mode | Ensure scheduled 4-hour sync uses mode='ongoing' (upsert, never delete). AR overlay fields never overwritten. | ⬜ Pending |

### 5.2 Data Health Page

| Task | Detail | Status |
|------|--------|--------|
| API endpoint | GET /api/settings/data-health — categorise contacts by readiness (ready, needs_email, generic_email, needs_phone, needs_attention, no_outstanding) | ✅ Done |
| Generic email detection | Flag 12 patterns: info@, accounts@, admin@, office@, finance@, hello@, enquiries@, contact@, billing@, sales@, support@, reception@ | ✅ Done |
| Hard bounce detection | Queries timelineEvents for email_hard_bounce events, downgrades contacts to needs_email | ✅ Done (4 Apr) |
| Page UI | Settings > Data Health. Summary cards (clickable filters) + search + sortable table + inline email/phone editing | ✅ Done |
| AR overlay saves | Inline edits save to arContactEmail/arContactPhone — Qashivo data, not synced back to Xero | ✅ Done |
| Onboarding integration | Step 6 (Review Debtors) uses same data-health API and readiness assessment | ⬜ Pending |

### 5.3 Communication Test Mode

| Task | Detail | Status |
|------|--------|--------|
| Settings UI | Add to Autonomy & Rules: communicationMode radio (Off/Testing/Soft Live/Live), testContactName, testEmails, testPhones | ✅ Done |
| Pipeline integration | When mode=testing, ALL outbound emails redirect to test addresses. Subject prefixed with [TEST]. Body includes "Original recipient: {real_email}" | ✅ Done |
| Default | New tenants default to "testing" mode | ✅ Done |
| Voice mode enforcement | Two Retell voice paths now routed through sendVoiceCall() wrapper for mode checks | ✅ Done (4 Apr) |

### 5.4 Collections Pipeline Hardening (added 4 Apr — pulled forward)

| Task | Detail | Status |
|------|--------|--------|
| Compliance gate on ActionExecutor | runComplianceGate() runs compliance engine on all email/SMS before delivery. Fails closed. | ✅ Done (4 Apr) |
| Approval pipeline fix | Deleted shadowed old approve endpoint. Bulk-approve and approve-all call approveAndSend(). | ✅ Done (4 Apr) |
| Collections scheduler boot fix | orchestrator.ts now correctly calls collectionsScheduler.start() | ✅ Done (4 Apr) |
| Compliance false positive fixes | Tenant timezone for time-of-day, digit-boundary invoice matching, cooldown pre-filter | ✅ Done (4 Apr) |
| Email HTML formatting | New emailFormatter.ts converts LLM plain text to professional HTML. Applied to all 4 email paths. | ✅ Done (4 Apr) |
| Conversation brief service | 11-source debtor history injected into all LLM generation paths | ✅ Done (4 Apr) |
| Promise modification detection | intentAnalyst detects revised payment promises, updates existing PTP signals | ✅ Done (4 Apr) |
| Prohibited PTP language | "promise to pay"/"PTP" prohibited in debtor-facing comms — replaced with "payment arrangement" | ✅ Done (4 Apr) |
| SMS E.164 normalization | normalizeToE164() converts UK local → international for all sends | ✅ Done (4 Apr) |
| Inbound SMS wider lookup | Three-source search × 4 format variants + unmatched SMS creates exception item | ✅ Done (4 Apr) |
| Startup validation | Throws at startup for missing ANTHROPIC_API_KEY/DATABASE_URL | ✅ Done (4 Apr) |

### 5.5 Two-Phase Collection Model (added 4 Apr)

| Task | Detail | Status |
|------|--------|--------|
| Phase 1 (Inform) | Single polite nudge for new/recent overdue. No payment date ask. Single-touch enforcement. | ✅ Done (4 Apr) |
| Phase 2 (Elicit Date) | After chaseDelayDays — actively seek payment date. Clear question. Normal escalation. | ✅ Done (4 Apr) |
| Pre-due reminders | Courtesy reminder N days before due for invoices above minimum threshold | ✅ Done (4 Apr) |
| Tenant settings | chaseDelayDays (default 5), preDueDateDays (default 7), preDueDateMinAmount (default £1000) | ✅ Done (4 Apr) |
| Settings UI | Collection Timing card on Autonomy & Rules page with sliders + amount input | ✅ Done (4 Apr) |

### 5.6 Action Centre Restructure (added 4 Apr)

| Task | Detail | Status |
|------|--------|--------|
| Tab rename + restructure | Queue→Approval, Activity→Sent, new Scheduled tab. Order: Summary, Approval, Scheduled, Sent, VIP, Exceptions | ✅ Done (4 Apr) |
| Configurable send delay | sendDelayMinutes tenant setting (0-60, default 15). After approval, actions wait in Scheduled. | ✅ Done (4 Apr) |
| Scheduled tab | Shows approved-but-not-yet-sent actions with Cancel and Send Now buttons + preview sheet | ✅ Done (4 Apr) |
| API endpoints | GET /api/action-centre/scheduled, POST /api/actions/:actionId/cancel, POST /api/actions/:actionId/send-now | ✅ Done (4 Apr) |
| Query invalidation | Shared useInvalidateActionCentre hook for consistent cross-tab invalidation | ✅ Done (4 Apr) |

### 5.7 UI/UX Improvements (added 4 Apr)

| Task | Detail | Status |
|------|--------|--------|
| Activity timeline redesign | Event-type visual differentiation (colour-coded borders, icons, expand/collapse) | ✅ Done (4 Apr) |
| Directional arrows on timeline | Blue outbound, emerald inbound arrows. Replaces text direction badges. | ✅ Done (4 Apr) |
| Sidebar restructured | Dashboard → Action Centre → Debtors → Disputes → Impact → Reports | ✅ Done (4 Apr) |
| Invoices page removed | Route redirects to /qollections/debtors. Invoices accessed via Debtor Detail. | ✅ Done (4 Apr) |
| Payment link placeholders removed | {{paymentLink}}/{{PORTAL_LINK}} removed — debtor portal deferred to MVP v2 | ✅ Done (4 Apr) |
| Riley drawer fix | modal={false} on Action Centre drawers so Riley z-[60] receives clicks | ✅ Done (4 Apr) |
| VIP 0-rows guard | VIP promote returns 404 for non-existent/wrong-tenant contacts | ✅ Done (4 Apr) |
| Dead code cleanup | Orphaned ageing analysis endpoint + component deleted | ✅ Done (4 Apr) |

### 5.8 Activity Feed + Real-Time Events (added 5 Apr)

| Task | Detail | Status |
|------|--------|--------|
| Activity Feed tab | Replaces Sent tab. Debtor-threaded view with coloured left borders, summary strip, pill filters, inline expand. Badge shows inbound count. | ✅ Done (5 Apr) |
| Activity Feed API | GET /api/action-centre/activity-feed queries timelineEvents + backfills from actions + inboundMessages, deduplicates | ✅ Done (5 Apr) |
| SSE real-time infrastructure | Tenant-scoped SSE service (realtimeEvents.ts) with 10 event types, 30s keep-alive, auto-cleanup | ✅ Done (5 Apr) |
| SSE client hook | useRealtimeEvents.ts — EventSource with auto-reconnect, per-event TanStack Query invalidation | ✅ Done (5 Apr) |
| Outbound timeline events | actionExecutor now creates timelineEvent for all successful sends (was missing) | ✅ Done (5 Apr) |
| Timeline event backfill | Activity Feed endpoint backfills from actions + inboundMessages tables for historical data | ✅ Done (5 Apr) |
| Tenant timezone fix | Time filter uses tenant timezone (Europe/London) instead of UTC midnight | ✅ Done (5 Apr) |
| Debtor detail Activity tab | Aligned with Action Centre Activity Feed design (timestamp column, clean narratives) | ✅ Done (5 Apr) |
| ActivityEventRow component | New shared component for consistent event rendering across feeds | ✅ Done (5 Apr) |

### 5.9 Decision Tree Engine (added 5 Apr)

| Task | Detail | Status |
|------|--------|--------|
| Deterministic decision tree | New decisionTree.ts (~530 lines). Pure function, zero DB queries, zero LLM calls. 9 gate checks, behavioural categorisation, DSO acceptance engine. | ✅ Done (5 Apr) |
| decisionAuditLog table | Full audit trail with outcome columns for future ML training | ✅ Done (5 Apr) |
| Feature flag | tenants.useDecisionTree (default false). Existing probabilistic path preserved as fallback. | ✅ Done (5 Apr) |
| Integration | Wired into actionPlanner.ts with input mapping from existing data structures | ✅ Done (5 Apr) |

### 5.10 SMS Nudge Model (added 5 Apr)

| Task | Detail | Status |
|------|--------|--------|
| SMS simplified to nudge | Outbound SMS now points debtors to check email only. No amounts, invoice numbers, links, or phone numbers. | ✅ Done (5 Apr) |
| Formal/legal exclusion | SMS excluded at formal/legal tone levels — those require written, detailed, auditable email | ✅ Done (5 Apr) |
| Inbound SMS/WhatsApp disabled | Webhooks return 200 immediately. Processing code preserved in block comments for re-enablement. | ✅ Done (5 Apr) |
| LLM prompt + templates updated | aiMessageGenerator system/user prompts + templateFallback SMS templates all generate nudge messages | ✅ Done (5 Apr) |
| SendSMSDialog UI | Updated with nudge templates and helper note | ✅ Done (5 Apr) |

### 5.11 Exceptions Enhancement (added 5 Apr)

| Task | Detail | Status |
|------|--------|--------|
| Exception state management | Workflow states: new → in_progress → resolved. Filter pills, state indicators, transition buttons. | ✅ Done (5 Apr) |
| Exception schema additions | 4 new columns: exceptionStatus, exceptionResolvedBy, exceptionResolvedAt, exceptionResolutionNotes | ✅ Done (5 Apr) |
| Exception summary landing | Dashboard with category cards (Collections, Debtor Situations, Other) showing counts + trends | ✅ Done (5 Apr) |
| Exception sub-tab APIs | POST /api/actions/:actionId/start-working, /reopen. Resolved items shown for 7 days. | ✅ Done (5 Apr) |

### 5.12 Bug Fixes (5 Apr)

| Task | Detail | Status |
|------|--------|--------|
| Inbound SMS timeline events | SMS/WhatsApp webhooks now create timeline events (was missing) | ✅ Done (5 Apr) |
| PTP overdue gate | intentAnalyst checks overdue status before PTP confirmation flow | ✅ Done (5 Apr) |
| Vonage webhook crash | rawPayload wrapped in clean object instead of raw req.body | ✅ Done (5 Apr) |
| SSE 401 fix | Clerk auth token passed to EventSource connection | ✅ Done (5 Apr) |
| DSO card formula | Aligned to standard formula matching trend chart | ✅ Done (5 Apr) |
| Activity Feed deduplication | By actionId and channel+contact+timestamp signature | ✅ Done (5 Apr) |
| SMS drawer contact picker | 6-source priority phone lookup + contact picker when multiple | ✅ Done (5 Apr) |

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

*Updated: 5 April 2026*

```
SPRINT 5 (Current):  Xero production hardening + Data Health + communication test mode
                     + collections pipeline hardening + two-phase model + Action Centre restructure
                     REMAINING: Xero redirect URI fix, old sync code removal, invoice dual-write,
                     token refresh, sync status API, sync banner, background sync mode, onboarding integration
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
