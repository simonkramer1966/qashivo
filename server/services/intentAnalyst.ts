import OpenAI from "openai";
import { db } from "../db";
import { inboundMessages, actions, contacts, invoices, paymentPlans, paymentPlanInvoices, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { getPromiseReliabilityService } from "./promiseReliabilityService.js";

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
      
      return {
        intentType,
        confidence: Math.min(Math.max(result.confidence || 0, 0), 1),
        sentiment: result.sentiment || 'neutral',
        extractedEntities: result.extractedEntities || {},
        reasoning: result.reasoning || '',
        requiresHumanReview,
        suggestedNextAction: result.suggestedNextAction
      };
    } catch (error) {
      console.error('❌ Intent analysis failed:', error);
      return {
        intentType: 'unknown',
        confidence: 0,
        sentiment: 'neutral',
        extractedEntities: {},
        reasoning: 'Analysis failed',
        requiresHumanReview: true
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
  "suggestedNextAction": "what Charlie recommends as next step (e.g., 'Schedule callback', 'Resend invoice with PO', 'Record PTP and monitor')"
}`;

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

      // Determine if we should create an action
      const shouldCreateAction = 
        analysis.intentType === 'vulnerability' || // Always create for vulnerability
        analysis.intentType === 'dispute' ||       // Always create for disputes
        (analysis.confidence >= this.CONFIDENCE_THRESHOLD && analysis.intentType !== 'unknown');
      
      if (shouldCreateAction) {
        await this.createActionFromIntent(message, analysis);
        
        // Create promise record if this is a promise_to_pay intent with high confidence
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
      
      // "end of week" / "by end of week" / "by friday"
      if (lowerStr.includes('end of week') || lowerStr.includes('end of the week')) {
        const friday = new Date(now);
        const dayOfWeek = friday.getDay();
        const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (7 - dayOfWeek + 5);
        friday.setDate(friday.getDate() + daysUntilFriday);
        return friday;
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
      
      // UK date format: "15/01/2025" or "15-01-2025" or "15 Jan 2025"
      const ukDateMatch = lowerStr.match(/(\d{1,2})[\/\-\s]+(\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\/\-\s]+(\d{2,4})/i);
      if (ukDateMatch) {
        const day = parseInt(ukDateMatch[1], 10);
        let month: number;
        const monthStr = ukDateMatch[2];
        
        if (isNaN(parseInt(monthStr, 10))) {
          // Month name
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          month = monthNames.indexOf(monthStr.toLowerCase().substring(0, 3));
        } else {
          month = parseInt(monthStr, 10) - 1; // JS months are 0-indexed
        }
        
        let year = parseInt(ukDateMatch[3], 10);
        if (year < 100) year += 2000; // Handle 2-digit years
        
        if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
          return new Date(year, month, day);
        }
      }
      
      // "15 January" or "January 15" without year
      const monthDayMatch = lowerStr.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/i);
      if (monthDayMatch) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const day = parseInt(monthDayMatch[1] || monthDayMatch[4], 10);
        const monthStr = (monthDayMatch[2] || monthDayMatch[3]).toLowerCase().substring(0, 3);
        const month = monthNames.indexOf(monthStr);
        
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
