# CHARLIE DECISION TREE — CONVERSATION SUMMARY v2

**Date:** 5 April 2026
**Purpose:** Capture the full design discussion before finalising the specification
**Status:** In discussion — spec v1.0 written, needs revision based on this conversation

---

## 1. THE CORE ARCHITECTURE DECISION

**Split Charlie into two brains:**

- **Brain 1: Decision tree (deterministic)** — decides WHAT to do. Same input always produces same output. Fully auditable, testable, explainable.
- **Brain 2: LLM (probabilistic)** — decides HOW to say it. Content generation only.

The LLM never decides whether to send, who to send to, what tone, or when. It only writes the words.

---

## 2. BEHAVIOUR-DRIVEN, NOT CALENDAR-DRIVEN

The initial spec (v1.0) was too mechanistic — driven by days overdue and contact counts. The revised approach is driven by debtor behaviour:

**Category 1: Reliable payers.** History shows they pay near the due date. Light touch. Nudge only. Don't chase aggressively — trust the pattern. Only escalate if they deviate from their normal behaviour.

**Category 2: Communicative but late.** They respond, they engage, they give a date. The question isn't whether to chase — it's whether the date they've given is commercially acceptable (see DSO engine below).

**Category 3: Silent.** No response to any communication. This is the genuinely concerning category. Silence is the strongest escalation trigger, not days overdue.

**Category 4: Can't pay.** They've communicated but the message is "we don't have the money." This isn't a chase problem — it's a negotiation problem.

---

## 3. THE DSO-BASED ACCEPTANCE ENGINE

### 3.1 The Rule

The client's actual DSO is the line. The objective is to never let it go up.

- If a debtor proposes a payment date that keeps DSO the same or reduces it → **accept**
- If a debtor proposes a payment date that would increase DSO → **negotiate**

### 3.2 Two DSO Figures

**Actual DSO** — the current measured DSO across all debtors. This is the decision gate. Charlie uses this to assess whether a proposed date is acceptable.

**Target DSO** — a user-configurable aspiration in settings. Riley tracks progress toward it in the weekly review. Charlie can use it for proactive nudging. But the hard decision gate is the actual DSO, not the target.

### 3.3 The Diminishing Returns Problem

If Qashivo consistently reduces DSO from 54 to 40 to 32 to 25, eventually Charlie would reject payment dates from debtors paying within their terms. A debtor with 30-day terms paying at day 28 shouldn't be pushed because DSO has dropped to 22.

**Solution:** The benchmark uses a floor:

```
benchmark = MAX(currentDSO, debtor's payment terms)
```

When DSO is high, DSO is the benchmark. As DSO drops below payment terms, the terms become the floor. Charlie never punishes a debtor for paying within their agreed terms.

### 3.4 The Cliff Edge Problem

A debtor proposing day 55 when DSO is 54 is essentially bang on average. Pushing back achieves almost nothing and risks the relationship. The line shouldn't be binary — it needs a gradient based on actual DSO impact.

### 3.5 DSO Impact Calculation

```
weight = this debtor's outstanding / total outstanding across all debtors
dsoImpact = weight × (proposedDays - currentDSO)
```

This produces the number of days this specific debtor's proposed date would shift the tenant's DSO. Small debtors barely move it. Large debtors move it significantly.

### 3.6 Threshold

**Default: 1.0 day.** If a debtor's proposed date would shift DSO by less than 1.0 day, accept. If 1.0 day or more, negotiate.

Tested across 20 scenarios at both 0.5 and 1.0 day thresholds using UK average DSO of 54 days. At 0.5, Charlie negotiates in 10 of 20 scenarios including borderline cases (e.g., biggest debtor just 3 days over DSO). At 1.0, Charlie negotiates in only 5 of 20 — only when the debtor is large AND significantly late.

1.0 day is the right default because:
- It avoids pushing back on large debtors over trivial timing differences
- It focuses Charlie's negotiation energy where it materially moves DSO
- The user can tighten to 0.5 in settings if they want more aggressive management

The threshold is a tenant setting, configurable in Settings > Collection Strategy.

### 3.7 Partial Payment Neutralisation

When Charlie negotiates, the system calculates exactly how much partial payment is needed to neutralise the DSO damage:

```
partialPaymentNeeded = outstanding × (1 - DSO / proposedDay)
```

This tells Charlie the negotiation target. Examples at DSO 54:

| Debtor | Outstanding | Proposed day | Partial needed now | Remainder on proposed date |
|--------|------------|-------------|-------------------|--------------------------|
| Large | £50,000 | Day 70 | £11,500 | £38,500 on day 70 |
| Large | £50,000 | Day 90 | £20,000 | £30,000 on day 90 |
| Medium | £30,000 | Day 70 | £5,600 | £24,400 on day 70 |
| Medium | £30,000 | Day 90 | £12,000 | £18,000 on day 90 |
| Medium | £20,000 | Day 90 | £6,000 | £14,000 on day 90 |

Charlie wraps this in natural language: "Would it help to split this? £11,500 now and the rest on the 15th?" The debtor hears a collaborative proposal, not a rejection.

### 3.8 Edge Cases vs Normal Conversations

Most debtors will confirm a date that's within or below DSO — "end of this week," "next Friday," "the 15th." Charlie accepts immediately. No negotiation needed.

The DSO negotiation engine only fires for the minority who say "not until next month" or "not until June." These are the 10-15% of conversations where the date is commercially problematic. For everything else, Charlie just says "thanks for confirming."

---

## 4. TWO-LAYER DSO MANAGEMENT

### Layer 1: Transactional (in-the-moment)

When a debtor proposes a date, the DSO impact calculation determines whether to accept or negotiate. This is the reactive layer — it handles each individual conversation as it happens.

### Layer 2: Strategic (portfolio-level)

Identifies debtors who are individually underperforming relative to their terms, even if no single conversation triggers the DSO threshold. This catches the chronic slow payer who consistently pays at day 65 on 30-day terms — never quite triggering the threshold because they're mid-size, but steadily preventing DSO from improving.

**How it works:**

For every debtor, calculate their "days beyond terms" (DBT):

```
DBT = average days to pay - payment terms
```

A debtor on 30-day terms averaging 55 days to pay has a DBT of 25. That's their personal contribution to the DSO problem.

**DSO drag calculation per debtor:**

```
dsoDrag = weight × DBT
```

A debtor who's 4% of the ledger with a DBT of 25 is contributing 1.0 day to the DSO. If they paid within 5 days of terms, the DSO would drop by nearly a full day.

**Riley surfaces this in the weekly review:**

"You have 8 debtors who consistently pay more than 15 days beyond their terms. Together they represent £180,000 outstanding and are adding approximately 4.2 days to your DSO. If these debtors paid within 5 days of terms, your DSO would drop from 54 to 50."

**Charlie adjusts behaviour for chronic underperformers:**

- Earlier contact — don't wait for chaseDelayDays
- More proactive pre-due nudges
- Less tolerance for "I'll pay next month"
- Phase 2 tone and directness start sooner
- These debtors are flagged in the conversation brief so the LLM knows this is a pattern, not a one-off

**User visibility:**

A "DSO Contributors" view (in dashboard or reports) showing:
- Debtors ranked by DSO drag (highest drag at top)
- Their average days to pay vs terms
- Their weight on the ledger
- The DSO improvement available if they paid within terms

This gives the user a hit list — not based on who owes the most, but who's dragging DSO down the most relative to what they should be paying.

### How the two layers interact

Layer 1 handles the **reactive** moment — a debtor says a date, Charlie assesses it.

Layer 2 drives **proactive** improvement — Charlie identifies chronic problems and adjusts its approach before the conversation even starts.

Together they create a virtuous cycle: Layer 2 makes Charlie more assertive with chronic late payers, which drives more conversations through Layer 1, where the partial payment negotiation captures upfront value. DSO drops. The system gets tighter.

---

## 5. CAN'T PAY / WON'T PAY — ESCALATION FRAMEWORK

### 5.1 The Boundary

The moment a debtor indicates they can't or won't pay, Charlie has reached the limit of what automation should handle. These are commercial decisions for the business owner. Charlie's role is to recognise, acknowledge, categorise, and hand off — not to negotiate, investigate, or resolve.

**One exception:** cash flow difficulty gets one gentle payment plan attempt. Any friction at all — hand to human.

### 5.2 Can't Pay Categories

**Category 1: Cash flow difficulty, no visibility on payment date**

The debtor wants to pay but genuinely can't right now. "Cash is really tight." "I don't know when we'll be able to pay."

- Charlie gets ONE attempt: "Would it help to break this into smaller monthly amounts?"
- Debtor engages positively, suggests terms → payment plan flow continues
- ANY pushback, uncertainty, hesitation, or silence → EXCEPTION immediately
- Charlie does NOT follow up or try a second time
- Exception carries: stated reason, amount at stake, conversation history

**Category 2: No cash, looks like going out of business**

The debtor signals severe financial distress. "We're really struggling." "We might not survive the quarter."

- EXCEPTION immediately — no automated response beyond acknowledgment
- Charlie sends one message: "Thank you for letting us know. I'll pass this to a colleague who can discuss options with you."
- Trigger Companies House check — late filings, CCJs, winding-up petitions?
- Flag as potential bad debt risk
- Riley alerts user prominently: "Debtor has indicated severe financial distress — potential bad debt risk of £X"
- No further automated contact until user resolves
- Possible Qapital trigger — if invoice finance is active, the funder needs to know

**Category 3: Already in administration**

The debtor or their administrator confirms administration has commenced.

- EXCEPTION immediately with "ADMINISTRATION" flag
- Cease ALL automated contact — legally required
- Charlie may ask ONE final question: "Could you share the administrator's contact details so we can register our claim?" — then stops
- Flag as confirmed bad debt
- Riley surfaces prominently — this affects cashflow forecasting and Working Capital Impact
- No further contact of any kind until user resolves

### 5.3 Won't Pay Categories (Disputes)

All disputes go to the exception queue immediately. Charlie does NOT investigate, negotiate, or attempt to resolve. Charlie gathers the stated reason, acknowledges, and hands off.

**Service incorrect**
- Debtor says the work or service was wrong, incomplete, or substandard
- Charlie: "I'm sorry to hear that. I'll pass this to a colleague who can look into it for you."
- Exception carries: stated issue, affected invoices
- User may need to involve delivery/operations team, issue credit note, or arrange rework

**Product incorrect**
- Debtor says wrong product delivered, defective, or not as described
- Same acknowledgment and handoff pattern
- May need return/replacement process

**Price incorrect**
- Debtor says the invoiced amount doesn't match what was agreed
- Charlie does NOT check quotes or attempt to reconcile — this is a commercial dispute
- Exception carries: what price the debtor expected, invoice amount
- User checks against quotes/purchase orders and resolves

**Delivery timing**
- Debtor says goods/services arrived late and they're withholding payment
- Acknowledgment and handoff
- User decides if compensation or discount is appropriate

**Relationship breakdown**
- Debtor indicates the broader relationship is damaged
- EXCEPTION immediately — this is a senior/owner conversation
- Charlie sends nothing further — any automated message risks making it worse
- Highest priority exception flag

### 5.4 The Universal Rule

For ALL can't/won't pay scenarios (except the single payment plan attempt):

1. **Recognise** the intent from the debtor's response
2. **Acknowledge** appropriately — one message, warm, human: "Thank you for letting us know. I'll pass this to a colleague who can help."
3. **Categorise** the exception with the stated reason, affected invoices, amount at stake, and full conversation history
4. **Stop** all automated chasing immediately — no further contact until user resolves
5. **Surface** prominently — these are not low-priority exceptions

Charlie is the friendly accounts person who handles the routine. The moment it gets difficult, emotional, or commercially complex — human. This is the right boundary for an AI system.

---

## 6. REFINEMENTS FROM STRESS TESTING

Ten improvements identified by challenging the design against real-world edge cases:

### 6.1 Rolling DSO benchmark

Use a 30-day rolling average DSO for the acceptance engine, not a real-time snapshot. Real-time DSO fluctuates daily as payments land — three debtors paying on the same morning could shift DSO enough to change decisions made that afternoon. A rolling average smooths this out and gives Charlie a stable benchmark.

### 6.2 Round partial payment amounts

The neutralisation formula produces precise figures (e.g., £11,428.57) that sound robotic in conversation. Round to natural amounts:
- Over £5,000: round to nearest £500
- Under £5,000: round to nearest £100
- Where possible, use natural fractions — halves, thirds, quarters

The LLM receives the calculated figure as a guide but is instructed to round to conversational amounts. "Could you do half now?" is better than "Could you do £11,500 now?"

### 6.3 Cold start for new debtors

Debtors with fewer than 3 paid invoices have no payment history to categorise. They are "unknown" — not reliable, not late, not silent.

- Default to standard Phase 1/Phase 2 treatment — not aggressive, not lenient
- Conversation brief flags "new relationship — no payment history" so the LLM keeps tone warm and relationship-building
- CIE segment data fills the gap if available — "construction companies in this size band typically pay at day 47"
- After 3 paid invoices, sufficient data exists to categorise behaviour

### 6.4 Precise definition of "friction" for payment plan attempts

The cash flow difficulty path gives Charlie one payment plan attempt, with "any friction" triggering an exception. "Friction" needs precise definition to avoid false positives:

**NOT friction (Charlie holds and follows up once):**
- "Let me check with my director and get back to you"
- "I need to discuss with finance"
- "Can I have a few days to think about it?"
→ Charlie holds 3-5 days, follows up once. If the follow-up gets pushback or silence, then exception.

**IS friction (exception immediately):**
- "No"
- "We can't commit to that either"
- "I don't know"
- "That's not going to work"
- Silence (no response to the proposal)
- Any response that doesn't move toward a specific arrangement

So the actual flow is: one attempt → if "let me check" response, one follow-up after 3-5 days → then exception if no commitment.

### 6.5 Silence timeframe definition

A debtor who hasn't responded in 2 days isn't silent — they might be busy. "Silent" needs a threshold:

**Silent = no response after 2 or more contact attempts across at least 10 days.**

Before that threshold: debtor is "awaiting response" — standard Phase 2 behaviour continues.
After that threshold: debtor transitions to Category 3 (silent), escalation triggers apply, tone escalation accelerates.

This prevents premature escalation on a debtor who just hasn't checked their email yet.

### 6.6 Vague dispute handling

Debtors often say "I'm not paying that" or "there's an issue" without explaining why. Charlie needs a path for unspecified disputes:

- Charlie asks ONE clarifying question: "I'm sorry to hear that. Could you let me know what the issue is so I can pass it to the right person?"
- If debtor specifies the reason → categorise (service/product/price/delivery/relationship) and hand off
- If debtor doesn't specify, says "I just don't want to pay," or doesn't respond → exception with "unspecified dispute" category
- Charlie does NOT ask twice

### 6.7 Proactive administration detection

The administration category (Can't Pay 3) assumes the debtor or administrator tells us. In reality, companies go into administration without notifying creditors.

For debtors who reach the "silent" threshold (6.5 above), Charlie triggers a Companies House status check. If status has changed to:
- "In administration"
- "In liquidation"
- "Dissolved"
- "Petition to wind up"

→ Cease all automated contact immediately. Create administration exception. No debtor communication required to trigger this — the public record is sufficient.

This is a background check, not a debtor interaction. It runs automatically as part of the silent debtor escalation path.

### 6.8 Gate check short-circuit confirmation

The 9 gate checks are sequential — each gate returns HOLD if triggered, stopping the evaluation. The implementation must genuinely short-circuit: if Node 3 (active arrangement) returns HOLD, Nodes 4-9 are never evaluated.

The audit log must confirm where evaluation stopped: "Evaluation stopped at Node 3.1 — active arrangement, date in 5 days. Nodes 4-9 not evaluated." This is important for debugging and for demonstrating efficiency to the bank buyer — Charlie isn't doing unnecessary work.

### 6.9 DSO negotiation always uses Professional tone

When the DSO engine triggers a partial payment negotiation, the tone is always Professional regardless of the current escalation level for that debtor. The negotiation is collaborative — "Would it help to split this?" — not pressuring.

If the debtor rejects the partial payment proposal, subsequent chase communications resume at the current escalation tone. But the negotiation conversation itself is always warm and solution-oriented.

This prevents the awkward situation where a debtor at Firm tone receives a Firm-toned request to make a partial payment. Payment plan proposals should always feel like Charlie is helping, not demanding.

### 6.10 Payment plan failure cap

A debtor could cycle through payment plans indefinitely — agree, fail, agree, fail — without ever paying. Two-strike rule:

- First failed payment plan → Charlie proposes ONE revised plan
- Second failed payment plan → EXCEPTION immediately
- No third plan without explicit user intervention
- Exception carries: both failed plan details, total amount at stake, total elapsed time

This prevents the system from being gamed by debtors who agree to plans with no intention of honouring them, while still giving genuine cases a second chance.

---

## 7. CHARLIE'S FUNDAMENTAL OBJECTIVE

**Find the right person, get a date.**

Every communication is trying to:
1. Confirm we're talking to the right person
2. Get a committed payment date
3. If the date would worsen DSO (Layer 1), negotiate a partial payment or arrangement
4. If they're a chronic underperformer (Layer 2), be more proactive from the start
5. If they can't pay (cash flow), one payment plan attempt + one follow-up if "let me check" — any real friction, hand to human
6. If they can't pay (distress/administration) or won't pay (dispute), hand to human immediately

---

## 8. WHAT THE V1.0 SPEC COVERS (already written)

- Full input state object (DebtorState interface)
- 9 gate check nodes (system, invoice, commitment, dispute, legal, probable payment, contact validation, cooldown, unresolved inbound)
- 5 action selection nodes (phase determination, tone selection, channel selection, timing, bundle & output)
- 6 special conversation flows (wrong person, payment plan, uncertainty, payment claim verification, out of office, partial payment)
- Debtor group coordination
- Full audit logging
- Implementation phasing

---

## 9. REVISIONS NEEDED IN V1.0

Based on the full conversation, the spec needs:

1. **Behavioural categories** — gate checks should first assess which category the debtor falls into (reliable, communicative, silent, can't pay) and branch accordingly

2. **DSO-based acceptance engine** — replace arbitrary "reasonable period" with the DSO impact calculation using 30-day rolling DSO as the benchmark. This becomes the core logic in Node 3 (active commitments) when evaluating a proposed payment date

3. **Partial payment neutralisation formula** — when negotiating, Charlie has a specific target amount calculated from the DSO impact, rounded to natural conversational amounts (nearest £500 over £5k, nearest £100 under £5k)

4. **DSO floor at payment terms** — benchmark = MAX(currentDSO, paymentTerms) to prevent punishing debtors who pay within terms as DSO improves

5. **Reliable payer recognition** — debtors who historically pay near due date get lighter treatment. Silence from them triggers concern, but normal lateness doesn't

6. **Silence definition and escalation** — silent = 2+ contacts across 10+ days with no response. Before threshold: "awaiting response." After threshold: escalation triggers including Companies House status check

7. **Layer 2 strategic monitoring** — days beyond terms (DBT), DSO drag per debtor, Riley weekly review integration, Charlie behaviour adjustment for chronic underperformers

8. **Can't pay / won't pay escalation framework** — three can't-pay categories (cash flow, distress, administration) and five won't-pay categories (service, product, price, delivery, relationship), plus "unspecified dispute" for vague refusals. Cash flow difficulty: one payment plan attempt + one follow-up if "let me check" response — real friction or silence triggers exception. Everything else: exception immediately.

9. **Cold start handling** — debtors with < 3 paid invoices default to standard treatment, conversation brief flags "new relationship," CIE segment data used if available

10. **DSO negotiation tone** — always Professional regardless of current escalation level. Negotiation is collaborative, not pressuring.

11. **Payment plan failure cap** — first failed plan gets one revised plan. Second failure = exception. No third plan without user intervention.

12. **Gate check short-circuit** — implementation must stop evaluating at first HOLD, audit log confirms where evaluation stopped

13. **Proactive administration detection** — Companies House check triggered automatically for debtors reaching the "silent" threshold. Changed status ceases all contact without debtor notification required.

14. **Tenant settings:**
    - dsoImpactThreshold (default 1.0 days)
    - dsoTarget (user-configurable aspiration)
    - All settings from v1.0 spec remain (chaseDelayDays, preDueDateDays, etc.)

---

## 10. OPEN QUESTIONS FOR NEXT DISCUSSION

- Should the threshold be tested in production at 1.0 and adjusted based on real data, or should we offer 0.75 / 1.0 / 1.5 as preset options?
- Should the DSO target be set automatically at onboarding (snapshot of current DSO minus 10%) or manually by the user?
- At what DBT threshold does Layer 2 flag a debtor as a chronic underperformer? (Proposed: DBT > 15 days)
- How does this interact with the Compliance Library? Should there be a compliance rule that prevents Charlie from suggesting specific payment amounts without user approval?
- CIE integration: should segment-level DBT averages inform Layer 2 thresholds? ("Construction companies average 22 DBT, so a construction debtor at 25 DBT isn't as concerning as a professional services debtor at 25 DBT")
- For the cash flow difficulty payment plan attempt: should there be a minimum amount threshold below which Charlie doesn't bother with a payment plan? (e.g., £500 invoice — just accept whatever date they give)

---

## 11. ACQUISITION VALUE

The DSO engine, escalation framework, and refinements together form a compelling acquisition narrative:

1. **Measurable ROI** — every tenant can see exactly how many days of DSO Qashivo has saved, translated into working capital released
2. **Intelligent negotiation** — not template-based chasing but mathematically-driven commercial conversations with calculated partial payment targets
3. **Strategic layer** — portfolio-level DSO management that identifies the highest-impact improvement opportunities
4. **Clear automation boundary** — Charlie handles routine, humans handle exceptions. This is auditable, compliant, and exactly what regulators and the CICM expect
5. **Proactive risk detection** — Companies House integration catches administration before the debtor tells us, protecting the client's exposure
6. **CIE enrichment** — cross-tenant DBT data by segment creates a proprietary benchmark dataset
7. **Risk intelligence** — can't-pay signals feed into credit risk scoring and Qapital underwriting. A debtor who tells one tenant they're struggling is a risk signal for all tenants
8. **Bank buyer appeal** — DSO management directly correlates with credit risk. A bank acquiring Qashivo inherits a tool that actively improves the creditworthiness of its SME lending portfolio

---

*This summary captures the full conversation to date. The decision tree spec (v1.0) needs revision to incorporate all items listed in Section 9 (Revisions Needed) before implementation.*
