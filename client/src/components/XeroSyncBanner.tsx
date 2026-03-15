import { RefreshCw } from "lucide-react";

interface XeroSyncBannerProps {
  isSyncing: boolean;
  contactCount: number;
  invoiceCount: number;
}

export function XeroSyncBanner({ isSyncing, contactCount, invoiceCount }: XeroSyncBannerProps) {
  if (!isSyncing) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span>
        Xero sync in progress&hellip; {contactCount} contacts, {invoiceCount} invoices synced so far
      </span>
    </div>
  );
}
