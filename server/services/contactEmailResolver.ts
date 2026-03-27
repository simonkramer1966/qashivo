import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { customerContactPersons } from "@shared/schema";

/**
 * Resolves the primary email for outbound communications.
 * Resolution hierarchy:
 *   1. Primary credit control contact person (customerContactPersons.isPrimaryCreditControl)
 *   2. AR overlay email (arContactEmail — Qashivo-owned, user-set)
 *   3. Fallback email (contact.email — Xero-synced)
 */
export async function resolvePrimaryEmail(
  contactId: string,
  tenantId: string,
  fallbackEmail?: string | null,
  arOverrideEmail?: string | null,
): Promise<string | null> {
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

  // AR overlay takes priority over Xero-synced email
  if (arOverrideEmail) {
    return arOverrideEmail;
  }

  return fallbackEmail || null;
}

/**
 * Resolves the primary SMS/phone number for outbound communications.
 * Resolution hierarchy:
 *   1. Primary credit control contact person (smsNumber, then phone)
 *   2. AR overlay phone (arContactPhone — Qashivo-owned, user-set)
 *   3. Fallback phone (contact.phone — Xero-synced)
 */
export async function resolvePrimarySmsNumber(
  contactId: string,
  tenantId: string,
  fallbackPhone?: string | null,
  arOverridePhone?: string | null,
): Promise<string | null> {
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

  // AR overlay takes priority over Xero-synced phone
  if (arOverridePhone) {
    return arOverridePhone;
  }

  return fallbackPhone || null;
}

/**
 * Resolves the primary contact name for outbound communications (e.g. voice calls).
 * Resolution hierarchy:
 *   1. Primary credit control contact person name
 *   2. AR overlay name (arContactName — Qashivo-owned, user-set)
 *   3. Fallback name (contact.name — Xero-synced)
 */
export async function resolvePrimaryContactName(
  contactId: string,
  tenantId: string,
  fallbackName?: string | null,
  arOverrideName?: string | null,
): Promise<string> {
  try {
    const [primaryPerson] = await db
      .select({ name: customerContactPersons.name })
      .from(customerContactPersons)
      .where(
        and(
          eq(customerContactPersons.contactId, contactId),
          eq(customerContactPersons.tenantId, tenantId),
          eq(customerContactPersons.isPrimaryCreditControl, true)
        )
      )
      .limit(1);

    if (primaryPerson?.name) {
      return primaryPerson.name;
    }
  } catch (error) {
    console.warn(`⚠️ Failed to look up primary credit control contact name for ${contactId}:`, error);
  }

  if (arOverrideName) {
    return arOverrideName;
  }

  return fallbackName || 'Customer';
}
