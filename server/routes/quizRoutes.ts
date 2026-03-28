import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { sendEmailWithAttachment } from "../services/sendgrid";
import { getRileyWebsiteResponse } from "../agents/rileyWebsite";
import type { ConversationMessage } from "../services/llm/claude";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";

// ─── Validation Schemas ──────────────────────────────────────────────────────

const startSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  companyName: z.string().optional(),
  role: z.string().optional(),
});

const answerSchema = z.object({
  questionId: z.string(),
  sectionId: z.enum(["credit_control", "cashflow", "finance"]),
  answerId: z.string(),
  score: z.number().min(1).max(4),
});

const completeSchema = z.object({
  leadId: z.string().min(1),
  answers: z.array(answerSchema).length(10),
});

// ─── Scoring Logic ───────────────────────────────────────────────────────────

type TierKey = "critical" | "at_risk" | "good" | "excellent";
type SectionId = "credit_control" | "cashflow" | "finance";

const SECTION_MAX: Record<SectionId, number> = {
  credit_control: 16,
  cashflow: 12,
  finance: 12,
};

function getTierForPercent(percent: number): TierKey {
  if (percent <= 25) return "critical";
  if (percent <= 50) return "at_risk";
  if (percent <= 75) return "good";
  return "excellent";
}

function getTierForOverallScore(score: number): TierKey {
  if (score <= 15) return "critical";
  if (score <= 24) return "at_risk";
  if (score <= 32) return "good";
  return "excellent";
}

function calculateResults(answers: z.infer<typeof answerSchema>[]) {
  const sectionScores: Record<SectionId, number> = {
    credit_control: 0,
    cashflow: 0,
    finance: 0,
  };

  for (const answer of answers) {
    sectionScores[answer.sectionId] += answer.score;
  }

  const totalScore =
    sectionScores.credit_control +
    sectionScores.cashflow +
    sectionScores.finance;

  const creditControlTier = getTierForPercent(
    (sectionScores.credit_control / SECTION_MAX.credit_control) * 100,
  );
  const cashflowTier = getTierForPercent(
    (sectionScores.cashflow / SECTION_MAX.cashflow) * 100,
  );
  const financeTier = getTierForPercent(
    (sectionScores.finance / SECTION_MAX.finance) * 100,
  );
  const overallTier = getTierForOverallScore(totalScore);

  // Weakest section by percentage
  const percentages: { section: SectionId; pct: number }[] = [
    {
      section: "credit_control",
      pct: sectionScores.credit_control / SECTION_MAX.credit_control,
    },
    { section: "cashflow", pct: sectionScores.cashflow / SECTION_MAX.cashflow },
    { section: "finance", pct: sectionScores.finance / SECTION_MAX.finance },
  ];
  percentages.sort((a, b) => a.pct - b.pct);
  const weakestSection = percentages[0].section;

  return {
    creditControlScore: sectionScores.credit_control,
    cashflowScore: sectionScores.cashflow,
    financeScore: sectionScores.finance,
    totalScore,
    creditControlTier,
    cashflowTier,
    financeTier,
    overallTier,
    weakestSection,
  };
}

// ─── Email HTML Builder ──────────────────────────────────────────────────────

function buildResultsEmailHtml(params: {
  fullName: string;
  totalScore: number;
  overallTier: string;
  creditControlScore: number;
  cashflowScore: number;
  financeScore: number;
  weakestSection: string;
  bookAttached: boolean;
}): string {
  const tierLabels: Record<string, string> = {
    critical: "Critical",
    at_risk: "At Risk",
    good: "Good",
    excellent: "Excellent",
  };

  const tierColours: Record<string, string> = {
    critical: "#EF4444",
    at_risk: "#F59E0B",
    good: "#06B6D4",
    excellent: "#10B981",
  };

  const sectionLabels: Record<string, string> = {
    credit_control: "Credit Control",
    cashflow: "Cashflow",
    finance: "Finance",
  };

  const colour = tierColours[params.overallTier] || "#06B6D4";
  const label = tierLabels[params.overallTier] || params.overallTier;
  const weakestLabel = sectionLabels[params.weakestSection] || params.weakestSection;

  const bookSection = params.bookAttached
    ? `<p style="margin-top:24px;font-size:14px;color:#475569;">Your free copy of <strong>The Cash Gap</strong> by Simon Kramer is attached to this email. Based on your results, we recommend focusing on the ${weakestLabel} chapters first.</p>`
    : `<p style="margin-top:24px;font-size:14px;color:#475569;">Your free copy of <strong>The Cash Gap</strong> by Simon Kramer is being prepared and will be sent shortly.</p>`;

  return `
    <div style="font-family:'Inter',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0F172A;">
      <div style="background:#0F172A;padding:32px;text-align:center;">
        <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">Your Cashflow Health Check Results</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0;">Powered by Qashivo</p>
      </div>
      <div style="padding:32px;">
        <p style="font-size:16px;">Hi ${params.fullName},</p>
        <p style="font-size:14px;color:#475569;">Thanks for completing the Cashflow Health Check. Here's your score:</p>
        <div style="text-align:center;margin:32px 0;">
          <div style="font-size:48px;font-weight:800;color:${colour};">${params.totalScore} / 40</div>
          <div style="display:inline-block;background:${colour};color:#fff;padding:4px 16px;border-radius:4px;font-weight:700;font-size:14px;margin-top:8px;">${label}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;">
          <tr>
            <td style="padding:12px;border:1px solid #e2e8f0;font-weight:700;">Credit Control</td>
            <td style="padding:12px;border:1px solid #e2e8f0;text-align:center;">${params.creditControlScore} / 16</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #e2e8f0;font-weight:700;">Cashflow</td>
            <td style="padding:12px;border:1px solid #e2e8f0;text-align:center;">${params.cashflowScore} / 12</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #e2e8f0;font-weight:700;">Finance</td>
            <td style="padding:12px;border:1px solid #e2e8f0;text-align:center;">${params.financeScore} / 12</td>
          </tr>
        </table>
        <p style="font-size:14px;color:#475569;">Based on your results, we recommend focusing on <strong>${weakestLabel}</strong> first.</p>
        ${bookSection}
        <div style="text-align:center;margin-top:32px;">
          <a href="https://qashivo.com/contact" style="display:inline-block;background:#06B6D4;color:#fff;padding:14px 32px;border-radius:6px;font-weight:700;text-decoration:none;font-size:14px;">Book a Demo</a>
        </div>
      </div>
      <div style="background:#f8fafc;padding:24px;text-align:center;font-size:12px;color:#94a3b8;">
        &copy; Nexus KPI Limited. Registered in England &amp; Wales.
      </div>
    </div>
  `;
}

// ─── Route Registration ──────────────────────────────────────────────────────

const DEFAULT_FROM = "Qashivo <hello@qashivo.com>";

// Rate limiter for Riley chat — 10 messages/minute per IP
const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many messages. Please wait a moment before sending another." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Cal.com configuration
const CAL_API_BASE = process.env.CAL_API_BASE || "https://api.cal.eu";
const CAL_API_KEY = process.env.CAL_API_KEY || "";
const CAL_USERNAME = process.env.CAL_USERNAME || "simon-kramer-5051hr";
const CAL_EVENT_SLUG = process.env.CAL_EVENT_SLUG || "15min";
const CAL_API_VERSION = process.env.CAL_API_VERSION || "2024-08-13";

export function registerQuizRoutes(app: Express): void {
  // Start quiz — create lead record
  app.post("/api/quiz/start", async (req, res) => {
    try {
      const data = startSchema.parse(req.body);
      const lead = await storage.createQuizLead({
        fullName: data.fullName,
        email: data.email,
        companyName: data.companyName ?? null,
        role: data.role ?? null,
        completed: false,
      });
      res.status(201).json({ leadId: lead.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Failed to start quiz:", error);
      res.status(500).json({ message: "Failed to start quiz" });
    }
  });

  // Complete quiz — calculate scores, send email
  app.post("/api/quiz/complete", async (req, res) => {
    try {
      const { leadId, answers } = completeSchema.parse(req.body);

      const lead = await storage.getQuizLead(leadId);
      if (!lead) {
        return res.status(404).json({ message: "Quiz lead not found" });
      }

      const results = calculateResults(answers);

      await storage.updateQuizLead(leadId, {
        ...results,
        answers: answers as any,
        completed: true,
        completedAt: new Date(),
      });

      // Fire-and-forget email with book PDF
      (async () => {
        try {
          const pdfPath = path.resolve("server/assets/the-cash-gap.pdf");
          const bookExists = fs.existsSync(pdfPath);
          const attachments: Array<{ filename: string; content: Buffer; type: string }> = [];

          if (bookExists) {
            attachments.push({
              filename: "The-Cash-Gap-Simon-Kramer.pdf",
              content: fs.readFileSync(pdfPath),
              type: "application/pdf",
            });
          }

          const success = await sendEmailWithAttachment({
            to: lead.email,
            from: DEFAULT_FROM,
            subject: "Your Cashflow Health Check Results + Free Copy of The Cash Gap",
            html: buildResultsEmailHtml({
              fullName: lead.fullName,
              totalScore: results.totalScore,
              overallTier: results.overallTier,
              creditControlScore: results.creditControlScore,
              cashflowScore: results.cashflowScore,
              financeScore: results.financeScore,
              weakestSection: results.weakestSection,
              bookAttached: bookExists,
            }),
            attachments: attachments.length > 0 ? attachments : undefined,
            // No tenantId — public lead capture, bypasses communication mode (same as investor demo)
          });

          if (success && bookExists) {
            await storage.updateQuizLead(leadId, { bookSent: true });
          }
        } catch (emailError) {
          console.error("Failed to send quiz results email:", emailError);
        }
      })().catch((err) => console.error("Quiz email fire-and-forget error:", err));

      res.json({
        totalScore: results.totalScore,
        creditControlScore: results.creditControlScore,
        cashflowScore: results.cashflowScore,
        financeScore: results.financeScore,
        overallTier: results.overallTier,
        creditControlTier: results.creditControlTier,
        cashflowTier: results.cashflowTier,
        financeTier: results.financeTier,
        weakestSection: results.weakestSection,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Failed to complete quiz:", error);
      res.status(500).json({ message: "Failed to complete quiz" });
    }
  });

  // Get results by lead ID (for email links / revisits)
  app.get("/api/quiz/results/:leadId", async (req, res) => {
    try {
      const lead = await storage.getQuizLead(req.params.leadId);
      if (!lead || !lead.completed) {
        return res.status(404).json({ message: "Quiz results not found" });
      }
      res.json({
        fullName: lead.fullName,
        totalScore: lead.totalScore,
        creditControlScore: lead.creditControlScore,
        cashflowScore: lead.cashflowScore,
        financeScore: lead.financeScore,
        overallTier: lead.overallTier,
        creditControlTier: lead.creditControlTier,
        cashflowTier: lead.cashflowTier,
        financeTier: lead.financeTier,
        weakestSection: lead.weakestSection,
      });
    } catch (error) {
      console.error("Failed to get quiz results:", error);
      res.status(500).json({ message: "Failed to get quiz results" });
    }
  });

  // ─── Riley Chat (SSE Streaming) ─────────────────────────────────────────────

  const chatSchema = z.object({
    leadId: z.string().min(1),
    message: z.string().max(1000).optional(), // optional for opening message
  });

  app.post("/api/quiz/chat", chatRateLimit, async (req: Request, res: Response) => {
    try {
      const { leadId, message } = chatSchema.parse(req.body);

      // Load lead
      const lead = await storage.getQuizLead(leadId);
      if (!lead || !lead.completed) {
        return res.status(404).json({ message: "Quiz results not found" });
      }

      // Get or create conversation
      let conversation = await storage.getQuizConversationByLeadId(leadId);

      if (!conversation) {
        // Check conversation limit (max 3 per lead)
        const convCount = await storage.countQuizConversationsByLeadId(leadId);
        if (convCount >= 3) {
          return res.status(429).json({ message: "Maximum conversations reached for this quiz." });
        }
        conversation = await storage.createQuizConversation({
          quizLeadId: leadId,
          messages: [],
          messageCount: 0,
        });
      }

      // Check message limit (max 20 messages per conversation)
      const messages = (conversation.messages as any[]) || [];
      if (messages.length >= 20) {
        return res.status(429).json({ message: "This conversation has reached its limit. Book a demo to continue the discussion!" });
      }

      // Check 30-min inactivity timeout
      if (conversation.lastMessageAt) {
        const inactiveMs = Date.now() - new Date(conversation.lastMessageAt).getTime();
        if (inactiveMs > 30 * 60 * 1000) {
          // Start a new conversation
          const convCount = await storage.countQuizConversationsByLeadId(leadId);
          if (convCount >= 3) {
            return res.status(429).json({ message: "Maximum conversations reached for this quiz." });
          }
          conversation = await storage.createQuizConversation({
            quizLeadId: leadId,
            messages: [],
            messageCount: 0,
          });
        }
      }

      const conversationHistory: ConversationMessage[] = ((conversation.messages as any[]) || []).map(
        (m: any) => ({ role: m.role as "user" | "assistant", content: m.content }),
      );

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      let fullResponse = "";

      const rileyResponse = await getRileyWebsiteResponse({
        lead,
        conversationHistory,
        userMessage: message,
        onDelta: (text: string) => {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ type: "delta", text })}\n\n`);
        },
      });

      // Store messages
      const updatedMessages = [...((conversation.messages as any[]) || [])];
      if (message) {
        updatedMessages.push({ role: "user", content: message, timestamp: new Date().toISOString() });
      }
      updatedMessages.push({ role: "assistant", content: rileyResponse, timestamp: new Date().toISOString() });

      await storage.updateQuizConversation(conversation.id, {
        messages: updatedMessages as any,
        messageCount: updatedMessages.length,
        lastMessageAt: new Date(),
      });

      // Check for booking markers and process them
      const bookMatch = rileyResponse.match(/\[BOOK:([^\]]+)\]/);
      if (bookMatch) {
        const bookingTime = bookMatch[1];
        try {
          const bookingResult = await createCalBooking(lead, bookingTime);
          if (bookingResult.success) {
            await storage.updateQuizLead(leadId, {
              demoBooked: true,
              demoBookedAt: new Date(),
              calBookingUid: bookingResult.uid,
            });
            res.write(`data: ${JSON.stringify({ type: "booking_confirmed", time: bookingTime, uid: bookingResult.uid })}\n\n`);
          }
        } catch (bookErr) {
          console.error("Cal.com booking failed:", bookErr);
          res.write(`data: ${JSON.stringify({ type: "booking_failed" })}\n\n`);
        }
      }

      // Check for availability marker
      if (rileyResponse.includes("[SHOW_AVAILABILITY]")) {
        try {
          const slots = await fetchCalAvailability();
          res.write(`data: ${JSON.stringify({ type: "availability", slots })}\n\n`);
        } catch (slotErr) {
          console.error("Cal.com availability fetch failed:", slotErr);
        }
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Riley chat error:", error);
      const isApiError = error instanceof Error && (error.message.includes("credit balance") || error.message.includes("API key") || error.constructor.name === "BadRequestError" || error.constructor.name === "AuthenticationError");
      const userMessage = isApiError
        ? "Riley is temporarily unavailable. Please try again in a few minutes, or book a demo at qashivo.com/contact."
        : "Something went wrong. Please try again.";
      if (!res.headersSent) {
        res.status(500).json({ message: userMessage });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", message: userMessage })}\n\n`);
        res.end();
      }
    }
  });

  // Get conversation history
  app.get("/api/quiz/chat/:leadId", async (req, res) => {
    try {
      const conversation = await storage.getQuizConversationByLeadId(req.params.leadId);
      if (!conversation) {
        return res.json({ messages: [] });
      }
      res.json({ messages: conversation.messages || [] });
    } catch (error) {
      console.error("Failed to get chat history:", error);
      res.status(500).json({ message: "Failed to get chat history" });
    }
  });

  // ─── Cal.com Availability ───────────────────────────────────────────────────

  app.get("/api/quiz/availability", async (_req, res) => {
    try {
      const slots = await fetchCalAvailability();
      res.json({ slots });
    } catch (error) {
      console.error("Failed to fetch availability:", error);
      res.status(500).json({ message: "Failed to fetch availability", fallbackUrl: `https://cal.eu/${CAL_USERNAME}/${CAL_EVENT_SLUG}` });
    }
  });

  // ─── Cal.com Demo Booking ──────────────────────────────────────────────────

  const bookDemoSchema = z.object({
    leadId: z.string().min(1),
    startTime: z.string().min(1), // ISO datetime
  });

  app.post("/api/quiz/book-demo", async (req, res) => {
    try {
      const { leadId, startTime } = bookDemoSchema.parse(req.body);

      const lead = await storage.getQuizLead(leadId);
      if (!lead) {
        return res.status(404).json({ message: "Quiz lead not found" });
      }

      if (lead.demoBooked) {
        return res.status(400).json({ message: "Demo already booked for this lead" });
      }

      const result = await createCalBooking(lead, startTime);

      await storage.updateQuizLead(leadId, {
        demoBooked: true,
        demoBookedAt: new Date(),
        calBookingUid: result.uid,
      });

      res.json({ success: true, booking: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Failed to book demo:", error);
      res.status(500).json({
        message: "Failed to book demo",
        fallbackUrl: `https://cal.eu/${CAL_USERNAME}/${CAL_EVENT_SLUG}`,
      });
    }
  });
}

// ─── Cal.com Helpers ──────────────────────────────────────────────────────────

async function fetchCalAvailability(): Promise<Array<{ date: string; time: string; startTime: string }>> {
  const startTime = new Date().toISOString();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  const endTime = endDate.toISOString();

  const url = `${CAL_API_BASE}/v2/slots/available?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&eventTypeSlug=${CAL_EVENT_SLUG}&username=${CAL_USERNAME}`;

  const response = await fetch(url, {
    headers: {
      "cal-api-version": CAL_API_VERSION,
      ...(CAL_API_KEY ? { Authorization: `Bearer ${CAL_API_KEY}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Cal.com API error: ${response.status}`);
  }

  const data = await response.json();
  const slots: Array<{ date: string; time: string; startTime: string }> = [];

  // Cal.com v2 returns { data: { slots: { "YYYY-MM-DD": [{ time: "..." }] } } }
  const slotsData = data?.data?.slots || {};
  for (const [date, daySlots] of Object.entries(slotsData)) {
    for (const slot of daySlots as any[]) {
      const dt = new Date(slot.time);
      slots.push({
        date,
        time: dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }),
        startTime: slot.time,
      });
    }
  }

  return slots;
}

async function createCalBooking(lead: any, startTime: string): Promise<{ success: boolean; uid: string }> {
  const response = await fetch(`${CAL_API_BASE}/v2/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cal-api-version": CAL_API_VERSION,
      ...(CAL_API_KEY ? { Authorization: `Bearer ${CAL_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      start: startTime,
      eventTypeSlug: CAL_EVENT_SLUG,
      username: CAL_USERNAME,
      attendee: {
        name: lead.fullName,
        email: lead.email,
        timeZone: "Europe/London",
      },
      bookingFieldsResponses: {
        notes: `Booked via Cashflow Health Check quiz. Score: ${lead.totalScore}/40. Weakest area: ${lead.weakestSection}. Company: ${lead.companyName || "Not provided"}.`,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cal.com booking failed: ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  return { success: true, uid: data?.data?.uid || data?.uid || "unknown" };
}
