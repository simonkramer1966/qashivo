/**
 * Test file to verify Sage and QuickBooks provider integration
 * This file tests the new providers against the existing APIMiddleware
 */

import { APIMiddleware } from './APIMiddleware';
import { SageProvider } from './providers/SageProvider';
import { QuickBooksProvider } from './providers/QuickBooksProvider';
import { XeroProvider } from './providers/XeroProvider';

/**
 * Test the provider registration and basic functionality
 */
export async function testProviderIntegration(): Promise<void> {
  console.log('🧪 Testing Provider Integration...');

  // Initialize API Middleware
  const apiMiddleware = new APIMiddleware();

  // Test 1: Create and register Sage provider
  console.log('\n1️⃣ Testing Sage Provider Registration...');
  try {
    const sageConfig = {
      name: 'sage',
      type: 'accounting' as const,
      clientId: 'test-sage-client-id',
      clientSecret: 'test-sage-client-secret',
      baseUrl: 'https://api.accounting.sage.com/v3.1',
      scopes: ['read_contacts', 'read_sales_invoices', 'read_bank_receipts'],
      redirectUri: '/api/providers/sage/callback',
      environment: 'sandbox' as const
    };

    const sageProvider = new SageProvider(sageConfig);
    apiMiddleware.registerProvider(sageProvider);
    console.log('✅ Sage provider registered successfully');

    // Verify provider is in registry
    const registeredSage = apiMiddleware.getProvider('sage');
    if (!registeredSage) {
      throw new Error('Sage provider not found in registry');
    }
    console.log('✅ Sage provider found in registry');

  } catch (error) {
    console.error('❌ Sage provider registration failed:', error);
  }

  // Test 2: Create and register QuickBooks provider
  console.log('\n2️⃣ Testing QuickBooks Provider Registration...');
  try {
    const qbConfig = {
      name: 'quickbooks',
      type: 'accounting' as const,
      clientId: 'test-qb-client-id',
      clientSecret: 'test-qb-client-secret',
      baseUrl: 'https://sandbox-quickbooks.api.intuit.com',
      scopes: ['com.intuit.quickbooks.accounting'],
      redirectUri: '/api/providers/quickbooks/callback',
      environment: 'sandbox' as const
    };

    const qbProvider = new QuickBooksProvider(qbConfig);
    apiMiddleware.registerProvider(qbProvider);
    console.log('✅ QuickBooks provider registered successfully');

    // Verify provider is in registry
    const registeredQB = apiMiddleware.getProvider('quickbooks');
    if (!registeredQB) {
      throw new Error('QuickBooks provider not found in registry');
    }
    console.log('✅ QuickBooks provider found in registry');

  } catch (error) {
    console.error('❌ QuickBooks provider registration failed:', error);
  }

  // Test 3: Verify provider type filtering
  console.log('\n3️⃣ Testing Provider Type Filtering...');
  try {
    const accountingProviders = apiMiddleware.getProvidersByType('accounting');
    console.log(`Found ${accountingProviders.length} accounting providers`);
    
    const providerNames = accountingProviders.map(p => p.name);
    console.log('Accounting providers:', providerNames);

    if (!providerNames.includes('sage')) {
      throw new Error('Sage provider not found in accounting providers');
    }
    if (!providerNames.includes('quickbooks')) {
      throw new Error('QuickBooks provider not found in accounting providers');
    }
    
    console.log('✅ Provider type filtering works correctly');

  } catch (error) {
    console.error('❌ Provider type filtering failed:', error);
  }

  // Test 4: Test health checks
  console.log('\n4️⃣ Testing Health Checks...');
  try {
    const healthResults = await apiMiddleware.healthCheck();
    console.log('Health check results:', healthResults);
    
    // Expect health checks to return false since no tokens are configured
    if (typeof healthResults.sage !== 'boolean') {
      throw new Error('Sage health check should return boolean');
    }
    if (typeof healthResults.quickbooks !== 'boolean') {
      throw new Error('QuickBooks health check should return boolean');
    }
    
    console.log('✅ Health checks working correctly');

  } catch (error) {
    console.error('❌ Health check failed:', error);
  }

  // Test 5: Test data transformation
  console.log('\n5️⃣ Testing Data Transformation...');
  try {
    const dataTransformer = apiMiddleware.getDataTransformer();
    
    // Test Sage contact transformation
    const mockSageContact = {
      id: 'sage-123',
      name: 'Test Company Ltd',
      main_contact_person: {
        email: 'test@company.com',
        telephone: '+44 123 456 789'
      },
      balance: '1250.50',
      deleted_at: null
    };

    const standardSageContact = dataTransformer.transformToStandard('sage', 'contact', mockSageContact) as StandardContact;
    console.log('Transformed Sage contact:', standardSageContact);

    if (standardSageContact.provider !== 'sage') {
      throw new Error('Sage contact transformation failed - provider field missing');
    }

    // Test QuickBooks customer transformation
    const mockQBCustomer = {
      Id: 'qb-456',
      Name: 'Test Customer Inc',
      Active: true,
      Balance: 500.75,
      PrimaryEmailAddr: { Address: 'customer@test.com' },
      PrimaryPhone: { FreeFormNumber: '555-123-4567' }
    };

    const standardQBContact = dataTransformer.transformToStandard('quickbooks', 'contact', mockQBCustomer) as StandardContact;
    console.log('Transformed QuickBooks contact:', standardQBContact);

    if (standardQBContact.provider !== 'quickbooks') {
      throw new Error('QuickBooks contact transformation failed - provider field missing');
    }

    console.log('✅ Data transformation working correctly');

  } catch (error) {
    console.error('❌ Data transformation failed:', error);
  }

  // Test 6: Test OAuth URL generation
  console.log('\n6️⃣ Testing OAuth URL Generation...');
  try {
    const sageAuth = await apiMiddleware.connectProvider('sage', 'test-tenant-123');
    if (!sageAuth.success || !sageAuth.authUrl) {
      throw new Error('Sage OAuth URL generation failed');
    }
    console.log('✅ Sage OAuth URL generated successfully');

    const qbAuth = await apiMiddleware.connectProvider('quickbooks', 'test-realm-456');
    if (!qbAuth.success || !qbAuth.authUrl) {
      throw new Error('QuickBooks OAuth URL generation failed');
    }
    console.log('✅ QuickBooks OAuth URL generated successfully');

  } catch (error) {
    console.error('❌ OAuth URL generation failed:', error);
  }

  console.log('\n🎉 Provider integration testing completed!');
}

/**
 * Test provider-specific functionality
 */
export async function testProviderSpecificFeatures(): Promise<void> {
  console.log('\n🔬 Testing Provider-Specific Features...');

  // Test Sage specific methods
  console.log('\n📊 Testing Sage Provider Features...');
  try {
    const sageConfig = {
      name: 'sage',
      type: 'accounting' as const,
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      baseUrl: 'https://api.accounting.sage.com/v3.1',
      scopes: ['read_contacts'],
      redirectUri: '/api/providers/sage/callback'
    };

    const sageProvider = new SageProvider(sageConfig);

    // Test provider properties
    if (sageProvider.name !== 'sage') {
      throw new Error('Sage provider name incorrect');
    }
    if (sageProvider.type !== 'accounting') {
      throw new Error('Sage provider type incorrect');
    }

    console.log('✅ Sage provider properties correct');

  } catch (error) {
    console.error('❌ Sage provider test failed:', error);
  }

  // Test QuickBooks specific methods
  console.log('\n📈 Testing QuickBooks Provider Features...');
  try {
    const qbConfig = {
      name: 'quickbooks',
      type: 'accounting' as const,
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      baseUrl: 'https://sandbox-quickbooks.api.intuit.com',
      scopes: ['com.intuit.quickbooks.accounting'],
      redirectUri: '/api/providers/quickbooks/callback',
      environment: 'sandbox' as const
    };

    const qbProvider = new QuickBooksProvider(qbConfig);

    // Test provider properties
    if (qbProvider.name !== 'quickbooks') {
      throw new Error('QuickBooks provider name incorrect');
    }
    if (qbProvider.type !== 'accounting') {
      throw new Error('QuickBooks provider type incorrect');
    }

    console.log('✅ QuickBooks provider properties correct');

  } catch (error) {
    console.error('❌ QuickBooks provider test failed:', error);
  }

  console.log('\n🎊 Provider-specific testing completed!');
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<void> {
  try {
    await testProviderIntegration();
    await testProviderSpecificFeatures();
    console.log('\n🏆 All provider tests completed successfully!');
  } catch (error) {
    console.error('\n💥 Provider testing failed:', error);
  }
}

// Functions are already exported above with their declarations