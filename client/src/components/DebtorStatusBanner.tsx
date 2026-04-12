import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Activity,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Scale,
  Handshake,
  AlertCircle,
  CheckCircle2,
  Star,
  Pause,
} from "lucide-react";

interface CharlieStatus {
  status: string;
  variant: string;
  reason: string;
  detail: Record<string, any>;
}

const VARIANT_CONFIG: Record<string, { borderColor: string; icon: typeof Activity }> = {
  chasing:      { borderColor: "border-l-blue-500",   icon: Activity },
  arrangement:  { borderColor: "border-l-teal-500",   icon: Handshake },
  cooldown:     { borderColor: "border-l-zinc-400",   icon: Clock },
  blackout:     { borderColor: "border-l-amber-500",  icon: AlertTriangle },
  dispute:      { borderColor: "border-l-red-500",    icon: Scale },
  vip:          { borderColor: "border-l-purple-500", icon: Star },
  legal:        { borderColor: "border-l-red-500",    icon: ShieldAlert },
  on_hold:      { borderColor: "border-l-zinc-400",   icon: Pause },
  no_action:    { borderColor: "border-l-green-500",  icon: CheckCircle2 },
  data_issue:   { borderColor: "border-l-amber-500",  icon: AlertCircle },
};

export default function DebtorStatusBanner({ contactId }: { contactId: string }) {
  const { data } = useQuery<CharlieStatus>({
    queryKey: [`/api/contacts/${contactId}/charlie-status`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/charlie-status`);
      return res.json();
    },
    enabled: !!contactId,
    staleTime: 30_000,
  });

  if (!data) return null;

  // VIP status is shown in the page header — don't duplicate here
  if (data.variant === "vip") return null;

  const config = VARIANT_CONFIG[data.variant] || VARIANT_CONFIG.no_action;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2.5 rounded-md border-l-[3px] ${config.borderColor} bg-muted/50 px-4 py-3`}>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-[13px] text-foreground truncate">{data.reason}</span>
    </div>
  );
}
