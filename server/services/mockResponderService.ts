/**
 * Mock Responder Service
 * 
 * Simulates realistic customer responses to outbound communications for demo purposes.
 * When demo mode is enabled, this service generates mock inbound messages (SMS, email, voice)
 * by posting to the appropriate webhook endpoints with realistic payloads.
 */

import { demoModeService } from './demoModeService.js';

interface MockResponseVariation {
  type: 'payment_plan' | 'promise_to_pay' | 'dispute' | 'general_query' | 'positive' | 'negative';
  messages: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

// Realistic customer response templates
const SMS_RESPONSES: MockResponseVariation[] = [
  {
    type: 'promise_to_pay',
    sentiment: 'positive',
    messages: [
      "Thanks for the reminder. I'll pay this by Friday.",
      "Will sort this out by end of week, promise.",
      "Got it, will pay on the 25th.",
      "Planning to pay this tomorrow morning.",
      "I can pay this by Monday if that works?",
      "Will transfer the payment on Oct 31st",
    ]
  },
  {
    type: 'payment_plan',
    sentiment: 'neutral',
    messages: [
      "Can I pay £500 now and the rest next month?",
      "Would it be ok to split this into 3 payments?",
      "I can only afford £1000 per week right now.",
      "Can we work out a payment plan? Bit tight this month.",
      "Is it possible to pay half now, half in 30 days?",
    ]
  },
  {
    type: 'dispute',
    sentiment: 'negative',
    messages: [
      "I don't think this invoice is correct. We agreed on a different amount.",
      "We returned those goods weeks ago, why am I still being charged?",
      "This doesn't match our PO, please check your records.",
      "I've already paid this! Check your system.",
      "The service wasn't delivered as promised, I'm disputing this charge.",
    ]
  },
  {
    type: 'general_query',
    sentiment: 'neutral',
    messages: [
      "Can you send me a copy of the invoice again?",
      "What payment methods do you accept?",
      "Which account should I transfer to?",
      "Can I get a statement of my account?",
      "Who do I speak to about this invoice?",
    ]
  },
  {
    type: 'positive',
    sentiment: 'positive',
    messages: [
      "All sorted, payment sent!",
      "Just transferred it now, thanks.",
      "Paid in full via bank transfer.",
      "Done! You should see it tomorrow.",
      "Payment processed, thanks for the reminder.",
    ]
  },
  {
    type: 'negative',
    sentiment: 'negative',
    messages: [
      "Can't pay right now, business is really slow.",
      "I'm having cash flow issues, need more time.",
      "Not able to pay this month, sorry.",
      "Still waiting on my own invoices to be paid.",
      "Stop harassing me, I'll pay when I can!",
    ]
  },
];

const EMAIL_RESPONSES: MockResponseVariation[] = [
  {
    type: 'promise_to_pay',
    sentiment: 'positive',
    messages: [
      "Hi,\n\nThank you for your email. I can confirm that payment will be made by the end of this week.\n\nBest regards",
      "Hello,\n\nApologies for the delay. I'll process the payment by Friday 25th October.\n\nThanks",
      "Hi there,\n\nJust to let you know I'll be paying this invoice on Monday morning.\n\nKind regards",
      "Good afternoon,\n\nPayment will be sent via bank transfer by October 31st.\n\nMany thanks",
    ]
  },
  {
    type: 'payment_plan',
    sentiment: 'neutral',
    messages: [
      "Hi,\n\nI'm experiencing some cash flow issues at the moment. Would it be possible to pay £2,000 now and the remaining balance over the next two months?\n\nPlease let me know if this is acceptable.\n\nBest regards",
      "Hello,\n\nDue to some unexpected expenses, I'd like to propose splitting this payment into three instalments. Can we arrange this?\n\nThank you",
      "Hi there,\n\nI can pay 50% immediately and the remaining 50% in 30 days. Would this work for you?\n\nKind regards",
    ]
  },
  {
    type: 'dispute',
    sentiment: 'negative',
    messages: [
      "Hi,\n\nI'm writing to dispute this invoice. The amount charged doesn't match our original agreement of £10,000. Please review and issue a corrected invoice.\n\nBest regards",
      "Hello,\n\nWe returned the goods on 15th September due to quality issues. This invoice should have been credited. Please investigate and confirm.\n\nThanks",
      "Good morning,\n\nThis invoice appears to be a duplicate. I have records showing payment was made on 5th October. Please check your accounts and confirm.\n\nRegards",
    ]
  },
  {
    type: 'general_query',
    sentiment: 'neutral',
    messages: [
      "Hi,\n\nCould you please send me the full invoice details? I don't seem to have it in my records.\n\nThank you",
      "Hello,\n\nWhat are your bank details for payment? I need to set up the transfer.\n\nBest regards",
      "Hi,\n\nCan you provide a statement showing all outstanding invoices for my account?\n\nKind regards",
    ]
  },
];

const VOICE_TRANSCRIPTS: MockResponseVariation[] = [
  {
    type: 'promise_to_pay',
    sentiment: 'positive',
    messages: [
      "Agent: Hello, this is regarding invoice INV-2024-001.\nCustomer: Oh yes, sorry about that. I've been meaning to pay it. I'll definitely get that sorted by the end of this week.\nAgent: Great, thank you.\nCustomer: No problem, I'll pay on Friday.",
      "Agent: Hi, I'm calling about your outstanding invoice.\nCustomer: Right, yes. I can pay that on Monday if that's okay?\nAgent: That would be perfect.\nCustomer: Okay, I'll make sure it's done Monday morning. Thanks for calling.",
    ]
  },
  {
    type: 'payment_plan',
    sentiment: 'neutral',
    messages: [
      "Agent: Hello, I'm calling regarding your overdue invoice.\nCustomer: Yes, I've been meaning to call you actually. Things are a bit tight right now. Could I possibly pay £1000 now and then spread the rest over the next couple of months?\nAgent: I can certainly discuss that with our finance team.\nCustomer: That would really help me out. I definitely want to pay, just need a bit of flexibility.",
    ]
  },
  {
    type: 'dispute',
    sentiment: 'negative',
    messages: [
      "Agent: I'm calling about invoice INV-2024-001.\nCustomer: Hold on, I think there's a mistake with that invoice. The amount is wrong - we agreed on £8,000, not £10,000.\nAgent: I understand, let me look into that for you.\nCustomer: Please do, because I'm not paying the incorrect amount.",
    ]
  },
];

class MockResponderService {
  /**
   * Generate a random mock response for SMS
   */
  private getRandomSMSResponse(): { message: string; type: string; sentiment: string } {
    const category = SMS_RESPONSES[Math.floor(Math.random() * SMS_RESPONSES.length)];
    const message = category.messages[Math.floor(Math.random() * category.messages.length)];
    return { message, type: category.type, sentiment: category.sentiment };
  }

  /**
   * Generate a random mock response for email
   */
  private getRandomEmailResponse(): { message: string; type: string; sentiment: string } {
    const category = EMAIL_RESPONSES[Math.floor(Math.random() * EMAIL_RESPONSES.length)];
    const message = category.messages[Math.floor(Math.random() * category.messages.length)];
    return { message, type: category.type, sentiment: category.sentiment };
  }

  /**
   * Generate a random mock voice transcript
   */
  private getRandomVoiceTranscript(): { transcript: string; type: string; sentiment: string } {
    const category = VOICE_TRANSCRIPTS[Math.floor(Math.random() * VOICE_TRANSCRIPTS.length)];
    const transcript = category.messages[Math.floor(Math.random() * category.messages.length)];
    return { transcript, type: category.type, sentiment: category.sentiment };
  }

  /**
   * Simulate SMS response - posts to Vonage webhook
   */
  async simulateSMSResponse(params: {
    fromNumber: string;
    toNumber: string;
    invoiceId: string;
    customerId: string;
    delayMs?: number;
  }): Promise<void> {
    if (!demoModeService.isEnabled()) {
      console.log('Demo mode disabled, skipping SMS simulation');
      return;
    }

    const { message, type, sentiment } = this.getRandomSMSResponse();
    const delay = params.delayMs || this.getRandomDelay();

    setTimeout(async () => {
      try {
        const webhookPayload = {
          message_uuid: this.generateUUID(),
          from: params.fromNumber,
          to: params.toNumber,
          text: message,
          timestamp: new Date().toISOString(),
          type: 'text',
          // Metadata for our intent analyzer
          _mock: true,
          _type: type,
          _sentiment: sentiment,
        };

        // Post to our Vonage SMS webhook
        const response = await fetch('http://localhost:5000/api/webhooks/vonage/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });

        if (response.ok) {
          console.log(`✅ Mock SMS response simulated (${type}):`, message.substring(0, 50));
        } else {
          console.error('Failed to post mock SMS:', await response.text());
        }
      } catch (error) {
        console.error('Error simulating SMS response:', error);
      }
    }, delay);
  }

  /**
   * Simulate email response - posts to SendGrid webhook
   */
  async simulateEmailResponse(params: {
    fromEmail: string;
    toEmail: string;
    invoiceId: string;
    customerId: string;
    delayMs?: number;
  }): Promise<void> {
    if (!demoModeService.isEnabled()) {
      console.log('Demo mode disabled, skipping email simulation');
      return;
    }

    const { message, type, sentiment } = this.getRandomEmailResponse();
    const delay = params.delayMs || this.getRandomDelay();

    setTimeout(async () => {
      try {
        const webhookPayload = {
          headers: {
            From: params.fromEmail,
            To: params.toEmail,
            Subject: `Re: Invoice Payment Reminder`,
          },
          text: message,
          html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
          from: params.fromEmail,
          to: params.toEmail,
          subject: `Re: Invoice Payment Reminder`,
          // Metadata for our intent analyzer
          _mock: true,
          _type: type,
          _sentiment: sentiment,
        };

        // Post to our SendGrid inbound webhook
        const response = await fetch('http://localhost:5000/api/webhooks/sendgrid/inbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });

        if (response.ok) {
          console.log(`✅ Mock email response simulated (${type}):`, message.substring(0, 50));
        } else {
          console.error('Failed to post mock email:', await response.text());
        }
      } catch (error) {
        console.error('Error simulating email response:', error);
      }
    }, delay);
  }

  /**
   * Simulate voice call response - posts to Retell webhook
   */
  async simulateVoiceResponse(params: {
    callId: string;
    invoiceId: string;
    customerId: string;
    customerPhone: string;
    delayMs?: number;
  }): Promise<void> {
    if (!demoModeService.isEnabled()) {
      console.log('Demo mode disabled, skipping voice simulation');
      return;
    }

    const { transcript, type, sentiment } = this.getRandomVoiceTranscript();
    const delay = params.delayMs || this.getRandomDelay();

    setTimeout(async () => {
      try {
        const webhookPayload = {
          call_id: params.callId,
          transcript: transcript,
          call_analysis: {
            call_successful: true,
            call_summary: `Customer ${type.replace('_', ' ')} - ${sentiment} sentiment`,
            user_sentiment: sentiment,
          },
          // Metadata for our intent analyzer
          _mock: true,
          _type: type,
          _sentiment: sentiment,
        };

        // Post to our Retell transcript webhook
        const response = await fetch('http://localhost:5000/api/webhooks/retell/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });

        if (response.ok) {
          console.log(`✅ Mock voice response simulated (${type}):`, transcript.substring(0, 50));
        } else {
          console.error('Failed to post mock voice transcript:', await response.text());
        }
      } catch (error) {
        console.error('Error simulating voice response:', error);
      }
    }, delay);
  }

  /**
   * Generate random delay between 3-10 seconds to simulate human response time
   */
  private getRandomDelay(): number {
    return Math.floor(Math.random() * 7000) + 3000; // 3-10 seconds
  }

  /**
   * Generate UUID for mock data
   */
  private generateUUID(): string {
    return 'mock-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

export const mockResponderService = new MockResponderService();
