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
    queryFn: ({ signal }) =>
      api<{ items: CompanySearchItem[]; count: number; truncated: boolean }>(
        `/companies/search?q=${encodeURIComponent(query)}`,
        { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) },
      ),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
  });
}

export type CompanyDiscoveryItem = {
  business_registration_number: string;
  name: string;
  award_count: number;
  winning_amount: number;
  organization_count: number;
  organization_names: string[];
  latest_award_date?: string;
  representative_award?: import("../notices/api").ProcurementAward;
};

export function useCompanyDiscovery(query: string) {
  return useQuery({
    queryKey: ["company-discovery", query],
    queryFn: ({ signal }) =>
      api<{
        items: CompanyDiscoveryItem[];
        matched_award_count: number;
        sampled_award_count: number;
        partial: boolean;
      }>(`/companies/discover?q=${encodeURIComponent(query)}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      }),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
  });
}

export type CompanyProfileResponse = {
  business_registration: Array<Record<string, unknown>>;
  suppliers: Array<Record<string, unknown>>;
  industries: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  sanctions: Array<Record<string, unknown>>;
  qualifications: Array<Record<string, unknown>>;
  direct_production: Array<Record<string, unknown>>;
  partial: boolean;
  qualification_error?: string;
};
export function useCompanyProfile(businessNumber?: string) {
  return useQuery({
    queryKey: ["company-profile", businessNumber],
    queryFn: ({ signal }) => api<CompanyProfileResponse>(`/companies/${encodeURIComponent(businessNumber!)}/profile`, { signal }),
    enabled: Boolean(businessNumber),
    staleTime: 30 * 60_000,
  });
}

export type CompanyActivityItem = {
  id: string;
  bid_notice_id?: string;
  notice_number?: string;
  notice_order?: string;
  company_number?: string;
  company_name?: string;
  rank?: number;
  bid_amount?: number;
  bid_at?: string;
  result?: string;
  remark?: string;
};
export type CompanyActivityResponse = {
  items: CompanyActivityItem[];
  awards: import("../notices/api").ProcurementAward[];
  award_pagination: { total_items?: number };
  contracts: import("../notices/api").ProcurementContract[];
  pagination: { page?: number; page_size?: number; total_items?: number; total_pages?: number };
  contract_count: number;
  registry_version?: string;
};
export function useCompanyActivity(businessNumber?: string) {
  return useQuery({
    queryKey: ["company-activity", businessNumber],
    queryFn: ({ signal }) => api<CompanyActivityResponse>(`/companies/${encodeURIComponent(businessNumber!)}/activity`, { signal }),
    enabled: Boolean(businessNumber),
    staleTime: 30 * 60_000,
  });
}
