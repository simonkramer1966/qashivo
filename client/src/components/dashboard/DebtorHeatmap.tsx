import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import DebtorPopup, { type DebtorPopupData } from "./DebtorPopup";
import { OVERDUE_COLORS, getCellColor } from "./colors";

export interface HeatmapDebtor extends DebtorPopupData {
  invoiceCount: number;
}

interface DebtorHeatmapProps {
  debtors: HeatmapDebtor[];
  isLoading: boolean;
}

export default function DebtorHeatmap({ debtors: rawDebtors, isLoading }: DebtorHeatmapProps) {
  const [, navigate] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDebtor, setHoveredDebtor] = useState<HeatmapDebtor | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const debtors = useMemo(
    () => [...rawDebtors].sort((a, b) => b.totalOutstanding - a.totalOutstanding),
    [rawDebtors]
  );

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

  const handleMouseEnter = (debtor: HeatmapDebtor, e: React.MouseEvent<HTMLDivElement>) => {
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
            {OVERDUE_COLORS.map((c) => (
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

          <DebtorPopup
            debtor={hoveredDebtor!}
            position={popupPos}
            visible={!!hoveredDebtor}
          />
        </div>
      </CardContent>
    </Card>
  );
}
