import { db } from '../db';
import { tenants, inboundMessages } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { refreshAccessToken } from '../services/emailConnection';
import { matchInboundEmail } from './emailMatchingService';

export interface RawInboundEmail {
  providerMessageId: string;
  messageIdHeader?: string;
  inReplyTo?: string;
  references?: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  receivedAt: Date;
  rawHeaders?: Record<string, string>;
}

export interface PollResult {
  messagesFound: number;
  messagesProcessed: number;
  errors: string[];
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

function parseGmailParts(parts: any[]): { textBody?: string; htmlBody?: string } {
  let textBody: string | undefined;
  let htmlBody: string | undefined;

  for (const part of parts) {
    if (part.parts) {
      const nested = parseGmailParts(part.parts);
      if (nested.textBody && !textBody) textBody = nested.textBody;
      if (nested.htmlBody && !htmlBody) htmlBody = nested.htmlBody;
    }

    if (part.mimeType === 'text/plain' && part.body?.data && !textBody) {
      textBody = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }

    if (part.mimeType === 'text/html' && part.body?.data && !htmlBody) {
      htmlBody = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
  }

  return { textBody, htmlBody };
}

function getGmailHeader(headers: any[], name: string): string | undefined {
  const header = headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value;
}

function parseEmailAddress(raw: string): { email: string; name?: string } {
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { email: match[2], name: match[1].replace(/^["']|["']$/g, '').trim() || undefined };
  }
  return { email: raw.trim() };
}

async function pollGmail(accessToken: string, tenantId: string, lastSyncAt: Date | null): Promise<RawInboundEmail[]> {
  let query = 'in:inbox';
  if (lastSyncAt) {
    const unixTimestamp = Math.floor(lastSyncAt.getTime() / 1000);
    query = `after:${unixTimestamp} in:inbox`;
  }

  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&labelIds=INBOX&maxResults=50`;

  const listResponse = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResponse.ok) {
    throw new Error(`Gmail list messages failed (${listResponse.status}): ${await listResponse.text()}`);
  }

  const listData = await listResponse.json() as { messages?: Array<{ id: string }> };

  if (!listData.messages || listData.messages.length === 0) {
    return [];
  }

  const emails: RawInboundEmail[] = [];

  for (const msg of listData.messages) {
    const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;

    const msgResponse = await fetch(msgUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!msgResponse.ok) {
      continue;
    }

    const msgData = await msgResponse.json() as any;
    const headers = msgData.payload?.headers || [];

    const fromRaw = getGmailHeader(headers, 'From') || '';
    const toRaw = getGmailHeader(headers, 'To') || '';
    const subject = getGmailHeader(headers, 'Subject') || '';
    const dateStr = getGmailHeader(headers, 'Date') || '';
    const messageIdHeader = getGmailHeader(headers, 'Message-ID') || getGmailHeader(headers, 'Message-Id');
    const inReplyTo = getGmailHeader(headers, 'In-Reply-To');
    const references = getGmailHeader(headers, 'References');

    const fromParsed = parseEmailAddress(fromRaw);
    const toParsed = parseEmailAddress(toRaw);

    let textBody: string | undefined;
    let htmlBody: string | undefined;

    if (msgData.payload?.parts) {
      const parsed = parseGmailParts(msgData.payload.parts);
      textBody = parsed.textBody;
      htmlBody = parsed.htmlBody;
    } else if (msgData.payload?.body?.data) {
      const bodyContent = Buffer.from(msgData.payload.body.data, 'base64url').toString('utf-8');
      if (msgData.payload.mimeType === 'text/html') {
        htmlBody = bodyContent;
      } else {
        textBody = bodyContent;
      }
    }

    const rawHeaders: Record<string, string> = {};
    for (const h of headers) {
      rawHeaders[h.name] = h.value;
    }

    emails.push({
      providerMessageId: msg.id,
      messageIdHeader,
      inReplyTo,
      references,
      from: fromParsed.email,
      fromName: fromParsed.name,
      to: toParsed.email,
      subject,
      textBody,
      htmlBody,
      receivedAt: dateStr ? new Date(dateStr) : new Date(parseInt(msgData.internalDate)),
      rawHeaders,
    });
  }

  return emails;
}

async function pollOutlook(accessToken: string, tenantId: string, lastSyncAt: Date | null): Promise<RawInboundEmail[]> {
  let filterParam = '';
  if (lastSyncAt) {
    filterParam = `&$filter=receivedDateTime ge ${lastSyncAt.toISOString()}`;
  }

  const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$select=id,subject,from,toRecipients,body,receivedDateTime,internetMessageHeaders&$orderby=receivedDateTime desc&$top=50${filterParam}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Outlook list messages failed (${response.status}): ${await response.text()}`);
  }

  const data = await response.json() as { value?: any[] };

  if (!data.value || data.value.length === 0) {
    return [];
  }

  const emails: RawInboundEmail[] = [];

  for (const msg of data.value) {
    const fromEmail = msg.from?.emailAddress?.address || '';
    const fromName = msg.from?.emailAddress?.name;
    const toEmail = msg.toRecipients?.[0]?.emailAddress?.address || '';

    const internetHeaders = msg.internetMessageHeaders || [];
    const getHeader = (name: string): string | undefined => {
      const h = internetHeaders.find((header: any) => header.name.toLowerCase() === name.toLowerCase());
      return h?.value;
    };

    const messageIdHeader = getHeader('Message-ID') || getHeader('Message-Id');
    const inReplyTo = getHeader('In-Reply-To');
    const references = getHeader('References');

    const rawHeaders: Record<string, string> = {};
    for (const h of internetHeaders) {
      rawHeaders[h.name] = h.value;
    }

    let textBody: string | undefined;
    let htmlBody: string | undefined;

    if (msg.body?.contentType === 'html') {
      htmlBody = msg.body.content;
      textBody = msg.body.content?.replace(/<[^>]*>/g, '');
    } else if (msg.body?.contentType === 'text') {
      textBody = msg.body.content;
    }

    emails.push({
      providerMessageId: msg.id,
      messageIdHeader,
      inReplyTo,
      references,
      from: fromEmail,
      fromName,
      to: toEmail,
      subject: msg.subject || '',
      textBody,
      htmlBody,
      receivedAt: new Date(msg.receivedDateTime),
      rawHeaders,
    });
  }

  return emails;
}

async function storeInboundEmail(tenantId: string, email: RawInboundEmail): Promise<string | null> {
  const existing = await db.select({ id: inboundMessages.id })
    .from(inboundMessages)
    .where(
      and(
        eq(inboundMessages.tenantId, tenantId),
        eq(inboundMessages.providerMessageId, email.providerMessageId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return null;
  }

  if (email.messageIdHeader) {
    const existingByHeader = await db.select({ id: inboundMessages.id })
      .from(inboundMessages)
      .where(
        and(
          eq(inboundMessages.tenantId, tenantId),
          eq(inboundMessages.providerMessageId, email.messageIdHeader)
        )
      )
      .limit(1);

    if (existingByHeader.length > 0) {
      return null;
    }
  }

  const content = email.textBody || (email.htmlBody ? email.htmlBody.replace(/<[^>]*>/g, '') : '');

  const [inserted] = await db.insert(inboundMessages).values({
    tenantId,
    channel: 'email',
    from: email.from,
    to: email.to,
    subject: email.subject,
    content: content || '(no content)',
    rawPayload: {
      providerMessageId: email.providerMessageId,
      messageIdHeader: email.messageIdHeader,
      inReplyTo: email.inReplyTo,
      references: email.references,
      fromName: email.fromName,
      textBody: email.textBody,
      htmlBody: email.htmlBody,
      receivedAt: email.receivedAt.toISOString(),
      rawHeaders: email.rawHeaders,
    },
    providerMessageId: email.messageIdHeader || email.providerMessageId,
  }).returning({ id: inboundMessages.id });

  return inserted?.id || null;
}

export async function pollTenantEmails(tenantId: string): Promise<PollResult> {
  const result: PollResult = { messagesFound: 0, messagesProcessed: 0, errors: [] };

  const [tenant] = await db.select({
    emailProvider: tenants.emailProvider,
    emailConnectionStatus: tenants.emailConnectionStatus,
    emailSyncEnabled: tenants.emailSyncEnabled,
    emailAccessToken: tenants.emailAccessToken,
    emailLastSyncAt: tenants.emailLastSyncAt,
  }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant) {
    result.errors.push('Tenant not found');
    return result;
  }

  if (tenant.emailConnectionStatus !== 'connected' || !tenant.emailSyncEnabled) {
    return result;
  }

  try {
    await refreshAccessToken(tenantId);
  } catch (err: any) {
    result.errors.push(`Token refresh failed: ${err.message}`);
    return result;
  }

  const [freshTenant] = await db.select({
    emailProvider: tenants.emailProvider,
    emailAccessToken: tenants.emailAccessToken,
    emailLastSyncAt: tenants.emailLastSyncAt,
  }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!freshTenant?.emailAccessToken) {
    result.errors.push('No access token after refresh');
    return result;
  }

  let emails: RawInboundEmail[] = [];

  try {
    if (freshTenant.emailProvider === 'gmail') {
      emails = await pollGmail(freshTenant.emailAccessToken, tenantId, freshTenant.emailLastSyncAt);
    } else if (freshTenant.emailProvider === 'outlook') {
      emails = await pollOutlook(freshTenant.emailAccessToken, tenantId, freshTenant.emailLastSyncAt);
    } else {
      result.errors.push(`Unknown email provider: ${freshTenant.emailProvider}`);
      return result;
    }
  } catch (err: any) {
    result.errors.push(`Polling failed: ${err.message}`);
    return result;
  }

  result.messagesFound = emails.length;

  for (const email of emails) {
    try {
      const storedId = await storeInboundEmail(tenantId, email);
      if (storedId) {
        result.messagesProcessed++;
        try {
          await matchInboundEmail(tenantId, storedId);
        } catch (matchErr: any) {
          console.warn(`Failed to match email ${storedId}: ${matchErr.message}`);
        }
      }
    } catch (err: any) {
      result.errors.push(`Failed to store email ${email.providerMessageId}: ${err.message}`);
    }
  }

  await db.update(tenants)
    .set({ emailLastSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  return result;
}

export function startPollingLoop(): void {
  if (pollingInterval) {
    return;
  }

  const POLL_INTERVAL_MS = 5 * 60 * 1000;

  const runPoll = async () => {
    try {
      const connectedTenants = await db.select({ id: tenants.id })
        .from(tenants)
        .where(
          and(
            eq(tenants.emailSyncEnabled, true),
            eq(tenants.emailConnectionStatus, 'connected')
          )
        );

      if (connectedTenants.length === 0) {
        return;
      }

      console.log(`[EmailPolling] Polling ${connectedTenants.length} tenant(s) for new emails`);

      for (const tenant of connectedTenants) {
        try {
          const result = await pollTenantEmails(tenant.id);
          if (result.messagesFound > 0 || result.errors.length > 0) {
            console.log(`[EmailPolling] Tenant ${tenant.id}: found=${result.messagesFound}, processed=${result.messagesProcessed}, errors=${result.errors.length}`);
          }
          if (result.errors.length > 0) {
            console.error(`[EmailPolling] Tenant ${tenant.id} errors:`, result.errors);
          }
        } catch (err: any) {
          console.error(`[EmailPolling] Tenant ${tenant.id} poll failed:`, err.message);
        }
      }
    } catch (err: any) {
      console.error('[EmailPolling] Poll loop error:', err.message);
    }
  };

  runPoll();
  pollingInterval = setInterval(runPoll, POLL_INTERVAL_MS);
  console.log('[EmailPolling] Polling loop started (interval: 5 minutes)');
}

export function stopPollingLoop(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('[EmailPolling] Polling loop stopped');
  }
}
