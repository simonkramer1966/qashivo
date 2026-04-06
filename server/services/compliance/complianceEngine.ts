/**
 * Compliance Engine — Rule-based v1
 * MVP v1 Build Spec Section 1.3.
 *
 * Every LLM-generated email passes through this engine before delivery.
 * Checks frequency caps, channel cooldowns, time-of-day, prohibited language,
 * data isolation, and debtor vulnerability.
 */

import { db } from "../../db";
import { eq, and, gte, desc, inArray, or, isNull, notInArray, sql } from "drizzle-orm";
import {
  tenants,
  contacts,
  invoices,
  actions,
  complianceChecks,
  customerPreferences,
} from "@shared/schema";
import { storage } from "../../storage";

// ── Types ────────────────────────────────────────────────────

export type ComplianceAction = "send" | "block" | "regenerate" | "queue_for_approval";

export interface ComplianceResult {
  approved: boolean;
  violations: string[];
  action: ComplianceAction;
  rulesChecked: string[];
}

export interface ComplianceInput {
  tenantId: string;
  contactId: string;
  actionId?: string;
  emailSubject: string;
  emailBody: string;
  toneLevel: "friendly" | "professional" | "firm" | "formal";
  agentReasoning?: string;
}

// ── Prohibited language patterns ─────────────────────────────

const LEGAL_THREAT_PATTERNS = [
  /\bcourt\s+action\b/i,
  /\blegal\s+proceedings?\b/i,
  /\bsolicitor/i,
  /\blawyer/i,
  /\blitigat/i,
  /\bcounty\s+court\s+judgm/i,
  /\bccj\b/i,
  /\bstatutory\s+demand\b/i,
  /\bwinding[\s-]?up\b/i,
  /\bbailiff/i,
  /\benforcement\s+agent/i,
];

const HARASSMENT_PATTERNS = [
  /\byou\s+must\s+pay\s+immediately\s+or\b/i,
  /\bfailure\s+to\s+pay\s+will\s+result\b/i,
  /\bwe\s+will\s+have\s+no\s+(choice|option)\s+but\b/i,
  /\bfinal\s+warning\b/i,
  /\blast\s+chance\b/i,
];

const DEBTOR_FACING_PROHIBITED = [
  /\bpromise\s+to\s+pay\b/i,
  /\bpromised\s+to\s+pay\b/i,
  /\bpayment\s+promise\b/i,
  /\bPTP\b/,
];

const PROFANITY_PATTERNS = [
  /\b(?:damn|hell|crap|bloody|bastard|shit|fuck|arse|bollocks|bugger|piss)\b/i,
];

// ── Main compliance check ────────────────────────────────────

export async function checkCompliance(input: ComplianceInput): Promise<ComplianceResult> {
  const violations: string[] = [];
  const rulesChecked: string[] = [];

  // Load tenant settings, contact, and preferences in parallel
  const [tenant, contact, debtorPrefs] = await Promise.all([
    loadTenant(input.tenantId),
    loadContact(input.tenantId, input.contactId),
    db.query.customerPreferences.findFirst({
      where: and(
        eq(customerPreferences.contactId, input.contactId),
        eq(customerPreferences.tenantId, input.tenantId),
      ),
      columns: {
        bestContactWindowStart: true,
        bestContactWindowEnd: true,
        contactTimezone: true,
        doNotContactFrom: true,
        doNotContactUntil: true,
      },
    }),
  ]);

  if (!tenant) {
    return { approved: false, violations: ["Tenant not found"], action: "block", rulesChecked: [] };
  }
  if (!contact) {
    return { approved: false, violations: ["Contact not found"], action: "block", rulesChecked: [] };
  }

  // ── Rule 1: Frequency cap ───────────────────────────────
  rulesChecked.push("frequency_cap");
  const maxTouches = tenant.maxTouchesPerWindow ?? 3;
  const windowDays = tenant.contactWindowDays ?? 14;
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);

  // Only count actions that were actually sent/completed — not pending/failed ones
  const SENT_STATUSES = ["completed", "sent", "delivered"];
  const recentActions = await db
    .select()
    .from(actions)
    .where(and(
      eq(actions.tenantId, input.tenantId),
      eq(actions.contactId, input.contactId),
      gte(actions.createdAt, windowStart),
      inArray(actions.status, SENT_STATUSES),
      or(
        isNull(actions.deliveryStatus),
        notInArray(actions.deliveryStatus, ['failed', 'failed_permanent', 'bounced']),
      ),
    ));

  const outboundCount = recentActions.filter(a =>
    a.type === "email" || a.type === "sms" || a.type === "call"
  ).length;

  if (outboundCount >= maxTouches) {
    violations.push(`Frequency cap: ${outboundCount} touches in last ${windowDays} days (max ${maxTouches})`);
  }

  // ── Rule 2: Channel cooldown ────────────────────────────
  rulesChecked.push("channel_cooldown");
  const cooldowns = (tenant.channelCooldowns as { email?: number; sms?: number; voice?: number } | null) ?? { email: 3 };
  const emailCooldownDays = cooldowns.email ?? 3;
  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - emailCooldownDays);

  const recentEmails = await db
    .select()
    .from(actions)
    .where(and(
      eq(actions.tenantId, input.tenantId),
      eq(actions.contactId, input.contactId),
      eq(actions.type, "email"),
      gte(actions.createdAt, cooldownStart),
      inArray(actions.status, SENT_STATUSES),
    ))
    .orderBy(desc(actions.createdAt))
    .limit(1);

  if (recentEmails.length > 0) {
    const lastEmailDate = recentEmails[0].createdAt;
    if (lastEmailDate) {
      const daysSince = Math.floor((Date.now() - lastEmailDate.getTime()) / (1000 * 60 * 60 * 24));
      violations.push(`Channel cooldown: last email was ${daysSince} day(s) ago (minimum ${emailCooldownDays})`);
    }
  }

  // ── Rule 3: Time-of-day (per-debtor hours override tenant) ──
  rulesChecked.push("time_of_day");
  const debtorStartStr = debtorPrefs?.bestContactWindowStart ?? tenant.businessHoursStart ?? "08:00";
  const debtorEndStr = debtorPrefs?.bestContactWindowEnd ?? tenant.businessHoursEnd ?? "18:00";
  const debtorTz = debtorPrefs?.contactTimezone ?? tenant.executionTimezone ?? "Europe/London";
  const startHour = parseTime(debtorStartStr);
  const endHour = parseTime(debtorEndStr);
  const currentHour = getCurrentHourInTimezone(debtorTz);

  if (currentHour < startHour || currentHour >= endHour) {
    violations.push(`Time-of-day: current time outside business hours (${debtorStartStr}–${debtorEndStr}${debtorPrefs?.bestContactWindowStart ? ' [debtor override]' : ''})`);
  }

  // ── Rule 3b: Blackout / do-not-contact ────────────────
  rulesChecked.push("blackout_period");
  if (debtorPrefs?.doNotContactUntil) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const until = new Date(debtorPrefs.doNotContactUntil);
    until.setHours(0, 0, 0, 0);
    const from = debtorPrefs.doNotContactFrom ? new Date(debtorPrefs.doNotContactFrom) : until;
    from.setHours(0, 0, 0, 0);
    if (today >= from && today <= until) {
      violations.push(`Blackout: debtor is in a do-not-contact period until ${until.toISOString().slice(0, 10)}`);
    }
  }

  // ── Rule 4: Prohibited language ─────────────────────────
  rulesChecked.push("prohibited_language");
  const fullContent = `${input.emailSubject}\n${input.emailBody}`;

  // Legal threats — only allowed in formal/final_notice
  if (input.toneLevel !== "formal") {
    for (const pattern of LEGAL_THREAT_PATTERNS) {
      if (pattern.test(fullContent)) {
        violations.push(`Prohibited language: legal threat detected ("${fullContent.match(pattern)?.[0]}") — not permitted at tone level "${input.toneLevel}"`);
        break;
      }
    }
  }

  // Harassment patterns
  for (const pattern of HARASSMENT_PATTERNS) {
    if (pattern.test(fullContent)) {
      violations.push(`Prohibited language: harassment pattern detected ("${fullContent.match(pattern)?.[0]}")`);
      break;
    }
  }

  // Debtor-facing prohibited language (e.g. "promise to pay" — sounds like a collections system)
  for (const pattern of DEBTOR_FACING_PROHIBITED) {
    if (pattern.test(fullContent)) {
      violations.push(`Prohibited language: collections terminology detected ("${fullContent.match(pattern)?.[0]}") — use natural business language instead`);
      break;
    }
  }

  // Profanity
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(fullContent)) {
      violations.push(`Prohibited language: profanity detected`);
      break;
    }
  }

  // ── Rule 5: Data isolation ──────────────────────────────
  rulesChecked.push("data_isolation");
  const dataIsolationViolation = await checkDataIsolation(
    input.tenantId,
    input.contactId,
    fullContent,
  );
  if (dataIsolationViolation) {
    violations.push(dataIsolationViolation);
  }

  // ── Rule 6: Debtor vulnerability ────────────────────────
  rulesChecked.push("debtor_vulnerability");
  if (contact.isPotentiallyVulnerable) {
    const toneOrder = ["friendly", "professional", "firm", "formal"];
    const toneIndex = toneOrder.indexOf(input.toneLevel);
    const maxIndex = toneOrder.indexOf("professional");
    if (toneIndex > maxIndex) {
      violations.push(`Debtor vulnerability: tone "${input.toneLevel}" exceeds maximum "professional" for vulnerable customer`);
    }
  }

  // ── Determine action ───────────────────────────────────
  const action = determineAction(violations, rulesChecked);

  // ── Log the compliance check ────────────────────────────
  await storage.createComplianceCheck({
    tenantId: input.tenantId,
    actionId: input.actionId ?? null,
    contactId: input.contactId,
    checkResult: action === "send" ? "approved" : action === "regenerate" ? "regenerated" : action === "queue_for_approval" ? "queued" : "blocked",
    rulesChecked,
    violations: violations.length > 0 ? violations : null,
    agentReasoning: input.agentReasoning ?? null,
    reviewedBy: null,
    reviewedAt: null,
  });

  return {
    approved: violations.length === 0,
    violations,
    action,
    rulesChecked,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours || 0) + (minutes || 0) / 60;
}

function getCurrentHourInTimezone(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return hour + minute / 60;
  } catch {
    // Invalid timezone — fall back to Europe/London
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return hour + minute / 60;
  }
}

function determineAction(violations: string[], _rulesChecked: string[]): ComplianceAction {
  if (violations.length === 0) return "send";

  const hasVulnerabilityViolation = violations.some(v => v.startsWith("Debtor vulnerability"));
  if (hasVulnerabilityViolation) return "regenerate";

  const hasTimeViolation = violations.some(v => v.startsWith("Time-of-day"));
  if (violations.length === 1 && hasTimeViolation) return "queue_for_approval";

  const hasProhibitedLanguage = violations.some(v => v.startsWith("Prohibited language"));
  const hasDataIsolation = violations.some(v => v.startsWith("Data isolation"));
  if (hasProhibitedLanguage || hasDataIsolation) return "block";

  // Frequency cap / cooldown violations → queue for human review
  return "queue_for_approval";
}

async function loadTenant(tenantId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return tenant;
}

async function loadContact(tenantId: string, contactId: string) {
  const [contact] = await db.select().from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
    .limit(1);
  return contact;
}

/**
 * Verify email content only references the target debtor's invoices.
 * Cross-references invoice numbers and amounts mentioned in the email
 * against other debtors' invoices in the same tenant.
 */
async function checkDataIsolation(
  tenantId: string,
  contactId: string,
  content: string,
): Promise<string | null> {
  // Get all invoices for this tenant that do NOT belong to this contact
  const otherInvoices = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      amount: invoices.amount,
      contactId: invoices.contactId,
    })
    .from(invoices)
    .where(and(
      eq(invoices.tenantId, tenantId),
    ));

  for (const inv of otherInvoices) {
    // Skip the target debtor's own invoices
    if (inv.contactId === contactId) continue;
    if (!inv.invoiceNumber) continue;

    const num = inv.invoiceNumber.trim();

    // Purely numeric invoice numbers need to be long enough to avoid
    // matching amounts, dates, and other incidental numbers in the body.
    // Alphanumeric prefixed numbers (e.g. "INV-109") are specific enough
    // at any length.
    const isNumericOnly = /^\d+$/.test(num);
    if (isNumericOnly && num.length < 5) continue;
    if (!isNumericOnly && num.length < 3) continue;

    // Build a pattern that won't match inside larger numbers or currency amounts.
    // For numeric-only: require non-digit (or start/end) on both sides so
    // "109" won't match inside "£1,109" or "21090".
    // For alphanumeric: standard word boundaries are sufficient.
    const escaped = num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = isNumericOnly
      ? new RegExp(`(?<!\\d)${escaped}(?!\\d)`)
      : new RegExp(`\\b${escaped}\\b`);

    if (pattern.test(content)) {
      return `Data isolation: email references invoice "${num}" which belongs to a different debtor`;
    }
  }

  return null;
}
