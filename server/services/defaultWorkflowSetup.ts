import { eq, and, sql, isNull, notInArray } from "drizzle-orm";
import { db } from "../db";
import { 
  communicationTemplates, 
  collectionSchedules, 
  customerScheduleAssignments,
  contacts,
  invoices
} from "@shared/schema";

const DEFAULT_SCHEDULE_NAME = "Standard Collection";

const DEFAULT_TEMPLATES = [
  {
    name: "Day 1 - Friendly Reminder",
    type: "email",
    category: "early_overdue",
    stage: 1,
    subject: "Friendly Reminder: {{invoiceCount}} invoice(s) totalling {{totalOverdue}} now overdue",
    content: `Dear {{contactName}},

I hope this email finds you well.

This is a friendly reminder that you have {{invoiceCount}} invoice(s) totalling {{totalOverdue}} that are now overdue.

{{invoiceTable}}

We understand that invoices can sometimes be overlooked, so we wanted to bring this to your attention. If you've already arranged payment, please disregard this message.

For your convenience, you can view and pay your invoices using our secure payment portal:
{{paymentLink}}

If you have any questions about these invoices or need to discuss payment arrangements, please don't hesitate to reach out.

Kind regards,
{{companyName}}`,
    toneOfVoice: "friendly",
    isDefault: true,
    sendTiming: { daysOffset: 1, timeOfDay: "09:00", weekdaysOnly: true }
  },
  {
    name: "Day 7 - Follow-up Email",
    type: "email",
    category: "early_overdue",
    stage: 2,
    subject: "Second Notice: {{invoiceCount}} invoice(s) totalling {{totalOverdue}} overdue",
    content: `Dear {{contactName}},

We're following up on our previous message regarding your overdue invoices. You currently have {{invoiceCount}} invoice(s) totalling {{totalOverdue}} past due, with the oldest being {{oldestInvoiceDays}} days overdue.

{{invoiceTable}}

We haven't received payment or heard back from you, and we'd like to resolve this matter promptly. Please let us know if:
- Payment has been sent (we'll confirm receipt)
- There are any issues with the invoices that need addressing
- You need to arrange a payment plan

You can pay securely online here: {{paymentLink}}

Please respond to this email or contact us at your earliest convenience so we can assist you.

Best regards,
{{companyName}}`,
    toneOfVoice: "professional",
    isDefault: true,
    sendTiming: { daysOffset: 7, timeOfDay: "09:00", weekdaysOnly: true }
  },
  {
    name: "Day 14 - Formal Notice",
    type: "email",
    category: "medium_overdue",
    stage: 3,
    subject: "Important: {{invoiceCount}} invoice(s) totalling {{totalOverdue}} require immediate attention",
    content: `Dear {{contactName}},

Despite our previous communications, we note that {{invoiceCount}} invoice(s) totalling {{totalOverdue}} remain unpaid. The oldest invoice is now {{oldestInvoiceDays}} days overdue.

{{invoiceTable}}

We take our business relationship seriously and would like to resolve this matter without further escalation. Please arrange payment within the next 7 days or contact us immediately to discuss your situation.

If there are any disputes or concerns regarding these invoices, please let us know so we can address them promptly.

Pay securely online: {{paymentLink}}

We look forward to hearing from you.

Regards,
{{companyName}}`,
    toneOfVoice: "formal",
    isDefault: true,
    sendTiming: { daysOffset: 14, timeOfDay: "09:00", weekdaysOnly: true }
  },
  {
    name: "Day 14 - SMS Reminder",
    type: "sms",
    category: "medium_overdue",
    stage: 4,
    subject: "SMS Payment Reminder",
    content: `Hi {{contactName}}, this is {{companyName}}. You have {{invoiceCount}} overdue invoice(s) totalling {{totalOverdue}}. Please pay or contact us urgently. Thank you.`,
    toneOfVoice: "professional",
    isDefault: true,
    sendTiming: { daysOffset: 14, timeOfDay: "10:00", weekdaysOnly: true }
  },
  {
    name: "Day 30 - Final Notice Before Recovery",
    type: "email",
    category: "late_overdue",
    stage: 5,
    subject: "Final Notice: Invoices totalling {{totalOverdue}} - Action Required to Avoid Recovery Proceedings",
    content: `Dear {{contactName}},

FINAL NOTICE BEFORE DEBT RECOVERY

Despite our previous correspondence, we have not received payment for the following invoices which are now significantly overdue:

{{invoiceTable}}

Total Outstanding: {{totalOverdue}}
Oldest Invoice: {{oldestInvoiceDays}} days overdue

We have made every reasonable effort to resolve this matter amicably. However, if we do not receive payment or hear from you within the next 7 days, we will have no alternative but to refer this debt to our external collection agency for recovery proceedings.

Please be aware that this may:
- Incur additional costs and interest charges
- Affect your credit rating
- Impact our future business relationship

To avoid these consequences, please arrange immediate payment or contact us today to discuss a resolution.

Pay now: {{paymentLink}}

This is our final attempt to resolve this matter directly before escalation.

Yours faithfully,
{{companyName}}`,
    toneOfVoice: "firm",
    isDefault: true,
    sendTiming: { daysOffset: 30, timeOfDay: "09:00", weekdaysOnly: true }
  }
];

export async function ensureDefaultTemplates(tenantId: string): Promise<string[]> {
  const templateIds: string[] = [];

  for (const template of DEFAULT_TEMPLATES) {
    const existing = await db.query.communicationTemplates.findFirst({
      where: and(
        eq(communicationTemplates.tenantId, tenantId),
        eq(communicationTemplates.name, template.name),
        eq(communicationTemplates.isDefault, true)
      )
    });

    if (existing) {
      templateIds.push(existing.id);
      continue;
    }

    const [created] = await db.insert(communicationTemplates).values({
      tenantId,
      name: template.name,
      type: template.type,
      category: template.category,
      stage: template.stage,
      subject: template.subject,
      content: template.content,
      toneOfVoice: template.toneOfVoice,
      isDefault: template.isDefault,
      isActive: true,
      sendTiming: template.sendTiming,
      variables: ["contactName", "invoiceNumber", "amount", "dueDate", "daysOverdue", "paymentLink", "companyName", "invoiceTable", "invoiceCount", "totalOverdue", "oldestInvoiceDays"]
    }).returning();

    templateIds.push(created.id);
    console.log(`✅ Created default template: ${template.name}`);
  }

  return templateIds;
}

export async function ensureDefaultSchedule(tenantId: string, templateIds: string[]): Promise<string> {
  const existing = await db.query.collectionSchedules.findFirst({
    where: and(
      eq(collectionSchedules.tenantId, tenantId),
      eq(collectionSchedules.name, DEFAULT_SCHEDULE_NAME),
      eq(collectionSchedules.isDefault, true)
    )
  });

  if (existing) {
    console.log(`♻️  Using existing default schedule: ${DEFAULT_SCHEDULE_NAME}`);
    return existing.id;
  }

  const scheduleSteps = [
    {
      id: "step-1",
      name: "Friendly Reminder",
      daysTrigger: 1,
      actionType: "email",
      templateId: templateIds[0],
      templateName: "Day 1 - Friendly Reminder",
      enabled: true
    },
    {
      id: "step-2", 
      name: "Follow-up Email",
      daysTrigger: 7,
      actionType: "email",
      templateId: templateIds[1],
      templateName: "Day 7 - Follow-up Email",
      enabled: true
    },
    {
      id: "step-3",
      name: "Formal Notice",
      daysTrigger: 14,
      actionType: "email",
      templateId: templateIds[2],
      templateName: "Day 14 - Formal Notice",
      enabled: true
    },
    {
      id: "step-4",
      name: "SMS Reminder",
      daysTrigger: 14,
      actionType: "sms",
      templateId: templateIds[3],
      templateName: "Day 14 - SMS Reminder",
      enabled: true
    },
    {
      id: "step-5",
      name: "Final Notice",
      daysTrigger: 30,
      actionType: "email",
      templateId: templateIds[4],
      templateName: "Day 30 - Final Notice Before Recovery",
      enabled: true
    }
  ];

  const [created] = await db.insert(collectionSchedules).values({
    tenantId,
    name: DEFAULT_SCHEDULE_NAME,
    description: "Automated collection workflow: Day 1 friendly email, Day 7 follow-up, Day 14 formal email + SMS, Day 30 final notice before recovery",
    isActive: true,
    isDefault: true,
    workflow: "overdue_only",
    scheduleSteps,
    schedulerType: "static",
    sendingSettings: {
      timezone: "Europe/London",
      sendingWindow: { start: "09:00", end: "17:00" },
      excludeWeekends: true
    }
  }).returning();

  console.log(`✅ Created default schedule: ${DEFAULT_SCHEDULE_NAME} with ${scheduleSteps.length} steps`);
  return created.id;
}

export async function assignUnassignedContactsToDefaultSchedule(
  tenantId: string, 
  scheduleId: string
): Promise<number> {
  const contactsWithOverdueInvoices = await db
    .selectDistinct({ contactId: contacts.id })
    .from(contacts)
    .innerJoin(invoices, eq(invoices.contactId, contacts.id))
    .where(and(
      eq(contacts.tenantId, tenantId),
      eq(invoices.tenantId, tenantId),
      sql`${invoices.status} NOT IN ('paid', 'cancelled', 'void')`,
      sql`${invoices.dueDate} < NOW()`
    ));

  if (contactsWithOverdueInvoices.length === 0) {
    console.log("No contacts with overdue invoices found");
    return 0;
  }

  const contactIds = contactsWithOverdueInvoices.map(c => c.contactId);

  const existingAssignments = await db
    .select({ contactId: customerScheduleAssignments.contactId })
    .from(customerScheduleAssignments)
    .where(and(
      eq(customerScheduleAssignments.tenantId, tenantId),
      eq(customerScheduleAssignments.isActive, true)
    ));

  const assignedContactIds = new Set(existingAssignments.map(a => a.contactId));
  const unassignedContactIds = contactIds.filter(id => !assignedContactIds.has(id));

  if (unassignedContactIds.length === 0) {
    console.log("All contacts with overdue invoices already have schedule assignments");
    return 0;
  }

  const assignmentRecords = unassignedContactIds.map(contactId => ({
    tenantId,
    contactId,
    scheduleId,
    isActive: true,
  }));

  await db.insert(customerScheduleAssignments).values(assignmentRecords);

  await db
    .update(collectionSchedules)
    .set({ 
      totalCustomersAssigned: sql`${collectionSchedules.totalCustomersAssigned} + ${unassignedContactIds.length}`
    })
    .where(eq(collectionSchedules.id, scheduleId));

  console.log(`✅ Assigned ${unassignedContactIds.length} contacts to default schedule`);
  return unassignedContactIds.length;
}

export async function setupDefaultWorkflow(tenantId: string): Promise<{
  templatesCreated: number;
  scheduleId: string;
  contactsAssigned: number;
}> {
  console.log(`🔧 Setting up default workflow for tenant ${tenantId}...`);

  const templateIds = await ensureDefaultTemplates(tenantId);
  const scheduleId = await ensureDefaultSchedule(tenantId, templateIds);
  const contactsAssigned = await assignUnassignedContactsToDefaultSchedule(tenantId, scheduleId);

  console.log(`✅ Default workflow setup complete: ${templateIds.length} templates, ${contactsAssigned} contacts assigned`);

  return {
    templatesCreated: templateIds.length,
    scheduleId,
    contactsAssigned
  };
}
