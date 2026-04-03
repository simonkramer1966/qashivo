import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import {
  getRileyResponse,
  getRileyResponseStreaming,
  extractIntelligence,
  getProactiveSuggestions,
  type RileyTopic,
} from "../agents/rileyAssistant";

const VALID_TOPICS = new Set<RileyTopic>([
  "debtor_intel",
  "forecast_input",
  "system_help",
  "onboarding",
  "weekly_review",
]);

export function registerRileyRoutes(app: Express): void {
  // ── POST /api/riley/message ─────────────────────────────────
  // Supports two modes:
  //   stream: false (default) — returns full JSON response
  //   stream: true — returns Server-Sent Events with text deltas
  app.post("/api/riley/message", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const {
        message,
        pageContext,
        extendedContext,
        topic,
        conversationId,
        relatedEntityType,
        relatedEntityId,
        stream,
      } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      const resolvedTopic: RileyTopic =
        topic && VALID_TOPICS.has(topic as RileyTopic)
          ? (topic as RileyTopic)
          : "system_help";

      // ── Non-streaming path (existing behaviour) ─────────────
      if (!stream) {
        const result = await getRileyResponse({
          tenantId: user.tenantId,
          userId: user.id,
          conversationId: conversationId || null,
          userMessage: message.trim(),
          pageContext: pageContext || "unknown",
          extendedContext: extendedContext || undefined,
          topic: resolvedTopic,
          relatedEntityType: relatedEntityType || undefined,
          relatedEntityId: relatedEntityId || undefined,
        });

        // Fire-and-forget intelligence extraction
        extractIntelligence(result.conversationId, user.tenantId).catch((err) =>
          console.error("[Riley] Background extraction failed:", err),
        );

        return res.json({
          response: result.response,
          conversationId: result.conversationId,
        });
      }

      // ── Streaming path (SSE) ────────────────────────────────
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      });

      // Detect client disconnect
      let clientDisconnected = false;
      req.on("close", () => {
        clientDisconnected = true;
      });

      const writeSse = (data: Record<string, unknown>) => {
        if (clientDisconnected) return;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const { conversationId: convId } = await getRileyResponseStreaming({
        tenantId: user.tenantId,
        userId: user.id,
        conversationId: conversationId || null,
        userMessage: message.trim(),
        pageContext: pageContext || "unknown",
        extendedContext: extendedContext || undefined,
        topic: resolvedTopic,
        relatedEntityType: relatedEntityType || undefined,
        relatedEntityId: relatedEntityId || undefined,

        onDelta(text) {
          writeSse({ delta: text });
        },

        onDone(fullResponse, finalConvId) {
          writeSse({ done: true, conversationId: finalConvId });
          res.end();

          // Fire-and-forget intelligence extraction
          extractIntelligence(finalConvId, user.tenantId!).catch((err) =>
            console.error("[Riley] Background extraction failed:", err),
          );
        },

        onError(error: any) {
          console.error("[Riley] Stream error:", {
            message: error?.message,
            status: error?.status,
            statusCode: error?.statusCode,
            type: error?.type || error?.error?.type,
            name: error?.name,
            stack: error?.stack?.split("\n").slice(0, 5).join("\n"),
          });
          writeSse({ error: "Response generation failed" });
          res.end();
        },
      });

      // Send conversationId immediately so client can track it
      writeSse({ conversationId: convId });

    } catch (error: any) {
      console.error("[Riley] Error processing message:", {
        message: error?.message,
        status: error?.status,
        type: error?.type || error?.error?.type,
        stack: error?.stack?.split("\n").slice(0, 5).join("\n"),
      });
      // If headers already sent (streaming started), just end
      if (res.headersSent) {
        try { res.write(`data: ${JSON.stringify({ error: "Response generation failed" })}\n\n`); } catch {}
        res.end();
      } else {
        res.status(500).json({ message: "Failed to process message" });
      }
    }
  });

  // ── GET /api/riley/conversations ────────────────────────────
  app.get("/api/riley/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const conversations = await storage.listRileyConversations(user.tenantId);

      const summaries = conversations.slice(0, 10).map((c) => {
        const messages = (c.messages as Array<{ role: string; content: string }>) || [];
        const lastMessage = messages[messages.length - 1];
        const preview = lastMessage
          ? lastMessage.content.slice(0, 100) + (lastMessage.content.length > 100 ? "…" : "")
          : "";

        return {
          id: c.id,
          topic: c.topic,
          relatedEntityType: c.relatedEntityType,
          relatedEntityId: c.relatedEntityId,
          updatedAt: c.updatedAt,
          messageCount: messages.length,
          lastMessagePreview: preview,
        };
      });

      res.json(summaries);
    } catch (error) {
      console.error("[Riley] Error listing conversations:", error);
      res.status(500).json({ message: "Failed to list conversations" });
    }
  });

  // ── GET /api/riley/conversation/:id ─────────────────────────
  app.get("/api/riley/conversation/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const conversation = await storage.getRileyConversation(
        req.params.id,
        user.tenantId,
      );

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      res.json(conversation);
    } catch (error) {
      console.error("[Riley] Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  // ── GET /api/riley/proactive ────────────────────────────────
  app.get("/api/riley/proactive", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const suggestions = await getProactiveSuggestions(user.tenantId);
      res.json(suggestions);
    } catch (error) {
      console.error("[Riley] Error fetching proactive suggestions:", error);
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });

  // ── GET /api/riley/health ─────────────────────────────────────
  // Quick diagnostic — is the Anthropic API reachable?
  app.get("/api/riley/health", isAuthenticated, async (_req: any, res) => {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    const keyPrefix = process.env.ANTHROPIC_API_KEY?.substring(0, 10) || "NOT SET";

    if (!hasKey) {
      return res.json({ status: "error", reason: "ANTHROPIC_API_KEY not set", keyPrefix });
    }

    try {
      const { generateText } = await import("../services/llm/claude");
      const result = await generateText({
        system: "Reply with exactly: ok",
        prompt: "health check",
        model: "fast",
        maxTokens: 5,
      });
      res.json({ status: "ok", response: result.trim(), keyPrefix });
    } catch (error: any) {
      res.json({
        status: "error",
        reason: error?.message || "Unknown error",
        errorStatus: error?.status,
        errorType: error?.type || error?.error?.type,
        keyPrefix,
      });
    }
  });
}
