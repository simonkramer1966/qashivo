import type { Express } from "express";
import { storage } from "../storage";
import { generateJSON } from "../services/llm/claude.js";

// Sample data returned when Retell is unavailable or call hasn't completed
const SAMPLE_REPORT = {
  intentScore: 78,
  intentSummary: "Confirmed liquidity for Friday settlement.",
  sentiment: "Cooperative",
  sentimentPosition: 82,
  sentimentQuote: "Switching to backup portal for faster auth.",
  commitmentLevel: "Medium High",
  commitmentType: "Verbal Promise",
  cashflowImpact: {
    amount: 12450,
    currency: "GBP",
    expectedDays: 14,
    signal: "RECOVERY_SIGNAL",
  },
  transcript: [
    {
      role: "agent",
      text: "Good afternoon, this is Qashivo calling on behalf of Apex Logistics regarding invoice #AX-902 for \u00a312,450. I'm calling to see if you have a scheduled payment date for this?",
      timestamp: "14:32:04 UTC",
    },
    {
      role: "debtor",
      text: "Yes, hello. We've had some internal delays with the new ERP system. I was looking at the ledger this morning and we were planning to process this by the end of next week.",
      timestamp: "14:32:15 UTC",
      badges: [
        { label: "Intent Detected", type: "teal", icon: "check_circle" },
        { label: "System Delay Noted", type: "amber", icon: "warning" },
      ],
    },
    {
      role: "agent",
      text: "I understand system migrations can be challenging. To ensure this doesn't slip, could we lock in Friday the 1st for the transfer? I can send over a direct payment link to bypass the ERP manual entry if that helps.",
      timestamp: "14:32:45 UTC",
    },
    {
      role: "debtor",
      text: "That would actually be helpful. If you send the link, I can authorize it through the backup portal on Friday morning.",
      timestamp: "14:33:10 UTC",
      badges: [
        { label: "Positive Shift", type: "green", icon: "trending_up" },
        { label: "Settlement Commitment", type: "teal", icon: "payments" },
      ],
    },
  ],
  recommendedActions: [
    {
      type: "Automated",
      title: "Confirmation Dispatched",
      description:
        "Summary of commitment and secure payment link sent to registered email.",
      icon: "mail",
      color: "teal",
    },
    {
      type: "Scheduled",
      title: "Escalation Trigger",
      description:
        "Automated re-check scheduled for Nov 1st, 10:00 AM if funds are not settled.",
      icon: "calendar_month",
      color: "amber",
    },
  ],
  riskInsights:
    '"ERP Migration" has been cited 3 times in 12 months. Recurring friction point. Transition to Direct Debit suggested.',
  callDurationSeconds: 96,
};

/** Convert seconds (e.g. 14.32) to a readable timestamp like "00:14" */
function formatSecondsToTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** Parse Retell's plain-text transcript string into structured messages.
 *  Format is typically "Agent: ...\nUser: ..." */
function parseRetellTranscriptString(transcript: string): Array<{ role: string; text: string; timestamp: string }> {
  const lines = transcript.split("\n").filter((l) => l.trim());
  const messages: Array<{ role: string; text: string; timestamp: string }> = [];
  for (const line of lines) {
    const match = line.match(/^(Agent|User):\s*(.+)/i);
    if (match) {
      messages.push({
        role: match[1].toLowerCase() === "agent" ? "agent" : "debtor",
        text: match[2].trim(),
        timestamp: "",
      });
    } else if (messages.length > 0) {
      // Continuation of previous message
      messages[messages.length - 1].text += " " + line.trim();
    }
  }
  return messages;
}

interface DemoAnalysis {
  intentScore: number;
  intentSummary: string;
  sentiment: string;
  sentimentPosition: number;
  sentimentQuote: string;
  commitmentLevel: string;
  commitmentType: string;
  cashflowImpact: { amount: number; currency: string; expectedDays: number; signal: string };
  recommendedActions: Array<{ type: string; title: string; description: string; icon: string; color: string }>;
  riskInsights: string;
  transcriptBadges?: Array<{ messageIndex: number; badges: Array<{ label: string; type: string; icon: string }> }>;
}

/** Use Claude to analyze a real call transcript and produce the intelligence report */
async function analyzeTranscriptWithClaude(transcriptText: string): Promise<DemoAnalysis> {
  return generateJSON<DemoAnalysis>({
    system: `You are a credit control AI analyst for Qashivo, a UK accounts receivable platform.
Analyze the following call transcript between an AI collection agent and a debtor. The call was about collecting on an overdue invoice for £12,450 from Williams Logistics.

Return a JSON object with these fields:
- intentScore: number 0-100. How likely is the debtor to pay? Based on verbal commitments, tone, and specificity of payment promises.
- intentSummary: string. One short sentence (max 60 chars) summarizing the payment intent evidence from the conversation. E.g. "Agreed two-payment plan, first instalment Friday." Must reference what was actually said.
- sentiment: string. One of: "Cooperative", "Neutral", "Defensive", "Hostile", "Evasive", "Apologetic"
- sentimentPosition: number 0-100. Where on the Resistant (0) to Cooperative (100) scale the debtor sits based on the conversation.
- sentimentQuote: string. A SHORT direct quote (max 80 chars) from the debtor that best illustrates their sentiment. Use their actual words from the transcript.
- commitmentLevel: string. One of: "High", "Medium High", "Medium", "Medium Low", "Low", "None"
- commitmentType: string. The type of commitment made. E.g. "Payment Plan", "Verbal Promise", "Written Commitment", "Partial Payment", "Callback Agreed", "No Commitment". Based on what the debtor actually agreed to.
- cashflowImpact: object with { amount: number (the total amount expected to be recovered based on the conversation — if a payment plan was agreed, use the total, not just one instalment), currency: "GBP", expectedDays: number (estimated days until FIRST payment based on the conversation), signal: one of "RECOVERY_SIGNAL", "AT_RISK", "UNLIKELY" }
- recommendedActions: array of 2-3 objects, each: { type: "Automated"|"Scheduled"|"Manual", title: string (short action name), description: string (1 sentence), icon: string (Google Material Symbol name like "mail", "calendar_month", "phone", "gavel", "payments"), color: "teal"|"amber" }
- riskInsights: string. 1-2 sentences about risk factors or patterns observed in the conversation.
- transcriptBadges: array of objects { messageIndex: number (0-based index of the message in the transcript), badges: array of { label: string (2-3 words), type: "teal"|"amber"|"green"|"red", icon: string (Material Symbol) } }. Add badges to 2-4 key moments in the conversation — intent signals, commitments, objections, risk flags.

Be specific and grounded in what was actually said. Do not invent details not in the transcript.`,
    prompt: transcriptText,
    model: "fast",
    temperature: 0.2,
    maxTokens: 2048,
  });
}

export function registerDemoRoutes(app: Express) {
  console.log("[DEMO] Registering demo routes — env check:", {
    RETELL_API_KEY: process.env.RETELL_API_KEY ? "SET" : "MISSING",
    RETELL_DEMO_AGENT_ID: process.env.RETELL_DEMO_AGENT_ID ? "SET" : "MISSING",
    RETELL_AGENT_ID: process.env.RETELL_AGENT_ID ? "SET" : "MISSING",
    RETELL_PHONE_NUMBER: process.env.RETELL_PHONE_NUMBER ? "SET" : "MISSING",
  });

  // POST /api/demo/start-call — initiate a demo voice call
  app.post("/api/demo/start-call", async (req, res) => {
    try {
      const { name, phoneNumber } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required" });
      }
      if (
        !phoneNumber ||
        typeof phoneNumber !== "string" ||
        phoneNumber.trim().length < 6
      ) {
        return res
          .status(400)
          .json({ message: "A valid phone number is required" });
      }

      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown";

      // Rate limiting: 10 calls per phone / 24h, 30 per IP / 24h
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [phoneCalls, ipCalls] = await Promise.all([
        storage.countRecentDemoCallsByPhone(phoneNumber.trim(), since),
        storage.countRecentDemoCallsByIp(clientIp, since),
      ]);

      if (phoneCalls >= 10) {
        return res.status(429).json({
          message:
            "You've reached the maximum demo calls for this number today. Try again tomorrow.",
        });
      }
      if (ipCalls >= 30) {
        return res.status(429).json({
          message: "Too many demo requests. Please try again later.",
        });
      }

      // Check if Retell is configured
      const demoAgentId =
        process.env.RETELL_DEMO_AGENT_ID || process.env.RETELL_AGENT_ID;
      if (!demoAgentId || !process.env.RETELL_API_KEY) {
        console.warn(
          "[DEMO] RETELL_DEMO_AGENT_ID / RETELL_API_KEY not configured — returning sample data"
        );
        const call = await storage.createDemoCall({
          callerName: name.trim(),
          phoneNumber: phoneNumber.trim(),
          ipAddress: clientIp,
          status: "completed",
          transcript: SAMPLE_REPORT.transcript,
          intentScore: SAMPLE_REPORT.intentScore,
          sentiment: SAMPLE_REPORT.sentiment,
          commitmentLevel: SAMPLE_REPORT.commitmentLevel,
          cashflowImpact: SAMPLE_REPORT.cashflowImpact,
          recommendedActions: SAMPLE_REPORT.recommendedActions,
          riskInsights: SAMPLE_REPORT.riskInsights,
          callDurationSeconds: SAMPLE_REPORT.callDurationSeconds,
          completedAt: new Date(),
        });
        return res.json({
          callId: call.id,
          status: "completed",
          fallback: true,
        });
      }

      // Create DB row first
      const call = await storage.createDemoCall({
        callerName: name.trim(),
        phoneNumber: phoneNumber.trim(),
        ipAddress: clientIp,
        status: "initiated",
        startedAt: new Date(),
      });

      // Initiate Retell call
      try {
        const {
          createUnifiedRetellCall,
          createStandardCollectionVariables,
        } = await import("../utils/retellCallHelper.js");

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() - 15);

        const callVariables = createStandardCollectionVariables({
          customerName: name.trim(),
          companyName: "Williams Logistics",
          invoiceNumber: "INV-AX-902",
          invoiceAmount: "12450",
          totalOutstanding: "12450",
          invoiceCount: "1",
          daysOverdue: "15",
          dueDate,
          customMessage:
            "This is a live demo call showcasing Qashivo's AI credit control capabilities",
        });

        // Pre-call diagnostics
        const fromNumber = process.env.RETELL_PHONE_NUMBER || "(not set)";
        console.log(`[DEMO] ====== PRE-CALL DIAGNOSTICS ======`);
        console.log(`[DEMO] Agent ID: ${demoAgentId?.substring(0, 8)}...`);
        console.log(`[DEMO] API Key: ${process.env.RETELL_API_KEY?.substring(0, 8)}...`);
        console.log(`[DEMO] From number (RETELL_PHONE_NUMBER): ${fromNumber}`);
        console.log(`[DEMO] To number (raw from frontend): "${phoneNumber.trim()}"`);
        console.log(`[DEMO] To number length: ${phoneNumber.trim().length}, starts with +: ${phoneNumber.trim().startsWith("+")}`);
        console.log(`[DEMO] Caller name: ${name.trim()}`);
        console.log(`[DEMO] Call variables:`, JSON.stringify(callVariables, null, 2));
        console.log(`[DEMO] ====================================`);

        const callResult = await createUnifiedRetellCall({
          toNumber: phoneNumber.trim(),
          agentId: demoAgentId,
          dynamicVariables: callVariables,
          metadata: { type: "public_demo", demoCallId: call.id },
          context: "PUBLIC_DEMO",
        });

        console.log(`[DEMO] Retell call created successfully — retellCallId: ${callResult.callId}, status: ${callResult.status}`);
        console.log(`[DEMO] Full call result:`, JSON.stringify(callResult, null, 2));

        await storage.updateDemoCall(call.id, {
          retellCallId: callResult.callId,
          status: callResult.status === "demo" ? "initiated" : "ringing",
        });

        return res.json({
          callId: call.id,
          status: "initiated",
        });
      } catch (retellError: any) {
        console.error(`[DEMO] ====== RETELL CALL FAILED ======`);
        console.error(`[DEMO] Error message: ${retellError?.message}`);
        console.error(`[DEMO] Error name: ${retellError?.name}`);
        console.error(`[DEMO] HTTP status: ${retellError?.status || retellError?.statusCode || "N/A"}`);
        console.error(`[DEMO] Error body:`, retellError?.body || retellError?.response?.data || "N/A");
        console.error(`[DEMO] Error headers:`, retellError?.headers || retellError?.response?.headers || "N/A");
        console.error(`[DEMO] Full error object:`, JSON.stringify(retellError, Object.getOwnPropertyNames(retellError), 2));
        console.error(`[DEMO] Error stack:`, retellError?.stack);
        console.error(`[DEMO] ================================`);
        // Update DB to failed so we have a record
        await storage.updateDemoCall(call.id, { status: "failed" });
        return res.status(502).json({
          message: `Voice call failed: ${retellError?.message || "Unknown Retell error"}. Please try again.`,
        });
      }
    } catch (error: any) {
      console.error("[DEMO] Error starting demo call:", error);
      return res
        .status(500)
        .json({ message: "Failed to start demo call" });
    }
  });

  // GET /api/demo/call-status/:callId
  app.get("/api/demo/call-status/:callId", async (req, res) => {
    try {
      const call = await storage.getDemoCall(req.params.callId);
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      // If call has a retellCallId and isn't completed, try to fetch live status
      if (
        call.retellCallId &&
        call.status !== "completed" &&
        call.status !== "failed"
      ) {
        try {
          console.log(`[DEMO] Polling Retell for call ${call.retellCallId} (DB status: ${call.status})`);
          const { RetellService } = await import("../retell-service.js");
          const retellService = new RetellService();
          const retellCall = await (retellService as any).getCall(
            call.retellCallId
          );
          console.log(`[DEMO] Retell getCall response — call_status: ${retellCall?.call_status}, duration_ms: ${retellCall?.duration_ms}, has_transcript: ${!!retellCall?.transcript}, has_transcript_object: ${!!retellCall?.transcript_object}`);
          if (retellCall) {
            const mappedStatus =
              retellCall.call_status === "ended"
                ? "completed"
                : retellCall.call_status === "error"
                ? "failed"
                : retellCall.call_status === "registered" ||
                  retellCall.call_status === "ongoing"
                ? "active"
                : call.status;

            if (mappedStatus !== call.status) {
              const updates: any = { status: mappedStatus };
              if (mappedStatus === "completed") {
                updates.completedAt = new Date();

                // Log the full Retell post-call response for debugging
                console.log("[DEMO] Full Retell post-call response:", JSON.stringify(retellCall, null, 2));

                // Parse transcript — Retell returns transcript_object (array) and transcript (string)
                if (retellCall.transcript_object && Array.isArray(retellCall.transcript_object)) {
                  updates.transcript = retellCall.transcript_object.map((msg: any, idx: number) => ({
                    role: msg.role === "agent" ? "agent" : "debtor",
                    text: msg.content || "",
                    timestamp: msg.words?.[0]?.start != null
                      ? formatSecondsToTimestamp(msg.words[0].start)
                      : "",
                  }));
                } else if (typeof retellCall.transcript === "string" && retellCall.transcript.trim()) {
                  // Fall back to parsing the plain-text transcript string
                  updates.transcript = parseRetellTranscriptString(retellCall.transcript);
                } else {
                  updates.transcript = SAMPLE_REPORT.transcript;
                }

                if (retellCall.duration_ms) {
                  updates.callDurationSeconds = Math.round(
                    retellCall.duration_ms / 1000
                  );
                }

                // Use Claude to analyze the real transcript instead of hardcoded sample data
                const hasRealTranscript = updates.transcript !== SAMPLE_REPORT.transcript;
                if (hasRealTranscript && updates.transcript.length > 0) {
                  try {
                    const transcriptText = updates.transcript
                      .map((m: any) => `${m.role === "agent" ? "AGENT" : "DEBTOR"}: ${m.text}`)
                      .join("\n");

                    console.log("[DEMO] Sending transcript to Claude for analysis...");
                    const analysis = await analyzeTranscriptWithClaude(transcriptText);
                    console.log("[DEMO] Claude analysis result:", JSON.stringify(analysis, null, 2));

                    updates.intentScore = analysis.intentScore;
                    updates.sentiment = analysis.sentiment;
                    updates.commitmentLevel = analysis.commitmentLevel;
                    // Pack card-specific text into cashflowImpact jsonb
                    updates.cashflowImpact = {
                      ...analysis.cashflowImpact,
                      intentSummary: analysis.intentSummary,
                      sentimentPosition: analysis.sentimentPosition,
                      sentimentQuote: analysis.sentimentQuote,
                      commitmentType: analysis.commitmentType,
                    };
                    updates.recommendedActions = analysis.recommendedActions;
                    updates.riskInsights = analysis.riskInsights;

                    // Add badges to transcript messages based on Claude analysis
                    if (analysis.transcriptBadges && Array.isArray(analysis.transcriptBadges)) {
                      for (const badge of analysis.transcriptBadges) {
                        if (badge.messageIndex >= 0 && badge.messageIndex < updates.transcript.length) {
                          if (!updates.transcript[badge.messageIndex].badges) {
                            updates.transcript[badge.messageIndex].badges = [];
                          }
                          updates.transcript[badge.messageIndex].badges.push(...badge.badges);
                        }
                      }
                    }
                  } catch (analysisErr: any) {
                    console.error("[DEMO] Claude analysis failed, using sample analysis:", analysisErr?.message);
                    updates.intentScore = SAMPLE_REPORT.intentScore;
                    updates.sentiment = SAMPLE_REPORT.sentiment;
                    updates.commitmentLevel = SAMPLE_REPORT.commitmentLevel;
                    updates.cashflowImpact = SAMPLE_REPORT.cashflowImpact;
                    updates.recommendedActions = SAMPLE_REPORT.recommendedActions;
                    updates.riskInsights = SAMPLE_REPORT.riskInsights;
                  }
                } else {
                  // No real transcript — use sample analysis
                  updates.intentScore = SAMPLE_REPORT.intentScore;
                  updates.sentiment = SAMPLE_REPORT.sentiment;
                  updates.commitmentLevel = SAMPLE_REPORT.commitmentLevel;
                  updates.cashflowImpact = SAMPLE_REPORT.cashflowImpact;
                  updates.recommendedActions = SAMPLE_REPORT.recommendedActions;
                  updates.riskInsights = SAMPLE_REPORT.riskInsights;
                }
              }
              await storage.updateDemoCall(call.id, updates);
            }

            return res.json({
              status: mappedStatus,
              duration: retellCall.duration_ms
                ? Math.round(retellCall.duration_ms / 1000)
                : call.callDurationSeconds ?? 0,
            });
          }
        } catch (pollErr: any) {
          console.error(`[DEMO] ====== CALL-STATUS POLL FAILED ======`);
          console.error(`[DEMO] retellCallId: ${call.retellCallId}`);
          console.error(`[DEMO] Error: ${pollErr?.message}`);
          console.error(`[DEMO] Status: ${pollErr?.status || pollErr?.statusCode || "N/A"}`);
          console.error(`[DEMO] Body:`, pollErr?.body || pollErr?.response?.data || "N/A");
          console.error(`[DEMO] Full error:`, JSON.stringify(pollErr, Object.getOwnPropertyNames(pollErr), 2));
          console.error(`[DEMO] ================================`);
        }
      }

      return res.json({
        status: call.status,
        duration: call.callDurationSeconds ?? 0,
      });
    } catch (error: any) {
      console.error("[DEMO] Error fetching call status:", error);
      return res.status(500).json({ message: "Failed to get call status" });
    }
  });

  // GET /api/demo/call-results/:callId
  app.get("/api/demo/call-results/:callId", async (req, res) => {
    try {
      const call = await storage.getDemoCall(req.params.callId);
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      const cfImpact = (call.cashflowImpact as any) ?? SAMPLE_REPORT.cashflowImpact;
      return res.json({
        callId: call.id,
        status: call.status,
        callerName: call.callerName,
        transcript: call.transcript ?? SAMPLE_REPORT.transcript,
        intentScore: call.intentScore ?? SAMPLE_REPORT.intentScore,
        intentSummary: cfImpact.intentSummary ?? SAMPLE_REPORT.intentSummary,
        sentiment: call.sentiment ?? SAMPLE_REPORT.sentiment,
        sentimentPosition: cfImpact.sentimentPosition ?? SAMPLE_REPORT.sentimentPosition,
        sentimentQuote: cfImpact.sentimentQuote ?? SAMPLE_REPORT.sentimentQuote,
        commitmentLevel:
          call.commitmentLevel ?? SAMPLE_REPORT.commitmentLevel,
        commitmentType: cfImpact.commitmentType ?? SAMPLE_REPORT.commitmentType,
        cashflowImpact: {
          amount: cfImpact.amount ?? SAMPLE_REPORT.cashflowImpact.amount,
          currency: cfImpact.currency ?? SAMPLE_REPORT.cashflowImpact.currency,
          expectedDays: cfImpact.expectedDays ?? SAMPLE_REPORT.cashflowImpact.expectedDays,
          signal: cfImpact.signal ?? SAMPLE_REPORT.cashflowImpact.signal,
        },
        recommendedActions:
          call.recommendedActions ?? SAMPLE_REPORT.recommendedActions,
        riskInsights: call.riskInsights ?? SAMPLE_REPORT.riskInsights,
        callDurationSeconds:
          call.callDurationSeconds ?? SAMPLE_REPORT.callDurationSeconds,
      });
    } catch (error: any) {
      console.error("[DEMO] Error fetching call results:", error);
      return res
        .status(500)
        .json({ message: "Failed to get call results" });
    }
  });
}
