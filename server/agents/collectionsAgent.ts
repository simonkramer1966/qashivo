/**
 * Collections Agent — legacy entry point for LLM email generation.
 *
 * Phase 1 of the consolidation refactor: this file is now a thin wrapper
 * around `debtorEmailService.generateDebtorEmail()`. The core logic — persona
 * resolution, invoice loading, conversation brief assembly, prompt assembly,
 * Claude call, validation — has moved to `server/services/debtorEmailService.ts`.
 *
 * All existing callers (collectionsPipeline, inboundReplyPipeline,
 * regenerateAtTone, etc.) continue to import `generateCollectionEmail` from
 * here and call it with the same arguments. They will be rewired to call
 * `generateDebtorEmail()` directly in Phase 2.
 *
 * CHARLIE'S OBJECTIVE: Get a payment date. Every communication exists to move
 * the debtor from silence to a committed date.
 */

import type { AgentPersona } from "@shared/schema";
import type { ActionContext } from "./prompts/collectionEmail";
import {
  generateDebtorEmail,
  type DebtorEmailType,
} from "../services/debtorEmailService";

// ── Output type (unchanged for caller compatibility) ─────────

export interface CollectionEmailResult {
  subject: string;
  body: string;
  agentReasoning: string;
  influenceDiagnosis?: {
    barrier: string;
    strategy: string;
    signals: string[];
    reasoning: string;
    confidence: string;
  };
}

// ── Public API ───────────────────────────────────────────────

/**
 * Generate a collection email for a specific debtor.
 *
 * Thin wrapper — delegates to `debtorEmailService.generateDebtorEmail()`.
 *
 * @param tenantId - Tenant scope
 * @param contactId - The debtor (contact) to email
 * @param actionContext - What kind of email this is and at what tone
 * @param personaOverride - Optional persona; if omitted uses the tenant's active persona
 * @param actionInvoiceIds - Explicit bundle from the action record
 */
export async function generateCollectionEmail(
  tenantId: string,
  contactId: string,
  actionContext: ActionContext,
  personaOverride?: AgentPersona,
  actionInvoiceIds?: string[],
): Promise<CollectionEmailResult> {
  // Map legacy actionType → new emailType. The legacy actionContext is also
  // forwarded via the internal escape hatch so the underlying prompt builder
  // sees the exact same values existing callers used to pass in.
  const emailTypeMap: Record<ActionContext["actionType"], DebtorEmailType> = {
    pre_due_reminder: "first_chase",
    follow_up: "follow_up",
    escalation: "follow_up",
    final_notice: "follow_up",
  };

  const result = await generateDebtorEmail({
    tenantId,
    contactId,
    emailType: emailTypeMap[actionContext.actionType] ?? "follow_up",
    toneLevel: actionContext.toneLevel,
    invoiceIds: actionInvoiceIds,
    sequencePosition: actionContext.touchCount,
    _legacyActionContext: actionContext,
    _personaOverride: personaOverride,
  });

  return {
    subject: result.subject,
    body: result.body,
    agentReasoning: result.agentReasoning,
    influenceDiagnosis: result.metadata.influenceDiagnosis,
  };
}
