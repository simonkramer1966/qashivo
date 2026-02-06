import OpenAI from "openai";
import { db } from "../db";
import { inboundMessages, actions, contacts, invoices, paymentPlans, paymentPlanInvoices, users, outcomes, emailClarifications, tenants } from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getPromiseReliabilityService } from "./promiseReliabilityService.js";
import { emailClarificationService } from "./emailClarificationService.js";

// Outcome types that map to CharlieIntentType
type OutcomeType = 
  | 'PROMISE_TO_PAY'
  | 'PAYMENT_PLAN' 
  | 'DISPUTE'
  | 'PAYMENT_CONFIRMATION'
  | 'VULNERABILITY'
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
  'vulnerability': 'VULNERABILITY',
  'callback_request': 'CALLBACK_REQUEST',
  'admin_issue': 'ADMIN_BLOCKER',
  'general_query': 'QUERY',
  'unknown': 'UNKNOWN'
};

// Forecast effect for each outcome type
type ForecastEffect = 'FORECAST_UPDATED' | 'ROUTED_TO_ATTENTION' | 'MANUAL_REVIEW' | 'NO_EFFECT';
const OUTCOME_FORECAST_EFFECTS: Record<OutcomeType, ForecastEffect> = {
  'PROMISE_TO_PAY': 'FORECAST_UPDATED',
  'PAYMENT_PLAN': 'FORECAST_UPDATED',
  'DISPUTE': 'ROUTED_TO_ATTENTION',
  'PAYMENT_CONFIRMATION': 'FORECAST_UPDATED',
  'VULNERABILITY': 'MANUAL_REVIEW',
  'CALLBACK_REQUEST': 'NO_EFFECT',
  'ADMIN_BLOCKER': 'ROUTED_TO_ATTENTION',
  'QUERY': 'NO_EFFECT',
  'UNKNOWN': 'MANUAL_REVIEW'
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Charlie-aligned intent types for B2B credit control
type CharlieIntentType = 
  | 'payment_plan'        // Customer wants to negotiate payment plan
  | 'dispute'             // Customer disputes the invoice
  | 'promise_to_pay'      // Customer commits to paying by specific date
  | 'payment_confirmation'// Customer confirms payment has been made
  | 'vulnerability'       // Hardship/vulnerability indicator detected
  | 'callback_request'    // Customer requests a phone call back
  | 'general_query'       // General questions about invoice/payment
  | 'admin_issue'         // Missing PO, wrong address, not received, etc.
  | 'unknown';            // Intent unclear

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
  sentiment: 'positive' | 'neutral' | 'negative';
  extractedEntities: {
    amounts?: string[];
    dates?: string[];
    promises?: string[];
    reasons?: string[];
    invoiceReferences?: string[];  // Invoice numbers, PO numbers
    contactPreferences?: string[]; // Phone, email preferences
  };
  reasoning: string;
  requiresHumanReview: boolean;    // Flag for vulnerability/edge cases
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
   * Analyze an inbound message using OpenAI
   */
  async analyzeIntent(messageContent: string, context?: {
    contactName?: string;
    invoiceAmount?: number;
    daysPastDue?: number;
  }): Promise<IntentAnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(messageContent, context);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are Charlie, an expert B2B credit control AI analyzing inbound customer communications.
Your role is to detect intent, extract actionable information, and recommend next steps.

Intent Types (in priority order):
- vulnerability: Customer indicates hardship, financial distress, mental health issues, or vulnerability. ALWAYS flag for human review.
- dispute: Customer disputes the invoice (quality, delivery, pricing, scope issues)
- promise_to_pay: Customer commits to paying by a specific date/timeframe
- payment_confirmation: Customer confirms payment has already been made or is in process
- callback_request: Customer explicitly asks to be called back or prefers phone communication
- admin_issue: Missing PO, wrong billing address, invoice not received, supplier setup issues
- payment_plan: Customer wants to negotiate installments or staged payments
- general_query: General questions about invoice, payment process, or account
- unknown: Intent is genuinely unclear

Critical Rules:
1. If ANY vulnerability/hardship indicator is detected, ALWAYS classify as 'vulnerability' regardless of other content
2. Look for admin blockers (missing PO, wrong address) - these are common in B2B
3. Extract invoice/PO references when mentioned
4. Note preferred contact methods
5. Consider B2B context: professional tone expected, process-driven issues common

Respond with valid JSON only, no markdown formatting.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      const intentType = result.intentType || 'unknown';
      
      // Determine if human review is required
      const requiresHumanReview = 
        intentType === 'vulnerability' ||
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
      
      return {
        intentType,
        confidence: Math.min(Math.max(result.confidence || 0, 0), 1),
        sentiment: result.sentiment || 'neutral',
        extractedEntities: result.extractedEntities || {},
        reasoning: result.reasoning || '',
        requiresHumanReview,
        suggestedNextAction: result.suggestedNextAction,
        ambiguity
      };
    } catch (error) {
      console.error('❌ Intent analysis failed:', error);
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
    invoiceAmount?: number;
    daysPastDue?: number;
  }): string {
    let prompt = `Analyze this B2B customer message:\n\n"${message}"\n\n`;
    
    if (context) {
      prompt += `Context:\n`;
      if (context.contactName) prompt += `- Customer: ${context.contactName}\n`;
      if (context.invoiceAmount) prompt += `- Invoice Amount: £${context.invoiceAmount.toFixed(2)}\n`;
      if (context.daysPastDue !== undefined) {
        if (context.daysPastDue > 0) {
          prompt += `- Days Overdue: ${context.daysPastDue}\n`;
        } else if (context.daysPastDue === 0) {
          prompt += `- Status: Due today\n`;
        } else {
          prompt += `- Days until due: ${Math.abs(context.daysPastDue)}\n`;
        }
      }
      prompt += '\n';
    }

    prompt += `Respond with JSON:
{
  "intentType": "vulnerability" | "dispute" | "promise_to_pay" | "payment_confirmation" | "callback_request" | "admin_issue" | "payment_plan" | "general_query" | "unknown",
  "confidence": 0.0 to 1.0,
  "sentiment": "positive" | "neutral" | "negative",
  "extractedEntities": {
    "amounts": ["any monetary amounts mentioned"],
    "dates": ["any dates or timeframes mentioned (e.g., 'Friday', 'next week', '15th January')"],
    "promises": ["any payment commitments or undertakings"],
    "reasons": ["reasons for dispute, delay, or non-payment"],
    "invoiceReferences": ["any invoice numbers, PO numbers, or references mentioned"],
    "contactPreferences": ["preferred contact methods or times mentioned"]
  },
  "reasoning": "brief explanation of your classification",
  "requiresHumanReview": true/false,
  "suggestedNextAction": "what Charlie recommends as next step (e.g., 'Schedule callback', 'Resend invoice with PO', 'Record PTP and monitor')",
  "ambiguity": {
    "hasAmbiguity": true/false,
    "types": ["invoice_reference" | "payment_amount" | "payment_date" | "multiple_invoices"],
    "details": {
      "unclearInvoices": true/false,
      "unclearAmount": true/false,
      "unclearDate": true/false,
      "multipleInvoices": true/false,
      "clarificationQuestions": ["specific polite questions to ask the debtor to clarify the ambiguity"]
    }
  }
}

IMPORTANT for ambiguity detection:
- If the customer mentions payment but doesn't specify WHICH invoice or invoices, set unclearInvoices: true
- If the customer promises to pay but the amount is vague or doesn't match known invoice amounts, set unclearAmount: true  
- If the customer promises to pay but gives no specific date (just "soon", "next week" without a day), set unclearDate: true
- If the customer has multiple outstanding invoices and it's unclear which they're referring to, set multipleInvoices: true
- Generate 1-3 polite, professional clarification questions to resolve the ambiguity
- hasAmbiguity should be true if ANY of the above are unclear for promise_to_pay or payment_plan intents`;

    return prompt;
  }

  /**
   * Process an unanalyzed inbound message
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
        
        if (shouldConfirm) {
          console.log(`✅ Clear ${analysis.intentType} detected - sending confirmation email`);
          await this.sendConfirmationEmail(message, analysis, context);
        }
      }

      // Determine if we should create an action
      const shouldCreateAction = 
        analysis.intentType === 'vulnerability' || // Always create for vulnerability
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
        // (Legacy table - kept for backwards compatibility)
        if (analysis.intentType === 'promise_to_pay' && 
            analysis.confidence >= this.CONFIDENCE_THRESHOLD &&
            message.contactId && message.invoiceId) {
          await this.createPromiseFromIntent(message, analysis, context);
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
        }
        
        // Flag contact as potentially vulnerable if vulnerability detected
        if (analysis.intentType === 'vulnerability' && message.contactId) {
          await this.flagContactAsVulnerable(message.contactId, message.tenantId, analysis);
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

    } catch (error) {
      console.error(`❌ Error processing message ${messageId}:`, error);
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
        vulnerability: 'urgent',
        dispute: 'high',
        promise_to_pay: 'medium',
        payment_confirmation: 'low',
        callback_request: 'high',
        admin_issue: 'medium',
        payment_plan: 'medium',
        general_query: 'low',
        unknown: 'low'
      };

      // Route low-confidence or unknown to "exception" status for Queries tab
      const actionStatus = analysis.requiresHumanReview || analysis.intentType === 'unknown' || analysis.confidence < this.CONFIDENCE_THRESHOLD
        ? 'exception'  // Will appear in Exceptions/Queries queue
        : 'pending';

      const [action] = await db
        .insert(actions)
        .values({
          tenantId: message.tenantId,
          contactId: message.contactId,
          invoiceId: message.invoiceId,
          type: message.channel,
          status: actionStatus,
          exceptionReason: analysis.requiresHumanReview ? 
            (analysis.intentType === 'vulnerability' ? 'vulnerability_detected' : 
             analysis.intentType === 'dispute' ? 'dispute_detected' : 
             'low_confidence') : undefined,
          subject: actionSubject,
          content: actionContent,
          intentType: analysis.intentType,
          intentConfidence: analysis.confidence.toString(),
          sentiment: analysis.sentiment,
          source: 'charlie_inbound',
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
    if (analysis.intentType === 'promise_to_pay' || analysis.intentType === 'payment_confirmation') {
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
      vulnerability: '🔴 URGENT: Vulnerability Indicator - Human Review Required',
      dispute: '⚠️ Invoice Dispute',
      promise_to_pay: '✅ Payment Promise Received',
      payment_confirmation: '💳 Payment Confirmation',
      callback_request: '📞 Callback Requested',
      admin_issue: '📋 Admin Blocker (PO/Address/Setup)',
      payment_plan: '💰 Payment Plan Request',
      general_query: '❓ Customer Query',
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
      
      console.log(`✅ Promise created: ${promise.id} - Payment by ${promisedDate.toLocaleDateString()}${!dateWasExtracted ? ' (default)' : ''}`);
    } catch (error) {
      console.error('❌ Error creating promise from intent:', error);
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
    }
  }

  /**
   * Flag a contact as potentially vulnerable based on detected intent
   * Creates an urgent action to notify human operators
   */
  private async flagContactAsVulnerable(
    contactId: string,
    tenantId: string,
    analysis: IntentAnalysisResult
  ): Promise<void> {
    try {
      // Update contact vulnerability flag
      await db
        .update(contacts)
        .set({
          isPotentiallyVulnerable: true,
          updatedAt: new Date()
        })
        .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
      
      // Create an urgent notification action for human review
      await db
        .insert(actions)
        .values({
          tenantId,
          contactId,
          type: 'note',
          status: 'exception',
          exceptionReason: 'vulnerability_detected',
          subject: '🔴 URGENT: Vulnerability Indicator Detected',
          content: `This contact has been automatically flagged as potentially vulnerable.\n\nDetection: ${new Date().toISOString()}\nReasoning: ${analysis.reasoning}\n\nAll automated communications have been paused. Please review and confirm vulnerability status before proceeding with any collection activity.\n\nCompliance Note: Special handling required under FCA/vulnerability guidelines.`,
          source: 'charlie_inbound',
          recommended: {
            priority: 'urgent',
            requiresHumanReview: true
          },
          aiGenerated: true
        });
      
      console.log(`🔴 Contact ${contactId} flagged as potentially vulnerable - urgent action created`);
    } catch (error) {
      console.error('Failed to flag contact as vulnerable:', error);
    }
  }

  /**
   * Handle a response to a pending clarification
   */
  private async handleClarificationResponse(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    clarification: typeof emailClarifications.$inferSelect,
    context: any
  ): Promise<void> {
    try {
      // If the response still has ambiguity, we might need another clarification
      if (analysis.ambiguity?.hasAmbiguity && 
          (analysis.intentType === 'promise_to_pay' || analysis.intentType === 'payment_plan')) {
        console.log(`⚠️  Response still has ambiguity - may need another clarification`);
        // Could send another clarification, but for now mark as needing manual review
      }
      
      // Resolve invoice references from the clarification response
      let resolvedInvoices: { invoiceId: string | null; linkedInvoices: Array<{ id: string; invoiceNumber: string; amount: number }> } = 
        { invoiceId: null, linkedInvoices: [] };
      
      if (message.contactId) {
        resolvedInvoices = await this.resolveInvoiceReferences(
          analysis,
          message.tenantId,
          message.contactId
        );
      }
      
      // Calculate resolved amount from invoices if not extracted
      const extractedAmount = this.extractPtpAmount(analysis, undefined);
      const resolvedAmount = extractedAmount || 
        (resolvedInvoices.linkedInvoices.length > 0 
          ? resolvedInvoices.linkedInvoices.reduce((sum, inv) => sum + inv.amount, 0)
          : context.invoiceAmount);
      
      // Resolve the clarification with resolved invoice data
      const resolvedData = {
        intentType: analysis.intentType,
        extractedEntities: analysis.extractedEntities,
        promiseToPayDate: this.extractPtpDate(analysis),
        promiseToPayAmount: resolvedAmount,
        confidence: analysis.confidence,
        resolvedInvoices: resolvedInvoices.linkedInvoices.map(inv => ({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount
        }))
      };
      
      await emailClarificationService.resolveClarification(
        clarification.id,
        message.id,
        analysis.intentType,
        resolvedData
      );
      
      // Update context with resolved invoice info for outcome creation
      if (resolvedInvoices.invoiceId && !message.invoiceId) {
        context.invoiceAmount = resolvedInvoices.linkedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
      }
      
      // If we now have a clear PTP or payment plan, send confirmation and create outcome
      const isConfirmable = 
        (analysis.intentType === 'promise_to_pay' || analysis.intentType === 'payment_plan') &&
        analysis.confidence >= this.CONFIDENCE_THRESHOLD;
      
      if (isConfirmable && message.contactId) {
        // Send confirmation email with resolved invoice data
        await this.sendConfirmationEmailWithResolvedData(
          message, 
          analysis, 
          context, 
          resolvedInvoices.linkedInvoices, 
          resolvedAmount
        );
        
        // Create the outcome with resolved invoice linkage
        await this.createOutcomeFromIntentWithInvoices(
          message, 
          analysis, 
          context, 
          resolvedInvoices.invoiceId, 
          resolvedInvoices.linkedInvoices.map(inv => inv.id)
        );
        
        // Update clarification with confirmation sent
        await db
          .update(emailClarifications)
          .set({
            confirmationSentAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(emailClarifications.id, clarification.id));
        
        console.log(`✅ Clarification resolved and confirmation sent`);
      }
      
      // Create action for this response
      await this.createActionFromIntent(message, analysis);
      
    } catch (error) {
      console.error('Failed to handle clarification response:', error);
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
          extracted: {
            freeTextNotes: `Awaiting clarification (ID: ${clarificationId || 'pending'}). ${analysis.reasoning}`
          },
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
      return null;
    }
  }

  /**
   * Send a confirmation email when PTP or payment plan is clear
   */
  private async sendConfirmationEmail(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: any
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
      
      // Send confirmation email
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
