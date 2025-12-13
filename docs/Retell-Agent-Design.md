# Charlie Voice Agent - Retell Custom LLM Architecture

## Overview

Charlie uses Retell's **Custom LLM** approach where Retell handles telephony (speech-to-text, text-to-speech, call management) while Charlie controls all conversation logic through a WebSocket server.

### Why Custom LLM?

| Approach | Pros | Cons |
|----------|------|------|
| **Retell LLM** | Quick setup, managed prompts | Less control, probabilistic responses |
| **Custom LLM** ✓ | Deterministic, full control, template-driven | More code to maintain |

Charlie's sophisticated decision logic makes Custom LLM the right choice:
- Exact objection handlers from playbook
- Deterministic state transitions
- Full audit trail of every response
- Template-driven responses matching tone profiles

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CALL FLOW                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐      │
│   │   Charlie   │──────▶  │   Retell    │──────▶  │  Customer   │      │
│   │  Decision   │         │   (Voice)   │         │   Phone     │      │
│   │   Engine    │         │             │         │             │      │
│   └──────┬──────┘         └──────┬──────┘         └─────────────┘      │
│          │                       │                                      │
│          ▼                       │ WebSocket                            │
│   ┌─────────────┐               │                                      │
│   │  Initiate   │               │                                      │
│   │    Call     │               │                                      │
│   └──────┬──────┘               │                                      │
│          │                       ▼                                      │
│          │              ┌─────────────┐                                 │
│          └─────────────▶│  Charlie    │◀─────── User speech            │
│                         │  Custom LLM │                                 │
│                         │  WebSocket  │────────▶ Agent speech          │
│                         └──────┬──────┘                                 │
│                                │                                        │
│                                ▼                                        │
│                         ┌─────────────┐                                 │
│                         │  State      │                                 │
│                         │  Machine    │                                 │
│                         └─────────────┘                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## State Machine

### States

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CONVERSATION STATE MACHINE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐                                                      │
│   │   GREETING   │ ◀── Entry point                                      │
│   └──────┬───────┘                                                      │
│          │ (identity confirmed)                                         │
│          ▼                                                               │
│   ┌──────────────┐                                                      │
│   │ REASON_CALL  │ ─── Explain why calling                              │
│   └──────┬───────┘                                                      │
│          │                                                               │
│          ▼                                                               │
│   ┌──────────────┐     ┌───────────────────────────────┐               │
│   │   INQUIRY    │────▶│     OBJECTION HANDLING        │               │
│   │   (listen)   │     │  ┌─────────────────────────┐  │               │
│   └──────┬───────┘     │  │ PAYMENT_IN_PROGRESS     │  │               │
│          │             │  │ CASHFLOW_ISSUE          │  │               │
│          │             │  │ DISPUTE                 │  │               │
│          │             │  │ WRONG_PERSON            │  │               │
│          │             │  │ NOT_RECEIVED_INVOICE    │  │               │
│          │             │  │ NEEDS_APPROVAL          │  │               │
│          │             │  │ MISSING_PO              │  │               │
│          │             │  └─────────────────────────┘  │               │
│          │             └───────────────┬───────────────┘               │
│          │                             │                                │
│          ▼                             ▼                                │
│   ┌──────────────┐◀────────────────────┘                                │
│   │ PTP_CAPTURE  │ ─── Get payment commitment                           │
│   └──────┬───────┘                                                      │
│          │                                                               │
│          ▼                                                               │
│   ┌──────────────┐                                                      │
│   │   CLOSING    │ ─── Confirm and end call                             │
│   └──────────────┘                                                      │
│                                                                          │
│   ┌──────────────┐                                                      │
│   │   TRANSFER   │ ─── Optional: transfer to human                      │
│   └──────────────┘                                                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### State Definitions

| State | Purpose | Entry Trigger | Exit Conditions |
|-------|---------|---------------|-----------------|
| `GREETING` | Verify identity | Call connected | Identity confirmed or wrong person |
| `REASON_FOR_CALL` | State invoice details | Identity confirmed | Customer acknowledges |
| `INQUIRY` | Listen and classify | Reason stated | Intent detected |
| `OBJECTION_*` | Handle specific objection | Objection detected | Objection resolved |
| `PTP_CAPTURE` | Get payment commitment | Ready to commit | Commitment made or refused |
| `CLOSING` | Confirm and wrap up | Commitment captured | Call ends |
| `TRANSFER` | Hand to human | Request detected | Transfer complete |

---

## Input Variables from Charlie

When initiating a call, Charlie passes these variables:

### Core Variables (Required)

```typescript
{
  // Customer & Invoice
  customer_name: string;          // "John Smith"
  company_name: string;           // "Acme Corp"
  invoice_number: string;         // "INV-2024-001"
  invoice_amount: string;         // "£5,250.00"
  total_outstanding: string;      // "£8,750.00"
  days_overdue: number;           // 45
  due_date: string;               // "15 November 2024"
  
  // Charlie Decision
  charlie_state: CharlieState;    // "ptp_missed" | "escalated" | "chasing" etc.
  voice_tone: VoiceTone;          // "calm_collaborative" | "firm_collaborative" | "formal_recovery"
  template_id: TemplateId;        // "VOICE_PTP_CHASE" | "VOICE_PTP_REQUEST" etc.
  
  // Tenant Config
  sender_company: string;         // "Nexus Collections"
  sender_name: string;            // "Charlie"
  contact_number: string;         // "0800 123 4567"
}
```

### Context Variables (Optional)

```typescript
{
  // History
  has_prior_ptp: boolean;         // true if promise was previously made
  promised_date?: string;         // "10 December 2024" (if PTP missed)
  prior_attempts: number;         // Number of prior contact attempts
  
  // Customer Segment
  customer_segment: string;       // "enterprise" | "small_business" | "good_payer" | "chronic_late"
  
  // Limits
  minimum_payment?: string;       // "£500" for payment plan floor
  deadline_date?: string;         // "20 December 2024" for final demand
}
```

---

## Tone Profiles

Charlie's `voice_tone` controls language throughout the conversation:

### CALM_COLLABORATIVE (Default)
- Assumes admin oversight
- Friendly, helpful language
- No mention of consequences
- Example: "I wanted to check if there's anything preventing payment"

### FIRM_COLLABORATIVE (Escalated / PTP Missed)
- Acknowledges urgency
- Professional but insistent
- Mentions need for commitment
- Example: "We need to understand what happened and get a new commitment today"

### FORMAL_RECOVERY (Final Demand)
- Business-like, consequences mentioned
- References potential escalation
- Requests evidence of payment
- Example: "Without payment by {{deadline_date}}, we'll need to consider further recovery action"

---

## Objection Handlers

Each objection type has tone-adaptive responses:

### PAYMENT_IN_PROGRESS

| Tone | Response |
|------|----------|
| Calm | "That's good news. Do you have an expected date for when the payment will clear?" |
| Firm | "That's great to hear. Can you provide a reference number or the date the payment was sent so we can track it?" |
| Formal | "I'll need evidence of that payment to halt any further action. Can you email proof of payment to us today?" |

### CASHFLOW_ISSUE

| Tone | Response |
|------|----------|
| Calm | "I understand. What's a realistic date you could commit to? Even a partial payment would help." |
| Firm | "I understand cash flow can be challenging. Can we discuss a payment plan? What amount could you commit to this week?" |
| Formal | "At this stage, we need a formal payment arrangement. Can you commit to at least {{minimum_payment}} weekly?" |

### DISPUTE

| Tone | Response |
|------|----------|
| Calm | "Let me understand the concern so we can address it. What's the specific issue?" |
| Firm | "I understand there's a concern. Let me note the details so we can investigate. What specifically is the issue?" |
| Formal | "Any dispute should have been raised earlier. Please put your concerns in writing and we'll review. Meanwhile, undisputed amounts remain payable." |

### WRONG_PERSON

All tones: "I apologize for any confusion. Could you direct me to the right person for accounts payable?"

### NOT_RECEIVED_INVOICE

All tones: "I can resend that right away. What email address should I use, and who should it be addressed to?"

### NEEDS_APPROVAL

| Tone | Response |
|------|----------|
| Calm | "I understand there's an approval process. Who needs to approve this, and by when can we expect that?" |
| Firm/Formal | "Who is the decision maker, and can you connect me to them now?" |

---

## WebSocket Protocol

### Retell → Charlie (Request)

```json
{
  "interaction_type": "response_required",
  "transcript": [
    {"role": "agent", "content": "Hello, am I speaking with John?"},
    {"role": "user", "content": "Yes, this is John"}
  ],
  "call_id": "call_xxxxx",
  "metadata": {
    "charlie_state": "ptp_missed",
    "voice_tone": "firm_collaborative",
    "customer_name": "John Smith",
    "invoice_number": "INV-2024-001"
  }
}
```

### Charlie → Retell (Response)

```json
{
  "response_id": 0,
  "content": "Great, thank you John. I'm calling about a payment that was promised for 10th December but hasn't arrived yet. The invoice INV-2024-001 for £5,250 is now 45 days overdue. Can you confirm when you'll be able to make this payment?",
  "content_complete": true,
  "end_call": false
}
```

---

## Intent Classification

Charlie's WebSocket server uses OpenAI to classify user intent:

```typescript
const INTENT_CATEGORIES = [
  'identity_confirmed',     // "Yes, this is John"
  'identity_denied',        // "No, wrong person"
  'payment_in_progress',    // "I sent it last week"
  'cashflow_issue',         // "We're having cash flow problems"
  'dispute',                // "There's an issue with the invoice"
  'wrong_person',           // "I don't handle invoices"
  'not_received_invoice',   // "I never got that invoice"
  'needs_approval',         // "I need to check with my boss"
  'missing_po',             // "We need a PO number"
  'ready_to_commit',        // "I can pay next Friday"
  'refuses_to_pay',         // "We're not paying"
  'request_callback',       // "Can you call back later?"
  'request_transfer',       // "I need to speak to a manager"
  'general_acknowledgment', // "OK", "I see", "Right"
  'unclear'                 // Can't classify
];
```

---

## Call Outcomes

Charlie captures these outcomes from calls:

| Outcome | Description | Next Action |
|---------|-------------|-------------|
| `ptp_captured` | Customer committed to pay | Create PTP record, schedule follow-up |
| `dispute_raised` | Customer disputed invoice | Flag for review, pause automation |
| `payment_confirmed` | Customer says paid already | Request reference, verify |
| `callback_scheduled` | Customer requested callback | Schedule callback action |
| `wrong_contact` | Wrong person answered | Update contact, retry |
| `no_answer` | Call not answered | Schedule retry |
| `voicemail` | Left voicemail | Log, schedule follow-up |
| `refused` | Customer refused to pay | Escalate to human |

---

## Implementation Files

| File | Purpose |
|------|---------|
| `server/services/charlieVoiceHandler.ts` | Main WebSocket handler and state machine |
| `server/services/charlieIntentClassifier.ts` | OpenAI-powered intent detection |
| `server/services/charliePlaybook.ts` | Voice scripts and templates (existing) |
| `server/routes/retell-websocket.ts` | WebSocket endpoint registration |

---

## Configuration

### Environment Variables

```bash
RETELL_API_KEY=your_retell_api_key
RETELL_CUSTOM_LLM_URL=wss://your-domain.com/retell-llm
OPENAI_API_KEY=your_openai_key  # For intent classification
```

### Retell Agent Setup

1. Create agent in Retell dashboard
2. Set response engine to "Custom LLM"
3. Set WebSocket URL to `wss://your-domain.com/retell-llm`
4. Configure voice (e.g., ElevenLabs)
5. Save agent ID for use in calls

---

## Testing

### Local Testing

```bash
# Start server with WebSocket
npm run dev

# Test WebSocket connection
wscat -c ws://localhost:5000/retell-llm
```

### Test Scenarios

1. **Happy Path**: Identity → Reason → Commit → Close
2. **Cashflow Objection**: Identity → Reason → "Can't pay" → Payment plan → Commit → Close
3. **Dispute**: Identity → Reason → "Invoice wrong" → Note dispute → Close
4. **Wrong Person**: Identity denied → Request redirect → Close
5. **Voicemail**: No answer → Leave message → Close
