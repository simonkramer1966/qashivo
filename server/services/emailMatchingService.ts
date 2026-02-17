import { db } from '../db';
import { inboundMessages, emailMessages, contacts, customerContactPersons, emailDomainMappings, emailSenderMappings } from '@shared/schema';
import { eq, and, like, isNull, desc, or } from 'drizzle-orm';

export interface MatchResult {
  contactId: string | null;
  matchType: 'thread' | 'email_mapping' | 'domain_mapping' | 'email_address' | 'domain' | 'unmatched';
  confidence: number;
  contactName?: string;
}

export interface UnmatchedEmail {
  id: string;
  from: string;
  subject: string | null;
  contentPreview: string;
  createdAt: Date;
}

const FREEMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'live.com', 'msn.com', 'protonmail.com', 'mail.com',
];

function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).toLowerCase().trim();
}

async function tryThreadMatch(tenantId: string, rawPayload: any): Promise<MatchResult | null> {
  const inReplyTo = rawPayload?.inReplyTo;
  const references = rawPayload?.references;

  if (!inReplyTo && !references) {
    return null;
  }

  const messageIds: string[] = [];
  if (inReplyTo) messageIds.push(inReplyTo);
  if (references) {
    const refs = references.split(/\s+/).filter(Boolean);
    messageIds.push(...refs);
  }

  for (const msgId of messageIds) {
    const results = await db.select({
      contactId: emailMessages.contactId,
    }).from(emailMessages).where(
      and(
        eq(emailMessages.tenantId, tenantId),
        or(
          eq(emailMessages.sendgridMessageId, msgId),
          eq(emailMessages.inReplyTo, msgId),
          like(emailMessages.references, `%${msgId}%`)
        )
      )
    ).limit(1);

    if (results.length > 0 && results[0].contactId) {
      const contact = await db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, results[0].contactId)).limit(1);
      return {
        contactId: results[0].contactId,
        matchType: 'thread',
        confidence: 1.0,
        contactName: contact[0]?.name,
      };
    }
  }

  return null;
}

async function tryEmailMapping(tenantId: string, senderEmail: string): Promise<MatchResult | null> {
  const results = await db.select({
    contactId: emailSenderMappings.contactId,
  }).from(emailSenderMappings).where(
    and(
      eq(emailSenderMappings.tenantId, tenantId),
      eq(emailSenderMappings.senderEmail, senderEmail)
    )
  ).limit(1);

  if (results.length > 0) {
    const contact = await db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, results[0].contactId)).limit(1);
    return {
      contactId: results[0].contactId,
      matchType: 'email_mapping',
      confidence: 1.0,
      contactName: contact[0]?.name,
    };
  }

  return null;
}

async function tryDomainMapping(tenantId: string, domain: string): Promise<MatchResult | null> {
  const results = await db.select({
    contactId: emailDomainMappings.contactId,
  }).from(emailDomainMappings).where(
    and(
      eq(emailDomainMappings.tenantId, tenantId),
      eq(emailDomainMappings.domain, domain)
    )
  ).limit(1);

  if (results.length > 0) {
    const contact = await db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, results[0].contactId)).limit(1);
    return {
      contactId: results[0].contactId,
      matchType: 'domain_mapping',
      confidence: 0.95,
      contactName: contact[0]?.name,
    };
  }

  return null;
}

async function tryDirectEmailMatch(tenantId: string, senderEmail: string): Promise<MatchResult | null> {
  const contactResults = await db.select({
    id: contacts.id,
    name: contacts.name,
  }).from(contacts).where(
    and(
      eq(contacts.tenantId, tenantId),
      eq(contacts.email, senderEmail)
    )
  );

  const personResults = await db.select({
    contactId: customerContactPersons.contactId,
  }).from(customerContactPersons).where(
    and(
      eq(customerContactPersons.tenantId, tenantId),
      eq(customerContactPersons.email, senderEmail)
    )
  );

  const matchedContactIds = new Map<string, string>();

  for (const c of contactResults) {
    matchedContactIds.set(c.id, c.name);
  }

  for (const p of personResults) {
    if (!matchedContactIds.has(p.contactId)) {
      const contact = await db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, p.contactId)).limit(1);
      matchedContactIds.set(p.contactId, contact[0]?.name || '');
    }
  }

  if (matchedContactIds.size === 1) {
    const entries = Array.from(matchedContactIds.entries());
    const contactId = entries[0][0];
    const contactName = entries[0][1];
    return {
      contactId,
      matchType: 'email_address',
      confidence: 0.9,
      contactName,
    };
  }

  if (matchedContactIds.size > 1) {
    const entries = Array.from(matchedContactIds.entries());
    const contactId = entries[0][0];
    const contactName = entries[0][1];
    return {
      contactId,
      matchType: 'email_address',
      confidence: 0.7,
      contactName,
    };
  }

  return null;
}

async function tryDomainMatch(tenantId: string, domain: string): Promise<MatchResult | null> {
  if (FREEMAIL_DOMAINS.includes(domain)) {
    return null;
  }

  const domainPattern = `%@${domain}`;

  const contactResults = await db.select({
    id: contacts.id,
    name: contacts.name,
  }).from(contacts).where(
    and(
      eq(contacts.tenantId, tenantId),
      like(contacts.email, domainPattern)
    )
  );

  const personResults = await db.select({
    contactId: customerContactPersons.contactId,
  }).from(customerContactPersons).where(
    and(
      eq(customerContactPersons.tenantId, tenantId),
      like(customerContactPersons.email, domainPattern)
    )
  );

  const matchedContactIds = new Map<string, string>();

  for (const c of contactResults) {
    matchedContactIds.set(c.id, c.name);
  }

  for (const p of personResults) {
    if (!matchedContactIds.has(p.contactId)) {
      const contact = await db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, p.contactId)).limit(1);
      matchedContactIds.set(p.contactId, contact[0]?.name || '');
    }
  }

  if (matchedContactIds.size === 1) {
    const entries = Array.from(matchedContactIds.entries());
    const contactId = entries[0][0];
    const contactName = entries[0][1];
    return {
      contactId,
      matchType: 'domain',
      confidence: 0.8,
      contactName,
    };
  }

  if (matchedContactIds.size > 1) {
    const entries = Array.from(matchedContactIds.entries());
    const contactId = entries[0][0];
    const contactName = entries[0][1];
    return {
      contactId,
      matchType: 'domain',
      confidence: 0.6,
      contactName,
    };
  }

  return null;
}

export async function matchInboundEmail(tenantId: string, inboundMessageId: string): Promise<MatchResult> {
  const [message] = await db.select().from(inboundMessages).where(
    and(
      eq(inboundMessages.id, inboundMessageId),
      eq(inboundMessages.tenantId, tenantId)
    )
  ).limit(1);

  if (!message) {
    return { contactId: null, matchType: 'unmatched', confidence: 0 };
  }

  const senderEmail = extractEmail(message.from);
  const domain = extractDomain(senderEmail);

  const threadResult = await tryThreadMatch(tenantId, message.rawPayload);
  if (threadResult) {
    await db.update(inboundMessages).set({ contactId: threadResult.contactId }).where(eq(inboundMessages.id, inboundMessageId));
    return threadResult;
  }

  const emailMappingResult = await tryEmailMapping(tenantId, senderEmail);
  if (emailMappingResult) {
    await db.update(inboundMessages).set({ contactId: emailMappingResult.contactId }).where(eq(inboundMessages.id, inboundMessageId));
    return emailMappingResult;
  }

  const domainMappingResult = await tryDomainMapping(tenantId, domain);
  if (domainMappingResult) {
    await db.update(inboundMessages).set({ contactId: domainMappingResult.contactId }).where(eq(inboundMessages.id, inboundMessageId));
    return domainMappingResult;
  }

  const directEmailResult = await tryDirectEmailMatch(tenantId, senderEmail);
  if (directEmailResult) {
    await db.update(inboundMessages).set({ contactId: directEmailResult.contactId }).where(eq(inboundMessages.id, inboundMessageId));
    return directEmailResult;
  }

  const domainResult = await tryDomainMatch(tenantId, domain);
  if (domainResult) {
    await db.update(inboundMessages).set({ contactId: domainResult.contactId }).where(eq(inboundMessages.id, inboundMessageId));

    if (domainResult.matchType === 'domain' && domainResult.confidence >= 0.8 && domainResult.contactId) {
      try {
        await db.insert(emailDomainMappings).values({
          tenantId,
          domain,
          contactId: domainResult.contactId,
          isAutoMatched: true,
        }).onConflictDoNothing();
      } catch (_) {}
    }

    return domainResult;
  }

  return { contactId: null, matchType: 'unmatched', confidence: 0 };
}

export async function assignEmailToContact(tenantId: string, inboundMessageId: string, contactId: string, userId: string): Promise<void> {
  const [message] = await db.select().from(inboundMessages).where(
    and(
      eq(inboundMessages.id, inboundMessageId),
      eq(inboundMessages.tenantId, tenantId)
    )
  ).limit(1);

  if (!message) {
    return;
  }

  await db.update(inboundMessages).set({ contactId }).where(eq(inboundMessages.id, inboundMessageId));

  const senderEmail = extractEmail(message.from);
  const domain = extractDomain(senderEmail);

  try {
    await db.insert(emailSenderMappings).values({
      tenantId,
      senderEmail,
      contactId,
      createdByUserId: userId,
    }).onConflictDoNothing();
  } catch (_) {}

  if (domain && !FREEMAIL_DOMAINS.includes(domain)) {
    try {
      await db.insert(emailDomainMappings).values({
        tenantId,
        domain,
        contactId,
        createdByUserId: userId,
        isAutoMatched: false,
      }).onConflictDoNothing();
    } catch (_) {}
  }
}

export async function getUnmatchedEmails(tenantId: string): Promise<UnmatchedEmail[]> {
  const results = await db.select({
    id: inboundMessages.id,
    from: inboundMessages.from,
    subject: inboundMessages.subject,
    content: inboundMessages.content,
    createdAt: inboundMessages.createdAt,
  }).from(inboundMessages).where(
    and(
      eq(inboundMessages.tenantId, tenantId),
      isNull(inboundMessages.contactId),
      eq(inboundMessages.channel, 'email')
    )
  ).orderBy(desc(inboundMessages.createdAt)).limit(100);

  return results.map((r) => ({
    id: r.id,
    from: r.from,
    subject: r.subject,
    contentPreview: (r.content || '').substring(0, 200),
    createdAt: r.createdAt!,
  }));
}
