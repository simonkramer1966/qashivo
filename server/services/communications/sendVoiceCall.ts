/**
 * Central Voice Call Wrapper — Communication Mode Enforcement
 *
 * SECURITY: ALL outbound voice calls MUST go through this wrapper.
 * Never call Retell APIs directly from routes, agents, or services.
 *
 * Mirrors the enforcement pattern used by:
 * - Email: enforceCommunicationMode() in server/services/sendgrid.ts
 * - SMS: mode check in server/services/vonage.ts
 */

export interface SendVoiceCallParams {
  tenantId: string;
  to: string;                           // Real intended phone number
  contactName: string;
  agentId: string;                      // Retell agent ID
  fromNumber?: string;
  dynamicVariables?: Record<string, any>;
  metadata?: Record<string, any>;
  context?: string;                     // Logging context (e.g. 'AI_CALL', 'SYSTEM_CALL')
}

export interface VoiceCallResult {
  callId: string;
  status: string;
  fromNumber: string;
  toNumber: string;
  agentId: string;
  direction: string;
  modeApplied: string;
  originalRecipient: string;
}

export async function sendVoiceCall(params: SendVoiceCallParams): Promise<VoiceCallResult> {
  const {
    tenantId,
    to,
    contactName,
    agentId,
    fromNumber,
    dynamicVariables = {},
    metadata = {},
    context = 'VOICE_CALL',
  } = params;

  // ── 1. Demo mode short-circuit ────────────────────────────────
  const { demoModeService } = await import('../demoModeService.js');
  if (demoModeService.isEnabled()) {
    console.log(`🎭 [${context}] Demo mode: Skipping real voice call, returning mock`);
    return {
      callId: 'demo-mock-voice-' + Date.now(),
      status: 'demo',
      fromNumber: fromNumber || process.env.RETELL_PHONE_NUMBER || '',
      toNumber: to,
      agentId,
      direction: 'outbound',
      modeApplied: 'demo',
      originalRecipient: to,
    };
  }

  // ── 2. Communication mode enforcement ─────────────────────────
  let actualTo = to;
  let actualContactName = contactName;
  let mode = 'unknown';

  try {
    const { db } = await import('../../db.js');
    const { tenants } = await import('../../../shared/schema.js');
    const { eq } = await import('drizzle-orm');

    const [tenant] = await db.select({
      communicationMode: tenants.communicationMode,
      testPhones: tenants.testPhones,
      testContactName: tenants.testContactName,
    }).from(tenants).where(eq(tenants.id, tenantId));

    mode = tenant?.communicationMode || 'testing'; // Default to testing, not live

    console.log(`📞 [VoiceCommMode] tenant=${tenantId} mode=${mode} intendedRecipient=${to} contact=${contactName}`);

    // MODE: OFF — hard block
    if (mode === 'off') {
      console.log(`🚫 [VoiceCommMode] BLOCKED — mode is OFF for tenant ${tenantId}`);
      throw new Error('Communication mode is OFF — all outbound voice calls blocked');
    }

    // MODE: TESTING or SOFT_LIVE — redirect to test phone
    if (mode === 'testing' || mode === 'soft_live') {
      const testPhones = tenant?.testPhones as string[] | null;
      if (testPhones?.length) {
        const originalTo = actualTo;
        actualTo = testPhones[0];
        const testContactNameOverride = tenant?.testContactName as string | null;
        if (testContactNameOverride) {
          actualContactName = testContactNameOverride;
        }
        const modeLabel = mode === 'testing' ? 'TEST' : 'SOFT LIVE';
        console.log(`🧪 [VoiceCommMode] ${modeLabel} redirect from ${originalTo} → ${actualTo}`);
      }
    }

    // MODE: LIVE — send to real recipient, no modification
    if (mode === 'live') {
      console.log(`🟢 [VoiceCommMode] LIVE — calling real recipient ${to}`);
    }
  } catch (err: any) {
    if (err.message?.includes('Communication mode is OFF')) {
      throw err; // Re-throw intentional blocks
    }
    console.warn('[VoiceSafetyNet] Could not check communication mode:', err);
    // Fail closed — if we can't verify the mode, block the call
    if (process.env.NODE_ENV === 'production') {
      console.error('🚫 [VoiceSafetyNet] BLOCKING voice call — cannot verify communication mode in production');
      throw new Error('Cannot verify communication mode — voice call blocked for safety');
    }
    // In development, allow through with warning
    console.warn('⚠️ [VoiceSafetyNet] Allowing call in development despite mode check failure');
  }

  // ── 3. Log the call attempt ───────────────────────────────────
  console.log(`📞 [${context}] Voice call dispatch: mode=${mode} intended=${to} actual=${actualTo} contact=${actualContactName}`);

  // ── 4. Dispatch via unified Retell helper ─────────────────────
  const { createUnifiedRetellCall } = await import('../../utils/retellCallHelper.js');

  // Inject mode context into dynamic variables so the voice agent knows
  const enrichedVariables = {
    ...dynamicVariables,
    customerName: actualContactName,
  };

  // If redirected, add original recipient info to metadata
  const enrichedMetadata = {
    ...metadata,
    tenantId,
    communicationMode: mode,
    ...(actualTo !== to ? { originalRecipient: to, originalContactName: contactName } : {}),
  };

  const callResult = await createUnifiedRetellCall({
    fromNumber: fromNumber || process.env.RETELL_PHONE_NUMBER,
    toNumber: actualTo,
    agentId,
    dynamicVariables: enrichedVariables,
    metadata: enrichedMetadata,
    context,
  });

  return {
    callId: callResult.callId,
    status: callResult.status,
    fromNumber: callResult.fromNumber,
    toNumber: callResult.toNumber,
    agentId: callResult.agentId,
    direction: callResult.direction,
    modeApplied: mode,
    originalRecipient: to,
  };
}
