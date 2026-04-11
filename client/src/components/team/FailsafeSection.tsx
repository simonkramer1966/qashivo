import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Pencil, Check } from "lucide-react";

interface FailsafeData {
  name: string;
  email: string;
  phone?: string | null;
  relationship?: string | null;
}

interface FailsafeSectionProps {
  failsafe: FailsafeData | null;
}

export default function FailsafeSection({ failsafe }: FailsafeSectionProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    emergencyContactName: failsafe?.name || "",
    emergencyContactEmail: failsafe?.email || "",
    emergencyContactPhone: failsafe?.phone || "",
    emergencyContactRelationship: failsafe?.relationship || "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/rbac/failsafe", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/team"] });
      setEditing(false);
      toast({ title: "Emergency contact saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  if (!editing && !failsafe) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              No emergency contact set
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              If you lose access to your account, this person can verify your identity and help restore it.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setEditing(true)}
            >
              Set up now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!editing && failsafe) {
    return (
      <div className="rounded-md border p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Emergency contact
            </p>
            <p className="text-sm font-medium">{failsafe.name}</p>
            <p className="text-sm text-muted-foreground">{failsafe.email}</p>
            {failsafe.phone && (
              <p className="text-sm text-muted-foreground">{failsafe.phone}</p>
            )}
            {failsafe.relationship && (
              <p className="text-xs text-muted-foreground">
                {failsafe.relationship}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setForm({
                emergencyContactName: failsafe.name,
                emergencyContactEmail: failsafe.email,
                emergencyContactPhone: failsafe.phone || "",
                emergencyContactRelationship: failsafe.relationship || "",
              });
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-4 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Emergency contact
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="fs-name" className="text-xs">
            Name *
          </Label>
          <Input
            id="fs-name"
            value={form.emergencyContactName}
            onChange={(e) =>
              setForm({ ...form, emergencyContactName: e.target.value })
            }
            placeholder="Jane Doe"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fs-email" className="text-xs">
            Email *
          </Label>
          <Input
            id="fs-email"
            type="email"
            value={form.emergencyContactEmail}
            onChange={(e) =>
              setForm({ ...form, emergencyContactEmail: e.target.value })
            }
            placeholder="jane@example.com"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fs-phone" className="text-xs">
            Phone
          </Label>
          <Input
            id="fs-phone"
            value={form.emergencyContactPhone}
            onChange={(e) =>
              setForm({ ...form, emergencyContactPhone: e.target.value })
            }
            placeholder="+44 7700 900000"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fs-rel" className="text-xs">
            Relationship
          </Label>
          <Input
            id="fs-rel"
            value={form.emergencyContactRelationship}
            onChange={(e) =>
              setForm({ ...form, emergencyContactRelationship: e.target.value })
            }
            placeholder="Business partner"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => mutation.mutate(form)}
          disabled={
            mutation.isPending ||
            !form.emergencyContactName ||
            !form.emergencyContactEmail
          }
        >
          {mutation.isPending ? "Saving..." : "Save"}
          {!mutation.isPending && <Check className="h-3.5 w-3.5 ml-1" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing(false)}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
