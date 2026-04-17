/**
 * Influence Engine — barrel export.
 *
 * Phase 1: Diagnostic layer + prompt architecture.
 * Every debtor-facing communication receives a barrier diagnosis and
 * structured PCP (Perception-Context-Permission) guidance.
 */

export {
  type InfluenceBarrier,
  type BarrierDiagnosis,
  type BarrierContext,
  buildBarrierContext,
  diagnoseBarrier,
} from "./barrierDiagnostic";

export {
  type EscalationStage,
  type InfluenceStrategy,
  deriveEscalationStage,
  selectStrategy,
} from "./strategySelector";

export {
  type DebtorBriefContext,
  generateInfluenceBrief,
  generateSmsInfluenceBrief,
} from "./influenceBriefGenerator";
