# Charlie Decision Engine - Complete Logic Reference

Charlie is an autonomous B2B credit controller that decides **who** to chase, **when** to contact them, **how** to communicate, and **what tone** to use. This document provides a complete reference of Charlie's decision logic.

---

## Table of Contents
1. [Overview](#overview)
2. [Invoice State Machine](#invoice-state-machine)
3. [Priority Scoring](#priority-scoring)
4. [Channel Selection](#channel-selection)
5. [Customer Segmentation](#customer-segmentation)
6. [Cadence Rules](#cadence-rules)
7. [Escalation Triggers](#escalation-triggers)
8. [Exception Handling](#exception-handling)
9. [Tone Progression](#tone-progression)
10. [Complete Decision Flow](#complete-decision-flow)

---

## Overview

Charlie operates on a **supervised autonomy** model:
- Charlie generates a daily plan (overnight)
- User approves with one click (10 minutes daily)
- Charlie executes throughout the day

### Key Principles
1. **Protect relationships while securing payment** - Never damage customer relationships
2. **Progressive escalation** - Start friendly, escalate only when needed
3. **Channel progression** - Email → SMS → Voice (never skip steps)
4. **Evidence-based decisions** - Use payment history and behaviour patterns

---

## Invoice State Machine

Charlie tracks each invoice through 12 distinct states:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INVOICE STATES                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│   │  DRAFT   │───▶│ PENDING  │───▶│ OVERDUE  │───▶│ CHASING  │     │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘     │
│                                         │              │             │
│                                         ▼              ▼             │
│                                   ┌──────────┐   ┌──────────┐       │
│                                   │   PTP    │◀──│ESCALATED │       │
│                                   └──────────┘   └──────────┘       │
│                                    │       │          │              │
│                            ┌───────┘       └───────┐  │              │
│                            ▼                       ▼  ▼              │
│                      ┌──────────┐           ┌──────────┐            │
│                      │ PTP_MET  │           │PTP_MISSED│            │
│                      └──────────┘           └──────────┘            │
│                            │                       │                 │
│                            ▼                       ▼                 │
│                      ┌──────────┐           ┌──────────┐            │
│                      │   PAID   │           │  FINAL   │            │
│                      └──────────┘           │  DEMAND  │            │
│                                             └──────────┘            │
│                                                   │                  │
│   EXCLUSION STATES:                              ▼                  │
│   ┌──────────┐  ┌──────────┐           ┌──────────────┐            │
│   │ DISPUTED │  │  ADMIN   │           │DEBT_RECOVERY │            │
│   │          │  │ BLOCKED  │           └──────────────┘            │
│   └──────────┘  └──────────┘                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### State Definitions

| State | Description | Charlie Action |
|-------|-------------|----------------|
| `draft` | Invoice created, not sent | No action |
| `pending` | Sent, not yet due | Pre-due reminder (optional) |
| `overdue` | Past due date | Begin chase sequence |
| `chasing` | Active collection | Continue cadence |
| `ptp` | Promise to Pay received | Monitor for payment |
| `ptp_met` | Payment received as promised | Close - success |
| `ptp_missed` | Promise not kept | **CRITICAL** - Immediate follow-up |
| `escalated` | Requires senior attention | Firm tone, possible call |
| `final_demand` | Last notice before legal | Formal written notice |
| `debt_recovery` | Handed to collections | **EXCLUDED** - External handling |
| `disputed` | Customer disputes invoice | **EXCLUDED** - Human review |
| `admin_blocked` | On hold / admin issue | **EXCLUDED** - Blocked |

---

## Priority Scoring

Charlie assigns a priority score (0-100) and tier to every invoice.

### Priority Tiers

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PRIORITY DECISION TREE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Is invoice in excluded state?                                      │
│   (disputed, admin_blocked, on_hold, ptp, ptp_met, debt_recovery)   │
│        │                                                             │
│        ├── YES ──▶ EXCLUDED (Score: 0)                              │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Is state = ptp_missed?                                            │
│        │                                                             │
│        ├── YES ──▶ CRITICAL (Score: 95)                             │
│        │          "Missed promise - requires immediate follow-up"   │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Is 60+ days overdue AND high value (≥£10,000)?                    │
│        │                                                             │
│        ├── YES ──▶ HIGH (Score: 85)                                 │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Is 30-60 days overdue AND moderate/high value (≥£5,000)?          │
│        │                                                             │
│        ├── YES ──▶ HIGH (Score: 75)                                 │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Is newly overdue (≤7 days) AND (high value OR new customer)?      │
│        │                                                             │
│        ├── YES ──▶ MEDIUM (Score: 65)                               │
│        │          "Establish payment pattern early"                 │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Calculate component score...                                       │
│        │                                                             │
│        └──▶ Score 0-100 based on:                                   │
│             • Overdue severity (+5 to +40)                          │
│             • Amount at risk (+10 to +15)                           │
│             • Contact recency (+5 to +15)                           │
│             • Final demand stage (+20)                              │
│                                                                      │
│   Final Tier Assignment:                                             │
│   Score ≥ 80 ──▶ HIGH                                               │
│   Score ≥ 50 ──▶ MEDIUM                                             │
│   Score < 50 ──▶ LOW                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Score Components

| Factor | Condition | Points Added |
|--------|-----------|--------------|
| **Overdue Severity** | 60+ days | +40 |
| | 30-60 days | +30 |
| | 14-30 days | +20 |
| | 7-14 days | +10 |
| | 1-7 days | +5 |
| **Amount at Risk** | ≥ £10,000 | +15 |
| | ≥ £5,000 | +10 |
| **Contact Recency** | 14+ days, overdue | +15 |
| | 7+ days | +5 |
| | Never contacted, overdue | +10 |
| **State** | Final demand | +20 |

---

## Channel Selection

Charlie follows a strict progression: **Email → SMS → Voice**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CHANNEL SELECTION TREE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Is state = final_demand?                                          │
│        │                                                             │
│        ├── YES ──▶ EMAIL                                            │
│        │          "Final demand requires formal written notice"     │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Is state = ptp_missed?                                            │
│        │                                                             │
│        ├── YES                                                       │
│        │    │                                                        │
│        │    ▼                                                        │
│        │    Has had SMS attempt AND (high value OR 30+ days)?       │
│        │         │                                                   │
│        │         ├── YES ──▶ VOICE                                  │
│        │         │          "Call for immediate commitment"         │
│        │         │                                                   │
│        │         └── NO                                              │
│        │              │                                              │
│        │              ▼                                              │
│        │         Has had email but not SMS?                         │
│        │              │                                              │
│        │              ├── YES ──▶ SMS                               │
│        │              │          "SMS nudge before call"            │
│        │              │                                              │
│        │              └── NO ──▶ EMAIL                              │
│        │                        "Email first for audit trail"       │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   First contact ever (or no prior email)?                           │
│        │                                                             │
│        ├── YES ──▶ EMAIL                                            │
│        │          "First touch - email for audit trail"             │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   2-5 days since last contact AND no SMS sent yet?                  │
│        │                                                             │
│        ├── YES ──▶ SMS                                              │
│        │          "No response after 48-72h - SMS nudge"            │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   5+ days AND SMS already sent AND (high value OR 30+ days)?        │
│        │                                                             │
│        ├── YES ──▶ VOICE                                            │
│        │          "Extended non-response - call required"           │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Enterprise customer?                                               │
│        │                                                             │
│        ├── YES ──▶ EMAIL                                            │
│        │          "Enterprise - formal written communication"       │
│        │                                                             │
│        └── NO ──▶ EMAIL (default)                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Channel Rules Summary

| Rule | Condition | Channel |
|------|-----------|---------|
| **First touch** | Never contacted | EMAIL |
| **No response 48-72h** | 2-5 days, no SMS yet | SMS |
| **Extended no response** | 5+ days, SMS sent, high value/aged | VOICE |
| **Missed PTP** | Promise broken, prior attempts made | VOICE |
| **Final demand** | Always | EMAIL |
| **Enterprise** | Always | EMAIL |

---

## Customer Segmentation

Charlie adjusts behaviour based on customer type:

```
┌─────────────────────────────────────────────────────────────────────┐
│                   CUSTOMER SEGMENTATION TREE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Customer created < 90 days ago?                                   │
│        │                                                             │
│        ├── YES ──▶ NEW_CUSTOMER                                     │
│        │          Tighter follow-up, confirm AP process             │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Behaviour score ≥ 80?                                             │
│        │                                                             │
│        ├── YES ──▶ GOOD_PAYER                                       │
│        │          Assume admin slip, friendly tone                  │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Behaviour score ≤ 30?                                             │
│        │                                                             │
│        ├── YES ──▶ CHRONIC_LATE_PAYER                               │
│        │          Shorter cadence, earlier escalation               │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Credit limit > £50,000?                                           │
│        │                                                             │
│        ├── YES ──▶ ENTERPRISE                                       │
│        │          Process-driven, PO/portal focus                   │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Credit limit < £5,000?                                            │
│        │                                                             │
│        ├── YES ──▶ SMALL_BUSINESS                                   │
│        │          Cashflow-driven, phone effective                  │
│        │                                                             │
│        └── NO ──▶ STANDARD                                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Segment Behaviours

| Segment | Email Cadence | SMS Cadence | Voice Cadence | Approach |
|---------|---------------|-------------|---------------|----------|
| **New Customer** | 2 days between | Default | 3 days, Mon-Fri | Tighter follow-up |
| **Good Payer** | 5 days between | 4 days between | 7 days between | Relaxed, friendly |
| **Chronic Late** | 2 days, 4/week max | 2 days, 3/week max | 3 days, 2/week max | Aggressive |
| **Enterprise** | Default, 2/week max | Default | 7 days, Tue-Thu only | Formal, process-focused |
| **Small Business** | Default | 3/week max | 9am-5pm, weekdays | SMS-effective |
| **Standard** | 3 days between | 2 days between | 5 days between | Balanced |

---

## Cadence Rules

Charlie enforces strict timing between contacts to prevent harassment:

### Default Cadence by Channel

| Channel | Min Days Between | Max Per Week | Business Hours | Preferred Days | Preferred Hours |
|---------|------------------|--------------|----------------|----------------|-----------------|
| **Email** | 3 | 3 | Yes | Mon-Fri | 9am-5pm |
| **SMS** | 2 | 2 | Yes | Mon-Fri | 10am-4pm |
| **Voice** | 5 | 1 | Yes | Tue-Thu | 10am-3pm |

### Cadence Check Logic

```
┌─────────────────────────────────────────────────────────────────────┐
│                      IS WITHIN CADENCE?                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Weekly contact count ≥ maxContactsPerWeek?                        │
│        │                                                             │
│        ├── YES ──▶ NOT WITHIN CADENCE (blocked)                     │
│        │          "Weekly limit exceeded"                           │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Never contacted before?                                            │
│        │                                                             │
│        ├── YES ──▶ WITHIN CADENCE (allowed)                         │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Days since last contact ≥ minDaysBetweenContacts?                 │
│        │                                                             │
│        ├── YES ──▶ WITHIN CADENCE (allowed)                         │
│        │                                                             │
│        └── NO ──▶ NOT WITHIN CADENCE (blocked)                      │
│                   "Too soon since last contact"                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Escalation Triggers

Charlie escalates when these conditions are met:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ESCALATION TRIGGERS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Trigger: MISSED_PTP                                               │
│   Condition: Promise to pay was made but payment not received       │
│   Action: Immediate follow-up, voice call if prior attempts made    │
│                                                                      │
│   ─────────────────────────────────────────────────────────────     │
│                                                                      │
│   Trigger: REPEATED_NON_RESPONSE                                    │
│   Condition: 3+ touches across channels with no reply               │
│   Action: Escalate to next channel, flag for human review           │
│                                                                      │
│   ─────────────────────────────────────────────────────────────     │
│                                                                      │
│   Trigger: OVERDUE_30_PLUS_NO_PROGRESS                              │
│   Condition: >30 days overdue with no payment progress              │
│   Action: Switch to firm tone, consider voice call                  │
│                                                                      │
│   ─────────────────────────────────────────────────────────────     │
│                                                                      │
│   Trigger: HIGH_VALUE_AVOIDANCE                                     │
│   Condition: High value (≥£10k) + signs of avoidance                │
│   Action: Priority escalation, human review recommended             │
│                                                                      │
│   ─────────────────────────────────────────────────────────────     │
│                                                                      │
│   Trigger: PATTERN_CHANGE                                           │
│   Condition: Previously good payer now slipping                     │
│   Action: Early intervention, investigate cause                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Exception Handling

Some actions require human review before execution:

### Exception Rules

| Rule | Condition | Reason |
|------|-----------|--------|
| **First Contact High Value** | First contact AND amount ≥ £10,000 | High risk, needs personalisation |
| **VIP Customer** | Contact notes contain "VIP" | Strategic relationship |
| **Low Confidence** | Confidence < threshold (80-90%) | Uncertain decision |
| **Escalation Required** | Any escalation trigger active | Needs human judgement |
| **Human Review Flag** | Charlie's confidence low | Complex situation |

### Exception Flow

```
Action generated ──▶ Check exception rules
                          │
                          ├── Exception triggered ──▶ Status: EXCEPTION
                          │                          Added to VIP Queue
                          │                          Requires human approval
                          │
                          └── No exception ──▶ Status: PENDING_APPROVAL
                                              Added to daily plan
                                              Auto-approved at execution time
```

---

## Tone Progression

Charlie adjusts tone based on state and escalation:

```
┌─────────────────────────────────────────────────────────────────────┐
│                       TONE SELECTION                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   State = debt_recovery OR final_demand?                            │
│        │                                                             │
│        ├── YES ──▶ RECOVERY_FORMAL_FIRM                             │
│        │          "This is a formal notice..."                      │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   State = ptp_missed OR shouldEscalate = true?                      │
│        │                                                             │
│        ├── YES ──▶ CREDIT_CONTROL_FIRM                              │
│        │          "We need to resolve this today..."                │
│        │                                                             │
│        └── NO                                                        │
│             │                                                        │
│             ▼                                                        │
│   Default ──▶ CREDIT_CONTROL_FRIENDLY                               │
│              "I hope this message finds you well..."                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Tone Profiles

| Profile | Use Case | Example Opening |
|---------|----------|-----------------|
| **FRIENDLY** | Pre-due, just overdue | "I hope this finds you well. Quick reminder..." |
| **FIRM** | 14-30 days, missed PTP | "We need to resolve this. Please confirm..." |
| **FORMAL** | 60+ days, final demand | "This is a formal notice requiring immediate..." |

---

## Complete Decision Flow

Here's how Charlie processes each invoice:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DECISION FLOW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   1. COMPUTE STATE                                                   │
│      └── Invoice State Machine determines current state             │
│                                                                      │
│   2. CHECK EXCLUSION                                                 │
│      └── Disputed, on hold, admin blocked ──▶ EXCLUDED              │
│                                                                      │
│   3. DETERMINE SEGMENT                                               │
│      └── Classify customer: new, good, chronic, enterprise, etc.    │
│                                                                      │
│   4. CALCULATE PRIORITY                                              │
│      └── Score 0-100, assign tier (critical/high/medium/low)        │
│                                                                      │
│   5. SELECT CHANNEL                                                  │
│      └── Email → SMS → Voice progression with contact history       │
│                                                                      │
│   6. CHECK CADENCE                                                   │
│      └── Verify within weekly limits and min days between           │
│          └── Out of cadence ──▶ Skip this invoice today             │
│                                                                      │
│   7. CHECK ESCALATION                                                │
│      └── Any triggers active? Set shouldEscalate flag               │
│                                                                      │
│   8. SELECT TONE                                                     │
│      └── Friendly → Firm → Formal based on state and escalation     │
│                                                                      │
│   9. SELECT TEMPLATE                                                 │
│      └── Match template to channel, state, and tone                 │
│                                                                      │
│  10. CHECK EXCEPTIONS                                                │
│      └── High value first contact, VIP, low confidence              │
│          └── Exception ──▶ Add to VIP Queue for human review        │
│                                                                      │
│  11. CREATE ACTION                                                   │
│      └── Generate action record with all decision metadata          │
│                                                                      │
│  12. ADD TO DAILY PLAN                                               │
│      └── Sorted by priority, respecting daily limits                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Summary

Charlie's decision-making can be summarised as:

> **"Right customer, right channel, right time, right tone"**

1. **Right customer** - Priority scoring ensures high-impact invoices get attention first
2. **Right channel** - Progression from email to SMS to voice, never skipping steps
3. **Right time** - Cadence rules prevent harassment while maintaining pressure
4. **Right tone** - Progressive escalation from friendly to formal protects relationships

The system generates a daily plan that users approve with one click, then Charlie executes autonomously throughout the day.
