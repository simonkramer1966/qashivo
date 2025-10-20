/**
 * Action Centre Helper Functions (Frontend)
 * 
 * Frontend utilities for exception tagging and reason display
 */

export interface Reason {
  icon: "overdue" | "payment_history" | "channel" | "urgency";
  label: string;
}

/**
 * Derive exception tags from action metadata
 */
export function deriveExceptionTags(action: any): string[] {
  const tags: string[] = [];
  
  // Check metadata for exception signals
  const metadata = action.metadata || {};
  
  if (metadata.dispute || action.invoiceDispute) {
    tags.push("Dispute");
  }
  
  if (metadata.brokenPromise || metadata.promiseBreached) {
    tags.push("Broken Promise");
  }
  
  if (metadata.highValue || (action.invoiceAmount && parseFloat(action.invoiceAmount) > 10000)) {
    tags.push("High Value");
  }
  
  if (metadata.lowSignal || metadata.newCustomer) {
    tags.push("Low Signal");
  }
  
  if (metadata.channelBlocked) {
    tags.push("Channel Blocked");
  }
  
  return tags;
}

/**
 * Get display-friendly reasons from action metadata
 */
export function getActionReasons(action: any): Reason[] {
  const reasons: Reason[] = [];
  const metadata = action.metadata || {};
  
  // Check if we have pre-computed reasons from the backend
  if (metadata.recommended?.reasons && Array.isArray(metadata.recommended.reasons)) {
    return metadata.recommended.reasons;
  }
  
  // Fallback: derive reasons from available metadata
  const daysOverdue = metadata.daysOverdue || 0;
  const priority = metadata.priority || metadata.recommended?.priority || 50;
  
  if (daysOverdue > 7) {
    reasons.push({
      icon: "overdue",
      label: `${daysOverdue} days overdue - immediate action needed`
    });
  } else if (daysOverdue > 0) {
    reasons.push({
      icon: "overdue",
      label: `${daysOverdue} days overdue`
    });
  }
  
  if (metadata.paymentHistory === "slow" || metadata.medianDays > 30) {
    reasons.push({
      icon: "payment_history",
      label: "Customer typically pays late"
    });
  } else if (metadata.paymentHistory === "fast") {
    reasons.push({
      icon: "payment_history",
      label: "Customer usually pays on time"
    });
  }
  
  if (metadata.bestChannel || metadata.recommended?.channel) {
    const channel = (metadata.bestChannel || metadata.recommended?.channel || "").toLowerCase();
    const channelLabels: Record<string, string> = {
      email: "Email has highest response rate",
      sms: "SMS has highest response rate",
      whatsapp: "WhatsApp has highest response rate",
      voice: "Calls get best results",
    };
    
    if (channelLabels[channel]) {
      reasons.push({
        icon: "channel",
        label: channelLabels[channel]
      });
    }
  }
  
  if (priority > 70) {
    reasons.push({
      icon: "urgency",
      label: "High priority - portfolio DSO impact"
    });
  }
  
  // If still no reasons, provide a default
  if (reasons.length === 0) {
    reasons.push({
      icon: "channel",
      label: "Adaptive scheduler recommendation based on customer behavior"
    });
  }
  
  return reasons;
}
