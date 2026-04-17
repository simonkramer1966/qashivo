/**
 * Strategy Selector — 12-strategy Fogg × Escalation matrix.
 *
 * Maps a diagnosed barrier (trigger/ability/motivation) and escalation stage
 * to one of 12 influence strategies, each carrying full PCP guidance,
 * technique lists, and formatting directives.
 */

import type { InfluenceBarrier } from "./barrierDiagnostic";

// ── Types ────────────────────────────────────────────────────

export type EscalationStage =
  | "first_contact"
  | "follow_up"
  | "escalation"
  | "pre_legal";

export interface InfluenceStrategy {
  name: string;
  barrier: InfluenceBarrier;
  stage: EscalationStage;
  pcpGuidance: {
    perception: string;
    context: string;
    permission: string;
  };
  techniques: string[];
  avoid: string[];
  toneAlignment: string;
  emailLength: string;
  subjectLineStyle: string;
}

// ── Stage derivation ─────────────────────────────────────────

export function deriveEscalationStage(communicationCount: number): EscalationStage {
  if (communicationCount === 0) return "first_contact";
  if (communicationCount <= 3) return "follow_up";
  if (communicationCount <= 5) return "escalation";
  return "pre_legal";
}

// ── Strategy matrix (3 barriers × 4 stages = 12 strategies) ──

const STRATEGY_MATRIX: Record<InfluenceBarrier, Record<EscalationStage, InfluenceStrategy>> = {
  trigger: {
    first_contact: {
      name: "Helpful Nudge",
      barrier: "trigger",
      stage: "first_contact",
      pcpGuidance: {
        perception: "Frame this as a helpful heads-up, not a demand. Open as if you're doing them a favour by flagging something they might have missed.",
        context: "State the invoice details clearly and concisely. Assume they want to pay and just need the information in front of them.",
        permission: "Make it easy to respond. Suggest one simple action: 'Could you let me know you've received this?' or 'Happy to resend the invoice if that helps.'",
      },
      techniques: [
        "Assume positive intent ('this may have slipped through')",
        "Offer to resend the invoice or provide details",
        "Keep the ask minimal — acknowledgement, not payment date",
      ],
      avoid: [
        "Asking for a payment date on first contact",
        "Mentioning overdue status prominently",
        "Using urgency language",
      ],
      toneAlignment: "Friendly",
      emailLength: "Short (80-120 words)",
      subjectLineStyle: "Helpful and specific — reference invoice number",
    },
    follow_up: {
      name: "Friendly Persistence",
      barrier: "trigger",
      stage: "follow_up",
      pcpGuidance: {
        perception: "Position yourself as checking in, not chasing. Reference the previous email naturally — 'I wanted to follow up on my earlier note.'",
        context: "Re-state the key details briefly. Add a small piece of new context (e.g. the due date has now passed).",
        permission: "Ask a soft question: 'Is there anything I can help with on this?' or 'Would it help if I sent the details to someone else in your team?'",
      },
      techniques: [
        "Reference previous communication naturally",
        "Offer alternative contact routes ('should I reach someone else?')",
        "Light social proof ('most clients find it easiest to...')",
      ],
      avoid: [
        "Expressing frustration at lack of response",
        "Repeating the first email verbatim",
        "Making it feel like a system-generated follow-up",
      ],
      toneAlignment: "Professional",
      emailLength: "Medium (100-150 words)",
      subjectLineStyle: "Re: or Follow-up — reference previous thread",
    },
    escalation: {
      name: "Authority Prompt",
      barrier: "trigger",
      stage: "escalation",
      pcpGuidance: {
        perception: "Introduce mild authority — this is now being handled at a more senior level, or mention that the account needs attention.",
        context: "Summarise the communication history briefly. State the balance clearly. Note the time elapsed.",
        permission: "Request a specific response by a specific date: 'Could you confirm receipt by [date]?' Make the action concrete.",
      },
      techniques: [
        "Imply seniority or escalation without being threatening",
        "Summarise the timeline ('I first wrote on X, then followed up on Y')",
        "Set a clear, reasonable response deadline",
      ],
      avoid: [
        "Threatening legal action at this stage",
        "Being passive-aggressive about silence",
        "Over-explaining the history",
      ],
      toneAlignment: "Firm",
      emailLength: "Medium (120-160 words)",
      subjectLineStyle: "Direct — 'Outstanding balance' or 'Action required'",
    },
    pre_legal: {
      name: "Formal Notice",
      barrier: "trigger",
      stage: "pre_legal",
      pcpGuidance: {
        perception: "Frame this as a formal, final attempt before the matter is escalated. The tone is serious but still professional — not hostile.",
        context: "Full summary of outstanding amount, invoice details, and communication history. Reference the statutory right to charge interest.",
        permission: "One clear action with a hard deadline: 'Please arrange payment of [amount] by [date] or contact me to discuss alternatives.'",
      },
      techniques: [
        "Reference statutory rights factually (Late Payment of Commercial Debts Act)",
        "State a clear deadline",
        "Offer one final opportunity to engage",
      ],
      avoid: [
        "Empty threats ('we will have no choice but to...' without specifics)",
        "Emotional language",
        "Over-lawyering the tone",
      ],
      toneAlignment: "Formal",
      emailLength: "Medium-long (150-200 words)",
      subjectLineStyle: "Formal — 'Final Notice' or 'Formal Payment Request'",
    },
  },

  ability: {
    first_contact: {
      name: "Empathetic Inquiry",
      barrier: "ability",
      stage: "first_contact",
      pcpGuidance: {
        perception: "Open with genuine empathy. Acknowledge that businesses sometimes face unexpected pressures. You're reaching out to understand, not to pressure.",
        context: "State the invoice briefly, but spend more words understanding the situation. Ask about any issues preventing payment.",
        permission: "Invite dialogue: 'If there's anything making this difficult, I'd genuinely like to hear about it so we can work something out.'",
      },
      techniques: [
        "Lead with curiosity, not demands",
        "Ask open-ended questions about their situation",
        "Signal willingness to be flexible",
      ],
      avoid: [
        "Demanding immediate payment when ability is the barrier",
        "Ignoring signals of financial difficulty",
        "Rigid deadline language",
      ],
      toneAlignment: "Friendly",
      emailLength: "Short-medium (100-140 words)",
      subjectLineStyle: "Soft — 'Checking in' or 'Your account with [company]'",
    },
    follow_up: {
      name: "Solution Offering",
      barrier: "ability",
      stage: "follow_up",
      pcpGuidance: {
        perception: "Position yourself as a problem-solver. You've noticed they might be having difficulty and you're here to help find a way forward.",
        context: "Reference any signals you have (partial payment, payment plan request, cashflow mention). Propose concrete options: instalment plan, extended terms, partial payment.",
        permission: "Offer two or three specific options: 'Would any of these work for you? (a) split into two payments, (b) pay by [date], (c) something else that suits you better.'",
      },
      techniques: [
        "Propose concrete payment options (not open-ended)",
        "Acknowledge any payments already made with genuine thanks",
        "Use 'we can work this out' language",
      ],
      avoid: [
        "Ignoring partial payments or broken promises without acknowledging them",
        "Making them feel judged for financial difficulty",
        "One-size-fits-all demands",
      ],
      toneAlignment: "Professional",
      emailLength: "Medium (130-170 words)",
      subjectLineStyle: "Collaborative — 'Payment options for [invoice]'",
    },
    escalation: {
      name: "Structured Resolution",
      barrier: "ability",
      stage: "escalation",
      pcpGuidance: {
        perception: "You understand the difficulty but need to find a resolution. Frame this as a shared problem that needs a plan.",
        context: "Lay out the facts clearly: what's owed, what's been paid, what was promised. Reference any broken arrangements factually, without blame.",
        permission: "Propose a structured resolution with a specific timeline: 'I'd like to suggest [plan]. Could we agree on this by [date]?'",
      },
      techniques: [
        "Reference any previous arrangements or promises factually",
        "Propose a formal payment plan with specific dates and amounts",
        "Use 'let's find a way through this' framing",
      ],
      avoid: [
        "Shaming them for broken promises",
        "Withdrawing flexibility suddenly",
        "Ignoring their situation",
      ],
      toneAlignment: "Firm but empathetic",
      emailLength: "Medium-long (150-190 words)",
      subjectLineStyle: "Resolution-focused — 'Payment arrangement for [amount]'",
    },
    pre_legal: {
      name: "Compassionate Firmness",
      barrier: "ability",
      stage: "pre_legal",
      pcpGuidance: {
        perception: "Acknowledge the difficulty one final time, but be clear that the matter now requires resolution. You've been patient and flexible — now you need a commitment.",
        context: "Full account summary. Reference all previous attempts to help. State what happens next if no resolution is reached.",
        permission: "Final, specific ask: 'Please contact me by [date] to confirm a payment plan. If I don't hear from you, I'll need to refer the matter for formal recovery.'",
      },
      techniques: [
        "Acknowledge past patience and flexibility you've shown",
        "Be factual about consequences without being threatening",
        "Leave the door open for one final conversation",
      ],
      avoid: [
        "Being cruel or dismissive of their situation",
        "Withdrawing all empathy suddenly",
        "Empty threats",
      ],
      toneAlignment: "Formal but human",
      emailLength: "Medium-long (160-200 words)",
      subjectLineStyle: "Serious — 'Urgent: resolution needed for [amount]'",
    },
  },

  motivation: {
    first_contact: {
      name: "Professional Reminder",
      barrier: "motivation",
      stage: "first_contact",
      pcpGuidance: {
        perception: "Establish professional credibility immediately. You are a named person at a real company, not a system notification.",
        context: "State the facts crisply: invoice number, amount, due date, days overdue. No fluff.",
        permission: "Direct but polite ask: 'Could you arrange payment this week?' or 'When can I expect this to be settled?'",
      },
      techniques: [
        "Be concise and businesslike — respect their time",
        "State facts without editorialising",
        "One clear ask, no hedging",
      ],
      avoid: [
        "Over-friendliness when the debtor is likely deliberate",
        "Burying the ask in pleasantries",
        "Apologising for chasing ('sorry to bother you')",
      ],
      toneAlignment: "Professional",
      emailLength: "Short (80-110 words)",
      subjectLineStyle: "Direct — invoice number and amount",
    },
    follow_up: {
      name: "Social Proof + Consequence",
      barrier: "motivation",
      stage: "follow_up",
      pcpGuidance: {
        perception: "Position timely payment as the norm. Most businesses pay on time — this is an outlier.",
        context: "Re-state the overdue amount. Mention the time elapsed. Introduce the first light consequence: 'Accounts that remain overdue beyond [period] are flagged for review.'",
        permission: "Firm ask with a date: 'I need to hear from you by [date] regarding when this will be settled.'",
      },
      techniques: [
        "Light social proof ('our standard payment terms are respected by the majority of our clients')",
        "Introduce future consequences factually, not threateningly",
        "Set a specific response deadline",
      ],
      avoid: [
        "Lecturing or moralising",
        "Making the debtor feel singled out",
        "Vague 'further action' language without specifics",
      ],
      toneAlignment: "Professional to firm",
      emailLength: "Medium (110-150 words)",
      subjectLineStyle: "Assertive — 'Overdue: [amount] past due date'",
    },
    escalation: {
      name: "Direct Consequence",
      barrier: "motivation",
      stage: "escalation",
      pcpGuidance: {
        perception: "This is serious. Frame the communication as a formal escalation — the matter has been raised internally.",
        context: "Timeline of all communication attempts. Total outstanding. Days overdue. State the consequences clearly: interest charges, credit reporting, referral to recovery.",
        permission: "Binary choice: 'Please arrange payment of [amount] by [date], or contact me to discuss. If I don't hear from you by [date], the account will be referred for formal recovery.'",
      },
      techniques: [
        "Factual escalation timeline",
        "Specific, real consequences (not vague threats)",
        "Binary choice — pay or engage",
      ],
      avoid: [
        "Personal attacks or judgements",
        "Over-escalating beyond what you can actually do",
        "Multiple demands in one email",
      ],
      toneAlignment: "Firm",
      emailLength: "Medium (130-170 words)",
      subjectLineStyle: "Urgent — 'Escalation: [amount] overdue'",
    },
    pre_legal: {
      name: "Legal Framing",
      barrier: "motivation",
      stage: "pre_legal",
      pcpGuidance: {
        perception: "This is the final communication before formal proceedings. The tone is factual and legal, but still offers a last chance.",
        context: "Full account summary. All previous attempts documented. Reference statutory rights (Late Payment of Commercial Debts Act). State exactly what will happen and when.",
        permission: "Final deadline with specific consequence: 'Payment of [amount] must be received by [date]. If not received, the matter will be referred to [recovery agent/solicitor] without further notice.'",
      },
      techniques: [
        "Reference specific legislation factually",
        "State the exact next step (not 'further action')",
        "Offer one final opportunity to resolve directly",
      ],
      avoid: [
        "Emotional language",
        "Empty threats you can't back up",
        "Multiple pages of legal-sounding waffle",
      ],
      toneAlignment: "Formal",
      emailLength: "Medium-long (150-200 words)",
      subjectLineStyle: "Legal — 'Final Notice Before Formal Recovery'",
    },
  },
};

// ── Public API ────────────────────────────────────────────────

export function selectStrategy(
  barrier: InfluenceBarrier,
  stage: EscalationStage,
): InfluenceStrategy {
  return STRATEGY_MATRIX[barrier][stage];
}
