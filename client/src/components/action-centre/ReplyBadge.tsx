import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

/**
 * Teal "Reply" badge shown on conversation_reply actions in the Approval and
 * Scheduled tabs. Pure presentational, no props — kept here so the styling
 * stays consistent across surfaces.
 */
export function ReplyBadge() {
  return (
    <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-200 h-5 px-1.5 text-[10px] gap-0.5">
      <MessageSquare className="h-2.5 w-2.5" />
      Reply
    </Badge>
  );
}
