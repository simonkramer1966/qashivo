/**
 * Companies House API Integration — Gap 6
 *
 * Free API: https://api.company-information.service.gov.uk
 * Auth: HTTP Basic (API key as username, empty password)
 * Rate limit: 600 requests per 5 minutes
 *
 * This reads public data from Companies House — not Xero API data.
 * No training restriction applies (see CLAUDE.md rule 5).
 */

const COMPANIES_HOUSE_API_BASE = "https://api.company-information.service.gov.uk";

export interface CompaniesHouseSearchResult {
  companyNumber: string;
  companyName: string;
  companyStatus: string;
  dateOfCreation: string;
  address: string;
}

export class CompaniesHouseService {
  private apiKey: string | null;

  constructor() {
    this.apiKey = process.env.COMPANIES_HOUSE_API_KEY || null;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`;
  }

  async searchCompany(companyName: string): Promise<CompaniesHouseSearchResult[]> {
    if (!this.apiKey) throw new Error("Companies House API key not configured");

    const url = `${COMPANIES_HOUSE_API_BASE}/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=5`;
    const response = await fetch(url, {
      headers: { Authorization: this.authHeader() },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[CompaniesHouse] Rate limited — waiting 60s");
        await new Promise((resolve) => setTimeout(resolve, 60_000));
        return this.searchCompany(companyName); // retry once
      }
      throw new Error(`Companies House search failed: ${response.status}`);
    }

    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      companyNumber: item.company_number,
      companyName: item.title,
      companyStatus: item.company_status,
      dateOfCreation: item.date_of_creation,
      address: item.address_snippet || "",
    }));
  }

  async getCompanyProfile(companyNumber: string): Promise<any | null> {
    if (!this.apiKey) return null;

    const response = await fetch(
      `${COMPANIES_HOUSE_API_BASE}/company/${companyNumber}`,
      { headers: { Authorization: this.authHeader() } },
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      if (response.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
        return this.getCompanyProfile(companyNumber);
      }
      throw new Error(`Companies House profile failed: ${response.status}`);
    }

    return response.json();
  }

  async getFilingHistory(
    companyNumber: string,
    itemsPerPage: number = 25,
  ): Promise<{ items: any[]; totalCount: number } | null> {
    if (!this.apiKey) return null;

    const response = await fetch(
      `${COMPANIES_HOUSE_API_BASE}/company/${companyNumber}/filing-history?items_per_page=${itemsPerPage}`,
      { headers: { Authorization: this.authHeader() } },
    );

    if (!response.ok) return null;
    return response.json();
  }
}

export const companiesHouseService = new CompaniesHouseService();
