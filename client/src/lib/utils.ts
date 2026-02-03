import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currencyCode: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export interface PrimaryCreditContact {
  name: string;
  email: string | null;
  phone: string | null;
  smsNumber: string | null;
  jobTitle: string | null;
}

export function getCustomerDisplayName(contact: { primaryCreditContact?: PrimaryCreditContact | null; name?: string; companyName?: string | null } | null | undefined): string {
  if (!contact) return 'Not available';
  
  if (contact.primaryCreditContact?.name && contact.primaryCreditContact.name.trim()) {
    return contact.primaryCreditContact.name;
  }
  
  return 'Not available';
}

export function getCustomerCompanyName(contact: { companyName?: string | null; name?: string } | null | undefined): string {
  if (!contact) return 'Not available';
  return contact.companyName || 'Not available';
}
