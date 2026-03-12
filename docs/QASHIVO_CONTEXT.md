# QASHIVO — Complete Product & Strategy Context Document

**Purpose of this document:** This is a comprehensive briefing document for any AI assistant, developer, or Claude Code session that needs to work on the Qashivo product. It contains everything needed to reverse-engineer the business strategy into detailed product design, architecture, data models, UI/UX, and working code. Treat this as the single source of truth.

---

## 1. WHAT QASHIVO IS

Qashivo is an **AI-powered working capital management platform** for UK SMEs. At its core is a team of specialised AI agents — led by an autonomous Collections Agent with a named persona that debtors believe is a real person — working across credit control, cashflow forecasting, and working capital finance.

**The AI Agent Team:**
Qashivo operates as a team of 10 AI agents coordinated by an Orchestrator. Debtor-facing agents (Collections, Dispute Resolution, Debt Recovery) have named personas and communicate via email, SMS, AI voice calls, and a debtor portal. Internal agents (Credit Risk, Forecasting, Compliance, and others) advise the customer through a dashboard with persona-driven insights. Every outbound communication passes through a Compliance Agent before delivery. See Section 4.4 for full architecture.

**The Three Pillars:**
- **Qollections** — AI-driven credit control and accounts receivable (AR) management, powered by the Collections Agent
- **Qashflow** — Bayesian 13-week rolling cashflow forecast covering inflows and outflows, with three scenarios (optimistic/expected/pessimistic)
- **Qapital** — Pre-authorised, instantly accessible working capital finance with one-click activation

**The Data Flywheel:**
The three pillars form an integrated data loop: Qollections captures debtor intent data through agent conversations → Qashflow uses that data (plus Open Banking payment patterns) to forecast cashflow with increasing accuracy → Qapital uses the forecast to trigger pre-approved finance when a gap is identified. Each pillar makes the others more valuable. The AI agents get smarter with every interaction.

---

## 2. BUSINESS STRATEGY: BUILD-TO-SELL

### The Model
Qashivo is being built to be **sold outright to a UK bank**. Not a partnership, not a licence — a full acquisition where the bank buys the IP, team, product, and customer base. Qashivo ceases to operate independently post-sale.

### Why a Bank Would Buy This
A bank deploying Qashivo to its business banking customers gets:
- **Customer engagement tool**: Free Qollections + Qashflow makes their business banking stickier
- **Early warning system**: Qashflow shows which customers are heading toward cashflow distress before they default
- **Lending origination engine**: Qapital pre-authorises customers for invoice finance using the bank's own balance sheet — proactive lending rather than waiting for applications
- **Data asset**: Real-time debtor behaviour data across their entire SME portfolio
- **Competitive differentiation**: No other UK bank currently offers an integrated AR + forecasting + finance tool

### Post-Acquisition Bank Deployment
The bank would:
1. White-label Qashivo under their brand
2. Offer Qollections + Qashflow **free** to all business banking customers
3. Connect Qapital to the bank's own lending systems (replacing any third-party finance panel)
4. Use Qashflow alerts to proactively contact customers approaching cashflow difficulty
5. Pre-authorise eligible customers for instant finance activation

### Acquisition Precedents
- **OakNorth acquired Fluidly** (Dec 2021) — cashflow forecasting platform, ~1,300 accountancy firm users. Integrated into OakNorth's ON Credit Intelligence Suite.
- **Allica Bank acquired Kriya** (Oct 2025) — invoice finance fintech, processed £4bn+, 300k+ transactions. Goal: £1bn SME working capital by 2028.
- Qashivo is more complete than either — it offers all three pillars integrated.

### Target Bank Buyers (Priority Order)
1. **Allica Bank** — Already bought Kriya (invoice finance). Qashivo adds credit control + forecasting to complete the loop. Raised £155m, targeting 10% of established SME market by 2028.
2. **OakNorth** — Already bought Fluidly (forecasting). Qashivo adds credit control + finance origination.
3. **Starling Bank** — Strong SME proposition, tech-first culture, banking licence.
4. **Tide** — 1.5m+ SME members, exploring embedded finance.
5. **Metro Bank / Virgin Money / Co-operative Bank** — Mid-tier banks seeking digital SME differentiation.

### Build Phase Strategy
- Launch into **UK recruitment sector** first (proving ground)
- Secondary vertical: **manufacturing**
- Target: 50–100 paying customers within 12 months
- Measure everything a bank buyer cares about (DSO reduction, forecast accuracy, finance uptake, retention, NPS)
- Timeline to sale: **12–18 months**
- Realistic sale price: **£3–6 million**

### Funding
- Seed round: £500–600k
- Build phase revenue (SaaS + finance commissions) partially offsets costs
- Total cash requirement through to sale: ~£700–800k

---

## 3. MARKET CONTEXT (UK DATA)

### Late Payments Crisis
- Late payments cost UK economy ~£11bn/year
- ~14,000 businesses close per year due to late payments (38/day)
- 90% of UK companies experienced late payments in past year
- Average delay: 32 days beyond agreed terms
- UK businesses collectively owed ~£26 billion in overdue invoices at any time
- SMEs spend average 86 hours/year chasing overdue invoices (133m hours nationally)
- ~63% of invoices sent by UK SMEs paid late
- Businesses with high overdue invoices: 1.5x more likely to have cashflow problems, 3x more likely to rely on credit cards, 6x more likely to be denied credit

### Invoice Finance Market
- UK market worth ~£3bn
- Only ~55,000 of 5.5m UK businesses use invoice finance (~1% penetration)
- 59% of UK businesses have never heard of invoice finance
- But 83% would recommend it once explained
- Global factoring market: $3.46tn (2025), growing at 11.5% CAGR

### Recruitment Sector (Primary Vertical)
- Processes £40bn+ annually in temp/contract staffing
- Structural cashflow mismatch: pay workers weekly, clients pay in 30–90 days
- 2nd largest sector using invoice finance; ~17% of agencies use IF (20x national average)
- Recruitment companies using IF have higher credit scores (49 vs industry average 39)
- Signed timesheets make debts clearly provable
- ~30,000 recruitment agencies in UK

### Manufacturing Sector (Secondary Vertical)
- ~130,000 manufacturing SMEs in UK
- Average 80+ days to pay suppliers (longest in UK)
- High working capital intensity
- Adds cross-sector validation for bank buyers

---

## 4. PRODUCT ARCHITECTURE — DETAILED SPECIFICATION

### 4.1 QOLLECTIONS (Credit Control / AR Management)

#### Core Purpose
Replace manual invoice chasing with an **autonomous AI Collections Agent** that manages debtor relationships across all channels (email, SMS, letter, AI voice calls). The agent operates as a virtual credit controller — conversational, persistent, and intelligent — that debtors believe is a real person. It captures debtor intent data through every interaction, feeding Qashflow with high-quality predictive signals.

#### Key Features

**Invoice Import & Sync**
- Real-time sync with accounting platforms: Xero, QuickBooks, Sage
- Import via CSV/Excel for non-integrated systems
- Automatic detection of new invoices, payments, credit notes
- Support for multiple currencies (GBP primary, EUR, USD)

**Debtor Management**
- Debtor profiles with full history: invoices, payments, communications, promises, disputes
- Automated credit scoring per debtor based on payment history
- Debtor segmentation (e.g., by risk level, size, sector, payment behaviour)
- Concentration risk alerts (single debtor representing >X% of receivables)

**AI Collections Agent** *(THIS IS THE CORE INNOVATION)*

The AI Collections Agent is Qashivo's primary differentiator. It is an autonomous, multi-channel credit control agent that manages the entire debtor relationship. Each Qashivo customer gets a **unique AI persona** that the debtor believes is a real human credit controller.

*Agent Persona*
- Each Qashivo customer creates and names their agent persona (e.g., "Sarah Mitchell" for ABC Recruitment)
- Customer configures: agent name, job title (e.g., "Credit Controller"), email signature, voice characteristics
- The persona is consistent across ALL channels — email, SMS, letter, voice — so the debtor builds a relationship with "Sarah"
- The agent references previous conversations naturally: "Hi John, when we spoke last Tuesday you mentioned the payment would be processed by Friday..."
- The agent maintains full conversation and communication history per debtor and uses it contextually in every interaction
- Goal: the debtor should believe they are dealing with a dedicated human credit controller

*Autonomous Decision Engine*
- The agent decides the **best next action** for each debtor based on:
  - The debtor's historic payment profile (how they've paid in the past)
  - Current communication history (what's been sent, what response was received)
  - Debtor intent signals (acknowledgements, promises, disputes, silence)
  - Credit control best practices (timing, channel selection, tone appropriateness)
  - The customer's configured rules and preferences
- Initially, the default sequence is seeded from the debtor's historic payment profile
- The agent then **autonomously adapts** its strategy based on what's working: if a debtor responds better to SMS than email, the agent shifts to SMS; if a debtor only pays after a phone call, the agent prioritises calling
- The agent learns per-debtor and per-debtor-segment patterns over time

*Communication Channels*
- **Email**: Full conversational capability. Agent sends outbound and responds to debtor replies conversationally. Threaded conversation maintained.
- **SMS**: Full conversational capability. Agent sends outbound and responds to debtor replies. Keeps messages concise and action-oriented.
- **Letter (PDF)**: Agent generates formal letters for postal delivery (pre-action, formal demands). Used at later escalation stages.
- **AI Voice (Outbound)**: Agent makes outbound calls to debtors. Conversational, natural-sounding voice. Can discuss specific invoices, capture promises, negotiate payment plans. Full call transcript captured and added to debtor history. Inbound call handling is a future roadmap item — initially, if a debtor calls back they speak to a human at the customer's company.

*Intent Capture Across All Channels*
- Debtor intent is captured from **every channel**, not just the portal:
  - **Email reply**: Agent uses NLP to extract intent — "I'll pay next Friday" → promise-to-pay signal with date
  - **SMS reply**: Same NLP extraction — "Paid today" → payment notification signal
  - **Voice call**: Real-time conversation with intent extraction — agent asks for and confirms payment dates, acknowledgements, dispute details. Transcript stored.
  - **Debtor portal**: Structured intent capture via UI (acknowledge, promise-to-pay, dispute, pay now, request plan)
- All intent signals feed into Qashflow immediately regardless of source channel
- Each signal includes: type, date, source_channel, confidence_score, raw_content, extracted_data

*Tone Escalation*
- Default behaviour: **progressive tone escalation** over time for non-responsive debtors
- Tone stages: Friendly → Professional → Firm → Formal → Legal/Pre-action
- The progression speed and intensity is **configurable per customer** — some customers want a gentler approach, others want faster escalation
- Default escalation timeline (configurable):
  - Pre-due to 7 days overdue: **Friendly** — helpful reminders, conversational
  - 7–14 days overdue: **Professional** — clear expectations, polite but direct
  - 14–30 days overdue: **Firm** — emphasis on urgency, consequences mentioned
  - 30–60 days overdue: **Formal** — formal written communications, letter before action
  - 60+ days overdue: **Legal/Pre-action** — statutory demand language, referral warnings
- Tone resets if the debtor engages (acknowledges, promises, makes partial payment)
- The agent adapts tone per debtor based on relationship history — a previously good payer who's temporarily late gets a softer touch than a serial late payer

*Payment Plan Negotiation*
- The agent has authority to **negotiate payment plans** with debtors within rules set by the customer
- Customer configures negotiation boundaries:
  - Maximum number of instalments allowed (e.g., up to 3 monthly payments)
  - Minimum instalment amount (e.g., no less than £500 per instalment)
  - Whether partial payments are acceptable
  - Whether extended terms can be offered (e.g., "pay full amount by end of next month")
  - Any debtor-specific overrides
- The agent can propose and agree plans within these boundaries during email, SMS, or voice conversations
- Plans outside the configured boundaries: agent tells the debtor they need to check with their manager and flags for human approval
- Agreed payment plans are tracked; missed instalments trigger automatic follow-up

*Autonomy Levels (Configurable Per Customer)*
- **Full Auto**: Agent decides and executes all actions without approval. Customer receives activity reports but doesn't approve individual communications. Recommended once trust is established.
- **Semi-Auto**: Agent operates autonomously for routine actions (standard reminders, follow-ups, acknowledgement requests) but requires customer approval for escalations (tone increase, letter before action, voice calls, payment plan agreements).
- **Supervised**: Agent drafts all communications and recommends actions, but customer must approve before anything is sent. Suitable for initial onboarding period.
- Default for new customers: **Semi-Auto** — builds trust while demonstrating value. Customer can change at any time.

*Agent Memory & Context*
- The agent maintains a complete **conversation memory** per debtor across all channels
- Memory includes: every communication sent and received, every intent signal, every promise (kept and broken), every dispute, every call transcript, payment history
- The agent uses this memory contextually: "I notice this is the third time we've discussed invoice #4567 — I'd really appreciate if we could get this resolved today"
- Memory also tracks debtor preferences: preferred channel, best time to reach, who to ask for, any special arrangements
- Cross-debtor learning: agent identifies patterns (e.g., "debtors in construction sector respond best to phone calls on Tuesdays") and applies them

**Debtor Portal**
- White-labelled portal accessible via unique link per debtor
- Branded with the Qashivo customer's logo, colours, and the **agent persona name** (e.g., "Your account is managed by Sarah Mitchell")
- Debtor can see all outstanding invoices from this customer
- Actions: acknowledge, promise-to-pay (date picker), dispute (reason + notes), request payment plan, make payment (link to payment gateway)
- **Chat widget**: debtor can message the AI agent directly from the portal — agent responds conversationally
- No login required — secure tokenised URL per debtor/invoice batch
- Mobile-first, responsive design
- All portal interactions create IntentSignal records that immediately feed Qashflow

**Escalation Workflows**
- Escalation is primarily managed by the AI agent's autonomous decision engine
- The agent escalates based on debtor behaviour, not just time elapsed
- Escalation options available to the agent: increase tone, switch channel, increase frequency, make voice call, generate formal letter, flag for human intervention, recommend collections referral
- **Human handover triggers** (agent pauses and alerts the customer):
  - Debtor explicitly requests to speak to a manager/human
  - Dispute involves complex commercial issues beyond payment
  - Payment plan request exceeds configured boundaries
  - Customer has set this debtor as "sensitive" or "key account"
  - Legal threshold reached (agent cannot provide legal advice)
- User dashboard shows: agent activity log, items requiring human intervention, debtor conversations, performance metrics

**Reporting & Analytics**
- Real-time ageing report (current, 30 days, 60 days, 90 days, 120+ days)
- DSO (Days Sales Outstanding) tracking — overall and per debtor
- Collection effectiveness index
- Agent performance metrics: response rates per channel, promise-to-pay conversion, promise kept rate, average days to collect
- Channel effectiveness analysis: which channels work best for which debtor segments
- Tone escalation analysis: at what stage do most debtors respond
- Voice call analytics: call duration, outcome, sentiment
- Invoice dispute analysis
- Debtor behaviour trends

#### Data Model — Key Entities (Qollections)
```
Company (the Qashivo customer)
├── AgentPersona
│   ├── name (e.g., "Sarah Mitchell")
│   ├── job_title (e.g., "Credit Controller")
│   ├── email_address (e.g., sarah@abcrecruitment.co.uk)
│   ├── phone_number (outbound caller ID)
│   ├── voice_profile (voice characteristics for AI voice calls)
│   ├── email_signature
│   ├── tone_escalation_config (timeline, intensity)
│   ├── autonomy_level (full_auto / semi_auto / supervised)
│   └── negotiation_rules
│       ├── max_instalments
│       ├── min_instalment_amount
│       ├── partial_payments_allowed
│       ├── max_extended_days
│       └── debtor_overrides[]
├── Accounting Integration (Xero/QB/Sage connection)
├── Debtors
│   ├── Debtor Profile (name, company, contact details, credit score, segment)
│   │   ├── preferred_channel
│   │   ├── best_contact_time
│   │   ├── contact_person_name
│   │   ├── special_instructions
│   │   └── sensitivity_flag (normal / key_account / sensitive)
│   ├── Invoices
│   │   ├── Invoice (number, amount, currency, date, due_date, status, paid_amount, paid_date)
│   │   └── Invoice Line Items
│   ├── ConversationHistory (unified cross-channel thread per debtor)
│   │   └── ConversationEntry
│   │       ├── timestamp
│   │       ├── channel (email / sms / voice / portal / letter)
│   │       ├── direction (inbound / outbound)
│   │       ├── content (message text / call transcript / portal action)
│   │       ├── tone_level (friendly / professional / firm / formal / legal)
│   │       ├── intent_extracted (if any)
│   │       └── agent_reasoning (why this action was chosen)
│   ├── Intent Signals
│   │   └── IntentSignal
│   │       ├── type (acknowledge / promise / dispute / plan_request / payment_notification)
│   │       ├── date
│   │       ├── source_channel (email / sms / voice / portal)
│   │       ├── promise_date (if applicable)
│   │       ├── confidence_score
│   │       ├── raw_content (original message/transcript excerpt)
│   │       └── extracted_data (structured data parsed from content)
│   ├── Payment History
│   │   └── Payment (amount, date, method, invoice_allocations)
│   ├── PaymentPlans
│   │   └── PaymentPlan
│   │       ├── agreed_date
│   │       ├── agreed_via (channel)
│   │       ├── total_amount
│   │       ├── instalments[]
│   │       │   └── Instalment (amount, due_date, status: pending/paid/missed)
│   │       ├── status (active / completed / defaulted)
│   │       └── approval_status (auto_approved / pending_human / human_approved)
│   ├── Disputes
│   │   └── Dispute (invoice, reason, status, resolution_date, notes, source_channel)
│   ├── VoiceCalls
│   │   └── VoiceCall
│   │       ├── call_id
│   │       ├── direction (outbound; inbound future)
│   │       ├── started_at, ended_at, duration
│   │       ├── outcome (promise / dispute / callback_requested / no_answer / voicemail)
│   │       ├── transcript (full text)
│   │       ├── summary (agent-generated)
│   │       ├── intent_signals_extracted[]
│   │       └── sentiment_score
│   └── AgentStrategy (per-debtor adaptive strategy)
│       ├── current_tone_level
│       ├── preferred_channel (learned)
│       ├── optimal_contact_time (learned)
│       ├── next_planned_action
│       ├── next_action_date
│       ├── escalation_stage
│       └── strategy_notes (agent reasoning log)
├── AgentActionLog
│   └── ActionEntry
│       ├── timestamp
│       ├── debtor
│       ├── action_type (email / sms / voice_call / letter / escalation / plan_offer)
│       ├── action_detail
│       ├── autonomy_status (auto_executed / pending_approval / human_approved / human_rejected)
│       ├── reasoning (why agent chose this action)
│       └── outcome (response received / no response / promise / dispute)
└── AgentPerformanceMetrics
    ├── response_rate_by_channel
    ├── promise_conversion_rate
    ├── promise_kept_rate
    ├── avg_days_to_collect
    ├── escalation_effectiveness
    └── channel_effectiveness_by_segment
```

### 4.2 QASHFLOW (Cashflow Forecasting)

#### Core Purpose
Bayesian rolling 13-week cashflow forecast in weekly buckets covering both **inflows and outflows**. Designed for business owners, not accountants — the system auto-detects as much as possible from Xero and Open Banking, asks the user only what it can't figure out, and gets more accurate every week as real data confirms or corrects its predictions.

#### Design Philosophy
- **Graduated accuracy targets** through Bayesian updating — start with reasonable priors, improve with every payment observed:
  - Week 1: 95%+ (known balance, confirmed commitments, recent intent signals)
  - Weeks 2–4: 85–90% (strong debtor models, solid recurring patterns)
  - Weeks 5–8: 75–85% (increasing debtor uncertainty, some outflows less certain)
  - Weeks 9–13: 65–75% (significant uncertainty — this is where the three scenarios earn their value)
- **Primary accuracy metric: scenario bracketing** — the actual cash balance should fall within the optimistic-pessimistic range **90%+ of the time across all weeks**. This matters more than the point estimate because it proves the system gives reliable signals even when the expected scenario is slightly off.
- **Three scenarios**: Optimistic / Expected / Pessimistic shown for every week
- **Auto-detect first, ask second** — every data category has an auto-detection strategy before falling back to user input
- **Manual inputs decay** — user-entered adjustments (capex, hiring, revenue changes) have an expiry. As time passes, they fall away and the forecast reverts to auto-detected patterns. This prevents stale manual overrides from corrupting the forecast.
- **Simple to operate** — the user sees a clear weekly view with traffic-light indicators. The Bayesian engine runs invisibly underneath.

#### Forecast Categories

**INFLOWS**

| Category | Source | Auto-Detection Method | User Input Needed? |
|----------|--------|----------------------|-------------------|
| AR collections (debtor payments) | Xero (invoices) + Open Banking (payment timing) + Qollections (intent signals) | Per-debtor Bayesian payment prediction model. See detailed model below. | No — fully automatic |
| Ad-hoc / cash sales | Open Banking | Detect recurring non-invoice income patterns from bank transactions | Rare — only if new revenue stream |
| Short-term revenue changes | User input | Cannot auto-detect | Yes — via changes dialog. Expires after stated period. |
| Refunds / credits expected | Xero (credit notes) | Detect outstanding credit notes or supplier refunds | No |
| Other income (grants, tax refunds, asset sales) | User input | Cannot reliably auto-detect | Yes — via changes dialog. One-off items with expected date. |

**OUTFLOWS**

**Design principle:** Open Banking is the primary source for ALL outflow detection. The bank account is the ground truth for what actually leaves the business. Xero AP data enriches the picture (supplier names, bill amounts, due dates) but many outflows never touch the AP ledger — direct debits, standing orders, debit card payments, bank transfers. The system must detect and forecast ALL of these without burdening the user.

**Bank Transaction Classification Engine:**
Every outgoing bank transaction detected via Open Banking is automatically classified into one of four categories:

| Classification | Description | Forecasting Approach | User Action |
|---------------|-------------|---------------------|-------------|
| **AP-Matched** | Payment matches a bill in Xero AP (by amount, supplier reference, or payee name) | Per-supplier Bayesian model using bill due dates + historic payment timing | None — fully reconciled |
| **Recurring** | No AP match, but follows a clear pattern: same/similar payee, consistent amount (±10%), regular interval (weekly/fortnightly/monthly/quarterly/annual). Examples: direct debits, standing orders, subscriptions, insurance, loan repayments, rent. | Forecast next occurrence at detected amount and date with high confidence | None — auto-detected. Silent notification: "We've detected a recurring payment of £450/month to Vodafone Ltd." User can reclassify or remove if wrong. |
| **Semi-Recurring** | No AP match, repeated payee but variable amounts or irregular timing. Examples: fuel, office supplies, Amazon purchases, business meals, ad spend. | Forecast using rolling average amount and average interval, with wider confidence bands | None — auto-detected. Wider scenario bands absorb the variability. |
| **One-Off** | No pattern, no AP match, not seen before or seen only once. | NOT forecast forward. Included in actuals but does not project into future weeks. | None — unless user flags it as expected to recur via changes dialog. |

**Classification is automatic and silent.** The system does not ask the user to categorise transactions. It classifies using payee name matching, amount pattern detection, and interval analysis. If the user wants to correct a classification, they can — but the default is that the system handles it.

**New recurring pattern detection:** When a transaction appears for the second or third time with a matching payee and consistent timing, the system promotes it from One-Off to Semi-Recurring or Recurring. A subtle in-app notification appears: "New recurring payment detected: £89/month to AWS. Added to your forecast." No action required from the user.

**Specific outflow categories (some detected via classification engine, some from other sources):**

| Category | Source | Auto-Detection Method | User Input Needed? |
|----------|--------|----------------------|-------------------|
| AP (supplier payments) | Xero (bills/AP) + Open Banking | AP-Matched classification. Per-supplier Bayesian payment prediction using bill due dates + historic payment timing from Open Banking. | No — automatic once AP data available |
| Direct debits & standing orders | Open Banking (Recurring classification) | Detected from bank transaction patterns. Consistent payee, amount, and date. | No — auto-detected |
| Debit card / card payments (recurring) | Open Banking (Recurring or Semi-Recurring) | Card payments to same merchants detected. SaaS subscriptions, phone bills, utilities classified as Recurring. Variable card spend (fuel, supplies) classified as Semi-Recurring. | No — auto-detected with appropriate confidence bands |
| Payroll | Open Banking (Recurring classification) | Detect recurring salary payments (weekly/monthly pattern, consistent amounts). Cross-reference with Xero payroll journals if available. | Confirmation on first detection, then automatic. User updates for planned hiring/changes. |
| HMRC PAYE (employer NIC + employee tax) | Calculated from payroll data | If payroll detected: estimate PAYE as ~30-40% of gross payroll (prior). Refine with actual HMRC payment history from Open Banking. Monthly payment, typically 22nd of following month. | Confirmation of percentage on setup. Then automatic. |
| VAT | Xero (VAT returns) + Open Banking | Xero provides VAT return data and quarter-end dates. Calculate expected VAT liability from recent returns. Payment due 1 month + 7 days after quarter end. | No — auto-calculated from Xero VAT data. User can override if they know it will differ. |
| Corporation Tax | Xero (filing history) + Open Banking | Detect annual pattern from Open Banking. Use previous year's payment as prior. Due 9 months + 1 day after accounting year end. | User confirms amount estimate. Annual item — prompted once per year. |
| HMRC TTP (Time to Pay arrangements) | User input | Cannot auto-detect — these are negotiated arrangements | Yes — user enters schedule (amount, frequency, remaining payments). Fixed schedule once entered. |
| Credit card statement payments | Open Banking (Recurring classification) | Detect monthly credit card payment pattern. Estimate next payment from recent 3-month trend of card statement amounts. | No — auto-detected. Note: this captures the card payment to the card issuer, distinct from individual card transactions. |
| Loan repayments | Open Banking (Recurring classification) | Detect recurring fixed payments to lenders (consistent amount, monthly pattern). | Confirmation on first detection, then automatic. |
| Rent / lease payments | Open Banking (Recurring classification) | Detect recurring property/equipment lease payments | Confirmation on first detection, then automatic. |
| Insurance | Open Banking (Recurring classification) | Detect annual or monthly insurance payments | Confirmation on first detection, then automatic. |
| Subscriptions / SaaS tools | Open Banking (Recurring classification) | Detect recurring patterns (software tools, utilities, phones etc.) | No — auto-detected. User can remove false positives. |
| Variable regular spend (fuel, supplies, consumables) | Open Banking (Semi-Recurring classification) | Same payee, variable amounts. Forecast using rolling average + wider bands. | No — auto-detected with wider confidence bands |
| Ad spend / marketing | Open Banking (Semi-Recurring classification) | Detect regular payments to ad platforms (Google, Meta, LinkedIn). Variable amounts. | No — auto-detected. User can add expected changes via changes dialog. |
| Anticipated Capex | User input | Cannot auto-detect — discretionary spending | Yes — via changes dialog. User enters amount + expected week. Expires if not updated. |
| Planned hiring (additional payroll) | User input | Cannot auto-detect until person is hired | Yes — via changes dialog. User enters: start date, salary, on-costs estimate. Expires and converts to detected payroll once person is on payroll. |
| Short-term overhead changes | User input | Cannot auto-detect | Yes — via changes dialog. Expires after stated period. |
| Dividends | User input or Open Banking | Detect historic dividend payments if pattern exists | Prompted if pattern detected, otherwise user input. |
| One-off known costs | User input | Cannot auto-detect | Yes — via changes dialog. One-off with expected date. |

#### The Bayesian Engine

**Core Concept:**
Every forecast line item has a **prior distribution** (what we expect based on history) that gets updated into a **posterior distribution** (what we now expect given new evidence). The forecast shows the posterior for each week.

**Accounting Platform Data Usage Clarification (re: Xero API Terms — see Section 5A):**
The Bayesian models are **trained** (priors built) exclusively on Open Banking payment data and Qashivo interaction data. No accounting platform API data is used to build, train, or update model weights.

However, the models use accounting platform data as **runtime inputs** during each forecast cycle — specifically invoice due dates, bill amounts, and VAT return figures. This is the same way any accounting app uses this data: an ageing report uses the invoice due date to calculate "days overdue"; Qashflow uses it to anchor where in time a payment prediction sits. The due date is a static fact being referenced, not an observation being learned from.

The distinction:
- **Training** (prohibited with Xero data): "We observed that Acme paid invoice #1234 on 5 March, 5 days after the due date. We update our model of Acme's payment behaviour with this observation." → This uses Open Banking payment date. Clean.
- **Runtime input** (standard app functionality): "Invoice #1234 is due on 28 Feb. Our model predicts Acme will pay ~8 days late. Therefore we forecast payment in the week of 3 March." → The due date from Xero is a coordinate, not a training observation. Same as every AR app in the Xero marketplace.

This applies equally to AP outflow prediction (bill amounts and dates as inputs), tax estimation (VAT return figures as inputs), and any other forecast category that references accounting platform data.

**For AR inflows (per invoice):**
```
Prior: debtor's historic payment cadence (from Open Banking training data)
  → "Acme Ltd typically pays 8 days late, std dev 4 days"

Evidence updates:
  + Qollections intent signal: promise-to-pay on 15 March → shifts distribution, narrows uncertainty
  + Qollections intent signal: acknowledged but no date → mild positive shift
  + No response + overdue → distribution shifts later, widens uncertainty
  + Broken previous promise → distribution shifts later, widens significantly
  + Partial payment received → remaining amount re-forecasted

Posterior: updated prediction of when and how much this debtor will pay this invoice
```

**For AP outflows (per supplier):**
```
Prior: historic payment pattern to this supplier (from Open Banking)
  → "We typically pay Supplier X on the 15th of the month, average £3,200"

Evidence updates:
  + New bill entered in Xero → confirms amount, updates timing expectation
  + Bill marked as approved/scheduled → high confidence for expected date
  + Payment terms known → informs expected date
  + Historic pattern of early/late payment to this supplier → adjusts

Posterior: updated prediction of when and how much we'll pay this supplier
```

**For recurring outflows (payroll, rent, loans, etc.):**
```
Prior: detected pattern from Open Banking (amount, frequency, date)
  → "Payroll: £28,000 every Friday" or "Rent: £4,500 on 1st of each month"

Evidence updates:
  + Each actual payment confirms or adjusts the pattern
  + User input (hiring plan) → adds to future payroll amounts
  + Seasonal variation detected → adjusts prior for known seasonal periods

Posterior: high-confidence prediction (recurring items have low uncertainty)
```

**For tax payments (PAYE, VAT, Corp Tax):**
```
Prior: calculated from known tax rules + historic data
  → "VAT Q1: estimated £12,000, due 7 May" (from Xero VAT return data)
  → "PAYE: estimated £8,400/month, due 22nd" (from payroll ×  ~30-40%)

Evidence updates:
  + Actual VAT return filed in Xero → exact amount known
  + Actual PAYE payment observed in Open Banking → refines percentage estimate
  + Corp tax payment from previous year → prior for this year

Posterior: medium-to-high confidence (tax amounts are somewhat predictable)
```

**For user-entered items (capex, hiring, revenue changes):**
```
Prior: no prior — entirely based on user input
  → "Capex: £15,000 server upgrade, expected week of 14 April"

Evidence updates:
  + User confirms/updates the item → maintained
  + User doesn't update and expiry date passes → item falls away from forecast
  + If item was expected but Open Banking shows no matching payment → prompt user: "Did the £15,000 server upgrade happen?"

Posterior: confidence depends on how recently the user confirmed the item
```

#### Three Scenarios

Each weekly bucket shows three figures:

| Scenario | How Calculated |
|----------|---------------|
| **Optimistic** | All AR inflows at the early end of their distribution (10th percentile of days-to-pay). All outflows at their expected amounts. User-entered positive changes included. |
| **Expected** | AR inflows at median of their distribution. Outflows at expected amounts. All confirmed items included. |
| **Pessimistic** | AR inflows at the late end of their distribution (90th percentile). Outflows at expected amounts + any flagged risks (e.g., debtor showing deterioration). Known one-off costs included even if timing uncertain. |

The spread between optimistic and pessimistic **narrows over time** as Bayesian updating accumulates evidence and as weeks get closer (less uncertainty about near-term events).

#### User Changes Dialog

The changes dialog is how users input information the system can't auto-detect. Design principles:
- **Not a wizard** (not a forced linear flow) — it's a dialog/panel the user can open anytime
- Items are organised by category: Revenue Changes, Cost Changes, Hiring, Capex, Tax, Other
- Each item has: description, amount, timing (which week or date range), and **expiry** (when this adjustment falls away if not updated)
- Default expiry: 3 months from entry, or the end date if a date range is specified
- Items approaching expiry trigger a prompt: "Your £15,000 capex estimate expires next week. Is this still planned?"
- Expired items disappear from the forecast silently (the forecast reverts to auto-detected patterns)
- User can see a list of all active adjustments and their expiry dates

#### Alerts & Triggers
- **Cashflow gap alert**: pessimistic scenario shows negative balance or balance below user-defined threshold in any future week
- **Debtor risk alert**: key debtor showing deteriorating payment behaviour (Bayesian posterior shifting unfavourably)
- **Concentration alert**: >30% of expected inflows in a single week depend on one debtor
- **Tax payment reminder**: upcoming HMRC payment approaching (PAYE, VAT, Corp Tax)
- **Qapital trigger**: expected or pessimistic scenario shows cashflow gap → prompt to activate pre-approved finance
- **Forecast accuracy drift**: if forecast-vs-actual variance exceeds threshold for 3+ consecutive weeks, alert user to review inputs
- Alert delivery: in-app notification, email, SMS (configurable per alert type)

#### Reporting
- **Primary view**: 13-week bar chart. Stacked bars for inflows (by category) and outflows (by category). Line for cumulative cash balance with optimistic/pessimistic bands shaded.
- **Drill-down**: click any week to see all individual inflow and outflow items with amounts and confidence levels
- **Scenario toggle**: switch between optimistic / expected / pessimistic views, or overlay all three
- **Category breakdown**: pie/bar chart showing outflow composition (payroll X%, suppliers Y%, tax Z%, etc.)
- **Forecast vs actual**: retrospective accuracy tracking. How accurate was last week's / last month's forecast? Builds user confidence and identifies systematic biases.
- **Trend view**: is the overall cash position improving or deteriorating over the 13-week horizon?
- **What-if**: user can create a temporary scenario ("what if Acme doesn't pay for 6 weeks?" or "what if I hire 2 more people?") without affecting the main forecast

#### Data Model — Key Entities (Qashflow)
```
Forecast
├── generated_at (timestamp)
├── opening_cash_balance (from Open Banking)
├── ForecastWeeks[] (13 entries)
│   └── ForecastWeek
│       ├── week_starting (date)
│       ├── scenarios
│       │   ├── optimistic { total_inflows, total_outflows, net, cumulative_balance }
│       │   ├── expected { total_inflows, total_outflows, net, cumulative_balance }
│       │   └── pessimistic { total_inflows, total_outflows, net, cumulative_balance }
│       ├── inflow_items[]
│       │   └── InflowItem
│       │       ├── category (ar_collection / ad_hoc_income / refund / user_entered)
│       │       ├── source_description (e.g., "Acme Ltd - Invoice #1234")
│       │       ├── amount_expected
│       │       ├── amount_optimistic
│       │       ├── amount_pessimistic
│       │       ├── confidence_score
│       │       └── basis (debtor_model / intent_signal / historic_pattern / user_input)
│       └── outflow_items[]
│           └── OutflowItem
│               ├── category (ap_supplier / payroll / paye / vat / corp_tax / ttp /
│               │             credit_card / loan / rent / insurance / subscription /
│               │             capex / hiring / dividend / user_entered_other)
│               ├── source_description (e.g., "Monthly payroll" or "VAT Q1 payment")
│               ├── amount_expected
│               ├── amount_optimistic
│               ├── amount_pessimistic
│               ├── confidence_score
│               └── basis (detected_pattern / xero_bill / calculated / user_input)
├── alerts[]
│   └── Alert (type, severity, week_affected, message, qapital_eligible: bool)
└── accuracy_tracking[]
    └── AccuracyRecord
        ├── forecast_date (when the forecast was generated)
        ├── target_week
        ├── horizon_weeks (how far ahead this prediction was: 1, 2, 3... 13)
        ├── predicted_balance_expected
        ├── predicted_balance_optimistic
        ├── predicted_balance_pessimistic
        ├── actual_balance
        ├── variance_expected (actual - predicted_expected)
        ├── variance_pct
        ├── within_scenario_bracket (bool: actual between optimistic and pessimistic?)
        └── accuracy_tier (week 1 / weeks 2-4 / weeks 5-8 / weeks 9-13)

RecurringPattern (auto-detected from Open Banking via classification engine)
├── pattern_id
├── description (auto-generated: "Monthly payment to Acme Landlords Ltd")
├── classification (ap_matched / recurring / semi_recurring)
├── category (payroll / rent / loan / insurance / subscription / credit_card / 
│             direct_debit / standing_order / variable_spend / ad_spend / other)
├── payee_name (normalised from bank transaction data)
├── payee_variants[] (different name formats seen: "VODAFONE LTD", "VODAFONE UK", etc.)
├── amount_mean
├── amount_std_dev
├── amount_is_fixed (bool — true for DD/standing orders with consistent amount)
├── frequency (weekly / fortnightly / monthly / quarterly / annual / irregular)
├── typical_day (e.g., 1st of month, every Friday, 22nd of month)
├── last_occurrence_date
├── last_occurrence_amount
├── occurrence_count (how many times this pattern has been observed)
├── confidence_score
├── user_confirmed (bool — has user confirmed this detection?)
├── user_dismissed (bool — user said this is not a real pattern)
├── ap_bill_id (if ap_matched — link to Xero bill)
├── first_detected_date
└── active (bool)

BankTransactionClassification (per outgoing transaction from Open Banking)
├── transaction_id
├── date
├── amount
├── payee_raw (raw payee string from bank)
├── payee_normalised (cleaned/matched payee name)
├── classification (ap_matched / recurring / semi_recurring / one_off)
├── matched_pattern_id (→ RecurringPattern, if classified as recurring/semi_recurring)
├── matched_ap_bill_id (→ Xero bill, if classified as ap_matched)
├── classification_confidence
├── classification_method (payee_match / amount_pattern / interval_pattern / ap_reconciliation)
├── user_override (if user reclassified manually)
└── included_in_forecast (bool — one-offs are NOT forecast forward)

UserAdjustment (manual inputs via changes dialog)
├── adjustment_id
├── category (revenue_change / cost_change / hiring / capex / tax / other)
├── description
├── amount
├── timing_type (one_off_date / date_range / recurring_weekly / recurring_monthly)
├── start_date
├── end_date (if range)
├── entered_date
├── expiry_date (defaults to 3 months or end_date)
├── last_confirmed_date
├── expired (bool)
└── affects (inflows / outflows)

DebtorPaymentModel (per debtor — Bayesian, trained on Open Banking data)
├── debtor_id
├── prior_mean_days_to_pay
├── prior_std_dev
├── posterior_mean_days_to_pay (updated with each new payment observation)
├── posterior_std_dev
├── seasonal_adjustments[] (month → adjustment factor)
├── trend (improving / stable / deteriorating)
├── promise_reliability (from Qashivo interaction data)
├── observations_count (number of payment observations feeding the model)
├── last_updated
└── data_source: "open_banking" (explicit — never accounting platform)

SupplierPaymentModel (per supplier — Bayesian, for AP outflow prediction)
├── supplier_id
├── prior_mean_days_to_pay_after_bill
├── prior_std_dev
├── posterior_mean_days_to_pay_after_bill
├── posterior_std_dev
├── typical_payment_day_of_month
├── observations_count
├── last_updated
└── data_source: "open_banking"

TaxEstimate
├── tax_type (paye / vat / corp_tax)
├── period
├── estimated_amount
├── due_date
├── basis (calculated_from_payroll / xero_vat_return / prior_year_amount / user_input)
├── confidence_score
└── actual_amount (filled after payment observed)
```

### 4.3 QAPITAL (Working Capital Finance)

#### Core Purpose
Pre-authorised finance facility that activates instantly when Qashflow identifies a cashflow gap. During the build phase, Qapital operates as a referral/origination layer connecting customers with a panel of finance providers. Post-acquisition by a bank, the bank replaces the panel with its own balance sheet.

#### Key Features

**Pre-Authorisation at Onboarding**
- When a customer joins Qashivo, they go through a finance eligibility assessment
- Assessment uses: company financials, debtor book quality, trading history, credit data
- Result: pre-authorised limit (e.g., "eligible for up to £50,000 selective invoice finance") or declined with improvement guidance
- Pre-authorisation is reviewed and updated automatically as Qollections and Qashflow data accumulates (improves over time)

**Finance Activation**
- When Qashflow identifies a cashflow gap and the customer is pre-authorised:
  - Alert: "You have a projected cashflow gap of £X in week Y. You are pre-approved for up to £Z in invoice finance."
  - Customer selects which invoices to finance (selective) or activates whole-ledger facility
  - Because pre-authorisation is done, paperwork is minimal — just confirm the specific invoices
  - Finance provider (or acquiring bank) advances funds (typically 80-90% of invoice value)
  - Remainder (minus fees) paid when debtor settles the invoice

**Improvement Guidance (for non-approved customers)**
- If a customer doesn't qualify, Qapital provides actionable steps:
  - Reduce debtor concentration
  - Improve payment terms with key debtors
  - Resolve outstanding disputes
  - Increase trading history
  - Improve credit score (specific actions)
- Progress tracked and re-assessment triggered when conditions improve

**Finance Provider Panel (Build Phase)**
- Referral agreements with 3–5 recruitment-specialist invoice finance providers
- Qashivo earns 0.5% commission on funded invoices
- Panel can include: Skipton Business Finance, Sonovate, Simplicity, Close Brothers, Aldermore
- Post-acquisition: bank replaces panel with own facilities

**Reporting**
- Finance utilisation dashboard
- Cost of finance analysis
- Pre-authorisation status and limit
- Improvement tracker (for non-approved)

#### Data Model — Key Entities (Qapital)
```
FinanceProfile (per customer)
├── authorisation_status (approved/declined/pending_review)
├── authorised_limit
├── authorised_products[] (selective_IF, whole_ledger, other)
├── last_assessment_date
├── next_review_date
├── decline_reasons[] (if applicable)
├── improvement_actions[] (if applicable)
└── assessment_history[]

FinanceFacility (active facility)
├── provider (panel provider or bank)
├── type (selective/whole_ledger)
├── limit
├── utilised_amount
├── advance_rate (e.g., 85%)
├── fee_structure
└── status

FinanceTransaction
├── facility
├── invoices_financed[]
├── advance_amount
├── advance_date
├── fee_amount
├── settlement_date
├── settlement_amount
└── status

ImprovementPlan (for declined customers)
├── actions[]
│   └── Action (description, target, current_status, completed: bool)
├── target_review_date
└── progress_percentage
```

### 4.4 AI AGENT ARCHITECTURE

#### Overview
Qashivo operates as a **team of specialised AI agents**, each with its own decision engine, memory, persona, and domain expertise. An **Orchestrator Agent** coordinates between them, managing handoffs, resolving conflicts, and ensuring the right agent handles each situation. To the user, the dashboard feels like having a team of specialists working for them. To the debtor, it feels like dealing with a real credit control department.

#### The Agent Team

| # | Agent | Persona Type | Debtor-Facing? | Pillar | Core Responsibility |
|---|-------|-------------|----------------|--------|-------------------|
| 0 | **Orchestrator** | Internal — "Director" | No | All | Coordinates all agents, manages handoffs, resolves priority conflicts |
| 1 | **Collections Agent** | External — named persona (e.g., "Sarah Mitchell, Credit Controller") | Yes | Qollections | Debtor communications, payment chasing, intent capture, **payment plan negotiation** across all channels |
| 2 | **Credit Risk Agent** | Internal — "Risk Analyst" persona | No | Qollections / Qapital | Monitors debtor creditworthiness, flags deterioration, scores debtor book |
| 3 | **Forecasting Agent** | Internal — "Cashflow Analyst" persona | No | Qashflow | Runs Bayesian forecast, generates alerts, explains changes in plain English |
| 4 | **Dispute Resolution Agent** | External — different persona (e.g., "James Cooper, Account Manager") | Yes | Qollections | Manages dispute lifecycle, communicates with debtors to resolve issues |
| 5 | **Working Capital Optimiser** | Internal — "Financial Advisor" persona | No | All three | Strategic recommendations to improve overall working capital position. *Deferred — post-sale unless time permits.* |
| 6 | **Debt Recovery Agent** | External — different, more formal persona (e.g., "David Clarke, Senior Collections Manager") | Yes | Qollections | Late-stage escalation, formal demands, pre-legal, recovery agency coordination |
| 7 | **Onboarding Agent** | Internal — "Setup Assistant" persona | No | All | Guides new customers through setup: Xero connection, Open Banking, agent persona config, autonomy settings, debtor import review, first forecast. |
| 8 | **Customer Health Agent** | Internal — "Account Manager" persona | No | All | Monitors customer engagement, identifies churn risk. *Deferred — post-sale unless time permits.* |
| 9 | **Compliance Agent** | Internal — "Compliance Officer" persona | No | All | Reviews all outbound agent communications for regulatory compliance before delivery |

**Note on agent count:** 10 agents total (down from 11 — Payment Plan negotiation is a sub-capability of the Collections Agent, not a separate agent). Of these, **7 are core for the build phase** (Orchestrator, Collections, Onboarding, Credit Risk, Forecasting, Dispute Resolution, Compliance) plus Debt Recovery as scope permits. Two are deferred unless time and budget allow (Working Capital Optimiser, Customer Health). The Onboarding Agent is in MVP v1 — the setup experience is too complex for manual support and first impressions matter. See Section 8A for the prioritisation logic.

#### Agent 0: The Orchestrator

The Orchestrator is the central coordinator. It does not communicate with debtors or the user directly — it works behind the scenes to ensure the right agent handles each situation at the right time.

**Responsibilities:**
- **Routing**: When an event occurs (new invoice, debtor reply, payment received, dispute raised), the Orchestrator decides which agent should handle it
- **Handoffs**: Manages transitions between agents. Examples:
  - Collections Agent detects a dispute → Orchestrator pauses collections, hands debtor to Dispute Resolution Agent
  - Dispute Resolution Agent resolves issue → Orchestrator hands debtor back to Collections Agent with context
  - Collections Agent exhausts its sequence without result → Orchestrator escalates to Debt Recovery Agent
  - Credit Risk Agent flags debtor deterioration → Orchestrator tells Collections Agent to accelerate, tells Forecasting Agent to adjust predictions
  - Forecasting Agent identifies cashflow gap → Orchestrator alerts Working Capital Optimiser to recommend solutions
- **Priority management**: When multiple agents want to act on the same debtor simultaneously, the Orchestrator resolves conflicts (e.g., don't send a collections email while a dispute is being resolved)
- **Compliance gate**: All debtor-facing communications are routed through the Compliance Agent before delivery. The Orchestrator enforces this pipeline.
- **Context sharing**: Ensures agents have access to relevant context from other agents when needed (e.g., Debt Recovery Agent receives full history from Collections Agent when a handoff occurs)

**Decision logic:**
```
Event: debtor_email_reply_received(debtor, content)
  → Compliance Agent: scan content for regulatory flags
  → Orchestrator: extract intent from content
    IF intent == dispute:
      → Pause Collections Agent for this debtor
      → Hand to Dispute Resolution Agent with full context
    ELIF intent == payment_plan_request:
      → Hand to Payment Plan Agent with debtor history + configured rules
    ELIF intent == promise_to_pay OR acknowledgement:
      → Route to Collections Agent for normal handling
      → Notify Forecasting Agent to update predictions
    ELIF intent == legal_threat OR regulatory_complaint:
      → Immediately flag to Compliance Agent + alert customer
      → Pause all automated communications for this debtor

Event: collections_sequence_exhausted(debtor)
  → Orchestrator: check if debtor has engaged at all
    IF no engagement after full sequence:
      → Hand to Debt Recovery Agent
      → Notify customer: "We're escalating [debtor] to our senior collections process"
    ELIF partial engagement but no payment:
      → Collections Agent tries one more round with different strategy
      → If still no result → Debt Recovery Agent

Event: cashflow_gap_detected(week, severity)
  → Forecasting Agent: generate alert with explanation
  → Working Capital Optimiser: generate recommendations
  → IF customer is Qapital pre-approved:
    → Qapital: prompt finance activation
  → Notify customer with combined alert + recommendations
```

#### Agent 1: Collections Agent (incl. Payment Plan Negotiation)
- **Persona**: Named external persona configured by customer (e.g., "Sarah Mitchell")
- **Channels**: Email, SMS, AI Voice (outbound), Portal Chat
- **Key capability**: Autonomous multi-channel debtor communication with adaptive strategy. Includes payment plan negotiation within customer-configured rules (max instalments, min amounts, extended terms). Plans within rules are auto-approved; plans exceeding rules are flagged for human approval.
- **Memory**: Full conversation history per debtor across all channels
- **Tone**: Progressive escalation (Friendly → Professional → Firm → Formal)
- **Autonomy**: Configurable (Full Auto / Semi-Auto / Supervised)
- **Hands off to**: Dispute Resolution Agent (disputes), Debt Recovery Agent (exhausted sequence)
- **Receives from**: Dispute Resolution Agent (resolved disputes → resume collections), Orchestrator (new invoices, debtor re-engagement)
- See Section 4.1 and Section 10 for full specification.

#### Agent 2: Credit Risk Agent
- **Persona**: Internal — "Risk Analyst" (e.g., "Alex, your Risk Analyst"). Appears on dashboard providing insights and alerts. Does not communicate with debtors.
- **Key capabilities**:
  - Per-debtor credit scoring based on payment history (Open Banking), intent signals (Qashivo), and external credit data (Creditsafe/Experian)
  - Debtor book quality assessment (overall portfolio health)
  - Concentration risk monitoring (single debtor >X% of AR)
  - Deterioration detection — flags when a previously reliable debtor's behaviour is worsening
  - Sector risk signals — if multiple debtors in the same sector start paying late, flag systemic risk
  - Feeds into Qapital pre-authorisation (debtor book quality affects finance eligibility)
- **Outputs**: Risk scores per debtor, portfolio risk dashboard, alerts ("Alex has flagged that Acme Ltd's payment behaviour has deteriorated over the last 3 months"), recommendations ("Consider reducing credit exposure to construction sector debtors")
- **Informs**: Collections Agent (chase priority and intensity), Forecasting Agent (risk adjustments to predictions), Working Capital Optimiser (risk-based recommendations)

#### Agent 4: Forecasting Agent
- **Persona**: Internal — "Cashflow Analyst" (e.g., "Morgan, your Cashflow Analyst"). Appears on Qashflow dashboard explaining forecast changes and alerts in plain English.
- **Key capabilities**:
  - Runs the Bayesian forecasting engine (see Section 4.2 and Section 11)
  - Generates the 13-week forecast with three scenarios
  - Explains changes: "Your expected cash position for week of 14 April has dropped by £8,000 since last week because Acme Ltd's payment is now predicted to arrive a week later than previously forecast"
  - Identifies and alerts on cashflow gaps, debtor risk, concentration risk
  - Tracks forecast accuracy and adjusts models
  - Responds to what-if queries: "What happens if I hire two more people in May?"
- **Outputs**: Weekly forecast, scenario analysis, plain-English explanations, alerts, what-if responses
- **Informs**: Orchestrator (triggers Qapital when gaps detected), Working Capital Optimiser (forecast data for strategic recommendations)

#### Agent 5: Dispute Resolution Agent
- **Persona**: External — **different person** from the Collections Agent (e.g., "James Cooper, Account Manager"). The debtor should feel they've been escalated to someone more senior or specialised who will listen and resolve the issue fairly.
- **Channels**: Email, AI Voice, Portal
- **Key capabilities**:
  - Takes over when a debtor raises a dispute (handoff from Collections Agent via Orchestrator)
  - Acknowledges the dispute, gathers details, communicates with the debtor to understand the issue
  - Categorises disputes: pricing disagreement, service quality, incorrect invoice, goods not received, partial delivery, already paid, administrative error
  - Attempts to resolve within its authority (e.g., confirm correct amount, clarify invoice details, acknowledge errors)
  - Escalates to customer (human) when resolution requires commercial decisions (write-off, credit note, re-negotiation of terms)
  - Once resolved: hands back to Collections Agent (if balance remains) or closes the invoice
- **Memory**: Full dispute history per debtor. Inherits conversation history from Collections Agent.
- **Tone**: Always professional and empathetic — never adversarial. The goal is to resolve, not to win.
- **Hands off to**: Collections Agent (dispute resolved, balance remaining), Customer/human (commercial decision needed)

#### Agent 6: Working Capital Optimiser
- **Persona**: Internal — "Financial Advisor" (e.g., "Taylor, your Working Capital Advisor"). Appears on a strategic advisory dashboard. Provides proactive recommendations.
- **Key capabilities**:
  - Analyses the customer's overall working capital position: AR days, AP days, cash conversion cycle
  - Recommends actions to improve cashflow:
    - "Your average DSO is 47 days. If you could reduce it to 40 days, you'd free up approximately £35,000 in working capital"
    - "You're paying Supplier X 10 days early on average. Paying on terms would improve your cash position by £5,000/month"
    - "3 debtors account for 60% of your receivables. Diversifying your client base would reduce concentration risk"
    - "Based on your forecast, you'll need £20,000 in additional working capital in 6 weeks. Consider activating your pre-approved Qapital facility now while terms are favourable"
  - Monitors trends and proactively surfaces insights
  - Links recommendations to specific Qashivo actions (e.g., "Tighten payment terms" → adjust Collections Agent sequence for specific debtors)
- **Outputs**: Strategic recommendations, working capital metrics, trend analysis, actionable suggestions
- **Informs**: Customer dashboard, Forecasting Agent (scenario inputs), Qapital (finance recommendations)

#### Agent 7: Debt Recovery Agent
- **Persona**: External — **different, more formal persona** (e.g., "David Clarke, Senior Collections Manager"). Deliberately feels like an escalation — a more senior person has taken over. The name and tone should convey authority without being threatening.
- **Channels**: Email, Letter (PDF), AI Voice
- **Key capabilities**:
  - Takes over from Collections Agent when standard collection efforts are exhausted (handoff via Orchestrator)
  - Sends formal communications: final demand letters, statutory interest notifications, letter before action
  - AI Voice calls with a firmer, more authoritative tone — still professional but clearly escalated
  - Can reference the history: "I can see my colleague Sarah has been in touch several times regarding these outstanding invoices. I've been asked to take over this matter."
  - Manages referral to external debt recovery agencies (if customer has accounts with agencies)
  - Prepares documentation for legal proceedings (invoice copies, communication history, proof of delivery/service)
  - Tracks statutory interest accrual under Late Payment of Commercial Debts Act
- **Tone**: Formal, authoritative, professional. Not aggressive or threatening but clearly serious. Legal language where appropriate.
- **Autonomy**: Always requires customer approval before initiating formal legal steps (letter before action, court referral). Routine formal demands can be semi-automatic.
- **Memory**: Inherits full history from Collections Agent. The debtor should feel the handoff: "David" knows everything "Sarah" discussed.
- **Hands off to**: Customer/human (legal proceedings), Collections Agent (if debtor re-engages and pays or agrees plan)

#### Agent 8: Onboarding Agent
- **Persona**: Internal — "Setup Assistant" (e.g., "Riley, your Setup Assistant"). Guides new customers through the onboarding process via in-app chat/wizard.
- **Key capabilities**:
  - Walks customer through: Xero/QB/Sage connection, Open Banking authorisation, agent persona setup (name, voice, email), communication preferences, autonomy level, debtor import review, Qapital pre-authorisation, forecast first-run
  - Conversational — answers questions during setup ("What's Open Banking? Is it safe?")
  - Detects when steps are stuck and offers help
  - Adapts to the customer's pace — can do everything in one session or spread across days
  - Hands off to Customer Health Agent once onboarding is complete
- **Outputs**: Completed onboarding checklist, setup quality score, suggestions for optimisation
- **Active period**: Primarily during first 1-2 weeks. Can be re-invoked if customer adds a new integration or changes configuration significantly.

#### Agent 9: Customer Health Agent
- **Persona**: Internal — "Account Manager" (e.g., "Sam, your Account Manager"). Proactive relationship manager that monitors engagement and helps the customer get value.
- **Key capabilities**:
  - Monitors customer engagement: are they logging in, reviewing forecasts, acting on alerts?
  - Identifies churn risk: declining login frequency, ignoring alerts, not resolving flagged items
  - Proactively reaches out: "Hi, I noticed you haven't reviewed your cashflow forecast in two weeks. Shall I summarise what's changed?"
  - Celebrates wins: "Great news — your DSO has dropped from 52 to 44 days since you started using Qashivo!"
  - Suggests feature adoption: "You're not using Qapital yet. Based on your forecast, pre-approval could save you £X in emergency borrowing costs."
  - Collects NPS and feedback
  - For partner-connected customers: alerts the partner if churn risk is detected
- **Channels**: In-app notifications, email summaries
- **Outputs**: Engagement metrics, churn risk scores, proactive nudges, feature adoption recommendations

#### Agent 10: Compliance Agent
- **Persona**: Internal — "Compliance Officer" (e.g., "Jordan, your Compliance Officer"). Operates mostly invisibly but surfaces on the dashboard when there's a compliance flag.
- **Key capabilities**:
  - **Pre-delivery review**: All debtor-facing communications generated by any agent are routed through the Compliance Agent before being sent. It checks for:
    - Language that could constitute harassment or threats
    - Misrepresentation of legal rights or authority
    - Frequency violations (too many contacts in too short a period)
    - Time-of-day violations (contacting debtors at unreasonable hours)
    - Data leakage (mentioning one debtor's information to another)
    - Statements that could be interpreted as legal advice
    - Compliance with Late Payment of Commercial Debts Act
    - Adherence to OFT Debt Collection Guidance principles
    - GDPR compliance (data handling in communications)
  - **Block or modify**: Can block a communication and flag for human review, or suggest modifications
  - **Audit trail**: Logs every compliance check with pass/flag/block outcome
  - **Reporting**: Compliance dashboard showing checks performed, flags raised, blocks issued
  - **Regulatory monitoring**: Flags if regulatory changes might affect current agent behaviour (future capability)
- **Critical architectural note**: The Compliance Agent is the final gate before any communication leaves Qashivo. The Orchestrator enforces this — no agent can bypass it. This is non-negotiable for the bank sale (bank acquirers will require demonstrable compliance controls).

#### Agent Communication Architecture

```
                              ┌─────────────────────┐
                              │   ORCHESTRATOR (0)   │
                              │  Routes, coordinates,│
                              │  manages handoffs    │
                              └──────────┬──────────┘
                                         │
              ┌──────────┬───────────┬────┴────┬───────────┬──────────┐
              │          │           │         │           │          │
    ┌─────────┴──┐ ┌─────┴─────┐ ┌──┴───┐ ┌───┴────┐ ┌───┴───┐ ┌───┴────┐
    │ Collections │ │  Dispute  │ │ Debt │ │ Credit │ │Forecast│ │Working │
    │ Agent (1)  │ │Resol. (4) │ │Rec(6)│ │Risk (2)│ │Agt (3) │ │Cap (5)*│
    │ incl. Pay  │ │           │ │      │ │        │ │        │ │        │
    │ Plans      │ │           │ │      │ │        │ │        │ │        │
    └────────────┘ └─────┬─────┘ └───┬──┘ └────────┘ └────────┘ └────────┘
          │              │           │
          └──────────────┴───────────┘      ┌──────────┐  ┌──────────┐
                         │                  │Onboarding│  │ Customer │
                         │                  │  (7)*    │  │Health(8)*│
                ┌────────┴────────┐         └──────────┘  └──────────┘
                │ COMPLIANCE (9)  │
                │ Final gate —    │         * = deferred unless time/budget permits
                │ all outbound    │
                │ comms pass here │
                └────────┬────────┘
                         │
                    ┌────┴────┐
                    │ DEBTOR  │
                    └─────────┘

DEBTOR-FACING AGENTS (have external personas):
  1. Collections Agent — "Sarah Mitchell, Credit Controller" (incl. payment plan negotiation)
  4. Dispute Resolution Agent — "James Cooper, Account Manager"  
  6. Debt Recovery Agent — "David Clarke, Senior Collections Manager"

INTERNAL AGENTS (dashboard personas, advise the customer):
  0. Orchestrator — invisible to user and debtor
  2. Credit Risk Agent — "Alex, your Risk Analyst"
  3. Forecasting Agent — "Morgan, your Cashflow Analyst"
  5. Working Capital Optimiser — "Taylor, your Working Capital Advisor" (deferred)
  7. Onboarding Agent — "Riley, your Setup Assistant"
  8. Customer Health Agent — "Sam, your Account Manager" (deferred)
  9. Compliance Agent — "Jordan, your Compliance Officer"
```

#### Persona Configuration

**External personas** (debtor-facing) are configured by the customer:
- Customer chooses the name, job title, and email signature for each debtor-facing agent
- Default names are suggested but customisable
- All external personas use the customer's company branding (not Qashivo branding)
- Voice characteristics (for AI Voice calls) are consistent per persona but distinct between personas — "David" (Debt Recovery) should sound different from "Sarah" (Collections)
- The debtor experiences a natural escalation path: Sarah → James (dispute) or Sarah → David (recovery)

**Internal personas** (dashboard-facing) have default names and characteristics:
- Can be renamed by the customer if desired but defaults are provided
- Appear on the dashboard with a consistent visual identity (avatar, colour)
- Communicate via in-app notifications, dashboard cards, and email summaries
- Tone is always helpful and advisory — these are the customer's team, not authority figures

#### Agent Memory Model

Each agent has access to:
1. **Its own memory**: decisions made, actions taken, outcomes observed within its domain
2. **Shared debtor context**: the unified ConversationHistory per debtor (all agents contribute to and read from this)
3. **Orchestrator context**: handoff notes, priority flags, cross-agent coordination data
4. **Customer configuration**: autonomy levels, negotiation rules, escalation preferences

When a handoff occurs, the receiving agent gets a **handoff brief** from the Orchestrator:
```
Handoff: Collections → Debt Recovery
Debtor: Acme Ltd (John Smith)
Reason: Collections sequence exhausted — no payment or engagement after 45 days
History summary: 6 emails, 2 SMS, 1 voice call attempted (no answer). 
  No intent signals captured. No response to any communication.
Outstanding: Invoice #1234 (£5,000, 45 days overdue), Invoice #1289 (£3,200, 30 days overdue)
Total outstanding: £8,200
Collections Agent notes: "Debtor is completely non-responsive. Phone number may be incorrect — 
  call went to generic voicemail. Email open tracking shows emails are being opened but not responded to."
Recommended action: Formal demand letter followed by voice call from senior persona.
```

#### MVP Phasing for Agents

| Phase | Agents Active | Notes |
|-------|--------------|-------|
| MVP v1 (Months 1-3) | Collections (1), Onboarding (7), Compliance (9), Orchestrator (0) | Core collections + onboarding experience + compliance gate. Compliance rule-based initially. Onboarding Agent guides setup conversationally. |
| MVP v2 (Months 3-6) | + Forecasting (3), Credit Risk (2) | Add cashflow intelligence and risk monitoring. |
| MVP v3 (Months 6-9) | + Dispute Resolution (4), Debt Recovery (6) | Full debtor lifecycle from first contact to pre-legal. |
| MVP v4 (Months 9-12) | Orchestrator fully autonomous, Compliance upgraded to LLM-assisted | Full core agent team operational. Partner portal (lightweight) if accountant partner secured. |
| Deferred | Working Capital Optimiser (5), Customer Health (8) | Post-sale unless time/budget permits. |
| Pre-MVP | Orchestrator (0) | Exists from day one as simple rule-based routing. Becomes more intelligent as agents are added. |

---

## 5. INTEGRATIONS

### Accounting Platforms (Critical — Must Have at Launch)
| Platform | Priority | Method | Data Accessed |
|----------|----------|--------|---------------|
| Xero | P1 | OAuth2 API | Invoices, payments, contacts, bank transactions, bills |
| QuickBooks Online | P1 | OAuth2 API | Invoices, payments, customers, bank feeds |
| Sage Business Cloud | P2 | API | Invoices, payments, contacts |
| FreeAgent | P3 | API | Invoices, payments, contacts |

### Open Banking (Important for Qashflow)
- Use Open Banking APIs (AIS — Account Information Services) to read bank transaction data
- Providers: TrueLayer, Yapily, or Plaid
- Data: real-time balances, transaction history, recurring transaction detection
- Requires FCA authorisation or partnership with authorised AISP

### Communication Channels
| Channel | Provider Options | Use |
|---------|-----------------|-----|
| Email | SendGrid, Postmark, SES | Conversational email (outbound + inbound reply handling) |
| SMS | Twilio, MessageBird | Conversational SMS (outbound + inbound reply handling) |
| Letter/PDF | Internal PDF generation + postal API (e.g., Stannp) | Formal notices, letter before action |
| AI Voice (Outbound) | Vapi, Bland.ai, Retell AI, or Twilio + custom | Outbound conversational calls. Must sound natural, handle interruptions, extract intent in real-time |
| Portal Chat | WebSocket-based chat widget | Real-time conversational chat on debtor portal |

### Credit Data (for Qapital)
- Companies House API (free — company data, filing history)
- Credit reference agencies: Creditsafe, Experian Business, Red Flag Alert
- Data: company credit score, CCJs, filing history, director data

### Payment Gateway (for Debtor Portal)
- Allow debtors to pay invoices directly from the portal
- Options: Stripe, GoCardless (for Direct Debit), Open Banking payment initiation
- GoCardless particularly useful for recurring/large B2B payments

---

## 5A. ACCOUNTING PLATFORM API CONSTRAINTS & DATA ARCHITECTURE

### Overview
Xero, QuickBooks, and Sage each impose terms on how data accessed via their APIs can be used. Xero's terms (updated December 2025) explicitly prohibit using API Data to train AI models. However, Qashivo's architecture cleanly separates **static transactional data** (from accounting platforms) from **behavioural payment data** (from Open Banking) and **interaction data** (from Qashivo's own agent). This separation means the AI models can be trained and improved without using any accounting platform API data.

### The Key Restriction
Xero prohibits using API Data to **"train or fine tune any artificial intelligence models including machine learning tools, large language models or predictive analytics tools."** Assume QuickBooks and Sage have or will impose similar restrictions.

### Qashivo's Data Source Separation

**Data from Accounting Platforms (Xero, QuickBooks, Sage) — STATIC TRANSACTIONAL DATA**
- Invoices raised: number, amount, currency, date, due date, line items
- Credit notes and adjustments
- Contact/debtor details: name, company, email, phone
- Bills (accounts payable, if used for Qashflow)
- Invoice status changes (sent, viewed, paid — where available)

This is **static record data**. An invoice is a fact: "Invoice #1234, £5,000, due 28 Feb, to Acme Ltd." It doesn't change. Qashivo reads this data via the API, stores it, displays it in the UI, and uses it as operational context (e.g., the AI agent references invoice details in communications). **This is standard app functionality — reading and displaying records — not AI training.**

**Data from Open Banking — BEHAVIOURAL PAYMENT DATA**
- When payments actually arrive in the customer's bank account
- Payment amounts and which invoices they correspond to (via matching/reconciliation)
- Payment timing patterns per debtor (the actual days-to-pay behaviour)
- Bank balances and transaction history
- Recurring payment patterns

This is **behavioural data** sourced directly from the customer's bank account via their explicit Open Banking consent. It is completely independent of any accounting platform's API terms. **This is the data that trains Qashivo's predictive models** — per-debtor payment cadence, reliability scoring, seasonal patterns, trend analysis.

**Data from Qashivo's Own Platform — INTERACTION DATA**
- Agent communications sent and debtor responses (emails, SMS, voice transcripts)
- Debtor intent signals (promises, acknowledgements, disputes) captured via all channels
- Agent strategy outcomes (which channel worked, which tone level prompted response)
- Promise reliability (promises kept vs broken)
- Payment plan adherence
- Portal engagement metrics

This is **Qashivo's own first-party data**, generated through the platform's operations. It is not sourced from any accounting platform API. **This data can be freely used for AI training, pattern learning, and model improvement.**

### The Clean Architecture

```
┌─────────────────────────┐     ┌──────────────────────────┐     ┌─────────────────────────┐
│   ACCOUNTING PLATFORM   │     │      OPEN BANKING        │     │    QASHIVO PLATFORM     │
│   (Xero / QB / Sage)    │     │  (TrueLayer / Yapily)    │     │   (Own interaction data) │
├─────────────────────────┤     ├──────────────────────────┤     ├─────────────────────────┤
│ Static data:            │     │ Behavioural data:        │     │ Interaction data:       │
│ • Invoices raised       │     │ • Payment dates          │     │ • Agent conversations   │
│ • Debtor contacts       │     │ • Payment amounts        │     │ • Intent signals        │
│ • Credit notes          │     │ • Bank balances          │     │ • Channel effectiveness │
│ • Bills/AP              │     │ • Transaction history    │     │ • Promise reliability   │
│                         │     │ • Recurring patterns     │     │ • Tone escalation data  │
├─────────────────────────┤     ├──────────────────────────┤     ├─────────────────────────┤
│ USE: Display, reference,│     │ USE: Train payment       │     │ USE: Train agent        │
│ operational context for │     │ prediction models,       │     │ behaviour models,       │
│ agent communications.   │     │ debtor cadence models,   │     │ channel optimisation,   │
│                         │     │ Qashflow forecasting     │     │ cross-debtor learning   │
│ ⛔ NOT used for AI      │     │ engine.                  │     │                         │
│ training.               │     │ ✅ CAN train AI models.  │     │ ✅ CAN train AI models. │
└─────────────────────────┘     └──────────────────────────┘     └─────────────────────────┘
```

### What This Means in Practice

**Qashflow Forecasting Engine:**
- "What invoices are outstanding and when are they due?" → comes from accounting platform (static data, used as input)
- "When will this debtor actually pay based on past behaviour?" → trained on Open Banking payment dates, confirmed by accounting platform allocation
- "How confident are we in this prediction?" → trained on Qashivo promise reliability data + Open Banking payment pattern variance

**AI Collections Agent:**
- "What invoices should I chase and what are the details?" → comes from accounting platform (static operational context)
- "What channel should I use, what tone, what time of day?" → trained on Qashivo interaction data (response rates, outcomes)
- "Is this debtor likely to pay on time or do I need to escalate?" → trained on Open Banking payment patterns + Qashivo intent data
- "How should I word this email?" → pre-trained LLM (Claude) with runtime context from all sources (inference, not training)

**Per-Debtor Payment Models:**
- `avg_days_to_pay` → calculated from Open Banking payment dates (triggered by accounting platform allocation confirmation)
- `promise_reliability` → calculated from Qashivo intent signals vs Open Banking payment confirmations
- `preferred_channel` → learned from Qashivo interaction data
- `seasonal_patterns` → derived from Open Banking payment timing across months/quarters

**Key principle:** The accounting platform allocation is the **trigger** that tells Qashivo "this payment is confirmed against these invoices — you can now create training records." The training data itself (payment timing) comes from Open Banking. The accounting platform never feeds an AI training pipeline.

### Payment Reconciliation Flow — The Two-Signal Model
Payment reconciliation requires **two signals working together**: Open Banking provides the payment timing (when money arrived), and the accounting platform provides the allocation (which invoices the payment covers). Neither signal alone is sufficient.

**The flow:**
```
1. OPEN BANKING detects payment landing in bank account
   → Captures: amount, date/time, sender reference, sender details
   → Stored as: UnmatchedBankTransaction (amount, date, reference, sender)
   → Status: UNRECONCILED

2. CUSTOMER (or accountant) allocates payment against invoices in Xero/QB/Sage
   → This is the definitive reconciliation — especially for bulk payments
   → Example: £50,000 payment allocated against 15 separate invoices

3. XERO SYNC picks up the allocation
   → Qashivo receives: Invoice #1234 marked as paid, Invoice #1235 marked as paid, etc.
   → This is the SIGNAL that triggers training data creation

4. QASHIVO MATCHES allocation to bank transaction
   → Links: Invoice #1234 (due 28 Feb) → paid via bank transaction on 5 March (Open Banking)
   → Each invoice in the bulk payment gets its own training record
   → All share the same Open Banking payment date

5. TRAINING RECORD CREATED (per invoice)
   → Invoice: #1234
   → Debtor: Acme Ltd
   → Amount: £5,000
   → Due date: 28 Feb (from Xero — static data)
   → Actual payment date: 5 March (from Open Banking — behavioural data)
   → Days late: 5
   → Trigger: Xero allocation confirmed
   → Training data source: Open Banking ✅ (not Xero)
```

**Why this matters:**
- A large payment might land in the bank account covering multiple invoices. Open Banking sees one transaction for £50,000 but Qashivo doesn't know which invoices it covers.
- Only when the payment is allocated in the accounting platform does Qashivo know: "this £50,000 covered invoices #1234, #1235, #1236... #1248."
- At that point, Qashivo creates a training record for each invoice, using the **Open Banking payment date** as the actual payment date.
- The Xero allocation is the **trigger/confirmation** — it makes the data reliable enough to train on. But the training data itself (payment timing) comes from Open Banking.

**Edge cases:**
- Payment in Open Banking but not yet allocated in Xero: training record is NOT created yet. The money is noted as received but unreconciled. Qashflow can use this as a positive signal (money arrived) but per-invoice training waits for allocation.
- Payment allocated in Xero but no matching Open Banking transaction: fall back to Xero payment date as a proxy. Flag for manual review. This might happen if Open Banking isn't connected or if the payment came through a channel not visible via Open Banking.
- Partial payment: allocated against invoice in Xero as partial. Training record notes partial payment. Remaining balance continues in collections.
- Payment on account (not allocated to specific invoices): no per-invoice training record until allocated. Qashflow notes the cash received.

### Use Case Approval Strategy
Qashivo's Xero app registration should describe the use case as:

*"Qashivo is a credit control and cashflow management platform. It reads invoice, contact, and payment status data from Xero to display outstanding receivables, automate debtor communications, and inform rolling cashflow forecasts. The app uses AI to generate personalised debtor communications based on invoice details. Payment behaviour analysis and predictive models are built from the customer's own bank transaction data via Open Banking, not from Xero API data."*

### Additional Platform-Specific Constraints
- **Branding**: Cannot mention Xero in app promotion without written approval
- **Financial services**: If Qapital referrals constitute financial services, Xero requires separate approval and potentially additional terms/fees
- **Security**: Must meet Xero's minimum security requirements; report security incidents within 24 hours
- **Usage limits**: API call volume limits apply; may need to negotiate higher limits as customer base grows
- **Audit rights**: Xero can audit API usage up to twice per year
- **Termination risk**: Xero can suspend access immediately if they suspect a breach — architect the product so it degrades gracefully if a sync is interrupted (Qashivo retains its own copy of synced data)

**What Qashivo DOES do (and this is standard app functionality):**
- Read invoice and payment data via the API to display in Qashivo's UI — this is the core approved use case
- Use that data at runtime as context in LLM prompts (e.g., the AI agent assembles a prompt containing "Invoice #1234, £5,000, due 28 Feb, debtor: Acme Ltd" to generate a contextual email) — this is **inference**, not training
- Calculate per-debtor statistics (average days to pay, payment trends, reliability scores) from historic payment data stored in Qashivo's own database — this is **application logic**, not AI model training
- Use those statistics as inputs to the Qashflow forecasting engine — this is the app's core feature set

### Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Xero challenges the architecture | Very Low | High | Clean separation between static data (Xero) and behavioural data (Open Banking). No Xero data enters any training pipeline. |
| Xero rejects use case during approval | Low | High | Use case description is conservative and aligns with many approved AR/credit control apps. Engage Xero partnership team early. |
| Open Banking consent rates are low | Medium | Medium | Position Open Banking as "connect your bank for better cashflow forecasts." Highlight the value. Many SMEs already familiar with Open Banking. |
| Payment matching accuracy is poor | Medium | Medium | Use multiple matching signals (amount, reference, debtor, timing). AI-assisted matching for ambiguous cases. Allow manual override. |
| QuickBooks/Sage have stricter terms | Low-Medium | Medium | Review each platform's terms individually. Architecture is platform-agnostic — accounting platforms only provide static data regardless. |

---

## 6. TECH STACK RECOMMENDATIONS

### Backend
- **Language**: TypeScript (Node.js) or Python (FastAPI/Django)
- **Database**: PostgreSQL (primary), Redis (caching, queues)
- **API**: REST API with OpenAPI spec; consider GraphQL for dashboard queries
- **Queue/Jobs**: Bull (Node) or Celery (Python) — for scheduled communications, forecast recalculation, data sync
- **Authentication**: Auth0 or Clerk (multi-tenant SaaS auth)

### AI / LLM Layer (Critical for Collections Agent)
- **LLM Provider**: Anthropic Claude API (primary) or OpenAI — for agent decision-making, email/SMS generation, intent extraction from replies, conversation management. **Critical: use providers with zero data retention / no training on input data. Anthropic supports this via API. See Section 5A for accounting platform API constraints.**
- **Agent Framework**: LangChain, LangGraph, or custom agent loop — the agent needs tool-calling capability (send email, send SMS, initiate call, create intent signal, check negotiation rules, escalate to human)
- **Voice AI**: Vapi, Bland.ai, or Retell AI — for outbound AI voice calls. Must support: custom voice/persona, real-time conversation, function calling (to look up invoice data mid-call), transcript generation, intent extraction
- **NLP/Intent Extraction**: LLM-based extraction from email replies, SMS replies, and call transcripts. Extract: promise-to-pay dates, acknowledgements, disputes, payment confirmations, sentiment
- **Prompt Engineering**: Critical — each persona needs a system prompt that includes: persona identity, company context, debtor history, current invoices, tone level, negotiation rules, conversation history. This prompt must be dynamically assembled per-interaction.
- **Guardrails**: Agent must never provide legal advice, never threaten, never misrepresent the debt, never share one debtor's information with another. Compliance layer wraps all agent outputs.

### Frontend
- **Framework**: React (Next.js) or Vue.js
- **UI Library**: Tailwind CSS + shadcn/ui or similar component library
- **Charts**: Recharts, Chart.js, or D3 for forecast visualisations
- **Chat Widget**: Custom WebSocket-based chat for debtor portal (or embeddable widget library)
- **State**: React Query / TanStack Query for server state

### Infrastructure
- **Cloud**: AWS (primary) or GCP
- **Hosting**: Containerised (Docker) on ECS/Fargate or similar
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry (errors), Datadog or CloudWatch (infra)
- **Logging**: Structured logging to CloudWatch or similar

### Key Architecture Decisions
- **Multi-tenant SaaS**: Single database with tenant isolation (row-level security or schema-per-tenant)
- **Webhook-driven sync**: Accounting platforms push changes via webhooks where available; poll as fallback
- **Event-driven**: Key actions (invoice created, payment received, intent signal captured) published as events; Qashflow forecast recalculates in response; AI agent evaluates next actions in response
- **Agent loop**: The AI Collections Agent runs as an event-driven agent loop: events trigger evaluation → agent decides next action → action is executed (or queued for approval) → outcome feeds back. This is NOT a cron job running fixed sequences.
- **Inbound message routing**: Email replies (via SendGrid inbound parse or similar), SMS replies (via Twilio webhook), and portal chat messages are all routed to the AI agent for the relevant debtor. Agent assembles full context (conversation history, invoices, intent signals) and generates a response.
- **Conversation memory**: All interactions across all channels stored in unified ConversationHistory per debtor. Agent context window is assembled dynamically from this history for each interaction.
- **Background jobs**: Forecast recalculation runs daily + on-demand. Agent scheduled actions (pre-due reminders, follow-ups) run via job queue. Voice calls scheduled and initiated via queue.
- **API-first**: Everything exposed via API so that post-acquisition the bank can integrate with their systems
- **Compliance layer**: All agent-generated content passes through a compliance check before delivery (no legal threats, no harassment, no data leakage between debtors, adherence to UK late payment legislation and FCA guidelines)

---

## 7. USER ROLES & PERSONAS

### Primary User: SME Business Owner / Finance Manager
- Uses Qollections to manage receivables
- Reviews Qashflow forecast weekly
- Receives alerts about cashflow gaps
- Activates Qapital finance when needed
- Typically non-technical; needs simple, clear UI
- May have an accountant (partner) connected who can view or manage on their behalf

### Partner User: Accountant / Bookkeeper
- Manages multiple Qashivo customers through a dedicated **Partner Portal**
- Has full access to each connected client's Qashivo account PLUS cross-client analytics that individual customers cannot see
- Can take actions on behalf of clients (configurable per client — see delegation model below)
- Earns recurring commission on each active client
- Gets Qashivo **free for their own practice's business** (their own firm is a Qashivo customer at no charge)
- Partner portal is **white-labelled with the accountant's firm branding** (logo, colours, firm name)

### Secondary User: Debtor (the customer's customer)
- Receives communications from the AI agent persona (believes they are dealing with a real person)
- Interacts via email reply, SMS reply, voice call, or debtor portal
- May negotiate payment plans with the agent
- Should experience professional, branded, human-feeling communications — not robotic templates or aggressive debt collection
- Never told they are speaking to an AI (the experience must be seamless)

### Admin User: Qashivo Internal (Build Phase)
- Manage customer and partner onboarding
- Monitor platform health
- Finance panel management
- Partner commission management
- Customer support

### Future User: Bank Staff (Post-Acquisition)
- Portfolio-level dashboards (similar to partner view but across all bank customers)
- Customer risk monitoring
- Lending decision support
- Sector analytics

---

## 7A. PARTNER (ACCOUNTANT) MODEL — DETAILED SPECIFICATION

### Why This Matters
The accountant channel was initially explored as the primary go-to-market for Qashivo but proved resistant at a trade show — accountants didn't want to get drawn into credit control. The partner model resolves this: **the AI agent does the credit control work, the accountant monitors and earns commission**. The accountant doesn't need to chase invoices — they just need to recommend Qashivo to their clients and optionally oversee the results.

For the bank sale, the partner layer adds significant value: the acquiring bank gets an indirect distribution channel through accounting firms who are already trusted advisors to SMEs.

### Partner Onboarding — Two Routes

**Route 1: Top-down (accountant brings their clients)**
1. Accountant registers as a Qashivo Partner
2. Sets up their firm branding on the partner portal (logo, colours, firm name)
3. Invites clients via email link or unique referral URL
4. Client clicks link → onboarding flow pre-associates them with the accountant
5. Client completes their own setup (Xero connection, Open Banking, agent persona config)
6. Accountant immediately sees the client in their partner portal

**Route 2: Bottom-up (customer invites their accountant)**
1. Customer onboards to Qashivo independently
2. In account settings: "Invite your accountant" → enters accountant's email
3. Accountant receives invitation → registers as Partner (if not already) or accepts link
4. Client appears in accountant's partner portal
5. Client configures delegation level (see below)

**Both routes result in the same partner-client relationship.** A partner can have clients onboarded via both routes.

### Delegation Model (Configurable Per Client)

Each client connected to a partner can set one of three delegation levels:

| Delegation Level | What the Accountant Can Do | Use Case |
|-----------------|---------------------------|----------|
| **View Only** | See everything (dashboard, forecast, agent activity, debtor data) but cannot change settings, approve actions, or take any action. Advisory role only. | Client wants to manage everything themselves; accountant monitors and advises in their regular meetings. |
| **Managed** | Full access to view AND take actions: approve/reject agent escalations, adjust forecast inputs (changes dialog), configure agent settings, manage debtor overrides, activate Qapital finance. Actions logged as "taken by [accountant name] on behalf of [client]." | Client wants the accountant to actively manage their credit control and cashflow. Common for smaller businesses without a finance function. |
| **Full Delegation** | Everything in Managed, PLUS: can modify agent persona, change autonomy levels, adjust negotiation rules, manage billing/subscription. Essentially acts as the account owner. | Client fully outsources financial management to their accountant. The accountant runs Qashivo as if it were their own tool for this client. |

Default for new connections: **View Only**. Client can change at any time. Accountant can request a higher level but client must approve.

### Partner Portal — Features

**Multi-Client Dashboard**
- Overview of all connected clients in a single view
- Per-client summary cards showing: cash position, forecast outlook (traffic light), DSO, overdue AR value, agent activity status, Qapital utilisation
- Sortable and filterable by: client name, sector, risk level, DSO, overdue amount
- Alerts panel: aggregated alerts across all clients, prioritised by severity

**Cross-Client Analytics** *(Partner-exclusive — individual customers cannot see this)*
- **Portfolio DSO benchmark**: average DSO across all clients, trend over time
- **Client comparison**: ranked table of clients by DSO, collection rate, forecast accuracy, agent effectiveness
- **Sector benchmarking**: "Your recruitment clients average 42 DSO vs 38 for your manufacturing clients"
- **Debtor overlap detection**: identify debtors that appear across multiple clients (e.g., same company owes money to several of the accountant's clients — useful risk signal)
- **Revenue dashboard**: commission earned per client, total commission, projected commission
- **Aggregate cashflow view**: combined cashflow position across all clients (useful for accountants advising on group structures or related businesses)
- **Best practices identification**: which clients have the best-performing agent configurations, fastest collections, most accurate forecasts — learnings that can be applied to other clients

**Per-Client Deep Dive**
- Identical view to what the customer sees (Qollections, Qashflow, Qapital dashboards)
- Plus action capabilities based on delegation level
- Audit trail: all actions taken by the accountant are logged with timestamp and "on behalf of [client]"

**Client Management**
- Invite new clients (generate referral link or send email invite)
- View client list with status (active, pending invite, churned)
- Commission tracking per client
- Client delegation level management (view current level, request changes)

### Commercial Model

**For the accountant:**
- Partner portal: **free**
- Qashivo for their own firm: **free** (one Qashivo account for the accountant's own business at no charge, including all three pillars)
- Commission: **recurring monthly commission** per active client. Structure TBD but indicative:
  - 10–20% of client's monthly subscription fee
  - Paid monthly in arrears
  - Continues for as long as the client remains active and connected to the partner
  - Potential bonus for Qapital origination (commission on finance facilitated through partner-referred clients)

**For the client:**
- Standard Qashivo pricing applies (no markup from the accountant)
- Benefit of accountant oversight and advisory at no additional cost
- Can disconnect from accountant at any time without affecting their Qashivo account

**Why this works despite trade show resistance:**
The accountants at the trade show resisted because they didn't want to **do** credit control. This model means they don't have to. The AI agent does the work. The accountant's role is to:
1. Recommend Qashivo to their clients (earn commission)
2. Monitor client cashflow health via the partner portal (adds value to their advisory relationship)
3. Optionally manage settings for clients who want hands-off (deepens the relationship)
4. Use cross-client analytics to provide better advice ("your DSO is higher than your peers — here's what's working for my other clients")

The accountant earns revenue without getting drawn into the operational messiness of chasing invoices.

### Partner Portal Branding
- Partner portal header: accountant's firm logo and colours
- URL: can be custom subdomain if desired (e.g., `smithaccounting.qashivo.com`) or standard with firm name in header
- Client invitations sent from partner are branded with the accountant's firm
- Debtor-facing communications are NOT branded with the accountant's firm — they use the customer's own branding and the AI agent persona. The accountant is invisible to the debtor.

### Data Model — Key Entities (Partner)
```
Partner (accountant firm)
├── firm_name
├── contact_name
├── email
├── branding
│   ├── logo_url
│   ├── primary_colour
│   ├── secondary_colour
│   └── custom_subdomain (optional)
├── subscription_status (active — always free)
├── own_qashivo_account (link to their own Company entity — free tier)
├── commission_rate (percentage of client subscription)
├── commission_history[]
│   └── CommissionPayment (month, amount, client_breakdown[], status: pending/paid)
└── clients[]
    └── PartnerClientLink
        ├── client (→ Company)
        ├── delegation_level (view_only / managed / full_delegation)
        ├── connected_date
        ├── connected_via (partner_invite / client_invite)
        ├── status (active / pending_invite / disconnected)
        └── action_log[]
            └── PartnerAction
                ├── timestamp
                ├── action_type
                ├── action_detail
                └── on_behalf_of (client company name)
```

### Partner in the Multi-Tenancy Architecture
- Each partner has their own authentication and portal session
- Partner can switch between client views without re-authenticating
- **Data isolation is critical**: partner can only see data for clients explicitly connected to them. No cross-tenant data leakage.
- Cross-client analytics are computed from the partner's connected clients only — never from the full Qashivo database
- If a client disconnects from a partner, the partner immediately loses all access to that client's data
- Audit trail for all partner actions is immutable and visible to both the partner and the client

---

## 8. KEY METRICS TO TRACK (BUILD PHASE)

These metrics must be measured from day one — they are what the bank buyer evaluates:

| Metric | How Measured | Target |
|--------|-------------|--------|
| DSO reduction | Compare customer DSO before/after Qashivo adoption | 10–15 day improvement within 90 days |
| Forecast accuracy (expected scenario) | Predicted vs actual cash balance per week (retrospective) | Week 1: 95%+, Weeks 2–4: 85–90%, Weeks 5–8: 75–85%, Weeks 9–13: 65–75% |
| Forecast accuracy (scenario bracketing) | % of weeks where actual balance falls within optimistic-pessimistic range | >90% across all weeks |
| Finance uptake | % of customers who use Qapital | >30% |
| Customer retention | Monthly/annual churn rate | >90% annual retention |
| NPS | In-app survey | >50 |
| Agent response rate | % of agent communications that get debtor engagement (any channel) | >40% |
| Promise-to-pay conversion | % of contacted debtors who make a promise | >30% |
| Promise kept rate | % of promises kept on or near stated date | Track and improve |
| Agent "human" pass rate | % of debtors who believe they're dealing with a human (sampled via survey) | >80% |
| Channel effectiveness | Response rates broken down by email / SMS / voice / portal | Track and optimise |
| Voice call success rate | % of outbound calls resulting in promise or acknowledgement | >50% |
| Payment plan completion | % of agreed payment plans completed in full | >70% |
| Bad debt reduction | Write-offs before vs after Qashivo | Measurable decline |
| Time saved | Self-reported hours saved on credit control per month | >10 hours/month |
| Agent autonomy adoption | % of customers on Full Auto vs Semi-Auto vs Supervised | Track migration toward Full Auto |

---

## 8A. BANK PROOF POINTS — WHAT DRIVES THE SALE

This section explicitly maps features to the metrics a bank acquisition team evaluates. During the build phase, every development decision should be tested against: **does this contribute to proving one of these points?**

| Proof Point | What the Bank Needs to See | Which Features Prove It | Priority |
|------------|---------------------------|------------------------|----------|
| **Reduces DSO** | Measurable improvement in days-to-collect across customer base | Collections Agent, intent capture, debtor portal, tone escalation | Critical |
| **Predicts cashflow accurately** | Graduated accuracy by horizon (95%+ week 1, 85–90% weeks 2–4, declining to 65–75% weeks 9–13). Actual balance within optimistic-pessimistic range >90% of weeks. Measurably improving over time. | Bayesian forecasting engine, Open Banking integration, intent signals feeding forecast | Critical |
| **Originates lending** | Demonstrable finance activation rate from Qashflow gap detection | Qapital pre-authorisation, one-click activation, Qashflow→Qapital trigger | Critical |
| **Customers retain and engage** | >90% retention, high NPS, growing usage | All pillars, but especially Collections Agent effectiveness and Qashflow value | Critical |
| **AI quality passes as human** | Debtors believe they're dealing with a real person | Collections Agent persona quality, conversation memory, voice calls | High |
| **Compliance is demonstrable** | Audit trail, compliance gate, zero regulatory incidents | Compliance Agent, action logging, pre-delivery review | High |
| **Scales across sectors** | Works for recruitment AND at least one other sector | Manufacturing beta, cross-sector Bayesian models | High |
| **Debtor book intelligence** | Portfolio-level risk visibility that the bank can use for its loan book | Credit Risk Agent, debtor scoring, concentration analysis | Medium |
| **Partner distribution channel** | Accountants actively using the partner portal | Partner model (if built during build phase) | Medium |
| **Clean, acquirable codebase** | Well-documented, tested, API-first, multi-tenant, white-label ready | Architecture decisions, code quality, API documentation | High |

**Features that DON'T directly prove bank value (defer if scope-pressured):**
Working Capital Optimiser, Customer Health Agent, partner portal (unless accountant partner secured), advanced cross-debtor learning, international architecture

---

## 8B. UI/UX SPECIFICATION

### Platform Type
Progressive Web App (PWA) — single codebase, responsive, installable on mobile. Web-first design, mobile-optimised.

### Role-Based Home Views
| Role | Default Home View | Rationale |
|------|------------------|-----------|
| Owner | Qashflow dashboard (13-week forecast, scenarios, alerts) | Owner cares about cashflow health and the big picture |
| Finance Manager | Qashflow dashboard (same as owner) | Finance managers think in cashflow terms |
| Staff / Credit Controller | Qollections dashboard (AR overview, agent activity, debtor list) | Staff are operational — they came for credit control |
| View Only | Qashflow dashboard (read-only) | Passive monitoring of business health |
| Partner (Accountant) | Partner portal (multi-client dashboard) | See Section 7A |

### Navigation Structure
Dashboard home + sidebar navigation with sub-sections per pillar:

```
┌─────────────────────────────────────────────┐
│ HEADER: Company name / logo    [User] [⚙️]  │
├──────────┬──────────────────────────────────┤
│ SIDEBAR  │  MAIN CONTENT AREA               │
│          │                                   │
│ 🏠 Home  │  [Role-based default view]        │
│          │                                   │
│ 📋 Qollections                               │
│   ├ Dashboard                                │
│   ├ Debtors                                  │
│   ├ Invoices                                 │
│   ├ Agent Activity                           │
│   ├ Disputes                                 │
│   └ Reports                                  │
│          │                                   │
│ 📊 Qashflow                                  │
│   ├ 13-Week Forecast                         │
│   ├ Scenarios                                │
│   ├ Changes (user adjustments)               │
│   └ Accuracy Tracking                        │
│          │                                   │
│ 💰 Qapital                                   │
│   ├ Pre-Authorisation Status                 │
│   ├ Active Facilities                        │
│   ├ Activate Finance                         │
│   └ Improvement Plan                         │
│          │                                   │
│ 🤖 Agent Team                                │
│   ├ Agent Dashboard (all agents)             │
│   ├ Notifications & Alerts                   │
│   └ Compliance Log                           │
│          │                                   │
│ ⚙️ Settings                                  │
│   ├ Agent Personas                           │
│   ├ Autonomy & Rules                         │
│   ├ Integrations (Xero/OB)                   │
│   ├ Users & Roles                            │
│   ├ Billing                                  │
│   └ Partner Connection                       │
└──────────┴──────────────────────────────────┘
```

### Key Screen Descriptions

**Qollections Dashboard:** AR summary (total outstanding, overdue amount, DSO), agent activity feed (recent communications, responses, escalations), debtor list with status indicators, ageing chart, items requiring human intervention.

**Qashflow 13-Week Forecast:** Stacked bar chart (inflows green, outflows red) with cumulative balance line. Three scenario toggle (optimistic/expected/pessimistic) with shaded confidence bands. Click any week to drill into individual line items. Alerts highlighted in-line. Agent persona insights ("Morgan says: your expected cash position has improved by £5k this week because...").

**Qapital Dashboard:** Pre-authorisation status and limit. Active facilities with utilisation. One-click "Activate Finance" button when Qashflow shows a gap. Improvement plan with progress tracking for non-approved customers.

**Agent Team Dashboard:** Each agent persona shown as a card with their latest insight/alert. Activity log showing all agent actions across the system. Compliance check statistics. Items pending human approval (for Semi-Auto/Supervised autonomy levels).

---

## 8C. USER ROLES & ACCESS CONTROL

### Roles Within a Customer Account

| Role | Qollections | Qashflow | Qapital | Agent Config | Billing | User Management |
|------|------------|----------|---------|-------------|---------|-----------------|
| **Owner** | Full | Full | Full | Full | Full | Full |
| **Finance Manager** | Full | Full | Full | Full | No | No |
| **Staff / Credit Controller** | Assigned debtors only | View only | No access | No | No | No |
| **View Only** | View all | View all | View status only | No | No | No |

**Debtor assignment for Staff role:**
- Owner or Finance Manager assigns specific debtors to each Staff user
- Staff users only see their assigned debtors in Qollections
- Agent actions on assigned debtors are visible; other debtors are hidden
- Useful for larger teams: "Sarah manages A-M, John manages N-Z"

**User management:**
- Owner invites users via email and assigns roles
- Owner can change roles and remove users at any time
- All user actions are logged in the audit trail
- Each user has their own authentication (email + password, or SSO)

---

## 8D. NOTIFICATION SYSTEM

### Tiered Notification Model

| Tier | Examples | In-App | Email | SMS/Push |
|------|---------|--------|-------|----------|
| **Critical** | Cashflow gap in pessimistic scenario, compliance block, Xero sync failure, debtor legal threat, Qapital facility expiring | Always | Always | Always |
| **Important** | Agent escalation requiring approval, dispute raised, promise broken, debtor non-responsive after full sequence, forecast accuracy drift | Always | Default on (configurable) | No (unless configured) |
| **Routine** | Agent sent email, debtor acknowledged, payment received, promise made, new invoice synced | Always | No (unless configured) | No |
| **Informational** | Agent persona insights, weekly summary, forecast updated, compliance checks passed | Always | Weekly digest (configurable) | No |

**Configuration:**
- Users can configure notification preferences per tier and per channel in Settings
- Critical tier cannot be disabled (always pushed)
- Each internal agent delivers its notifications in-persona: "Alex (Risk Analyst) has flagged..." / "Morgan (Cashflow Analyst) says..."
- Partner notifications: partner receives Important and Critical alerts for their connected clients

---

## 8E. BILLING & SUBSCRIPTION

### Build Phase Billing
- **Payment processing**: Stripe (subscription management, card payments, invoicing)
- **Subscription tiers**: As per Section 13 pricing, managed via Stripe
- **Usage-based charges**: Voice call minutes and SMS messages billed as add-ons above base subscription. Tracked in Qashivo, billed via Stripe.
- **Upgrade/downgrade**: Self-service via Settings. Pro-rated billing.
- **Failed payments**: Stripe handles retries. After 3 failures, account enters grace period (7 days). Service continues but alerts shown. After grace period, account moves to read-only (can view data but agents pause).

### Partner Commission
- **Tracking**: Custom commission tracking within Qashivo (Stripe doesn't natively handle partner commission)
- **Calculation**: Percentage of client's monthly subscription fee (rate set per partner agreement, indicative 10-20%)
- **Payout**: Monthly in arrears. Can be via Stripe Connect (automated) or manual bank transfer during build phase.
- **Dashboard**: Partner sees commission earned per client, total monthly, projected annual, payout history

---

## 8F. DATA RETENTION & DELETION

### Retention Policy
- **Standard retention**: 7 years from creation/last activity (aligned with UK business record retention requirements)
- **Applies to**: All data — conversation history, voice recordings, transcripts, intent signals, invoices, payment records, agent action logs, compliance audit trail, forecast history
- **Voice recordings**: Stored securely (encrypted at rest) for 7 years. Large storage requirement — consider tiered storage (hot for 12 months, cold archive thereafter).

### Customer Churn
- When a customer cancels: account enters read-only state. Data retained for 7 years from cancellation date.
- Customer can request data export at any time (GDPR right to portability)
- Customer can request deletion (GDPR right to erasure) — Qashivo deletes all data except what is legally required to retain (e.g., financial records, compliance audit trail). Deletion request logged.

### Debtor Data
- Debtor data (contact details, conversation history, intent signals) retained as part of the customer's records for 7 years
- If a debtor exercises GDPR rights directly with Qashivo: consult legal. The data is processed under the customer's legitimate interest, not Qashivo's. Typically the customer (data controller) decides.

### Partner Data
- If partner disconnects from a client: partner loses access immediately. Client data remains with the client.
- If partner account closes: all partner-level data (commission records, analytics) retained for 7 years. Client accounts are unaffected.

---

## 8G. EDGE CASES & EXCEPTION HANDLING

| Scenario | Handling |
|----------|---------|
| **Xero sync fails mid-way** | Retry with exponential backoff. Alert customer if failure persists >1 hour. Agents continue working with last-synced data. Forecast shows "data may be stale" warning. |
| **Invoice voided in Xero while collections active** | Immediately pause all agent activity for that invoice. Flag for human intervention. Agent does not send any further communications about the voided invoice. |
| **Debtor disputes invoice amount** | Orchestrator pauses collections. Dispute Resolution Agent engages to gather details, OR debtor self-resolves via portal. Amount disputes always flagged for human commercial decision — agent gathers info but does not agree to changes. |
| **Payment reversed after being recorded** | Alert customer immediately (Critical notification). Re-open the invoice in Qollections. Collections Agent resumes but with context: "We noticed the payment was reversed..." |
| **Same debtor appears across multiple Qashivo customers** | Each customer's data is isolated. No cross-tenant data sharing. If a partner has both customers, debtor overlap detection in partner analytics is based on name/company matching only. |
| **AI voice call hits voicemail** | Configurable per customer: leave a brief message asking debtor to call back (logged as attempted with voicemail), or hang up and retry later (logged as no answer). |
| **AI voice quality insufficient** | Fallback: system schedules a call task for the customer's human team instead. Logged as "voice call deferred to human." Customer can toggle voice AI on/off. |
| **Open Banking not connected** | Product works in degraded mode. Qollections fully functional. Qashflow uses Xero payment dates as proxy (lower accuracy, clearly communicated). Bayesian models cannot be trained — forecast shows wider uncertainty bands. Prompt user to connect Open Banking for improved accuracy. |
| **Debtor in different timezone** | Agent respects business hours in the debtor's timezone (detected from debtor address/country or configurable). No calls or SMS outside 8am-7pm debtor local time. |
| **Multiple contacts at same debtor company** | Debtor profile supports multiple contacts. Agent can be configured to contact the primary contact, escalate to a secondary, or contact accounts payable directly. |
| **Customer has no historic payment data (new business)** | Bayesian models use uninformative priors (industry average payment times for the sector). Models improve rapidly as first payments are observed via Open Banking. |
| **LLM generates inappropriate content** | Compliance Agent (rule-based in v1) catches known patterns. If content passes compliance but customer reports an issue: logged, reviewed, compliance rules updated. |

---

## 8H. QAPITAL — DETAILED USER FLOW

### Finance Activation Flow (One-Click Model)

```
1. ONBOARDING: Customer completes Qapital pre-authorisation
   → Company financials assessed (via Xero data + credit reference)
   → Debtor book quality scored (via Credit Risk Agent)
   → Result: Approved (with limit) or Declined (with improvement plan)
   → Pre-authorisation auto-populates finance application data

2. TRIGGER: Qashflow detects cashflow gap
   → Forecasting Agent: "You have a projected gap of £15,000 in week 8"
   → If customer is pre-approved: "You can cover this with your Qapital facility"
   → Dashboard shows: [Activate Finance] button with pre-filled details

3. ACTIVATION: Customer clicks [Activate Finance]
   → Selects which invoices to finance (selective IF) or confirms whole-ledger
   → Pre-authorisation data auto-populates the application — no forms to fill
   → One-click submission to finance provider
   → Provider confirms advance (target: same day for pre-approved customers)

4. FUNDING: Finance provider advances funds
   → Typically 80-90% of invoice value
   → Funds appear in customer's bank account
   → Qashivo tracks: facility utilisation, advance amount, fees

5. SETTLEMENT: Debtor pays the invoice
   → Payment detected via Open Banking, confirmed by Xero allocation
   → Finance provider deducts advance + fees from settlement
   → Remainder transferred to customer
   → Qashivo updates: facility utilisation reduced, forecast adjusted
```

### For Non-Approved Customers
- Qapital dashboard shows: "Not currently eligible. Here's how to improve:"
- Improvement plan with specific actions (reduce debtor concentration, resolve disputes, improve credit score)
- Progress tracked by Credit Risk Agent
- Automatic re-assessment when conditions improve
- Customer Health Agent (when built) nudges: "You're 2 actions away from Qapital eligibility"

---

## 8I. INTERNATIONALISATION APPROACH

### Principle: UK-First, Architected for Multi-Country

Build for the UK market but ensure nothing in the architecture prevents future internationalisation. Specific considerations:

**Architecture from day one:**
- All monetary amounts stored with currency code (never assume GBP)
- Date/time always stored as UTC with timezone metadata
- All user-facing strings externalisable (i18n-ready, even if only English at launch)
- Tax calculation logic abstracted into country-specific modules (UK tax rules in a UK module, not hardcoded)
- Regulatory/compliance rules abstracted per jurisdiction (UK compliance rules in a UK module)
- Debtor timezone awareness for communication scheduling

**UK-specific but modular:**
- HMRC PAYE, VAT, Corp Tax calculations in a UK tax module
- Late Payment of Commercial Debts Act compliance in a UK legal module
- Open Banking via UK-specific AISP providers (but the integration layer is provider-agnostic)
- FCA regulatory requirements in a UK regulatory module

**Post-acquisition expansion** (bank's responsibility but architecture supports it):
- Add new country modules (tax, legal, regulatory)
- Add new accounting platform integrations (e.g., DATEV for Germany)
- Add new Open Banking providers per country
- Multi-language support for agent communications and debtor portal
- Multi-currency forecasting in Qashflow

---

## 9. DEBTOR PORTAL — DETAILED SPEC

The debtor portal is one of several channels through which the AI Collections Agent captures intent. It must be:
- **Frictionless**: No login, no registration. Accessed via unique tokenised URL.
- **Branded**: Shows the Qashivo customer's logo, colours, AND the **agent persona** (e.g., "Your account is managed by Sarah Mitchell, Credit Controller").
- **Mobile-first**: Most debtors will open on mobile from an email/SMS link.
- **Conversational**: Includes a chat widget where the debtor can message the AI agent directly.

### Portal Flow
1. Debtor receives email/SMS from the AI agent persona with link: "Hi John, you have 3 outstanding invoices. View and respond here →"
2. Link opens branded portal showing:
   - Company header (logo, name)
   - Agent persona introduction: "I'm Sarah Mitchell, your point of contact for payments. How can I help?"
   - List of outstanding invoices (number, date, due date, amount, status)
   - For each invoice, action buttons:
     - ✓ **Acknowledge** (one click — "I confirm receipt of this invoice")
     - 📅 **Promise to Pay** (date picker — "I will pay on [date]")
     - ⚠️ **Dispute** (text field — "There is an issue with this invoice")
     - 💳 **Pay Now** (redirect to payment gateway)
     - 📋 **Request Payment Plan** (opens form; agent may counter-propose within configured rules)
   - **Chat widget** (bottom-right): "Message Sarah" — opens conversational interface with the AI agent. Debtor can ask questions, explain delays, negotiate. Agent responds in real-time.
3. After action, debtor sees confirmation and can take action on remaining invoices
4. All actions create IntentSignal records that immediately feed Qashflow
5. Chat conversations are stored in the debtor's ConversationHistory alongside email/SMS/voice

### Security
- Token expires after X days (configurable, default 30)
- Token is per-debtor, not per-invoice (shows all outstanding invoices)
- Rate limiting on portal access
- No sensitive financial data shown (just invoice numbers and amounts)
- Chat widget rate-limited to prevent abuse

---

## 10. AI AGENT BEHAVIOUR — EXAMPLES & DECISION LOGIC

### How the Agent Decides What to Do Next

The AI Collections Agent does NOT follow a fixed sequence. It makes autonomous decisions based on a decision framework. However, a **default strategy** is seeded for each debtor based on their historic payment profile, and the agent adapts from there.

### Default Strategy (New Debtor, No History)
```
Day -7:  Email (Friendly) — Pre-due courtesy reminder
Day 0:   Email (Friendly) — Due date notification  
Day +3:  Email (Professional) — Gentle follow-up with portal link
Day +7:  SMS (Professional) — "Hi [Name], just checking in on invoice #1234. Can you confirm a payment date?"
Day +10: Email (Professional) — Follow-up referencing SMS
Day +14: AI Voice Call (Firm) — Outbound call to discuss payment. Capture promise.
Day +21: Email (Firm) — Written follow-up on call / escalation warning
Day +30: Letter PDF (Formal) — Formal notice  
Day +30: Alert to customer — Human intervention recommended
Day +45: Letter PDF (Legal) — Letter before action (if customer has enabled)
```

### Agent Adaptation Examples

**Debtor who responds to SMS but ignores emails:**
```
Agent learns: SMS response rate 80%, email response rate 10%
Agent adapts: Shifts to SMS as primary channel, uses email only for formal documentation
Next action: SMS → "Hi John, quick reminder about the £5,200 outstanding. When can we expect payment?"
```

**Debtor who always pays after a phone call:**
```
Agent learns: 3 of last 4 payments made within 48hrs of voice call
Agent adapts: Skips email escalation, schedules voice call earlier in sequence
Next action: Voice call at Day +7 instead of Day +14
```

**Previously reliable debtor who's suddenly late:**
```
Agent learns: This debtor has paid on time for 12 months, now 10 days late
Agent adapts: Keeps tone at Friendly (not Professional), assumes temporary issue
Next action: Email → "Hi John, this is unusual for you — is everything okay? Just wanted to check in about invoice #1234."
```

**Serial late payer who always promises and breaks promises:**
```
Agent learns: promise_reliability = 0.2 (kept 1 of 5 promises)
Agent adapts: Escalates tone faster, emphasises consequences earlier, shorter intervals
Agent notes in conversation: "I notice we've discussed this invoice a few times now. I'd really appreciate if we could resolve this today."
```

### Conversational Email Example (Agent → Debtor)

**Outbound (Day +7, Professional tone):**
```
Subject: Invoice #4567 — Payment Update Needed

Hi John,

I hope you're well. I'm following up on invoice #4567 for £3,200, 
which was due on 28 February.

I sent a reminder last week but haven't heard back yet. Could you 
let me know when we can expect payment? If there's an issue with 
the invoice, I'm happy to help resolve it.

You can reply to this email, or use this link to confirm a payment 
date: [portal link]

Thanks,
Sarah Mitchell
Credit Controller
ABC Recruitment Ltd
```

**Debtor replies:**
```
Hi Sarah, sorry about that. We've had some internal processing 
delays. Should be able to get it paid by next Wednesday.
```

**Agent response (automatic, same thread):**
```
Hi John,

No problem at all — I understand these things happen. I've noted 
Wednesday 19th March as the expected payment date for invoice #4567.

I'll check back in then. If anything changes in the meantime, just 
let me know.

Thanks,
Sarah
```

**Behind the scenes:** Agent extracts promise-to-pay signal (date: 19 March, source: email, confidence: 0.7 based on debtor history). IntentSignal created. Qashflow forecast updated. Agent schedules follow-up for 20 March if payment not received.

### Voice Call Example Flow

**Agent calls debtor:**
```
Agent: "Hello, could I speak to John please? ... Hi John, it's Sarah 
Mitchell calling from ABC Recruitment. How are you? ... I'm calling 
about a couple of outstanding invoices. I know invoice 4567 for 
£3,200 was due back on the 28th of February. I just wanted to check 
in and see when we might be able to get that settled?"

[Debtor responds]

Agent: "That's great, so you're saying the 19th of March? Perfect, 
I'll make a note of that. And just while I've got you, there's also 
invoice 4589 for £1,800 that's coming up for payment on the 15th — 
is that one tracking okay on your side?"

[Debtor responds]

Agent: "Brilliant. Thanks John, I really appreciate that. I'll drop 
you an email confirming what we've agreed. Have a good day."
```

**Behind the scenes:** Full transcript stored. Two IntentSignals created (promise for #4567, acknowledgement for #4589). Agent sends confirmation email in the same persona. Voice call outcome logged.

### Payment Plan Negotiation Example

**During voice call or email conversation:**
```
Debtor: "I can't pay the full £8,000 right now. Could we split it?"

Agent checks rules: max_instalments=3, min_instalment=£500
Agent: "I understand, John. I can offer a payment plan — would three 
monthly payments of £2,667 work for you? The first would be due on 
the 1st of April."

Debtor: "Could we do four payments instead?"

Agent checks rules: max_instalments=3, four exceeds limit
Agent: "I'd need to check that with my manager. Let me get back to 
you by end of day tomorrow — in the meantime, shall I set up the 
three-payment option as a backup?"
```

**Behind the scenes:** If within rules → PaymentPlan created (auto_approved), instalments scheduled, tracking begins. If outside rules → flagged for human approval, customer notified.

### Escalation Rules (Agent-Driven)
- Agent continuously evaluates whether current strategy is working
- If response rate for a debtor drops below threshold: agent tries alternative channel
- If debtor acknowledges but doesn't promise: agent follows up within 3 days via different channel
- If debtor promises but misses date: agent contacts next business day, tone increases one level, references broken promise
- If debtor disputes: agent pauses collection, captures dispute details, alerts customer for resolution
- If debtor requests human: agent immediately flags for handover, provides full context to customer
- If no engagement after exhausting all channels: agent recommends human intervention or collections referral

---

## 11. QASHFLOW BAYESIAN MODEL — TECHNICAL DETAIL

### Overview
The forecast engine uses Bayesian updating: each line item starts with a prior (historical pattern or reasonable default) and updates to a posterior as new evidence arrives. The three scenarios (optimistic/expected/pessimistic) are derived from the posterior distribution percentiles.

### Training Data Sources (Reminder — see Section 5A)
```
Payment timing models (debtor + supplier): trained on OPEN BANKING data
  → Triggered/confirmed by accounting platform allocation
  → Accounting platform data is NEVER in the training pipeline

Agent effectiveness models: trained on QASHIVO INTERACTION DATA
  → Communications, intent signals, outcomes

Recurring pattern detection: trained on OPEN BANKING transaction data
  → Payroll, rent, loans, subscriptions auto-detected from bank patterns
```

**Runtime inputs vs training data in the code below:**
The prediction functions below reference `invoice.due_date`, `bill.amount`, `bill.due_date`, and similar fields sourced from the accounting platform. These are **runtime inputs** — static facts used as reference coordinates in a prediction calculation. They are not training observations. The model's learned parameters (prior_mean, prior_std, etc.) come exclusively from Open Banking. The accounting platform data tells the model *what to predict about* (this invoice, due on this date); the Open Banking data taught the model *how to predict* (this debtor typically pays X days late).

### AR Inflow Prediction (Per Invoice)

```python
# Each outstanding invoice gets a predicted payment week and amount distribution

def predict_invoice_payment(invoice, debtor_model, intent_signals):
    
    # START WITH PRIOR from debtor's Bayesian payment model
    prior_mean = debtor_model.posterior_mean_days_to_pay  # e.g., 8 days late
    prior_std = debtor_model.posterior_std_dev             # e.g., 4 days
    
    # UPDATE WITH INTENT SIGNALS from Qollections
    latest_signal = get_latest_intent_signal(invoice)
    
    if latest_signal.type == 'promise_to_pay':
        # Strong evidence — shift distribution toward promised date
        promised_days = (latest_signal.promise_date - invoice.due_date).days
        likelihood_mean = promised_days
        likelihood_std = 3.0 * (1 - debtor_model.promise_reliability)
        # Low reliability → wide likelihood (don't trust the promise much)
        # High reliability → narrow likelihood (trust the promise)
    
    elif latest_signal.type == 'acknowledge':
        # Mild positive evidence — debtor is engaged
        likelihood_mean = prior_mean * 0.85  # slightly earlier than historic
        likelihood_std = prior_std * 0.9      # slightly less uncertain
    
    elif latest_signal.type == 'dispute':
        # Remove from forecast until resolved
        return { predicted_week: None, amount: 0, confidence: 0, reason: 'disputed' }
    
    elif latest_signal is None and invoice.is_overdue:
        # No response + overdue — negative evidence
        days_overdue = (today - invoice.due_date).days
        likelihood_mean = prior_mean + (days_overdue * 0.5)  # shifts later
        likelihood_std = prior_std * (1 + days_overdue * 0.05)  # widens
    
    else:
        # No signal, within terms — use prior as-is
        likelihood_mean = prior_mean
        likelihood_std = prior_std
    
    # BAYESIAN UPDATE: combine prior and likelihood
    posterior_mean, posterior_std = bayesian_normal_update(
        prior_mean, prior_std, likelihood_mean, likelihood_std
    )
    
    # CONVERT TO WEEKLY BUCKET
    predicted_payment_date = invoice.due_date + timedelta(days=posterior_mean)
    predicted_week = get_week_bucket(predicted_payment_date)
    
    # SCENARIOS from posterior distribution
    optimistic_date = invoice.due_date + timedelta(days=percentile(posterior, 0.10))
    pessimistic_date = invoice.due_date + timedelta(days=percentile(posterior, 0.90))
    
    return {
        predicted_week_expected: get_week_bucket(predicted_payment_date),
        predicted_week_optimistic: get_week_bucket(optimistic_date),
        predicted_week_pessimistic: get_week_bucket(pessimistic_date),
        amount: invoice.outstanding_amount,
        confidence: 1.0 / (1.0 + posterior_std),  # normalised confidence score
    }
```

### AP Outflow Prediction (Per Bill/Supplier)

```python
# Mirror of AR model but for outgoing payments to suppliers

def predict_supplier_payment(bill, supplier_model):
    
    # PRIOR from supplier payment model (how quickly WE pay this supplier)
    prior_mean = supplier_model.posterior_mean_days_to_pay_after_bill
    prior_std = supplier_model.posterior_std_dev
    
    # EVIDENCE
    if bill.status == 'approved' or bill.status == 'scheduled':
        # Bill approved for payment — high confidence
        if bill.scheduled_date:
            return {
                predicted_week: get_week_bucket(bill.scheduled_date),
                amount: bill.amount,
                confidence: 0.95,
                scenario_spread: 'narrow'  # almost certain
            }
        else:
            # Approved but no specific date — use prior but tighter
            likelihood_mean = prior_mean * 0.8
            likelihood_std = prior_std * 0.5
    
    elif bill.due_date:
        # Bill has a due date — we'll likely pay around then
        likelihood_mean = (bill.due_date - bill.date).days
        likelihood_std = prior_std
    
    else:
        # Use historic pattern
        likelihood_mean = prior_mean
        likelihood_std = prior_std
    
    posterior_mean, posterior_std = bayesian_normal_update(
        prior_mean, prior_std, likelihood_mean, likelihood_std
    )
    
    predicted_date = bill.date + timedelta(days=posterior_mean)
    
    return {
        predicted_week_expected: get_week_bucket(predicted_date),
        amount: bill.amount,
        confidence: 1.0 / (1.0 + posterior_std),
    }
```

### Recurring Outflow Prediction

```python
# For detected recurring patterns (payroll, rent, loans, subscriptions, etc.)

def predict_recurring_payment(pattern, user_adjustments):
    
    # Pattern already detected from Open Banking with high confidence
    base_amount = pattern.amount_mean
    base_std = pattern.amount_std_dev
    next_date = calculate_next_occurrence(pattern)
    
    # Apply user adjustments (e.g., "hiring 2 people, +£6,000/month from April")
    for adj in user_adjustments:
        if adj.affects_category == pattern.category and adj.is_active:
            if adj.timing_type == 'recurring_monthly':
                base_amount += adj.amount
            elif adj.timing_type == 'one_off' and adj.date in pattern.next_week:
                base_amount += adj.amount  # one-off addition
    
    return {
        predicted_week: get_week_bucket(next_date),
        amount_expected: base_amount,
        amount_optimistic: base_amount - base_std,  # could be slightly less
        amount_pessimistic: base_amount + base_std,  # could be slightly more
        confidence: pattern.confidence_score,
    }
```

### Tax Payment Prediction

```python
def predict_tax_payment(tax_type, company):
    
    if tax_type == 'VAT':
        # Check Xero for filed/draft VAT return
        vat_return = get_latest_vat_return(company)  # static data from Xero
        if vat_return and vat_return.status in ('filed', 'draft'):
            amount = vat_return.amount
            due_date = vat_return.due_date  # quarter end + 1 month + 7 days
            confidence = 0.9 if vat_return.status == 'filed' else 0.75
        else:
            # Estimate from prior quarter or historic Open Banking pattern
            amount = estimate_from_history(company, 'vat')
            due_date = next_vat_due_date(company)
            confidence = 0.5
    
    elif tax_type == 'PAYE':
        # Estimate from detected payroll
        payroll_pattern = get_pattern(company, 'payroll')
        if payroll_pattern:
            monthly_paye = payroll_pattern.amount_mean * 0.35  # ~35% as starting prior
            # Refine with actual HMRC payments from Open Banking
            actual_paye_payments = get_open_banking_payments(company, payee_contains='HMRC')
            if actual_paye_payments:
                monthly_paye = bayesian_update(monthly_paye, actual_paye_payments)
            due_date = next_paye_due_date()  # 22nd of following month
            confidence = 0.7
        else:
            monthly_paye = user_input_or_zero()
            confidence = 0.3
    
    elif tax_type == 'CORP_TAX':
        # Annual payment — use prior year from Open Banking or user input
        prior_payment = get_open_banking_payments(company, payee_contains='HMRC', annual=True)
        if prior_payment:
            amount = prior_payment.amount  # prior year as estimate
        else:
            amount = get_user_estimate(company, 'corp_tax')
        due_date = corp_tax_due_date(company)  # 9 months + 1 day after year end
        confidence = 0.5  # annual estimates are inherently less certain
    
    return { amount, due_date, confidence, tax_type }
```

### Weekly Aggregation

```python
def generate_forecast(company):
    opening_balance = get_open_banking_balance(company)
    forecast_weeks = []
    cumulative = opening_balance
    
    for week in next_13_weeks():
        # Collect all inflow predictions for this week
        inflows = (
            [predict_invoice_payment(inv, ...) for inv in outstanding_invoices 
             if predicted_week == week]
            + [user_entered_inflows for week]
            + [detected_adhoc_income for week]
        )
        
        # Collect all outflow predictions for this week
        outflows = (
            [predict_supplier_payment(bill, ...) for bill in outstanding_bills
             if predicted_week == week]
            + [predict_recurring_payment(p, ...) for p in detected_patterns
               if next_occurrence_in(week)]
            + [predict_tax_payment(t, ...) for t in upcoming_taxes
               if due_in(week)]
            + [user_entered_outflows for week]
        )
        
        # Calculate three scenarios
        optimistic = {
            inflows: sum(item.amount_optimistic for item in inflows),
            outflows: sum(item.amount_expected for item in outflows),  # outflows don't get optimistic
        }
        expected = {
            inflows: sum(item.amount_expected for item in inflows),
            outflows: sum(item.amount_expected for item in outflows),
        }
        pessimistic = {
            inflows: sum(item.amount_pessimistic for item in inflows),
            outflows: sum(item.amount_pessimistic for item in outflows),  # include risk items
        }
        
        for scenario in [optimistic, expected, pessimistic]:
            scenario.net = scenario.inflows - scenario.outflows
            scenario.cumulative = cumulative + scenario.net
        
        cumulative = expected.cumulative  # carry forward expected for next week
        
        forecast_weeks.append(ForecastWeek(
            week_starting=week.start,
            scenarios={ optimistic, expected, pessimistic },
            inflow_items=inflows,
            outflow_items=outflows,
            alerts=check_alerts(optimistic, expected, pessimistic, company),
        ))
    
    return Forecast(
        generated_at=now(),
        opening_cash_balance=opening_balance,
        weeks=forecast_weeks,
    )
```

### Bayesian Update Function

```python
def bayesian_normal_update(prior_mean, prior_std, likelihood_mean, likelihood_std):
    """
    Conjugate normal-normal Bayesian update.
    Combines prior belief with new evidence to produce posterior.
    """
    prior_precision = 1.0 / (prior_std ** 2)
    likelihood_precision = 1.0 / (likelihood_std ** 2)
    
    posterior_precision = prior_precision + likelihood_precision
    posterior_mean = (
        (prior_mean * prior_precision + likelihood_mean * likelihood_precision) 
        / posterior_precision
    )
    posterior_std = (1.0 / posterior_precision) ** 0.5
    
    return posterior_mean, posterior_std
```

### How the Forecast Improves Over Time
- **Week 1**: Prior is based on sparse data (maybe no Open Banking history yet). Wide uncertainty bands. Recurring patterns not yet detected. Scenario bracketing will be wide but should still capture actuals.
- **Week 4**: Open Banking has 4 weeks of data. Major recurring patterns detected (payroll, rent). Debtor models still sparse but some intent signals captured. Expected scenario accuracy for weeks 1–2 approaching 85%+.
- **Week 12**: 3 months of data. Debtor models have multiple payment observations. Recurring patterns confirmed. Tax estimates refined. Expected scenario accuracy at 4-week horizon reaching 85–90%. Scenario bracketing >90%.
- **Month 6+**: Rich debtor models with seasonal awareness. Agent interaction data improving predictions. Expected scenario accuracy meeting graduated targets across all horizons. Pessimistic scenario becomes genuinely informative rather than just "everything goes wrong." Scenario bracketing consistently >90% — the forecast is a reliable planning tool.

---

## 12. MVP SCOPE (BUILD PHASE — WHAT TO BUILD FIRST)

**Critical principle:** LLM-generated communications from day one. This is the core innovation. There are no templates — every email, SMS, and voice call is generated by the LLM in the agent's persona voice, contextualised with debtor history and conversation memory. If it reads like a template, it's wrong.

**Agent prioritisation:** 6 core agents built during the build phase (Orchestrator, Collections, Credit Risk, Forecasting, Dispute Resolution, Compliance). Debt Recovery added as scope permits. Working Capital Optimiser, Onboarding Agent, and Customer Health Agent deferred to post-sale unless time and budget allow.

### MVP v1 (Months 1–3): Collections Agent + Onboarding Agent + Core Infrastructure
**Agents active:** Collections (1), Onboarding (7), Compliance (9 — rule-based), Orchestrator (0 — basic routing)

- Xero integration (invoice sync, payment sync, contact sync)
- Open Banking connection (balance, transaction history — begin pattern detection)
- Debtor profiles and invoice management
- **AI agent persona setup** (name, title, email signature, branding)
- **Collections Agent email capability**: LLM-generated outbound emails in persona voice with tone control. Every email unique, contextual, and persona-consistent.
- **Inbound email handling**: agent reads and responds to debtor email replies conversationally
- Debtor portal (acknowledge, promise-to-pay, dispute, pay now, request payment plan)
- **Intent extraction from all channels** (email replies, portal actions) — NLP-based promise/acknowledge/dispute detection
- **Compliance Agent (rule-based)**: checks all outbound emails against rules (frequency caps, time-of-day, prohibited language patterns, data leakage). Blocks and flags violations.
- Ageing report and DSO tracking
- User dashboard with agent activity log
- **Autonomy controls**: Semi-Auto (default) and Supervised modes
- Default strategy seeding for new debtors (based on sector defaults; no Open Banking history yet for new customers)
- **User roles**: Owner, Finance Manager, Staff, View Only. Owner invites and assigns.
- **Stripe billing integration**
- Role-based home views (Owner/FM → cashflow placeholder; Staff → Qollections dashboard)
- **Onboarding Agent ("Riley")**: Conversational setup assistant guiding customers through Xero connection, Open Banking authorisation, agent persona creation (name, voice, email), communication preferences, autonomy level selection, debtor import review, and Qapital eligibility check. Answers questions during setup ("What's Open Banking? Is it safe?"). Adapts to customer's pace. Hands off to Customer Health Agent (when built) or goes dormant after onboarding complete. Can be re-invoked for new integrations or major config changes.

### MVP v2 (Months 3–6): Qashflow + SMS + Agent Intelligence
**Agents added:** Forecasting (3), Credit Risk (2)

- **Bayesian forecasting engine**: 13-week forecast covering inflows AND outflows
- Open Banking payment data now feeding debtor payment models (two-signal reconciliation active)
- Recurring pattern detection from Open Banking (payroll, rent, loans, subscriptions)
- User changes dialog (capex, hiring, revenue changes — with expiry)
- Three scenarios (optimistic/expected/pessimistic)
- Forecast visualisation (stacked bar chart + cumulative line + scenario toggle)
- Forecasting Agent persona on dashboard: explains changes in plain English
- Cashflow gap alerts + Qapital trigger (prompt only — Qapital not yet active)
- Forecast vs actual tracking
- **SMS outbound and inbound** (Collections Agent sends and responds conversationally)
- **Agent adaptive strategy**: agent begins learning per-debtor channel preferences and payment patterns
- **Tone escalation engine**: progressive escalation with configurable timelines
- **Full Auto autonomy mode** available
- **Portal chat widget**: debtor can message Collections Agent from portal
- **Credit Risk Agent**: debtor scoring, concentration risk monitoring, deterioration detection
- **Tiered notification system** (critical/important/routine/informational)

### MVP v3 (Months 6–9): Qapital + Voice + Disputes + Recovery
**Agents added:** Dispute Resolution (4), Debt Recovery (6)

- **Qapital pre-authorisation**: credit assessment at onboarding, continuous update from Qollections/Qashflow data
- Finance panel referral workflow (3–5 providers)
- **One-click finance activation**: pre-authorisation auto-populates application, Qashflow gap → activate button
- Improvement guidance for non-approved customers
- Finance utilisation tracking
- **AI Voice outbound calls**: Collections Agent makes calls using configured persona voice. Voicemail handling configurable.
- **Human fallback for voice**: if quality insufficient or customer prefers, system schedules call task for customer's team instead
- **Voice intent extraction**: real-time transcript → intent signals
- **Payment plan negotiation**: Collections Agent negotiates within customer-configured rules across all channels
- **Letter/PDF generation**: formal letters for late-stage escalation
- **Dispute Resolution Agent**: separate persona (e.g., "James Cooper"), handles disputes handed off by Orchestrator. Gathers info, debtor can self-resolve via portal, amount disputes flagged for human decision.
- **Debt Recovery Agent**: separate formal persona (e.g., "David Clarke"), handles post-collections escalation. Formal demands, statutory interest, pre-legal.
- Orchestrator upgraded: full handoff management between Collections → Dispute Resolution → Debt Recovery

### MVP v4 (Months 9–12): Polish, Scale & Sale-Readiness
- QuickBooks integration
- Advanced forecasting (seasonal patterns, trend analysis, AP outflow prediction refinement)
- **Cross-debtor learning**: agent applies patterns from similar debtors/segments
- **Agent performance dashboard**: channel effectiveness, tone analysis, negotiation success rates
- Comprehensive reporting suite
- Debtor assignment for Staff users
- **Full API documentation** (for bank buyer due diligence)
- **White-label theming engine** (for bank deployment readiness)
- **Compliance audit trail** (every agent action logged with reasoning — upgrade Compliance Agent to LLM-assisted)
- **Partner portal** (lightweight: dashboard + client list + commission tracking) — **only if accountant partner secured**
- Usage-based billing for voice and SMS via Stripe
- Data export capability (for due diligence)
- Performance metrics packaging (DSO reduction evidence, forecast accuracy history, customer case studies)

### Deferred to Post-Sale
- Working Capital Optimiser Agent
- Customer Health Agent
- Full partner portal (cross-client analytics, benchmarking, full delegation)
- Inbound voice call handling
- International expansion (multi-currency, multi-country tax/compliance modules)
- Advanced Qapital products (asset finance, trade finance, R&D tax credit lending)

---

## 13. PRICING (BUILD PHASE — DIRECT SaaS)

| Tier | Monthly Price | Includes |
|------|--------------|----------|
| Qollections Starter | £99–£149/mo | Credit control automation, debtor portal, basic reporting. Up to 50 active debtors. |
| Qollections + Qashflow | £249–£399/mo | Full AR management + 13-week forecast. Up to 200 active debtors. |
| Full Qashivo | £499–£799/mo | All three pillars including Qapital pre-authorisation. Unlimited debtors. |
| Qapital commission | 0.5% of funded invoices | Earned from finance provider on successful referral |

**Usage-based add-ons (from MVP v4):**
| Add-on | Price | Notes |
|--------|-------|-------|
| AI Voice calls | £0.15–0.25/minute | Outbound calls via AI voice agent |
| SMS messages | £0.04–0.08/message | Outbound + inbound SMS |
| Additional voice minutes bundle | £25/mo for 200 minutes | Discounted bundle |

Target: average revenue per customer of ~£350/month by end of Year 1 (base subscription + usage).

---

## 14. TARGET CUSTOMER PROFILE (BUILD PHASE)

### Ideal Customer: UK Recruitment Agency
- Annual turnover: £1m–£10m
- 50–500 active debtors
- Places temporary/contract workers
- Pays workers weekly; clients pay in 30–90 days
- Currently chases invoices manually or with basic accounting software features
- May or may not already use invoice finance
- Pain: spending >10 hours/month on credit control; regularly has cashflow gaps

### Secondary Customer: UK Manufacturer
- Annual turnover: £2m–£20m
- 20–200 active debtors
- Long payment cycles (60–90+ days)
- High working capital needs (materials, labour before payment)
- Pain: unpredictable cashflow, difficulty planning investment

---

## 15. COMPETITIVE LANDSCAPE

| Company | Credit Control | AI Agent | Cashflow Forecast | Finance | Integrated Loop | Acquired? |
|---------|---------------|----------|-------------------|---------|-----------------|-----------|
| Chaser | ✓ Automation | ✗ Templates only | ✗ | ✗ | ✗ | No |
| Kolleno | ✓ Automation | ✗ Templates only | ✗ | ✗ | ✗ | No |
| Fluidly | ✗ | ✗ | ✓ Strong | ✗ | ✗ | Yes (OakNorth) |
| Kriya | ✗ | ✗ | ✗ | ✓ Strong | ✗ | Yes (Allica) |
| Triver | ✗ | ✗ | ✗ | ✓ Strong | ✗ | No |
| Float | ✗ | ✗ | ✓ Good | ✗ | ✗ | No |
| Xero/QB built-in | Basic | ✗ | Basic | Marketplace | ✗ | N/A |
| **QASHIVO** | **✓ Strong** | **✓ Autonomous AI persona with voice** | **✓ AI-driven** | **✓ Pre-approved** | **✓ Full loop** | **Building** |

Key differentiators vs nearest competitors (Chaser, Kolleno): They offer template-based automation — preconfigured email sequences that fire on a schedule. Qashivo offers an **autonomous AI agent** that thinks, adapts, converses across channels including voice, negotiates payment plans, and builds relationships with debtors. The gap is automation vs intelligence.

---

## 16. REGULATORY CONSIDERATIONS

- **FCA**: If Qashivo introduces customers to regulated finance products, it likely needs FCA authorisation as a credit broker (or appointed representative status). Consult regulatory lawyer.
- **Open Banking**: To access bank data via AIS, need to be an authorised AISP or partner with one (e.g., TrueLayer).
- **GDPR/Data Protection**: Processing debtor personal data (email, phone, voice recordings). Ensure lawful basis (legitimate interest of the creditor). Privacy notices required. Data retention policies. Voice call recordings require clear data processing basis.
- **AI Transparency**: Current UK position on AI agents interacting with humans is evolving. The AI agent does not disclose that it is AI (the persona is designed to pass as human). Monitor regulatory developments around AI disclosure requirements. The Online Safety Act and potential AI regulation may impose disclosure obligations in future. Design the system so that disclosure can be toggled on if regulation requires it.
- **Call Recording**: UK law permits recording calls without consent for business purposes, but best practice is to inform (e.g., "calls may be recorded for quality purposes" at the start). The AI voice system should include this.
- **Late Payment Legislation**: The Late Payment of Commercial Debts (Interest) Act 1998 governs B2B late payment. Agent communications must not misrepresent legal rights. Agent must never threaten legal action unless the customer has authorised it and it is genuine.
- **Harassment/OFT Guidelines**: While primarily aimed at consumer debt, the OFT Debt Collection Guidance principles of fairness apply. Agent must not: contact debtors at unreasonable times, use threatening language, misrepresent authority, contact debtors an excessive number of times. Build frequency caps and time-of-day rules into the agent.
- **Consumer Credit**: Invoice finance to businesses is generally not consumer credit, but verify if any products offered could fall under CCA 1974.
- **Anti-Money Laundering**: KYC on customers at onboarding. May need to comply with Money Laundering Regulations depending on activities.

---

## 17. GLOSSARY

| Term | Definition |
|------|-----------|
| AR | Accounts Receivable — money owed to a business by its customers |
| DSO | Days Sales Outstanding — average number of days to collect payment |
| IF | Invoice Finance — generic term for factoring and discounting |
| Factoring | Selling invoices to a factor who collects payment (disclosed to debtor) |
| Discounting | Borrowing against invoices while retaining credit control (confidential) |
| Selective IF | Financing individual invoices rather than whole ledger |
| Debtor | A customer who owes money (the customer's customer) |
| Debtor Intent | A signal indicating the debtor's intention regarding payment (captured via any channel) |
| Intent Signal | A structured data record extracted from debtor interaction (promise, acknowledge, dispute, etc.) |
| AI Collections Agent | The autonomous AI persona that manages debtor relationships across all channels |
| Agent Persona | The named identity (e.g., "Sarah Mitchell") that the AI agent uses when communicating with debtors |
| Tone Escalation | Progressive increase in communication firmness from Friendly → Professional → Firm → Formal → Legal |
| Autonomy Level | How much human approval the agent requires: Full Auto / Semi-Auto / Supervised |
| Ageing | Categorising receivables by how long overdue (30/60/90/120+ days) |
| Open Banking | UK framework allowing authorised third parties to access bank data via APIs |
| AIS | Account Information Services — Open Banking service to read account data |
| AISP | Account Information Service Provider — entity authorised to provide AIS |
| White-label | Rebranding a product under another company's name |
| Conversation History | Unified cross-channel record of all interactions between the agent and a debtor |

---

## 18. EXISTING CODEBASE ASSESSMENT

### Repository
- **Location**: `https://github.com/simonkramer1966/qashivo` (private — make public temporarily for Claude Code access, or clone locally)
- **Language**: TypeScript (96.4%), Vite + React frontend, Express backend
- **Database**: PostgreSQL + Drizzle ORM (already the chosen stack)
- **Commits**: 5,058 — this is a substantial codebase, not a prototype
- **Origin**: Built on Replit, migrated to GitHub for Railway deployment

### Strategy: REFACTOR — Not Rewrite
The existing codebase has significant infrastructure that directly maps to the product spec. A rewrite would waste months of tested, working code. The approach is:
- **Backend: Refactor** — keep and evolve existing infrastructure, add AI agent layers and Bayesian engine on top
- **Frontend: Rewrite** — completely new UI to the spec in Section 8B. New pages, components, navigation. Same framework (React + Tailwind + shadcn/ui).
- **Authentication: Replace** — currently Replit OIDC, needs replacing with Auth0, Clerk, or custom auth

### What Exists and Maps to the Spec (KEEP & EVOLVE)

| Existing System | Status | Maps to Spec Section | Refactor Needed |
|----------------|--------|---------------------|-----------------|
| **Drizzle ORM schema** (tenants, users, invoices, contacts, partners, API connections) | Production-grade | Section 4.1 data model | Extend with new agent entities, forecast models, bank transaction classification |
| **RBAC system** (50+ permissions, 6 role tiers, middleware chain) | Production-grade | Section 8C user roles | Add Staff debtor assignment. Largely complete. |
| **Multi-tenant isolation** (tenant-scoped queries, middleware, storage layer) | Production-grade | Section 4.4 multi-tenancy | No changes needed — already handles tenant isolation correctly |
| **Partner B2B2B architecture** (tenant switching, partner-client relationships, access levels) | Production-grade | Section 7A partner model | Extend with commission tracking, delegation levels. Core architecture solid. |
| **Email infrastructure** (SendGrid abstraction, inbound parsing, routing, delivery tracking) | Production-grade | Section 4.1 agent email capability | Evolve from template-based to LLM-generated. Inbound email → agent routing pipeline. |
| **Inbound email schema** (NormalizedInboundEmail with routing, intent, provider abstraction) | Production-grade | Section 4.1 intent capture from email | Extend routing to feed AI agent instead of static workflows |
| **Timeline / conversation history** (unified timeline, channels, outcomes, confidence scores) | Production-grade | Section 4.1 ConversationHistory | This IS the conversation history model. Add agent_reasoning field. |
| **Payment signals / behavioural analytics** (signal collector, statistics, trend detection) | Substantial | Section 11 Bayesian model inputs | Foundation for Bayesian engine. Extend with Open Banking data source. |
| **Adaptive scheduler** (scoring engine, cold-start, dual modes) | Substantial | Section 4.4 Orchestrator / Agent decision engine | Evolve into AI agent autonomous decision engine. Replace rule-based with LLM-driven. |
| **Dispute system** (lifecycle, debtor portal, evidence, notifications) | Complete | Section 4.4 Dispute Resolution Agent | Add AI agent persona layer on top. Existing lifecycle logic reusable. |
| **Voice integration** (Retell AI, prompts, transcripts) | Working | Section 4.1 AI Voice | Already integrated. Evolve prompts for agent persona. Add intent extraction from transcripts. |
| **SMS via Vonage** | Working | Section 4.1 SMS channel | Add inbound SMS handling and agent response generation |
| **Stripe billing** | Working | Section 8E billing | Extend with usage-based charges for voice/SMS and partner commission |
| **Debtor portal** (magic link auth, payment, dispute, PTP) | Working | Section 9 debtor portal | Add chat widget, agent persona branding, payment plan request UI |
| **Overdue categorisation** (granular categories, priorities, filtering) | Complete | Section 4.1 ageing reports | Reusable as-is |
| **Health scoring** (invoice scores, risk levels, payment likelihood) | Working | Section 4.4 Credit Risk Agent | Foundation for Credit Risk Agent. Extend with Bayesian debtor models. |
| **Zod validation** on all API inputs | Complete | General quality | Keep as-is |
| **Webhook signature verification** (Xero, Sage, QuickBooks HMAC) | Working | Section 5 integrations | Keep as-is |
| **Currency handling** (multi-currency with i18n formatting) | Working | Section 8I internationalisation | Already architected for multi-currency |
| **Date formatting** (en-GB unambiguous format) | Working | General | Keep as-is |
| **Partner scorecard** (readiness assessment for accountant partners) | Working | Section 7A partner commercial model | Keep — useful for partner onboarding |

### What Needs Adding (NEW)

| New System | Spec Section | Builds On |
|-----------|-------------|-----------|
| **AI Collections Agent (LLM-powered)** | Section 4.1, 4.4, 10 | Existing email + SMS + voice + timeline infrastructure |
| **Agent persona system** | Section 4.1, 4.4 | New — but plumbing exists (email, voice, portal) |
| **Orchestrator** | Section 4.4 | Existing middleware architecture |
| **Compliance Agent (rule-based v1)** | Section 4.4 | New — integrates with existing email delivery pipeline |
| **Onboarding Agent** | Section 4.4 | New |
| **Bayesian forecasting engine** | Section 4.2, 11 | Existing payment signals provide data foundation |
| **Open Banking integration** | Section 5, 5A | New — TrueLayer or Yapily |
| **Bank transaction classification engine** | Section 4.2 outflows | New — processes Open Banking transaction data |
| **Two-signal reconciliation** | Section 5A | Existing Xero payment sync + new Open Banking data |
| **User changes dialog** (forecast manual inputs with expiry) | Section 4.2 | New UI component |
| **Qapital pre-authorisation & one-click activation** | Section 8H | Existing Stripe + new finance provider integrations |
| **New frontend (complete rewrite)** | Section 8B | Same framework (React + Tailwind + shadcn/ui), fresh components |
| **Auth replacement** | — | Replace Replit OIDC with Auth0/Clerk/custom |

### What Needs Removing or Replacing

| Existing System | Action | Reason |
|----------------|--------|--------|
| Replit OAuth (OIDC) | Replace | Platform-specific, not portable |
| Replit object storage | Replace | Platform-specific |
| `.replit` configuration | Remove | No longer on Replit |
| `replit.md` | Replace with QASHIVO_CONTEXT.md | New canonical spec document |
| Glassmorphism UI | Rewrite frontend | Complete UI redesign per Section 8B |
| OpenAI dependency | Replace with Anthropic Claude | Primary LLM provider for all agents |
| Demo/investor pages | Remove or defer | Not needed for build phase MVP |

### Key Dependencies Already in package.json (Reusable)
- `drizzle-orm` + `drizzle-kit` — database ORM ✓
- `@sendgrid/mail` — email delivery ✓
- `@vonage/server-sdk` — SMS ✓
- `retell-sdk` — AI voice ✓
- `stripe` + `@stripe/react-stripe-js` — billing ✓
- `openid-client` — OAuth (needs reconfiguring for new auth provider) ✓
- `express` + `express-session` + `express-rate-limit` — API framework ✓
- `zod` + `drizzle-zod` — validation ✓
- `recharts` — charts for Qashflow visualisation ✓
- `react-hook-form` + `@hookform/resolvers` — form handling ✓
- `node-cron` — scheduled jobs (forecast recalculation, agent actions) ✓
- `sanitize-html` — content safety ✓
- `date-fns` — date handling ✓
- `ws` — WebSocket for portal chat widget ✓
- All Radix UI + shadcn/ui components — UI library ✓

### Dependencies to Add
- `@anthropic-ai/sdk` — Claude API for all AI agents
- TrueLayer or Yapily SDK — Open Banking
- `bullmq` or similar — job queue for agent actions (replace node-cron for complex scheduling)

---

## 19. INSTRUCTIONS FOR CLAUDE CODE / NEW SESSIONS

When starting a new session to work on Qashivo:

1. **Read this entire document first** — it is the single source of truth
2. **This is a REFACTOR, not a rewrite.** There is an existing codebase at `https://github.com/simonkramer1966/qashivo` with 5,000+ commits of production infrastructure. See Section 18 for what exists and what to keep.
3. **Backend: refactor and extend.** Keep the existing RBAC, multi-tenant, partner, email, SMS, voice, timeline, payment signals, dispute system, and Stripe billing. Add AI agent layers and Bayesian forecasting on top.
4. **Frontend: rewrite.** New UI per Section 8B. Same framework (React + Tailwind + shadcn/ui) but completely new pages and components. Role-based home views, sidebar navigation, agent persona dashboard cards.
5. **Authentication: replace.** Swap Replit OIDC for Auth0, Clerk, or custom auth. Keep the session management and RBAC middleware.
6. **The AI Collections Agent is the core innovation** — it is an autonomous, conversational, multi-channel credit controller with a named persona. It is NOT a template-based email scheduler. Every communication is LLM-generated, contextual, and persona-consistent. If it reads like a template, it's wrong.
7. **LLM from day one.** MVP v1 uses LLM-generated emails. No templates. The Compliance Agent is rule-based in v1, upgraded to LLM-assisted later.
8. **Intent capture happens across ALL channels** — email replies, SMS replies, voice call transcripts, and portal interactions all generate IntentSignals. The existing inbound email and timeline systems provide the foundation.
9. **The agent needs full conversation memory** — the existing Timeline system IS the ConversationHistory. Extend it with agent_reasoning fields.
10. **Everything must be API-first** — the bank buyer will need to integrate with their systems
11. **Track all metrics from day one** — DSO, forecast accuracy (graduated by horizon + scenario bracketing), agent response rates, channel effectiveness
12. **Recruitment sector first** — all UX decisions, defaults, and persona examples should be optimised for recruitment agencies
13. **The product will be white-labelled by a bank** — build with theming/branding customisation in mind from the start
14. **Security and data isolation are already strong** — the existing multi-tenant RBAC system is production-grade. Maintain this standard.
15. **Code quality matters for the sale** — clean, well-documented, tested code increases acquisition value
16. **Compliance layer is mandatory** — all agent-generated content must pass through compliance checks before delivery. Log all agent decisions with reasoning for audit trail.
17. **Autonomy is configurable** — Full Auto, Semi-Auto, Supervised modes per customer. Default new customers to Semi-Auto.
18. **The debtor must believe the agent is human** — the quality of generated communications, the consistency of persona, and the conversational memory are what make this work. This is the bar.
19. **Open Banking payment data trains the models; accounting platform data does not.** See Section 5A. The two-signal reconciliation model uses accounting platform allocation as a trigger, Open Banking payment dates as training data.
20. **Default currency is GBP** (not USD as in the current codebase). Update currency defaults for UK-first market.

---

*Document version: 4.1 — March 2026*
*Final update for this conversation. Added Section 18: Existing Codebase Assessment. Comprehensive mapping of existing infrastructure to spec sections. Strategy confirmed as REFACTOR (backend) + REWRITE (frontend) + REPLACE (auth). Section 19 (Instructions) updated for refactor context — developers/Claude Code must understand what already exists before building. Updated from 18 to 19 sections.*
*Next step: Create MVP v1 Build Spec in a new conversation, using this document as the canonical reference.*
