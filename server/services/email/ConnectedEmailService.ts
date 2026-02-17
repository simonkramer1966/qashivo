import { db } from '../../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { refreshAccessToken } from '../emailConnection';

export interface ConnectedEmailParams {
  tenantId: string;
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  inReplyTo?: string;
  references?: string;
}

export interface ConnectedEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function isEmailConnected(tenantId: string): Promise<boolean> {
  const [tenant] = await db.select({
    emailConnectionStatus: tenants.emailConnectionStatus,
    emailProvider: tenants.emailProvider,
  }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant) return false;

  return tenant.emailConnectionStatus === 'connected' && tenant.emailProvider !== null;
}

export async function sendViaConnectedAccount(params: ConnectedEmailParams): Promise<ConnectedEmailResult> {
  const [tenant] = await db.select({
    emailProvider: tenants.emailProvider,
    emailAccessToken: tenants.emailAccessToken,
    emailConnectedAddress: tenants.emailConnectedAddress,
    emailConnectionStatus: tenants.emailConnectionStatus,
  }).from(tenants).where(eq(tenants.id, params.tenantId)).limit(1);

  if (!tenant || tenant.emailConnectionStatus !== 'connected' || !tenant.emailProvider) {
    return { success: false, error: 'No email account connected' };
  }

  try {
    await refreshAccessToken(params.tenantId);
  } catch (err: any) {
    return { success: false, error: `Failed to refresh access token: ${err.message}` };
  }

  const [freshTenant] = await db.select({
    emailProvider: tenants.emailProvider,
    emailAccessToken: tenants.emailAccessToken,
    emailConnectedAddress: tenants.emailConnectedAddress,
  }).from(tenants).where(eq(tenants.id, params.tenantId)).limit(1);

  if (!freshTenant?.emailAccessToken || !freshTenant.emailConnectedAddress) {
    return { success: false, error: 'Missing access token or connected email address' };
  }

  if (freshTenant.emailProvider === 'gmail') {
    return sendViaGmail(freshTenant.emailAccessToken, params, freshTenant.emailConnectedAddress);
  } else if (freshTenant.emailProvider === 'outlook') {
    return sendViaOutlook(freshTenant.emailAccessToken, params, freshTenant.emailConnectedAddress);
  }

  return { success: false, error: `Unsupported email provider: ${freshTenant.emailProvider}` };
}

async function sendViaGmail(accessToken: string, params: ConnectedEmailParams, fromEmail: string): Promise<ConnectedEmailResult> {
  try {
    const rawEmail = buildRawEmail({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      htmlBody: params.htmlBody,
      textBody: params.textBody,
      replyTo: params.replyTo,
      headers: params.headers,
      inReplyTo: params.inReplyTo,
      references: params.references,
    });

    const base64url = Buffer.from(rawEmail)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64url }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return { success: false, error: `Gmail API error (${response.status}): ${errorData}` };
    }

    const data = await response.json() as { id: string };

    return { success: true, messageId: data.id };
  } catch (err: any) {
    return { success: false, error: `Gmail send failed: ${err.message}` };
  }
}

async function sendViaOutlook(accessToken: string, params: ConnectedEmailParams, fromEmail: string): Promise<ConnectedEmailResult> {
  try {
    const internetMessageHeaders: Array<{ name: string; value: string }> = [];

    if (params.inReplyTo) {
      internetMessageHeaders.push({ name: 'In-Reply-To', value: params.inReplyTo });
    }
    if (params.references) {
      internetMessageHeaders.push({ name: 'References', value: params.references });
    }
    if (params.headers) {
      for (const [name, value] of Object.entries(params.headers)) {
        if (name.startsWith('X-') || name.startsWith('x-')) {
          internetMessageHeaders.push({ name, value });
        }
      }
    }

    const message: Record<string, any> = {
      subject: params.subject,
      body: {
        contentType: 'HTML',
        content: params.htmlBody,
      },
      toRecipients: [
        {
          emailAddress: { address: params.to },
        },
      ],
    };

    if (params.replyTo) {
      message.replyTo = [
        {
          emailAddress: { address: params.replyTo },
        },
      ];
    }

    if (internetMessageHeaders.length > 0) {
      message.internetMessageHeaders = internetMessageHeaders;
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        saveToSentItems: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return { success: false, error: `Outlook API error (${response.status}): ${errorData}` };
    }

    const messageId = response.headers.get('request-id') || `outlook-${Date.now()}`;

    return { success: true, messageId };
  } catch (err: any) {
    return { success: false, error: `Outlook send failed: ${err.message}` };
  }
}

function buildRawEmail(params: {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  inReplyTo?: string;
  references?: string;
}): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const lines: string[] = [];

  lines.push(`From: ${params.from}`);
  lines.push(`To: ${params.to}`);
  lines.push(`Subject: ${params.subject}`);
  lines.push('MIME-Version: 1.0');

  if (params.replyTo) {
    lines.push(`Reply-To: ${params.replyTo}`);
  }
  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`);
  }
  if (params.references) {
    lines.push(`References: ${params.references}`);
  }

  if (params.headers) {
    for (const [name, value] of Object.entries(params.headers)) {
      if (name.startsWith('X-') || name.startsWith('x-')) {
        lines.push(`${name}: ${value}`);
      }
    }
  }

  const textBody = params.textBody || params.htmlBody.replace(/<[^>]*>/g, '');

  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  lines.push('');

  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: 7bit');
  lines.push('');
  lines.push(textBody);
  lines.push('');

  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/html; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: 7bit');
  lines.push('');
  lines.push(params.htmlBody);
  lines.push('');

  lines.push(`--${boundary}--`);

  return lines.join('\r\n');
}
