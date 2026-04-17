/**
 * Influence Engine — barrel export.
 *
 * Phase 1: Diagnostic layer + prompt architecture.
 * Phase 2: Technique translation layer (22 named keys → LLM instructions).
 * Phase 3: Voice call influence brief (barrier openings, calibrated
 *          questions, de-escalation protocols, voicemail scripts).
 * Phase 4: SMS tone ceiling + barrier-specific compression guidance.
 * Phase 5: CIE integration stubs (social proof consumer + outcome publisher).
 * Phase 6: Vulnerability detection (Haiku classification, chasing pause,
 *          supportive mode, manager review workflow).
 * Phase 7: Persona framing modes (in-house / agency / escalation,
 *          per-debtor identity switching, transition emails).
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

export {
  type SocialProofData,
  getSocialProofData,
} from "./cieConsumer";

export {
  type ActionInfluenceMeta,
  getAmountBand,
  getActionInfluenceMetadata,
  publishInfluenceOutcome,
} from "./ciePublisher";

export {
  type PersonaFraming,
  type IdentityMode,
  resolvePersonaFraming,
  hasContactReceivedAgencyCommunication,
  generateTransitionEmailContent,
} from "./personaFraming";
