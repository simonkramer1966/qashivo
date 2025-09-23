#!/usr/bin/env node

/**
 * MCP Tools Registration: Call Outcome Logging Tools
 * Registers all call outcome logging tools with the MCP server
 */

import { registerPromiseToPayTool } from './logPromiseToPay.js';
import { registerDisputeTool } from './logDispute.js';
import { registerRefusalTool } from './logRefusal.js';
import { registerCallbackRequestTool } from './logCallbackRequest.js';
import { registerNoAnswerTool } from './logNoAnswer.js';
import { registerPaymentConfirmedTool } from './logPaymentConfirmed.js';

export const registerCallOutcomeTools = (server) => {
  try {
    // Register all call outcome logging tools
    registerPromiseToPayTool(server);
    registerDisputeTool(server);
    registerRefusalTool(server);
    registerCallbackRequestTool(server);
    registerNoAnswerTool(server);
    registerPaymentConfirmedTool(server);
    
    console.log('✅ Registered all call outcome logging tools');
  } catch (error) {
    console.error('❌ Error registering call outcome tools:', error);
    throw error;
  }
};