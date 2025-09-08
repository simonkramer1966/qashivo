import { MailService } from '@sendgrid/mail';

const mailService = new MailService();
const apiKey = process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY_ENV_VAR || "default_key";

if (apiKey && apiKey !== "default_key") {
  mailService.setApiKey(apiKey);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

interface EmailWithAttachmentParams extends EmailParams {
  attachments: Array<{
    content: Buffer;
    filename: string;
    type: string;
    disposition?: string;
  }>;
}

interface BulkEmailParams {
  from: string;
  subject: string;
  text?: string;
  html?: string;
  recipients: Array<{
    to: string;
    substitutions?: Record<string, string>;
  }>;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (apiKey === "default_key") {
      console.log("SendGrid API key not configured, skipping email send:", params);
      return true;
    }

    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html,
    });
    
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendReminderEmail(
  invoiceData: {
    contactEmail: string;
    contactName: string;
    invoiceNumber: string;
    amount: number;
    dueDate: string;
    daysPastDue: number;
  },
  fromEmail: string,
  customMessage?: string
): Promise<boolean> {
  const subject = `Payment Reminder - Invoice ${invoiceData.invoiceNumber}`;
  
  const defaultMessage = `
Dear ${invoiceData.contactName},

We hope this message finds you well. We wanted to remind you that Invoice ${invoiceData.invoiceNumber} for $${invoiceData.amount} was due on ${invoiceData.dueDate} and is now ${invoiceData.daysPastDue} days overdue.

We understand that sometimes invoices can be overlooked or there may be circumstances affecting payment. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to reach out to us.

To make payment, you can:
- Log into your account portal
- Send a check to our mailing address
- Call us to arrange payment over the phone

We appreciate your prompt attention to this matter and value our business relationship.

Best regards,
Accounts Receivable Team
  `.trim();

  const htmlMessage = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Payment Reminder</h2>
  
  <p>Dear ${invoiceData.contactName},</p>
  
  <p>We hope this message finds you well. We wanted to remind you that:</p>
  
  <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #007bff; margin: 20px 0;">
    <strong>Invoice #${invoiceData.invoiceNumber}</strong><br>
    <strong>Amount:</strong> $${invoiceData.amount}<br>
    <strong>Due Date:</strong> ${invoiceData.dueDate}<br>
    <strong>Days Past Due:</strong> ${invoiceData.daysPastDue}
  </div>
  
  <p>We understand that sometimes invoices can be overlooked or there may be circumstances affecting payment. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to reach out to us.</p>
  
  <div style="margin: 30px 0;">
    <h3 style="color: #333;">Payment Options:</h3>
    <ul>
      <li>Log into your account portal</li>
      <li>Send a check to our mailing address</li>
      <li>Call us to arrange payment over the phone</li>
    </ul>
  </div>
  
  <p>We appreciate your prompt attention to this matter and value our business relationship.</p>
  
  <p>Best regards,<br>
  <strong>Accounts Receivable Team</strong></p>
</div>
  `;

  return await sendEmail({
    to: invoiceData.contactEmail,
    from: fromEmail,
    subject,
    text: customMessage || defaultMessage,
    html: customMessage ? undefined : htmlMessage,
  });
}

export async function sendBulkEmails(params: BulkEmailParams): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const recipient of params.recipients) {
    let subject = params.subject;
    let text = params.text || '';
    let html = params.html || '';

    // Apply substitutions if provided
    if (recipient.substitutions) {
      Object.entries(recipient.substitutions).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        subject = subject.replace(new RegExp(placeholder, 'g'), value);
        text = text.replace(new RegExp(placeholder, 'g'), value);
        html = html.replace(new RegExp(placeholder, 'g'), value);
      });
    }

    const success = await sendEmail({
      to: recipient.to,
      from: params.from,
      subject,
      text,
      html,
    });

    if (success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push(`Failed to send email to ${recipient.to}`);
    }
  }

  return results;
}

export async function sendEmailWithAttachment(params: EmailWithAttachmentParams): Promise<boolean> {
  try {
    if (apiKey === "default_key") {
      console.log("SendGrid API key not configured, skipping email with attachment send:", {
        to: params.to,
        subject: params.subject,
        attachmentCount: params.attachments.length
      });
      return true;
    }

    const attachmentData = params.attachments.map(att => ({
      content: att.content.toString('base64'),
      filename: att.filename,
      type: att.type,
      disposition: att.disposition || 'attachment'
    }));

    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html,
      attachments: attachmentData
    });
    
    console.log(`Email with ${params.attachments.length} attachment(s) sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email with attachment error:', error);
    return false;
  }
}
