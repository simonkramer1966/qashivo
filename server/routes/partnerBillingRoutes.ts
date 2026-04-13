import type { Express, Request, Response } from 'express';
import { isAuthenticated } from '../auth';
import { db } from '../db';
import { partnerInvoices } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import {
  getOrCreateBillingConfig, updateBillingConfig,
  getClientBillingList, setClientTier, setClientRetailPrice,
  pauseClientBilling, resumeClientBilling, cancelClientBilling,
  startClientTrial, ensureClientBillingForAllLinks,
  getBillingSnapshot, getRevenueTimeSeries, getRevenueEvents,
  TIER_WHOLESALE_PENCE, TIER_LABELS,
} from '../services/partnerBillingService';
import { generatePartnerInvoice } from '../services/partnerInvoicePdfGenerator';

// ── Validation Schemas ────────────────────────────────────────────────────────

const updateConfigSchema = z.object({
  defaultTier: z.enum(['qollect', 'qollect_pro', 'qollect_qapital']).optional(),
  billingContactName: z.string().max(200).optional(),
  billingContactEmail: z.string().email().optional().nullable(),
  billingAddressLine1: z.string().max(200).optional().nullable(),
  billingAddressLine2: z.string().max(200).optional().nullable(),
  billingCity: z.string().max(100).optional().nullable(),
  billingPostalCode: z.string().max(20).optional().nullable(),
  billingCountry: z.string().max(10).optional(),
  companyRegistrationNumber: z.string().max(50).optional().nullable(),
  vatNumber: z.string().max(50).optional().nullable(),
  paymentMethod: z.enum(['invoice', 'stripe']).optional(),
  paymentTermsDays: z.number().int().min(1).max(90).optional(),
  invoicePrefix: z.string().max(10).regex(/^[A-Z0-9]+$/).optional(),
});

const setTierSchema = z.object({
  tier: z.enum(['qollect', 'qollect_pro', 'qollect_qapital']),
});

const setRetailPriceSchema = z.object({
  retailPricePence: z.number().int().min(0),
});

const trialSchema = z.object({
  trialDays: z.number().int().min(1).max(365),
});

// ── Helper ────────────────────────────────────────────────────────────────────

function getPartnerUser(req: Request): { partnerId: string; userId: string; isAdmin: boolean } | null {
  const user = req.user as any;
  if (!user?.partnerId) return null;
  return {
    partnerId: user.partnerId,
    userId: user.id,
    isAdmin: user.role === 'partner',
  };
}

function requireAdmin(res: Response, pu: { isAdmin: boolean }): boolean {
  if (!pu.isAdmin) {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function registerPartnerBillingRoutes(app: Express) {

  // GET /api/partner/billing/config
  app.get('/api/partner/billing/config', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });

      const config = await getOrCreateBillingConfig(pu.partnerId);
      // Also ensure billing rows exist for all linked clients
      const created = await ensureClientBillingForAllLinks(pu.partnerId);
      if (created > 0) console.log(`[partnerBilling] Created ${created} missing billing rows for partner ${pu.partnerId}`);

      res.json({ config, tierLabels: TIER_LABELS, tierPrices: TIER_WHOLESALE_PENCE });
    } catch (error) {
      console.error('GET /api/partner/billing/config error:', error);
      res.status(500).json({ message: 'Failed to load billing config' });
    }
  });

  // PUT /api/partner/billing/config
  app.put('/api/partner/billing/config', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });
      if (!requireAdmin(res, pu)) return;

      const parsed = updateConfigSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });

      const config = await updateBillingConfig(pu.partnerId, parsed.data, pu.userId);
      res.json({ config });
    } catch (error) {
      console.error('PUT /api/partner/billing/config error:', error);
      res.status(500).json({ message: 'Failed to update billing config' });
    }
  });

  // GET /api/partner/billing/clients
  app.get('/api/partner/billing/clients', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });

      await ensureClientBillingForAllLinks(pu.partnerId);
      const clients = await getClientBillingList(pu.partnerId);
      res.json({ clients });
    } catch (error) {
      console.error('GET /api/partner/billing/clients error:', error);
      res.status(500).json({ message: 'Failed to load client billing' });
    }
  });

  // PUT /api/partner/billing/clients/:tenantId/tier
  app.put('/api/partner/billing/clients/:tenantId/tier', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });
      if (!requireAdmin(res, pu)) return;

      const parsed = setTierSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });

      const result = await setClientTier(pu.partnerId, req.params.tenantId, parsed.data.tier, pu.userId);
      res.json({ billing: result });
    } catch (error) {
      console.error('PUT /api/partner/billing/clients/:tenantId/tier error:', error);
      res.status(500).json({ message: 'Failed to update tier' });
    }
  });

  // PUT /api/partner/billing/clients/:tenantId/retail-price
  app.put('/api/partner/billing/clients/:tenantId/retail-price', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });
      if (!requireAdmin(res, pu)) return;

      const parsed = setRetailPriceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });

      const result = await setClientRetailPrice(pu.partnerId, req.params.tenantId, parsed.data.retailPricePence, pu.userId);
      res.json({ billing: result });
    } catch (error) {
      console.error('PUT retail-price error:', error);
      res.status(500).json({ message: 'Failed to update retail price' });
    }
  });

  // POST /api/partner/billing/clients/:tenantId/pause
  app.post('/api/partner/billing/clients/:tenantId/pause', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });
      if (!requireAdmin(res, pu)) return;

      const result = await pauseClientBilling(pu.partnerId, req.params.tenantId, pu.userId);
      res.json({ billing: result });
    } catch (error) {
      console.error('POST pause error:', error);
      res.status(500).json({ message: 'Failed to pause billing' });
    }
  });

  // POST /api/partner/billing/clients/:tenantId/resume
  app.post('/api/partner/billing/clients/:tenantId/resume', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });
      if (!requireAdmin(res, pu)) return;

      const result = await resumeClientBilling(pu.partnerId, req.params.tenantId, pu.userId);
      res.json({ billing: result });
    } catch (error) {
      console.error('POST resume error:', error);
      res.status(500).json({ message: 'Failed to resume billing' });
    }
  });

  // POST /api/partner/billing/clients/:tenantId/cancel
  app.post('/api/partner/billing/clients/:tenantId/cancel', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });
      if (!requireAdmin(res, pu)) return;

      const result = await cancelClientBilling(pu.partnerId, req.params.tenantId, pu.userId);
      res.json({ billing: result });
    } catch (error) {
      console.error('POST cancel error:', error);
      res.status(500).json({ message: 'Failed to cancel billing' });
    }
  });

  // POST /api/partner/billing/clients/:tenantId/trial
  app.post('/api/partner/billing/clients/:tenantId/trial', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });
      if (!requireAdmin(res, pu)) return;

      const parsed = trialSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });

      const result = await startClientTrial(pu.partnerId, req.params.tenantId, parsed.data.trialDays, pu.userId);
      res.json({ billing: result });
    } catch (error) {
      console.error('POST trial error:', error);
      res.status(500).json({ message: 'Failed to start trial' });
    }
  });

  // GET /api/partner/billing/invoices
  app.get('/api/partner/billing/invoices', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });

      const invoices = await db
        .select({
          id: partnerInvoices.id,
          invoiceNumber: partnerInvoices.invoiceNumber,
          periodStart: partnerInvoices.periodStart,
          periodEnd: partnerInvoices.periodEnd,
          subtotalPence: partnerInvoices.subtotalPence,
          discountPence: partnerInvoices.discountPence,
          vatPence: partnerInvoices.vatPence,
          totalPence: partnerInvoices.totalPence,
          currency: partnerInvoices.currency,
          status: partnerInvoices.status,
          lineItems: partnerInvoices.lineItems,
          sentAt: partnerInvoices.sentAt,
          paidAt: partnerInvoices.paidAt,
          dueDate: partnerInvoices.dueDate,
          createdAt: partnerInvoices.createdAt,
        })
        .from(partnerInvoices)
        .where(eq(partnerInvoices.partnerId, pu.partnerId))
        .orderBy(desc(partnerInvoices.createdAt));

      res.json({ invoices });
    } catch (error) {
      console.error('GET /api/partner/billing/invoices error:', error);
      res.status(500).json({ message: 'Failed to load invoices' });
    }
  });

  // GET /api/partner/billing/invoices/:id/pdf
  app.get('/api/partner/billing/invoices/:id/pdf', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });

      const [invoice] = await db
        .select({ pdfData: partnerInvoices.pdfData, invoiceNumber: partnerInvoices.invoiceNumber, partnerId: partnerInvoices.partnerId })
        .from(partnerInvoices)
        .where(eq(partnerInvoices.id, req.params.id))
        .limit(1);

      if (!invoice || invoice.partnerId !== pu.partnerId) {
        return res.status(404).json({ message: 'Invoice not found' });
      }

      if (!invoice.pdfData) {
        return res.status(404).json({ message: 'PDF not available' });
      }

      const pdfBuffer = Buffer.from(invoice.pdfData, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('GET /api/partner/billing/invoices/:id/pdf error:', error);
      res.status(500).json({ message: 'Failed to download invoice' });
    }
  });

  // POST /api/partner/billing/invoices/generate — manual invoice generation (admin)
  app.post('/api/partner/billing/invoices/generate', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });
      if (!requireAdmin(res, pu)) return;

      const { periodStart, periodEnd } = req.body;
      const start = periodStart ? new Date(periodStart) : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
      const end = periodEnd ? new Date(periodEnd) : new Date(new Date().getFullYear(), new Date().getMonth(), 0);

      const result = await generatePartnerInvoice(pu.partnerId, start, end);
      res.json(result);
    } catch (error) {
      console.error('POST /api/partner/billing/invoices/generate error:', error);
      res.status(500).json({ message: 'Failed to generate invoice' });
    }
  });

  // GET /api/partner/billing/revenue
  app.get('/api/partner/billing/revenue', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });

      const [snapshot, timeSeries] = await Promise.all([
        getBillingSnapshot(pu.partnerId),
        getRevenueTimeSeries(pu.partnerId, 12),
      ]);

      res.json({ snapshot, timeSeries });
    } catch (error) {
      console.error('GET /api/partner/billing/revenue error:', error);
      res.status(500).json({ message: 'Failed to load revenue data' });
    }
  });

  // GET /api/partner/billing/events
  app.get('/api/partner/billing/events', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pu = getPartnerUser(req);
      if (!pu) return res.status(403).json({ message: 'Not a partner user' });

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const events = await getRevenueEvents(pu.partnerId, limit, offset);
      res.json({ events });
    } catch (error) {
      console.error('GET /api/partner/billing/events error:', error);
      res.status(500).json({ message: 'Failed to load events' });
    }
  });
}
