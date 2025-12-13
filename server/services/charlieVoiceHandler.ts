/**
 * Charlie Voice Handler - Custom LLM WebSocket Handler for Retell
 * 
 * Manages conversation state machine for voice calls, using Charlie's
 * playbook templates and tone profiles for deterministic responses.
 */

import OpenAI from 'openai';
import {
  VoiceScript,
  TemplateContext,
  selectVoiceScript,
  renderTemplate,
  VOICE_SCRIPTS,
} from './charliePlaybook.js';
import { VoiceTone, TemplateId, ToneProfile } from './playbookEngine.js';
import { CharlieInvoiceState } from './invoiceStateMachine.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// TYPES
// ============================================================================

export type ConversationState = 
  | 'greeting'
  | 'reason_for_call'
  | 'inquiry'
  | 'objection_payment_coming'
  | 'objection_cashflow'
  | 'objection_dispute'
  | 'objection_wrong_person'
  | 'objection_not_received'
  | 'objection_needs_approval'
  | 'objection_missing_po'
  | 'ptp_capture'
  | 'closing'
  | 'transfer'
  | 'ended';

export type UserIntent =
  | 'identity_confirmed'
  | 'identity_denied'
  | 'payment_in_progress'
  | 'cashflow_issue'
  | 'dispute'
  | 'wrong_person'
  | 'not_received_invoice'
  | 'needs_approval'
  | 'missing_po'
  | 'ready_to_commit'
  | 'refuses_to_pay'
  | 'request_callback'
  | 'request_transfer'
  | 'general_acknowledgment'
  | 'unclear';

export interface CallContext {
  callId: string;
  customerName: string;
  companyName: string;
  invoiceNumber: string;
  invoiceAmount: string;
  totalOutstanding: string;
  daysOverdue: number;
  dueDate: string;
  charlieState: CharlieInvoiceState;
  voiceTone: VoiceTone;
  templateId: TemplateId;
  senderCompany: string;
  senderName: string;
  contactNumber: string;
  hasPriorPtp?: boolean;
  promisedDate?: string;
  priorAttempts?: number;
  customerSegment?: string;
  minimumPayment?: string;
  deadlineDate?: string;
}

export interface ConversationSession {
  callId: string;
  state: ConversationState;
  context: CallContext;
  transcript: Array<{ role: 'agent' | 'user'; content: string }>;
  capturedPtp?: {
    amount?: string;
    date?: string;
  };
  capturedDispute?: string;
  outcome?: string;
  startedAt: Date;
}

export interface RetellRequest {
  interaction_type: 'response_required' | 'reminder_required' | 'update_only';
  transcript: Array<{ role: 'agent' | 'user'; content: string }>;
  call_id: string;
  metadata?: Record<string, any>;
}

export interface RetellResponse {
  response_id: number;
  content: string;
  content_complete: boolean;
  end_call: boolean;
}

// ============================================================================
// CONVERSATION STATE MANAGER
// ============================================================================

class ConversationManager {
  private sessions: Map<string, ConversationSession> = new Map();

  getSession(callId: string): ConversationSession | undefined {
    return this.sessions.get(callId);
  }

  createSession(callId: string, context: CallContext): ConversationSession {
    const session: ConversationSession = {
      callId,
      state: 'greeting',
      context,
      transcript: [],
      startedAt: new Date(),
    };
    this.sessions.set(callId, session);
    return session;
  }

  updateState(callId: string, state: ConversationState): void {
    const session = this.sessions.get(callId);
    if (session) {
      session.state = state;
    }
  }

  addTranscript(callId: string, role: 'agent' | 'user', content: string): void {
    const session = this.sessions.get(callId);
    if (session) {
      session.transcript.push({ role, content });
    }
  }

  capturePtp(callId: string, amount?: string, date?: string): void {
    const session = this.sessions.get(callId);
    if (session) {
      session.capturedPtp = { amount, date };
    }
  }

  captureDispute(callId: string, details: string): void {
    const session = this.sessions.get(callId);
    if (session) {
      session.capturedDispute = details;
    }
  }

  setOutcome(callId: string, outcome: string): void {
    const session = this.sessions.get(callId);
    if (session) {
      session.outcome = outcome;
    }
  }

  endSession(callId: string): ConversationSession | undefined {
    const session = this.sessions.get(callId);
    if (session) {
      session.state = 'ended';
      this.sessions.delete(callId);
    }
    return session;
  }
}

const conversationManager = new ConversationManager();

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

async function classifyIntent(userMessage: string, conversationHistory: Array<{ role: 'agent' | 'user'; content: string }>): Promise<UserIntent> {
  const systemPrompt = `You are an intent classifier for a debt collection call. Classify the customer's response into one of these categories:

- identity_confirmed: Customer confirms they are the right person ("Yes, this is John", "Speaking", "That's me")
- identity_denied: Customer says they're not that person ("No, wrong number", "You have the wrong person")
- payment_in_progress: Customer says payment is coming or sent ("I paid last week", "It's in the post", "We sent it")
- cashflow_issue: Customer mentions financial difficulties ("Cash flow is tight", "We're struggling", "Can't pay right now")
- dispute: Customer disputes the invoice ("That's wrong", "We don't owe that", "There's a problem with the invoice")
- wrong_person: Customer says they don't handle payments ("I don't deal with invoices", "You need accounts payable")
- not_received_invoice: Customer didn't get the invoice ("Never received it", "Didn't get that", "Can you resend?")
- needs_approval: Customer needs internal approval ("Need to check with my boss", "Has to go through finance")
- missing_po: Customer needs a PO number ("We need a purchase order", "What's the PO?")
- ready_to_commit: Customer is ready to commit to payment ("I can pay Friday", "We'll pay next week", "How about the 15th?")
- refuses_to_pay: Customer explicitly refuses ("We're not paying", "No", "Forget it")
- request_callback: Customer asks to call back later ("Can you call back?", "I'm busy right now")
- request_transfer: Customer wants a manager ("Let me speak to a manager", "I want to escalate this")
- general_acknowledgment: General acknowledgment without clear intent ("OK", "I see", "Right", "Uh huh")
- unclear: Cannot determine intent

Respond with ONLY the intent category, nothing else.`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-4).map(t => ({
      role: t.role === 'agent' ? 'assistant' as const : 'user' as const,
      content: t.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 50,
      temperature: 0,
    });

    const intent = response.choices[0]?.message?.content?.trim().toLowerCase() as UserIntent;
    
    const validIntents: UserIntent[] = [
      'identity_confirmed', 'identity_denied', 'payment_in_progress', 'cashflow_issue',
      'dispute', 'wrong_person', 'not_received_invoice', 'needs_approval', 'missing_po',
      'ready_to_commit', 'refuses_to_pay', 'request_callback', 'request_transfer',
      'general_acknowledgment', 'unclear'
    ];
    
    return validIntents.includes(intent) ? intent : 'unclear';
  } catch (error) {
    console.error('Intent classification failed:', error);
    return 'unclear';
  }
}

// ============================================================================
// RESPONSE GENERATION
// ============================================================================

function getToneAdjustedResponse(baseResponse: string, tone: VoiceTone): string {
  return baseResponse;
}

function getGreetingResponse(context: CallContext): string {
  const { voiceTone, customerName, senderCompany } = context;
  
  switch (voiceTone) {
    case VoiceTone.VOICE_TONE_CALM_COLLABORATIVE:
      return `Hello, this is Charlie calling from ${senderCompany}. Am I speaking with ${customerName}?`;
    case VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE:
      return `Hello, this is Charlie from ${senderCompany}'s credit control team. Is this ${customerName}?`;
    case VoiceTone.VOICE_TONE_FORMAL_RECOVERY:
      return `Good day. I'm calling from ${senderCompany} regarding an urgent account matter. Am I speaking with ${customerName}?`;
    default:
      return `Hello, this is Charlie calling from ${senderCompany}. Am I speaking with ${customerName}?`;
  }
}

function getReasonForCallResponse(context: CallContext): string {
  const { charlieState, voiceTone, invoiceNumber, invoiceAmount, daysOverdue, promisedDate, totalOutstanding } = context;
  
  if (charlieState === 'ptp_missed' && promisedDate) {
    return `Thank you. I'm following up on a payment that was promised for ${promisedDate} but hasn't arrived yet. Invoice ${invoiceNumber} for ${invoiceAmount} is now ${daysOverdue} days overdue. We need to understand what happened and get a new commitment today.`;
  }
  
  if (charlieState === 'final_demand') {
    return `Thank you. I'm calling because invoice ${invoiceNumber} for ${invoiceAmount} is now ${daysOverdue} days seriously overdue. We've made several attempts to contact you about this. This matter needs to be resolved today to avoid further action. What is preventing payment from being made?`;
  }
  
  if (charlieState === 'debt_recovery') {
    return `Thank you. Your account is now significantly past due with a balance of ${totalOutstanding || invoiceAmount}. This has reached a stage where we must discuss immediate resolution. We'd prefer to resolve this directly rather than involving third parties. What can be done to settle this account today?`;
  }
  
  return `Thank you. I'm calling about invoice ${invoiceNumber} for ${invoiceAmount}, which was due on ${context.dueDate} and is now ${daysOverdue} days overdue. I wanted to check if there's anything preventing payment, and confirm when we can expect this to be settled.`;
}

function getObjectionResponse(objectionType: string, context: CallContext): string {
  const { voiceTone, minimumPayment, invoiceNumber, invoiceAmount } = context;
  const script = selectVoiceScript(context.templateId, voiceTone);
  
  if (script?.objectionHandlers && script.objectionHandlers[objectionType]) {
    let response = script.objectionHandlers[objectionType];
    response = response.replace('{{minimumPayment}}', minimumPayment || '£500');
    response = response.replace('{{invoiceNumber}}', invoiceNumber);
    response = response.replace('{{invoiceAmount}}', invoiceAmount);
    return response;
  }
  
  const defaultHandlers: Record<string, Partial<Record<VoiceTone, string>>> = {
    payment_in_progress: {
      [VoiceTone.VOICE_TONE_CALM_COLLABORATIVE]: "That's good news. Do you have an expected date for when the payment will clear?",
      [VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE]: "That's great to hear. Can you provide a reference number or the date the payment was sent so we can track it?",
      [VoiceTone.VOICE_TONE_FORMAL_RECOVERY]: "I'll need evidence of that payment to halt any further action. Can you email proof of payment to us today?",
      [VoiceTone.VOICE_TONE_LEGAL_INFO]: "I'll need evidence of that payment to halt any further action. Can you email proof of payment to us today?",
    },
    cash_flow_issue: {
      [VoiceTone.VOICE_TONE_CALM_COLLABORATIVE]: "I understand. What's a realistic date you could commit to? Even a partial payment would help.",
      [VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE]: "I understand cash flow can be challenging. Can we discuss a payment plan? What amount could you commit to this week?",
      [VoiceTone.VOICE_TONE_FORMAL_RECOVERY]: `At this stage, we need a formal payment arrangement. Can you commit to at least ${minimumPayment || '£500'} weekly?`,
      [VoiceTone.VOICE_TONE_LEGAL_INFO]: `At this stage, we need a formal payment arrangement. Can you commit to at least ${minimumPayment || '£500'} weekly?`,
    },
    dispute: {
      [VoiceTone.VOICE_TONE_CALM_COLLABORATIVE]: "Let me understand the concern so we can address it. What's the specific issue?",
      [VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE]: "I understand there's a concern. Let me note the details so we can investigate. What specifically is the issue?",
      [VoiceTone.VOICE_TONE_FORMAL_RECOVERY]: "Any dispute should have been raised earlier. Please put your concerns in writing and we'll review. Meanwhile, undisputed amounts remain payable.",
      [VoiceTone.VOICE_TONE_LEGAL_INFO]: "Any dispute should have been raised earlier. Please put your concerns in writing and we'll review. Meanwhile, undisputed amounts remain payable.",
    },
    wrong_person: {
      [VoiceTone.VOICE_TONE_CALM_COLLABORATIVE]: "I apologize for any confusion. Could you direct me to the right person for accounts payable?",
      [VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE]: "I apologize for any confusion. Could you direct me to the right person for accounts payable?",
      [VoiceTone.VOICE_TONE_FORMAL_RECOVERY]: "I apologize. Who handles accounts payable, and can you transfer me to them now?",
      [VoiceTone.VOICE_TONE_LEGAL_INFO]: "I apologize. Who handles accounts payable, and can you transfer me to them now?",
    },
    not_received_invoice: {
      [VoiceTone.VOICE_TONE_CALM_COLLABORATIVE]: "I can resend that right away. What email address should I use, and who should it be addressed to?",
      [VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE]: "I can resend that right away. What email address should I use, and who should it be addressed to?",
      [VoiceTone.VOICE_TONE_FORMAL_RECOVERY]: "I can resend that immediately. What email address should I use? Once received, we'll need payment within 48 hours.",
      [VoiceTone.VOICE_TONE_LEGAL_INFO]: "I can resend that immediately. What email address should I use? Once received, we'll need payment within 48 hours.",
    },
    needs_approval: {
      [VoiceTone.VOICE_TONE_CALM_COLLABORATIVE]: "I understand there's an approval process. Who needs to approve this, and by when can we expect that?",
      [VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE]: "Who is the decision maker, and can you connect me to them now?",
      [VoiceTone.VOICE_TONE_FORMAL_RECOVERY]: "Who is the decision maker? Given the urgency, I need to speak with them today.",
      [VoiceTone.VOICE_TONE_LEGAL_INFO]: "Who is the decision maker? Given the urgency, I need to speak with them today.",
    },
  };
  
  const handlerKey = objectionType.replace('cashflow_issue', 'cash_flow_issue');
  return defaultHandlers[handlerKey]?.[voiceTone] || "I understand. Can you tell me more about the situation?";
}

function getPtpCaptureResponse(context: CallContext): string {
  const { voiceTone, charlieState } = context;
  
  if (charlieState === 'ptp_missed') {
    return "Given the previous commitment wasn't met, I need a firm date today. When exactly will this payment be made, and for how much?";
  }
  
  switch (voiceTone) {
    case VoiceTone.VOICE_TONE_CALM_COLLABORATIVE:
      return "When can you make this payment? Even a partial payment would help us resolve this.";
    case VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE:
      return "What date can you commit to for this payment? I need a specific date to note on your account.";
    case VoiceTone.VOICE_TONE_FORMAL_RECOVERY:
      return "To avoid further action, I need a commitment today. What is the maximum you can pay, and when?";
    default:
      return "When can we expect this payment to be made?";
  }
}

function getClosingResponse(context: CallContext, capturedPtp?: { amount?: string; date?: string }): string {
  const { voiceTone, senderCompany, deadlineDate } = context;
  
  if (capturedPtp?.amount && capturedPtp?.date) {
    const baseClosing = `Thank you for your time. To confirm, you've committed to paying ${capturedPtp.amount} by ${capturedPtp.date}. I'll send a follow-up email confirming this arrangement.`;
    
    if (voiceTone === VoiceTone.VOICE_TONE_FORMAL_RECOVERY && deadlineDate) {
      return `${baseClosing} Please note that if this commitment isn't met, the account will be escalated for further action.`;
    }
    
    return baseClosing + " Is there anything else you need from us?";
  }
  
  return `Thank you for your time today. We'll follow up in writing. If you have any questions, please contact us at ${senderCompany}. Goodbye.`;
}

// ============================================================================
// STATE MACHINE TRANSITIONS
// ============================================================================

function getNextState(currentState: ConversationState, intent: UserIntent, context: CallContext): ConversationState {
  switch (currentState) {
    case 'greeting':
      if (intent === 'identity_confirmed') return 'reason_for_call';
      if (intent === 'identity_denied' || intent === 'wrong_person') return 'objection_wrong_person';
      return 'greeting';
    
    case 'reason_for_call':
      return 'inquiry';
    
    case 'inquiry':
      switch (intent) {
        case 'payment_in_progress': return 'objection_payment_coming';
        case 'cashflow_issue': return 'objection_cashflow';
        case 'dispute': return 'objection_dispute';
        case 'wrong_person': return 'objection_wrong_person';
        case 'not_received_invoice': return 'objection_not_received';
        case 'needs_approval': return 'objection_needs_approval';
        case 'missing_po': return 'objection_missing_po';
        case 'ready_to_commit': return 'ptp_capture';
        case 'refuses_to_pay': return 'closing';
        case 'request_callback': return 'closing';
        case 'request_transfer': return 'transfer';
        case 'general_acknowledgment': return 'ptp_capture';
        default: return 'ptp_capture';
      }
    
    case 'objection_payment_coming':
    case 'objection_cashflow':
    case 'objection_dispute':
    case 'objection_not_received':
    case 'objection_needs_approval':
    case 'objection_missing_po':
      if (intent === 'ready_to_commit') return 'ptp_capture';
      if (intent === 'refuses_to_pay') return 'closing';
      if (intent === 'general_acknowledgment') return 'ptp_capture';
      return 'ptp_capture';
    
    case 'objection_wrong_person':
      return 'closing';
    
    case 'ptp_capture':
      if (intent === 'ready_to_commit') return 'closing';
      if (intent === 'refuses_to_pay') return 'closing';
      return 'closing';
    
    case 'transfer':
      return 'ended';
    
    case 'closing':
      return 'ended';
    
    default:
      return 'ended';
  }
}

function getResponseForState(state: ConversationState, context: CallContext, intent?: UserIntent, session?: ConversationSession): string {
  switch (state) {
    case 'greeting':
      return getGreetingResponse(context);
    
    case 'reason_for_call':
      return getReasonForCallResponse(context);
    
    case 'inquiry':
      return getPtpCaptureResponse(context);
    
    case 'objection_payment_coming':
      return getObjectionResponse('payment_in_progress', context);
    
    case 'objection_cashflow':
      return getObjectionResponse('cash_flow_issue', context);
    
    case 'objection_dispute':
      return getObjectionResponse('dispute', context);
    
    case 'objection_wrong_person':
      return getObjectionResponse('wrong_person', context) + " Thank you for your help. Goodbye.";
    
    case 'objection_not_received':
      return getObjectionResponse('not_received_invoice', context);
    
    case 'objection_needs_approval':
      return getObjectionResponse('needs_approval', context);
    
    case 'objection_missing_po':
      return "I can help with that. What PO number should be on the invoice? I'll update it immediately.";
    
    case 'ptp_capture':
      return getPtpCaptureResponse(context);
    
    case 'closing':
      return getClosingResponse(context, session?.capturedPtp);
    
    case 'transfer':
      return "I understand. Let me transfer you to a supervisor who can help further. Please hold.";
    
    default:
      return "Thank you for your time. Goodbye.";
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handleRetellRequest(request: RetellRequest): Promise<RetellResponse> {
  const { call_id, interaction_type, transcript, metadata } = request;
  
  let session = conversationManager.getSession(call_id);
  
  if (!session && metadata) {
    const context: CallContext = {
      callId: call_id,
      customerName: metadata.customer_name || 'Customer',
      companyName: metadata.company_name || 'Company',
      invoiceNumber: metadata.invoice_number || 'Unknown',
      invoiceAmount: metadata.invoice_amount || '£0',
      totalOutstanding: metadata.total_outstanding || metadata.invoice_amount || '£0',
      daysOverdue: metadata.days_overdue || 0,
      dueDate: metadata.due_date || 'Unknown',
      charlieState: metadata.charlie_state || 'chasing',
      voiceTone: metadata.voice_tone || VoiceTone.VOICE_TONE_CALM_COLLABORATIVE,
      templateId: metadata.template_id || TemplateId.VOICE_PTP_REQUEST,
      senderCompany: metadata.sender_company || 'Your Company',
      senderName: metadata.sender_name || 'Charlie',
      contactNumber: metadata.contact_number || '',
      hasPriorPtp: metadata.has_prior_ptp || false,
      promisedDate: metadata.promised_date,
      priorAttempts: metadata.prior_attempts || 0,
      customerSegment: metadata.customer_segment,
      minimumPayment: metadata.minimum_payment,
      deadlineDate: metadata.deadline_date,
    };
    
    session = conversationManager.createSession(call_id, context);
    
    const greeting = getGreetingResponse(context);
    conversationManager.addTranscript(call_id, 'agent', greeting);
    
    return {
      response_id: 0,
      content: greeting,
      content_complete: true,
      end_call: false,
    };
  }
  
  if (!session) {
    return {
      response_id: 0,
      content: "I apologize, there seems to be a technical issue. Please call us back. Goodbye.",
      content_complete: true,
      end_call: true,
    };
  }
  
  const lastUserMessage = transcript.filter(t => t.role === 'user').pop()?.content || '';
  
  if (lastUserMessage) {
    conversationManager.addTranscript(call_id, 'user', lastUserMessage);
  }
  
  if (interaction_type === 'reminder_required') {
    const reminder = session.state === 'greeting' 
      ? "Hello? Are you still there?"
      : "Are you still with me?";
    return {
      response_id: 0,
      content: reminder,
      content_complete: true,
      end_call: false,
    };
  }
  
  const intent = await classifyIntent(lastUserMessage, session.transcript);
  console.log(`[Charlie Voice] Call ${call_id}: Intent detected: ${intent} in state: ${session.state}`);
  
  if (intent === 'ready_to_commit' && lastUserMessage) {
    const dateMatch = lastUserMessage.match(/(\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)?|\w+day|tomorrow|next\s+\w+)/i);
    const amountMatch = lastUserMessage.match(/[£$]?\d+(?:,\d{3})*(?:\.\d{2})?/);
    
    if (dateMatch || amountMatch) {
      conversationManager.capturePtp(
        call_id,
        amountMatch?.[0] || session.context.invoiceAmount,
        dateMatch?.[0] || 'as agreed'
      );
    }
  }
  
  if (intent === 'dispute' && lastUserMessage) {
    conversationManager.captureDispute(call_id, lastUserMessage);
  }
  
  const nextState = getNextState(session.state, intent, session.context);
  conversationManager.updateState(call_id, nextState);
  
  const response = getResponseForState(nextState, session.context, intent, session);
  conversationManager.addTranscript(call_id, 'agent', response);
  
  const shouldEndCall = nextState === 'ended' || 
    (nextState === 'closing' && !session.capturedPtp) ||
    (session.state === 'objection_wrong_person');
  
  if (shouldEndCall) {
    let outcome = 'unknown';
    if (session.capturedPtp?.date) outcome = 'ptp_captured';
    else if (session.capturedDispute) outcome = 'dispute_raised';
    else if (intent === 'payment_in_progress') outcome = 'payment_confirmed';
    else if (intent === 'refuses_to_pay') outcome = 'refused';
    else if (intent === 'wrong_person') outcome = 'wrong_contact';
    else if (intent === 'request_callback') outcome = 'callback_requested';
    
    conversationManager.setOutcome(call_id, outcome);
    
    const endedSession = conversationManager.endSession(call_id);
    console.log(`[Charlie Voice] Call ${call_id} ended with outcome: ${outcome}`, endedSession);
  }
  
  return {
    response_id: transcript.length,
    content: response,
    content_complete: true,
    end_call: shouldEndCall,
  };
}

export { conversationManager };
