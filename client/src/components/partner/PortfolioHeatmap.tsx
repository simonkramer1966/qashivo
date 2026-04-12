import { useMemo, useRef, useState, useCallback } from "react";
import { Treemap, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { usePartnerContext } from "@/hooks/usePartnerContext";

const TREEMAP_HEIGHT = 400;

const HEALTH_COLORS = [
  { max: 0, color: "#EAF3DE", label: "Current" },
  { max: 10, color: "#C0DD97", label: "1-10d" },
  { max: 30, color: "#EF9F27", label: "11-30d" },
  { max: 60, color: "#E24B4A", label: "31-60d" },
  { max: 90, color: "#C00000", label: "61-90d" },
  { max: Infinity, color: "#7B1515", label: "90d+" },
];

function getHealthColor(daysOverdue: number): string {
  for (const c of HEALTH_COLORS) {
    if (daysOverdue <= c.max) return c.color;
  }
  return HEALTH_COLORS[HEALTH_COLORS.length - 1].color;
}

function getTextColor(daysOverdue: number): string {
  if (daysOverdue <= 10) return "#27500A";
  if (daysOverdue <= 30) return "#633806";
  return "#FFFFFF";
}

const fmt = (amount: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

export interface HeatmapClient {
  tenantId: string;
  name: string;
  outstanding: number;
  overdue: number;
  oldestOverdueDays: number;
}

interface PortfolioHeatmapProps {
  clients: HeatmapClient[];
  isLoading: boolean;
}

interface CellProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  outstanding: number;
  overdue: number;
  oldestOverdueDays: number;
  tenantId: string;
  arTotal: number;
  onCellClick: (tenantId: string) => void;
  onCellEnter: (client: HeatmapClient, rect: DOMRect | { x: number; y: number; width: number; height: number }) => void;
  onCellLeave: () => void;
  [key: string]: any;
}

function HeatmapCell(props: CellProps) {
  const { x, y, width, height, name, outstanding, oldestOverdueDays, tenantId, arTotal, onCellClick, onCellEnter, onCellLeave } = props;

  if (width <= 0 || height <= 0) return null;

  const color = getHealthColor(oldestOverdueDays ?? 0);
  const textColor = getTextColor(oldestOverdueDays ?? 0);
  const showText = width > 60 && height > 28;
  const maxChars = Math.floor(width / 7);
  const pct = arTotal > 0 ? ((outstanding / arTotal) * 100).toFixed(1) : "0.0";

  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        fill={color} stroke="#FFFFFF" strokeWidth={2} rx={2} ry={2}
        style={{ cursor: "pointer" }}
        onClick={() => onCellClick(tenantId)}
        onMouseEnter={() => onCellEnter(
          { tenantId, name, outstanding, overdue: props.overdue, oldestOverdueDays },
          { x, y, width, height }
        )}
        onMouseLeave={onCellLeave}
      />
      {showText && (
        <>
          <text x={x + 6} y={y + 16} fill={textColor} fontSize={11} fontWeight={500} style={{ pointerEvents: "none" }}>
            {name.length > maxChars ? name.slice(0, maxChars) + "\u2026" : name}
          </text>
          <text x={x + 6} y={y + 29} fill={textColor} fontSize={10} opacity={0.8} style={{ pointerEvents: "none" }}>
            {fmt(outstanding)} · {pct}%
          </text>
        </>
      )}
    </g>
  );
}

export default function PortfolioHeatmap({ clients, isLoading }: PortfolioHeatmapProps) {
  const { switchTenant } = usePartnerContext();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HeatmapClient | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const treemapData = useMemo(
    () => clients
      .filter(c => c.outstanding > 0)
      .map(c => ({ ...c, size: c.outstanding })),
    [clients]
  );

  const arTotal = useMemo(
    () => treemapData.reduce((sum, c) => sum + c.outstanding, 0),
    [treemapData]
  );

  const handleCellClick = useCallback(
    (tenantId: string) => switchTenant(tenantId),
    [switchTenant]
  );

  const handleCellEnter = useCallback(
    (client: HeatmapClient, rect: { x: number; y: number; width: number; height: number }) => {
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      if (!wrapperRect) return;
      const spaceRight = wrapperRect.width - (rect.x + rect.width);
      const side = spaceRight > 220 ? "right" : "left";
      let cy = rect.y;
      if (TREEMAP_HEIGHT - rect.y < 140) cy = Math.max(0, cy - 80);
      setPopupPos({
        x: side === "right" ? rect.x + rect.width + 8 : rect.x - 218,
        y: cy,
      });
      setHovered(client);
    },
    []
  );

  const handleCellLeave = useCallback(() => setHovered(null), []);

  if (isLoading) {
    return (
      <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-5">
        <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">Portfolio Health</h3>
        <Skeleton className="w-full mt-4" style={{ height: TREEMAP_HEIGHT }} />
      </div>
    );
  }

  if (clients.length === 0 || treemapData.length === 0) {
    return (
      <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-5">
        <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">Portfolio Health</h3>
        <div className="flex items-center justify-center py-8 text-sm text-[var(--q-text-tertiary)]">
          No clients with outstanding balances
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">Portfolio Health</h3>
          <p className="text-[11px] text-[var(--q-text-tertiary)] mt-0.5">
            {clients.length} client{clients.length !== 1 ? "s" : ""} · cell size = outstanding · colour = oldest overdue
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[var(--q-text-tertiary)]">
          <span>Current</span>
          {HEALTH_COLORS.map(c => (
            <span key={c.label} className="inline-block rounded-sm" style={{ width: 16, height: 8, backgroundColor: c.color }} />
          ))}
          <span>90d+</span>
        </div>
      </div>

      <div ref={wrapperRef} className="relative">
        <ResponsiveContainer width="100%" height={TREEMAP_HEIGHT}>
          <Treemap
            data={treemapData}
            dataKey="size"
            aspectRatio={1}
            content={
              <HeatmapCell
                x={0} y={0} width={0} height={0}
                name="" outstanding={0} overdue={0} oldestOverdueDays={0} tenantId=""
                arTotal={arTotal}
                onCellClick={handleCellClick}
                onCellEnter={handleCellEnter}
                onCellLeave={handleCellLeave}
              />
            }
          />
        </ResponsiveContainer>

        {hovered && (
          <div
            className="absolute z-50 bg-[var(--q-chart-tooltip-bg)] text-white rounded-lg shadow-lg p-3 pointer-events-none"
            style={{ left: popupPos.x, top: popupPos.y, width: 210 }}
          >
            <p className="text-xs font-semibold mb-1.5 truncate">{hovered.name}</p>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Outstanding</span>
                <span className="font-medium">{fmt(hovered.outstanding)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Overdue</span>
                <span className="font-medium text-red-300">{fmt(hovered.overdue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Oldest overdue</span>
                <span className="font-medium">{hovered.oldestOverdueDays}d</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">% of portfolio</span>
                <span className="font-medium">{arTotal > 0 ? ((hovered.outstanding / arTotal) * 100).toFixed(1) : "0.0"}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
