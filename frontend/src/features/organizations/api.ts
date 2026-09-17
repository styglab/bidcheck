import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/client";

export type Organization = {
  id: string;
  organization_code: string;
  name: string;
  jurisdiction_type?: string;
};

export function useOrganizationSearch(query: string) {
  return useQuery({
    queryKey: ["organizations", query],
    queryFn: ({ signal }) => api<{ items: Organization[]; pagination?: { total_items: number }; registry_version?: string }>(`/organizations?q=${encodeURIComponent(query)}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) }),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 60_000,
    retry: false,
  });
}

export function useOrganization(code?: string) {
  return useQuery({
    queryKey: ["organization", code],
    queryFn: ({ signal }) => api<{ organization: Organization; registry_version?: string }>(`/organizations/${encodeURIComponent(code!)}`, { signal }),
    enabled: Boolean(code),
    staleTime: 30 * 60_000,
  });
}

export function useOrganizationActivity(code?: string) {
  return useQuery({
    queryKey: ["organization-activity", code],
    queryFn: ({ signal }) => api<{ awards: import("../notices/api").ProcurementAward[]; award_pagination: { total_items?: number }; contracts: import("../notices/api").ProcurementContract[]; contract_pagination: { total_items?: number } }>(`/organizations/${encodeURIComponent(code!)}/activity`, { signal }),
    enabled: Boolean(code),
    staleTime: 5 * 60_000,
  });
}
