import type { Express } from "express";
import { storage } from "../storage";

// Sample data returned when Retell is unavailable or call hasn't completed
const SAMPLE_REPORT = {
  intentScore: 78,
  sentiment: "Cooperative",
  commitmentLevel: "Medium High",
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

export function registerDemoRoutes(app: Express) {
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

      // Rate limiting: 3 calls per phone / 24h, 10 per IP / 24h
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [phoneCalls, ipCalls] = await Promise.all([
        storage.countRecentDemoCallsByPhone(phoneNumber.trim(), since),
        storage.countRecentDemoCallsByIp(clientIp, since),
      ]);

      if (phoneCalls >= 3) {
        return res.status(429).json({
          message:
            "You've reached the maximum demo calls for this number today. Try again tomorrow.",
        });
      }
      if (ipCalls >= 10) {
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

        // The frontend sends phoneNumber already in E.164 format (e.g. +447716273336)
        console.log(
          `[DEMO] Starting Retell call — agent: ${demoAgentId}, to: ${phoneNumber.trim()}, caller: ${name.trim()}`
        );

        const callResult = await createUnifiedRetellCall({
          toNumber: phoneNumber.trim(),
          agentId: demoAgentId,
          dynamicVariables: callVariables,
          metadata: { type: "public_demo", demoCallId: call.id },
          context: "PUBLIC_DEMO",
        });

        console.log(
          `[DEMO] Retell call created — retellCallId: ${callResult.callId}, status: ${callResult.status}`
        );

        await storage.updateDemoCall(call.id, {
          retellCallId: callResult.callId,
          status: callResult.status === "demo" ? "initiated" : "ringing",
        });

        return res.json({
          callId: call.id,
          status: "initiated",
        });
      } catch (retellError: any) {
        console.error("[DEMO] Retell call failed:", retellError?.message);
        console.error("[DEMO] Retell error details:", {
          status: retellError?.status,
          response: retellError?.response?.data || retellError?.body || "no response body",
        });
        // Fallback to sample data
        await storage.updateDemoCall(call.id, {
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
          const { RetellService } = await import("../retell-service.js");
          const retellService = new RetellService();
          const retellCall = await (retellService as any).getCall(
            call.retellCallId
          );
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
                if (retellCall.transcript) {
                  updates.transcript = retellCall.transcript;
                }
                if (retellCall.call_analysis) {
                  updates.intentScore =
                    retellCall.call_analysis.intent_score ?? SAMPLE_REPORT.intentScore;
                  updates.sentiment =
                    retellCall.call_analysis.sentiment ?? SAMPLE_REPORT.sentiment;
                  updates.commitmentLevel =
                    retellCall.call_analysis.commitment_level ?? SAMPLE_REPORT.commitmentLevel;
                  updates.cashflowImpact = SAMPLE_REPORT.cashflowImpact;
                  updates.recommendedActions = SAMPLE_REPORT.recommendedActions;
                  updates.riskInsights =
                    retellCall.call_analysis.risk_insights ?? SAMPLE_REPORT.riskInsights;
                }
                if (retellCall.duration_ms) {
                  updates.callDurationSeconds = Math.round(
                    retellCall.duration_ms / 1000
                  );
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
        } catch {
          // Retell lookup failed — return DB status
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

      return res.json({
        callId: call.id,
        status: call.status,
        callerName: call.callerName,
        transcript: call.transcript ?? SAMPLE_REPORT.transcript,
        intentScore: call.intentScore ?? SAMPLE_REPORT.intentScore,
        sentiment: call.sentiment ?? SAMPLE_REPORT.sentiment,
        commitmentLevel:
          call.commitmentLevel ?? SAMPLE_REPORT.commitmentLevel,
        cashflowImpact:
          call.cashflowImpact ?? SAMPLE_REPORT.cashflowImpact,
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
