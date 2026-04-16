export interface DebtorPopupData {
  id: string;
  name: string;
  totalOutstanding: number;
  overdueAmount: number;
  oldestOverdueDays: number;
  riskBand?: string | null;
  riskScore?: number | null;
  paymentBehaviour?: string | null;
}

const fmt = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

interface DebtorPopupProps {
  debtor: DebtorPopupData;
  position: { x: number; y: number };
  visible: boolean;
  arTotal?: number;
}

export default function DebtorPopup({ debtor, position, visible, arTotal }: DebtorPopupProps) {
  if (!visible) return null;

  return (
    <div
      className="absolute z-50 bg-popover border rounded-lg shadow-lg p-3 w-[220px] pointer-events-none"
      style={{ left: position.x, top: position.y }}
    >
      <div className="text-sm font-medium truncate">{debtor.name}</div>
      <div className="mt-1.5 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Outstanding</span>
          <span className="font-medium">{fmt(debtor.totalOutstanding)}</span>
        </div>
        {arTotal != null && arTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">% of total</span>
            <span>{((debtor.totalOutstanding / arTotal) * 100).toFixed(1)}% of AR</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Overdue</span>
          {debtor.overdueAmount > 0 ? (
            <span className="font-medium text-red-600">{fmt(debtor.overdueAmount)}</span>
          ) : (
            <span className="text-green-600">None</span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Days overdue</span>
          <span>
            {debtor.oldestOverdueDays > 0
              ? `${debtor.oldestOverdueDays} days overdue`
              : "Current"}
          </span>
        </div>
        {debtor.riskBand && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Risk</span>
            <span className="capitalize">
              {debtor.riskBand}
              {debtor.riskScore != null && (
                <span className="text-muted-foreground ml-1">{debtor.riskScore}/100</span>
              )}
            </span>
          </div>
        )}
        {debtor.paymentBehaviour && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Behaviour</span>
            <span className="capitalize">{debtor.paymentBehaviour}</span>
          </div>
        )}
      </div>
      <div className="mt-2 text-[10px] text-primary">
        View customer detail →
      </div>
    </div>
  );
}
