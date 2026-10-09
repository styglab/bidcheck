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
    queryFn: ({ signal }) =>
      api<{ items: Organization[]; pagination?: { total_items: number }; registry_version?: string }>(
        `/organizations?q=${encodeURIComponent(query)}`,
        { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) },
      ),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 60_000,
    retry: false,
  });
}

export function useOrganization(code?: string) {
  return useQuery({
    queryKey: ["organization", code],
    queryFn: ({ signal }) =>
      api<{ organization: Organization; registry_version?: string }>(
        `/organizations/${encodeURIComponent(code!)}`,
        { signal },
      ),
    enabled: Boolean(code),
    staleTime: 30 * 60_000,
  });
}

type ProcurementFilters = {
  largeCategory?: string;
  middleCategory?: string;
  fieldCode?: string;
  workType?: string;
};

export function useOrganizationActivity(
  code?: string,
  enabled = true,
  periodYears = 5,
  page = 1,
  query?: string,
  filters: ProcurementFilters = {},
  kind: "awards" | "contracts" = "awards",
  periodRange?: { from: number; to: number },
) {
  const search = new URLSearchParams({
    period_years: String(periodYears),
    page: String(page),
    page_size: "20",
    kind,
  });
  if (periodRange) {
    search.set("period_from_year", String(periodRange.from));
    search.set("period_to_year", String(periodRange.to));
  }
  if (query) search.set("q", query);
  if (filters.largeCategory) search.set("large_category", filters.largeCategory);
  if (filters.middleCategory) search.set("middle_category", filters.middleCategory);
  if (filters.fieldCode) search.set("field_code", filters.fieldCode);
  if (filters.workType) search.set("work_type", filters.workType);
  return useQuery({
    queryKey: ["organization-activity", code, periodYears, periodRange, page, query, filters, kind],
    queryFn: ({ signal }) =>
      api<{
        awards: import("../notices/api").ProcurementAward[];
        award_pagination: { page?: number; total_items?: number; total_pages?: number };
        contracts: import("../notices/api").ProcurementContract[];
        contract_pagination: { page?: number; total_items?: number; total_pages?: number };
      }>(`/organizations/${encodeURIComponent(code!)}/activity?${search}`, { signal }),
    enabled: Boolean(code) && enabled,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
}

export type ProcurementOutcomeCompany = {
  business_registration_number?: string;
  company_name?: string;
  company_role?: string;
  company_role_label?: string;
  share_percent?: number;
};
export type ProcurementOutcome = {
  outcome_id: string;
  bid_notice_id?: string;
  notice_name?: string;
  organization_code?: string;
  organization_name?: string;
  stage: "award" | "contract";
  stage_name?: string;
  latest_activity_date?: string;
  work_type?: string;
  field_code?: string;
  field_name?: string;
  large_category?: string;
  middle_category?: string;
  award?: {
    award_id?: string;
    award_date?: string;
    winner_name?: string;
    winner_business_registration_number?: string;
    winning_amount?: number;
    winning_rate?: number;
  };
  contract?: {
    contract_event_id?: string;
    unified_contract_number?: string;
    first_contract_date?: string;
    contract_date?: string;
    contract_amount?: number;
    contract_version_count?: number;
    lead_contractor?: ProcurementOutcomeCompany;
    contractor_count?: number;
    contractors?: ProcurementOutcomeCompany[];
  };
};
export function useOrganizationOutcomes(
  code?: string,
  enabled = true,
  periodRange?: { from: number; to: number },
  page = 1,
  query?: string,
  filters: ProcurementFilters = {},
) {
  const search = new URLSearchParams({
    period_from_year: String(periodRange?.from),
    period_to_year: String(periodRange?.to),
    page: String(page),
    page_size: "20",
  });
  if (query) search.set("q", query);
  if (filters.largeCategory) search.set("large_category", filters.largeCategory);
  if (filters.middleCategory) search.set("middle_category", filters.middleCategory);
  if (filters.fieldCode) search.set("field_code", filters.fieldCode);
  if (filters.workType) search.set("work_type", filters.workType);
  return useQuery({
    queryKey: ["organization-outcomes", code, periodRange, page, query, filters],
    queryFn: ({ signal }) =>
      api<{
        items: ProcurementOutcome[];
        pagination: { page: number; total_items: number; total_pages: number };
        registry_version?: string;
      }>(`/organizations/${encodeURIComponent(code!)}/outcomes?${search}`, { signal }),
    enabled: Boolean(code && periodRange && enabled),
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
}

export type ProcurementActivityStage =
  "all" | "scheduled" | "open" | "closed" | "award" | "contract" | "failed_or_cancelled";
export type ProcurementActivity = Omit<ProcurementOutcome, "outcome_id" | "stage"> & {
  activity_id: string;
  notice_linkage: "linked" | "unlinked";
  stage: Exclude<ProcurementActivityStage, "all">;
  project_amount?: number;
  project_amount_basis?: string;
  project_amount_basis_name?: string;
  notice?: {
    published_at?: string;
    bid_begin_at?: string;
    deadline_at?: string;
    status?: string;
    notice_status?: string;
    allocated_budget?: number;
    estimated_price?: number;
    base_amount?: number;
    display_amount?: number;
    display_amount_basis?: string;
    display_amount_basis_name?: string;
  };
};
export function useOrganizationProcurementActivity(
  code?: string,
  enabled = true,
  periodRange?: { from: number; to: number },
  page = 1,
  query?: string,
  stage: ProcurementActivityStage = "all",
  filters: ProcurementFilters = {},
) {
  const search = new URLSearchParams({
    period_from_year: String(periodRange?.from),
    period_to_year: String(periodRange?.to),
    page: String(page),
    page_size: "20",
    stage,
  });
  if (query) search.set("q", query);
  if (filters.largeCategory) search.set("large_category", filters.largeCategory);
  if (filters.middleCategory) search.set("middle_category", filters.middleCategory);
  if (filters.fieldCode) search.set("field_code", filters.fieldCode);
  if (filters.workType) search.set("work_type", filters.workType);
  return useQuery({
    queryKey: ["organization-procurement-activity", code, periodRange, page, query, stage, filters],
    queryFn: ({ signal }) =>
      api<{
        items: ProcurementActivity[];
        stage_counts: Record<ProcurementActivityStage, number>;
        linkage_counts: { linked: number; unlinked: number };
        pagination: { page: number; total_items: number; total_pages: number };
        registry_version?: string;
      }>(`/organizations/${encodeURIComponent(code!)}/procurement-activity?${search}`, { signal }),
    enabled: Boolean(code && periodRange && enabled),
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
  result_confirmed_participation_count?: number;
  successful_participation_count?: number;
  award_success_rate?: number | null;
  award_event_count: number;
  contract_event_count: number;
  contract_version_count?: number;
  unique_project_count?: number;
  total_attributed_contract_amount?: number;
  amount_completeness: "complete" | "partial" | "unknown";
  first_activity_date?: string;
  latest_activity_date?: string;
  latest_contract_date?: string;
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
  major_field?: { field_code?: string; field_name?: string };
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
  result_confirmed_participation_count?: number;
  successful_participation_count?: number;
  award_success_rate?: number | null;
  award_event_count: number;
  contract_event_count: number;
  contract_version_count?: number;
  unique_project_count?: number;
  company_count: number;
  organization_count: number;
  total_attributed_contract_amount?: number;
  amount_completeness: "complete" | "partial" | "unknown";
  average_contract_amount?: number;
  previous_period_comparison?: {
    basis?: string;
    current_year?: number;
    comparison_year?: number;
    contract_amount_change_rate?: number;
    contract_event_count_change?: number;
    comparable?: boolean;
    comparison_note?: string | null;
  };
  supplier_entry?: SupplierEntry;
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
export type SupplierEntryCompany = {
  company_number?: string;
  company_name?: string;
  entry_status: "first_observed" | "reentering" | "incumbent" | string;
  entry_status_name?: string;
  target_year_contract_count: number;
  target_year_attributed_contract_amount?: number;
  amount_completeness?: "complete" | "partial" | "unknown";
  target_year_first_contract_date?: string;
  target_year_latest_contract_date?: string;
  first_observed_contract_date?: string;
  previous_contract_date?: string | null;
  reentry_contract_date?: string | null;
};
export type SupplierEntry = {
  target_year: number;
  period_from: string;
  period_to: string;
  lookback_from: string;
  lookback_to: string;
  lookback_years: number;
  basis?: string;
  first_observed_company_count: number;
  reentering_company_count: number;
  incumbent_company_count: number;
  total_company_count: number;
  first_observed_company_rate: number;
  reentering_company_rate?: number;
  entry_and_reentry_company_count?: number;
  entry_and_reentry_rate?: number;
  history_available_from?: string;
  history_complete_for_lookback?: boolean;
  history_complete_for_first_observed?: boolean;
  minimum_sample_size?: number;
  sample_sufficient?: boolean;
  company_preview?: SupplierEntryCompany[];
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
    detailed_items?: Array<{ code: string; name: string; sequence?: string }>;
    event_count: number;
    contract_event_count?: number;
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
  notice_quarter_distribution?: Array<{ quarter: number; notice_count: number; notice_share: number }>;
  notice_quarter_basis?: string;
  contract_method_distribution?: Array<{
    method: "competitive" | "direct" | "other" | "unknown" | string;
    method_name: string;
    contract_event_count: number;
    attributed_contract_amount?: number;
    contract_share: number;
    amount_share?: number;
  }>;
  company_structure?: {
    contracted_company_count: number;
    top_5_company_amount?: number;
    total_company_attributed_contract_amount?: number;
    top_5_company_amount_share?: number;
    concentration_metric?: string;
    concentration_basis?: string;
    concentration_computable?: boolean;
    concentration_note?: string;
    excluded_contract_event_count?: number;
    small_supplier_population?: boolean;
    hhi?: number;
    hhi_scale?: string;
    hhi_basis?: string;
    multi_contract_company_count: number;
    single_contract_company_count: number;
    rolling_12m?: ProcurementProfileSummary["rolling_12m_supplier_entry"];
  };
  supplier_entry?: SupplierEntry;
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
  };
  data_completeness: { status?: string; missing_reasons?: string[] };
  registry_version?: string;
  pagination?: { page?: number; page_size?: number; total_items?: number; total_pages?: number };
};
export function useOrganizationProcurementProfile(
  code?: string,
  periodYears = 5,
  filters: ProcurementFilters = {},
  enabled = true,
  periodRange?: { from: number; to: number },
  companies: {
    page?: number;
    pageSize?: number;
    query?: string;
    sort?: "contract_amount_desc" | "contract_count_desc" | "latest_contract_desc";
  } = {},
) {
  const search = new URLSearchParams({
    period_years: String(periodYears),
    page: String(companies.page ?? 1),
    page_size: String(companies.pageSize ?? 20),
  });
  if (periodRange) {
    search.set("period_from_year", String(periodRange.from));
    search.set("period_to_year", String(periodRange.to));
  }
  if (filters.largeCategory) search.set("large_category", filters.largeCategory);
  if (filters.middleCategory) search.set("middle_category", filters.middleCategory);
  if (filters.fieldCode) search.set("field_code", filters.fieldCode);
  if (filters.workType) search.set("work_type", filters.workType);
  if (companies.query) search.set("company_query", companies.query);
  if (companies.sort) search.set("sort", companies.sort);
  return useQuery({
    queryKey: ["organization-procurement-profile", code, periodYears, periodRange, filters, companies],
    queryFn: ({ signal }) =>
      api<OrganizationProcurementProfile>(
        `/organizations/${encodeURIComponent(code!)}/procurement-profile?${search}`,
        { signal },
      ),
    enabled: Boolean(code) && enabled,
    staleTime: 10 * 60_000,
    placeholderData: (previous) => previous,
  });
}
export function useOrganizationSupplierEntries(
  code?: string,
  targetYear?: number,
  filters: ProcurementFilters = {},
  enabled = true,
  page = 1,
  pageSize = 10,
) {
  const search = new URLSearchParams({
    target_year: String(targetYear),
    entry_status: "first_observed",
    sort: "contract_amount_desc",
    page: String(page),
    page_size: String(pageSize),
  });
  if (filters.largeCategory) search.set("large_category", filters.largeCategory);
  if (filters.middleCategory) search.set("middle_category", filters.middleCategory);
  if (filters.fieldCode) search.set("field_code", filters.fieldCode);
  if (filters.workType) search.set("work_type", filters.workType);
  return useQuery({
    queryKey: ["organization-supplier-entries", code, targetYear, filters, page, pageSize],
    queryFn: ({ signal }) =>
      api<{
        items: SupplierEntryCompany[];
        supplier_entry?: SupplierEntry;
        pagination: {
          page: number;
          page_size: number;
          total_items: number;
          total_pages: number;
          sort?: string;
        };
        registry_version?: string;
      }>(`/organizations/${encodeURIComponent(code!)}/supplier-entries?${search}`, { signal }),
    enabled: Boolean(code && targetYear && enabled),
    staleTime: 10 * 60_000,
    placeholderData: (previous) => previous,
  });
}
export function useOrganizationCompanyRelationship(
  organizationCode?: string,
  companyNumber?: string,
  page = 1,
  periodYears = 5,
  filters: ProcurementFilters = {},
  enabled = true,
  periodRange?: { from: number; to: number },
) {
  const search = new URLSearchParams({
    page: String(page),
    page_size: "20",
    period_years: String(periodYears),
  });
  if (periodRange) {
    search.set("period_from_year", String(periodRange.from));
    search.set("period_to_year", String(periodRange.to));
  }
  if (filters.largeCategory) search.set("large_category", filters.largeCategory);
  if (filters.middleCategory) search.set("middle_category", filters.middleCategory);
  if (filters.fieldCode) search.set("field_code", filters.fieldCode);
  if (filters.workType) search.set("work_type", filters.workType);
  return useQuery({
    queryKey: [
      "organization-company-relationship",
      organizationCode,
      companyNumber,
      page,
      periodYears,
      periodRange,
      filters,
    ],
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
