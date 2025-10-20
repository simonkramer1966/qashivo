# Action Centre User Guide

## Overview

The **Action Centre** is the command center for your collections workflow in Nexus AR. It's designed around an **exception-first philosophy**: the AI handles routine collections automatically, surfacing only items that need human attention or approval.

Think of it as your daily task list—intelligently filtered, prioritized, and ready for action.

---

## How the Action Centre Works

### The Exception-First Approach

Instead of reviewing every customer manually, the Action Centre shows you:
- **AI-recommended actions** waiting for your approval
- **Exceptions** that require human judgment (disputes, promises to pay, special circumstances)
- **Inbound queries** from customers that need responses
- **Broken promises** that need follow-up

Most routine collections happen automatically in the background. You only see what matters.

---

## Understanding the Tabs

### 1. **Queries Tab** 
**Why debtors appear here:** Customers have sent inbound communication (email, SMS, WhatsApp, or voicemail) that the AI has analyzed.

**What you see:**
- Customer messages with AI-detected **intent** (payment promise, dispute, query, complaint)
- **Sentiment analysis** (positive, neutral, negative)
- Recommended next actions based on the content

**When to act:**
- Customer disputes an invoice → Route to Disputes tab or adjust invoice
- Customer promises payment → Log the promise (creates PTP record)
- Customer asks a question → Respond via Compose

---

### 2. **Overdue Tab** (Current View)
**Why debtors appear here:** They have unpaid invoices past their due date, and the AI has recommended a collection action.

**What you see:**
- One row per customer (with multiple overdue invoices bundled together)
- Total outstanding amount
- **AI-recommended action** (e.g., "Email in 2h" or "SMS now")
- **Priority level** based on amount, days overdue, and payment history
- **Exceptions** like "First overdue" or "VIP customer" that might need special handling

**When to act:**
- **Approve** if the AI recommendation looks good
- **Compose** to customize the message
- **Snooze** if you know they're about to pay
- **Assign** to a specialist collector for complex cases

---

### 3. **Upcoming PTP Tab**
**Why debtors appear here:** Customers have made a **Promise to Pay (PTP)** that's coming due in the next 7 days.

**What you see:**
- Customers with active payment promises
- Promised payment date and amount
- Reminder actions scheduled before the due date

**When to act:**
- Review promises approaching due dates
- Send courtesy reminders (AI suggests timing)
- Escalate if customer history shows frequent broken promises

---

### 4. **Broken Promises Tab**
**Why debtors appear here:** Customers missed a **Promise to Pay** deadline without making the payment.

**What you see:**
- Customers who broke commitments
- Original promise details (date, amount)
- How many times they've broken promises before
- Escalated follow-up actions (often more urgent tone)

**When to act:**
- **Approve escalated actions** (stronger language, phone calls)
- **Assign to senior collector** for repeat offenders
- **Mark as disputed** if there's a legitimate reason for non-payment

---

### 5. **Disputes Tab**
**Why debtors appear here:** Customers have formally disputed an invoice (via inbound message flagged as "dispute" intent, or manually logged).

**What you see:**
- Disputed invoices with reason codes
- Customer's dispute message/explanation
- Supporting documentation (if uploaded)
- Collection actions are **paused** until resolved

**When to act:**
- **Investigate** the dispute (check delivery proof, contract terms, etc.)
- **Resolve** by adjusting invoice or confirming it's valid
- **Resume collections** once dispute is settled

---

### 6. **On Hold Tab**
**Why debtors appear here:** Collections have been manually paused for specific reasons (legal dispute, payment plan in progress, bankruptcy, etc.).

**What you see:**
- Customers with active collection holds
- Hold reason and who placed it
- Hold expiry date (if temporary)

**When to act:**
- **Review holds** regularly to ensure they're still valid
- **Resume collections** when hold reason expires
- **Extend hold** if circumstances require it

---

## Available Actions Explained

### 🎨 **Compose**
**What it does:** Opens the Template Library + Multi-Channel Composer, allowing you to:
- Select a template (overdue reminder, payment plan offer, final notice, etc.)
- Choose channel (Email, SMS, WhatsApp, Voice)
- Customize the message with merge fields (customer name, amount, invoice number)
- Preview before sending

**When to use:**
- AI recommendation needs personalization (VIP customer, special circumstance)
- Customer requested specific payment terms
- You want to bundle multiple messages into one communication

**Result:** Message is sent immediately or scheduled, and logged in customer timeline.

---

### ✅ **Approve**
**What it does:** Accepts the AI-recommended action exactly as proposed (no edits).

**When to use:**
- The recommended action looks appropriate
- No special circumstances require customization
- You want to process actions quickly (bulk approve)

**Result:** Action is scheduled and will execute automatically at the recommended time.

---

### ⏰ **Snooze**
**What it does:** Postpones the action to a later date/time with a logged reason.

**When to use:**
- Customer verbally promised payment by a specific date
- Waiting for dispute resolution
- Customer is temporarily unreachable (vacation, hospital, etc.)
- Invoice is under internal review

**Result:** Action is hidden from queue until snooze date, then resurfaces automatically. Snooze reason is logged for audit trail.

---

### 🚨 **Escalate**
**What it does:** Immediately increases priority and moves to more assertive collection tactics.

**When to use:**
- Customer is unresponsive after multiple attempts
- Amount is material and days overdue is high
- Customer broke multiple payment promises
- Legal action or collections agency referral is being considered

**Result:** Priority boosted, more urgent messaging, often switches to phone calls, may trigger supervisor review.

---

### 👤 **Assign**
**What it does:** Delegates the customer/action to a specific collector or team.

**When to use:**
- Complex dispute requires specialist knowledge
- VIP customer needs senior relationship manager
- High-value debt needs dedicated collector
- Language barrier requires bilingual agent

**Result:** Action appears in assigned user's queue, original user is notified when resolved.

---

### 📋 **View Timeline**
**What it does:** Opens complete communication history for this customer.

**What you see:**
- All sent messages (email, SMS, voice) with timestamps
- Inbound responses from customer
- Payment history and promises
- Notes from other collectors
- AI confidence scores and reasoning for past actions

**When to use:**
- Before calling a customer (see what's already been said)
- Investigating why collections haven't worked
- Customer claims "I never received anything"
- Preparing for legal action (need documentation)

---

## Recommended Workflow

### Daily Action Centre Routine

**1. Start with Queries (5-10 min)**
- Process new inbound messages
- Log payment promises → creates PTPs
- Route disputes → moves to Disputes tab
- Answer questions via Compose

**2. Review Overdue (15-20 min)**
- Scan for **red exception badges** (high priority)
- **Bulk approve** routine actions that look good
- **Compose custom messages** for VIP/sensitive accounts
- **Snooze** items with known temporary delays

**3. Check Broken Promises (5 min)**
- Approve escalated follow-ups
- Call repeat offenders personally
- Assign difficult cases to specialists

**4. Monitor Disputes (as needed)**
- Investigate new disputes daily
- Resolve or escalate within 48 hours
- Update customers on status

**5. Review Upcoming PTPs (weekly)**
- Ensure reminders are scheduled
- Flag high-risk promises for closer monitoring

---

## AI Confidence Scores

Each recommended action shows an **AI confidence score** (0-100%):

- **70-100% (High):** AI is very confident based on customer behavior, amount, timing
- **40-70% (Medium):** Reasonable recommendation, but review exceptions
- **0-40% (Low):** Uncertain case, human review strongly suggested

**Pro tip:** You can bulk approve high-confidence actions to save time, then focus on medium/low confidence items.

---

## Exception Tags Explained

Exception badges surface situations that might need special handling:

- **First Overdue:** Customer's first late payment (be gentle, might be oversight)
- **VIP Customer:** High-value or strategic account (personalize communication)
- **Recent Payment:** Paid recently but now overdue again (check if payment plan needed)
- **High Value:** Material amount that warrants extra attention
- **Long Overdue:** 60+ days past due (consider escalation)
- **Multiple Invoices:** Several invoices bundled (might need payment plan)
- **Dispute History:** Customer has disputed before (handle carefully)

---

## Best Practices

### ✅ Do:
- **Trust the AI for routine cases** - it learns from your decisions
- **Review exception tags** before approving
- **Add snooze reasons** for audit trail
- **Check timeline before calling** customers
- **Bulk approve** when confident to save time

### ❌ Don't:
- Ignore high-priority exceptions
- Approve without reading exception tags
- Snooze indefinitely without resolution plan
- Send duplicate messages (check timeline first)
- Escalate prematurely (try standard approach first)

---

## Integration with Automation

The Action Centre is designed to work **with** automation, not replace it:

- **Auto-Escalation Rules** move items between tabs automatically
- **Template Library** provides consistent, compliant messaging
- **AI Intent Analysis** routes inbound queries to correct tab
- **PTP Breach Detection** automatically flags broken promises

You're not micromanaging collections—you're handling exceptions while automation does the heavy lifting.

---

## Keyboard Shortcuts (Coming Soon)

- `A` - Approve selected action
- `C` - Open Compose
- `S` - Snooze
- `E` - Escalate
- `T` - View Timeline
- `↓/↑` - Navigate actions
- `Space` - Select/deselect

---

## Questions?

For technical support or feature requests, contact the Nexus AR team or refer to the main documentation at `/docs`.
