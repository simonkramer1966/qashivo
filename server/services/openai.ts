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

export async function detectSmsIntent(
  smsMessage: string,
  context?: {
    customerName?: string;
    invoiceNumber?: string;
    amount?: number;
    daysPastDue?: number;
  }
): Promise<{
  intentType: 'payment_plan' | 'dispute' | 'promise_to_pay' | 'general_query';
  intentConfidence: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
}> {
  try {
    const contextInfo = context ? `
    Context:
    - Customer: ${context.customerName || 'Unknown'}
    - Invoice: ${context.invoiceNumber || 'N/A'}
    - Amount: ${context.amount ? `$${context.amount}` : 'N/A'}
    - Days Past Due: ${context.daysPastDue || 0}
    ` : '';

    const prompt = `
    Analyze this SMS message from a customer regarding an invoice payment:
    
    Message: "${smsMessage}"
    ${contextInfo}
    
    Classify the customer's intent into ONE of these categories:
    - "payment_plan": Customer wants to set up installments or payment arrangement
    - "dispute": Customer is questioning/disputing the invoice or amount
    - "promise_to_pay": Customer commits to pay by a specific date
    - "general_query": General questions or other communications
    
    Also determine:
    - Sentiment: positive, neutral, or negative
    - Confidence: 0.0 to 1.0 (how confident you are in the classification)
    - Summary: Brief 1-sentence summary of the message
    
    Respond in JSON format:
    {
      "intentType": "payment_plan|dispute|promise_to_pay|general_query",
      "intentConfidence": 0.85,
      "sentiment": "positive|neutral|negative",
      "summary": "Brief summary of the message"
    }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing customer communications in debt collection. Accurately classify customer intent and sentiment."
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
      intentType: result.intentType || 'general_query',
      intentConfidence: parseFloat(result.intentConfidence) || 0.5,
      sentiment: result.sentiment || 'neutral',
      summary: result.summary || smsMessage.substring(0, 100)
    };
  } catch (error) {
    console.error("Error detecting SMS intent:", error);
    // Return default values if AI fails
    return {
      intentType: 'general_query',
      intentConfidence: 0.3,
      sentiment: 'neutral',
      summary: smsMessage.substring(0, 100)
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
    knowledgeBase?: Array<{
      title: string;
      content: string;
      category: string;
      priority: number;
      source?: string;
    }>;
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
  },
  specificCustomerData?: {
    customerName: string;
    totalInvoices: number;
    totalAmount: number;
    outstandingAmount: number;
    invoiceDetails: Array<{
      invoiceNumber: string;
      amount: number;
      status: string;
      daysPastDue: number;
    }>;
  } | null
): Promise<string> {
  try {
    console.log("🤖 AI CFO: Starting response generation for:", userMessage.substring(0, 50) + "...");
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an experienced CFO providing financial advice on accounts receivable. 

CRITICAL UNDERSTANDING - "OWE" vs "INVOICED" DISTINCTION:
When users ask "How much does [Customer] owe us?" they want OUTSTANDING/UNPAID amounts, NOT total invoice amounts.
• "Owe" = Outstanding Amount = Unpaid invoices only
• "Total invoiced" = All invoices including paid ones
• Always prioritize and emphasize OUTSTANDING amounts for "owe" questions

IMPORTANT: You have COMPLETE ACCESS to detailed invoice and customer data. You can and should provide specific information about individual customers, their outstanding balances, payment history, and aging details.

CURRENT AR DATA:
• Total Outstanding: $${arContext.totalOutstanding?.toLocaleString() || '0'}
• Overdue Amount: $${arContext.overdueAmount?.toLocaleString() || '0'} 
• Collection Rate: ${arContext.collectionRate || 85}%
• Active Outstanding Invoices: ${arContext.activeContacts || 0}

${arContext.knowledgeBase && arContext.knowledgeBase.length > 0 ? `
KNOWLEDGE BASE (Use this for accurate industry data and best practices):
${arContext.knowledgeBase.map((fact: any, index: number) => 
`${index + 1}. **${fact.title}** (${fact.category})
   ${fact.content}
   Source: ${fact.source || 'Internal'}`
).join('\n\n')}

REFERENCE KNOWLEDGE: Always cite the knowledge base facts when providing industry benchmarks, regulatory guidance, or best practices. This ensures accurate and credible advice.
` : ''}

${specificCustomerData ? `
SPECIFIC CUSTOMER FOUND: ${specificCustomerData.customerName}
• Total Invoices: ${specificCustomerData.totalInvoices}
• Total Amount (All Invoices): $${specificCustomerData.totalAmount.toLocaleString()}
• Outstanding Amount: $${specificCustomerData.outstandingAmount.toLocaleString()}

DETAILED INVOICE BREAKDOWN:
${specificCustomerData.invoiceDetails.map(inv => 
  `• Invoice ${inv.invoiceNumber}: $${inv.amount.toLocaleString()} (${inv.daysPastDue} days past due, ${inv.status})`
).join('\n')}

ANSWER DIRECTLY: Provide specific details about this customer's outstanding balance and recommend next actions.
` : `
COMPLETE CUSTOMER DATABASE ACCESS:
You have access to ALL customer invoices. When asked about specific customers, I'll search for their exact details.

SAMPLE CUSTOMERS (Top 5 by amount):
${arContext.recentInvoices?.map(inv => 
  `• ${inv.customerName}: $${inv.amount.toLocaleString()} (${inv.daysPastDue} days past due, Status: ${inv.status})`
).join('\n') || '• No recent invoice data available'}
`}

CAPABILITIES:
- Answer specific questions about individual customers and their balances
- Provide detailed aging analysis and payment recommendations  
- Access complete invoice history and payment patterns
- Give precise financial advice based on actual data
- Reference knowledge base for industry benchmarks and compliance requirements

FORMATTING INSTRUCTIONS:
- Use clear paragraph breaks between different points
- Start key recommendations with bullet points (•)
- Use line breaks to separate sections
- Keep paragraphs concise (2-3 sentences max)
- When asked about specific customers, search through the available data and provide exact details
- When referencing knowledge base facts, mention the source for credibility`
        },
        {
          role: "user", 
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    console.log("🤖 AI CFO: Response received successfully");
    return response.choices[0].message.content || "I apologize, but I'm having trouble processing your request right now. Please try asking again.";
  } catch (error: any) {
    console.error("❌ AI CFO Error:", error.message || error);
    if (error.status) {
      console.error("❌ Status:", error.status);
    }
    return "I apologize for the technical difficulty. As your AI CFO, I'm temporarily unable to provide advice. Please try your question again in a moment.";
  }
}

// Email template types for collections
export type EmailTemplateType = 'full_payment_request' | 'plan_confirmation' | 'remittance_request' | 'statement';

interface CollectionEmailContext {
  contactName: string;
  companyName: string;
  totalOutstanding: number;
  oldestOverdueDays: number;
  invoices: Array<{
    invoiceNumber: string;
    amount: number;
    interest?: number;
    dueDate: string;
    daysOverdue: number;
  }>;
  recentActivity?: Array<{
    type: string;
    date: string;
    summary?: string;
  }>;
  paymentPlan?: {
    totalAmount: number;
    installments: number;
    nextPaymentDate: string;
    nextPaymentAmount: number;
  } | null;
  tone: 'friendly' | 'professional' | 'firm';
  senderName: string;
  senderCompany: string;
  includeStatutoryInterest?: boolean;
  totalInterest?: number;
  statutoryInterestRate?: number;
}

export interface CollectionEmailDraft {
  subject: string;
  body: string;
  templateType: EmailTemplateType;
}

const templateDescriptions: Record<EmailTemplateType, string> = {
  full_payment_request: "Request for full payment of all outstanding invoices, emphasizing the importance of settling the account",
  plan_confirmation: "Confirmation of an agreed payment plan with details of the installments and next steps",
  remittance_request: "Request for remittance advice or proof of payment for recent payments made",
  statement: "Statement of account showing all outstanding invoices with a request to review and confirm balances"
};

export async function generateCollectionEmail(
  templateType: EmailTemplateType,
  context: CollectionEmailContext
): Promise<CollectionEmailDraft> {
  try {
    const templateDescription = templateDescriptions[templateType];
    
    const invoicesList = context.invoices.map(inv => 
      `- Invoice ${inv.invoiceNumber}: £${inv.amount.toFixed(2)}`
    ).join('\n');
    
    const statutoryInterestSection = context.includeStatutoryInterest && context.totalInterest && context.totalInterest > 0
      ? `\nStatutory Interest (to be included as a SEPARATE paragraph AFTER the invoice list):
- Total interest amount: £${context.totalInterest.toFixed(2)}
- IMPORTANT: After listing the invoices, include a separate paragraph stating that you reserve the right to charge statutory interest of £${context.totalInterest.toFixed(2)} under the Late Payment of Commercial Debts (Interest) Act 1998. Do NOT list interest per invoice - just state the total amount you reserve the right to charge.`
      : '';

    const recentActivityText = context.recentActivity?.length 
      ? context.recentActivity.slice(0, 5).map(a => `- ${a.date}: ${a.type} - ${a.summary || ''}`).join('\n')
      : 'No recent communication on file';

    const paymentPlanText = context.paymentPlan
      ? `Active payment plan: £${context.paymentPlan.totalAmount} over ${context.paymentPlan.installments} installments. Next payment: £${context.paymentPlan.nextPaymentAmount} due ${context.paymentPlan.nextPaymentDate}`
      : 'No active payment plan';

    const prompt = `
Generate a professional UK business collection email with these details:

Template Type: ${templateType.replace(/_/g, ' ').toUpperCase()}
Purpose: ${templateDescription}

Customer Details:
- Contact Name: ${context.contactName}
- Company: ${context.companyName}
- Total Overdue Balance: £${context.totalOutstanding.toFixed(2)} (amount past due date)
- Oldest Overdue: ${context.oldestOverdueDays} days

Overdue Invoices (past due date):
${invoicesList}
${statutoryInterestSection}

Recent Communication History:
${recentActivityText}

Payment Plan Status:
${paymentPlanText}

Desired Tone: ${context.tone}

From:
${context.senderName}
${context.senderCompany}

Generate an appropriate email in JSON format:
{
  "subject": "Clear, professional subject line",
  "body": "Full email body with proper UK business formatting. Use £ for currency. Include greeting, main content, call to action, and professional sign-off. Do not include placeholder brackets like [Name] - use the actual values provided."
}

Guidelines:
- Use British English spelling
- Be professional but ${context.tone}
- Include specific invoice/amount details where relevant
- IMPORTANT: Refer to the total as "overdue balance" (past due), not "outstanding balance" (outstanding could include invoices not yet due)
- End with clear next steps or call to action
- Sign off appropriately for the tone
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an experienced UK credit controller writing professional collection emails. You balance firmness with maintaining positive customer relationships. Always use British English and £ currency formatting. CRITICAL: Always refer to the balance as 'overdue balance' (past due date), NEVER use 'outstanding balance' as that term includes invoices not yet due."
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
      subject: result.subject || getDefaultSubject(templateType, context),
      body: result.body || getDefaultBody(templateType, context),
      templateType
    };
  } catch (error) {
    console.error("Error generating collection email:", error);
    return {
      subject: getDefaultSubject(templateType, context),
      body: getDefaultBody(templateType, context),
      templateType
    };
  }
}

function getDefaultSubject(templateType: EmailTemplateType, context: CollectionEmailContext): string {
  switch (templateType) {
    case 'full_payment_request':
      return `Payment Required - £${context.totalOutstanding.toFixed(2)} Outstanding`;
    case 'plan_confirmation':
      return `Payment Plan Confirmation - ${context.companyName}`;
    case 'remittance_request':
      return `Remittance Advice Required - ${context.companyName}`;
    case 'statement':
      return `Statement of Account - ${context.companyName}`;
  }
}

function getDefaultBody(templateType: EmailTemplateType, context: CollectionEmailContext): string {
  const greeting = `Dear ${context.contactName},`;
  const signOff = `Kind regards,\n${context.senderName}\n${context.senderCompany}`;
  
  switch (templateType) {
    case 'full_payment_request':
      return `${greeting}\n\nI am writing regarding the outstanding balance on your account of £${context.totalOutstanding.toFixed(2)}.\n\nPlease arrange payment at your earliest convenience.\n\n${signOff}`;
    case 'plan_confirmation':
      return `${greeting}\n\nThank you for discussing a payment arrangement with us.\n\nPlease confirm you are happy to proceed with the agreed plan.\n\n${signOff}`;
    case 'remittance_request':
      return `${greeting}\n\nWe have received a payment but require remittance advice to allocate it correctly.\n\nPlease provide details of the invoices this payment relates to.\n\n${signOff}`;
    case 'statement':
      return `${greeting}\n\nPlease find below a summary of your outstanding invoices totalling £${context.totalOutstanding.toFixed(2)}.\n\nKindly review and let us know if you have any queries.\n\n${signOff}`;
  }
}
