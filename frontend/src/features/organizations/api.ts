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

export function useOrganizationActivity(code?: string, enabled = true, periodYears = 5, fieldCode?: string) {
  const search = new URLSearchParams({ period_years: String(periodYears) });
  if (fieldCode) search.set("field_code", fieldCode);
  return useQuery({
    queryKey: ["organization-activity", code, periodYears, fieldCode],
    queryFn: ({ signal }) => api<{ awards: import("../notices/api").ProcurementAward[]; award_pagination: { total_items?: number }; contracts: import("../notices/api").ProcurementContract[]; contract_pagination: { total_items?: number } }>(`/organizations/${encodeURIComponent(code!)}/activity?${search}`, { signal }),
    enabled: Boolean(code) && enabled,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
}

export type ProcurementRelationship = {
  company_number?: string;
  company_name?: string;
  organization_code?: string;
  organization_name?: string;
  participation_count: number;
  award_event_count: number;
  contract_event_count: number;
  contract_version_count?: number;
  unique_project_count?: number;
  total_attributed_contract_amount?: number;
  amount_completeness: "complete" | "partial" | "unknown";
  first_activity_date?: string;
  latest_activity_date?: string;
  active_years: number[];
  active_year_count: number;
  yearly_activity: Array<{
    year: number;
    participation_count: number;
    award_event_count: number;
    contract_event_count: number;
    attributed_contract_amount?: number;
    amount_completeness: "complete" | "partial" | "unknown";
  }>;
  major_fields: Array<{ code: string; name: string; event_count: number; amount?: number }>;
  representative_notices: Array<{
    bid_notice_id: string;
    notice_name: string;
    activity_type: string;
    activity_date?: string;
    amount?: number;
  }>;
};
export type ProcurementProfileSummary = {
  notice_count: number;
  participation_count: number;
  award_event_count: number;
  contract_event_count: number;
  contract_version_count?: number;
  unique_project_count?: number;
  company_count: number;
  organization_count: number;
  total_attributed_contract_amount?: number;
  amount_completeness: "complete" | "partial" | "unknown";
  rolling_12m_supplier_entry?: {
    window_months: number;
    period_from: string;
    period_to: string;
    comparison_period_from: string;
    comparison_period_to: string;
    first_observed_company_count: number;
    reentering_company_count: number;
    incumbent_company_count: number;
    total_company_count: number;
    first_observed_company_rate: number;
    entry_and_reentry_rate: number;
    history_from: string;
    history_basis: "current_5_fiscal_years" | string;
    minimum_sample_size: number;
    sample_sufficient: boolean;
  };
};
export type OrganizationProcurementProfile = {
  organization: { code: string; name: string };
  summary: ProcurementProfileSummary;
  company_relationships: ProcurementRelationship[];
  yearly_activity: Array<{
    year: number;
    notice_count: number;
    award_event_count: number;
    contract_event_count: number;
    company_count: number;
    attributed_contract_amount?: number;
    amount_completeness: "complete" | "partial" | "unknown";
  }>;
  field_distribution: Array<{
    field_code?: string;
    field_name?: string;
    large_category?: string;
    middle_category?: string;
    basic_category?: string;
    level?: "large" | "middle" | "basic" | "detailed_item";
    parent_field_code?: string;
    classification_source?: string;
    work_types?: string[];
    detailed_items?: Array<{ code: string; name: string; sequence?: string }>;
    event_count: number;
    attributed_contract_amount?: number;
    amount_share?: number;
  }>;
  work_type_distribution?: Array<{
    work_type: "goods" | "service" | "construction" | "foreign" | "other" | "unknown";
    work_type_name: string;
    event_count: number;
    participation_count: number;
    award_event_count: number;
    contract_event_count: number;
    attributed_contract_amount?: number;
  }>;
  field_options?: Array<{
    field_code: string;
    field_name: string;
    large_category?: string;
    middle_category?: string;
    basic_category?: string;
    level?: "large" | "middle" | "basic" | "detailed_item";
    parent_field_code?: string;
  }>;
  selected_field?: {
    field_code: string;
    field_name: string;
    large_category?: string;
    middle_category?: string;
    basic_category?: string;
    level?: "large" | "middle" | "basic" | "detailed_item";
  };
  analysis_basis: { period_from?: string; period_to?: string; period_years?: number; field_filter?: { large_category?: string; middle_category?: string; field_code?: string; field_name?: string }; work_type?: string };
  data_completeness: { status?: string; missing_reasons?: string[] };
  registry_version?: string;
};
export function useOrganizationProcurementProfile(code?: string, periodYears = 5, filters: { largeCategory?: string; middleCategory?: string; fieldCode?: string; workType?: string } = {}, enabled = true) {
  const search = new URLSearchParams({ period_years: String(periodYears) });
  if (filters.largeCategory) search.set("large_category", filters.largeCategory);
  if (filters.middleCategory) search.set("middle_category", filters.middleCategory);
  if (filters.fieldCode) search.set("field_code", filters.fieldCode);
  if (filters.workType) search.set("work_type", filters.workType);
  return useQuery({
    queryKey: ["organization-procurement-profile", code, periodYears, filters],
    queryFn: ({ signal }) =>
      api<OrganizationProcurementProfile>(`/organizations/${encodeURIComponent(code!)}/procurement-profile?${search}`, { signal }),
    enabled: Boolean(code) && enabled,
    staleTime: 10 * 60_000,
    placeholderData: (previous) => previous,
  });
}
export function useOrganizationCompanyRelationship(
  organizationCode?: string,
  companyNumber?: string,
  page = 1,
  periodYears = 5,
  fieldCode?: string,
  enabled = true,
) {
  const search = new URLSearchParams({ page: String(page), page_size: "20", period_years: String(periodYears) });
  if (fieldCode) search.set("field_code", fieldCode);
  return useQuery({
    queryKey: ["organization-company-relationship", organizationCode, companyNumber, page, periodYears, fieldCode],
    queryFn: ({ signal }) =>
      api<import("../notices/api").OrganizationCompanyRelationshipResponse>(
        `/organizations/${encodeURIComponent(organizationCode!)}/companies/${encodeURIComponent(companyNumber!)}/relationship?${search}`,
        { signal },
      ),
    enabled: Boolean(organizationCode && companyNumber) && enabled,
    staleTime: 10 * 60_000,
    placeholderData: (previous) => previous,
  });
}
