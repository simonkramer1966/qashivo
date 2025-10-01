import {
  StickyNote,
  Mail,
  MessageSquare,
  MessageCircle,
  Mic,
  Phone,
  Bot,
  CheckCircle,
  CalendarCheck,
  AlertTriangle,
  Calendar,
  Bell,
  Send,
  Monitor,
  RefreshCw,
  Edit,
  Receipt,
  Scale,
  LucideIcon,
} from "lucide-react";

export type ActivityType =
  | "note"
  | "email"
  | "sms"
  | "whatsapp"
  | "voice_message"
  | "human_call"
  | "ai_call"
  | "payment_received"
  | "promise_to_pay"
  | "dispute_filed"
  | "payment_plan_created"
  | "automated_reminder"
  | "letter_post"
  | "portal_message"
  | "status_change"
  | "invoice_adjusted"
  | "credit_note"
  | "legal_action";

interface ActivityIconConfig {
  icon: LucideIcon;
  label: string;
  color: string;
  isPrimary: boolean; // true for activities 1-7 (teal), false for 8-17 (grey)
}

const activityIconMap: Record<ActivityType, ActivityIconConfig> = {
  // Primary activities (1-7) - Brand Teal #17B6C3
  note: {
    icon: StickyNote,
    label: "Note",
    color: "#17B6C3",
    isPrimary: true,
  },
  email: {
    icon: Mail,
    label: "Email",
    color: "#17B6C3",
    isPrimary: true,
  },
  sms: {
    icon: MessageSquare,
    label: "SMS",
    color: "#17B6C3",
    isPrimary: true,
  },
  whatsapp: {
    icon: MessageCircle,
    label: "WhatsApp",
    color: "#17B6C3",
    isPrimary: true,
  },
  voice_message: {
    icon: Mic,
    label: "Voice Message",
    color: "#17B6C3",
    isPrimary: true,
  },
  human_call: {
    icon: Phone,
    label: "Human Call",
    color: "#17B6C3",
    isPrimary: true,
  },
  ai_call: {
    icon: Bot,
    label: "AI Call",
    color: "#17B6C3",
    isPrimary: true,
  },

  // Secondary activities (8-17) - Grey
  payment_received: {
    icon: CheckCircle,
    label: "Payment Received",
    color: "#6B7280",
    isPrimary: false,
  },
  promise_to_pay: {
    icon: CalendarCheck,
    label: "Promise to Pay",
    color: "#6B7280",
    isPrimary: false,
  },
  dispute_filed: {
    icon: AlertTriangle,
    label: "Dispute Filed",
    color: "#6B7280",
    isPrimary: false,
  },
  payment_plan_created: {
    icon: Calendar,
    label: "Payment Plan Created",
    color: "#6B7280",
    isPrimary: false,
  },
  automated_reminder: {
    icon: Bell,
    label: "Automated Reminder",
    color: "#6B7280",
    isPrimary: false,
  },
  letter_post: {
    icon: Send,
    label: "Letter/Post",
    color: "#6B7280",
    isPrimary: false,
  },
  portal_message: {
    icon: Monitor,
    label: "Portal Message",
    color: "#6B7280",
    isPrimary: false,
  },
  status_change: {
    icon: RefreshCw,
    label: "Status Change",
    color: "#6B7280",
    isPrimary: false,
  },
  invoice_adjusted: {
    icon: Edit,
    label: "Invoice Adjusted",
    color: "#6B7280",
    isPrimary: false,
  },
  credit_note: {
    icon: Receipt,
    label: "Credit Note",
    color: "#6B7280",
    isPrimary: false,
  },
  legal_action: {
    icon: Scale,
    label: "Legal Action",
    color: "#6B7280",
    isPrimary: false,
  },
};

export function getActivityIcon(
  activityType: string,
  className?: string
): JSX.Element {
  const normalizedType = activityType.toLowerCase().replace(/\s+/g, "_") as ActivityType;
  const config = activityIconMap[normalizedType];

  if (!config) {
    // Fallback for unknown activity types
    return <StickyNote className={className || "h-4 w-4"} style={{ color: "#6B7280" }} />;
  }

  const Icon = config.icon;
  return <Icon className={className || "h-4 w-4"} style={{ color: config.color }} />;
}

export function getActivityIconWithBackground(
  activityType: string,
  size: "sm" | "md" | "lg" = "md"
): JSX.Element {
  const normalizedType = activityType.toLowerCase().replace(/\s+/g, "_") as ActivityType;
  const config = activityIconMap[normalizedType] || {
    icon: StickyNote,
    color: "#6B7280",
    isPrimary: false,
  };

  const Icon = config.icon;
  
  const sizeClasses = {
    sm: "p-1.5 h-7 w-7",
    md: "p-2 h-9 w-9",
    lg: "p-3 h-12 w-12",
  };
  
  const iconSizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const bgColor = config.isPrimary ? "bg-[#17B6C3]/10" : "bg-gray-100 dark:bg-gray-800";

  return (
    <div
      className={`${sizeClasses[size]} ${bgColor} rounded-lg flex items-center justify-center`}
    >
      <Icon className={iconSizeClasses[size]} style={{ color: config.color }} />
    </div>
  );
}

export function getActivityLabel(activityType: string): string {
  const normalizedType = activityType.toLowerCase().replace(/\s+/g, "_") as ActivityType;
  const config = activityIconMap[normalizedType];
  return config?.label || activityType;
}

export function getActivityColor(activityType: string): string {
  const normalizedType = activityType.toLowerCase().replace(/\s+/g, "_") as ActivityType;
  const config = activityIconMap[normalizedType];
  return config?.color || "#6B7280";
}

export function getAllActivityTypes(): ActivityType[] {
  return Object.keys(activityIconMap) as ActivityType[];
}

export function getPrimaryActivityTypes(): ActivityType[] {
  return Object.entries(activityIconMap)
    .filter(([_, config]) => config.isPrimary)
    .map(([type, _]) => type as ActivityType);
}

export function getSecondaryActivityTypes(): ActivityType[] {
  return Object.entries(activityIconMap)
    .filter(([_, config]) => !config.isPrimary)
    .map(([type, _]) => type as ActivityType);
}
