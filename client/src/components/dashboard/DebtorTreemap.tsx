import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import DebtorPopup from "./DebtorPopup";
import { OVERDUE_COLORS, getCellColor, getTextColor } from "./colors";
import type { HeatmapDebtor } from "./DebtorHeatmap";

const TREEMAP_HEIGHT = 320;

const fmt = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

interface DebtorTreemapProps {
  debtors: HeatmapDebtor[];
  isLoading: boolean;
}

export default function DebtorTreemap({ debtors, isLoading }: DebtorTreemapProps) {
  const [, navigate] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoveredDebtor, setHoveredDebtor] = useState<HeatmapDebtor | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const leaves = useMemo(() => {
    if (width <= 0 || debtors.length === 0) return [];

    const root = hierarchy<{ children?: HeatmapDebtor[] }>({ children: debtors })
      .sum((d) => (d as any).totalOutstanding ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    treemap<{ children?: HeatmapDebtor[] }>()
      .size([width, TREEMAP_HEIGHT])
      .tile(treemapSquarify)
      .padding(2)(root);

    return root.leaves();
  }, [debtors, width]);

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
          <CardTitle className="text-sm font-semibold">Debtor Treemap</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height: TREEMAP_HEIGHT }} />
        </CardContent>
      </Card>
    );
  }

  if (debtors.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Debtor Treemap</CardTitle>
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
            <CardTitle className="text-sm font-semibold">Debtor Treemap</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {debtors.length} debtor{debtors.length !== 1 ? "s" : ""} · cell size = outstanding amount · colour = days overdue
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
      <CardContent className="p-0">
        <div ref={containerRef} className="relative mx-6 mb-6" style={{ height: TREEMAP_HEIGHT }}>
          {width > 0 && leaves.map((leaf) => {
            const d = leaf.data as HeatmapDebtor;
            const x0 = leaf.x0 ?? 0;
            const y0 = leaf.y0 ?? 0;
            const x1 = leaf.x1 ?? 0;
            const y1 = leaf.y1 ?? 0;
            const cellW = x1 - x0;
            const cellH = y1 - y0;
            const showText = cellW > 60 && cellH > 30;

            return (
              <div
                key={d.id}
                className="absolute cursor-pointer transition-opacity hover:opacity-80 overflow-hidden"
                style={{
                  left: x0,
                  top: y0,
                  width: cellW,
                  height: cellH,
                  backgroundColor: getCellColor(d.oldestOverdueDays),
                  borderRadius: 2,
                }}
                onClick={() => navigate(`/qollections/debtors/${d.id}`)}
                onMouseEnter={(e) => handleMouseEnter(d, e)}
                onMouseLeave={() => setHoveredDebtor(null)}
              >
                {showText && (
                  <div className="p-1.5" style={{ color: getTextColor(d.oldestOverdueDays) }}>
                    <div className="truncate" style={{ fontSize: 11, fontWeight: 500, lineHeight: "14px" }}>
                      {d.name}
                    </div>
                    <div className="truncate opacity-80" style={{ fontSize: 10, lineHeight: "13px" }}>
                      {fmt(d.totalOutstanding)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

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
