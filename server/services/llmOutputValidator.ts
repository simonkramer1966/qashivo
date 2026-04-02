/**
 * LLM Output Validator — Gap 9
 *
 * Validates generated message quality before send.
 * Checks length, debtor name, invoice references, system prompt leakage, and tone alignment.
 */

interface ValidationResult {
  valid: boolean;
  failures: string[];
}

const LEAKAGE_PATTERNS = [
  /\bas an ai\b/i,
  /\blanguage model\b/i,
  /\bi'm claude\b/i,
  /\bi am claude\b/i,
  /\banthropic\b/i,
  /\bsystem prompt\b/i,
  /\[INST\]/,
  /<\|im_start\|>/,
];

/**
 * Validate a generated message before sending.
 */
export function validateGeneratedMessage(
  content: string,
  channel: 'email' | 'sms' | 'voice',
  debtorName: string,
  toneLevel: string,
  invoiceRefs: string[],
): ValidationResult {
  const failures: string[] = [];

  // 1. Length check
  const measureContent = channel === 'email'
    ? content.replace(/<[^>]*>/g, '').trim()
    : content.trim();
  const len = measureContent.length;

  switch (channel) {
    case 'email':
      if (len < 200) failures.push(`Email too short (${len} chars, min 200)`);
      if (len > 5000) failures.push(`Email too long (${len} chars, max 5000)`);
      break;
    case 'sms':
      if (len < 50) failures.push(`SMS too short (${len} chars, min 50)`);
      if (len > 160) failures.push(`SMS too long (${len} chars, max 160)`);
      break;
    case 'voice':
      if (len < 100) failures.push(`Voice script too short (${len} chars, min 100)`);
      if (len > 2000) failures.push(`Voice script too long (${len} chars, max 2000)`);
      break;
  }

  // 2. Debtor name check — must contain full name or first word
  const nameToCheck = debtorName.trim();
  if (nameToCheck && nameToCheck !== 'Customer') {
    const firstName = nameToCheck.split(/\s+/)[0];
    const contentLower = content.toLowerCase();
    const hasFullName = contentLower.includes(nameToCheck.toLowerCase());
    const hasFirstName = firstName.length >= 2 && contentLower.includes(firstName.toLowerCase());
    if (!hasFullName && !hasFirstName) {
      failures.push(`Missing debtor name "${nameToCheck}" or "${firstName}"`);
    }
  }

  // 3. Invoice reference or currency amount
  const hasInvoiceRef = invoiceRefs.some(ref =>
    ref && content.toLowerCase().includes(ref.toLowerCase())
  );
  const hasCurrencyAmount = /£\s*[\d,]+\.?\d*/i.test(content);
  if (!hasInvoiceRef && !hasCurrencyAmount) {
    failures.push('Missing invoice reference or currency amount');
  }

  // 4. System prompt leakage
  for (const pattern of LEAKAGE_PATTERNS) {
    if (pattern.test(content)) {
      failures.push(`System prompt leakage detected: ${pattern.source}`);
      break; // one leakage failure is enough
    }
  }

  // 5. Tone alignment
  const tone = toneLevel.toLowerCase();
  const contentLower = content.toLowerCase();

  if (tone === 'friendly') {
    if (contentLower.includes('legal proceedings')) failures.push('Friendly tone contains "legal proceedings"');
    if (contentLower.includes('consequences')) failures.push('Friendly tone contains "consequences"');
    if (contentLower.includes('failure to')) failures.push('Friendly tone contains "failure to"');
  } else if (tone === 'professional') {
    if (contentLower.includes('legal proceedings')) failures.push('Professional tone contains "legal proceedings"');
  } else if (tone === 'legal') {
    const hasLegalFraming =
      contentLower.includes('pre-action') ||
      contentLower.includes('proceedings') ||
      contentLower.includes('statutory interest') ||
      contentLower.includes('civil procedure');
    if (!hasLegalFraming) {
      failures.push('Legal tone missing legal framing (pre-action, proceedings, statutory interest, or Civil Procedure)');
    }
  }
  // firm and formal — warnings only, not rejections (per spec)

  return { valid: failures.length === 0, failures };
}
