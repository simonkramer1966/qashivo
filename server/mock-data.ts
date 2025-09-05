import { storage } from "./storage";
import type { InsertContact, InsertInvoice } from "@shared/schema";

// Realistic agency client companies
const agencyClients = [
  { name: "TechFlow Solutions", company: "TechFlow Solutions", email: "simon@studiopow.com", phone: "+1-555-0101" },
  { name: "Digital Marketing Pro", company: "Digital Marketing Pro", email: "simon@studiopow.com", phone: "+1-555-0102" },
  { name: "CloudSync Technologies", company: "CloudSync Technologies", email: "simon@studiopow.com", phone: "+1-555-0103" },
  { name: "E-Commerce Empire", company: "E-Commerce Empire", email: "simon@studiopow.com", phone: "+1-555-0104" },
  { name: "FinTech Innovations", company: "FinTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0105" },
  { name: "HealthTech Solutions", company: "HealthTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0106" },
  { name: "RetailRise Brands", company: "RetailRise Brands", email: "simon@studiopow.com", phone: "+1-555-0107" },
  { name: "SaaS Dynamics", company: "SaaS Dynamics", email: "simon@studiopow.com", phone: "+1-555-0108" },
  { name: "Global Manufacturing Corp", company: "Global Manufacturing Corp", email: "simon@studiopow.com", phone: "+1-555-0109" },
  { name: "StartupLaunch Ventures", company: "StartupLaunch Ventures", email: "simon@studiopow.com", phone: "+1-555-0110" },
  { name: "CyberSecurity First", company: "CyberSecurity First", email: "simon@studiopow.com", phone: "+1-555-0111" },
  { name: "PropTech Innovations", company: "PropTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0112" },
  { name: "AI Analytics Co", company: "AI Analytics Co", email: "simon@studiopow.com", phone: "+1-555-0113" },
  { name: "GreenEnergy Solutions", company: "GreenEnergy Solutions", email: "simon@studiopow.com", phone: "+1-555-0114" },
  { name: "LogisticsTech Hub", company: "LogisticsTech Hub", email: "simon@studiopow.com", phone: "+1-555-0115" },
  { name: "MedDevice Innovations", company: "MedDevice Innovations", email: "simon@studiopow.com", phone: "+1-555-0116" },
  { name: "EduTech Solutions", company: "EduTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0117" },
  { name: "SportsTech Dynamics", company: "SportsTech Dynamics", email: "simon@studiopow.com", phone: "+1-555-0118" },
  { name: "FoodTech Enterprises", company: "FoodTech Enterprises", email: "simon@studiopow.com", phone: "+1-555-0119" },
  { name: "LegalTech Innovations", company: "LegalTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0120" },
  { name: "TravelTech Solutions", company: "TravelTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0121" },
  { name: "InsurTech Dynamics", company: "InsurTech Dynamics", email: "simon@studiopow.com", phone: "+1-555-0122" },
  { name: "RealEstate Pro", company: "RealEstate Pro", email: "simon@studiopow.com", phone: "+1-555-0123" },
  { name: "AutoTech Innovations", company: "AutoTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0124" },
  { name: "AgriTech Solutions", company: "AgriTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0125" },
  { name: "BioTech Ventures", company: "BioTech Ventures", email: "simon@studiopow.com", phone: "+1-555-0126" },
  { name: "CleanTech Innovations", company: "CleanTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0127" },
  { name: "GameTech Studios", company: "GameTech Studios", email: "simon@studiopow.com", phone: "+1-555-0128" },
  { name: "VoiceTech Solutions", company: "VoiceTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0129" },
  { name: "DataViz Enterprises", company: "DataViz Enterprises", email: "simon@studiopow.com", phone: "+1-555-0130" },
  { name: "BlockChain Innovations", company: "BlockChain Innovations", email: "simon@studiopow.com", phone: "+1-555-0131" },
  { name: "IoT Solutions Inc", company: "IoT Solutions Inc", email: "simon@studiopow.com", phone: "+1-555-0132" },
  { name: "AugmentedReality Co", company: "AugmentedReality Co", email: "simon@studiopow.com", phone: "+1-555-0133" },
  { name: "VirtualReality Pro", company: "VirtualReality Pro", email: "simon@studiopow.com", phone: "+1-555-0134" },
  { name: "DroneeTech Solutions", company: "DroneeTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0135" },
  { name: "RoboTech Innovations", company: "RoboTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0136" },
  { name: "3DPrint Technologies", company: "3DPrint Technologies", email: "simon@studiopow.com", phone: "+1-555-0137" },
  { name: "SmartHome Solutions", company: "SmartHome Solutions", email: "simon@studiopow.com", phone: "+1-555-0138" },
  { name: "WearableTech Co", company: "WearableTech Co", email: "simon@studiopow.com", phone: "+1-555-0139" },
  { name: "QuantumTech Labs", company: "QuantumTech Labs", email: "simon@studiopow.com", phone: "+1-555-0140" },
  { name: "NanoTech Innovations", company: "NanoTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0141" },
  { name: "SpaceTech Ventures", company: "SpaceTech Ventures", email: "simon@studiopow.com", phone: "+1-555-0142" },
  { name: "OceanTech Solutions", company: "OceanTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0143" },
  { name: "WeatherTech Pro", company: "WeatherTech Pro", email: "simon@studiopow.com", phone: "+1-555-0144" },
  { name: "ClimaTech Innovations", company: "ClimaTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0145" },
  { name: "WaterTech Solutions", company: "WaterTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0146" },
  { name: "SolarTech Dynamics", company: "SolarTech Dynamics", email: "simon@studiopow.com", phone: "+1-555-0147" },
  { name: "WindTech Innovations", company: "WindTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0148" },
  { name: "GeoTech Solutions", company: "GeoTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0149" },
  { name: "MiningTech Pro", company: "MiningTech Pro", email: "simon@studiopow.com", phone: "+1-555-0150" },
  { name: "PetrolTech Innovations", company: "PetrolTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0151" },
  { name: "ChemTech Solutions", company: "ChemTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0152" },
  { name: "MaterialTech Pro", company: "MaterialTech Pro", email: "simon@studiopow.com", phone: "+1-555-0153" },
  { name: "PlasticTech Innovations", company: "PlasticTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0154" },
  { name: "MetalTech Solutions", company: "MetalTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0155" },
  { name: "CeramicTech Pro", company: "CeramicTech Pro", email: "simon@studiopow.com", phone: "+1-555-0156" },
  { name: "GlassTech Innovations", company: "GlassTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0157" },
  { name: "TextileTech Solutions", company: "TextileTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0158" },
  { name: "FashionTech Pro", company: "FashionTech Pro", email: "simon@studiopow.com", phone: "+1-555-0159" },
  { name: "BeautyTech Innovations", company: "BeautyTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0160" },
  { name: "WellnessTech Solutions", company: "WellnessTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0161" },
  { name: "FitnessTech Pro", company: "FitnessTech Pro", email: "simon@studiopow.com", phone: "+1-555-0162" },
  { name: "NutriTech Innovations", company: "NutriTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0163" },
  { name: "PharmaTech Solutions", company: "PharmaTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0164" },
  { name: "VetTech Pro", company: "VetTech Pro", email: "simon@studiopow.com", phone: "+1-555-0165" },
  { name: "AnimalTech Innovations", company: "AnimalTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0166" },
  { name: "PlantTech Solutions", company: "PlantTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0167" },
  { name: "GardenTech Pro", company: "GardenTech Pro", email: "simon@studiopow.com", phone: "+1-555-0168" },
  { name: "ForestTech Innovations", company: "ForestTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0169" },
  { name: "EcoTech Solutions", company: "EcoTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0170" },
  { name: "SustainTech Pro", company: "SustainTech Pro", email: "simon@studiopow.com", phone: "+1-555-0171" },
  { name: "RecycleTech Innovations", company: "RecycleTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0172" },
  { name: "WasteTech Solutions", company: "WasteTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0173" },
  { name: "PackagingTech Pro", company: "PackagingTech Pro", email: "simon@studiopow.com", phone: "+1-555-0174" },
  { name: "LogisticsTech Solutions", company: "LogisticsTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0175" },
  { name: "ShippingTech Innovations", company: "ShippingTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0176" },
  { name: "CargoTech Pro", company: "CargoTech Pro", email: "simon@studiopow.com", phone: "+1-555-0177" },
  { name: "DeliveryTech Solutions", company: "DeliveryTech Solutions", email: "simon@studiopow.com", phone: "+1-555-0178" },
  { name: "WarehouseTech Innovations", company: "WarehouseTech Innovations", email: "simon@studiopow.com", phone: "+1-555-0179" },
  { name: "InventoryTech Pro", company: "InventoryTech Pro", email: "simon@studiopow.com", phone: "+1-555-0180" }
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
      const issueDate = getRandomDate(monthsBack);
      const dueDate = new Date(issueDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from issue
      
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