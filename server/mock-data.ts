import { storage } from "./storage";
import type { InsertContact, InsertInvoice } from "@shared/schema";

// Realistic agency client companies
const agencyClients = [
  { name: "Sarah Mitchell", company: "TechFlow Solutions", email: "simon@studiopow.com", phone: "+1-555-0101" },
  { name: "David Rodriguez", company: "Digital Marketing Pro", email: "simon@studiopow.com", phone: "+1-555-0102" },
  { name: "Emily Chen", company: "CloudSync Technologies", email: "simon@studiopow.com", phone: "+1-555-0103" },
  { name: "Michael Johnson", company: "E-Commerce Empire", email: "simon@studiopow.com", phone: "+1-555-0104" },
  { name: "Jessica Thompson", company: "FinTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0105" },
  { name: "Robert Anderson", company: "HealthTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0106" },
  { name: "Amanda Williams", company: "RetailRise Brands", email: "simon@studiopow.com", phone: "+1-555-0107" },
  { name: "Christopher Lee", company: "SaaS Dynamics", email: "simon@studiopow.com", phone: "+1-555-0108" },
  { name: "Rachel Garcia", company: "Global Manufacturing Corp", email: "simon@studiopow.com", phone: "+1-555-0109" },
  { name: "Daniel Martinez", company: "StartupLaunch Ventures", email: "simon@studiopow.com", phone: "+1-555-0110" },
  { name: "Lisa Brown", company: "CyberSecurity First", email: "simon@studiopow.com", phone: "+1-555-0111" },
  { name: "Kevin Wilson", company: "PropTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0112" },
  { name: "Jennifer Davis", company: "AI Analytics Co", email: "simon@studiopow.com", phone: "+1-555-0113" },
  { name: "Matthew Taylor", company: "GreenEnergy Solutions", email: "simon@studiopow.com", phone: "+1-555-0114" },
  { name: "Ashley Miller", company: "LogisticsTech Hub", email: "simon@studiopow.com", phone: "+1-555-0115" },
  { name: "James White", company: "MedDevice Innovations", email: "simon@studiopow.com", phone: "+1-555-0116" },
  { name: "Nicole Jackson", company: "EduTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0117" },
  { name: "Andrew Harris", company: "SportsTech Dynamics", email: "simon@studiopow.com", phone: "+1-555-0118" },
  { name: "Stephanie Clark", company: "FoodTech Enterprises", email: "simon@studiopow.com", phone: "+1-555-0119" },
  { name: "Brandon Lewis", company: "LegalTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0120" },
  { name: "Megan Robinson", company: "TravelTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0121" },
  { name: "Joshua Walker", company: "InsurTech Dynamics", email: "simon@studiopow.com", phone: "+1-555-0122" },
  { name: "Samantha Hall", company: "RealEstate Pro", email: "simon@studiopow.com", phone: "+1-555-0123" },
  { name: "Tyler Allen", company: "AutoTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0124" },
  { name: "Kimberly Young", company: "AgriTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0125" },
  { name: "Ryan King", company: "BioTech Ventures", email: "simon@studiopow.com", phone: "+1-555-0126" },
  { name: "Lauren Wright", company: "CleanTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0127" },
  { name: "Nathan Lopez", company: "GameTech Studios", email: "simon@studiopow.com", phone: "+1-555-0128" },
  { name: "Brittany Hill", company: "VoiceTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0129" },
  { name: "Jordan Scott", company: "DataViz Enterprises", email: "simon@studiopow.com", phone: "+1-555-0130" },
  { name: "Vanessa Green", company: "BlockChain Innovations", email: "simon@studiopow.com", phone: "+1-555-0131" },
  { name: "Eric Adams", company: "IoT Solutions Inc", email: "simon@studiopow.com", phone: "+1-555-0132" },
  { name: "Tiffany Baker", company: "AugmentedReality Co", email: "simon@studiopow.com", phone: "+1-555-0133" },
  { name: "Marcus Gonzalez", company: "VirtualReality Pro", email: "simon@studiopow.com", phone: "+1-555-0134" },
  { name: "Crystal Nelson", company: "DroneeTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0135" },
  { name: "Aaron Carter", company: "RoboTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0136" },
  { name: "Heather Mitchell", company: "3DPrint Technologies", email: "simon@studiopow.com", phone: "+1-555-0137" },
  { name: "Jeremy Perez", company: "SmartHome Solutions", email: "simon@studiopow.com", phone: "+1-555-0138" },
  { name: "Monica Roberts", company: "WearableTech Co", email: "simon@studiopow.com", phone: "+1-555-0139" },
  { name: "Carlos Turner", company: "QuantumTech Labs", email: "simon@studiopow.com", phone: "+1-555-0140" },
  { name: "Diana Phillips", company: "NanoTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0141" },
  { name: "Sean Campbell", company: "SpaceTech Ventures", email: "simon@studiopow.com", phone: "+1-555-0142" },
  { name: "Patricia Parker", company: "OceanTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0143" },
  { name: "Gregory Evans", company: "WeatherTech Pro", email: "simon@studiopow.com", phone: "+1-555-0144" },
  { name: "Andrea Edwards", company: "ClimaTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0145" },
  { name: "Keith Collins", company: "WaterTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0146" },
  { name: "Melanie Stewart", company: "SolarTech Dynamics", email: "simon@studiopow.com", phone: "+1-555-0147" },
  { name: "Brian Sanchez", company: "WindTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0148" },
  { name: "Cynthia Morris", company: "GeoTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0149" },
  { name: "Travis Reed", company: "MiningTech Pro", email: "simon@studiopow.com", phone: "+1-555-0150" },
  { name: "Denise Cook", company: "PetrolTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0151" },
  { name: "Victor Morgan", company: "ChemTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0152" },
  { name: "Cheryl Bell", company: "MaterialTech Pro", email: "simon@studiopow.com", phone: "+1-555-0153" },
  { name: "Russell Murphy", company: "PlasticTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0154" },
  { name: "Jacqueline Bailey", company: "MetalTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0155" },
  { name: "Adam Rivera", company: "CeramicTech Pro", email: "simon@studiopow.com", phone: "+1-555-0156" },
  { name: "Teresa Cooper", company: "GlassTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0157" },
  { name: "Kenneth Richardson", company: "TextileTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0158" },
  { name: "Kathryn Cox", company: "FashionTech Pro", email: "simon@studiopow.com", phone: "+1-555-0159" },
  { name: "Peter Ward", company: "BeautyTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0160" },
  { name: "Julie Torres", company: "WellnessTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0161" },
  { name: "Alexander Peterson", company: "FitnessTech Pro", email: "simon@studiopow.com", phone: "+1-555-0162" },
  { name: "Sandra Gray", company: "NutriTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0163" },
  { name: "Douglas Ramirez", company: "PharmaTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0164" },
  { name: "Christine James", company: "VetTech Pro", email: "simon@studiopow.com", phone: "+1-555-0165" },
  { name: "Nicholas Watson", company: "AnimalTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0166" },
  { name: "Donna Brooks", company: "PlantTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0167" },
  { name: "Timothy Kelly", company: "GardenTech Pro", email: "simon@studiopow.com", phone: "+1-555-0168" },
  { name: "Catherine Sanders", company: "ForestTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0169" },
  { name: "Steven Price", company: "EcoTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0170" },
  { name: "Barbara Bennett", company: "SustainTech Pro", email: "simon@studiopow.com", phone: "+1-555-0171" },
  { name: "Jeffrey Wood", company: "RecycleTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0172" },
  { name: "Helen Barnes", company: "WasteTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0173" },
  { name: "Richard Ross", company: "PackagingTech Pro", email: "simon@studiopow.com", phone: "+1-555-0174" },
  { name: "Margaret Henderson", company: "LogisticsTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0175" },
  { name: "Joseph Coleman", company: "ShippingTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0176" },
  { name: "Dorothy Jenkins", company: "CargoTech Pro", email: "simon@studiopow.com", phone: "+1-555-0177" },
  { name: "Gary Perry", company: "DeliveryTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0178" },
  { name: "Nancy Powell", company: "WarehouseTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0179" },
  { name: "Frank Long", company: "InventoryTech Pro", email: "simon@studiopow.com", phone: "+1-555-0180" }
];

// Project types and typical pricing for agencies
const projectTypes = [
  { name: "Brand Identity Design", minAmount: 8000, maxAmount: 25000 },
  { name: "Website Development", minAmount: 15000, maxAmount: 75000 },
  { name: "Mobile App Development", minAmount: 25000, maxAmount: 150000 },
  { name: "Digital Marketing Campaign", minAmount: 10000, maxAmount: 50000 },
  { name: "SEO Optimization", minAmount: 5000, maxAmount: 20000 },
  { name: "Social Media Management", minAmount: 3000, maxAmount: 12000 },
  { name: "Content Strategy", minAmount: 8000, maxAmount: 30000 },
  { name: "UI/UX Design", minAmount: 12000, maxAmount: 60000 },
  { name: "E-commerce Platform", minAmount: 20000, maxAmount: 100000 },
  { name: "Monthly Retainer", minAmount: 5000, maxAmount: 15000 },
  { name: "Video Production", minAmount: 15000, maxAmount: 80000 },
  { name: "Photography Services", minAmount: 3000, maxAmount: 15000 },
  { name: "Copywriting Services", minAmount: 2000, maxAmount: 10000 },
  { name: "Market Research", minAmount: 8000, maxAmount: 35000 },
  { name: "Consultation Services", minAmount: 2000, maxAmount: 8000 }
];

// Generate random date within last 6 months
function getRandomDate(monthsBack: number): Date {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate random amount within range
function getRandomAmount(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate invoice number
function generateInvoiceNumber(month: number, year: number, sequence: number): string {
  const monthStr = month.toString().padStart(2, '0');
  const yearStr = year.toString().slice(-2);
  const seqStr = sequence.toString().padStart(4, '0');
  return `AGN-${yearStr}${monthStr}-${seqStr}`;
}

// Determine invoice status based on due date and random factors
function getInvoiceStatus(dueDate: Date, issueDate: Date): { status: string; paidDate?: Date; amountPaid: number } {
  const now = new Date();
  const daysSinceIssue = Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // 75% of invoices are paid
  const isPaid = Math.random() < 0.75;
  
  if (isPaid) {
    // Paid invoices - some paid early, some on time, some late
    const paymentDelay = Math.random() < 0.6 ? 
      Math.floor(Math.random() * 5) - 10 : // Early to on-time payment
      Math.floor(Math.random() * 20) + 1;  // Late payment
    
    const paidDate = new Date(dueDate.getTime() + (paymentDelay * 24 * 60 * 60 * 1000));
    
    // Don't set future paid dates
    if (paidDate > now) {
      return { status: "pending", amountPaid: 0 };
    }
    
    return { 
      status: "paid", 
      paidDate,
      amountPaid: 100 // Assuming full payment for simplicity
    };
  } else {
    // Unpaid invoices
    if (daysSinceDue > 0) {
      // Overdue - some have partial payments
      const hasPartialPayment = Math.random() < 0.3;
      return { 
        status: "overdue", 
        amountPaid: hasPartialPayment ? Math.floor(Math.random() * 50) + 10 : 0
      };
    } else {
      // Still pending
      return { status: "pending", amountPaid: 0 };
    }
  }
}

export async function generateMockData(tenantId: string): Promise<void> {
  console.log('🎯 Starting mock data generation...');
  
  // Clear existing data first
  console.log('🧹 Clearing existing mock data...');
  try {
    // Get counts before clearing
    const existingInvoices = await storage.getInvoices(tenantId, 5000);
    const existingContacts = await storage.getContacts(tenantId);
    
    console.log(`📋 Found ${existingInvoices.length} existing invoices and ${existingContacts.length} existing contacts to clear`);
    
    // Clear all existing data for clean slate
    await storage.clearAllContacts(tenantId);
    await storage.clearAllInvoices(tenantId);
    
    console.log('✅ Cleared all existing data');
  } catch (error) {
    console.log('⚠️ Could not clear existing data, proceeding with generation...');
  }
  
  // Create contacts (80 clients)
  const contactIds: string[] = [];
  console.log('📝 Creating 80 agency clients...');
  
  for (const client of agencyClients) {
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
  }
  
  console.log(`✅ Created ${contactIds.length} clients`);
  
  // Generate invoices (300 per month for 6 months = 1,800 total)
  console.log('💰 Generating 1,800 invoices over 6 months...');
  
  let totalInvoices = 0;
  
  for (let monthsBack = 5; monthsBack >= 0; monthsBack--) {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() - monthsBack + 1;
    
    console.log(`📅 Month ${6 - monthsBack}/6: Generating 300 invoices...`);
    
    for (let i = 0; i < 300; i++) {
      const contactId = contactIds[Math.floor(Math.random() * contactIds.length)];
      const projectType = projectTypes[Math.floor(Math.random() * projectTypes.length)];
      const amount = getRandomAmount(projectType.minAmount, projectType.maxAmount);
      
      // Generate overdue invoices with due dates before August 30, 2025
      const maxDueDate = new Date('2025-08-30');
      const minDueDate = new Date('2025-06-01'); // Start from June for variety
      const dueDate = new Date(minDueDate.getTime() + Math.random() * (maxDueDate.getTime() - minDueDate.getTime()));
      
      // Issue date is 30 days before due date
      const issueDate = new Date(dueDate.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      const { status, paidDate, amountPaid } = getInvoiceStatus(dueDate, issueDate);
      
      const invoiceData: InsertInvoice = {
        tenantId,
        contactId,
        invoiceNumber: generateInvoiceNumber(month > 12 ? month - 12 : month, month > 12 ? year + 1 : year, i + 1),
        amount: amount.toString(),
        amountPaid: ((amount * amountPaid) / 100).toString(),
        taxAmount: (amount * 0.1).toString(), // 10% tax
        status,
        issueDate,
        dueDate,
        paidDate,
        description: projectType.name,
        currency: "USD"
      };
      
      await storage.createInvoice(invoiceData);
      totalInvoices++;
    }
  }
  
  console.log(`🎉 Mock data generation complete!`);
  console.log(`📊 Summary:`);
  console.log(`   • ${contactIds.length} clients created`);
  console.log(`   • ${totalInvoices} invoices generated`);
  console.log(`   • 6 months of realistic AR data`);
  console.log(`   • Mix of paid, pending, and overdue invoices`);
}