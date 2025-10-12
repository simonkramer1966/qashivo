/**
 * Demo Mode Service
 * Manages demo mode state and provides API for toggling demo mode
 * When enabled, simulates realistic inbound responses to outbound communications
 */

let demoModeEnabled = process.env.DEMO_MODE_ENABLED === 'true';

export const demoModeService = {
  /**
   * Check if demo mode is currently enabled
   */
  isEnabled(): boolean {
    return demoModeEnabled;
  },

  /**
   * Set demo mode state
   */
  setEnabled(enabled: boolean): void {
    demoModeEnabled = enabled;
    console.log(`[Demo Mode] ${enabled ? 'Enabled' : 'Disabled'}`);
  },

  /**
   * Get current demo mode status
   */
  getStatus(): { enabled: boolean } {
    return { enabled: demoModeEnabled };
  }
};
