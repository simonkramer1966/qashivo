import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { 
  emailClarifications, 
  emailMessages,
  inboundMessages, 
  contacts, 
  invoices, 
  tenants,
  conversations,
  timelineEvents
} from "@shared/schema";
import { sendEmail } from "./sendgrid";
import { generateReplyToEmail, findOrCreateConversation, updateConversationStats } from "./emailCommunications";
import { v4 as uuidv4 } from "uuid";

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
