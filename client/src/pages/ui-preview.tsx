import { useState } from "react";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

const MOCK_CUSTOMERS = [
  { id: "1", company: "Nexus Engineering Ltd", contact: "Sarah Thornton", outstanding: 48200, overdue: 32100, daysPastDue: 47, band: "inconsistent", lastContact: "12/02/26" },
  { id: "2", company: "Meridian Consulting Group", contact: "James Hartley", outstanding: 22750, overdue: 0, daysPastDue: 0, band: "ontime", lastContact: "28/02/26" },
  { id: "3", company: "Apex Building Solutions", contact: "Clare Webb", outstanding: 91400, overdue: 61400, daysPastDue: 83, band: "inconsistent", lastContact: "05/01/26" },
  { id: "4", company: "Birchwood Recruitment", contact: "Tom Aldridge", outstanding: 14300, overdue: 14300, daysPastDue: 29, band: "late", lastContact: "18/02/26" },
  { id: "5", company: "Vantage Facilities Management", contact: "Priya Nair", outstanding: 7600, overdue: 0, daysPastDue: 0, band: "ontime", lastContact: "01/03/26" },
  { id: "6", company: "Clearstone Legal LLP", contact: "Michael Finn", outstanding: 33900, overdue: 18500, daysPastDue: 38, band: "late", lastContact: "14/02/26" },
  { id: "7", company: "Hartfield Media", contact: "Emma Lowe", outstanding: 5200, overdue: 5200, daysPastDue: 61, band: "inconsistent", lastContact: "22/01/26" },
  { id: "8", company: "Sovereign Property Group", contact: "David Park", outstanding: 128000, overdue: 0, daysPastDue: 0, band: "ontime", lastContact: "03/03/26" },
  { id: "9", company: "Kestrel Logistics Ltd", contact: "Rachel Burns", outstanding: 19400, overdue: 9700, daysPastDue: 21, band: "late", lastContact: "25/02/26" },
  { id: "10", company: "Greenfield Advisory", contact: "Chris Malone", outstanding: 4800, overdue: 0, daysPastDue: 0, band: "unknown", lastContact: "—" },
];

const CURRENT_TOKENS = {
  "--preview-radius": "1rem",
  "--preview-input-radius": "0.75rem",
  "--preview-btn-radius": "1rem",
  "--preview-foreground": "215 16% 20%",
  "--preview-muted": "215 20% 45%",
  "--preview-border": "214 32% 91%",
  "--preview-font-weight": "400",
  "--preview-header-weight": "600",
  "--preview-h4-transform": "none",
  "--preview-h4-tracking": "normal",
  "--preview-h4-size": "0.875rem",
  "--preview-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  "--preview-row-hover": "249 250 251",
};

const PROPOSED_TOKENS = {
  "--preview-radius": "0.5rem",
  "--preview-input-radius": "0.375rem",
  "--preview-btn-radius": "0.375rem",
  "--preview-foreground": "215 25% 13%",
  "--preview-muted": "215 16% 38%",
  "--preview-border": "214 20% 86%",
  "--preview-font-weight": "500",
  "--preview-header-weight": "600",
  "--preview-h4-transform": "uppercase",
  "--preview-h4-tracking": "0.05em",
  "--preview-h4-size": "0.6875rem",
  "--preview-shadow": "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
  "--preview-row-hover": "248 250 252",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function BandDot({ band }: { band: string }) {
  const colour = band === "ontime" ? "#10b981" : band === "late" ? "#f59e0b" : band === "inconsistent" ? "#f43f5e" : "#cbd5e1";
  return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: colour, flexShrink: 0 }} />;
}

function BandLabel({ band }: { band: string }) {
  if (band === "ontime") return <span style={{ color: "#059669", fontSize: "inherit" }}>On time</span>;
  if (band === "late") return <span style={{ color: "#d97706", fontSize: "inherit" }}>Pays late</span>;
  if (band === "inconsistent") return <span style={{ color: "#e11d48", fontSize: "inherit" }}>Inconsistent</span>;
  return <span style={{ color: "#94a3b8", fontSize: "inherit" }}>Unknown</span>;
}

function CustomerTable({ tokens }: { tokens: Record<string, string> }) {
  const [search, setSearch] = useState("");
  const visible = MOCK_CUSTOMERS.filter(c =>
    c.company.toLowerCase().includes(search.toLowerCase()) ||
    c.contact.toLowerCase().includes(search.toLowerCase())
  );

  const fg = `hsl(${tokens["--preview-foreground"]})`;
  const muted = `hsl(${tokens["--preview-muted"]})`;
  const border = `hsl(${tokens["--preview-border"]})`;
  const radius = tokens["--preview-radius"];
  const inputRadius = tokens["--preview-input-radius"];
  const fontWeight = tokens["--preview-font-weight"];
  const shadow = tokens["--preview-shadow"];
  const rowHoverRgb = tokens["--preview-row-hover"];
  const h4Size = tokens["--preview-h4-size"];
  const h4Transform = tokens["--preview-h4-transform"] as "uppercase" | "none";
  const h4Tracking = tokens["--preview-h4-tracking"];

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight, color: fg, background: "#fff", minHeight: "100vh" }}>

      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${border}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: fg, fontFamily: "'Archivo', sans-serif", letterSpacing: "-0.01em" }}>
            Customers
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: muted, fontWeight }}>
            Qashivo manages collections automatically. Review is only needed when something is flagged.
          </p>
        </div>
        <div style={{ position: "relative", width: 260 }}>
          <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: muted }} />
          <input
            type="text"
            placeholder="Find a customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              paddingLeft: 32,
              paddingRight: 12,
              height: 34,
              fontSize: "0.8125rem",
              color: fg,
              background: "transparent",
              border: `1px solid ${border}`,
              borderRadius: inputRadius,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div style={{ padding: "24px 32px" }}>

        {/* Stats row */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: "0 0 12px", fontSize: h4Size, color: muted, textTransform: h4Transform, letterSpacing: h4Tracking, fontWeight: 600 }}>
            Debtor Behaviour Profiles
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            {[
              { band: "ontime", label: "Usually pay on time", value: "38%" },
              { band: "late", label: "Pay late but reliably", value: "44%" },
              { band: "inconsistent", label: "Inconsistent", value: "12%" },
              { band: "unknown", label: "Unknown", value: "6%" },
            ].map(s => (
              <div key={s.band}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <BandDot band={s.band} />
                  <span style={{ fontSize: "0.75rem", color: muted }}>{s.label}</span>
                </div>
                <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, color: s.band === "unknown" ? muted : fg, fontVariantNumeric: "tabular-nums" }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: `1px solid ${border}`, marginBottom: 16 }} />

        {/* Table */}
        <div style={{ border: `1px solid ${border}`, borderRadius: radius, boxShadow: shadow, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: `1px solid ${border}` }}>
                {["Company", "Contact", "Outstanding", "Overdue", "Days overdue", "Behaviour", "Last contact"].map(col => (
                  <th key={col} style={{
                    padding: "10px 16px",
                    textAlign: col === "Company" || col === "Contact" ? "left" : "right",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((c, i) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: i < visible.length - 1 ? `1px solid ${border}` : "none", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = `rgb(${rowHoverRgb})`)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "11px 16px", fontWeight: 500, color: fg }}>{c.company}</td>
                  <td style={{ padding: "11px 16px", color: muted }}>{c.contact}</td>
                  <td style={{ padding: "11px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(c.outstanding)}</td>
                  <td style={{ padding: "11px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.overdue > 0 ? "#e11d48" : muted }}>
                    {c.overdue > 0 ? fmt(c.overdue) : "—"}
                  </td>
                  <td style={{ padding: "11px 16px", textAlign: "right", color: c.daysPastDue > 60 ? "#e11d48" : c.daysPastDue > 30 ? "#d97706" : c.daysPastDue > 0 ? fg : muted }}>
                    {c.daysPastDue > 0 ? `${c.daysPastDue}d` : "—"}
                  </td>
                  <td style={{ padding: "11px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      <BandDot band={c.band} />
                      <BandLabel band={c.band} />
                    </div>
                  </td>
                  <td style={{ padding: "11px 16px", textAlign: "right", color: muted }}>{c.lastContact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: "0.8125rem", color: muted }}>
          <span>Showing {visible.length} of 24 customers</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3].map(p => (
              <button
                key={p}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: tokens["--preview-btn-radius"],
                  border: `1px solid ${p === 1 ? "#17B6C3" : border}`,
                  background: p === 1 ? "#17B6C3" : "transparent",
                  color: p === 1 ? "#fff" : muted,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  fontWeight: p === 1 ? 600 : 400,
                }}
              >
                {p}
              </button>
            ))}
            <button style={{
              width: 30,
              height: 30,
              borderRadius: tokens["--preview-btn-radius"],
              border: `1px solid ${border}`,
              background: "transparent",
              color: muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function UiPreview() {
  const [mode, setMode] = useState<"current" | "proposed">("current");
  const tokens = mode === "current" ? CURRENT_TOKENS : PROPOSED_TOKENS;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>

      {/* Control bar */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#0f172a",
        color: "#fff",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}>
        <div>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#17B6C3" }}>Qashivo</span>
          <span style={{ fontSize: "0.8125rem", color: "#94a3b8", marginLeft: 8 }}>Design Preview — mock data only, not live</span>
        </div>
        <div style={{ display: "flex", background: "#1e293b", borderRadius: 8, padding: 3, gap: 2 }}>
          {(["current", "proposed"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "none",
                background: mode === m ? "#fff" : "transparent",
                color: mode === m ? "#0f172a" : "#94a3b8",
                fontSize: "0.8125rem",
                fontWeight: mode === m ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {m === "current" ? "Current Design" : "Proposed Design"}
            </button>
          ))}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#64748b", textAlign: "right" }}>
          {mode === "current"
            ? "radius 16px · muted text 45% · border 91%"
            : "radius 8px · muted text 38% · border 86% · weight 500"}
        </div>
      </div>

      {/* Preview frame */}
      <div style={{ maxWidth: 1200, margin: "32px auto", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgb(0 0 0 / 0.12)" }}>
        <CustomerTable tokens={tokens} />
      </div>

    </div>
  );
}
