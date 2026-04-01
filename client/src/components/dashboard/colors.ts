export const OVERDUE_COLORS = [
  { max: 0, color: "#EAF3DE", label: "Current" },
  { max: 10, color: "#C0DD97", label: "1–10d" },
  { max: 30, color: "#EF9F27", label: "11–30d" },
  { max: 60, color: "#E24B4A", label: "31–60d" },
  { max: 90, color: "#C00000", label: "61–90d" },
  { max: Infinity, color: "#7B1515", label: "90d+" },
];

export function getCellColor(daysOverdue: number): string {
  for (const c of OVERDUE_COLORS) {
    if (daysOverdue <= c.max) return c.color;
  }
  return OVERDUE_COLORS[OVERDUE_COLORS.length - 1].color;
}

export function getTextColor(daysOverdue: number): string {
  if (daysOverdue <= 10) return "#27500A";
  if (daysOverdue <= 30) return "#633806";
  return "#FFFFFF";
}
