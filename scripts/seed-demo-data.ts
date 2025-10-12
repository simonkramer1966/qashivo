import { generateMockData } from "../server/mock-data";

const DEMO_TENANT_ID = "6feb7f4d-ba6f-4a67-936e-9cff78f49c59"; // Investor Demo Ltd

async function seedDemoData() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║     NEXUS AR - DEMO DATA SEEDING SCRIPT          ║");
  console.log("╚═══════════════════════════════════════════════════╝");
  console.log("");
  console.log(`📋 Target Tenant: Investor Demo Ltd`);
  console.log(`🆔 Tenant ID: ${DEMO_TENANT_ID}`);
  console.log("");
  
  try {
    await generateMockData(DEMO_TENANT_ID);
    
    console.log("");
    console.log("╔═══════════════════════════════════════════════════╗");
    console.log("║            ✅ SEEDING COMPLETED!                  ║");
    console.log("╚═══════════════════════════════════════════════════╝");
    console.log("");
    console.log("🎯 Demo tenant is now populated with:");
    console.log("   • 20 strategic test clients");
    console.log("   • 40-80 invoices with varied statuses");
    console.log("   • All contacts use: info@nexuskpi.com & +447716273336");
    console.log("   • Invoice range: £500 - £25,000");
    console.log("");
    console.log("🚀 Ready for investor demo!");
    
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

seedDemoData();
