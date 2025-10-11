import OpenAI from "openai";
import { db } from "../db";
import { inboundMessages, actions, contacts, invoices } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getPromiseReliabilityService } from "./promiseReliabilityService.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface IntentAnalysisResult {
  intentType: 'payment_plan' | 'dispute' | 'promise_to_pay' | 'general_query' | 'unknown';
  confidence: number; // 0.00 to 1.00
  sentiment: 'positive' | 'neutral' | 'negative';
  extractedEntities: {
    amounts?: string[];
    dates?: string[];
    promises?: string[];
    reasons?: string[];
  };
  reasoning: string;
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
            content: `You are an expert intent analyst for accounts receivable communications. 
Analyze customer messages to detect their intent and extract key information.

Intent Types:
- payment_plan: Customer wants to negotiate a payment plan or installments
- dispute: Customer disputes the invoice or questions the charges
- promise_to_pay: Customer commits to paying by a specific date
- general_query: General questions about the invoice or payment process
- unknown: Intent is unclear or doesn't fit other categories

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
      
      return {
        intentType: result.intentType || 'unknown',
        confidence: Math.min(Math.max(result.confidence || 0, 0), 1),
        sentiment: result.sentiment || 'neutral',
        extractedEntities: result.extractedEntities || {},
        reasoning: result.reasoning || ''
      };
    } catch (error) {
      console.error('❌ Intent analysis failed:', error);
      return {
        intentType: 'unknown',
        confidence: 0,
        sentiment: 'neutral',
        extractedEntities: {},
        reasoning: 'Analysis failed'
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
    let prompt = `Analyze this customer message:\n\n"${message}"\n\n`;
    
    if (context) {
      prompt += `Context:\n`;
      if (context.contactName) prompt += `- Customer: ${context.contactName}\n`;
      if (context.invoiceAmount) prompt += `- Invoice Amount: £${context.invoiceAmount.toFixed(2)}\n`;
      if (context.daysPastDue) prompt += `- Days Overdue: ${context.daysPastDue}\n`;
      prompt += '\n';
    }

    prompt += `Respond with JSON:
{
  "intentType": "payment_plan" | "dispute" | "promise_to_pay" | "general_query" | "unknown",
  "confidence": 0.0 to 1.0,
  "sentiment": "positive" | "neutral" | "negative",
  "extractedEntities": {
    "amounts": ["any monetary amounts mentioned"],
    "dates": ["any dates or timeframes mentioned"],
    "promises": ["any payment commitments"],
    "reasons": ["reasons for dispute or delay"]
  },
  "reasoning": "brief explanation of your classification"
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

      console.log(`✅ Intent analyzed: ${analysis.intentType} (${(analysis.confidence * 100).toFixed(0)}% confidence)`);

      // Auto-create action if high confidence
      if (analysis.confidence >= this.CONFIDENCE_THRESHOLD && analysis.intentType !== 'unknown') {
        await this.createActionFromIntent(message, analysis);
        
        // Create promise record if this is a promise_to_pay intent
        if (analysis.intentType === 'promise_to_pay' && message.contactId && message.invoiceId) {
          await this.createPromiseFromIntent(message, analysis, context);
        }
      } else {
        console.log(`⚠️  Low confidence (${(analysis.confidence * 100).toFixed(0)}%) - flagged for manual review`);
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

      const [action] = await db
        .insert(actions)
        .values({
          tenantId: message.tenantId,
          contactId: message.contactId,
          invoiceId: message.invoiceId,
          type: message.channel, // email, sms, whatsapp, voice
          status: 'pending',
          subject: actionSubject,
          content: actionContent,
          intentType: analysis.intentType,
          intentConfidence: analysis.confidence.toString(),
          sentiment: analysis.sentiment,
          source: 'automated',
          metadata: {
            direction: 'inbound',
            inboundMessageId: message.id,
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
   * Generate action subject from intent
   */
  private generateActionSubject(analysis: IntentAnalysisResult): string {
    const subjects = {
      payment_plan: '💰 Payment Plan Request',
      dispute: '⚠️ Invoice Dispute',
      promise_to_pay: '✅ Payment Promise',
      general_query: '❓ Customer Query',
      unknown: '📩 Inbound Message'
    };
    return subjects[analysis.intentType] || subjects.unknown;
  }

  /**
   * Generate action content from message and analysis
   */
  private generateActionContent(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult
  ): string {
    let content = `Customer Response Received\n\n`;
    content += `Channel: ${message.channel}\n`;
    content += `From: ${message.from}\n`;
    content += `Intent: ${analysis.intentType} (${(analysis.confidence * 100).toFixed(0)}% confidence)\n`;
    content += `Sentiment: ${analysis.sentiment}\n\n`;
    
    if (Object.keys(analysis.extractedEntities).length > 0) {
      content += `Key Information:\n`;
      if (analysis.extractedEntities.amounts?.length) {
        content += `- Amounts: ${analysis.extractedEntities.amounts.join(', ')}\n`;
      }
      if (analysis.extractedEntities.dates?.length) {
        content += `- Dates: ${analysis.extractedEntities.dates.join(', ')}\n`;
      }
      if (analysis.extractedEntities.promises?.length) {
        content += `- Promises: ${analysis.extractedEntities.promises.join(', ')}\n`;
      }
      if (analysis.extractedEntities.reasons?.length) {
        content += `- Reasons: ${analysis.extractedEntities.reasons.join(', ')}\n`;
      }
      content += '\n';
    }
    
    content += `Message:\n"${message.content}"`;
    
    return content;
  }

  /**
   * Create a promise record from promise_to_pay intent
   */
  private async createPromiseFromIntent(
    message: typeof inboundMessages.$inferSelect,
    analysis: IntentAnalysisResult,
    context: any
  ): Promise<void> {
    try {
      const promiseService = getPromiseReliabilityService();
      
      // Extract promised date from entities
      let promisedDate: Date | null = null;
      if (analysis.extractedEntities.dates && analysis.extractedEntities.dates.length > 0) {
        // Try to parse the first date mentioned
        const dateStr = analysis.extractedEntities.dates[0];
        promisedDate = this.parsePromisedDate(dateStr);
      }
      
      // If no date extracted, default to 7 days from now
      if (!promisedDate) {
        promisedDate = new Date();
        promisedDate.setDate(promisedDate.getDate() + 7);
      }
      
      // Extract promised amount from entities
      let promisedAmount: number | undefined;
      if (analysis.extractedEntities.amounts && analysis.extractedEntities.amounts.length > 0) {
        const amountStr = analysis.extractedEntities.amounts[0];
        promisedAmount = this.parseAmount(amountStr);
      }
      
      // Get a user ID (system user) for promise creation
      // TODO: In production, this should be a proper system user or the tenant's default user
      const systemUserId = message.tenantId; // Temporary workaround
      
      const promise = await promiseService.createPromise({
        tenantId: message.tenantId,
        contactId: message.contactId!,
        invoiceId: message.invoiceId!,
        promiseType: 'payment_date',
        promisedDate,
        promisedAmount,
        sourceType: 'inbound_message',
        sourceId: message.id,
        channel: message.channel,
        createdByUserId: systemUserId,
        notes: `Promise extracted from ${message.channel} message`,
        metadata: {
          originalMessage: message.content,
          extractedEntities: analysis.extractedEntities,
          confidence: analysis.confidence,
          sentiment: analysis.sentiment,
        },
      });
      
      console.log(`✅ Promise created: ${promise.id} - Payment by ${promisedDate.toLocaleDateString()}`);
    } catch (error) {
      console.error('❌ Error creating promise from intent:', error);
    }
  }
  
  /**
   * Parse a date string from natural language
   */
  private parsePromisedDate(dateStr: string): Date | null {
    try {
      // Handle common patterns
      const lowerStr = dateStr.toLowerCase();
      const now = new Date();
      
      // "tomorrow"
      if (lowerStr.includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }
      
      // "next week" or "week"
      if (lowerStr.includes('next week') || lowerStr === 'week') {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek;
      }
      
      // "friday" or other day names
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (let i = 0; i < dayNames.length; i++) {
        if (lowerStr.includes(dayNames[i])) {
          const targetDay = i + 1; // Monday = 1
          const currentDay = now.getDay() || 7; // Sunday = 7
          let daysToAdd = targetDay - currentDay;
          if (daysToAdd <= 0) daysToAdd += 7; // Next week if day already passed
          const result = new Date(now);
          result.setDate(result.getDate() + daysToAdd);
          return result;
        }
      }
      
      // Try standard date parsing
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
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
