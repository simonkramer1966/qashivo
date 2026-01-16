/**
 * Outcome Detection Service
 * 
 * MVP heuristics-based approach to detect outcomes from inbound communications
 * WITHOUT using AI/ML (Xero compliance requirement)
 * 
 * Outcome Types:
 * - PROMISE_TO_PAY: Customer commits to pay by a specific date
 * - DISPUTE: Customer disputes the invoice (wrong amount, not received, quality issues)
 * - ALREADY_PAID: Customer claims they've already paid
 * - QUERY: Customer has a question about the invoice
 * - CALLBACK_REQUEST: Customer requests a callback
 * - NOT_RESPONSIBLE: Wrong person, not the decision maker
 * - IGNORED: No meaningful content detected
 */

export type OutcomeType = 
  | 'PROMISE_TO_PAY'
  | 'DISPUTE'
  | 'ALREADY_PAID'
  | 'QUERY'
  | 'CALLBACK_REQUEST'
  | 'NOT_RESPONSIBLE'
  | 'IGNORED';

export interface OutcomeDetectionResult {
  outcomeType: OutcomeType | null;
  confidence: number;
  extractedAmount: string | null;
  extractedDate: Date | null;
  extractedReason: string | null;
  matchedPatterns: string[];
}

const UK_DATE_PATTERNS = [
  /(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i,
  /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
  /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|next\s+week|end\s+of\s+(?:this\s+)?week|end\s+of\s+(?:this\s+)?month)\b/i,
];

const AMOUNT_PATTERNS = [
  /£\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
  /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:pounds?|GBP)/i,
  /(?:pay|paying|send|transfer)\s+(?:you\s+)?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
];

const PROMISE_TO_PAY_PATTERNS = [
  /(?:will|can|going\s+to|shall)\s+(?:pay|send|transfer|arrange|make\s+payment)/i,
  /(?:pay|payment|settle)\s+(?:by|on|before|this)/i,
  /(?:arrange|organise|schedule)\s+(?:a\s+)?payment/i,
  /promise\s+to\s+pay/i,
  /(?:will\s+)?(?:be\s+)?paid?\s+(?:by|on|before)/i,
  /(?:commit|committed)\s+to\s+(?:pay|paying)/i,
  /i(?:'ll|'m\s+going\s+to)\s+(?:pay|settle|clear)/i,
  /expect\s+to\s+pay/i,
  /payment\s+(?:will\s+be\s+)?(?:made|processed|sent)\s+(?:by|on)/i,
];

const ALREADY_PAID_PATTERNS = [
  /(?:already|have)\s+(?:paid|settled|cleared|sent|transferred)/i,
  /payment\s+(?:has\s+been|was)\s+(?:made|sent|processed)/i,
  /(?:cheque|check|bacs|transfer)\s+(?:sent|in\s+post|on\s+its\s+way)/i,
  /paid\s+(?:this|the\s+invoice|on)/i,
  /(?:should\s+have\s+)?(?:received|got)\s+(?:the\s+)?payment/i,
  /cleared\s+(?:this|the\s+balance)/i,
  /(?:this\s+)?(?:invoice\s+)?(?:is\s+)?(?:already\s+)?paid/i,
];

const DISPUTE_PATTERNS = [
  /(?:dispute|disputing|disputed|query|querying)/i,
  /(?:wrong|incorrect)\s+(?:amount|invoice|goods|items|price)/i,
  /(?:didn't|did\s+not|never)\s+(?:receive|get|order)/i,
  /(?:goods|items|products?)\s+(?:were\s+)?(?:damaged|faulty|wrong|missing)/i,
  /not\s+(?:as\s+)?(?:ordered|agreed|described)/i,
  /(?:quality|service)\s+(?:issue|problem)/i,
  /(?:overcharged|double\s+charged)/i,
  /(?:credit\s+note|refund)\s+(?:due|expected|promised)/i,
  /(?:return|returned)\s+(?:the\s+)?(?:goods|items|products?)/i,
  /(?:complaint|complaining)/i,
];

const QUERY_PATTERNS = [
  /(?:can\s+you|could\s+you|please)\s+(?:send|email|provide)/i,
  /(?:need|require)\s+(?:a\s+)?(?:copy|duplicate|breakdown)/i,
  /(?:which|what)\s+(?:invoice|order)/i,
  /(?:don't|do\s+not)\s+(?:recognise|recognize|have\s+record)/i,
  /(?:statement|breakdown|details)/i,
  /(?:unclear|confused|unsure)\s+(?:about|which)/i,
  /(?:can't|cannot)\s+(?:find|locate|see)/i,
  /\?$/m,
];

const CALLBACK_PATTERNS = [
  /(?:call|phone|ring)\s+(?:me|us|back)/i,
  /(?:prefer|rather)\s+(?:speak|talk|discuss)/i,
  /(?:give\s+(?:me|us)\s+a\s+call)/i,
  /(?:available|free)\s+(?:to\s+)?(?:speak|talk|call)/i,
  /(?:best|good)\s+(?:time\s+to\s+)?(?:call|reach)/i,
  /(?:my|our)\s+(?:direct\s+)?(?:number|phone)/i,
];

const NOT_RESPONSIBLE_PATTERNS = [
  /(?:wrong|incorrect)\s+(?:person|contact|department)/i,
  /(?:don't|do\s+not)\s+(?:deal\s+with|handle)\s+(?:this|payments?|invoices?)/i,
  /(?:not\s+(?:the\s+)?)?(?:my|our)\s+(?:responsibility|department)/i,
  /(?:speak|contact|email)\s+(?:to\s+)?(?:accounts?|finance|someone\s+else)/i,
  /(?:accounts?\s+)?(?:payable|department)\s+(?:handles?|deals?\s+with)/i,
  /(?:i'm|i\s+am)\s+not\s+(?:the\s+right|able|authorised)/i,
  /(?:left|no\s+longer\s+(?:work|here))/i,
];

const AUTO_REPLY_PATTERNS = [
  /out\s+of\s+(?:the\s+)?office/i,
  /auto(?:matic)?(?:[-\s])?reply/i,
  /(?:will\s+be\s+)?(?:away|on\s+leave|on\s+holiday)/i,
  /(?:limited|no)\s+access\s+to\s+email/i,
  /(?:will\s+)?(?:respond|reply|get\s+back)\s+(?:when|upon|on\s+my)/i,
  /this\s+is\s+an?\s+automated/i,
  /do\s+not\s+reply/i,
];

function parseUKDate(text: string): Date | null {
  const monthMap: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };
  
  // Try "15th January" or "January 15th"
  for (const pattern of UK_DATE_PATTERNS.slice(0, 2)) {
    const match = text.match(pattern);
    if (match) {
      const fullMatch = match[0].toLowerCase();
      const monthMatch = fullMatch.match(/jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?/);
      const dayMatch = fullMatch.match(/\d{1,2}/);
      
      if (monthMatch && dayMatch) {
        const month = monthMap[monthMatch[0].substring(0, 3)];
        const day = parseInt(dayMatch[0], 10);
        const year = new Date().getFullYear();
        const date = new Date(year, month, day);
        
        // If date is in the past, assume next year
        if (date < new Date()) {
          date.setFullYear(year + 1);
        }
        
        return date;
      }
    }
  }
  
  // Try DD/MM/YYYY or DD-MM-YYYY
  const numericMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    const month = parseInt(numericMatch[2], 10) - 1; // 0-indexed
    let year = parseInt(numericMatch[3], 10);
    if (year < 100) {
      year += 2000;
    }
    return new Date(year, month, day);
  }
  
  // Try relative dates
  const today = new Date();
  const relativeMatch = text.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week|end\s+of\s+(?:this\s+)?week|end\s+of\s+(?:this\s+)?month)\b/i);
  if (relativeMatch) {
    const relative = relativeMatch[1].toLowerCase();
    
    if (relative === 'today') {
      return today;
    }
    if (relative === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    if (relative.includes('next week')) {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }
    if (relative.includes('end of') && relative.includes('week')) {
      const endOfWeek = new Date(today);
      const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
      endOfWeek.setDate(endOfWeek.getDate() + daysUntilFriday);
      return endOfWeek;
    }
    if (relative.includes('end of') && relative.includes('month')) {
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return endOfMonth;
    }
    
    // Day of week
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(relative);
    if (targetDay >= 0) {
      const result = new Date(today);
      const currentDay = today.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      result.setDate(result.getDate() + daysToAdd);
      return result;
    }
  }
  
  return null;
}

function extractAmount(text: string): string | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amount = match[1].replace(/,/g, '');
      return amount;
    }
  }
  return null;
}

function matchPatterns(text: string, patterns: RegExp[]): { matched: boolean; matches: string[] } {
  const matches: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }
  return { matched: matches.length > 0, matches };
}

function cleanText(text: string): string {
  // Remove HTML tags
  let cleaned = text.replace(/<[^>]*>/g, ' ');
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // Remove quoted/forwarded email content (common patterns)
  cleaned = cleaned.replace(/^>.*$/gm, '');
  cleaned = cleaned.replace(/On .+ wrote:[\s\S]*$/i, '');
  cleaned = cleaned.replace(/From:[\s\S]*Sent:[\s\S]*To:[\s\S]*/i, '');
  cleaned = cleaned.replace(/-----Original Message-----[\s\S]*/i, '');
  
  return cleaned.trim();
}

export function detectOutcomeFromText(rawText: string): OutcomeDetectionResult {
  const text = cleanText(rawText);
  const matchedPatterns: string[] = [];
  
  // Check for auto-reply first
  const autoReply = matchPatterns(text, AUTO_REPLY_PATTERNS);
  if (autoReply.matched) {
    return {
      outcomeType: 'IGNORED',
      confidence: 0.9,
      extractedAmount: null,
      extractedDate: null,
      extractedReason: 'Auto-reply detected',
      matchedPatterns: autoReply.matches,
    };
  }
  
  // Check for promise to pay (highest priority if date found)
  const ptpMatch = matchPatterns(text, PROMISE_TO_PAY_PATTERNS);
  const extractedDate = parseUKDate(text);
  const extractedAmount = extractAmount(text);
  
  if (ptpMatch.matched) {
    matchedPatterns.push(...ptpMatch.matches);
    
    let confidence = 0.6;
    if (extractedDate) confidence += 0.25;
    if (extractedAmount) confidence += 0.1;
    
    return {
      outcomeType: 'PROMISE_TO_PAY',
      confidence: Math.min(confidence, 0.95),
      extractedAmount,
      extractedDate,
      extractedReason: null,
      matchedPatterns,
    };
  }
  
  // Check for already paid
  const paidMatch = matchPatterns(text, ALREADY_PAID_PATTERNS);
  if (paidMatch.matched) {
    matchedPatterns.push(...paidMatch.matches);
    
    let confidence = 0.7;
    if (extractedDate) confidence += 0.1;
    if (extractedAmount) confidence += 0.1;
    
    return {
      outcomeType: 'ALREADY_PAID',
      confidence: Math.min(confidence, 0.9),
      extractedAmount,
      extractedDate,
      extractedReason: null,
      matchedPatterns,
    };
  }
  
  // Check for dispute
  const disputeMatch = matchPatterns(text, DISPUTE_PATTERNS);
  if (disputeMatch.matched) {
    matchedPatterns.push(...disputeMatch.matches);
    
    // Try to extract reason
    let reason: string | null = null;
    const reasonPatterns = [
      /(?:because|due\s+to|as)\s+(.{10,60})/i,
      /(?:wrong|incorrect|damaged|faulty|missing|not\s+received)\s+(.{5,40})/i,
    ];
    for (const pattern of reasonPatterns) {
      const reasonMatch = text.match(pattern);
      if (reasonMatch) {
        reason = reasonMatch[1].trim();
        break;
      }
    }
    
    return {
      outcomeType: 'DISPUTE',
      confidence: disputeMatch.matches.length > 1 ? 0.85 : 0.7,
      extractedAmount,
      extractedDate: null,
      extractedReason: reason,
      matchedPatterns,
    };
  }
  
  // Check for callback request
  const callbackMatch = matchPatterns(text, CALLBACK_PATTERNS);
  if (callbackMatch.matched) {
    matchedPatterns.push(...callbackMatch.matches);
    
    return {
      outcomeType: 'CALLBACK_REQUEST',
      confidence: 0.75,
      extractedAmount: null,
      extractedDate: null,
      extractedReason: null,
      matchedPatterns,
    };
  }
  
  // Check for not responsible
  const notResponsibleMatch = matchPatterns(text, NOT_RESPONSIBLE_PATTERNS);
  if (notResponsibleMatch.matched) {
    matchedPatterns.push(...notResponsibleMatch.matches);
    
    return {
      outcomeType: 'NOT_RESPONSIBLE',
      confidence: 0.75,
      extractedAmount: null,
      extractedDate: null,
      extractedReason: null,
      matchedPatterns,
    };
  }
  
  // Check for general query
  const queryMatch = matchPatterns(text, QUERY_PATTERNS);
  if (queryMatch.matched) {
    matchedPatterns.push(...queryMatch.matches);
    
    return {
      outcomeType: 'QUERY',
      confidence: 0.6,
      extractedAmount: null,
      extractedDate: null,
      extractedReason: null,
      matchedPatterns,
    };
  }
  
  // No clear outcome detected
  return {
    outcomeType: null,
    confidence: 0,
    extractedAmount: null,
    extractedDate: null,
    extractedReason: null,
    matchedPatterns: [],
  };
}
