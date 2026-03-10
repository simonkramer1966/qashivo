import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { PartnerWaitlist } from "@shared/schema";

const Q_LABELS = [
  "SME clients",
  "Credit control offered?",
  "Clients with late payment",
  "Current setup",
  "Pilot timeline",
];

type SortKey = "createdAt" | "fullName" | "firmName" | "email";
type SortDir = "asc" | "desc";

function SortableHeader({
  label,
  sortKey,
  active,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const isActive = active === sortKey;
  return (
    <th
      className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          dir === "asc" ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
        )}
      </span>
    </th>
  );
}

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

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "createdAt") {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else {
        av = (a[sortKey] ?? "").toLowerCase();
        bv = (b[sortKey] ?? "").toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [entries, sortKey, sortDir]);

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
                  <SortableHeader label="Date" sortKey="createdAt" active={sortKey} dir={sortDir} onClick={handleSort} />
                  <SortableHeader label="Name" sortKey="fullName" active={sortKey} dir={sortDir} onClick={handleSort} />
                  <SortableHeader label="Firm" sortKey="firmName" active={sortKey} dir={sortDir} onClick={handleSort} />
                  <SortableHeader label="Email" sortKey="email" active={sortKey} dir={sortDir} onClick={handleSort} />
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Mobile</th>
                  {Q_LABELS.map((l) => (
                    <th key={l} className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{l}</th>
                  ))}
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Q4 Other</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e, i) => (
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
