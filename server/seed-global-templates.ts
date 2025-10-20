import { db } from './db';
import { globalTemplates } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Seed Global Templates - Sprint 3
 * 
 * Seeds the 6 curated global templates for the investor demo:
 * 1. Friendly nudge
 * 2. PTP today?
 * 3. High-value escalate
 * 4. Dispute receipt
 * 5. Promise broken
 * 6. Final notice
 */

const GLOBAL_TEMPLATES = [
  {
    code: 'friendly_nudge',
    channel: 'email',
    tone: 'friendly',
    locale: 'en-GB',
    version: '1.0.0',
    subject: 'Friendly payment reminder - Invoice {{invoice_number}}',
    body: `Hi {{first_name}},

I hope this email finds you well. I wanted to reach out regarding Invoice {{invoice_number}} for £{{invoice_total}}, which was due on {{due_date}}.

I understand that things can get busy, and payments can sometimes slip through the cracks. If you've already sent payment, please disregard this message and accept my thanks!

If not, could you kindly arrange payment in the next few days? You can pay securely online here:
{{wallet_url}}

If there's any issue with the invoice or you'd like to discuss payment arrangements, I'm here to help. Just reply to this email or give me a call.

Thanks for your business!

Best regards,
{{sender_name}}
{{company_name}}`,
    requiredVars: ['first_name', 'invoice_number', 'invoice_total', 'due_date', 'wallet_url', 'sender_name', 'company_name'],
    complianceFlags: [],
    status: 'active',
  },
  {
    code: 'ptp_today',
    channel: 'sms',
    tone: 'friendly',
    locale: 'en-GB',
    version: '1.0.0',
    subject: null,
    body: `Hi {{first_name}}, this is {{sender_name}} from {{company_name}}. Can you confirm when you'll be able to pay Invoice {{invoice_number}} (£{{invoice_total}})? Reply with a date or call me on {{sender_phone}}. Thanks!`,
    requiredVars: ['first_name', 'sender_name', 'company_name', 'invoice_number', 'invoice_total', 'sender_phone'],
    complianceFlags: [],
    status: 'active',
  },
  {
    code: 'high_value_escalate',
    channel: 'email',
    tone: 'firm',
    locale: 'en-GB',
    version: '1.0.0',
    subject: 'Urgent: Outstanding payment required - Invoice {{invoice_number}}',
    body: `Dear {{first_name}},

This is an urgent notice regarding Invoice {{invoice_number}} for £{{invoice_total}}, which is now {{days_overdue}} days overdue.

Despite previous reminders, payment has not been received. We need to resolve this matter as a priority to maintain our business relationship.

Please arrange immediate payment via:
{{wallet_url}}

If there are any issues preventing payment, or if you need to discuss a payment plan, please contact me directly by {{urgency_date}} to avoid further escalation.

This account requires immediate attention.

Regards,
{{sender_name}}
{{job_title}}
{{company_name}}
{{sender_phone}}`,
    requiredVars: ['first_name', 'invoice_number', 'invoice_total', 'days_overdue', 'wallet_url', 'urgency_date', 'sender_name', 'job_title', 'company_name', 'sender_phone'],
    complianceFlags: ['high_value', 'escalation'],
    status: 'active',
  },
  {
    code: 'dispute_receipt',
    channel: 'email',
    tone: 'friendly',
    locale: 'en-GB',
    version: '1.0.0',
    subject: 'Dispute received - Invoice {{invoice_number}}',
    body: `Hi {{first_name}},

Thank you for getting in touch regarding Invoice {{invoice_number}}.

I've received your query about {{dispute_summary}}, and I want to help resolve this quickly.

I'm looking into this now and will get back to you within {{response_timeframe}} with a full response. In the meantime, if you have any additional information or documents that might help, please send them through.

Your reference number for this query is: {{dispute_ref}}

I appreciate your patience while we work this out.

Best regards,
{{sender_name}}
{{company_name}}
{{sender_phone}} | {{sender_email}}`,
    requiredVars: ['first_name', 'invoice_number', 'dispute_summary', 'response_timeframe', 'dispute_ref', 'sender_name', 'company_name', 'sender_phone', 'sender_email'],
    complianceFlags: ['dispute_handling'],
    status: 'active',
  },
  {
    code: 'promise_broken',
    channel: 'email',
    tone: 'firm',
    locale: 'en-GB',
    version: '1.0.0',
    subject: 'Payment commitment not received - Invoice {{invoice_number}}',
    body: `Dear {{first_name}},

I'm following up on your commitment to pay Invoice {{invoice_number}} (£{{invoice_total}}) by {{ptp_date}}.

Unfortunately, we have not received payment as agreed. This is concerning as we arranged this payment date specifically to accommodate your circumstances.

I need to understand what has prevented you from making this payment:

• Has something changed in your situation?
• Do you need to revise the payment arrangement?
• Is there an issue with the invoice?

Please contact me urgently by {{contact_deadline}} to discuss this. You can:
- Pay now: {{wallet_url}}
- Call me: {{sender_phone}}
- Reply to this email

Without hearing from you, I will have no choice but to escalate this matter to our collections team.

I hope we can resolve this quickly.

Regards,
{{sender_name}}
{{company_name}}`,
    requiredVars: ['first_name', 'invoice_number', 'invoice_total', 'ptp_date', 'contact_deadline', 'wallet_url', 'sender_phone', 'sender_name', 'company_name'],
    complianceFlags: ['broken_promise', 'escalation_warning'],
    status: 'active',
  },
  {
    code: 'final_notice',
    channel: 'email',
    tone: 'legal',
    locale: 'en-GB',
    version: '1.0.0',
    subject: 'FINAL NOTICE - Invoice {{invoice_number}} - Action required within 7 days',
    body: `FINAL NOTICE BEFORE LEGAL ACTION

Dear {{first_name}},

Re: Invoice {{invoice_number}} - £{{invoice_total}}
Amount outstanding: £{{total_outstanding_with_interest}}
(Including interest of £{{interest_amount}} as of {{interest_calc_date}})

Despite multiple attempts to contact you, Invoice {{invoice_number}} dated {{invoice_date}} remains unpaid, now {{days_overdue}} days overdue.

IMMEDIATE ACTION REQUIRED

You have 7 days from the date of this letter to pay the full outstanding balance of £{{total_outstanding_with_interest}}.

Payment must be received by: {{final_deadline_date}}

Pay immediately: {{wallet_url}}

CONSEQUENCES OF NON-PAYMENT

If payment is not received by the deadline above, we will have no alternative but to:

1. Instruct debt collection agents
2. Report this debt to credit reference agencies
3. Commence legal proceedings to recover the debt plus interest and costs
4. Add your details to our internal credit blacklist

This will affect your credit rating and may result in additional costs.

DISPUTE OR PAYMENT DIFFICULTY

If you dispute this invoice or are experiencing genuine financial difficulty, you must contact us immediately on {{sender_phone}} or reply to this email before {{final_deadline_date}}.

This is your final opportunity to resolve this matter without further action.

Yours sincerely,

{{sender_name}}
{{job_title}}
{{company_name}}

{{company_address}}
Tel: {{sender_phone}}
Email: {{sender_email}}

Company Registration: {{company_reg_number}}`,
    requiredVars: [
      'first_name',
      'invoice_number',
      'invoice_total',
      'total_outstanding_with_interest',
      'interest_amount',
      'interest_calc_date',
      'invoice_date',
      'days_overdue',
      'final_deadline_date',
      'wallet_url',
      'sender_phone',
      'sender_email',
      'sender_name',
      'job_title',
      'company_name',
      'company_address',
      'company_reg_number',
    ],
    complianceFlags: ['final_notice', 'legal_ready', 'requires_approval'],
    status: 'active',
  },
];

/**
 * Seed or update global templates
 */
export async function seedGlobalTemplates() {
  console.log('🌱 Seeding global templates...');

  try {
    for (const template of GLOBAL_TEMPLATES) {
      // Check if template with this code already exists
      const existing = await db
        .select()
        .from(globalTemplates)
        .where(eq(globalTemplates.code, template.code))
        .limit(1);

      if (existing.length > 0) {
        // Update existing template
        await db
          .update(globalTemplates)
          .set({
            ...template,
            updatedAt: new Date(),
          })
          .where(eq(globalTemplates.code, template.code));
        
        console.log(`  ✅ Updated: ${template.code} (${template.channel})`);
      } else {
        // Insert new template
        await db.insert(globalTemplates).values(template);
        console.log(`  ✨ Created: ${template.code} (${template.channel})`);
      }
    }

    console.log(`\n✅ Successfully seeded ${GLOBAL_TEMPLATES.length} global templates`);
    
    // Return summary
    return {
      success: true,
      count: GLOBAL_TEMPLATES.length,
      templates: GLOBAL_TEMPLATES.map(t => ({ code: t.code, channel: t.channel, tone: t.tone })),
    };
  } catch (error) {
    console.error('❌ Error seeding global templates:', error);
    throw error;
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  seedGlobalTemplates()
    .then(() => {
      console.log('\n🎉 Global template seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Failed to seed global templates:', error);
      process.exit(1);
    });
}
