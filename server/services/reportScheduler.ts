import { storage } from '../storage';
import { generateReport, REPORT_TYPE_LABELS, type ReportType } from './reportGenerator';
import { sendEmail, DEFAULT_FROM_EMAIL, DEFAULT_FROM } from './sendgrid';
import { addDays, addMonths, setHours, setMinutes, startOfDay, nextDay, setDate } from 'date-fns';
import type { ScheduledReport } from '../../shared/schema';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startReportScheduler() {
  if (intervalHandle) { return; }
  console.log('📊 Starting report scheduler (checking every 5 minutes)');

  runDueReports().catch(err => console.error('[ReportScheduler] Initial run error:', err));

  intervalHandle = setInterval(() => {
    runDueReports().catch(err => console.error('[ReportScheduler] Run error:', err));
  }, CHECK_INTERVAL_MS);
}

export function stopReportScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('📊 Report scheduler stopped');
  }
}

async function runDueReports() {
  const dueReports = await storage.getDueScheduledReports();
  if (dueReports.length === 0) return;

  console.log(`📊 [ReportScheduler] Found ${dueReports.length} due report(s)`);

  for (const schedule of dueReports) {
    try {
      await processReport(schedule);
    } catch (err) {
      console.error(`[ReportScheduler] Error processing report ${schedule.id}:`, err);
    }
  }
}

async function processReport(schedule: ScheduledReport) {
  const reportType = schedule.reportType as ReportType;
  console.log(`📊 [ReportScheduler] Generating ${reportType} for tenant ${schedule.tenantId}`);

  const report = await generateReport(schedule.tenantId, reportType);

  let successCount = 0;
  let failCount = 0;

  for (const recipient of schedule.recipients) {
    try {
      const result = await sendEmail({
        to: recipient,
        from: `${DEFAULT_FROM} <${DEFAULT_FROM_EMAIL}>`,
        subject: report.subject,
        html: report.html,
        tenantId: schedule.tenantId,
      });

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        console.error(`[ReportScheduler] Failed to send to ${recipient}:`, result.error);
      }
    } catch (err) {
      failCount++;
      console.error(`[ReportScheduler] Send error for ${recipient}:`, err);
    }
  }

  const nextRunAt = computeNextRunAt(schedule);

  await storage.updateScheduledReport(schedule.id, {
    lastSentAt: new Date() as any,
    nextRunAt: nextRunAt as any,
  } as any);

  console.log(`📊 [ReportScheduler] Report ${schedule.name} sent to ${successCount}/${schedule.recipients.length} recipients. Next run: ${nextRunAt.toISOString()}`);
}

export function computeNextRunAt(schedule: Pick<ScheduledReport, 'frequency' | 'sendTime' | 'dayOfWeek' | 'dayOfMonth' | 'timezone'>): Date {
  const now = new Date();
  const [hours, minutes] = (schedule.sendTime || '08:00').split(':').map(Number);

  let next: Date;

  switch (schedule.frequency) {
    case 'daily': {
      next = startOfDay(addDays(now, 1));
      next = setHours(next, hours);
      next = setMinutes(next, minutes);
      break;
    }
    case 'weekly': {
      const targetDay = schedule.dayOfWeek ?? 1;
      next = nextDay(now, targetDay as 0 | 1 | 2 | 3 | 4 | 5 | 6);
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
      next = addDays(now, 1);
      next = setHours(next, hours);
      next = setMinutes(next, minutes);
    }
  }

  return next;
}
