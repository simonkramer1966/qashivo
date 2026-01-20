import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  partnerProspects,
  partnerScorecardSubmissions,
  partnerScorecardAnswers,
} from "@shared/schema";
import {
  SCORECARD_VERSION,
  ALL_QUESTION_KEYS,
  calculateBand,
  calculateCategoryScores,
  calculateTotalScore,
  SCORECARD_CATEGORIES,
  SCORECARD_BANDS,
} from "@shared/scorecard/partnerScorecardQuestions";
import { eq } from "drizzle-orm";
import sgMail from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== "default_key") {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface ScorecardEmailData {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  totalScore: number;
  band: string;
  bandLabel: string;
  bandDescription: string;
  categoryScores: Record<string, number>;
  nextSteps: string[];
}

async function sendScorecardConfirmationEmail(data: ScorecardEmailData): Promise<void> {
  if (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY === "default_key") {
    console.log(`[DEV] Skipping confirmation email to ${data.email}`);
    return;
  }

  const categoryBreakdown = SCORECARD_CATEGORIES.map((cat) => {
    const score = data.categoryScores[cat.id] || 0;
    return `• ${cat.name}: ${score}/20`;
  }).join("\n");

  const nextStepsList = data.nextSteps.map((step, i) => `${i + 1}. ${step}`).join("\n");

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #17B6C3 0%, #0fa3ae 100%); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Partner Opportunity Scorecard</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Your Results from Qashivo</p>
    </div>
    
    <div style="padding: 32px;">
      <p style="margin: 0 0 24px; color: #333; font-size: 16px;">Hi ${data.firstName},</p>
      
      <p style="margin: 0 0 24px; color: #555; font-size: 15px; line-height: 1.6;">
        Thank you for completing the Partner Opportunity Scorecard. Here's a summary of your results for <strong>${data.companyName}</strong>.
      </p>
      
      <div style="background: #f8fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0 0 8px; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Your Score</p>
        <div style="font-size: 48px; font-weight: 700; color: #17B6C3; margin-bottom: 8px;">${data.totalScore}<span style="font-size: 20px; color: #999;">/100</span></div>
        <span style="display: inline-block; padding: 6px 16px; background: #17B6C3; color: white; border-radius: 20px; font-size: 14px; font-weight: 500;">${data.bandLabel}</span>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px; color: #333; font-size: 16px; font-weight: 600;">What this suggests</h3>
        <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6;">${data.bandDescription}</p>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px; color: #333; font-size: 16px; font-weight: 600;">Category Breakdown</h3>
        <div style="background: #f8fafb; border-radius: 8px; padding: 16px;">
          ${SCORECARD_CATEGORIES.map((cat) => {
            const score = data.categoryScores[cat.id] || 0;
            const percentage = (score / 20) * 100;
            return `
              <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="color: #333; font-size: 13px;">${cat.name}</span>
                  <span style="color: #666; font-size: 13px;">${score}/20</span>
                </div>
                <div style="background: #e5e7eb; border-radius: 4px; height: 6px; overflow: hidden;">
                  <div style="background: #17B6C3; width: ${percentage}%; height: 100%;"></div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
      
      <div style="margin-bottom: 32px;">
        <h3 style="margin: 0 0 16px; color: #333; font-size: 16px; font-weight: 600;">Recommended Next Steps</h3>
        <ol style="margin: 0; padding-left: 20px; color: #555; font-size: 14px; line-height: 1.8;">
          ${data.nextSteps.map((step) => `<li>${step}</li>`).join("")}
        </ol>
      </div>
      
      <div style="text-align: center; padding-top: 16px; border-top: 1px solid #eee;">
        <p style="margin: 0 0 16px; color: #555; font-size: 14px;">Ready to explore how Qashivo can help?</p>
        <a href="https://qashivo.com/contact" style="display: inline-block; background: #17B6C3; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500;">Book a Call</a>
      </div>
    </div>
    
    <div style="background: #f8fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
      <p style="margin: 0; color: #888; font-size: 12px;">
        © 2026 Nexus KPI Limited. All rights reserved.<br>
        <a href="https://qashivo.com" style="color: #17B6C3; text-decoration: none;">qashivo.com</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const plainTextContent = `
Partner Opportunity Scorecard Results

Hi ${data.firstName},

Thank you for completing the Partner Opportunity Scorecard. Here's a summary of your results for ${data.companyName}.

YOUR SCORE: ${data.totalScore}/100
BAND: ${data.bandLabel}

What this suggests:
${data.bandDescription}

Category Breakdown:
${categoryBreakdown}

Recommended Next Steps:
${nextStepsList}

Ready to explore how Qashivo can help?
Book a call: https://qashivo.com/contact

---
© 2026 Nexus KPI Limited
https://qashivo.com
  `.trim();

  try {
    await sgMail.send({
      to: data.email,
      from: {
        email: "noreply@qashivo.com",
        name: "Qashivo",
      },
      subject: `Your Partner Opportunity Score: ${data.totalScore}/100 - ${data.bandLabel}`,
      text: plainTextContent,
      html: htmlContent,
    });
    console.log(`✅ Scorecard confirmation email sent to ${data.email}`);
  } catch (error) {
    console.error(`❌ Failed to send scorecard email to ${data.email}:`, error);
  }
}

const router = Router();

const prospectSignupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  companyName: z.string().min(1, "Company name is required"),
  jobTitle: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

const scorecardAnswerSchema = z.object({
  questionKey: z.string(),
  score: z.number().min(1).max(5),
  comment: z.string().optional(),
});

const scorecardSubmissionSchema = z.object({
  answers: z.array(scorecardAnswerSchema).length(20, "All 20 questions must be answered"),
  notes: z.string().optional(),
});

router.post("/api/prospect/signup", async (req, res) => {
  try {
    const validated = prospectSignupSchema.parse(req.body);
    
    const existingProspect = await db.query.partnerProspects.findFirst({
      where: eq(partnerProspects.email, validated.email),
    });
    
    if (existingProspect) {
      return res.json({ 
        success: true, 
        prospectId: existingProspect.id,
        message: "Welcome back! Continuing your scorecard." 
      });
    }
    
    const [prospect] = await db
      .insert(partnerProspects)
      .values({
        firstName: validated.firstName,
        lastName: validated.lastName,
        email: validated.email,
        phone: validated.phone || null,
        companyName: validated.companyName,
        jobTitle: validated.jobTitle || null,
        source: "scorecard_landing",
        utmSource: validated.utmSource || null,
        utmMedium: validated.utmMedium || null,
        utmCampaign: validated.utmCampaign || null,
        status: "NEW",
      })
      .returning();
    
    res.json({ 
      success: true, 
      prospectId: prospect.id,
      message: "Signup successful" 
    });
  } catch (error) {
    console.error("Prospect signup error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    res.status(500).json({ success: false, error: "Failed to create prospect" });
  }
});

router.post("/api/prospect/:prospectId/scorecard", async (req, res) => {
  try {
    const { prospectId } = req.params;
    const validated = scorecardSubmissionSchema.parse(req.body);
    
    const prospect = await db.query.partnerProspects.findFirst({
      where: eq(partnerProspects.id, prospectId),
    });
    
    if (!prospect) {
      return res.status(404).json({ success: false, error: "Prospect not found" });
    }
    
    const providedKeys = validated.answers.map((a) => a.questionKey);
    const missingKeys = ALL_QUESTION_KEYS.filter((key) => !providedKeys.includes(key));
    
    if (missingKeys.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Missing answers for questions",
        missingKeys,
      });
    }
    
    const totalScore = calculateTotalScore(validated.answers);
    const categoryScores = calculateCategoryScores(validated.answers);
    const bandInfo = calculateBand(totalScore);
    
    const [submission] = await db
      .insert(partnerScorecardSubmissions)
      .values({
        prospectId,
        totalScore,
        band: bandInfo.band,
        categoryScores,
        version: SCORECARD_VERSION,
        notes: validated.notes || null,
      })
      .returning();
    
    await db.insert(partnerScorecardAnswers).values(
      validated.answers.map((answer) => ({
        submissionId: submission.id,
        questionKey: answer.questionKey,
        score: answer.score,
        comment: answer.comment || null,
      }))
    );
    
    await db
      .update(partnerProspects)
      .set({ status: "QUALIFIED" })
      .where(eq(partnerProspects.id, prospectId));
    
    sendScorecardConfirmationEmail({
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      email: prospect.email,
      companyName: prospect.companyName,
      totalScore,
      band: bandInfo.band,
      bandLabel: bandInfo.label,
      bandDescription: bandInfo.description,
      categoryScores,
      nextSteps: bandInfo.nextSteps,
    }).catch((err) => console.error("Email send error:", err));
    
    res.json({
      success: true,
      submission: {
        id: submission.id,
        totalScore,
        band: bandInfo.band,
        bandLabel: bandInfo.label,
        bandColor: bandInfo.color,
        bandDescription: bandInfo.description,
        nextSteps: bandInfo.nextSteps,
        categoryScores,
      },
    });
  } catch (error) {
    console.error("Scorecard submission error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }
    res.status(500).json({ success: false, error: "Failed to submit scorecard" });
  }
});

router.get("/api/prospect/:prospectId/scorecard/result", async (req, res) => {
  try {
    const { prospectId } = req.params;
    
    const submission = await db.query.partnerScorecardSubmissions.findFirst({
      where: eq(partnerScorecardSubmissions.prospectId, prospectId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      with: {
        answers: true,
        prospect: true,
      },
    });
    
    if (!submission) {
      return res.status(404).json({ success: false, error: "No scorecard found" });
    }
    
    const bandInfo = SCORECARD_BANDS.find((b) => b.band === submission.band);
    
    res.json({
      success: true,
      result: {
        prospect: {
          firstName: submission.prospect.firstName,
          lastName: submission.prospect.lastName,
          email: submission.prospect.email,
          companyName: submission.prospect.companyName,
        },
        submission: {
          id: submission.id,
          totalScore: submission.totalScore,
          band: submission.band,
          bandLabel: bandInfo?.label || submission.band,
          bandColor: bandInfo?.color || "#94A3B8",
          bandDescription: bandInfo?.description || "",
          nextSteps: bandInfo?.nextSteps || [],
          categoryScores: submission.categoryScores,
          createdAt: submission.createdAt,
        },
        categories: SCORECARD_CATEGORIES.map((cat) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          score: (submission.categoryScores as Record<string, number>)[cat.id] || 0,
          maxScore: 20,
          questions: cat.questions.map((q) => {
            const answer = submission.answers.find((a) => a.questionKey === q.key);
            return {
              key: q.key,
              text: q.text,
              score: answer?.score || 0,
              comment: answer?.comment || null,
            };
          }),
        })),
      },
    });
  } catch (error) {
    console.error("Get scorecard result error:", error);
    res.status(500).json({ success: false, error: "Failed to get scorecard result" });
  }
});

router.get("/api/scorecard/questions", async (_req, res) => {
  res.json({
    version: SCORECARD_VERSION,
    categories: SCORECARD_CATEGORIES,
    bands: SCORECARD_BANDS.map((b) => ({
      band: b.band,
      label: b.label,
      minScore: b.minScore,
      maxScore: b.maxScore,
    })),
  });
});

export default router;
