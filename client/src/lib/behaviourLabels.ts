export type BehaviourLabel = 
  | "Pays on time"
  | "Pays late but reliable"
  | "Inconsistent"
  | "Unknown";

export interface BehaviourInfo {
  label: BehaviourLabel;
  context?: string;
}

export function getBehaviourLabel(riskBand?: string | null, riskScore?: number | null): BehaviourInfo {
  if (!riskBand && (riskScore === undefined || riskScore === null)) {
    return { label: "Unknown", context: "Limited payment history" };
  }

  const band = riskBand?.toUpperCase();
  
  switch (band) {
    case "A":
      return { 
        label: "Pays on time", 
        context: "Invoices typically settled on or before due date" 
      };
    case "B":
      return { 
        label: "Pays on time", 
        context: "Reliable payment behaviour" 
      };
    case "C":
      return { 
        label: "Pays late but reliable", 
        context: "Predictable payment timing, typically after due date" 
      };
    case "D":
      return { 
        label: "Inconsistent", 
        context: "Payment timing varies" 
      };
    default:
      if (riskScore !== undefined && riskScore !== null) {
        if (riskScore <= 30) {
          return { label: "Pays on time", context: "Strong payment history" };
        } else if (riskScore <= 50) {
          return { label: "Pays late but reliable" };
        } else if (riskScore <= 70) {
          return { label: "Inconsistent" };
        } else {
          return { label: "Inconsistent", context: "Requires closer supervision" };
        }
      }
      return { label: "Unknown", context: "Limited payment history" };
  }
}

export function getBehaviourLabelStyle(label: BehaviourLabel): string {
  return "text-slate-600";
}
