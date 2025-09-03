import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

interface CollectionSuggestion {
  type: 'opportunity' | 'risk' | 'strategy';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  confidence: number;
}

interface EmailDraft {
  subject: string;
  content: string;
  tone: 'friendly' | 'professional' | 'urgent';
}

export async function generateCollectionSuggestions(
  invoiceData: {
    amount: number;
    daysPastDue: number;
    contactHistory: Array<{ type: string; date: string; response?: string }>;
    contactProfile: { name: string; paymentHistory: string; relationship: string };
  }
): Promise<CollectionSuggestion[]> {
  try {
    const prompt = `
    As a debt collection expert, analyze this invoice situation and provide actionable suggestions:
    
    Invoice Amount: $${invoiceData.amount}
    Days Past Due: ${invoiceData.daysPastDue}
    Contact History: ${JSON.stringify(invoiceData.contactHistory)}
    Contact Profile: ${JSON.stringify(invoiceData.contactProfile)}
    
    Provide 2-3 specific, actionable suggestions in JSON format:
    {
      "suggestions": [
        {
          "type": "opportunity|risk|strategy",
          "priority": "high|medium|low",
          "title": "Short title",
          "description": "Detailed explanation",
          "action": "Specific action to take",
          "confidence": 0.8
        }
      ]
    }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert debt collection advisor with 20+ years of experience. Provide practical, professional advice."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{"suggestions": []}');
    return result.suggestions || [];
  } catch (error) {
    console.error("Error generating collection suggestions:", error);
    return [];
  }
}

export async function generateEmailDraft(
  context: {
    contactName: string;
    invoiceNumber: string;
    amount: number;
    daysPastDue: number;
    previousEmails: number;
    tone: 'friendly' | 'professional' | 'urgent';
  }
): Promise<EmailDraft> {
  try {
    const prompt = `
    Generate a professional collection email with these details:
    
    Contact Name: ${context.contactName}
    Invoice Number: ${context.invoiceNumber}
    Amount: $${context.amount}
    Days Past Due: ${context.daysPastDue}
    Previous Emails Sent: ${context.previousEmails}
    Desired Tone: ${context.tone}
    
    Create an appropriate email in JSON format:
    {
      "subject": "Email subject line",
      "content": "Full email content with proper formatting",
      "tone": "${context.tone}"
    }
    
    Make the email professional, empathetic, and action-oriented. Include payment options and next steps.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a professional accounts receivable specialist. Generate courteous but effective collection emails."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      subject: result.subject || `Payment Reminder - Invoice ${context.invoiceNumber}`,
      content: result.content || `Dear ${context.contactName},\n\nWe hope this message finds you well. We wanted to remind you that Invoice ${context.invoiceNumber} for $${context.amount} is now ${context.daysPastDue} days past due.\n\nPlease let us know if you have any questions or concerns.\n\nBest regards`,
      tone: context.tone
    };
  } catch (error) {
    console.error("Error generating email draft:", error);
    return {
      subject: `Payment Reminder - Invoice ${context.invoiceNumber}`,
      content: `Dear ${context.contactName},\n\nWe hope this message finds you well. We wanted to remind you that Invoice ${context.invoiceNumber} for $${context.amount} is now ${context.daysPastDue} days past due.\n\nPlease let us know if you have any questions or concerns.\n\nBest regards`,
      tone: context.tone
    };
  }
}

export async function analyzePaymentPatterns(
  invoiceHistory: Array<{
    amount: number;
    issueDate: string;
    paidDate?: string;
    daysToPay?: number;
  }>
): Promise<{
  averagePaymentTime: number;
  paymentTrend: 'improving' | 'declining' | 'stable';
  riskScore: number;
  recommendations: string[];
}> {
  try {
    const prompt = `
    Analyze this payment history and provide insights:
    
    Invoice History: ${JSON.stringify(invoiceHistory)}
    
    Provide analysis in JSON format:
    {
      "averagePaymentTime": number,
      "paymentTrend": "improving|declining|stable",
      "riskScore": number (0-100),
      "recommendations": ["recommendation1", "recommendation2"]
    }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a credit risk analyst. Analyze payment patterns and provide actionable insights."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      averagePaymentTime: result.averagePaymentTime || 30,
      paymentTrend: result.paymentTrend || 'stable',
      riskScore: result.riskScore || 50,
      recommendations: result.recommendations || ['Monitor payment behavior closely']
    };
  } catch (error) {
    console.error("Error analyzing payment patterns:", error);
    return {
      averagePaymentTime: 30,
      paymentTrend: 'stable',
      riskScore: 50,
      recommendations: ['Monitor payment behavior closely']
    };
  }
}
