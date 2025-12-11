import { db } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
import { actions, messageDrafts, contacts, invoices, tenants } from '@shared/schema';
import { aiMessageGenerator, MessageContext, ToneSettings } from './aiMessageGenerator';
import { ToneProfile, PlaybookStage } from './playbookEngine';
import crypto from 'crypto';

export class MessagePreGenerationService {
  
  /**
   * Pre-generate message drafts for all pending actions scheduled for today
   * This runs after the daily plan is created (typically at 2am)
   */
  async preGenerateForTenant(tenantId: string): Promise<{ generated: number; failed: number; skipped: number }> {
    console.log(`🔄 Pre-generating message drafts for tenant: ${tenantId}`);
    
    const stats = { generated: 0, failed: 0, skipped: 0 };
    
    try {
      const pendingActions = await db.select()
        .from(actions)
        .where(and(
          eq(actions.tenantId, tenantId),
          inArray(actions.status, ['pending', 'pending_approval', 'scheduled']),
          inArray(actions.type, ['email', 'sms', 'voice', 'call'])
        ));

      console.log(`Found ${pendingActions.length} pending communication actions`);

      for (const action of pendingActions) {
        try {
          const result = await this.preGenerateForAction(action);
          if (result === 'generated') stats.generated++;
          else if (result === 'skipped') stats.skipped++;
          else if (result === 'failed') stats.failed++;
        } catch (error: any) {
          console.error(`Failed to pre-generate for action ${action.id}:`, error.message);
          stats.failed++;
        }
      }

      console.log(`✅ Pre-generation complete for tenant ${tenantId}: ${stats.generated} generated, ${stats.skipped} skipped, ${stats.failed} failed`);
      return stats;
    } catch (error: any) {
      console.error(`Pre-generation failed for tenant ${tenantId}:`, error.message);
      throw error;
    }
  }

  /**
   * Pre-generate draft for a single action
   */
  async preGenerateForAction(action: any): Promise<'generated' | 'skipped' | 'failed'> {
    const channel = this.normalizeChannel(action.type);
    if (!channel) return 'skipped';

    const [contact] = action.contactId 
      ? await db.select().from(contacts).where(eq(contacts.id, action.contactId))
      : [];
    
    const [invoice] = action.invoiceId
      ? await db.select().from(invoices).where(eq(invoices.id, action.invoiceId))
      : [];
    
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, action.tenantId));

    if (!contact || !tenant) {
      console.log(`Skipping action ${action.id} - missing contact or tenant`);
      return 'skipped';
    }

    const messageContext = this.buildMessageContext(action, contact, invoice, tenant);
    const toneSettings = this.buildToneSettings(action);
    const contextHash = this.computeContextHash(action, messageContext, toneSettings);

    // Check for existing draft for this specific action+channel combination
    const existingDraft = await db.select()
      .from(messageDrafts)
      .where(and(
        eq(messageDrafts.actionId, action.id),
        eq(messageDrafts.channel, channel)
      ));

    if (existingDraft.length > 0) {
      const draft = existingDraft[0];
      if (draft.contextHash === contextHash && draft.status === 'generated') {
        return 'skipped';
      }
      if (draft.contextHash !== contextHash) {
        await db.update(messageDrafts)
          .set({ status: 'stale', updatedAt: new Date() })
          .where(eq(messageDrafts.id, draft.id));
      }
    }

    try {
      let generatedContent: { subject?: string; body?: string; voiceScript?: string; callToAction?: string };
      
      switch (channel) {
        case 'email':
          generatedContent = await aiMessageGenerator.generateEmail(messageContext, toneSettings);
          break;
        case 'sms':
          generatedContent = await aiMessageGenerator.generateSMS(messageContext, toneSettings);
          break;
        case 'voice':
          generatedContent = await aiMessageGenerator.generateVoiceScript(messageContext, toneSettings);
          break;
        default:
          return 'skipped';
      }

      if (existingDraft.length > 0) {
        await db.update(messageDrafts)
          .set({
            subject: generatedContent.subject,
            body: generatedContent.body,
            voiceScript: generatedContent.voiceScript,
            callToAction: generatedContent.callToAction,
            contextHash,
            status: 'generated',
            generatedAt: new Date(),
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(messageDrafts.id, existingDraft[0].id));
      } else {
        await db.insert(messageDrafts).values({
          actionId: action.id,
          tenantId: action.tenantId,
          channel,
          subject: generatedContent.subject,
          body: generatedContent.body,
          voiceScript: generatedContent.voiceScript,
          callToAction: generatedContent.callToAction,
          contextHash,
          status: 'generated',
          generatedAt: new Date(),
        });
      }

      return 'generated';
    } catch (error: any) {
      console.error(`AI generation failed for action ${action.id}:`, error.message);
      
      if (existingDraft.length > 0) {
        await db.update(messageDrafts)
          .set({ status: 'failed', errorMessage: error.message, updatedAt: new Date() })
          .where(eq(messageDrafts.id, existingDraft[0].id));
      } else {
        await db.insert(messageDrafts).values({
          actionId: action.id,
          tenantId: action.tenantId,
          channel,
          contextHash,
          status: 'failed',
          errorMessage: error.message,
        });
      }

      return 'failed';
    }
  }

  /**
   * Get a fresh draft for an action by channel, checking if context has changed
   */
  async getDraftForAction(
    actionId: string,
    channel: 'email' | 'sms' | 'voice',
    currentContext: MessageContext,
    currentToneSettings: ToneSettings
  ): Promise<{ draft: any | null; contextChanged: boolean }> {
    const currentHash = this.computeContextHashForLookup(currentContext, currentToneSettings);
    
    const [existingDraft] = await db.select()
      .from(messageDrafts)
      .where(and(
        eq(messageDrafts.actionId, actionId),
        eq(messageDrafts.channel, channel)
      ));

    if (!existingDraft) {
      return { draft: null, contextChanged: false };
    }

    // Compare context hash - if customer situation has changed, mark draft as stale
    if (existingDraft.contextHash !== currentHash) {
      await db.update(messageDrafts)
        .set({ status: 'stale', updatedAt: new Date() })
        .where(eq(messageDrafts.id, existingDraft.id));
      return { draft: null, contextChanged: true };
    }

    if (existingDraft.status === 'generated') {
      return { draft: existingDraft, contextChanged: false };
    }

    return { draft: null, contextChanged: false };
  }

  /**
   * Mark a draft as used when successfully sent
   */
  async markDraftUsed(actionId: string): Promise<void> {
    await db.update(messageDrafts)
      .set({ status: 'used', usedAt: new Date(), updatedAt: new Date() })
      .where(eq(messageDrafts.actionId, actionId));
  }

  /**
   * Invalidate all drafts for a contact (when their situation changes)
   */
  async invalidateDraftsForContact(contactId: string): Promise<number> {
    const contactActions = await db.select({ id: actions.id })
      .from(actions)
      .where(and(
        eq(actions.contactId, contactId),
        inArray(actions.status, ['pending', 'pending_approval', 'scheduled'])
      ));

    if (contactActions.length === 0) return 0;

    const actionIds = contactActions.map(a => a.id);
    
    const result = await db.update(messageDrafts)
      .set({ status: 'stale', updatedAt: new Date() })
      .where(and(
        inArray(messageDrafts.actionId, actionIds),
        eq(messageDrafts.status, 'generated')
      ));

    return contactActions.length;
  }

  private normalizeChannel(actionType: string): 'email' | 'sms' | 'voice' | null {
    switch (actionType.toLowerCase()) {
      case 'email': return 'email';
      case 'sms': return 'sms';
      case 'voice':
      case 'call': return 'voice';
      default: return null;
    }
  }

  private buildMessageContext(action: any, contact: any, invoice: any, tenant: any): MessageContext {
    const daysOverdue = invoice?.dueDate 
      ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      : action.metadata?.daysOverdue || 0;

    return {
      customerName: contact.name || 'Customer',
      companyName: contact.companyName || contact.name,
      invoiceNumber: invoice?.invoiceNumber || action.metadata?.invoiceNumber || 'N/A',
      invoiceAmount: this.parseAmount(invoice?.amount ?? action.metadata?.amount ?? 0),
      currency: '£',
      dueDate: invoice?.dueDate ? new Date(invoice.dueDate) : new Date(),
      daysOverdue,
      totalOutstanding: action.metadata?.totalOutstanding,
      invoiceCount: action.metadata?.invoiceCount,
      previousContactCount: action.metadata?.previousContactCount,
      lastContactDate: action.metadata?.lastContactDate ? new Date(action.metadata.lastContactDate) : undefined,
      lastContactChannel: action.metadata?.lastContactChannel,
      hasPromiseToPay: action.metadata?.hasPromiseToPay,
      promiseToPayDate: action.metadata?.promiseToPayDate ? new Date(action.metadata.promiseToPayDate) : undefined,
      promiseToPayMissed: action.metadata?.promiseToPayMissed,
      isHighValue: action.metadata?.isHighValue,
      isVip: action.metadata?.isVip,
      hasDispute: action.metadata?.hasDispute,
      tenantName: tenant.name || 'Accounts Team',
      tenantPhone: tenant.phone,
      tenantEmail: tenant.email,
      paymentLink: action.metadata?.paymentLink,
    };
  }

  private buildToneSettings(action: any): ToneSettings {
    return {
      stage: (action.metadata?.stage || 'CREDIT_CONTROL') as PlaybookStage,
      toneProfile: (action.metadata?.toneProfile || 'CREDIT_CONTROL_FRIENDLY') as ToneProfile,
      reasonCode: action.metadata?.reasonCode,
      templateId: action.metadata?.templateId,
      tenantStyle: action.metadata?.tenantStyle,
      useLatePaymentLegislation: action.metadata?.useLatePaymentLegislation,
    };
  }

  private parseAmount(value: any): number {
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Compute a hash of the context to detect changes
   * Includes action metadata to detect manual edits and approval changes
   */
  private computeContextHash(action: any, context: MessageContext, toneSettings: ToneSettings): string {
    const contextSnapshot = {
      // Customer context
      customerName: context.customerName,
      companyName: context.companyName,
      invoiceNumber: context.invoiceNumber,
      invoiceAmount: context.invoiceAmount,
      daysOverdue: context.daysOverdue,
      hasPromiseToPay: context.hasPromiseToPay,
      promiseToPayMissed: context.promiseToPayMissed,
      hasDispute: context.hasDispute,
      previousContactCount: context.previousContactCount,
      isVip: context.isVip,
      isHighValue: context.isHighValue,
      
      // Tone settings
      stage: toneSettings.stage,
      toneProfile: toneSettings.toneProfile,
      tenantStyle: toneSettings.tenantStyle,
      useLatePaymentLegislation: toneSettings.useLatePaymentLegislation,
      
      // Action-specific (detect manual edits)
      manualContent: action.content || null,
      manualSubject: action.subject || null,
      status: action.status,
    };

    const jsonStr = JSON.stringify(contextSnapshot);
    return crypto.createHash('md5').update(jsonStr).digest('hex');
  }

  /**
   * Compute context hash for external callers (actionExecutor)
   * who don't have the full action object available
   */
  computeContextHashForLookup(context: MessageContext, toneSettings: ToneSettings): string {
    const contextSnapshot = {
      customerName: context.customerName,
      companyName: context.companyName,
      invoiceNumber: context.invoiceNumber,
      invoiceAmount: context.invoiceAmount,
      daysOverdue: context.daysOverdue,
      hasPromiseToPay: context.hasPromiseToPay,
      promiseToPayMissed: context.promiseToPayMissed,
      hasDispute: context.hasDispute,
      previousContactCount: context.previousContactCount,
      isVip: context.isVip,
      isHighValue: context.isHighValue,
      stage: toneSettings.stage,
      toneProfile: toneSettings.toneProfile,
      tenantStyle: toneSettings.tenantStyle,
      useLatePaymentLegislation: toneSettings.useLatePaymentLegislation,
      manualContent: null,
      manualSubject: null,
      status: null,
    };
    const jsonStr = JSON.stringify(contextSnapshot);
    return crypto.createHash('md5').update(jsonStr).digest('hex');
  }
}

export const messagePreGenerator = new MessagePreGenerationService();
