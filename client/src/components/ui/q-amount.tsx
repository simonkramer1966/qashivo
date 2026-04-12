import * as React from "react";
import { cn } from "@/lib/utils";

type QAmountVariant = "default" | "overdue" | "positive";

interface QAmountProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  variant?: QAmountVariant;
  decimals?: number;
}

const variantClasses: Record<QAmountVariant, string> = {
  default: "q-amount",
  overdue: "q-amount q-amount--overdue",
  positive: "q-amount q-amount--positive",
};

function QAmount({
  value,
  variant = "default",
  decimals = 2,
  className,
  ...props
}: QAmountProps) {
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return (
    <span className={cn(variantClasses[variant], className)} {...props}>
      {formatted}
    </span>
  );
}

export { QAmount };
export type { QAmountProps, QAmountVariant };
