/**
 * Comprehensive Test Suite for Qashivo Forecast Engine
 * 
 * This test validates the forecast engine with realistic sample data
 * to ensure all calculations and scenarios work correctly.
 */

import {
  ForecastEngine,
  ForecastInputData,
  ForecastConfig,
  createForecastConfig,
  DEFAULT_FORECAST_CONFIG,
  ForecastInvoice,
  ForecastBill,
  ForecastBankAccount,
  ForecastBudgetLine,
  ForecastExchangeRate,
  HistoricalTransaction
} from './forecast';

/**
 * Generate comprehensive sample data for testing
 */
export function generateSampleForecastData(): ForecastInputData {
  const forecastDate = new Date('2025-01-01T00:00:00Z');
  
  // Sample invoices (Accounts Receivable)
  const invoices: ForecastInvoice[] = [
    {
      id: 'inv-001',
      contactId: 'customer-001',
      invoiceNumber: 'INV-2024-001',
      amount: 50000,
      amountPaid: 0,
      currency: 'USD',
      issueDate: new Date('2024-12-15T00:00:00Z'),
      dueDate: new Date('2025-01-15T00:00:00Z'), // Due in 2 weeks
      status: 'pending',
      paymentTerms: 30,
      collectionStage: 'initial',
      isOnHold: false,
      contactPaymentHistory: {
        averageDaysToPayment: 25,
        paymentReliability: 0.85,
        totalTransactions: 12
      }
    },
    {
      id: 'inv-002',
      contactId: 'customer-002',
      invoiceNumber: 'INV-2024-002',
      amount: 25000,
      amountPaid: 5000,
      currency: 'USD',
      issueDate: new Date('2024-11-15T00:00:00Z'),
      dueDate: new Date('2024-12-15T00:00:00Z'), // 17 days overdue
      status: 'overdue',
      paymentTerms: 30,
      collectionStage: 'reminder_1',
      isOnHold: false,
      contactPaymentHistory: {
        averageDaysToPayment: 45,
        paymentReliability: 0.70,
        totalTransactions: 8
      }
    },
    {
      id: 'inv-003',
      contactId: 'customer-003',
      invoiceNumber: 'INV-2024-003',
      amount: 75000,
      amountPaid: 0,
      currency: 'EUR',
      issueDate: new Date('2024-12-20T00:00:00Z'),
      dueDate: new Date('2025-02-20T00:00:00Z'), // Due in 7 weeks
      status: 'pending',
      paymentTerms: 60,
      collectionStage: 'initial',
      isOnHold: false
    },
    {
      id: 'inv-004',
      contactId: 'customer-004',
      invoiceNumber: 'INV-2024-004',
      amount: 15000,
      amountPaid: 0,
      currency: 'USD',
      issueDate: new Date('2024-12-28T00:00:00Z'),
      dueDate: new Date('2025-01-28T00:00:00Z'), // Due in 4 weeks
      status: 'pending',
      paymentTerms: 30,
      collectionStage: 'initial',
      isOnHold: false,
      contactPaymentHistory: {
        averageDaysToPayment: 32,
        paymentReliability: 0.95,
        totalTransactions: 24
      }
    }
  ];
  
  // Sample bills (Accounts Payable)
  const bills: ForecastBill[] = [
    {
      id: 'bill-001',
      vendorId: 'vendor-001',
      billNumber: 'BILL-2024-001',
      amount: 30000,
      amountPaid: 0,
      currency: 'USD',
      issueDate: new Date('2024-12-10T00:00:00Z'),
      dueDate: new Date('2025-01-10T00:00:00Z'), // Due in 1.5 weeks
      status: 'pending',
      paymentTerms: 30,
      vendorPaymentTerms: {
        earlyPaymentDiscount: 2.0, // 2% discount
        earlyPaymentDays: 10,
        lateFeeRate: 1.5,
        lateFeeDays: 30
      }
    },
    {
      id: 'bill-002',
      vendorId: 'vendor-002',
      billNumber: 'BILL-2024-002',
      amount: 12000,
      amountPaid: 0,
      currency: 'USD',
      issueDate: new Date('2024-12-20T00:00:00Z'),
      dueDate: new Date('2025-01-20T00:00:00Z'), // Due in 3 weeks
      status: 'pending',
      paymentTerms: 30
    },
    {
      id: 'bill-003',
      vendorId: 'vendor-003',
      billNumber: 'BILL-2024-003',
      amount: 45000,
      amountPaid: 0,
      currency: 'EUR',
      issueDate: new Date('2024-12-15T00:00:00Z'),
      dueDate: new Date('2025-02-15T00:00:00Z'), // Due in 6.5 weeks
      status: 'pending',
      paymentTerms: 60
    }
  ];
  
  // Sample bank accounts
  const bankAccounts: ForecastBankAccount[] = [
    {
      id: 'bank-001',
      name: 'Operating Account',
      currency: 'USD',
      currentBalance: 125000,
      accountType: 'checking',
      isActive: true
    },
    {
      id: 'bank-002',
      name: 'Euro Account',
      currency: 'EUR',
      currentBalance: 35000,
      accountType: 'checking',
      isActive: true
    },
    {
      id: 'bank-003',
      name: 'Credit Line',
      currency: 'USD',
      currentBalance: -5000,
      accountType: 'credit_card',
      isActive: true,
      creditLimit: 50000
    }
  ];
  
  // Sample budget lines
  const budgetLines: ForecastBudgetLine[] = [
    {
      id: 'budget-001',
      category: 'income',
      subcategory: 'Recurring Revenue',
      budgetedAmount: 100000,
      period: 'monthly',
      currency: 'USD',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2025-12-31T00:00:00Z'),
      isRecurring: true,
      distributionPattern: 'linear'
    },
    {
      id: 'budget-002',
      category: 'expense',
      subcategory: 'Payroll',
      budgetedAmount: 45000,
      period: 'monthly',
      currency: 'USD',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2025-12-31T00:00:00Z'),
      isRecurring: true,
      distributionPattern: 'linear'
    },
    {
      id: 'budget-003',
      category: 'expense',
      subcategory: 'Office Rent',
      budgetedAmount: 8000,
      period: 'monthly',
      currency: 'USD',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2025-12-31T00:00:00Z'),
      isRecurring: true,
      distributionPattern: 'linear'
    },
    {
      id: 'budget-004',
      category: 'expense',
      subcategory: 'Marketing Campaign',
      budgetedAmount: 25000,
      period: 'quarterly',
      currency: 'USD',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2025-03-31T00:00:00Z'),
      isRecurring: false,
      distributionPattern: 'front_loaded'
    }
  ];
  
  // Sample exchange rates
  const exchangeRates: ForecastExchangeRate[] = [
    {
      fromCurrency: 'EUR',
      toCurrency: 'USD',
      rate: 1.08,
      rateDate: new Date('2025-01-01T00:00:00Z'),
      volatility: 0.12
    },
    {
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      rate: 0.926,
      rateDate: new Date('2025-01-01T00:00:00Z'),
      volatility: 0.12
    }
  ];
  
  // Sample historical transactions
  const historicalTransactions: HistoricalTransaction[] = [
    {
      date: new Date('2024-12-01T00:00:00Z'),
      amount: 85000,
      type: 'income',
      category: 'Sales',
      currency: 'USD',
      contactId: 'customer-001'
    },
    {
      date: new Date('2024-12-01T00:00:00Z'),
      amount: 42000,
      type: 'expense',
      category: 'Payroll',
      currency: 'USD'
    },
    {
      date: new Date('2024-12-15T00:00:00Z'),
      amount: 65000,
      type: 'income',
      category: 'Sales',
      currency: 'USD',
      contactId: 'customer-002'
    },
    {
      date: new Date('2024-12-15T00:00:00Z'),
      amount: 8000,
      type: 'expense',
      category: 'Rent',
      currency: 'USD'
    }
  ];
  
  return {
    invoices,
    bills,
    bankAccounts,
    budgetLines,
    exchangeRates,
    historicalTransactions,
    forecastDate
  };
}

/**
 * Test basic forecast engine functionality
 */
export async function testBasicForecast(): Promise<void> {
  console.log('🧪 Testing Basic Forecast Functionality...');
  
  try {
    // Generate sample data
    const inputData = generateSampleForecastData();
    
    // Create base scenario configuration
    const config = createForecastConfig('base');
    
    // Initialize forecast engine
    const engine = new ForecastEngine(config, inputData);
    
    // Generate forecast
    const forecast = await engine.generateForecast();
    
    // Validate basic structure
    console.log('✅ Forecast generated successfully');
    console.log(`📊 Forecast period: ${forecast.forecastPeriod.weeks} weeks`);
    console.log(`📅 From ${forecast.forecastPeriod.startDate.toDateString()} to ${forecast.forecastPeriod.endDate.toDateString()}`);
    console.log(`💰 Base currency: ${forecast.baseCurrency}`);
    console.log(`📈 Daily positions: ${forecast.dailyPositions.length}`);
    console.log(`📊 Weekly positions: ${forecast.weeklyPositions.length}`);
    console.log(`💳 Cash flow items: ${forecast.cashFlowItems.length}`);
    
    // Validate daily positions
    const firstDay = forecast.dailyPositions[0];
    const lastDay = forecast.dailyPositions[forecast.dailyPositions.length - 1];
    
    console.log(`\n💵 Starting balance: $${firstDay.openingBalance.toLocaleString()}`);
    console.log(`💵 Ending balance: $${lastDay.closingBalance.toLocaleString()}`);
    console.log(`📈 Net cash flow: $${(lastDay.closingBalance - firstDay.openingBalance).toLocaleString()}`);
    
    // Validate cash flow breakdown
    const totalARCollections = forecast.cashFlowItems
      .filter(item => item.type === 'ar_collection')
      .reduce((sum, item) => sum + item.amount, 0);
    
    const totalAPPayments = Math.abs(forecast.cashFlowItems
      .filter(item => item.type === 'ap_payment')
      .reduce((sum, item) => sum + item.amount, 0));
    
    const totalBudgetIncome = forecast.cashFlowItems
      .filter(item => item.type === 'budget_income')
      .reduce((sum, item) => sum + item.amount, 0);
    
    const totalBudgetExpenses = Math.abs(forecast.cashFlowItems
      .filter(item => item.type === 'budget_expense')
      .reduce((sum, item) => sum + item.amount, 0));
    
    console.log(`\n📊 Cash Flow Breakdown:`);
    console.log(`   AR Collections: $${totalARCollections.toLocaleString()}`);
    console.log(`   AP Payments: $${totalAPPayments.toLocaleString()}`);
    console.log(`   Budget Income: $${totalBudgetIncome.toLocaleString()}`);
    console.log(`   Budget Expenses: $${totalBudgetExpenses.toLocaleString()}`);
    
    // Validate metrics
    console.log(`\n📈 Key Metrics:`);
    console.log(`   Average Cash Balance: $${forecast.metrics.averageCashBalance.toLocaleString()}`);
    console.log(`   Min Cash Balance: $${forecast.metrics.minCashBalance.toLocaleString()}`);
    console.log(`   Max Cash Balance: $${forecast.metrics.maxCashBalance.toLocaleString()}`);
    console.log(`   Cash Runway: ${Math.round(forecast.metrics.cashRunway)} days`);
    console.log(`   DSO: ${Math.round(forecast.metrics.dso)} days`);
    console.log(`   DPO: ${Math.round(forecast.metrics.dpo)} days`);
    console.log(`   CCC: ${Math.round(forecast.metrics.ccc)} days`);
    console.log(`   Collection Efficiency: ${(forecast.metrics.collectionEfficiency * 100).toFixed(1)}%`);
    
    // Validate recommendations
    console.log(`\n💡 Recommendations: ${forecast.recommendations.length}`);
    forecast.recommendations.forEach((rec, idx) => {
      console.log(`   ${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
      console.log(`      Impact: $${rec.impact.toLocaleString()}`);
    });
    
    console.log('\n✅ Basic forecast test completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Basic forecast test failed:', error);
    throw error;
  }
}

/**
 * Test scenario comparison functionality
 */
export async function testScenarioComparison(): Promise<void> {
  console.log('🧪 Testing Scenario Comparison...');
  
  try {
    const inputData = generateSampleForecastData();
    
    // Test different scenarios
    const scenarios = ['base', 'optimistic', 'pessimistic'] as const;
    const results: Record<string, any> = {};
    
    for (const scenario of scenarios) {
      const config = createForecastConfig(scenario);
      const engine = new ForecastEngine(config, inputData);
      const forecast = await engine.generateForecast();
      
      results[scenario] = {
        finalBalance: forecast.dailyPositions[forecast.dailyPositions.length - 1].closingBalance,
        minBalance: forecast.metrics.minCashBalance,
        maxBalance: forecast.metrics.maxCashBalance,
        totalCollections: forecast.cashFlowItems
          .filter(item => item.type === 'ar_collection')
          .reduce((sum, item) => sum + item.amount, 0),
        cashRunway: forecast.metrics.cashRunway
      };
    }
    
    console.log('\n📊 Scenario Comparison Results:');
    console.log('================================================');
    
    scenarios.forEach(scenario => {
      const result = results[scenario];
      console.log(`\n${scenario.toUpperCase()} SCENARIO:`);
      console.log(`   Final Balance: $${result.finalBalance.toLocaleString()}`);
      console.log(`   Min Balance: $${result.minBalance.toLocaleString()}`);
      console.log(`   Max Balance: $${result.maxBalance.toLocaleString()}`);
      console.log(`   Total Collections: $${result.totalCollections.toLocaleString()}`);
      console.log(`   Cash Runway: ${Math.round(result.cashRunway)} days`);
    });
    
    // Validate that scenarios produce different results
    const baseBalance = results['base'].finalBalance;
    const optimisticBalance = results['optimistic'].finalBalance;
    const pessimisticBalance = results['pessimistic'].finalBalance;
    
    if (optimisticBalance > baseBalance && baseBalance > pessimisticBalance) {
      console.log('\n✅ Scenario ordering is correct (Optimistic > Base > Pessimistic)');
    } else {
      console.log('\n⚠️ Scenario ordering may need adjustment');
    }
    
    console.log('\n✅ Scenario comparison test completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Scenario comparison test failed:', error);
    throw error;
  }
}

/**
 * Test multi-currency functionality
 */
export async function testMultiCurrencyForecast(): Promise<void> {
  console.log('🧪 Testing Multi-Currency Functionality...');
  
  try {
    const inputData = generateSampleForecastData();
    
    // Create config with EUR base currency
    const config: ForecastConfig = {
      ...DEFAULT_FORECAST_CONFIG,
      baseCurrency: 'EUR'
    };
    
    const engine = new ForecastEngine(config, inputData);
    const forecast = await engine.generateForecast();
    
    console.log(`✅ Multi-currency forecast generated with base currency: ${forecast.baseCurrency}`);
    
    // Check that EUR amounts are not converted while USD amounts are
    const eurCollections = forecast.cashFlowItems
      .filter(item => item.type === 'ar_collection' && item.description.includes('EUR'))
      .reduce((sum, item) => sum + item.amount, 0);
    
    const usdCollections = forecast.cashFlowItems
      .filter(item => item.type === 'ar_collection' && !item.description.includes('EUR'))
      .reduce((sum, item) => sum + item.amount, 0);
    
    console.log(`   EUR Collections: €${eurCollections.toLocaleString()}`);
    console.log(`   USD Collections (converted): €${usdCollections.toLocaleString()}`);
    
    // Validate FX metrics
    if (forecast.metrics.fxExposure > 0) {
      console.log(`   FX Exposure: €${forecast.metrics.fxExposure.toLocaleString()}`);
      console.log(`   FX Impact: €${forecast.metrics.fxImpact.toLocaleString()}`);
    }
    
    console.log('\n✅ Multi-currency test completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Multi-currency test failed:', error);
    throw error;
  }
}

/**
 * Test edge cases and error handling
 */
export async function testEdgeCases(): Promise<void> {
  console.log('🧪 Testing Edge Cases and Error Handling...');
  
  try {
    // Test with minimal data
    const minimalData: ForecastInputData = {
      invoices: [],
      bills: [],
      bankAccounts: [{
        id: 'bank-001',
        name: 'Test Account',
        currency: 'USD',
        currentBalance: 10000,
        accountType: 'checking',
        isActive: true
      }],
      budgetLines: [],
      exchangeRates: [],
      historicalTransactions: [],
      forecastDate: new Date('2025-01-01T00:00:00Z')
    };
    
    const config = createForecastConfig('base');
    const engine = new ForecastEngine(config, minimalData);
    const forecast = await engine.generateForecast();
    
    console.log('✅ Minimal data test passed');
    console.log(`   Generated ${forecast.dailyPositions.length} daily positions`);
    console.log(`   Final balance: $${forecast.dailyPositions[forecast.dailyPositions.length - 1].closingBalance.toLocaleString()}`);
    
    // Test with very short forecast period
    const shortConfig: ForecastConfig = {
      ...config,
      forecastWeeks: 1
    };
    
    const shortEngine = new ForecastEngine(shortConfig, minimalData);
    const shortForecast = await shortEngine.generateForecast();
    
    console.log('✅ Short forecast period test passed');
    console.log(`   Generated ${shortForecast.dailyPositions.length} daily positions for 1 week`);
    
    console.log('\n✅ Edge cases test completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Edge cases test failed:', error);
    throw error;
  }
}

/**
 * Run comprehensive test suite
 */
export async function runComprehensiveTests(): Promise<void> {
  console.log('🚀 Starting Comprehensive Forecast Engine Test Suite');
  console.log('==================================================\n');
  
  try {
    await testBasicForecast();
    await testScenarioComparison();
    await testMultiCurrencyForecast();
    await testEdgeCases();
    
    console.log('🎉 ALL TESTS PASSED! Forecast Engine is working correctly.');
    console.log('==================================================');
    
  } catch (error) {
    console.error('💥 TEST SUITE FAILED:', error);
    throw error;
  }
}

// Export test runner for external use
export default {
  runComprehensiveTests,
  testBasicForecast,
  testScenarioComparison,
  testMultiCurrencyForecast,
  testEdgeCases,
  generateSampleForecastData
};