import { db } from '../server/db';
import { contacts, invoices, actions, inboundMessages, paymentPromises, customerLearningProfiles } from '../shared/schema';
import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';

const LEARNING_DEMO_TENANT_ID = 'db071cd0-9ed0-47c5-b6b8-68587a54d21a';
const DEMO_PHONE = '+447716273336';
const DEMO_USER_ID = 'demo-user-47061483'; // System user for demo

// Behavioral profile definitions
interface BehavioralProfile {
  name: string;
  ptpKeptRate: number; // 0-1
  sentimentDriftPerMonth: number; // -0.1 to +0.1
  disputeRate: number; // 0-1
  avgSlipDays: { min: number; max: number };
  learningConfidence: number; // 0-1
  channelEffectiveness: { email: number; sms: number; voice: number };
  deteriorationRate?: number; // For deteriorating profile (monthly decline)
  isUnpredictable?: boolean; // For unpredictable_late profile
}

const PROFILES: Record<string, BehavioralProfile> = {
  reliable: {
    name: 'Reliable',
    ptpKeptRate: 0.9,
    sentimentDriftPerMonth: 0.02,
    disputeRate: 0.02,
    avgSlipDays: { min: 1, max: 3 },
    learningConfidence: 0.85,
    channelEffectiveness: { email: 0.8, sms: 0.7, voice: 0.9 },
  },
  serial_promiser: {
    name: 'Serial Promiser',
    ptpKeptRate: 0.3,
    sentimentDriftPerMonth: -0.05,
    disputeRate: 0.05,
    avgSlipDays: { min: 7, max: 14 },
    learningConfidence: 0.75,
    channelEffectiveness: { email: 0.4, sms: 0.5, voice: 0.6 },
  },
  predictable_late: {
    name: 'Predictable Late',
    ptpKeptRate: 0.7,
    sentimentDriftPerMonth: 0,
    disputeRate: 0.03,
    avgSlipDays: { min: 7, max: 10 },
    learningConfidence: 0.8,
    channelEffectiveness: { email: 0.7, sms: 0.6, voice: 0.7 },
  },
  disputer: {
    name: 'Disputer',
    ptpKeptRate: 0.5,
    sentimentDriftPerMonth: -0.03,
    disputeRate: 0.2,
    avgSlipDays: { min: 3, max: 5 },
    learningConfidence: 0.65,
    channelEffectiveness: { email: 0.5, sms: 0.4, voice: 0.7 },
  },
  deteriorating: {
    name: 'Deteriorating',
    ptpKeptRate: 0.8, // Starts high
    sentimentDriftPerMonth: -0.1,
    disputeRate: 0.1,
    avgSlipDays: { min: 10, max: 20 },
    learningConfidence: 0.7,
    channelEffectiveness: { email: 0.6, sms: 0.5, voice: 0.6 },
    deteriorationRate: 0.05, // 5% decline per month in PTP kept rate
  },
  unpredictable_late: {
    name: 'Unpredictable Late',
    ptpKeptRate: 0.5,
    sentimentDriftPerMonth: 0,
    disputeRate: 0.08,
    avgSlipDays: { min: 2, max: 60 },
    learningConfidence: 0.3, // Low confidence due to randomness
    channelEffectiveness: { email: 0.5, sms: 0.5, voice: 0.5 },
    isUnpredictable: true,
  },
};

// Helper functions
function randomAmount(min: number = 500, max: number = 25000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateInvoiceNumber(): string {
  return `INV-${faker.string.numeric(6)}`;
}

function getSentimentScore(profile: BehavioralProfile, monthsAgo: number): number {
  const baseSentiment = profile.ptpKeptRate > 0.7 ? 0.6 : profile.ptpKeptRate > 0.4 ? 0 : -0.4;
  const drift = profile.sentimentDriftPerMonth * (12 - monthsAgo);
  return Math.max(-1, Math.min(1, baseSentiment + drift + (Math.random() * 0.2 - 0.1)));
}

function getMessageTemplate(profile: BehavioralProfile, sentiment: number, isDispute: boolean = false): string {
  if (isDispute) {
    return faker.helpers.arrayElement([
      "This invoice is incorrect, we didn't receive these items",
      "We've already paid this invoice, please check your records",
      "The amount charged is wrong, should be less",
      "We dispute these charges, quality was poor",
    ]);
  }

  if (profile.name === 'Reliable') {
    return faker.helpers.arrayElement([
      "Payment sent today as promised, thank you",
      "Paid in full, thanks for the reminder",
      "All settled now, appreciate your patience",
    ]);
  }

  if (profile.name === 'Serial Promiser') {
    return faker.helpers.arrayElement([
      "We'll definitely pay by Friday",
      "Payment will be sent next week for sure",
      "I promise we'll pay by end of month",
      "Will transfer it tomorrow, I promise",
    ]);
  }

  if (profile.name === 'Predictable Late') {
    return faker.helpers.arrayElement([
      "We always pay by the 10th of the following month",
      "Our payment run is on the 15th, you'll get it then",
      "Payment scheduled for next week as usual",
    ]);
  }

  if (profile.name === 'Deteriorating') {
    if (sentiment > 0) {
      return "Will pay this week, no problem";
    } else {
      return faker.helpers.arrayElement([
        "Having cash flow issues, need more time",
        "Can't pay right now, business is struggling",
        "Not sure when we can pay this",
      ]);
    }
  }

  return faker.helpers.arrayElement([
    "Will get this sorted soon",
    "Payment coming shortly",
    "We're working on it",
  ]);
}

function getIntentType(isDispute: boolean, isPromise: boolean): string {
  if (isDispute) return 'dispute';
  if (isPromise) return 'promise_to_pay';
  return faker.helpers.arrayElement(['general_query', 'payment_plan', 'general_query']);
}

function getSentimentCategory(score: number): string {
  if (score > 0.2) return 'positive';
  if (score < -0.2) return 'negative';
  return 'neutral';
}

async function seedData() {
  console.log('🚀 Starting LearningDemo Data Seeding...\n');
  
  const startTime = Date.now();
  let totalCustomers = 0;
  let totalInvoices = 0;
  let totalCommunications = 0;
  let totalPromises = 0;
  let totalProfiles = 0;

  // Generate customers for each profile
  for (const [profileKey, profile] of Object.entries(PROFILES)) {
    console.log(`\n📊 Generating ${profile.name} customers (40)...`);
    
    for (let i = 0; i < 40; i++) {
      const companyName = faker.company.name();
      const contactEmail = faker.internet.email().toLowerCase();
      
      // Create contact
      const [contact] = await db.insert(contacts).values({
        tenantId: LEARNING_DEMO_TENANT_ID,
        name: faker.person.fullName(),
        email: contactEmail,
        phone: DEMO_PHONE,
        companyName,
        role: 'customer',
        isActive: true,
        paymentTerms: 30,
      }).returning();
      
      totalCustomers++;

      // Generate 15-30 invoices over 12 months
      const numInvoices = Math.floor(Math.random() * 16) + 15;
      const now = new Date();
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(now.getMonth() - 12);

      for (let inv = 0; inv < numInvoices; inv++) {
        const monthsAgo = Math.floor((inv / numInvoices) * 12);
        const issueDate = new Date(now);
        issueDate.setMonth(now.getMonth() - (12 - monthsAgo));
        
        const dueDate = new Date(issueDate);
        dueDate.setDate(issueDate.getDate() + 30);
        
        const amount = randomAmount();
        
        // Determine if paid based on profile
        const isPaid = Math.random() < (profile.ptpKeptRate - (profile.deteriorationRate || 0) * monthsAgo);
        const slipDays = profile.isUnpredictable 
          ? Math.floor(Math.random() * (profile.avgSlipDays.max - profile.avgSlipDays.min + 1)) + profile.avgSlipDays.min
          : Math.floor(Math.random() * (profile.avgSlipDays.max - profile.avgSlipDays.min + 1)) + profile.avgSlipDays.min;
        
        const paidDate = isPaid ? new Date(dueDate.getTime() + slipDays * 24 * 60 * 60 * 1000) : null;
        const status = isPaid ? 'paid' : (dueDate < now ? 'overdue' : 'pending');
        
        const [invoice] = await db.insert(invoices).values({
          tenantId: LEARNING_DEMO_TENANT_ID,
          contactId: contact.id,
          invoiceNumber: generateInvoiceNumber(),
          amount: amount.toString(),
          amountPaid: isPaid ? amount.toString() : '0',
          status,
          issueDate,
          dueDate,
          paidDate,
          currency: 'GBP',
        }).returning();
        
        totalInvoices++;

        // Generate 5-10 communications per invoice (batch for performance)
        const numComms = Math.floor(Math.random() * 6) + 5;
        const isDisputed = Math.random() < profile.disputeRate;
        
        const inboundBatch: any[] = [];
        const outboundBatch: any[] = [];
        const inboundActionBatch: any[] = [];
        
        for (let comm = 0; comm < numComms; comm++) {
          const commDate = randomDate(issueDate, paidDate || now);
          const channel = faker.helpers.arrayElement(['email', 'sms', 'voice']);
          const isInbound = Math.random() < 0.4;
          const sentiment = getSentimentScore(profile, monthsAgo);
          const isPromise = !isDisputed && Math.random() < 0.3;
          
          if (isInbound) {
            const content = getMessageTemplate(profile, sentiment, isDisputed);
            const intentType = getIntentType(isDisputed, isPromise);
            const confidence = (Math.random() * 0.4 + 0.6).toFixed(2);
            const sentimentCategory = getSentimentCategory(sentiment);
            const promisedDate = isPromise ? new Date(commDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
            
            inboundBatch.push({
              tenantId: LEARNING_DEMO_TENANT_ID,
              contactId: contact.id,
              invoiceId: invoice.id,
              channel,
              from: channel === 'email' ? contactEmail : DEMO_PHONE,
              to: channel === 'email' ? 'collections@nexusar.com' : '+447418317011',
              subject: channel === 'email' ? `Re: Invoice ${invoice.invoiceNumber}` : null,
              content,
              intentAnalyzed: true,
              intentType,
              intentConfidence: confidence,
              sentiment: sentimentCategory,
              extractedEntities: promisedDate ? {
                promisedDate: promisedDate.toISOString(),
                promisedAmount: amount,
              } : null,
            });
            
            // Create corresponding action record for Intent Analyst system
            inboundActionBatch.push({
              tenantId: LEARNING_DEMO_TENANT_ID,
              contactId: contact.id,
              invoiceId: invoice.id,
              type: 'inbound_analyzed' as const,
              actionType: intentType === 'promise_to_pay' ? 'promise_to_pay' : (intentType === 'dispute' ? 'dispute' : 'follow_up'),
              intentType,
              status: 'open' as const,
              priority: intentType === 'dispute' ? 'high' : (intentType === 'promise_to_pay' ? 'medium' : 'low'),
              subject: channel === 'email' ? `Re: Invoice ${invoice.invoiceNumber}` : `${intentType} via ${channel}`,
              content,
              metadata: {
                analysis: {
                  intent: intentType,
                  confidence: parseFloat(confidence),
                  sentiment: sentimentCategory,
                  entities: {
                    dates: promisedDate ? [promisedDate.toISOString()] : [],
                    amounts: promisedDate ? [amount] : [],
                  },
                },
                channel,
                source: 'inbound_message',
              },
              source: 'inbound' as const,
              createdAt: commDate,
            });
            
            totalCommunications++;
          } else {
            outboundBatch.push({
              tenantId: LEARNING_DEMO_TENANT_ID,
              contactId: contact.id,
              invoiceId: invoice.id,
              type: channel,
              status: 'completed' as const,
              subject: `Payment reminder: Invoice ${invoice.invoiceNumber}`,
              content: `Dear ${contact.name}, this is a reminder that invoice ${invoice.invoiceNumber} for £${amount} is due.`,
              scheduledFor: commDate,
              completedAt: commDate,
              source: 'automated' as const,
              createdAt: commDate,
            });
            
            totalCommunications++;
          }
        }
        
        // Batch insert messages and actions
        if (inboundBatch.length > 0) await db.insert(inboundMessages).values(inboundBatch);
        if (inboundActionBatch.length > 0) await db.insert(actions).values(inboundActionBatch);
        if (outboundBatch.length > 0) await db.insert(actions).values(outboundBatch);

        // Generate promises for this invoice (batch)
        if (!isDisputed && Math.random() < 0.6) {
          const numPromises = profile.name === 'Serial Promiser' ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 2) + 1;
          const promiseBatch: any[] = [];
          
          for (let p = 0; p < numPromises; p++) {
            const promiseDate = randomDate(dueDate, paidDate || now);
            const promisedPaymentDate = new Date(promiseDate);
            promisedPaymentDate.setDate(promiseDate.getDate() + 7);
            
            // CRITICAL FIX: Clamp keptRate to [0, 1] to prevent negative values
            const keptRate = Math.max(0, Math.min(1, profile.ptpKeptRate - (profile.deteriorationRate || 0) * monthsAgo));
            const wasKept = Math.random() < keptRate;
            
            // CRITICAL FIX: Promise status logic - only mark as 'open' if promised date is in future AND invoice unpaid
            const isPromiseFuture = promisedPaymentDate > now;
            const promiseStatus = isPromiseFuture && !paidDate ? 'open' : (wasKept ? 'kept' : 'broken');
            
            promiseBatch.push({
              tenantId: LEARNING_DEMO_TENANT_ID,
              contactId: contact.id,
              invoiceId: invoice.id,
              promiseType: 'payment_date' as const,
              promisedDate: promisedPaymentDate,
              promisedAmount: amount.toString(),
              sourceType: 'inbound_message' as const,
              channel: faker.helpers.arrayElement(['email', 'sms', 'voice']),
              status: promiseStatus as any,
              actualPaymentDate: wasKept && !isPromiseFuture ? paidDate : null,
              actualPaymentAmount: wasKept && !isPromiseFuture ? amount.toString() : null,
              daysLate: wasKept && !isPromiseFuture && paidDate ? Math.floor((paidDate.getTime() - promisedPaymentDate.getTime()) / (24 * 60 * 60 * 1000)) : null,
              isSerialPromise: p >= 2,
              promiseSequence: p + 1,
              createdByUserId: DEMO_USER_ID,
              createdAt: promiseDate,
            });
            
            totalPromises++;
          }
          
          if (promiseBatch.length > 0) await db.insert(paymentPromises).values(promiseBatch);
        }
      }

      // CRITICAL FIX: Calculate learning profile using actual generated data
      const allPromises = await db.select().from(paymentPromises).where(eq(paymentPromises.contactId, contact.id));
      const allMessages = await db.select().from(inboundMessages).where(eq(inboundMessages.contactId, contact.id));
      const allActions = await db.select().from(actions).where(eq(actions.contactId, contact.id));
      const allInvoices = await db.select().from(invoices).where(eq(invoices.contactId, contact.id));
      
      // Calculate promise metrics from actual data
      const promisesKept = allPromises.filter(p => p.status === 'kept').length;
      const promisesBroken = allPromises.filter(p => p.status === 'broken').length;
      const totalPromisesMade = allPromises.length;
      const prs = totalPromisesMade > 0 ? (promisesKept / totalPromisesMade) * 100 : null;
      
      // Calculate channel effectiveness from actual promise outcomes per channel
      const emailPromises = allPromises.filter(p => p.channel === 'email');
      const smsPromises = allPromises.filter(p => p.channel === 'sms');
      const voicePromises = allPromises.filter(p => p.channel === 'voice');
      
      const emailEffectiveness = emailPromises.length > 0 
        ? emailPromises.filter(p => p.status === 'kept').length / emailPromises.length 
        : 0.5;
      const smsEffectiveness = smsPromises.length > 0 
        ? smsPromises.filter(p => p.status === 'kept').length / smsPromises.length 
        : 0.5;
      const voiceEffectiveness = voicePromises.length > 0 
        ? voicePromises.filter(p => p.status === 'kept').length / voicePromises.length 
        : 0.5;
      
      // Calculate payment reliability from actual invoice payment data
      const paidInvoices = allInvoices.filter(inv => inv.status === 'paid');
      const paymentReliability = allInvoices.length > 0 
        ? paidInvoices.length / allInvoices.length 
        : 0;
      
      // Calculate average payment delay from actual paid invoices
      const paymentDelays = paidInvoices
        .filter(inv => inv.paidDate && inv.dueDate)
        .map(inv => {
          const dueTime = inv.dueDate!.getTime();
          const paidTime = inv.paidDate!.getTime();
          return Math.floor((paidTime - dueTime) / (24 * 60 * 60 * 1000));
        });
      const averagePaymentDelay = paymentDelays.length > 0 
        ? Math.floor(paymentDelays.reduce((sum, d) => sum + d, 0) / paymentDelays.length)
        : 0;
      
      // Calculate channel usage for preferred channel
      const emailMessages = allMessages.filter(m => m.channel === 'email').length;
      const smsMessages = allMessages.filter(m => m.channel === 'sms').length;
      const voiceMessages = allMessages.filter(m => m.channel === 'voice').length;
      const totalMessages = emailMessages + smsMessages + voiceMessages;
      
      // Use generated data for interactions
      const totalInteractions = allMessages.length + allActions.length;
      const successfulActions = allPromises.filter(p => p.status === 'kept').length;
      
      await db.insert(customerLearningProfiles).values({
        tenantId: LEARNING_DEMO_TENANT_ID,
        contactId: contact.id,
        emailEffectiveness: emailEffectiveness.toFixed(2),
        smsEffectiveness: smsEffectiveness.toFixed(2),
        voiceEffectiveness: voiceEffectiveness.toFixed(2),
        totalInteractions,
        successfulActions,
        averageResponseTime: Math.floor(Math.random() * 48) + 2,
        preferredChannel: totalMessages > 0 
          ? (emailMessages > smsMessages && emailMessages > voiceMessages ? 'email' 
             : smsMessages > voiceMessages ? 'sms' : 'voice')
          : 'email',
        preferredContactTime: faker.helpers.arrayElement(['morning', 'afternoon', 'evening']),
        averagePaymentDelay,
        paymentReliability: paymentReliability.toFixed(2),
        learningConfidence: profile.learningConfidence.toFixed(2),
        totalPromisesMade,
        promisesKept,
        promisesBroken,
        promisesPartiallyKept: 0,
        promiseReliabilityScore: prs ? prs.toFixed(2) : null,
        prsLast30Days: prs ? (prs + (Math.random() * 10 - 5)).toFixed(2) : null,
        prsLast90Days: prs ? prs.toFixed(2) : null,
        prsLast12Months: prs ? prs.toFixed(2) : null,
        isSerialPromiser: profile.name === 'Serial Promiser',
        isReliableLatePayer: profile.name === 'Predictable Late',
        isRelationshipDeteriorating: profile.name === 'Deteriorating',
        isNewCustomer: false,
      });
      
      totalProfiles++;
    }
    
    console.log(`✅ ${profile.name}: 40 customers created`);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 SEEDING COMPLETE!');
  console.log('='.repeat(60));
  console.log(`✅ Seeded ${totalCustomers} customers`);
  console.log(`✅ Generated ${totalInvoices} invoices`);
  console.log(`✅ Created ${totalCommunications} messages`);
  console.log(`✅ Recorded ${totalPromises} Promise-to-Pay events`);
  console.log(`✅ Built ${totalProfiles} learning profiles`);
  console.log(`⏱️  Completed in ${duration} seconds`);
  console.log('='.repeat(60));
  console.log('\n📊 Behavioral Profile Distribution:');
  Object.values(PROFILES).forEach(p => {
    console.log(`   ${p.name}: 40 customers`);
  });
  console.log('\n🎯 All data isolated to LearningDemo tenant');
  console.log('📱 All customers use demo phone: +447716273336\n');
}

// Run the seeder
seedData()
  .then(() => {
    console.log('✨ Seeding process completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
