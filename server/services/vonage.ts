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

interface SMSParams {
  to: string;
  message: string;
  from?: string;
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
    let to = params.to;
    let text = params.message;

    // Safety net: check tenant communication mode for SMS redirection
    if ((params as any).tenantId) {
      try {
        const { db } = await import('../db.js');
        const { tenants } = await import('../../shared/schema.js');
        const { eq } = await import('drizzle-orm');
        const [tenant] = await db.select({
          communicationMode: tenants.communicationMode,
          testPhones: tenants.testPhones,
        }).from(tenants).where(eq(tenants.id, (params as any).tenantId));

        if (tenant?.communicationMode === 'off') {
          console.log(`🚫 [SmsSafetyNet] Communication mode is OFF — blocking SMS`);
          return { success: false, error: 'Communication mode is OFF' };
        }

        if (tenant?.communicationMode === 'testing') {
          const testPhones = tenant.testPhones as string[] | null;
          if (testPhones?.length) {
            const originalTo = to;
            to = testPhones[0];
            text = `[TEST] Original recipient: ${originalTo}\n\n${text}`;
            console.log(`🧪 [SmsSafetyNet] Redirected SMS from ${originalTo} → ${to}`);
          }
        }
      } catch (err) {
        console.warn('[SmsSafetyNet] Could not check communication mode:', err);
      }
    }

    console.log(`📤 Sending Vonage SMS from ${from} to ${to}`);

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
        console.error(`❌ Vonage SMS error: ${message.errorText}`);
        return { 
          success: false, 
          error: message.errorText || 'Failed to send SMS' 
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
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = `Hi ${contactData.name}, this is a friendly reminder that Invoice ${contactData.invoiceNumber} for £${contactData.amount} is ${contactData.daysPastDue} days past due. Please contact us to arrange payment. Thank you!`;

  return await sendSMS({
    to: contactData.phone,
    message,
  });
}

export async function sendUrgentPaymentNotice(
  contactData: {
    phone: string;
    name: string;
    invoiceNumber: string;
    amount: number;
    daysPastDue: number;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = `URGENT: ${contactData.name}, Invoice ${contactData.invoiceNumber} (£${contactData.amount}) is ${contactData.daysPastDue} days overdue. Immediate payment required to avoid further action. Please call us today.`;

  return await sendSMS({
    to: contactData.phone,
    message,
  });
}

export async function sendCustomSMS(
  to: string,
  message: string,
  from?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return await sendSMS({ to, message, from });
}
