/**
 * Message Post-Processor Service
 * 
 * Ensures AI-generated email content has proper HTML formatting
 * even when the AI model returns plain text without tags.
 */

/**
 * Ensures the email body has proper <p> tags for paragraph formatting.
 * If the content already has <p> tags, returns it unchanged.
 * Otherwise, splits by double newlines and wraps each paragraph.
 */
export function ensureHtmlParagraphs(body: string): string {
  if (!body || typeof body !== 'string') {
    return body;
  }

  // Check if content already has <p> tags (case-insensitive)
  if (/<p[\s>]/i.test(body)) {
    return body;
  }

  // Preserve HTML tables - extract them first
  const tablePattern = /<table[\s\S]*?<\/table>/gi;
  const tables: string[] = [];
  let processedBody = body.replace(tablePattern, (match) => {
    tables.push(match);
    return `__TABLE_PLACEHOLDER_${tables.length - 1}__`;
  });

  // Split by double newlines (paragraph breaks) or single newlines with empty lines
  const paragraphs = processedBody
    .split(/\n\s*\n|\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // If no paragraph breaks found, try splitting by single newlines
  // but only if there are meaningful breaks
  let wrappedParagraphs: string[];
  
  if (paragraphs.length === 1 && paragraphs[0].includes('\n')) {
    // Single block with newlines - split more aggressively
    const lines = paragraphs[0]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    // Group lines that look like they belong together
    // (signature lines with <br> should stay together)
    wrappedParagraphs = lines.map(line => {
      // Check if it's a placeholder for a table
      if (line.startsWith('__TABLE_PLACEHOLDER_')) {
        return line;
      }
      // Wrap in <p> tags
      return `<p>${line}</p>`;
    });
  } else {
    // Multiple paragraphs detected
    wrappedParagraphs = paragraphs.map(para => {
      // Check if it's a placeholder for a table
      if (para.startsWith('__TABLE_PLACEHOLDER_')) {
        return para;
      }
      // Replace single newlines with <br> within paragraphs
      const withBreaks = para.replace(/\n/g, '<br>');
      return `<p>${withBreaks}</p>`;
    });
  }

  // Join with newlines for readability
  let result = wrappedParagraphs.join('\n');

  // Restore tables
  tables.forEach((table, index) => {
    result = result.replace(`__TABLE_PLACEHOLDER_${index}__`, table);
  });

  return result;
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
  cleaned = cleaned.replace(/>\s+</g, '>\n<');

  return cleaned.trim();
}

/**
 * Post-process SMS content
 * Ensures proper line breaks are preserved
 */
export function cleanSmsContent(body: string): string {
  if (!body) return body;

  // Normalize line breaks
  let cleaned = body.replace(/\\n/g, '\n');
  
  // Remove excessive whitespace while preserving intentional breaks
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}
