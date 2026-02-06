import { db } from "../db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { 
  emailClarifications, 
  emailMessages,
  inboundMessages, 
  contacts, 
  invoices, 
  tenants,
  conversations,
  timelineEvents,
  outcomes,
  actions
} from "@shared/schema";
import { sendEmail } from "./sendgrid";
import { generateReplyToEmail, findOrCreateConversation, updateConversationStats } from "./emailCommunications";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";

const EMAIL_REPLY_DOMAIN = process.env.EMAIL_REPLY_DOMAIN || "in.qashivo.com";
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "cc@qashivo.com";
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || "Qashivo Credit Control";

interface AmbiguityDetails {
  unclearInvoices?: boolean;
  unclearAmount?: boolean;
  unclearDate?: boolean;
  multipleInvoices?: boolean;
  clarificationQuestions?: string[];
}

interface ClarificationContext {
  tenantId: string;
  contactId: string;
  messageId: string;
  contactEmail: string;
  contactName: string;
  companyName: string;
  tenantName: string;
  ambiguityType: string;
  ambiguityDetails: AmbiguityDetails;
  outstandingInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    dueDate: Date;
  }>;
}

interface ConfirmationContext {
  tenantId: string;
  contactId: string;
  contactEmail: string;
  contactName: string;
  tenantName: string;
  intentType: 'promise_to_pay' | 'payment_plan';
  ptpDate?: string;
  ptpAmount?: number;
  invoiceId?: string;
  invoices?: Array<{
    invoiceNumber: string;
    amount: number;
  }>;
  paymentPlanDetails?: {
    totalAmount: number;
    installments: Array<{ date: string; amount: number }>;
  };
  sourceChannel?: string;
}

type VoiceCallDisposition = 'completed' | 'no_answer' | 'busy' | 'voicemail' | 'failed';

interface ConversationReplyContext {
  tenantId: string;
  contactId: string;
  contactEmail: string;
  contactName: string;
  tenantName: string;
  inboundMessageText: string;
  inboundSubject?: string;
  linkedInvoiceIds?: string[];
  conversationId?: string;
}

interface EscalationResult {
  shouldEscalate: boolean;
  reason: string;
  category?: 'human_request' | 'hostility' | 'legal_threat' | 'authority_exceeded' | 'unresolved_loop' | 'sentiment_drop' | 'complex_dispute';
  suggestedHandoff?: string;
}

interface VoiceFollowUpContext {
  tenantId: string;
  contactId: string;
  contactEmail: string;
  contactName: string;
  tenantName: string;
  callId: string;
  voiceStatus: VoiceCallDisposition;
  outcomeType?: string;
  callSummary?: string;
  transcript?: string;
  extracted?: Record<string, any>;
  linkedInvoiceIds?: string[];
  durationSeconds?: number;
  actionId?: string;
}

class EmailClarificationService {
  
  /**
   * Send a clarification email when ambiguity is detected
   */
  async sendClarificationEmail(context: ClarificationContext): Promise<{ success: boolean; clarificationId?: string; error?: string }> {
    try {
      console.log(`📧 Sending clarification email for ${context.ambiguityType} to ${context.contactEmail}`);
      
      // Find or create conversation
      const conversationId = await findOrCreateConversation(
        context.tenantId,
        context.contactId,
        "Payment clarification"
      );
      
      // Generate email ID and reply-to address
      const emailId = uuidv4();
      const replyTo = generateReplyToEmail(context.tenantId, conversationId, emailId);
      
      // Build the clarification email content
      const { subject, htmlContent, textContent } = this.buildClarificationEmail(context);
      
      // Send the email
      const result = await sendEmail({
        to: context.contactEmail,
        from: `${context.tenantName} via Qashivo <${SENDGRID_FROM_EMAIL}>`,
        replyTo,
        subject,
        html: htmlContent,
        text: textContent
      });
      
      if (!result.success) {
        console.error(`❌ Failed to send clarification email: ${result.error}`);
        return { success: false, error: result.error };
      }
      
      // Store in email_messages table so replies can be routed correctly
      await db.insert(emailMessages).values({
        id: emailId,
        tenantId: context.tenantId,
        direction: 'OUTBOUND',
        channel: 'EMAIL',
        contactId: context.contactId,
        conversationId,
        toEmail: context.contactEmail,
        fromEmail: SENDGRID_FROM_EMAIL,
        subject,
        textBody: textContent,
        htmlBody: htmlContent,
        status: 'SENT',
        sentAt: new Date(),
      });
      
      // Create clarification record
      const [clarification] = await db
        .insert(emailClarifications)
        .values({
          tenantId: context.tenantId,
          contactId: context.contactId,
          conversationId,
          originalMessageId: context.messageId,
          ambiguityType: context.ambiguityType,
          ambiguityDetails: context.ambiguityDetails,
          clarificationEmailId: emailId,
          clarificationSentAt: new Date(),
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
        })
        .returning();
      
      // Update conversation stats
      await updateConversationStats(conversationId, "outbound");
      
      console.log(`✅ Clarification email sent, ID: ${clarification.id}`);
      
      return { success: true, clarificationId: clarification.id };
      
    } catch (error: any) {
      console.error(`❌ Error sending clarification email:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send a confirmation email once PTP or payment plan details are clear
   */
  async sendConfirmationEmail(context: ConfirmationContext): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`📧 Sending ${context.intentType} confirmation email to ${context.contactEmail}`);
      
      // Find existing conversation
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(and(
          eq(conversations.tenantId, context.tenantId),
          eq(conversations.contactId, context.contactId),
          eq(conversations.status, "open")
        ))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(1);
      
      const conversationId = conversation?.id || await findOrCreateConversation(
        context.tenantId,
        context.contactId,
        context.intentType === 'promise_to_pay' ? "Payment promise confirmation" : "Payment plan confirmation"
      );
      
      // Generate email ID and reply-to address
      const emailId = uuidv4();
      const replyTo = generateReplyToEmail(context.tenantId, conversationId, emailId);
      
      // Build the confirmation email content
      const { subject, htmlContent, textContent } = this.buildConfirmationEmail(context);
      
      // Send the email
      const result = await sendEmail({
        to: context.contactEmail,
        from: `${context.tenantName} via Qashivo <${SENDGRID_FROM_EMAIL}>`,
        replyTo,
        subject,
        html: htmlContent,
        text: textContent
      });
      
      if (!result.success) {
        console.error(`❌ Failed to send confirmation email: ${result.error}`);
        return { success: false, error: result.error };
      }
      
      // Store in email_messages table (appears in Customer Drawer conversation list)
      await db.insert(emailMessages).values({
        id: emailId,
        tenantId: context.tenantId,
        direction: 'OUTBOUND',
        channel: 'EMAIL',
        contactId: context.contactId,
        invoiceId: context.invoiceId || null,
        conversationId,
        toEmail: context.contactEmail,
        toName: context.contactName,
        fromEmail: SENDGRID_FROM_EMAIL,
        fromName: `${context.tenantName} via Qashivo`,
        subject,
        textBody: textContent,
        htmlBody: htmlContent,
        replyToken: replyTo.split('@')[0],
        status: 'SENT',
        sentAt: new Date(),
      });
      
      // Build confirmation summary for timeline
      const formattedDate = context.ptpDate ? new Date(context.ptpDate).toLocaleDateString('en-GB', { 
        day: 'numeric', month: 'long', year: 'numeric' 
      }) : null;
      const formattedAmount = context.ptpAmount ? `£${context.ptpAmount.toFixed(2)}` : null;
      
      let timelineSummary: string;
      if (context.intentType === 'promise_to_pay') {
        const parts = ['Payment promise confirmation sent'];
        if (formattedAmount) parts.push(`for ${formattedAmount}`);
        if (formattedDate) parts.push(`due ${formattedDate}`);
        timelineSummary = parts.join(' ');
      } else {
        timelineSummary = `Payment plan confirmation sent${formattedAmount ? ` for ${formattedAmount}` : ''}`;
      }
      
      // Create timeline event (appears in Activity tab)
      await db.insert(timelineEvents).values({
        tenantId: context.tenantId,
        customerId: context.contactId,
        invoiceId: context.invoiceId || null,
        occurredAt: new Date(),
        direction: 'outbound',
        channel: 'email',
        summary: timelineSummary,
        preview: textContent.substring(0, 240),
        subject,
        body: textContent,
        status: 'sent',
        provider: 'sendgrid',
        providerMessageId: emailId,
        createdByType: 'system',
        createdByName: 'Qashivo AI',
        outcomeType: context.intentType === 'promise_to_pay' ? 'promise_to_pay' : 'payment_plan',
        outcomeExtracted: {
          ptpDate: context.ptpDate || null,
          ptpAmount: context.ptpAmount || null,
          sourceChannel: context.sourceChannel || 'email',
        },
      });
      
      // Update conversation stats
      await updateConversationStats(conversationId, "outbound");
      
      console.log(`✅ Confirmation email sent and stored (email_messages + timeline_events)`);
      
      return { success: true };
      
    } catch (error: any) {
      console.error(`❌ Error sending confirmation email:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check if a message is a response to a pending clarification
   */
  async checkForPendingClarification(contactId: string, tenantId: string): Promise<{
    hasPending: boolean;
    clarification?: typeof emailClarifications.$inferSelect;
  }> {
    const [pending] = await db
      .select()
      .from(emailClarifications)
      .where(and(
        eq(emailClarifications.contactId, contactId),
        eq(emailClarifications.tenantId, tenantId),
        eq(emailClarifications.status, 'pending')
      ))
      .orderBy(desc(emailClarifications.createdAt))
      .limit(1);
    
    if (pending && pending.expiresAt && new Date(pending.expiresAt) > new Date()) {
      return { hasPending: true, clarification: pending };
    }
    
    return { hasPending: false };
  }
  
  /**
   * Mark a clarification as resolved
   */
  async resolveClarification(
    clarificationId: string, 
    responseMessageId: string,
    resolvedIntentType: string,
    resolvedData: any
  ): Promise<void> {
    await db
      .update(emailClarifications)
      .set({
        status: 'resolved',
        responseMessageId,
        responseReceivedAt: new Date(),
        resolvedIntentType,
        resolvedData,
        updatedAt: new Date()
      })
      .where(eq(emailClarifications.id, clarificationId));
    
    console.log(`✅ Clarification ${clarificationId} marked as resolved`);
  }
  
  /**
   * Build clarification email content based on ambiguity type
   */
  private buildClarificationEmail(context: ClarificationContext): {
    subject: string;
    htmlContent: string;
    textContent: string;
  } {
    const { ambiguityDetails, contactName, tenantName, outstandingInvoices } = context;
    
    // Use AI-generated questions if available, otherwise generate based on ambiguity type
    const questions = ambiguityDetails.clarificationQuestions?.length 
      ? ambiguityDetails.clarificationQuestions 
      : this.generateDefaultQuestions(ambiguityDetails, outstandingInvoices);
    
    const subject = `RE: Payment Arrangement - Quick Clarification Needed`;
    
    // Build invoice list if there are multiple outstanding invoices
    let invoiceListHtml = '';
    let invoiceListText = '';
    if (outstandingInvoices && outstandingInvoices.length > 1 && ambiguityDetails.multipleInvoices) {
      invoiceListHtml = `
        <p style="margin-top: 15px;">For reference, here are your current outstanding invoices:</p>
        <table style="border-collapse: collapse; width: 100%; margin-top: 10px;">
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #dee2e6;">Invoice #</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #dee2e6;">Amount</th>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #dee2e6;">Due Date</th>
          </tr>
          ${outstandingInvoices.map(inv => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">${inv.invoiceNumber}</td>
              <td style="padding: 8px; text-align: right; border-bottom: 1px solid #dee2e6;">£${inv.amount.toFixed(2)}</td>
              <td style="padding: 8px; border-bottom: 1px solid #dee2e6;">${new Date(inv.dueDate).toLocaleDateString('en-GB')}</td>
            </tr>
          `).join('')}
        </table>
      `;
      invoiceListText = '\n\nFor reference, here are your current outstanding invoices:\n' +
        outstandingInvoices.map(inv => 
          `  - ${inv.invoiceNumber}: £${inv.amount.toFixed(2)} (Due: ${new Date(inv.dueDate).toLocaleDateString('en-GB')})`
        ).join('\n');
    }
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .question { margin: 10px 0; padding: 10px 15px; background-color: #f8f9fa; border-left: 3px solid #0070f3; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <p>Dear ${contactName},</p>
    
    <p>Thank you for getting in touch about your account with ${tenantName}.</p>
    
    <p>To ensure we record your payment arrangement accurately, could you please help us clarify a few details:</p>
    
    ${questions.map(q => `<div class="question">${q}</div>`).join('')}
    
    ${invoiceListHtml}
    
    <p style="margin-top: 20px;">Simply reply to this email with your answers, and we'll confirm the arrangement straight back to you.</p>
    
    <p>Kind regards,<br>
    ${tenantName} Accounts Team</p>
    
    <div class="footer">
      <p>This email was sent on behalf of ${tenantName} via Qashivo credit control.</p>
    </div>
  </div>
</body>
</html>`;

    const textContent = `Dear ${contactName},

Thank you for getting in touch about your account with ${tenantName}.

To ensure we record your payment arrangement accurately, could you please help us clarify a few details:

${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
${invoiceListText}

Simply reply to this email with your answers, and we'll confirm the arrangement straight back to you.

Kind regards,
${tenantName} Accounts Team

---
This email was sent on behalf of ${tenantName} via Qashivo credit control.`;

    return { subject, htmlContent, textContent };
  }
  
  /**
   * Build confirmation email content
   */
  private buildConfirmationEmail(context: ConfirmationContext): {
    subject: string;
    htmlContent: string;
    textContent: string;
  } {
    const { intentType, contactName, tenantName, ptpDate, ptpAmount, invoices, paymentPlanDetails } = context;
    
    let subject: string;
    let confirmationDetails: string;
    let confirmationDetailsText: string;
    
    if (intentType === 'promise_to_pay') {
      subject = `Payment Arrangement Confirmed - ${tenantName}`;
      
      const formattedDate = ptpDate ? new Date(ptpDate).toLocaleDateString('en-GB', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }) : 'the agreed date';
      
      const formattedAmount = ptpAmount ? `£${ptpAmount.toFixed(2)}` : 'the agreed amount';
      
      confirmationDetails = `
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #2e7d32;">✓ Payment Promise Confirmed</h3>
          <p style="margin: 5px 0;"><strong>Amount:</strong> ${formattedAmount}</p>
          <p style="margin: 5px 0;"><strong>Payment Date:</strong> ${formattedDate}</p>
          ${invoices && invoices.length > 0 ? `
            <p style="margin: 10px 0 5px 0;"><strong>Covering:</strong></p>
            <ul style="margin: 5px 0; padding-left: 20px;">
              ${invoices.map(inv => `<li>Invoice ${inv.invoiceNumber} - £${inv.amount.toFixed(2)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `;
      
      confirmationDetailsText = `
PAYMENT PROMISE CONFIRMED
-------------------------
Amount: ${formattedAmount}
Payment Date: ${formattedDate}
${invoices && invoices.length > 0 ? `Covering:\n${invoices.map(inv => `  - Invoice ${inv.invoiceNumber}: £${inv.amount.toFixed(2)}`).join('\n')}` : ''}
`;
      
    } else {
      // Payment plan
      subject = `Payment Plan Confirmed - ${tenantName}`;
      
      const totalAmount = paymentPlanDetails?.totalAmount || ptpAmount || 0;
      const installments = paymentPlanDetails?.installments || [];
      
      confirmationDetails = `
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #2e7d32;">✓ Payment Plan Confirmed</h3>
          <p style="margin: 5px 0;"><strong>Total Amount:</strong> £${totalAmount.toFixed(2)}</p>
          ${installments.length > 0 ? `
            <p style="margin: 10px 0 5px 0;"><strong>Payment Schedule:</strong></p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px;">
              <tr style="background-color: #c8e6c9;">
                <th style="padding: 8px; text-align: left;">Date</th>
                <th style="padding: 8px; text-align: right;">Amount</th>
              </tr>
              ${installments.map(inst => `
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #c8e6c9;">${new Date(inst.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                  <td style="padding: 8px; text-align: right; border-bottom: 1px solid #c8e6c9;">£${inst.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </table>
          ` : ''}
        </div>
      `;
      
      confirmationDetailsText = `
PAYMENT PLAN CONFIRMED
----------------------
Total Amount: £${totalAmount.toFixed(2)}
${installments.length > 0 ? `Payment Schedule:\n${installments.map(inst => `  - ${new Date(inst.date).toLocaleDateString('en-GB')}: £${inst.amount.toFixed(2)}`).join('\n')}` : ''}
`;
    }
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <p>Dear ${contactName},</p>
    
    <p>Thank you for confirming your payment arrangements. We have recorded the following:</p>
    
    ${confirmationDetails}
    
    <p>We appreciate you working with us to bring your account up to date. If you have any questions or need to make changes to this arrangement, please reply to this email.</p>
    
    <p>Kind regards,<br>
    ${tenantName} Accounts Team</p>
    
    <div class="footer">
      <p>This email was sent on behalf of ${tenantName} via Qashivo credit control.</p>
    </div>
  </div>
</body>
</html>`;

    const textContent = `Dear ${contactName},

Thank you for confirming your payment arrangements. We have recorded the following:
${confirmationDetailsText}

We appreciate you working with us to bring your account up to date. If you have any questions or need to make changes to this arrangement, please reply to this email.

Kind regards,
${tenantName} Accounts Team

---
This email was sent on behalf of ${tenantName} via Qashivo credit control.`;

    return { subject, htmlContent, textContent };
  }
  
  /**
   * Check if this contact has recently replied (within 48h), indicating an active conversation
   * where the AI should respond immediately without cooldown restrictions.
   */
  async isActiveConversation(tenantId: string, contactId: string): Promise<{ active: boolean; lastInboundAt?: Date }> {
    try {
      const activeWindow = new Date();
      activeWindow.setHours(activeWindow.getHours() - 48);

      const [recentInbound] = await db.select({ receivedAt: emailMessages.receivedAt, createdAt: emailMessages.createdAt })
        .from(emailMessages)
        .where(and(
          eq(emailMessages.tenantId, tenantId),
          eq(emailMessages.contactId, contactId),
          eq(emailMessages.direction, 'INBOUND'),
          sql`COALESCE(${emailMessages.receivedAt}, ${emailMessages.createdAt}) >= ${activeWindow}`
        ))
        .orderBy(desc(sql`COALESCE(${emailMessages.receivedAt}, ${emailMessages.createdAt})`))
        .limit(1);

      if (recentInbound) {
        const lastInboundAt = recentInbound.receivedAt || recentInbound.createdAt;
        return { active: true, lastInboundAt: lastInboundAt ? new Date(lastInboundAt) : undefined };
      }

      return { active: false };
    } catch (error: any) {
      console.error('Error checking active conversation:', error);
      return { active: false };
    }
  }

  /**
   * Check if email cadence rules allow sending an email to this contact.
   * For active conversations (debtor has replied within 48h), cadence is bypassed entirely.
   * For cold outreach, standard tenant cooldown and max-touches rules apply.
   */
  async checkEmailCadence(tenantId: string, contactId: string): Promise<{ canSend: boolean; reason?: string; lastEmailAt?: Date; isActiveConversation?: boolean }> {
    try {
      const activeConvo = await this.isActiveConversation(tenantId, contactId);
      if (activeConvo.active) {
        console.log(`💬 Active conversation detected for contact ${contactId} — cadence bypassed (last inbound: ${activeConvo.lastInboundAt?.toISOString()})`);
        return { canSend: true, isActiveConversation: true };
      }

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      const cooldowns = (tenant?.channelCooldowns as { email?: number; sms?: number; voice?: number }) || { email: 3, sms: 5, voice: 7 };
      const emailCooldownDays = cooldowns.email || 3;

      const cooldownDate = new Date();
      cooldownDate.setDate(cooldownDate.getDate() - emailCooldownDays);

      const [lastEmail] = await db.select({ sentAt: emailMessages.sentAt, createdAt: emailMessages.createdAt })
        .from(emailMessages)
        .where(and(
          eq(emailMessages.tenantId, tenantId),
          eq(emailMessages.contactId, contactId),
          eq(emailMessages.direction, 'OUTBOUND'),
          sql`COALESCE(${emailMessages.sentAt}, ${emailMessages.createdAt}) >= ${cooldownDate}`
        ))
        .orderBy(desc(sql`COALESCE(${emailMessages.sentAt}, ${emailMessages.createdAt})`))
        .limit(1);

      if (lastEmail) {
        const lastSentAt = lastEmail.sentAt || lastEmail.createdAt;
        return {
          canSend: false,
          reason: `Email cooldown active: last email sent ${lastSentAt ? new Date(lastSentAt).toLocaleDateString('en-GB') : 'recently'}. Cooldown: ${emailCooldownDays} days.`,
          lastEmailAt: lastSentAt ? new Date(lastSentAt) : undefined,
        };
      }

      const maxTouches = tenant?.maxTouchesPerWindow || 3;
      const windowDays = tenant?.contactWindowDays || 14;
      const windowDate = new Date();
      windowDate.setDate(windowDate.getDate() - windowDays);

      const touchCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(emailMessages)
        .where(and(
          eq(emailMessages.tenantId, tenantId),
          eq(emailMessages.contactId, contactId),
          eq(emailMessages.direction, 'OUTBOUND'),
          sql`COALESCE(${emailMessages.sentAt}, ${emailMessages.createdAt}) >= ${windowDate}`
        ));

      const totalTouches = touchCount[0]?.count || 0;
      if (totalTouches >= maxTouches) {
        return {
          canSend: false,
          reason: `Max touches exceeded: ${totalTouches}/${maxTouches} in the last ${windowDays} days.`,
        };
      }

      return { canSend: true };
    } catch (error: any) {
      console.error('Error checking email cadence:', error);
      return { canSend: true };
    }
  }

  /**
   * Assess whether the AI should continue the conversation or escalate to a human.
   * Uses OpenAI to analyse the debtor's latest message in context of the conversation history.
   */
  async shouldEscalate(tenantId: string, contactId: string, latestMessage: string, conversationHistory: string): Promise<EscalationResult> {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const exchangeCountResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(emailMessages)
        .where(and(
          eq(emailMessages.tenantId, tenantId),
          eq(emailMessages.contactId, contactId),
          sql`COALESCE(${emailMessages.sentAt}, ${emailMessages.receivedAt}, ${emailMessages.createdAt}) >= NOW() - INTERVAL '14 days'`
        ));
      const recentExchangeCount = exchangeCountResult[0]?.count || 0;

      const prompt = `You are an AI credit control assistant deciding whether to continue handling a debtor conversation autonomously or escalate to a human agent.

CONVERSATION HISTORY:
${conversationHistory}

LATEST DEBTOR MESSAGE:
"${latestMessage}"

TOTAL RECENT EXCHANGES (last 14 days): ${recentExchangeCount}

Analyse the latest message and decide: should the AI continue this conversation, or should it be escalated to a human?

ESCALATION TRIGGERS (escalate if ANY of these are true):
1. Debtor explicitly asks to speak to a person, manager, or someone senior
2. Hostile, abusive, or threatening language
3. Legal threats or mention of solicitors/lawyers/legal action
4. Requests that exceed AI authority: write-offs, credit notes, payment term changes, unusual arrangements
5. More than 10 exchanges in the last 14 days without reaching a clear resolution (payment plan, PTP, or dispute filed)
6. Significant sentiment deterioration — debtor becoming increasingly frustrated or aggressive
7. Complex multi-party disputes or situations needing judgement calls

CONTINUE if the debtor is:
- Asking straightforward questions about invoices, amounts, or due dates
- Negotiating payment timing or amounts within normal parameters
- Providing information or documents
- Agreeing to arrangements
- Making a promise to pay
- Requesting a payment plan
- Being generally cooperative even if unhappy

Return a JSON object:
{
  "shouldEscalate": boolean,
  "reason": "Brief explanation of the decision",
  "category": "human_request" | "hostility" | "legal_threat" | "authority_exceeded" | "unresolved_loop" | "sentiment_drop" | "complex_dispute" | null,
  "suggestedHandoff": "A brief note for the human agent on what to focus on (only if escalating)"
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Analyse and decide." }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return {
        shouldEscalate: result.shouldEscalate === true,
        reason: result.reason || 'No reason provided',
        category: result.category || undefined,
        suggestedHandoff: result.suggestedHandoff || undefined,
      };
    } catch (error: any) {
      console.error('Error in escalation check:', error);
      return { shouldEscalate: false, reason: 'Escalation check failed — defaulting to continue' };
    }
  }

  /**
   * Create an escalation action for human review when AI determines it can no longer
   * handle the conversation autonomously.
   */
  async createEscalationAction(
    tenantId: string,
    contactId: string,
    escalation: EscalationResult,
    conversationSummary: string,
    latestMessage: string,
    conversationId?: string,
  ): Promise<string | null> {
    try {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
      const contactName = contact?.companyName || contact?.name || 'Unknown';

      const [action] = await db.insert(actions).values({
        tenantId,
        contactId,
        type: 'email',
        status: 'exception',
        exceptionReason: `ai_escalation_${escalation.category || 'general'}`,
        subject: `AI Escalation: ${contactName} — ${escalation.category?.replace(/_/g, ' ') || 'requires human attention'}`,
        content: `The AI has been managing an email conversation with ${contactName} and has determined that human intervention is now needed.

ESCALATION REASON: ${escalation.reason}
CATEGORY: ${escalation.category || 'general'}

LATEST DEBTOR MESSAGE:
"${latestMessage}"

CONVERSATION SUMMARY:
${conversationSummary}

${escalation.suggestedHandoff ? `SUGGESTED FOCUS:\n${escalation.suggestedHandoff}` : ''}`,
        source: 'charlie_inbound',
        aiGenerated: true,
        workState: 'ATTENTION',
        confidenceScore: '0.95',
        recommended: {
          priority: 'high',
          suggestedNextAction: escalation.suggestedHandoff || 'Review conversation and respond manually',
          requiresHumanReview: true,
          escalationCategory: escalation.category,
        },
        metadata: {
          escalation: true,
          escalationCategory: escalation.category,
          escalationReason: escalation.reason,
          conversationId: conversationId || null,
          suggestedHandoff: escalation.suggestedHandoff,
        },
      }).returning();

      await db.insert(timelineEvents).values({
        tenantId,
        customerId: contactId,
        occurredAt: new Date(),
        direction: 'system',
        channel: 'email',
        summary: `AI escalated conversation to human — ${escalation.category?.replace(/_/g, ' ') || 'requires attention'}`,
        preview: escalation.reason.substring(0, 240),
        status: 'escalated',
        createdByType: 'system',
        createdByName: 'Qashivo AI',
        actionId: action.id,
      });

      await db.update(conversations)
        .set({ status: 'escalated', updatedAt: new Date() })
        .where(and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.contactId, contactId),
          eq(conversations.status, 'open')
        ));

      console.log(`🚨 Escalation action created: ${action.id} — ${escalation.category} — ${escalation.reason}`);
      return action.id;
    } catch (error: any) {
      console.error('Error creating escalation action:', error);
      return null;
    }
  }

  /**
   * Generate an AI reply to a debtor's email in an active conversation.
   * Uses the full conversation history and debtor context.
   */
  private async generateConversationReplyWithAI(
    context: ConversationReplyContext,
    debtorContext: string,
    conversationHistory: string,
  ): Promise<{ subject: string; htmlContent: string; textContent: string; timelineSummary: string }> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const currentDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const prompt = `You are a professional credit control assistant replying to a debtor's email. You are continuing an active conversation — respond naturally as if you are a human accounts team member.

TODAY'S DATE: ${currentDate}
TENANT (creditor) NAME: ${context.tenantName}
DEBTOR NAME: ${context.contactName}

CONVERSATION HISTORY (most recent first):
${conversationHistory}

LATEST DEBTOR MESSAGE:
"${context.inboundMessageText}"

${debtorContext}

RULES — YOU MUST FOLLOW THESE:
1. NEVER use placeholder text like "the agreed date", "the agreed amount", "your outstanding balance", or "[amount]". Use concrete figures from the debtor context or conversation history. If you don't have a specific figure, don't reference it.
2. Respond directly to what the debtor said. This is a conversation — don't repeat introductions or context they already know.
3. Keep responses concise — no more than 120 words in the body.
4. If the debtor is asking a question, answer it clearly using the invoice/account data available.
5. If the debtor is negotiating payment terms, engage constructively. You can accept reasonable payment dates and amounts. Suggest payment plans if the total is large and the debtor seems willing.
6. If the debtor is providing information (e.g. remittance details, PO numbers), acknowledge receipt and confirm next steps.
7. If the debtor confirms a payment promise, confirm the exact date and amount back to them.
8. Be warm but professional. No overly formal language. No grovelling. Treat them as a business partner.
9. Reference specific invoice numbers and amounts when relevant.
10. Sign off as "${context.tenantName} Accounts Team".
11. Do NOT include any Qashivo branding in the body — only in the footer.
12. The subject line should be a reply (Re: ...) to maintain the thread.

Return a JSON object with exactly these fields:
- "subject": Email subject line (typically "Re: [original subject]")
- "body_text": The plain text email body (include greeting and sign-off)
- "body_html": The same email wrapped in clean, minimal HTML (use inline styles, no external CSS)
- "timeline_summary": A one-line summary for the activity timeline (e.g. "AI replied to debtor query about INV-1234")`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Generate the reply email." }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    const subject = result.subject || `Re: ${context.inboundSubject || 'Your account'}`;
    const textContent = result.body_text || '';
    const htmlBody = result.body_html || `<p>${textContent.replace(/\n/g, '<br>')}</p>`;
    const timelineSummary = result.timeline_summary || 'AI replied to debtor email';

    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
${htmlBody}
<div style="margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 10px;">
  <p>This email was sent on behalf of ${context.tenantName} via Qashivo credit control.</p>
</div>
</body>
</html>`;

    return {
      subject,
      htmlContent,
      textContent: textContent + `\n\n---\nThis email was sent on behalf of ${context.tenantName} via Qashivo credit control.`,
      timelineSummary,
    };
  }

  /**
   * Detect auto-reply / out-of-office / bounce messages that should NOT trigger AI responses.
   * Prevents infinite reply loops between AI and auto-responders.
   */
  isAutoReply(subject?: string, messageText?: string, headers?: Record<string, any>): boolean {
    if (headers) {
      if (headers['auto-submitted'] || headers['Auto-Submitted']) {
        const val = (headers['auto-submitted'] || headers['Auto-Submitted']).toLowerCase();
        if (val !== 'no') return true;
      }
      if (headers['x-auto-response-suppress'] || headers['X-Auto-Response-Suppress']) return true;
      if (headers['x-autoreply'] || headers['X-Autoreply'] || headers['X-AutoReply']) return true;
      if (headers['precedence'] || headers['Precedence']) {
        const val = (headers['precedence'] || headers['Precedence']).toLowerCase();
        if (['bulk', 'junk', 'auto_reply', 'list'].includes(val)) return true;
      }
      const returnPath = headers['return-path'] || headers['Return-Path'];
      if (returnPath !== undefined && (returnPath === '<>' || returnPath === '')) return true;
    }

    if (subject) {
      const subjectLower = subject.toLowerCase();
      const autoReplyPatterns = [
        'out of office', 'out of the office', 'automatic reply', 'auto-reply', 'autoreply',
        'on vacation', 'on holiday', 'away from', 'delivery status', 'undeliverable',
        'mail delivery failed', 'returned mail', 'delivery failure',
        'do not reply', 'noreply', 'no-reply', 'mailer-daemon',
      ];
      if (autoReplyPatterns.some(p => subjectLower.includes(p))) return true;
    }

    return false;
  }

  /**
   * Check if this conversation has been escalated to a human and should not receive AI auto-replies.
   */
  private async isConversationEscalated(tenantId: string, contactId: string): Promise<boolean> {
    try {
      const [escalatedConv] = await db.select({ id: conversations.id })
        .from(conversations)
        .where(and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.contactId, contactId),
          eq(conversations.status, 'escalated')
        ))
        .limit(1);
      return !!escalatedConv;
    } catch (e) {
      return false;
    }
  }

  /**
   * Handle an inbound debtor email in an active conversation.
   * Checks escalation first, then generates and sends an immediate AI reply.
   * Returns the result including whether it was escalated or replied to.
   */
  async handleActiveConversationReply(context: ConversationReplyContext): Promise<{
    success: boolean;
    action: 'replied' | 'escalated' | 'skipped';
    reason?: string;
    error?: string;
  }> {
    try {
      console.log(`💬 Active conversation reply: ${context.contactName} (${context.contactEmail})`);

      const alreadyEscalated = await this.isConversationEscalated(context.tenantId, context.contactId);
      if (alreadyEscalated) {
        console.log(`⏸️ Conversation already escalated to human — skipping AI auto-reply for ${context.contactId}`);
        return { success: true, action: 'skipped', reason: 'Conversation previously escalated to human agent' };
      }

      const debtorContext = await this.gatherDebtorContext(context.tenantId, context.contactId, context.linkedInvoiceIds);

      const recentEmails = await db.select({
        direction: emailMessages.direction,
        subject: emailMessages.subject,
        textBody: emailMessages.textBody,
        inboundText: emailMessages.inboundText,
        sentAt: emailMessages.sentAt,
        receivedAt: emailMessages.receivedAt,
        createdAt: emailMessages.createdAt,
      })
        .from(emailMessages)
        .where(and(
          eq(emailMessages.tenantId, context.tenantId),
          eq(emailMessages.contactId, context.contactId),
        ))
        .orderBy(desc(sql`COALESCE(${emailMessages.sentAt}, ${emailMessages.receivedAt}, ${emailMessages.createdAt})`))
        .limit(10);

      const conversationHistory = recentEmails.map(e => {
        const date = (e.sentAt || e.receivedAt || e.createdAt);
        const dateStr = date ? new Date(date).toLocaleString('en-GB') : 'unknown';
        const body = e.direction === 'OUTBOUND' ? (e.textBody || '').substring(0, 300) : (e.inboundText || '').substring(0, 300);
        return `[${e.direction} — ${dateStr}] Subject: ${e.subject || '(no subject)'}\n${body}`;
      }).join('\n---\n');

      const escalation = await this.shouldEscalate(context.tenantId, context.contactId, context.inboundMessageText, conversationHistory);

      if (escalation.shouldEscalate) {
        console.log(`🚨 Escalating conversation: ${escalation.reason} (${escalation.category})`);

        const conversationSummary = recentEmails.slice(0, 5).map(e => {
          const dir = e.direction === 'OUTBOUND' ? 'Us' : 'Debtor';
          const body = e.direction === 'OUTBOUND' ? (e.textBody || '').substring(0, 150) : (e.inboundText || '').substring(0, 150);
          return `${dir}: ${body}`;
        }).join('\n');

        await this.createEscalationAction(
          context.tenantId,
          context.contactId,
          escalation,
          conversationSummary,
          context.inboundMessageText,
          context.conversationId,
        );

        return { success: true, action: 'escalated', reason: escalation.reason };
      }

      const { subject, htmlContent, textContent, timelineSummary } = await this.generateConversationReplyWithAI(
        context, debtorContext, conversationHistory
      );

      const conversationId = context.conversationId || await findOrCreateConversation(
        context.tenantId,
        context.contactId,
        subject
      );

      const emailId = uuidv4();
      const replyTo = generateReplyToEmail(context.tenantId, conversationId, emailId);

      const result = await sendEmail({
        to: context.contactEmail,
        from: `${context.tenantName} via Qashivo <${SENDGRID_FROM_EMAIL}>`,
        replyTo,
        subject,
        html: htmlContent,
        text: textContent,
      });

      if (!result.success) {
        console.error(`❌ Failed to send conversation reply: ${result.error}`);
        return { success: false, action: 'replied', error: result.error };
      }

      await db.insert(emailMessages).values({
        id: emailId,
        tenantId: context.tenantId,
        direction: 'OUTBOUND',
        channel: 'EMAIL',
        contactId: context.contactId,
        invoiceId: context.linkedInvoiceIds?.[0] || null,
        conversationId,
        toEmail: context.contactEmail,
        toName: context.contactName,
        fromEmail: SENDGRID_FROM_EMAIL,
        fromName: `${context.tenantName} via Qashivo`,
        subject,
        textBody: textContent,
        htmlBody: htmlContent,
        replyToken: replyTo.split('@')[0],
        status: 'SENT',
        sentAt: new Date(),
      });

      await db.insert(timelineEvents).values({
        tenantId: context.tenantId,
        customerId: context.contactId,
        invoiceId: context.linkedInvoiceIds?.[0] || null,
        occurredAt: new Date(),
        direction: 'outbound',
        channel: 'email',
        summary: timelineSummary,
        preview: textContent.substring(0, 240),
        subject,
        body: textContent,
        status: 'sent',
        provider: 'sendgrid',
        providerMessageId: emailId,
        createdByType: 'system',
        createdByName: 'Qashivo AI',
      });

      await updateConversationStats(conversationId, "outbound");

      console.log(`✅ AI conversation reply sent: ${timelineSummary}`);
      return { success: true, action: 'replied' };

    } catch (error: any) {
      console.error(`❌ Error in active conversation reply:`, error);
      return { success: false, action: 'skipped', error: error.message };
    }
  }

  /**
   * Gather debtor context for OpenAI email generation.
   * Pulls outstanding invoices, recent outcomes, communication history, and behaviour patterns.
   */
  private async gatherDebtorContext(tenantId: string, contactId: string, linkedInvoiceIds?: string[]): Promise<string> {
    const contextParts: string[] = [];

    try {
      const outstandingInvoices = await db.select({
        invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount,
        amountPaid: invoices.amountPaid,
        dueDate: invoices.dueDate,
        status: invoices.status,
        outcomeOverride: invoices.outcomeOverride,
      })
        .from(invoices)
        .where(and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.contactId, contactId),
          eq(invoices.status, 'OPEN')
        ))
        .orderBy(invoices.dueDate);

      if (outstandingInvoices.length > 0) {
        const invoiceList = outstandingInvoices.map(inv => {
          const outstanding = Number(inv.amount || 0) - Number(inv.amountPaid || 0);
          const daysOverdue = inv.dueDate
            ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          return `  - ${inv.invoiceNumber}: £${outstanding.toFixed(2)} (${daysOverdue > 0 ? `${daysOverdue} days overdue` : `due ${new Date(inv.dueDate!).toLocaleDateString('en-GB')}`})${inv.outcomeOverride ? ` [${inv.outcomeOverride}]` : ''}`;
        }).join('\n');
        const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + (Number(inv.amount || 0) - Number(inv.amountPaid || 0)), 0);
        contextParts.push(`OUTSTANDING INVOICES (${outstandingInvoices.length} total, £${totalOutstanding.toFixed(2)}):\n${invoiceList}`);
      } else {
        contextParts.push('OUTSTANDING INVOICES: None currently outstanding.');
      }
    } catch (e) { /* non-critical */ }

    try {
      const recentOutcomes = await db.select({
        type: outcomes.type,
        extracted: outcomes.extracted,
        sourceChannel: outcomes.sourceChannel,
        createdAt: outcomes.createdAt,
      })
        .from(outcomes)
        .where(and(
          eq(outcomes.tenantId, tenantId),
          eq(outcomes.debtorId, contactId),
        ))
        .orderBy(desc(outcomes.createdAt))
        .limit(5);

      if (recentOutcomes.length > 0) {
        const outcomeList = recentOutcomes.map(o => {
          const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : 'unknown';
          const ext = o.extracted as Record<string, any> || {};
          let detail = `${o.type} via ${o.sourceChannel || 'unknown'} on ${date}`;
          if (ext.promiseToPayDate) detail += ` (promised: ${ext.promiseToPayDate})`;
          if (ext.promiseToPayAmount) detail += ` (£${ext.promiseToPayAmount})`;
          if (ext.freeTextNotes) detail += ` — "${ext.freeTextNotes.substring(0, 80)}"`;
          return `  - ${detail}`;
        }).join('\n');
        contextParts.push(`RECENT OUTCOME HISTORY:\n${outcomeList}`);
      }
    } catch (e) { /* non-critical */ }

    try {
      const recentEmails = await db.select({
        direction: emailMessages.direction,
        subject: emailMessages.subject,
        sentAt: emailMessages.sentAt,
        createdAt: emailMessages.createdAt,
      })
        .from(emailMessages)
        .where(and(
          eq(emailMessages.tenantId, tenantId),
          eq(emailMessages.contactId, contactId),
        ))
        .orderBy(desc(emailMessages.sentAt))
        .limit(5);

      if (recentEmails.length > 0) {
        const emailList = recentEmails.map(e => {
          const date = (e.sentAt || e.createdAt) ? new Date((e.sentAt || e.createdAt)!).toLocaleDateString('en-GB') : 'unknown';
          return `  - ${e.direction} on ${date}: "${e.subject || 'no subject'}"`;
        }).join('\n');
        contextParts.push(`RECENT EMAIL HISTORY:\n${emailList}`);
      }
    } catch (e) { /* non-critical */ }

    if (linkedInvoiceIds && linkedInvoiceIds.length > 0) {
      contextParts.push(`THIS CALL WAS ABOUT INVOICE(S): ${linkedInvoiceIds.join(', ')}`);
    }

    return contextParts.join('\n\n');
  }

  /**
   * Use OpenAI to generate a personalised voice call follow-up email based on
   * the call disposition, transcript, debtor context, and next steps.
   */
  private async generateFollowUpWithAI(context: VoiceFollowUpContext, debtorContext: string): Promise<{ subject: string; htmlContent: string; textContent: string }> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const currentDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let dispositionDescription: string;
    switch (context.voiceStatus) {
      case 'no_answer':
        dispositionDescription = 'The call was not answered. Nobody picked up.';
        break;
      case 'voicemail':
        dispositionDescription = 'The call went to voicemail. A message may have been left.';
        break;
      case 'busy':
        dispositionDescription = 'The line was busy/engaged when we called.';
        break;
      case 'failed':
        dispositionDescription = 'The call could not be connected (possible wrong number or technical issue).';
        break;
      case 'completed':
      default:
        dispositionDescription = `The call was answered and lasted ${context.durationSeconds ? `${Math.floor(context.durationSeconds / 60)} minutes ${context.durationSeconds % 60} seconds` : 'a short while'}.`;
        break;
    }

    const outcomeSection = context.outcomeType
      ? `\nCALL OUTCOME TYPE: ${context.outcomeType}`
      : '';

    const extractedSection = context.extracted && Object.keys(context.extracted).length > 0
      ? `\nEXTRACTED DATA: ${JSON.stringify(context.extracted)}`
      : '';

    const transcriptSection = context.callSummary
      ? `\nCALL SUMMARY: ${context.callSummary}`
      : (context.transcript
        ? `\nTRANSCRIPT EXCERPT: ${context.transcript.substring(0, 800)}`
        : '');

    const prompt = `You are a professional credit control assistant writing a follow-up email after a phone call attempt to a debtor.

TODAY'S DATE: ${currentDate}
TENANT (creditor) NAME: ${context.tenantName}
DEBTOR NAME: ${context.contactName}
CALL DISPOSITION: ${context.voiceStatus}
${dispositionDescription}
${outcomeSection}
${extractedSection}
${transcriptSection}

${debtorContext}

RULES — YOU MUST FOLLOW THESE:
1. NEVER use placeholder text like "the agreed date", "the agreed amount", "your outstanding balance", or "[amount]". If you have a concrete date or amount from the extracted data, use it exactly. If you don't have it, don't reference it at all.
2. Write in a warm but professional tone. You represent the creditor's accounts team.
3. The email should be concise — no more than 150 words in the body.
4. If the call was completed and has a clear outcome (PTP, dispute, docs requested, etc.), confirm what was discussed and any next steps.
5. If the call was not answered / busy / voicemail, write a brief polite email explaining we tried to reach them about their account, mention what the call was about (e.g. outstanding invoices), and suggest how they can get in touch.
6. If there is ambiguity in the outcome (e.g. debtor said they'd pay "soon" without a date), ask for clarification on the specific missing details.
7. If the outcome is CONTACT_ISSUE or wrong number, write an email to any known email explaining we had difficulty reaching them by phone and asking them to confirm the best contact number.
8. Include specific invoice numbers and amounts when available from the debtor context.
9. Sign off as "${context.tenantName} Accounts Team".
10. Do NOT include any Qashivo branding in the body — only in the footer.

Return a JSON object with exactly these fields:
- "subject": A concise email subject line
- "body_text": The plain text email body (include greeting and sign-off)
- "body_html": The same email wrapped in clean, minimal HTML (use inline styles, no external CSS)
- "email_type": One of: "confirmation", "clarification", "missed_call", "voicemail_followup", "busy_followup", "wrong_number", "general_summary"
- "timeline_summary": A one-line summary for the activity timeline (e.g. "Post-call confirmation sent — PTP £5,000 by 28 Feb 2026")`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Generate the follow-up email based on the context provided." }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    const subject = result.subject || `Following up on our call — ${context.tenantName}`;
    const textContent = result.body_text || '';
    const htmlBody = result.body_html || `<p>${textContent.replace(/\n/g, '<br>')}</p>`;

    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
${htmlBody}
<div style="margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 10px;">
  <p>This email was sent on behalf of ${context.tenantName} via Qashivo credit control.</p>
</div>
</body>
</html>`;

    return {
      subject,
      htmlContent,
      textContent: textContent + `\n\n---\nThis email was sent on behalf of ${context.tenantName} via Qashivo credit control.`,
    };
  }

  /**
   * Send a personalised AI-generated follow-up email after any voice call,
   * regardless of outcome. Respects cadence rules.
   */
  async sendVoiceFollowUpEmail(context: VoiceFollowUpContext): Promise<{ success: boolean; skipped?: boolean; reason?: string; error?: string }> {
    try {
      console.log(`📧 Voice follow-up: ${context.voiceStatus} / ${context.outcomeType || 'N/A'} → ${context.contactEmail}`);

      const cadenceResult = await this.checkEmailCadence(context.tenantId, context.contactId);
      if (!cadenceResult.canSend) {
        console.log(`⏸️ Voice follow-up skipped (cadence): ${cadenceResult.reason}`);
        return { success: true, skipped: true, reason: cadenceResult.reason };
      }

      const debtorContext = await this.gatherDebtorContext(context.tenantId, context.contactId, context.linkedInvoiceIds);

      const { subject, htmlContent, textContent } = await this.generateFollowUpWithAI(context, debtorContext);

      const conversationId = await findOrCreateConversation(
        context.tenantId,
        context.contactId,
        `Voice call follow-up — ${context.voiceStatus}`
      );

      const emailId = uuidv4();
      const replyTo = generateReplyToEmail(context.tenantId, conversationId, emailId);

      const result = await sendEmail({
        to: context.contactEmail,
        from: `${context.tenantName} via Qashivo <${SENDGRID_FROM_EMAIL}>`,
        replyTo,
        subject,
        html: htmlContent,
        text: textContent,
      });

      if (!result.success) {
        console.error(`❌ Failed to send voice follow-up email: ${result.error}`);
        return { success: false, error: result.error };
      }

      await db.insert(emailMessages).values({
        id: emailId,
        tenantId: context.tenantId,
        direction: 'OUTBOUND',
        channel: 'EMAIL',
        contactId: context.contactId,
        invoiceId: context.linkedInvoiceIds?.[0] || null,
        conversationId,
        toEmail: context.contactEmail,
        toName: context.contactName,
        fromEmail: SENDGRID_FROM_EMAIL,
        fromName: `${context.tenantName} via Qashivo`,
        subject,
        textBody: textContent,
        htmlBody: htmlContent,
        replyToken: replyTo.split('@')[0],
        status: 'SENT',
        sentAt: new Date(),
      });

      let timelineSummary: string;
      if (context.voiceStatus === 'completed') {
        const ext = context.extracted || {};
        if (context.outcomeType === 'PROMISE_TO_PAY' && ext.promiseToPayDate) {
          const fmtDate = new Date(ext.promiseToPayDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          const fmtAmt = ext.promiseToPayAmount ? `£${Number(ext.promiseToPayAmount).toFixed(2)}` : null;
          timelineSummary = `Post-call confirmation sent — PTP${fmtAmt ? ` ${fmtAmt}` : ''} by ${fmtDate}`;
        } else if (context.outcomeType === 'DISPUTE') {
          timelineSummary = `Post-call email sent — dispute acknowledged`;
        } else if (context.outcomeType === 'DOCS_REQUESTED') {
          timelineSummary = `Post-call email sent — document request confirmed`;
        } else {
          timelineSummary = `Post-call summary email sent — ${context.outcomeType || 'call completed'}`;
        }
      } else if (context.voiceStatus === 'no_answer') {
        timelineSummary = 'Missed call follow-up email sent — call not answered';
      } else if (context.voiceStatus === 'voicemail') {
        timelineSummary = 'Voicemail follow-up email sent';
      } else if (context.voiceStatus === 'busy') {
        timelineSummary = 'Follow-up email sent — line was busy';
      } else {
        timelineSummary = `Voice follow-up email sent — ${context.voiceStatus}`;
      }

      await db.insert(timelineEvents).values({
        tenantId: context.tenantId,
        customerId: context.contactId,
        invoiceId: context.linkedInvoiceIds?.[0] || null,
        occurredAt: new Date(),
        direction: 'outbound',
        channel: 'email',
        summary: timelineSummary,
        preview: textContent.substring(0, 240),
        subject,
        body: textContent,
        status: 'sent',
        provider: 'sendgrid',
        providerMessageId: emailId,
        createdByType: 'system',
        createdByName: 'Qashivo AI',
        outcomeType: context.outcomeType ? context.outcomeType.toLowerCase() : 'voice_followup',
        outcomeExtracted: {
          callId: context.callId,
          voiceStatus: context.voiceStatus,
          outcomeType: context.outcomeType || null,
          sourceChannel: 'voice',
          ...(context.extracted || {}),
        },
      });

      await updateConversationStats(conversationId, "outbound");

      console.log(`✅ Voice follow-up email sent and stored: ${timelineSummary}`);

      return { success: true };

    } catch (error: any) {
      console.error(`❌ Error sending voice follow-up email:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate default clarification questions based on ambiguity type
   */
  private generateDefaultQuestions(
    ambiguityDetails: AmbiguityDetails, 
    outstandingInvoices?: Array<{ invoiceNumber: string; amount: number }>
  ): string[] {
    const questions: string[] = [];
    
    if (ambiguityDetails.unclearInvoices || ambiguityDetails.multipleInvoices) {
      if (outstandingInvoices && outstandingInvoices.length > 1) {
        questions.push(`Which invoice(s) does your payment relate to? (You have ${outstandingInvoices.length} outstanding invoices - see the list below)`);
      } else {
        questions.push(`Could you please confirm the invoice number(s) your payment relates to?`);
      }
    }
    
    if (ambiguityDetails.unclearAmount) {
      questions.push(`What is the exact amount you intend to pay?`);
    }
    
    if (ambiguityDetails.unclearDate) {
      questions.push(`On what date do you expect to make the payment?`);
    }
    
    // Ensure at least one question
    if (questions.length === 0) {
      questions.push(`Could you please confirm the details of your intended payment (invoice number, amount, and date)?`);
    }
    
    return questions;
  }
}

export const emailClarificationService = new EmailClarificationService();
