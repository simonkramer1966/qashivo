import Anthropic from "@anthropic-ai/sdk";

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
}

interface GenerateJSONOptions extends GenerateTextOptions {
  /** Optional hint for the expected JSON shape — appended to the system prompt */
  schemaHint?: string;
}

/**
 * Generate a plain-text completion from Claude.
 */
export async function generateText(opts: GenerateTextOptions): Promise<string> {
  const { system, prompt, model = "fast", temperature = 0.3, maxTokens = 1024 } = opts;

  const response = await anthropic.messages.create({
    model: MODELS[model],
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected content block type: ${block.type}`);
  }
  return block.text;
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
