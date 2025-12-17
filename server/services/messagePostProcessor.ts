/**
 * Message Post-Processor Service
 * 
 * Ensures AI-generated email content has proper HTML formatting
 * even when the AI model returns plain text without tags.
 */

/**
 * Ensures the email body has proper <p> tags for paragraph formatting.
 * Handles mixed content where some paragraphs may already be wrapped
 * but others are plain text.
 */
export function ensureHtmlParagraphs(body: string): string {
  if (!body || typeof body !== 'string') {
    return body;
  }

  // Preserve HTML tables - extract them first
  const tablePattern = /<table[\s\S]*?<\/table>/gi;
  const tables: string[] = [];
  let processedBody = body.replace(tablePattern, (match) => {
    tables.push(match);
    return `\n__TABLE_PLACEHOLDER_${tables.length - 1}__\n`;
  });

  // Check if content has ANY <p> tags
  const hasSomePTags = /<p[\s>]/i.test(processedBody);
  
  if (hasSomePTags) {
    // Content has some <p> tags - need to process mixed content
    // Split content into segments by existing <p>...</p> blocks and process gaps
    processedBody = processMixedContent(processedBody);
  } else {
    // No <p> tags at all - wrap everything
    processedBody = wrapAllParagraphs(processedBody);
  }

  // Restore tables
  tables.forEach((table, index) => {
    processedBody = processedBody.replace(`__TABLE_PLACEHOLDER_${index}__`, table);
  });

  return processedBody;
}

/**
 * Process content that has some <p> tags but may have unwrapped text segments
 */
function processMixedContent(body: string): string {
  // Split the content by existing <p>...</p> blocks
  // Regex matches <p>...</p> including attributes and multi-line content
  const pTagPattern = /(<p[^>]*>[\s\S]*?<\/p>)/gi;
  
  const segments = body.split(pTagPattern);
  
  const processedSegments = segments.map(segment => {
    // If this segment is already a <p> block, keep it as-is
    if (/<p[^>]*>[\s\S]*?<\/p>/i.test(segment)) {
      return segment;
    }
    
    // This is a text segment between <p> blocks - wrap if non-empty
    const trimmed = segment.trim();
    if (!trimmed || trimmed === '' || /^__TABLE_PLACEHOLDER_\d+__$/.test(trimmed)) {
      return segment; // Keep placeholders and whitespace as-is
    }
    
    // Wrap the text in <p> tags, handling newlines
    return wrapAllParagraphs(segment);
  });
  
  return processedSegments.join('');
}

/**
 * Wrap all plain text in <p> tags by splitting on paragraph breaks
 */
function wrapAllParagraphs(text: string): string {
  // Split by double newlines (paragraph breaks) or single newlines with empty lines
  const paragraphs = text
    .split(/\n\s*\n|\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // If no paragraph breaks found, try splitting by single newlines
  let wrappedParagraphs: string[];
  
  if (paragraphs.length === 1 && paragraphs[0].includes('\n')) {
    // Single block with newlines - split more aggressively
    const lines = paragraphs[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    wrappedParagraphs = lines.map(line => {
      // Check if it's a placeholder for a table
      if (/^__TABLE_PLACEHOLDER_\d+__$/.test(line)) {
        return line;
      }
      // Don't wrap if already a block element
      if (/^<(p|div|table|ul|ol|h[1-6])[>\s]/i.test(line)) {
        return line;
      }
      return `<p>${line}</p>`;
    });
  } else if (paragraphs.length === 1) {
    // Single paragraph without any breaks
    const para = paragraphs[0];
    if (/^__TABLE_PLACEHOLDER_\d+__$/.test(para) || /^<(p|div|table|ul|ol|h[1-6])[>\s]/i.test(para)) {
      return para;
    }
    return `<p>${para}</p>`;
  } else {
    // Multiple paragraphs detected
    wrappedParagraphs = paragraphs.map(para => {
      // Check if it's a placeholder for a table or already a block element
      if (/^__TABLE_PLACEHOLDER_\d+__$/.test(para) || /^<(p|div|table|ul|ol|h[1-6])[>\s]/i.test(para)) {
        return para;
      }
      // Replace single newlines with <br> within paragraphs
      const withBreaks = para.replace(/\n/g, '<br>');
      return `<p>${withBreaks}</p>`;
    });
  }

  return wrappedParagraphs.join('\n');
}

/**
 * Cleans up email content by:
 * - Removing excessive whitespace
 * - Ensuring proper paragraph formatting
 * - Preserving HTML tables and other markup
 */
export function cleanEmailContent(body: string): string {
  if (!body) return body;

  // First ensure paragraphs are properly wrapped
  let cleaned = ensureHtmlParagraphs(body);

  // Remove empty paragraphs
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');

  // Remove excessive whitespace between tags
  cleaned = cleaned.replace(/>\s{2,}</g, '>\n<');

  return cleaned.trim();
}

/**
 * Post-process SMS content
 * Ensures proper line breaks are preserved and enforces 160 character limit
 */
export function cleanSmsContent(body: string): string {
  if (!body) return body;

  // Normalize line breaks (handle escaped \n from JSON)
  let cleaned = body.replace(/\\n/g, '\n');
  
  // Remove excessive whitespace while preserving intentional breaks
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  cleaned = cleaned.trim();
  
  // Enforce 160 character limit for SMS
  if (cleaned.length > 160) {
    console.warn(`⚠️ SMS exceeded 160 chars (${cleaned.length}), truncating: "${cleaned.substring(0, 50)}..."`);
    cleaned = truncateSmsToLimit(cleaned, 160);
  }
  
  return cleaned;
}

/**
 * Truncate SMS to character limit while preserving meaning
 * Tries to break at word boundaries and keeps essential structure
 */
function truncateSmsToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  
  // Find the last space before the limit to avoid cutting words
  const truncated = text.substring(0, limit - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > limit * 0.6) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Build SMS content that fits within character limit
 * Prioritizes essential information and truncates less important parts
 */
export function buildSmsWithLimit(
  parts: { text: string; priority: number }[],
  maxLength: number = 160
): string {
  // Sort by priority (lower = more important)
  const sorted = [...parts].sort((a, b) => a.priority - b.priority);
  
  let result = '';
  for (const part of sorted) {
    const candidate = result ? `${result}\n${part.text}` : part.text;
    if (candidate.length <= maxLength) {
      result = candidate;
    }
  }
  
  return result.trim();
}

/**
 * Wraps email content in a professional HTML email template
 */
export interface EmailTemplateOptions {
  companyName: string;
  companyEmail?: string;
  brandColor?: string;
}

export function wrapInHtmlEmailTemplate(
  bodyContent: string,
  options: EmailTemplateOptions
): string {
  const { companyName, companyEmail, brandColor = '#17B6C3' } = options;
  
  // Check if content is already a full HTML document - if so, extract body content
  let contentToWrap = bodyContent;
  if (/<html[\s>]/i.test(bodyContent)) {
    // Extract content between <body> tags if present
    const bodyMatch = bodyContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      contentToWrap = bodyMatch[1];
    } else {
      // Has <html> but no <body> - try to extract what's inside <html>
      const htmlMatch = bodyContent.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
      if (htmlMatch) {
        contentToWrap = htmlMatch[1];
      }
    }
  }
  
  const processedBody = cleanEmailContent(contentToWrap);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email from ${companyName}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background-color: ${brandColor};
      padding: 24px 32px;
      text-align: left;
    }
    .email-header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
    }
    .email-body {
      padding: 32px;
      background-color: #ffffff;
    }
    .email-body p {
      margin: 0 0 16px 0;
      line-height: 1.6;
    }
    .email-body p:last-child {
      margin-bottom: 0;
    }
    .email-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 14px;
    }
    .email-body table th {
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #495057;
    }
    .email-body table td {
      border: 1px solid #e9ecef;
      padding: 12px;
      color: #495057;
    }
    .email-body table tr:nth-child(even) {
      background-color: #f8f9fa;
    }
    .email-footer {
      padding: 24px 32px;
      background-color: #f8f9fa;
      border-top: 1px solid #e9ecef;
      font-size: 13px;
      color: #6c757d;
    }
    .email-footer p {
      margin: 0 0 8px 0;
    }
    .email-footer a {
      color: ${brandColor};
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .email-body {
        padding: 20px;
      }
      .email-header {
        padding: 16px 20px;
      }
      .email-footer {
        padding: 16px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-header">
      <h1>${companyName}</h1>
    </div>
    <div class="email-body">
      ${processedBody}
    </div>
    <div class="email-footer">
      <p>This email was sent by ${companyName}.</p>
      ${companyEmail ? `<p>Questions? Reply to this email or contact us at <a href="mailto:${companyEmail}">${companyEmail}</a></p>` : ''}
      <p style="margin-top: 16px; font-size: 11px; color: #adb5bd;">
        Please do not reply to this email if it was sent from a no-reply address.
      </p>
    </div>
  </div>
</body>
</html>`;
}
