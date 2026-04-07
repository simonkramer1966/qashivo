# Qashivo — Claude Code Instructions

> **This file is a living document and Claude Code's persistent memory for Qashivo.**
> It must be updated at the end of every meaningful session. See SELF-UPDATE PROTOCOL below.

---

## SELF-UPDATE PROTOCOL

**After every session** where you make code changes, fix bugs, or learn something new about the codebase, update this file before ending:

1. **CURRENT STATE** — tick off completed items, update sprint progress, note what changed
2. **RECENT CHANGES LOG** — add a dated entry describing what was done
3. **KNOWN ISSUES** — add any bugs discovered, remove any fixed
4. **CODEBASE LEARNINGS** — add patterns, gotchas, or conventions discovered while working in the code
5. **ARCHITECTURE NOTES** — if you find how the system actually works differs from the spec, record the reality

**Before every session**, read this file first. It is more current than any spec document.

---

## Before Starting ANY Work
Read /docs/QASHIVO_CONTEXT.md completely. It is the canonical product specification (2,500+ lines, 19 sections). Do not skip it. Every development decision must align with this document.

## Strategy
- **Build-to-sell** to a UK bank. Every feature must prove value for acquisition.
- **REFACTOR** backend (keep existing RBAC, multi-tenant, partner, email, voice, timeline)
- **REWRITE** frontend (completely new UI per Section 8B of context doc)
- **REPLACE** auth (swap for production auth)
- Current phase: **MVP v1.1** — Riley AI Assistant, Data Health, Xero production hardening
- See Section 18 for existing codebase mapping
- See Section 19 for all development directives
- See Section 12 for MVP v1 scope
- See Section 8A for bank proof points
- See `docs/QASHIVO_CONTEXT_ADDENDUM_v4.2.md` Sections 20-23 for Riley, Data Health, onboarding, Xero architecture
- See `docs/MVP_V1.1_BUILD_SPEC.md` for Sprint 5-8 breakdown
- See `CHARLIE_ENGINEERING_SPEC.md` for Charlie decision engine hardening — 14 gaps, schema changes, template fallbacks, verification queries. This is the authoritative implementation brief for all Charlie improvements.
- See `DISPUTE_RESOLUTION_SPEC.md` (to be created) for statutory dispute workflow driven by UK "Time to Pay Up" legislation

## Critical Rules
1. Every communication is LLM-generated in the agent's persona voice. NO templates. If it reads like a template, it's wrong.
2. Compliance Agent (rule-based v1) gates ALL outbound communications before delivery.
3. Multi-tenant data isolation must be maintained — never leak data between tenants.
4. Default currency is GBP. UK-first market.
5. Open Banking payment data trains models. Accounting platform data does NOT. See Section 5A. This is a hard architectural boundary — Xero bank transaction data can be used for operational inference (matching payments to invoices) but NEVER for model training. See CHARLIE_ENGINEERING_SPEC.md Gap 14 for the two-source architecture.
6. The debtor must believe the agent is human.
7. AR overlay fields (arContactEmail, arContactPhone, arContactName, arNotes) are SACRED — never overwrite during any sync operation. This is Qashivo-owned data, a core stickiness factor, and a data asset for the bank buyer.
8. Make targeted edits, not full rebuilds, unless Simon explicitly asks for a rebuild.
9. Ask before deleting — if you think code is dead/unused, flag it rather than removing silently.
10. **Immediate UI Feedback** — Every user action must produce visible feedback within 200ms. No invisible states.
    - **Optimistic UI**: After approve/cancel/send, update the local cache immediately via `queryClient.setQueryData()` or `invalidateQueries()`. Do not wait for the next polling cycle.
    - **Button states**: Every mutation button must show a loading spinner (`isPending`) while the request is in flight and be disabled to prevent double-clicks.
    - **Cache invalidation**: Use `useInvalidateActionCentre()` (prefix `["/api/action-centre"]`) after any action-centre mutation. For cross-tab updates, emit an SSE event via `emitTenantEvent()`.
    - **Send Now means NOW**: When a user clicks "Send Now", execute the action immediately via `actionExecutor.executeActionsByIds()`. Never just update `scheduledFor` and wait for the executor polling cycle.
    - **SSE for every state change**: Every server-side state transition that affects the UI must emit an SSE event (`emitTenantEvent()` in `realtimeEvents.ts`). This includes: approval, cancellation, execution completion, inbound messages, payment detection.
    - **No invisible states**: If an item moves between tabs (e.g. Approval → Scheduled → Sent), both the source and destination tabs must update. The user must never wonder "where did that item go?"

## Outbound Communications Safety (CRITICAL)

All outbound communications (email, SMS, voice) MUST go through the central enforcement wrapper before reaching the wire:
- **Email**: `enforceCommunicationMode()` in `server/services/sendgrid.ts`
- **SMS**: mode check in `server/services/vonage.ts`
- **Voice (Retell)**: `sendVoiceCall()` in `server/services/communications/sendVoiceCall.ts`

Never call SendGrid, Vonage, or Retell APIs directly from routes, agents, or any new service. Always pass `tenantId` through to the wrapper.

The wrappers enforce Off / Testing / Soft Live / Live modes and **fail closed on errors** — if the DB is unreachable, sends are blocked rather than allowed through.

**Soft Live note:** No contact-level opt-in mechanism exists yet. Soft Live currently behaves identically to Testing mode until opt-in is built.

**Exceptions (no tenant context):** Investor demo endpoint (`/api/investor/voice-demo`) and MCP admin tools bypass mode enforcement — these are non-tenant-scoped and documented with safety comments.

**SMS channel (MVP):** SMS is a one-way nudge channel. Outbound only — points debtors to check their email. No amounts, invoice numbers, links, or phone numbers in SMS content. No inbound SMS processing (webhook returns 200 immediately, processing code preserved for re-enablement). SMS is NOT used at Formal or Legal tone levels — those require written, detailed, auditable email. Inbound SMS/WhatsApp processing code preserved but disabled. Re-enable when RCS or per-tenant numbers are available.

*Added: 22 March 2026 — post communication mode audit, Sprint 7. Voice wrapper added same date.*

---

## CURRENT STATE

<!-- UPDATE THIS SECTION EVERY SESSION -->

**Current sprint**: Sprint 5 — Xero production hardening + Data Health + Communication Test Mode

**Sprint 5 checklist**:
- [ ] Xero redirect URI fix (replace REPLIT_DOMAINS with APP_URL env var)
- [ ] Remove old syncContactsToDatabase code
- [ ] Fix invoice sync (write to BOTH cached_xero_invoices AND invoices table)
- [ ] Token refresh (offline_access, proactive refresh, 401 retry, mark expired on failure)
- [ ] Sync status API (GET /api/xero/sync-status)
- [ ] Sync banner on Debtors/Data Health pages (auto-refresh on completion)
- [ ] Background sync mode (4-hour, mode='ongoing', never overwrite AR overlay)
- [ ] Data Health API endpoint (GET /api/settings/data-health)
- [ ] Generic email detection (12 patterns: info@, accounts@, admin@, office@, finance@, hello@, enquiries@, contact@, billing@, sales@, support@, reception@)
- [ ] Data Health page UI (Settings > Data Health — summary cards, search, sortable table, inline editing)
- [ ] AR overlay inline editing (saves to arContactEmail/arContactPhone)
- [ ] Communication test mode settings UI (Off/Testing/Soft Live/Live radio)
- [ ] Communication test mode pipeline integration ([TEST] prefix, redirect to test addresses)
- [ ] Default new tenants to "testing" mode

**Upcoming sprints**:
- Sprint 6: Debtor Detail page + row navigation + three-dot menus
- Sprint 7: Riley AI Assistant (chat widget, conversations, intelligence extraction, onboarding)
- Sprint 8: Weekly CFO Review (Qashflow tab, review generation, proactive notifications)
- Charlie Hardening: ALL 14 gaps per CHARLIE_ENGINEERING_SPEC.md now implemented (Gaps 1-3, 5-14). Gap 14 Phase 2 (Open Banking confirmation + learning layer) deferred until TrueLayer/Yapily integration.

---

## RECENT CHANGES LOG

<!-- ADD NEW ENTRIES AT THE TOP — format: YYYY-MM-DD: What changed -->

- 2026-04-07: BUG FIX — "Yesterday collected" banner showing £6,230,470 against ~£170k total AR. Root cause in `/api/action-centre/yesterday-summary`: query filtered by `invoices.updatedAt` (bumped on every sync, so all 8,258 historical paid invoices appeared as "paid yesterday" after a sync run) and summed `invoices.amount` (gross total) instead of `amountPaid` (received). Fix: filter by `invoices.paidDate` (set from Xero `fullyPaidDate` by SyncOrchestrator) and sum `amountPaid`. Verified against Datum Creative Media — old query returned £6,230,469.62 (exact match to bug report), new query returns 0 yesterday and £76,041 across last 30 days against ~£170k AR. File: `server/routes/actionCentreRoutes.ts`. Caveat: 78 of 8,258 paid invoices have NULL `paidDate` (~1%) and won't be counted — minor data quality issue, acceptable for the banner.
- 2026-04-07: BUG FIX — Action Centre showing total outstanding instead of overdue/bundled amount. Mentzendorff row showed £32,277 (all 17 unpaid invoices) when only £11,137.40 was actually overdue and the action bundled a single £10,203.92 invoice. Two root causes fixed: (1) `actionCentreRoutes.ts` approvals query summed all unpaid invoices per contact via `contactInvoiceStats`. Now computes per-row `totalAmount` from `action.invoiceIds[]` (the bundle Charlie chose to chase), net of `amountPaid`. Account-wide outstanding still computed and exposed as `accountBalance` for context only. (2) `collectionsAgent.generateCollectionEmail` loaded ALL unpaid invoices for the LLM prompt regardless of which the action was chasing. New `actionInvoiceIds` parameter threaded from `collectionsPipeline.processCollectionEmail` (and regenerate-tone path) — when present, loads exactly those invoices; when absent (e.g. inbound reply path), defaults to overdue-only (`dueDate < now`). Renamed `loadOutstandingInvoices` → `loadChaseInvoices`. Bundle is the source of truth — Charlie does not chase payment of invoices that aren't yet due, and the email/UI never reference invoices outside the action bundle. Files: `server/services/actionPlanner.ts` (totalAmount net of amountPaid), `server/agents/collectionsAgent.ts`, `server/services/collectionsPipeline.ts`, `server/routes/actionCentreRoutes.ts`.
- 2026-04-07: Email drawer fixes — (1) Replaced native `<input type="checkbox">` with shadcn `Checkbox` component for visible/clickable invoice selection. (2) Added "Select overdue" button between "Select all" and "Deselect all", filters by `daysOverdue > 0`. (3) Fixed contact picker click bug — Popover-inside-Sheet pointer-event interception. Added `onInteractOutside={(e) => e.preventDefault()}` and `onOpenAutoFocus={(e) => e.preventDefault()}` to PopoverContent in `RecipientChipInput.tsx`. Files: `client/src/components/email/SendEmailDrawer.tsx`, `client/src/components/email/RecipientChipInput.tsx`.
- 2026-04-06: Sync Abstraction Layer — replaced monolithic Xero sync with platform-agnostic SyncOrchestrator + XeroAdapter (~1,980 lines). Provider-independent types, webhook router, adapter interface for QuickBooks/Sage. Files: server/sync/SyncOrchestrator.ts, server/sync/adapters/XeroAdapter.ts, server/sync/adapters/types.ts, server/sync/index.ts, server/sync/webhookRouter.ts.
- 2026-04-06: Xero sync hardening — (1) /Date()/ format crash fixed; (2) 401/403 retry with token refresh; (3) silent failure logging + test contact exclusion from AR; (4) dynamic webhook URL from APP_URL; (5) dead sync system removed + token mutex + stale data guard; (6) health check 403 treated as auth failure. Credit notes, overpayments, prepayments now populated. Initial sync date-filtered (open invoices any age + 24mo paid). Two-pass bounded fetch for force/reconciliation syncs. Database clearing script added (scripts/clear-sync-data.mjs).
- 2026-04-06: Collapsible sidebar with icon-only mode, persisted preference. Standardised filter-pill.tsx component across Activity, Approvals, Scheduled, Exceptions tabs. VIP restructured with navigation links + safety filters.
- 2026-04-06: Debtor detail enhancements — DebtorStatusBanner shows Charlie's phase/tone/next action/risk signals. Communication Preferences expanded to per-debtor channel controls (3×2 grid). Tab reorder. New customerTimelineService.ts for debtor-specific timeline queries. shared/types/timeline.ts for unified event types.
- 2026-04-06: Activity view polish — date leads in all views (time only for communications). Debtor activity tab deduplication of payment events + amount formatting with commas. Dashboard debtor list table removed (debtors via dedicated page).
- 2026-04-06: Immediate UI Feedback architecture rule added to CLAUDE.md (optimistic UI, button states, cache invalidation, SSE patterns).
- 2026-04-05: SMS simplified to one-way nudge channel for MVP. Outbound SMS now points debtors to check their email — no amounts, no invoice numbers, no links, no phone numbers. Inbound SMS/WhatsApp processing disabled (webhooks return 200 immediately, processing code preserved in block comments for re-enablement). LLM prompt + fallback templates + circuit breaker template fallbacks all updated to generate nudge messages. Decision tree excludes SMS at formal/legal tone levels — formal/legal communications require written, detailed, auditable email. If SMS is the only channel at formal/legal tone, an exception is created for manual review. SendSMSDialog UI updated with nudge templates and helper note. Files: webhooks.ts (SMS + WhatsApp handlers), aiMessageGenerator.ts (system/user prompts + default body), templateFallback.ts (SMS templates), decisionTree.ts (channel selection), SendSMSDialog.tsx (UI templates + note).
- 2026-04-05: FIX — Activity Feed shows "No activity yet" despite real activity. Three root causes: (1) `actionExecutor.ts` never created `timelineEvent` records for successful outbound sends — emails/SMS were delivered but invisible to the Activity Feed which only queries `timelineEvents`. Fix: new `createOutboundTimelineEvent()` method on ActionExecutor, called from both execution paths (`executeScheduledActions` and `executeActionsByIds`) after successful delivery. Creates timeline event with direction='outbound', correct channel, summary, preview, body, and actionId linkage. Non-fatal — delivery is never blocked by a failed timeline insert. (2) Historical actions and inbound messages had no timeline events — Activity Feed endpoint now also queries `actions` table (completed/sent/failed) and `inbound_messages` table as backfill, deduplicating against existing timeline events by actionId and channel+contact+timestamp signature. (3) Time filter used UTC midnight instead of tenant timezone — "today" at 11pm BST excluded the last hour of the business day. Fix: endpoint now reads `executionTimezone` from tenants table (default Europe/London) and computes midnight in the tenant's timezone using Intl.DateTimeFormat.
- 2026-04-05: Charlie Deterministic Decision Tree Engine implemented. New pure-function module `server/services/decisionTree.ts` (~530 lines) — zero DB queries, zero side effects, zero LLM calls. 9 sequential gate checks, behavioural categorisation (RELIABLE/COMMUNICATIVE/SILENT/UNKNOWN), phase/tone/channel/timing selection, DSO acceptance engine with partial payment calculation. Feature-flagged via `tenants.useDecisionTree` (default false). New `decisionAuditLog` table for full audit trail with outcome columns for future ML training. Integrated into `actionPlanner.ts` with input mapping from existing data structures. Existing probabilistic path preserved as fallback when flag is off.
- 2026-04-05: INVESTIGATION — Full Charlie decision engine architecture audit completed. Traced decision flow from "debtor has overdue invoice" to "email sent". Documented all decision functions (charlieDecisionEngine, actionPlanner, adaptive-scheduler, collectionsAgent, actionExecutor), 27+ gate checks across 4 layers (planning, execution, compliance, communications orchestrator), LLM boundary (content generation only — LLM never decides channel/tone/timing/whether to send), data dependencies (12+ tables), 3 independent DSO calculations (realised, snapshot, projected), and integration points for future deterministic decision tree. Key finding: LLM is cleanly isolated to content generation and intent classification — all strategic decisions are rule-based. Recommended insertion point for decisionTree.ts: replace `planAdaptiveAction()` in actionPlanner.ts, keep all downstream infrastructure (executor, compliance, delivery).
- 2026-04-05: FIX — Activity Feed shows "No activity yet" for inbound SMS. Root cause: SMS webhook stored messages in `inboundMessages` table but never created a `timelineEvent`. Activity Feed only queries `timelineEvents`. Fix: Added `db.insert(timelineEvents)` to SMS and WhatsApp webhook handlers (matching email handler pattern — channel, direction, summary, preview, body, provider='vonage').
- 2026-04-05: FIX — Payment promise (PTP) confirmation sent for non-overdue invoices. Debtor said "can't pay until June" on invoice not yet due — system sent "Payment Arrangement Confirmed" email. Root cause: intentAnalyst.ts had no overdue check before PTP confirmation flow. Fix: New `checkDebtorHasOverdueInvoices()` queries invoices where dueDate < now AND status NOT IN (PAID, VOIDED, DELETED, DRAFT). If not overdue: stores as early intelligence (`aiFact` with category='payment_behaviour', factKey='expected_payment_date', 90-day expiry) + note action; skips confirmation email and PTP record. If overdue: standard flow unchanged. Works across all channels (email, SMS, voice, WhatsApp). Charlie can reference early intelligence when invoice becomes overdue: "I understand you mentioned June — just confirming that's still the plan?"
- 2026-04-05: SSE infrastructure for real-time UI updates. New `server/services/realtimeEvents.ts` — tenant-scoped SSE service (addClient, emitTenantEvent, 30s keep-alive, auto-cleanup on disconnect). New `GET /api/events/stream` endpoint (behind isAuthenticated). Wired into: Vonage SMS webhook, SendGrid inbound email, action executor (both execution paths), event-bus hard bounces, Xero payment detection. Client: new `client/src/hooks/useRealtimeEvents.ts` — EventSource connection with auto-reconnect (3 retries, escalating delays), per-event-type TanStack Query invalidation map (10 event types → query key prefixes), smart debtor detail invalidation by contactId, graceful fallback to polling. Connected via `RealtimeEventsProvider` component in App.tsx authenticated routes.
- 2026-04-05: FIX — Vonage SMS webhook crash (TypeError in Drizzle insert). Root cause: `rawPayload: req.body` passed raw Express-parsed form-urlencoded body to Drizzle's jsonb serializer. Fix: Wrapped rawPayload in clean object with explicit fields (matching email handler pattern). Added `?? null` guards on nullable fields (to, providerMessageId). Same fix applied to WhatsApp webhook.
- 2026-04-05: Shared invalidation hook `useInvalidateActionCentre.ts` — invalidates all action-centre queries + VIP + approval-queue with single function call. Uses prefix matching on ["/api/action-centre"].
- 2026-04-05: Exception sub-tabs: state sections + filter pills. Exception items now have workflow states (new → in_progress → resolved) with filter pills (All | New | In Progress | Resolved), state indicators (CircleDot/Circle/Check), state transition buttons (Acknowledge, Mark resolved with notes, Dismiss, Reopen). Badge count only shows "new" items. Schema: 4 new columns on actions table (exceptionStatus, exceptionResolvedBy, exceptionResolvedAt, exceptionResolutionNotes). API: new endpoints POST /api/actions/:actionId/start-working, /reopen. Resolved items shown for 7 days.
- 2026-04-05: Exceptions tab summary landing. Main tab shows summary dashboard with category cards (Collections, Debtor Situations, Other) showing counts and trend indicators. Clicking a card navigates to the relevant sub-tab. Sub-tabs show detailed exception items with expand/collapse per item.
- 2026-04-05: SMS drawer fix — priority phone lookup + contact picker. Phone resolution now checks 6 sources in priority order: Primary AR SMS → Primary AR phone → AR overlay → main contact → escalation contact → other persons. Deduplication by number. Contact picker dropdown when multiple phones found, disabled Send when none.
- 2026-04-05: Activity Feed tab replaces Sent tab. Debtor-threaded view of all communications grouped by contact with coloured left borders (amber=needs attention, green=positive outcome, blue=awaiting response, red=dispute). Smart summary strip at top ("Today: 12 sent · 3 replies · 2 arrangements"). Pill filters for direction/channel/time range. Events expand inline to show full body. Badge count shows inbound items only. New API: `GET /api/action-centre/activity-feed` queries timelineEvents grouped by debtor with filtering. Tab order: Summary | Approval (N) | Scheduled (N) | Activity Feed (N) | VIP | Exceptions.
- 2026-04-04: Action Centre tab restructure + configurable send delay. Tabs renamed: Queue→Approval, Activity→Sent. New Scheduled tab shows approved-but-not-yet-sent actions (status=scheduled, sorted by scheduledFor ascending) with Cancel and Send Now buttons per row, plus preview sheet on row click. New API endpoints: `GET /api/action-centre/scheduled`, `POST /api/actions/:actionId/cancel`, `POST /api/actions/:actionId/send-now`. New `sendDelayMinutes` tenant setting (default 15, range 0-60) — after approval, actions wait N minutes in Scheduled before executor picks them up. When sendDelayMinutes=0, immediate delivery (no regression). `approveAndSend()` in collectionsPipeline.ts now sets status=scheduled + scheduledFor=NOW+delay instead of immediate delivery. Settings UI: "Send Delay After Approval" card with slider (0-60min, step 5). Tab order: Summary | Approval (N) | Scheduled (N) | Sent | VIP | Exceptions.
- 2026-04-04: Two-phase collection model implemented. Phase 1 (Inform): invoice is new or recently overdue — one polite nudge only, do NOT ask for payment date, do NOT chase silence. Phase 2 (Elicit Date): invoice is significantly overdue — actively seek a specific payment date, end with clear question. Transition controlled by `chaseDelayDays` tenant setting (default 5). Three new tenant columns: `chaseDelayDays`, `preDueDateDays` (default 7, courtesy reminder before due), `preDueDateMinAmount` (default £1000). Phase flows through `ActionContext.phase` into all LLM prompts (collectionEmail.ts, aiMessageGenerator.ts for email/SMS/voice). Single-touch enforcement: Phase 1 contacts with any prior completed action are skipped. Pre-due invoices included in adaptive query when `preDueDateDays > 0` and amount exceeds minimum. Conversation brief service includes COLLECTION PHASE section. Settings UI added to Autonomy & Rules page (Collection Timing card with sliders + amount input). All debtor-facing prompts include LANGUAGE RULE prohibiting "promise to pay"/"PTP" — use "payment arrangement", "confirmed payment date" instead. Compliance engine enforces this via DEBTOR_FACING_PROHIBITED patterns.
- 2026-04-04: CRITICAL FIX — ActionExecutor now runs compliance engine before delivery. New `runComplianceGate()` method checks email/SMS content through `complianceEngine.ts` (frequency caps, channel cooldowns, time-of-day, prohibited language, data isolation, vulnerability). Block → cancel action + timeline event. Queue_for_approval → revert to pending_approval for human review. Fail closed on compliance errors. Applied to both `executeScheduledActions()` and `executeActionsByIds()` paths. Voice calls skip content compliance (live calls). This was the last unguarded outbound path — all channels now pass through compliance before delivery.
- 2026-04-04: FIX — Email formatting. New `emailFormatter.ts` converts LLM plain text to clean HTML email: double newlines → `<p>`, single newlines → `<br>`, bullet lines → `<ul><li>`. Wrapped in professional 600px template (Arial, line-height 1.6, no Qashivo branding per Critical Rule 6). Applied to all 4 email paths: collectionsPipeline.ts, actionExecutor.ts, inboundReplyPipeline.ts, emailCommunications.ts. Existing HTML content detected and passed through (just wrapped in template). SMS and voice unaffected (plain text / spoken text).
- 2026-04-04: Sidebar restructured — Credit Control order is now Dashboard → Action Centre → Debtors → Disputes → Impact → Reports. Invoices page removed from navigation (invoices accessed via Debtor Detail page). Route /qollections/invoices redirects to /qollections/debtors. Page component file kept with deletion flag (30-day expiry).
- 2026-04-04: FIX — Approval pipeline: deleted shadowed old approve endpoint (set status to 'scheduled' for tomorrow without sending). Fixed bulk-approve and approve-all to call approveAndSend() for immediate delivery. Fixed collectionsScheduler not starting at boot (orchestrator had `void collectionsScheduler` instead of `.start()`).
- 2026-04-04: CRITICAL FIX — Two Retell voice paths bypassed communication mode enforcement. `collectionsRoutes.ts` "Make Call" handler now routes through `sendVoiceCall()` instead of calling `createUnifiedRetellCall()` directly. `retell-service.ts` `createCall()` now routes through `sendVoiceCall()` when `tenantId` is provided; logs warning and allows through for non-tenant demo paths. Only remaining direct `createUnifiedRetellCall()` callers are: `sendVoiceCall.ts` (the wrapper itself), investor demo endpoint, and public demo endpoint (both documented bypasses).
- 2026-04-04: Data Health now detects hard bounces. Batch query on timelineEvents for `email_hard_bounce` events, downgrades affected contacts to `needs_email`, adds `bounced` boolean per contact and `summary.bounced` count. Single grouped query, no N+1.
- 2026-04-04: Removed all `{{paymentLink}}`/`{{PORTAL_LINK}}` references from email pipeline. Debtor portal not built yet — placeholder was appearing unfilled in agent emails. Removed from: `defaultWorkflowSetup.ts` (4 templates + variables arrays), `aiMessageGenerator.ts` (MessageContext interface + prompt), `actionExecutor.ts` (context builder), `messagePreGenerator.ts` (context builder), `emailCommunications.ts` (EmailTemplateData + substitution + context builder). Docs updated to note deferral to MVP v2.
- 2026-04-04: Deleted orphaned ageing analysis code — `/api/analytics/aging-analysis` endpoint (dashboardRoutes.ts) and `aging-analysis.tsx` component were dead code (never imported/rendered). Live Dashboard uses `/api/qollections/summary` which has correct UK-standard ageing buckets.
- 2026-04-02: Gap 6 implemented — Cold start warm start + Debtor Intelligence Enrichment. Part A: `getOrCreateCustomerProfile()` in collectionLearningService.ts now inherits channel effectiveness priors from similar debtors (segment+size fallback chain: segment+size → segment → size → system defaults {email:0.6, sms:0.5, voice:0.4}). Requires 5+ mature profiles (confidence > 0.5) to form cohort priors, otherwise falls back. New profiles start at confidence 0.15-0.20 (inherited knowledge) instead of 0.1. Part B: New `debtorIntelligence` table with unique(tenantId, contactId) — stores Companies House data (status, SIC codes, age, size, filing health, late filings, registered address, insolvency risk), credit risk score (0-100), AI risk summary. New `server/services/companiesHouse.ts` — Companies House API integration (search + profile + filing history, rate limited, Basic auth). New `server/services/debtorEnrichmentService.ts` — orchestrates enrichment from Companies House → credit risk scoring → Claude AI risk summary → DB storage. Enrichment is non-blocking: fired after Xero contact sync (both main path and credit-only contacts). 90-day freshness check prevents re-enrichment of recently scored debtors. `enrichmentJob.ts` runs weekly for quarterly re-enrichment of debtors with outstanding balances. Credit risk score also written to contacts.riskScore for Charlie to read. Riley debtor context extended with company intelligence section. Requires `COMPANIES_HOUSE_API_KEY` env var (free, register at developer.company-information.service.gov.uk). Degrades gracefully if API key not configured. CCJ register and AI web search documented as future enrichment sources.
- 2026-04-02: Gap 13 implemented — Seasonal payment pattern integration. Three-phase approach: (1) Riley extraction prompt extended with detailed seasonal pattern examples (slow_month, fast_month, year_end_month) and onboarding question about seasonal payment behaviour. Facts stored in aiFacts with category='seasonal_pattern'. (2) `fitDistribution()` in paymentDistribution.ts extended with optional `seasonalAdjustments` parameter — applies mu shifts for current month: slow +0.15, fast -0.15, year_end -0.20. Seasonal shifts apply even to cold-start segment priors. (3) Learned patterns via `calculateLearnedSeasonalPatterns()` — requires 12+ months of payment data, identifies months deviating >20% from overall average. `getEffectiveSeasonalAdjustments()` merges Riley-captured and learned patterns (learned overrides Riley when learningConfidence > 0.7). All four callers of `fitDistribution()` updated: adaptive-scheduler.ts (via CustomerContext.seasonalAdjustments), actionPlanner.ts (fetches per-contact at loop start), weeklyReviewService.ts (fetches per-contact for all overdue), rileyAssistant.ts (includes seasonal note in debtor context).
- 2026-04-02: Gap 12 implemented — Lightweight debtor grouping. New `debtorGroups` table + `debtorGroupId` FK on contacts. Full CRUD API at `/api/debtor-groups` with member management endpoints (`POST /members`, `DELETE /members/:contactId`). Tone consistency enforcement: post-planning sweep in `actionPlanner.ts` queries same-day scheduled actions for grouped contacts, aligns all to highest tone level, cancels duplicates (keeps highest priority, cancels rest with `cancellationReason: 'debtor_group_same_day_conflict'`). Riley group suggestions via `detectPotentialGroups()` based on email domain matching (skips 14 generic providers). Group context injected into Riley's debtors list page context. Routes registered in `server/routes/debtorGroupRoutes.ts`. v2 deferred: cadence coordination across group, shared PTP/intelligence.
- 2026-04-02: Gap 7 implemented — P(Pay) log-normal distribution model. Replaces sigmoid-based P(Pay) estimate in adaptive-scheduler.ts with log-normal CDF fitted per debtor. New service `server/services/paymentDistribution.ts` with: `fitDistribution()` (mu from trend-adjusted median, sigma from p75/volatility), `estimatePaymentProbability()` (conditional CDF for time horizons), `getPaymentForecast()` (three-scenario quantiles: q25/q50/q75), `describeDistribution()` (Riley-friendly text), `forecastInvoicePayment()` (per-invoice date forecasts). Cold-start segment priors: small_business=40d, enterprise=50d, freelancer=30d. Trend shifts curve by TREND_WEIGHT=3 days per unit. Sigma clamped 0.1–1.5. Weekly CFO Review updated: `buildDebtorScenarios()` now uses distribution quantiles instead of hardcoded multipliers (was: optimistic=dueDate, expected=avg, pessimistic=1.5×avg). `fetchBehaviorSignalsForContacts()` bulk-fetches customerBehaviorSignals for all overdue contacts. Riley's `buildDebtorContext()` now includes payment pattern description and trend warnings. All existing modifiers (channel boost, amount penalty, weekday effect, PTP boost) and composite scoring formula preserved unchanged.
- 2026-04-02: Gap 3 implemented — Portfolio Controller per-debtor urgency weighting. Replaces flat tenant-level urgency with per-debtor weights based on contribution to overdue (normalised avg = 1.0) × trend multiplier (deteriorating 1.0–1.5, improving 0.5–1.0). `calculatePerDebtorUrgency()` in charlieDecisionEngine.ts runs nightly after `recomputeUrgency()`, writes to `customerLearningProfiles` (4 new columns: debtorUrgency, contributionWeight, trendMultiplier, urgencyUpdatedAt). Both actionPlanner.ts consumer paths (adaptive scheduling + daily plan) read per-debtor urgency from profile, falling back to flat tenant urgency if no profile exists. Small-balance improving debtors get near-zero urgency — no unfair pressure from large debtors dragging DSO.
- 2026-04-02: Gap 1 implemented — Feedback loop: three-tier effectiveness model + payment attribution + adaptive EMA. New service `channelEffectivenessService.ts` with: three-tier scoring (delivery 0.2, engagement 0.2, payment 0.6), payment attribution (same-day exclusion, 48h full credit, 7d partial credit, configurable), multi-channel attribution (0.3 credit to earlier channels), adaptive EMA (learning rate tied to confidence via Gap 6 formula), hard bounce override (bypass EMA → 0.1). Event bus `processEffectivenessUpdate()` triggers on delivery/engagement events to update customerLearningProfiles. Xero sync detects invoice PAID transitions and triggers `processPaymentAttribution()`. Three new tenant settings: paymentAttributionFullCreditHours, paymentAttributionPartialCreditDays, paymentAttributionSameDayExcluded. Exposed in settings API.
- 2026-04-02: Gap 11 implemented — Debtor channel preference hard overrides. Channel preferences already existed in `customerPreferences` table (emailEnabled, smsEnabled, voiceEnabled) with UI toggles in customer-detail.tsx, but Charlie never read them. Added `channelPreferenceSource` and `channelPreferenceNotes` columns to customerPreferences. Enforcement wired into `charlieDecisionEngine.ts` (applyChannelPreferenceOverride after selectChannel) and `actionPlanner.ts` (channelPrefs build + AI optimization safety check). Null/undefined defaults to enabled (backwards compatible). Fallback order: email → sms → voice. If all channels disabled, action is skipped and logged. UI auto-sets source to 'user_manual' on toggle change, displays source + notes below toggles. Riley extraction prompt updated to detect channel preferences from conversations ("don't call me", "email only", etc.) and write to customerPreferences with source='riley_conversation'.
- 2026-04-02: Gap 10 implemented — Pre-action 30-day statutory response window. `setLegalResponseWindowIfNeeded()` in actionExecutor.ts sets `legalResponseWindowEnd` on contacts after Legal tone actions complete. Gap 4 validation gate updated to block both active windows AND expired-but-unresolved windows (requires user to explicitly resolve via API). Daily `legalWindowJob.ts` creates day-25 expiry warnings and day-30 expired events with deduplication. `POST /api/contacts/:id/legal-window/resolve` endpoint (manager+ role) supports three resolution actions: resume_collections (clears window), refer_debt_recovery (keeps window, logs handoff), extend_window (new 30-day window). Xero sync auto-clears window when all invoices for a contact become settled.
- 2026-04-02: Gap 5 implemented — Tone escalation velocity cap + history tracking. Engine now reads agentToneLevel from last completed action and enforces ±1 step max per cycle. No-response escalation pressure (+1 after N consecutive unanswered contacts, default threshold 4). Significant payment override (≥50% of outstanding paid resets baseline to Professional, bypassing downward cap). Two new tenant settings: noResponseEscalationThreshold, significantPaymentThreshold. Three new helper functions: getLastSentAction, getConsecutiveNoResponseCount, checkSignificantPayment. ToneEscalationResult.signals extended with lastToneLevel, consecutiveNoResponseCount, velocityCapped.
- 2026-04-02: Gap 2 implemented — PRS Bayesian prior (k=3, prior=60) + recency weighting (90-day half-life decay). Added prsRaw and prsConfidence columns to customerLearningProfiles. Rolling windows now filter by evaluatedAt (resolution date) instead of createdAt. All behavioral flags use Bayesian-adjusted PRS. calculationVersion bumped to "2.0" on recalculation. Thin-data debtors regress toward tenant population mean (10+ scored debtors required) or system default of 60.
- 2026-04-02: Gap 8 implemented — Dead letter handling + delivery confirmation. Custom args (tenant_id, action_id, contact_id, invoice_id) now attached to all SendGrid outbound emails. Webhook receiver logs warnings for legacy emails without custom args. Event bus processDeliveryOutcome() updates action delivery status on delivered/bounce/dropped events. Hard bounces create timeline events for Data Health. Retry logic (max 2 retries, 5m/30m delay) in actionExecutor. Touch counting queries in actionPlanner and complianceEngine exclude failed deliveries. Schema: added voiceContactRecord (jsonb) to actions table.
- 2026-04-02: CHARLIE_ENGINEERING_SPEC.md v1.1 created — 14 gaps covering Charlie decision engine hardening. Full audit of tone escalation, PRS, delivery pipeline, P(Pay) model, portfolio controller, channel effectiveness, cold start. Identified SendGrid webhook pipeline non-functional (plumbing exists, nothing flows). Identified bank transaction sync not wired. Pre-action 30-day compliance gap found. New tables specified: debtorIntelligence, debtorGroups, probablePayments. New fields on actions, contacts, tenants tables. Template fallback messages for LLM circuit breaker. UK "Time to Pay Up" legislation (24 March 2026) factored in — separate DISPUTE_RESOLUTION_SPEC.md to be created.
- 2026-04-02: Gap 14 implemented — Unreconciled payment detection (Phase 1: Xero signal layer). New `probablePayments` table in schema. `probablePaymentService.ts` — matching algorithm with three confidence tiers (HIGH: exact amount + name/reference match or Xero contact match; MEDIUM: multi-invoice total match or ambiguous payer; LOW: amount-only match). HIGH/MEDIUM matches flag contacts via `probablePaymentDetected`/`probablePaymentConfidence`/`probablePaymentDetectedAt`, suspending all chasing. Bank transaction sync wired into `xeroSync.ts` `syncAllDataForTenant()` — fetches unreconciled RECEIVE transactions from last 90 days, stores in `bank_transactions` table (with auto-created bank accounts for FK), runs matching algorithm. Execution-time gate in `actionExecutor.ts` already checks probable payment flags (Gap 4). NEW: P(Pay) defensive check added — if CDF(days_overdue) > 60% for a debtor's payment distribution, action cancelled as `ppay_likely_paid_Npct`. Xero sync auto-clears probable payment flags when all invoices for a contact become paid. Resolution API: `POST /api/contacts/:id/probable-payment/resolve` (confirm/reject, manager+). `GET /api/contacts/:id/probable-payments` lists all matches. `expireStaleMatches()` expires 30-day-old pending matches. IMPORTANT: Xero bank transaction data is used for operational inference only — never feeds into learning models (API compliance). Phase 2 (Open Banking confirmation + learning layer) deferred until TrueLayer/Yapily integration.
- 2026-04-02: Gap 4 verified — Execution-time re-validation fully implemented. `validateActionBeforeExecution()` checks: legal response window (active + expired-unresolved), probable payment detection (HIGH/MEDIUM), P(Pay) defensive check (>60% CDF), invoice status changes (paid/void/disputed/on-hold), bundle modification (requires replan), minimum chase threshold (tenant configurable, default £50).
- 2026-04-02: Gap 9 verified — LLM circuit breaker + template fallback fully implemented. `llmCircuitBreaker.ts` (per-tenant CLOSED→OPEN→HALF_OPEN state machine, 3 failures in 30min opens circuit, 5min probe interval). `llmOutputValidator.ts` (length, debtor name, invoice refs, system prompt leakage, tone alignment). `templateFallback.ts` (10 templates: 5 email + 5 SMS across friendly/professional/firm/formal/legal tones). `aiMessageGenerator.ts` wires all three: circuit check → LLM with retry → output validation → template fallback after 4h. Voice NOT templated. Admin email notifications on circuit state changes.
- 2026-03-22: Added voice wrapper for Retell communication mode enforcement. Completed comms mode audit across all outbound channels.

---

## KNOWN ISSUES

<!-- ADD bugs when discovered (with date), REMOVE when fixed -->

- **Ageing analysis chart bug — RESOLVED**: Diagnosed as dead code. The buggy `/api/analytics/aging-analysis` endpoint and its `aging-analysis.tsx` component were orphaned (never imported/rendered). The live Dashboard uses `/api/qollections/summary` which has correct UK ageing buckets. Dead code deleted 4 April 2026.
- **Xero redirect URI**: Still references REPLIT_DOMAINS in xero.ts constructor — needs APP_URL. This is the last remaining Sprint 5.1 item.
- **Old sync code — FIXED (6 Apr)**: Dead sync system removed. Sync Abstraction Layer (SyncOrchestrator + XeroAdapter) replaces monolithic xeroSync.ts as the primary sync path.
- **Invoice sync — FIXED (6 Apr)**: SyncOrchestrator writes to both cached tables and main tables. Credit notes, overpayments, and prepayments now populated during sync.
- **SendGrid delivery webhooks — FIXED (Gap 8)**: Custom args now attached, webhook events flow through event bus to update action delivery status. Remaining limitation: connected email (Gmail/Outlook OAuth) path has no delivery tracking — no equivalent to SendGrid custom_args or webhooks. Also: `processed`, `unsubscribe`, `spamreport`, `group_unsubscribe`, `group_resubscribe` events are not handled (recorded in contactOutcomes but not in DELIVERY_EVENT_TYPES). Data Health endpoint does not yet query timeline events for hard bounce signals — the auto-flip creates the event but Data Health only checks static contact fields.
- **Tone escalation engine stateless — FIXED (Gap 5)**: Velocity cap (±1 step/cycle) reads agentToneLevel from last completed action. No-response escalation pressure after N consecutive unanswered contacts. Significant payment override resets baseline to Professional. Two new tenant settings: noResponseEscalationThreshold (default 4), significantPaymentThreshold (default 0.50).
- **PRS no sample size guard — FIXED (Gap 2)**: Bayesian prior (k=3) regresses thin-data debtors toward population mean or system default 60. 1 kept promise now scores ~70 (not 100). Recency weighting (90-day half-life) ensures recent behavior dominates. prsRaw and prsConfidence columns added for transparency.
- **No pre-action 30-day response window — FIXED (Gap 10)**: `setLegalResponseWindowIfNeeded()` sets `legalResponseWindowEnd` on contacts when a Legal tone action completes. Gap 4 validation gate blocks both active AND expired-unresolved windows. Daily `legalWindowJob` creates day-25 expiry warnings and day-30 expiry events (deduped). `POST /api/contacts/:id/legal-window/resolve` endpoint (manager+ role) supports `resume_collections`, `refer_debt_recovery`, and `extend_window`. Xero sync auto-clears window on full settlement.
- **Bank transactions now synced — FIXED (Gap 14)**: `syncBankTransactionsAndMatch()` in xeroSync.ts fetches unreconciled RECEIVE transactions from Xero (last 90 days), stores in bank_transactions table, runs probable payment matching. bankTransactionsCount now reflects actual synced count. Matching results stored in probablePayments table. Remaining: Phase 2 (Open Banking confirmation + learning layer) not yet built.
- **Data Health doesn't detect hard bounces — FIXED**: GET /api/settings/data-health now batch-queries timelineEvents for `email_hard_bounce` events (Gap 8). Contacts with a hard bounce are downgraded to `needs_email`, a `bounced` flag is included per contact, and `summary.bounced` count is added. Single grouped query — no N+1.
- **Circuit breaker admin SMS alerts — RESOLVED**: SMS path was already absent from `notifyAdmins()` — only a stale comment remained. Comment updated to clarify SMS is intentionally excluded until user phone numbers are collected. Email notifications work fine.
- **Inbound SMS invisible in Activity Feed — FIXED**: SMS webhook never created a `timelineEvent`. Activity Feed only queries that table. Fixed 5 April 2026 — SMS and WhatsApp webhooks now create timeline events matching the email handler pattern.
- **Activity Feed shows "No activity yet" — FIXED**: Three root causes: (1) actionExecutor never created timeline events for successful outbound sends, (2) historical actions/inbound messages had no timeline events (endpoint now backfills from actions + inboundMessages tables), (3) time filter used UTC instead of tenant timezone. All three fixed 5 April 2026.
- **PTP confirmation sent for non-overdue invoices — FIXED**: `intentAnalyst.ts` had no overdue check before sending "Payment Arrangement Confirmed" emails. Fixed 5 April 2026 — new `checkDebtorHasOverdueInvoices()` gates the PTP flow. Non-overdue signals stored as early intelligence (`aiFact`) instead.
- **Vonage SMS webhook crash — FIXED**: `rawPayload: req.body` passed raw form-urlencoded body to Drizzle jsonb serializer, causing `TypeError`. Fixed 5 April 2026 — wrapped in clean object with explicit fields.

---

## CODEBASE LEARNINGS

<!-- ADD to this section whenever you discover something non-obvious about the codebase -->

### Patterns discovered
- **Comms wrappers fail closed** — if DB is unreachable during mode check, sends are blocked not allowed. This is intentional.
- **Soft Live = Testing** until contact-level opt-in is built. No separate behaviour yet.
- **Investor demo bypasses mode enforcement** — `/api/investor/voice-demo` has no tenant context, documented with safety comments.

### Gotchas & traps
- **Replit remnants**: Old code may reference REPLIT_DOMAINS, Replit-specific env vars, or Replit file paths. Replace with APP_URL and Railway equivalents. All @replit packages have been removed.
- **Drizzle schema is large**: ~92 tables. When making schema changes, check for FK dependencies before adding/removing columns. Large schemas may need manual SQL via scripts to avoid drizzle-kit column type conflicts.
- **AI layer is thin**: The current AI integration (charlieDecisionEngine, charliePlaybook, intentAnalyst, actionPlanner) is acknowledged as too thin/bolted-on. Future architecture moves toward five distinct agents with shared state and orchestration.
- **Silent error swallowing pattern**: Multiple places in the codebase use catch blocks that silently discard errors (e.g., SendGrid webhook handler line 805 `if (!tenant_id) continue`). This caused the entire delivery event pipeline to fail silently. When debugging persistent issues, write diagnostic scripts before attempting fixes. Always add observability logging in catch blocks.
- **Connected email has no delivery tracking**: Gmail/Outlook OAuth path in ConnectedEmailService.ts sends email but has no webhook infrastructure, no custom_args equivalent, and no way to track delivery/bounce/open/click. All delivery tracking is SendGrid-only.
- **Data Health is static-field-only**: The `/api/settings/data-health` endpoint only checks contact fields (email populated, phone populated, generic email patterns). It does NOT query timelineEvents. Hard bounce timeline events from Gap 8 won't change Data Health readiness until the endpoint is extended.
- **Half-built pipelines**: A recurring pattern — infrastructure exists (tables, interfaces, service methods) but is never wired into the runtime flow. Confirmed cases: SendGrid delivery webhooks (custom args missing), bank transaction sync (API methods exist, never called), communicationOutcomeProcessor (exists, no subscribers). Before assuming a feature works, trace the data flow end-to-end.
- **Feedback loop pipeline (Gap 1)**: Delivery webhook → event-bus.ts `publishContactOutcome()` → `processDeliveryOutcome()` (updates action status, Gap 8) + `processEffectivenessUpdate()` (updates channel effectiveness scores, Gap 1). Payment: Xero sync detects `invoiceStatus` transition to PAID → `processPaymentAttribution()` in `channelEffectivenessService.ts` → calculates attribution window → updates effectiveness via adaptive EMA. Two scoring services exist: old `collectionLearningService.calculateEffectiveness()` (additive formula, manual API only) and new `channelEffectivenessService.calculateInteractionEffectiveness()` (three-tier weighted model, auto-triggered). The old service is NOT deprecated — it handles A/B testing and action optimization in `actionPlanner.ts`.
- **Channel preferences live in customerPreferences table, not contacts**: The `customerPreferences` table (separate from `contacts`) stores channel opt-outs (emailEnabled, smsEnabled, voiceEnabled), contact windows, and trading name. UI toggles in customer-detail.tsx save here via `PATCH /api/contacts/:contactId/preferences`. The `contacts` table has `preferredChannel` (varchar) on `customerLearningProfiles` but that's a different concept (learned preference vs hard override). Two channel selection paths exist: `charlieDecisionEngine.selectChannel()` and `actionPlanner` `channelPrefs` — both must enforce overrides.

- **Probable payment detection is per-sync**: `syncBankTransactionsAndMatch()` in xeroSync.ts runs after every invoice sync. It fetches unreconciled RECEIVE bank transactions, stores them, and runs matching. The execution-time gate in actionExecutor checks `probablePaymentDetected` flag + P(Pay) CDF > 0.60 defensive check. Resolution is via `POST /api/contacts/:id/probable-payment/resolve` (confirm/reject). Auto-cleared when all invoices become paid. Bank transaction data is Xero-API-compliant (inference only, no model training).

- **Debtor group enforcement is post-planning**: `enforceDebtorGroupConsistency()` in `actionPlanner.ts` runs AFTER all actions for a tenant are created via `proposeAction()`. It queries the DB for same-day scheduled actions belonging to grouped contacts, aligns tones (highest wins), and cancels duplicates. This means actions are briefly in the DB before being cleaned — if the planner crashes mid-sweep, some duplicate actions may remain scheduled. The sweep is fail-safe (non-fatal errors are caught and logged). `detectPotentialGroups()` in `debtorGroupRoutes.ts` is also used by Riley's debtors list context.

### SSE real-time events
- **SSE service is tenant-scoped**: `server/services/realtimeEvents.ts` maintains a Map of SSE clients keyed by connection ID, each tagged with tenantId. Events only broadcast to clients matching the tenant. 30-second keep-alive prevents proxy timeouts.
- **SSE endpoint**: `GET /api/events/stream` (behind `isAuthenticated` in `server/routes.ts`). Client connects via `EventSource` in `useRealtimeEvents()` hook.
- **10 event types**: `inbound_sms`, `inbound_email`, `action_completed`, `payment_received`, `ptp_created`, `dispute_detected`, `exception_created`, `delivery_bounce`, `approval_needed`, `sync_complete`. Each maps to specific TanStack Query key prefixes for invalidation.
- **WebSocket service exists but is DISABLED**: `server/services/websocketService.ts` has `WEBSOCKET_DISABLED = true`. SSE replaces it for push notifications. The broadcast methods in WebSocket service document the event types needed.
- **Emission points**: Vonage SMS webhook, SendGrid inbound email, actionExecutor (both execution paths), event-bus (hard bounces), xeroSync (payment detection). New emission points should call `emitTenantEvent()` from `realtimeEvents.ts`.

### Timeline events and Activity Feed
- **actionExecutor was not creating timeline events**: The `sendEmailAction()`, `sendSMSAction()`, and `initiateVoiceCall()` methods in actionExecutor.ts wrote to `emailMessages` and updated action status, but never created a `timelineEvent`. The Activity Feed only queries `timelineEvents`. Fixed: new `createOutboundTimelineEvent()` method in both execution paths.
- **Activity Feed now backfills from actions + inboundMessages**: The endpoint at `GET /api/action-centre/activity-feed` queries `timelineEvents` first, then fills gaps from `actions` (outbound) and `inbound_messages` (inbound), deduplicating by actionId and channel+contact+timestamp. This means historical data shows up immediately without a migration.
- **Time filter must use tenant timezone**: The endpoint defaults to "today" which must mean midnight in the tenant's timezone (Europe/London), not UTC. A 1-hour offset during BST can exclude recent activity.

### Inbound message pipeline gaps
- **SMS/WhatsApp webhooks were missing timeline events**: The email inbound path creates a `timelineEvent` (webhooks.ts ~line 2233) but SMS and WhatsApp did not. Activity Feed only queries `timelineEvents` table, so inbound SMS was invisible. Fixed 5 April 2026 — both now create timeline events matching the email pattern.
- **Vonage SMS sends form-urlencoded data**: `req.body` from Vonage is form-urlencoded, not JSON. Passing `req.body` directly to Drizzle's jsonb column can crash with `TypeError: Cannot read properties of null (reading 'constructor')`. Always wrap `rawPayload` in a clean plain object with explicit fields (matching the email handler pattern).
- **Intent extraction runs on all channels**: `intentAnalyst.processInboundMessage()` is called from SMS, WhatsApp, email, and voice webhook handlers. But the confirmation email flow and clarification flow (lines 399-486 in intentAnalyst.ts) are gated to email channel only. SMS/voice PTP detections create actions and outcomes but don't send clarification emails.

### PTP (Promise to Pay) pipeline
- **No overdue check existed before 5 April 2026**: The PTP flow (confirmation email, promise record, forecast adjustment) fired regardless of whether the debtor had overdue invoices. A debtor saying "can't pay until June" on a not-yet-due invoice would get a "Payment Arrangement Confirmed" email.
- **Early intelligence flow**: When a PTP is detected for a debtor with no overdue invoices, it's stored as an `aiFact` (category='payment_behaviour', factKey='expected_payment_date') with 90-day expiry. Charlie can reference this when the invoice becomes overdue. No confirmation email, no PTP record, no forecast adjustment.
- **Overdue check is at method level, not query level**: `checkDebtorHasOverdueInvoices()` in intentAnalyst.ts queries ALL invoices for the contact (not just the linked invoice) to determine overdue status. This handles SMS messages that arrive without a specific invoiceId linkage.

### Charlie decision engine (from full audit)
- **Consolidation is sound**: actionPlanner.ts (lines 618-898) correctly filters invoices individually before bundling. Only invoices that pass exclusion checks enter consolidated actions.
- **agentToneLevel already stored**: actions table has agentToneLevel (varchar) at line 806 of schema.ts. The tone engine writes it but never reads it back.
- **Channel effectiveness scores now update — FIXED (Gap 1)**: `channelEffectivenessService.ts` updates customerLearningProfiles via adaptive EMA on delivery events (event-bus.ts `processEffectivenessUpdate`) and payment attribution (xeroSync.ts detects PAID transitions). Three-tier model: delivery 0.2, engagement 0.2, payment 0.6. Hard bounce → immediate 0.1 drop. `communicationOutcomeProcessor` is still not wired — it's been superseded by the new service for effectiveness scoring. The old `collectionLearningService.calculateEffectiveness()` formula still exists but is only used via the manual API endpoint.
- **P(Pay) uses log-normal distribution — FIXED (Gap 7)**: adaptive-scheduler.ts `estimateProbabilityOfPayment()` now uses a log-normal CDF via `paymentDistribution.ts`. Incorporates all 4 history signals: medianDaysToPay (mu), p75DaysToPay (sigma), volatility (sigma fallback), trend (mu shift). Additive modifiers (channel reply rates, weekday effect, PTP boost, amount penalty) preserved on top. Cold-start uses segment-specific log-normal priors instead of flat probabilities. The `amountSensitivity` per-debtor field is still NOT integrated — generic log10 penalty stays. Per-debtor amount sensitivity parked for v2.
- **Portfolio urgency now per-debtor — FIXED (Gap 3)**: `calculatePerDebtorUrgency()` in charlieDecisionEngine.ts calculates per-debtor urgency = baseUrgency × contributionWeight × trendMultiplier, stored in `customerLearningProfiles`. Both actionPlanner paths read `debtorUrgency` from profile, falling back to flat tenant urgency if null. The base urgency (tenant-level DSO vs target) still adjusts ±0.1 per nightly cycle in `schedulerState.urgencyFactor` and `workflows.adaptiveSettings.urgencyFactor`.
- **Xero API training prohibition**: March 2026 developer terms prohibit using Xero API data for AI/ML training. Architecture must position AI as inference on customer-owned data. Open Banking data (via TrueLayer/Yapily) has no such restriction — all model training should use Open Banking data.

### Sync conventions
- **Sync Abstraction Layer (6 Apr)**: New `server/sync/` directory contains the platform-agnostic sync system. `SyncOrchestrator` manages sync lifecycle, `XeroAdapter` implements the provider interface. Types in `server/sync/adapters/types.ts`. Webhook router in `server/sync/webhookRouter.ts`. The old monolithic `xeroSync.ts` is being phased out — new code should use the abstraction layer.
- **Invoice-first sync**: Fetch invoices from Xero → extract contacts from invoice data → batch-fetch contact details. Both the old xeroSync.ts and new XeroAdapter follow this pattern.
- **Two sync modes**: INITIAL (clean sweep + fresh insert) for first connection. ONGOING (upsert by xeroInvoiceId/xeroContactId, never delete) for scheduled background syncs.
- **Initial sync date filter**: Open invoices (any age) + 24 months of paid history. Reduces volume on large books.
- **Two-pass bounded fetch**: Force and reconciliation syncs use two passes — first open invoices, then recent paid — to prevent timeout.
- **Rate limiting**: 1.5 second delay between paginated Xero API calls, 60 second wait on 429.
- **Token refresh**: Proactive (check expiry with 2-min buffer before API calls) + reactive (401/403 retry once). Failed refresh → mark connection "expired", prompt user to reconnect. 403 is now treated as auth failure (not just 401).
- **Xero date format gotcha**: Xero returns dates in `/Date(timestamp+offset)/` format. Must parse before DB insert or Drizzle will crash.

### Design system
- **shadcn/ui**: zinc neutral palette, semantic tokens, minimal borders, near-black primary actions.
- This is a financial product — no rainbow dashboards, no playful UI.
- Wouter for routing, TanStack Query v5 for data fetching.

---

## Commands
```bash
npm run dev        # Start dev server (tsx, port 5000)
npm run build      # Vite client build + esbuild server bundle → dist/
npm run start      # NODE_ENV=production node dist/index.js
npm run check      # TypeScript type checking (tsc --noEmit)
npm run db:push    # Drizzle Kit: push schema changes to PostgreSQL
```

## Architecture

### Stack
- **Frontend**: React 18 + TypeScript, Vite, Wouter (routing), TanStack Query v5, Shadcn/ui (Radix + Tailwind) — BEING REWRITTEN
- **Backend**: Express.js (TypeScript ESM, transpiled by tsx in dev, esbuild in prod)
- **Database**: PostgreSQL (Neon serverless), Drizzle ORM
- **Auth**: Passport local strategy — BEING REPLACED. Sessions stored in PostgreSQL.
- **AI**: Migrating from OpenAI to Anthropic Claude API for all agents
- **Email**: SendGrid (transactional + inbound parsing)
- **SMS**: Vonage
- **Voice**: Retell AI
- **Billing**: Stripe
- **Hosting**: Railway (project: `impartial-quietude`) → `https://qashivo-production.up.railway.app`
- **File storage**: Cloudflare R2 (planned)

### Directory Layout
- `client/src/` — React app (BEING REWRITTEN). Pages in `pages/`, components in `components/`, Shadcn primitives in `components/ui/`
- `server/` — Express backend (REFACTORING — keep infrastructure, add agent layers)
  - `index.ts` — Entry point, middleware setup
  - `routes.ts` — Root router, imports feature route modules from `routes/`
  - `routes/` — Feature route modules (~17 files)
  - `services/` — Business logic (~74 services). Key: `charlieDecisionEngine.ts` (AI agent — evolving to LLM-powered), `xeroSync.ts`, `openai.ts` (replacing with Anthropic)
  - `services/sendgrid.ts` — Email delivery with `enforceCommunicationMode()` wrapper
  - `services/vonage.ts` — SMS with communication mode check
  - `services/communications/sendVoiceCall.ts` — Voice with mode enforcement
  - `middleware/` — Auth, RBAC (`rbac.ts`), provider abstraction
  - `startup/orchestrator.ts` — Bootstrap sequence
  - `storage.ts` — `IStorage` interface (data access layer), implemented by `DatabaseStorage`
  - `auth.ts` — Passport local strategy, session config (BEING REPLACED)
  - `agents/` — AI agent implementations (collectionsAgent, rileyAssistant)
  - `agents/prompts/` — Prompt assembly functions per action type
  - `services/compliance/` — Compliance engine (rule-based v1)
  - `services/llm/claude.ts` — Claude API abstraction (generateText(), generateJSON())
  - `sync/` — Sync Abstraction Layer (added 6 Apr). Platform-agnostic sync system.
    - `SyncOrchestrator.ts` — sync lifecycle management
    - `adapters/XeroAdapter.ts` — Xero-specific sync implementation
    - `adapters/types.ts` — provider-independent types
    - `webhookRouter.ts` — webhook routing by provider
    - `index.ts` — public API
- `shared/` — Code shared by client and server
  - `schema.ts` — Single source of truth: ~92 Drizzle tables, Zod validation schemas, TypeScript types
  - `types/` — shared type definitions (includes `timeline.ts` for unified event types)
  - `utils/`, `forecast.ts`, `currencies.ts`
- `migrations/` — Drizzle-generated SQL migrations
- `docs/` — Feature & architecture documentation + QASHIVO_CONTEXT.md

### Path Aliases (tsconfig.json)
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

## Key Patterns (Existing — Maintain These)

### Multi-Tenancy
Every main table has a `tenantId` FK. Always include `tenantId` in queries. The RBAC middleware sets `req.rbac.tenantId`.

### RBAC
Six tiers: Owner > Admin > Accountant/Partner > Manager > Credit Controller > Read Only. Use middleware factories:
- `withRBACContext` — loads user, tenant, permissions onto `req.rbac`
- `withPermission('invoices:edit')` — checks specific permission
- `withMinimumRole('manager')` — checks role hierarchy

### Data Access
Use the `storage` singleton (from `server/storage.ts`), not raw `db` queries in routes. ~200 async methods.

### Provider Abstraction
Accounting providers (Xero, QuickBooks, Sage) registered at startup via `ProviderRegistry`. Communication: SendGrid (email), Vonage (SMS), Retell AI (voice).

### Integrations Page
- Route: `/settings/integrations` — 4-tab layout (Accounting, Email, Banking, Communications)
- Accounting providers: `/api/providers/status` → `server/routes/integrationRoutes.ts`
- Email connection: `/api/email-connection/*` → `server/routes/emailConnectionRoutes.ts`
- Communications status: `/api/integrations/communications/status` → `server/routes/integrationRoutes.ts`
- OAuth callbacks redirect to `/settings/integrations?email_connected=true` (or `?error=...`)
- Email OAuth tokens stored on `tenants` table, accounting provider tokens on `providerConnections` table
- See `docs/OAUTH_SETUP.md` for Google, Microsoft, and Xero OAuth setup instructions

### Data Integrity
All AR summary figures (outstanding, overdue, DSO, debtor count) must use `getARSummary()` in `server/services/arCalculations.ts`. Never write inline SUM queries for these figures in route handlers. The correct calculation including credit note and overpayment netting lives in one place only. Invoice status filter: excludes `paid, void, voided, deleted, draft`.

### Background Jobs
Started from `server/startup/orchestrator.ts`. All fire-and-forget async calls must have `.catch()` handlers.

## Database
- **ORM**: Drizzle with PostgreSQL dialect. Schema in `shared/schema.ts`.
- **Primary keys**: UUIDs via `gen_random_uuid()`
- **Migrations**: `npm run db:push` (Drizzle Kit push)
- **Adding a table**: Define in `shared/schema.ts` → add relations → create Zod insert schema → run `db:push` → add storage methods in `storage.ts`

### Key Schema Tables
- `invoices` — main invoice data, joined everywhere
- `contacts` — debtor/customer records with AR overlay fields
- `cached_xero_invoices` — raw Xero data for reference
- `aiFacts` — business intelligence extracted by Riley (extended in Sprint 7: category, entityType, entityId, factKey, confidence, source, sourceConversationId, expiresAt, isActive)
- `tenants` — multi-tenant root, includes settings (extended: rileyReviewDay/Time/Timezone)
- `agentPersonas` — AI persona config per tenant
- `complianceChecks` — audit log of compliance checks on agent content
- `rileyConversations` — conversation history between Riley and users (Sprint 7)
- `forecastUserAdjustments` — cashflow inputs from Riley conversations (Sprint 7)
- `weeklyReviews` — generated CFO review content (Sprint 8)
- `debtorIntelligence` — Companies House enrichment + credit risk scoring per debtor (Gap 6). Unique on (tenantId, contactId). Sources: Companies House API, AI risk summary. Future: CCJ register, web search
- `debtorGroups` — linked debtor entities sharing AP department or ownership (Charlie spec Gap 12)
- `probablePayments` — unreconciled bank transaction matches against outstanding invoices (Charlie spec Gap 14)

## Important Conventions
- TypeScript ESM throughout — no CommonJS `require()`
- Sanitize responses: use `stripSensitiveFields()` before returning user/tenant data
- The `unhandledRejection` handler logs but does not exit — background task failures must not crash the server
- Vite dev server integration is in `server/vite.ts` — do not modify
- Use `APP_URL` env var for any URL that needs to reference the production domain

---

## ARCHITECTURE NOTES

<!-- Record how things ACTUALLY work vs how specs say they should -->

### Data flow (Xero sync)
```
Two paths exist (transitioning from old → new):

OLD (xeroSync.ts — being phased out):
  Xero API → cached tables + main tables → AR overlay preserved → scoring

NEW (server/sync/ — Sync Abstraction Layer, 6 Apr):
  SyncOrchestrator → XeroAdapter → Xero API
    ↓ (invoice-first, date-filtered, two-pass bounded fetch)
  cached_xero_invoices + cached_xero_credit_notes + cached_xero_overpayments
    + invoices table + contacts table
    ↓
  AR overlay fields preserved (NEVER overwritten)
    ↓
  Credit notes, overpayments, prepayments populated
    ↓
  Data Health assessment recalculated
    ↓
  Debtor scoring / enrichment queued
```

### Core pipeline: LLM Email Generation → Delivery
```
Scheduler trigger (existing schedulerState/collectionSchedules)
  → Context assembly (debtor profile, invoices, conversation history)
  → LLM generation (collectionsAgent.ts → Claude API via llm/claude.ts)
  → Compliance check (compliance/complianceEngine.ts)
  → IF Semi-Auto: insert to messageDrafts as pending_approval → user approves
  → IF Full Auto: promote directly to actions table
  → Email delivery (SendGrid via enforceCommunicationMode wrapper)
  → Logging (timelineEvents + complianceChecks + action status update)
```

### Core pipeline: Inbound Email → Agent Response
```
SendGrid inbound webhook (/api/webhooks/sendgrid/inbound)
  → Match to debtor via replyToken or email address
  → Intent extraction via Claude (intentAnalyst)
  → Signal creation (customerBehaviorSignals + contactOutcomes)
  → Agent generates contextual reply (same LLM pipeline)
  → Compliance check → approval flow → delivery via wrapper
  → Threading maintained via In-Reply-To/References (emailMessages)
```

### Two-phase collection model
```
Phase 1 (Inform) — daysOverdue ≤ chaseDelayDays (default 5)
  → One polite nudge only. Do NOT ask for payment date.
  → Do NOT follow up on silence. Single-touch enforcement.
  → Pre-due reminders: preDueDateDays before due date, invoices > preDueDateMinAmount.

Phase 2 (Elicit Date) — daysOverdue > chaseDelayDays
  → Actively seek a specific payment date.
  → End emails with clear question the debtor can answer in one sentence.
  → Normal escalation ladder applies (follow_up → escalation → final_notice).

Phase flows via ActionContext.phase → LLM prompts (collectionEmail, aiMessageGenerator).
Tenant settings: chaseDelayDays, preDueDateDays, preDueDateMinAmount.
UI: Settings > Autonomy & Rules > Collection Timing card.
```

### Real-time events (SSE)
```
Server: realtimeEvents.ts
  → addClient(tenantId, res) — registers SSE connection
  → emitTenantEvent(tenantId, type, data) — broadcasts to tenant's clients
  → 30s keep-alive, auto-cleanup on disconnect

Emission points:
  webhooks.ts (SMS/email inbound) → inbound_sms / inbound_email
  actionExecutor.ts (delivery) → action_completed
  event-bus.ts (bounces) → delivery_bounce
  xeroSync.ts (PAID detection) → payment_received

Client: useRealtimeEvents.ts hook
  → EventSource to /api/events/stream
  → Per-event-type TanStack Query invalidation
  → 3 retries with escalating delays (1s, 3s, 10s)
  → Falls back to polling (refetchInterval) after max retries
```

### Charlie decision architecture (from 5 April 2026 audit)
```
Two-phase pipeline orchestrated by collectionsScheduler.ts:

PLANNING (hourly):
  actionPlanner.planActionsForAllTenants()
    → for each tenant with collectionsAutomationEnabled=true:
      → planActionsForTenant(tenantId)
        → Query overdue invoices (JOIN contacts, schedules, assignments)
        → for each invoice:
          → planAdaptiveAction() → adaptive-scheduler.scheduleNextTouch()
            → Scores all (channel × time horizon) combos
            → Composite: α·pPay − β·friction − γ·risk + δ·urgency
        → Bundle multi-invoice actions by contact
        → Create actions via batchProcessor.proposeAction()
        → enforceDebtorGroupConsistency() (post-sweep)

EXECUTION (every 10 minutes):
  actionExecutor.executeScheduledActions()
    → validateActionBeforeExecution() — 6 Gap 4 gates
    → runComplianceGate() — content compliance
    → executeAction() → sendEmail/SMS/Voice
    → enforceCommunicationMode() — final safety gate

LLM BOUNDARY (strict separation):
  Rules decide: WHETHER, WHICH channel, WHAT tone, WHEN, WHO
  LLM generates: email/SMS/voice CONTENT only
  LLM classifies: inbound intent (12 types, confidence gated)
  LLM never decides channel, tone, timing, or whether to send

DECISION TREE INSERTION POINT (future):
  Replace planAdaptiveAction() + scheduleNextTouch() with
  decisionTree.evaluate(debtor, invoices, tenant, history)
  Keep all downstream: executor, compliance, delivery, mode enforcement
```

### Agent architecture (current vs planned)
**Current**: Single Collections Agent with LLM email generation, compliance checking, approval queue, intent extraction, tone escalation. AI layer is thin — essentially prompt-and-respond.

**Planned (MVP v2+)**: Five distinct agents — Collections, Risk Assessment, Cashflow Forecasting, Dispute Resolution, Working Capital Optimization. Shared state, tool registries, inter-agent orchestration via Orchestrator. May need architectural evolution away from monolith for long-running agent workloads.

### Key services being evolved
```
charlieDecisionEngine.ts  → scheduling/trigger layer for collectionsAgent.ts
openai.ts                 → replaced by server/services/llm/claude.ts
intentAnalyst.ts          → rewired to use Claude via server/services/llm/claude.ts
auth.ts                   → replaced by production auth (Clerk or Supabase)
```

---

## MVP v1 Build Plan

Read `docs/MVP_V1_BUILD_SPEC.md` for full sprint breakdown with schema changes, pipeline architecture, and build order.

### Sprint Sequence

| Sprint | Weeks | Focus | Key Deliverable |
|--------|-------|-------|-----------------|
| 0 | 1 | Foundation | Auth replaced, OpenAI→Claude, BullMQ added, frontend shell scaffolded |
| 1 | 2–3 | First LLM Email | Agent persona config, LLM email generation, compliance engine, inbound email→agent |
| 2 | 4–6 | Autonomy + Onboarding | Approval queue UI, debtor portal persona, onboarding flow, Open Banking connection |
| 3 | 7–9 | Dashboard + Reporting | Qollections dashboard rebuild, DSO tracking, default strategies, agent activity log |
| 4 | 10–12 | Intelligence + Polish | Claude intent extraction, tone escalation engine, E2E testing, metrics |

### What Does NOT Ship in MVP v1
SMS, voice calls, Bayesian forecasting, Qashflow dashboard, Qapital, payment plan negotiation by agent, chat widget, cross-debtor learning, partner portal. See Section 12 of context doc.

---

## MVP v1.1 Build Plan

Read `docs/MVP_V1.1_BUILD_SPEC.md` for full sprint breakdown. Read `docs/QASHIVO_CONTEXT_ADDENDUM_v4.2.md` for Riley architecture (Sections 20-23).

### Sprint Sequence (v1.1)

| Sprint | Focus | Key Deliverable |
|--------|-------|-----------------|
| 5 | Xero Production + Data Health | Reliable sync, token refresh, data health page, communication test mode |
| 6 | Debtor Detail Page | Full debtor record, multi-contact, row click navigation |
| 7 | Riley AI Assistant | Chat widget, conversations, intelligence extraction, onboarding mode |
| 8 | Weekly CFO Review | Qashflow tab, review generation, proactive notifications |

### Riley AI Assistant (Sprint 7)

Riley is Qashivo's always-available AI assistant — the intelligence layer across all three pillars. She serves as onboarding guide, business intelligence gatherer, virtual CFO, system help, and action taker.

**Key tables:** rileyConversations, forecastUserAdjustments, aiFacts (extended), tenants (rileyReviewDay/Time/Timezone)

**Key service:** `server/agents/rileyAssistant.ts` — prompt assembly, context building, response generation, intelligence extraction

**Riley does NOT use templates.** Every response is LLM-generated with full business context.

---

## Environment Variables

| Variable | Purpose | Status |
|----------|---------|--------|
| APP_URL | Production domain for Xero redirect URI etc. | Required |
| DATABASE_URL | Neon PostgreSQL connection string | Active |
| OPENAI_API_KEY | GPT-4/5 for agent LLM calls | Active (migrating to Anthropic) |
| ANTHROPIC_API_KEY | Claude API for agents | Planned |
| XERO_CLIENT_ID | Xero OAuth app ID | Active |
| XERO_CLIENT_SECRET | Xero OAuth secret | Active |
| STRIPE_SECRET_KEY | Stripe payments | Active |
| SENDGRID_API_KEY | Email sending | Active |
| VONAGE_API_KEY | SMS/voice | Active |
| RETELL_API_KEY | Voice AI | Active |
| REDIS_URL | BullMQ job queue | Planned |
| TRUELAYER_CLIENT_ID | Open Banking (read-only v1) | Planned |
| TRUELAYER_CLIENT_SECRET | Open Banking | Planned |
| COMPANIES_HOUSE_API_KEY | Companies House API (free, Gap 6 enrichment) | Planned |

## Deployment

- **Platform**: Railway — auto-deploys from GitHub `main` branch on push
- **No Replit dependencies** — all @replit packages removed, no .replit or replit.md files
- **Build**: `npm run build` (Vite client + esbuild server → `dist/`)
- **Start**: `NODE_ENV=production node dist/index.js`
- **Logs**: Railway dashboard → service → Deployments → logs
- **DB**: Neon serverless PostgreSQL (connection via `DATABASE_URL`)
- **DB migrations**: Use `npm run db:push` (Drizzle Kit). For large schemas, may need manual SQL via scripts to avoid drizzle-kit column type conflicts.
- **GitHub**: `simonkramer1966`
- **Local codebase**: `~/Documents/qashivo`
