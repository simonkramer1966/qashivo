/**
 * CIE Consumer — reads social proof data from Collective Intelligence
 * Engine segment profiles for use in influence briefs.
 *
 * STUB: The `segmentProfiles` table does not exist yet. This module
 * returns { available: false } until the CIE schema is built.
 * When the table is created, implement the fallback chain:
 *   Industry×Size×Region → Industry×Size → Industry → unavailable
 * with thresholds: sampleSize >= 20 AND tenantCount >= 5.
 *
 * Phase 5 of the Influence Engine.
 */

// ── Types ────────────────────────────────────────────────────

export interface SocialProofData {
  available: boolean;
  medianDaysToPay: number | null;
  percentSettledWithin45Days: number | null;
  sampleSize: number;
  tenantCount: number;
  confidence: "low" | "medium" | "high";
  segmentLabel: string;
}

const UNAVAILABLE: SocialProofData = {
  available: false,
  medianDaysToPay: null,
  percentSettledWithin45Days: null,
  sampleSize: 0,
  tenantCount: 0,
  confidence: "low",
  segmentLabel: "",
};

// ── Main consumer ────────────────────────────────────────────

/**
 * Look up aggregate social proof data for a debtor's industry segment.
 *
 * TODO: When `segmentProfiles` table is created, query with fallback chain:
 *   1. Industry × Size × Region (most specific)
 *   2. Industry × Size
 *   3. Industry only
 *   4. Unavailable
 * Only return available=true when sampleSize >= 20 AND tenantCount >= 5.
 */
export async function getSocialProofData(
  _segmentIndustry: string | null,
  _segmentSize: string | null,
  _segmentRegion: string | null,
): Promise<SocialProofData> {
  // Stub — segmentProfiles table does not exist yet
  if (process.env.NODE_ENV !== "production") {
    console.debug("[CIE] getSocialProofData stub — segmentProfiles table not yet created");
  }
  return UNAVAILABLE;
}
