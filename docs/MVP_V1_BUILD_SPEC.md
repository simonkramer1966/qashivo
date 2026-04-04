# QASHIVO — MVP v1 BUILD SPECIFICATION

**Version:** 1.0 — 12 March 2026
**Scope:** Months 1–3 (MVP v1)
**Reference:** QASHIVO_CONTEXT.md v4.1 (Sections 12, 18, 4.1, 4.4, 8B, 8C, 10, 19)
**Strategy:** REFACTOR (backend) + REWRITE (frontend) + REPLACE (auth)

---

## PART 1: CODEBASE ASSESSMENT — WHAT EXISTS vs WHAT MVP v1 NEEDS

### 1.1 Existing Infrastructure That Maps Directly to MVP v1 (KEEP)

The current codebase has 5,058 commits of production infrastructure. The following systems are directly usable for MVP v1 with minimal modification:

**Production-Grade (use as-is or extend lightly):**

| System | Schema Tables | Status | MVP v1 Action |
|--------|--------------|--------|---------------|
| Multi-tenant isolation | `tenants`, tenant-scoped queries, middleware | Production | No changes — already isolates per tenant |
| RBAC & permissions | `users`, `permissions`, `rolePermissions` (50+ permissions, 6 tiers) | Production | Add Staff debtor assignment in MVP v2. Sufficient for v1. |
| Drizzle ORM schema | 80+ tables across all domains | Production | Extend with new agent persona + compliance tables |
| Email infrastructure | `emailMessages`, `conversations`, `emailSenders`, `emailDomainMappings`, SendGrid abstraction | Production | Rewire from template → LLM generation pipeline |
| Inbound email parsing | `inboundMessages`, `emailClarifications`, routing logic | Production | Route to AI agent instead of static Intent Analyst |
| Timeline / conversation history | `timelineEvents`, `actions`, `contactOutcomes` | Production | Add `agentReasoning` field. This IS the ConversationHistory. |
| Contacts & debtor profiles | `contacts`, `customerContactPersons`, `contactNotes`, `debtorProfiles` | Production | Already has AR overlay, playbook fields, risk tags |
| Invoices with workflow state | `invoices` (30+ fields incl. workflow state machine, pause states) | Production | Reusable. Add agent-generated `nextAction` logic. |
| Payment plans | `paymentPlans`, `paymentPlanInvoices` | Production | Reusable for agent negotiation |
| Disputes | `disputes`, lifecycle states, evidence tracking | Production | Reusable. AI persona layer added in MVP v3. |
| Xero integration | OAuth, sync, webhooks, `syncState`, `providerConnections`, `cachedXeroInvoices` | Working | Keep. Fix webhook signature verification gaps noted in handover. |
| Stripe billing | `subscriptionPlans`, `walletTransactions` | Working | Keep. Extend in MVP v4 for usage billing. |
| Zod validation | All API inputs validated | Complete | Keep |

**Substantial (needs evolution but foundation is solid):**

| System | Current State | MVP v1 Evolution |
|--------|--------------|-----------------|
| Intent Analyst (OpenAI-based) | 3-layer: Webhook → AI Analysis → Action Generation. Extracts promise-to-pay, dispute, payment plan, general query. Confidence-based auto-action (≥60%). | Replace OpenAI with Claude. Extend from intent *analysis* to intent *extraction + agent response generation*. The analysis pipeline becomes part of the Collections Agent's inbound processing. |
| Adaptive scheduler / scoring engine | `schedulerState`, `collectionSchedules`, dual-mode, cold-start scoring | Evolve from rule-based scheduler into the AI agent's autonomous decision engine. Existing scoring feeds LLM context. |
| Collection policies | `collectionPolicies` (timer settings, escalation routes, cooldowns) | Keep as guardrails for the agent. Agent operates *within* these policy bounds. |
| Customer behaviour signals | `customerBehaviorSignals` (signal type, confidence, statistics, trend detection) | Foundation for Bayesian debtor models (MVP v2). In v1, signals feed LLM context for email generation. |
| Action effectiveness tracking | `actionEffectiveness` (channel, outcome, response time tracking) | Keep — feeds agent learning about which channels work per debtor |
| Message drafts | `messageDrafts` (pre-generated content with context hashing, freshness detection) | Repurpose: LLM generates into this table, compliance checks before promotion to `actions` |
| Voice integration (Retell AI) | `voiceCalls`, 4 script templates, Retell SDK | Keep for MVP v3 voice. Not active in v1. |
| SMS (Vonage) | `smsMessages`, Vonage SDK | Keep for MVP v2. Not active in v1. |
| Debtor portal | `magicLinkTokens`, `debtorPayments`, PTP, dispute, pay-now | Working. Add agent persona branding in v1. Chat widget deferred to v2. |

**What Needs Removing or Replacing:**

| Item | Action | Reason |
|------|--------|--------|
| Replit Auth (OIDC via `openid-client` + Passport.js) | **Replace** — Sprint 0, Day 1 | Platform-specific, not portable. Sessions table reusable. |
| OpenAI dependency (`intentAnalyst.ts`) | **Replace with Anthropic Claude** | Primary LLM provider per spec. Swap SDK + prompts. |
| Glassmorphism UI + investor demo pages | **Rewrite frontend** | Complete UI redesign per Section 8B. |
| `invoices.currency` default `"USD"` | **Change to `"GBP"`** | UK-first market. Several tables default to USD. |
| `.replit` config, `replit.md` | **Remove** | No longer on Replit |
| Demo tenant data / investor pages | **Remove** | Not needed for build phase |

### 1.2 Gap Analysis — What's Missing for MVP v1

These are the **new systems** required that don't exist in the codebase:

| New System | Spec Reference | Depends On |
|-----------|---------------|-----------|
| **Auth system (Clerk or Auth0)** | Section 19 instruction 5 | Nothing — first task |
| **AI Collections Agent (LLM core)** | Sections 4.1, 4.4, 10 | Auth + existing email/timeline infra |
| **Agent Persona system** | Sections 4.1, 4.4 | New DB tables + settings UI |
| **LLM email generation service** | Sections 4.1, 10, 12 | Agent persona + debtor context assembly |
| **Compliance Agent (rule-based v1)** | Section 4.4, 12 | Sits between LLM output and email delivery |
| **Dynamic prompt assembly engine** | Section 6 AI/LLM Layer | Debtor history + invoices + persona + tone = prompt |
| **Inbound email → agent routing** | Section 4.1 intent capture | Existing inbound parsing → new agent pipeline |
| **Orchestrator (basic routing v1)** | Section 4.4 | Routes events to correct agent |
| **Onboarding Agent ("Riley")** | Section 12 MVP v1 | New conversational setup flow |
| **Open Banking connection (read-only v1)** | Section 5, 5A | TrueLayer/Yapily SDK. Balance + tx history. |
| **New frontend** | Section 8B | Complete rewrite — same framework, new everything |

---

## PART 2: IMPLEMENTATION PLAN — SPRINT-BY-SPRINT

### Sprint 0: Foundation (Week 1)

**Goal:** Replace auth, clean up codebase, establish new project structure. Zero user-facing features — this is plumbing.

**0.1 Authentication Replacement**

The existing auth uses Replit OIDC via `openid-client` + Passport.js with PostgreSQL-backed sessions (`connect-pg-simple`). The session infrastructure and RBAC middleware are valuable; only the identity provider is being swapped.

*Recommended: Clerk (faster to integrate for SaaS, built-in multi-tenant, user management UI, webhook-based session sync). Alternative: Auth0.*

| Task | Detail |
|------|--------|
| Install Clerk SDK | `@clerk/clerk-sdk-node` + `@clerk/clerk-react` |
| Remove Replit auth code | Remove `openid-client`, Passport.js OIDC strategy, Replit-specific callback routes |
| Implement Clerk middleware | Replace `isAuthenticated` middleware. Clerk JWT → extract `userId` + `tenantId`. Existing tenant-scoping middleware stays. |
| Map Clerk users to `users` table | On first sign-in, create/link row in `users` table with `clerkId` field. Preserve existing `tenantId`, `role`, `tenantRole` fields. |
| Preserve session table | Keep `sessions` table for Express session fallback. Clerk primary, session secondary. |
| Add user management | Clerk handles invite-by-email, password reset, MFA. Remove custom `resetToken`/`resetTokenExpiry` fields (Clerk handles this). |
| Preserve RBAC | Existing `permissions` + `rolePermissions` tables + middleware chain stays. Clerk provides identity; app provides authorization. |
| Test tenant isolation | Verify that Clerk auth → tenant lookup → row-level scoping works identically to current flow. |

*Schema change:* Add `clerkId: varchar("clerk_id").unique()` to `users` table. Keep `password` field temporarily for migration; remove once all users migrated.

**0.2 Codebase Cleanup**

| Task | Detail |
|------|--------|
| Remove Replit artefacts | Delete `.replit`, `replit.md`, any Replit-specific env vars |
| Remove demo/investor pages | Remove `investorLeads`, `investmentCallRequests` tables and associated routes/UI |
| Fix currency defaults | Global find-replace: `default("USD")` → `default("GBP")` across schema for `invoices.currency`, `bills.currency`, `bankAccounts.currency`, `exchangeRates`, etc. |
| Replace OpenAI SDK | `npm remove openai`, `npm add @anthropic-ai/sdk`. Update `intentAnalyst.ts` to use Claude. |
| Add BullMQ | `npm add bullmq`. Set up Redis connection. Create base job queue for agent actions. Replace `node-cron` for complex scheduling (keep cron for simple periodic tasks like sync). |
| Establish new folder structure | `server/agents/` (agent implementations), `server/agents/prompts/` (prompt templates), `server/services/llm/` (Claude abstraction), `server/services/compliance/` (rule engine) |

**0.3 New Frontend Scaffold**

| Task | Detail |
|------|--------|
| Clean out existing UI | Remove all glassmorphism pages. Keep `client/` folder structure. |
| Implement shell layout | Sidebar navigation per Section 8B. Header with company name/logo, user menu. |
| Implement Clerk auth UI | `<SignIn />`, `<SignUp />`, `<UserButton />` components. Protected route wrapper. |
| Role-based routing | Owner/FM → Qashflow placeholder. Staff → Qollections dashboard. View Only → Qashflow read-only. |
| Stub pages | Create placeholder pages for every sidebar item. Only Qollections Dashboard and Settings get built in Sprint 1. |

---

### Sprint 1: Agent Persona + First LLM Email (Weeks 2–3)

**Goal:** A customer can configure an AI persona and the system generates its first real, LLM-crafted collection email for an overdue invoice. This is the moment the core innovation comes alive.

**1.1 Agent Persona System**

*New table: `agentPersonas`*

```
agentPersonas
├── id (PK)
├── tenantId (FK → tenants)
├── personaName (varchar) — e.g., "Sarah Mitchell"
├── jobTitle (varchar) — e.g., "Credit Controller"
├── emailSignatureName (varchar) — displayed name in email signature
├── emailSignatureTitle (varchar) — displayed title
├── emailSignatureCompany (varchar) — company name (defaults to tenant.name)
├── emailSignaturePhone (varchar) — optional direct line
├── toneDefault (varchar) — "friendly" | "professional" | "firm"
├── voiceCharacteristics (jsonb) — for MVP v3 voice: gender, accent, pace
├── companyContext (text) — what the agent "knows" about the company
│   e.g., "ABC Recruitment places temporary IT contractors with FTSE 250 clients"
├── sectorContext (varchar) — "recruitment" | "manufacturing" | "general"
├── isActive (boolean)
├── createdAt, updatedAt
```

*Settings UI: Agent Persona page under Settings → Agent Personas*
- Form: persona name, job title, email signature fields, default tone, company context (textarea)
- Preview card showing how the persona will appear in an email signature
- For v1: one persona per tenant. Multi-persona deferred to MVP v3 (Dispute Resolution Agent gets its own persona)

**1.2 LLM Email Generation Service**

This is the core innovation. Every email is LLM-generated, contextual, and persona-consistent. No templates.

*Service: `server/agents/collectionsAgent.ts`*

The service assembles a dynamic prompt per-interaction containing:

```
SYSTEM PROMPT ASSEMBLY:
├── Agent identity (persona name, title, company)
├── Company context (sector, what the company does)
├── Communication rules (tone level, frequency caps, prohibited language)
├── Current autonomy mode (Semi-Auto / Supervised)
│
USER PROMPT ASSEMBLY (per debtor, per action):
├── Debtor profile
│   ├── Company name, contact name, contact email
│   ├── Payment terms, credit limit
│   ├── Historic payment behaviour summary
│   │   (from customerBehaviorSignals: avg days to pay, reliability, trend)
│   ├── Risk tag (NORMAL / HIGH_VALUE)
│   └── Any AR notes
├── Outstanding invoices for this debtor
│   ├── Invoice number, amount, due date, days overdue
│   ├── Current workflow state (pre_due / due / late)
│   └── Pause state if any (dispute / ptp / payment_plan)
├── Conversation history (last 10 interactions from timeline)
│   ├── Channel, direction, date, content summary
│   ├── Any intent signals extracted
│   └── Outcomes recorded
├── Current action context
│   ├── What we're doing (pre-due reminder / follow-up / escalation)
│   ├── Tone level (Friendly / Professional / Firm / Formal)
│   ├── Days since last contact
│   └── Touch count for this debtor
└── INSTRUCTION: Generate email with subject line and body.
    Sign off as the persona.
    (Portal link deferred to MVP v2 — debtor portal not yet built.)
    Do not use template language. Be conversational and natural.
    Reference specific invoice details and any prior conversation.
```

*Claude API call structure:*

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",  // Sonnet for email gen (cost-effective, fast)
  max_tokens: 1024,
  system: systemPrompt,  // persona + rules
  messages: [{ role: "user", content: contextPrompt }]  // debtor + invoice + history + instruction
});
```

*Output:* Parsed into `{ subject: string, body: string, agentReasoning: string }`. The reasoning explains *why* the agent chose this approach (logged for audit trail, never sent to debtor).

**1.3 Compliance Agent (Rule-Based v1)**

Every LLM-generated email passes through compliance before delivery. In v1 this is a rule engine, not LLM-based.

*Service: `server/services/compliance/complianceEngine.ts`*

| Rule | Check | Action on Violation |
|------|-------|-------------------|
| Frequency cap | No more than `maxTouchesPerWindow` contacts in `contactWindowDays` (from tenant settings) | Block + log |
| Channel cooldown | Minimum `channelCooldowns.email` days since last email to this debtor | Block + log |
| Time-of-day | Only send during `businessHoursStart`–`businessHoursEnd` (tenant timezone) | Reschedule |
| Prohibited language | Scan for: legal threats (unless customer-authorised), harassment patterns, profanity, PII leakage (other debtor names/amounts) | Block + flag for human review |
| Data isolation | Verify email content references ONLY the target debtor's invoices (cross-reference amounts/numbers against DB) | Block + alert |
| Statutory compliance | If `useLatePamentLegislation` enabled, verify late payment interest references are calculated correctly | Flag for review |
| Debtor vulnerability | If `isPotentiallyVulnerable` flag set, enforce softer tone ceiling (max Professional) | Regenerate at lower tone |

*Output:* `{ approved: boolean, violations: string[], action: 'send' | 'block' | 'regenerate' | 'queue_for_approval' }`

*New table: `complianceChecks`*

```
complianceChecks
├── id (PK)
├── tenantId (FK)
├── actionId (FK → actions) — the action being checked
├── checkResult (varchar) — "approved" | "blocked" | "regenerated" | "queued"
├── rulesChecked (jsonb) — list of rules evaluated
├── violations (jsonb) — any violations found
├── agentReasoning (text) — why agent generated this content
├── reviewedBy (varchar, FK → users) — if human reviewed
├── reviewedAt (timestamp)
├── createdAt
```

**1.4 Email Generation → Delivery Pipeline**

The end-to-end flow for a single collection email:

```
1. TRIGGER: Scheduler identifies debtor needs contact
   (existing schedulerState + collectionSchedules logic)
   ↓
2. CONTEXT ASSEMBLY: Pull debtor profile, invoices, conversation history
   (existing queries on contacts, invoices, timelineEvents, actions)
   ↓
3. LLM GENERATION: Collections Agent generates email
   (new: server/agents/collectionsAgent.ts → Claude API)
   ↓
4. COMPLIANCE CHECK: Rule engine validates content
   (new: server/services/compliance/complianceEngine.ts)
   ↓
5a. IF Semi-Auto/Supervised: Insert into messageDrafts as "pending_approval"
    → User sees in dashboard → Approves/edits/rejects
   ↓
5b. IF Full Auto (not in v1 default, but architecture supports):
    → Auto-promote to actions table
   ↓
6. DELIVERY: Existing SendGrid email pipeline
   (existing: emailMessages, sendgrid.ts, threading via threadKey/replyToken)
   ↓
7. LOGGING: Create timelineEvent, update action status, record complianceCheck
   (existing timeline infrastructure + new compliance log)
```

**1.5 Inbound Email → Agent Response**

When a debtor replies to an agent email:

```
1. RECEIVE: SendGrid inbound parse webhook → existing inbound routing
   (existing: /api/webhooks/sendgrid/inbound → inboundMessages table)
   ↓
2. MATCH: Route to debtor via replyToken or email address matching
   (existing: emailMessages.replyToken lookup, contact email matching)
   ↓
3. INTENT EXTRACTION: Replace OpenAI with Claude for intent analysis
   Extract: promise_to_pay (+ date), acknowledge, dispute, payment_query, general
   (replace: intentAnalyst.ts → new claude-based extraction)
   ↓
4. SIGNAL CREATION: Create intent signal in existing structures
   (existing: customerBehaviorSignals, contactOutcomes)
   ↓
5. AGENT RESPONSE: Collections Agent generates contextual reply
   Prompt includes: original thread, debtor's reply, extracted intent, conversation history
   ↓
6. COMPLIANCE CHECK → APPROVAL FLOW → DELIVERY
   (same pipeline as outbound, steps 4-7 above)
   ↓
7. THREADING: Reply maintains email thread via In-Reply-To / References headers
   (existing: emailMessages threading infrastructure)
```

---

### Sprint 2: Autonomy Controls + Debtor Portal + Onboarding (Weeks 4–6)

**2.1 Autonomy Modes**

The existing schema already has `approvalMode` on `tenants` with values `manual`, `auto_after_timeout`, `full_auto`. Map these to the spec's terminology:

| Spec Term | DB Value | Behaviour |
|-----------|----------|-----------|
| Supervised | `manual` | Every agent action requires human approval before send |
| Semi-Auto (default) | `auto_after_timeout` | Agent actions auto-send after `approvalTimeoutHours` if not reviewed. Exceptions always require approval. |
| Full Auto | `full_auto` | Agent sends immediately after compliance check passes. Exceptions still flagged. |

*Settings UI: Autonomy & Rules page*
- Radio selection: Supervised / Semi-Auto / Full Auto
- Timeout hours slider (for Semi-Auto)
- Exception rules toggles (already in schema as `exceptionRules` JSONB):
  - Flag first contact with new debtor
  - Flag invoices over threshold (configurable)
  - Flag dispute keywords detected
  - Flag VIP customers (manual tag on contact)

*Approval Queue UI (part of Qollections Dashboard):*
- List of pending agent actions with: debtor name, invoice(s), generated email preview, agent reasoning, compliance check result
- Actions: Approve (sends as-is), Edit (opens editor, then approve), Reject (with reason logged), Snooze
- Existing `actions.status = 'pending_approval'` field supports this

**2.2 Debtor Portal — Agent Persona Branding**

The existing portal has magic link auth, invoice display, PTP, dispute, and pay-now. For v1, add:

| Enhancement | Detail |
|-------------|--------|
| Persona header | Show agent persona: "Your account is managed by **Sarah Mitchell**, Credit Controller at ABC Recruitment" with optional avatar |
| Company branding | Use `tenants.companyLogoUrl`, `tenants.brandPrimaryColor` for portal styling |
| Portal link in emails | **Deferred to MVP v2** — portal link placeholder removed from all prompts and templates (4 April 2026). Will be re-added when debtor portal is production-ready. |
| Intent signals from portal | All portal actions (acknowledge, PTP, dispute, pay-now, payment plan request) create entries in `customerBehaviorSignals` and `contactOutcomes` |

**2.3 Onboarding Agent ("Riley")**

Riley is a conversational setup assistant — NOT a traditional wizard. Implemented as a full-page guided flow with a chat-like interface.

*Onboarding steps (tracked via existing `onboardingProgress` table):*

| Step | What Happens | Existing Infra |
|------|-------------|---------------|
| 1. Welcome | Riley introduces Qashivo, explains the setup | New UI |
| 2. Connect Xero | OAuth flow to connect accounting platform | Existing Xero OAuth |
| 3. Connect Open Banking | TrueLayer/Yapily consent flow — "Connect your bank for better cashflow forecasts" | New (see 2.4) |
| 4. Create Agent Persona | Name, title, email signature, default tone, company context | New (Sprint 1 tables) |
| 5. Set Communication Preferences | Autonomy level, business hours, frequency limits | Existing tenant settings |
| 6. Review Imported Debtors | Show debtors synced from Xero, highlight top overdue | Existing contacts/invoices |
| 7. Qapital Eligibility Check | Quick assessment — "You may be eligible for £X in invoice finance" | Placeholder in v1 |
| 8. Go Live | Enable the Collections Agent — first emails queued | Flip `onboardingCompleted` |

*Implementation:* React multi-step form. Riley's conversational copy is static in v1 (hardcoded per step with contextual variations). LLM-powered Riley conversation deferred to v2.

**2.4 Open Banking Connection (Read-Only v1)**

MVP v1 connects Open Banking for balance and transaction history. Pattern detection and Bayesian models are MVP v2. In v1, the connection is established and data begins accumulating.

| Task | Detail |
|------|--------|
| Provider | TrueLayer (recommended — wider UK bank coverage, better developer experience) or Yapily |
| Consent flow | Integrated into onboarding step 3. Customer authenticates with their bank via TrueLayer's hosted flow. |
| Data retrieved | Current account balance, last 90 days of transactions |
| Storage | `bankAccounts` table (already exists) + `bankTransactions` table (already exists) |
| Sync | Daily sync via scheduled job. Store raw transactions. Classification deferred to v2. |
| No training in v1 | Open Banking data is stored but not yet used for Bayesian models. Displayed as bank balance on dashboard. |

*New table: `openBankingConnections`*

```
openBankingConnections
├── id (PK)
├── tenantId (FK)
├── provider (varchar) — "truelayer" | "yapily"
├── consentId (varchar) — provider consent reference
├── consentStatus (varchar) — "active" | "expired" | "revoked"
├── accountIds (jsonb) — list of connected account IDs
├── lastSyncAt (timestamp)
├── consentExpiresAt (timestamp)
├── createdAt, updatedAt
```

---

### Sprint 3: Dashboard, Reporting & Default Strategies (Weeks 7–9)

**3.1 Qollections Dashboard**

*Rebuild using existing data, new UI per Section 8B:*

| Widget | Data Source | Detail |
|--------|-----------|--------|
| AR Summary Cards | `invoices` aggregate queries | Total outstanding, total overdue, current DSO, total debtors |
| Ageing Chart | `invoices.dueDate` calculation | Bar chart: current, 1-30, 31-60, 61-90, 90+ days |
| Agent Activity Feed | `actions` + `complianceChecks` | Last 20 agent actions: email sent, reply received, PTP captured, compliance check result |
| Approval Queue | `actions WHERE status = 'pending_approval'` | Cards showing pending emails with preview + approve/edit/reject |
| Debtor List | `contacts` with invoice aggregates | Sortable table: name, outstanding, oldest overdue, last contact, next action, status |
| Items Needing Attention | `attentionItems` (existing table) | Broken promises, disputes, no response after X touches, compliance blocks |

**3.2 DSO Tracking**

*New table: `dsoSnapshots`*

```
dsoSnapshots
├── id (PK)
├── tenantId (FK)
├── snapshotDate (date)
├── dsoValue (decimal) — days sales outstanding
├── totalReceivables (decimal)
├── totalRevenue90d (decimal) — trailing 90-day revenue for DSO calc
├── overdueAmount (decimal)
├── overduePercentage (decimal)
├── createdAt
```

Daily cron job calculates and stores DSO. Dashboard shows DSO trend chart (line graph, last 90 days). This is a key metric for bank buyer due diligence.

**3.3 Default Strategy Seeding**

When a debtor first enters the system (imported from Xero), the agent needs a starting strategy. Without Open Banking history (no Bayesian model yet), use sector defaults:

*Recruitment sector defaults:*

```
Day -5:  Email (Friendly) — Pre-due courtesy reminder
         "Hi {contact}, just a heads-up that invoice {number} for {amount} is due on {date}."
Day 0:   Email (Friendly) — Due date notification
Day +3:  Email (Professional) — Follow-up with portal link
Day +7:  Email (Professional) — Second follow-up, reference previous email
Day +14: Email (Firm) — Urgency, request specific payment date
Day +21: Email (Firm) — Escalation warning
Day +30: Flag for ATTENTION — human intervention recommended
```

These are NOT templates — they are *instructions to the LLM* about what kind of email to generate at each stage. The LLM produces unique, contextual content every time. The strategy provides timing, channel, and tone guidance.

The existing `collectionPolicies` table stores timing parameters. The existing `contacts.playbookStage` and scheduler state track where each debtor is in the sequence. The new piece is that the scheduler triggers LLM generation instead of template selection.

**3.4 Agent Activity Log**

*Reuse existing `actions` table with enhanced UI:*

| Column | Source |
|--------|--------|
| Timestamp | `actions.createdAt` |
| Debtor | `contacts.name` via `actions.contactId` |
| Action Type | `actions.type` (email, note, etc.) |
| Status | `actions.status` (pending_approval, sent, completed, etc.) |
| Agent Reasoning | New `actions.agentReasoning` field or from `complianceChecks.agentReasoning` |
| Compliance | `complianceChecks.checkResult` |

---

### Sprint 4: Intent Extraction, Tone Escalation & Polish (Weeks 10–12)

**4.1 Intent Extraction (Claude-Powered)**

Replace the OpenAI Intent Analyst with Claude-based extraction. The existing `inboundMessages` table and extraction pipeline remain — only the AI engine changes.

*Claude extraction prompt structure:*

```
Analyse this debtor email reply and extract structured intent:

DEBTOR: {name} at {company}
REGARDING: Invoice(s) {numbers} totalling {amount}
THEIR REPLY: {email_content}
CONVERSATION CONTEXT: {last 3 exchanges}

Extract:
1. intent_type: promise_to_pay | acknowledge | dispute | payment_query | 
   payment_notification | general | unclear
2. If promise_to_pay: extract date (specific or relative, e.g., "end of month" → {date})
3. If dispute: extract dispute_reason and which invoice(s) affected
4. confidence: 0.0–1.0
5. sentiment: positive | neutral | negative | frustrated
6. suggested_agent_response_approach: brief guidance for the Collections Agent's reply

Return as JSON.
```

*Storage:* Results written to existing `inboundMessages` fields (`intentType`, `intentConfidence`, `sentiment`, `extractedEntities`). New field `suggestedApproach` added to `extractedEntities` JSONB.

**4.2 Tone Escalation Engine**

The spec defines 5 tone levels: Friendly → Professional → Firm → Formal → Legal/Pre-action.

*Logic (in Collections Agent):*

```
Determine tone for debtor {contact} on invoice {invoice}:

INPUTS:
- days_overdue
- last_intent_signal (and when received)
- touch_count (outbound contacts for this invoice)
- promise_reliability (from customerBehaviorSignals)
- was_previously_good_payer (trend from debtorProfile)
- tenant_style (GENTLE / STANDARD / FIRM from tenant settings)

DEFAULT ESCALATION (STANDARD style):
  pre-due to +7 days → Friendly
  +7 to +14 → Professional  
  +14 to +30 → Firm
  +30 to +60 → Formal
  +60+ → Legal/Pre-action (only if tenant has enabled)

ADJUSTMENTS:
  - Debtor engaged recently (replied, acknowledged): hold or step back one level
  - Broken promise: skip forward one level
  - Previously reliable payer, first late: hold at Friendly longer
  - Tenant style GENTLE: shift all thresholds +7 days
  - Tenant style FIRM: shift all thresholds -3 days
  - isPotentiallyVulnerable: cap at Professional
```

The tone level is passed to the LLM as part of the prompt. The LLM adapts its language, formality, and urgency accordingly. This is NOT changing a template — the entire email is regenerated with the appropriate tone.

**4.3 User Role Implementation**

Map existing schema roles to spec roles:

| Spec Role | DB `tenantRole` | Home View | Permissions |
|-----------|----------------|-----------|-------------|
| Owner | `owner` | Qashflow placeholder (v1: Qollections) | Full access to everything |
| Finance Manager | `accountant` or `manager` | Qashflow placeholder (v1: Qollections) | Full Qollections + Qashflow. No billing/user mgmt. |
| Staff / Credit Controller | `credit_controller` | Qollections dashboard | Assigned debtors only (assignment deferred to v2, see all in v1) |
| View Only | `readonly` | Qollections dashboard (read-only) | View all, change nothing |

User invitation: Owner invites via email (Clerk handles invitation flow). Owner assigns `tenantRole` via Settings → Users & Roles.

**4.4 Final Polish**

| Task | Detail |
|------|--------|
| Error handling | Graceful degradation if Claude API is down (queue emails, retry). If Xero sync fails, show last-synced-at timestamp. |
| Rate limiting | Claude API rate limits respected via BullMQ job queue with configurable concurrency. |
| Metrics logging | Every agent action logs: debtor, invoice, channel, tone, compliance result, response time, outcome. Foundation for bank buyer metrics. |
| E2E testing | Test: new customer onboarding → Xero connect → persona setup → first email generated → debtor replies → intent extracted → agent responds |
| Currency display | All monetary values formatted as GBP (£) with `Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })` |

---

## PART 3: SCHEMA MIGRATION SUMMARY

### New Tables for MVP v1

| Table | Purpose |
|-------|---------|
| `agentPersonas` | AI persona configuration per tenant |
| `complianceChecks` | Audit log of every compliance check on agent content |
| `openBankingConnections` | TrueLayer/Yapily consent and connection state |
| `dsoSnapshots` | Daily DSO metric snapshots for trend tracking |

### Modified Tables

| Table | Changes |
|-------|---------|
| `users` | Add `clerkId` (varchar, unique). Remove Replit-specific fields eventually. |
| `actions` | Add `agentReasoning` (text) — why the agent chose this action/content |
| `invoices` | Change `currency` default from `"USD"` to `"GBP"` |
| `bills` | Change `currency` default from `"USD"` to `"GBP"` |
| `bankAccounts` | Change `currency` default from `"USD"` to `"GBP"` |
| `tenants` | Add `defaultPersonaId` (FK → agentPersonas). Existing autonomy fields reused. |

### Tables to Remove (or ignore)

| Table | Reason |
|-------|--------|
| `investorLeads` | Investor demo — not needed |
| `investmentCallRequests` | Investor demo — not needed |
| `partnerWaitlist` | Replace with proper partner flow later |

---

## PART 4: RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM generates inappropriate content | Medium | High | Compliance Agent catches rule violations. Semi-Auto mode means human reviews before send. Prohibited language patterns. |
| LLM latency causes poor UX | Low-Med | Medium | Async generation via BullMQ. Pre-generate emails in batch during off-hours. Sonnet model for speed. |
| Claude API downtime | Low | High | Queue-based architecture — emails queue and send when API recovers. No real-time dependency. |
| Clerk auth migration breaks existing sessions | Low | High | Parallel auth during migration. Test thoroughly in Sprint 0. |
| Open Banking consent rates low in onboarding | Medium | Low (v1) | Position clearly: "Connect your bank for better cashflow forecasts." Not blocking for v1 — Qollections works without it. |
| Debtor identifies agent as AI | Medium | Medium | Quality of LLM output + conversation memory + persona consistency. Semi-Auto review catches robotic output. Prompt engineering critical. |
| Email deliverability (SPF/DKIM/DMARC) | Low-Med | High | Use existing SendGrid domain verification. Agent sends from customer's domain (existing `emailSenders` + `emailDomainMappings` tables). |

---

## PART 5: BUILD ORDER SUMMARY

```
WEEK 1  (Sprint 0):  Auth replacement + cleanup + frontend scaffold
WEEK 2  (Sprint 1):  Agent persona tables + LLM service + first generated email
WEEK 3  (Sprint 1):  Compliance engine + approval flow + inbound email → agent
WEEK 4  (Sprint 2):  Autonomy controls UI + approval queue
WEEK 5  (Sprint 2):  Debtor portal persona branding + onboarding flow
WEEK 6  (Sprint 2):  Open Banking connection + onboarding completion
WEEK 7  (Sprint 3):  Qollections dashboard rebuild
WEEK 8  (Sprint 3):  DSO tracking + default strategies + agent activity log  
WEEK 9  (Sprint 3):  Settings pages (persona, autonomy, integrations, users)
WEEK 10 (Sprint 4):  Claude intent extraction replacing OpenAI
WEEK 11 (Sprint 4):  Tone escalation engine + strategy adaptation
WEEK 12 (Sprint 4):  Polish, E2E testing, metrics logging, bug fixes
```

**MVP v1 is complete when:**
1. A customer can sign up, connect Xero, create an agent persona, and go live
2. The AI agent generates and sends (after approval) unique, contextual collection emails
3. When a debtor replies, the agent extracts intent and generates a contextual response
4. Every outbound email passes compliance checks with a full audit trail
5. The customer sees their AR dashboard with agent activity, approval queue, and DSO trend
6. The debtor portal shows the agent persona and captures intent signals
7. Open Banking is connected and accumulating transaction data for MVP v2

**What explicitly does NOT ship in MVP v1:** SMS, voice calls, Bayesian forecasting, Qashflow dashboard, Qapital, payment plan negotiation by agent, chat widget, Full Auto mode (available in settings but not default), cross-debtor learning, partner portal.

---

*This spec should be used alongside QASHIVO_CONTEXT.md (the canonical product spec) and the existing codebase. Every implementation decision above preserves the existing infrastructure described in Section 18 while adding the new AI agent layer described in Sections 4.1, 4.4, 10, and 12.*
