import { MailService } from '@sendgrid/mail';

const mailService = new MailService();
const apiKey = process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY_ENV_VAR || "default_key";

// Centralized sender configuration
export const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@nexusar.com';
export const DEFAULT_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Nexus AR';
export const DEFAULT_FROM = `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`;

if (apiKey && apiKey !== "default_key") {
  mailService.setApiKey(apiKey);
  console.log(`✅ SendGrid configured successfully with sender: ${DEFAULT_FROM}`);
} else {
  console.log("⚠️ SendGrid API key not configured, emails will be skipped");
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

    const emailData: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
    };

    // SendGrid requires at least one content type
    if (params.html) {
      emailData.html = params.html;
      // If we have HTML, provide a text fallback if none provided
      if (!params.text) {
        emailData.text = params.html.replace(/<[^>]*>/g, ''); // Strip HTML tags for text version
      } else {
        emailData.text = params.text;
      }
    } else if (params.text) {
      emailData.text = params.text;
    } else {
      throw new Error('Email must have either text or html content');
    }

    await mailService.send(emailData);
    
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error);
    if (error.response && error.response.body && error.response.body.errors) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
    }
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
  // This function is deprecated - all email sending should use templates from Collections Workflow
  throw new Error('sendReminderEmail is deprecated. Use template-based email sending instead.');
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
