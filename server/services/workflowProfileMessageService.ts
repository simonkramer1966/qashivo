import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { workflowProfiles, workflowMessageVariants } from "@shared/schema";
import { CharlieDecision, CharlieChannel } from "./charlieDecisionEngine";
import { CharlieInvoiceState } from "./invoiceStateMachine";

export interface WorkflowPreparedMessage {
  channel: CharlieChannel;
  subject?: string;
  body: string;
  fromWorkflowProfile: boolean;
  templateKey: string;
}

const VARIABLE_MAPPINGS: Record<string, string> = {
  '{{contactName}}': 'contactFirstName',
  '{{companyName}}': 'companyName',
  '{{invoiceNumber}}': 'invoiceNumber',
  '{{invoiceTotal}}': 'invoiceTotal',
  '{{totalAmount}}': 'invoiceTotal',
  '{{dueDate}}': 'dueDate',
  '{{daysOverdue}}': 'daysOverdue',
  '{{senderName}}': 'senderName',
  '{{senderCompany}}': 'senderCompany',
  '{{contactNumber}}': 'contactNumber',
  '{{paymentDetails}}': 'paymentDetails',
  '{{invoiceSummary}}': 'invoiceSummary',
  '{{invoiceCount}}': 'invoiceCount',
};

function mapCharlieStateToMessageKey(state: CharlieInvoiceState, daysOverdue: number): string {
  if (daysOverdue < 0) return 'PRE_DUE_REMINDER';
  if (daysOverdue === 0) return 'DUE_TODAY';
  if (daysOverdue <= 7) return 'OVERDUE_7';
  if (daysOverdue <= 14) return 'OVERDUE_14';
  if (daysOverdue <= 30) return 'OVERDUE_30';
  return 'FINAL_NOTICE';
}

function mapChannelToVariantChannel(channel: CharlieChannel): string {
  switch (channel) {
    case 'email': return 'EMAIL';
    case 'sms': return 'SMS';
    case 'voice': return 'VOICE';
    default: return 'EMAIL';
  }
}

function renderTemplate(template: string, context: Record<string, any>): string {
  let result = template;
  
  for (const [variable, contextKey] of Object.entries(VARIABLE_MAPPINGS)) {
    const value = context[contextKey];
    if (value !== undefined) {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), String(value));
    }
  }
  
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  
  return result;
}

export async function getActiveWorkflowProfileForTenant(tenantId: string) {
  return await db.query.workflowProfiles.findFirst({
    where: and(
      eq(workflowProfiles.tenantId, tenantId),
      eq(workflowProfiles.status, "ACTIVE")
    ),
  });
}

export async function getMessageVariantsForProfile(profileId: string) {
  return await db.query.workflowMessageVariants.findMany({
    where: eq(workflowMessageVariants.workflowProfileId, profileId),
  });
}

export async function prepareMessageFromWorkflowProfile(
  tenantId: string,
  decision: CharlieDecision & { invoiceCount?: number; invoiceTable?: string },
  tenantConfig: {
    companyName: string;
    senderName: string;
    contactNumber: string;
    paymentDetails: string;
  }
): Promise<WorkflowPreparedMessage | null> {
  const channel = decision.recommendedChannel;
  if (channel === 'none') return null;

  const activeProfile = await getActiveWorkflowProfileForTenant(tenantId);
  if (!activeProfile) {
    return null;
  }

  const messageVariants = await getMessageVariantsForProfile(activeProfile.id);
  if (!messageVariants || messageVariants.length === 0) {
    return null;
  }

  const messageKey = mapCharlieStateToMessageKey(decision.charlieState, decision.invoice.daysOverdue);
  const variantChannel = mapChannelToVariantChannel(channel);
  
  const matchingVariant = messageVariants.find(v => 
    v.key === messageKey && v.channel === variantChannel
  );

  if (!matchingVariant || !matchingVariant.body) {
    return null;
  }

  const invoiceCount = decision.invoiceCount || 1;
  const hasMultipleInvoices = invoiceCount > 1;
  const contactFirstName = decision.contact.name?.split(' ')[0] || decision.contact.name;
  
  const invoiceSummary = hasMultipleInvoices && decision.invoiceTable
    ? decision.invoiceTable
    : `Invoice ${decision.invoice.invoiceNumber}: £${decision.invoice.amount.toFixed(2)}`;

  const context: Record<string, any> = {
    contactFirstName,
    companyName: tenantConfig.companyName,
    invoiceNumber: hasMultipleInvoices ? `${invoiceCount} invoices` : decision.invoice.invoiceNumber,
    invoiceTotal: `£${decision.invoice.amount.toFixed(2)}`,
    dueDate: new Date(decision.invoice.dueDate).toLocaleDateString('en-GB'),
    daysOverdue: decision.invoice.daysOverdue,
    senderName: tenantConfig.senderName,
    senderCompany: tenantConfig.companyName,
    contactNumber: tenantConfig.contactNumber,
    paymentDetails: tenantConfig.paymentDetails,
    invoiceSummary,
    invoiceCount,
  };

  const body = renderTemplate(matchingVariant.body, context);
  const subject = matchingVariant.subject 
    ? renderTemplate(matchingVariant.subject, context)
    : undefined;

  return {
    channel,
    subject,
    body,
    fromWorkflowProfile: true,
    templateKey: messageKey,
  };
}
