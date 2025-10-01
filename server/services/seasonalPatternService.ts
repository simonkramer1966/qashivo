// Seasonal Pattern Service - Stub for MVP ML features

export class SeasonalPatternService {
  async getSeasonalPatterns(tenantId: string) {
    return {
      patterns: [],
      monthlyTrends: [],
      seasonalityScore: 0
    };
  }

  async detectSeasonality(tenantId: string) {
    return {
      hasSeasonality: false,
      confidence: 0,
      patterns: []
    };
  }

  async getSeasonalForecast(tenantId: string, months: number) {
    return {
      forecast: [],
      confidence: 0
    };
  }
}

export const seasonalPatternService = new SeasonalPatternService();
