/**
 * Partner Riley routes — Portfolio-level AI assistant.
 * Partner Portal Phase 6.
 */

import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import {
  getPortfolioRileyResponse,
  getPortfolioRileyResponseStreaming,
  type PortfolioRileyTopic,
} from "../agents/portfolioRileyAssistant";

const VALID_TOPICS = new Set<PortfolioRileyTopic>([
  "portfolio_overview",
  "client_comparison",
  "staff_workload",
  "system_help",
]);

export function registerPartnerRileyRoutes(app: Express): void {
  // ── POST /api/partner/riley/message ───────────────────────
  app.post("/api/partner/riley/message", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.partnerId) {
        return res.status(403).json({ message: "Not a partner user" });
      }

      const { message, currentPage, conversationId, topic, relatedEntityType, relatedEntityId, stream } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      const resolvedTopic: PortfolioRileyTopic =
        topic && VALID_TOPICS.has(topic as PortfolioRileyTopic)
          ? (topic as PortfolioRileyTopic)
          : "portfolio_overview";

      // ── Non-streaming path ──
      if (!stream) {
        const result = await getPortfolioRileyResponse({
          partnerId: user.partnerId,
          userId: user.id,
          conversationId: conversationId || null,
          userMessage: message.trim(),
          currentPage: currentPage || "/partner/dashboard",
          topic: resolvedTopic,
          relatedEntityType: relatedEntityType || undefined,
          relatedEntityId: relatedEntityId || undefined,
        });

        return res.json({
          response: result.response,
          conversationId: result.conversationId,
        });
      }

      // ── Streaming path (SSE) ──
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      let clientDisconnected = false;
      req.on("close", () => { clientDisconnected = true; });

      const writeSse = (data: Record<string, unknown>) => {
        if (clientDisconnected) return;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const { conversationId: convId } = await getPortfolioRileyResponseStreaming({
        partnerId: user.partnerId,
        userId: user.id,
        conversationId: conversationId || null,
        userMessage: message.trim(),
        currentPage: currentPage || "/partner/dashboard",
        topic: resolvedTopic,
        relatedEntityType: relatedEntityType || undefined,
        relatedEntityId: relatedEntityId || undefined,

        onDelta(text) {
          writeSse({ delta: text });
        },

        onDone(fullResponse, finalConvId) {
          writeSse({ done: true, conversationId: finalConvId });
          res.end();
        },

        onError(error: any) {
          console.error("[PortfolioRiley] Stream error:", error?.message);
          writeSse({ error: "Response generation failed" });
          res.end();
        },
      });

      writeSse({ conversationId: convId });

    } catch (error: any) {
      console.error("[PortfolioRiley] Error:", error?.message);
      if (res.headersSent) {
        try { res.write(`data: ${JSON.stringify({ error: "Response generation failed" })}\n\n`); } catch {}
        res.end();
      } else {
        res.status(500).json({ message: "Failed to process message" });
      }
    }
  });

  // ── GET /api/partner/riley/conversations ──────────────────
  app.get("/api/partner/riley/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.partnerId) {
        return res.status(403).json({ message: "Not a partner user" });
      }

      const conversations = await storage.listPartnerRileyConversations(user.partnerId);

      const summaries = conversations.slice(0, 10).map(c => {
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
      console.error("[PortfolioRiley] Error listing conversations:", error);
      res.status(500).json({ message: "Failed to list conversations" });
    }
  });

  // ── GET /api/partner/riley/conversation/:id ───────────────
  app.get("/api/partner/riley/conversation/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.partnerId) {
        return res.status(403).json({ message: "Not a partner user" });
      }

      const conversation = await storage.getPartnerRileyConversation(req.params.id, user.partnerId);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      res.json(conversation);
    } catch (error) {
      console.error("[PortfolioRiley] Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });
}
