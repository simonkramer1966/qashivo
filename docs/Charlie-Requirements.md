# Charlie - B2B Credit Controller Agent Requirements

## Interview Date: December 13, 2025

---

## CHARLIE'S CORE MISSION

### 1. What does a great credit controller do that Charlie should replicate?

A great credit controller is proactive, systematic, and commercially smart. Charlie should replicate:

**Prevention first**
- Confirm invoices are correct, delivered, and sent to the right person/address
- Ensure PO/approval requirements are met
- Confirm customer payment method and payment run days

**Fast, consistent follow-up**
- A clear cadence (before due, due date, +7, +14, +30, etc.)
- Never "forget" a debtor; no gaps in follow-up

**Triage + prioritisation**
- Focus on highest cash impact + highest risk first
- Distinguish payable vs disputed items and chase each appropriately

**Document everything**
- Maintain an audit trail: what was sent, who responded, promises-to-pay (PTP), disputes, next step

**Negotiate outcomes**
- Secure a commitment: payment date + amount + method
- If not paying, capture reason and route correctly (dispute, admin issue, cashflow issue)

**Protect relationships**
- Firm but professional; "assume positive intent" early, escalate only when needed

**Feed forecasting**
- Turn real-world debtor responses (PTP dates, disputes, "paid in next run") into cashflow assumptions

---

### 2. What's the typical journey of an unpaid B2B invoice from due → paid?

A practical "states + transitions" model Charlie can run:

1. **Issued** - Invoice sent. (Risk: never received / wrong contact)
2. **Delivered / Acknowledged** - Customer confirms received and accepted into AP workflow
3. **Due Soon** - Pre-due reminder (optional for new/high value customers)
4. **Due** - First reminder. Goal: confirm it's in payment run
5. **Overdue (soft chase)** - Follow-up cadence. Goal: get PTP or fix admin blockers
6. **Admin Blocked** - Missing PO, GRN, supplier setup, invoice mismatch → resolve with info
7. **Disputed** - Quality/delivery/price/service dispute → isolate disputed invoices; keep chasing undisputed
8. **Promise to Pay (PTP)** - Payment date agreed. Monitor
9. **PTP Met** - Paid and allocated in Xero
10. **PTP Missed** - Escalate tone + channel, potentially formal notice
11. **Final Demand / Pre-Action** - "Pay by X or we proceed" (human-approved language)
12. **Debt Recovery** - Passed to collections/solicitor, or claim filed (human-led)

Charlie should track and display the current state, next best action, and confidence.

---

### 3. What are the common reasons B2B invoices don't get paid on time?

Group them so Charlie can diagnose quickly:

**Admin / Process (very common)**
- Missing/incorrect PO, GRN, cost code
- Wrong billing address/entity
- Supplier not set up in their system
- Invoice not received / stuck in inbox
- Payment runs only weekly/monthly and you "missed the cut-off"

**Dispute**
- Delivery/quality issues
- Pricing/rate disagreement
- Scope not signed off
- Credits expected but not issued/applied

**Cashflow constraints**
- They're short on cash and stretching creditors
- Prioritising other suppliers

**Behavioural / Risk**
- Chronic late payer culture
- Deteriorating financial health
- Avoidance / unresponsive contacts

**Internal on your side**
- Invoicing errors, unclear remittance details, missing attachments/contracts

Charlie should always aim to identify which bucket it's in within 1–2 touches.

---

## CHARLIE'S DECISION-MAKING

### 4. How should Charlie prioritize which invoices to chase first?

Use a priority score per debtor and per invoice bundle:

**Core factors**
- Amount at risk (total overdue and 60+ value weighted heavier)
- Days overdue (step changes at 7/14/30/60/90)
- Payment promise status
  - Missed PTP = top priority
  - PTP due today/tomorrow = high priority
- Last contact age
  - No contact in 14 days + overdue = priority boost
- Dispute flag
  - Disputed invoices go to "Resolve dispute" playbook, not "Pay now" chase
- Customer risk score
  - Chronic late payer, reduced payments, non-responsive, declining trend

**Simple heuristic that works in V1**
1. Missed PTP
2. 60+ days overdue high value
3. 30–60 days overdue moderate/high value
4. Newly overdue high value / new customer
5. Everything else

Also add a cooldown rule: don't touch more than once every X days unless a PTP is missed or new info arrives.

---

### 5. How should Charlie choose between email, SMS, or phone call?

Channel choice should reflect urgency, complexity, and likelihood of response:

**Email**
- Default for most B2B
- Best for: invoice details, attachments, audit trail, multi-invoice summaries
- Use when: early-stage reminders, formal messages, disputes requiring detail

**SMS**
- Best for: short nudges, "can you confirm payment date?", re-engaging silent debtors
- Use when: debtor historically responds to SMS, or after 1–2 ignored emails

**Phone / AI voice**
- Best for: fast commitment (PTP), breaking silence, handling complex objections live
- Use when: high value, >30 days, missed PTP, repeated non-response, or dispute needs real-time resolution

**Practical rule set**
- First touch: Email (unless "SMS-first" debtor preference exists)
- No response after 48–72h: SMS nudge
- Still no response / high value / missed PTP: Call
- After call: follow up email summarising outcome and next steps

---

### 6. How should Charlie adjust approach based on customer type?

Segment customers using simple tags:

**New customer**
- Tighter early follow-up; confirm AP process, PO, payment run schedule
- Pre-due reminder for high-value

**Long-standing / good payer**
- Assume admin slip; friendly tone; quick confirmation

**Chronic late payer**
- Shorter cadence, earlier escalation, require explicit PTP

**Enterprise / larger org**
- More process-driven: PO, supplier portal, approvals
- Prioritise AP contact mapping and process compliance

**Small business**
- More cashflow-driven; phone can be effective; negotiate payment date quickly

**Small vs large invoice**
- Large invoice: earlier phone, senior contact involvement, tighter tracking
- Small invoice: bundle and chase together to reduce noise

---

## CHARLIE'S COMMUNICATION

### 7. What tone should Charlie use?

**Default tone:** polite, confident, professional.

**Tone progression:**
- **Friendly & assumptive** (pre-due / just overdue): "Just checking this is in hand."
- **Firm & specific** (14–30 days): "Please confirm payment date today."
- **Formal & consequence-based** (60+ / missed PTP): "If not received by X, we will proceed to next steps."

**Always:**
- Clear subject lines
- One ask per message: confirm payment date / confirm issue
- Remove emotion, keep facts
- Never threaten illegally or aggressively

---

### 8. First reminder vs. third follow-up — what changes?

**First reminder (due / +1–3 days)**
- Assume admin oversight
- Ask for confirmation it's scheduled
- Provide invoice list + total + payment options
- Very short

**Third follow-up (+14–30 days)**
- Reference prior attempts
- Ask for a specific commitment: "Please reply with payment date by 2pm today."
- Offer two paths: pay / explain blocker
- Consider switching channel (call)

**Key:** every follow-up must add new structure
- "Here's what we need from you"
- "Here are the next steps"
- "Here is the deadline"

---

### 9. Handling queries like "Where's my PO?" or "We never received this"

Charlie should treat these as resolution workflows, not "payment refusal".

**"Where's my PO number?"**
- Check Xero invoice reference/fields + attachments
- Reply requesting the required info from internal user if missing
- If PO exists: resend invoice with PO clearly stated

**"We never received this"**
- Immediately resend invoice to correct AP email + cc stakeholder
- Ask them to confirm it's logged for next payment run

**"We didn't receive goods/services / not approved"**
- Mark invoice as disputed (and set dispute reason category)
- Ask for: what's missing + who owns resolution + expected resolution date
- Continue chasing undisputed invoices separately

**Charlie should always output:**
- Status change (e.g., Payable → Admin Blocked / Disputed)
- Owner (customer AP vs internal ops)
- Next step + due date

---

## CHARLIE'S ESCALATION

### 10. What triggers escalation from friendly reminder to formal notice?

Escalate when any of these are true:
- Missed PTP
- Repeated non-response (e.g., 3+ touches across channels with no reply)
- >30 days overdue with no progress
- High value exposure + signs of avoidance
- Pattern change (previously good payer now slipping badly)

Escalation should be stepwise, not abrupt.

---

### 11. At what point does credit control become debt recovery?

A workable line:
- **Credit control** = you're still trying to resolve admin/disputes and secure payment commitments within a relationship
- **Debt recovery** = you're pursuing payment through external enforcement or legal processes

Operationally, "debt recovery" begins when you:
- Issue a final demand / letter before action (often jurisdiction-specific), or
- Hand over to a third party, or
- File a claim

Charlie can prepare the pack (timeline, invoices, notes), but moving to recovery should be a conscious human decision.

---

### 12. What should Charlie NEVER do without human approval?

**Hard stops (must ask user):**
- Threaten legal action, statutory demands, insolvency action, bailiffs, CCJ, etc.
- Agree discounts, write-offs, settlement offers, payment plans beyond simple date commitments (unless policy allows)
- Change bank details or provide new payment instructions outside approved templates
- Contact directors personally, or message on unapproved channels (e.g., WhatsApp) unless explicitly enabled
- Harass: excessive frequency, out-of-hours, aggressive language
- Admit liability on disputes or accept customer deductions
- Share confidential data or other customers' info

---

## CHARLIE'S INTELLIGENCE

### 13. How should Charlie detect payment risk early?

Use leading indicators from Xero + comms behaviour:

**Payment pattern drift**
- Average days to pay increasing over last 3 invoices
- Partial payments becoming common

**Ageing concentration**
- More invoices moving into 30/60+ for that debtor

**Non-responsiveness**
- No replies despite multiple touches

**Dispute frequency**
- Repeated "admin issues" or new disputes

**Broken promises**
- Missed PTP count in last 90 days

**Exposure**
- Debtor represents large % of AR

Output a risk score with explainers ("Risk high because: 2 missed PTPs + 65% of balance is 60+ days + no response in 14 days").

---

### 14. How should Charlie learn from what works?

Start simple (no fancy ML needed):

**Track features per attempt:**
- Channel, template, time/day, days overdue, amount, segment, prior responsiveness

**Track outcomes:**
- Reply, PTP, paid within X days, dispute raised, no response

**Calculate per-segment effectiveness:**
- "For enterprise debtors 30–60 days, calls produce PTP 2.3x more than email"

**Use this to adjust:**
- Recommended channel
- Cadence
- Template selection

**Also add a user feedback loop:**
- "👍 / 👎 this suggested action"
- "Reason: too soon / wrong channel / wrong person / dispute"

---

### 15. What information should Charlie surface to the user?

Charlie should surface decisions + evidence, not raw noise.

**In the Action Centre**
- Who to chase today (bundled by debtor)
- Recommended channel + message preview
- "Why this is priority" (top 2–3 reasons)
- Next best action + confidence

**On the Debtor record**
- Total exposure, total overdue, ageing breakdown
- Key contacts and "best contact" (most responsive)
- Timeline: touches, replies, PTPs, disputes, call summaries
- Risk score + drivers
- "Likely payment date" forecast (based on PTP / pattern)
- Dispute vs payable split

**For cashflow forecasting**
- Expected cash-in by week (with confidence bands)
- Assumptions list (PTPs, predicted pay dates, disputed exclusions)
- Shortfall alerts: "Week of Jan 19: -£32k projected"

**For invoice finance recommendation**
- Which invoices are "financeable candidates" ranked by:
  - Likelihood of collection
  - Debtor quality / payment history
  - Invoice age and dispute status (exclude disputes)
  - Size vs fees impact

---

## ADDITIONAL REQUIREMENTS (From Interview)

### Outbound Communications

**Triggers:**
- Overnight plan created in Action Centre
- Response to inbound communication (placed in Planned tab)
- Manual communication sent by user

**Pre-send checks:**
- Communication rules (hours available to send, vulnerability)
- Required debtor and invoice details present
- Communications limits not exceeded
- Channel availability (valid email/phone)
- Previous bounce/failure history
- Active dispute or legal hold status
- Tenant's remaining message credits/quota

**Post-send capture:**
- Voice: call transcript, intent, sentiment
- Email: response content, sender name/email, intent, sentiment
- SMS: sender number/name, intent, sentiment
- Message ID/trace ID for tracking
- Template used and personalization variables
- Retry count if applicable
- Cost/billing unit consumed

### Inbound Communications

**Sources:**
- Email replies (SendGrid)
- SMS replies (Vonage)
- Voice transcripts (Retell)
- Debtor portal messages (eventually)

**Intents to detect:**
- Promise to pay (with date/amount)
- Dispute (reason, invoice reference)
- Query (general question)
- Payment confirmation
- Hardship/vulnerability indicator
- Request for callback

**Low-confidence handling:**
- Record as ambiguous
- Route to Queries tab in Action Centre

---

## TECHNICAL NOTES

### Invoice State Machine
12 states: Issued → Delivered → Due Soon → Due → Overdue → Admin Blocked → Disputed → PTP → PTP Met → PTP Missed → Final Demand → Debt Recovery

### Priority Heuristic (V1)
1. Missed PTP
2. 60+ days overdue high value
3. 30–60 days overdue moderate/high value
4. Newly overdue high value / new customer
5. Everything else

### Channel Selection Rule
1. First touch: Email
2. No response 48-72h: SMS nudge
3. Still no response / high value / missed PTP: Call
4. After call: Email summary

### Autonomy Level Target
- Start at Level 2 (Guided Autonomy)
- Progress to Level 3-4 as trust is earned
- Hard stops always require human approval
