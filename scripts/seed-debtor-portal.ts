import { storage } from "../server/storage";
import type { InsertContact, InsertInvoice } from "../shared/schema";
import { db } from "../server/db";
import { disputes, promisesToPay } from "../shared/schema";

// Use the Demo Company Ltd tenant for debtor portal testing
const DEMO_TENANT_ID = "6feb7f4d-ba6f-4a67-936e-9cff78f49c59"; // Demo Company Ltd

async function seedDebtorPortalData() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║   DEBTOR PORTAL - TEST DATA SEEDING SCRIPT       ║");
  console.log("╚═══════════════════════════════════════════════════╝");
  console.log("");
  console.log(`📋 Target Tenant: Demo Company Ltd`);
  console.log(`🆔 Tenant ID: ${DEMO_TENANT_ID}`);
  console.log("");
  
  try {
    // Create 2 test buyers
    console.log("👥 Creating 2 test buyers...");
    
    const buyer1Data: InsertContact = {
      tenantId: DEMO_TENANT_ID,
      name: "Alex Thompson",
      email: "alex.thompson@testbuyer.com",
      phone: "+447700900123",
      companyName: "Thompson Digital Ltd",
      paymentTerms: 30,
      preferredContactMethod: "email",
      isActive: true
    };
    
    const buyer2Data: InsertContact = {
      tenantId: DEMO_TENANT_ID,
      name: "Emma Richardson",
      email: "emma.richardson@testbuyer.com",
      phone: "+447700900456",
      companyName: "Richardson Creative Agency",
      paymentTerms: 30,
      preferredContactMethod: "email",
      isActive: true
    };
    
    const buyer1 = await storage.createContact(buyer1Data);
    const buyer2 = await storage.createContact(buyer2Data);
    
    console.log(`  ✅ Created ${buyer1.name} (${buyer1.companyName})`);
    console.log(`  ✅ Created ${buyer2.name} (${buyer2.companyName})`);
    console.log("");
    
    // Create 3 invoices for buyer 1
    console.log(`💰 Creating 3 invoices for ${buyer1.name}...`);
    
    const now = new Date();
    
    // Invoice 1: Regular overdue invoice (15 days overdue)
    const invoice1Data: InsertInvoice = {
      tenantId: DEMO_TENANT_ID,
      contactId: buyer1.id,
      invoiceNumber: "INV-2025-001",
      issueDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      dueDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      amount: "1250.00",
      amountPaid: "0",
      status: "overdue",
      description: "Website Development - Phase 1",
      currency: "GBP",
      source: "manual"
    };
    
    const invoice1 = await storage.createInvoice(invoice1Data);
    console.log(`  ✅ Invoice ${invoice1.invoiceNumber}: £1,250.00 - 15 days overdue (interest accruing)`);
    
    // Invoice 2: Disputed invoice (will add dispute after creation)
    const invoice2Data: InsertInvoice = {
      tenantId: DEMO_TENANT_ID,
      contactId: buyer1.id,
      invoiceNumber: "INV-2025-002",
      issueDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      dueDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      amount: "3450.00",
      amountPaid: "0",
      status: "overdue",
      description: "Mobile App Development",
      currency: "GBP",
      source: "manual"
    };
    
    const invoice2 = await storage.createInvoice(invoice2Data);
    console.log(`  ✅ Invoice ${invoice2.invoiceNumber}: £3,450.00 - 30 days overdue (DISPUTED)`);
    
    // Invoice 3: Invoice with active promise to pay
    const invoice3Data: InsertInvoice = {
      tenantId: DEMO_TENANT_ID,
      contactId: buyer1.id,
      invoiceNumber: "INV-2025-003",
      issueDate: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
      dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      amount: "875.00",
      amountPaid: "0",
      status: "overdue",
      description: "SEO Optimization Services",
      currency: "GBP",
      source: "manual"
    };
    
    const invoice3 = await storage.createInvoice(invoice3Data);
    console.log(`  ✅ Invoice ${invoice3.invoiceNumber}: £875.00 - 5 days overdue (PROMISE TO PAY)`);
    console.log("");
    
    // Create 3 invoices for buyer 2
    console.log(`💰 Creating 3 invoices for ${buyer2.name}...`);
    
    // Invoice 4: Recent invoice (not yet due)
    const invoice4Data: InsertInvoice = {
      tenantId: DEMO_TENANT_ID,
      contactId: buyer2.id,
      invoiceNumber: "INV-2025-004",
      issueDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      dueDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000), // 20 days in future
      amount: "2250.00",
      amountPaid: "0",
      status: "pending",
      description: "Digital Marketing Campaign - Q1",
      currency: "GBP",
      source: "manual"
    };
    
    const invoice4 = await storage.createInvoice(invoice4Data);
    console.log(`  ✅ Invoice ${invoice4.invoiceNumber}: £2,250.00 - Due in 20 days`);
    
    // Invoice 5: Slightly overdue (3 days)
    const invoice5Data: InsertInvoice = {
      tenantId: DEMO_TENANT_ID,
      contactId: buyer2.id,
      invoiceNumber: "INV-2025-005",
      issueDate: new Date(now.getTime() - 33 * 24 * 60 * 60 * 1000), // 33 days ago
      dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      amount: "1560.00",
      amountPaid: "0",
      status: "overdue",
      description: "Brand Identity Design",
      currency: "GBP",
      source: "manual"
    };
    
    const invoice5 = await storage.createInvoice(invoice5Data);
    console.log(`  ✅ Invoice ${invoice5.invoiceNumber}: £1,560.00 - 3 days overdue`);
    
    // Invoice 6: Partially paid invoice (will add promise to pay for remaining balance)
    const invoice6Data: InsertInvoice = {
      tenantId: DEMO_TENANT_ID,
      contactId: buyer2.id,
      invoiceNumber: "INV-2025-006",
      issueDate: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000), // 50 days ago
      dueDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      amount: "4500.00",
      amountPaid: "2000.00", // £2,000.00 paid (44% paid)
      status: "overdue",
      description: "E-Commerce Platform Development",
      currency: "GBP",
      source: "manual"
    };
    
    const invoice6 = await storage.createInvoice(invoice6Data);
    console.log(`  ✅ Invoice ${invoice6.invoiceNumber}: £4,500.00 (£2,000 paid) - 20 days overdue (PROMISE TO PAY)`);
    console.log("");
    
    // Create formal dispute for invoice 2
    console.log("⚖️  Creating formal dispute for invoice INV-2025-002...");
    
    const responseDue = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    const dispute = await db.insert(disputes).values({
      tenantId: DEMO_TENANT_ID,
      invoiceId: invoice2.id,
      contactId: buyer1.id,
      type: "quality",
      status: "pending",
      summary: "Service quality issues: The mobile app delivered has significant bugs and does not meet the specifications outlined in the contract. We identified 15 critical issues that make the app unusable in production. We request a 50% reduction in the invoice amount or a complete rework of the application at no additional cost.",
      buyerContactName: buyer1.name,
      buyerContactEmail: buyer1.email,
      buyerContactPhone: buyer1.phone,
      responseDueAt: responseDue
    }).returning();
    
    console.log(`  ✅ Dispute created: quality issue (Response due: ${responseDue.toISOString().split('T')[0]})`);
    console.log("");
    
    // Create promise to pay for invoice 3
    console.log("🤝 Creating promise to pay for invoice INV-2025-003...");
    const ptp1 = await db.insert(promisesToPay).values({
      tenantId: DEMO_TENANT_ID,
      invoiceId: invoice3.id,
      contactId: buyer1.id,
      contactName: buyer1.name,
      contactEmail: buyer1.email,
      contactPhone: buyer1.phone,
      amount: "875.00", // Full amount
      promisedDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      paymentMethod: "bank_transfer",
      status: "active",
      createdVia: "debtor_portal",
      notes: "Will pay in full within 7 days after receiving client payment"
    }).returning();
    
    console.log(`  ✅ Promise to pay: £875.00 - Due in 7 days`);
    console.log("");
    
    // Create promise to pay for invoice 6 (partial payment)
    console.log("🤝 Creating promise to pay for invoice INV-2025-006...");
    const ptp2 = await db.insert(promisesToPay).values({
      tenantId: DEMO_TENANT_ID,
      invoiceId: invoice6.id,
      contactId: buyer2.id,
      contactName: buyer2.name,
      contactEmail: buyer2.email,
      contactPhone: buyer2.phone,
      amount: "2500.00", // Remaining £2,500.00
      promisedDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      paymentMethod: "bank_transfer",
      status: "active",
      createdVia: "debtor_portal",
      notes: "Will pay remaining balance in two weeks when project milestone payment is received"
    }).returning();
    
    console.log(`  ✅ Promise to pay: £2,500.00 - Due in 14 days`);
    console.log("");
    
    console.log("╔═══════════════════════════════════════════════════╗");
    console.log("║            ✅ SEEDING COMPLETED!                  ║");
    console.log("╚═══════════════════════════════════════════════════╝");
    console.log("");
    console.log("🎯 Debtor portal test data created:");
    console.log("");
    console.log("👥 Buyers:");
    console.log(`   • ${buyer1.name} (${buyer1.companyName})`);
    console.log(`     Email: ${buyer1.email} | Phone: ${buyer1.phone}`);
    console.log(`   • ${buyer2.name} (${buyer2.companyName})`);
    console.log(`     Email: ${buyer2.email} | Phone: ${buyer2.phone}`);
    console.log("");
    console.log("💰 Invoices:");
    console.log("   Buyer 1 (Alex Thompson):");
    console.log(`     • INV-2025-001: £1,250.00 - 15 days overdue (interest accruing)`);
    console.log(`     • INV-2025-002: £3,450.00 - 30 days overdue ⚖️  DISPUTED`);
    console.log(`     • INV-2025-003: £875.00 - 5 days overdue 🤝 PROMISE TO PAY (7 days)`);
    console.log("   Buyer 2 (Emma Richardson):");
    console.log(`     • INV-2025-004: £2,250.00 - Due in 20 days`);
    console.log(`     • INV-2025-005: £1,560.00 - 3 days overdue`);
    console.log(`     • INV-2025-006: £4,500.00 (£2,000 paid) - 20 days overdue 🤝 PROMISE TO PAY (14 days)`);
    console.log("");
    console.log("🔗 Magic Link Access:");
    console.log(`   1. Set DEBUG_AUTH=true in environment`);
    console.log(`   2. POST to /api/debtor/auth/request-link`);
    console.log(`   3. Use email: ${buyer1.email} or ${buyer2.email}`);
    console.log("");
    console.log("🚀 Ready for debtor portal testing!");
    
    process.exit(0);
  } catch (error) {
    console.error("");
    console.error("╔═══════════════════════════════════════════════════╗");
    console.error("║            ❌ SEEDING FAILED!                     ║");
    console.error("╚═══════════════════════════════════════════════════╝");
    console.error("");
    console.error("Error details:", error);
    process.exit(1);
  }
}

seedDebtorPortalData();
