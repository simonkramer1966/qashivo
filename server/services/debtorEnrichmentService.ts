/**
 * Debtor Intelligence Enrichment Engine — Gap 6
 *
 * Triggered:
 * - Automatically after new contacts sync from Xero (queued, non-blocking)
 * - Quarterly re-enrichment for debtors with active outstanding balances
 *
 * Sources:
 * - Companies House (company status, SIC codes, age, filing health, size)
 * - AI risk summary (Claude)
 * - CCJ register (future)
 * - AI web search (future)
 */

import { companiesHouseService } from "./companiesHouse";
import { db } from "../db";
import { debtorIntelligence, contacts, invoices } from "@shared/schema";
import { eq, and, sql, isNull, or } from "drizzle-orm";
import { generateText } from "./llm/claude";

// ── SIC Code → Sector Mapping ──────────────────────────────────

function mapSicToSector(sicCode?: string): string {
  if (!sicCode) return "Unknown";
  const prefix = sicCode.substring(0, 2);
  const sectorMap: Record<string, string> = {
    "01": "Agriculture", "02": "Forestry", "03": "Fishing",
    "05": "Mining", "06": "Mining", "07": "Mining", "08": "Mining", "09": "Mining",
    "10": "Manufacturing", "11": "Manufacturing", "12": "Manufacturing", "13": "Manufacturing",
    "20": "Manufacturing", "21": "Manufacturing", "22": "Manufacturing", "23": "Manufacturing",
    "24": "Manufacturing", "25": "Manufacturing", "26": "Manufacturing", "27": "Manufacturing",
    "28": "Manufacturing", "29": "Manufacturing", "30": "Manufacturing", "31": "Manufacturing",
    "32": "Manufacturing", "33": "Manufacturing",
    "35": "Energy", "36": "Water & Waste", "37": "Water & Waste", "38": "Water & Waste", "39": "Water & Waste",
    "41": "Construction", "42": "Construction", "43": "Construction",
    "45": "Motor Trade", "46": "Wholesale", "47": "Retail",
    "49": "Transport", "50": "Transport", "51": "Transport", "52": "Transport", "53": "Transport",
    "55": "Hospitality", "56": "Hospitality",
    "58": "Media", "59": "Media", "60": "Media", "61": "Telecoms", "62": "Technology", "63": "Technology",
    "64": "Financial Services", "65": "Financial Services", "66": "Financial Services",
    "68": "Real Estate",
    "69": "Professional Services", "70": "Professional Services", "71": "Professional Services",
    "72": "Professional Services", "73": "Professional Services", "74": "Professional Services", "75": "Professional Services",
    "77": "Rental & Leasing", "78": "Recruitment", "79": "Travel", "80": "Security", "81": "Facilities", "82": "Business Support",
    "84": "Public Administration", "85": "Education", "86": "Healthcare", "87": "Healthcare", "88": "Healthcare",
    "90": "Arts & Entertainment", "91": "Arts & Entertainment", "92": "Arts & Entertainment", "93": "Sport & Recreation",
    "94": "Membership Organisations", "95": "Repair Services", "96": "Personal Services",
  };
  return sectorMap[prefix] || "Other";
}

// ── Companies House Data Processing ─────────────────────────────

interface ProcessedIntelligence {
  companyNumber?: string;
  companyStatus?: string;
  sicCodes?: string[];
  industrySector?: string;
  companyAge?: number;
  incorporationDate?: Date;
  sizeClassification?: string;
  filingHealth?: number;
  lateFilingCount?: number;
  directorCount?: number;
  directorStability?: number;
  registeredAddress?: string;
  insolvencyRisk?: boolean;
}

function processCompaniesHouseData(
  company: any | null,
  filing: any | null,
): ProcessedIntelligence {
  if (!company) return {};

  const result: ProcessedIntelligence = {};

  result.companyNumber = company.company_number;
  result.companyStatus = company.company_status;
  result.sicCodes = company.sic_codes || [];
  result.industrySector = mapSicToSector(result.sicCodes?.[0]);

  if (company.date_of_creation) {
    const created = new Date(company.date_of_creation);
    result.incorporationDate = created;
    result.companyAge = Math.floor(
      (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    );
  }

  // Size classification from accounts type
  const accountsType = company.accounts?.last_accounts?.type || "";
  if (accountsType.includes("micro")) result.sizeClassification = "micro";
  else if (accountsType.includes("small")) result.sizeClassification = "small";
  else if (accountsType.includes("medium")) result.sizeClassification = "medium";
  else if (accountsType.includes("full") || accountsType.includes("group")) result.sizeClassification = "large";

  // Registered address
  const addr = company.registered_office_address;
  if (addr) {
    result.registeredAddress = [
      addr.address_line_1, addr.address_line_2,
      addr.locality, addr.region, addr.postal_code, addr.country,
    ].filter(Boolean).join(", ");
  }

  // Insolvency risk
  result.insolvencyRisk = ["liquidation", "receivership", "administration", "insolvency-proceedings"]
    .includes(company.company_status || "");

  // Filing health from filing history
  if (filing?.items) {
    const lateFilings = filing.items.filter((f: any) =>
      f.type?.includes("late-filing") ||
      f.description?.toLowerCase().includes("late filing") ||
      f.category === "penalty",
    );
    result.lateFilingCount = lateFilings.length;
    result.filingHealth = Math.max(0, 100 - lateFilings.length * 10);
  }

  return result;
}

// ── Credit Risk Scoring ─────────────────────────────────────────

function calculateCreditRiskScore(intelligence: ProcessedIntelligence): number {
  let score = 50; // neutral baseline

  // Positive signals
  if (intelligence.companyAge && intelligence.companyAge > 10) score += 15;
  else if (intelligence.companyAge && intelligence.companyAge > 5) score += 10;

  if (intelligence.lateFilingCount === 0) score += 10;

  // No CCJs assumed until CCJ register is integrated
  score += 10;

  if (intelligence.sizeClassification === "medium" || intelligence.sizeClassification === "large") score += 5;

  // Negative signals
  if (intelligence.lateFilingCount) {
    score -= Math.min(15, intelligence.lateFilingCount * 3);
  }

  if (intelligence.insolvencyRisk) score -= 50;
  if (intelligence.companyStatus === "dormant") score -= 20;
  if (intelligence.companyStatus === "dissolved") score -= 50;
  if (intelligence.companyAge !== undefined && intelligence.companyAge < 2) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ── AI Risk Summary ─────────────────────────────────────────────

async function generateRiskSummary(
  companyName: string,
  intelligence: ProcessedIntelligence,
  creditRiskScore: number,
): Promise<string> {
  const context = [
    `Company: ${companyName}`,
    intelligence.companyStatus ? `Status: ${intelligence.companyStatus}` : null,
    intelligence.companyAge !== undefined ? `Age: ${intelligence.companyAge} years` : null,
    intelligence.industrySector ? `Sector: ${intelligence.industrySector}` : null,
    intelligence.sizeClassification ? `Size: ${intelligence.sizeClassification}` : null,
    intelligence.lateFilingCount !== undefined ? `Late filings: ${intelligence.lateFilingCount}` : null,
    intelligence.insolvencyRisk ? "WARNING: Insolvency risk detected" : null,
    `Credit risk score: ${creditRiskScore}/100`,
  ].filter(Boolean).join("\n");

  return generateText({
    system: "You are a credit risk analyst. Write a brief 2-3 sentence plain English assessment of this debtor's credit risk for a credit controller. Be factual and direct. Do not use jargon.",
    prompt: `Assess this debtor:\n${context}`,
    model: "fast",
    temperature: 0.3,
    logContext: { caller: 'debtor_enrichment' },
  });
}

// ── Main Enrichment Function ────────────────────────────────────

const RATE_LIMIT_DELAY_MS = 1500;

export async function enrichDebtor(
  tenantId: string,
  contactId: string,
  contactName: string,
): Promise<void> {
  console.log(`[Enrichment] Starting enrichment for ${contactName} (${contactId})`);

  // Check if enrichment already exists and is recent (< 90 days)
  const existing = await db
    .select({ id: debtorIntelligence.id, enrichedAt: debtorIntelligence.enrichedAt })
    .from(debtorIntelligence)
    .where(
      and(
        eq(debtorIntelligence.tenantId, tenantId),
        eq(debtorIntelligence.contactId, contactId),
      ),
    )
    .limit(1);

  if (existing[0]?.enrichedAt) {
    const daysSinceEnrichment =
      (Date.now() - new Date(existing[0].enrichedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceEnrichment < 90) {
      console.log(
        `[Enrichment] ${contactName} enriched ${Math.round(daysSinceEnrichment)} days ago — skipping`,
      );
      return;
    }
  }

  const enrichmentSources: string[] = [];
  let companyData: any = null;
  let filingData: any = null;

  // ── Companies House ──
  if (companiesHouseService.isConfigured()) {
    try {
      const searchResults = await companiesHouseService.searchCompany(contactName);

      if (searchResults.length > 0) {
        const bestMatch = searchResults[0];
        companyData = await companiesHouseService.getCompanyProfile(bestMatch.companyNumber);
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
        filingData = await companiesHouseService.getFilingHistory(bestMatch.companyNumber);
        enrichmentSources.push("companies_house");
        console.log(
          `[Enrichment] Companies House match: ${bestMatch.companyName} (${bestMatch.companyNumber})`,
        );
      } else {
        console.log(`[Enrichment] No Companies House match for "${contactName}"`);
      }
    } catch (err) {
      console.warn(`[Enrichment] Companies House lookup failed for ${contactName}:`, err);
    }
  }

  // ── Process data ──
  const intelligence = processCompaniesHouseData(companyData, filingData);
  const creditRiskScore = calculateCreditRiskScore(intelligence);

  // ── AI risk summary ──
  let aiRiskSummary: string | null = null;
  try {
    aiRiskSummary = await generateRiskSummary(contactName, intelligence, creditRiskScore);
    enrichmentSources.push("ai_summary");
  } catch (err) {
    console.warn("[Enrichment] AI summary generation failed:", err);
  }

  // ── Store results ──
  const enrichmentRecord = {
    tenantId,
    contactId,
    companyStatus: intelligence.companyStatus || null,
    companiesHouseNumber: intelligence.companyNumber || null,
    industryCode: intelligence.sicCodes?.join(", ") || null,
    industrySector: intelligence.industrySector || null,
    companyAge: intelligence.companyAge ?? null,
    incorporationDate: intelligence.incorporationDate || null,
    sizeClassification: intelligence.sizeClassification || null,
    filingHealth: intelligence.filingHealth?.toFixed(2) || null,
    lateFilingCount: intelligence.lateFilingCount ?? null,
    directorCount: intelligence.directorCount ?? null,
    directorStability: intelligence.directorStability?.toFixed(2) || null,
    registeredAddress: intelligence.registeredAddress || null,
    ccjCount: 0,
    ccjTotal: "0",
    insolvencyRisk: intelligence.insolvencyRisk || false,
    newsSignals: null,
    aiRiskSummary,
    creditRiskScore,
    enrichedAt: new Date(),
    enrichmentSource: enrichmentSources,
    enrichmentStatus: enrichmentSources.length > 0 ? "complete" : "failed",
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    await db
      .update(debtorIntelligence)
      .set(enrichmentRecord)
      .where(
        and(
          eq(debtorIntelligence.tenantId, tenantId),
          eq(debtorIntelligence.contactId, contactId),
        ),
      );
  } else {
    await db.insert(debtorIntelligence).values({
      ...enrichmentRecord,
      createdAt: new Date(),
    });
  }

  // Also update the contact's riskScore if enrichment produced one
  if (creditRiskScore !== null) {
    await db
      .update(contacts)
      .set({ riskScore: creditRiskScore, updatedAt: new Date() })
      .where(eq(contacts.id, contactId));
  }

  console.log(
    `[Enrichment] ${contactName}: score=${creditRiskScore}, status=${intelligence.companyStatus || "unknown"}, sources=${enrichmentSources.join(",")}`,
  );
}

// ── Batched Processing ──────────────────────────────────────────
//
// Enrichment fires Claude + Companies House API calls per contact.
// Large books (78+ contacts) previously hammered the APIs in a tight
// 1.5s-spaced loop with no cool-down. We now process in batches of
// ENRICHMENT_BATCH_SIZE with an ENRICHMENT_PAUSE_MS gap between
// batches. Individual failures are logged and the run continues.

const ENRICHMENT_BATCH_SIZE = 10;
const ENRICHMENT_PAUSE_MS = 15_000;

async function enrichInBatches(
  items: Array<{ tenantId: string; contactId: string; contactName: string }>,
  label: string,
): Promise<void> {
  if (items.length === 0) {
    console.log(`[Enrichment] ${label}: nothing to enrich`);
    return;
  }

  const totalBatches = Math.ceil(items.length / ENRICHMENT_BATCH_SIZE);
  let enrichedCount = 0;

  console.log(
    `[Enrichment] ${label}: ${items.length} contacts in ${totalBatches} batch(es) of ${ENRICHMENT_BATCH_SIZE}`,
  );

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * ENRICHMENT_BATCH_SIZE;
    const batch = items.slice(start, start + ENRICHMENT_BATCH_SIZE);

    for (const item of batch) {
      try {
        await enrichDebtor(item.tenantId, item.contactId, item.contactName);
      } catch (err) {
        console.warn(
          `[Enrichment] Failed for ${item.contactName} (${item.contactId}):`,
          err,
        );
        // Continue — one bad contact must not abort the batch.
      }
      enrichedCount++;
      // Light per-contact spacing for Companies House (2/sec limit).
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }

    console.log(
      `[Enrichment] Batch ${batchIndex + 1}/${totalBatches} complete (${enrichedCount} of ${items.length} contacts enriched)`,
    );

    // Pause between batches (skip after the final batch).
    if (batchIndex < totalBatches - 1) {
      console.log(`[Enrichment] Pausing ${ENRICHMENT_PAUSE_MS / 1000}s before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, ENRICHMENT_PAUSE_MS));
    }
  }

  console.log(`[Enrichment] ${label}: complete`);
}

// ── Batch Enrichment for New Contacts ───────────────────────────

export async function enrichNewContacts(
  tenantId: string,
  newContacts: Array<{ id: string; name: string }>,
): Promise<void> {
  await enrichInBatches(
    newContacts.map((c) => ({ tenantId, contactId: c.id, contactName: c.name })),
    `New contacts (tenant ${tenantId})`,
  );
}

// ── Quarterly Re-enrichment ─────────────────────────────────────

export async function runQuarterlyEnrichment(): Promise<void> {
  console.log("[Enrichment] Running quarterly re-enrichment");

  const debtorsToEnrich = await db
    .select({
      contactId: contacts.id,
      contactName: contacts.name,
      tenantId: contacts.tenantId,
    })
    .from(contacts)
    .leftJoin(
      debtorIntelligence,
      and(
        eq(debtorIntelligence.contactId, contacts.id),
        eq(debtorIntelligence.tenantId, contacts.tenantId),
      ),
    )
    .where(
      and(
        // Has outstanding invoices
        sql`EXISTS (
          SELECT 1 FROM invoices
          WHERE invoices.contact_id = ${contacts.id}
          AND invoices.status NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')
        )`,
        // Enrichment missing or older than 90 days
        or(
          isNull(debtorIntelligence.enrichedAt),
          sql`${debtorIntelligence.enrichedAt} < now() - interval '90 days'`,
        ),
      ),
    )
    .limit(50); // Batch limit to respect rate limits

  await enrichInBatches(
    debtorsToEnrich.map((d) => ({
      tenantId: d.tenantId,
      contactId: d.contactId,
      contactName: d.contactName,
    })),
    "Quarterly re-enrichment",
  );
}
