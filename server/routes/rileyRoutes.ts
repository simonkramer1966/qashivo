import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import {
  getRileyResponse,
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
  app.post("/api/riley/message", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const {
        message,
        pageContext,
        topic,
        conversationId,
        relatedEntityType,
        relatedEntityId,
      } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      const resolvedTopic: RileyTopic =
        topic && VALID_TOPICS.has(topic as RileyTopic)
          ? (topic as RileyTopic)
          : "system_help";

      const result = await getRileyResponse({
        tenantId: user.tenantId,
        userId: user.id,
        conversationId: conversationId || null,
        userMessage: message.trim(),
        pageContext: pageContext || "unknown",
        topic: resolvedTopic,
        relatedEntityType: relatedEntityType || undefined,
        relatedEntityId: relatedEntityId || undefined,
      });

      // Fire-and-forget intelligence extraction
      extractIntelligence(result.conversationId, user.tenantId).catch((err) =>
        console.error("[Riley] Background extraction failed:", err),
      );

      res.json({
        response: result.response,
        conversationId: result.conversationId,
      });
    } catch (error) {
      console.error("[Riley] Error processing message:", error);
      res.status(500).json({ message: "Failed to process message" });
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
}
