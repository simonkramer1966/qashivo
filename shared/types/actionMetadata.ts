/**
 * Shared constants and types for `actions.metadata` jsonb field.
 *
 * The metadata column is loosely typed at the DB level (jsonb), but several
 * keys carry semantic meaning across the planner, executor, route handlers,
 * and UI. Centralising the literals here prevents typos that would silently
 * break routing (e.g. the executor's `conversation_reply` detour or the
 * approvals-tab "Reply" badge).
 */

export const CONVERSATION_TYPE = {
  REPLY: "conversation_reply",
} as const;

export type ConversationType =
  (typeof CONVERSATION_TYPE)[keyof typeof CONVERSATION_TYPE];
