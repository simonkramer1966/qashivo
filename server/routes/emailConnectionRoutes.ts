import { Router } from 'express';
import { isAuthenticated } from '../auth';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getMicrosoftAuthUrl,
  handleMicrosoftCallback,
  disconnectEmail,
  refreshAccessToken,
  getEmailConnectionStatus,
  verifyOAuthState,
} from '../services/emailConnection';
import { getUnmatchedEmails, assignEmailToContact } from '../services/emailMatchingService';
import { pollTenantEmails } from '../services/emailPollingService';
import { db } from '../db';
import { inboundMessages, contacts, emailMessages } from '@shared/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';

const router = Router();

router.get('/api/email-connection/status', isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'No tenant associated with user' });
    }

    const status = await getEmailConnectionStatus(tenantId);
    res.json(status);
  } catch (error) {
    console.error('Email connection status error:', error);
    res.status(500).json({ message: 'Failed to get email connection status' });
  }
});

router.get('/api/email-connection/google/connect', isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'No tenant associated with user' });
    }

    const authUrl = getGoogleAuthUrl(tenantId);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Google connect error:', error);
    res.status(500).json({ message: 'Failed to initiate Google connection' });
  }
});

router.get('/api/email-connection/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect('/settings?tab=integrations&error=missing_params');
    }

    const tenantId = verifyOAuthState(state as string);
    await handleGoogleCallback(code as string, tenantId);
    res.redirect('/settings?tab=integrations&email_connected=true');
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect('/settings?tab=integrations&error=google_callback_failed');
  }
});

router.get('/api/email-connection/microsoft/connect', isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'No tenant associated with user' });
    }

    const authUrl = getMicrosoftAuthUrl(tenantId);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Microsoft connect error:', error);
    res.status(500).json({ message: 'Failed to initiate Microsoft connection' });
  }
});

router.get('/api/email-connection/microsoft/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect('/settings?tab=integrations&error=missing_params');
    }

    const tenantId = verifyOAuthState(state as string);
    await handleMicrosoftCallback(code as string, tenantId);
    res.redirect('/settings?tab=integrations&email_connected=true');
  } catch (error) {
    console.error('Microsoft callback error:', error);
    res.redirect('/settings?tab=integrations&error=microsoft_callback_failed');
  }
});

router.post('/api/email-connection/disconnect', isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'No tenant associated with user' });
    }

    await disconnectEmail(tenantId);
    res.json({ success: true, message: 'Email disconnected successfully' });
  } catch (error) {
    console.error('Email disconnect error:', error);
    res.status(500).json({ message: 'Failed to disconnect email' });
  }
});

router.post('/api/email-connection/test', isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'No tenant associated with user' });
    }

    await refreshAccessToken(tenantId);
    res.json({ success: true, message: 'Email connection is working' });
  } catch (error) {
    console.error('Email connection test error:', error);
    res.status(500).json({ success: false, message: 'Email connection test failed', error: (error as Error).message });
  }
});

router.get('/api/email-inbox/unmatched', isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'No tenant associated with user' });
    }

    const unmatched = await getUnmatchedEmails(tenantId);
    res.json(unmatched);
  } catch (error) {
    console.error('Get unmatched emails error:', error);
    res.status(500).json({ message: 'Failed to get unmatched emails', error: (error as Error).message });
  }
});

router.post('/api/email-inbox/assign', isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const userId = (req as any).user?.id;
    if (!tenantId) {
      return res.status(400).json({ message: 'No tenant associated with user' });
    }

    const { inboundMessageId, contactId } = req.body;
    if (!inboundMessageId || !contactId) {
      return res.status(400).json({ message: 'inboundMessageId and contactId are required' });
    }

    await assignEmailToContact(tenantId, inboundMessageId, contactId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Assign email error:', error);
    res.status(500).json({ message: 'Failed to assign email', error: (error as Error).message });
  }
});

router.post('/api/email-inbox/poll', isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'No tenant associated with user' });
    }

    const result = await pollTenantEmails(tenantId);
    res.json(result);
  } catch (error) {
    console.error('Poll emails error:', error);
    res.status(500).json({ message: 'Failed to poll emails', error: (error as Error).message });
  }
});

router.get('/api/email-inbox/messages', isAuthenticated, async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'No tenant associated with user' });
    }

    const contactId = req.query.contactId as string | undefined;

    const conditions = [eq(inboundMessages.tenantId, tenantId), isNotNull(inboundMessages.contactId)];
    if (contactId) {
      conditions.push(eq(inboundMessages.contactId!, contactId));
    }

    const messages = await db.select({
      id: inboundMessages.id,
      from: inboundMessages.from,
      to: inboundMessages.to,
      subject: inboundMessages.subject,
      content: inboundMessages.content,
      contactId: inboundMessages.contactId,
      channel: inboundMessages.channel,
      intentType: inboundMessages.intentType,
      sentiment: inboundMessages.sentiment,
      createdAt: inboundMessages.createdAt,
    })
    .from(inboundMessages)
    .where(and(...conditions))
    .orderBy(desc(inboundMessages.createdAt))
    .limit(200);

    res.json(messages);
  } catch (error) {
    console.error('Get inbox messages error:', error);
    res.status(500).json({ message: 'Failed to get inbox messages', error: (error as Error).message });
  }
});

export default router;
