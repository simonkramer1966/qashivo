import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, ShieldCheck, Zap } from "lucide-react";

const MODES = [
  { value: "manual", label: "Manual", icon: Shield, description: "Review every action" },
  { value: "auto_after_timeout", label: "Semi-Auto", icon: ShieldCheck, description: "Auto-approve after timer" },
  { value: "full_auto", label: "Full Auto", icon: Zap, description: "Execute immediately" },
] as const;

interface ModeSelectorProps {
  currentMode: string;
}

export default function ModeSelector({ currentMode }: ModeSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMode = useMutation({
    mutationFn: (mode: string) =>
      apiRequest("PATCH", "/api/action-centre/settings", { approvalMode: mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/context"] });
      toast({ title: "Mode updated" });
    },
    onError: () => {
      toast({ title: "Failed to update mode", variant: "destructive" });
    },
  });

  const current = MODES.find((m) => m.value === currentMode) ?? MODES[0];

  return (
    <Select value={currentMode} onValueChange={(v) => updateMode.mutate(v)}>
      <SelectTrigger className="w-[180px]">
        <div className="flex items-center gap-2">
          <current.icon className="h-4 w-4" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {MODES.map((mode) => (
          <SelectItem key={mode.value} value={mode.value}>
            <div className="flex items-center gap-2">
              <mode.icon className="h-4 w-4" />
              <div>
                <div className="font-medium">{mode.label}</div>
                <div className="text-xs text-muted-foreground">{mode.description}</div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
