import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Debtor {
  id: string;
  name: string;
  totalOutstanding: number;
  overdueAmount: number;
  oldestOverdueDays: number;
  riskBand?: string | null;
  riskScore?: number | null;
  paymentBehaviour?: string | null;
  invoiceCount: number;
}

const fmt = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

const COLORS = [
  { max: 0, color: "#EAF3DE", label: "Current" },
  { max: 10, color: "#C0DD97", label: "1–10d" },
  { max: 30, color: "#EF9F27", label: "11–30d" },
  { max: 60, color: "#E24B4A", label: "31–60d" },
  { max: 90, color: "#C00000", label: "61–90d" },
  { max: Infinity, color: "#7B1515", label: "90d+" },
];

function getCellColor(daysOverdue: number): string {
  for (const c of COLORS) {
    if (daysOverdue <= c.max) return c.color;
  }
  return COLORS[COLORS.length - 1].color;
}

export default function DebtorHeatmap() {
  const [, navigate] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDebtor, setHoveredDebtor] = useState<Debtor | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number; side: "right" | "left" }>({ x: 0, y: 0, side: "right" });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { data: debtorsResponse, isLoading } = useQuery<{ debtors: Debtor[]; unmatchedCredits: number }>({
    queryKey: ["/api/qollections/debtors"],
    refetchInterval: 60000,
  });

  const debtors = useMemo(() => {
    const list = debtorsResponse?.debtors ?? [];
    return [...list].sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [debtorsResponse]);

  const maxOutstanding = useMemo(
    () => debtors.reduce((max, d) => Math.max(max, d.totalOutstanding), 0),
    [debtors]
  );

  const minSize = isMobile ? 16 : 20;
  const maxSize = isMobile ? 36 : 48;
  const sizeRange = maxSize - minSize;

  const getCellSize = (outstanding: number) => {
    if (maxOutstanding === 0) return minSize;
    return Math.round(minSize + (outstanding / maxOutstanding) * sizeRange);
  };

  const handleMouseEnter = (debtor: Debtor, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const spaceRight = containerRect.right - rect.right;
    const side = spaceRight > 220 ? "right" : "left";

    let y = rect.top - containerRect.top;
    if (containerRect.bottom - rect.bottom < 160) {
      y = Math.max(0, y - 100);
    }

    setPopupPos({
      x: side === "right" ? rect.right - containerRect.left + 8 : rect.left - containerRect.left - 228,
      y,
      side,
    });
    setHoveredDebtor(debtor);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Debtor Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[120px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (debtors.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Debtor Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No debtors with outstanding balances
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">Debtor Heatmap</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {debtors.length} debtor{debtors.length !== 1 ? "s" : ""} · ordered by outstanding · colour = days overdue
            </p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Current</span>
            {COLORS.map((c) => (
              <span
                key={c.label}
                className="inline-block rounded-sm"
                style={{ width: 16, height: 8, backgroundColor: c.color }}
              />
            ))}
            <span>90d+ overdue</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative">
          <div className="flex flex-wrap" style={{ gap: 3 }}>
            {debtors.map((debtor) => {
              const size = getCellSize(debtor.totalOutstanding);
              return (
                <div
                  key={debtor.id}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  style={{
                    width: size,
                    height: size,
                    backgroundColor: getCellColor(debtor.oldestOverdueDays),
                    borderRadius: 3,
                  }}
                  onClick={() => navigate(`/qollections/debtors/${debtor.id}`)}
                  onMouseEnter={(e) => handleMouseEnter(debtor, e)}
                  onMouseLeave={() => setHoveredDebtor(null)}
                />
              );
            })}
          </div>

          {/* Hover popup */}
          {hoveredDebtor && (
            <div
              className="absolute z-50 bg-popover border rounded-lg shadow-lg p-3 w-[220px] pointer-events-none"
              style={{
                left: popupPos.x,
                top: popupPos.y,
              }}
            >
              <div className="text-sm font-medium truncate">{hoveredDebtor.name}</div>
              <div className="mt-1.5 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-medium">{fmt(hoveredDebtor.totalOutstanding)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overdue</span>
                  {hoveredDebtor.overdueAmount > 0 ? (
                    <span className="font-medium text-red-600">{fmt(hoveredDebtor.overdueAmount)}</span>
                  ) : (
                    <span className="text-green-600">None</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days overdue</span>
                  <span>
                    {hoveredDebtor.oldestOverdueDays > 0
                      ? `${hoveredDebtor.oldestOverdueDays} days overdue`
                      : "Current"}
                  </span>
                </div>
                {hoveredDebtor.riskBand && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk</span>
                    <span className="capitalize">
                      {hoveredDebtor.riskBand}
                      {hoveredDebtor.riskScore != null && (
                        <span className="text-muted-foreground ml-1">{hoveredDebtor.riskScore}/100</span>
                      )}
                    </span>
                  </div>
                )}
                {hoveredDebtor.paymentBehaviour && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Behaviour</span>
                    <span className="capitalize">{hoveredDebtor.paymentBehaviour}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 text-[10px] text-primary">
                View debtor detail →
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
