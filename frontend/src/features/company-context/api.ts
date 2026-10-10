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
    queryFn: ({ signal }) =>
      api<CompanyProfileResponse>(`/companies/${encodeURIComponent(businessNumber!)}/profile`, { signal }),
    enabled: Boolean(businessNumber),
    staleTime: 30 * 60_000,
  });
}

type OntologyObject = {
  id: string;
  type: string;
  properties: Record<string, unknown>;
};

export type CompanyFinancialPeriod = {
  fiscal_year: number;
  status: "available" | "no_data" | "unavailable" | "error";
  objects: OntologyObject[];
};

export type CompanyDetailContext = {
  resolution: {
    status: "confirmed" | "unresolved";
    business_registration_number: string;
    corporate_registration_number?: string;
    resolution_method?: string;
  };
  business_status: OntologyObject[];
  company_profile: OntologyObject[];
  financials: CompanyFinancialPeriod[];
  financial_availability?: {
    requested_limit?: number;
    available_years?: number[];
    no_data_years?: number[];
    latest_available_year?: number;
  };
  relationships: OntologyObject[];
  sections: Record<
    string,
    { status: "available" | "no_data" | "unavailable" | "error"; completeness?: string; reason?: string }
  >;
  data_availability: Record<string, boolean>;
  sources: string[];
  observed_at?: string;
  partial_failure: boolean;
  errors: Array<{ section?: string; message?: string } | string>;
  registry_version?: string;
};

export function useCompanyDetailContext(businessNumber?: string, companyName?: string, enabled = true) {
  const search = new URLSearchParams();
  if (companyName?.trim()) search.set("company_name", companyName.trim());
  return useQuery({
    queryKey: ["company-detail-context", businessNumber, companyName],
    queryFn: ({ signal }) =>
      api<CompanyDetailContext>(
        `/companies/${encodeURIComponent(businessNumber!)}/detail-context?${search}`,
        { signal },
      ),
    enabled: Boolean(businessNumber) && enabled,
    staleTime: 6 * 60 * 60_000,
    gcTime: 12 * 60 * 60_000,
    retry: false,
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
  remark?: string;
  notice_name?: string;
  organization_code?: string;
  organization_name?: string;
  participation_date?: string;
  participant_count?: number;
  winning_amount?: number;
  result?: "award" | "contract" | "unsuccessful" | "unknown";
  result_confirmed?: boolean;
};
export type CompanyActivityResponse = {
  items: CompanyActivityItem[];
  awards: import("../notices/api").ProcurementAward[];
  award_pagination: { total_items?: number };
  contracts: import("../notices/api").ProcurementContract[];
  pagination: { page?: number; page_size?: number; total_items?: number; total_pages?: number };
  data_completeness?: { status?: string; missing_reasons?: string[] };
  contract_count: number;
  registry_version?: string;
};
export function useCompanyActivity(
  businessNumber?: string,
  filters: {
    fromYear?: number;
    toYear?: number;
    largeCategory?: string;
    middleCategory?: string;
    fieldCode?: string;
    workType?: string;
    query?: string;
    page?: number;
    pageSize?: number;
  } = {},
  enabled = true,
) {
  const search = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 20),
  });
  if (filters.fromYear && filters.toYear) {
    search.set("period_from_year", String(filters.fromYear));
    search.set("period_to_year", String(filters.toYear));
  }
  if (filters.largeCategory) search.set("large_category", filters.largeCategory);
  if (filters.middleCategory) search.set("middle_category", filters.middleCategory);
  if (filters.fieldCode) search.set("field_code", filters.fieldCode);
  if (filters.workType) search.set("work_type", filters.workType);
  if (filters.query) search.set("query", filters.query);
  return useQuery({
    queryKey: ["company-activity", businessNumber, filters],
    queryFn: ({ signal }) =>
      api<CompanyActivityResponse>(`/companies/${encodeURIComponent(businessNumber!)}/activity?${search}`, {
        signal,
      }),
    enabled: Boolean(businessNumber) && enabled,
    staleTime: 30 * 60_000,
  });
}

export type CompanyProcurementProfile = {
  company: { business_registration_number: string; name: string };
  summary: import("../organizations/api").ProcurementProfileSummary;
  organization_relationships: import("../organizations/api").ProcurementRelationship[];
  organization_entry?: {
    target_year: number;
    period_from: string;
    period_to: string;
    lookback_from: string;
    lookback_to: string;
    lookback_years: number;
    basis?: string;
    first_observed_organization_count: number;
    reentering_organization_count: number;
    incumbent_organization_count: number;
    total_organization_count: number;
    first_observed_organization_rate: number;
    reentering_organization_rate?: number;
    entry_and_reentry_organization_count?: number;
    entry_and_reentry_rate?: number;
    history_available_from?: string;
    history_complete_for_lookback?: boolean;
    history_complete_for_first_observed?: boolean;
    minimum_sample_size?: number;
    sample_sufficient?: boolean;
  };
  yearly_activity: Array<{
    year: number;
    notice_count: number;
    participation_count: number;
    result_confirmed_participation_count?: number;
    successful_participation_count?: number;
    award_success_rate?: number | null;
    award_event_count: number;
    contract_event_count: number;
    attributed_contract_amount?: number;
    amount_completeness: "complete" | "partial" | "unknown";
  }>;
  field_distribution: Array<{
    field_code?: string;
    field_name?: string;
    large_category?: string;
    middle_category?: string;
    classification_source?: string;
    work_types?: string[];
    display_level?: string;
    display_code?: string;
    display_name?: string;
    has_children?: boolean;
    selection_filter?: {
      work_type?: string | null;
      large_category?: string | null;
      middle_category?: string | null;
      field_code?: string | null;
    };
    event_count: number;
    participation_count?: number;
    result_confirmed_participation_count?: number;
    successful_participation_count?: number;
    award_success_rate?: number | null;
    award_event_count?: number;
    contract_event_count?: number;
    attributed_contract_amount?: number;
    amount_share?: number;
  }>;
  work_type_distribution?: Array<{
    work_type: string;
    work_type_name: string;
    contract_event_count: number;
    attributed_contract_amount?: number;
  }>;
  selected_field?: {
    field_code?: string;
    field_name?: string;
    large_category?: string;
    middle_category?: string;
  };
  recent_activity: Array<{
    bid_notice_id: string;
    notice_name: string;
    activity_type: "participation" | "award" | "contract";
    activity_date?: string;
    organization_code?: string;
    organization_name?: string;
  }>;
  analysis_basis: {
    period_from?: string;
    period_to?: string;
    period_years?: number;
    field_filter?: {
      large_category?: string;
      middle_category?: string;
      field_code?: string;
      field_name?: string;
    };
    work_type?: string;
    organization_query?: string;
  };
  data_completeness: { status?: string; missing_reasons?: string[] };
  pagination?: { page: number; page_size: number; total_items: number; total_pages: number };
  registry_version?: string;
};
export function useCompanyProcurementProfile(
  businessNumber?: string,
  filters: {
    fromYear?: number;
    toYear?: number;
    largeCategory?: string;
    middleCategory?: string;
    fieldCode?: string;
    workType?: string;
    organizationQuery?: string;
    targetYear?: number;
    organizationEntryStatus?: "first_observed" | "reentering" | "incumbent";
    page?: number;
    pageSize?: number;
  } = {},
  enabled = true,
) {
  const search = new URLSearchParams({
    period_years: String(filters.fromYear && filters.toYear ? filters.toYear - filters.fromYear + 1 : 5),
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 20),
  });
  if (filters.fromYear && filters.toYear) {
    search.set("period_from_year", String(filters.fromYear));
    search.set("period_to_year", String(filters.toYear));
  }
  if (filters.largeCategory) search.set("large_category", filters.largeCategory);
  if (filters.middleCategory) search.set("middle_category", filters.middleCategory);
  if (filters.fieldCode) search.set("field_code", filters.fieldCode);
  if (filters.workType) search.set("work_type", filters.workType);
  if (filters.organizationQuery) search.set("organization_query", filters.organizationQuery);
  if (filters.targetYear) search.set("target_year", String(filters.targetYear));
  if (filters.organizationEntryStatus) {
    search.set("organization_entry_status", filters.organizationEntryStatus);
  }
  return useQuery({
    queryKey: ["company-procurement-profile", businessNumber, filters],
    queryFn: ({ signal }) =>
      api<CompanyProcurementProfile>(
        `/companies/${encodeURIComponent(businessNumber!)}/procurement-profile?${search}`,
        { signal },
      ),
    enabled: Boolean(businessNumber) && enabled,
    staleTime: 10 * 60_000,
    placeholderData: (previous) => previous,
  });
}

export type CompanyCompetitorsResponse = {
  items: Array<{
    company_number: string;
    company_name: string;
    co_participation_count: number;
    latest_co_participation_date?: string;
  }>;
  pagination: { page: number; page_size: number; total_items: number; total_pages: number };
  data_completeness?: { status?: string; missing_reasons?: string[] };
};
export function useCompanyCompetitors(
  businessNumber: string | undefined,
  filters: {
    fromYear: number;
    toYear: number;
    largeCategory?: string;
    middleCategory?: string;
    fieldCode?: string;
    workType?: string;
  },
  enabled = true,
) {
  const search = new URLSearchParams({
    period_from_year: String(filters.fromYear),
    period_to_year: String(filters.toYear),
    page: "1",
    page_size: "5",
  });
  if (filters.largeCategory) search.set("large_category", filters.largeCategory);
  if (filters.middleCategory) search.set("middle_category", filters.middleCategory);
  if (filters.fieldCode) search.set("field_code", filters.fieldCode);
  if (filters.workType) search.set("work_type", filters.workType);
  return useQuery({
    queryKey: ["company-competitors", businessNumber, filters],
    queryFn: ({ signal }) =>
      api<CompanyCompetitorsResponse>(
        `/companies/${encodeURIComponent(businessNumber!)}/competitors?${search}`,
        { signal },
      ),
    enabled: Boolean(businessNumber) && enabled,
    staleTime: 10 * 60_000,
    placeholderData: (previous) => previous,
  });
}
