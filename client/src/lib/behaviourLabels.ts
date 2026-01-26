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
  
  // A = On Time, B = Late Reliable, C = Inconsistent, D or no band = Unknown
  switch (band) {
    case "A":
      return { 
        label: "Pays on time", 
        context: "Invoices typically settled on or before due date" 
      };
    case "B":
      return { 
        label: "Pays late but reliable", 
        context: "Reliable payment behaviour, typically after due date" 
      };
    case "C":
      return { 
        label: "Inconsistent", 
        context: "Payment timing varies" 
      };
    case "D":
    case "E":
      return { 
        label: "Unknown", 
        context: "Limited payment history" 
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
          return { label: "Unknown", context: "Limited payment history" };
        }
      }
      return { label: "Unknown", context: "Limited payment history" };
  }
}

export function getBehaviourLabelStyle(label: BehaviourLabel): string {
  return "text-slate-600";
}
