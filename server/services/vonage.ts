import { Vonage } from '@vonage/server-sdk';

const apiKey = process.env.VONAGE_API_KEY || '';
const apiSecret = process.env.VONAGE_API_SECRET || '';
const fromNumber = process.env.VONAGE_PHONE_NUMBER || '';

const vonageClient = (apiKey && apiSecret)
  ? new Vonage({
      apiKey: apiKey,
      apiSecret: apiSecret,
    })
  : null;

console.log('📱 Vonage Configuration:');
console.log('  API Key:', apiKey ? 'configured' : 'not set');
console.log('  From Number:', fromNumber || 'not set');
if (vonageClient) {
  console.log('  ✅ Vonage SMS client initialized');
}

/**
 * Normalize a phone number to E.164 format without '+' prefix (Vonage requirement).
 * UK mobiles: 07xxx → 447xxx, +447xxx → 447xxx, 00447xxx → 447xxx
 */
function normalizeToE164(phone: string): string {
  let normalized = phone.replace(/[\s\-\(\)]/g, ''); // Strip whitespace, dashes, parens
  if (normalized.startsWith('+')) {
    normalized = normalized.slice(1);
  }
  if (normalized.startsWith('0044')) {
    normalized = '44' + normalized.slice(4);
  }
  if (normalized.startsWith('0')) {
    normalized = '44' + normalized.slice(1);
  }
  return normalized;
}

interface SMSParams {
  to: string;
  message: string;
  from?: string;
  tenantId: string;
  // systemBypass: true — for system-to-admin alerts only (circuit breaker notifications).
  // Never use for debtor-facing messages.
  systemBypass?: boolean;
}

export async function sendSMS(params: SMSParams & {
  invoiceId?: string;
  customerId?: string;
}): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    // Check if demo mode is enabled - SHORT-CIRCUIT and return mock success
    const { demoModeService } = await import('./demoModeService.js');
    if (demoModeService.isEnabled()) {
      console.log('🎭 Demo mode: Skipping real SMS send, returning mock success');

      // Schedule mock inbound response if context available
      if (params.invoiceId && params.customerId) {
        const { mockResponderService } = await import('./mockResponderService.js');
        mockResponderService.simulateSMSResponse({
          fromNumber: params.to,
          toNumber: params.from || fromNumber,
          invoiceId: params.invoiceId,
          customerId: params.customerId,
        });
      }

      // Return mock success immediately - DO NOT send real SMS
      return { success: true, messageId: 'demo-mock-sms-' + Date.now() };
    }

    if (!vonageClient) {
      console.log("Vonage credentials not configured, skipping SMS send:", params);
      return { success: true, messageId: 'mock-vonage-id' };
    }

    const from = params.from || fromNumber;
    let to = normalizeToE164(params.to);
    let text = params.message;

    // SECURITY: Communication mode enforcement — MUST happen before any send
    // tenantId is required — every SMS must go through mode check
    // systemBypass skips mode check — for system-to-admin alerts only
    if (params.systemBypass) {
      console.log(`📱 [SmsSystemBypass] Sending admin alert SMS to ${to} (bypassing mode check)`);
    } else try {
      const { db } = await import('../db.js');
      const { tenants } = await import('../../shared/schema.js');
      const { eq } = await import('drizzle-orm');
      const [tenant] = await db.select({
        communicationMode: tenants.communicationMode,
        testPhones: tenants.testPhones,
      }).from(tenants).where(eq(tenants.id, params.tenantId));

      const mode = tenant?.communicationMode || 'testing'; // Default to testing, not live

      console.log(`📱 [SmsCommMode] tenant=${params.tenantId} mode=${mode} intendedRecipient=${to}`);

      if (mode === 'off') {
        console.log(`🚫 [SmsCommMode] BLOCKED — mode is OFF for tenant ${params.tenantId}`);
        return { success: false, error: 'Communication mode is OFF — all outbound blocked' };
      }

      if (mode === 'testing' || mode === 'soft_live') {
        const testPhones = tenant?.testPhones as string[] | null;
        if (!testPhones?.length) {
          console.error(`🚫 [SmsCommMode] BLOCKED — ${mode} mode but no test phone numbers configured for tenant ${params.tenantId}`);
          return { success: false, error: `No test phone numbers configured for ${mode} mode` };
        }
        const originalTo = to;
        to = normalizeToE164(testPhones[0]);
        const modeLabel = mode === 'testing' ? 'TEST' : 'SOFT LIVE';
        text = `[${modeLabel}] Original recipient: ${originalTo}\n\n${text}`;
        console.log(`🧪 [SmsCommMode] ${modeLabel} redirect from ${originalTo} → ${to}`);
      }
      // mode === 'live' — send to real recipient, no modification
    } catch (err) {
      console.warn('[SmsSafetyNet] Could not check communication mode:', err);
      // Fail closed — block if we can't verify
      if (process.env.NODE_ENV === 'production') {
        console.error('🚫 [SmsSafetyNet] BLOCKING SMS — cannot verify communication mode in production');
        return { success: false, error: 'Cannot verify communication mode — SMS blocked for safety' };
      }
    }

    console.log(`📤 Sending Vonage SMS from=${from} to=${to} textLen=${text.length}`);

    const response = await vonageClient.sms.send({
      to,
      from,
      text,
    });

    if (response.messages && response.messages[0]) {
      const message = response.messages[0];

      if (message.status === '0') {
        console.log(`✅ Vonage SMS sent successfully! Message ID: ${message.messageId}`);
        return { success: true, messageId: message.messageId };
      } else {
        console.error(`❌ Vonage SMS error: status=${message.status} error="${message.errorText}" to=${to} from=${from}`);
        return {
          success: false,
          error: `Vonage status ${message.status}: ${message.errorText || 'Failed to send SMS'}`
        };
      }
    }

    return { success: false, error: 'No response from Vonage' };
  } catch (error: any) {
    console.error('❌ Vonage SMS error:', error.message);
    console.error('❌ Vonage full error:', JSON.stringify(error, null, 2));
    if (error.response) {
      console.error('❌ Vonage error response:', JSON.stringify(error.response, null, 2));
    }
    return {
      success: false,
      error: error.message || 'Failed to send SMS'
    };
  }
}

export async function sendPaymentReminderSMS(
  contactData: {
    phone: string;
    name: string;
    invoiceNumber: string;
    amount: number;
    daysPastDue: number;
    tenantId: string;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = `Hi ${contactData.name}, this is a friendly reminder that Invoice ${contactData.invoiceNumber} for £${contactData.amount} is ${contactData.daysPastDue} days past due. Please contact us to arrange payment. Thank you!`;

  return await sendSMS({
    to: contactData.phone,
    message,
    tenantId: contactData.tenantId,
  });
}

export async function sendUrgentPaymentNotice(
  contactData: {
    phone: string;
    name: string;
    invoiceNumber: string;
    amount: number;
    daysPastDue: number;
    tenantId: string;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = `URGENT: ${contactData.name}, Invoice ${contactData.invoiceNumber} (£${contactData.amount}) is ${contactData.daysPastDue} days overdue. Immediate payment required to avoid further action. Please call us today.`;

  return await sendSMS({
    to: contactData.phone,
    message,
    tenantId: contactData.tenantId,
  });
}

export async function sendCustomSMS(
  to: string,
  message: string,
  tenantId: string,
  from?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return await sendSMS({ to, message, from, tenantId });
}
