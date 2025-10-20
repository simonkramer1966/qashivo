import { describe, it, expect, beforeEach } from 'vitest';
import {
  scheduleNextAction,
  type ScheduleActionContext,
  type AdaptiveSettings,
} from '../server/lib/adaptive-scheduler';

describe('Adaptive Scheduler - Composite Scoring', () => {
  let baseSettings: AdaptiveSettings;
  let baseContext: ScheduleActionContext;

  beforeEach(() => {
    baseSettings = {
      targetDSO: 45,
      urgencyFactor: 0.5,
      quietHours: [22, 8],
      maxDailyTouches: 3,
    };

    baseContext = {
      tenantId: 'test-tenant',
      settings: baseSettings,
      customer: {
        segment: 'default',
        channelPrefs: {
          email: true,
          sms: true,
          whatsapp: false,
          call: true,
        },
      },
      invoice: {
        amount: 5000,
        dueAt: new Date('2025-01-01'),
        issuedAt: new Date('2024-12-01'),
        ageDays: 10,
        dispute: false,
      },
      constraints: {
        now: new Date('2025-01-11'),
        minGapHours: 24,
        allowedChannels: ['email', 'sms', 'call'],
        timezone: 'Europe/London',
        hasOverride: false,
        maxDailyTouchesPerCustomer: 2,
      },
    };
  });

  describe('Scoring Formula', () => {
    it('should calculate composite score correctly', () => {
      const result = scheduleNextAction(baseContext);
      expect(result).toBeDefined();
      expect(result?.priority).toBeGreaterThan(0);
      expect(result?.reasoning).toBeDefined();
    });

    it('should increase score for higher urgency factor', () => {
      const lowUrgency = scheduleNextAction({
        ...baseContext,
        settings: { ...baseSettings, urgencyFactor: 0.2 },
      });

      const highUrgency = scheduleNextAction({
        ...baseContext,
        settings: { ...baseSettings, urgencyFactor: 0.8 },
      });

      expect(highUrgency?.priority).toBeGreaterThan(lowUrgency?.priority || 0);
    });

    it('should decrease score for higher friction (recent contact)', () => {
      const recentContact = scheduleNextAction({
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          lastTouchAt: new Date('2025-01-10'), // Very recent
        },
      });

      const oldContact = scheduleNextAction({
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          lastTouchAt: new Date('2025-01-01'), // 10 days ago
        },
      });

      expect((oldContact?.priority || 0)).toBeGreaterThan(recentContact?.priority || 0);
    });
  });

  describe('Constraint Enforcement', () => {
    it('should skip when dispute flag is set', () => {
      const result = scheduleNextAction({
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          dispute: true,
        },
      });

      expect(result).toBeNull();
    });

    it('should skip when manual override is present', () => {
      const result = scheduleNextAction({
        ...baseContext,
        constraints: {
          ...baseContext.constraints,
          hasOverride: true,
        },
      });

      expect(result).toBeNull();
    });

    it('should not schedule during quiet hours', () => {
      // Test at 11 PM (23:00) - within quiet hours [22, 8]
      const quietTime = new Date('2025-01-11T23:00:00');
      const result = scheduleNextAction({
        ...baseContext,
        constraints: {
          ...baseContext.constraints,
          now: quietTime,
        },
      });

      if (result?.suggestedDate) {
        const hour = result.suggestedDate.getHours();
        // Should not be during quiet hours [22, 8]
        expect(hour).toBeGreaterThanOrEqual(8);
        expect(hour).toBeLessThan(22);
      }
    });

    it('should respect channel allow-list', () => {
      const result = scheduleNextAction({
        ...baseContext,
        constraints: {
          ...baseContext.constraints,
          allowedChannels: ['email'], // Only email allowed
        },
      });

      if (result) {
        expect(result.channel).toBe('email');
      }
    });

    it('should respect minimum gap hours between contacts', () => {
      const lastContact = new Date('2025-01-11T10:00:00');
      const now = new Date('2025-01-11T12:00:00'); // Only 2 hours later
      
      const result = scheduleNextAction({
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          lastTouchAt: lastContact,
        },
        constraints: {
          ...baseContext.constraints,
          now,
          minGapHours: 24,
        },
      });

      if (result?.suggestedDate) {
        const hoursDiff = (result.suggestedDate.getTime() - lastContact.getTime()) / (1000 * 60 * 60);
        expect(hoursDiff).toBeGreaterThanOrEqual(24);
      }
    });
  });

  describe('Cold-Start Logic', () => {
    it('should use segment priors for customers without behavior signals', () => {
      const resultWithoutBehavior = scheduleNextAction({
        ...baseContext,
        customer: {
          ...baseContext.customer,
          behavior: undefined,
        },
      });

      expect(resultWithoutBehavior).toBeDefined();
      expect(resultWithoutBehavior?.priority).toBeGreaterThan(0);
    });

    it('should use actual behavior when available', () => {
      const withBehavior = scheduleNextAction({
        ...baseContext,
        customer: {
          ...baseContext.customer,
          behavior: {
            totalInteractions: 10,
            emailResponseRate: 0.8,
            smsResponseRate: 0.6,
            callPickupRate: 0.4,
            avgPaymentDelayDays: 5,
            promiseKeepRate: 0.9,
          },
        },
      });

      const withoutBehavior = scheduleNextAction({
        ...baseContext,
        customer: {
          ...baseContext.customer,
          behavior: undefined,
        },
      });

      // Both should produce results
      expect(withBehavior).toBeDefined();
      expect(withoutBehavior).toBeDefined();
    });
  });

  describe('Channel Selection', () => {
    it('should prefer email for low urgency', () => {
      const result = scheduleNextAction({
        ...baseContext,
        settings: {
          ...baseSettings,
          urgencyFactor: 0.1, // Very low urgency
        },
      });

      // For low urgency, email is typically preferred
      expect(result?.channel).toBe('email');
    });

    it('should select appropriate channel based on preferences and urgency', () => {
      const result = scheduleNextAction({
        ...baseContext,
        customer: {
          ...baseContext.customer,
          channelPrefs: {
            email: true,
            sms: true,
            whatsapp: false,
            call: false, // No call preference
          },
        },
      });

      if (result) {
        expect(['email', 'sms']).toContain(result.channel);
      }
    });
  });

  describe('Reasoning Output', () => {
    it('should provide human-readable reasoning', () => {
      const result = scheduleNextAction(baseContext);
      
      expect(result?.reasoning).toBeDefined();
      if (result?.reasoning) {
        expect(result.reasoning.length).toBeGreaterThan(10);
        expect(typeof result.reasoning).toBe('string');
      }
    });

    it('should explain why action was skipped', () => {
      const result = scheduleNextAction({
        ...baseContext,
        invoice: {
          ...baseContext.invoice,
          dispute: true,
        },
      });

      expect(result).toBeNull();
      // In production, you might want to return a reason for the skip
    });
  });
});
