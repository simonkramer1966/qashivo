/**
 * Email Formatter — converts LLM plain text output to clean HTML email.
 *
 * The LLM generates well-structured plain text with \n line breaks.
 * Email clients ignore \n in HTML, so we must convert to proper HTML
 * before sending via SendGrid or connected email.
 *
 * Rules:
 *  - Double line breaks (\n\n) → paragraph boundary
 *  - Single line breaks (\n) → <br>
 *  - Lines starting with • or - (bullet) → <ul><li> list
 *  - No Qashivo branding (Critical Rule 6: debtor must believe agent is human)
 */

/**
 * Convert plain text email body to clean HTML wrapped in an email template.
 * If the body already contains HTML block elements, it is returned as-is
 * (wrapped in the outer template only).
 */
export function formatEmailHtml(body: string): string {
  // If the body already has block-level HTML, skip conversion but still wrap.
  // We must still inject margin styles into bare <p> tags — the LLM often
  // forgets inline styles and email clients (Gmail, Outlook, Apple Mail) strip
  // <style> blocks, leaving paragraphs flush against each other.
  if (/<(?:p|div|table|ul|ol|h[1-6])\b/i.test(body)) {
    return wrapInTemplate(injectParagraphSpacing(body));
  }

  const html = textToHtml(body);
  return wrapInTemplate(html);
}

/**
 * Inject inline margin into bare <p> tags from LLM-generated HTML.
 * Preserves any existing style attribute by appending margin only when absent.
 * Email clients strip <style> blocks, so margins MUST be inline.
 */
function injectParagraphSpacing(html: string): string {
  return html.replace(/<p(\s[^>]*)?>/gi, (match, attrs) => {
    const attrString = attrs || '';
    // If a style attribute already exists, only append margin if not set
    const styleMatch = attrString.match(/style\s*=\s*"([^"]*)"/i);
    if (styleMatch) {
      const styleValue = styleMatch[1];
      if (/margin\s*:/i.test(styleValue) || /margin-bottom\s*:/i.test(styleValue)) {
        return match; // already has margin — leave alone
      }
      const newStyle = styleValue.trim().replace(/;?\s*$/, '') + ';margin:0 0 12px 0;';
      const newAttrs = attrString.replace(/style\s*=\s*"[^"]*"/i, `style="${newStyle}"`);
      return `<p${newAttrs}>`;
    }
    // No style attribute — add one
    return `<p${attrString} style="margin:0 0 12px 0;">`;
  });
}

/**
 * Convert plain text with \n to semantic HTML paragraphs, line breaks, and lists.
 */
function textToHtml(text: string): string {
  // Normalise line endings
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into paragraph blocks (double newline)
  const blocks = normalised.split(/\n{2,}/);

  const htmlBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n');

    // Check if this block is a list (all lines start with bullet marker)
    const isList = lines.every(l => /^\s*[•\-–]\s/.test(l));

    if (isList) {
      const items = lines.map(l => {
        const content = l.replace(/^\s*[•\-–]\s*/, '').trim();
        return `  <li style="margin-bottom:4px;">${escapeHtml(content)}</li>`;
      });
      htmlBlocks.push(`<ul style="margin:0 0 16px 0;padding-left:20px;">\n${items.join('\n')}\n</ul>`);
    } else {
      // Regular paragraph — convert single \n to <br>
      const paragraphHtml = lines
        .map(l => escapeHtml(l.trim()))
        .join('<br>\n');
      htmlBlocks.push(`<p style="margin:0 0 16px 0;">${paragraphHtml}</p>`);
    }
  }

  return htmlBlocks.join('\n');
}

/**
 * Wrap converted HTML in a clean, professional email template.
 * No branding — the debtor must believe the email is from a human agent.
 */
function wrapInTemplate(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Email</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="padding:32px 36px;">
${innerHtml}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
