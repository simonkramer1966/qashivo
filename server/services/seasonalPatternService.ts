import { db } from '../db';
import { eq, and, desc, sql, count, avg, gte, lte } from 'drizzle-orm';
import {
  seasonalPatterns,
  invoices,
  contacts,
  type SeasonalPattern,
  type InsertSeasonalPattern,
} from '@shared/schema';

/**
 * Seasonal Pattern Recognition Service
 * 
 * Analyzes and identifies time-based payment patterns including:
 * - Daily patterns (day of week preferences)
 * - Weekly patterns (week-based cycles)
 * - Monthly patterns (month-end effects, specific months)
 * - Quarterly patterns (business cycles)
 * - Yearly patterns (seasonal business effects)
 * - Holiday patterns (impact of holidays)
 */
export class SeasonalPatternService {
  private static readonly MODEL_VERSION = '2.0.0';
  
  /**
   * Perform comprehensive seasonal pattern analysis
   */
  async performSeasonalAnalysis(tenantId: string): Promise<{
    patterns: SeasonalPattern[];
    insights: any;
  }> {
    try {
      // Clear existing patterns for fresh analysis
      await this.clearExistingPatterns(tenantId);
      
      // Get payment data for analysis
      const paymentData = await this.getPaymentDataForAnalysis(tenantId);
      
      if (paymentData.length < 10) {
        return { 
          patterns: [], 
          insights: { message: 'Insufficient payment data for seasonal analysis' } 
        };
      }
      
      // Analyze different temporal patterns
      const dailyPatterns = await this.analyzeDailyPatterns(tenantId, paymentData);
      const weeklyPatterns = await this.analyzeWeeklyPatterns(tenantId, paymentData);
      const monthlyPatterns = await this.analyzeMonthlyPatterns(tenantId, paymentData);
      const quarterlyPatterns = await this.analyzeQuarterlyPatterns(tenantId, paymentData);
      const yearlyPatterns = await this.analyzeYearlyPatterns(tenantId, paymentData);
      
      const allPatterns = [
        ...dailyPatterns,
        ...weeklyPatterns,
        ...monthlyPatterns,
        ...quarterlyPatterns,
        ...yearlyPatterns
      ];
      
      // Generate insights
      const insights = await this.generateSeasonalInsights(tenantId, allPatterns, paymentData);
      
      return {
        patterns: allPatterns,
        insights
      };
    } catch (error) {
      console.error('Error performing seasonal analysis:', error);
      throw error;
    }
  }
  
  /**
   * Analyze daily payment patterns (day of week effects)
   */
  private async analyzeDailyPatterns(
    tenantId: string,
    paymentData: any[]
  ): Promise<SeasonalPattern[]> {
    const patterns: InsertSeasonalPattern[] = [];
    
    // Group payments by day of week
    const dayOfWeekData = this.groupPaymentsByDayOfWeek(paymentData);
    
    // Analyze each day of week
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let dayNum = 0; dayNum < 7; dayNum++) {
      const dayName = daysOfWeek[dayNum];
      const dayData = dayOfWeekData[dayNum] || [];
      
      if (dayData.length >= 3) { // Need minimum sample size
        const avgDelay = dayData.reduce((sum, p) => sum + p.paymentDelay, 0) / dayData.length;
        const paymentRate = dayData.filter(p => p.paymentDelay !== null).length / dayData.length;
        const variance = this.calculateVariance(dayData.map(p => p.paymentDelay || 0));
        
        // Determine if this day shows significant patterns
        const overallAvgDelay = paymentData.reduce((sum, p) => sum + (p.paymentDelay || 0), 0) / paymentData.length;
        const patternStrength = this.calculatePatternStrength(avgDelay, overallAvgDelay, variance);
        
        if (patternStrength > 0.3) { // Significant pattern threshold
          patterns.push({
            tenantId,
            contactId: null, // Global pattern
            patternType: 'daily',
            patternName: `${dayName} Payment Pattern`,
            description: `Payment behavior on ${dayName}s`,
            timeComponent: dayName.toLowerCase(),
            cyclePeriod: 7, // Weekly cycle
            patternStrength: patternStrength.toString(),
            confidence: this.calculateConfidence(dayData.length, variance).toString(),
            reliability: this.calculateReliability(dayData).toString(),
            averagePaymentDelay: Math.round(avgDelay),
            paymentVariance: variance.toString(),
            sampleSize: dayData.length,
            historicalData: {
              payments: dayData.length,
              averageDelay: avgDelay,
              paymentRate: paymentRate,
              dayOfWeek: dayNum,
            },
            trendDirection: this.calculateTrendDirection(dayData),
            nextPredictedPeak: this.calculateNextOccurrence(dayNum, 'weekly'),
            seasonalMultiplier: this.calculateSeasonalMultiplier(avgDelay, overallAvgDelay).toString(),
            modelVersion: SeasonalPatternService.MODEL_VERSION,
            isActive: true,
          });
        }
      }
    }
    
    // Insert patterns into database
    const createdPatterns = [];
    for (const pattern of patterns) {
      const [created] = await db.insert(seasonalPatterns).values(pattern).returning();
      createdPatterns.push(created);
    }
    
    return createdPatterns;
  }
  
  /**
   * Analyze weekly payment patterns
   */
  private async analyzeWeeklyPatterns(
    tenantId: string,
    paymentData: any[]
  ): Promise<SeasonalPattern[]> {
    const patterns: InsertSeasonalPattern[] = [];
    
    // Group payments by week of month (1-4)
    const weekOfMonthData = this.groupPaymentsByWeekOfMonth(paymentData);
    
    for (let week = 1; week <= 4; week++) {
      const weekData = weekOfMonthData[week] || [];
      
      if (weekData.length >= 5) { // Need minimum sample size
        const avgDelay = weekData.reduce((sum, p) => sum + p.paymentDelay, 0) / weekData.length;
        const variance = this.calculateVariance(weekData.map(p => p.paymentDelay || 0));
        
        const overallAvgDelay = paymentData.reduce((sum, p) => sum + (p.paymentDelay || 0), 0) / paymentData.length;
        const patternStrength = this.calculatePatternStrength(avgDelay, overallAvgDelay, variance);
        
        if (patternStrength > 0.25) {
          patterns.push({
            tenantId,
            contactId: null,
            patternType: 'weekly',
            patternName: `Week ${week} of Month Pattern`,
            description: `Payment behavior during week ${week} of the month`,
            timeComponent: `week_${week}`,
            cyclePeriod: 30, // Monthly cycle
            patternStrength: patternStrength.toString(),
            confidence: this.calculateConfidence(weekData.length, variance).toString(),
            reliability: this.calculateReliability(weekData).toString(),
            averagePaymentDelay: Math.round(avgDelay),
            paymentVariance: variance.toString(),
            sampleSize: weekData.length,
            historicalData: {
              payments: weekData.length,
              averageDelay: avgDelay,
              weekOfMonth: week,
            },
            trendDirection: this.calculateTrendDirection(weekData),
            seasonalMultiplier: this.calculateSeasonalMultiplier(avgDelay, overallAvgDelay).toString(),
            modelVersion: SeasonalPatternService.MODEL_VERSION,
            isActive: true,
          });
        }
      }
    }
    
    // Insert patterns into database
    const createdPatterns = [];
    for (const pattern of patterns) {
      const [created] = await db.insert(seasonalPatterns).values(pattern).returning();
      createdPatterns.push(created);
    }
    
    return createdPatterns;
  }
  
  /**
   * Analyze monthly payment patterns
   */
  private async analyzeMonthlyPatterns(
    tenantId: string,
    paymentData: any[]
  ): Promise<SeasonalPattern[]> {
    const patterns: InsertSeasonalPattern[] = [];
    
    // Group payments by month
    const monthlyData = this.groupPaymentsByMonth(paymentData);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    for (let month = 1; month <= 12; month++) {
      const monthData = monthlyData[month] || [];
      
      if (monthData.length >= 3) {
        const avgDelay = monthData.reduce((sum, p) => sum + p.paymentDelay, 0) / monthData.length;
        const variance = this.calculateVariance(monthData.map(p => p.paymentDelay || 0));
        
        const overallAvgDelay = paymentData.reduce((sum, p) => sum + (p.paymentDelay || 0), 0) / paymentData.length;
        const patternStrength = this.calculatePatternStrength(avgDelay, overallAvgDelay, variance);
        
        if (patternStrength > 0.2) {
          const monthName = monthNames[month - 1];
          
          patterns.push({
            tenantId,
            contactId: null,
            patternType: 'monthly',
            patternName: `${monthName} Payment Pattern`,
            description: `Payment behavior during ${monthName}`,
            timeComponent: monthName.toLowerCase(),
            cyclePeriod: 365, // Yearly cycle
            patternStrength: patternStrength.toString(),
            confidence: this.calculateConfidence(monthData.length, variance).toString(),
            reliability: this.calculateReliability(monthData).toString(),
            averagePaymentDelay: Math.round(avgDelay),
            paymentVariance: variance.toString(),
            sampleSize: monthData.length,
            historicalData: {
              payments: monthData.length,
              averageDelay: avgDelay,
              month: month,
              seasonalIndicators: this.identifySeasonalIndicators(month, avgDelay, overallAvgDelay),
            },
            trendDirection: this.calculateTrendDirection(monthData),
            nextPredictedPeak: this.calculateNextMonthOccurrence(month),
            seasonalMultiplier: this.calculateSeasonalMultiplier(avgDelay, overallAvgDelay).toString(),
            modelVersion: SeasonalPatternService.MODEL_VERSION,
            isActive: true,
          });
        }
      }
    }
    
    // Insert patterns into database
    const createdPatterns = [];
    for (const pattern of patterns) {
      const [created] = await db.insert(seasonalPatterns).values(pattern).returning();
      createdPatterns.push(created);
    }
    
    return createdPatterns;
  }
  
  /**
   * Analyze quarterly payment patterns
   */
  private async analyzeQuarterlyPatterns(
    tenantId: string,
    paymentData: any[]
  ): Promise<SeasonalPattern[]> {
    const patterns: InsertSeasonalPattern[] = [];
    
    // Group payments by quarter
    const quarterlyData = this.groupPaymentsByQuarter(paymentData);
    const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];
    
    for (let quarter = 1; quarter <= 4; quarter++) {
      const quarterData = quarterlyData[quarter] || [];
      
      if (quarterData.length >= 5) {
        const avgDelay = quarterData.reduce((sum, p) => sum + p.paymentDelay, 0) / quarterData.length;
        const variance = this.calculateVariance(quarterData.map(p => p.paymentDelay || 0));
        
        const overallAvgDelay = paymentData.reduce((sum, p) => sum + (p.paymentDelay || 0), 0) / paymentData.length;
        const patternStrength = this.calculatePatternStrength(avgDelay, overallAvgDelay, variance);
        
        if (patternStrength > 0.15) {
          patterns.push({
            tenantId,
            contactId: null,
            patternType: 'quarterly',
            patternName: `${quarterNames[quarter - 1]} Payment Pattern`,
            description: `Payment behavior during ${quarterNames[quarter - 1]}`,
            timeComponent: `q${quarter}`,
            cyclePeriod: 365, // Yearly cycle
            patternStrength: patternStrength.toString(),
            confidence: this.calculateConfidence(quarterData.length, variance).toString(),
            reliability: this.calculateReliability(quarterData).toString(),
            averagePaymentDelay: Math.round(avgDelay),
            paymentVariance: variance.toString(),
            sampleSize: quarterData.length,
            historicalData: {
              payments: quarterData.length,
              averageDelay: avgDelay,
              quarter: quarter,
              businessCycleImpact: this.assessBusinessCycleImpact(quarter, avgDelay),
            },
            trendDirection: this.calculateTrendDirection(quarterData),
            nextPredictedPeak: this.calculateNextQuarterOccurrence(quarter),
            seasonalMultiplier: this.calculateSeasonalMultiplier(avgDelay, overallAvgDelay).toString(),
            modelVersion: SeasonalPatternService.MODEL_VERSION,
            isActive: true,
          });
        }
      }
    }
    
    // Insert patterns into database
    const createdPatterns = [];
    for (const pattern of patterns) {
      const [created] = await db.insert(seasonalPatterns).values(pattern).returning();
      createdPatterns.push(created);
    }
    
    return createdPatterns;
  }
  
  /**
   * Analyze yearly payment patterns and trends
   */
  private async analyzeYearlyPatterns(
    tenantId: string,
    paymentData: any[]
  ): Promise<SeasonalPattern[]> {
    const patterns: InsertSeasonalPattern[] = [];
    
    // Group payments by year
    const yearlyData = this.groupPaymentsByYear(paymentData);
    const years = Object.keys(yearlyData).map(Number).sort();
    
    if (years.length >= 2) {
      // Analyze year-over-year trends
      const yearlyAverages = years.map(year => {
        const yearData = yearlyData[year];
        return {
          year,
          avgDelay: yearData.reduce((sum, p) => sum + p.paymentDelay, 0) / yearData.length,
          count: yearData.length,
        };
      });
      
      const overallTrend = this.calculateYearlyTrend(yearlyAverages);
      const trendStrength = Math.abs(overallTrend.slope);
      
      if (trendStrength > 0.5) { // Significant yearly trend
        patterns.push({
          tenantId,
          contactId: null,
          patternType: 'yearly',
          patternName: 'Annual Payment Trend',
          description: `Year-over-year payment behavior trend`,
          timeComponent: 'annual',
          cyclePeriod: 365,
          patternStrength: Math.min(trendStrength / 10, 1).toString(), // Normalize
          confidence: this.calculateTrendConfidence(yearlyAverages).toString(),
          reliability: this.calculateYearlyReliability(yearlyAverages).toString(),
          averagePaymentDelay: Math.round(yearlyAverages[yearlyAverages.length - 1].avgDelay),
          paymentVariance: this.calculateVariance(yearlyAverages.map(y => y.avgDelay)).toString(),
          sampleSize: paymentData.length,
          historicalData: {
            yearlyAverages,
            trendSlope: overallTrend.slope,
            trendIntercept: overallTrend.intercept,
            yearsAnalyzed: years.length,
          },
          trendDirection: overallTrend.slope > 0 ? 'increasing' : 'decreasing',
          nextPredictedPeak: this.calculateNextYearPrediction(years[years.length - 1] + 1),
          seasonalMultiplier: '1.0', // Baseline for yearly patterns
          modelVersion: SeasonalPatternService.MODEL_VERSION,
          isActive: true,
        });
      }
    }
    
    // Insert patterns into database
    const createdPatterns = [];
    for (const pattern of patterns) {
      const [created] = await db.insert(seasonalPatterns).values(pattern).returning();
      createdPatterns.push(created);
    }
    
    return createdPatterns;
  }
  
  /**
   * Generate insights from seasonal analysis
   */
  private async generateSeasonalInsights(
    tenantId: string,
    patterns: SeasonalPattern[],
    paymentData: any[]
  ): Promise<any> {
    const insights = {
      totalPatterns: patterns.length,
      strongestPatterns: patterns
        .filter(p => parseFloat(p.patternStrength || '0') > 0.5)
        .sort((a, b) => parseFloat(b.patternStrength || '0') - parseFloat(a.patternStrength || '0'))
        .slice(0, 5),
      
      seasonalEffects: {
        strongestDay: this.findStrongestPattern(patterns, 'daily'),
        strongestMonth: this.findStrongestPattern(patterns, 'monthly'),
        strongestQuarter: this.findStrongestPattern(patterns, 'quarterly'),
      },
      
      businessImpact: this.assessBusinessImpact(patterns),
      recommendations: this.generateSeasonalRecommendations(patterns),
      
      dataQuality: {
        totalPayments: paymentData.length,
        timeSpan: this.calculateTimeSpan(paymentData),
        confidence: this.calculateOverallConfidence(patterns),
      },
    };
    
    return insights;
  }
  
  /**
   * Helper methods for data grouping and analysis
   */
  private groupPaymentsByDayOfWeek(paymentData: any[]): Record<number, any[]> {
    const grouped: Record<number, any[]> = {};
    
    paymentData.forEach(payment => {
      if (payment.paidDate) {
        const dayOfWeek = new Date(payment.paidDate).getDay();
        if (!grouped[dayOfWeek]) grouped[dayOfWeek] = [];
        grouped[dayOfWeek].push(payment);
      }
    });
    
    return grouped;
  }
  
  private groupPaymentsByWeekOfMonth(paymentData: any[]): Record<number, any[]> {
    const grouped: Record<number, any[]> = {};
    
    paymentData.forEach(payment => {
      if (payment.paidDate) {
        const date = new Date(payment.paidDate);
        const weekOfMonth = Math.ceil(date.getDate() / 7);
        if (!grouped[weekOfMonth]) grouped[weekOfMonth] = [];
        grouped[weekOfMonth].push(payment);
      }
    });
    
    return grouped;
  }
  
  private groupPaymentsByMonth(paymentData: any[]): Record<number, any[]> {
    const grouped: Record<number, any[]> = {};
    
    paymentData.forEach(payment => {
      if (payment.paidDate) {
        const month = new Date(payment.paidDate).getMonth() + 1;
        if (!grouped[month]) grouped[month] = [];
        grouped[month].push(payment);
      }
    });
    
    return grouped;
  }
  
  private groupPaymentsByQuarter(paymentData: any[]): Record<number, any[]> {
    const grouped: Record<number, any[]> = {};
    
    paymentData.forEach(payment => {
      if (payment.paidDate) {
        const month = new Date(payment.paidDate).getMonth() + 1;
        const quarter = Math.ceil(month / 3);
        if (!grouped[quarter]) grouped[quarter] = [];
        grouped[quarter].push(payment);
      }
    });
    
    return grouped;
  }
  
  private groupPaymentsByYear(paymentData: any[]): Record<number, any[]> {
    const grouped: Record<number, any[]> = {};
    
    paymentData.forEach(payment => {
      if (payment.paidDate) {
        const year = new Date(payment.paidDate).getFullYear();
        if (!grouped[year]) grouped[year] = [];
        grouped[year].push(payment);
      }
    });
    
    return grouped;
  }
  
  /**
   * Statistical calculation methods
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    return squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private calculatePatternStrength(avgDelay: number, overallAvgDelay: number, variance: number): number {
    const deviationRatio = Math.abs(avgDelay - overallAvgDelay) / (overallAvgDelay + 1);
    const consistencyFactor = 1 / (1 + variance / 100); // Lower variance = higher strength
    return Math.min(deviationRatio * consistencyFactor, 1);
  }
  
  private calculateConfidence(sampleSize: number, variance: number): number {
    let confidence = 0.5; // Base confidence
    
    // Sample size factor
    if (sampleSize > 20) confidence += 0.3;
    else if (sampleSize > 10) confidence += 0.2;
    else if (sampleSize > 5) confidence += 0.1;
    
    // Variance factor (lower variance = higher confidence)
    const varianceFactor = Math.max(0, 0.3 - (variance / 100));
    confidence += varianceFactor;
    
    return Math.max(0.1, Math.min(0.99, confidence));
  }
  
  private calculateReliability(data: any[]): number {
    if (data.length === 0) return 0;
    
    // Calculate consistency of pattern
    const delays = data.map(d => d.paymentDelay || 0);
    const variance = this.calculateVariance(delays);
    const mean = delays.reduce((sum, val) => sum + val, 0) / delays.length;
    
    // Lower coefficient of variation = higher reliability
    const coefficientOfVariation = variance > 0 ? Math.sqrt(variance) / (Math.abs(mean) + 1) : 0;
    const reliability = Math.max(0.1, 1 - Math.min(coefficientOfVariation / 2, 0.9));
    
    return reliability;
  }
  
  private calculateTrendDirection(data: any[]): string {
    if (data.length < 3) return 'stable';
    
    // Simple linear regression to determine trend
    const sortedData = data.sort((a, b) => new Date(a.paidDate).getTime() - new Date(b.paidDate).getTime());
    const n = sortedData.length;
    const sumX = n * (n + 1) / 2; // Sum of indices
    const sumY = sortedData.reduce((sum, d) => sum + (d.paymentDelay || 0), 0);
    const sumXY = sortedData.reduce((sum, d, i) => sum + (i + 1) * (d.paymentDelay || 0), 0);
    const sumX2 = n * (n + 1) * (2 * n + 1) / 6; // Sum of squared indices
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (slope > 0.5) return 'increasing';
    if (slope < -0.5) return 'decreasing';
    return 'stable';
  }
  
  private calculateSeasonalMultiplier(avgDelay: number, overallAvgDelay: number): number {
    if (overallAvgDelay === 0) return 1;
    return avgDelay / overallAvgDelay;
  }
  
  /**
   * Date calculation methods
   */
  private calculateNextOccurrence(dayOfWeek: number, cycleType: string): Date {
    const now = new Date();
    const nextOccurrence = new Date(now);
    
    // Calculate days until next occurrence
    const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7;
    nextOccurrence.setDate(now.getDate() + daysUntilNext);
    
    return nextOccurrence;
  }
  
  private calculateNextMonthOccurrence(month: number): Date {
    const now = new Date();
    const nextYear = month <= now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
    return new Date(nextYear, month - 1, 1);
  }
  
  private calculateNextQuarterOccurrence(quarter: number): Date {
    const now = new Date();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const nextYear = quarter <= currentQuarter ? now.getFullYear() + 1 : now.getFullYear();
    const quarterStartMonth = (quarter - 1) * 3;
    return new Date(nextYear, quarterStartMonth, 1);
  }
  
  private calculateNextYearPrediction(year: number): Date {
    return new Date(year, 0, 1);
  }
  
  /**
   * Analysis helper methods
   */
  private identifySeasonalIndicators(month: number, avgDelay: number, overallAvgDelay: number): string[] {
    const indicators = [];
    const ratio = avgDelay / (overallAvgDelay + 1);
    
    if (month === 12 && ratio > 1.2) indicators.push('holiday_slowdown');
    if (month === 1 && ratio > 1.1) indicators.push('post_holiday_delay');
    if ([3, 6, 9, 12].includes(month) && ratio < 0.9) indicators.push('quarter_end_acceleration');
    if ([7, 8].includes(month) && ratio > 1.1) indicators.push('summer_vacation_impact');
    
    return indicators;
  }
  
  private assessBusinessCycleImpact(quarter: number, avgDelay: number): string {
    if (quarter === 1) return avgDelay > 15 ? 'slow_start' : 'strong_start';
    if (quarter === 2) return avgDelay < 10 ? 'momentum_building' : 'seasonal_lag';
    if (quarter === 3) return avgDelay > 20 ? 'summer_slowdown' : 'steady_performance';
    if (quarter === 4) return avgDelay < 8 ? 'year_end_push' : 'holiday_impact';
    return 'normal';
  }
  
  private calculateYearlyTrend(yearlyAverages: any[]): { slope: number; intercept: number } {
    const n = yearlyAverages.length;
    if (n < 2) return { slope: 0, intercept: 0 };
    
    const sumX = yearlyAverages.reduce((sum, _, i) => sum + i, 0);
    const sumY = yearlyAverages.reduce((sum, y) => sum + y.avgDelay, 0);
    const sumXY = yearlyAverages.reduce((sum, y, i) => sum + i * y.avgDelay, 0);
    const sumX2 = yearlyAverages.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }
  
  private calculateTrendConfidence(yearlyAverages: any[]): number {
    const trend = this.calculateYearlyTrend(yearlyAverages);
    const predictions = yearlyAverages.map((_, i) => trend.intercept + trend.slope * i);
    const actual = yearlyAverages.map(y => y.avgDelay);
    
    // Calculate R-squared
    const actualMean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
    const totalSumSquares = actual.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
    const residualSumSquares = actual.reduce((sum, val, i) => sum + Math.pow(val - predictions[i], 2), 0);
    
    const rSquared = 1 - (residualSumSquares / totalSumSquares);
    return Math.max(0.1, Math.min(0.99, rSquared));
  }
  
  private calculateYearlyReliability(yearlyAverages: any[]): number {
    const delays = yearlyAverages.map(y => y.avgDelay);
    const variance = this.calculateVariance(delays);
    const mean = delays.reduce((sum, val) => sum + val, 0) / delays.length;
    
    const coefficientOfVariation = variance > 0 ? Math.sqrt(variance) / (Math.abs(mean) + 1) : 0;
    return Math.max(0.1, 1 - Math.min(coefficientOfVariation, 0.9));
  }
  
  /**
   * Insight generation methods
   */
  private findStrongestPattern(patterns: SeasonalPattern[], patternType: string): any {
    const typePatterns = patterns.filter(p => p.patternType === patternType);
    if (typePatterns.length === 0) return null;
    
    return typePatterns.reduce((strongest, current) => 
      parseFloat(current.patternStrength || '0') > parseFloat(strongest.patternStrength || '0') 
        ? current 
        : strongest
    );
  }
  
  private assessBusinessImpact(patterns: SeasonalPattern[]): any {
    const impact = {
      cashFlowPredictability: 'medium',
      collectionOptimization: [],
      riskMitigation: [],
    };
    
    // Assess cash flow predictability
    const strongPatterns = patterns.filter(p => parseFloat(p.patternStrength || '0') > 0.4);
    if (strongPatterns.length > 3) {
      impact.cashFlowPredictability = 'high';
    } else if (strongPatterns.length < 2) {
      impact.cashFlowPredictability = 'low';
    }
    
    // Collection optimization opportunities
    const monthlyPatterns = patterns.filter(p => p.patternType === 'monthly');
    monthlyPatterns.forEach(pattern => {
      if (pattern.averagePaymentDelay && pattern.averagePaymentDelay > 20) {
        impact.collectionOptimization.push(`Intensify collections during ${pattern.timeComponent}`);
      }
    });
    
    // Risk mitigation strategies
    const quarterlyPatterns = patterns.filter(p => p.patternType === 'quarterly');
    quarterlyPatterns.forEach(pattern => {
      if (pattern.averagePaymentDelay && pattern.averagePaymentDelay > 25) {
        impact.riskMitigation.push(`Prepare for slower payments in ${pattern.timeComponent?.toUpperCase()}`);
      }
    });
    
    return impact;
  }
  
  private generateSeasonalRecommendations(patterns: SeasonalPattern[]): string[] {
    const recommendations = [];
    
    // Day of week recommendations
    const dailyPatterns = patterns.filter(p => p.patternType === 'daily');
    const bestDay = dailyPatterns.reduce((best, current) => 
      !best || (current.averagePaymentDelay || 0) < (best.averagePaymentDelay || 0) ? current : best
    , null);
    
    if (bestDay) {
      recommendations.push(`Optimize collection timing: ${bestDay.timeComponent} shows fastest payment responses`);
    }
    
    // Monthly recommendations
    const monthlyPatterns = patterns.filter(p => p.patternType === 'monthly');
    const slowestMonth = monthlyPatterns.reduce((slowest, current) => 
      !slowest || (current.averagePaymentDelay || 0) > (slowest.averagePaymentDelay || 0) ? current : slowest
    , null);
    
    if (slowestMonth && slowestMonth.averagePaymentDelay && slowestMonth.averagePaymentDelay > 20) {
      recommendations.push(`Proactive collections needed in ${slowestMonth.timeComponent}: typically ${slowestMonth.averagePaymentDelay} days delay`);
    }
    
    // Yearly trend recommendations
    const yearlyPattern = patterns.find(p => p.patternType === 'yearly');
    if (yearlyPattern) {
      if (yearlyPattern.trendDirection === 'increasing') {
        recommendations.push('Payment delays are increasing year-over-year: consider stricter credit policies');
      } else if (yearlyPattern.trendDirection === 'decreasing') {
        recommendations.push('Payment performance is improving: consider expanding credit offerings');
      }
    }
    
    return recommendations;
  }
  
  private calculateTimeSpan(paymentData: any[]): any {
    if (paymentData.length === 0) return null;
    
    const dates = paymentData
      .filter(p => p.paidDate)
      .map(p => new Date(p.paidDate).getTime())
      .sort((a, b) => a - b);
    
    if (dates.length === 0) return null;
    
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    const daysDifference = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalDays: daysDifference,
      totalMonths: Math.floor(daysDifference / 30),
    };
  }
  
  private calculateOverallConfidence(patterns: SeasonalPattern[]): number {
    if (patterns.length === 0) return 0;
    
    const confidences = patterns.map(p => parseFloat(p.confidence || '0'));
    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }
  
  /**
   * Data retrieval methods
   */
  private async getPaymentDataForAnalysis(tenantId: string): Promise<any[]> {
    const payments = await db
      .select({
        invoiceId: invoices.id,
        contactId: invoices.contactId,
        amount: invoices.amount,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        paidDate: invoices.paidDate,
        status: invoices.status,
      })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.status, 'paid'),
        gte(invoices.issueDate, sql`now() - interval '2 years'`) // Last 2 years of data
      ));
    
    return payments.map(payment => ({
      ...payment,
      paymentDelay: payment.paidDate && payment.dueDate ? 
        Math.floor((new Date(payment.paidDate).getTime() - new Date(payment.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 
        null,
    }));
  }
  
  private async clearExistingPatterns(tenantId: string): Promise<void> {
    await db
      .delete(seasonalPatterns)
      .where(eq(seasonalPatterns.tenantId, tenantId));
  }
  
  /**
   * Public API methods
   */
  async getSeasonalPatterns(tenantId: string): Promise<SeasonalPattern[]> {
    return await db
      .select()
      .from(seasonalPatterns)
      .where(eq(seasonalPatterns.tenantId, tenantId))
      .orderBy(desc(seasonalPatterns.patternStrength));
  }
  
  async getPatternsByType(tenantId: string, patternType: string): Promise<SeasonalPattern[]> {
    return await db
      .select()
      .from(seasonalPatterns)
      .where(and(
        eq(seasonalPatterns.tenantId, tenantId),
        eq(seasonalPatterns.patternType, patternType)
      ))
      .orderBy(desc(seasonalPatterns.patternStrength));
  }
  
  async getSeasonalMultiplier(tenantId: string, date: Date): Promise<number> {
    const patterns = await this.getSeasonalPatterns(tenantId);
    
    const dayOfWeek = date.getDay();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    
    let multiplier = 1.0;
    let factors = 0;
    
    // Apply daily factor
    const dailyPattern = patterns.find(p => 
      p.patternType === 'daily' && 
      p.timeComponent === ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek]
    );
    if (dailyPattern) {
      multiplier += parseFloat(dailyPattern.seasonalMultiplier || '1') - 1;
      factors++;
    }
    
    // Apply monthly factor
    const monthlyPattern = patterns.find(p => 
      p.patternType === 'monthly' && 
      p.timeComponent === [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ][month - 1]
    );
    if (monthlyPattern) {
      multiplier += parseFloat(monthlyPattern.seasonalMultiplier || '1') - 1;
      factors++;
    }
    
    // Apply quarterly factor
    const quarterlyPattern = patterns.find(p => 
      p.patternType === 'quarterly' && 
      p.timeComponent === `q${quarter}`
    );
    if (quarterlyPattern) {
      multiplier += parseFloat(quarterlyPattern.seasonalMultiplier || '1') - 1;
      factors++;
    }
    
    // Average the factors
    return factors > 0 ? multiplier / factors : 1.0;
  }
}