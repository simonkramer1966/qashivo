import { db } from '../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const OAUTH_STATE_SECRET = process.env.SESSION_SECRET || process.env.REPL_ID || 'fallback-oauth-state-secret';

export function generateOAuthState(tenantId: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${tenantId}:${nonce}`;
  const hmac = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

export function verifyOAuthState(state: string): string {
  const decoded = Buffer.from(state, 'base64url').toString();
  const parts = decoded.split(':');
  if (parts.length < 3) {
    throw new Error('Invalid OAuth state format');
  }
  const hmac = parts.pop()!;
  const payload = parts.join(':');
  const tenantId = parts[0];
  const expectedHmac = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
    throw new Error('Invalid OAuth state signature');
  }
  return tenantId;
}

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/Mail.Send',
];

function getBaseUrl(requestHost?: string, forwardedHost?: string, forwardedProto?: string): string {
  const host = forwardedHost || requestHost;
  if (host) {
    const cleanHost = host.split(',')[0].trim();
    const protocol = forwardedProto?.split(',')[0]?.trim() || (cleanHost.includes('localhost') ? 'http' : 'https');
    console.log(`[EmailConnection] getBaseUrl: requestHost=${requestHost}, forwardedHost=${forwardedHost}, proto=${protocol}, using=${cleanHost}`);
    return `${protocol}://${cleanHost}`;
  }
  return process.env.APP_URL || 'https://qashivo.replit.app';
}

export function getGoogleAuthUrl(tenantId: string, requestHost?: string, forwardedHost?: string, forwardedProto?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const redirectUri = `${getBaseUrl(requestHost, forwardedHost, forwardedProto)}/api/email-connection/google/callback`;
  const state = generateOAuthState(tenantId);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleGoogleCallback(code: string, tenantId: string, requestHost?: string, forwardedHost?: string, forwardedProto?: string): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured');
  }

  const redirectUri = `${getBaseUrl(requestHost, forwardedHost, forwardedProto)}/api/email-connection/google/callback`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    throw new Error(`Failed to exchange Google auth code: ${errorData}`);
  }

  const tokenData = await tokenResponse.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userInfoResponse.ok) {
    throw new Error('Failed to fetch Google user info');
  }

  const userInfo = await userInfoResponse.json() as { email: string };

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  await db.update(tenants)
    .set({
      emailProvider: 'gmail',
      emailConnectedAddress: userInfo.email,
      emailAccessToken: tokenData.access_token,
      emailRefreshToken: tokenData.refresh_token || null,
      emailTokenExpiresAt: expiresAt,
      emailConnectionStatus: 'connected',
      emailSyncEnabled: true,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));
}

export function getMicrosoftAuthUrl(tenantId: string, requestHost?: string, forwardedHost?: string, forwardedProto?: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID is not configured');
  }

  const redirectUri = `${getBaseUrl(requestHost, forwardedHost, forwardedProto)}/api/email-connection/microsoft/callback`;
  const state = generateOAuthState(tenantId);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: MICROSOFT_SCOPES.join(' '),
    state,
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function handleMicrosoftCallback(code: string, tenantId: string, requestHost?: string, forwardedHost?: string, forwardedProto?: string): Promise<void> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials are not configured');
  }

  const redirectUri = `${getBaseUrl(requestHost, forwardedHost, forwardedProto)}/api/email-connection/microsoft/callback`;

  const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    throw new Error(`Failed to exchange Microsoft auth code: ${errorData}`);
  }

  const tokenData = await tokenResponse.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userInfoResponse.ok) {
    throw new Error('Failed to fetch Microsoft user info');
  }

  const userInfo = await userInfoResponse.json() as { mail?: string; userPrincipalName?: string };
  const email = userInfo.mail || userInfo.userPrincipalName || '';

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  await db.update(tenants)
    .set({
      emailProvider: 'outlook',
      emailConnectedAddress: email,
      emailAccessToken: tokenData.access_token,
      emailRefreshToken: tokenData.refresh_token || null,
      emailTokenExpiresAt: expiresAt,
      emailConnectionStatus: 'connected',
      emailSyncEnabled: true,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));
}

export async function refreshAccessToken(tenantId: string): Promise<void> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant || !tenant.emailRefreshToken || !tenant.emailProvider) {
    throw new Error('No email connection found for this tenant');
  }

  if (tenant.emailTokenExpiresAt && new Date(tenant.emailTokenExpiresAt) > new Date(Date.now() + 5 * 60 * 1000)) {
    return;
  }

  if (tenant.emailProvider === 'gmail') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials are not configured');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tenant.emailRefreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to refresh Google token: ${errorData}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await db.update(tenants)
      .set({
        emailAccessToken: data.access_token,
        emailTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));
  } else if (tenant.emailProvider === 'outlook') {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth credentials are not configured');
    }

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tenant.emailRefreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to refresh Microsoft token: ${errorData}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await db.update(tenants)
      .set({
        emailAccessToken: data.access_token,
        emailTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));
  }
}

export async function disconnectEmail(tenantId: string): Promise<void> {
  await db.update(tenants)
    .set({
      emailProvider: null,
      emailConnectedAddress: null,
      emailAccessToken: null,
      emailRefreshToken: null,
      emailTokenExpiresAt: null,
      emailConnectionStatus: 'disconnected',
      emailSyncEnabled: false,
      emailLastSyncAt: null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));
}

export async function getEmailConnectionStatus(tenantId: string) {
  const [tenant] = await db.select({
    emailProvider: tenants.emailProvider,
    emailConnectedAddress: tenants.emailConnectedAddress,
    emailConnectionStatus: tenants.emailConnectionStatus,
    emailLastSyncAt: tenants.emailLastSyncAt,
    emailSyncEnabled: tenants.emailSyncEnabled,
  }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  return {
    provider: tenant.emailProvider,
    email: tenant.emailConnectedAddress,
    status: tenant.emailConnectionStatus,
    lastSync: tenant.emailLastSyncAt,
    syncEnabled: tenant.emailSyncEnabled,
  };
}
