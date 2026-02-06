import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { customerContactPersons } from "@shared/schema";

export async function resolvePrimaryEmail(contactId: string, tenantId: string, fallbackEmail?: string | null): Promise<string | null> {
  try {
    const [primaryPerson] = await db
      .select({ email: customerContactPersons.email })
      .from(customerContactPersons)
      .where(
        and(
          eq(customerContactPersons.contactId, contactId),
          eq(customerContactPersons.tenantId, tenantId),
          eq(customerContactPersons.isPrimaryCreditControl, true)
        )
      )
      .limit(1);

    if (primaryPerson?.email) {
      return primaryPerson.email;
    }
  } catch (error) {
    console.warn(`⚠️ Failed to look up primary credit control contact for ${contactId}:`, error);
  }

  return fallbackEmail || null;
}

export async function resolvePrimarySmsNumber(contactId: string, tenantId: string, fallbackPhone?: string | null): Promise<string | null> {
  try {
    const [primaryPerson] = await db
      .select({ smsNumber: customerContactPersons.smsNumber, phone: customerContactPersons.phone })
      .from(customerContactPersons)
      .where(
        and(
          eq(customerContactPersons.contactId, contactId),
          eq(customerContactPersons.tenantId, tenantId),
          eq(customerContactPersons.isPrimaryCreditControl, true)
        )
      )
      .limit(1);

    if (primaryPerson?.smsNumber) {
      return primaryPerson.smsNumber;
    }
    if (primaryPerson?.phone) {
      return primaryPerson.phone;
    }
  } catch (error) {
    console.warn(`⚠️ Failed to look up primary credit control SMS number for ${contactId}:`, error);
  }

  return fallbackPhone || null;
}
