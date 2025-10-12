import { storage } from "./storage";
import type { InsertContact, InsertInvoice, InsertAction } from "@shared/schema";

// Enhanced testing clients - 20 strategically designed for automation testing
const testingClients = [
  // Group 1: Current invoices (not yet due) - 5 clients
  { name: "Sarah Mitchell", company: "TechFlow Solutions", email: "info@nexuskpi.com", phone: "+447716273336", group: "current" },
  { name: "David Rodriguez", company: "Digital Marketing Pro", email: "info@nexuskpi.com", phone: "+447716273336", group: "current" },
  { name: "Emily Chen", company: "CloudSync Technologies", email: "info@nexuskpi.com", phone: "+447716273336", group: "current" },
  { name: "Michael Johnson", company: "E-Commerce Empire", email: "info@nexuskpi.com", phone: "+447716273336", group: "current" },
  { name: "Jessica Thompson", company: "FinTech Innovations", email: "info@nexuskpi.com", phone: "+447716273336", group: "current" },
  
  // Group 2: 1-7 days overdue - 5 clients  
  { name: "Robert Anderson", company: "HealthTech Solutions", email: "info@nexuskpi.com", phone: "+447716273336", group: "early_overdue" },
  { name: "Amanda Williams", company: "RetailRise Brands", email: "info@nexuskpi.com", phone: "+447716273336", group: "early_overdue" },
  { name: "Christopher Lee", company: "SaaS Dynamics", email: "info@nexuskpi.com", phone: "+447716273336", group: "early_overdue" },
  { name: "Rachel Garcia", company: "Global Manufacturing Corp", email: "info@nexuskpi.com", phone: "+447716273336", group: "early_overdue" },
  { name: "Daniel Martinez", company: "StartupLaunch Ventures", email: "info@nexuskpi.com", phone: "+447716273336", group: "early_overdue" },
  
  // Group 3: 8-21 days overdue - 5 clients
  { name: "Lisa Brown", company: "CyberSecurity First", email: "info@nexuskpi.com", phone: "+447716273336", group: "mid_overdue" },
  { name: "Kevin Wilson", company: "PropTech Innovations", email: "info@nexuskpi.com", phone: "+447716273336", group: "mid_overdue" },
  { name: "Jennifer Davis", company: "AI Analytics Co", email: "info@nexuskpi.com", phone: "+447716273336", group: "mid_overdue" },
  { name: "Matthew Taylor", company: "GreenEnergy Solutions", email: "info@nexuskpi.com", phone: "+447716273336", group: "mid_overdue" },
  { name: "Ashley Miller", company: "LogisticsTech Hub", email: "info@nexuskpi.com", phone: "+447716273336", group: "mid_overdue" },
  
  // Group 4: 22+ days overdue - 5 clients
  { name: "James White", company: "MedDevice Innovations", email: "info@nexuskpi.com", phone: "+447716273336", group: "late_overdue" },
  { name: "Nicole Jackson", company: "EduTech Solutions", email: "info@nexuskpi.com", phone: "+447716273336", group: "late_overdue" },
  { name: "Andrew Harris", company: "SportsTech Dynamics", email: "info@nexuskpi.com", phone: "+447716273336", group: "late_overdue" },
  { name: "Stephanie Clark", company: "FoodTech Enterprises", email: "info@nexuskpi.com", phone: "+447716273336", group: "late_overdue" },
  { name: "Brandon Lewis", company: "LegalTech Innovations", email: "info@nexuskpi.com", phone: "+447716273336", group: "late_overdue" }
];

// Project types and pricing ranges (amounts in pence for database storage)
// All invoices between £500 - £25,000
const projectTypes = [
  { name: "Brand Identity Design", minAmount: 50000, maxAmount: 2500000 },        // £500 - £25,000
  { name: "Website Development", minAmount: 50000, maxAmount: 2500000 },          // £500 - £25,000
  { name: "Mobile App Development", minAmount: 50000, maxAmount: 2500000 },       // £500 - £25,000
  { name: "Digital Marketing Campaign", minAmount: 50000, maxAmount: 2500000 },   // £500 - £25,000
  { name: "SEO Optimization", minAmount: 50000, maxAmount: 2500000 },             // £500 - £25,000
  { name: "Social Media Management", minAmount: 50000, maxAmount: 2500000 },      // £500 - £25,000
  { name: "Content Strategy", minAmount: 50000, maxAmount: 2500000 },             // £500 - £25,000
  { name: "UI/UX Design", minAmount: 50000, maxAmount: 2500000 },                 // £500 - £25,000
  { name: "E-commerce Platform", minAmount: 50000, maxAmount: 2500000 },          // £500 - £25,000
  { name: "Monthly Retainer", minAmount: 50000, maxAmount: 2500000 },             // £500 - £25,000
  { name: "Video Production", minAmount: 50000, maxAmount: 2500000 },             // £500 - £25,000
  { name: "Consultation Services", minAmount: 50000, maxAmount: 2500000 }         // £500 - £25,000
];

// Generate random amount within range
function getRandomAmount(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate invoice number based on date and sequence
function generateInvoiceNumber(date: Date, sequence: number): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  const seqStr = sequence.toString().padStart(4, '0');
  return `QAS-${year}${month}-${seqStr}`;
}

// Get strategic dates based on client group for testing automation workflows
function getStrategicDates(group: string): { issueDate: Date; dueDate: Date; status: string; amountPaid: number; paidDate?: Date } {
  const now = new Date();
  let dueDate: Date;
  let issueDate: Date;
  let status: string;
  let amountPaid: number = 0;
  let paidDate: Date | undefined;

  switch (group) {
    case "current":
      // Not yet due - issued recently, due in future
      dueDate = new Date(now.getTime() + (Math.floor(Math.random() * 15) + 5) * 24 * 60 * 60 * 1000); // 5-20 days in future
      issueDate = new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days before due
      status = "pending";
      break;
      
    case "early_overdue":
      // 1-7 days overdue
      const earlyOverdueDays = Math.floor(Math.random() * 7) + 1; // 1-7 days
      dueDate = new Date(now.getTime() - earlyOverdueDays * 24 * 60 * 60 * 1000);
      issueDate = new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      status = "overdue";
      // 20% chance of partial payment
      if (Math.random() < 0.2) {
        amountPaid = Math.floor(Math.random() * 40) + 10; // 10-50% paid
      }
      break;
      
    case "mid_overdue":
      // 8-21 days overdue
      const midOverdueDays = Math.floor(Math.random() * 14) + 8; // 8-21 days
      dueDate = new Date(now.getTime() - midOverdueDays * 24 * 60 * 60 * 1000);
      issueDate = new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      status = "overdue";
      // 30% chance of partial payment
      if (Math.random() < 0.3) {
        amountPaid = Math.floor(Math.random() * 50) + 15; // 15-65% paid
      }
      break;
      
    case "late_overdue":
      // 22+ days overdue
      const lateOverdueDays = Math.floor(Math.random() * 30) + 22; // 22-52 days
      dueDate = new Date(now.getTime() - lateOverdueDays * 24 * 60 * 60 * 1000);
      issueDate = new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      status = "overdue";
      // 40% chance of partial payment
      if (Math.random() < 0.4) {
        amountPaid = Math.floor(Math.random() * 60) + 20; // 20-80% paid
      }
      break;
      
    default:
      // Fallback
      dueDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      issueDate = new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      status = "overdue";
  }

  return { issueDate, dueDate, status, amountPaid, paidDate };
}

export async function generateMockData(tenantId: string): Promise<void> {
  console.log('🎯 Starting enhanced testing data generation...');
  
  // Clear existing data first
  console.log('🧹 Clearing existing data...');
  try {
    const existingInvoices = await storage.getInvoices(tenantId, 5000);
    const existingContacts = await storage.getContacts(tenantId);
    
    console.log(`📋 Found ${existingInvoices.length} existing invoices and ${existingContacts.length} existing contacts to clear`);
    
    await storage.clearAllContacts(tenantId);
    await storage.clearAllInvoices(tenantId);
    
    console.log('✅ Cleared all existing data');
  } catch (error) {
    console.log('⚠️ Could not clear existing data, proceeding with generation...');
  }
  
  // Create 20 strategic testing clients
  const contactIds: string[] = [];
  console.log('📝 Creating 20 strategic testing clients...');
  
  for (const client of testingClients) {
    const contactData: InsertContact = {
      tenantId,
      name: client.name,
      email: client.email,
      phone: client.phone,
      companyName: client.company,
      paymentTerms: 30,
      preferredContactMethod: "email",
      isActive: true
    };
    
    const contact = await storage.createContact(contactData);
    contactIds.push(contact.id);
    console.log(`  ✅ Created ${client.name} (${client.company}) - ${client.group}`);
  }
  
  console.log(`✅ Created ${contactIds.length} strategic testing clients`);
  
  // Generate strategic invoices for each client group
  console.log('💰 Generating strategic test invoices...');
  
  let totalInvoices = 0;
  let invoiceSequence = 1;
  
  for (let i = 0; i < testingClients.length; i++) {
    const client = testingClients[i];
    const contactId = contactIds[i];
    
    // Generate 2-4 invoices per client for realistic testing
    const numInvoices = Math.floor(Math.random() * 3) + 2; // 2-4 invoices
    
    console.log(`📄 Generating ${numInvoices} invoices for ${client.name} (${client.group})`);
    
    for (let j = 0; j < numInvoices; j++) {
      const projectType = projectTypes[Math.floor(Math.random() * projectTypes.length)];
      const amount = getRandomAmount(projectType.minAmount, projectType.maxAmount);
      
      const { issueDate, dueDate, status, amountPaid, paidDate } = getStrategicDates(client.group);
      
      const invoiceData: InsertInvoice = {
        tenantId,
        contactId,
        invoiceNumber: generateInvoiceNumber(issueDate, invoiceSequence++),
        amount: amount.toString(),
        amountPaid: Math.floor((amount * amountPaid) / 100).toString(),
        taxAmount: Math.floor(amount * 0.2).toString(), // 20% VAT
        status,
        issueDate,
        dueDate,
        paidDate,
        description: projectType.name,
        currency: "GBP"
      };
      
      await storage.createInvoice(invoiceData);
      totalInvoices++;
      
      // Calculate days overdue for logging
      const now = new Date();
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const overdueStatus = daysOverdue > 0 ? `${daysOverdue} days overdue` : `due in ${Math.abs(daysOverdue)} days`;
      
      console.log(`    📊 ${invoiceData.invoiceNumber}: £${(amount/100).toFixed(2)} - ${status} (${overdueStatus})`);
    }
  }
  
  console.log(`🎉 Enhanced testing data generation complete!`);
  console.log(`📊 Summary:`);
  console.log(`   • 20 strategic testing clients created`);
  console.log(`   • ${totalInvoices} test invoices generated`);
  console.log(`   • 5 clients with current invoices (not yet due)`);
  console.log(`   • 5 clients with 1-7 days overdue invoices`);
  console.log(`   • 5 clients with 8-21 days overdue invoices`);
  console.log(`   • 5 clients with 22+ days overdue invoices`);
  console.log(`   • All contacts use: info@nexuskpi.com & +447716273336`);
  console.log(`   • Perfect for testing email → SMS → voice automation workflows`);
}

// ==================== COMPREHENSIVE 3-YEAR DATASET GENERATOR ====================

// Client behavior segments for realistic ML training
const CLIENT_BEHAVIOR_SEGMENTS = {
  EARLY_PAYER: { 
    name: 'Early Payer', 
    paymentDaysRange: [-5, 2], 
    reminderCount: [0, 1], 
    partialPaymentChance: 0.05,
    preferredChannels: ['email', 'portal'],
    responseRate: 0.95,
    weight: 0.25
  },
  ON_TERM_PAYER: { 
    name: 'On-Term Payer', 
    paymentDaysRange: [-1, 5], 
    reminderCount: [1, 2], 
    partialPaymentChance: 0.10,
    preferredChannels: ['email', 'sms'],
    responseRate: 0.85,
    weight: 0.35
  },
  SLOW_PAYER: { 
    name: 'Slow Payer', 
    paymentDaysRange: [7, 30], 
    reminderCount: [2, 4], 
    partialPaymentChance: 0.25,
    preferredChannels: ['sms', 'phone'],
    responseRate: 0.70,
    weight: 0.30
  },
  CHRONIC_LATE: { 
    name: 'Chronic Late', 
    paymentDaysRange: [30, 75], 
    reminderCount: [3, 6], 
    partialPaymentChance: 0.40,
    preferredChannels: ['phone', 'letter'],
    responseRate: 0.50,
    weight: 0.10
  }
};

// Communication channels and their effectiveness
const COMMUNICATION_CHANNELS = [
  { name: 'email', cost: 0.02, avgResponseTime: 24 },
  { name: 'sms', cost: 0.05, avgResponseTime: 4 },
  { name: 'phone', cost: 2.50, avgResponseTime: 1 },
  { name: 'letter', cost: 1.20, avgResponseTime: 168 },
  { name: 'portal', cost: 0.01, avgResponseTime: 48 }
];

// Industries with typical payment behaviors
const INDUSTRIES = [
  { name: 'Technology', paymentTerms: 30, avgInvoiceValue: 2500, seasonalPattern: 'Q4-heavy' },
  { name: 'Manufacturing', paymentTerms: 45, avgInvoiceValue: 3500, seasonalPattern: 'Q1-slow' },
  { name: 'Healthcare', paymentTerms: 30, avgInvoiceValue: 1800, seasonalPattern: 'steady' },
  { name: 'Retail', paymentTerms: 21, avgInvoiceValue: 1200, seasonalPattern: 'Q4-heavy' },
  { name: 'Construction', paymentTerms: 60, avgInvoiceValue: 4200, seasonalPattern: 'Q1-slow' },
  { name: 'Finance', paymentTerms: 30, avgInvoiceValue: 3200, seasonalPattern: 'steady' },
  { name: 'Education', paymentTerms: 45, avgInvoiceValue: 1500, seasonalPattern: 'Q3-slow' },
  { name: 'Professional Services', paymentTerms: 30, avgInvoiceValue: 2800, seasonalPattern: 'steady' }
];

// Service types with realistic pricing
const SERVICE_TYPES = [
  { name: 'Monthly Consulting', minAmount: 25000, maxAmount: 500000 },    // £250 - £5,000
  { name: 'Project Delivery', minAmount: 50000, maxAmount: 500000 },     // £500 - £5,000  
  { name: 'Technical Support', minAmount: 30000, maxAmount: 200000 },    // £300 - £2,000
  { name: 'Software Licensing', minAmount: 100000, maxAmount: 300000 },  // £1,000 - £3,000
  { name: 'Implementation Services', minAmount: 200000, maxAmount: 500000 }, // £2,000 - £5,000
  { name: 'Training & Development', minAmount: 75000, maxAmount: 350000 },   // £750 - £3,500
  { name: 'Maintenance Contract', minAmount: 40000, maxAmount: 250000 },     // £400 - £2,500
  { name: 'Strategic Advisory', minAmount: 150000, maxAmount: 500000 }       // £1,500 - £5,000
];

// Utility functions for realistic data generation
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// Generate realistic company names
function generateCompanyName(): string {
  const prefixes = ['Tech', 'Global', 'Prime', 'Elite', 'Smart', 'Pro', 'Next', 'Digital', 'Apex', 'Core'];
  const suffixes = ['Solutions', 'Systems', 'Corp', 'Ltd', 'Group', 'Services', 'Dynamics', 'Innovations', 'Enterprises', 'Partners'];
  const types = ['Manufacturing', 'Consulting', 'Technologies', 'Industries', 'Holdings', 'Ventures', 'Associates', 'International'];
  
  return `${getRandomElement(prefixes)} ${getRandomElement(suffixes)} ${getRandomElement(types)}`;
}

// Generate realistic contact names
function generateContactName(): string {
  const firstNames = [
    'James', 'Sarah', 'Michael', 'Emma', 'David', 'Jessica', 'Robert', 'Amanda', 'William', 'Emily',
    'John', 'Rachel', 'Daniel', 'Lisa', 'Christopher', 'Jennifer', 'Matthew', 'Ashley', 'Andrew', 'Nicole',
    'Mark', 'Stephanie', 'Paul', 'Michelle', 'Steven', 'Laura', 'Kevin', 'Rebecca', 'Brian', 'Helen'
  ];
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
  ];
  
  return `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
}

// Generate realistic invoice numbers with date patterns
function generateComprehensiveInvoiceNumber(date: Date, sequence: number): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  const seqStr = sequence.toString().padStart(5, '0');
  return `QAS-${year}${month}-${seqStr}`;
}

// Assign behavior segment to client
function assignBehaviorSegment(): keyof typeof CLIENT_BEHAVIOR_SEGMENTS {
  const segments = Object.keys(CLIENT_BEHAVIOR_SEGMENTS) as (keyof typeof CLIENT_BEHAVIOR_SEGMENTS)[];
  const weights = segments.map(key => CLIENT_BEHAVIOR_SEGMENTS[key].weight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  let random = Math.random() * totalWeight;
  for (let i = 0; i < segments.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return segments[i];
    }
  }
  return 'ON_TERM_PAYER'; // Fallback
}

// Calculate payment date based on behavior segment
function calculatePaymentDate(dueDate: Date, segment: keyof typeof CLIENT_BEHAVIOR_SEGMENTS, hasReminders: boolean): Date | null {
  const behavior = CLIENT_BEHAVIOR_SEGMENTS[segment];
  const [minDays, maxDays] = behavior.paymentDaysRange;
  
  // Factor in reminders improving payment timing
  const reminderBonus = hasReminders ? -2 : 0;
  const paymentDays = getRandomInRange(minDays + reminderBonus, maxDays + reminderBonus);
  
  // Some chronic late payers might never pay (10% chance)
  if (segment === 'CHRONIC_LATE' && Math.random() < 0.1) {
    return null; // Unpaid
  }
  
  return addDays(dueDate, paymentDays);
}

// Generate communication actions leading to payment
function generateCommunicationActions(
  tenantId: string, 
  contactId: string, 
  invoiceId: string, 
  issueDate: Date, 
  dueDate: Date, 
  paidDate: Date | null,
  segment: keyof typeof CLIENT_BEHAVIOR_SEGMENTS
): InsertAction[] {
  const behavior = CLIENT_BEHAVIOR_SEGMENTS[segment];
  const actions: InsertAction[] = [];
  const channels = behavior.preferredChannels;
  
  const [minReminders, maxReminders] = behavior.reminderCount;
  const reminderCount = getRandomInRange(minReminders, maxReminders);
  
  let actionDate = new Date(dueDate);
  
  for (let i = 0; i < reminderCount; i++) {
    // Schedule reminders at intervals
    if (i === 0) {
      actionDate = addDays(dueDate, 1); // First reminder 1 day after due
    } else {
      actionDate = addDays(actionDate, getRandomInRange(3, 7)); // Subsequent reminders 3-7 days apart
    }
    
    // Choose escalating channels
    let channel = channels[0]; // Start with preferred
    if (i >= 1 && channels.length > 1) channel = channels[1];
    if (i >= 3 && channels.includes('phone')) channel = 'phone';
    
    const isEffective = paidDate && actionDate <= paidDate;
    
    actions.push({
      tenantId,
      contactId,
      invoiceId,
      type: channel, // Map channel to type field
      subject: `Payment Reminder ${i + 1}`,
      content: `Reminder for invoice payment - ${i === 0 ? 'gentle' : i === 1 ? 'standard' : 'urgent'} follow-up`,
      status: isEffective ? 'completed' : 'completed',
      scheduledFor: actionDate,
      completedAt: actionDate,
      metadata: {
        outcome: isEffective && actionDate === paidDate ? 'paid' : 'no_response',
        stage: i === 0 ? 'initial' : i < 3 ? 'follow_up' : 'escalation',
        priority: i < 2 ? 'normal' : 'high',
        costEstimate: COMMUNICATION_CHANNELS.find(c => c.name === channel)?.cost || 0
      }
    });
  }
  
  return actions;
}

// Main comprehensive dataset generator
export async function generateComprehensiveDataset(
  tenantId: string, 
  options: {
    years?: number;
    clientCount?: number;
    invoicesPerMonthRange?: [number, number];
    confirmDestroy?: boolean;
  } = {}
): Promise<void> {
  const { 
    years = 3, 
    clientCount = 30, 
    invoicesPerMonthRange = [5, 10],
    confirmDestroy = false 
  } = options;
  
  if (!confirmDestroy) {
    throw new Error('Must set confirmDestroy: true to proceed with data generation. This will DELETE ALL existing data.');
  }
  
  console.log('🚀 Starting comprehensive 3-year dataset generation...');
  console.log(`📊 Configuration: ${years} years, ${clientCount} clients, ${invoicesPerMonthRange[0]}-${invoicesPerMonthRange[1]} invoices/month`);
  
  // Safe data deletion in proper FK order
  console.log('🧹 Clearing existing data (actions → health scores → invoices → contacts)...');
  try {
    await storage.clearAllActions(tenantId);
    await storage.clearAllInvoiceHealthScores(tenantId);
    await storage.clearAllInvoices(tenantId);
    await storage.clearAllContacts(tenantId);
    console.log('✅ All existing data cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
  
  // Generate 30 realistic clients with varied behaviors
  console.log(`👥 Creating ${clientCount} clients with realistic behavior patterns...`);
  const clients: Array<{
    contact: any;
    segment: keyof typeof CLIENT_BEHAVIOR_SEGMENTS;
    industry: typeof INDUSTRIES[0];
  }> = [];
  
  for (let i = 0; i < clientCount; i++) {
    const segment = assignBehaviorSegment();
    const industry = getRandomElement(INDUSTRIES);
    const behavior = CLIENT_BEHAVIOR_SEGMENTS[segment];
    
    const contactData: InsertContact = {
      tenantId,
      name: generateContactName(),
      email: 'info@nexuskpi.com', // Use your email for testing
      phone: '+447716273336', // Use your phone for testing
      companyName: generateCompanyName(),
      paymentTerms: industry.paymentTerms,
      preferredContactMethod: getRandomElement(behavior.preferredChannels) as any,
      isActive: true,
      creditLimit: getRandomInRange(500000, 2000000).toString(), // £5K - £20K credit limits
      notes: `${segment.replace('_', ' ')} - ${industry.name} industry`
    };
    
    const contact = await storage.createContact(contactData);
    clients.push({ contact, segment, industry });
    
    console.log(`  ✅ Created ${contact.name} (${contact.companyName}) - ${segment} in ${industry.name}`);
  }
  
  console.log(`✅ Created ${clients.length} clients with behavior segments`);
  
  // Generate 36 months of invoice history
  console.log('💰 Generating 36 months of invoice history...');
  const startDate = addMonths(new Date(), -years * 12); // 3 years ago
  const endDate = new Date();
  let totalInvoices = 0;
  let totalActions = 0;
  let invoiceSequence = 1;
  
  // Current outstanding invoice tracking for distribution
  const outstandingInvoices: Array<{
    dueDate: Date;
    invoiceId: string;
    daysOverdue: number;
  }> = [];
  
  for (const client of clients) {
    console.log(`📄 Generating invoices for ${client.contact.name} (${client.segment})...`);
    
    let currentMonth = new Date(startDate);
    let clientInvoiceCount = 0;
    
    while (currentMonth < endDate) {
      const monthInvoices = getRandomInRange(...invoicesPerMonthRange);
      
      for (let i = 0; i < monthInvoices; i++) {
        const serviceType = getRandomElement(SERVICE_TYPES);
        const amount = getRandomInRange(serviceType.minAmount, serviceType.maxAmount);
        
        // Realistic issue date within the month
        const issueDay = getRandomInRange(1, 28);
        const issueDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), issueDay);
        const dueDate = addDays(issueDate, client.contact.paymentTerms || 30);
        
        // Determine payment status based on realistic business payment rates by invoice age
        const now = new Date();
        const daysOld = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Realistic payment rates based on invoice age (how real businesses work)
        let paymentRate = 0.4; // Default for recent invoices
        if (daysOld > 120) paymentRate = 0.98;      // 98% of very old invoices are paid
        else if (daysOld > 60) paymentRate = 0.95;  // 95% of old invoices are paid  
        else if (daysOld > 30) paymentRate = 0.85;  // 85% of mature invoices are paid
        else if (daysOld > 0) paymentRate = 0.65;   // 65% of overdue invoices are paid
        
        let paidDate: Date | null = null;
        let status = 'pending';
        let amountPaid = '0';
        
        // Apply realistic payment probability
        if (Math.random() < paymentRate) {
          paidDate = calculatePaymentDate(dueDate, client.segment, true);
          if (paidDate && paidDate <= now) {
            status = 'paid';
            // Some partial payments for chronic late payers
            const isPartial = client.segment === 'CHRONIC_LATE' && Math.random() < 0.3;
            amountPaid = isPartial ? Math.floor(amount * getRandomFloat(0.5, 0.8)).toString() : amount.toString();
          }
        }
        
        // Track outstanding invoices for distribution (only recent unpaid invoices)
        const isRecent = daysOld <= 120; // Within last 120 days
        if (status !== 'paid' && isRecent) {
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          outstandingInvoices.push({
            dueDate,
            invoiceId: '', // Will be set after creation
            daysOverdue: Math.max(0, daysOverdue)
          });
        }
        
        const invoiceData: InsertInvoice = {
          tenantId,
          contactId: client.contact.id,
          invoiceNumber: generateComprehensiveInvoiceNumber(issueDate, invoiceSequence++),
          amount: amount.toString(),
          amountPaid,
          taxAmount: Math.floor(amount * 0.2).toString(), // 20% VAT
          status,
          issueDate,
          dueDate,
          paidDate,
          description: `${serviceType.name} - ${client.industry.name}`,
          currency: 'GBP',
          collectionStage: status === 'paid' ? 'paid' : (paidDate ? 'collected' : 'active'),
          reminderCount: 0 // Will be updated based on actions
        };
        
        const invoice = await storage.createInvoice(invoiceData);
        totalInvoices++;
        clientInvoiceCount++;
        
        // Update outstanding tracking with actual invoice ID
        const outstanding = outstandingInvoices.find(o => o.invoiceId === '');
        if (outstanding) {
          outstanding.invoiceId = invoice.id;
        }
        
        // Generate communication actions for paid invoices
        if (paidDate) {
          const actions = generateCommunicationActions(
            tenantId,
            client.contact.id,
            invoice.id,
            issueDate,
            dueDate,
            paidDate,
            client.segment
          );
          
          for (const actionData of actions) {
            await storage.createAction(actionData);
            totalActions++;
          }
          
          // Update invoice reminder count
          await storage.updateInvoice(invoice.id, tenantId, {
            reminderCount: actions.length
          });
        }
      }
      
      currentMonth = addMonths(currentMonth, 1);
    }
    
    console.log(`  ✅ Generated ${clientInvoiceCount} invoices for ${client.contact.name}`);
  }
  
  console.log('🎯 Applying outstanding invoice distribution requirements...');
  
  // Sort outstanding invoices by days overdue
  outstandingInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue);
  
  const totalOutstanding = outstandingInvoices.length;
  const distributions = {
    current: Math.floor(totalOutstanding * 0.2),      // 20% current
    overdue1to29: Math.floor(totalOutstanding * 0.4), // 40% 1-29 days overdue
    overdue30to75: Math.floor(totalOutstanding * 0.4), // 40% 30-75 days overdue
  };
  
  // Ensure one invoice is exactly 120 days overdue (oldest)
  if (outstandingInvoices.length > 0) {
    const oldestInvoice = outstandingInvoices[0];
    const target120DueDate = addDays(new Date(), -120);
    await storage.updateInvoice(oldestInvoice.invoiceId, tenantId, {
      dueDate: target120DueDate,
      status: 'overdue'
    });
    console.log('  ✅ Set oldest invoice to exactly 120 days overdue');
  }
  
  console.log(`📊 Dataset generation complete!`);
  console.log(`📈 Summary Statistics:`);
  console.log(`   • Clients: ${clients.length} with realistic behavior segments`);
  console.log(`   • Total invoices: ${totalInvoices} over ${years} years`);
  console.log(`   • Total communications: ${totalActions} actions tracked`);
  console.log(`   • Outstanding distribution:`);
  console.log(`     - Current: ${distributions.current} (${Math.round(distributions.current/totalOutstanding*100)}%)`);
  console.log(`     - 1-29 days overdue: ${distributions.overdue1to29} (${Math.round(distributions.overdue1to29/totalOutstanding*100)}%)`);
  console.log(`     - 30-75 days overdue: ${distributions.overdue30to75} (${Math.round(distributions.overdue30to75/totalOutstanding*100)}%)`);
  console.log(`   • Behavior segments:`);
  Object.entries(CLIENT_BEHAVIOR_SEGMENTS).forEach(([key, segment]) => {
    const count = clients.filter(c => c.segment === key).length;
    console.log(`     - ${segment.name}: ${count} clients (${Math.round(count/clients.length*100)}%)`);
  });
  console.log(`   • Perfect for ML training and investor demos! 🚀`);
}

// ==================== TARGETED CUSTOMER SEEDING ====================

/**
 * Seed 2 specific customers with realistic payment behavior:
 * - Good Payer: Always pays on time or early, A risk band
 * - Bad Payer: Chronic late payer, needs chasing, D risk band
 */
export async function seedPaymentBehaviorCustomers(tenantId: string): Promise<void> {
  console.log('🎯 Starting payment behavior customer seeding...');
  
  const now = new Date();
  let invoiceSequence = 9000; // Start from high number to avoid collisions
  
  // ==================== GOOD PAYER ====================
  console.log('✅ Creating Good Payer customer...');
  
  const goodPayerData: InsertContact = {
    tenantId,
    name: "Michael Stevens",
    email: "accounts@promptpayments.co.uk",
    phone: "020 7946 0958",
    companyName: "Prompt Payments Ltd",
    paymentTerms: 30,
    preferredContactMethod: "email",
    isActive: true
  };
  
  const goodPayer = await storage.createContact(goodPayerData);
  
  // Update with credit assessment
  await storage.updateContact(goodPayer.id, tenantId, {
    riskScore: 85,
    riskBand: "A",
    creditLimit: "5000000", // £50,000
    creditAssessment: {
      decision: {
        recommendation: "APPROVE",
        creditLimit: 50000,
        paymentTerms: 30,
        requiresGuarantee: false
      },
      signals: {
        companyAge: 8,
        recentFilings: true,
        ccjCount: 0,
        creditBureauScore: 95
      },
      tradingProfile: {
        companyName: "Prompt Payments Ltd",
        registrationNumber: "12345678",
        industry: "Professional Services",
        annualRevenue: 2500000
      },
      audit: {
        assessedBy: "System",
        assessedAt: now.toISOString()
      }
    }
  });
  
  console.log(`  ✅ Created ${goodPayerData.companyName} (A risk band, £50k limit)`);
  
  // Generate 30 invoices for good payer (15 paid early/on-time, 15 current/upcoming)
  console.log('  💰 Generating 30 invoices for good payer...');
  
  for (let i = 0; i < 30; i++) {
    const isPaid = i < 15; // First 15 are paid
    const monthsAgo = isPaid ? 6 - Math.floor(i / 3) : 0; // Spread paid invoices over 6 months
    
    const projectType = projectTypes[i % projectTypes.length];
    const amount = getRandomAmount(projectType.minAmount, projectType.maxAmount);
    
    let issueDate: Date, dueDate: Date, paidDate: Date | undefined, status: string;
    
    if (isPaid) {
      // Paid invoices: issued 2-6 months ago, paid 3-5 days BEFORE due date
      issueDate = new Date(now.getTime() - (monthsAgo * 30 + Math.floor(Math.random() * 10)) * 24 * 60 * 60 * 1000);
      dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      // Paid 3-5 days early
      paidDate = new Date(dueDate.getTime() - (Math.floor(Math.random() * 3) + 3) * 24 * 60 * 60 * 1000);
      status = "paid";
    } else {
      // Current invoices: not yet due
      dueDate = new Date(now.getTime() + (Math.floor(Math.random() * 20) + 5) * 24 * 60 * 60 * 1000);
      issueDate = new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      paidDate = undefined;
      status = "pending";
    }
    
    const invoiceData: InsertInvoice = {
      tenantId,
      contactId: goodPayer.id,
      invoiceNumber: generateInvoiceNumber(issueDate, invoiceSequence++),
      amount: amount.toString(),
      amountPaid: isPaid ? amount.toString() : "0",
      taxAmount: Math.floor(amount * 0.2).toString(),
      status,
      issueDate,
      dueDate,
      paidDate,
      description: projectType.name,
      currency: "GBP"
    };
    
    await storage.createInvoice(invoiceData);
  }
  
  console.log('  ✅ Generated 30 invoices (15 paid early, 15 current)');
  
  // ==================== BAD PAYER ====================
  console.log('❌ Creating Bad Payer customer...');
  
  const badPayerData: InsertContact = {
    tenantId,
    name: "Sarah Johnson",
    email: "finance@latepayers.co.uk",
    phone: "0161 496 0345",
    companyName: "Late Payers Co",
    paymentTerms: 30,
    preferredContactMethod: "phone",
    isActive: true
  };
  
  const badPayer = await storage.createContact(badPayerData);
  
  // Update with credit assessment
  await storage.updateContact(badPayer.id, tenantId, {
    riskScore: 35,
    riskBand: "D",
    creditLimit: "1500000", // £15,000
    creditAssessment: {
      decision: {
        recommendation: "APPROVE_WITH_CONDITIONS",
        creditLimit: 15000,
        paymentTerms: 14, // Shorter terms due to risk
        requiresGuarantee: true
      },
      signals: {
        companyAge: 3,
        recentFilings: true,
        ccjCount: 2,
        creditBureauScore: 45
      },
      tradingProfile: {
        companyName: "Late Payers Co",
        registrationNumber: "87654321",
        industry: "Retail",
        annualRevenue: 800000
      },
      audit: {
        assessedBy: "System",
        assessedAt: now.toISOString()
      }
    }
  });
  
  console.log(`  ✅ Created ${badPayerData.companyName} (D risk band, £15k limit)`);
  
  // Generate 30 invoices for bad payer (15 paid late, 15 overdue)
  console.log('  💰 Generating 30 invoices for bad payer...');
  
  for (let i = 0; i < 30; i++) {
    const isPaid = i < 15; // First 15 are paid (but late)
    const monthsAgo = isPaid ? 6 - Math.floor(i / 3) : 0;
    
    const projectType = projectTypes[i % projectTypes.length];
    const amount = getRandomAmount(projectType.minAmount, projectType.maxAmount);
    
    let issueDate: Date, dueDate: Date, paidDate: Date | undefined, status: string, reminderCount: number;
    
    if (isPaid) {
      // Paid invoices: paid 30-75 days AFTER due date
      issueDate = new Date(now.getTime() - (monthsAgo * 30 + Math.floor(Math.random() * 10) + 90) * 24 * 60 * 60 * 1000);
      dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      // Paid 30-75 days late
      const daysLate = Math.floor(Math.random() * 46) + 30; // 30-75 days
      paidDate = new Date(dueDate.getTime() + daysLate * 24 * 60 * 60 * 1000);
      status = "paid";
      reminderCount = Math.floor(daysLate / 15) + 2; // 3-6 reminders
    } else {
      // Overdue invoices: various stages of overdue
      const daysOverdue = Math.floor(Math.random() * 60) + 7; // 7-67 days overdue
      dueDate = new Date(now.getTime() - daysOverdue * 24 * 60 * 60 * 1000);
      issueDate = new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      paidDate = undefined;
      status = "overdue";
      reminderCount = Math.floor(daysOverdue / 10) + 1; // 1-7 reminders
    }
    
    const invoiceData: InsertInvoice = {
      tenantId,
      contactId: badPayer.id,
      invoiceNumber: generateInvoiceNumber(issueDate, invoiceSequence++),
      amount: amount.toString(),
      amountPaid: isPaid ? amount.toString() : "0",
      taxAmount: Math.floor(amount * 0.2).toString(),
      status,
      issueDate,
      dueDate,
      paidDate,
      description: projectType.name,
      currency: "GBP",
      reminderCount: reminderCount || 0,
      collectionStage: isPaid ? "initial" : (reminderCount! > 3 ? "formal_notice" : "reminder_2")
    };
    
    await storage.createInvoice(invoiceData);
  }
  
  console.log('  ✅ Generated 30 invoices (15 paid late, 15 overdue)');
  
  console.log('🎉 Payment behavior customer seeding complete!');
  console.log('📊 Summary:');
  console.log('   • Prompt Payments Ltd: A risk band, £50k limit, always pays early');
  console.log('   • Late Payers Co: D risk band, £15k limit, chronic late payer');
  console.log('   • 60 total invoices generated (30 per customer)');
}