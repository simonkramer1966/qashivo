export type TimelineDirection = "outbound" | "inbound" | "internal";

export type TimelineChannel = "email" | "sms" | "voice" | "note" | "system";

export type TimelineOutcomeType =
  | "promise_to_pay"
  | "request_more_time"
  | "payment_plan"
  | "dispute"
  | "wrong_contact"
  | "paid_confirmed"
  | "refused"
  | "no_response"
  | "other";

export type TimelineStatus = "sent" | "delivered" | "failed" | "received" | "transcribed";

export type TimelineProvider = "sendgrid" | "vonage" | "retell" | "stripe" | "xero";

export type TimelineCreatedByType = "system" | "user";

export interface TimelineOutcome {
  type: TimelineOutcomeType;
  confidence: number;
  extracted?: Record<string, any>;
  requiresReview?: boolean;
}

export interface TimelineParticipants {
  from?: string;
  to?: string[];
}

export interface TimelineExternalRefs {
  provider?: TimelineProvider;
  providerMessageId?: string;
}

export interface TimelineCreatedBy {
  type: TimelineCreatedByType;
  name?: string;
  userId?: string;
}

export interface TimelineItem {
  id: string;
  occurredAt: string;
  direction: TimelineDirection;
  channel: TimelineChannel;
  summary: string;
  preview?: string;
  body?: string;
  subject?: string;
  participants?: TimelineParticipants;
  outcome?: TimelineOutcome;
  status?: TimelineStatus;
  externalRefs?: TimelineExternalRefs;
  createdBy?: TimelineCreatedBy;
}

export interface TimelineFilters {
  channel?: TimelineChannel[];
  direction?: TimelineDirection[];
  outcomesOnly?: boolean;
  needsReviewOnly?: boolean;
}

export interface TimelineResponse {
  items: TimelineItem[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface CustomerPreviewInvoice {
  id: string;
  invoiceNumber: string;
  description?: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  amountPaid: number;
  balance: number;
  status: string;
  daysOverdue?: number;
}

export interface CustomerPreview {
  customer: {
    id: string;
    name: string;
    email?: string;
    companyName?: string;
    behaviourLabel?: string;
    outstandingTotal: number;
    overdueTotal: number;
  };
  creditControlContact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  allCreditControlContacts?: Array<{
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    isPrimary: boolean;
  }>;
  messagingStatus?: {
    emailOptedOut?: boolean;
    smsOptedOut?: boolean;
    voiceOptedOut?: boolean;
  };
  latestTimeline: Array<{
    id: string;
    occurredAt: string;
    channel: TimelineChannel;
    direction: TimelineDirection;
    summary: string;
    preview?: string;
    body?: string;
    status?: TimelineStatus;
    invoiceId?: string;
    outcome?: {
      type: TimelineOutcomeType;
      confidence: number;
      extracted?: Record<string, any>;
    };
    createdBy?: {
      type: TimelineCreatedByType;
      name?: string;
    };
  }>;
  totalTimelineCount?: number;
  hasMoreTimeline?: boolean;
  invoices: CustomerPreviewInvoice[];
}

export interface CustomerPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  voiceEnabled: boolean;
  bestContactWindowStart?: string;
  bestContactWindowEnd?: string;
  bestContactDays?: string[];
  workflowId?: string | null;
}

export function getConfidenceLabel(confidence: number, requiresReview?: boolean): string {
  if (requiresReview) return "Needs review";
  if (confidence >= 0.85) return "High confidence";
  if (confidence >= 0.65) return "Medium confidence";
  return "Needs review";
}

export function getOutcomeTypeLabel(type: TimelineOutcomeType): string {
  const labels: Record<TimelineOutcomeType, string> = {
    promise_to_pay: "Promise to pay",
    request_more_time: "Request more time",
    payment_plan: "Payment plan",
    dispute: "Dispute raised",
    wrong_contact: "Wrong contact",
    paid_confirmed: "Payment confirmed",
    refused: "Refused to pay",
    no_response: "No response",
    other: "Other",
  };
  return labels[type] || type;
}
