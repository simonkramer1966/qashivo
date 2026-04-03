# CHARLIE ENGINEERING SPEC — v1.2
## Qashivo Collections Decision Engine — Architecture, Gaps, and Handover Documentation

**Version:** 1.2  
**Date:** April 2026  
**Status:** All 14 gaps implemented. Three known issues remain open (documented below).  
**Purpose:** Authoritative handover document for any developer inheriting this codebase. Explains not just what was built but why every decision was made.

---

## CONTENTS

1. What Charlie Is
2. Architecture Overview
3. Key Files Reference
4. The 14 Engineering Gaps — Problem, Decision, Implementation, Current State
5. Known Remaining Issues
6. Architectural Decisions Requiring Human Judgement
7. Test Cases and Verification Queries
8. What Was Deliberately Deferred to v2

---

## 1. WHAT CHARLIE IS

Charlie is Qashivo's autonomous collections decision engine. He is not a rules engine with templates — every decision is data-driven and every message is LLM-generated (via Anthropic Claude API) in the voice of a configured agent persona.

Charlie's job on every cycle:
1. Scan all overdue invoices for a tenant
2. Score each debtor by priority (who needs chasing today)
3. Select the optimal contact channel (email → SMS → voice escalation path)
4. Determine the correct tone (Friendly → Professional → Firm → Formal → Legal)
5. Generate a personalised message via LLM with full debtor behavioural context
6. Consolidate multiple invoices per debtor into one action (never spam)
7. Queue actions for approval or auto-send depending on tenant autonomy settings
8. Learn from every outcome to improve future decisions

**Why no templates?** Templates produce robotic, generic communications that debtors recognise and ignore. LLM-generated messages with full context (payment history, prior contact count, broken promises, debtor segment, relationship notes from Riley) produce materially higher response rates. This is a core product differentiator and a hard rule: if a generated message reads like a template, the prompt context is insufficient.

---

## 2. ARCHITECTURE OVERVIEW

### Trigger Cycle

```
collectionsScheduler.ts (continuous background process)
  │
  ├── Phase 1: Planning (hourly)
  │     ActionPlanner.planActionsForAllTenants()
  │     → Scans all overdue invoices across all tenants
  │     → Calls charlieDecisionEngine per debtor
  │     → Creates agentActions with status='scheduled'
  │
  ├── Phase 2: Execution (every 10 minutes)
  │     Finds actions where scheduledFor <= NOW() AND status='approved'
  │     → actionExecutor.executeAction()
  │     → Compliance check → send via wrapper → log outcome
  │
  └── portfolioController.ts (nightly)
        Recomputes per-debtor urgency weights
        Updates customerLearningProfiles.debtorUrgency
```

### Decision Pipeline (per debtor, per cycle)

```
charlieDecisionEngine.ts
  │
  ├── calculatePriorityScore()
  │     → Overdue severity (5–40 pts)
  │     → Amount at risk (10–15 pts)
  │     → Contact recency (5–15 pts)
  │     → Missed PTP bonus (+20 pts)
  │     → Exclusion checks (dispute, hold, active PTP, legal, wrong party)
  │
  ├── selectChannel()
  │     → Strict escalation: email → SMS → voice
  │     → Channel preference hard overrides (customerPreferences table)
  │     → Channel effectiveness scores from customerLearningProfiles
  │     → Segment rules (enterprise = email only, vulnerable = email only)
  │
  ├── determineTone()
  │     → toneEscalationEngine.ts
  │     → Baseline from days overdue × tenant style (GENTLE/STANDARD/FIRM)
  │     → Behavioural adjustments (PRS, serial promiser, deteriorating)
  │     → Velocity cap: ±1 step per cycle maximum (Gap 5)
  │     → Hard caps: vulnerable max Professional, legal response window blocked
  │
  ├── calculatePerDebtorUrgency() (nightly, stored in profile)
  │     → baseUrgency × contributionWeight × trendMultiplier
  │
  └── applyChannelPreferenceOverride()
        → Hard stop if all channels disabled → action skipped + logged
```

### Learning Pipeline (continuous)

```
Outbound send
  → SendGrid custom_args attached (tenant_id, action_id, contact_id)
  → Delivery webhook fires → event-bus.ts processDeliveryOutcome()
      → Updates action delivery status (Gap 8)
      → processEffectivenessUpdate() → channelEffectivenessService.ts
          → Three-tier scoring: delivery 0.2, engagement 0.2, payment 0.6
          → Adaptive EMA update on customerLearningProfiles

Xero sync detects invoice PAID transition
  → processPaymentAttribution() in channelEffectivenessService.ts
      → Attribution window: same-day excluded, 48h = full credit,
        7d = partial credit (configurable per tenant)
      → Multi-channel credit: 0.3 to earlier channels in sequence
      → Updates emailEffectiveness/smsEffectiveness/voiceEffectiveness
```

### Inbound Reply Pipeline

```
SendGrid inbound parse webhook → /api/webhooks/sendgrid/inbound
  → Token validation (INBOUND_WEBHOOK_TOKEN env var)
  → Match to debtor via replyToken or email address
  → intentAnalyst.ts → Claude API → intent extraction
      Intents: promise_to_pay, dispute, payment_plan, query, complaint, other
  → customerBehaviorSignals updated
  → contactOutcomes recorded
  → forecastUserAdjustments created if intent = promise_to_pay (Gap resolved)
  → Contextual agent reply generated → compliance check → approval flow → send
```

---

## 3. KEY FILES REFERENCE

| File | Role |
|------|------|
| `server/services/charlieDecisionEngine.ts` | Core brain: priority scoring, channel selection, per-debtor urgency, confidence |
| `server/services/toneEscalationEngine.ts` | 5-tone scale, behavioural adjustments, velocity cap (Gap 5) |
| `server/services/actionPlanner.ts` | Scans invoices, creates actions, consolidates per debtor, group enforcement |
| `server/services/collectionsScheduler.ts` | Background triggers: hourly planner, 10-min executor |
| `server/services/portfolioController.ts` | Nightly per-debtor urgency calculation |
| `server/services/aiMessageGenerator.ts` | LLM message generation, circuit breaker integration |
| `server/services/promiseReliabilityService.ts` | PRS calculation with Bayesian prior (Gap 2) |
| `server/services/channelEffectivenessService.ts` | Three-tier effectiveness model, payment attribution (Gap 1) |
| `server/services/collectionLearningService.ts` | Channel learning (cold start warm start Gap 6), A/B testing |
| `server/services/paymentDistribution.ts` | Log-normal P(Pay) model (Gap 7) |
| `server/services/llmCircuitBreaker.ts` | Per-tenant circuit breaker, template fallback (Gap 9) |
| `server/services/templateFallback.ts` | 10 fallback templates: 5 email + 5 SMS across all tone levels |
| `server/services/llmOutputValidator.ts` | Post-generation validation: length, debtor name, invoice refs, tone |
| `server/services/debtorEnrichmentService.ts` | Companies House enrichment, credit risk scoring (Gap 6 Part B) |
| `server/services/companiesHouse.ts` | Companies House API integration |
| `server/services/debtorGroupRoutes.ts` | Debtor group CRUD, Riley group detection (Gap 12) |
| `server/services/probablePaymentService.ts` | Unreconciled payment matching, three confidence tiers (Gap 14) |
| `server/startup/legalWindowJob.ts` | Daily 30-day statutory response window enforcement (Gap 10) |
| `server/lib/adaptive-scheduler.ts` | ML-enhanced timing, P(Pay) integration, weekday/channel scoring |
| `server/agents/rileyAssistant.ts` | Riley AI assistant, debtor context injection |

---

## 4. THE 14 ENGINEERING GAPS

Each gap entry documents: the original problem, why it mattered, the decision made, what was implemented, and the current state.

---

### GAP 1 — Feedback Loop: Channel Effectiveness Scoring on Incomplete Data

**Original problem:**  
Channel effectiveness scores (emailEffectiveness, smsEffectiveness, voiceEffectiveness) in `customerLearningProfiles` were being updated only from SendGrid webhook events (open, click, reply). These events are unreliable — Apple Mail Privacy Protection pre-fetches emails causing false opens; corporate spam filters click links on delivery; reply rates are low even for effective emails. A debtor who always opens emails but never triggers a pixel would be scored as low-effectiveness for email, causing Charlie to switch them to SMS unnecessarily.

Additionally, the ultimate signal — payment received after communication — was not being fed back into effectiveness scores at all.

**Why it mattered:**  
Incorrect channel effectiveness scores cause Charlie to use suboptimal channels for each debtor. At scale across a tenant's portfolio, this means higher friction, lower response rates, and slower cash collection. It also corrupts the learning loop — the system gets worse over time rather than better.

**Decision made:**  
Replace single-signal scoring (webhook events only) with a three-tier weighted model:
- Delivery tier (weight 0.2): delivery confirmed, bounce detected
- Engagement tier (weight 0.2): open, click, reply
- Payment tier (weight 0.6): payment received within attribution window

The payment tier dominates because it is the only unambiguous signal. All other signals are proxies.

Attribution window for payment credit: same-day excluded (customer was already paying), 48h = full credit, 7d = partial credit. Multi-channel attribution: if email was sent 3 days before SMS and payment arrives 1 day after SMS, SMS gets full credit but email gets 0.3 credit for having softened the debtor.

**What was implemented:**  
New service `channelEffectivenessService.ts` with:
- `calculateInteractionEffectiveness()` — three-tier scoring per interaction
- `processPaymentAttribution()` — triggered by Xero sync detecting invoice PAID transitions
- `processEffectivenessUpdate()` — event bus subscriber, updates scores via adaptive EMA
- Hard bounce override: bypasses EMA entirely, drops email effectiveness to 0.1 immediately
- Three configurable tenant settings: `paymentAttributionFullCreditHours`, `paymentAttributionPartialCreditDays`, `paymentAttributionSameDayExcluded`

**Current state — IMPLEMENTED with known limitation:**  
The new service is live. However: two scoring services now coexist. The old `collectionLearningService.calculateEffectiveness()` still exists and is used by A/B testing and the `actionPlanner` optimisation path. This is intentional — the old service handles a different concern (action optimisation) not channel effectiveness per se. A developer inheriting this code should be aware of both services and their distinct roles. See Known Remaining Issues for full detail.

---

### GAP 2 — PRS Has No Minimum Sample Size Guard

**Original problem:**  
Promise Reliability Score (PRS) = (promises kept × 100 + partially kept × 50) / total resolved promises. A debtor with exactly one kept promise scores PRS 100 — identical to a debtor with 20 kept promises. Charlie treated both as maximally reliable: friendly tone, relaxed cadence, benefit of the doubt. One datapoint is not a pattern; the formula was overconfident on thin data.

**Why it mattered:**  
PRS is the single most important debtor metric. It directly drives tone selection (Gap 5 velocity cap aside). An inflated PRS from one lucky data point means Charlie sends friendly emails to debtors who may be unreliable — discovering the truth only after several more missed promises, by which point days of recovery time are lost.

**Decision made:**  
Apply a Bayesian prior that regresses thin-data scores toward the population mean. Parameters: k=3 (prior weight equivalent to 3 observations), prior=60 (system default PRS). With k=3, a debtor with 1 kept promise scores approximately 70 (not 100). A debtor with 10 kept promises scores approximately 93. The prior weakens as sample size grows, becoming negligible at n≥20.

Population mean (10+ scored debtors) used in preference to the system default when available. This makes the prior tenant-specific — a tenant whose debtors are generally reliable gets a higher prior, correctly.

Add recency weighting: 90-day half-life decay. A promise kept 200 days ago counts for less than a promise kept 20 days ago. Recent behaviour is the best predictor of near-future behaviour.

**What was implemented:**  
- `promiseReliabilityService.ts` updated with Bayesian calculation
- New columns `prsRaw` and `prsConfidence` on `customerLearningProfiles` (transparency — raw score preserved alongside adjusted score)
- Rolling windows now filter by `evaluatedAt` (resolution date) not `createdAt`
- All behavioural flags use Bayesian-adjusted PRS
- `calculationVersion` bumped to "2.0" on recalculation
- Regression toward tenant population mean requires 10+ scored debtors; falls back to system default 60 otherwise

**Current state — IMPLEMENTED. No known issues.**

---

### GAP 3 — Portfolio Controller Applies Urgency Uniformly

**Original problem:**  
The nightly Portfolio Controller computed a single tenant-level urgency factor (0.1–1.0) based on projected DSO vs target DSO, then applied it uniformly across all debtors. If one large debtor was dragging DSO above target, Charlie became more aggressive with every debtor in the portfolio — including good payers with current invoices, new customers who shouldn't be pressured, and small-balance debtors where the urgency was disproportionate.

**Why it mattered:**  
Unnecessary pressure on good payers damages relationships. Qashivo's value proposition includes protecting client relationships — aggressive collection of current invoices from reliable customers directly contradicts this. The uniform approach also obscured which debtors were actually causing the DSO problem.

**Decision made:**  
Calculate per-debtor urgency weights based on each debtor's actual contribution to the overdue problem. Normalise so that the average debtor gets weight 1.0. Debtors whose outstanding balance is above average and trending worse get weights above 1.0; debtors who are improving or have small balances get weights below 1.0. Apply the tenant-level urgency factor only as a multiplier on these per-debtor weights — not as a flat override.

Formula: `debtorUrgency = baseUrgency × contributionWeight × trendMultiplier`
- `contributionWeight` = debtor's overdue amount / mean overdue amount across all debtors (normalised to 1.0)
- `trendMultiplier` = 1.0–1.5 for deteriorating debtors, 0.5–1.0 for improving debtors

**What was implemented:**  
- `calculatePerDebtorUrgency()` added to `charlieDecisionEngine.ts`
- Runs nightly after `recomputeUrgency()`
- Writes four new columns to `customerLearningProfiles`: `debtorUrgency`, `contributionWeight`, `trendMultiplier`, `urgencyUpdatedAt`
- Both `actionPlanner.ts` consumer paths read `debtorUrgency` from profile
- Fallback to flat tenant urgency if no profile exists (backwards compatible)
- Tenant-level urgency factor still adjusts ±0.1 per nightly cycle as before

**Current state — IMPLEMENTED. No known issues.**

---

### GAP 4 — Execution-Time Re-validation

**Original problem:**  
Actions were validated at planning time (when created) but not re-validated at execution time (when actually sent). The gap between planning (hourly) and execution (every 10 minutes) means an invoice could change state — paid, disputed, put on hold, debtor flagged with probable payment — after an action was approved but before it was sent. The result: emails sent to debtors who had already paid, or chased on disputed invoices.

**Why it mattered:**  
Sending a collections email to a debtor who paid yesterday is a relationship-damaging error that undermines trust in the platform. Sending to disputed invoices creates legal exposure. These are not theoretical edge cases — Xero syncs run every 4 hours and payment events happen continuously.

**Decision made:**  
Add a `validateActionBeforeExecution()` gate in `actionExecutor.ts` that runs immediately before every send. If validation fails, action is cancelled with a descriptive reason code rather than silently skipped.

**What was implemented:**  
`validateActionBeforeExecution()` checks:
1. Legal response window — active or expired-but-unresolved blocks execution
2. Probable payment detection — HIGH or MEDIUM confidence match suspends chasing
3. P(Pay) defensive check — if CDF(days_overdue) > 60% for debtor's distribution, action cancelled as `ppay_likely_paid_Npct` (debtor has probably already paid based on their historical pattern)
4. Invoice status changes — paid, void, disputed, or on-hold cancels action
5. Bundle modification — if any invoice in a consolidated bundle has changed state, requires replanning rather than partial send
6. Minimum chase threshold — configurable per tenant (default £50); below this, action skipped

**Current state — VERIFIED COMPLETE. No known issues.**

---

### GAP 5 — No Escalation Velocity Cap on Tone

**Original problem:**  
The tone escalation engine could stack multiple simultaneous escalation triggers without any rate limit. Serial promiser (+1), relationship deteriorating (+1), final demand baseline (+1 from table) could combine to jump a debtor from Friendly to Legal in a single cycle. There was no rule preventing Charlie from escalating more than one tone level within any given time period.

**Why it mattered:**  
Sudden tone jumps are jarring to debtors and can damage relationships that were recoverable with a more measured approach. More practically, rapid escalation to Legal tone triggers the 30-day statutory response window (Gap 10), which cannot easily be reversed. Premature Legal tone is also a compliance risk.

**Decision made:**  
Implement a ±1 velocity cap: Charlie cannot move the tone more than one level in either direction in a single cycle. If multiple triggers would cause a +2 jump, it is applied as +1 this cycle and re-evaluated next cycle. Add escalation pressure for non-response: after N consecutive unanswered contacts (default 4, configurable), an additional +1 is applied. Add a significant payment override: if ≥50% of outstanding balance is paid, tone resets to Professional regardless of history (debtor is engaging, reward them).

The velocity cap reads `agentToneLevel` from the last completed action for that debtor. This field already existed in the schema but was never read back. Gap 5 wired the read.

**What was implemented:**  
- Velocity cap (±1 step max per cycle) in `toneEscalationEngine.ts`
- `getLastSentAction()` helper reads previous tone from completed actions
- `getConsecutiveNoResponseCount()` counts unanswered contacts
- `checkSignificantPayment()` detects partial payments ≥ threshold
- Two new tenant settings: `noResponseEscalationThreshold` (default 4), `significantPaymentThreshold` (default 0.50)
- `ToneEscalationResult.signals` extended with `lastToneLevel`, `consecutiveNoResponseCount`, `velocityCapped` for observability

**Current state — IMPLEMENTED. No known issues.**

---

### GAP 6 — Cold Start Problem With No Warm Start Solution

**Original problem:**  
New debtors and new tenants start with all channel effectiveness scores at 0.5 (equal probability for all channels). Learning confidence starts at 0.1. Charlie's early channel decisions for new debtors were essentially random — neither using knowledge about similar debtors nor about the debtor's industry or segment. Additionally, there was no external data enrichment to inform early risk scoring.

**Why it mattered:**  
A new tenant with 50 debtors would spend the first several cycles making suboptimal channel choices for all of them while the system learned from scratch. For a product that promises value from day one, this was a meaningful gap. Additionally, without external enrichment, Charlie's risk scores were purely reactive — based only on observed payment behaviour, with no forward-looking signals.

**Decision made (two parts):**

Part A — Warm start from cohort priors: When a new debtor profile is created, inherit channel effectiveness scores from similar debtors (same segment + similar size). Requires 5+ mature profiles (confidence > 0.5) to form a cohort. If insufficient cohort data, fall back to segment-only priors, then size-only, then system defaults (email:0.6, sms:0.5, voice:0.4). New profiles start at confidence 0.15–0.20 (inherited knowledge) rather than 0.1 (cold start). This reflects that the system knows something — just not this specific debtor.

Part B — Companies House enrichment: Integrate with the Companies House free API to enrich every debtor with company data immediately on Xero sync. Enrichment is non-blocking (fired asynchronously after contact sync). Data includes: company status, SIC codes, company age, filing health, late filings count, registered address, insolvency risk flags. A Claude AI risk summary is generated from this data and stored alongside a 0–100 credit risk score. Score is written back to `contacts.riskScore` for Charlie to read in priority scoring.

**What was implemented:**  
- `getOrCreateCustomerProfile()` in `collectionLearningService.ts` updated with cohort prior inheritance
- New `debtorIntelligence` table with unique(tenantId, contactId)
- `server/services/companiesHouse.ts` — Companies House API (search + profile + filing history, rate limited, Basic auth)
- `server/services/debtorEnrichmentService.ts` — orchestration: Companies House → credit scoring → Claude risk summary → DB
- Enrichment triggered non-blocking after Xero contact sync
- 90-day freshness check prevents unnecessary re-enrichment
- `enrichmentJob.ts` — weekly re-enrichment of debtors with outstanding balances
- Riley debtor context extended with company intelligence section
- Requires `COMPANIES_HOUSE_API_KEY` env var (free registration)
- Degrades gracefully if API key not configured

**Current state — IMPLEMENTED. Future enrichment sources documented but not built: CCJ register, AI web search.**

---

### GAP 7 — P(Pay) Model Undocumented and Underspecified

**Original problem:**  
`adaptive-scheduler.ts` used P(Pay) for timing decisions but the model was a sigmoid function applied to `medianDaysToPay`. It did not incorporate the `trend` field (which tracks whether payment behaviour is improving or deteriorating), `volatility` (consistency), or `p75DaysToPay` (spread). Effectively Charlie knew the average but ignored the variance and direction of travel.

**Why it mattered:**  
A debtor who typically pays in 20 days but whose trend is worsening (last 3 invoices paid in 25, 30, 35 days) should be treated very differently from one whose trend is improving. The sigmoid model treated them identically. Good timing decisions — contacting on the right day — meaningfully improve payment rates.

**Decision made:**  
Replace sigmoid with a log-normal CDF fitted per debtor using all four available history signals. Log-normal is the correct distribution for payment timing: it is right-skewed (some debtors pay very late but almost none pay before due), bounded at zero, and well-understood. Fit parameters: mu derived from trend-adjusted median, sigma derived from p75/volatility.

Provide three-scenario quantile output (q25/q50/q75) for use in the weekly CFO review cashflow scenarios. Add cold-start segment priors: small_business=40d, enterprise=50d, freelancer=30d.

**What was implemented:**  
New service `server/services/paymentDistribution.ts` with:
- `fitDistribution()` — mu from trend-adjusted median (TREND_WEIGHT=3 days per trend unit), sigma from p75/volatility (clamped 0.1–1.5)
- `estimatePaymentProbability()` — conditional log-normal CDF for specified time horizons
- `getPaymentForecast()` — three-scenario quantiles for CFO review
- `describeDistribution()` — Riley-friendly text description
- `forecastInvoicePayment()` — per-invoice expected payment dates
- Seasonal adjustment parameter integrated (Gap 13)
- Weekly CFO Review updated to use distribution quantiles instead of hardcoded multipliers
- `fetchBehaviorSignalsForContacts()` bulk-fetches for all overdue contacts
- Riley debtor context includes payment pattern description and trend warnings

**Current state — IMPLEMENTED with one known deferred item:**  
`amountSensitivity` field (per-debtor payment lag by invoice size) is tracked in `customerBehaviorSignals` but NOT yet integrated into the log-normal fit. A generic log10 penalty is applied instead. Per-debtor amount sensitivity is parked for v2. Document this clearly in any handover.

---

### GAP 8 — No Dead Letter Handling for Failed Sends

**Original problem:**  
The SendGrid webhook pipeline infrastructure existed (tables, interfaces) but was not wired — no custom args were attached to outbound emails, so delivery events (delivered, bounced, dropped) arrived at the webhook handler with no way to match them to the correct tenant, action, or contact. The handler had `if (!tenant_id) continue` — it silently discarded all events. Failed sends were marked as sent. Charlie's cadence counting was wrong for any debtor whose email bounced.

**Why it mattered:**  
This was the most immediately damaging gap. A failed send counted as a send means: Charlie thinks he contacted the debtor when he didn't. The cooldown timer starts. The touch count increments. Tone escalation considers the failed send as a unanswered contact. All downstream decisions for that debtor are corrupted until a payment or reply resets the state.

**Decision made:**  
Attach SendGrid custom args to every outbound email at send time. Implement retry logic for transient failures. Update action delivery status from webhook events. Exclude failed deliveries from touch counting queries throughout the system.

**What was implemented:**  
- Custom args (`tenant_id`, `action_id`, `contact_id`, `invoice_id`) attached to all SendGrid outbound emails in `sendgrid.ts`
- Webhook receiver updated to extract custom args and route to event bus
- `processDeliveryOutcome()` in event bus updates action delivery status on delivered/bounce/dropped events
- Hard bounce events create timeline events consumed by Data Health (see Known Remaining Issues — Data Health does not yet query these timeline events)
- Retry logic: max 2 retries, delays 5min then 30min, in `actionExecutor.ts`
- Touch counting queries in `actionPlanner.ts` and `complianceEngine.ts` now exclude failed deliveries
- New `voiceContactRecord` (jsonb) column on actions table for voice call outcome storage

**Current state — IMPLEMENTED with known limitation:**  
Connected email path (Gmail/Outlook OAuth via `ConnectedEmailService.ts`) has NO delivery tracking — no custom args equivalent, no webhook infrastructure. All delivery tracking is SendGrid-only. This is documented in CLAUDE.md and must be communicated to any developer who extends the connected email feature.

---

### GAP 9 — LLM Circuit Breaker and Template Fallback

**Original problem:**  
If the Anthropic Claude API was unavailable (network error, rate limit, outage), `aiMessageGenerator.ts` would throw and the collections pipeline would halt entirely. No fallback existed. A period of API unavailability meant zero collections activity.

**Why it mattered:**  
Collections timing matters — contacting a debtor on the right day significantly affects payment rates. An hour of downtime during the daily planning window could delay an entire day's collections activity. For a tenant with urgent cashflow needs, this is unacceptable.

**Decision made:**  
Implement a per-tenant circuit breaker with three states: CLOSED (normal), OPEN (failing, use fallback), HALF_OPEN (probing recovery). After 3 failures within 30 minutes, circuit opens. After 5 minutes, circuit probes with a single request. If probe succeeds, circuit closes. Fallback: 10 pre-written templates (5 email + 5 SMS, one per tone level) that are compliant, professional, and contextually filled at runtime.

Voice calls are NOT templated — a robotic-sounding AI voice call is worse than no call.

**What was implemented:**  
- `llmCircuitBreaker.ts` — per-tenant CLOSED→OPEN→HALF_OPEN state machine
- `llmOutputValidator.ts` — post-generation validation (length, debtor name present, invoice refs, no system prompt leakage, tone alignment check)
- `templateFallback.ts` — 10 fallback templates contextually filled with debtor name, invoice details, amounts
- `aiMessageGenerator.ts` wires all three: circuit check → LLM with retry → output validation → template fallback after 4 hours open
- Admin email notifications on circuit state changes
- Voice not templated (deliberate — silence is better than a clearly robotic call)

**Current state — IMPLEMENTED with known limitation:**  
Admin SMS alerts in `notifyAdmins()` silently fail — the `users` table has no `phone` column. Email notifications work. SMS notifications will fail silently until a phone field is added to the users schema. See Known Remaining Issues.

---

### GAP 10 — Pre-Action 30-Day Statutory Response Window

**Original problem:**  
UK "Time to Pay Up" legislation (March 2026) requires that before escalating to formal legal proceedings, a debtor must be given a formal response window after a Legal tone communication. No mechanism existed to enforce this — Charlie could send Legal tone emails and immediately continue escalating without the required pause.

**Why it mattered:**  
Regulatory compliance. Failure to observe the statutory window exposes the tenant to challenge on any subsequent legal action. This is not a product feature — it is a legal requirement in the UK market.

**Decision made:**  
After any Legal tone action completes, set a `legalResponseWindowEnd` on the contact (30 days from action date). The execution-time gate (Gap 4) blocks all further actions while the window is active or expired-but-unresolved. Require explicit human resolution with three options: resume collections (cleared to chase again), refer to debt recovery (handoff logged), extend window (new 30 days). Day-25 warning events and day-30 expiry events are created automatically by a nightly job.

**What was implemented:**  
- `setLegalResponseWindowIfNeeded()` in `actionExecutor.ts` sets window after Legal tone actions
- Gap 4 gate blocks active AND expired-unresolved windows
- Daily `legalWindowJob.ts` creates day-25 expiry warnings and day-30 expired events (deduplicated)
- `POST /api/contacts/:id/legal-window/resolve` endpoint (manager+ role) with three resolution actions: `resume_collections`, `refer_debt_recovery`, `extend_window`
- Xero sync auto-clears window when all invoices for a contact settle to paid

**Current state — IMPLEMENTED. No known issues.**

---

### GAP 11 — Channel Preference Hard Overrides Not Enforced

**Original problem:**  
The `customerPreferences` table stored channel opt-outs (`emailEnabled`, `smsEnabled`, `voiceEnabled`) with UI toggles on the debtor detail page. Charlie never read these. A user could mark "do not call this debtor" and Charlie would still queue voice calls.

**Why it mattered:**  
A direct user instruction — do not contact this debtor by phone — must be respected unconditionally. Ignoring it damages client trust and potentially creates legal exposure if a debtor has formally requested no contact via a specific channel.

**Decision made:**  
Wire `customerPreferences` channel flags into both `charlieDecisionEngine.selectChannel()` and `actionPlanner.ts` channel optimisation path. If a channel is disabled, never select it. If all channels are disabled, skip the debtor entirely and log the skip. Allow Riley to capture channel preferences conversationally and write them to `customerPreferences` automatically.

**What was implemented:**  
- `applyChannelPreferenceOverride()` added to `charlieDecisionEngine.ts` after `selectChannel()`
- `channelPrefs` build added to `actionPlanner.ts` AI optimisation safety check
- Null/undefined defaults to enabled (backwards compatible with existing records)
- Fallback order if preferred channel disabled: email → sms → voice
- If all disabled: action skipped, reason logged as `all_channels_disabled`
- New columns `channelPreferenceSource` and `channelPreferenceNotes` on `customerPreferences`
- UI auto-sets source to `user_manual` on toggle change, displays source and notes
- Riley extraction prompt updated to detect channel preferences from conversations

**Current state — IMPLEMENTED. No known issues.**

---

### GAP 12 — No Debtor Grouping for Related Entities

**Original problem:**  
Many SME debtors are related — subsidiaries of the same parent, franchisees of the same brand, entities sharing an AP department. Charlie treated each contact independently. If three subsidiaries of Acme Group were all being chased, Charlie might send Friendly to one, Firm to another, and Formal to a third on the same day — incoherent from the debtor's perspective, as the same accounts payable team received all three.

**Why it mattered:**  
Tone inconsistency across related entities is confusing and undermines the persona illusion. More practically, a debtor who receives conflicting communications from the same "agent" loses trust in the process.

**Decision made:**  
Create a lightweight `debtorGroups` table to link related contacts. Post-planning consistency sweep aligns all same-day actions for grouped contacts to the highest tone level and cancels duplicates (keeps highest priority action, cancels the rest). Riley detects potential groups via email domain matching and suggests them to users.

**What was implemented:**  
- `debtorGroups` table + `debtorGroupId` FK on `contacts`
- Full CRUD API at `/api/debtor-groups` with member management
- Post-planning sweep: `enforceDebtorGroupConsistency()` in `actionPlanner.ts` — runs after all actions for tenant created, aligns tones, cancels duplicates with reason `debtor_group_same_day_conflict`
- Riley `detectPotentialGroups()` based on email domain matching (skips 14 generic domains: gmail, outlook, hotmail etc.)
- Group context injected into Riley's debtors list page context
- Routes in `server/routes/debtorGroupRoutes.ts`

**Current state — IMPLEMENTED with known limitation:**  
Post-planning sweep has a race condition: if the planner crashes between action creation and consistency sweep, duplicate actions may remain scheduled. The sweep is non-fatal (errors caught and logged). This is acceptable for current scale but should be made atomic (wrap in a database transaction) in a future sprint. Cadence coordination across group members and shared PTP/intelligence deferred to v2.

---

### GAP 13 — Seasonal Payment Patterns Not Integrated

**Original problem:**  
P(Pay) timing and cashflow forecasts ignored seasonal patterns. A UK SME debtor who always pays slowly in December (year-end pressure) and fast in January (new budget) was treated identically in all months. Riley could capture this knowledge conversationally but had nowhere to store and use it.

**Why it mattered:**  
Seasonal timing errors mean chasing too hard in slow months (damaging relationships) and not hard enough in fast months (missing easy collection opportunities). For the cashflow forecast, ignoring seasonality produces inaccurate scenario ranges.

**Decision made:**  
Three-phase integration: (1) Riley captures seasonal patterns via conversation and stores in `aiFacts`. (2) `fitDistribution()` in `paymentDistribution.ts` accepts optional seasonal adjustments — applies mu shifts for current month. (3) System learns seasonal patterns from 12+ months of payment data, overriding Riley-captured patterns when sufficient data exists.

**What was implemented:**  
- Riley extraction prompt extended with seasonal pattern examples and onboarding question
- Facts stored in `aiFacts` with `category='seasonal_pattern'`
- `fitDistribution()` extended with optional `seasonalAdjustments` parameter
- Seasonal mu shifts: slow month +0.15, fast month -0.15, year-end month -0.20
- `calculateLearnedSeasonalPatterns()` — requires 12+ months of data, identifies months deviating >20% from overall average
- `getEffectiveSeasonalAdjustments()` merges Riley-captured and learned patterns (learned overrides Riley when `learningConfidence > 0.7`)
- All four callers of `fitDistribution()` updated to pass seasonal adjustments

**Current state — IMPLEMENTED. No known issues.**

---

### GAP 14 — Unreconciled Payment Detection

**Original problem:**  
Charlie would chase a debtor who had already paid but whose payment had not yet reconciled in Xero (e.g., bank transfer received but not matched to an invoice). The result: aggressive collections communications to someone who had already fulfilled their obligation — a serious relationship-damaging error.

Additionally, Xero's March 2026 developer terms explicitly prohibit using Xero API data for AI/ML model training. This creates a hard architectural boundary: bank transaction data from Xero can be used for operational inference (matching payments to invoices) but must never feed into learning models.

**Why it mattered:**  
Chasing a debtor who has paid is one of the most damaging errors a collections system can make. At scale it will happen regularly if unreconciled payments are ignored. The API compliance boundary is a legal requirement.

**Decision made:**  
Fetch unreconciled RECEIVE bank transactions from Xero on every sync. Run a three-confidence-tier matching algorithm against outstanding invoices. Flag contacts where a probable payment is detected; suspend all chasing until confirmed or rejected by a human. Integrate with execution-time gate (Gap 4).

Matching confidence tiers:
- HIGH: exact amount + debtor name/reference match, OR direct Xero contact match
- MEDIUM: total matches multiple outstanding invoices, OR ambiguous payer reference
- LOW: amount-only match (possible coincidence)

Charlie suspends chasing on HIGH and MEDIUM. LOW is logged but does not block.

Architecture note: bank transaction data flows through `probablePaymentService.ts` for operational matching. It does NOT feed into `channelEffectivenessService.ts`, `collectionLearningService.ts`, or any model training path. This boundary is documented with code comments and must be preserved.

**What was implemented:**  
- New `probablePayments` table in schema
- `probablePaymentService.ts` — matching algorithm, three confidence tiers
- HIGH/MEDIUM matches: `probablePaymentDetected`, `probablePaymentConfidence`, `probablePaymentDetectedAt` flags on contacts; all chasing suspended
- Bank transaction sync wired into `xeroSync.ts` `syncAllDataForTenant()` — fetches unreconciled RECEIVE transactions from last 90 days
- P(Pay) defensive check added to execution gate: if CDF(days_overdue) > 60%, action cancelled as `ppay_likely_paid_Npct`
- Xero sync auto-clears probable payment flags when all invoices for a contact become paid
- Resolution API: `POST /api/contacts/:id/probable-payment/resolve` (confirm/reject, manager+)
- `GET /api/contacts/:id/probable-payments` lists all matches
- `expireStaleMatches()` expires 30-day-old pending matches

**Current state — IMPLEMENTED (Phase 1). Phase 2 (Open Banking confirmation + learning layer) deferred until TrueLayer/Yapily integration.**

---

## 5. KNOWN REMAINING ISSUES

These issues are known, documented, and prioritised. They do not compromise core correctness but should be addressed before handover to a human development team.

### Issue 1 — Two Scoring Services Coexist (MEDIUM priority)

**Description:**  
`collectionLearningService.calculateEffectiveness()` (old, additive formula) and `channelEffectivenessService.calculateInteractionEffectiveness()` (new, three-tier weighted model) both exist and both update `customerLearningProfiles`. The old service is used by A/B testing and the `actionPlanner` optimisation path. The new service handles real-time effectiveness updates from delivery events and payment attribution.

**Risk:**  
A developer unfamiliar with the distinction may attempt to consolidate them incorrectly, removing the A/B testing capability or breaking the real-time update path.

**What needs to happen:**  
Document the boundary clearly in both service files with comments. The old service should be deprecated for effectiveness scoring (not A/B testing) and removed in a future sprint once all callers have been migrated to the new service. Do not consolidate without understanding the A/B testing dependency.

### Issue 2 — Data Health Does Not Detect Hard Bounces (LOW priority)

**Description:**  
Gap 8 wires hard bounce events from SendGrid into timeline events. The `GET /api/settings/data-health` endpoint only checks static contact fields (email populated, generic email pattern). It does not query timeline events. A contact whose email hard-bounced will still show as "Ready" in Data Health rather than "Needs Email."

**What needs to happen:**  
Extend the Data Health endpoint to query `timelineEvents` for `email_hard_bounce` events and downgrade readiness status to "Needs Email" where found.

### Issue 3 — Circuit Breaker Admin SMS Alerts Silently Fail (LOW priority)

**Description:**  
`llmCircuitBreaker.ts` `notifyAdmins()` attempts to send SMS alerts to tenant admins when circuit state changes. The `users` table has no `phone` column. SMS notifications fail silently. Email notifications work correctly.

**What needs to happen:**  
Either add a `phone` column to the `users` table and wire it through, or remove SMS notifications from the circuit breaker and rely on email only. Do not leave silent failures in production code.

### Issue 4 — Ageing Analysis Chart Shows Wrong Buckets (LOW priority)

**Description:**  
The dashboard ageing analysis chart is showing incorrect invoice counts per bucket. Flagged 15 March 2026. Root cause not yet diagnosed. Does not affect Charlie's decisions (which use the database directly) but misleads users reviewing the dashboard.

**What needs to happen:**  
Compare chart data query against `getARSummary()` in `arCalculations.ts`. The chart is likely using an inline SUM query with different bucket boundaries or invoice status filters. All AR figures must use `getARSummary()` — this is a hard architecture rule.

### Issue 5 — Debtor Group Consistency Sweep Race Condition (LOW priority, known)

**Description:**  
`enforceDebtorGroupConsistency()` in `actionPlanner.ts` runs after all actions for a tenant are created. If the planner crashes between action creation and the consistency sweep, some group members may have duplicate scheduled actions. The sweep is non-fatal.

**What needs to happen:**  
Wrap action creation + consistency sweep in a database transaction so they are atomic. This is straightforward with Drizzle's transaction support. Deferred because the current failure mode (duplicate actions) is caught by the execution-time gate (Gap 4 minimum chase threshold and consolidation logic).

---

## 6. ARCHITECTURAL DECISIONS REQUIRING HUMAN JUDGEMENT

These decisions were made during the current build phase. They are correct given current constraints but should be explicitly reviewed as the product scales.

### Decision A — Monolith vs Agent Microservices

**Current state:** All Charlie logic runs in a TypeScript monolith on a single Railway service. The scheduler, planner, executor, LLM calls, and all services share a single process.

**Why this is correct now:** Simplicity. A single process with no inter-service communication is easier to debug, deploy, and reason about. At current scale (single tenant, hundreds of debtors), there is no performance pressure.

**When to revisit:** When multiple tenants are running simultaneous planning cycles, or when long-running LLM calls start blocking the scheduler. The architecture anticipates five distinct agents (Collections, Risk, Cashflow, Dispute Resolution, Working Capital) — separating these is a natural evolution that should not require rewriting Charlie, only extracting services.

### Decision B — Xero as Sole Data Source for Invoice State

**Current state:** All invoice state (paid, voided, disputed) comes from Xero sync. There is no independent Qashivo-side invoice ledger.

**Why this is correct now:** Avoids data duplication and sync conflicts for MVP.

**When to revisit:** When Open Banking is live. TrueLayer/Yapily payment data may confirm payments before Xero reconciles them. At that point, a Qashivo-side "effective invoice state" that incorporates both Xero and Open Banking signals should be considered.

### Decision C — Per-Tenant Circuit Breaker

**Current state:** The LLM circuit breaker is per-tenant. If Anthropic's API is down, all tenants independently open their circuits and all fall back to templates.

**Why this is correct now:** Per-tenant state allows recovery to happen independently — one tenant's heavy usage pattern should not affect another's circuit state.

**When to revisit:** If the platform grows to hundreds of tenants, a global circuit breaker should be added above the per-tenant layer to avoid thundering herd on API recovery (all tenants probing simultaneously after an outage).

### Decision D — Xero API Data Architecture Boundary

**Hard rule:** Xero API data is used for operational inference only (payment matching, invoice state). It must NEVER feed into model training, channel effectiveness learning, or PRS calculations. This is required by Xero's March 2026 developer terms.

Open Banking data (TrueLayer/Yapily) has no such restriction. All learning model training should use Open Banking data only.

This boundary is enforced by convention and comments in the codebase. A future sprint should add automated tests that verify no `xeroSync.ts` output flows into `collectionLearningService.ts` or `channelEffectivenessService.ts`.

---

## 7. TEST CASES AND VERIFICATION QUERIES

Run these queries against the production database to verify each gap is functioning correctly.

### Verify Gap 2 — PRS Bayesian Prior
```sql
-- A debtor with exactly 1 kept promise should NOT have prsAdjusted = 100
SELECT contact_id, prs_raw, prs_adjusted, prs_confidence, calculation_version
FROM customer_learning_profiles
WHERE prs_raw = 100
ORDER BY prs_confidence ASC;
-- Expected: prs_adjusted < 100 for low prs_confidence records
-- Expected: calculation_version = '2.0' for all recently calculated records
```

### Verify Gap 3 — Per-Debtor Urgency
```sql
-- Urgency should vary across debtors, not be uniform
SELECT contact_id, debtor_urgency, contribution_weight, trend_multiplier
FROM customer_learning_profiles
WHERE tenant_id = '[tenant_id]'
AND urgency_updated_at > NOW() - INTERVAL '25 hours'
ORDER BY debtor_urgency DESC;
-- Expected: debtor_urgency varies. Average should be close to tenant urgency_factor.
-- Expected: urgency_updated_at populated for all active debtors
```

### Verify Gap 5 — Velocity Cap
```sql
-- Find any debtor whose tone jumped more than 1 level in a single cycle
SELECT a1.contact_id, a1.agent_tone_level as prev_tone, 
       a2.agent_tone_level as new_tone,
       a2.created_at
FROM agent_actions a1
JOIN agent_actions a2 ON a1.contact_id = a2.contact_id
  AND a2.created_at > a1.created_at
  AND a2.created_at < a1.created_at + INTERVAL '2 hours'
WHERE a1.status = 'completed' AND a2.status IN ('scheduled', 'pending_approval')
-- Manually verify no jump > 1 level (Friendly→Firm would be a violation)
```

### Verify Gap 8 — Delivery Tracking
```sql
-- Recent actions should have delivery status populated
SELECT id, contact_id, status, delivery_status, delivered_at, bounce_type
FROM agent_actions
WHERE created_at > NOW() - INTERVAL '24 hours'
AND channel = 'email'
ORDER BY created_at DESC;
-- Expected: delivery_status IN ('delivered', 'bounced', 'pending') not NULL
-- Any NULL delivery_status indicates custom args not being attached
```

### Verify Gap 10 — Legal Response Window
```sql
-- Contacts in legal response window should have no active scheduled actions
SELECT c.id, c.name, c.legal_response_window_end,
       COUNT(a.id) as scheduled_actions
FROM contacts c
LEFT JOIN agent_actions a ON a.contact_id = c.id 
  AND a.status IN ('scheduled', 'pending_approval')
WHERE c.legal_response_window_end > NOW()
GROUP BY c.id, c.name, c.legal_response_window_end
HAVING COUNT(a.id) > 0;
-- Expected: zero rows. Any rows indicate Gap 4 execution gate not blocking correctly.
```

### Verify Gap 14 — Probable Payment Detection
```sql
-- Check recent probable payment matches
SELECT pp.contact_id, c.name, pp.confidence_tier, 
       pp.matched_amount, pp.transaction_date, pp.status
FROM probable_payments pp
JOIN contacts c ON pp.contact_id = c.id
WHERE pp.created_at > NOW() - INTERVAL '7 days'
ORDER BY pp.created_at DESC;

-- Verify HIGH/MEDIUM matches have suspended chasing
SELECT c.name, c.probable_payment_detected, c.probable_payment_confidence,
       COUNT(a.id) as active_actions
FROM contacts c
LEFT JOIN agent_actions a ON a.contact_id = c.id
  AND a.status IN ('scheduled', 'pending_approval')
WHERE c.probable_payment_detected = true
GROUP BY c.id, c.name, c.probable_payment_detected, c.probable_payment_confidence
HAVING COUNT(a.id) > 0;
-- Expected: zero rows. Any rows indicate probable payment not blocking correctly.
```

---

## 8. WHAT WAS DELIBERATELY DEFERRED TO V2

The following items are documented requirements that were consciously deferred. They are not gaps or bugs — they are scoped out of the current build.

| Item | Reason for deferral |
|------|---------------------|
| Per-debtor amount sensitivity in P(Pay) | Requires 12+ months of varied invoice data per debtor. Insufficient data at MVP stage. |
| Open Banking confirmation layer (Gap 14 Phase 2) | Requires TrueLayer/Yapily integration not yet built. |
| CCJ register enrichment (Gap 6) | Paid data source. Cost-benefit unclear at current scale. |
| Debtor group cadence coordination | Complex — requires shared cooldown state across group members. |
| Shared PTP intelligence across groups | Legal entity boundary questions unresolved. |
| Five-agent architecture | Correct long-term direction but premature until multi-tenant scale demands it. |
| Atomic debtor group consistency sweep | Low priority given execution gate safety net. |
| Soft Live contact-level opt-in | Regulatory detail — Soft Live currently behaves as Testing mode. |
| DISPUTE_RESOLUTION_SPEC.md | UK "Time to Pay Up" full workflow. Spec document to be created separately. |
| SMS admin alerts in circuit breaker | Blocked by missing `phone` column on users table. |

---

*CHARLIE_ENGINEERING_SPEC.md v1.2 — Qashivo / Nexus KPI Limited*  
*This document is the authoritative handover reference for the Charlie collections engine.*  
*Read alongside: CLAUDE.md, QASHIVO_CONTEXT.md, How-Charlie-Works.md*
