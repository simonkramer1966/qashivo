import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Treemap, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import DebtorPopup from "./DebtorPopup";
import { OVERDUE_COLORS, getCellColor, getTextColor } from "./colors";
import type { HeatmapDebtor } from "./DebtorHeatmap";

const TREEMAP_HEIGHT = 640;

const fmt = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

interface DebtorTreemapProps {
  debtors: HeatmapDebtor[];
  isLoading: boolean;
}

interface TreemapCellProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  oldestOverdueDays: number;
  totalOutstanding: number;
  id: string;
  onCellClick: (id: string) => void;
  onCellEnter: (debtor: HeatmapDebtor, rect: { x: number; y: number; width: number; height: number }) => void;
  onCellLeave: () => void;
  // All original debtor fields passed through by recharts
  [key: string]: any;
}

function TreemapCell(props: TreemapCellProps) {
  const {
    x, y, width, height,
    name, oldestOverdueDays, totalOutstanding, id,
    onCellClick, onCellEnter, onCellLeave,
    // extract debtor fields for popup
    overdueAmount, riskBand, riskScore, paymentBehaviour, invoiceCount,
  } = props;

  if (width <= 0 || height <= 0) return null;

  const overdueOnly = props.overdueOnly as boolean;
  const isGreyed = overdueOnly && (!oldestOverdueDays || oldestOverdueDays <= 0);
  const color = isGreyed ? "#E8E8E8" : getCellColor(oldestOverdueDays ?? 0);
  const textColor = isGreyed ? "#999999" : getTextColor(oldestOverdueDays ?? 0);
  const fillOpacity = isGreyed ? 0.4 : 1;
  const showText = width > 60 && height > 28;
  const maxChars = Math.floor(width / 7);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="#FFFFFF"
        strokeWidth={2}
        rx={2}
        ry={2}
        opacity={fillOpacity}
        style={{ cursor: "pointer" }}
        onClick={() => onCellClick(id)}
        onMouseEnter={() =>
          onCellEnter(
            { id, name, totalOutstanding, overdueAmount, oldestOverdueDays, riskBand, riskScore, paymentBehaviour, invoiceCount },
            { x, y, width, height }
          )
        }
        onMouseLeave={onCellLeave}
      />
      {showText && (
        <>
          <text
            x={x + 6}
            y={y + 16}
            fill={textColor}
            fontSize={11}
            fontWeight={500}
            style={{ pointerEvents: "none" }}
          >
            {name.length > maxChars ? name.slice(0, maxChars) + "…" : name}
          </text>
          <text
            x={x + 6}
            y={y + 29}
            fill={textColor}
            fontSize={10}
            opacity={0.8}
            style={{ pointerEvents: "none" }}
          >
            {fmt(totalOutstanding)}
          </text>
        </>
      )}
    </g>
  );
}

export default function DebtorTreemap({ debtors, isLoading }: DebtorTreemapProps) {
  const [, navigate] = useLocation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hoveredDebtor, setHoveredDebtor] = useState<HeatmapDebtor | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [overdueOnly, setOverdueOnly] = useState(false);

  const handleCellClick = useCallback(
    (id: string) => navigate(`/qollections/debtors/${id}`),
    [navigate]
  );

  const handleCellEnter = useCallback(
    (debtor: HeatmapDebtor, rect: { x: number; y: number; width: number; height: number }) => {
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      if (!wrapperRect) return;

      const spaceRight = wrapperRect.width - (rect.x + rect.width);
      const side = spaceRight > 230 ? "right" : "left";

      let y = rect.y;
      if (TREEMAP_HEIGHT - rect.y < 160) {
        y = Math.max(0, y - 100);
      }

      setPopupPos({
        x: side === "right" ? rect.x + rect.width + 8 : rect.x - 228,
        y,
      });
      setHoveredDebtor(debtor);
    },
    []
  );

  const handleCellLeave = useCallback(() => setHoveredDebtor(null), []);

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

  const treemapData = debtors
    .filter((d) => d.totalOutstanding > 0)
    .map((d) => ({
      ...d,
      size: d.totalOutstanding,
    }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">Debtor Treemap</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {overdueOnly
                ? `${debtors.filter((d) => d.oldestOverdueDays > 0).length} debtors overdue of ${debtors.length}`
                : `${debtors.length} debtor${debtors.length !== 1 ? "s" : ""}`}
              {" · cell size = outstanding amount · colour = days overdue"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="overdue-toggle" checked={overdueOnly} onCheckedChange={setOverdueOnly} />
              <label htmlFor="overdue-toggle" className="text-xs text-muted-foreground cursor-pointer">
                Show only overdue
              </label>
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
        </div>
      </CardHeader>
      <CardContent>
        <div ref={wrapperRef} className="relative">
          <ResponsiveContainer width="100%" height={TREEMAP_HEIGHT}>
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={1}
              content={
                <TreemapCell
                  x={0} y={0} width={0} height={0}
                  name="" oldestOverdueDays={0} totalOutstanding={0} id=""
                  onCellClick={handleCellClick}
                  onCellEnter={handleCellEnter}
                  onCellLeave={handleCellLeave}
                  overdueOnly={overdueOnly}
                />
              }
            />
          </ResponsiveContainer>

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
