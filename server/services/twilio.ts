import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID_ENV_VAR || "default_sid";
const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN_ENV_VAR || "default_token";
const fromNumber = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER_ENV_VAR || "+1234567890";
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_MESSAGING_SERVICE_SID_ENV_VAR;

const client = (accountSid !== "default_sid" && authToken !== "default_token") 
  ? twilio(accountSid, authToken) 
  : null;

console.log('📱 Twilio Configuration:');
console.log('  Account SID:', accountSid !== "default_sid" ? 'configured' : 'not set');
console.log('  From Number:', fromNumber !== "+1234567890" ? fromNumber : 'not set');
console.log('  Messaging Service SID:', messagingServiceSid || 'not set');
if (messagingServiceSid) {
  console.log('  ✅ Using Messaging Service for SMS');
}

interface SMSParams {
  to: string;
  message: string;
  from?: string;
}

export async function sendSMS(params: SMSParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    if (!client) {
      console.log("Twilio credentials not configured, skipping SMS send:", params);
      return { success: true, messageId: 'mock-id' };
    }

    const messagePayload: any = {
      body: params.message,
      to: params.to,
    };

    if (messagingServiceSid) {
      messagePayload.messagingServiceSid = messagingServiceSid;
      console.log(`📤 Sending SMS via Messaging Service (${messagingServiceSid}) to ${params.to}`);
    } else {
      messagePayload.from = params.from || fromNumber;
      console.log(`📤 Sending SMS from ${messagePayload.from} to ${params.to}`);
    }

    const message = await client.messages.create(messagePayload);

    console.log(`✅ SMS sent successfully! SID: ${message.sid}, Status: ${message.status}`);
    return { success: true, messageId: message.sid };
  } catch (error: any) {
    console.error('❌ Twilio SMS error:', error.message);
    if (error.code) console.error('   Error code:', error.code);
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
  const message = `Hi ${contactData.name}, this is a friendly reminder that Invoice ${contactData.invoiceNumber} for $${contactData.amount} is ${contactData.daysPastDue} days past due. Please contact us to arrange payment. Thank you!`;

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
  const message = `URGENT: ${contactData.name}, Invoice ${contactData.invoiceNumber} ($${contactData.amount}) is ${contactData.daysPastDue} days overdue. Immediate payment required to avoid further action. Please call us today.`;

  return await sendSMS({
    to: contactData.phone,
    message,
  });
}

export async function makeCall(
  params: {
    to: string;
    from?: string;
    url: string; // TwiML URL for call instructions
  }
): Promise<{
  success: boolean;
  callId?: string;
  error?: string;
}> {
  try {
    if (!client) {
      console.log("Twilio credentials not configured, skipping call:", params);
      return { success: true, callId: 'mock-call-id' };
    }

    const call = await client.calls.create({
      url: params.url,
      to: params.to,
      from: params.from || fromNumber,
    });

    console.log(`Call initiated to ${params.to}, ID: ${call.sid}`);
    return { success: true, callId: call.sid };
  } catch (error: any) {
    console.error('Twilio call error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to initiate call' 
    };
  }
}

export async function getBulkSMSStatus(messageIds: string[]): Promise<Array<{
  id: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
}>> {
  if (!client) {
    return messageIds.map(id => ({ id, status: 'sent' }));
  }

  const results = [];
  for (const messageId of messageIds) {
    try {
      const message = await client.messages(messageId).fetch();
      results.push({
        id: messageId,
        status: message.status,
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage,
      });
    } catch (error: any) {
      results.push({
        id: messageId,
        status: 'failed',
        errorMessage: error.message,
      });
    }
  }

  return results;
}
