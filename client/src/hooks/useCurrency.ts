import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

interface TenantData {
  id: string;
  name: string;
  currency?: string;
  settings?: {
    companyName?: string;
    tagline?: string;
  };
}

export function useCurrency() {
  const { user } = useAuth();
  
  const { data: tenant } = useQuery<TenantData>({
    queryKey: ['/api/tenant'],
    enabled: !!user,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  const currency = tenant?.currency || 'GBP';

  const formatCurrency = (amount: number, options?: {
    showDecimals?: boolean;
    currencyOverride?: string;
  }) => {
    const currencyToUse = options?.currencyOverride || currency;
    const showDecimals = options?.showDecimals ?? false;

    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currencyToUse,
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(amount);
  };

  return {
    currency,
    formatCurrency,
  };
}
