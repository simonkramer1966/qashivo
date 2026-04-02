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

## Outbound Communications Safety (CRITICAL)

All outbound communications (email, SMS, voice) MUST go through the central enforcement wrapper before reaching the wire:
- **Email**: `enforceCommunicationMode()` in `server/services/sendgrid.ts`
- **SMS**: mode check in `server/services/vonage.ts`
- **Voice (Retell)**: `sendVoiceCall()` in `server/services/communications/sendVoiceCall.ts`

Never call SendGrid, Vonage, or Retell APIs directly from routes, agents, or any new service. Always pass `tenantId` through to the wrapper.

The wrappers enforce Off / Testing / Soft Live / Live modes and **fail closed on errors** — if the DB is unreachable, sends are blocked rather than allowed through.

**Soft Live note:** No contact-level opt-in mechanism exists yet. Soft Live currently behaves identically to Testing mode until opt-in is built.

**Exceptions (no tenant context):** Investor demo endpoint (`/api/investor/voice-demo`) and MCP admin tools bypass mode enforcement — these are non-tenant-scoped and documented with safety comments.

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
- Charlie Hardening: 14 gaps per CHARLIE_ENGINEERING_SPEC.md (delivery confirmation, PRS Bayesian, execution-time revalidation, tone velocity cap, pre-action compliance, circuit breaker, channel preferences, feedback loop, portfolio controller, P(Pay) log-normal, debtor grouping, seasonal patterns, unreconciled payment detection, cold start + enrichment). Implementation priority order defined in spec.

---

## RECENT CHANGES LOG

<!-- ADD NEW ENTRIES AT THE TOP — format: YYYY-MM-DD: What changed -->

- 2026-04-02: Gap 11 implemented — Debtor channel preference hard overrides. Channel preferences already existed in `customerPreferences` table (emailEnabled, smsEnabled, voiceEnabled) with UI toggles in customer-detail.tsx, but Charlie never read them. Added `channelPreferenceSource` and `channelPreferenceNotes` columns to customerPreferences. Enforcement wired into `charlieDecisionEngine.ts` (applyChannelPreferenceOverride after selectChannel) and `actionPlanner.ts` (channelPrefs build + AI optimization safety check). Null/undefined defaults to enabled (backwards compatible). Fallback order: email → sms → voice. If all channels disabled, action is skipped and logged. UI auto-sets source to 'user_manual' on toggle change, displays source + notes below toggles. Riley extraction prompt updated to detect channel preferences from conversations ("don't call me", "email only", etc.) and write to customerPreferences with source='riley_conversation'.
- 2026-04-02: Gap 10 implemented — Pre-action 30-day statutory response window. `setLegalResponseWindowIfNeeded()` in actionExecutor.ts sets `legalResponseWindowEnd` on contacts after Legal tone actions complete. Gap 4 validation gate updated to block both active windows AND expired-but-unresolved windows (requires user to explicitly resolve via API). Daily `legalWindowJob.ts` creates day-25 expiry warnings and day-30 expired events with deduplication. `POST /api/contacts/:id/legal-window/resolve` endpoint (manager+ role) supports three resolution actions: resume_collections (clears window), refer_debt_recovery (keeps window, logs handoff), extend_window (new 30-day window). Xero sync auto-clears window when all invoices for a contact become settled.
- 2026-04-02: Gap 5 implemented — Tone escalation velocity cap + history tracking. Engine now reads agentToneLevel from last completed action and enforces ±1 step max per cycle. No-response escalation pressure (+1 after N consecutive unanswered contacts, default threshold 4). Significant payment override (≥50% of outstanding paid resets baseline to Professional, bypassing downward cap). Two new tenant settings: noResponseEscalationThreshold, significantPaymentThreshold. Three new helper functions: getLastSentAction, getConsecutiveNoResponseCount, checkSignificantPayment. ToneEscalationResult.signals extended with lastToneLevel, consecutiveNoResponseCount, velocityCapped.
- 2026-04-02: Gap 2 implemented — PRS Bayesian prior (k=3, prior=60) + recency weighting (90-day half-life decay). Added prsRaw and prsConfidence columns to customerLearningProfiles. Rolling windows now filter by evaluatedAt (resolution date) instead of createdAt. All behavioral flags use Bayesian-adjusted PRS. calculationVersion bumped to "2.0" on recalculation. Thin-data debtors regress toward tenant population mean (10+ scored debtors required) or system default of 60.
- 2026-04-02: Gap 8 implemented — Dead letter handling + delivery confirmation. Custom args (tenant_id, action_id, contact_id, invoice_id) now attached to all SendGrid outbound emails. Webhook receiver logs warnings for legacy emails without custom args. Event bus processDeliveryOutcome() updates action delivery status on delivered/bounce/dropped events. Hard bounces create timeline events for Data Health. Retry logic (max 2 retries, 5m/30m delay) in actionExecutor. Touch counting queries in actionPlanner and complianceEngine exclude failed deliveries. Schema: added voiceContactRecord (jsonb) to actions table.
- 2026-04-02: CHARLIE_ENGINEERING_SPEC.md v1.1 created — 14 gaps covering Charlie decision engine hardening. Full audit of tone escalation, PRS, delivery pipeline, P(Pay) model, portfolio controller, channel effectiveness, cold start. Identified SendGrid webhook pipeline non-functional (plumbing exists, nothing flows). Identified bank transaction sync not wired. Pre-action 30-day compliance gap found. New tables specified: debtorIntelligence, debtorGroups, probablePayments. New fields on actions, contacts, tenants tables. Template fallback messages for LLM circuit breaker. UK "Time to Pay Up" legislation (24 March 2026) factored in — separate DISPUTE_RESOLUTION_SPEC.md to be created.
- 2026-03-22: Added voice wrapper for Retell communication mode enforcement. Completed comms mode audit across all outbound channels.

---

## KNOWN ISSUES

<!-- ADD bugs when discovered (with date), REMOVE when fixed -->

- **Ageing analysis chart bug**: Dashboard showing wrong aging buckets (flagged 15 March 2026)
- **Xero redirect URI**: Still references REPLIT_DOMAINS in xero.ts constructor — needs APP_URL
- **Old sync code**: syncContactsToDatabase may still exist — needs deletion if unused
- **Invoice sync incomplete**: syncInvoicesAndContacts may not be writing to both cached_xero_invoices AND main invoices table
- **SendGrid delivery webhooks — FIXED (Gap 8)**: Custom args now attached, webhook events flow through event bus to update action delivery status. Remaining limitation: connected email (Gmail/Outlook OAuth) path has no delivery tracking — no equivalent to SendGrid custom_args or webhooks. Also: `processed`, `unsubscribe`, `spamreport`, `group_unsubscribe`, `group_resubscribe` events are not handled (recorded in contactOutcomes but not in DELIVERY_EVENT_TYPES). Data Health endpoint does not yet query timeline events for hard bounce signals — the auto-flip creates the event but Data Health only checks static contact fields.
- **Tone escalation engine stateless — FIXED (Gap 5)**: Velocity cap (±1 step/cycle) reads agentToneLevel from last completed action. No-response escalation pressure after N consecutive unanswered contacts. Significant payment override resets baseline to Professional. Two new tenant settings: noResponseEscalationThreshold (default 4), significantPaymentThreshold (default 0.50).
- **PRS no sample size guard — FIXED (Gap 2)**: Bayesian prior (k=3) regresses thin-data debtors toward population mean or system default 60. 1 kept promise now scores ~70 (not 100). Recency weighting (90-day half-life) ensures recent behavior dominates. prsRaw and prsConfidence columns added for transparency.
- **No pre-action 30-day response window — FIXED (Gap 10)**: `setLegalResponseWindowIfNeeded()` sets `legalResponseWindowEnd` on contacts when a Legal tone action completes. Gap 4 validation gate blocks both active AND expired-unresolved windows. Daily `legalWindowJob` creates day-25 expiry warnings and day-30 expiry events (deduped). `POST /api/contacts/:id/legal-window/resolve` endpoint (manager+ role) supports `resume_collections`, `refer_debt_recovery`, and `extend_window`. Xero sync auto-clears window on full settlement.
- **Bank transactions not synced**: xero.ts has getBankTransactions() API methods but xeroSync.ts never calls them. bankTransactionsCount hardcoded to 0. Table truncated on initial sync but never repopulated. See CHARLIE_ENGINEERING_SPEC.md Gap 14.
- **Data Health doesn't detect hard bounces**: Hard bounce timeline events are created (Gap 8) but GET /api/settings/data-health only checks static contact fields (email populated, phone populated, generic email patterns). Needs query extension to check for email_hard_bounce timeline events and downgrade readiness status to "Needs Email".
- **Circuit breaker admin SMS alerts non-functional**: `llmCircuitBreaker.ts` `notifyAdmins()` attempts to send SMS alerts to tenant admins, but the `users` table has no `phone` column. SMS notifications will silently fail until a phone field is added to the users schema. Email notifications work fine.

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
- **Channel preferences live in customerPreferences table, not contacts**: The `customerPreferences` table (separate from `contacts`) stores channel opt-outs (emailEnabled, smsEnabled, voiceEnabled), contact windows, and trading name. UI toggles in customer-detail.tsx save here via `PATCH /api/contacts/:contactId/preferences`. The `contacts` table has `preferredChannel` (varchar) on `customerLearningProfiles` but that's a different concept (learned preference vs hard override). Two channel selection paths exist: `charlieDecisionEngine.selectChannel()` and `actionPlanner` `channelPrefs` — both must enforce overrides.

### Charlie decision engine (from full audit)
- **Consolidation is sound**: actionPlanner.ts (lines 618-898) correctly filters invoices individually before bundling. Only invoices that pass exclusion checks enter consolidated actions.
- **agentToneLevel already stored**: actions table has agentToneLevel (varchar) at line 806 of schema.ts. The tone engine writes it but never reads it back.
- **Channel effectiveness scores never update**: customerLearningProfiles stores emailEffectiveness, smsEffectiveness, voiceEffectiveness (0-1, default 0.5). collectionLearningService.ts has getOrCreateCustomerProfile(). But communicationOutcomeProcessor is not wired to update these scores. The EMA formula (newScore = oldScore x 0.8 + thisInteraction x 0.2) exists in documentation but nothing triggers it.
- **P(Pay) uses 3 of 6 available signals**: adaptive-scheduler.ts estimateProbabilityOfPayment() uses medianDaysToPay, channel reply rates, weekdayEffect. Ignores p75DaysToPay, volatility, trend.
- **Portfolio urgency applied uniformly**: portfolioController.ts calculates tenant-level urgency factor but applies it identically to all debtors regardless of their contribution to the DSO problem.
- **Xero API training prohibition**: March 2026 developer terms prohibit using Xero API data for AI/ML training. Architecture must position AI as inference on customer-owned data. Open Banking data (via TrueLayer/Yapily) has no such restriction — all model training should use Open Banking data.

### Sync conventions
- **Invoice-first sync**: Fetch invoices from Xero → extract contacts from invoice data → batch-fetch contact details. This is the correct sync path (xeroSync.ts), NOT the old syncContactsToDatabase.
- **Two sync modes**: INITIAL (clean sweep + fresh insert) for first connection. ONGOING (upsert by xeroInvoiceId/xeroContactId, never delete) for scheduled background syncs.
- **Rate limiting**: 1.5 second delay between paginated Xero API calls, 60 second wait on 429.
- **Token refresh**: Proactive (check expiry with 2-min buffer before API calls) + reactive (401 retry once). Failed refresh → mark connection "expired", prompt user to reconnect.

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
- `shared/` — Code shared by client and server
  - `schema.ts` — Single source of truth: ~92 Drizzle tables, Zod validation schemas, TypeScript types
  - `types/`, `utils/`, `forecast.ts`, `currencies.ts`
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
- `debtorIntelligence` — AI enrichment data from Companies House, CCJ register, web search (Charlie spec Gap 6)
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
Xero API
  ↓ (invoice-first sync, 1.5s rate limit between pages)
cached_xero_invoices (raw cache) + invoices table + contacts table
  ↓
AR overlay fields preserved (NEVER overwritten)
  ↓
Data Health assessment recalculated
  ↓
Debtor scoring job queued
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
