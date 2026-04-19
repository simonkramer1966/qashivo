/**
 * Voice Call Post-Processing — Briefing linkage + outcome recording
 *
 * Called fire-and-forget from the Retell call-ended webhook.
 * Links completed calls back to their voiceCallBriefings record,
 * writes voiceCallOutcomes, publishes CIE outcomes with influence
 * metadata, and transitions conversation state.
 *
 * Non-fatal — every step is try/caught so webhook processing
 * is never blocked by post-call failures.
 */

import { db } from "../db";
import { eq } from "drizzle-orm";
import { voiceCallBriefings, voiceCallOutcomes } from "@shared/schema";

export interface PostCallParams {
  retellCallId: string;
  tenantId: string;
  contactId: string;
  actionId: string | undefined;
  voiceStatus: string; // completed | no_answer | busy | voicemail | failed
  durationSeconds: number;
  recordingUrl: string | null;
  transcriptText: string | null;
  transcriptSummary: string | null;
  callOutcome: string; // ptp_captured | dispute_raised | completed | refused | wrong_contact | callback_requested | no_answer | busy | voicemail | failed
  capturedPtp: { amount?: string; date?: string } | null;
  capturedDispute: string | null;
  extractedData: Record<string, any>;
}

const OUTCOME_MAP: Record<string, string> = {
  ptp_captured: "payment_date_secured",
  dispute_raised: "dispute_raised",
  callback_requested: "callback_requested",
  wrong_contact: "wrong_number",
  refused: "no_commitment",
  completed: "no_commitment",
  no_answer: "no_commitment",
  busy: "no_commitment",
  voicemail: "voicemail_left",
  failed: "no_commitment",
};

export async function processPostCallOutcome(params: PostCallParams): Promise<void> {
  const { retellCallId } = params;

  // Step A: Look up briefing by retellCallId
  const [briefing] = await db
    .select()
    .from(voiceCallBriefings)
    .where(eq(voiceCallBriefings.retellCallId, retellCallId))
    .limit(1);

  if (!briefing) return; // legacy call — no briefing-backed processing

  console.log(`[PostCall] Processing briefing-backed call ${retellCallId} (briefing ${briefing.id})`);

  // Step B: Update briefing callStatus
  try {
    const { updateBriefingCallStatus } = await import("../agents/retellPromptBuilder.js");
    const briefingStatus = ["no_answer", "busy", "voicemail"].includes(params.voiceStatus)
      ? "no_answer"
      : params.voiceStatus; // completed or failed
    await updateBriefingCallStatus(briefing.id, retellCallId, briefingStatus);
  } catch (err) {
    console.warn("[PostCall] Failed to update briefing status:", err);
  }

  // Step C: Write voiceCallOutcomes record
  try {
    await db
      .insert(voiceCallOutcomes)
      .values({
        tenantId: params.tenantId,
        contactId: params.contactId,
        briefingId: briefing.id,
        retellCallId,
        callDuration: params.durationSeconds,
        completionStatus: params.voiceStatus,
        recordingUrl: params.recordingUrl,
        transcriptText: params.transcriptText,
        transcriptSummary: params.transcriptSummary,
        extractedOutcome: OUTCOME_MAP[params.callOutcome] || "no_commitment",
        extractedPaymentDate:
          params.extractedData?.promiseToPayDate || params.capturedPtp?.date || null,
        extractedPaymentAmount:
          params.extractedData?.promiseToPayAmount ||
          params.capturedPtp?.amount ||
          null,
        extractedInstalmentsCount: params.extractedData?.instalmentsCount || null,
        extractedDisputeReason:
          params.capturedDispute || params.extractedData?.disputeCategory || null,
        extractedCallbackDate: params.extractedData?.callbackTime
          ? new Date(params.extractedData.callbackTime)
          : null,
        extractedNewContactName: params.extractedData?.newContactName || null,
        extractedNewContactEmail: params.extractedData?.newContactEmail || null,
        extractedNewContactPhone: params.extractedData?.newContactPhone || null,
        intentAnalysisJson: params.extractedData,
        influenceBarrier: briefing.influenceBarrier,
        influenceStrategy: briefing.influenceStrategy,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.warn("[PostCall] Failed to write voiceCallOutcomes:", err);
  }

  // Step D: Publish CIE outcome with influence metadata from briefing
  if (briefing.influenceBarrier && briefing.influenceStrategy) {
    try {
      const { publishInfluenceOutcome, getActionInfluenceMetadata } = await import(
        "./influence/ciePublisher.js"
      );
      const meta = briefing.actionId
        ? await getActionInfluenceMetadata(briefing.actionId)
        : null;

      const cieOutcome =
        params.callOutcome === "ptp_captured"
          ? "promised"
          : ["no_answer", "busy", "failed"].includes(params.callOutcome)
            ? "ignored"
            : "unknown";

      void publishInfluenceOutcome(
        params.tenantId,
        params.contactId,
        {
          channel: "voice",
          toneLevel: briefing.toneLevel || "professional",
          barrier: briefing.influenceBarrier,
          strategyName: briefing.influenceStrategy,
          daysOverdue: meta?.daysOverdue ?? 0,
          amountBand: meta?.amountBand ?? "unknown",
          sequencePosition: meta?.sequencePosition ?? 0,
        },
        { type: cieOutcome, daysToOutcome: null },
      );
    } catch (err) {
      console.warn("[PostCall] CIE outcome publish failed:", err);
    }
  }

  // Step E: Transition conversation state
  const shouldTransition =
    params.voiceStatus === "completed" ||
    params.callOutcome === "ptp_captured" ||
    params.callOutcome === "dispute_raised";

  if (shouldTransition && params.contactId) {
    try {
      const { transitionState } = await import("./conversationStateService.js");
      const trigger =
        params.callOutcome === "ptp_captured" || params.callOutcome === "dispute_raised"
          ? "intent_classified"
          : "chase_sent";

      await transitionState(params.tenantId, params.contactId, trigger as any, {
        eventId: retellCallId,
        eventType: "voice_call",
        intent: params.callOutcome,
      });
    } catch (err) {
      console.warn("[PostCall] Conversation state transition failed:", err);
    }
  }

  console.log(
    `[PostCall] Done processing call ${retellCallId}: outcome=${params.callOutcome}, briefing=${briefing.id}`,
  );
}
