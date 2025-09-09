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

export async function generateAiCfoResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  arContext: {
    totalOutstanding: number;
    overdueAmount: number;
    collectionRate: number;
    averageDaysToPay: number;
    activeContacts: number;
    recentInvoices?: Array<{
      id: string;
      amount: number;
      daysPastDue: number;
      customerName: string;
      status: string;
    }>;
    cashflowTrends?: {
      thirtyDays: number;
      sixtyDays: number;
      ninetyDays: number;
    };
  }
): Promise<string> {
  try {
    const contextPrompt = `
    CURRENT AR PERFORMANCE DATA:
    - Total Outstanding: $${arContext.totalOutstanding?.toLocaleString() || '0'}
    - Overdue Amount: $${arContext.overdueAmount?.toLocaleString() || '0'}
    - Collection Rate: ${arContext.collectionRate || 85}%
    - Average Days to Pay: ${arContext.averageDaysToPay || 30} days
    - Active Contacts: ${arContext.activeContacts || 0}
    
    ${arContext.recentInvoices ? `
    RECENT INVOICE STATUS:
    ${arContext.recentInvoices.slice(0, 5).map(inv => 
      `- ${inv.customerName}: $${inv.amount} (${inv.daysPastDue} days past due, ${inv.status})`
    ).join('\n')}
    ` : ''}
    
    ${arContext.cashflowTrends ? `
    CASHFLOW AGING:
    - 0-30 days: $${arContext.cashflowTrends.thirtyDays?.toLocaleString() || '0'}
    - 31-60 days: $${arContext.cashflowTrends.sixtyDays?.toLocaleString() || '0'}
    - 60+ days: $${arContext.cashflowTrends.ninetyDays?.toLocaleString() || '0'}
    ` : ''}
    `;

    const messages: any[] = [
      {
        role: "system",
        content: `You are an experienced CFO and financial advisor specializing in accounts receivable and cashflow optimization. You provide strategic, actionable financial advice to business leaders.

Your expertise includes:
- Accounts receivable management and optimization
- Cashflow forecasting and improvement strategies  
- Credit risk assessment and mitigation
- Collection strategy optimization
- Working capital management
- Financial performance analysis
- Industry benchmarking and best practices

IMPORTANT GUIDELINES:
1. Always reference the specific AR data provided to make your advice contextual and relevant
2. Provide concrete, actionable recommendations with clear next steps
3. Explain the financial impact and rationale behind your suggestions
4. Use professional but accessible language suitable for business leaders
5. Focus on strategic opportunities to improve cashflow and reduce receivables risk
6. When appropriate, provide industry benchmarks or comparisons
7. Keep responses comprehensive but concise (200-400 words typically)

CURRENT CONTEXT:
${contextPrompt}
`
      }
    ];

    // Add conversation history (last 10 messages to maintain context)
    const recentHistory = conversationHistory.slice(-10);
    messages.push(...recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })));

    // Add current user message
    messages.push({
      role: "user", 
      content: userMessage
    });

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages,
      temperature: 0.7,
      max_tokens: 800,
    });

    return response.choices[0].message.content || "I apologize, but I'm having trouble processing your request right now. Please try asking again.";
  } catch (error) {
    console.error("Error generating AI CFO response:", error);
    return "I apologize for the technical difficulty. As your AI CFO, I'm temporarily unable to provide advice. Please try your question again in a moment.";
  }
}
