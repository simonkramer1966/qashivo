/**
 * Influence Engine — barrel export.
 *
 * Phase 1: Diagnostic layer + prompt architecture.
 * Phase 2: Technique translation layer (22 named keys → LLM instructions).
 * Phase 3: Voice call influence brief (barrier openings, calibrated
 *          questions, de-escalation protocols, voicemail scripts).
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

export {
  type VoiceDebtorContext,
  type VoiceAgentContext,
  generateVoiceCallBrief,
} from "./voiceCallBriefGenerator";
