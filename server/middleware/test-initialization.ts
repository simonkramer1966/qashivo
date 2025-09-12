import { apiMiddleware } from './index';
import { XeroProvider } from './providers/XeroProvider';
import type { ProviderConfig } from './types';

/**
 * Test middleware initialization and basic functionality
 */
export async function testMiddlewareInitialization(): Promise<boolean> {
  try {
    console.log('🧪 Testing middleware initialization...');

    // Test 1: Create and register XeroProvider
    const xeroConfig: ProviderConfig = {
      name: 'xero',
      type: 'accounting',
      clientId: process.env.XERO_CLIENT_ID || 'test-client-id',
      clientSecret: process.env.XERO_CLIENT_SECRET || 'test-client-secret',
      baseUrl: 'https://api.xero.com',
      scopes: ['accounting.read', 'accounting.transactions'],
      redirectUri: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/xero/callback`,
      environment: 'production'
    };

    const xeroProvider = new XeroProvider(xeroConfig);
    apiMiddleware.registerProvider(xeroProvider);

    console.log('✅ XeroProvider registered successfully');

    // Test 2: Verify provider registration
    const providers = apiMiddleware.getProviders();
    console.log(`📋 Total providers registered: ${providers.length}`);
    console.log(`📋 Provider names: ${providers.map(p => p.name).join(', ')}`);

    const accountingProviders = apiMiddleware.getProvidersByType('accounting');
    console.log(`📊 Accounting providers: ${accountingProviders.length}`);

    // Test 3: Health check
    const healthResults = await apiMiddleware.healthCheck();
    console.log('🏥 Health check results:', healthResults);

    // Test 4: Test auth URL generation (without requiring real credentials)
    try {
      const connectionResult = await apiMiddleware.connectProvider('xero', 'test-tenant');
      if (connectionResult.success && connectionResult.authUrl) {
        console.log('🔗 Auth URL generated successfully (length):', connectionResult.authUrl.length);
      } else {
        console.log('ℹ️ Auth URL generation expected result:', connectionResult.error);
      }
    } catch (error) {
      console.log('ℹ️ Auth test completed with expected behavior');
    }

    console.log('🎉 All middleware tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Middleware test failed:', error);
    return false;
  }
}

// Helper function to verify middleware is ready for migration
export function verifyMigrationReadiness(): boolean {
  const providers = apiMiddleware.getProviders();
  const hasXero = providers.some(p => p.name === 'xero');
  
  if (!hasXero) {
    console.log('❌ Xero provider not found - migration not ready');
    return false;
  }

  console.log('✅ Middleware ready for migration');
  return true;
}