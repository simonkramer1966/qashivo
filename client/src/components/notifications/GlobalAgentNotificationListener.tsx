import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAgentNotifications } from "@/hooks/useAgentNotifications";
import { useManualSync } from "@/hooks/useManualSync";

/**
 * Subscribes to global SSE events and emits Charlie/Riley notifications
 * for things that aren't scoped to a single page (sync failures, delivery
 * failures on any page, etc.).
 */
export function GlobalAgentNotificationListener() {
  const { notify } = useAgentNotifications();
  const [, navigate] = useLocation();
  const retrySync = useManualSync();

  useEffect(() => {
    const onSyncFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail as { error?: string } | undefined;
      notify({
        agent: "charlie",
        severity: "error",
        title: "Xero sync failed",
        message: detail?.error ?? "I couldn't reach Xero. Reconnect in Settings to resume.",
        actions: [
          {
            label: "Reconnect Xero",
            onClick: () => navigate("/settings/integrations"),
          },
          {
            label: "Retry",
            variant: "secondary",
            onClick: () => retrySync.mutate(),
          },
        ],
      });
    };

    const onSendFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { contactName?: string; error?: string }
        | undefined;
      notify({
        agent: "charlie",
        severity: "error",
        title: "Email send failed",
        message: detail?.contactName
          ? `I couldn't deliver the email to ${detail.contactName}. It's back in the queue.`
          : "I couldn't deliver one of the emails. It's back in the queue.",
        actions: [
          {
            label: "View approvals",
            onClick: () => navigate("/qollections/agent-activity?tab=queue"),
          },
        ],
      });
    };

    const onDeliveryBounce = (e: Event) => {
      const detail = (e as CustomEvent).detail as { contactName?: string } | undefined;
      notify({
        agent: "charlie",
        severity: "warning",
        title: "Email bounced",
        message: detail?.contactName
          ? `The email to ${detail.contactName} hard-bounced. I've flagged the contact in Data Health.`
          : "An email hard-bounced. I've flagged the contact in Data Health.",
        actions: [
          {
            label: "Open Data Health",
            onClick: () => navigate("/settings/data-health"),
          },
        ],
      });
    };

    window.addEventListener("realtime:sync_failed", onSyncFailed);
    window.addEventListener("realtime:send_failed", onSendFailed);
    window.addEventListener("realtime:delivery_bounce", onDeliveryBounce);
    return () => {
      window.removeEventListener("realtime:sync_failed", onSyncFailed);
      window.removeEventListener("realtime:send_failed", onSendFailed);
      window.removeEventListener("realtime:delivery_bounce", onDeliveryBounce);
    };
  }, [notify, navigate, retrySync]);

  return null;
}
