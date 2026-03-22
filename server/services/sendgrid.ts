// Backwards compatibility wrapper for SendGrid email service
// SECURITY: All outbound email MUST flow through this module's exported functions.
// Communication mode enforcement happens here — do NOT call emailService.sendEmail() directly.
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

// ── Communication Mode Enforcement ─────────────────────────────
// This is the SINGLE enforcement point for all outbound email.
// Every email path MUST call this before dispatching.

interface ModeCheckResult {
  allowed: boolean;
  to: string;
  subject: string;
  html: string;
  text?: string;
  mode: string;
  error?: string;
}

async function enforceCommunicationMode(params: {
  tenantId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<ModeCheckResult> {
  const { db } = await import('../db.js');
  const { tenants } = await import('../../shared/schema.js');
  const { eq } = await import('drizzle-orm');

  const [tenant] = await db.select({
    communicationMode: tenants.communicationMode,
    testEmails: tenants.testEmails,
    testContactName: tenants.testContactName,
  }).from(tenants).where(eq(tenants.id, params.tenantId));

  const mode = tenant?.communicationMode || 'testing'; // Default to testing, not live
  let { to, subject, html, text } = params;

  console.log(`📧 [CommMode] tenant=${params.tenantId} mode=${mode} intendedRecipient=${to} subject="${subject.slice(0, 60)}"`);

  // MODE: OFF — hard block, throw
  if (mode === 'off') {
    console.log(`🚫 [CommMode] BLOCKED — mode is OFF for tenant ${params.tenantId}`);
    return { allowed: false, to, subject, html, text, mode, error: 'Communication mode is OFF — all outbound blocked' };
  }

  // MODE: TESTING — redirect to test addresses
  if (mode === 'testing') {
    const testEmails = tenant?.testEmails as string[] | null;
    if (testEmails?.length && !subject.startsWith('[TEST]')) {
      const originalTo = to;
      to = testEmails[0];
      subject = `[TEST] ${subject}`;
      const testBanner = `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#92400e;"><strong>TEST MODE</strong> — Original recipient: ${originalTo}</div>`;
      html = testBanner + html;
      if (text) {
        text = `[TEST MODE] Original recipient: ${originalTo}\n\n${text}`;
      }
      console.log(`🧪 [CommMode] REDIRECTED from ${originalTo} → ${to}`);
    }
    return { allowed: true, to, subject, html, text, mode };
  }

  // MODE: SOFT_LIVE — no opt-in mechanism exists yet, so fall back to testing behaviour
  // TODO: When contact-level opt-in flag is added, check it here.
  //       If opted in → send to real recipient. If not → redirect to test address.
  if (mode === 'soft_live') {
    const testEmails = tenant?.testEmails as string[] | null;
    if (testEmails?.length && !subject.startsWith('[SOFT LIVE]')) {
      const originalTo = to;
      to = testEmails[0];
      subject = `[SOFT LIVE] ${subject}`;
      const testBanner = `<div style="background:#dbeafe;border:1px solid #3b82f6;border-radius:6px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#1e40af;"><strong>SOFT LIVE</strong> — Original recipient: ${originalTo} (no opt-in flag set)</div>`;
      html = testBanner + html;
      if (text) {
        text = `[SOFT LIVE] Original recipient: ${originalTo}\n\n${text}`;
      }
      console.log(`🔵 [CommMode] SOFT_LIVE redirect (no opt-in) from ${originalTo} → ${to}`);
    }
    return { allowed: true, to, subject, html, text, mode };
  }

  // MODE: LIVE — send to real recipient, no modification
  console.log(`🟢 [CommMode] LIVE — sending to real recipient ${to}`);
  return { allowed: true, to, subject, html, text, mode };
}

// ── Primary Send Function ──────────────────────────────────────

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
    // 1. Demo mode check (short-circuits everything)
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

    // 2. COMMUNICATION MODE ENFORCEMENT — must happen BEFORE any send path
    //    This is the security-critical check. It runs before connected email,
    //    before SendGrid, before anything that touches the wire.
    if (params.tenantId) {
      try {
        const modeResult = await enforceCommunicationMode({
          tenantId: params.tenantId,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
        });

        if (!modeResult.allowed) {
          // Mode is OFF — hard block
          throw new Error(modeResult.error || 'Communication mode is OFF');
        }

        // Apply any mode transformations (test redirect, subject prefix, etc.)
        params.to = modeResult.to;
        params.subject = modeResult.subject;
        params.html = modeResult.html;
        params.text = modeResult.text;
      } catch (err: any) {
        if (err.message?.includes('Communication mode is OFF')) {
          // Re-throw mode-off errors — these are intentional blocks
          return { success: false, error: err.message };
        }
        console.warn('[EmailSafetyNet] Could not check communication mode:', err);
        // If we can't verify the mode, block in production as a safety measure
        if (process.env.NODE_ENV === 'production') {
          console.error('🚫 [EmailSafetyNet] BLOCKING email — cannot verify communication mode in production');
          return { success: false, error: 'Cannot verify communication mode — email blocked for safety' };
        }
      }
    } else {
      console.log(`📧 [EmailRouting] No tenantId provided — system/internal email, no mode check`);
    }

    // 3. Connected email routing (mode has already been enforced above)
    if (params.tenantId) {
      try {
        const { isEmailConnected, sendViaConnectedAccount } = await import('./email/ConnectedEmailService.js');
        const connected = await isEmailConnected(params.tenantId);
        console.log(`📧 [EmailRouting] tenantId=${params.tenantId}, connected=${connected}`);
        if (connected) {
          console.log(`📧 [EmailRouting] Sending via connected email account for tenant ${params.tenantId}`);
          const connectedResult = await sendViaConnectedAccount({
            tenantId: params.tenantId,
            to: params.to, // Already transformed by mode enforcement
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
    }

    // 4. SendGrid dispatch (mode already enforced, params already transformed)
    console.log(`📧 sendEmail dispatching to SendGrid — to: ${params.to}, replyTo: ${params.replyTo || '(none)'}`);

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
  tenantId?: string;
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
  tenantId?: string;
}): Promise<boolean> {
  try {
    // SECURITY: Enforce communication mode for bulk sends
    if (params.tenantId) {
      const modeResult = await enforceCommunicationMode({
        tenantId: params.tenantId,
        to: params.recipients[0]?.email || 'unknown',
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      if (!modeResult.allowed) {
        console.log(`🚫 [BulkEmail] Blocked — communication mode is OFF for tenant ${params.tenantId}`);
        return false;
      }

      // In testing/soft_live mode, redirect ALL recipients to test address
      if (modeResult.mode === 'testing' || modeResult.mode === 'soft_live') {
        const originalRecipients = params.recipients.map(r => r.email).join(', ');
        params.recipients = [{ email: modeResult.to, name: 'Test Recipient' }];
        params.subject = modeResult.subject;
        params.html = modeResult.html;
        if (modeResult.text) params.text = modeResult.text;
        // Append original recipients list to the test banner
        const recipientNote = `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:8px 16px;margin-bottom:12px;font-size:12px;color:#92400e;">Bulk send — original ${originalRecipients.split(',').length} recipients: ${originalRecipients.slice(0, 500)}</div>`;
        params.html = recipientNote + params.html;
        console.log(`🧪 [BulkEmail] Redirected bulk send of ${originalRecipients.split(',').length} recipients → ${modeResult.to}`);
      }
    }

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
  tenantId?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    type: string;
  }>;
}): Promise<boolean> {
  try {
    // SECURITY: Enforce communication mode for attachment emails
    if (params.tenantId) {
      const modeResult = await enforceCommunicationMode({
        tenantId: params.tenantId,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      if (!modeResult.allowed) {
        console.log(`🚫 [AttachmentEmail] Blocked — communication mode is OFF for tenant ${params.tenantId}`);
        return false;
      }

      params.to = modeResult.to;
      params.subject = modeResult.subject;
      params.html = modeResult.html;
      params.text = modeResult.text;
    }

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
// WARNING: Direct use of emailService bypasses communication mode enforcement.
// Only use for system-to-system emails (user invites, password resets) that
// should NEVER be gated by tenant communication mode.
export { emailService };
