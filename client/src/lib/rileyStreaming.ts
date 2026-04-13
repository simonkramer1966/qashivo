/**
 * Shared SSE streaming helper for Riley chat components.
 * Used by both FloatingRileyChat (SME Riley) and PortfolioRileyChat (Partner Riley).
 */

async function getClerkToken(): Promise<string | undefined> {
  try {
    const clerk = (window as any).Clerk;
    if (clerk?.session) {
      return await clerk.session.getToken();
    }
  } catch {
    // Clerk not initialised yet
  }
  return undefined;
}

export async function sendStreamingMessage(
  endpoint: string,
  body: Record<string, unknown>,
  callbacks: {
    onConversationId: (id: string) => void;
    onDelta: (text: string) => void;
    onDone: (conversationId: string) => void;
    onError: (error: string) => void;
  },
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await getClerkToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, stream: true }),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("ReadableStream not supported");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(trimmed.slice(6));

        if (data.conversationId && !data.done) {
          callbacks.onConversationId(data.conversationId);
        }
        if (data.delta) {
          callbacks.onDelta(data.delta);
        }
        if (data.done) {
          callbacks.onDone(data.conversationId);
          return;
        }
        if (data.error) {
          callbacks.onError(data.error);
          return;
        }
      } catch {
        // Skip malformed SSE lines
      }
    }
  }
}
