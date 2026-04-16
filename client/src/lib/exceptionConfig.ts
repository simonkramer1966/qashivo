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
  ],
  debtor_situations: [
    "distress",
    "service_issue",
    "missing_po",
    "insolvency_risk",
    "complaint",
  ],
  promises: ["broken_promise", "unallocated_timeout"],
  other: ["other"],
} as const;

export type ExceptionSubTab =
  | "collections"
  | "debtor_situations"
  | "promises"
  | "other";

export const EXCEPTION_SUB_TABS: { value: ExceptionSubTab; label: string }[] = [
  { value: "collections", label: "Collections" },
  { value: "debtor_situations", label: "Customer Situations" },
  { value: "promises", label: "Promises" },
  { value: "other", label: "Other" },
];

export const VALID_EXCEPTION_SUBS = new Set<ExceptionSubTab>([
  "collections",
  "debtor_situations",
  "promises",
  "other",
]);

/**
 * Classify an exception into a group. Accepts a reason string (for
 * status='exception' rows) plus the action status — failed sends are
 * always routed to Collections regardless of reason.
 */
export function classifyException(
  reason: string | null,
  status?: string | null,
): ExceptionSubTab | null {
  if (status === "failed") return "collections";
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
