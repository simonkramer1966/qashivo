import Anthropic from "@anthropic-ai/sdk";
import { logLLMCall, logLLMCallManual, type LLMLogContext } from "../admin/llmLogger";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("[Claude] ANTHROPIC_API_KEY is not set — server cannot start without it.");
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Model tiers — adjust as needed
const MODELS = {
  fast: "claude-haiku-4-5-20251001" as const,
  standard: "claude-sonnet-4-6" as const,
  advanced: "claude-opus-4-6" as const,
};

type ModelTier = keyof typeof MODELS;

interface GenerateTextOptions {
  system: string;
  prompt: string;
  model?: ModelTier;
  temperature?: number;
  maxTokens?: number;
  logContext?: LLMLogContext;
}

interface GenerateJSONOptions extends GenerateTextOptions {
  /** Optional hint for the expected JSON shape — appended to the system prompt */
  schemaHint?: string;
}

/**
 * Generate a plain-text completion from Claude.
 */
export async function generateText(opts: GenerateTextOptions): Promise<string> {
  const { system, prompt, model = "fast", temperature = 0.3, maxTokens = 1024, logContext } = opts;
  const modelId = MODELS[model];

  if (logContext) {
    const response = await logLLMCall(
      {
        tenantId: logContext.tenantId,
        caller: logContext.caller,
        relatedEntityType: logContext.relatedEntityType,
        relatedEntityId: logContext.relatedEntityId,
        model: modelId,
        systemPrompt: system,
        userMessage: prompt,
        metadata: logContext.metadata,
      },
      () => anthropic.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: "user", content: prompt }],
      }, { timeout: 30_000 }),
    );

    const block = response.content[0];
    if (block.type !== "text") {
      throw new Error(`Unexpected content block type: ${block.type}`);
    }
    return block.text;
  }

  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: prompt }],
  }, { timeout: 30_000 });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected content block type: ${block.type}`);
  }
  return block.text;
}

export type { ModelTier };
export type { LLMLogContext };

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface GenerateConversationOptions {
  system: string;
  messages: ConversationMessage[];
  model?: ModelTier;
  temperature?: number;
  maxTokens?: number;
  logContext?: LLMLogContext;
}

/**
 * Generate a response from Claude given a full conversation history.
 * Use this for multi-turn conversations like Riley chat.
 */
export async function generateConversation(opts: GenerateConversationOptions): Promise<string> {
  const { system, messages, model = "standard", temperature = 0.4, maxTokens = 1024, logContext } = opts;
  const modelId = MODELS[model];
  const userMessage = messages.filter(m => m.role === "user").map(m => m.content).join("\n---\n");

  if (logContext) {
    const response = await logLLMCall(
      {
        tenantId: logContext.tenantId,
        caller: logContext.caller,
        relatedEntityType: logContext.relatedEntityType,
        relatedEntityId: logContext.relatedEntityId,
        model: modelId,
        systemPrompt: system,
        userMessage,
        metadata: logContext.metadata,
      },
      () => anthropic.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        temperature,
        system,
        messages,
      }, { timeout: 30_000 }),
    );

    const block = response.content[0];
    if (block.type !== "text") {
      throw new Error(`Unexpected content block type: ${block.type}`);
    }
    return block.text;
  }

  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: maxTokens,
    temperature,
    system,
    messages,
  }, { timeout: 30_000 });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected content block type: ${block.type}`);
  }
  return block.text;
}

/**
 * Stream a conversation response from Claude, yielding text deltas.
 * Use this for real-time SSE streaming in chat interfaces.
 */
export async function streamConversation(
  opts: GenerateConversationOptions,
  onDelta: (text: string) => void,
): Promise<string> {
  const { system, messages, model = "standard", temperature = 0.4, maxTokens = 1024, logContext } = opts;
  const modelId = MODELS[model];
  const start = Date.now();

  const stream = anthropic.messages.stream({
    model: modelId,
    max_tokens: maxTokens,
    temperature,
    system,
    messages,
  }, { timeout: 30_000 });

  let fullText = "";

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
      onDelta(event.delta.text);
    }
  }

  // Log streaming calls manually after completion
  if (logContext) {
    const userMessage = messages.filter(m => m.role === "user").map(m => m.content).join("\n---\n");
    logLLMCallManual({
      tenantId: logContext.tenantId,
      caller: logContext.caller,
      relatedEntityType: logContext.relatedEntityType,
      relatedEntityId: logContext.relatedEntityId,
      model: modelId,
      systemPrompt: system,
      userMessage,
      assistantResponse: fullText,
      latencyMs: Date.now() - start,
      metadata: logContext.metadata,
    });
  }

  return fullText;
}

/**
 * Generate a JSON response from Claude and parse it.
 * Returns a typed object — caller is responsible for runtime validation.
 */
export async function generateJSON<T = unknown>(opts: GenerateJSONOptions): Promise<T> {
  const systemWithJson = opts.schemaHint
    ? `${opts.system}\n\nRespond with valid JSON only, no markdown formatting.\nExpected shape: ${opts.schemaHint}`
    : `${opts.system}\n\nRespond with valid JSON only, no markdown formatting.`;

  const text = await generateText({
    ...opts,
    system: systemWithJson,
  });

  // Strip markdown fences if present (Claude sometimes wraps JSON in ```json ... ```)
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}
