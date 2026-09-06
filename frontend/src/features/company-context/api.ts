import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/client";
export type CompanySearchItem = {
  id: string;
  business_registration_number?: string;
  name?: string;
  properties: Record<string, unknown>;
};
export function useCompanySearch(query: string) {
  return useQuery({
    queryKey: ["companies", query],
    queryFn: () =>
      api<{ items: CompanySearchItem[]; count: number; truncated: boolean }>(
        `/companies/search?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  });
}
