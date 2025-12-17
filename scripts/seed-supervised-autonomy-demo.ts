import { storage } from "../server/storage";
import type { InsertContact, InsertInvoice, InsertAction } from "../shared/schema";

const DEMO_TENANT_ID = "6feb7f4d-ba6f-4a67-936e-9cff78f49c59";

async function seedSupervisedAutonomyDemo() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  QASHIVO - SUPERVISED AUTONOMY DEMO DATA                     ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");
  console.log(`📋 Target Tenant: Investor Demo Ltd`);
  console.log(`🆔 Tenant ID: ${DEMO_TENANT_ID}\n`);

  try {
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    const showcaseDebtors = [
      {
        name: "Marcus Thompson",
        company: "Thompson Engineering Ltd",
        email: "marcus.thompson@thompson-eng.co.uk",
        phone: "+447716273336",
        invoices: [
          { amount: 1575000, daysOverdue: 35, description: "Industrial Equipment Maintenance Q3" },
          { amount: 425000, daysOverdue: 12, description: "Emergency Repair Services" }
        ],
        actions: [
          { type: "email", status: "completed", daysAgo: 32, outcome: { answered: true, outcome: "no_response", sentiment: "neutral" } },
          { type: "sms", status: "completed", daysAgo: 25, outcome: { delivered: true, outcome: "acknowledged" } },
          { type: "email", status: "completed", daysAgo: 18, outcome: { answered: true, outcome: "promised_payment", promisedAmount: 100000, promisedDate: new Date(now.getTime() + 7 * oneDay) } },
          { type: "voice", status: "completed", daysAgo: 10, outcome: { answered: true, outcome: "ptp_obtained", promisedAmount: 1575000, promisedDate: new Date(now.getTime() - 3 * oneDay), sentiment: "cooperative" } },
          { type: "email", status: "completed", daysAgo: 2, outcome: { sent: true, outcome: "ptp_breach_followup" } },
          { type: "voice", status: "scheduled", daysAgo: 0, outcome: null }
        ]
      },
      {
        name: "Sarah Mitchell",
        company: "Mitchell Design Studio",
        email: "sarah@mitchell-design.co.uk",
        phone: "+447716273336",
        invoices: [
          { amount: 875000, daysOverdue: 21, description: "Brand Identity Project" }
        ],
        actions: [
          { type: "email", status: "completed", daysAgo: 18, outcome: { sent: true, outcome: "delivered" } },
          { type: "email", status: "completed", daysAgo: 11, outcome: { answered: true, outcome: "dispute_raised", disputeReason: "Work incomplete - final deliverables not received" } },
          { type: "sms", status: "exception", daysAgo: 0, outcome: null }
        ]
      },
      {
        name: "James Crawford",
        company: "Crawford & Sons Construction",
        email: "accounts@crawford-construction.co.uk",
        phone: "+447716273336",
        invoices: [
          { amount: 2850000, daysOverdue: 45, description: "Site Preparation Phase 1" },
          { amount: 1250000, daysOverdue: 28, description: "Materials Supply Oct 2024" }
        ],
        actions: [
          { type: "email", status: "completed", daysAgo: 42, outcome: { sent: true, outcome: "delivered" } },
          { type: "sms", status: "completed", daysAgo: 35, outcome: { delivered: true, outcome: "no_response" } },
          { type: "voice", status: "completed", daysAgo: 28, outcome: { answered: false, outcome: "voicemail_left" } },
          { type: "email", status: "completed", daysAgo: 21, outcome: { sent: true, outcome: "delivered" } },
          { type: "voice", status: "completed", daysAgo: 14, outcome: { answered: true, outcome: "callback_requested", callbackTime: new Date(now.getTime() + 2 * oneDay), sentiment: "busy" } },
          { type: "voice", status: "completed", daysAgo: 7, outcome: { answered: true, outcome: "ptp_obtained", promisedAmount: 4100000, promisedDate: new Date(now.getTime() + 14 * oneDay), sentiment: "positive" } },
          { type: "email", status: "scheduled", daysAgo: 0, outcome: null }
        ]
      },
      {
        name: "Emma Richardson",
        company: "Richardson Legal Services",
        email: "emma.r@richardson-legal.co.uk",
        phone: "+447716273336",
        invoices: [
          { amount: 1250000, daysOverdue: 14, description: "Legal Consultation Services Q4" }
        ],
        actions: [
          { type: "email", status: "completed", daysAgo: 11, outcome: { sent: true, outcome: "delivered" } },
          { type: "voice", status: "completed", daysAgo: 4, outcome: { answered: true, outcome: "ptp_obtained", promisedAmount: 1250000, promisedDate: new Date(now.getTime() + 3 * oneDay), sentiment: "cooperative" } },
          { type: "email", status: "pending", daysAgo: 0, outcome: null }
        ]
      },
      {
        name: "David Patterson",
        company: "Patterson Tech Solutions",
        email: "david@patterson-tech.com",
        phone: "+447716273336",
        invoices: [
          { amount: 560000, daysOverdue: 7, description: "IT Support Contract November" }
        ],
        actions: [
          { type: "email", status: "completed", daysAgo: 5, outcome: { sent: true, outcome: "acknowledged" } },
          { type: "sms", status: "pending", daysAgo: 0, outcome: null }
        ]
      }
    ];

    console.log("🧹 Clearing existing demo actions...");
    try {
      const existingActions = await storage.getActions(DEMO_TENANT_ID);
      for (const action of existingActions) {
        await storage.deleteActionItem(action.id, DEMO_TENANT_ID);
      }
      console.log(`  ✅ Cleared ${existingActions.length} existing actions\n`);
    } catch (e) {
      console.log("  ⚠️ Could not clear actions, continuing...\n");
    }

    let contactsCreated = 0;
    let invoicesCreated = 0;
    let actionsCreated = 0;
    let invoiceSequence = 5000;

    for (const debtor of showcaseDebtors) {
      console.log(`\n👤 Creating ${debtor.name} (${debtor.company})`);

      const contactData: InsertContact = {
        tenantId: DEMO_TENANT_ID,
        name: debtor.name,
        email: debtor.email,
        phone: debtor.phone,
        companyName: debtor.company,
        paymentTerms: 30,
        preferredContactMethod: "email",
        isActive: true
      };

      const contact = await storage.createContact(contactData);
      contactsCreated++;
      console.log(`  ✅ Contact created: ${contact.id}`);

      for (const inv of debtor.invoices) {
        const dueDate = new Date(now.getTime() - inv.daysOverdue * oneDay);
        const issueDate = new Date(dueDate.getTime() - 30 * oneDay);
        
        const invoiceData: InsertInvoice = {
          tenantId: DEMO_TENANT_ID,
          contactId: contact.id,
          invoiceNumber: `QAS-SA-${invoiceSequence++}`,
          amount: inv.amount.toString(),
          amountPaid: "0",
          taxAmount: Math.floor(inv.amount * 0.2).toString(),
          status: "overdue",
          issueDate,
          dueDate,
          description: inv.description,
          currency: "GBP"
        };

        const invoice = await storage.createInvoice(invoiceData);
        invoicesCreated++;
        console.log(`  📄 Invoice: £${(inv.amount / 100).toFixed(2)} - ${inv.daysOverdue} days overdue`);

        for (const act of debtor.actions) {
          const scheduledFor = new Date(now.getTime() - act.daysAgo * oneDay);
          const completedAt = act.status === "completed" ? scheduledFor : null;

          const priorityScore = Math.min(100, 50 + inv.daysOverdue + (inv.amount / 100000));

          const actionData: InsertAction = {
            tenantId: DEMO_TENANT_ID,
            contactId: contact.id,
            invoiceId: invoice.id,
            type: act.type as "email" | "sms" | "voice" | "whatsapp" | "letter",
            status: act.status as "pending" | "scheduled" | "completed" | "failed" | "exception" | "cancelled",
            priority: Math.round(priorityScore),
            scheduledFor,
            completedAt,
            outcome: act.outcome,
            triggeredBy: "ai_scheduler",
            approvalStatus: act.status === "pending" ? "pending" : act.status === "exception" ? "requires_review" : "approved",
            confidenceScore: act.status === "exception" ? "0.65" : "0.92"
          };

          await storage.createAction(actionData);
          actionsCreated++;
        }
      }

      console.log(`  📊 Created ${debtor.actions.length} actions for ${debtor.name}`);
    }

    console.log("\n" + "═".repeat(65));
    console.log("\n🎉 SUPERVISED AUTONOMY DEMO DATA COMPLETE!\n");
    console.log("📊 Summary:");
    console.log(`   • ${contactsCreated} showcase debtors created`);
    console.log(`   • ${invoicesCreated} invoices (£500 - £28,500)`);
    console.log(`   • ${actionsCreated} actions across email/SMS/voice`);
    console.log("\n🎯 Demo Highlights:");
    console.log("   • Marcus Thompson: PTP breach scenario (promised £15,750, missed deadline)");
    console.log("   • Sarah Mitchell: Active dispute (work quality concerns)");
    console.log("   • James Crawford: Callback + fresh PTP (£41,000 promised in 14 days)");
    console.log("   • Emma Richardson: Cooperative debtor with recent PTP");
    console.log("   • David Patterson: Early stage collection (7 days overdue)");
    console.log("\n✨ Ready for Gerald demo!\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ SEEDING FAILED:", error);
    process.exit(1);
  }
}

seedSupervisedAutonomyDemo();
