import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  Loader2,
  Save,
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
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
  toneDefault: "friendly" | "professional" | "firm";
  companyContext: string | null;
  sectorContext: string | null;
  isActive: boolean;
}

const TONE_OPTIONS = [
  {
    value: "friendly",
    label: "Friendly",
    description: "Warm, approachable tone. Best for early-stage reminders and relationship-focused sectors.",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    value: "professional",
    label: "Professional",
    description: "Balanced and business-like. Suitable for most B2B communication.",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    value: "firm",
    label: "Firm",
    description: "Direct and assertive. For escalation stages and persistent non-payment.",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
];

const SECTOR_OPTIONS = [
  { value: "recruitment", label: "Recruitment" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "professional_services", label: "Professional Services" },
  { value: "construction", label: "Construction" },
  { value: "technology", label: "Technology" },
  { value: "general", label: "General" },
];

export default function SettingsAgentPersonas() {
  const { toast } = useToast();

  const { data: persona, isLoading } = useQuery<AgentPersona | null>({
    queryKey: ["/api/agent-persona"],
  });

  const [form, setForm] = useState({
    personaName: "",
    jobTitle: "",
    emailSignatureName: "",
    emailSignatureTitle: "",
    emailSignatureCompany: "",
    emailSignaturePhone: "",
    toneDefault: "professional" as "friendly" | "professional" | "firm",
    companyContext: "",
    sectorContext: "recruitment",
  });

  useEffect(() => {
    if (persona) {
      setForm({
        personaName: persona.personaName || "",
        jobTitle: persona.jobTitle || "",
        emailSignatureName: persona.emailSignatureName || "",
        emailSignatureTitle: persona.emailSignatureTitle || "",
        emailSignatureCompany: persona.emailSignatureCompany || "",
        emailSignaturePhone: persona.emailSignaturePhone || "",
        toneDefault: persona.toneDefault || "professional",
        companyContext: persona.companyContext || "",
        sectorContext: persona.sectorContext || "recruitment",
      });
    }
  }, [persona]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("PATCH", "/api/agent-persona", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-persona"] });
      toast({ title: "Persona saved", description: "Agent persona has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save persona.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <AppShell title="Agent Personas" subtitle="Configure agent personalities and behaviour">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Agent Personas" subtitle="Configure agent personalities and behaviour">
      <div className="max-w-4xl mx-auto space-y-6">
            {/* Identity */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-[#17B6C3]" />
                  <CardTitle>Agent Identity</CardTitle>
                </div>
                <CardDescription>
                  Set the name and role your AI agent uses when communicating with debtors.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="personaName">
                      <User className="inline h-4 w-4 mr-1" />
                      Persona Name
                    </Label>
                    <Input
                      id="personaName"
                      placeholder="e.g. Charlie"
                      value={form.personaName}
                      onChange={(e) => updateField("personaName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">
                      <Briefcase className="inline h-4 w-4 mr-1" />
                      Job Title
                    </Label>
                    <Input
                      id="jobTitle"
                      placeholder="e.g. Credit Controller"
                      value={form.jobTitle}
                      onChange={(e) => updateField("jobTitle", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Default Tone */}
            <Card>
              <CardHeader>
                <CardTitle>Default Tone</CardTitle>
                <CardDescription>
                  The baseline tone your agent uses. Individual collection steps can override this.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {TONE_OPTIONS.map((tone) => (
                    <button
                      key={tone.value}
                      type="button"
                      onClick={() => updateField("toneDefault", tone.value)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        form.toneDefault === tone.value
                          ? "border-[#17B6C3] bg-[#17B6C3]/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <Badge className={`mb-2 ${tone.color}`}>{tone.label}</Badge>
                      <p className="text-sm text-muted-foreground">{tone.description}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sector & Context */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#17B6C3]" />
                  <CardTitle>Sector & Context</CardTitle>
                </div>
                <CardDescription>
                  Help the agent understand your industry so it can tailor language and approach.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sectorContext">Industry Sector</Label>
                  <select
                    id="sectorContext"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.sectorContext}
                    onChange={(e) => updateField("sectorContext", e.target.value)}
                  >
                    {SECTOR_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyContext">Company Context</Label>
                  <textarea
                    id="companyContext"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Describe your company and any specific instructions for the agent. e.g. 'We are a recruitment agency specialising in tech placements. Our clients value personal relationships and we want to maintain goodwill throughout collections.'"
                    value={form.companyContext}
                    onChange={(e) => updateField("companyContext", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This context is injected into every LLM prompt so the agent writes emails that sound like your team.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Email Signature */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-[#17B6C3]" />
                  <CardTitle>Email Signature</CardTitle>
                </div>
                <CardDescription>
                  Configure how the agent signs emails sent to debtors.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    <Label htmlFor="emailSignatureCompany">Company Name</Label>
                    <Input
                      id="emailSignatureCompany"
                      placeholder="e.g. Acme Recruitment Ltd"
                      value={form.emailSignatureCompany}
                      onChange={(e) => updateField("emailSignatureCompany", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailSignaturePhone">
                      <Phone className="inline h-4 w-4 mr-1" />
                      Phone (optional)
                    </Label>
                    <Input
                      id="emailSignaturePhone"
                      placeholder="e.g. +44 20 7123 4567"
                      value={form.emailSignaturePhone}
                      onChange={(e) => updateField("emailSignaturePhone", e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Signature Preview */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Signature Preview</Label>
                  <div className="rounded-md border bg-muted/30 p-4 text-sm">
                    <p className="font-medium">{form.emailSignatureName || "Agent Name"}</p>
                    <p className="text-muted-foreground">
                      {form.emailSignatureTitle || "Title"}
                    </p>
                    <p className="text-muted-foreground">
                      {form.emailSignatureCompany || "Company"}
                    </p>
                    {form.emailSignaturePhone && (
                      <p className="text-muted-foreground">{form.emailSignaturePhone}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end pb-8">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="bg-[#17B6C3] hover:bg-[#14a3af] text-white"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Persona
              </Button>
            </div>
      </div>
    </AppShell>
  );
}
