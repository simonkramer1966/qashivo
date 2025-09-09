import { storage } from './storage';

// Seed the database with initial AI Facts
export async function seedAiFacts(tenantId: string) {
  try {
    // Check if facts already exist
    const existingFacts = await storage.getAiFacts(tenantId);
    if (existingFacts.length > 0) {
      console.log('🧠 AI Facts already exist, skipping seed');
      return;
    }

    const initialFacts = [
      {
        tenantId,
        category: 'industry_data',
        title: 'Average Days Sales Outstanding (DSO) Benchmarks',
        content: 'Industry benchmarks for Days Sales Outstanding: SaaS/Technology: 30-45 days, Manufacturing: 45-60 days, Construction: 60-90 days, Healthcare: 45-75 days, Professional Services: 30-60 days. DSO above 45 days generally indicates collection efficiency issues that need attention.',
        tags: ['dso', 'benchmarks', 'kpis', 'ar_performance'],
        priority: 9,
        source: 'Industry Research 2024',
        createdBy: 'system'
      },
      {
        tenantId,
        category: 'regulations',
        title: 'Fair Debt Collection Practices Act (FDCPA) Guidelines',
        content: 'Key FDCPA compliance requirements: Cannot call before 8 AM or after 9 PM in consumers timezone. Cannot use deceptive or abusive language. Must cease communication if consumer requests in writing. Third-party collectors cannot discuss debt details with anyone other than the debtor or their attorney. Violations can result in $1,000 fines per violation plus attorney fees.',
        tags: ['fdcpa', 'compliance', 'regulations', 'debt_collection'],
        priority: 10,
        source: 'Federal Trade Commission',
        createdBy: 'system'
      },
      {
        tenantId,
        category: 'best_practices',
        title: 'Collection Call Best Practices',
        content: 'Effective collection call strategies: Start with empathy and understanding. Ask open-ended questions to understand the customer\'s situation. Offer payment plans when full payment is not possible. Document all conversations with detailed notes. Follow up promptly on commitments. Always maintain professional tone even when dealing with difficult customers.',
        tags: ['collection_calls', 'communication', 'best_practices'],
        priority: 8,
        source: 'AR Professional Standards',
        createdBy: 'system'
      },
      {
        tenantId,
        category: 'industry_data',
        title: 'Optimal Collection Contact Frequency',
        content: 'Research shows optimal contact frequency for debt collection: 0-30 days past due: Weekly contact, 31-60 days: Bi-weekly contact, 61-90 days: Weekly contact with escalation, 90+ days: Daily contact or legal action. Over-contacting can lead to customer complaints and legal issues.',
        tags: ['contact_frequency', 'timing', 'best_practices'],
        priority: 7,
        source: 'Collection Industry Research',
        createdBy: 'system'
      },
      {
        tenantId,
        category: 'policies',
        title: 'Payment Plan Guidelines',
        content: 'Standard payment plan policies: Minimum down payment of 10-20% of total balance. Payment plans should not exceed 6 months for balances under $5,000. Require written agreement for all payment arrangements. Set up automatic payment methods when possible. Monitor compliance and have clear consequences for missed payments.',
        tags: ['payment_plans', 'policies', 'ar_management'],
        priority: 8,
        source: 'Company Policy Manual',
        createdBy: 'system'
      },
      {
        tenantId,
        category: 'industry_data', 
        title: 'Email vs Phone Collection Effectiveness',
        content: 'Collection channel effectiveness data: Phone calls have 65% higher response rate than emails for amounts over $500. Email works best for friendly reminders on amounts under $200. Text messages achieve 45% response rate for payment reminders. Multi-channel approach (email + phone + text) increases collection rate by 23%.',
        tags: ['multichannel', 'effectiveness', 'communication_channels'],
        priority: 7,
        source: 'AR Technology Study 2024',
        createdBy: 'system'
      }
    ];

    // Create all facts
    for (const fact of initialFacts) {
      await storage.createAiFact(fact);
    }

    console.log(`🧠 Successfully seeded ${initialFacts.length} AI Facts for tenant ${tenantId}`);
  } catch (error) {
    console.error('Error seeding AI Facts:', error);
  }
}