/**
 * Exception groupings — shared between Summary card and Exceptions sub-tabs.
 * Any change here is reflected in both places automatically.
 */

export const EXCEPTION_GROUPS = {
  collections: [
    "dispute",
    "unresponsive",
    "wants_human",
    "compliance_failure",
    "broken_promise",
  ],
  debtor_situations: [
    "distress",
    "service_issue",
    "missing_po",
    "insolvency_risk",
    "complaint",
  ],
  other: ["other"],
} as const;

export type ExceptionSubTab = "collections" | "debtor_situations" | "other";

export const EXCEPTION_SUB_TABS: { value: ExceptionSubTab; label: string }[] = [
  { value: "collections", label: "Collections" },
  { value: "debtor_situations", label: "Debtor Situations" },
  { value: "other", label: "Other" },
];

export const VALID_EXCEPTION_SUBS = new Set<ExceptionSubTab>([
  "collections",
  "debtor_situations",
  "other",
]);

/** Classify an exception reason string into a group. */
export function classifyException(reason: string | null): ExceptionSubTab | null {
  if (!reason) return null;
  const r = reason.toLowerCase();
  for (const [group, types] of Object.entries(EXCEPTION_GROUPS)) {
    if (types.some((t) => r.includes(t))) return group as ExceptionSubTab;
  }
  return null;
}

/** Get the set of exception reason keywords for a given sub-tab. */
export function getGroupTypes(sub: ExceptionSubTab): readonly string[] {
  return EXCEPTION_GROUPS[sub];
}
