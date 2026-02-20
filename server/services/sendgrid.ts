// Backwards compatibility wrapper for SendGrid email service
import { SendGridEmailService } from './email/SendGridEmailService';
import { EmailServiceConfig, EmailMessage, EmailAddress, EmailProvider } from '../../shared/types/email';

// Create singleton instance
const config: EmailServiceConfig = {
  provider: EmailProvider.SENDGRID,
  apiKey: process.env.SENDGRID_API_KEY || 'default_key',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  defaultFrom: {
    email: process.env.SENDGRID_FROM_EMAIL || 'cc@qashivo.com',
    name: process.env.SENDGRID_FROM_NAME || 'Qashivo Credit Control'
  }
};

const emailService = new SendGridEmailService(config);

// Export constants
export const DEFAULT_FROM = process.env.SENDGRID_FROM_NAME || 'Qashivo Credit Control';
export const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'cc@qashivo.com';

export async function sendEmail(params: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  invoiceId?: string;
  customerId?: string;
  trackClicks?: boolean;
  tenantId?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { demoModeService } = await import('./demoModeService.js');
    if (demoModeService.isEnabled()) {
      console.log('🎭 Demo mode: Skipping real email send, returning mock success');
      
      if (params.invoiceId && params.customerId) {
        const { mockResponderService } = await import('./mockResponderService.js');
        mockResponderService.simulateEmailResponse({
          fromEmail: params.to,
          toEmail: params.from,
          invoiceId: params.invoiceId,
          customerId: params.customerId,
        });
      }
      
      return { success: true, messageId: 'demo-mock-email-' + Date.now() };
    }

    if (params.tenantId) {
      try {
        const { isEmailConnected, sendViaConnectedAccount } = await import('./email/ConnectedEmailService.js');
        const connected = await isEmailConnected(params.tenantId);
        console.log(`📧 [EmailRouting] tenantId=${params.tenantId}, connected=${connected}`);
        if (connected) {
          console.log(`📧 [EmailRouting] Sending via connected email account for tenant ${params.tenantId}`);
          const connectedResult = await sendViaConnectedAccount({
            tenantId: params.tenantId,
            to: params.to,
            subject: params.subject,
            htmlBody: params.html,
            textBody: params.text,
            replyTo: params.replyTo,
            headers: params.headers,
          });
          if (connectedResult.success) {
            console.log(`✅ [EmailRouting] Email sent via connected account, messageId: ${connectedResult.messageId}`);
            return connectedResult;
          }
          console.warn(`⚠️ [EmailRouting] Connected email send failed, falling back to SendGrid: ${connectedResult.error}`);
        } else {
          console.log(`📧 [EmailRouting] No connected email for tenant ${params.tenantId}, using SendGrid`);
        }
      } catch (routingErr: any) {
        console.error(`❌ [EmailRouting] Error checking connected email, falling back to SendGrid:`, routingErr.message);
      }
    } else {
      console.log(`📧 [EmailRouting] No tenantId provided, using SendGrid directly`);
    }

    console.log(`📧 sendEmail called with replyTo: ${params.replyTo || '(none)'}`);
    
    const message: EmailMessage = {
      to: [{ email: params.to }],
      from: parseEmailAddress(params.from),
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
      replyTo: params.replyTo ? { email: params.replyTo } : undefined,
      customHeaders: params.headers,
      trackClicks: params.trackClicks,
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
