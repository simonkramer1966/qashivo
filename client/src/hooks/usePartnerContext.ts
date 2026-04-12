import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface PartnerInfo {
  id: string;
  name: string;
  slug: string;
  brandName: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  accentColor: string | null;
  partnerType: string;
  partnerTier: string;
  status: string;
}

interface PartnerTenant {
  id: string;
  name: string;
  xeroOrganisationName?: string | null;
  settings?: { companyName?: string };
}

export function usePartnerContext() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const isPartner = !!(user as any)?.partnerId;

  const { data: partnerInfo, isLoading: isLoadingPartner } = useQuery<PartnerInfo>({
    queryKey: ["/api/partner/me"],
    enabled: isPartner,
    staleTime: 15 * 60 * 1000,
  });

  const { data: tenantsResponse, isLoading: isLoadingTenants } = useQuery<{ tenants: PartnerTenant[] }>({
    queryKey: ["/api/partner/tenants"],
    enabled: isPartner,
    staleTime: 60 * 1000,
  });

  const switchTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiRequest("POST", "/api/partner/switch-tenant", { tenantId });
      return res;
    },
    onSuccess: () => {
      // Clear all cached data — new tenant context
      queryClient.removeQueries();
      setLocation("/home");
    },
  });

  return {
    isPartner,
    partnerInfo: partnerInfo || null,
    tenants: tenantsResponse?.tenants || [],
    isLoading: isLoadingPartner || isLoadingTenants,
    switchTenant: switchTenantMutation.mutate,
    isSwitching: switchTenantMutation.isPending,
  };
}
