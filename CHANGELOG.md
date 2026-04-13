# QASHIVO — CHANGE LOG

**Purpose:** Auditable record of all code changes to the Qashivo platform
**Format:** Reverse chronological (newest first)
**Maintained by:** Documentation Coworker (Claude Cowork)

---

## [2026-04-12] — UI Refresh: q- design token system, navigation restructure, data table overhaul

**Sprint:** Post-Sprint 5 (UI refresh + navigation consolidation)
**Scope:** Frontend (also: Navigation, Action Centre, Debtor Detail, Bridge/Facility, Settings)

| Change | From | To |
|--------|------|-----|
| 🆕 q- design token system | No design tokens — inline Tailwind + ad-hoc colours | `tokens.css` with warm gray palette, semantic tokens (`--q-bg-page`, `--q-bg-surface`, `--q-text-*`), shared `QMetricCard` component |
| UI Refresh Phase 1-2 | Inconsistent component styling | Token system installed + shared q-token components (QMetricCard etc.) |
| UI Refresh Phase 3a | Dashboard with default Tailwind | Dashboard restyled with q- design tokens |
| UI Refresh Phase 3b | Debtors list + TreeMap with default styling | Debtors list + DebtorTreemap restyled with q- tokens |
| UI Refresh Phase 3c | Debtor Detail with default styling | Debtor Detail page restyled with q- tokens |
| UI Refresh Phase 3d | Action Centre with default styling | Action Centre restyled with q- tokens |
| UI Refresh Phase 3e | Qashflow Forecast with default styling | Qashflow Forecast restyled with q- tokens |
| UI Refresh Phase 3f | Qapital pages with default styling | Qapital pages restyled with q- tokens |
| Dark mode | `prefers-color-scheme` dark mode active | Force light mode only (dark mode removed) |
| Content area background | White/default | Warm gray (`--q-bg-page` / #F8F7F5) globally |
| Recharts hover cursor | Gray overlay on chart hover | Removed globally (CSS + `cursor={false}`) |
| Navigation: Qollections default | Qollections Dashboard was default | Action Centre is now default Qollections page |
| Navigation: Impact page | Visible in sidebar | Hidden from sidebar, redirects to Action Centre |
| Navigation: Settings | 6 settings nav items | Merged to 3 items — Data Health and Audit Log relocated |
| Navigation: Playbook settings | Standalone settings page | Moved into Agent Settings > Charlie tab |
| Weekly Review page | Standalone route | Merged into Forecast page, standalone route removed |
| Home click | Expanded Qollections section | 🐛 Fixed — no longer expands Qollections |
| Approval tab layout | Card-based rows | Proper data table with sortable columns, overdue amount column, row click → drawer panel |
| Approval tab headers | Wrapping text | `whitespace-nowrap` on all column headers |
| Exceptions tab | Default card styling | Restyled category cards to match design system |
| Action Centre Summary | Default layout | Restyled three columns, navigation links, date pills, vertical alignment |
| Action Centre mode indicator | Visible on page | Removed |
| Debtor detail: VIP | VIP banner (duplicate) | VIP star in header row (left of name), banner duplicate suppressed |
| Debtor detail: actions | Default position | Relocated to header row |
| Debtor detail: paid tab | Default table | Restyled table + days-to-pay calculation fix |
| Debtor detail: back arrow | 🐛 Broken | Fixed |
| Activity tab: defaults | Default view | Notes view as default, expand-on-click for content |
| Activity tab: filters | Disputes filter present | Disputes filter removed, payment leak in System filter fixed |
| Bridge layout | Multiple iterations | Final: header+toggle row, invoice modal, always-visible table, compact recommendation |
| Bridge: facility fee | Fee included in cost | Removed — cost is interest only |
| Bridge: approve button | Visible on "Your facility" | Hidden when "Your facility" toggle is active |
| Bridge: minimum threshold | £500 minimum invoice | Threshold removed |
| Bridge table styling | Custom table | Matched to Debtors list structure (h-12 headers, sentence case) |
| Facility page | SummaryCard/MetricCard | Tabbed layout, QMetricCard, updated metric cards |
| Scenarios page | Default layout | Cashflow grid + editable cards moved, overdraft facility added |
| 🐛 Data Health tab | Vertical misalignment with All Debtors tab | Fixed alignment |
| Settings Team page | Default styling | Proper tables in card containers with q-token styling |
| Audit Log page | Default styling | Proper table in card container with q-token styling |
| 🐛 Email HTML safety net | Edge case formatting issues | Safety net + SendEmailDrawer overdue default + preview toggle |
| Riley recommendation | Contained link | Link removed, q-token fonts applied |
| Consistency fixes | Various pages inconsistent | Data Health, Qashflow, Scenario pages aligned |
| Debug endpoint | New | Temporary conversation brief inspector endpoint (debug only) |

**Notes:** 48 commits. Massive UI refresh day — the q- design token system was installed and rolled out across all 6 major page groups (Dashboard, Debtors, Debtor Detail, Action Centre, Qashflow, Qapital). Navigation consolidated: Qollections now defaults to Action Centre, Impact hidden, Settings merged from 6→3 items, Weekly Review merged into Forecast. Approval tab rebuilt from card rows to a proper sortable data table with drawer panel. Bridge page reached final layout. 69 files changed, ~5,000 insertions/deletions. Zero backend changes — purely frontend.

---

## [2026-04-11] — RBAC system, Qapital pillar (Capital Bridge + Facility), three-pillar dashboard, branding

**Sprint:** Post-Sprint 5 (feature sprint — RBAC + Qapital MVP + dashboard redesign)
**Scope:** RBAC, Qapital, Qashflow, Dashboard, Branding

| Change | From | To |
|--------|------|-----|
| 🆕 RBAC Phase 1 — schema + middleware | Basic role field on users | `userDelegations` table, delegation middleware, `/api/permissions` endpoint, `usePermissions` frontend hook. 6-tier RBAC with granular per-permission delegation |
| 🆕 RBAC Phase 2 — Team management | No team page | Team page with invitation table migration, `InviteModal`, `TeamMemberRow`, `DelegationToggles`, `FailsafeSection`. Team invitation emails via SendGrid |
| 🆕 RBAC Phase 3 — Permission gating | No frontend/API enforcement | Route-level permission gating on App.tsx, sidebar items, Action Centre, Forecast, Collections routes. Riley gains RBAC context awareness |
| 🆕 RBAC Phase 4 — Audit log + owner transfer | No audit trail or ownership transfer | `auditLog` table, Settings > Audit Log page with filterable UI, owner transfer on Team page, 90-day retention cleanup job |
| 📊 RBAC schema changes | New | `userDelegations`, `auditLog` tables. `teamInvitations` migrated from JSON to proper table |
| 🆕 Capital sidebar section | No Qapital navigation | Qapital section in sidebar: Pre-Authorisation, Bridge, Facility pages |
| 🆕 Capital Pre-Authorisation page | New | Eligibility checklist for invoice financing pre-authorisation |
| 🆕 Capital Bridge page | New | Invoice financing bridge UI — invoice selection, provider comparison cards, cash gap analysis. Greedy-with-improvement knapsack algorithm for optimal invoice subset. Deterministic risk scores. Business rule filtering (min advance, max concentration) |
| 🆕 Capital Facility page | New | Active facility dashboard with draw-down tracking |
| 🐛 Bridge selection algorithm | Selected all invoices | Picks optimal subset using greedy knapsack to bridge cash gap, not exceed it |
| 🆕 Cash gap alert system | New | `cashGapAlertHistory` table. In-app banner + SMS notification when forecast shows cash shortfall. SSE event for real-time alerts |
| 🐛 Forecast chart y-axis | Cut off negative values | Shows full range including negative pessimistic scenario |
| 🐛 Forecast page crash (×2) | Crashed on null API data | Defensive null guards on all optional data + conditional red zone rendering |
| Running Balance chart red zone | Stopped at zero line | Extends to full chart bottom for visual impact |
| Page rename | "Running Balance" / "Cashflow Grid" | "13w Qashflow Forecast" / "Cashflow Detail" |
| 🆕 Three-pillar dashboard | Single credit control dashboard | Three-pillar Home page: Credit Control · Cashflow · Capital summary cards with navigation |
| Dashboard separation | Dashboard = Home + Qollections | Home.tsx (three-pillar overview) separate from Qollections dashboard (credit control only) |
| Branding: pillar names | Generic section names | Qollections / Qashflow / Qapital throughout sidebar and UI |
| Email tagline | Old tagline | "Working Capital Intelligence" |
| 🆕 Bridge: Total advance row | No summary | Comparison cards show total advance amount |
| Bridge: cash gap banner | Multi-line banner | Compressed to single line with inline toggle |
| 🆕 Debtor Record page stub | New | Initial debtor-record.tsx page at `/qollections/debtors/:id` |

**Notes:** 22 commits. Major structural day — three new product pillars now visible in the UI. RBAC is a full 4-phase implementation (schema → team management → permission enforcement → audit trail). Qapital/Capital Bridge introduces the invoice financing UI with an algorithmic invoice selector. Dashboard redesigned from single-pillar to three-pillar architecture. Branding solidified with Qollections/Qashflow/Qapital naming convention.

---

## [2026-04-10] — 13-week cashflow forecast, conversation state machine, security hardening, onboarding + UI polish

**Sprint:** 5 → 8 (major feature sprint — Qashflow cashflow forecast delivered)
**Scope:** Qashflow (also: Security, Conversation lifecycle, Debtors, VIP, Onboarding, Action Centre)

| Change | From | To |
|--------|------|-----|
| 🆕 13-week cashflow forecast engine | New | Bottom-up AR forecast: per-debtor log-normal payment distributions, three-scenario modelling (optimistic/expected/pessimistic), promise overrides, 8 signal intelligence computations. `cashflowForecastService.ts` (~1,325 lines) |
| 🆕 Cashflow forecast API | New | 6 endpoints at `/api/cashflow/forecast/*` — weekly breakdown, signals, scenarios, manual adjustments |
| 🆕 Cashflow forecast UI | New | Full forecast page with dual Recharts charts, signal cards, weekly breakdown table |
| 🆕 Recurring revenue detection (Layer 2) | New | Auto-detects recurring patterns from invoice history, projects forward with decay confidence |
| 🆕 Outflow grid + net cashflow (Layer 3) | New | Manual outflow entry per week, running balance calculation |
| 🆕 User pipeline layer (Layer 4) | New | Confidence-tiered payment timing (Committed/Expected/Stretch), inline grid editing, scenario weighting |
| 🆕 Rolling window + manual close (Layer 5) | New | Weeks auto-roll forward, manual close locks actuals, accuracy tracking vs forecasted |
| 🐛 Close-week eligibility | Any week closeable | Constrained to current 13-week window only |
| 🆕 Forecast methodology card | No explanation of model | Recurring revenue and pipeline sections added to methodology card |
| 🔒 Security hardening | Test/debug endpoints unprotected | Role-gated behind RBAC (manager/admin/owner). Rate limiters on sync, agent, destructive, mutation endpoints |
| 🔒 Token encryption at rest | Xero tokens stored plaintext | AES-256-GCM encryption via `tryEncryptToken`/`tryDecryptToken`. All 4 write + 5 read sites updated. Migration script for existing tokens |
| 🔒 npm audit fix | Known vulnerabilities in qs, rollup, picomatch, yaml | All patched |
| 🆕 Conversation state machine | Scattered conversation state queries | 9-state deterministic lifecycle (idle → chase_sent → debtor_responded → conversing → promise_monitor → dispute_hold → escalated → resolved → hold). Optimistic locking, weekend-aware silence timeouts, full audit trail. `conversationStateService.ts` (~472 lines) |
| 📊 Conversation states schema | New | `conversationStates` table + `conversationStateHistory` audit table |
| 🆕 Debtor-level contact hours enforcement | Tenant-wide business hours only | `snapToContactWindow()` + compliance gate + per-debtor Send Now gating. Three-level enforcement |
| Debtors KPI: Overdue % | Avg Days Overdue card | Overdue % (totalOverdue/totalOutstanding). Colour-coded: green <25%, amber 25-50%, red >50% |
| 🆕 Debtors list UI polish | Basic list | Amber VIP star, state column, font consistency |
| 🐛 VIP menu clicks | Click navigated instead of actioning | Fixed with onSelect for menu items, added Remove VIP option |
| 🆕 VIP optimistic UI | Server round-trip on every VIP action | Immediate local cache update + rollback on error |
| 🆕 Compact search bar | Full-width search | Compact inline search in debtors header |
| 🆕 Streamlined onboarding | 9-step wizard | 2-screen flow: Connect Xero → Test Contact → Dashboard. Resilience guard checks data presence not boolean flag |
| 🐛 Reconnect Xero button | Navigated to raw API endpoint | Now navigates to Settings integrations page |
| 🆕 Scheduled tab three-dot menu | Cancel button per row | Three-dot menu with cancel + other actions. Detail drawer removed |
| 🆕 Sync error banner redesign | Basic error message | Redesigned banner with clear actions + pricing page updated |
| 🐛 Send Now outside business hours | Always clickable | Greyed out with tooltip. Re-evaluates every 60s |

**Notes:** 20 commits. Architecturally the biggest day of the build — the 13-week cashflow forecast (Sprint 8 deliverable, brought forward) is ~2,700 new lines spanning engine, API, and UI. The conversation state machine replaces ad-hoc conversation tracking with a deterministic 9-state lifecycle. Security hardening closes the last unprotected endpoint gaps and encrypts Xero tokens at rest. Onboarding simplified from 9 steps to 2 screens.

---

## [2026-04-09] — Promise tracking, sync UX, token refresh fix, Exceptions polish + UI hardening

**Sprint:** 5 (Xero production + Data Health + Communication Test Mode)
**Scope:** Xero Sync (also: Promises, Exceptions, Debtors, Integrations, UI)

| Change | From | To |
|--------|------|-----|
| 🆕 Sync UX: ambient progress bar | No visual sync feedback | Progress bar in header during sync, sidebar indicator, contextual banner |
| 🆕 Sync schedule + sidebar manual-sync | 4-hour `setInterval` | 60-second tick checking `crossedScheduledSlot()` per tenant with configurable `syncScheduleTimes`. Sidebar shows next sync time + manual trigger button (manager+) |
| 🐛 Xero token refresh race condition | Two uncoordinated mutex Maps could both refresh same token | Shared `withXeroRefreshLock(tenantId, fn)` serializes all refresh attempts. Health check no longer rotates tokens unconditionally |
| 🆕 Agent notifications | No feedback during Charlie/Riley runs | Stacked notification cards with progress indication |
| 🆕 Promise tracking + unallocated payments | Charlie chased debtors who had promised to pay or already paid | Active promise gate, net effective overdue calculation, broken promise detection, unallocated payment timeout, auto-reconciliation via Xero sync |
| 🆕 Promises sub-tab | New | New sub-tab in Exceptions showing promise status, broken promises, unallocated payments awaiting reconciliation |
| 🐛 Failed sends in Activity Feed | Failed sends mixed with successful activity | Routed to Exceptions tab instead |
| 🐛 Rules of Hooks violation | ExceptionsTab sub-tabs had conditional hooks | Fixed hook ordering |
| 🐛 Exceptions sub-tab counts | Counts incorrect on sub-tab pills | Fixed count queries per sub-tab + teal active pill state |
| 🆕 Integrations UI polish | Basic Xero disconnect + callback | Shadcn disconnect confirmation dialog + redesigned Xero callback page |
| 🐛 Debtor detail totals | Included drafts, didn't net credits | Excludes drafts, nets credit notes to match Xero AR |
| 🆕 Debtors Promise column | No promise visibility in list | New column showing active promise status per debtor |
| 🆕 Header sync indicator | Sync status only in sidebar | Compact indicator in page header |
| 🆕 Enrichment batching | Sequential enrichment calls | Batched Companies House lookups |
| 🐛 Header crash on non-array provider status | TypeError on providers/status returning non-array | Defensive array check |
| 🐛 Sidebar active highlight | Wrong item highlighted on nested routes | Longest-match resolution algorithm |
| Debtor detail tab consistency | Inconsistent tab styling | Aligned padding, borders, spacing across all tabs |
| Prior-session fixes batch | Various minor issues from prior session | Clarification flow fixes, planner improvements, settings tweaks, diagnostic scripts |

**Notes:** 17 commits across two sessions. Morning session focused on sync UX and the critical Xero token refresh race condition (two mutex Maps, health check rotating tokens every 20 minutes — see CLAUDE.md for full root cause). Afternoon session delivered promise tracking (Charlie no longer embarrasses the business by chasing debtors who've already paid or promised to pay) and polished Exceptions/Integrations/Debtors UI.

---

## [2026-04-06] — Sync Abstraction Layer, Xero hardening, UI polish + collapsible sidebar

**Sprint:** 5 (Xero production + Data Health + Communication Test Mode)
**Scope:** Xero Sync (also: UI, Dashboard, Debtor Detail, Sidebar)

| Change | From | To |
|--------|------|-----|
| ⚠️ Sync Abstraction Layer | Monolithic Xero-specific sync | Platform-agnostic SyncOrchestrator + XeroAdapter (~1,980 new lines). Provider-independent types, webhook router, adapter interface for future QuickBooks/Sage |
| 🆕 Database clearing script | No way to reset sync data for fresh start | scripts/clear-sync-data.mjs — clears sync tables while preserving tenant/user config |
| 🐛 Xero /Date()/ format crash | Sync crash on UpdatedDateUTC parsing | Parse Xero's /Date(timestamp+offset)/ format before DB insert |
| 🆕 Credit notes, overpayments, prepayments | Not synced from Xero | Populated in cached tables during sync for accurate AR calculations |
| 🆕 Initial sync date filter | Fetched all invoices regardless of age | Open invoices (any age) + 24 months of paid history — reduces initial sync volume |
| 🆕 Two-pass bounded fetch | Single unbounded fetch for force/reconciliation sync | Two passes: first open invoices, then recent paid — prevents timeout on large books |
| 🐛 Xero 403 after reconnect | Auth failure not handled during reconnect flow | 401/403 retry with automatic token refresh before retry |
| 🐛 Xero sync silent failure | Sync failed without any visible error | Error logging + exclusion of test contacts (isSupplier/isCustomer=false) from AR figures |
| 🐛 Xero sync webhook URL | Stale webhook URL after deploy | Dynamic URL from APP_URL env var |
| 🐛 Xero sync dead code | Old sync system still partially wired | Removed dead sync system, added token mutex to prevent concurrent refreshes, stale data guard |
| 🐛 Xero health check false positive | Health check reported OK when token was actually expired | Treat 403 as auth failure, not just 401 |
| 🆕 Collapsible sidebar | Fixed-width sidebar always expanded | Icon-only collapsed mode with smooth transition, persisted preference |
| 🆕 Standardised filter pills | Inconsistent pill styling across tabs | Shared filter-pill.tsx component used across Activity, Approvals, Scheduled, Exceptions tabs |
| 🆕 VIP restructure | Basic VIP list | Action Centre navigation links + safety filters on VIP view |
| 🆕 Charlie status banner on debtor detail | No visibility into Charlie's assessment | DebtorStatusBanner component shows phase, tone, next action, risk signals |
| 🆕 Communication Preferences expanded | Minimal prefs card | Per-debtor channel controls (email/SMS/voice toggles) in 3×2 grid layout |
| 🐛 Communication Preferences layout | Card content overflowing | Fixed to 3×2 grid layout |
| 🆕 Immediate UI Feedback architecture rule | No codified rule for UI responsiveness | Added to CLAUDE.md: 200ms feedback, optimistic UI, button states, cache invalidation, SSE patterns |
| 🐛 Activity tab pill labels | Long labels, wrong group order | Shortened "All" label, reordered Time group for scannability |
| 🐛 Debtor activity tab duplicates | Payment events shown multiple times | Deduplication of payment events in debtor timeline |
| 🐛 Activity view date display | Times shown without dates, confusing for older events | Date leads in all activity views, time shown only for communications |
| 🗑️ Dashboard debtor list table | Redundant debtor list on dashboard | Removed — debtors accessed via dedicated Debtors page |
| Debtor detail tab reorder | Old tab sequence | Reordered for workflow priority |
| 📊 New shared timeline types | No shared type definitions | shared/types/timeline.ts with unified event types |
| 📊 Customer timeline service | No dedicated timeline query service | server/services/customerTimelineService.ts for debtor-specific timeline queries |

**Notes:** 21 commits. The Sync Abstraction Layer is the most architecturally significant change — replaces the monolithic Xero sync with a provider-agnostic pattern (SyncOrchestrator + adapter interface) that will support QuickBooks and Sage in future. Multiple Xero sync bugs fixed around auth handling, date parsing, and silent failures. UI polish across the board: collapsible sidebar, standardised filter pills, debtor detail enrichment. The dashboard debtor list table removed in favour of the dedicated Debtors page.

---

## [2026-04-05] — Activity Feed, Decision Tree Engine, SSE real-time, SMS nudge model + bug fixes

**Sprint:** 5 (Xero production + Data Health + Communication Test Mode)
**Scope:** Action Centre (also: Charlie decision engine, Communications, SSE infrastructure, Exceptions)

| Change | From | To |
|--------|------|-----|
| 🆕 Activity Feed tab | Sent tab (flat list of past actions) | Debtor-threaded view with coloured borders, summary strip, pill filters, inline expand |
| 🆕 Activity Feed API | No dedicated endpoint | GET /api/action-centre/activity-feed — queries timelineEvents + backfills from actions + inboundMessages |
| 🆕 Deterministic decision tree engine | All decisions via probabilistic adaptive-scheduler | New decisionTree.ts (~530 lines) — 9 gate checks, behavioural categorisation, phase/tone/channel/timing. Feature-flagged via tenants.useDecisionTree |
| 📊 decisionAuditLog table | New | Full audit trail with outcome columns for future ML training |
| 🆕 SSE real-time events | Polling-only UI updates | Tenant-scoped SSE service with 10 event types, auto-reconnect client hook, TanStack Query invalidation |
| 🆕 SSE endpoint | New | GET /api/events/stream (authenticated) with 30s keep-alive |
| 🆕 SMS simplified to nudge channel | SMS sent full collection messages | One-way nudge only — points debtors to check email. No amounts, no invoice numbers, no links. Excluded at formal/legal tone |
| 🆕 Exception state management | Static exception list | Workflow states (new → in_progress → resolved) with filter pills, state indicators, transition buttons |
| 📊 Exception schema additions | No state tracking | 4 new columns: exceptionStatus, exceptionResolvedBy, exceptionResolvedAt, exceptionResolutionNotes |
| 🆕 Exceptions summary landing | Direct list view | Dashboard with category cards (Collections, Debtor Situations, Other) showing counts + trends |
| 🐛 Activity Feed empty state | "No activity yet" despite real activity | Three fixes: outbound timeline events created, backfill from actions/inboundMessages, tenant timezone for time filter |
| 🐛 Inbound SMS invisible | SMS webhook never created timelineEvent | SMS + WhatsApp webhooks now create timeline events matching email handler pattern |
| 🐛 PTP for non-overdue invoices | Sent "Payment Arrangement Confirmed" for not-yet-due | New overdue check gates PTP flow; non-overdue signals stored as early intelligence (aiFact) |
| 🐛 Vonage webhook crash | rawPayload: req.body caused TypeError in Drizzle jsonb | Wrapped in clean object with explicit fields + null guards |
| 🐛 SSE 401 Unauthorized | Missing Clerk token on EventSource connection | Auth token passed to SSE endpoint |
| 🐛 DSO card formula | Custom calculation didn't match trend chart | Aligned to standard DSO formula |
| 🐛 Activity Feed duplicates | Multiple sources producing duplicate events | Deduplication by actionId and channel+contact+timestamp signature |
| 🐛 Activity Feed sort order | Inconsistent ordering | Newest first, consistent across all event sources |
| 🆕 SMS drawer contact picker | Single phone field, no fallback | Priority 6-source phone lookup + contact picker dropdown when multiple phones found |
| 🆕 Debtor detail Activity tab | Separate design from Action Centre | Aligned with Action Centre Activity Feed design (timestamp column, clean narratives) |
| 🆕 ActivityEventRow component | Inline rendering in feed | New shared component with timestamp column layout and clean narrative text |

**Notes:** 15 commits. The deterministic decision tree engine (decisionTree.ts) is the most architecturally significant addition — a pure-function module with zero DB queries, zero LLM calls, feature-flagged for safe rollout. SSE infrastructure replaces polling for real-time UI updates across all key events. SMS is now a lightweight nudge channel only, with formal/legal tone requiring email. Multiple Activity Feed bugs resolved — the feed now reliably shows all communication history.

---

## [2026-04-04] — Collections pipeline hardening + two-phase model + Action Centre restructure

**Sprint:** 5 (Xero production + Data Health + Communication Test Mode)
**Scope:** Collections pipeline (also: Action Centre, Compliance, Riley, Data Health, Communications)

| Change | From | To |
|--------|------|-----|
| 🆕 Two-phase collection model | Single chase approach for all overdue | Phase 1 (Inform) single nudge + Phase 2 (Elicit Date) after chaseDelayDays |
| 🆕 Pre-due courtesy reminders | No pre-due notifications | Configurable reminders N days before due for invoices above threshold |
| 📊 New tenant settings | No collection timing config | chaseDelayDays, preDueDateDays, preDueDateMinAmount columns |
| 🆕 Action Centre tab restructure | Queue + Activity tabs | Approval + Scheduled + Sent tabs with cancel/send-now per row |
| 🆕 Configurable send delay | Immediate delivery after approval | sendDelayMinutes setting (0-60, default 15) — approved actions wait in Scheduled |
| 🆕 Scheduled tab | New | Shows approved-but-not-yet-sent actions with Cancel and Send Now buttons |
| 🔒 Compliance gate on ActionExecutor | Executor bypassed compliance engine | runComplianceGate() checks all email/SMS before delivery, fails closed |
| 🔒 Voice paths routed through mode wrapper | Two Retell paths bypassed comms mode enforcement | collectionsRoutes + retell-service now route through sendVoiceCall() |
| 🐛 Approval pipeline fix | Approve set status to 'scheduled' for tomorrow | Approve calls approveAndSend() for immediate delivery |
| 🐛 Collections scheduler boot fix | orchestrator had `void collectionsScheduler` (no-op) | Correctly calls `.start()` — ActionExecutor now runs at boot |
| 🐛 SMS E.164 normalization | UK local format (07xxx) rejected by Vonage (status 12) | normalizeToE164() converts 07xxx → 447xxx for all sends |
| 🐛 Compliance false positives | UTC time-of-day, invoice number matching in currency amounts | Tenant timezone via Intl, digit-boundary matching, cooldown pre-filter |
| 🐛 Riley blocked by drawer | Action Centre Sheet made sibling elements inert | modal={false} on drawers, Riley z-[60] receives clicks |
| 🆕 Conversation brief service | Charlie had no memory of prior exchanges | 11-source debtor history assembled + injected into all LLM generation paths |
| 🆕 Promise modification detection | No detection of revised payment promises | intentAnalyst detects revised promises, updates existing PTP signals |
| 🆕 Email HTML formatting | LLM plain text sent as-is | emailFormatter.ts converts to clean HTML (paragraphs, breaks, bullet lists, 600px template) |
| 🆕 Activity timeline redesign | Basic timeline list | Event-type visual differentiation (colour-coded borders, icons, expand/collapse) |
| 🆕 Inbound SMS wider contact lookup | Single phone field search | Three-source search (phone, arContactPhone, customerContactPersons) × 4 format variants |
| 🆕 Unmatched SMS exception logging | Unmatched inbound SMS silently discarded | Creates UNMATCHED_INBOUND_SMS attention item in Action Centre Exceptions |
| 🆕 Data Health hard bounce detection | Static field checks only | Queries timelineEvents for email_hard_bounce, downgrades to needs_email |
| 🗑️ Invoices page removed from nav | Standalone /qollections/invoices page | Redirects to /qollections/debtors (invoices accessed via Debtor Detail) |
| 🗑️ Orphaned ageing analysis deleted | Dead /api/analytics/aging-analysis endpoint + component | Removed (live Dashboard uses /api/qollections/summary) |
| 🗑️ Payment link placeholders removed | {{paymentLink}}/{{PORTAL_LINK}} in email templates | Removed — debtor portal deferred to MVP v2 |
| 🐛 VIP promotion 0-rows guard | Silent success on non-existent/wrong-tenant contacts | Returns 404, logs warning on 0-row update |
| 🆕 Action Centre query invalidation hook | Inconsistent query key invalidation across tabs | Shared useInvalidateActionCentre hook for all mutations |
| 🐛 Startup validation | Missing ANTHROPIC_API_KEY failed silently per call | Throws at startup, orchestrator validates DATABASE_URL + ANTHROPIC_API_KEY first |
| Sidebar restructured | Old nav order | Dashboard → Action Centre → Debtors → Disputes → Impact → Reports |
| Prohibited PTP language | "promise to pay" used in agent emails | LANGUAGE RULE: use "payment arrangement"/"confirmed payment date" instead |

**Notes:** Massive hardening session — 16 commits. Three critical security fixes (compliance gate, voice mode enforcement, startup validation). The two-phase collection model is the most significant behavioural change: Charlie now distinguishes between informing a debtor vs actively seeking payment dates, reducing aggressive early chasing.

---
