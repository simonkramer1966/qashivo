import { generateJSON } from "./llm/claude";
import { db } from "../db";
import { logSystemError } from "./admin/errorLogger";
import { inboundMessages, actions, contacts, invoices, paymentPlans, paymentPlanInvoices, users, outcomes, emailClarifications, tenants, emailMessages, customerContactPersons, forecastUserAdjustments, paymentPromises, timelineEvents, aiFacts } from "@shared/schema";
import { eq, and, desc, inArray, notInArray, asc, sql, gte, lt } from "drizzle-orm";
import { getPromiseReliabilityService } from "./promiseReliabilityService.js";
import { emailClarificationService } from "./emailClarificationService.js";
import { processInboundReply } from "./inboundReplyPipeline";
import { transitionState } from "./conversationStateService";
import { signalCollector } from "../lib/signal-collector";

// Outcome types that map to CharlieIntentType
type OutcomeType = 
  | 'PROMISE_TO_PAY'
  | 'PAYMENT_PLAN' 
  | 'DISPUTE'
  | 'PAYMENT_CONFIRMATION'
  | 'CALLBACK_REQUEST'
  | 'ADMIN_BLOCKER'
  | 'QUERY'
  | 'UNKNOWN';

// Map intent types to outcome types
const INTENT_TO_OUTCOME_TYPE: Record<CharlieIntentType, OutcomeType> = {
  'promise_to_pay': 'PROMISE_TO_PAY',
  'payment_plan': 'PAYMENT_PLAN',
  'dispute': 'DISPUTE',
  'payment_confirmation': 'PAYMENT_CONFIRMATION',
  'payment_notification': 'PAYMENT_CONFIRMATION',
  'acknowledge': 'QUERY',
  'callback_request': 'CALLBACK_REQUEST',
  'admin_issue': 'ADMIN_BLOCKER',
  'general_query': 'QUERY',
  'payment_query': 'QUERY',
  'general': 'QUERY',
  'unclear': 'UNKNOWN',
  'unknown': 'UNKNOWN'
};

// Forecast effect for each outcome type
type ForecastEffect = 'FORECAST_UPDATED' | 'ROUTED_TO_ATTENTION' | 'MANUAL_REVIEW' | 'NO_EFFECT';
const OUTCOME_FORECAST_EFFECTS: Record<OutcomeType, ForecastEffect> = {
  'PROMISE_TO_PAY': 'FORECAST_UPDATED',
  'PAYMENT_PLAN': 'FORECAST_UPDATED',
  'DISPUTE': 'ROUTED_TO_ATTENTION',
  'PAYMENT_CONFIRMATION': 'FORECAST_UPDATED',
  'CALLBACK_REQUEST': 'NO_EFFECT',
  'ADMIN_BLOCKER': 'ROUTED_TO_ATTENTION',
  'QUERY': 'NO_EFFECT',
  'UNKNOWN': 'MANUAL_REVIEW'
};

// Claude LLM via server/services/llm/claude.ts

// Charlie-aligned intent types for B2B credit control
type CharlieIntentType =
  | 'promise_to_pay'        // Customer commits to paying by specific date
  | 'acknowledge'           // Customer acknowledges receipt / will look into it (no firm commitment)
  | 'dispute'               // Customer disputes the invoice
  | 'payment_notification'  // Customer confirms payment has been made or is in process
  | 'payment_query'         // Questions about invoice, payment process, amounts
  | 'payment_plan'          // Customer wants to negotiate payment plan
  | 'payment_confirmation'  // LEGACY alias — kept for backward compat, maps to payment_notification
  | 'callback_request'      // Customer requests a phone call back
  | 'admin_issue'           // Missing PO, wrong address, not received, etc.
  | 'general_query'         // LEGACY alias — kept for backward compat, maps to payment_query
  | 'general'               // General non-payment communication
  | 'unclear'               // Intent genuinely unclear — needs human review
  | 'unknown';              // Fallback

// Ambiguity types for clarification requests
type AmbiguityType = 'invoice_reference' | 'payment_amount' | 'payment_date' | 'multiple_invoices' | 'none';

interface AmbiguityInfo {
  hasAmbiguity: boolean;
  types: AmbiguityType[];
  details: {
    unclearInvoices?: boolean;    // Can't determine which invoice(s)
    unclearAmount?: boolean;      // Amount mentioned doesn't match or is vague
    unclearDate?: boolean;        // No date given or date is vague
    multipleInvoices?: boolean;   // Debtor has multiple invoices, unclear which they mean
    clarificationQuestions?: string[]; // Specific questions to ask
  };
}

interface IntentAnalysisResult {
  intentType: CharlieIntentType;
  confidence: number; // 0.00 to 1.00
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated';
  extractedEntities: {
    amounts?: string[];
    dates?: string[];
    resolvedDates?: string[];      // ISO dates resolved from relative expressions
    promises?: string[];
    reasons?: string[];
    invoiceReferences?: string[];  // Invoice numbers, PO numbers
    contactPreferences?: string[]; // Phone, email preferences
    disputeReason?: string;        // Specific dispute reason
    affectedInvoices?: string[];   // Which invoices the dispute covers
    suggestedApproach?: string;    // Brief guidance for the Collections Agent's reply
  };
  reasoning: string;
  requiresHumanReview: boolean;    // Flag for edge cases
  suggestedNextAction?: string;    // Charlie's recommended action
  ambiguity?: AmbiguityInfo;       // Ambiguity details for clarification flow
}

/**
 * Intent Analyst Service
 * Analyzes inbound communications to detect intent and create actionable items
 */
class IntentAnalyst {
  private readonly CONFIDENCE_THRESHOLD = 0.6;
  
  /**
   * Analyse an inbound message using Claude
   */
  async analyzeIntent(messageContent: string, context?: {
    contactName?: string;
    companyName?: string;
    invoiceAmount?: number;
    invoiceNumbers?: string[];
    daysPastDue?: number;
    conversationContext?: string;
  }): Promise<IntentAnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(messageContent, context);

      const result = await generateJSON<any>({
        logContext: { caller: 'intent_analysis' },
        system: `You are Charlie, an expert B2B credit control AI analysing inbound debtor communications.
Your role is to detect intent, extract actionable information, and recommend the Collections Agent's response approach.

Intent Types (in priority order):
- promise_to_pay: Debtor commits to paying by a specific date or timeframe. MUST extract the date.
  Date extraction rules:
  • "end of month" → last day of current month (resolve to ISO date)
  • "next Friday" → the coming Friday (resolve to ISO date)
  • "15th March" → 2026-03-15 (resolve to ISO date)
  • "within 7 days" → today + 7 days (resolve to ISO date)
  • "by close of play tomorrow" → tomorrow's date
  • Always resolve relative dates to absolute ISO dates in resolvedDates.
- acknowledge: Debtor acknowledges receipt or says they'll look into it but makes NO firm payment commitment (e.g., "thanks, I'll check this", "noted", "I'll get back to you"). Do NOT classify as promise_to_pay.
- dispute: Debtor disputes the invoice — extract the dispute_reason (quality, delivery, pricing, scope, wrong amount, not received) and which invoice(s) are affected in affectedInvoices.
- payment_notification: Debtor confirms payment has already been made or is in process (e.g., "payment sent", "BACS submitted today", "already paid this").
- payment_query: Questions about invoice amounts, payment details, bank details, or how to pay.
- payment_plan: Debtor wants to negotiate instalments or staged payments.
- callback_request: Debtor explicitly asks to be called back or prefers phone.
- admin_issue: Missing PO, wrong billing address, invoice not received, supplier setup issues.
- general: General non-payment communication that doesn't fit other categories.
- unclear: Intent is genuinely unclear or the message is too brief/vague to classify.

Sentiment: Assess the debtor's emotional state:
- positive: Cooperative, willing to pay, friendly
- neutral: Business-like, factual, no strong emotion
- negative: Unhappy, complaining, pushing back
- frustrated: Angry, repeated chasing complaints, threatens escalation, hostile language

Suggested Approach: Provide brief guidance for the Collections Agent's reply — e.g., "Acknowledge PTP and confirm date", "Empathise with dispute, request specifics", "Thank for payment notification, confirm receipt when cleared".

Critical Rules:
1. Look for admin blockers (missing PO, wrong address) — common in B2B recruitment sector
2. Extract invoice/PO references when mentioned
3. Note preferred contact methods
4. Consider B2B context: professional tone expected, process-driven issues common
5. Use "acknowledge" when the debtor confirms receipt but doesn't commit to payment
6. Use "unclear" when the message is too short or vague to determine intent
7. For disputes: ALWAYS extract disputeReason and affectedInvoices
8. For promise_to_pay: ALWAYS resolve dates to ISO format in resolvedDates`,
        prompt,
        model: "fast",
        temperature: 0.3,
      });
      // Normalise legacy intent types from LLM output
      let intentType: CharlieIntentType = result.intentType || 'unknown';
      if (intentType === 'payment_confirmation') intentType = 'payment_notification';
      if (intentType === 'general_query') intentType = 'payment_query';

      // Determine if human review is required
      const requiresHumanReview =
        intentType === 'dispute' ||
        (result.confidence || 0) < this.CONFIDENCE_THRESHOLD ||
        result.requiresHumanReview === true;

      // Parse ambiguity info
      const ambiguity: AmbiguityInfo = result.ambiguity ? {
        hasAmbiguity: result.ambiguity.hasAmbiguity || false,
        types: result.ambiguity.types || [],
        details: {
          unclearInvoices: result.ambiguity.details?.unclearInvoices || false,
          unclearAmount: result.ambiguity.details?.unclearAmount || false,
          unclearDate: result.ambiguity.details?.unclearDate || false,
          multipleInvoices: result.ambiguity.details?.multipleInvoices || false,
          clarificationQuestions: result.ambiguity.details?.clarificationQuestions || []
        }
      } : {
        hasAmbiguity: false,
        types: [],
        details: {}
      };

      // Build enriched extracted entities
      const entities = result.extractedEntities || {};

      return {
        intentType,
        confidence: Math.min(Math.max(result.confidence || 0, 0), 1),
        sentiment: result.sentiment || 'neutral',
        extractedEntities: {
          ...entities,
          resolvedDates: entities.resolvedDates || [],
          disputeReason: entities.disputeReason || undefined,
          affectedInvoices: entities.affectedInvoices || undefined,
          suggestedApproach: entities.suggestedApproach || result.suggestedApproach || undefined,
        },
        reasoning: result.reasoning || '',
        requiresHumanReview,
        suggestedNextAction: result.suggestedNextAction,
        ambiguity
      };
    } catch (error) {
      console.error('❌ Intent analysis failed:', error);
      logSystemError({ source: 'intent_analyst', severity: 'error', message: `Intent analysis failed: ${error instanceof Error ? error.message : String(error)}`, stackTrace: error instanceof Error ? error.stack : undefined }).catch(() => {});
      return {
        intentType: 'unknown',
        confidence: 0,
        sentiment: 'neutral',
        extractedEntities: {},
        reasoning: 'Analysis failed',
        requiresHumanReview: true,
        ambiguity: { hasAmbiguity: false, types: [], details: {} }
      };
    }
  }

  /**
   * Build the analysis prompt with context
   */
  private buildAnalysisPrompt(message: string, context?: {
    contactName?: string;
    companyName?: string;
    invoiceAmount?: number;
    invoiceNumbers?: string[];
    daysPastDue?: number;
    conversationContext?: string;
  }): string {
    let prompt = `Analyse this debtor email reply and extract structured intent:\n\n`;

    if (context?.contactName || context?.companyName) {
      prompt += `DEBTOR: ${context.contactName || 'Unknown'}`;
      if (context.companyName) prompt += ` at ${context.companyName}`;
      prompt += '\n';
    }
    if (context?.invoiceNumbers?.length || context?.invoiceAmount) {
      prompt += `REGARDING: `;
      if (context.invoiceNumbers?.length) prompt += `Invoice(s) ${context.invoiceNumbers.join(', ')}`;
      if (context.invoiceAmount) prompt += ` totalling £${context.invoiceAmount.toFixed(2)}`;
      prompt += '\n';
    }
    if (context?.daysPastDue !== undefined) {
      if (context.daysPastDue > 0) {
        prompt += `STATUS: ${context.daysPastDue} days overdue\n`;
      } else if (context.daysPastDue === 0) {
        prompt += `STATUS: Due today\n`;
      } else {
        prompt += `STATUS: ${Math.abs(context.daysPastDue)} days until due\n`;
      }
    }

    prompt += `THEIR REPLY:\n"${message}"\n\n`;

    if (context?.conversationContext) {
      prompt += `CONVERSATION CONTEXT (last exchanges):\n${context.conversationContext}\n\n`;
    }

    prompt += `Today's date: ${new Date().toISOString().split('T')[0]}

Respond with JSON:
{
  "intentType": "promise_to_pay" | "acknowledge" | "dispute" | "payment_notification" | "payment_query" | "payment_plan" | "callback_request" | "admin_issue" | "general" | "unclear",
  "confidence": 0.0 to 1.0,
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "extractedEntities": {
    "amounts": ["any monetary amounts mentioned"],
    "dates": ["any dates or timeframes as written (e.g., 'next Friday', 'end of month', '15th March')"],
    "resolvedDates": ["resolved ISO dates, e.g., '2026-03-31' for 'end of month'"],
    "promises": ["any payment commitments or undertakings"],
    "reasons": ["reasons for dispute, delay, or non-payment"],
    "invoiceReferences": ["any invoice numbers, PO numbers, or references mentioned"],
    "contactPreferences": ["preferred contact methods or times mentioned"],
    "disputeReason": "specific reason if dispute (quality, delivery, pricing, scope, wrong amount, not received, or custom)",
    "affectedInvoices": ["which invoice numbers the dispute covers"],
    "suggestedApproach": "brief guidance for the Collections Agent's reply (e.g., 'Acknowledge PTP, confirm date, express thanks', 'Empathise, request supporting documentation for dispute')"
  },
  "reasoning": "brief explanation of your classification",
  "requiresHumanReview": true/false,
  "suggestedNextAction": "what Charlie recommends as next step (e.g., 'Record PTP for 2026-03-31 and schedule follow-up', 'Resend invoice with PO', 'Route dispute to manager')",
  "ambiguity": {
    "hasAmbiguity": true/false,
    "types": ["invoice_reference" | "payment_amount" | "payment_date" | "multiple_invoices"],
    "details": {
      "unclearInvoices": true/false,
      "unclearAmount": true/false,
      "unclearDate": true/false,
      "multipleInvoices": true/false,
      "clarificationQuestions": ["specific polite questions to ask the debtor to clarify"]
    }
  }
}

DATE RESOLUTION RULES:
- "end of month" → last day of current month as ISO date
- "next Friday" → the coming Friday as ISO date
- "15th March" → 2026-03-15
- "within 7 days" → today + 7 days as ISO date
- "by close of play tomorrow" → tomorrow's date
- Always populate both dates (as written) and resolvedDates (as ISO)

AMBIGUITY RULES:
- If the debtor mentions payment but doesn't specify WHICH invoice, set unclearInvoices: true
- If the debtor promises to pay but the amount is vague, set unclearAmount: true
- If the debtor promises to pay but gives no specific date (just "soon"), set unclearDate: true
- If the debtor has multiple outstanding invoices and it's unclear which, set multipleInvoices: true
- hasAmbiguity should be true if ANY of the above are unclear for promise_to_pay or payment_plan

CRITICAL EXCEPTIONS — do NOT flag ambiguity when:
- The debtor says "full payment", "pay everything", "pay all", "settle the full balance", "pay in full" or similar — this means ALL invoices. Set hasAmbiguity: false.
- A specific date AND "full/all/everything" language is used together — clear, unambiguous PTP.`;

    return prompt;
  }

  /**
   * Process an unanalyzed inbound message
   *
   * TODO: Link inbound response back to the decisionAuditLog
   * that triggered the outbound action, update outcome 'responded'
   */
  async processInboundMessage(messageId: string): Promise<void> {
    try {
      // Get the message
      const [message] = await db
        .select()
        .from(inboundMessages)
        .where(eq(inboundMessages.id, messageId))
        .limit(1);

      if (!message) {
        console.error(`❌ Message ${messageId} not found`);
        return;
      }

      if (message.intentAnalyzed) {
        console.log(`⏭️  Message ${messageId} already analyzed`);
        return;
      }

      // Get context if contact/invoice linked
      let context: any = {};
      
      if (message.contactId) {
        const [contact] = await db
          .select()
          .from(contacts)
          .where(eq(contacts.id, message.contactId))
          .limit(1);
        if (contact) context.contactName = contact.companyName || contact.name;
      }

      if (message.invoiceId) {
        const [invoice] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, message.invoiceId))
          .limit(1);
        
        if (invoice) {
          context.invoiceAmount = Number(invoice.amount);
          const daysPastDue = Math.max(0, 
            Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
          );
          context.daysPastDue = daysPastDue;
        }
      }

      // Analyze intent
      console.log(`🔍 Analyzing intent for message ${messageId}...`);
      const analysis = await this.analyzeIntent(message.content, context);

      // Update message with analysis
      await db
        .update(inboundMessages)
        .set({
          intentAnalyzed: true,
          intentType: analysis.intentType,
          intentConfidence: analysis.confidence.toString(),
          sentiment: analysis.sentiment,
          extractedEntities: analysis.extractedEntities,
          updatedAt: new Date(),
        })
        .where(eq(inboundMessages.id, messageId));

      console.log(`✅ Intent analyzed: ${analysis.intentType} (${(analysis.confidence * 100).toFixed(0)}% confidence)${analysis.requiresHumanReview ? ' [HUMAN REVIEW]' : ''}`);

      // Check if debtor has overdue invoices — used for PTP flow gating (all channels)
      let debtorHasOverdue = false;
      if (message.contactId &&
          (analysis.intentType === 'promise_to_pay' || analysis.intentType === 'payment_plan') &&
          analysis.confidence >= this.CONFIDENCE_THRESHOLD) {
        debtorHasOverdue = await this.checkDebtorHasOverdueInvoices(message.tenantId, message.contactId);
      }

      // Check if this is a response to a pending clarification (EMAIL only)
      if (message.channel === 'email' || message.channel === 'EMAIL') {
        const pendingResult = message.contactId 
          ? await emailClarificationService.checkForPendingClarification(message.contactId, message.tenantId)
          : { hasPending: false };
        
        if (pendingResult.hasPending && pendingResult.clarification) {
          console.log(`📧 This email is a response to pending clarification ${pendingResult.clarification.id}`);
          await this.handleClarificationResponse(message, analysis, pendingResult.clarification, context);
          return; // Don't process further - clarification response handled
        }
        
        // Check if this is a PTP/payment_plan with ambiguity - send clarification email
        const needsClarification = 
          analysis.ambiguity?.hasAmbiguity === true &&
          (analysis.intentType === 'promise_to_pay' || analysis.intentType === 'payment_plan') &&
          message.contactId &&
          message.from; // Need email address
        
        if (needsClarification) {
          console.log(`🤔 Ambiguity detected in ${analysis.intentType} - sending clarification email`);
          const clarificationResult = await this.sendClarificationForAmbiguity(message, analysis, context);
          
          // Create a pending action for tracking (don't skip action creation)
          // This ensures ambiguous messages are tracked even if debtor never responds
          await this.createActionFromIntent(message, analysis);
          
          // Create a "clarification_pending" outcome linked to the clarification record
          if (message.contactId) {
            await this.createPendingClarificationOutcome(
              message, 
              analysis, 
              context,
              clarificationResult?.clarificationId
            );
          }
          
          // Don't continue to confirmation/standard flow, but don't return without tracking
          return;
        }
        
        // If high confidence PTP or payment_plan with no ambiguity, send confirmation
        const shouldConfirm =
          (analysis.intentType === 'promise_to_pay' || analysis.intentType === 'payment_plan') &&
          analysis.confidence >= this.CONFIDENCE_THRESHOLD &&
          !analysis.ambiguity?.hasAmbiguity &&
          message.contactId &&
          message.from;

        let confirmationSent = false;

        if (shouldConfirm && debtorHasOverdue) {
          // Standard PTP confirmation flow — debtor has overdue invoices
          const activePromise = analysis.intentType === 'promise_to_pay' && message.contactId
            ? await this.findActivePromise(message.tenantId, message.contactId)
            : null;

          if (activePromise) {
            console.log(`🔄 Existing active promise detected — sending modified confirmation`);
          } else {
            console.log(`✅ Clear ${analysis.intentType} detected - sending confirmation email`);
          }

          await this.sendConfirmationEmail(message, analysis, context, activePromise);
          confirmationSent = true;
        } else if (shouldConfirm && !debtorHasOverdue) {
          // Early intelligence — debtor mentioned payment timing but nothing is overdue
          console.log(`📋 Early intelligence: debtor mentioned payment date but has no overdue invoices — storing as aiFact, skipping confirmation`);
          await this.storeEarlyPaymentIntelligence(message, analysis, context);
          confirmationSent = true; // Prevent auto-reply since we've handled it
        }

        // Active conversation auto-reply: if the debtor is in an active conversation
        // (replied within 48h) and we haven't already sent a confirmation/clarification,
        // check escalation and send an immediate AI reply.
        if (!confirmationSent && message.contactId && message.from) {
          this.handleActiveConversationAutoReply(message).catch(err => 
            console.error('❌ Active conversation auto-reply error:', err)
          );
        }
      }

      // For non-email channels: store early intelligence if PTP detected with no overdue invoices
      if (message.channel !== 'email' && message.channel !== 'EMAIL' &&
          !debtorHasOverdue &&
          (analysis.intentType === 'promise_to_pay' || analysis.intentType === 'payment_plan') &&
          analysis.confidence >= this.CONFIDENCE_THRESHOLD &&
          message.contactId) {
        console.log(`📋 Early intelligence (${message.channel}): debtor mentioned payment date but has no overdue invoices`);
        await this.storeEarlyPaymentIntelligence(message, analysis, context);
      }

      // Determine if we should create an action
      const shouldCreateAction =
        analysis.intentType === 'dispute' ||       // Always create for disputes
        (analysis.confidence >= this.CONFIDENCE_THRESHOLD && analysis.intentType !== 'unknown');
      
      if (shouldCreateAction) {
        await this.createActionFromIntent(message, analysis);
        
        // ALWAYS create unified outcome for forecast-affecting intents (all channels)
        // This ensures email, SMS, and voice intents all feed into the forecast
        if (message.contactId && analysis.intentType !== 'unknown') {
          await this.createOutcomeFromIntent(message, analysis, context);
        }
        
        // Create promise record if this is a promise_to_pay intent with high confidence
        // Detects modifications to existing active promises vs genuinely new promises
        // Only create formal PTP records when the debtor actually has overdue invoices
        if (analysis.intentType === 'promise_to_pay' &&
            analysis.confidence >= this.CONFIDENCE_THRESHOLD &&
            message.contactId && message.invoiceId &&
            debtorHasOverdue) {
          const modificationResult = await this.detectAndHandlePromiseModification(message, analysis, context);
          if (!modificationResult.isModification) {
            // Genuinely new promise — create fresh records
            await this.createPromiseFromIntent(message, analysis, context);
            await this.createForecastAdjustmentFromPromise(message, analysis, context);
          }
          // If modification, detectAndHandlePromiseModification already updated the records

          // Conversation state → PROMISE_MONITOR
          // Confidence tiers: >= 0.92 auto-confirmed, 0.85-0.91 requires confirmation, < 0.85 logged only
          const needsConfirmation = analysis.confidence >= 0.85 && analysis.confidence < 0.92;
          await transitionState(message.tenantId, message.contactId, 'intent_classified', {
            intent: 'promise', eventId: message.id, eventType: 'inbound_message',
            metadata: { confidence: analysis.confidence, requiresConfirmation: needsConfirmation },
          }).catch(err => console.warn('[State] promise intent_classified transition failed:', err));
        }
        
        // Handle payment plan requests - update invoice outcome and create notification
        if (analysis.intentType === 'payment_plan' && 
            analysis.confidence >= this.CONFIDENCE_THRESHOLD &&
            message.contactId) {
          await this.handlePaymentPlanIntent(message, analysis);
        }
        
        // Handle dispute intents - update invoice outcome
        if (analysis.intentType === 'dispute' &&
            analysis.confidence >= this.CONFIDENCE_THRESHOLD &&
            message.invoiceId) {
          await this.handleDisputeIntent(message, analysis);

          // Conversation state → DISPUTE_HOLD
          if (message.contactId) {
            await transitionState(message.tenantId, message.contactId, 'intent_classified', {
              intent: 'dispute', eventId: message.id, eventType: 'inbound_message',
            }).catch(err => console.warn('[State] dispute intent_classified transition failed:', err));
          }
        }

        // For non-promise/non-dispute intents with sufficient confidence → CONVERSING
        if (message.contactId &&
            analysis.intentType !== 'promise_to_pay' &&
            analysis.intentType !== 'dispute' &&
            analysis.intentType !== 'unknown') {
          await transitionState(message.tenantId, message.contactId, 'intent_classified', {
            intent: 'acknowledge', eventId: message.id, eventType: 'inbound_message',
          }).catch(err => console.warn('[State] acknowledge intent_classified transition failed:', err));
        }

      } else {
        console.log(`⚠️  Low confidence (${(analysis.confidence * 100).toFixed(0)}%) - flagged for manual review`);
        // Still create action for low confidence - route to Queries tab
        await this.createActionFromIntent(message, analysis);

        // Create outcome even for low confidence - marked for manual review
        if (message.contactId) {
          await this.createOutcomeFromIntent(message, analysis, context);
        }
      }

      // Trigger Collections Agent reply pipeline for email responses
      // This generates a contextual LLM reply and routes through compliance → approval → delivery
      if (message.channel === 'email' && message.contactId) {
        // Find the emailMessages record for this inbound message
        const rawPayload = message.rawPayload as any;
        const emailMessageId = rawPayload?.emailMessageId || rawPayload?.normalized?.emailMessageId;

        if (emailMessageId) {
          processInboundReply({
            tenantId: message.tenantId,
            contactId: message.contactId,
            inboundEmailMessageId: emailMessageId,
            inboundText: message.content || '',
            inboundSubject: message.subject || null,
            intentType: analysis.intentType,
            invoiceId: message.invoiceId,
          }).catch(err => console.error('❌ Inbound reply pipeline error:', err));
        }
      }

    } catch (error) {
      console.error(`❌ Error processing message ${messageId}:`, error);
      logSystemError({ source: 'intent_analyst', severity: 'error', message: `Error processing message ${messageId}: ${error instanceof Error ? error.message : String(error)}`, stackTrace: error instanceof Error ? error.stack : undefined, context: { messageId } }).catch(() => {});
    }
  }

  /**
   * Handle active conversation auto-reply asynchronously.
   * Checks if the contact is in an active conversation (replied within 48h),
   * then either sends an AI reply or escalates to a human.
   */
  private async handleActiveConversationAutoReply(
    message: typeof inboundMessages.$inferSelect
  ): Promise<void> {
    if (!message.contactId || !message.from) return;

    const rawPayload = message.rawPayload as any;
    const headers = rawPayload?.normalized?.email?.headers || rawPayload?.headers || {};
    if (emailClarificationService.isAutoReply(message.subject || undefined, message.content || undefined, headers)) {
      console.log(`🤖 Auto-reply/bounce detected — skipping AI response to prevent loop (${message.subject})`);
      return;
    }

    const activeConvo = await emailClarificationService.isActiveConversation(message.tenantId, message.contactId);
    if (!activeConvo.active) {
      return;
    }

    console.log(`💬 Active conversation detected for ${message.contactId} — triggering AI auto-reply`);

    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, message.contactId))
      .limit(1);

    if (!contact) return;

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, message.tenantId))
      .limit(1);

    if (!tenant) return;

    const primaryEmail = (contact as any).primaryCreditContact?.email || contact.email;
    const senderEmail = message.from?.toLowerCase().trim();
    const senderDiffersFromPrimary = senderEmail && primaryEmail && senderEmail !== primaryEmail.toLowerCase().trim();
    const contactEmail = senderDiffersFromPrimary
      ? senderEmail
      : (primaryEmail || senderEmail);
    if (!contactEmail) return;

    if (senderDiffersFromPrimary) {
      console.log(`📧 Debtor replied from different email: ${senderEmail} (primary: ${primaryEmail}) — replying to sender`);
    }

    if (senderEmail) {
      await this.autoDiscoverContactPerson(message.tenantId, message.contactId, senderEmail, message.from);
    }

    const result = await emailClarificationService.handleActiveConversationReply({
      tenantId: message.tenantId,
      contactId: message.contactId,
      contactEmail,
      contactName: contact.companyName || contact.name || 'Customer',
      tenantName: tenant.name || 'Accounts Team',
      inboundMessageText: message.content || '',
      inboundSubject: message.subject || undefined,
      linkedInvoiceIds: message.invoiceId ? [message.invoiceId] : undefined,
    });

    if (result.action === 'escalated') {
      console.log(`🚨 Active conversation escalated: ${result.reason}`);
    } else if (result.action === 'replied') {
      console.log(`✅ Active conversation AI reply sent`);
    } else {
      console.log(`⏸️ Active conversation reply skipped: ${result.reason || result.error}`);
    }
  }

  /**
   * Auto-discover a new contact person when a debtor replies from an unknown email address.
   * Adds the email to customerContactPersons if not already present.
   */
  private async autoDiscoverContactPerson(
    tenantId: string,
    contactId: string,
    email: string,
    rawFrom: string | null
  ): Promise<void> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await db
        .select({ id: customerContactPersons.id })
        .from(customerContactPersons)
        .where(and(
          eq(customerContactPersons.tenantId, tenantId),
          eq(customerContactPersons.contactId, contactId),
          sql`lower(${customerContactPersons.email}) = ${normalizedEmail}`
        ))
        .limit(1);

      if (existing.length > 0) return;

      const namePart = rawFrom?.match(/^(.+?)\s*</)
        ? rawFrom.match(/^(.+?)\s*</)?.[1]?.trim()
        : null;

      await db.insert(customerContactPersons).values({
        tenantId,
        contactId,
        name: namePart || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        notes: `Auto-discovered from inbound email reply on ${new Date().toISOString().split('T')[0]}`,
        isPrimaryCreditControl: false,
        isEscalation: false,
        isFromXero: false,
      });

      console.log(`👤 Auto-discovered contact person: ${email} for contact ${contactId}`);
    } catch (err) {
      console.error(`❌ Failed to auto-discover contact person ${email}:`, err);
    }
  }

  /**
   * Create an action from detected intent
   */
  private async createActionFromIntent(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult
  ): Promise<void> {
    try {
      const actionSubject = this.generateActionSubject(analysis);
      const actionContent = this.generateActionContent(message, analysis);

      // Determine action priority based on intent
      const priorityMap: Record<CharlieIntentType, string> = {
        dispute: 'high',
        promise_to_pay: 'medium',
        payment_notification: 'low',
        payment_confirmation: 'low',
        acknowledge: 'low',
        callback_request: 'high',
        admin_issue: 'medium',
        payment_plan: 'medium',
        payment_query: 'low',
        general_query: 'low',
        general: 'low',
        unclear: 'low',
        unknown: 'low'
      };

      // Route low-confidence, unknown, or unclear to "exception" status for Queries tab
      const actionStatus = analysis.requiresHumanReview || analysis.intentType === 'unknown' || analysis.intentType === 'unclear' || analysis.confidence < this.CONFIDENCE_THRESHOLD
        ? 'exception'  // Will appear in Exceptions/Queries queue
        : 'pending';

      let action: any;
      if (actionStatus === 'exception') {
        // Exceptions go directly to the Exceptions tab — bypass proposeAction
        const [created] = await db
          .insert(actions)
          .values({
            tenantId: message.tenantId,
            contactId: message.contactId,
            invoiceId: message.invoiceId,
            type: message.channel,
            status: 'exception',
            exceptionReason: analysis.requiresHumanReview ?
              (analysis.intentType === 'dispute' ? 'dispute_detected' :
               'low_confidence') : undefined,
            subject: actionSubject,
            content: actionContent,
            intentType: analysis.intentType,
            intentConfidence: analysis.confidence.toString(),
            sentiment: analysis.sentiment,
            source: 'charlie_inbound',
            agentType: 'collections',
            actionSummary: actionSubject,
            recommended: {
              priority: priorityMap[analysis.intentType] || 'medium',
              suggestedNextAction: analysis.suggestedNextAction,
              requiresHumanReview: analysis.requiresHumanReview
            },
            metadata: {
              direction: 'inbound',
              inboundMessageId: message.id,
              requiresHumanReview: analysis.requiresHumanReview,
              suggestedNextAction: analysis.suggestedNextAction,
              analysis: {
                reasoning: analysis.reasoning,
                entities: analysis.extractedEntities
              },
              originalMessage: {
                from: message.from,
                content: message.content,
                receivedAt: message.createdAt
              }
            }
          })
          .returning();
        action = created;
      } else {
        // Route through proposeAction for batch/approval queue
        const { proposeAction } = await import('./batchProcessor');
        const { id: actionId } = await proposeAction({
          tenantId: message.tenantId,
          contactId: message.contactId,
          invoiceId: message.invoiceId,
          type: message.channel,
          subject: actionSubject,
          content: actionContent,
          intentType: analysis.intentType,
          intentConfidence: analysis.confidence.toString(),
          sentiment: analysis.sentiment,
          agentType: 'collections',
          actionSummary: actionSubject,
          recommended: {
            priority: priorityMap[analysis.intentType] || 'medium',
            suggestedNextAction: analysis.suggestedNextAction,
            requiresHumanReview: analysis.requiresHumanReview
          },
          metadata: {
            direction: 'inbound',
            inboundMessageId: message.id,
            requiresHumanReview: analysis.requiresHumanReview,
            suggestedNextAction: analysis.suggestedNextAction,
            analysis: {
              reasoning: analysis.reasoning,
              entities: analysis.extractedEntities
            },
            originalMessage: {
              from: message.from,
              content: message.content,
              receivedAt: message.createdAt
            }
          }
        });
        const [fetched] = await db.select().from(actions).where(eq(actions.id, actionId)).limit(1);
        action = fetched;
      }

      // Link action back to message
      await db
        .update(inboundMessages)
        .set({
          actionCreated: true,
          actionId: action.id,
        })
        .where(eq(inboundMessages.id, message.id));

      console.log(`✅ Action created: ${actionSubject}`);
    } catch (error) {
      console.error('❌ Error creating action:', error);
      logSystemError({ tenantId: message.tenantId ?? undefined, source: 'intent_analyst', severity: 'error', message: `Error creating action from intent: ${error instanceof Error ? error.message : String(error)}`, stackTrace: error instanceof Error ? error.stack : undefined, context: { messageId: message.id, contactId: message.contactId ?? undefined } }).catch(() => {});
    }
  }

  /**
   * Create a unified outcome record for forecast integration
   * This is the SINGLE source of truth for all intent outcomes across all channels
   */
  private async createOutcomeFromIntent(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: { contactName?: string; invoiceAmount?: number; daysPastDue?: number }
  ): Promise<void> {
    try {
      if (!message.contactId) {
        console.warn(`⚠️  Cannot create outcome - no contactId on message ${message.id}`);
        return;
      }

      const outcomeType = INTENT_TO_OUTCOME_TYPE[analysis.intentType];
      const effect = OUTCOME_FORECAST_EFFECTS[outcomeType];
      
      // Determine confidence band
      let confidenceBand: 'HIGH' | 'MEDIUM' | 'LOW';
      if (analysis.confidence >= 0.85) {
        confidenceBand = 'HIGH';
      } else if (analysis.confidence >= 0.6) {
        confidenceBand = 'MEDIUM';
      } else {
        confidenceBand = 'LOW';
      }

      // Map channel to source channel format
      const sourceChannel = message.channel?.toUpperCase() || 'EMAIL';

      // Build extracted structured data based on intent type
      const extracted = this.buildExtractedData(analysis, context);

      // Create the unified outcome record
      // Use null explicitly for nullable fields (not undefined)
      const [outcome] = await db
        .insert(outcomes)
        .values({
          tenantId: message.tenantId,
          debtorId: message.contactId,
          invoiceId: message.invoiceId || null,
          linkedInvoiceIds: [],
          type: outcomeType,
          confidence: analysis.confidence.toFixed(2),
          confidenceBand,
          requiresHumanReview: analysis.requiresHumanReview,
          effect,
          extracted,
          sourceChannel,
          sourceMessageId: message.id,
          rawSnippet: message.content?.substring(0, 500) || '',
        })
        .returning();

      console.log(`✅ Outcome created: ${outcomeType} (${confidenceBand} confidence) - effect: ${effect}`);

    } catch (error) {
      console.error('❌ Error creating outcome:', error);
      logSystemError({ tenantId: message.tenantId ?? undefined, source: 'intent_analyst', severity: 'error', message: `Error creating outcome from intent: ${error instanceof Error ? error.message : String(error)}`, stackTrace: error instanceof Error ? error.stack : undefined, context: { messageId: message.id, contactId: message.contactId ?? undefined } }).catch(() => {});
    }
  }

  /**
   * Build extracted structured data from intent analysis
   * Maps analysis entities to the unified outcome.extracted schema
   */
  private buildExtractedData(
    analysis: IntentAnalysisResult,
    context: { contactName?: string; invoiceAmount?: number; daysPastDue?: number }
  ): {
    promiseToPayDate?: string;
    promiseToPayAmount?: number;
    confirmedBy?: string;
    paymentPlanSchedule?: Array<{ date: string; amount: number }>;
    paymentProcessWindow?: { earliest?: string; latest?: string };
    disputeCategory?: 'PRICING' | 'DELIVERY' | 'QUALITY' | 'OTHER';
    docsRequested?: Array<'INVOICE_COPY' | 'STATEMENT' | 'REMITTANCE' | 'PO'>;
    oooUntil?: string;
    freeTextNotes?: string;
  } {
    const extracted: any = {};
    const entities = analysis.extractedEntities;

    // Extract promise to pay date
    if (analysis.intentType === 'promise_to_pay' || analysis.intentType === 'payment_notification' || analysis.intentType === 'payment_confirmation') {
      if (entities.dates?.length) {
        const parsedDate = this.parsePromisedDate(entities.dates[0]);
        if (parsedDate) {
          extracted.promiseToPayDate = parsedDate.toISOString().split('T')[0];
        }
      }
      
      // Extract amount if mentioned
      if (entities.amounts?.length) {
        const amount = this.parseAmount(entities.amounts[0]);
        if (amount && amount > 0) {
          extracted.promiseToPayAmount = amount;
        }
      } else if (context.invoiceAmount) {
        // Use invoice amount as fallback for full payment promise
        extracted.promiseToPayAmount = context.invoiceAmount;
      }
      
      if (context.contactName) {
        extracted.confirmedBy = context.contactName;
      }
    }

    // Extract payment plan schedule
    if (analysis.intentType === 'payment_plan') {
      // Try to build a schedule from extracted dates and amounts
      const dates = entities.dates || [];
      const amounts = entities.amounts || [];
      
      if (dates.length > 0) {
        const schedule: Array<{ date: string; amount: number }> = [];
        
        for (let i = 0; i < dates.length; i++) {
          const parsedDate = this.parsePromisedDate(dates[i]);
          if (parsedDate) {
            // Use corresponding amount if available, otherwise divide total
            let amount: number;
            if (amounts[i]) {
              amount = this.parseAmount(amounts[i]) || 0;
            } else if (context.invoiceAmount && dates.length > 0) {
              // Divide invoice amount equally among dates
              amount = context.invoiceAmount / dates.length;
            } else {
              amount = 0;
            }
            
            schedule.push({
              date: parsedDate.toISOString().split('T')[0],
              amount
            });
          }
        }
        
        if (schedule.length > 0) {
          extracted.paymentPlanSchedule = schedule;
        }
      }
      
      // If no dates extracted, create a default 14-day first payment
      if (!extracted.paymentPlanSchedule) {
        const firstPaymentDate = new Date();
        firstPaymentDate.setDate(firstPaymentDate.getDate() + 14);
        extracted.paymentPlanSchedule = [{
          date: firstPaymentDate.toISOString().split('T')[0],
          amount: context.invoiceAmount || 0
        }];
      }
    }

    // Extract dispute category
    if (analysis.intentType === 'dispute') {
      const reasons = (entities.reasons || []).join(' ').toLowerCase();
      if (reasons.includes('price') || reasons.includes('cost') || reasons.includes('amount')) {
        extracted.disputeCategory = 'PRICING';
      } else if (reasons.includes('delivery') || reasons.includes('shipping') || reasons.includes('late')) {
        extracted.disputeCategory = 'DELIVERY';
      } else if (reasons.includes('quality') || reasons.includes('damage') || reasons.includes('defect')) {
        extracted.disputeCategory = 'QUALITY';
      } else {
        extracted.disputeCategory = 'OTHER';
      }
    }

    // Extract admin/docs requested
    if (analysis.intentType === 'admin_issue') {
      const docsRequested: string[] = [];
      const content = (entities.reasons || []).join(' ').toLowerCase();
      if (content.includes('invoice') || content.includes('copy')) docsRequested.push('INVOICE_COPY');
      if (content.includes('statement')) docsRequested.push('STATEMENT');
      if (content.includes('remittance')) docsRequested.push('REMITTANCE');
      if (content.includes('po') || content.includes('purchase order')) docsRequested.push('PO');
      if (docsRequested.length > 0) {
        extracted.docsRequested = docsRequested;
      }
    }

    // Always include reasoning as freeTextNotes
    if (analysis.reasoning) {
      extracted.freeTextNotes = analysis.reasoning;
    }

    return extracted;
  }

  /**
   * Generate action subject from intent (Charlie-aligned)
   */
  private generateActionSubject(analysis: IntentAnalysisResult): string {
    const subjects: Record<CharlieIntentType, string> = {
      dispute: '⚠️ Invoice Dispute',
      promise_to_pay: '✅ Payment Promise Received',
      payment_notification: '💳 Payment Notification',
      payment_confirmation: '💳 Payment Confirmation',
      acknowledge: '👋 Acknowledgement Received',
      callback_request: '📞 Callback Requested',
      admin_issue: '📋 Admin Blocker (PO/Address/Setup)',
      payment_plan: '💰 Payment Plan Request',
      payment_query: '❓ Payment Query',
      general_query: '❓ Customer Query',
      general: '📩 General Communication',
      unclear: '🔍 Unclear Intent - Review Required',
      unknown: '📩 Inbound Message - Review Required'
    };
    return subjects[analysis.intentType] || subjects.unknown;
  }

  /**
   * Generate action content from message and analysis (Charlie-aligned)
   */
  private generateActionContent(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult
  ): string {
    let content = `Customer Response Received\n\n`;
    content += `Channel: ${message.channel}\n`;
    content += `From: ${message.from}\n`;
    content += `Intent: ${analysis.intentType} (${(analysis.confidence * 100).toFixed(0)}% confidence)\n`;
    content += `Sentiment: ${analysis.sentiment}\n`;
    
    if (analysis.requiresHumanReview) {
      content += `⚠️ Human Review Required\n`;
    }
    content += '\n';
    
    const entities = analysis.extractedEntities;
    if (entities && Object.keys(entities).length > 0) {
      content += `Key Information:\n`;
      if (entities.amounts?.length) {
        content += `- Amounts: ${entities.amounts.join(', ')}\n`;
      }
      if (entities.dates?.length) {
        content += `- Dates: ${entities.dates.join(', ')}\n`;
      }
      if (entities.promises?.length) {
        content += `- Promises: ${entities.promises.join(', ')}\n`;
      }
      if (entities.reasons?.length) {
        content += `- Reasons: ${entities.reasons.join(', ')}\n`;
      }
      if (entities.invoiceReferences?.length) {
        content += `- Invoice/PO Refs: ${entities.invoiceReferences.join(', ')}\n`;
      }
      if (entities.contactPreferences?.length) {
        content += `- Contact Preferences: ${entities.contactPreferences.join(', ')}\n`;
      }
      content += '\n';
    }
    
    if (analysis.suggestedNextAction) {
      content += `Suggested Next Action: ${analysis.suggestedNextAction}\n\n`;
    }
    
    content += `Analysis: ${analysis.reasoning}\n\n`;
    content += `Original Message:\n"${message.content}"`;
    
    return content;
  }

  // ── Promise modification detection ──────────────────────────────────

  /**
   * Find the most recent active (open/rescheduled) promise for this contact.
   * Returns null if no active promise exists.
   */
  private async findActivePromise(
    tenantId: string,
    contactId: string,
  ): Promise<typeof paymentPromises.$inferSelect | null> {
    const [active] = await db
      .select()
      .from(paymentPromises)
      .where(
        and(
          eq(paymentPromises.tenantId, tenantId),
          eq(paymentPromises.contactId, contactId),
          inArray(paymentPromises.status, ['open', 'rescheduled']),
          gte(paymentPromises.promisedDate, new Date()), // Not yet past due
        )
      )
      .orderBy(desc(paymentPromises.createdAt))
      .limit(1);

    return active || null;
  }

  /**
   * Check if a debtor has any overdue invoices (dueDate < now, status not paid/void/draft).
   */
  private async checkDebtorHasOverdueInvoices(tenantId: string, contactId: string): Promise<boolean> {
    const [overdueInvoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.contactId, contactId),
          lt(invoices.dueDate, new Date()),
          notInArray(invoices.invoiceStatus, ['PAID', 'VOIDED', 'DELETED', 'DRAFT']),
        )
      )
      .limit(1);

    return !!overdueInvoice;
  }

  /**
   * Store early payment intelligence when a debtor mentions payment timing
   * but has no overdue invoices. Stored as an aiFact for Riley and Charlie
   * to reference when the invoice eventually becomes overdue.
   */
  private async storeEarlyPaymentIntelligence(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: any,
  ): Promise<void> {
    try {
      const extractedDates = analysis.extractedEntities.dates || [];
      const dateStr = extractedDates[0] || 'unspecified date';

      // Store as aiFact for future reference
      await db.insert(aiFacts).values({
        tenantId: message.tenantId,
        category: 'payment_behaviour',
        title: `Early payment signal — expects to pay ${dateStr}`,
        content: `Debtor indicated payment timing before invoice is overdue. Original message (${message.channel}): "${message.content}". Extracted date: ${dateStr}. No invoices are currently overdue — this is advance notice of potential late payment. When invoices become overdue, Charlie can reference this: "I understand you mentioned ${dateStr} — just confirming that's still the plan?"`,
        tags: ['early_intelligence', 'payment_timing', 'pre_overdue'],
        priority: 7,
        source: 'intent_extraction',
        entityType: 'debtor',
        entityId: message.contactId,
        factKey: 'expected_payment_date',
        factValue: dateStr,
        confidence: String(analysis.confidence),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      });

      // Create a note action (not a PTP) to appear in Activity Feed
      if (message.contactId) {
        await db.insert(actions).values({
          tenantId: message.tenantId,
          contactId: message.contactId,
          invoiceId: message.invoiceId,
          type: 'note',
          status: 'completed',
          subject: 'Early Payment Intelligence',
          content: `Debtor mentioned payment timing ("${message.content?.substring(0, 150)}") but no invoices are currently overdue. Stored as advance notice — will be referenced when invoices become due.`,
          source: 'charlie_inbound',
          aiGenerated: true,
          completedAt: new Date(),
        });
      }

      console.log(`✅ Early payment intelligence stored as aiFact for contact ${message.contactId}`);
    } catch (err) {
      console.error('Failed to store early payment intelligence (non-fatal):', err);
    }
  }

  /**
   * Detect if a new PTP modifies an existing active promise.
   * If modification detected: updates existing promise, forecast, and logs signal.
   * Returns { isModification: true } if handled, { isModification: false } if new promise.
   */
  private async detectAndHandlePromiseModification(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: any,
  ): Promise<{ isModification: boolean }> {
    try {
      if (!message.contactId) return { isModification: false };

      const activePromise = await this.findActivePromise(message.tenantId, message.contactId);
      if (!activePromise) return { isModification: false };

      // Extract new promised date
      let newDate: Date | null = null;
      for (const dateStr of (analysis.extractedEntities.dates || [])) {
        newDate = this.parsePromisedDate(dateStr);
        if (newDate) break;
      }
      if (!newDate) {
        // No concrete new date — might be a cancellation or vague update, not a modification
        return { isModification: false };
      }

      // Extract new amount (if changed)
      let newAmount: number | undefined;
      for (const amountStr of (analysis.extractedEntities.amounts || [])) {
        newAmount = this.parseAmount(amountStr);
        if (newAmount !== undefined && newAmount > 0) break;
      }

      // Calculate days pushed
      const oldDate = new Date(activePromise.promisedDate);
      const daysPushed = Math.round((newDate.getTime() - oldDate.getTime()) / 86400000);

      // If dates are the same (within 1 day), treat as reiteration, not modification
      if (Math.abs(daysPushed) <= 1 && !newAmount) {
        return { isModification: false };
      }

      console.log(`🔄 Promise modification detected: ${oldDate.toLocaleDateString()} → ${newDate.toLocaleDateString()} (${daysPushed > 0 ? '+' : ''}${daysPushed} days)`);

      // Find the original promise date (first in the chain) for tracking total drift
      let originalDate = oldDate;
      if (activePromise.previousPromiseId) {
        const chain = await db
          .select({ promisedDate: paymentPromises.promisedDate })
          .from(paymentPromises)
          .where(
            and(
              eq(paymentPromises.contactId, message.contactId),
              eq(paymentPromises.invoiceId, activePromise.invoiceId),
            )
          )
          .orderBy(asc(paymentPromises.createdAt))
          .limit(1);
        if (chain[0]) originalDate = new Date(chain[0].promisedDate);
      }

      // 1. Mark old promise as rescheduled
      const prevModCount = Number((activePromise as any).modificationCount || 0);
      await db
        .update(paymentPromises)
        .set({
          status: 'rescheduled',
          notes: `${activePromise.notes || ''}\nRescheduled on ${new Date().toLocaleDateString()} — moved ${daysPushed > 0 ? 'back' : 'forward'} ${Math.abs(daysPushed)} days`.trim(),
          modificationCount: prevModCount + 1,
          originalPromisedDate: (activePromise as any).originalPromisedDate ?? originalDate,
          lastModifiedAt: new Date(),
          lastModifiedReason: `Rescheduled ${daysPushed > 0 ? '+' : ''}${daysPushed} days via ${message.channel}`,
          metadata: {
            ...(activePromise.metadata as any || {}),
            rescheduledAt: new Date().toISOString(),
            rescheduledTo: newDate.toISOString(),
            daysPushed,
          },
          updatedAt: new Date(),
        })
        .where(eq(paymentPromises.id, activePromise.id));

      // 2. Create new promise with modification tracking
      const promiseService = getPromiseReliabilityService();
      await promiseService.createPromise({
        tenantId: message.tenantId,
        contactId: message.contactId,
        invoiceId: activePromise.invoiceId,
        promiseType: 'payment_date',
        promisedDate: newDate,
        promisedAmount: newAmount ?? (activePromise.promisedAmount ? Number(activePromise.promisedAmount) : undefined),
        sourceType: 'inbound_message',
        sourceId: message.id,
        channel: message.channel,
        createdByUserId: message.tenantId,
        notes: `Modified promise — ${daysPushed > 0 ? 'pushed back' : 'pulled forward'} ${Math.abs(daysPushed)} days from ${oldDate.toLocaleDateString()}`,
        metadata: {
          originalMessage: message.content,
          extractedEntities: analysis.extractedEntities,
          confidence: analysis.confidence,
          sentiment: analysis.sentiment,
          isModification: true,
          previousPromiseId: activePromise.id,
          previousDate: oldDate.toISOString(),
          originalDate: originalDate.toISOString(),
          daysPushed,
        },
      });

      // 3. Update existing forecastUserAdjustment instead of creating duplicate
      await this.updateForecastAdjustmentForModification(
        message.tenantId,
        message.contactId,
        newDate,
        newAmount,
        daysPushed,
      );

      // 4. Log behavioural signal
      try {
        await signalCollector.recordPromiseModified(message.contactId, message.tenantId, daysPushed);
      } catch (err) {
        console.warn('⚠️ Failed to record promise modification signal:', err);
      }

      // 5. Log timeline event for visibility
      const [contact] = await db
        .select({ name: contacts.name, companyName: contacts.companyName })
        .from(contacts)
        .where(eq(contacts.id, message.contactId))
        .limit(1);
      const debtorName = contact?.companyName || contact?.name || 'Unknown';

      const signalType = daysPushed > 0 ? 'promise_delayed' : 'promise_accelerated';
      await db.insert(timelineEvents).values({
        tenantId: message.tenantId,
        customerId: message.contactId,
        invoiceId: activePromise.invoiceId,
        occurredAt: new Date(),
        direction: 'inbound',
        channel: message.channel || 'email',
        summary: `${debtorName} modified payment promise: ${oldDate.toLocaleDateString('en-GB')} → ${newDate.toLocaleDateString('en-GB')} (${daysPushed > 0 ? '+' : ''}${daysPushed} days)`,
        preview: (message.content || '').substring(0, 240),
        status: 'processed',
        createdByType: 'system',
        createdByName: 'Qashivo AI',
        outcomeType: signalType,
        outcomeExtracted: {
          previousDate: oldDate.toISOString(),
          newDate: newDate.toISOString(),
          daysPushed,
          previousAmount: activePromise.promisedAmount ? Number(activePromise.promisedAmount) : null,
          newAmount: newAmount || null,
          originalDate: originalDate.toISOString(),
        },
      });

      console.log(`✅ Promise modification processed: ${signalType}, ${daysPushed} days`);
      return { isModification: true };
    } catch (error) {
      console.error('❌ Error detecting promise modification:', error);
      // Fall through to create as new promise
      return { isModification: false };
    }
  }

  /**
   * Update an existing forecastUserAdjustment for a modified promise
   * instead of creating a duplicate record.
   */
  private async updateForecastAdjustmentForModification(
    tenantId: string,
    contactId: string,
    newDate: Date,
    newAmount: number | undefined,
    daysPushed: number,
  ): Promise<void> {
    try {
      // Find the most recent PTP-related forecast adjustment for this contact
      const [existing] = await db
        .select()
        .from(forecastUserAdjustments)
        .where(
          and(
            eq(forecastUserAdjustments.tenantId, tenantId),
            eq(forecastUserAdjustments.source, 'inbound_reply'),
            eq(forecastUserAdjustments.category, 'revenue_change'),
            eq(forecastUserAdjustments.affects, 'inflows'),
            sql`${forecastUserAdjustments.description} LIKE '%Promise to pay%'`,
            sql`COALESCE(${forecastUserAdjustments.expired}, false) = false`,
          )
        )
        .orderBy(desc(forecastUserAdjustments.createdAt))
        .limit(1);

      if (existing) {
        // Update existing record
        const updates: any = {
          startDate: newDate,
          updatedAt: new Date(),
          followUpStatus: 'pending', // Reset follow-up since the date changed
          description: `${existing.description} [revised ${daysPushed > 0 ? '+' : ''}${daysPushed}d on ${new Date().toLocaleDateString('en-GB')}]`,
        };
        if (newAmount !== undefined && newAmount > 0) {
          updates.amount = newAmount.toFixed(2);
        }

        await db
          .update(forecastUserAdjustments)
          .set(updates)
          .where(eq(forecastUserAdjustments.id, existing.id));

        console.log(`✅ Updated forecast adjustment ${existing.id} with new date ${newDate.toLocaleDateString()}`);
      } else {
        // No existing record found — create one (shouldn't normally happen)
        console.log(`⚠️ No existing forecast adjustment found for modified promise — will be created via standard flow`);
      }
    } catch (error) {
      console.error('❌ Error updating forecast adjustment for modification:', error);
    }
  }

  /**
   * Create a promise record from promise_to_pay intent
   * Validates required fields before creating the promise record
   */
  private async createPromiseFromIntent(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: any
  ): Promise<void> {
    try {
      // Validate required fields before proceeding
      if (!message.contactId) {
        console.warn(`⚠️  Cannot create promise - no contactId on message ${message.id}`);
        return;
      }
      
      if (!message.invoiceId) {
        console.warn(`⚠️  Cannot create promise - no invoiceId on message ${message.id}. Promise noted but not linked.`);
        // Still create an action to record the promise even without invoice link
        await db.insert(actions).values({
          tenantId: message.tenantId,
          contactId: message.contactId,
          type: 'note',
          status: 'pending',
          subject: '💬 Payment Promise (No Invoice Link)',
          content: `Customer made a payment promise but no specific invoice was identified.\n\nMessage: "${message.content}"\n\nExtracted info:\n- Dates: ${analysis.extractedEntities.dates?.join(', ') || 'None'}\n- Amounts: ${analysis.extractedEntities.amounts?.join(', ') || 'None'}\n- Promises: ${analysis.extractedEntities.promises?.join(', ') || 'None'}`,
          source: 'charlie_inbound',
          aiGenerated: true
        });
        return;
      }
      
      const promiseService = getPromiseReliabilityService();
      
      // Extract promised date from entities
      let promisedDate: Date | null = null;
      const extractedDates = analysis.extractedEntities.dates || [];
      
      for (const dateStr of extractedDates) {
        promisedDate = this.parsePromisedDate(dateStr);
        if (promisedDate) break; // Use first successfully parsed date
      }
      
      // If no date extracted, default to 7 days from now with a note
      const dateWasExtracted = promisedDate !== null;
      if (!promisedDate) {
        console.log(`⚠️  No parseable date found in promise, defaulting to 7 days`);
        promisedDate = new Date();
        promisedDate.setDate(promisedDate.getDate() + 7);
      }
      
      // Extract promised amount from entities
      let promisedAmount: number | undefined;
      const extractedAmounts = analysis.extractedEntities.amounts || [];
      
      for (const amountStr of extractedAmounts) {
        promisedAmount = this.parseAmount(amountStr);
        if (promisedAmount !== undefined && promisedAmount > 0) break;
      }
      
      // Use invoice amount as fallback if no amount specified
      if (promisedAmount === undefined && context?.invoiceAmount) {
        promisedAmount = context.invoiceAmount;
      }
      
      // Get a user ID - use system tenant ID as placeholder for automated captures
      const systemUserId = message.tenantId;
      
      const promise = await promiseService.createPromise({
        tenantId: message.tenantId,
        contactId: message.contactId,
        invoiceId: message.invoiceId,
        promiseType: 'payment_date',
        promisedDate,
        promisedAmount,
        sourceType: 'inbound_message',
        sourceId: message.id,
        channel: message.channel,
        createdByUserId: systemUserId,
        notes: `Promise extracted from ${message.channel} message${!dateWasExtracted ? ' (date defaulted - review recommended)' : ''}`,
        metadata: {
          originalMessage: message.content,
          extractedEntities: analysis.extractedEntities,
          confidence: analysis.confidence,
          sentiment: analysis.sentiment,
          dateWasExtracted,
        },
      });

      // Backfill bundle fields — if the triggering action chased multiple
      // invoices, populate promisedInvoiceIds from action.invoiceIds (or
      // metadata.allInvoiceIds) so downstream gates know the full bundle.
      try {
        let bundleIds: string[] | null = null;
        if (context?.actionId) {
          const [sourceAction] = await db
            .select({ invoiceIds: actions.invoiceIds, metadata: actions.metadata })
            .from(actions)
            .where(eq(actions.id, context.actionId))
            .limit(1);
          if (sourceAction) {
            const metaIds = (sourceAction.metadata as any)?.allInvoiceIds as string[] | undefined;
            bundleIds = (sourceAction.invoiceIds as string[] | null) || metaIds || null;
          }
        }
        if (!bundleIds || bundleIds.length === 0) {
          bundleIds = [message.invoiceId];
        }
        await db
          .update(paymentPromises)
          .set({
            promisedInvoiceIds: bundleIds,
            originalPromisedDate: promisedDate,
          })
          .where(eq(paymentPromises.id, promise.id));
      } catch (err) {
        console.warn('[intentAnalyst] promisedInvoiceIds backfill failed (non-fatal):', err);
      }

      console.log(`✅ Promise created: ${promise.id} - Payment by ${promisedDate.toLocaleDateString()}${!dateWasExtracted ? ' (default)' : ''}`);
    } catch (error) {
      console.error('❌ Error creating promise from intent:', error);
      logSystemError({ tenantId: message.tenantId ?? undefined, source: 'intent_analyst', severity: 'error', message: `Error creating promise from intent: ${error instanceof Error ? error.message : String(error)}`, stackTrace: error instanceof Error ? error.stack : undefined, context: { messageId: message.id, contactId: message.contactId ?? undefined, invoiceId: message.invoiceId ?? undefined } }).catch(() => {});
      // Log details for debugging
      console.error('Message details:', {
        messageId: message.id, 
        contactId: message.contactId, 
        invoiceId: message.invoiceId,
        entities: analysis.extractedEntities 
      });
    }
  }
  
  /**
   * Create a forecastUserAdjustment record from a promise-to-pay intent.
   * This bridges the inbound reply chain into the cashflow forecast so
   * the weekly CFO review can include expected inflows from debtor promises.
   */
  private async createForecastAdjustmentFromPromise(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: any,
  ): Promise<void> {
    try {
      if (!message.contactId || !message.invoiceId) return;

      // Resolve promised date
      let promisedDate: Date | null = null;
      for (const dateStr of (analysis.extractedEntities.dates || [])) {
        promisedDate = this.parsePromisedDate(dateStr);
        if (promisedDate) break;
      }
      if (!promisedDate) {
        promisedDate = new Date();
        promisedDate.setDate(promisedDate.getDate() + 7);
      }

      // Resolve amount: extracted amount > invoice balance > 0
      let amount = 0;
      for (const amountStr of (analysis.extractedEntities.amounts || [])) {
        const parsed = this.parseAmount(amountStr);
        if (parsed !== undefined && parsed > 0) { amount = parsed; break; }
      }
      if (amount === 0 && context?.invoiceAmount) {
        amount = typeof context.invoiceAmount === 'string'
          ? parseFloat(context.invoiceAmount) || 0
          : context.invoiceAmount;
      }
      if (amount <= 0) return; // Nothing to forecast

      // Load contact name for description
      const [contact] = await db.select({ name: contacts.name, companyName: contacts.companyName })
        .from(contacts)
        .where(eq(contacts.id, message.contactId))
        .limit(1);
      const debtorName = contact?.companyName || contact?.name || 'Unknown';

      // Set expiry 3 months from now
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 3);

      await db.insert(forecastUserAdjustments).values({
        tenantId: message.tenantId,
        category: 'revenue_change',
        description: `Promise to pay from ${debtorName} — extracted from inbound reply`,
        amount: amount.toFixed(2),
        timingType: 'one_off_date',
        startDate: promisedDate,
        enteredDate: new Date(),
        expiryDate,
        affects: 'inflows',
        source: 'inbound_reply',
        followUpPriority: 'medium',
        followUpStatus: 'pending',
      });

      console.log(`✅ Forecast adjustment created: ${debtorName} — £${amount.toFixed(2)} expected ${promisedDate.toLocaleDateString()}`);
    } catch (error) {
      console.error('❌ Error creating forecast adjustment from promise:', error);
      logSystemError({ tenantId: message.tenantId ?? undefined, source: 'intent_analyst', severity: 'error', message: `Error creating forecast adjustment from promise: ${error instanceof Error ? error.message : String(error)}`, stackTrace: error instanceof Error ? error.stack : undefined, context: { messageId: message.id, contactId: message.contactId ?? undefined } }).catch(() => {});
    }
  }

  /**
   * Parse a date string from natural language
   * Handles common B2B payment date expressions
   */
  private parsePromisedDate(dateStr: string): Date | null {
    try {
      const lowerStr = dateStr.toLowerCase().trim();
      const now = new Date();
      
      // "today"
      if (lowerStr === 'today') {
        return new Date(now);
      }
      
      // "tomorrow"
      if (lowerStr.includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }
      
      // "next week" / "in a week" / "within a week"
      if (lowerStr.includes('next week') || lowerStr.includes('in a week') || lowerStr.includes('within a week')) {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek;
      }
      
      // "end of next week" - Friday of next week
      if (lowerStr.includes('end of next week')) {
        const friday = new Date(now);
        const dayOfWeek = friday.getDay();
        const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (7 - dayOfWeek + 5);
        friday.setDate(friday.getDate() + daysUntilFriday + 7);
        return friday;
      }

      // "end of week" / "by end of week" / "by friday"
      if (lowerStr.includes('end of week') || lowerStr.includes('end of the week')) {
        const friday = new Date(now);
        const dayOfWeek = friday.getDay();
        const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (7 - dayOfWeek + 5);
        friday.setDate(friday.getDate() + daysUntilFriday);
        return friday;
      }

      // "end of [month name]" - e.g. "end of February", "end of March"
      const endOfNamedMonthMatch = lowerStr.match(/end\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
      if (endOfNamedMonthMatch) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const fullMonthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const monthStr = endOfNamedMonthMatch[1].toLowerCase();
        let monthIdx = fullMonthNames.indexOf(monthStr);
        if (monthIdx < 0) monthIdx = monthNames.indexOf(monthStr.substring(0, 3));
        if (monthIdx >= 0) {
          let year = now.getFullYear();
          const lastDay = new Date(year, monthIdx + 1, 0);
          if (lastDay < now) {
            lastDay.setFullYear(year + 1);
          }
          return lastDay;
        }
      }
      
      // "end of month" / "by month end"
      if (lowerStr.includes('end of month') || lowerStr.includes('month end') || lowerStr.includes('end of the month')) {
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return endOfMonth;
      }
      
      // "next month"
      if (lowerStr.includes('next month')) {
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      }
      
      // "in X weeks" pattern (e.g., "in 2 weeks", "within 3 weeks")
      const weeksMatch = lowerStr.match(/(?:in|within)\s+(\d+)\s+weeks?/);
      if (weeksMatch) {
        const weeks = parseInt(weeksMatch[1], 10);
        const result = new Date(now);
        result.setDate(result.getDate() + (weeks * 7));
        return result;
      }
      
      // "in X days" pattern (e.g., "in 3 days", "within 5 days")
      const daysMatch = lowerStr.match(/(?:in|within)\s+(\d+)\s+days?/);
      if (daysMatch) {
        const days = parseInt(daysMatch[1], 10);
        const result = new Date(now);
        result.setDate(result.getDate() + days);
        return result;
      }
      
      // "by the Xth" / "on the Xth" pattern (e.g., "by the 15th", "on the 20th")
      const ordinalMatch = lowerStr.match(/(?:by|on|before)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?/);
      if (ordinalMatch) {
        const dayOfMonth = parseInt(ordinalMatch[1], 10);
        if (dayOfMonth >= 1 && dayOfMonth <= 31) {
          const result = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
          // If that day has passed this month, assume next month
          if (result <= now) {
            result.setMonth(result.getMonth() + 1);
          }
          return result;
        }
      }
      
      // Day names: "friday", "next monday", "this wednesday"
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (let i = 0; i < dayNames.length; i++) {
        if (lowerStr.includes(dayNames[i])) {
          const targetDay = i; // Sunday = 0, Monday = 1, etc.
          const currentDay = now.getDay();
          let daysToAdd = targetDay - currentDay;
          
          // If "next X", always go to next week
          if (lowerStr.includes('next')) {
            if (daysToAdd <= 0) daysToAdd += 7;
          } else {
            // Default: if same or past, go to next week
            if (daysToAdd <= 0) daysToAdd += 7;
          }
          
          const result = new Date(now);
          result.setDate(result.getDate() + daysToAdd);
          return result;
        }
      }
      
      // Helper to parse month names (full or abbreviated)
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const fullMonthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      
      const parseMonthName = (monthStr: string): number => {
        const lower = monthStr.toLowerCase();
        // Check full month names first
        const fullIdx = fullMonthNames.findIndex(m => lower.startsWith(m) || m.startsWith(lower));
        if (fullIdx >= 0) return fullIdx;
        // Then abbreviated
        return monthNames.indexOf(lower.substring(0, 3));
      };
      
      // UK date format with ordinal: "16th March 2026", "1st January 2025", "15/01/2025", "15 Jan 2025"
      // Handle ordinal suffixes (st, nd, rd, th) and full month names
      const ukDateMatch = lowerStr.match(/(\d{1,2})(?:st|nd|rd|th)?[\/\-\s]+(\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\/\-\s]+(\d{2,4})/i);
      if (ukDateMatch) {
        const day = parseInt(ukDateMatch[1], 10);
        let month: number;
        const monthStr = ukDateMatch[2];
        
        if (isNaN(parseInt(monthStr, 10))) {
          // Month name (full or abbreviated)
          month = parseMonthName(monthStr);
        } else {
          month = parseInt(monthStr, 10) - 1; // JS months are 0-indexed
        }
        
        let year = parseInt(ukDateMatch[3], 10);
        if (year < 100) year += 2000; // Handle 2-digit years
        
        if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
          return new Date(year, month, day);
        }
      }
      
      // Month-first with year: "March 16th 2026", "January 1st 2025"
      const monthFirstWithYearMatch = lowerStr.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?[\s,]+(\d{2,4})/i);
      if (monthFirstWithYearMatch) {
        const monthStr = monthFirstWithYearMatch[1];
        const day = parseInt(monthFirstWithYearMatch[2], 10);
        let year = parseInt(monthFirstWithYearMatch[3], 10);
        const month = parseMonthName(monthStr);
        
        if (year < 100) year += 2000; // Handle 2-digit years
        
        if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
          return new Date(year, month, day);
        }
      }
      
      // "15th January" or "January 15th" without year - handles ordinals and full month names
      const monthDayMatch = lowerStr.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
      if (monthDayMatch) {
        const day = parseInt(monthDayMatch[1] || monthDayMatch[4], 10);
        const monthStr = (monthDayMatch[2] || monthDayMatch[3]);
        const month = parseMonthName(monthStr);
        
        if (day >= 1 && day <= 31 && month >= 0) {
          let year = now.getFullYear();
          const result = new Date(year, month, day);
          // If date has passed, assume next year
          if (result < now) {
            result.setFullYear(year + 1);
          }
          return result;
        }
      }
      
      // Try standard date parsing as last resort
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime()) && parsed > now) {
        return parsed;
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  }
  
  /**
   * Parse amount from string
   */
  private parseAmount(amountStr: string): number | undefined {
    try {
      // Remove currency symbols and commas
      const cleaned = amountStr.replace(/[£$€,]/g, '').trim();
      const amount = parseFloat(cleaned);
      return isNaN(amount) ? undefined : amount;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Handle payment plan intent - create payment plan record and update invoice
   * This creates an actual payment_plans record so EPD/cash-inflow forecasts update
   */
  private async handlePaymentPlanIntent(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult
  ): Promise<void> {
    try {
      console.log(`💰 Payment plan intent detected for contact ${message.contactId}`);
      
      if (!message.contactId) {
        console.warn(`⚠️  Cannot create payment plan - no contactId on message ${message.id}`);
        return;
      }
      
      // Extract amount from entities (use first amount or estimate from invoice)
      let totalAmount = 0;
      if (analysis.extractedEntities.amounts?.length) {
        const amountStr = analysis.extractedEntities.amounts[0];
        const cleaned = amountStr.replace(/[£$€,]/g, '').trim();
        totalAmount = parseFloat(cleaned) || 0;
      }
      
      // If no amount extracted but we have an invoice, use invoice balance (tenant-scoped)
      if (totalAmount === 0 && message.invoiceId) {
        const invoice = await db.select().from(invoices)
          .where(and(
            eq(invoices.id, message.invoiceId),
            eq(invoices.tenantId, message.tenantId)
          ))
          .limit(1);
        if (invoice.length > 0) {
          const inv = invoice[0];
          totalAmount = Number(inv.amount) - Number(inv.amountPaid || 0);
        }
      }
      
      // Default to a reasonable estimate if still no amount
      if (totalAmount === 0) {
        totalAmount = 1000; // Default placeholder
      }
      
      // Parse start date from entities (default to tomorrow)
      let planStartDate = new Date();
      planStartDate.setDate(planStartDate.getDate() + 1); // Tomorrow by default
      
      if (analysis.extractedEntities.dates?.length) {
        const parsedDate = this.parsePromisedDate(analysis.extractedEntities.dates[0]);
        if (parsedDate) {
          planStartDate = parsedDate;
        }
      }
      
      // Get a user from this tenant for the addedByUserId field (required FK)
      const tenantUser = await db.select().from(users)
        .where(eq(users.tenantId, message.tenantId))
        .limit(1);
      
      if (tenantUser.length === 0) {
        console.warn(`⚠️  Cannot create payment plan - no users found for tenant ${message.tenantId}`);
        return;
      }
      const addedByUserId = tenantUser[0].id;
      
      // Create the payment plan record
      const [newPlan] = await db.insert(paymentPlans).values({
        tenantId: message.tenantId,
        contactId: message.contactId,
        totalAmount: totalAmount.toFixed(2),
        paymentFrequency: 'monthly', // Default for MVP
        numberOfPayments: 3, // Default for MVP
        planStartDate: planStartDate,
        status: 'active',
        outstandingAtCreation: totalAmount.toFixed(2),
        nextCheckDate: planStartDate, // Check on plan start date
        source: 'inbound_intent'
      }).returning();
      
      console.log(`✅ Created payment plan ${newPlan.id} for contact ${message.contactId}`);
      
      // If we have an invoice, link it to the plan and update outcomeOverride
      if (message.invoiceId) {
        await db.insert(paymentPlanInvoices).values({
          paymentPlanId: newPlan.id,
          invoiceId: message.invoiceId,
          addedByUserId: addedByUserId
        });
        
        await db
          .update(invoices)
          .set({
            outcomeOverride: 'Plan',
            updatedAt: new Date()
          })
          .where(and(eq(invoices.id, message.invoiceId), eq(invoices.tenantId, message.tenantId)));
        
        console.log(`✅ Linked invoice ${message.invoiceId} to payment plan and updated outcomeOverride`);
      }
      
      console.log(`💰 Payment plan created. Amount: £${totalAmount.toFixed(2)}, Start: ${planStartDate.toISOString()}`);
    } catch (error) {
      console.error('❌ Error handling payment plan intent:', error);
      logSystemError({ tenantId: message.tenantId ?? undefined, source: 'intent_analyst', severity: 'error', message: `Error handling payment plan intent: ${error instanceof Error ? error.message : String(error)}`, stackTrace: error instanceof Error ? error.stack : undefined, context: { messageId: message.id, contactId: message.contactId ?? undefined, invoiceId: message.invoiceId ?? undefined } }).catch(() => {});
    }
  }

  /**
   * Handle dispute intent - update invoice pauseState and outcomeOverride
   */
  private async handleDisputeIntent(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult
  ): Promise<void> {
    try {
      console.log(`⚠️ Dispute intent detected for invoice ${message.invoiceId}`);
      
      // Update invoice with dispute status
      if (message.invoiceId) {
        await db
          .update(invoices)
          .set({
            outcomeOverride: 'Disputed',
            pauseState: 'dispute',
            updatedAt: new Date()
          })
          .where(and(eq(invoices.id, message.invoiceId), eq(invoices.tenantId, message.tenantId)));
        
        console.log(`✅ Updated invoice ${message.invoiceId} to disputed status`);
      }
      
      // Extract dispute reason if mentioned
      const disputeReason = analysis.extractedEntities.reasons?.join('; ') || analysis.reasoning;
      console.log(`⚠️ Dispute recorded. Reason: ${disputeReason}`);
    } catch (error) {
      console.error('❌ Error handling dispute intent:', error);
      logSystemError({ tenantId: message.tenantId ?? undefined, source: 'intent_analyst', severity: 'error', message: `Error handling dispute intent: ${error instanceof Error ? error.message : String(error)}`, stackTrace: error instanceof Error ? error.stack : undefined, context: { messageId: message.id, contactId: message.contactId ?? undefined, invoiceId: message.invoiceId ?? undefined } }).catch(() => {});
    }
  }

  /**
   * Build the full email conversation thread for a contact, formatted for AI analysis.
   * Pulls all email_messages (inbound + outbound) in chronological order.
   */
  private async buildConversationThread(tenantId: string, contactId: string): Promise<string> {
    const messages = await db
      .select({
        direction: emailMessages.direction,
        subject: emailMessages.subject,
        textBody: emailMessages.textBody,
        inboundText: emailMessages.inboundText,
        inboundSubject: emailMessages.inboundSubject,
        fromName: emailMessages.fromName,
        inboundFromName: emailMessages.inboundFromName,
        sentAt: emailMessages.sentAt,
        receivedAt: emailMessages.receivedAt,
        createdAt: emailMessages.createdAt,
      })
      .from(emailMessages)
      .where(and(
        eq(emailMessages.tenantId, tenantId),
        eq(emailMessages.contactId, contactId),
      ))
      .orderBy(asc(sql`COALESCE(${emailMessages.sentAt}, ${emailMessages.receivedAt}, ${emailMessages.createdAt})`))
      .limit(30);

    if (messages.length === 0) return 'No previous email messages found.';

    return messages.map((msg, i) => {
      const isOutbound = msg.direction === 'OUTBOUND';
      const sender = isOutbound
        ? (msg.fromName || 'Accounts Team')
        : (msg.inboundFromName || 'Debtor');
      const subject = isOutbound ? msg.subject : msg.inboundSubject;
      const body = isOutbound ? msg.textBody : msg.inboundText;
      const timestamp = msg.sentAt || msg.receivedAt || msg.createdAt;
      const dateStr = timestamp ? new Date(timestamp).toISOString() : 'unknown';
      const dir = isOutbound ? 'OUTBOUND (our email)' : 'INBOUND (debtor reply)';

      const bodyText = body
        ? body.split(/\n\nOn .* wrote:/)[0].trim().substring(0, 1500)
        : '(no text content)';

      return `--- Message ${i + 1} [${dir}] ${dateStr} ---\nFrom: ${sender}\nSubject: ${subject || '(no subject)'}\n\n${bodyText}`;
    }).join('\n\n');
  }

  /**
   * Use AI to analyze the full conversation thread and extract a structured payment arrangement.
   * Handles multi-tranche plans (e.g. "£20k on 13th Feb, balance at end of Feb").
   */
  private async analyzeConversationForPaymentArrangement(
    conversationThread: string,
    outstandingInvoices: Array<{ invoiceNumber: string; amount: number; dueDate: string }>,
    totalOutstanding: number
  ): Promise<{
    intentType: 'promise_to_pay' | 'payment_plan';
    confidence: number;
    installments: Array<{ date: string; amount: number; description: string }>;
    totalAmount: number;
    invoiceAllocation: string;
    reasoning: string;
  }> {
    const invoiceList = outstandingInvoices.length > 0
      ? outstandingInvoices.map(inv => `  - ${inv.invoiceNumber}: £${inv.amount.toFixed(2)} (due ${inv.dueDate})`).join('\n')
      : '  (no specific invoices available)';

    const prompt = `You are an AI credit controller assistant. Analyze the FULL email conversation thread below between our accounts team and a debtor. Extract the final agreed payment arrangement.

FULL CONVERSATION THREAD (chronological order):
${conversationThread}

OUTSTANDING INVOICES:
${invoiceList}
Total Outstanding: £${totalOutstanding.toFixed(2)}

TODAY'S DATE: ${new Date().toISOString().split('T')[0]}

YOUR TASK:
Read the ENTIRE conversation and extract the final agreed payment arrangement. Pay close attention to:
- Specific dates mentioned for each payment (e.g. "13th February", "end of Feb", "next Friday")
- Specific amounts for each payment tranche
- Whether the debtor is proposing a single lump sum or multiple payments on different dates
- Any invoice allocation preferences (e.g. "oldest first", "specific invoices")

RULES:
1. If the debtor mentioned DIFFERENT dates for DIFFERENT amounts, this is a MULTI-TRANCHE payment plan (intentType: "payment_plan") with separate installments for each date+amount pair.
2. Convert all relative dates to concrete calendar dates (e.g. "end of Feb" → "2026-02-28", "next Friday" → specific date).
3. If "the balance" or "remaining" is mentioned for a later date, calculate the actual amount (total outstanding minus earlier payments).
4. If the debtor said "oldest invoices first", note that in invoiceAllocation.
5. Only include arrangements the debtor has actually committed to — not questions or hypotheticals.
6. Use the LATEST position from the conversation. If they revised their offer in a later message, use the revised version.

Return JSON:
{
  "intentType": "promise_to_pay" | "payment_plan",
  "confidence": 0.0 to 1.0,
  "installments": [
    { "date": "YYYY-MM-DD", "amount": numeric_amount, "description": "brief note e.g. first payment, balance payment" }
  ],
  "totalAmount": total numeric amount across all installments,
  "invoiceAllocation": "how debtor wants payments allocated to invoices, or 'not specified'",
  "reasoning": "brief explanation of how you extracted this from the conversation"
}

CRITICAL: Each payment tranche on a DIFFERENT date MUST be a SEPARATE entry in the installments array. Do NOT merge payments on different dates into one entry.`;

    const result = await generateJSON<any>({
      system: prompt,
      prompt: "Extract the payment arrangement from this conversation.",
      model: "fast",
      temperature: 0.2,
      schemaHint: `{ intentType, confidence, installments: [{ date, amount, description }], totalAmount, invoiceAllocation, reasoning }`,
      logContext: { caller: 'intent_ptp_extraction' },
    });

    return {
      intentType: result.intentType === 'payment_plan' ? 'payment_plan' : 'promise_to_pay',
      confidence: Math.min(1, Math.max(0, result.confidence || 0.8)),
      installments: (result.installments || []).map((inst: any) => ({
        date: inst.date || '',
        amount: Number(inst.amount) || 0,
        description: inst.description || '',
      })),
      totalAmount: Number(result.totalAmount) || 0,
      invoiceAllocation: result.invoiceAllocation || 'not specified',
      reasoning: result.reasoning || '',
    };
  }

  /**
   * Handle a response to a pending clarification.
   * Uses the FULL conversation thread (not just the latest reply) to extract
   * accurate payment arrangements including multi-tranche plans.
   */
  private async handleClarificationResponse(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    clarification: typeof emailClarifications.$inferSelect,
    context: any
  ): Promise<void> {
    try {
      if (!message.contactId) {
        console.warn('Cannot handle clarification response - no contactId');
        return;
      }

      if (!message.from) {
        console.warn('Cannot handle clarification response - no sender email address');
        return;
      }

      console.log(`📧 Processing clarification response with full conversation context...`);

      const conversationThread = await this.buildConversationThread(message.tenantId, message.contactId);

      let resolvedInvoices = await this.resolveInvoiceReferences(
        analysis,
        message.tenantId,
        message.contactId
      );

      const allOutstanding = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          dueDate: invoices.dueDate,
        })
        .from(invoices)
        .where(and(
          eq(invoices.tenantId, message.tenantId),
          eq(invoices.contactId, message.contactId),
          eq(invoices.status, 'OPEN')
        ))
        .orderBy(asc(invoices.dueDate))
        .limit(50);

      const totalOutstanding = allOutstanding.reduce((sum, inv) => sum + Number(inv.amount), 0);

      const arrangement = await this.analyzeConversationForPaymentArrangement(
        conversationThread,
        allOutstanding.map(inv => ({
          invoiceNumber: inv.invoiceNumber || 'Unknown',
          amount: Number(inv.amount),
          dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : 'unknown',
        })),
        totalOutstanding
      );

      console.log(`📋 Extracted arrangement: ${arrangement.intentType}, ${arrangement.installments.length} installment(s), total £${arrangement.totalAmount.toFixed(2)}`);
      arrangement.installments.forEach((inst, i) => {
        console.log(`   Instalment ${i + 1}: £${inst.amount.toFixed(2)} on ${inst.date} (${inst.description})`);
      });

      const linkedInvoices = resolvedInvoices.linkedInvoices;

      const resolvedData = {
        intentType: arrangement.intentType,
        extractedEntities: analysis.extractedEntities,
        promiseToPayDate: arrangement.installments[0]?.date || null,
        promiseToPayAmount: arrangement.totalAmount,
        confidence: arrangement.confidence,
        installments: arrangement.installments,
        invoiceAllocation: arrangement.invoiceAllocation,
        resolvedInvoices: linkedInvoices.map(inv => ({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
        })),
      };

      await emailClarificationService.resolveClarification(
        clarification.id,
        message.id,
        arrangement.intentType,
        resolvedData
      );

      const isConfirmable = arrangement.confidence >= this.CONFIDENCE_THRESHOLD &&
        arrangement.installments.length > 0 &&
        arrangement.installments.every(inst => inst.date && inst.amount > 0);

      if (isConfirmable) {
        let paymentPlanDetails: { totalAmount: number; installments: Array<{ date: string; amount: number }> } | undefined;

        if (arrangement.intentType === 'payment_plan' || arrangement.installments.length > 1) {
          paymentPlanDetails = {
            totalAmount: arrangement.totalAmount,
            installments: arrangement.installments.map(inst => ({
              date: inst.date,
              amount: inst.amount,
            })),
          };
        }

        const [contact] = await db.select().from(contacts).where(eq(contacts.id, message.contactId)).limit(1);
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, message.tenantId)).limit(1);

        if (contact && tenant) {
          const intentTypeForEmail = arrangement.installments.length > 1 ? 'payment_plan' : arrangement.intentType;
          const result = await emailClarificationService.sendConfirmationEmail({
            tenantId: message.tenantId,
            contactId: message.contactId,
            contactEmail: message.from,
            contactName: contact.name || contact.companyName || 'Customer',
            tenantName: tenant.name || 'Our company',
            intentType: intentTypeForEmail as 'promise_to_pay' | 'payment_plan',
            ptpDate: arrangement.installments[0]?.date || undefined,
            ptpAmount: arrangement.installments.length === 1 ? arrangement.installments[0].amount : arrangement.totalAmount,
            invoiceId: message.invoiceId || resolvedInvoices.invoiceId || undefined,
            invoices: linkedInvoices.map(inv => ({
              invoiceNumber: inv.invoiceNumber,
              amount: inv.amount,
            })),
            paymentPlanDetails,
            sourceChannel: message.channel || 'email',
          });

          if (result.success) {
            console.log(`✅ Confirmation email sent with full-conversation-resolved data`);
          } else {
            console.error(`❌ Failed to send confirmation: ${result.error}`);
          }
        }

        await this.createOutcomeFromArrangement(
          message,
          arrangement,
          context,
          resolvedInvoices.invoiceId,
          linkedInvoices.map(inv => inv.id)
        );

        await db
          .update(emailClarifications)
          .set({
            confirmationSentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emailClarifications.id, clarification.id));

        console.log(`✅ Clarification resolved and confirmation sent`);
      } else {
        console.log(`⚠️ Arrangement not confirmable (confidence: ${arrangement.confidence}, installments: ${arrangement.installments.length}) — may need further clarification`);
      }

      await this.createActionFromIntent(message, analysis);

    } catch (error) {
      console.error('Failed to handle clarification response:', error);
      logSystemError({ tenantId: message.tenantId ?? undefined, source: 'intent_analyst', severity: 'error', message: `Failed to handle clarification response: ${error instanceof Error ? error.message : String(error)}`, stackTrace: error instanceof Error ? error.stack : undefined, context: { messageId: message.id, contactId: message.contactId ?? undefined } }).catch(() => {});
    }
  }

  /**
   * Create a pending clarification outcome for forecasting
   * This marks the intent as "awaiting clarification" so forecasting knows about it
   */
  private async createPendingClarificationOutcome(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: any,
    clarificationId?: string
  ): Promise<void> {
    try {
      if (!message.contactId) return;
      
      const outcomeType = INTENT_TO_OUTCOME_TYPE[analysis.intentType];
      
      // Build extracted data preserving any date/amount info from the original analysis
      const extractedData: Record<string, any> = {
        freeTextNotes: `Awaiting clarification (ID: ${clarificationId || 'pending'}). ${analysis.reasoning}`
      };
      
      // Preserve promise date from analysis so the chart can still show a forecast
      const dates = analysis.extractedEntities?.dates || [];
      if (dates.length > 0) {
        const parsedDate = this.parsePromisedDate(dates[0]);
        if (parsedDate) {
          extractedData.promiseToPayDate = parsedDate.toISOString().split('T')[0];
        }
      }
      
      // Preserve amounts if available (use same field name and parsing as buildExtractedData)
      const amounts = analysis.extractedEntities?.amounts || [];
      if (amounts.length > 0) {
        const parsedAmount = this.parseAmount(amounts[0]);
        if (parsedAmount && parsedAmount > 0) {
          extractedData.promiseToPayAmount = parsedAmount;
        }
      }
      
      // Create an outcome with MANUAL_REVIEW effect to indicate it needs clarification
      const [outcome] = await db
        .insert(outcomes)
        .values({
          tenantId: message.tenantId,
          debtorId: message.contactId,
          invoiceId: message.invoiceId || null,
          linkedInvoiceIds: [],
          type: outcomeType,
          confidence: analysis.confidence.toFixed(2),
          confidenceBand: 'LOW', // Mark as low confidence since ambiguous
          requiresHumanReview: true,
          effect: 'MANUAL_REVIEW', // Pending clarification
          extracted: extractedData,
          sourceChannel: (message.channel?.toUpperCase() || 'EMAIL') as string,
          sourceMessageId: message.id,
          rawSnippet: message.content?.substring(0, 500) || '',
        })
        .returning();
      
      console.log(`📋 Created pending clarification outcome: ${outcome.id}${clarificationId ? ` (linked to clarification ${clarificationId})` : ''}`);
    } catch (error) {
      console.error('Failed to create pending clarification outcome:', error);
    }
  }

  /**
   * Resolve invoice references from analysis to actual invoice IDs
   */
  private async resolveInvoiceReferences(
    analysis: IntentAnalysisResult,
    tenantId: string,
    contactId: string
  ): Promise<{ invoiceId: string | null; linkedInvoices: Array<{ id: string; invoiceNumber: string; amount: number }> }> {
    const invoiceRefs = analysis.extractedEntities.invoiceReferences || [];
    
    // Get all outstanding invoices for this contact once
    const allOutstanding = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, amount: invoices.amount })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.contactId, contactId),
        eq(invoices.status, 'OPEN')
      ))
      .limit(50);
    
    if (invoiceRefs.length === 0) {
      // No references provided
      // If only one outstanding, assume that's what they mean
      if (allOutstanding.length === 1) {
        return { 
          invoiceId: allOutstanding[0].id, 
          linkedInvoices: allOutstanding.map(inv => ({ 
            id: inv.id, 
            invoiceNumber: inv.invoiceNumber || '', 
            amount: Number(inv.amount) 
          }))
        };
      }
      
      // Multiple outstanding, no references - can't resolve, return all for context
      // The confirmation will list all or require manual review
      return { 
        invoiceId: null, 
        linkedInvoices: allOutstanding.map(inv => ({ 
          id: inv.id, 
          invoiceNumber: inv.invoiceNumber || '', 
          amount: Number(inv.amount) 
        }))
      };
    }
    
    // Try to match references to actual invoices
    const matchedInvoices: Array<{ id: string; invoiceNumber: string; amount: number }> = [];
    
    for (const ref of invoiceRefs) {
      // Normalize reference - remove common prefixes like "INV-", "Invoice ", etc.
      const normalizedRef = ref.toLowerCase().replace(/^(inv[-\s]?|invoice[-\s]?|#)/i, '').trim();
      
      for (const inv of allOutstanding) {
        const invNum = (inv.invoiceNumber || '').toLowerCase();
        const normalizedInvNum = invNum.replace(/^(inv[-\s]?|invoice[-\s]?|#)/i, '').trim();
        
        // Match if: exact match, invNum contains ref, ref contains invNum, or normalized versions match
        const isMatch = 
          invNum === normalizedRef ||
          normalizedInvNum === normalizedRef ||
          invNum.includes(normalizedRef) ||
          normalizedRef.includes(normalizedInvNum) ||
          normalizedInvNum.includes(normalizedRef);
        
        if (isMatch && !matchedInvoices.find(m => m.id === inv.id)) {
          matchedInvoices.push({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber || '',
            amount: Number(inv.amount)
          });
        }
      }
    }
    
    return {
      invoiceId: matchedInvoices.length > 0 ? matchedInvoices[0].id : null,
      linkedInvoices: matchedInvoices
    };
  }

  /**
   * Send a clarification email when ambiguity is detected
   * Returns the clarificationId if successful
   */
  private async sendClarificationForAmbiguity(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: any
  ): Promise<{ clarificationId?: string } | null> {
    try {
      if (!message.contactId || !message.from) {
        console.warn('Cannot send clarification - missing contact or email');
        return null;
      }
      
      // Get contact and tenant info
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, message.contactId))
        .limit(1);
      
      if (!contact) {
        console.warn('Cannot send clarification - contact not found');
        return null;
      }
      
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, message.tenantId))
        .limit(1);
      
      // Get outstanding invoices for this contact
      const outstandingInvoices = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          dueDate: invoices.dueDate
        })
        .from(invoices)
        .where(and(
          eq(invoices.tenantId, message.tenantId),
          eq(invoices.contactId, message.contactId),
          eq(invoices.status, 'OPEN')
        ))
        .orderBy(invoices.dueDate)
        .limit(10);
      
      // Determine ambiguity type
      let ambiguityType = 'unknown';
      if (analysis.ambiguity?.details.unclearDate) ambiguityType = 'payment_date';
      else if (analysis.ambiguity?.details.unclearAmount) ambiguityType = 'payment_amount';
      else if (analysis.ambiguity?.details.multipleInvoices || analysis.ambiguity?.details.unclearInvoices) ambiguityType = 'invoice_reference';
      
      // Send clarification email
      const result = await emailClarificationService.sendClarificationEmail({
        tenantId: message.tenantId,
        contactId: message.contactId,
        messageId: message.id,
        contactEmail: message.from,
        contactName: contact.name || contact.companyName || 'Customer',
        companyName: contact.companyName || contact.name || '',
        tenantName: tenant?.name || 'Our company',
        ambiguityType,
        ambiguityDetails: analysis.ambiguity?.details || {},
        outstandingInvoices: outstandingInvoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber || 'Unknown',
          amount: Number(inv.amount),
          dueDate: inv.dueDate
        }))
      });
      
      if (result.success) {
        console.log(`📧 Clarification email sent for ambiguous ${analysis.intentType} (ID: ${result.clarificationId})`);
        return { clarificationId: result.clarificationId };
      } else {
        console.error(`❌ Failed to send clarification: ${result.error}`);
        return null;
      }
      
    } catch (error) {
      console.error('Failed to send clarification for ambiguity:', error);
      logSystemError({ tenantId: message.tenantId ?? undefined, source: 'intent_analyst', severity: 'error', message: `Failed to send clarification for ambiguity: ${error instanceof Error ? error.message : String(error)}`, stackTrace: error instanceof Error ? error.stack : undefined, context: { messageId: message.id, contactId: message.contactId ?? undefined } }).catch(() => {});
      return null;
    }
  }

  /**
   * Send a confirmation email when PTP or payment plan is clear
   */
  private async sendConfirmationEmail(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: any,
    activePromise?: typeof paymentPromises.$inferSelect | null,
  ): Promise<void> {
    try {
      if (!message.contactId || !message.from) {
        console.warn('Cannot send confirmation - missing contact or email');
        return;
      }
      
      // Get contact info
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, message.contactId))
        .limit(1);
      
      if (!contact) {
        console.warn('Cannot send confirmation - contact not found');
        return;
      }
      
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, message.tenantId))
        .limit(1);
      
      // Get invoice info if linked
      let linkedInvoices: Array<{ invoiceNumber: string; amount: number }> = [];
      if (message.invoiceId) {
        const [invoice] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, message.invoiceId))
          .limit(1);
        
        if (invoice) {
          linkedInvoices.push({
            invoiceNumber: invoice.invoiceNumber || 'Unknown',
            amount: Number(invoice.amount)
          });
        }
      }
      
      const ptpDate = this.extractPtpDate(analysis);
      const invoiceFallbackAmount = context.invoiceAmount || (linkedInvoices.length > 0 ? linkedInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0) : undefined);
      const ptpAmount = this.extractPtpAmount(analysis, invoiceFallbackAmount);
      
      // Guard: if we don't have a concrete date, send clarification instead
      if (!ptpDate && analysis.intentType === 'promise_to_pay') {
        console.log(`⚠️ Cannot compute concrete date for PTP - sending clarification instead of vague confirmation`);
        await this.sendClarificationForAmbiguity(message, analysis, context);
        return;
      }
      
      // Build payment plan details if applicable
      let paymentPlanDetails: { totalAmount: number; installments: Array<{ date: string; amount: number }> } | undefined;
      if (analysis.intentType === 'payment_plan') {
        const dates = analysis.extractedEntities.dates || [];
        const amounts = analysis.extractedEntities.amounts || [];
        
        if (dates.length > 0) {
          const installments: Array<{ date: string; amount: number }> = [];
          for (let i = 0; i < dates.length; i++) {
            const parsedDate = this.parsePromisedDate(dates[i]);
            if (parsedDate) {
              const amount = amounts[i] ? (this.parseAmount(amounts[i]) || 0) : ((invoiceFallbackAmount || 0) / dates.length);
              installments.push({
                date: parsedDate.toISOString().split('T')[0],
                amount
              });
            }
          }
          paymentPlanDetails = {
            totalAmount: ptpAmount || invoiceFallbackAmount || 0,
            installments
          };
        }
      }
      
      // Build modification context if modifying an existing active promise
      let modificationData: {
        isModification: boolean;
        previousPromise?: {
          promisedDate: string;
          promisedAmount?: number;
          originalPromisedDate?: string;
          daysPushed: number;
        };
      } | undefined;

      if (activePromise && ptpDate) {
        const oldDate = new Date(activePromise.promisedDate);
        const newDate = new Date(ptpDate);
        const daysPushed = Math.round((newDate.getTime() - oldDate.getTime()) / 86400000);

        if (Math.abs(daysPushed) > 1 || (ptpAmount && activePromise.promisedAmount && Math.abs(ptpAmount - Number(activePromise.promisedAmount)) > 1)) {
          // Find the original promise date (first in chain)
          let originalDate = oldDate;
          if (activePromise.previousPromiseId) {
            const [first] = await db
              .select({ promisedDate: paymentPromises.promisedDate })
              .from(paymentPromises)
              .where(
                and(
                  eq(paymentPromises.contactId, message.contactId!),
                  eq(paymentPromises.invoiceId, activePromise.invoiceId),
                )
              )
              .orderBy(asc(paymentPromises.createdAt))
              .limit(1);
            if (first) originalDate = new Date(first.promisedDate);
          }

          modificationData = {
            isModification: true,
            previousPromise: {
              promisedDate: oldDate.toISOString(),
              promisedAmount: activePromise.promisedAmount ? Number(activePromise.promisedAmount) : undefined,
              originalPromisedDate: originalDate.toISOString(),
              daysPushed,
            },
          };
        }
      }

      // Send confirmation email (with modification context if applicable)
      const result = await emailClarificationService.sendConfirmationEmail({
        tenantId: message.tenantId,
        contactId: message.contactId,
        contactEmail: message.from,
        contactName: contact.name || contact.companyName || 'Customer',
        tenantName: tenant?.name || 'Our company',
        intentType: analysis.intentType as 'promise_to_pay' | 'payment_plan',
        ptpDate: ptpDate || undefined,
        ptpAmount: ptpAmount || undefined,
        invoiceId: message.invoiceId || undefined,
        invoices: linkedInvoices.length > 0 ? linkedInvoices : undefined,
        paymentPlanDetails,
        sourceChannel: message.channel || 'email',
        ...(modificationData || {}),
      });
      
      if (result.success) {
        console.log(`✅ Confirmation email sent for ${analysis.intentType}`);
      } else {
        console.error(`❌ Failed to send confirmation: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
    }
  }

  /**
   * Send confirmation email with pre-resolved invoice data (used after clarification)
   */
  private async sendConfirmationEmailWithResolvedData(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: any,
    resolvedInvoices: Array<{ id: string; invoiceNumber: string; amount: number }>,
    resolvedAmount: number | null
  ): Promise<void> {
    try {
      if (!message.contactId || !message.from) {
        console.warn('Cannot send confirmation - missing contact or email');
        return;
      }
      
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, message.contactId))
        .limit(1);
      
      if (!contact) {
        console.warn('Cannot send confirmation - contact not found');
        return;
      }
      
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, message.tenantId))
        .limit(1);
      
      const ptpDate = this.extractPtpDate(analysis);
      const finalAmount = resolvedAmount || this.extractPtpAmount(analysis, context.invoiceAmount);
      
      // Build payment plan details if applicable
      let paymentPlanDetails: { totalAmount: number; installments: Array<{ date: string; amount: number }> } | undefined;
      if (analysis.intentType === 'payment_plan') {
        const dates = analysis.extractedEntities.dates || [];
        if (dates.length > 0) {
          const installments: Array<{ date: string; amount: number }> = [];
          for (const dateStr of dates) {
            const parsedDate = this.parsePromisedDate(dateStr);
            if (parsedDate) {
              installments.push({
                date: parsedDate.toISOString().split('T')[0],
                amount: finalAmount ? finalAmount / dates.length : 0
              });
            }
          }
          paymentPlanDetails = {
            totalAmount: finalAmount || 0,
            installments
          };
        }
      }
      
      const result = await emailClarificationService.sendConfirmationEmail({
        tenantId: message.tenantId,
        contactId: message.contactId,
        contactEmail: message.from,
        contactName: contact.name || contact.companyName || 'Customer',
        tenantName: tenant?.name || 'Our company',
        intentType: analysis.intentType as 'promise_to_pay' | 'payment_plan',
        ptpDate: ptpDate || undefined,
        ptpAmount: finalAmount || undefined,
        invoiceId: message.invoiceId || resolvedInvoices[0]?.id || undefined,
        invoices: resolvedInvoices.map(inv => ({
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount
        })),
        paymentPlanDetails,
        sourceChannel: message.channel || 'email',
      });
      
      if (result.success) {
        console.log(`✅ Confirmation email sent with resolved data for ${analysis.intentType}`);
      } else {
        console.error(`❌ Failed to send confirmation: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Failed to send confirmation email with resolved data:', error);
    }
  }

  /**
   * Create an outcome with explicit invoice linkage (used after clarification)
   */
  private async createOutcomeFromIntentWithInvoices(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: any,
    primaryInvoiceId: string | null,
    linkedInvoiceIds: string[]
  ): Promise<void> {
    try {
      if (!message.contactId) {
        console.warn('Cannot create outcome - no contactId');
        return;
      }
      
      const outcomeType = INTENT_TO_OUTCOME_TYPE[analysis.intentType];
      const effect = OUTCOME_FORECAST_EFFECTS[outcomeType];
      
      // Determine confidence band
      let confidenceBand: 'HIGH' | 'MEDIUM' | 'LOW';
      if (analysis.confidence >= 0.85) {
        confidenceBand = 'HIGH';
      } else if (analysis.confidence >= 0.6) {
        confidenceBand = 'MEDIUM';
      } else {
        confidenceBand = 'LOW';
      }
      
      const sourceChannel = message.channel?.toUpperCase() || 'EMAIL';
      const extracted = this.buildExtractedData(analysis, context);
      
      // Create the outcome with explicit invoice linkage
      const [outcome] = await db
        .insert(outcomes)
        .values({
          tenantId: message.tenantId,
          debtorId: message.contactId,
          invoiceId: primaryInvoiceId,
          linkedInvoiceIds: linkedInvoiceIds,
          type: outcomeType,
          confidence: analysis.confidence.toFixed(2),
          confidenceBand,
          requiresHumanReview: analysis.requiresHumanReview,
          effect,
          extracted,
          sourceChannel,
          sourceMessageId: message.id,
          rawSnippet: message.content?.substring(0, 500) || '',
        })
        .returning();
      
      console.log(`✅ Outcome created with resolved invoices: ${outcomeType} (${confidenceBand})`);
      
    } catch (error) {
      console.error('Failed to create outcome with invoices:', error);
    }
  }

  private async createOutcomeFromArrangement(
    message: typeof inboundMessages.$inferSelect,
    arrangement: {
      intentType: 'promise_to_pay' | 'payment_plan';
      confidence: number;
      installments: Array<{ date: string; amount: number; description: string }>;
      totalAmount: number;
      invoiceAllocation: string;
    },
    context: any,
    primaryInvoiceId: string | null,
    linkedInvoiceIds: string[]
  ): Promise<void> {
    try {
      if (!message.contactId) {
        console.warn('Cannot create outcome - no contactId');
        return;
      }

      const outcomeType = arrangement.intentType === 'payment_plan' ? 'PAYMENT_PLAN' : 'PROMISE_TO_PAY';
      const effect = OUTCOME_FORECAST_EFFECTS[outcomeType];

      let confidenceBand: 'HIGH' | 'MEDIUM' | 'LOW';
      if (arrangement.confidence >= 0.85) {
        confidenceBand = 'HIGH';
      } else if (arrangement.confidence >= 0.6) {
        confidenceBand = 'MEDIUM';
      } else {
        confidenceBand = 'LOW';
      }

      const sourceChannel = message.channel?.toUpperCase() || 'EMAIL';

      const extracted: any = {
        promiseToPayAmount: arrangement.totalAmount,
      };

      if (arrangement.installments.length === 1) {
        extracted.promiseToPayDate = arrangement.installments[0].date;
      } else if (arrangement.installments.length > 1) {
        extracted.paymentPlanSchedule = arrangement.installments.map(inst => ({
          date: inst.date,
          amount: inst.amount,
        }));
        extracted.promiseToPayDate = arrangement.installments[0].date;
      }

      if (arrangement.invoiceAllocation && arrangement.invoiceAllocation !== 'not specified') {
        extracted.invoiceAllocation = arrangement.invoiceAllocation;
      }

      if (context.contactName) {
        extracted.confirmedBy = context.contactName;
      }

      const [outcome] = await db
        .insert(outcomes)
        .values({
          tenantId: message.tenantId,
          debtorId: message.contactId,
          invoiceId: primaryInvoiceId,
          linkedInvoiceIds: linkedInvoiceIds,
          type: outcomeType,
          confidence: arrangement.confidence.toFixed(2),
          confidenceBand,
          requiresHumanReview: false,
          effect,
          extracted,
          sourceChannel,
          sourceMessageId: message.id,
          rawSnippet: message.content?.substring(0, 500) || '',
        })
        .returning();

      console.log(`✅ Outcome created from arrangement: ${outcomeType} (${confidenceBand}) with ${arrangement.installments.length} installment(s)`);
    } catch (error) {
      console.error('Failed to create outcome from arrangement:', error);
    }
  }

  /**
   * Extract PTP date from analysis - tries all extracted dates until one parses
   */
  private extractPtpDate(analysis: IntentAnalysisResult): string | null {
    const dates = analysis.extractedEntities.dates || [];
    for (const dateStr of dates) {
      const parsed = this.parsePromisedDate(dateStr);
      if (parsed) {
        return parsed.toISOString().split('T')[0];
      }
    }
    return null;
  }

  /**
   * Extract PTP amount from analysis
   * Falls back to invoice amount so confirmation emails always have a value
   */
  private extractPtpAmount(analysis: IntentAnalysisResult, fallbackAmount?: number): number | null {
    const amounts = analysis.extractedEntities.amounts || [];
    if (amounts.length > 0) {
      const parsed = this.parseAmount(amounts[0]);
      if (parsed) return parsed;
    }
    return fallbackAmount || null;
  }

  /**
   * Process all unanalyzed messages
   */
  async processAllPending(): Promise<void> {
    try {
      const pendingMessages = await db
        .select()
        .from(inboundMessages)
        .where(eq(inboundMessages.intentAnalyzed, false))
        .limit(50); // Process in batches

      console.log(`📋 Found ${pendingMessages.length} messages to analyze`);

      for (const message of pendingMessages) {
        await this.processInboundMessage(message.id);
      }

      console.log(`✅ Batch analysis completed`);
    } catch (error) {
      console.error('❌ Error in batch processing:', error);
    }
  }
}

// Export singleton instance
export const intentAnalyst = new IntentAnalyst();
