# Next Session Briefing — 13 April 2026

## Where We Are
Sprint 5 has expanded to 25 sub-sections (5.1–5.25). The 12 April session was a massive UI refresh day — 48 commits installing the q- design token system and rolling it out across all 6 major page groups (Dashboard, Debtors, Debtor Detail, Action Centre, Qashflow, Qapital). Navigation was consolidated: Qollections now defaults to Action Centre, Impact hidden, Settings merged from 6→3 items, Weekly Review merged into Forecast. The Approval tab was rebuilt from card rows to a proper sortable data table. Bridge page reached its final layout. 69 files changed, ~5,000 insertions/deletions — purely frontend, zero backend changes.

Two Sprint 5 items remain: Xero redirect URI fix (trivial) and onboarding Data Health integration. Three P0 security findings from the 6 April scan remain unaddressed: scorecard email bypass, demo call tenant isolation, and token enumeration in the invite system.

CLAUDE.md is now 3 days stale — missing 10 April (security hardening, conversation state machine, 13w forecast, onboarding, VIP/debtors polish), 11 April (RBAC, Qapital, three-pillar dashboard, branding), and 12 April (q- design tokens, UI refresh, navigation consolidation) sessions entirely.

## This Session's Focus
Update CLAUDE.md (critical — 3 days stale), close security findings and Sprint 5 final items, then begin Sprint 6 (Debtor Detail page — the stub already exists and was partially built during the UI refresh).

## Tasks (in order)

### 1. Update CLAUDE.md — P0
**What:** CLAUDE.md is 3 days stale. It's missing three full sessions (10–12 April) comprising ~90 commits. The RECENT CHANGES LOG, CURRENT STATE, KNOWN ISSUES, CODEBASE LEARNINGS, and ARCHITECTURE NOTES sections all need updating.
**Why now:** CLAUDE.md is the persistent memory for every Claude Code session. 3 days of drift means significantly incorrect context for all future sessions. This is the single highest-impact task.
**Key additions needed:**
- RECENT CHANGES LOG: 10 Apr entries (security hardening, conversation state machine, 13w forecast, onboarding simplification, VIP/debtors polish), 11 Apr entries (RBAC 4-phase, Qapital pillar, cash gap alerts, three-pillar dashboard, branding), 12 Apr entries (q- design token system, UI refresh Phases 1-3f, navigation consolidation, approval tab data table, debtor detail polish, bridge final layout)
- CURRENT STATE: Sprint 5 expanded to 25 sub-sections
- ARCHITECTURE NOTES: RBAC delegation model, conversation state machine (9-state lifecycle), Qapital Bridge algorithm (greedy knapsack), three-pillar dashboard routing, q- design token system, navigation structure changes
- CODEBASE LEARNINGS: `usePermissions` hook, delegation middleware, `cashGapAlertService` SSE, bridge selection algorithm, `tokens.css` design system, `QMetricCard` shared component, conversation states table
- Key Schema Tables: add `userDelegations`, `auditLog`, `cashGapAlertHistory`, `conversationStates`, `conversationStateHistory`
- Design system section: document `tokens.css`, `--q-bg-page`/`--q-bg-surface` tokens, `QMetricCard`, force light mode
**Files:** CLAUDE.md only
**Watch out for:** Don't remove anything still accurate. Append to existing sections. The design system is a significant new pattern worth its own subsection in CODEBASE LEARNINGS.

### 2. Fix scorecard email bypass — P0 (Security)
**What:** `server/routes/prospectScorecardRoutes.ts` line 156 calls `sgMail.send()` directly, bypassing `enforceCommunicationMode()`. Route through the central `sendEmail()` wrapper.
**Why now:** Security scan critical finding from 6 April — persists for a week now. The only remaining outbound email path not enforced.
**Files likely involved:** `server/routes/prospectScorecardRoutes.ts`, `server/services/sendgrid.ts`
**Watch out for:** Ensure tenantId context is available. If public endpoint, document the bypass.

### 3. Add tenant isolation to demo call results — P0 (Security)
**What:** `storage.getDemoCall(callId)` returns data without tenantId filter. Any callId returns data to any caller.
**Why now:** Security scan critical finding. Data leakage risk. One week old.
**Files likely involved:** `server/routes/demoRoutes.ts`, `server/storage.ts`

### 4. Fix token enumeration in invite system — P1 (Security)
**What:** Invite verification returns different responses for valid vs invalid tokens.
**Files likely involved:** `server/routes/partnerRoutes.ts`

### 5. Fix Xero redirect URI — P1 (Sprint 5.1 final item)
**What:** Replace REPLIT_DOMAINS in `server/services/xero.ts` constructor with APP_URL env var. Also check `server/startup/orchestrator.ts`, `server/routes/integrationRoutes.ts`, and `server/routes.ts.bak` which also reference REPLIT_DOMAINS.
**Why now:** Last original Sprint 5.1 item. Trivial fix but has persisted since the start of Sprint 5.
**Files likely involved:** `server/services/xero.ts`, `server/startup/orchestrator.ts`, `server/routes/integrationRoutes.ts`

### 6. Begin Sprint 6: Debtor Detail page — P1
**What:** Full debtor record at `/qollections/debtors/:id` per build spec Section 6.1: header, contacts management, invoices list, agent activity, AR notes. The debtor detail page already has significant scaffolding from the 12 April UI refresh (VIP header, activity tab with notes default, paid tab, q- design tokens applied).
**Why now:** Sprint 6 is the next sprint. The UI refresh day means the debtor detail page is partially built — capitalize on that momentum. Focus on wiring the data layer: contacts CRUD, invoice list with action timeline, AR notes persistence.
**Files likely involved:** `client/src/pages/qollections/debtor-record.tsx` (exists), new API endpoints for contacts CRUD
**Watch out for:** Row-click navigation from all debtor list surfaces (Section 6.2). Three-dot menu pattern already established. The debtor detail already renders but needs the data endpoints built.

## Don't Touch
- q- design token system (just completed — settled, consistent, do not re-theme)
- Sync Abstraction Layer (stabilised 9 Apr, token lock working)
- Collections pipeline (stabilised 7 Apr, email generation working)
- Charlie decision engine gaps (all 14 implemented)
- 13-week cashflow forecast engine (delivered 10 Apr)
- Capital Bridge algorithm (delivered 11 Apr)
- RBAC system (delivered 11 Apr)
- Navigation structure (consolidated 12 Apr — let it settle)

## Known Bugs to Keep in Mind
- **Xero redirect URI** — still references REPLIT_DOMAINS in 4 files (Task 5 above)
- **Scorecard email bypass** — direct sgMail.send() bypassing mode enforcement (Task 2)
- **Demo call tenant isolation** — no tenantId filter on getDemoCall (Task 3)
- **Connected email has no delivery tracking** — Gmail/Outlook OAuth path
- **SendGrid event types** — `processed`, `unsubscribe`, `spamreport` not handled
- **Soft Live = Testing** until contact-level opt-in built
- **Debug endpoint** — temporary conversation brief inspector endpoint was added 12 Apr — remove before production

## Architecture Reminders
- Central communication wrappers: ALL outbound must go through `sendEmail()`/`sendSMS()`/`sendVoiceCall()`. Fail closed.
- AR overlay fields are SACRED — never overwrite during sync.
- `getARSummary()` is the single source of truth for AR figures.
- RBAC: use `withPermission()` or `withMinimumRole()` middleware on new endpoints.
- Immediate UI Feedback rule — 200ms visible feedback for every user action.
- Design tokens: use `--q-bg-page` for page backgrounds, `--q-bg-surface` for cards/modals, `QMetricCard` for metrics.

---

## Claude Code Prompt — Ready to Paste

---

Read CLAUDE.md first for full context. Then read docs/MVP_V1.1_BUILD_SPEC.md Sections 5.24-5.25 (12 April work) and Section 6 (Debtor Detail page).

**Task 1 (do first):** Update CLAUDE.md to reflect all changes from 10–12 April (3 days of drift, ~90 commits). Add RECENT CHANGES LOG entries for: (1) 10 Apr — security hardening (RBAC role gating, rate limiting, Xero token encryption AES-256-GCM, npm audit fix), conversation state machine (9-state lifecycle in conversationStateService.ts, conversationStates + conversationStateHistory tables, optimistic locking, weekend-aware silence timeouts), 13-week cashflow forecast engine (cashflowForecastService.ts ~1,325 lines, 6 API endpoints, recurring revenue detection, outflow grid, user pipeline layer, rolling window + manual close), onboarding simplification (9-step → 2-screen), debtor-level contact hours enforcement, VIP optimistic UI + fixes, compact debtors search. (2) 11 Apr — RBAC 4-phase (userDelegations + auditLog tables, delegation middleware, team page, permission gating, audit log UI, owner transfer), Qapital pillar (Capital Bridge with greedy knapsack, Facility page, Pre-Authorisation), cash gap alerts (cashGapAlertHistory table, SSE integration), three-pillar dashboard (Home.tsx), branding (Qollections/Qashflow/Qapital). (3) 12 Apr — q- design token system (tokens.css with warm gray palette, QMetricCard), UI refresh Phases 1-3f across all 6 page groups, force light mode, navigation consolidation (Action Centre as default, Impact hidden, Settings 6→3, Playbook → Agent Settings, Weekly Review → Forecast), approval tab rebuilt as sortable data table with drawer, debtor detail polish (VIP header, activity tab notes default, paid tab restyle), bridge final layout (interest-only, no £500 threshold), scenarios page overdraft facility. Update CURRENT STATE to Sprint 5 at 25 sub-sections. Add design system section to CODEBASE LEARNINGS. Add schema tables. Update Directory Layout.

**Task 2 — Fix scorecard email bypass (P0 security):**
In `server/routes/prospectScorecardRoutes.ts` line 156, replace direct `sgMail.send()` with `sendEmail()` wrapper from `server/services/sendgrid.ts`.

**Task 3 — Fix demo call tenant isolation (P0 security):**
In `server/routes/demoRoutes.ts`, add tenantId filtering to `GET /api/demo/call-results/:callId`.

**Task 4 — Replace all REPLIT_DOMAINS references:**
In `server/services/xero.ts`, `server/startup/orchestrator.ts`, `server/routes/integrationRoutes.ts` — replace with APP_URL env var.

**Task 5 — Remove temporary debug endpoint:**
The conversation brief inspector endpoint added on 12 April — remove it.

**Task 6 — Sprint 6: Debtor Detail data layer:**
The debtor detail UI at `/qollections/debtors/:id` is partially built (12 Apr UI refresh). Build the data layer: contacts CRUD API endpoints, invoice list with per-invoice action timeline, AR notes persistence. Wire row-click navigation from Debtors, Data Health, and VIP pages per build spec Section 6.2.

Do NOT touch: tokens.css, QMetricCard, SyncOrchestrator.ts, xeroTokenLock.ts, conversationStateService.ts, cashflowForecastService.ts, decisionTree.ts, bridge.tsx, RBAC files, navigation structure. All of these were recently stabilised.

Verify: `npm run check` passes. No new type errors.

---
