export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
];

export const DEFAULT_CURRENCY = 'GBP';

// ── Supported languages ────────────────────────────────────────

export interface SupportedLanguage {
  code: string;
  name: string;
  retellCode: string;
}

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { code: 'en-GB', name: 'English (British)', retellCode: 'en-GB' },
  { code: 'en-US', name: 'English (American)', retellCode: 'en-US' },
  { code: 'fr-FR', name: 'French', retellCode: 'fr-FR' },
  { code: 'de-DE', name: 'German', retellCode: 'de-DE' },
  { code: 'es-ES', name: 'Spanish', retellCode: 'es-ES' },
  { code: 'pt-PT', name: 'Portuguese', retellCode: 'pt-PT' },
  { code: 'nl-NL', name: 'Dutch', retellCode: 'nl-NL' },
  { code: 'it-IT', name: 'Italian', retellCode: 'it-IT' },
  { code: 'pl-PL', name: 'Polish', retellCode: 'pl-PL' },
  { code: 'sv-SE', name: 'Swedish', retellCode: 'sv-SE' },
] as const;

export const DEFAULT_LANGUAGE = 'en-GB';

export function getLanguageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang?.name || code;
}

export function getRetellLanguageCode(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang?.retellCode || 'en-GB';
}

// Map currency codes to appropriate locales for Intl formatting
const CURRENCY_LOCALE_MAP: Record<string, string> = {
  GBP: 'en-GB', EUR: 'de-DE', USD: 'en-US', JPY: 'ja-JP',
  CAD: 'en-CA', AUD: 'en-AU', CHF: 'de-CH', CNY: 'zh-CN',
  INR: 'en-IN', BRL: 'pt-BR', KRW: 'ko-KR', MXN: 'es-MX',
  SGD: 'en-SG', NZD: 'en-NZ', ZAR: 'en-ZA', SEK: 'sv-SE',
  NOK: 'nb-NO', DKK: 'da-DK', PLN: 'pl-PL', CZK: 'cs-CZ',
};

export function formatCurrencyForPrompt(amount: number, currencyCode: string): string {
  const locale = CURRENCY_LOCALE_MAP[currencyCode] || 'en-GB';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Helper function to get currency symbol by code
export function getCurrencySymbol(currencyCode: string): string {
  const currency = CURRENCIES.find(c => c.code === currencyCode);
  return currency?.symbol || '$';
}

// Helper function to format currency
export function formatCurrency(amount: number, currencyCode: string = DEFAULT_CURRENCY): string {
  const symbol = getCurrencySymbol(currencyCode);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace(new RegExp(`^[^\\d]*`), symbol);
}