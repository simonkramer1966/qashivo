import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bug, Sparkles, RefreshCw, X, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug report", sublabel: "Something isn't working", icon: Bug },
  { value: "feature", label: "Feature request", sublabel: "I'd like to see...", icon: Sparkles },
  { value: "workflow", label: "Workflow improvement", sublabel: "This could work better", icon: RefreshCw },
] as const;

export default function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [type, setType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPage = typeof window !== "undefined" ? window.location.pathname : "";
  const userEmail = (user as any)?.email || "";

  const resetForm = () => {
    setType("");
    setDescription("");
    setPriority("");
    setScreenshotData(null);
    setScreenshotName("");
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/feedback", {
        type,
        description,
        page: currentPage,
        priority: priority || null,
        screenshotData,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Thanks for your feedback!" });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to submit feedback", description: err.message, variant: "destructive" });
    },
  });

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Screenshot too large", description: "Maximum 5MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotData(reader.result as string);
      setScreenshotName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const canSubmit = type && description.length >= 10 && !submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Send feedback</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-3">
            {FEEDBACK_TYPES.map((ft) => (
              <button
                key={ft.value}
                type="button"
                onClick={() => setType(ft.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors",
                  type === ft.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/40 text-muted-foreground"
                )}
              >
                <ft.icon className="h-5 w-5" />
                <span className="text-xs font-semibold leading-tight">{ft.label}</span>
                <span className="text-[10px] leading-tight opacity-70">{ft.sublabel}</span>
              </button>
            ))}
          </div>

          {/* Description */}
          <div>
            <Textarea
              placeholder="Describe what happened, what you expected, or what you'd like to see..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
            {description.length > 0 && description.length < 10 && (
              <p className="text-xs text-muted-foreground mt-1">
                {10 - description.length} more characters needed
              </p>
            )}
          </div>

          {/* Priority */}
          <div>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Priority (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Screenshot */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              className="hidden"
              onChange={handleScreenshot}
            />
            {screenshotData ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <img
                  src={screenshotData}
                  alt="Screenshot preview"
                  className="h-12 w-12 rounded object-cover"
                />
                <span className="text-sm text-muted-foreground flex-1 truncate">{screenshotName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setScreenshotData(null); setScreenshotName(""); }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                Attach a screenshot (optional)
              </Button>
            )}
          </div>

          {/* Context info */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Submitted from: <span className="font-mono">{currentPage}</span></p>
            {userEmail && <p>We'll follow up at <span className="font-medium">{userEmail}</span></p>}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button
              disabled={!canSubmit}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit feedback"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
