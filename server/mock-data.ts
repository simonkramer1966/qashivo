import { storage } from "./storage";
import type { InsertContact, InsertInvoice } from "@shared/schema";

// Enhanced testing clients - 20 strategically designed for automation testing
const testingClients = [
  // Group 1: Current invoices (not yet due) - 5 clients
  { name: "Sarah Mitchell", company: "TechFlow Solutions", email: "info@nexuskpi.com", phone: "07716 273336", group: "current" },
  { name: "David Rodriguez", company: "Digital Marketing Pro", email: "info@nexuskpi.com", phone: "07716 273336", group: "current" },
  { name: "Emily Chen", company: "CloudSync Technologies", email: "info@nexuskpi.com", phone: "07716 273336", group: "current" },
  { name: "Michael Johnson", company: "E-Commerce Empire", email: "info@nexuskpi.com", phone: "07716 273336", group: "current" },
  { name: "Jessica Thompson", company: "FinTech Innovations", email: "info@nexuskpi.com", phone: "07716 273336", group: "current" },
  
  // Group 2: 1-7 days overdue - 5 clients  
  { name: "Robert Anderson", company: "HealthTech Solutions", email: "info@nexuskpi.com", phone: "07716 273336", group: "early_overdue" },
  { name: "Amanda Williams", company: "RetailRise Brands", email: "info@nexuskpi.com", phone: "07716 273336", group: "early_overdue" },
  { name: "Christopher Lee", company: "SaaS Dynamics", email: "info@nexuskpi.com", phone: "07716 273336", group: "early_overdue" },
  { name: "Rachel Garcia", company: "Global Manufacturing Corp", email: "info@nexuskpi.com", phone: "07716 273336", group: "early_overdue" },
  { name: "Daniel Martinez", company: "StartupLaunch Ventures", email: "info@nexuskpi.com", phone: "07716 273336", group: "early_overdue" },
  
  // Group 3: 8-21 days overdue - 5 clients
  { name: "Lisa Brown", company: "CyberSecurity First", email: "info@nexuskpi.com", phone: "07716 273336", group: "mid_overdue" },
  { name: "Kevin Wilson", company: "PropTech Innovations", email: "info@nexuskpi.com", phone: "07716 273336", group: "mid_overdue" },
  { name: "Jennifer Davis", company: "AI Analytics Co", email: "info@nexuskpi.com", phone: "07716 273336", group: "mid_overdue" },
  { name: "Matthew Taylor", company: "GreenEnergy Solutions", email: "info@nexuskpi.com", phone: "07716 273336", group: "mid_overdue" },
  { name: "Ashley Miller", company: "LogisticsTech Hub", email: "info@nexuskpi.com", phone: "07716 273336", group: "mid_overdue" },
  
  // Group 4: 22+ days overdue - 5 clients
  { name: "James White", company: "MedDevice Innovations", email: "info@nexuskpi.com", phone: "07716 273336", group: "late_overdue" },
  { name: "Nicole Jackson", company: "EduTech Solutions", email: "info@nexuskpi.com", phone: "07716 273336", group: "late_overdue" },
  { name: "Andrew Harris", company: "SportsTech Dynamics", email: "info@nexuskpi.com", phone: "07716 273336", group: "late_overdue" },
  { name: "Stephanie Clark", company: "FoodTech Enterprises", email: "info@nexuskpi.com", phone: "07716 273336", group: "late_overdue" },
  { name: "Brandon Lewis", company: "LegalTech Innovations", email: "info@nexuskpi.com", phone: "07716 273336", group: "late_overdue" }
];

// Project types and pricing ranges (amounts in pence for database storage)
const projectTypes = [
  { name: "Brand Identity Design", minAmount: 50000, maxAmount: 500000 },        // £500 - £5,000
  { name: "Website Development", minAmount: 150000, maxAmount: 2500000 },       // £1,500 - £25,000
  { name: "Mobile App Development", minAmount: 500000, maxAmount: 5000000 },    // £5,000 - £50,000
  { name: "Digital Marketing Campaign", minAmount: 100000, maxAmount: 1500000 }, // £1,000 - £15,000
  { name: "SEO Optimization", minAmount: 75000, maxAmount: 800000 },            // £750 - £8,000
  { name: "Social Media Management", minAmount: 50000, maxAmount: 300000 },     // £500 - £3,000
  { name: "Content Strategy", minAmount: 100000, maxAmount: 1000000 },          // £1,000 - £10,000
  { name: "UI/UX Design", minAmount: 200000, maxAmount: 1500000 },              // £2,000 - £15,000
  { name: "E-commerce Platform", minAmount: 800000, maxAmount: 3500000 },       // £8,000 - £35,000
  { name: "Monthly Retainer", minAmount: 150000, maxAmount: 800000 },           // £1,500 - £8,000
  { name: "Video Production", minAmount: 300000, maxAmount: 2000000 },          // £3,000 - £20,000
  { name: "Consultation Services", minAmount: 100000, maxAmount: 500000 }       // £1,000 - £5,000
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
  console.log(`   • All contacts use: info@nexuskpi.com & 07716 273336`);
  console.log(`   • Perfect for testing email → SMS → voice automation workflows`);
}