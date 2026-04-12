import { useState } from "react";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ChevronDown, Building2, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgSwitcherProps {
  collapsed?: boolean;
}

export default function OrgSwitcher({ collapsed }: OrgSwitcherProps) {
  const { isPartner, tenants, switchTenant, isSwitching } = usePartnerContext();
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  // Get current tenant info
  const { data: currentTenant } = useQuery<{
    id: string;
    name: string;
    xeroOrganisationName?: string | null;
    settings?: { companyName?: string };
  }>({
    queryKey: ["/api/tenant"],
    staleTime: 15 * 60 * 1000,
  });

  if (!isPartner) return null;

  const currentName = currentTenant?.xeroOrganisationName || currentTenant?.settings?.companyName || currentTenant?.name || "Select client";
  const currentInitial = currentName.charAt(0).toUpperCase();

  const handleTenantSelect = (tenantId: string) => {
    setOpen(false);
    switchTenant(tenantId);
  };

  const handlePortalClick = () => {
    setOpen(false);
    setLocation("/partner/dashboard");
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {collapsed ? (
          <button
            className="w-full flex items-center justify-center py-2 rounded-md text-q-text-secondary hover:bg-q-bg-surface-hover transition-colors"
            title={currentName}
          >
            <div className="w-7 h-7 rounded-md bg-q-bg-surface-alt flex items-center justify-center text-xs font-semibold text-q-text-primary">
              {currentInitial}
            </div>
          </button>
        ) : (
          <button
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
              "text-q-text-secondary hover:bg-q-bg-surface-hover hover:text-q-text-primary",
              isSwitching && "opacity-50 pointer-events-none"
            )}
          >
            <Building2 className="w-4 h-4 shrink-0 text-q-text-tertiary" />
            <span className="flex-1 text-left truncate">{currentName}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0"
        side={collapsed ? "right" : "bottom"}
        align="start"
        sideOffset={collapsed ? 8 : 4}
      >
        <Command>
          <CommandInput placeholder="Search clients..." />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup heading="Clients">
              {tenants.map((tenant: any) => {
                const name = tenant.xeroOrganisationName || tenant.settings?.companyName || tenant.name;
                const isCurrent = tenant.id === currentTenant?.id;
                return (
                  <CommandItem
                    key={tenant.id}
                    onSelect={() => handleTenantSelect(tenant.id)}
                    className={cn(isCurrent && "bg-accent")}
                  >
                    <div className="flex items-center gap-2 w-full min-w-0">
                      <div className="w-6 h-6 rounded bg-q-bg-surface-alt flex items-center justify-center text-[10px] font-semibold text-q-text-primary shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 truncate text-sm">{name}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handlePortalClick}>
                <LayoutDashboard className="w-4 h-4 mr-2 text-q-text-tertiary" />
                <span>Partner Portal</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
