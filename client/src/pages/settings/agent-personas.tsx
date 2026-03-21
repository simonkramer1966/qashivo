import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Mail,
} from "lucide-react";

interface AgentPersona {
  id: string;
  tenantId: string;
  personaName: string;
  jobTitle: string;
  emailSignatureName: string;
  emailSignatureTitle: string;
  emailSignatureCompany: string;
  emailSignaturePhone: string | null;
  toneDefault: string;
  voiceCharacteristics: unknown;
  companyContext: string | null;
  sectorContext: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface PersonaForm {
  personaName: string;
  jobTitle: string;
  emailSignatureName: string;
  emailSignatureTitle: string;
  emailSignatureCompany: string;
  emailSignaturePhone: string;
  toneDefault: string;
  companyContext: string;
  sectorContext: string;
  isActive: boolean;
}

const EMPTY_FORM: PersonaForm = {
  personaName: "",
  jobTitle: "",
  emailSignatureName: "",
  emailSignatureTitle: "",
  emailSignatureCompany: "",
  emailSignaturePhone: "",
  toneDefault: "professional",
  companyContext: "",
  sectorContext: "general",
  isActive: true,
};

const TONE_OPTIONS = [
  { value: "professional", label: "Professional", color: "bg-blue-100 text-blue-700" },
  { value: "friendly", label: "Friendly", color: "bg-emerald-100 text-emerald-700" },
  { value: "firm", label: "Firm", color: "bg-amber-100 text-amber-700" },
  { value: "empathetic", label: "Empathetic", color: "bg-purple-100 text-purple-700" },
];

function getToneBadgeClass(tone: string): string {
  return TONE_OPTIONS.find((t) => t.value === tone)?.color ?? "bg-gray-100 text-gray-700";
}

export default function SettingsAgentPersonas() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PersonaForm>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: personas, isLoading } = useQuery<AgentPersona[]>({
    queryKey: ["/api/personas"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: PersonaForm) => {
      const res = await apiRequest("POST", "/api/personas", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      setDialogOpen(false);
      toast({ title: "Persona created", description: "New agent persona has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create persona.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PersonaForm }) => {
      const res = await apiRequest("PATCH", `/api/personas/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      setDialogOpen(false);
      setEditingId(null);
      toast({ title: "Persona updated", description: "Agent persona has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update persona.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/personas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      setDeleteConfirmId(null);
      toast({ title: "Persona deleted", description: "Agent persona has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete persona.", variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (persona: AgentPersona) => {
    setEditingId(persona.id);
    setForm({
      personaName: persona.personaName,
      jobTitle: persona.jobTitle,
      emailSignatureName: persona.emailSignatureName,
      emailSignatureTitle: persona.emailSignatureTitle,
      emailSignatureCompany: persona.emailSignatureCompany,
      emailSignaturePhone: persona.emailSignaturePhone ?? "",
      toneDefault: persona.toneDefault,
      companyContext: persona.companyContext ?? "",
      sectorContext: persona.sectorContext ?? "general",
      isActive: persona.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.personaName.trim()) {
      toast({ title: "Validation", description: "Persona name is required.", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const updateField = <K extends keyof PersonaForm>(field: K, value: PersonaForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <AppShell title="Agent Personas" subtitle="Configure agent personalities and behaviour">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24 mt-1" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Agent Personas" subtitle="Configure agent personalities and behaviour">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {personas?.length ?? 0} persona{(personas?.length ?? 0) !== 1 ? "s" : ""} configured
          </p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Persona
          </Button>
        </div>

        {/* Persona Cards */}
        {(!personas || personas.length === 0) ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium mb-1">No personas yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first agent persona to start sending AI-generated collection emails.
              </p>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Persona
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {personas.map((persona) => (
              <Card key={persona.id} className={!persona.isActive ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{persona.personaName}</CardTitle>
                    </div>
                    <Badge variant={persona.isActive ? "default" : "secondary"}>
                      {persona.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {persona.jobTitle && (
                    <p className="text-sm text-muted-foreground">{persona.jobTitle}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Tone:</span>
                    <Badge variant="outline" className={getToneBadgeClass(persona.toneDefault)}>
                      {persona.toneDefault}
                    </Badge>
                  </div>

                  {/* Signature preview */}
                  {(persona.emailSignatureName || persona.emailSignatureCompany) && (
                    <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-0.5">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Mail className="h-3 w-3" />
                        <span>Signature</span>
                      </div>
                      {persona.emailSignatureName && (
                        <p className="font-medium text-sm">{persona.emailSignatureName}</p>
                      )}
                      {persona.emailSignatureTitle && (
                        <p className="text-muted-foreground">{persona.emailSignatureTitle}</p>
                      )}
                      {persona.emailSignatureCompany && (
                        <p className="text-muted-foreground">{persona.emailSignatureCompany}</p>
                      )}
                    </div>
                  )}

                  <Separator />

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(persona)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(persona.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Persona" : "Add Persona"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* Identity */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Identity</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="personaName">Persona Name *</Label>
                    <Input
                      id="personaName"
                      placeholder="e.g. Charlie"
                      value={form.personaName}
                      onChange={(e) => updateField("personaName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title</Label>
                    <Input
                      id="jobTitle"
                      placeholder="e.g. Credit Controller"
                      value={form.jobTitle}
                      onChange={(e) => updateField("jobTitle", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Email Signature */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Email Signature</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailSignatureName">Name</Label>
                    <Input
                      id="emailSignatureName"
                      placeholder="e.g. Charlie Smith"
                      value={form.emailSignatureName}
                      onChange={(e) => updateField("emailSignatureName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailSignatureTitle">Title</Label>
                    <Input
                      id="emailSignatureTitle"
                      placeholder="e.g. Credit Controller"
                      value={form.emailSignatureTitle}
                      onChange={(e) => updateField("emailSignatureTitle", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailSignatureCompany">Company</Label>
                    <Input
                      id="emailSignatureCompany"
                      placeholder="e.g. Acme Recruitment Ltd"
                      value={form.emailSignatureCompany}
                      onChange={(e) => updateField("emailSignatureCompany", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailSignaturePhone">Phone (optional)</Label>
                    <Input
                      id="emailSignaturePhone"
                      placeholder="e.g. +44 20 7123 4567"
                      value={form.emailSignaturePhone}
                      onChange={(e) => updateField("emailSignaturePhone", e.target.value)}
                    />
                  </div>
                </div>

                {/* Signature Preview */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Signature Preview</Label>
                  <div className="rounded-md border bg-muted/30 p-4 text-sm">
                    <p className="font-medium">{form.emailSignatureName || "Agent Name"}</p>
                    <p className="text-muted-foreground text-xs">{form.emailSignatureTitle || "Title"}</p>
                    <p className="text-muted-foreground text-xs">{form.emailSignatureCompany || "Company"}</p>
                    {form.emailSignaturePhone && (
                      <p className="text-muted-foreground text-xs">{form.emailSignaturePhone}</p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tone */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Tone</h4>
                <Select value={form.toneDefault} onValueChange={(v) => updateField("toneDefault", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Context */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Context</h4>
                <div className="space-y-2">
                  <Label htmlFor="companyContext">Company Context</Label>
                  <Textarea
                    id="companyContext"
                    placeholder="Describe your company and any specific instructions for the agent..."
                    value={form.companyContext}
                    onChange={(e) => updateField("companyContext", e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sectorContext">Sector Context</Label>
                  <Textarea
                    id="sectorContext"
                    placeholder="e.g. recruitment, manufacturing, professional services..."
                    value={form.sectorContext}
                    onChange={(e) => updateField("sectorContext", e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Only active personas can be used for agent communications.
                  </p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => updateField("isActive", checked)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Save Changes" : "Create Persona"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Persona</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this persona? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
