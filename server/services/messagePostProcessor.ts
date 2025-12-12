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
 * Ensures proper line breaks are preserved
 */
export function cleanSmsContent(body: string): string {
  if (!body) return body;

  // Normalize line breaks (handle escaped \n from JSON)
  let cleaned = body.replace(/\\n/g, '\n');
  
  // Remove excessive whitespace while preserving intentional breaks
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}
