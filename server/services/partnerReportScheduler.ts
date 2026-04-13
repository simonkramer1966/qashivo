import { db } from '../db';
import { partnerReportSubscriptions, partnerGeneratedReports } from '@shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { addDays, addMonths, setHours, setMinutes, startOfDay, nextDay, setDate, subDays } from 'date-fns';
import { generatePartnerReport, type PartnerReportType, PARTNER_REPORT_TYPE_LABELS } from './partnerReportGenerator';
import { sendEmailWithAttachment, DEFAULT_FROM_EMAIL, DEFAULT_FROM } from './sendgrid';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startPartnerReportScheduler() {
  console.log('[PartnerReportScheduler] Starting (checking every 5 minutes)');

  runDueReports().catch(err => console.error('[PartnerReportScheduler] Initial run error:', err));

  intervalHandle = setInterval(() => {
    runDueReports().catch(err => console.error('[PartnerReportScheduler] Run error:', err));
  }, CHECK_INTERVAL_MS);
}

export function stopPartnerReportScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[PartnerReportScheduler] Stopped');
  }
}

async function runDueReports() {
  const now = new Date();
  const due = await db
    .select()
    .from(partnerReportSubscriptions)
    .where(and(
      eq(partnerReportSubscriptions.isActive, true),
      lte(partnerReportSubscriptions.nextRunAt, now),
    ));

  if (due.length === 0) return;
  console.log(`[PartnerReportScheduler] Found ${due.length} due subscription(s)`);

  for (const sub of due) {
    try {
      await processSubscription(sub);
    } catch (err) {
      console.error(`[PartnerReportScheduler] Error processing subscription ${sub.id}:`, err);
    }
  }
}

async function processSubscription(sub: typeof partnerReportSubscriptions.$inferSelect) {
  const reportType = sub.reportType as PartnerReportType;
  const periodEnd = new Date();
  const periodStart = sub.frequency === 'monthly' ? subDays(periodEnd, 30)
    : sub.frequency === 'fortnightly' ? subDays(periodEnd, 14)
    : subDays(periodEnd, 7);

  console.log(`[PartnerReportScheduler] Generating ${reportType} for partner ${sub.partnerId}`);

  // Create report record
  const [report] = await db.insert(partnerGeneratedReports).values({
    partnerId: sub.partnerId,
    subscriptionId: sub.id,
    reportType: sub.reportType,
    title: PARTNER_REPORT_TYPE_LABELS[reportType] || sub.reportType,
    periodStart,
    periodEnd,
    status: 'generating',
    generatedBy: sub.createdBy,
  }).returning();

  try {
    const result = await generatePartnerReport(sub.partnerId, reportType, { periodStart, periodEnd });

    // Store PDF as base64
    await db.update(partnerGeneratedReports)
      .set({
        pdfData: result.pdfBuffer.toString('base64'),
        metadata: result.metadata,
        status: 'completed',
        title: result.title,
      })
      .where(eq(partnerGeneratedReports.id, report.id));

    // Distribute via email
    const recipients = (sub.recipientEmails as string[]) || [];
    if (recipients.length > 0) {
      let successCount = 0;
      for (const recipient of recipients) {
        try {
          const sent = await sendEmailWithAttachment({
            to: recipient,
            from: `${DEFAULT_FROM} <${DEFAULT_FROM_EMAIL}>`,
            subject: result.title,
            html: `<p>Please find attached your ${PARTNER_REPORT_TYPE_LABELS[reportType]} report.</p><p style="color:#6b7280;font-size:13px;">Period: ${periodStart.toLocaleDateString('en-GB')} – ${periodEnd.toLocaleDateString('en-GB')}</p>`,
            tenantId: sub.partnerId, // Partner ID used for mode enforcement
            attachments: [{
              filename: `${sub.reportType}-${periodEnd.toISOString().slice(0, 10)}.pdf`,
              content: result.pdfBuffer,
              type: 'application/pdf',
            }],
          });
          if (sent) successCount++;
        } catch (err) {
          console.error(`[PartnerReportScheduler] Email failed for ${recipient}:`, err);
        }
      }

      await db.update(partnerGeneratedReports)
        .set({
          distributedAt: new Date(),
          distributionRecipients: recipients,
        })
        .where(eq(partnerGeneratedReports.id, report.id));

      console.log(`[PartnerReportScheduler] ${result.title} sent to ${successCount}/${recipients.length} recipients`);
    }
  } catch (err) {
    console.error(`[PartnerReportScheduler] Generation failed for subscription ${sub.id}:`, err);
    await db.update(partnerGeneratedReports)
      .set({ status: 'failed', metadata: { error: String(err) } })
      .where(eq(partnerGeneratedReports.id, report.id));
  }

  // Update subscription schedule
  const nextRunAt = computePartnerReportNextRunAt(sub);
  await db.update(partnerReportSubscriptions)
    .set({ lastGeneratedAt: new Date(), nextRunAt, updatedAt: new Date() })
    .where(eq(partnerReportSubscriptions.id, sub.id));
}

export function computePartnerReportNextRunAt(
  schedule: Pick<typeof partnerReportSubscriptions.$inferSelect, 'frequency' | 'timeOfDay' | 'dayOfWeek' | 'dayOfMonth' | 'timezone'>,
): Date {
  const now = new Date();
  const [hours, minutes] = (schedule.timeOfDay || '08:00').split(':').map(Number);

  let next: Date;

  switch (schedule.frequency) {
    case 'weekly': {
      const targetDay = schedule.dayOfWeek ?? 1; // Monday default
      next = nextDay(now, targetDay as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      next = startOfDay(next);
      next = setHours(next, hours);
      next = setMinutes(next, minutes);
      break;
    }
    case 'fortnightly': {
      const targetDay = schedule.dayOfWeek ?? 1;
      next = nextDay(now, targetDay as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      next = addDays(next, 7); // Skip one week to make it fortnightly
      next = startOfDay(next);
      next = setHours(next, hours);
      next = setMinutes(next, minutes);
      break;
    }
    case 'monthly': {
      const targetDate = schedule.dayOfMonth ?? 1;
      next = addMonths(startOfDay(now), 1);
      next = setDate(next, Math.min(targetDate, 28));
      next = setHours(next, hours);
      next = setMinutes(next, minutes);
      break;
    }
    default: {
      next = addDays(now, 7);
      next = setHours(next, hours);
      next = setMinutes(next, minutes);
    }
  }

  return next;
}
