// Backwards compatibility wrapper for SendGrid email service
import { SendGridEmailService } from './email/SendGridEmailService';
import { EmailServiceConfig, EmailMessage, EmailAddress, EmailProvider } from '../../shared/types/email';

// Create singleton instance
const config: EmailServiceConfig = {
  provider: EmailProvider.SENDGRID,
  apiKey: process.env.SENDGRID_API_KEY || 'default_key',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  defaultFrom: {
    email: process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com',
    name: process.env.SENDGRID_FROM_NAME || 'Nexus AR'
  }
};

const emailService = new SendGridEmailService(config);

// Export constants
export const DEFAULT_FROM = process.env.SENDGRID_FROM_NAME || 'Nexus AR';
export const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';

// Simple send email function for backwards compatibility
export async function sendEmail(params: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  invoiceId?: string;
  customerId?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Check if demo mode is enabled - SHORT-CIRCUIT and return mock success
    const { demoModeService } = await import('./demoModeService.js');
    if (demoModeService.isEnabled()) {
      console.log('🎭 Demo mode: Skipping real email send, returning mock success');
      
      // Schedule mock inbound response if context available
      if (params.invoiceId && params.customerId) {
        const { mockResponderService } = await import('./mockResponderService.js');
        mockResponderService.simulateEmailResponse({
          fromEmail: params.to,
          toEmail: params.from,
          invoiceId: params.invoiceId,
          customerId: params.customerId,
        });
      }
      
      // Return mock success immediately - DO NOT send real email
      return { success: true, messageId: 'demo-mock-email-' + Date.now() };
    }

    const message: EmailMessage = {
      to: [{ email: params.to }],
      from: parseEmailAddress(params.from),
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text
    };

    const result = await emailService.sendEmail(message);
    return { 
      success: result.success, 
      messageId: result.messageId,
      error: result.error 
    };
  } catch (error: any) {
    console.error('Send email error:', error);
    return { success: false, error: error.message };
  }
}

// Send reminder email function
export async function sendReminderEmail(params: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return await sendEmail(params);
}

// Send bulk emails function
export async function sendBulkEmails(params: {
  from: string;
  subject: string;
  html: string;
  text?: string;
  recipients: Array<{ email: string; name?: string }>;
}): Promise<boolean> {
  try {
    const result = await emailService.sendBulkEmails({
      from: parseEmailAddress(params.from),
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
      recipients: params.recipients.map(r => ({
        to: { email: r.email, name: r.name }
      }))
    });

    return result.successfulSends > 0;
  } catch (error) {
    console.error('Send bulk emails error:', error);
    return false;
  }
}

// Send email with attachment
export async function sendEmailWithAttachment(params: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    type: string;
  }>;
}): Promise<boolean> {
  try {
    const message: EmailMessage = {
      to: [{ email: params.to }],
      from: parseEmailAddress(params.from),
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
      attachments: params.attachments?.map(att => ({
        filename: att.filename,
        content: new Uint8Array(att.content),
        type: att.type
      }))
    };

    const result = await emailService.sendEmail(message);
    return result.success;
  } catch (error) {
    console.error('Send email with attachment error:', error);
    return false;
  }
}

// Helper function to parse email address with name
function parseEmailAddress(emailString: string): EmailAddress {
  const match = emailString.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].trim(),
      email: match[2].trim()
    };
  }
  return { email: emailString.trim() };
}

// Export the service for advanced usage
export { emailService };
