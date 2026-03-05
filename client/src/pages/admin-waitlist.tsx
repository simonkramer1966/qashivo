import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import type { PartnerWaitlist } from "@shared/schema";

const Q_LABELS = [
  "SME clients",
  "Credit control offered?",
  "Clients with late payment",
  "Current setup",
  "Pilot timeline",
];

function downloadCsv(entries: PartnerWaitlist[]) {
  const headers = [
    "Date",
    "Full Name",
    "Firm",
    "Email",
    "Mobile",
    ...Q_LABELS,
    "Q4 Other",
    "Source",
  ];

  const rows = entries.map((e) => [
    new Date(e.createdAt).toISOString(),
    e.fullName,
    e.firmName,
    e.email,
    e.mobile,
    e.q1,
    e.q2,
    e.q3,
    e.q4,
    e.q5,
    e.otherText ?? "",
    e.sourcePath,
  ]);

  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `partner-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminWaitlist() {
  const { data: entries, isLoading } = useQuery<PartnerWaitlist[]>({
    queryKey: ["/api/admin/waitlist"],
  });

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Partner Waitlist</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isLoading ? "Loading…" : `${entries?.length ?? 0} application${entries?.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!entries?.length}
            onClick={() => entries && downloadCsv(entries)}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        ) : !entries?.length ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <p className="text-sm">No applications yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Firm</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Mobile</th>
                  {Q_LABELS.map((l) => (
                    <th key={l} className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{l}</th>
                  ))}
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Q4 Other</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-muted/20"}`}
                  >
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{e.fullName}</td>
                    <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{e.firmName}</td>
                    <td className="px-4 py-2.5 text-foreground whitespace-nowrap">
                      <a href={`mailto:${e.email}`} className="hover:underline">{e.email}</a>
                    </td>
                    <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{e.mobile}</td>
                    <td className="px-4 py-2.5 text-foreground">{e.q1}</td>
                    <td className="px-4 py-2.5 text-foreground">{e.q2}</td>
                    <td className="px-4 py-2.5 text-foreground">{e.q3}</td>
                    <td className="px-4 py-2.5 text-foreground">{e.q4}</td>
                    <td className="px-4 py-2.5 text-foreground">{e.q5}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.otherText ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
