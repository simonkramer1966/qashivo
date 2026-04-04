import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export function useInvalidateActionCentre() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contacts/vip"] });
    queryClient.invalidateQueries({ queryKey: ["/api/approval-queue"] });
  }, [queryClient]);
}
