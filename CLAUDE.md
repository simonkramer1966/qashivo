# Qashivo — Claude Code Instructions

## Before Starting ANY Work
Read /docs/QASHIVO_CONTEXT.md completely. It is the canonical product specification
 (2,500+ lines, 19 sections).
 Do not skip it. Every development decision must align with this document.

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

## Critical Rules
1. Every communication is LLM-generated in the agent's persona voice. NO templates. If it reads like a template, it's wrong.
2. Compliance Agent (rule-based v1) gates ALL outbound communications before delivery.
3. Multi-tenant data isolation must be maintained — never leak data between tenants.
4. Default currency is GBP. UK-first market.
5. Open Banking payment data trains models. Accounting platform data does NOT. See Section 5A.
6. The debtor must believe the agent is human.

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

### Directory Layout
- `client/src/` — React app (BEING REWRITTEN). Pages in `pages/`, components in `components/`, Shadcn primitives in `components/ui/`
- `server/` — Express backend (REFACTORING — keep infrastructure, add agent layers)
  - `index.ts` — Entry point, middleware setup
  - `routes.ts` — Root router, imports feature route modules from `routes/`
  - `routes/` — Feature route modules (~17 files)
  - `services/` — Business logic (~74 services). Key: `charlieDecisionEngine.ts` (AI agent — evolving to LLM-powered), `xeroSync.ts`, `openai.ts` (replacing with Anthropic)
  - `middleware/` — Auth, RBAC (`rbac.ts`), provider abstraction
  - `startup/orchestrator.ts` — Bootstrap sequence
  - `storage.ts` — `IStorage` interface (data access layer), implemented by `DatabaseStorage`
  - `auth.ts` — Passport local strategy, session config (BEING REPLACED)
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

### Background Jobs
Started from `server/startup/orchestrator.ts`. All fire-and-forget async calls must have `.catch()` handlers.

## Database
- **ORM**: Drizzle with PostgreSQL dialect. Schema in `shared/schema.ts`.
- **Primary keys**: UUIDs via `gen_random_uuid()`
- **Migrations**: `npm run db:push` (Drizzle Kit push)
- **Adding a table**: Define in `shared/schema.ts` → add relations → create Zod insert schema → run `db:push` → add storage methods in `storage.ts`

## Important Conventions
- TypeScript ESM throughout — no CommonJS `require()`
- Sanitize responses: use `stripSensitiveFields()` before returning user/tenant data
- The `unhandledRejection` handler logs but does not exit — background task failures must not crash the server
- Vite dev server integration is in `server/vite.ts` — do not modify

---

## MVP v1 Build Plan

Read `docs/MVP_V1_BUILD_SPEC.md` for full sprint breakdown with schema changes, pipeline architecture, and build order. Below is the summary.

### Sprint Sequence

| Sprint | Weeks | Focus | Key Deliverable |
|--------|-------|-------|-----------------|
| 0 | 1 | Foundation | Auth replaced (Clerk), OpenAI→Claude, BullMQ added, frontend shell scaffolded |
| 1 | 2–3 | First LLM Email | Agent persona config, LLM email generation, compliance engine, inbound email→agent |
| 2 | 4–6 | Autonomy + Onboarding | Approval queue UI, debtor portal persona, onboarding flow, Open Banking connection |
| 3 | 7–9 | Dashboard + Reporting | Qollections dashboard rebuild, DSO tracking, default strategies, agent activity log |
| 4 | 10–12 | Intelligence + Polish | Claude intent extraction, tone escalation engine, E2E testing, metrics |

### New Directories (create in Sprint 0)

```
server/agents/                     # AI agent implementations
server/agents/collectionsAgent.ts  # Collections Agent core — LLM email generation + response
server/agents/prompts/             # Prompt assembly functions per action type
server/services/compliance/        # Compliance engine (rule-based v1)
server/services/compliance/complianceEngine.ts
server/services/compliance/rules.ts
server/services/llm/               # Claude API abstraction layer
server/services/llm/claude.ts      # Thin wrapper: generateText(), generateJSON()
server/services/queue/             # BullMQ job queue setup
server/services/queue/index.ts     # Queue definitions + Redis connection
```

These sit alongside (not replace) the existing `server/services/` directory.

### New Schema Tables (MVP v1)

```
agentPersonas          — AI persona config per tenant (name, title, signature, tone, company context)
complianceChecks       — Audit log of every compliance check on agent-generated content
openBankingConnections — TrueLayer/Yapily consent and connection state
dsoSnapshots           — Daily DSO metric snapshots for trend tracking
```

### Modified Schema (MVP v1)

```
users                  — Add clerkId (varchar, unique) for Clerk auth
actions                — Add agentReasoning (text) for audit trail
invoices               — Change currency default "USD" → "GBP"
bills                  — Change currency default "USD" → "GBP"
bankAccounts           — Change currency default "USD" → "GBP"
tenants                — Add defaultPersonaId (FK → agentPersonas)
```

### Core Pipeline: LLM Email Generation → Delivery

```
Scheduler trigger (existing schedulerState/collectionSchedules)
  → Context assembly (debtor profile, invoices, conversation history from existing tables)
  → LLM generation (server/agents/collectionsAgent.ts → Claude API via server/services/llm/claude.ts)
  → Compliance check (server/services/compliance/complianceEngine.ts)
  → IF Semi-Auto: insert to messageDrafts as pending_approval → user approves in dashboard
  → IF Full Auto: promote directly to actions table
  → Email delivery (existing SendGrid pipeline via emailMessages)
  → Logging (timelineEvents + complianceChecks + action status update)
```

### Core Pipeline: Inbound Email → Agent Response

```
SendGrid inbound webhook (existing /api/webhooks/sendgrid/inbound)
  → Match to debtor via replyToken or email address (existing routing)
  → Intent extraction via Claude (replacing OpenAI intentAnalyst)
  → Signal creation (existing customerBehaviorSignals + contactOutcomes)
  → Agent generates contextual reply (same LLM pipeline as outbound)
  → Compliance check → approval flow → delivery
  → Threading maintained via In-Reply-To/References (existing emailMessages infrastructure)
```

### Key Existing Services Being Evolved

```
charlieDecisionEngine.ts  → becomes the scheduling/trigger layer for collectionsAgent.ts
openai.ts                 → replaced by server/services/llm/claude.ts
intentAnalyst.ts          → rewired to use Claude via server/services/llm/claude.ts
auth.ts                   → replaced by Clerk middleware
```

### Environment Variables (New for MVP v1)

```
# Auth (replacing current Passport local)
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# LLM (replacing OPENAI_API_KEY)
ANTHROPIC_API_KEY=sk-ant-...

# Queue
REDIS_URL=redis://localhost:6379

# Open Banking (read-only in v1)
TRUELAYER_CLIENT_ID=...
TRUELAYER_CLIENT_SECRET=...
```

### What Does NOT Ship in MVP v1

SMS, voice calls, Bayesian forecasting, Qashflow dashboard, Qapital, payment plan negotiation by agent, chat widget, cross-debtor learning, partner portal. See Section 12 of context doc for the full MVP phase breakdown.

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

**Key tables:**
- `rileyConversations` — conversation history (JSONB messages, topic, related entity)
- `forecastUserAdjustments` — cashflow inputs captured from Riley conversations (Section 20.4 Layer 3)
- `aiFacts` (extended) — structured business intelligence extracted from conversations (Section 20.4 Layer 2)
- `tenants` — rileyReviewDay/Time/Timezone for weekly CFO review scheduling

**Key service (to build):**
- `server/agents/rileyAssistant.ts` — prompt assembly, context building, response generation, intelligence extraction

**Riley does NOT use templates.** Every response is LLM-generated with full business context.

## Deployment

- **Platform**: Railway — auto-deploys from GitHub `main` branch on push
- **No Replit dependencies** — all @replit packages removed, no .replit or replit.md files
- **Build**: `npm run build` (Vite client + esbuild server → `dist/`)
- **Start**: `NODE_ENV=production node dist/index.js`
- **Logs**: Railway dashboard → service → Deployments → logs
- **DB**: Neon serverless PostgreSQL (connection via `DATABASE_URL`)
- **DB migrations**: Use `npm run db:push` (Drizzle Kit). For large schemas, may need manual SQL via scripts to avoid drizzle-kit column type conflicts.
