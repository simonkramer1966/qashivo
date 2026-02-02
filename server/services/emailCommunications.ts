import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { actions, contacts, invoices, tenants, emailMessages, conversations } from "@shared/schema";
import { sendEmail } from "./sendgrid";
import { generateReplyTokenSignature } from "./inboundEmailNormalizer";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

const EMAIL_REPLY_DOMAIN = process.env.EMAIL_REPLY_DOMAIN || "in.qashivo.com";
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "cc@qashivo.com";
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || "Qashivo Credit Control";

interface SendActionEmailResult {
  success: boolean;
  emailMessageId?: string;
  sendgridMessageId?: string;
  error?: string;
}

interface EmailTemplateData {
  customerName: string;
  companyName: string;
  invoiceNumber?: string;
  amountDue?: string;
  dueDate?: string;
  payLink?: string;
  tenantName: string;
}

/**
 * Generate reply-to email address in format:
 * reply+{tenantId}.{conversationId}.{emailMessageId}.{signature}@in.qashivo.com
 */
function generateReplyToEmail(tenantId: string, conversationId: string, emailMessageId: string): string {
  const signature = generateReplyTokenSignature(tenantId, conversationId, emailMessageId);
  const token = `${tenantId}.${conversationId}.${emailMessageId}.${signature}`;
  return `reply+${token}@${EMAIL_REPLY_DOMAIN}`;
}

/**
 * Find or create a conversation for a contact
 */
async function findOrCreateConversation(
  tenantId: string,
  contactId: string,
  subject?: string
): Promise<string> {
  // Look for existing open conversation with this contact
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(
      eq(conversations.tenantId, tenantId),
      eq(conversations.contactId, contactId),
      eq(conversations.status, "open")
    ))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);
  
  if (existing) {
    return existing.id;
  }
  
  // Create new conversation
  const [newConversation] = await db
    .insert(conversations)
    .values({
      tenantId,
      contactId,
      subject: subject || "Collection correspondence",
      status: "open",
      channel: "email",
      messageCount: 0,
    })
    .returning();
  
  return newConversation.id;
}

/**
 * Update conversation metadata after adding a message
 */
async function updateConversationStats(
  conversationId: string,
  direction: "inbound" | "outbound"
): Promise<void> {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  
  if (conv) {
    await db
      .update(conversations)
      .set({
        messageCount: (conv.messageCount || 0) + 1,
        lastMessageAt: new Date(),
        lastMessageDirection: direction,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));
  }
}

function generateThreadKey(invoiceId: string | null, contactId: string): string {
  if (invoiceId) {
    return `inv_${invoiceId}`;
  }
  return `cust_${contactId}`;
}

function buildSubject(invoice: any, contact: any, tenantName: string): string {
  if (invoice) {
    return `Invoice ${invoice.invoiceNumber} — ${contact.companyName || contact.name}`;
  }
  return `Quick reminder — ${contact.companyName || contact.name}`;
}

function applyTemplateVariables(template: string, data: EmailTemplateData): string {
  let result = template;
  result = result.replace(/\{\{customerName\}\}/g, data.customerName);
  result = result.replace(/\{\{companyName\}\}/g, data.companyName);
  result = result.replace(/\{\{invoiceNumber\}\}/g, data.invoiceNumber || "");
  result = result.replace(/\{\{amountDue\}\}/g, data.amountDue || "");
  result = result.replace(/\{\{dueDate\}\}/g, data.dueDate || "");
  result = result.replace(/\{\{payLink\}\}/g, data.payLink || "");
  result = result.replace(/\{\{tenantName\}\}/g, data.tenantName);
  return result;
}

function formatAmount(amount: string | number | null): string {
  if (!amount) return "£0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `£${num.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function buildDefaultEmailBody(data: EmailTemplateData, daysOverdue: number): string {
  const greeting = `Dear ${data.customerName},`;
  
  let body = "";
  if (daysOverdue > 0 && data.invoiceNumber) {
    body = `
      <p>We hope this email finds you well.</p>
      <p>This is a friendly reminder that invoice <strong>${data.invoiceNumber}</strong> for <strong>${data.amountDue}</strong> was due on ${data.dueDate}.</p>
      <p>If payment has already been made, please disregard this message. Otherwise, we would appreciate payment at your earliest convenience.</p>
    `;
  } else {
    body = `
      <p>We hope this email finds you well.</p>
      <p>This is a friendly reminder regarding your account. If you have any questions about your invoices, please don't hesitate to get in touch.</p>
    `;
  }

  const footer = `
    <p>Kind regards,<br/>${data.tenantName}</p>
  `;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <p>${greeting}</p>
      ${body}
      ${footer}
    </div>
  `;
}

export async function sendActionEmail(actionId: string): Promise<SendActionEmailResult> {
  try {
    const [actionRecord] = await db
      .select({
        action: actions,
        contact: contacts,
        invoice: invoices,
        tenant: tenants,
      })
      .from(actions)
      .innerJoin(contacts, eq(actions.contactId, contacts.id))
      .leftJoin(invoices, eq(actions.invoiceId, invoices.id))
      .innerJoin(tenants, eq(actions.tenantId, tenants.id))
      .where(eq(actions.id, actionId))
      .limit(1);

    if (!actionRecord) {
      return { success: false, error: "Action not found" };
    }

    const { action, contact, invoice, tenant } = actionRecord;

    if (action.status !== "scheduled" && action.status !== "pending_approval") {
      console.log(`Action ${actionId} has status ${action.status}, checking if approved...`);
    }

    if (!contact.email) {
      return { success: false, error: "Contact has no email address" };
    }

    // Find or create conversation for this contact
    const conversationId = await findOrCreateConversation(
      action.tenantId,
      contact.id,
      invoice?.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : undefined
    );
    
    // Pre-generate email message ID for reply token
    const emailMessageId = uuidv4();
    
    // Generate reply-to with new format: tenantId.conversationId.emailMessageId.signature
    const replyToEmail = generateReplyToEmail(action.tenantId, conversationId, emailMessageId);
    const replyToken = `${action.tenantId}.${conversationId}.${emailMessageId}`;
    
    const threadKey = generateThreadKey(invoice?.id || null, contact.id);

    const daysOverdue = invoice?.dueDate
      ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const templateData: EmailTemplateData = {
      customerName: contact.name || "Customer",
      companyName: contact.companyName || contact.name || "Customer",
      invoiceNumber: invoice?.invoiceNumber || undefined,
      amountDue: invoice?.amount ? formatAmount(invoice.amount) : undefined,
      dueDate: invoice?.dueDate ? formatDate(invoice.dueDate) : undefined,
      payLink: (action.metadata as any)?.paymentLink,
      tenantName: tenant.name || "Accounts Team",
    };

    let subject = action.subject;
    let htmlBody = action.content;

    if (!subject) {
      subject = buildSubject(invoice, contact, tenant.name);
    }

    if (htmlBody) {
      htmlBody = applyTemplateVariables(htmlBody, templateData);
    } else {
      htmlBody = buildDefaultEmailBody(templateData, daysOverdue);
    }

    const textBody = htmlBody.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

    const customHeaders: Record<string, string> = {
      "X-Qashivo-Action-Id": action.id,
      "X-Qashivo-Contact-Id": contact.id,
      "X-Qashivo-Thread-Key": threadKey,
    };
    if (invoice?.id) {
      customHeaders["X-Qashivo-Invoice-Id"] = invoice.id;
    }

    const [emailMessage] = await db
      .insert(emailMessages)
      .values({
        id: emailMessageId, // Use pre-generated ID for reply token
        tenantId: action.tenantId,
        conversationId, // Link to conversation
        direction: "OUTBOUND",
        channel: "EMAIL",
        actionId: action.id,
        contactId: contact.id,
        invoiceId: invoice?.id || null,
        toEmail: contact.email,
        toName: contact.name || null,
        fromEmail: SENDGRID_FROM_EMAIL,
        fromName: tenant.name ? `${tenant.name} via Qashivo` : SENDGRID_FROM_NAME,
        subject,
        textBody,
        htmlBody,
        threadKey,
        replyToken,
        status: "QUEUED",
      })
      .returning();

    await db
      .update(actions)
      .set({ emailReplyToken: replyToken })
      .where(eq(actions.id, action.id));

    try {
      const sendResult = await sendEmail({
        to: contact.email,
        from: `${tenant.name ? `${tenant.name} via Qashivo` : SENDGRID_FROM_NAME} <${SENDGRID_FROM_EMAIL}>`,
        replyTo: replyToEmail,
        subject,
        html: htmlBody,
        text: textBody,
        headers: customHeaders,
      });

      if (sendResult) {
        await db
          .update(emailMessages)
          .set({
            status: "SENT",
            sentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emailMessages.id, emailMessage.id));
        
        // Update conversation stats
        await updateConversationStats(conversationId, "outbound");

        console.log(`✅ Email sent to ${contact.email} for action ${action.id} (conversation: ${conversationId})`);

        return {
          success: true,
          emailMessageId: emailMessage.id,
        };
      } else {
        await db
          .update(emailMessages)
          .set({
            status: "FAILED",
            error: "SendGrid returned false",
            updatedAt: new Date(),
          })
          .where(eq(emailMessages.id, emailMessage.id));

        return { success: false, error: "Failed to send email via SendGrid" };
      }
    } catch (sendError: any) {
      await db
        .update(emailMessages)
        .set({
          status: "FAILED",
          error: sendError.message,
          updatedAt: new Date(),
        })
        .where(eq(emailMessages.id, emailMessage.id));

      return { success: false, error: sendError.message };
    }
  } catch (error: any) {
    console.error("sendActionEmail error:", error);
    return { success: false, error: error.message };
  }
}

export async function getEmailThreadForContact(
  tenantId: string,
  contactId: string,
  invoiceId?: string
): Promise<any[]> {
  let query = db
    .select()
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.tenantId, tenantId),
        eq(emailMessages.contactId, contactId)
      )
    )
    .orderBy(emailMessages.createdAt);

  if (invoiceId) {
    query = db
      .select()
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.tenantId, tenantId),
          eq(emailMessages.invoiceId, invoiceId)
        )
      )
      .orderBy(emailMessages.createdAt);
  }

  return await query;
}

export async function getEmailMessageById(emailMessageId: string) {
  const [message] = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.id, emailMessageId))
    .limit(1);
  return message;
}
