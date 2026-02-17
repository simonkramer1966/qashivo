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
} from '../services/emailConnection';

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

    const tenantId = decodeURIComponent(state as string);
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

    const tenantId = decodeURIComponent(state as string);
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

export default router;
