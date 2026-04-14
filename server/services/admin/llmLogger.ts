import { db } from "../../db";
import { adminLlmLogs } from "@shared/schema";

// Cost per 1M tokens (USD)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.25, output: 1.25 },
  "claude-opus-4-6": { input: 15, output: 75 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): string {
  const costs = MODEL_COSTS[model];
  if (!costs) return "0";
  const cost = (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
  return cost.toFixed(6);
}

export interface LLMLogParams {
  tenantId?: string;
  caller: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  metadata?: Record<string, unknown>;
}

export interface LLMLogContext {
  tenantId?: string;
  caller: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Wraps a Claude API call to log prompt/response/tokens/cost/latency.
 * Transparent wrapper — returns the original API response unchanged.
 * Fire-and-forget DB insert; never blocks the caller.
 */
export async function logLLMCall<T>(params: LLMLogParams, apiCallFn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  let response: T;

  try {
    response = await apiCallFn();
  } catch (error: any) {
    const latencyMs = Date.now() - start;

    // Log the failed call
    db.insert(adminLlmLogs)
      .values({
        tenantId: params.tenantId ?? null,
        caller: params.caller,
        relatedEntityType: params.relatedEntityType ?? null,
        relatedEntityId: params.relatedEntityId ?? null,
        model: params.model,
        systemPrompt: params.systemPrompt,
        userMessage: params.userMessage,
        assistantResponse: null,
        inputTokens: null,
        outputTokens: null,
        latencyMs,
        costUsd: null,
        error: error?.message ?? String(error),
        metadata: params.metadata ?? null,
      })
      .catch((err) => console.error("[LLMLogger] Failed to log error call:", err));

    throw error;
  }

  const latencyMs = Date.now() - start;

  // Extract response fields from Anthropic message shape
  const res = response as any;
  const assistantResponse = res?.content?.[0]?.text ?? null;
  const inputTokens = res?.usage?.input_tokens ?? null;
  const outputTokens = res?.usage?.output_tokens ?? null;
  const costUsd =
    inputTokens != null && outputTokens != null
      ? calculateCost(params.model, inputTokens, outputTokens)
      : null;

  db.insert(adminLlmLogs)
    .values({
      tenantId: params.tenantId ?? null,
      caller: params.caller,
      relatedEntityType: params.relatedEntityType ?? null,
      relatedEntityId: params.relatedEntityId ?? null,
      model: params.model,
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      assistantResponse,
      inputTokens,
      outputTokens,
      latencyMs,
      costUsd,
      error: null,
      metadata: params.metadata ?? null,
    })
    .catch((err) => console.error("[LLMLogger] Failed to log call:", err));

  return response;
}

/**
 * Log an LLM call manually — for streaming calls where we only have
 * the final text + token count after completion.
 * Fire-and-forget DB insert; never blocks the caller.
 */
export function logLLMCallManual(params: LLMLogParams & {
  assistantResponse?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  error?: string;
}): void {
  const costUsd =
    params.inputTokens != null && params.outputTokens != null
      ? calculateCost(params.model, params.inputTokens, params.outputTokens)
      : null;

  db.insert(adminLlmLogs)
    .values({
      tenantId: params.tenantId ?? null,
      caller: params.caller,
      relatedEntityType: params.relatedEntityType ?? null,
      relatedEntityId: params.relatedEntityId ?? null,
      model: params.model,
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      assistantResponse: params.assistantResponse ?? null,
      inputTokens: params.inputTokens ?? null,
      outputTokens: params.outputTokens ?? null,
      latencyMs: params.latencyMs,
      costUsd,
      error: params.error ?? null,
      metadata: params.metadata ?? null,
    })
    .catch((err) => console.error("[LLMLogger] Failed to log manual call:", err));
}
