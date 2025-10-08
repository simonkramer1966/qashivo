import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, FileText } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  arContactName?: string | null;
  arContactEmail?: string | null;
  arContactPhone?: string | null;
  arNotes?: string | null;
}

interface EditARContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
}

export default function EditARContactDialog({
  open,
  onOpenChange,
  contact,
}: EditARContactDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    arContactName: contact.arContactName || "",
    arContactEmail: contact.arContactEmail || "",
    arContactPhone: contact.arContactPhone || "",
    arNotes: contact.arNotes || "",
  });

  const updateARMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest(`/api/contacts/${contact.id}/ar-details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "AR Contact Updated",
        description: "Collections contact details have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contact.id}`] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update AR contact details",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateARMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Edit AR Contact Details</DialogTitle>
          <DialogDescription>
            Update collections-specific contact information. These details are separate from your accounting system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* AR Contact Name */}
          <div className="space-y-2">
            <Label htmlFor="arContactName" className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              AR Contact Person
            </Label>
            <Input
              id="arContactName"
              value={formData.arContactName}
              onChange={(e) =>
                setFormData({ ...formData, arContactName: e.target.value })
              }
              placeholder={contact.name}
              data-testid="input-ar-contact-name"
            />
            <p className="text-xs text-slate-500">
              Leave blank to use default: {contact.name}
            </p>
          </div>

          {/* AR Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="arContactEmail" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              AR Contact Email
            </Label>
            <Input
              id="arContactEmail"
              type="email"
              value={formData.arContactEmail}
              onChange={(e) =>
                setFormData({ ...formData, arContactEmail: e.target.value })
              }
              placeholder={contact.email || "ar@example.com"}
              data-testid="input-ar-contact-email"
            />
            <p className="text-xs text-slate-500">
              Leave blank to use default: {contact.email || "None"}
            </p>
          </div>

          {/* AR Contact Phone */}
          <div className="space-y-2">
            <Label htmlFor="arContactPhone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              AR Contact Phone
            </Label>
            <Input
              id="arContactPhone"
              type="tel"
              value={formData.arContactPhone}
              onChange={(e) =>
                setFormData({ ...formData, arContactPhone: e.target.value })
              }
              placeholder={contact.phone || "+44 1234 567890"}
              data-testid="input-ar-contact-phone"
            />
            <p className="text-xs text-slate-500">
              Leave blank to use default: {contact.phone || "None"}
            </p>
          </div>

          {/* AR Notes */}
          <div className="space-y-2">
            <Label htmlFor="arNotes" className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              Collections Notes
            </Label>
            <Textarea
              id="arNotes"
              value={formData.arNotes}
              onChange={(e) =>
                setFormData({ ...formData, arNotes: e.target.value })
              }
              placeholder="Add internal notes about collections strategy, payment preferences, etc."
              rows={4}
              data-testid="textarea-ar-notes"
            />
            <p className="text-xs text-slate-500">
              Internal notes visible only to your team
            </p>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> These changes are stored locally for collections purposes only. 
              They will not be synced back to {contact.companyName || "your accounting system"}.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateARMutation.isPending}
              data-testid="button-cancel-ar-edit"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateARMutation.isPending}
              className="bg-[#17B6C3] hover:bg-[#1396A1]"
              data-testid="button-save-ar-details"
            >
              {updateARMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
