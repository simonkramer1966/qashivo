/**
 * Utility functions for normalizing dynamic variables for Retell AI integration
 * 
 * Root Cause Fix: Retell AI expects snake_case variable names but we're sending camelCase.
 * This utility normalizes variable names and ensures proper type coercion.
 */

/**
 * Mapping of camelCase to snake_case for known variable transformations
 */
const VARIABLE_NAME_MAPPING: Record<string, string> = {
  // Customer information
  customerName: 'customer_name',
  companyName: 'company_name',
  organisationName: 'organisation_name',
  
  // Invoice details
  invoiceNumber: 'invoice_number',
  invoiceAmount: 'invoice_amount',
  totalOutstanding: 'total_outstanding',
  daysOverdue: 'days_overdue',
  dueDate: 'due_date',
  amountPaid: 'amount_paid',
  outstandingAmount: 'total_outstanding',
  outstanding_amount: 'total_outstanding', // Handle snake_case input
  invoiceCount: 'invoice_count',
  invoice_count: 'invoice_count', // Handle snake_case input
  amount: 'invoice_amount', // Map generic 'amount' to 'invoice_amount'
  
  // Communication
  customMessage: 'custom_message',
  
  // Dates and timing
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  
  // Contact information
  phoneNumber: 'phone_number',
  emailAddress: 'email_address',
  contactMethod: 'contact_method',
  
  // AI context
  aiCallContext: 'ai_call_context',
  contextId: 'context_id',
  callType: 'call_type',
  isAiPowered: 'is_ai_powered',
  
  // ML intelligence
  preferredChannel: 'preferred_channel',
  communicationEffectiveness: 'communication_effectiveness',
  paymentReliability: 'payment_reliability',
  riskLevel: 'risk_level',
  customerSegment: 'customer_segment',
  aiConfidence: 'ai_confidence',
  recommendedApproach: 'recommended_approach',
  interactionHistorySummary: 'interaction_history_summary',
  paymentPredictionProbability: 'payment_prediction_probability',
  predictedPaymentTimeframe: 'predicted_payment_timeframe',
  riskFactors: 'risk_factors',
  successfulContactMethods: 'successful_contact_methods',
  customerResponsiveness: 'customer_responsiveness',
  escalationRisk: 'escalation_risk',
  seasonalPaymentPatterns: 'seasonal_payment_patterns',
  historicalPaymentBehavior: 'historical_payment_behavior'
};

/**
 * Converts camelCase string to snake_case
 */
function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Coerces value to string and handles null/undefined values
 */
function coerceToString(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number') {
    return value.toString();
  }
  
  if (typeof value === 'boolean') {
    return value.toString();
  }
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  
  return String(value);
}

/**
 * Core variables expected by the Retell AI prompt template
 * Additional variables are allowed and will be passed through
 */
const RETELL_CORE_VARIABLES = new Set([
  'customer_name',
  'organisation_name', 
  'company_name',
  'invoice_number',
  'invoice_amount',
  'total_outstanding',
  'days_overdue',
  'invoice_count',
  'due_date'
]);

/**
 * Check if debug logging is enabled
 */
function isDebugLoggingEnabled(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.RETELL_DEBUG === 'true';
}

/**
 * Redact PII from values for safe logging
 */
function redactPII(value: string, key: string): string {
  const piiKeys = ['customer_name', 'company_name', 'organisation_name', 'invoice_amount', 'total_outstanding'];
  
  if (!isDebugLoggingEnabled() && piiKeys.includes(key)) {
    if (key.includes('amount') || key.includes('outstanding')) {
      return '[AMOUNT_REDACTED]';
    }
    if (key.includes('name')) {
      return '[NAME_REDACTED]';
    }
    return '[PII_REDACTED]';
  }
  
  return value;
}

/**
 * Filters variables to include core prompt variables plus configurable additional ones
 * Now less restrictive to allow legitimate additional context variables
 * 
 * @param variables - The normalized variables object
 * @param context - Optional context for logging
 * @param allowAdditionalVars - Whether to allow non-core variables (default: true)
 * @returns Filtered variables object
 */
function filterRetellVariables(
  variables: Record<string, string>,
  context: string = 'RETELL_CALL',
  allowAdditionalVars: boolean = true
): Record<string, string> {
  const filteredVariables: Record<string, string> = {};
  let includedCount = 0;
  let excludedCount = 0;
  
  for (const [key, value] of Object.entries(variables)) {
    const isCoreVariable = RETELL_CORE_VARIABLES.has(key);
    const shouldInclude = isCoreVariable || allowAdditionalVars;
    
    if (shouldInclude) {
      filteredVariables[key] = value;
      includedCount++;
      
      if (isDebugLoggingEnabled()) {
        const redactedValue = redactPII(value, key);
        console.log(`✅ [${context}] Including variable: ${key} = "${redactedValue}" (${isCoreVariable ? 'core' : 'additional'})`);
      }
    } else {
      excludedCount++;
      if (isDebugLoggingEnabled()) {
        console.log(`❌ [${context}] Excluding variable: ${key} (not allowed)`);
      }
    }
  }
  
  if (isDebugLoggingEnabled()) {
    console.log(`🔧 [${context}] Filter summary: ${includedCount} included, ${excludedCount} excluded`);
  }
  return filteredVariables;
}

/**
 * Normalizes dynamic variables for Retell AI integration
 * 
 * This function:
 * 1. Parses JSON strings if input is string, otherwise clones object
 * 2. Maps camelCase keys to snake_case using predefined mappings
 * 3. Coerces all values to strings
 * 4. Removes undefined/null values
 * 5. Filters to include core prompt variables plus additional context variables
 * 6. Logs the transformation for debugging (PII-safe in production)
 * 
 * @param variables - The variables object to normalize (can be string or object)
 * @param context - Optional context for logging (e.g., "AI_CALL", "MCP_CALL")
 * @returns Normalized variables object with core prompt variables plus additional context
 */
export function normalizeDynamicVariables(
  variables: Record<string, any> | string | null | undefined,
  context: string = 'RETELL_CALL'
): Record<string, string> {
  if (isDebugLoggingEnabled()) {
    console.log(`🔧 [${context}] Starting variable normalization`);
    console.log(`🔧 [${context}] Original variables:`, variables);
  }

  let parsedVariables: Record<string, any> = {};

  // Step 1: Parse input
  if (typeof variables === 'string') {
    try {
      parsedVariables = JSON.parse(variables);
      if (isDebugLoggingEnabled()) {
        console.log(`🔧 [${context}] Parsed JSON string successfully`);
      }
    } catch (error) {
      console.error(`❌ [${context}] Failed to parse JSON string:`, error);
      return {};
    }
  } else if (variables && typeof variables === 'object') {
    // Clone the object to avoid mutation
    parsedVariables = { ...variables };
  } else {
    console.log(`🔧 [${context}] No variables provided or invalid type`);
    return {};
  }

  const normalizedVariables: Record<string, string> = {};

  // Step 2: Transform keys and values
  for (const [key, value] of Object.entries(parsedVariables)) {
    // Skip null/undefined values
    if (value === null || value === undefined) {
      console.log(`🔧 [${context}] Skipping null/undefined value for key: ${key}`);
      continue;
    }

    // Transform key: use mapping first, then fallback to camelToSnakeCase
    let normalizedKey = VARIABLE_NAME_MAPPING[key];
    if (!normalizedKey) {
      normalizedKey = camelToSnakeCase(key);
      console.log(`🔧 [${context}] Transformed key ${key} -> ${normalizedKey} (fallback conversion)`);
    } else {
      console.log(`🔧 [${context}] Transformed key ${key} -> ${normalizedKey} (predefined mapping)`);
    }

    // Transform value to string
    const stringValue = coerceToString(value);
    normalizedVariables[normalizedKey] = stringValue;

    if (isDebugLoggingEnabled()) {
      const redactedValue = redactPII(stringValue, normalizedKey);
      console.log(`🔧 [${context}] Key: ${normalizedKey}, Value: "${redactedValue}" (type: ${typeof value})`);
    }
  }

  if (isDebugLoggingEnabled()) {
    console.log(`🔧 [${context}] Pre-filter variable count: ${Object.keys(normalizedVariables).length}`);
  }
  
  // Filter to only include Retell-expected variables
  const filteredVariables = filterRetellVariables(normalizedVariables, context);
  
  if (isDebugLoggingEnabled()) {
    console.log(`🔧 [${context}] Transformation complete. ${Object.keys(filteredVariables).length} variables processed`);
  }

  return filteredVariables;
}

/**
 * Helper function to log variable transformation for debugging
 */
export function logVariableTransformation(
  original: Record<string, any> | string | null | undefined,
  normalized: Record<string, string>,
  context: string = 'RETELL_CALL'
): void {
  if (!isDebugLoggingEnabled()) {
    return; // Skip logging in production to avoid PII exposure
  }

  console.log(`📊 [${context}] Variable Transformation Summary:`);
  console.log(`📊 [${context}] Original type:`, typeof original);
  console.log(`📊 [${context}] Original keys:`, original && typeof original === 'object' ? Object.keys(original) : 'N/A');
  console.log(`📊 [${context}] Normalized keys:`, Object.keys(normalized));
  console.log(`📊 [${context}] Key transformations:`);
  
  if (original && typeof original === 'object') {
    for (const originalKey of Object.keys(original)) {
      const mappedKey = VARIABLE_NAME_MAPPING[originalKey] || camelToSnakeCase(originalKey);
      if (mappedKey in normalized) {
        console.log(`📊 [${context}]   ${originalKey} -> ${mappedKey}`);
      }
    }
  }
}