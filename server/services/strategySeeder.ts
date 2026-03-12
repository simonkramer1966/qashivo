import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  collectionSchedules,
  customerScheduleAssignments,
} from "@shared/schema";

const RECRUITMENT_SCHEDULE_NAME = "Recruitment Sector Default";

/**
 * Default collection strategy steps for the recruitment sector.
 * These are NOT templates — they are timing/channel/tone instructions
 * that the LLM uses to generate unique emails at each touchpoint.
 */
const RECRUITMENT_SECTOR_STEPS = [
  {
    id: "seed-pre-due",
    name: "Pre-Due Reminder",
    daysTrigger: -5,
    actionType: "email",
    toneLevel: "friendly",
    channel: "email",
    instruction: "Gentle heads-up that an invoice is approaching its due date. Keep warm and relationship-focused.",
    enabled: true,
  },
  {
    id: "seed-due-date",
    name: "Due Date Notification",
    daysTrigger: 0,
    actionType: "email",
    toneLevel: "friendly",
    channel: "email",
    instruction: "Invoice is now due. Friendly reminder with payment details. No pressure.",
    enabled: true,
  },
  {
    id: "seed-followup-3",
    name: "First Follow-Up",
    daysTrigger: 3,
    actionType: "email",
    toneLevel: "professional",
    channel: "email",
    instruction: "First follow-up after due date. Professional tone, ask if there are any issues with payment.",
    enabled: true,
  },
  {
    id: "seed-followup-7",
    name: "Second Follow-Up",
    daysTrigger: 7,
    actionType: "email",
    toneLevel: "professional",
    channel: "email",
    instruction: "Second follow-up. Professional tone, reference previous correspondence, request update on payment timeline.",
    enabled: true,
  },
  {
    id: "seed-followup-14",
    name: "Third Follow-Up",
    daysTrigger: 14,
    actionType: "email",
    toneLevel: "firm",
    channel: "email",
    instruction: "Two weeks overdue. Firm but respectful. Emphasise the importance of settling the balance and offer to discuss payment arrangements.",
    enabled: true,
  },
  {
    id: "seed-followup-21",
    name: "Escalation Warning",
    daysTrigger: 21,
    actionType: "email",
    toneLevel: "firm",
    channel: "email",
    instruction: "Three weeks overdue. Firm tone. Warn that the matter may be escalated if not resolved. Offer final opportunity for payment plan.",
    enabled: true,
  },
  {
    id: "seed-flag-30",
    name: "Flag for Attention",
    daysTrigger: 30,
    actionType: "flag",
    toneLevel: "formal",
    channel: "internal",
    instruction: "ATTENTION: 30 days overdue. Flag for human review and potential escalation to collections or legal.",
    enabled: true,
  },
];

/**
 * Ensures a default recruitment-sector collection schedule exists for a tenant.
 * Returns the schedule ID (creates one if it doesn't exist).
 */
export async function ensureDefaultSchedule(tenantId: string): Promise<string> {
  // Check if a default schedule already exists
  const [existing] = await db
    .select({ id: collectionSchedules.id })
    .from(collectionSchedules)
    .where(
      and(
        eq(collectionSchedules.tenantId, tenantId),
        eq(collectionSchedules.isDefault, true),
      ),
    )
    .limit(1);

  if (existing) return existing.id;

  // Create the default schedule with recruitment sector steps
  const [created] = await db
    .insert(collectionSchedules)
    .values({
      tenantId,
      name: RECRUITMENT_SCHEDULE_NAME,
      description:
        "Recruitment sector defaults: pre-due reminder at day -5, due date notification day 0, follow-ups at +3, +7, +14, +21, flag for attention at +30. LLM generates unique emails using these timing/tone instructions.",
      isActive: true,
      isDefault: true,
      workflow: "overdue_only",
      scheduleSteps: RECRUITMENT_SECTOR_STEPS,
      schedulerType: "static",
      sendingSettings: {
        timezone: "Europe/London",
        sendingWindow: { start: "09:00", end: "17:00" },
        excludeWeekends: true,
      },
    })
    .returning();

  console.log(
    `[strategy-seeder] Created default schedule "${RECRUITMENT_SCHEDULE_NAME}" for tenant ${tenantId}`,
  );
  return created.id;
}

/**
 * Assigns a contact to the tenant's default collection schedule.
 * Skips if the contact already has an active assignment.
 */
export async function assignContactToDefaultSchedule(
  tenantId: string,
  contactId: string,
): Promise<void> {
  // Check if contact already has an assignment
  const [existingAssignment] = await db
    .select({ id: customerScheduleAssignments.id })
    .from(customerScheduleAssignments)
    .where(
      and(
        eq(customerScheduleAssignments.tenantId, tenantId),
        eq(customerScheduleAssignments.contactId, contactId),
        eq(customerScheduleAssignments.isActive, true),
      ),
    )
    .limit(1);

  if (existingAssignment) return;

  const scheduleId = await ensureDefaultSchedule(tenantId);

  await db.insert(customerScheduleAssignments).values({
    tenantId,
    contactId,
    scheduleId,
    isActive: true,
  });

  // Increment totalCustomersAssigned
  await db
    .update(collectionSchedules)
    .set({
      totalCustomersAssigned: sql`COALESCE(${collectionSchedules.totalCustomersAssigned}, 0) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(collectionSchedules.id, scheduleId));

  console.log(
    `[strategy-seeder] Assigned contact ${contactId} to default schedule for tenant ${tenantId}`,
  );
}
