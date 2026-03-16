import { generateJSON } from "./llm/claude";
import { db } from "../db";
import { actions } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

interface ChatTurn {
  role: "riley" | "user";
  message: string;
}

interface RileyResponse {
  reply: string;
  category?: string; // tone_wrong, timing_wrong, wrong_contact, wrong_action, compliance_concern, other
  done: boolean;
}

const SYSTEM_PROMPT = `You are Riley, an AI assistant embedded in Qashivo's Action Centre.
A collections agent has rejected an AI-proposed action. Your job is to understand WHY and classify the rejection.

You are having a brief inline chat (2-3 turns max) with the user. Be concise and professional.

Turn 1: You already know what the action was. Ask the user what was wrong.
Turn 2+: Based on their response, classify into one of these categories:
- tone_wrong: The tone/wording was inappropriate
- timing_wrong: Bad timing to contact this debtor
- wrong_contact: Wrong person or contact method
- wrong_action: Wrong type of action entirely
- compliance_concern: Legal or regulatory issue
- other: Doesn't fit above

Then ask: "Should this apply as a rule going forward, or just this time?"

When you have enough information, set done=true and include the category.

Respond as JSON: { "reply": "...", "category": "..." (optional), "done": false/true }`;

/**
 * Process a rejection chat message for an action.
 * Chat history is stored namespaced at metadata.riley.chatHistory[].
 */
export async function processRejectionChat(
  actionId: string,
  userMessage: string
): Promise<RileyResponse> {
  // Get action and existing chat history
  const [action] = await db
    .select({ id: actions.id, metadata: actions.metadata, actionSummary: actions.actionSummary, subject: actions.subject, type: actions.type })
    .from(actions)
    .where(eq(actions.id, actionId))
    .limit(1);

  if (!action) throw new Error("Action not found");

  const meta = (action.metadata ?? {}) as Record<string, any>;
  const riley = meta.riley ?? {};
  const chatHistory: ChatTurn[] = riley.chatHistory ?? [];

  // Build prompt from history
  const actionDesc = action.actionSummary || action.subject || `${action.type} action`;
  const historyStr = chatHistory
    .map((t) => `${t.role === "riley" ? "Riley" : "User"}: ${t.message}`)
    .join("\n");

  const prompt = `Action that was rejected: "${actionDesc}"

Previous conversation:
${historyStr || "(none)"}

User's latest message: ${userMessage}

Respond as JSON with { "reply", "category" (if determined), "done" }.`;

  const response = await generateJSON<RileyResponse>({
    system: SYSTEM_PROMPT,
    prompt,
    model: "fast",
    temperature: 0.4,
    maxTokens: 300,
    schemaHint: '{ "reply": "string", "category?": "string", "done": "boolean" }',
  });

  // Append both turns to history
  const updatedHistory = [
    ...chatHistory,
    { role: "user" as const, message: userMessage },
    { role: "riley" as const, message: response.reply },
  ];

  // Save to metadata.riley namespace (Amendment 2 — never write to root keys)
  await db
    .update(actions)
    .set({
      metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
        riley: { chatHistory: updatedHistory, category: response.category, done: response.done },
      })}::jsonb`,
      updatedAt: new Date(),
      // Also set real column if category determined
      ...(response.category ? { rejectionCategory: response.category } : {}),
    })
    .where(eq(actions.id, actionId));

  return response;
}
