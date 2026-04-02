# CHARLIE ENGINEERING SPEC — Collections Decision Engine Hardening

**Version:** 1.1 — 02 April 2026
**Scope:** Nine original engineering gaps identified in Charlie audit, plus LLM circuit breaker, Debtor Intelligence Enrichment, and four additional recommendations from expert review (pre-action compliance, channel preferences, debtor grouping, seasonal patterns)
**Priority:** This spec is the authoritative implementation brief for Claude Code. Each gap is defined with precise fix logic, schema changes, and verification queries.
**Prerequisite:** MVP v1.1 substantially complete. Read alongside CLAUDE.md, How-Charlie-Works.md, and MVP_V1_1_BUILD_SPEC.md.
**Related specs:** DISPUTE_RESOLUTION_SPEC.md (separate document — covers 30-day statutory dispute window, tactical dispute detection, SBC adjudication pathway, driven by the UK Government's "Time to Pay Up" legislation published 24 March 2026)

---

## CURRENT STATE SUMMARY

Charlie is Qashivo's autonomous collections decision engine. He runs on a scheduler (hourly planning, 10-minute execution) and for every overdue debtor decides: who to chase, which channel (email, SMS, voice), what tone (Friendly, Professional, Firm, Formal, Legal), and generates fully personalised LLM messages via the Anthropic Claude API.

### Key Components

| File | Role |
|------|------|
| `server/services/charlieDecisionEngine.ts` | Priority scoring, channel selection, confidence |
| `server/services/toneEscalationEngine.ts` | 5-tone scale with behavioural adjustments |
| `server/services/actionPlanner.ts` | Creates and consolidates actions (one per debtor per day) |
| `server/services/collectionsScheduler.ts` | Background triggers: hourly planner, 10-min executor |
| `server/services/portfolioController.ts` | Nightly DSO urgency factor |
| `server/services/aiMessageGenerator.ts` | LLM message generation |
| `server/services/promiseReliabilityService.ts` | Promise Reliability Score (PRS) |
| `server/lib/adaptive-scheduler.ts` | ML-enhanced timing, P(Pay) model |
| `server/services/collectionLearningService.ts` | Channel effectiveness learning |
| `server/services/communicationOutcomeProcessor.ts` | Outcome recording (exists but not wired) |

### Critical Finding: SendGrid Delivery Pipeline Is Non-Functional

**Status:** The webhook endpoint exists (POST /api/webhooks/sendgrid/events at server/routes/webhooks.ts:788) and the code is structurally sound — it parses SendGrid event batches, publishes to event bus with idempotency, writes to contactOutcomes table, and handles delivered, open, click, bounce, dropped, deferred events.

**But it does not work because:**

1. **No custom args on outbound emails.** The webhook handler expects `tenant_id`, `action_id`, `contact_id`, and `invoice_id` as custom arguments on each SendGrid event (line 799-802). The outbound email sending code never attaches these. Every event hits `if (!tenant_id) continue;` (line 805) and is silently dropped. Zero matches found for `custom_args`, `customArgs`, `unique_args`, `uniqueArgs` across the server.

2. **No event bus subscribers.** The event bus (`server/lib/event-bus.ts`) is a write-only DB insert into `contactOutcomes`. There are no listeners that trigger `communicationOutcomeProcessor` to update learning profiles, channel effectiveness scores, or behavioral flags.

**What works:** The `contactOutcomes` table, idempotency mechanism, and `communicationOutcomeProcessor` service all exist. The plumbing is there — it just needs connecting.

**This finding is a prerequisite for both Gap 8 (delivery confirmation) and Gap 1 (feedback loop). One wiring job unlocks both gaps.**

---

## IMPLEMENTATION PRIORITY ORDER

```
1. Gap 8  — Dead letter handling + delivery confirmation (data corruption risk)
2. Gap 2  — PRS Bayesian prior + recency weighting (wrong tone at scale)
3. Gap 4  — Execution-time re-validation of consolidated actions (compliance risk)
4. Gap 5  — Tone escalation velocity cap + history tracking (tone correctness)
5. Gap 10 — Pre-action 30-day statutory response window (compliance — LEGAL REQUIREMENT)
6. Gap 14 — Unreconciled payment detection (prevents chasing paid debtors)
7. Gap 9  — LLM circuit breaker + template fallback (resilience)
8. Gap 11 — Debtor channel preference hard overrides (compliance/UX)
9. Gap 1  — Feedback loop + payment attribution (effectiveness accuracy)
10. Gap 3  — Portfolio Controller per-debtor weighting (precision)
11. Gap 7  — P(Pay) log-normal distribution model (timing accuracy)
12. Gap 12 — Lightweight debtor grouping (tone consistency)
13. Gap 13 — Seasonal payment pattern integration (timing accuracy)
14. Gap 6  — Cold start warm start + Debtor Intelligence Enrichment (cold start UX)
```

---

## GAP 8 — DEAD LETTER HANDLING + DELIVERY CONFIRMATION

### Problem

The action lifecycle ends at `sent`, which means "we called the provider API." It does not confirm the debtor received the communication. This creates two failures:

**Failure A — Silent send failure.** The provider API returns an error or the message bounces, but the action stays marked `sent`. Charlie's cadence, touch count, and cooldown all proceed as if contact was made. Every downstream decision for that debtor is wrong.

**Failure B — No proof of delivery for legal escalation.** UK debt recovery (Pre-Action Protocol under the Civil Procedure Rules) requires evidence that the debtor was contacted and given reasonable opportunity to respond before legal action. A status of `sent` proves you tried — it does not prove they received. Without delivery confirmation, any file handed to a solicitor or debt recovery partner has a gap that a competent defence would challenge.

### Fix: Extended Action Status Lifecycle

```
planned → approved → sent → delivered / bounced / failed
                                ↓
                          failed_permanent (after retry exhaustion)
```

**Status definitions:**

| Status | Meaning |
|--------|---------|
| `sent` | Provider API accepted the request (HTTP 2xx). Transitional state, not terminal. |
| `delivered` | Provider confirmed delivery. SendGrid `delivered` event. Vonage `delivered` DLR. Retell AI — see voice taxonomy below. |
| `bounced` | Provider confirmed non-delivery. SendGrid `bounce`/`blocked`. Vonage `failed`/`rejected` DLR. Retell AI — call not answered or number invalid. |
| `failed` | Provider API rejected the request at send time (HTTP 4xx/5xx). Eligible for retry. |
| `failed_permanent` | Retries exhausted, or hard bounce. Not eligible for retry. Excluded from cadence counting. |
| `generation_failed` | LLM message generation failed (see Gap 9). Action never reached send stage. |
| `cancelled_at_execution` | Execution-time re-validation cancelled the action (see Gap 4). |

### Voice Contact Status Taxonomy (Retell AI)

Voice requires a richer status model than email or SMS because evidential value varies depending on what happened during the call.

```
sent (call initiated)
  → no_answer              — rang out, no pickup, no voicemail
  → voicemail_left         — voicemail detected, message left
  → connected_brief        — answered, < 30 seconds, no substance exchanged
  → connected_unqualified  — answered, > 30 seconds, but unknown who spoke to
  → connected_qualified    — answered, named contact identified, substance communicated
  → failed                 — call setup failure (bad number, network error, Retell API error)
```

**Evidential weight per status:**

| Status | Evidential Value | Cadence Treatment |
|--------|-----------------|-------------------|
| `connected_qualified` | Full. Named contact, substance communicated, intent captured. Only status that counts as "meaningful contact" for pre-action protocol. | Full touch, cooldown applies, touch count increments |
| `connected_unqualified` | Partial. Someone answered but cannot prove who. Supports narrative but does not satisfy pre-action bar alone. | Full touch for cadence, but flags for follow-up written contact |
| `voicemail_left` | Contact attempt only. Courts accept as evidence you tried, not confirmed contact. | Half touch. Cooldown applies. Charlie auto-queues follow-up email within 24 hours referencing voicemail (default behaviour, not configurable). |
| `connected_brief` | None. Switchboard pickup and immediate transfer/hangup. | No touch. Debtor re-enters next cycle. |
| `no_answer` | None. | No touch. Debtor re-enters next cycle. |
| `failed` | None. | No touch. Debtor re-enters next cycle. |

### Immutable Voice Evidence Record

Every Retell AI call produces a `voiceContactRecord` stored as JSONB on the action:

```json
{
  "callTimestamp": "ISO timestamp",
  "callDuration": 145,
  "numberDialled": "+447...",
  "contactReached": { "name": "Jane Smith", "role": "Accounts Payable Manager" },
  "substanceCommunicated": true,
  "fullTranscript": "...",
  "detectedIntents": ["promise_to_pay", "acknowledged_debt"],
  "commitments": [{ "type": "payment", "amount": 5000, "date": "2026-04-10" }],
  "recordingReference": "retell://recording/abc123",
  "recordingAnnouncementMade": true,
  "voicemailLeft": false,
  "callOutcome": "connected_qualified"
}
```

**Legal basis:** UK law (RIPA 2000) permits recording B2B calls without consent for establishing facts. Best practice is to announce recording. Transcripts preferred by courts over audio alone.

### Legal Evidence Fields on All Actions

Add to the actions table:

| Field | Type | Purpose |
|-------|------|---------|
| `providerMessageId` | varchar | SendGrid message ID, Vonage message UUID, Retell call ID |
| `deliveryStatus` | varchar | The extended lifecycle status |
| `deliveryConfirmedAt` | timestamp | When provider confirmed delivery |
| `deliveryRawPayload` | jsonb | Full webhook payload — the actual proof |
| `retryCount` | integer | Number of retries attempted |
| `retryOf` | integer (FK) | Points to original action if this is a retry |
| `voiceContactRecord` | jsonb | Retell AI call evidence (voice actions only) |
| `generationMethod` | varchar | 'llm' or 'template_fallback' (see Gap 9) |

### Retry Policy

- Max 2 retries per action
- 5-minute delay on first retry, 30-minute delay on second
- Same channel for retries
- Only `failed` status (synchronous API failure) triggers retry
- `bounced` does NOT retry on the same channel — the message was sent, the recipient's infrastructure rejected it
- Hard bounces (SendGrid bounce type `hard`) → `failed_permanent` immediately, no retry
- After retry exhaustion → `failed_permanent`

### Channel Switch on Bounce

**Next planning cycle, not same cycle.** When an action bounces or reaches `failed_permanent`:

- The debtor re-enters the next daily planning cycle
- The planning engine sees the failed channel and considers alternatives
- This keeps the plan-execute-record loop clean and predictable
- It also creates a natural feedback loop with Data Health — hard bounce triggers auto-flip (see below), user fixes contact data, next cycle uses correct data

### Cadence Correction on Failure

When an action reaches `bounced` or `failed_permanent`:

- Touch count does NOT increment for that debtor
- Cooldown does NOT apply
- The debtor re-enters the next planning cycle at the same priority as if the contact never happened

### Data Health Auto-Flip on Hard Bounce

When an email hard bounce is confirmed:

- Auto-update the debtor's Data Health status to "Needs Email" or "Needs Attention"
- This connects Gap 8 to the existing Data Health system
- Riley can proactively surface it: "The email for Acme Ltd bounced — do you have an alternative contact?"
- UI surfacing of Data Health issues (Dashboard card, debtor list badges, Riley notifications) — to be defined separately

### SendGrid Webhook Wiring (Prerequisite Fix)

1. Add custom args to ALL outbound SendGrid sends: `tenant_id`, `action_id`, `contact_id`, `invoice_id`
2. Wire event bus subscribers to `communicationOutcomeProcessor`
3. Add observability logging on the webhook receiver — log warning when events arrive without custom args
4. Implement the new delivery statuses in the action status lifecycle

### Pre-Action File Output

When a debtor is escalated toward legal action, the system produces a chronological contact log containing every attempt across all channels — with voice records providing timestamp, duration, who was spoken to, transcript, and outcome. This is the file that goes to the solicitor or debt recovery partner.

### Verification

```sql
-- Confirm delivery events are flowing (not all stuck at 'sent')
SELECT delivery_status, count(*)
FROM actions
WHERE sent_at > now() - interval '7 days'
GROUP BY delivery_status;

-- Should show a mix of delivered/bounced/failed, not 100% sent

-- Confirm retry mechanism is working
SELECT retry_count, count(*)
FROM actions
WHERE retry_count > 0
AND created_at > now() - interval '30 days'
GROUP BY retry_count;

-- Confirm cadence correction: failed actions should not count as touches
SELECT a.contact_id, a.delivery_status, a.created_at
FROM actions a
WHERE a.delivery_status IN ('bounced', 'failed_permanent')
AND a.created_at > now() - interval '7 days'
ORDER BY a.contact_id, a.created_at;
-- Cross-reference: subsequent actions for same contact should not show cooldown gap
```

---

## GAP 2 — PRS BAYESIAN PRIOR + RECENCY WEIGHTING

### Problem

Promise Reliability Score = `(kept x 100 + partial x 50) / total resolved`. A debtor with 1 kept promise scores PRS 100 — identical to a debtor with 20 kept promises. No confidence weighting exists. A single data point drives tone decisions at scale. Additionally, PRS treats all promises equally regardless of timing. A promise broken 6 months ago weighs the same as one broken yesterday.

### Fix Part A — Bayesian Regression to Population Mean

```
adjusted_PRS = (weighted_n x raw_PRS + k x prior_PRS) / (weighted_n + k)
```

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `k` | 3 | Prior strength. SME debtors typically generate 3-5 PTPs in the initial learning period. k=3 means the debtor's own data overtakes the prior after roughly 3-4 resolved promises. |
| `prior_PRS` | Tenant population mean if 10+ debtors have resolved promises. Otherwise system default of 60. | 60 is slightly skeptical — most debtors partially deliver on promises. |

**Confidence signal:** `weighted_n / (weighted_n + k)` — exposed alongside the adjusted PRS for downstream consumers.

**Practical outcomes:**

| Scenario | raw_PRS | adjusted_PRS |
|----------|---------|-------------|
| 1 kept promise | 100 | (1x100 + 3x60) / 4 = **70** |
| 1 broken promise | 0 | (1x0 + 3x60) / 4 = **45** |
| 4 kept promises | 100 | (4x100 + 3x60) / 7 = **82.9** |
| 10 kept promises | 100 | (10x100 + 3x60) / 13 = **86.2** |

### Fix Part B — Recency Weighting (Time Decay)

Each resolved promise gets a weight based on age:

```
weight = 1 / (1 + days_since_resolution / 90)
```

A promise resolved today gets weight 1.0. 90 days ago gets 0.5. 180 days ago gets 0.33.

The PRS calculation becomes:

```
weighted_kept = sum of (weight x 100) for each kept promise
weighted_partial = sum of (weight x 50) for each partial promise
weighted_broken = sum of (weight x 0) for each broken promise
weighted_n = sum of all weights
raw_PRS = (weighted_kept + weighted_partial) / weighted_n
```

Then apply the Bayesian adjustment using `weighted_n` instead of raw count.

**Practical effect across debtor lifecycles:**

- **Reformed debtor** (3 broken 6 months ago, 3 kept in last month): broken weights ~0.33 each (total ~1.0), kept weights ~1.0 each (total ~3.0). Raw PRS heavily favours recent good behaviour. Charlie softens tone.
- **Deteriorating debtor** (3 kept 6 months ago, 2 broken this month): kept weights ~0.33 each (total ~1.0), broken weights ~1.0 each (total ~2.0). Raw PRS drops sharply. Charlie escalates tone.

### Recalculation Trigger

On every promise resolution, not nightly batch. The calculation is lightweight — a sum over a small set of records.

### Verification

```sql
-- Debtors where Bayesian adjustment changed PRS by more than 10 points
SELECT contact_id, raw_prs, adjusted_prs, confidence,
       (raw_prs - adjusted_prs) as adjustment
FROM debtor_prs_scores
WHERE abs(raw_prs - adjusted_prs) > 10;

-- Debtors where recency weighting reverses the raw signal
SELECT contact_id, raw_prs, recency_weighted_prs
FROM debtor_prs_scores
WHERE (raw_prs > 70 AND recency_weighted_prs < 50)
   OR (raw_prs < 30 AND recency_weighted_prs > 50);
```

---

## GAP 4 — EXECUTION-TIME RE-VALIDATION OF CONSOLIDATED ACTIONS

### Problem

**Original concern:** Consolidation bundles excluded invoices. **Finding:** Not confirmed. The planner (`actionPlanner.ts`, lines 618-898) correctly filters invoices individually before bundling. Only invoices that pass all exclusion checks, deduplication, and scoring threshold are included in the consolidated action.

**Actual gap:** The timing window between the hourly planning run and the 10-minute execution run. During that window, invoice or debtor status can change: an invoice could be paid, disputed, receive a PTP, or the debtor could be put on hold. The executor sends the planned action without re-checking.

### Fix: Lightweight Execution-Time Gate

Before the executor sends any action, run a validation query:

```
For the action's debtor:
  - Is debtor now on hold or paused? → cancel action
  - Is debtor now marked VIP with restrictions? → re-check tone

For each invoice in the action:
  - Is it now paid (status changed since planning)? → remove from bundle
  - Is it now disputed? → remove from bundle
  - Has a PTP been recorded since planning? → remove from bundle
  - Is it now admin-blocked? → remove from bundle

Post-filter:
  - Bundle empty → cancel action, log reason, status = 'cancelled_at_execution'
  - Bundle reduced below minimum chase threshold → cancel action
  - Highest-priority invoice removed → recalculate tone/channel from remaining
  - Bundle unchanged → proceed as planned
```

This is a single database query per action — fetch current status of the debtor and all invoices in the bundle, compare against what was planned.

### Minimum Chase Threshold

**New tenant-configurable setting.** Default: £50. Stored in tenant settings.

If the remaining invoices in a bundle after re-validation total below this threshold, the action is cancelled. This also prevents Charlie from chasing trivial amounts under normal planning (apply at planning time as well as execution time).

### Verification

```sql
-- Actions cancelled at execution time by re-validation
SELECT cancellation_reason, count(*)
FROM actions
WHERE status = 'cancelled_at_execution'
AND created_at > now() - interval '30 days'
GROUP BY cancellation_reason;

-- Should show occasional cancellations. Consistent zeros means either
-- the gate isn't firing or planning is perfectly aligned with reality.
```

---

## GAP 5 — TONE ESCALATION VELOCITY CAP + HISTORY TRACKING

### Problem

Two related issues. First, no cap on how many tone levels can jump in a single cycle — multiple escalation triggers stack without limit. Second, the tone engine (`toneEscalationEngine.ts`) is stateless. It recalculates tone from scratch each cycle based on current signals with no memory of what tone was previously used. This allows both inappropriate jumps up and inappropriate drops down.

**Example of the drop problem:** A debtor at Firm tone sends a low-effort reply ("leave me alone"). The "replied within 7 days" step-down fires, dropping tone to Friendly. When the 7-day window passes, tone jumps back to Firm. The debtor experiences erratic tone shifts.

**Existing data:** `agentToneLevel` is already stored on the actions table (line 806 of shared/schema.ts). The data for tone history lookup exists — the engine just does not read it.

### Fix Part A — Tone History Lookup

At the start of each tone calculation, query the most recent sent action for that debtor and retrieve `agentToneLevel`. If no prior action exists (first contact), skip the velocity cap — the calculated tone is the starting tone.

### Fix Part B — Velocity Cap

```
last_tone = most recent agentToneLevel for this debtor (from actions table)
calculated_tone = what the current stateless engine produces
max_allowed = last_tone + 1
min_allowed = last_tone - 1

capped_tone = clamp(calculated_tone, min_allowed, max_allowed)
```

This enforces:

- **Max +1 per cycle up.** No jumping from Friendly to Formal.
- **Max -1 per cycle down.** A single reply does not crash tone from Firm to Friendly. De-escalation is gradual. An experienced credit controller would need to be convinced before adopting a warmer tone.
- **The engine's signal calculation still matters.** It determines the direction and target — the cap governs the speed.

### Processing Order

```
1. Calculate raw tone from signals (existing logic)
2. Apply velocity cap (new — Part B)
3. Apply hard overrides (existing: vulnerable, good payer, new customer, GENTLE tenant)
```

Hard overrides always win. A vulnerable debtor override still forces Friendly regardless of velocity.

### No-Response Escalation Pressure

Add a new signal: "no response to N consecutive contacts" pushes calculated tone toward Legal. The velocity cap still applies — Charlie walks through each level — but persistent upward pressure gets to Legal within N cycles.

**Threshold:** 4 consecutive contacts with no response (tenant-configurable in settings, default 4).

This replaces the need for any cap bypass conditions. Debtors who go dark experience steady escalation through the cap, not a jump around it.

### Significant Payment Event Override

**Exception to the velocity cap (downward only):** If a debtor pays more than 50% of their total outstanding balance in a single payment, tone resets to Professional regardless of current level. This bypasses the -1 per cycle velocity cap downward.

**Rationale:** The velocity cap exists to prevent gaming via low-effort replies. A substantial payment is the strongest possible signal of good faith — demonstrated with money, not words. A debtor who just paid £40k of a £50k balance should not receive their next communication about the remaining £10k in Formal tone.

```
On payment received:
  If payment_amount > (total_outstanding_before_payment x 0.50):
    Reset agentToneLevel to 'professional' for this debtor
    Log: "Significant payment event — tone reset to Professional"
    Next communication uses Professional regardless of prior tone
```

This override does NOT apply to the upward cap. Only downward resets are permitted via this mechanism.

### Verification

```sql
-- Check no debtor experienced more than 1 tone level change between consecutive actions
SELECT a1.contact_id, a1.agent_tone_level as prev_tone, a2.agent_tone_level as next_tone,
       a1.created_at as prev_date, a2.created_at as next_date
FROM actions a1
JOIN actions a2 ON a1.contact_id = a2.contact_id
  AND a2.created_at > a1.created_at
  AND NOT EXISTS (
    SELECT 1 FROM actions a3
    WHERE a3.contact_id = a1.contact_id
    AND a3.created_at > a1.created_at
    AND a3.created_at < a2.created_at
  )
WHERE abs(tone_to_int(a2.agent_tone_level) - tone_to_int(a1.agent_tone_level)) > 1
AND a2.created_at > now() - interval '30 days';

-- Should return zero rows. Any results indicate a velocity cap violation.
-- tone_to_int: friendly=1, professional=2, firm=3, formal=4, legal=5
```

---

## GAP 9 — LLM CIRCUIT BREAKER + TEMPLATE FALLBACK

### Problem

Every action Charlie sends requires a Claude API call to generate the personalised message. If the Anthropic API goes down, returns errors, times out, or returns degraded responses, there is no fallback. Three failure modes: silent failure (corrupts cadence state), loud failure (action stuck in limbo), or degraded output (unprofessional message sent to debtor).

### Fix Layer 1 — API Failure Handling (Circuit Breaker)

```
For each message generation call:
  Try: call Claude API with 30-second timeout
  On timeout or HTTP 5xx:
    Retry once after 10 seconds
    On second failure:
      Mark action as 'generation_failed'
      Action does NOT proceed to send
      Debtor re-enters next planning cycle
      Log failure with full context

If 3+ consecutive generation failures within 30 minutes (any debtor):
  CIRCUIT OPEN — halt all message generation for this tenant
  Alert tenant admin via email AND SMS
  Retry circuit every 5 minutes with single test call
  On success:
    CIRCUIT CLOSED — resume normal operations
    Alert tenant admin via email AND SMS that circuit has recovered
  Log all circuit open/close events
```

### Fix Layer 2 — Output Quality Validation

Before any generated message is sent:

```
Validate:
  - Message length > minimum (50 chars SMS, 200 chars email)
  - Message length < maximum (160 chars SMS, 5000 chars email)
  - Message contains at least one invoice reference or amount
  - Message contains debtor company name
  - No system prompt leakage (check for common patterns)
```

**Keyword-based tone alignment check:**

```
Friendly:     should NOT contain "legal", "proceedings", "consequences", "failure to"
Professional: should NOT contain "legal", "proceedings"
Firm:         should contain at least one urgency marker ("prompt", "immediate", "overdue", "outstanding")
Formal:       should contain consequence language ("further action", "escalate", "reserve the right")
Legal:        must contain legal framing ("pre-action", "proceedings", "statutory interest", "Civil Procedure")
```

**On validation failure:**

- Regenerate once with same context
- If second attempt also fails validation → mark as `generation_failed`, do not send
- Log both the prompt and output for debugging

### Fix Layer 3 — Template Fallback During Extended Outage

**Activation:** Circuit open for 4+ hours. Template fallback activates for queued actions that have passed their scheduled time by more than 4 hours.

**Behaviour:**
- Under 4 hours circuit open → queue and wait, no templates
- 4+ hours → template fallback for backlog only
- Templates marked as `generationMethod: 'template_fallback'` in action record
- When circuit closes → LLM generation resumes for all subsequent actions
- Voice actions are NOT sent during template fallback — they remain queued until circuit closes

**Template selection:** Based on the action's assigned tone level and channel. See Appendix A for all templates.

**Known limitation:** The Legal tone template references the Pre-Action Protocol Information Sheet and Reply Form as "available upon request" rather than attaching them, because the template system does not have access to document generation. When Charlie operates normally via LLM, Legal tone messages should include or attach these documents.

### Admin Notifications

All circuit breaker state changes notify the tenant admin via BOTH email and SMS:

- Circuit OPEN: "Qashivo alert: Message generation is experiencing issues. Outbound communications have been paused. We are monitoring and will notify you when service resumes."
- Circuit CLOSED: "Qashivo alert: Message generation has recovered. Outbound communications have resumed."

---

## GAP 1 — FEEDBACK LOOP + PAYMENT ATTRIBUTION

### Problem

Charlie uses channel effectiveness scores to decide whether to email, SMS, or call a debtor. These scores should reflect real-world outcomes. Currently the entire delivery event pipeline is dead (see SendGrid finding above), open/click tracking is unreliable (Apple Mail Privacy Protection inflates opens), and payment correlation is missing entirely.

**Depends on:** Gap 8's custom args fix. Once delivery events flow, this gap wires them into the learning engine.

### Fix: Three-Tier Effectiveness Model

Replaces the existing additive formula (`Delivery(0.1) + Opened(0.2) + Clicked(0.1) + Replied(0.3) + Payment(0.5) + QuickPay(0.2) + FullPayment(0.1)`).

New composite effectiveness score per interaction:

```
email_effectiveness = (
  delivery_score x 0.2 +
  engagement_score x 0.2 +
  payment_attribution_score x 0.6
)
```

**Tier 1 — Delivery (weight 0.2, reliable):**
- `delivered` → 1.0
- `bounced` → 0.0
- No delivery event yet → 0.5 (neutral pending confirmation)

**Tier 2 — Engagement (weight 0.2, unreliable, discounted):**
- `opened` → weighted at 0.3 (heavy discount due to Apple Mail inflation)
- `clicked` → weighted at 0.5
- `replied` → weighted at 0.9 (strong signal, already works via inbound parse webhook)
- Engagement score = max of applicable signals (not additive)

**Tier 3 — Payment Outcome (weight 0.6, the real measure):**

Attribution windows (tenant-configurable, these are defaults):

| Window | Credit | Rationale |
|--------|--------|-----------|
| Same day as send | 0.0 (no attribution) | Debtor likely already initiated payment before reading the communication |
| 1-48 hours after send | 1.0 (full credit) | Strong evidence the communication drove the payment |
| 48 hours - 7 days | 0.5 (partial credit) | Communication may have contributed but other factors involved |
| Beyond 7 days | 0.0 (no credit) | Correlation too weak to attribute |

**Multi-channel attribution:**
- Most recent channel gets credit at the applicable rate
- Earlier channels in the same cycle get 0.3 partial credit regardless of timing
- Exception: same-day payment → no attribution to any channel

### Hard Bounce Impact

A hard email bounce bypasses the EMA and immediately drops `emailEffectiveness` to 0.1 for that debtor. This is definitive — the email address does not work. Standard EMA is too gradual for a binary failure.

### EMA Learning Rate

The existing formula `newScore = oldScore x 0.8 + thisInteraction x 0.2` is retained with a fixed 0.8/0.2 split. Adaptive EMA tied to learningConfidence is implemented under Gap 6.

### Wiring Job

1. Connect `communicationOutcomeProcessor` to write back to `customerLearningProfiles` after outcomes arrive
2. Implement the three-tier scoring model as the effectiveness calculation
3. Add payment attribution logic with same-day exclusion and configurable windows
4. Depends on Gap 8 custom args fix for delivery events to flow

### Verification

```sql
-- Confirm effectiveness scores are being updated (no longer static at 0.5)
SELECT email_effectiveness, sms_effectiveness, voice_effectiveness,
       learning_confidence, updated_at
FROM customer_learning_profiles
WHERE updated_at > now() - interval '7 days'
ORDER BY updated_at DESC
LIMIT 20;

-- Confirm payment attribution is working
SELECT a.id, a.contact_id, a.channel, a.sent_at, p.paid_at,
       extract(epoch from (p.paid_at - a.sent_at)) / 3600 as hours_after_send
FROM actions a
JOIN payments p ON a.contact_id = p.contact_id
  AND p.paid_at > a.sent_at
  AND p.paid_at < a.sent_at + interval '7 days'
WHERE a.sent_at > now() - interval '30 days'
ORDER BY hours_after_send;
```

---

## GAP 3 — PORTFOLIO CONTROLLER PER-DEBTOR WEIGHTING

### Problem

The nightly urgency factor (0.1-1.0) is applied uniformly across all debtors. A single large debtor dragging DSO causes Charlie to become more aggressive with every debtor, including reliable payers.

### Fix: Per-Debtor Urgency Weighting

Replace flat urgency with:

```
debtor_urgency = base_urgency x contribution_weight x trend_multiplier
```

**base_urgency** — existing tenant-level factor (0.1-1.0). Unchanged. Represents overall portfolio health.

**contribution_weight** — debtor's share of the problem:

```
contribution_weight = debtor_overdue_amount / total_portfolio_overdue_amount
```

Normalised so average debtor gets weight 1.0.

**trend_multiplier** — pulls `trend` field from `customerBehaviorSignals`:

```
trend > 0 (deteriorating): multiplier = 1.0 + (trend x 0.1), capped at 1.5
trend = 0 (stable):        multiplier = 1.0
trend < 0 (improving):     multiplier = 1.0 + (trend x 0.1), floored at 0.5
```

**Small-balance improving debtors get zero additional pressure.** A debtor with tiny contribution weight and negative trend results in near-zero debtor_urgency — Charlie maintains normal cadence.

### Three-Lever Application

Urgency works through three levers in sequence:

1. **Cadence tightening** — shorter gaps between contacts, up to the playbook hard limits (per-channel min days and max per week)
2. **Tone pressure** — once cadence hits hard limits, additional pressure spills into tone calculation. Subject to Gap 5's velocity cap (+1 per cycle maximum).
3. **Channel escalation** — faster progression to SMS/voice for high-urgency debtors

### Verification

```sql
-- Confirm urgency is differentiated across debtors (not uniform)
SELECT c.name, pu.debtor_urgency, pu.contribution_weight, pu.trend_multiplier
FROM portfolio_urgency pu
JOIN contacts c ON c.id = pu.contact_id
WHERE pu.tenant_id = :tenantId
ORDER BY pu.debtor_urgency DESC;

-- Top urgency debtors should correlate with largest overdue balances + deteriorating trends
```

---

## GAP 7 — P(PAY) LOG-NORMAL DISTRIBUTION MODEL

### Problem

`estimateProbabilityOfPayment()` in `adaptive-scheduler.ts` uses `medianDaysToPay` as the core timing signal via a sigmoid curve but ignores `p75DaysToPay`, `volatility`, and `trend`. A debtor trending toward slower payment gets the same timing prediction as a stable debtor.

**Current implementation (from diagnosis):**

```
base = sigmoid(2.0 x (ageDays / medianDaysToPay) - 1.5)
     + channelBoost (replyRate x 0.6)
     - amountPenalty (log10(amount) / 20, max 0.25)
     + weekdayAdj (multiplier - 1.0)
     + ptpBoost (0.15 if PTP date is in the future)
     → clamped [0, 1]
```

Uses: `medianDaysToPay`, channel reply rates, `weekdayEffect`. Ignores: `p75DaysToPay`, `volatility`, `trend`.

### Fix: Full Log-Normal Distribution

Replace the sigmoid with a log-normal distribution fitted per debtor. Payment timing data is naturally right-skewed — log-normal captures this shape.

**Distribution parameters:**

```
mu = ln(medianDaysToPay) + (trend x trend_weight)
sigma = ln(p75DaysToPay / medianDaysToPay) / 0.6745
```

If `p75DaysToPay` is missing or unreliable, fall back to: `sigma = volatility x scaling_factor`

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `trend_weight` | 3 | One unit of trend shifts the curve by ~3 days. Moderately deteriorating debtor (trend +2) shifts expected payment window by 6 days. |

**mu (location)** — trend-adjusted median. Deteriorating debtor shifts distribution rightward.

**sigma (spread)** — derived from p75 using the mathematical relationship between median and 75th percentile of a log-normal. High volatility or big median-to-p75 gap means wide distribution (less timing certainty).

### What the Distribution Produces

For any given day:

- **PDF** — probability density (when is payment most likely?)
- **CDF** — cumulative probability (chance they have paid by then)
- **Survival function (1 - CDF)** — chance they still have not paid (risk assessment)

### How It Feeds Charlie's Scheduling

The adaptive scheduler receives:

```
p_pay_today = CDF(ageDays + horizon) - CDF(ageDays)
```

This replaces the single sigmoid P(Pay) in the composite scoring formula:

```
score = 1.0 x P(Pay) - 0.35 x Friction - 0.6 x Risk + (0.4 + urgencyFactor) x Urgency
```

Unchanged — just receives a better P(Pay).

### How It Feeds the Weekly CFO Review

For each outstanding invoice:

```
optimistic_date  = quantile(0.25)  // 25% chance they pay by this date
expected_date    = quantile(0.50)  // median expected payment date
pessimistic_date = quantile(0.75)  // 75% chance they pay by this date
```

Multiply by invoice amount and sum across debtors — three-scenario inflow forecasting per week, driven by actual debtor behaviour data. Replaces the current heuristic ("optimistic = pay on time, expected = pay at historic average, pessimistic = 50% later than average").

### Distribution Parameters Visible to Users

Riley can reference the distribution conversationally: "Based on their history, Acme typically pays around day 38 but could stretch to 52."

### Cold Start Segment Priors

When `medianDaysToPay` and `p75DaysToPay` do not exist yet:

| Segment | mu | sigma | Typical Median (days) |
|---------|----|-------|-----------------------|
| small_business | ln(40) | 0.5 | 40 |
| enterprise | ln(50) | 0.4 | 50 |
| freelancer | ln(30) | 0.6 | 30 |
| default | ln(45) | 0.5 | 45 |

These priors are replaced by real data as payment history accumulates (connects to Gap 6).

### What Stays Unchanged

- Channel boost from reply rates
- Weekday effect
- PTP boost
- Amount penalty (generic log10; per-debtor `amountSensitivity` replacement parked for v2)
- Composite scoring formula structure

### Verification

```sql
-- Compare timing predictions for deteriorating vs stable debtors
SELECT c.name,
       bs.median_days_to_pay,
       bs.trend,
       bs.volatility,
       bs.p75_days_to_pay
FROM customer_behavior_signals bs
JOIN contacts c ON c.id = bs.contact_id
WHERE bs.trend > 1
ORDER BY bs.trend DESC;

-- Run before and after: deteriorating debtors' scheduled actions should shift to later timing
```

---

## GAP 6 — COLD START WARM START + DEBTOR INTELLIGENCE ENRICHMENT

### Problem

New debtors start with all channel effectiveness scores at 0.5, learningConfidence at 0.1, no PRS data, no behavioural signals. Charlie's early decisions are uninformed guesses. Learning confidence grows at +0.05 per interaction, taking 18 interactions to reach 0.95.

### Fix Part A — Segment-Level Portfolio Priors (Immediate)

When a new debtor enters, inherit priors from similar debtors in the tenant's portfolio instead of flat defaults.

**Segmentation: two axes:**

- **Size band:** Small (< £10k total invoiced), Medium (£10k-£50k), Large (> £50k)
- **Customer segment:** From `charlieDecisionEngine.ts` — new_customer, good_payer, chronic_late_payer, enterprise, small_business

**Fallback chain:**

```
1. Same segment + same size band within this tenant → best match
2. Same segment, any size band within this tenant → broader match
3. Any segment, same size band within this tenant → size-only match
4. System-wide defaults → last resort
```

**Minimum cohort size:** 5 debtors with learningConfidence > 0.5 before segment priors are trusted. Below 5, fall through to next level.

**System-wide defaults (replacing flat 0.5):**

| Channel | Default | Rationale |
|---------|---------|-----------|
| Email | 0.6 | Email is the workhorse in B2B collections |
| SMS | 0.5 | Effective but not universal |
| Voice | 0.4 | Hardest to connect, most effective when you do |

### Fix Part B — Adaptive EMA (Resolves Gap 1 Parked Question)

Tie EMA learning rate to learningConfidence so early interactions carry more weight:

```
ema_retention = 0.5 + (0.3 x learningConfidence)
ema_new_data  = 1 - ema_retention
```

| Confidence | Retention | New Data | Behaviour |
|------------|-----------|----------|-----------|
| 0.2 (warm started) | 0.56 | 0.44 | Learns fast |
| 0.5 (moderate) | 0.65 | 0.35 | Moderate |
| 0.9 (mature) | 0.77 | 0.23 | Stable, close to original 0.8/0.2 |

### Fix Part C — Confidence Acceleration

Replace fixed +0.05 per interaction with:

```
confidence_increment = 0.1 x (1 - current_confidence)
```

At confidence 0.2: first interaction adds 0.08 (reaches 0.28). At 0.5: adds 0.05. At 0.8: adds 0.02. Fast early gains, slow later refinement.

### Fix Part D — Debtor Intelligence Enrichment

When a new debtor syncs from Xero, trigger an AI enrichment job that builds a genuine risk profile from public data. This replaces and supersedes segment priors once complete.

**Trigger points:**
- Automatically after new contact syncs from Xero (queued, not blocking sync)
- Manually via user request ("Research this debtor")
- Periodic re-enrichment quarterly for debtors with active outstanding balances
- On-demand via Riley ("What's the latest on Acme?")

**Data sources:**

**Companies House API (structured, reliable, free, rate-limited 600 req/5 min):**

| Data Point | What It Yields |
|------------|---------------|
| Company status | active, dormant, dissolved, in administration |
| SIC codes | Industry classification |
| Incorporation date | Company age |
| Accounts filing history | Late filing count and pattern |
| Confirmation statement history | Compliance signal |
| Registered address | Geography |
| Director count and changes | Stability signal |
| Accounts type | Size classification (micro, small, medium, large) |

**Companies House PSC register:**
- Persons of significant control — ownership structure

**CCJ register / Gazette (may require paid API):**
- County Court Judgments — direct credit risk signal
- Insolvency notices — critical risk flag

**AI web search (Claude API with web search tool):**
- Recent news — funding, redundancies, acquisitions, legal actions
- Industry context — sector health, payment culture
- Company website — active/inactive, hiring signals, growth indicators
- Reviews/reputation — Glassdoor, Trustpilot, trade forums

### Debtor Intelligence Profile (New Table: `debtorIntelligence`)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | serial PK | |
| `tenantId` | FK | |
| `contactId` | FK | |
| `companyStatus` | varchar | active, dormant, dissolved, administration |
| `industryCode` | varchar | SIC code(s) |
| `industrySector` | varchar | Human-readable sector name |
| `companyAge` | integer | Years since incorporation |
| `sizeClassification` | varchar | micro, small, medium, large |
| `filingHealth` | decimal | Score based on late filing count/frequency |
| `ccjCount` | integer | Number of CCJs |
| `ccjTotal` | decimal | Total value of CCJs |
| `insolvencyRisk` | boolean | Flag from Gazette |
| `directorStability` | decimal | Score based on director changes |
| `newsSignals` | jsonb | Array of recent relevant findings |
| `aiRiskSummary` | text | Plain English paragraph from Claude |
| `enrichedAt` | timestamp | When enrichment last ran |
| `enrichmentSource` | jsonb | Which sources were successfully queried |
| `creditRiskScore` | integer | Composite 0-100 score |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### Credit Risk Scoring Model

```
Base score: 50 (neutral)

Positive signals:
+ Company age > 5 years:              +10
+ Company age > 10 years:             +5 (additional)
+ No late filings in 3 years:         +10
+ No CCJs:                            +10
+ Accounts filed as medium/large:     +5
+ Active hiring (from web search):    +5

Negative signals:
- Late filings (per instance):        -3 (up to -15)
- CCJs (per CCJ):                     -12 (up to -36)
- Insolvency notice:                  -50 (critical)
- Dormant status:                     -20
- Director changes > 3 in 2 years:    -10
- Negative news signals:              -5 to -15 (AI assessed)
- Company age < 2 years:              -10
- Dissolved:                          -50 (almost certainly uncollectable)

Clamped to 0-100.
```

### How Enrichment Feeds Charlie

- **Cold start priors** — enrichment replaces segment priors entirely for enriched debtors
- **Tone calibration** — debtors with CCJs and late filings get firmer baseline tone
- **Risk tagging** — feeds existing credit risk score on the debtor record
- **Riley context** — Riley references enrichment data conversationally
- **Partner portal** — portfolio-level risk heatmaps driven by real credit data
- **P(Pay) priors** — industry-specific payment norms can refine the cold start distribution parameters from Gap 7

### Verification

```sql
-- Confirm enrichment is running for new debtors
SELECT c.name, di.credit_risk_score, di.company_status, di.ccj_count,
       di.enriched_at, di.enrichment_source
FROM debtor_intelligence di
JOIN contacts c ON c.id = di.contact_id
WHERE di.enriched_at > now() - interval '30 days'
ORDER BY di.enriched_at DESC;

-- Confirm cold start priors differ from flat 0.5
SELECT clp.email_effectiveness, clp.sms_effectiveness, clp.voice_effectiveness,
       clp.learning_confidence
FROM customer_learning_profiles clp
WHERE clp.learning_confidence < 0.3
AND (clp.email_effectiveness != 0.5
  OR clp.sms_effectiveness != 0.5
  OR clp.voice_effectiveness != 0.5);
```

---

## GAP 10 — PRE-ACTION 30-DAY STATUTORY RESPONSE WINDOW

### Problem

When Charlie sends a Legal tone Letter Before Action, the Pre-Action Protocol for Debt Claims under the Civil Procedure Rules requires a 30-day response period during which the creditor must not commence proceedings. This is a legal requirement, not a preference.

**No hard constraint exists in Charlie's playbook today.** If a high urgency factor, missed PTP, or portfolio pressure triggers a follow-up communication during the 30-day window, that follow-up could be argued as harassment and could invalidate the pre-action compliance. This is a compliance gap that exists independent of the new "Time to Pay Up" legislation.

### Fix: Hard Constraint on Legal Tone Actions

```
When an action is sent with agentToneLevel = 'legal':
  → Debtor enters 30-day statutory response window
  → ALL automated contact suspended for that debtor
    - All channels (email, SMS, voice)
    - All invoices (not just the invoices in the Legal action)
  → NO OVERRIDE — not urgency, not missed PTP, not portfolio pressure,
    not manual "Run Agent Now"
  → This is a LEGAL REQUIREMENT, not a configurable setting

  → Day 25: Riley notifies user:
    "The 30-day response period for {companyName} expires in 5 days.
    No payment or response received.
    Shall I prepare the file for debt recovery?"

  → Day 30: Debtor exits response window
    → If payment received during window: normal processing
    → If dispute raised during window: enters dispute workflow
      (see DISPUTE_RESOLUTION_SPEC.md)
    → If no response and no payment: eligible for court referral /
      debt recovery handoff. Riley prompts user for decision.
```

**This constraint operates above the velocity cap, above urgency, above all other scheduling logic.** It is the highest priority rule in the execution pipeline after only the "debtor on hold" check.

### Implementation

Add a `legalResponseWindowEnd` timestamp field to the contact/debtor record. Set to `sent_at + 30 days` when a Legal tone action is sent. The execution-time gate (Gap 4) checks this field before sending any action to this debtor:

```
if (debtor.legalResponseWindowEnd && now() < debtor.legalResponseWindowEnd):
  cancel action
  status = 'cancelled_at_execution'
  cancellationReason = 'legal_response_window_active'
```

### Verification

```sql
-- Confirm no actions were sent to debtors during their legal response window
SELECT a.contact_id, a.sent_at, c.legal_response_window_end
FROM actions a
JOIN contacts c ON c.id = a.contact_id
WHERE a.delivery_status IN ('sent', 'delivered')
AND a.sent_at < c.legal_response_window_end
AND a.sent_at > c.legal_response_window_end - interval '30 days'
AND a.agent_tone_level != 'legal';

-- Should return zero rows. Any results indicate a compliance violation.
```

---

## GAP 11 — DEBTOR CHANNEL PREFERENCE HARD OVERRIDES

### Problem

If a debtor says "don't call me, email only" during a Retell AI call, Charlie must respect that as a hard channel constraint. Currently, channel selection in `charlieDecisionEngine.ts` may override debtor preferences based on escalation logic, urgency, or value thresholds. Channel preferences stated by the debtor are a compliance and relationship issue — ignoring them damages trust and could be raised as a defence in court proceedings.

**Note:** Channel preference checkboxes may already exist on the Debtor Detail page UI. Verify with Claude Code diagnostic whether these exist and whether `charlieDecisionEngine.ts` currently reads them as hard overrides.

### Fix: Hard Channel Override

Debtor channel preferences are set via:
- Manual toggle by user on Debtor Detail page (checkboxes per channel)
- Riley intelligence extraction from conversation (debtor states preference)
- Detected from Retell AI call transcript (debtor says "don't call me")

These are stored on the contact record as:

```
channelEmailEnabled: boolean (default true)
channelSmsEnabled: boolean (default true)
channelVoiceEnabled: boolean (default true)
channelPreferenceSource: 'user_manual' | 'riley_conversation' | 'call_transcript'
channelPreferenceNotes: text (e.g., "Debtor requested email only during call on 15 March")
```

**Charlie's channel selection MUST check these before choosing a channel:**

```
if (!debtor.channelEmailEnabled && selectedChannel === 'email'):
  → fall to next available channel
if (!debtor.channelSmsEnabled && selectedChannel === 'sms'):
  → fall to next available channel
if (!debtor.channelVoiceEnabled && selectedChannel === 'voice'):
  → fall to next available channel
if (no channels enabled):
  → flag debtor as "No Available Channel", surface to user via Riley
  → do NOT send via any channel
```

**These overrides cannot be bypassed** by escalation logic, urgency factor, value thresholds, or any other signal. They are hard constraints at the same level as the vulnerable debtor override.

### Riley Intelligence Extraction

Add channel preference detection to Riley's extraction prompt:

```
If the debtor or their representative states a communication preference
(e.g., "don't call me", "email only", "prefer text messages"),
extract as: debtorUpdates[{contactId, field: "channelPreference", value: {...}}]
```

### Verification

```sql
-- Confirm no actions were sent via disabled channels
SELECT a.contact_id, a.channel, c.channel_email_enabled,
       c.channel_sms_enabled, c.channel_voice_enabled
FROM actions a
JOIN contacts c ON c.id = a.contact_id
WHERE a.delivery_status IN ('sent', 'delivered')
AND ((a.channel = 'email' AND c.channel_email_enabled = false)
  OR (a.channel = 'sms' AND c.channel_sms_enabled = false)
  OR (a.channel = 'voice' AND c.channel_voice_enabled = false))
AND a.created_at > now() - interval '30 days';

-- Should return zero rows.
```

---

## GAP 12 — LIGHTWEIGHT DEBTOR GROUPING

### Problem

In SME collections, group structures are common. Acme Holdings owns Acme Manufacturing, Acme Services, and Acme Logistics. They may be separate contacts in Xero but share the same AP department, the same decision-maker, and the same bank account. Charlie currently treats each contact independently. If all four entities are overdue, Charlie could send four separate emails to the same person on the same day — or worse, use different tones across related entities because each has a different PRS.

### Fix (v1.1 scope): Schema, UI, Tone Consistency, Conflict Detection

**v1.1 implements steps 1 and 2 only. Steps 3 and 4 are parked for v2.**

**Step 1 — Tone consistency across group (v1.1):**
All contacts in a debtor group receive the same tone in any given cycle. The group tone is the highest calculated tone among all group members. If Acme Manufacturing calculates Firm and Acme Services calculates Friendly, both receive Firm.

**Step 2 — Same-day conflict detection (v1.1):**
After the planning engine generates all actions, scan for group conflicts: multiple actions to contacts in the same group on the same day. If detected, consolidate into a single action referencing all entities, or stagger across consecutive days.

**Step 3 — Cadence coordination across group (v2):**
Shared cadence across group members so the AP department isn't contacted by multiple entities within the cooldown period.

**Step 4 — Shared intelligence across group (v2):**
A PTP from one entity pauses chasing across the group if they share AP. Payment behaviour signals inherited across group members.

### Schema

**New table: `debtorGroups`**

| Field | Type | Purpose |
|-------|------|---------|
| `id` | serial PK | |
| `tenantId` | FK | |
| `groupName` | varchar | User-assigned name (e.g., "Acme Group") |
| `notes` | text | Context about the group relationship |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Extended: `contacts` table**

| Field | Type | Purpose |
|-------|------|---------|
| `debtorGroupId` | integer FK (nullable) | Links to debtorGroups. Null = ungrouped. |

### UI

- **Debtor Detail page:** "Link to group" action. Search and select existing group or create new.
- **Debtor list:** Group indicator icon on grouped contacts.
- **Riley suggestion:** Riley can suggest groupings based on matching email domains or matching registered addresses from enrichment data (Gap 6). "Acme Manufacturing and Acme Services share the same email domain — shall I link them as a group?"

### Planning Engine Integration

After `actionPlanner.ts` generates all actions for a tenant:

```
1. Identify all actions where the contact belongs to a debtorGroup
2. Group actions by debtorGroupId
3. For each group with multiple actions on the same day:
   a. Set tone to the highest tone among all group members' actions
   b. Either consolidate into single action or stagger across days
   c. Log the adjustment: "Tone aligned across Acme Group — elevated to Firm"
```

### Verification

```sql
-- Confirm no group had inconsistent tones on the same day
SELECT dg.group_name, a.agent_tone_level, date(a.scheduled_for), count(*)
FROM actions a
JOIN contacts c ON c.id = a.contact_id
JOIN debtor_groups dg ON dg.id = c.debtor_group_id
WHERE a.created_at > now() - interval '30 days'
AND a.status IN ('sent', 'delivered', 'approved')
GROUP BY dg.group_name, date(a.scheduled_for), a.agent_tone_level
HAVING count(DISTINCT a.agent_tone_level) > 1;

-- Should return zero rows. Multiple tones for same group on same day = violation.
```

---

## GAP 13 — SEASONAL PAYMENT PATTERN INTEGRATION

### Problem

The P(Pay) distribution model (Gap 7) treats every month identically. Many industries have strong seasonal payment patterns — construction slows in winter, retail delays in January, nearly every business accelerates payments before their financial year-end. A debtor who reliably pays late in December but on time the rest of the year gets the same treatment year-round.

The `weekdayEffect` in `customerBehaviorSignals` captures day-of-week patterns but there is no month-of-year or quarter-end signal.

### Fix: Seasonal aiFacts Feeding P(Pay) Distribution

**Phase 1 — Intelligence gathering via Riley:**

Update Riley's intelligence extraction prompt to recognise seasonal pattern statements:

```
If the user mentions seasonal payment patterns (e.g., "December is always slow",
"they pay everything before their March year-end", "construction clients delay in winter"),
extract as: facts[{
  category: "seasonal_pattern",
  entityType: "debtor" or "tenant" (if industry-wide),
  entityId: contactId or null,
  factKey: "slow_month" | "fast_month" | "year_end_month" | "seasonal_note",
  factValue: "december" | "march" | descriptive text,
  confidence: 1.0 (user stated directly)
}]
```

Riley should also proactively ask about seasonal patterns during onboarding: "Are there any months where your clients typically pay slower or faster?"

**Phase 2 — P(Pay) monthly adjustment:**

Seasonal aiFacts modify the log-normal distribution's mu parameter on a per-month basis:

```
For a debtor with seasonal_pattern facts:
  slow_month: mu_adjusted = mu + 0.15 (shifts expected payment ~15% later)
  fast_month: mu_adjusted = mu - 0.15 (shifts expected payment ~15% earlier)
  year_end_month: mu_adjusted = mu - 0.20 (stronger pull-forward effect)
```

For tenant-wide seasonal patterns (no specific debtor), apply to all debtors unless overridden by debtor-specific seasonal facts.

**Phase 3 — Learned seasonal patterns (data-driven):**

Once sufficient payment history exists (12+ months per debtor), calculate actual monthly payment velocity relative to annual average:

```
monthly_factor[month] = avg_days_to_pay_in_month / avg_days_to_pay_overall
```

If December's average is 35 days and the overall average is 25 days, the December factor is 1.4 — payments take 40% longer. Apply this as a mu multiplier in the P(Pay) distribution for that month.

Learned patterns override Riley-captured facts when learningConfidence > 0.7 for the debtor.

### Verification

```sql
-- Confirm seasonal adjustments are being applied
SELECT af.entity_id, af.fact_key, af.fact_value, af.confidence
FROM ai_facts af
WHERE af.category = 'seasonal_pattern'
AND af.is_active = true
ORDER BY af.entity_id, af.fact_key;

-- Cross-reference: scheduled actions in slow months should have later timing
-- compared to the same debtors in normal months
```

---

## GAP 14 — UNRECONCILED PAYMENT DETECTION

### Problem

Charlie's decisions depend on invoice status from Xero. If a debtor has paid but the payment hasn't been reconciled in Xero, the invoice remains marked as unpaid. Charlie chases a debtor who has already paid. This is the single most damaging failure mode for user trust — one incorrect chase after payment can undo weeks of relationship building and destroy the creditor's confidence in Qashivo.

In SME accounting, bank reconciliation commonly lags days or weeks behind actual payments. The payment sits in the Xero bank feed as an unmatched transaction. Qashivo has no visibility into this — it only sees invoice status.

### Current State (from Claude Code diagnosis)

`xero.ts` has fully implemented API methods for bank transactions:
- `getBankTransactions()` (line 927) — fetches from Xero BankTransactions endpoint with filters
- `getBankTransaction()` (line 995) — fetches single transaction by ID
- `XeroBankTransaction` interface defined (line 124)

`xeroSync.ts` does NOT call them during sync:
- `bankTransactionsCount` in sync result is hardcoded to 0 in every return path
- `bank_transactions` table gets truncated on initial sync but nothing repopulates it
- No `getBankTransactions()` call anywhere in the sync flow

The plumbing exists. Nothing flows through it.

### Fix: Two-Source Architecture

**Critical Xero API boundary:** Xero's March 2026 developer terms prohibit using API data for AI/ML training. The architecture must use Xero data for operational inference only (reading and matching — permitted) and Open Banking data for learning and model training (fully permitted under customer consent).

#### Phase 1 — Xero Signal Layer (inference only, implement now)

Wire `getBankTransactions()` into the sync pipeline. After each sync, run a matching algorithm against outstanding invoices.

**Sync integration:**

```
During each Xero sync (initial and ongoing):
  1. Fetch unreconciled bank transactions (type: RECEIVE, status: unreconciled)
  2. For each unreconciled transaction, run matching algorithm
  3. Store matches in probablePayments table
  4. Flag matched debtors as "probable payment received"
```

**Matching algorithm:**

```
For each unreconciled bank RECEIVE transaction:

  HIGH CONFIDENCE (any one of these):
  - Transaction amount exactly matches one outstanding invoice amount
    for a debtor whose name appears in the transaction reference
  - Transaction reference contains an invoice number that exists
    in outstanding invoices

  MEDIUM CONFIDENCE (combination required):
  - Transaction amount matches the total of multiple outstanding
    invoices for the same debtor
  - OR transaction amount exactly matches an invoice amount
    but payer name is ambiguous

  LOW CONFIDENCE:
  - Transaction amount matches an invoice amount but no
    corroborating name or reference match

  For HIGH and MEDIUM confidence matches:
    → Flag debtor as probable_payment_detected
    → Charlie suspends chasing for this debtor
    → Riley notifies user: "I found a £15,000 bank transaction 
      that looks like it matches Acme Ltd's invoice {ref}. 
      Can you confirm and reconcile?"
  
  For LOW confidence:
    → Do not suspend chasing
    → If P(Pay) model also predicts >60% probability of payment
      by now, flag action for human approval rather than auto-send
```

**What this layer MUST NOT do (Xero API compliance):**

- Must NOT store payment timing patterns derived from bank transaction data
- Must NOT feed bank transaction dates into the P(Pay) model
- Must NOT train any model on bank transaction data
- Must NOT use bank transactions to calculate behavioural signals
- This is a read-and-react safety check. Match, flag, notify. Nothing more.

**Charlie integration — execution-time gate addition (extends Gap 4):**

```
Before sending any action, check:
  ...existing Gap 4 checks...
  - Does this debtor have a probable_payment_detected flag? 
    → If HIGH/MEDIUM confidence: cancel action, 
      status = 'cancelled_at_execution',
      cancellationReason = 'probable_payment_detected'
    → If LOW confidence + P(Pay) > 0.6: downgrade to pending_approval,
      flag message: "Payment may have been received but not reconciled"
```

**P(Pay) defensive check (Approach 1 — no bank data needed):**

Even without bank transaction matching, the P(Pay) distribution from Gap 7 provides a statistical estimate of whether payment has likely occurred. Before any action auto-sends:

```
If CDF(days_overdue) > 0.60 for this debtor:
  → This debtor has statistically likely paid by now
  → Flag action for human approval in all autonomy modes
  → Riley prompt: "Based on {companyName}'s payment history, 
    they typically pay by now. Can you check your bank feed 
    before I send this chase?"
```

This check works immediately, before the bank transaction matching is built, and provides a safety net even for tenants who reconcile promptly.

#### Phase 2 — Open Banking Confirmation + Learning Layer (dependent on Open Banking integration)

When Open Banking is connected (via TrueLayer or Yapily), it provides real-time payment notifications directly from the bank account. This layer:

**Confirms or refutes Xero signals:**

```
Xero signal: probable payment detected for Acme Ltd
Open Banking: confirms £15,000 BACS receipt from Acme Ltd at 14:32 today
→ Match confirmed. Invoice status updated. Chasing definitively suspended.
→ User notified: reconciliation needed in Xero
```

**Trains all learning models (fully permitted):**

All learning happens from Open Banking data, not Xero data:

- Actual payment timing → feeds P(Pay) distribution parameters (mu, sigma)
- Reconciliation lag per tenant → how long between bank receipt and Xero reconciliation
- Payment method patterns → BACS, Faster Payment, cheque, card
- Day-of-week and time-of-day patterns → feeds weekdayEffect
- Amount patterns → pays in full, partial, rounds down
- Payment attribution → confirms which communication drove the payment (feeds Gap 1)

**Reconciliation lag measurement:**

```
reconciliation_lag = xero_invoice_paid_date - open_banking_payment_date
```

This metric per tenant tells Charlie how much to trust Xero data freshness. A tenant with 1-day lag needs minimal defensive behaviour. A tenant with 7-day lag needs aggressive probable-payment checking.

Riley surfaces this: "Your bank reconciliation is running about 5 days behind. I'm being extra cautious about chasing debtors whose payments are statistically due."

**Auto-resolution of forecast items:**

When Open Banking detects a payment matching a forecast item in `forecastUserAdjustments`, auto-resolve it — no need to ask the user if the expected payment went through. Riley notes it in the weekly review: "The £15k payment from Acme arrived on Tuesday."

### Schema

**New table: `probablePayments`**

| Field | Type | Purpose |
|-------|------|---------|
| `id` | serial PK | |
| `tenantId` | FK | |
| `contactId` | FK (nullable) | Matched debtor, if identified |
| `invoiceId` | FK (nullable) | Matched invoice, if identified |
| `bankTransactionId` | varchar | Xero bank transaction ID |
| `transactionDate` | date | Date of bank transaction |
| `transactionAmount` | decimal | Amount received |
| `transactionReference` | text | Payer reference from bank |
| `matchConfidence` | varchar | high, medium, low |
| `matchReason` | text | Why matched (exact amount, reference match, etc.) |
| `status` | varchar | pending, confirmed, rejected, expired |
| `confirmedBy` | varchar | user_manual, open_banking, xero_reconciliation |
| `confirmedAt` | timestamp | When confirmed |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Extended: `contacts` table**

| Field | Type | Purpose |
|-------|------|---------|
| `probablePaymentDetected` | boolean (default false) | Flag for execution-time gate |
| `probablePaymentConfidence` | varchar (nullable) | high, medium, low |
| `probablePaymentDetectedAt` | timestamp (nullable) | When the signal was raised |

### Verification

```sql
-- Confirm bank transactions are being synced (no longer hardcoded to 0)
SELECT tenant_id, count(*) as unreconciled_count, max(created_at) as latest
FROM bank_transactions
WHERE is_reconciled = false
AND transaction_type = 'RECEIVE'
GROUP BY tenant_id;

-- Confirm probable payments are being detected
SELECT pp.match_confidence, count(*), 
       count(*) filter (where pp.status = 'confirmed') as confirmed,
       count(*) filter (where pp.status = 'rejected') as false_positives
FROM probable_payments pp
WHERE pp.created_at > now() - interval '30 days'
GROUP BY pp.match_confidence;

-- False positive rate: rejected / total should be < 10% for HIGH confidence
-- If higher, matching algorithm needs tuning

-- Confirm actions are being cancelled for probable payments
SELECT count(*)
FROM actions
WHERE cancellation_reason = 'probable_payment_detected'
AND created_at > now() - interval '30 days';

-- Cross-reference with actual reconciliation: how many cancelled actions
-- were correctly cancelled (payment was real)?
SELECT a.id, pp.status as payment_status
FROM actions a
JOIN probable_payments pp ON pp.contact_id = a.contact_id
  AND pp.created_at < a.created_at
WHERE a.cancellation_reason = 'probable_payment_detected'
AND a.created_at > now() - interval '30 days';
```

---

## JURISDICTION SCOPE AND LIMITATIONS

### Current Scope: England and Wales Only

All compliance logic, template language, statutory references, and pre-action protocol procedures in this spec are based on the law of England and Wales. Specifically:

- Pre-Action Protocol for Debt Claims (Civil Procedure Rules)
- Late Payment of Commercial Debts (Interest) Act 1998
- UK Government "Time to Pay Up" legislation (published 24 March 2026, implementation no earlier than 2027)
- RIPA 2000 (voice recording)

### Known Limitations

- **Scotland:** Separate legal system. Different pre-action procedures. The Legal tone template and 30-day response window may not be correct for Scottish debtors.
- **Northern Ireland:** Follows different court rules and procedures.
- **International:** No coverage for non-UK debtors.

### v2 Scope: International Jurisdiction Framework

A jurisdiction flag per debtor will be implemented in v2, with template and compliance rules switching based on jurisdiction. This will be designed as an international framework from the outset, not a UK-only extension. The enrichment data from Companies House (Gap 6) can provide the registered address which indicates jurisdiction.

---

## SCHEMA CHANGES SUMMARY

### New Tables

| Table | Purpose |
|-------|---------|
| `debtorIntelligence` | AI enrichment data from Companies House, CCJ register, web search (Gap 6) |
| `debtorGroups` | Linked debtor entities sharing AP department or ownership (Gap 12) |
| `probablePayments` | Unreconciled bank transaction matches against outstanding invoices (Gap 14) |

### Extended Tables

| Table | New Fields |
|-------|-----------|
| `actions` | `providerMessageId` (varchar), `deliveryStatus` (varchar), `deliveryConfirmedAt` (timestamp), `deliveryRawPayload` (jsonb), `retryCount` (integer), `retryOf` (integer FK), `voiceContactRecord` (jsonb), `generationMethod` (varchar), `cancellationReason` (varchar) |
| `tenants` | `minimumChaseThreshold` (decimal, default 50), `noResponseEscalationThreshold` (integer, default 4), `paymentAttributionFullCreditHours` (integer, default 48), `paymentAttributionPartialCreditDays` (integer, default 7), `paymentAttributionSameDayExcluded` (boolean, default true) |
| `contacts` | `legalResponseWindowEnd` (timestamp, nullable — Gap 10), `debtorGroupId` (integer FK nullable — Gap 12), `channelEmailEnabled` (boolean, default true — Gap 11), `channelSmsEnabled` (boolean, default true — Gap 11), `channelVoiceEnabled` (boolean, default true — Gap 11), `channelPreferenceSource` (varchar — Gap 11), `channelPreferenceNotes` (text — Gap 11), `probablePaymentDetected` (boolean, default false — Gap 14), `probablePaymentConfidence` (varchar, nullable — Gap 14), `probablePaymentDetectedAt` (timestamp, nullable — Gap 14) |

### Existing Tables — No Schema Change, Logic Change Only

| Table | Change |
|-------|--------|
| `customerLearningProfiles` | PRS calculation changes to Bayesian + recency weighted. Effectiveness scores updated via three-tier model. Adaptive EMA. No new columns needed. |
| `customerBehaviorSignals` | `trend` field now consumed by Portfolio Controller (Gap 3) and P(Pay) model (Gap 7). No new columns needed. |

---

## APPENDIX A — TEMPLATE FALLBACK MESSAGES

Templates are used ONLY during extended LLM outages (circuit open 4+ hours). Every template message is marked `generationMethod: 'template_fallback'` in the action record.

**Dynamic placeholders:**

```
{companyName}        — debtor company name
{contactName}        — AR contact name, fallback to "Accounts Department"
{totalOutstanding}   — total amount owed
{oldestInvoiceRef}   — reference number of oldest overdue invoice
{oldestInvoiceDays}  — days overdue on oldest invoice
{invoiceCount}       — number of overdue invoices
{creditorName}       — the tenant's company name
{agentName}          — the persona name (from agent setup)
{agentTitle}         — the persona title
{agentEmail}         — reply-to email
{agentPhone}         — contact number
```

**Voice actions are NOT sent during template fallback.** They remain queued until the circuit closes.

---

### EMAIL — FRIENDLY

**Subject:** Payment reminder — {oldestInvoiceRef}

Dear {contactName},

I hope this message finds you well.

I am writing regarding {invoiceCount} outstanding invoice(s) totalling {totalOutstanding} on behalf of {creditorName}. The oldest of these, {oldestInvoiceRef}, is now {oldestInvoiceDays} days past the due date.

This may simply be an oversight, and if payment has already been arranged, please disregard this message. If there are any queries regarding these invoices, I would be happy to assist in resolving them promptly.

Could you kindly confirm when we might expect payment, or let me know if there is anything preventing settlement?

Kind regards,
{agentName}
{agentTitle}
{creditorName}
{agentEmail} | {agentPhone}

---

### EMAIL — PROFESSIONAL

**Subject:** Overdue payment — {oldestInvoiceRef} — action required

Dear {contactName},

I am writing to follow up on {invoiceCount} overdue invoice(s) totalling {totalOutstanding} owed to {creditorName}. The oldest, {oldestInvoiceRef}, is now {oldestInvoiceDays} days beyond the agreed payment terms.

Despite our previous correspondence, payment has not yet been received. I would appreciate your prompt attention to this matter.

Please arrange payment at your earliest convenience and confirm the expected date of settlement. If there is a query or dispute preventing payment, please contact me directly so that we can resolve it without further delay.

I look forward to hearing from you.

Yours sincerely,
{agentName}
{agentTitle}
{creditorName}
{agentEmail} | {agentPhone}

---

### EMAIL — FIRM

**Subject:** Urgent — overdue account requires immediate attention — {oldestInvoiceRef}

Dear {contactName},

I am writing regarding the overdue balance of {totalOutstanding} owed to {creditorName} across {invoiceCount} invoice(s). The oldest, {oldestInvoiceRef}, is now {oldestInvoiceDays} days past the agreed payment terms.

This balance has remained unpaid despite previous reminders. This is now a matter requiring your immediate attention.

Please arrange payment in full within 7 days of this notice. If payment cannot be made in full, please contact me within 48 hours to discuss a payment arrangement. Failure to respond or make payment may result in further action to recover the amount owed.

I would strongly prefer to resolve this matter directly with you and avoid any escalation.

Yours sincerely,
{agentName}
{agentTitle}
{creditorName}
{agentEmail} | {agentPhone}

---

### EMAIL — FORMAL

**Subject:** Formal notice — overdue account — {totalOutstanding} — {oldestInvoiceRef}

Dear {contactName},

FORMAL NOTICE OF OVERDUE ACCOUNT

I am writing to formally notify you that the sum of {totalOutstanding} remains outstanding and payable to {creditorName}. This relates to {invoiceCount} invoice(s), the oldest being {oldestInvoiceRef}, now {oldestInvoiceDays} days beyond the agreed payment terms.

Repeated attempts to resolve this matter have not resulted in payment or a satisfactory response.

Please be advised that {creditorName} reserves the right to charge statutory interest and compensation under the Late Payment of Commercial Debts (Interest) Act 1998. At the current Bank of England base rate plus 8%, interest is accruing daily on the outstanding balance.

I urge you to arrange settlement of this account in full within 7 days of the date of this notice. If you wish to discuss a payment arrangement, please contact me immediately.

If payment or a suitable proposal is not received within this period, we will have no alternative but to consider further recovery action.

Yours sincerely,
{agentName}
{agentTitle}
{creditorName}
{agentEmail} | {agentPhone}

---

### EMAIL — LEGAL

**Subject:** Pre-action notice — {creditorName} v {companyName} — {totalOutstanding}

Dear {contactName},

LETTER BEFORE ACTION

This letter serves as formal notice in accordance with the Pre-Action Protocol for Debt Claims under the Civil Procedure Rules.

{creditorName} is owed the sum of {totalOutstanding} in respect of {invoiceCount} unpaid invoice(s). The oldest of these, {oldestInvoiceRef}, is now {oldestInvoiceDays} days past the agreed payment terms.

All reasonable efforts to recover this debt by correspondence have been exhausted without satisfactory resolution.

{creditorName} hereby demands payment of the full outstanding balance, together with statutory interest and fixed compensation payable under the Late Payment of Commercial Debts (Interest) Act 1998, within 30 days of the date of this letter.

If payment is not received within 30 days, {creditorName} intends to commence court proceedings to recover the debt, interest, compensation, and costs without further notice to you.

You are advised to seek independent legal advice. If you believe you have a valid defence or counterclaim, or if you wish to propose a payment arrangement, you must respond in writing within 30 days.

A copy of the Information Sheet and Reply Form as prescribed by the Pre-Action Protocol is available upon request.

Yours faithfully,
{agentName}
{agentTitle}
{creditorName}
{agentEmail} | {agentPhone}

---

### SMS — FRIENDLY

Reminder from {creditorName}: Invoice {oldestInvoiceRef} for {totalOutstanding} is now {oldestInvoiceDays} days overdue. If already paid, please disregard. Any queries, please contact {agentName} on {agentEmail}

---

### SMS — PROFESSIONAL

{creditorName}: Your account has {invoiceCount} overdue invoice(s) totalling {totalOutstanding}. The oldest ({oldestInvoiceRef}) is {oldestInvoiceDays} days past terms. Please arrange payment or contact {agentName} on {agentEmail}

---

### SMS — FIRM

URGENT — {creditorName}: {totalOutstanding} overdue across {invoiceCount} invoice(s), oldest {oldestInvoiceDays} days past terms. Immediate payment or contact within 48 hours required. {agentName}: {agentEmail}

---

### SMS — FORMAL

FORMAL NOTICE — {creditorName}: {totalOutstanding} remains unpaid ({oldestInvoiceDays} days overdue). Statutory interest accruing under Late Payment Act 1998. Payment within 7 days required. Contact {agentName}: {agentEmail}

---

### SMS — LEGAL

PRE-ACTION NOTICE — {creditorName}: {totalOutstanding} outstanding. Legal proceedings will be commenced if payment not received within 30 days. Seek independent legal advice. Contact {agentName}: {agentEmail}

---

## APPENDIX B — CROSS-GAP DEPENDENCIES

```
Gap 8 (delivery confirmation)
  └── Prerequisite for Gap 1 (feedback loop needs delivery events flowing)
  └── Connects to Data Health (hard bounce auto-flips status)

Gap 2 (PRS Bayesian + recency)
  └── Standalone — no dependencies

Gap 4 (execution-time re-validation)
  └── Standalone — no dependencies
  └── Introduces minimum chase threshold (new tenant setting)
  └── Gap 10 legal response window check added to execution gate

Gap 5 (tone velocity cap)
  └── Reads agentToneLevel from actions table (already exists)
  └── Must be respected by Gap 3 urgency-driven tone pressure
  └── Significant payment event override bypasses cap downward only

Gap 10 (pre-action 30-day window)
  └── Integrates into Gap 4 execution-time gate
  └── Legal requirement — highest priority constraint after debtor-on-hold
  └── Riley notification at day 25

Gap 9 (circuit breaker)
  └── Standalone — no dependencies
  └── Template fallback messages in Appendix A

Gap 11 (channel preference overrides)
  └── Integrates into charlieDecisionEngine.ts channel selection
  └── Riley intelligence extraction detects stated preferences
  └── Verify existing UI checkboxes via Claude Code diagnostic

Gap 1 (feedback loop)
  └── Depends on Gap 8 (custom args + event bus wiring)
  └── EMA rate connects to Gap 6 (adaptive EMA)

Gap 3 (portfolio controller per-debtor)
  └── Uses trend from customerBehaviorSignals (shared with Gap 7)
  └── Urgency-driven tone pressure subject to Gap 5 velocity cap

Gap 7 (P(Pay) distribution)
  └── Uses trend, volatility, p75 from customerBehaviorSignals
  └── Cold start priors connect to Gap 6
  └── Feeds Weekly CFO Review three-scenario forecasting
  └── Seasonal adjustments from Gap 13 modify mu per month

Gap 12 (debtor grouping)
  └── Post-planning coordination in actionPlanner.ts
  └── Riley suggests groupings from Gap 6 enrichment data (matching domains/addresses)

Gap 13 (seasonal patterns)
  └── Feeds into Gap 7 P(Pay) distribution as monthly mu adjustments
  └── Riley intelligence extraction captures seasonal facts
  └── Learned patterns from payment history override Riley-captured facts

Gap 6 (cold start + enrichment)
  └── Adaptive EMA resolves Gap 1 parked question
  └── Enrichment replaces segment priors from Part A
  └── Enrichment feeds risk scoring, tone, Riley context, partner portal
  └── P(Pay) cold start priors defined in Gap 7
  └── Enrichment data can suggest debtor groupings for Gap 12

Gap 14 (unreconciled payment detection)
  └── Phase 1 (Xero signal layer): wires existing getBankTransactions() into sync
  └── Extends Gap 4 execution-time gate with probable payment check
  └── Uses Gap 7 P(Pay) CDF as secondary defensive check
  └── Phase 2 (Open Banking): dependent on Open Banking integration
  └── Phase 2 feeds Gap 1 payment attribution with confirmed payment data
  └── Phase 2 feeds Gap 7 P(Pay) model training (permitted on Open Banking data)
  └── Xero API compliance: inference only, no training on bank transaction data
```

---

## APPENDIX C — TENANT-CONFIGURABLE SETTINGS ADDED

| Setting | Default | Gap |
|---------|---------|-----|
| `minimumChaseThreshold` | £50 | Gap 4 |
| `noResponseEscalationThreshold` | 4 consecutive contacts | Gap 5 |
| `paymentAttributionFullCreditHours` | 48 | Gap 1 |
| `paymentAttributionPartialCreditDays` | 7 | Gap 1 |
| `paymentAttributionSameDayExcluded` | true | Gap 1 |
| `significantPaymentThreshold` | 0.50 (50% of outstanding) | Gap 5 |

**Not tenant-configurable (legal/compliance requirements):**

| Constraint | Value | Gap |
|-----------|-------|-----|
| Pre-action response window | 30 days (statutory) | Gap 10 |
| Debtor channel preferences | Hard override, no bypass | Gap 11 |

---

## APPENDIX D — SEPARATE DELIVERABLES AND v2 SCOPE

### Separate Spec Required: DISPUTE_RESOLUTION_SPEC.md

Driven by the UK Government "Time to Pay Up" legislation (published 24 March 2026, implementation no earlier than 2027). Covers:

- 30-day statutory dispute window tracking per invoice
- Dispute categorisation (pricing, quality, delivery, incorrect invoice, partial delivery, other)
- Evidence capture workflow (debtor uploads supporting documentation)
- Riley-assisted dispute triage and validity assessment
- Partial dispute handling (undisputed portion remains chaseable, disputed portion enters resolution)
- Tactical dispute detection (pattern recognition per debtor — debtors who dispute every invoice at day 28 and withdraw at day 50)
- Post-resolution invoice re-entry into Charlie's pipeline with adjusted amounts and dates
- Statutory interest accruing from original due date if dispute found invalid
- SBC adjudication referral pathway (new escalation stage between Formal and Legal)
- Charlie's proactive messaging about dispute window expiry ("The statutory dispute period for invoice {ref} expires on {date}")
- Updated statutory interest references in Professional and Firm tone messaging (mandatory under new legislation, no longer just an escalation tool)

### Riley Enhancement (Saved to Memory)

Daily proactive activity summary pushed to user: "Charlie sent X emails, Y SMS today, Z bounced, one dispute received." Different from Agent Activity page — push notification, not pull. To be scoped as a Riley enhancement outside this spec.

### MVP v2 Scope Items

| Item | Origin |
|------|--------|
| Debtor-facing digital dispute portal (self-service) | Time to Pay Up legislation |
| Statutory interest reporting dashboard for accounting firms | Time to Pay Up legislation / partner portal |
| SBC referral as formal stage in invoice state machine | Time to Pay Up legislation |
| P(Pay) prior recalibration as market behaviour shifts post-legislation | Gap 7 |
| Payment performance reporting features (large company requirements) | Time to Pay Up legislation |
| International jurisdiction framework (per-debtor jurisdiction flag) | Jurisdiction scope |
| Per-debtor `amountSensitivity` replacing generic log10 penalty in P(Pay) | Gap 7 |
| Adaptive EMA decay rate (if Gap 6 adaptive EMA proves insufficient) | Gap 1 / Gap 6 |
| Data Health UI — Dashboard card, debtor list badges, Riley notifications | Gap 8 / Data Health |
| Open Banking confirmation + learning layer (Phase 2 of Gap 14) | Gap 14 |
| Reconciliation lag measurement per tenant (Open Banking dependent) | Gap 14 |
| Debtor group cadence coordination — Steps 3 and 4 | Gap 12 |

---

*Version 1.1 — 02 April 2026*
*This spec extends How-Charlie-Works.md with the engineering fixes required to harden Charlie for production use, legal defensibility, and acquirer due diligence.*
*Read alongside: CLAUDE.md, MVP_V1_1_BUILD_SPEC.md, QASHIVO_CONTEXT_ADDENDUM_v4_2.md*
*Related: DISPUTE_RESOLUTION_SPEC.md (to be created)*
