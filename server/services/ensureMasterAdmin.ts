import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const MASTER_ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || "control@qashivo.com";

export async function ensureMasterAdminExists(): Promise<void> {
  const masterPassword = process.env.MASTER_ADMIN_PASSWORD;
  
  if (!masterPassword) {
    console.log("⚠️  MASTER_ADMIN_PASSWORD not configured - skipping master admin setup");
    return;
  }
  
  try {
    console.log("🔐 Checking for master admin user...");
    
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, MASTER_ADMIN_EMAIL))
      .limit(1);
    
    const hashedPassword = await bcrypt.hash(masterPassword, 10);
    
    if (existingAdmin.length > 0) {
      await db
        .update(users)
        .set({ 
          platformAdmin: true,
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(users.email, MASTER_ADMIN_EMAIL));
      console.log("✅ Master admin user updated");
      return;
    }
    
    await db.insert(users).values({
      email: MASTER_ADMIN_EMAIL,
      password: hashedPassword,
      firstName: "Qashivo",
      lastName: "Control",
      role: "owner",
      platformAdmin: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    console.log("✅ Master admin user created successfully");
  } catch (error) {
    console.error("❌ Failed to ensure master admin user:", error);
  }
}
