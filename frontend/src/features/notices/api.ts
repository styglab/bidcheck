import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/client";
export type Notice = {
  id: string;
  notice_number: string;
  notice_order: string;
  name: string;
  work_type: string;
  field_code?: string;
  field_name?: string;
  large_category?: string;
  middle_category?: string;
  status: string;
  organization: string;
  organization_code?: string;
  notice_organization: string;
  notice_organization_code?: string;
  published_at?: string;
  deadline_at?: string;
  opening_at?: string;
  bid_method?: string;
  contract_method?: string;
  estimated_price?: number;
  allocated_budget?: number;
  detail_url?: string;
  notice_kind?: "original" | "re_notice" | "correction" | "cancellation" | "unknown";
  notice_kind_name?: string;
  is_re_notice?: boolean;
  notice_lineage_id?: string;
  root_bid_notice_id?: string;
  previous_bid_notice_id?: string;
  superseded_by_bid_notice_id?: string;
  latest_bid_notice_id?: string;
  is_latest_in_lineage?: boolean;
  lineage_status?: string;
  lineage_confidence?: string;
  lineage_count?: number;
  lineage_notices?: Array<{ bid_notice_id: string; notice_kind?: string; notice_published_at?: string }>;
  extraction_completeness?: string;
  requires_review: boolean;
  requirement_expression?: RequirementExpression;
};
export type RequirementExpression = {
  operator: "all" | "any" | "leaf";
  conditions?: RequirementExpression[];
  requirement_id?: string | null;
};
export type Requirement = {
  id: string;
  local_id?: string;
  type: string;
  operator?: string;
  title: string;
  industry_code?: string;
  applicability?: string;
  original_text?: string;
  proposition_text?: string;
  mandatory: boolean;
  confidence?: string;
  evidence_summary?: string;
  proof_summary?: string;
  comparison_mode?: string;
  observed_at?: string;
  assessment_stage?: "bid_entry" | "qualification_review" | "contracting";
  failure_effect?: string;
  review_status?: string;
  evidence: RequirementEvidence[];
};
export type RequirementEvidence = {
  id: string;
  requirement_id?: string;
  source_type?: string;
  document_id?: string;
  source_document?: string;
  source_page?: number;
  source_clause?: string;
  source_excerpt?: string;
  source_url?: string;
};
export type ParticipationFinding = {
  id: string;
  category: "participation_note" | "performance_obligation" | "competition_risk_signal";
  title?: string;
  description?: string;
  deadline_text?: string;
  failure_effect?: string;
  importance?: string;
  review_status?: string;
  competitive_effect?: string;
  legitimate_justification?: string;
  evidence: Array<{
    id: string;
    source_document?: string;
    source_page?: number;
    source_clause?: string;
    source_excerpt?: string;
    source_url?: string;
  }>;
};
export type NoticeFilters = {
  q?: string;
  work_type?: string;
  published_from?: string;
  published_to?: string;
  deadline_from?: string;
  deadline_to?: string;
  contract_method?: string;
  price_min?: string;
  price_max?: string;
  notice_organization_code?: string;
  demand_organization_code?: string;
  large_category?: string;
  middle_category?: string;
  field_code?: string;
  include_history?: boolean;
  lineage_mode?: "all" | "latest_only" | "grouped";
  sort?: string;
  page?: number;
  page_size?: number;
};
type SearchResponse = {
  items: Notice[];
  pagination: { page: number; page_size: number; total_items: number; total_pages: number };
  truncated: boolean;
  registry_version?: string;
};
type DetailResponse = {
  notice: Notice;
  requirements: Requirement[];
  requirement_set?: {
    id: string;
    requirement_expression?: RequirementExpression;
    requirement_categories: Record<string, { completeness?: string; applicability?: string }>;
    region_requirement_status?: string;
    industry_license_requirement_status?: string;
    requirement_extraction_status?: string;
    requires_review: boolean;
  } | null;
  requirement_state: string;
  participation_findings: ParticipationFinding[];
  registry_version?: string;
};
export function noticeQueryOptions(filters: NoticeFilters = {}) {
  const search = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  return queryOptions({
    queryKey: ["notices", filters],
    queryFn: ({ signal }) => api<SearchResponse>(`/bids?${search}`, { signal }),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });
}
export function useNotices(filters: NoticeFilters = {}, enabled = true) {
  return useQuery({ ...noticeQueryOptions(filters), enabled });
}
export function useNotice(noticeId?: string) {
  return useQuery({
    queryKey: ["notice", noticeId],
    queryFn: ({ signal }) => api<DetailResponse>(`/bids/${encodeURIComponent(noticeId!)}`, { signal }),
    enabled: Boolean(noticeId),
    staleTime: 60_000,
  });
}
export type ProcurementParticipation = {
  id: string;
  bid_notice_id?: string;
  notice_number?: string;
  notice_order?: string;
  company_number?: string;
  company_name?: string;
  rank?: number;
  bid_amount?: number;
  bid_rate?: number | string;
  bid_at?: string;
  result?: string;
  remark?: string;
  bid_classification_number?: string;
  rebid_number?: string;
  result_confirmed?: boolean;
};
export type ProcurementAward = {
  id: string;
  bid_notice_id?: string;
  notice_number?: string;
  notice_order?: string;
  notice_name?: string;
  company_number?: string;
  company_name?: string;
  winning_amount?: number;
  winning_rate?: number | string;
  participant_count?: number;
  opening_at?: string;
  award_date?: string;
  notice_published_date?: string;
  organization_code?: string;
  organization_name?: string;
};
export type ProcurementContract = {
  id: string;
  name?: string;
  type?: string;
  notice_number?: string;
  bid_notice_id?: string;
  amount?: number;
  concluded_date?: string;
  contract_date?: string;
  period?: string;
  method?: string;
  detail_url?: string;
  contract_number?: string;
  unified_contract_number?: string;
  department_name?: string;
  payment_method_name?: string;
  guarantee_deposit_rate?: number | string;
  basis_law_name?: string;
  long_term_continuation_type?: string;
  field_code?: string;
  field_name?: string;
  organization_code?: string;
  contractors?: Array<{
    business_registration_number?: string;
    company_name?: string;
    company_role?: "sole" | "consortium_lead" | "consortium_member";
    company_role_label?: string;
    share_percent?: number | null;
    share_completeness?: "complete" | "unknown" | "invalid";
  }>;
  lead_contractor?: {
    business_registration_number?: string;
    company_name?: string;
    company_role?: "sole" | "consortium_lead" | "consortium_member";
    company_role_label?: string;
    share_percent?: number | null;
    share_completeness?: "complete" | "unknown" | "invalid";
  };
  contractor_count?: number;
  contractor_completeness?: string;
};
export function useNoticeActivity(noticeId?: string, enabled = true) {
  return useQuery({
    queryKey: ["notice-activity", noticeId],
    queryFn: ({ signal }) =>
      api<{
        participations: ProcurementParticipation[];
        awards: ProcurementAward[];
        contracts: ProcurementContract[];
        participation_summary?: {
          source_participant_count: number;
          stored_participant_count: number;
          returned_participant_count: number;
          retention_policy?: string;
          data_completeness?: { status?: string; missing_reasons?: string[] };
        };
      }>(`/bids/${encodeURIComponent(noticeId!)}/activity`, { signal }),
    enabled: Boolean(noticeId) && enabled,
    staleTime: 5 * 60_000,
  });
}
export type BidRelationshipContext = {
  bid_notice: {
    bid_notice_id: string;
    notice_name: string;
    organization_code?: string;
    organization_name?: string;
  };
  lifecycle: { status: string; participation_count: number; award_count: number; contract_count: number };
  participants: Array<{
    business_registration_number?: string;
    company_name?: string;
    opening_rank?: number;
    bid_amount?: number;
    bid_rate?: number | string;
    result?: string;
    current_award?: {
      awarded?: boolean;
      award_date?: string;
      winning_amount?: number;
      winning_rate?: number | string;
    };
    current_contract?: {
      contracted?: boolean;
      contract_date?: string;
      contract_amount?: number;
      attributed_contract_amount?: number;
      company_role?: string;
      share_percent?: number;
      amount_completeness?: "complete" | "partial" | "unknown";
    };
    prior_organization_relationship?: {
      participation_count?: number;
      award_event_count?: number;
      contract_event_count?: number;
      total_attributed_contract_amount?: number;
      amount_completeness?: "complete" | "partial" | "unknown";
      first_activity_date?: string;
      latest_activity_date?: string;
      latest_contract_date?: string;
      active_years?: number[];
      yearly_activity?: Array<Record<string, unknown>>;
    };
  }>;
  contracts: Array<Record<string, unknown>>;
  analysis_basis: { period_from?: string; period_to?: string; prior_relationship_cutoff?: string };
  data_completeness: { status?: string; missing_reasons?: string[] };
  registry_version?: string;
};
export function useBidRelationshipContext(noticeId?: string, enabled = true) {
  return useQuery({
    queryKey: ["bid-relationship-context", noticeId],
    queryFn: ({ signal }) =>
      api<BidRelationshipContext>(`/bids/${encodeURIComponent(noticeId!)}/relationship-context`, { signal }),
    enabled: Boolean(noticeId) && enabled,
    staleTime: 10 * 60_000,
  });
}
export type NoticeMarketContext = {
  query_basis: string;
  signals: Array<{ type: string; label: string; tone: "info" | "relation" | "review" }>;
  companies: Array<{
    company_number: string;
    company_name: string;
    participation_count: number;
    award_count: number;
    contract_count: number;
    organization_award_count: number;
    organization_participation_count: number;
    organization_contract_count: number;
    organization_contract_amount?: number;
    organization_latest_activity_date?: string;
    organization_similar_participation_count: number;
    organization_similar_award_count: number;
    organization_similar_contract_count: number;
    region_status?: "satisfied" | "unsatisfied" | "needs_review" | "unknown" | "not_applicable";
    industry_license_status?: "satisfied" | "unsatisfied" | "needs_review" | "unknown" | "not_applicable";
    required_industries?: unknown[];
    required_licenses?: unknown[];
    matched_industries?: unknown[];
    matched_licenses?: unknown[];
    industry_license_reference_date?: string;
    signals?: string[];
    total_amount: number;
    latest_award_date?: string;
    notice_ids: string[];
    activities?: Array<{
      bid_notice_id: string;
      notice_name?: string;
      organization_code?: string;
      organization_name?: string;
      participated: boolean;
      awarded: boolean;
      contracted: boolean;
      award_date?: string;
      notice_published_date?: string;
      activity_date?: string;
      opening_rank?: number;
      bid_amount?: number | string;
      result?: "awarded" | "not_awarded" | "participation_only" | "contracted";
      bid_classification_number?: string;
      rebid_number?: string;
      unified_contract_number?: string;
      winning_amount?: number;
      is_similar_notice?: boolean;
      is_same_organization?: boolean;
    }>;
  }>;
  similar_notices: Array<
    ProcurementAward & {
      similarity_reasons: string[];
      similarity_score: number;
      similarity_level?: "high" | "medium" | "low";
      matched_features?: Record<string, unknown>;
      relationship_type?: "same_project" | "similar_notice" | "related_candidate";
      comparison_eligible?: boolean;
      comparison_exclusion_reasons?: string[];
    }
  >;
  sample_size: number;
  period_years: number;
};
export function useNoticeMarketContext(noticeId?: string, enabled = true) {
  return useQuery({
    queryKey: ["notice-market-context", noticeId],
    queryFn: ({ signal }) =>
      api<NoticeMarketContext>(`/bids/${encodeURIComponent(noticeId!)}/market-context`, { signal }),
    enabled: Boolean(noticeId) && enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
}
export type OrganizationFieldCompany = {
  company_number: string;
  company_name: string;
  relationship_group: "organization_field" | "market_similar" | "organization_other";
  same_organization_award_count: number;
  same_organization_contract_count: number;
  same_organization_contract_amount?: number;
  same_organization_contract_amount_complete: boolean;
  same_field_award_count: number;
  same_field_contract_count: number;
  same_project_type_count: number;
  similar_amount_count: number;
  latest_activity_date?: string;
  matched_factors: string[];
  sample_notice_ids: string[];
  same_field_event_count?: number;
  same_project_type_event_count?: number;
  similar_amount_event_count?: number;
  first_award_date?: string;
  latest_award_date?: string;
  active_years?: number[];
  active_year_count?: number;
  consecutive_active_years?: number;
  annual_activity?: Array<{
    year: number;
    award_event_count: number;
    attributed_contract_amount?: number;
    amount_completeness: "complete" | "partial" | "unknown";
    sole_count: number;
    consortium_lead_count: number;
    consortium_member_count: number;
  }>;
  same_field_contract_amount?: number;
  same_field_contract_amount_complete?: boolean;
  representative_notices?: Array<{
    notice_id: string;
    notice_name?: string;
    awarded_at?: string;
    amount?: number;
    project_type?: string;
    is_similar_amount?: boolean;
  }>;
  organization_relationship?: {
    award_event_count: number;
    yearly_activity: Array<{
      year: number;
      award_event_count: number;
      attributed_contract_amount?: number;
      amount_completeness: "complete" | "partial" | "unknown";
      sole_count: number;
      consortium_lead_count: number;
      consortium_member_count: number;
    }>;
    total_attributed_contract_amount?: number;
    amount_completeness: "complete" | "partial" | "unknown";
  };
  similar_project_experience?: {
    candidate_count?: number;
    event_count: number;
    strong_event_count?: number;
    limited_event_count?: number;
    reference_only_event_count?: number;
    similar_amount_event_count: number;
  };
};
export type OrganizationFieldCompaniesResponse = {
  bid_notice_id: string;
  organization?: { code?: string; name?: string };
  analysis_basis?: {
    period_years?: number;
    period_from?: string;
    period_to?: string;
    period_type?: string;
    work_type?: string;
    field?: { code?: string; label?: string };
    industries?: Array<{ code: string; name: string }>;
    project_type?: { code?: string; label?: string };
    project_type_label?: string;
    similar_amount_range?: {
      reference_amount?: number;
      minimum_amount?: number;
      maximum_amount?: number;
      rule?: string;
    };
    observation_started_at?: string;
  };
  market_structure?: {
    award_event_count?: number;
    company_count?: number;
    repeat_company_count?: number;
    single_award_company_count?: number;
    similar_amount_company_count?: number;
    top_1_share?: number;
    top_3_share?: number;
    top_5_share?: number;
    company_distribution?: {
      one?: number;
      two_to_three?: number;
      four_to_nine?: number;
      ten_or_more?: number;
    };
  };
  market_entry?: {
    definition?: string;
    classification?: string;
    observation_started_at?: string;
    recent_new_entrant_count?: number;
    recent_years?: Array<{
      year: number;
      incumbent_award_count: number;
      new_entrant_award_count: number;
      new_entrant_company_count: number;
    }>;
    companies?: Array<{
      company_number: string;
      company_name: string;
      first_award_date?: string;
      representative_notice_id?: string;
      classification?: string;
    }>;
  };
  organization_field_companies: OrganizationFieldCompany[];
  market_similar_companies: OrganizationFieldCompany[];
  organization_other_companies: OrganizationFieldCompany[];
  policy: Record<string, unknown>;
  registry_version?: string;
};
export function useNoticeOrganizationFieldCompanies(noticeId?: string, enabled = true) {
  return useQuery({
    queryKey: ["notice-organization-field-companies", noticeId],
    queryFn: ({ signal }) =>
      api<OrganizationFieldCompaniesResponse>(
        `/bids/${encodeURIComponent(noticeId!)}/organization-field-companies`,
        { signal },
      ),
    enabled: Boolean(noticeId) && enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export type BidParticipationContext = {
  analysis_basis?: {
    period_from?: string;
    period_to?: string;
    period_years?: number;
    field_filter?: Record<string, string>;
  };
  market_entry?: {
    status?: string;
    reference_year?: number;
    is_year_to_date?: boolean;
    contracted_company_count?: number;
    new_supplier_company_count?: number;
    new_supplier_rate?: number;
    lookback_years?: number;
    completeness?: string;
  };
  supplier_concentration?: {
    status?: string;
    company_count?: number;
    contract_event_count?: number;
    total_contract_amount?: number;
    top_1_share?: number;
    top_3_share?: number;
    top_5_share?: number;
    amount_completeness?: string;
  };
  project_scale?: {
    status?: string;
    current_project_amount?: number;
    current_project_amount_basis?: string;
    comparison_event_count?: number;
    median_project_amount?: number;
    percentile?: number;
    amount_completeness?: string;
  };
  competition?: {
    status?: string;
    source_bid_count?: number;
    overall_average_participant_count?: number;
    overall_median_participant_count?: number;
    recent_5_average_participant_count?: number;
    previous_5_average_participant_count?: number;
    completeness?: string;
    completeness_reason?: string | null;
  };
  peer_benchmark?: {
    status?: string;
    peer_organization_count?: number;
    supplier_concentration?: {
      current_value?: number;
      peer_median?: number;
      percentile?: number;
      peer_organization_count?: number;
      interpretation_allowed?: boolean;
      minimum_sample_satisfied?: boolean;
      completeness?: string;
    };
    new_supplier_amount_share?: {
      current_value?: number;
      peer_median?: number;
      percentile?: number;
      new_supplier_contract_amount?: number;
      total_eligible_contract_amount?: number;
      new_supplier_company_count?: number;
      contracted_company_count?: number;
      interpretation_allowed?: boolean;
    };
    competition?: {
      participant_count_median?: { current_value?: number; peer_median?: number; percentile?: number };
      single_participant_share?: { current_value?: number; peer_median?: number; percentile?: number };
      current_bid_count?: number;
      interpretation_allowed?: boolean;
      completeness?: string;
    };
  };
  new_supplier_similar_amount_cases?: {
    status?: string;
    reference_amount?: number;
    amount_range?: { minimum_amount?: number; maximum_amount?: number; rule?: string };
    eligible_case_count?: number;
    similar_amount_contract_event_count?: number;
    completeness?: string;
    items?: Array<{
      company_number: string;
      company_name: string;
      contract_event_id?: string;
      unified_contract_number?: string;
      contract_name?: string;
      bid_notice_id?: string | null;
      notice_name?: string | null;
      first_contract_date?: string;
      attributed_contract_amount?: number;
      current_notice_amount_difference_rate?: number;
      entry_classification?: string;
      notice_linkage?: string;
      relationship_context?: {
        organization_code?: string;
        company_number?: string;
        contract_event_id?: string;
        period_from_year?: number;
        period_to_year?: number;
        work_type?: string;
        large_category?: string;
        middle_category?: string;
        field_code?: string;
      };
    }>;
  };
  attention_suppliers?: Array<{
    company_number: string;
    company_name: string;
    contract_event_count?: number;
    attributed_contract_amount?: number;
    latest_contract_date?: string;
    first_contract_date?: string;
    first_contract_status?: string;
    attention_reasons?: string[];
    display_attention_reasons?: string[];
    attention_reason_evidence?: Record<string, Record<string, unknown>>;
    relationship_context?: {
      organization_code?: string;
      company_number?: string;
      period_from_year?: number;
      period_to_year?: number;
      work_type?: string;
      large_category?: string;
      middle_category?: string;
      field_code?: string;
    };
  }>;
  top_suppliers?: Array<{
    company_number: string;
    company_name: string;
    award_event_count?: number;
    contract_event_count?: number;
    attributed_contract_amount?: number;
    latest_contract_date?: string;
    active_years?: number[];
    consecutive_active_years?: number;
    entry_classification?: string;
    same_organization_field_contract_count?: number;
    same_organization_field_contract_amount?: number;
    other_organization_same_field_contract_count?: number;
    other_organization_same_field_contract_amount?: number;
    similar_amount_contract_count?: number;
    new_supplier_case_count?: number;
    attention_reasons?: string[];
  }>;
  related_past_projects?: Array<{
    bid_notice_id: string;
    notice_name: string;
    notice_kind?: string;
    notice_lineage_id?: string;
    lineage_count?: number;
    root_bid_notice_id?: string;
    relationship_type?: string;
    notice_published_at?: string;
    awarded_company_number?: string | null;
    awarded_company_name?: string | null;
    contract_amount?: number | null;
    contract_date?: string | null;
  }>;
  data_completeness?: { status?: string; missing_reasons?: string[] };
  registry_version?: string;
};

export function useBidParticipationContext(noticeId?: string, enabled = true) {
  return useQuery({
    queryKey: ["bid-participation-context-v4", noticeId],
    queryFn: ({ signal }) =>
      api<BidParticipationContext>(`/bids/${encodeURIComponent(noticeId!)}/participation-context`, {
        signal,
      }),
    enabled: Boolean(noticeId) && enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export type RelatedProjectFilter =
  "all" | "similar_amount" | "entry_or_reentering_supplier" | "repeat_supplier";
export type RelatedProjectsResponse = {
  items: Array<{
    bid_notice_id?: string | null;
    notice_name: string;
    notice_published_at?: string | null;
    contract_event_id?: string;
    unified_contract_number?: string;
    project_amount?: number;
    contract_amount?: number;
    contract_date?: string;
    first_contract_date?: string;
    latest_contract_version_date?: string;
    contract_version_count?: number;
    company_number?: string;
    company_name?: string;
    contractor_count?: number;
    contractor_amount_completeness?: string;
    relationship_status_summary?: "entry_or_reentering" | "repeat" | "mixed";
    is_similar_amount?: boolean;
    supplier_entry_classification?: string;
    is_repeat_supplier?: boolean;
    contract_time_relationship_status?: "entry_or_reentering" | "repeat";
    contract_time_relationship_status_name?: string;
    prior_same_organization_field_contract_count?: number;
    history_period_from?: string;
    history_period_to?: string;
    classification_basis?: string;
    matched_filters?: string[];
    contractors?: Array<{
      company_number?: string;
      company_name?: string;
      attributed_contract_amount?: number;
      supplier_entry_classification?: string;
      is_repeat_supplier?: boolean;
      contract_time_relationship_status?: "entry_or_reentering" | "repeat";
      contract_time_relationship_status_name?: string;
      prior_same_organization_field_contract_count?: number;
    }>;
  }>;
  filter_counts: Record<RelatedProjectFilter, number>;
  applied_filter?: { filters?: RelatedProjectFilter[]; operator?: "and" | "or"; total_items?: number };
  pagination: { page: number; page_size: number; total_items: number; total_pages: number };
  analysis_basis?: { organization_code?: string };
  registry_version?: string;
};
export function useNoticeRelatedProjects(
  noticeId?: string,
  projectFilters: RelatedProjectFilter[] = [],
  page = 1,
  enabled = true,
) {
  const filterKey = [...projectFilters].sort().join(",");
  return useQuery({
    queryKey: ["notice-related-projects-v5", noticeId, filterKey, page],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        filter_operator: "and",
        sort: "recent_desc",
        page: String(page),
        page_size: "5",
      });
      projectFilters.forEach((filter) => params.append("project_filters", filter));
      return api<RelatedProjectsResponse>(
        `/bids/${encodeURIComponent(noticeId!)}/related-projects?${params.toString()}`,
        { signal },
      );
    },
    enabled: Boolean(noticeId) && enabled,
    placeholderData: (previous) => previous,
    staleTime: 10 * 60_000,
  });
}
export type OrganizationCompanyRelationshipResponse = {
  bid_notice_id?: string;
  organization?: { code?: string; name?: string };
  company?: { business_registration_number?: string; name?: string };
  analysis_basis?: {
    period_years?: number;
    reference_bid_notice_id?: string;
    observation_started_at?: string;
  };
  summary?: {
    award_event_count?: number;
    contract_event_count?: number;
    contract_version_count?: number;
    unique_project_count?: number;
    total_attributed_contract_amount?: number;
    first_award_date?: string;
    latest_award_date?: string;
    active_years?: number[];
    active_year_count?: number;
    consecutive_active_years?: number;
    similar_amount_event_count?: number;
  };
  yearly_activity?: Array<{
    year: number;
    event_count?: number;
    award_event_count?: number;
    attributed_event_count?: number;
    total_attributed_amount?: number;
    attributed_contract_amount?: number;
  }>;
  major_fields?: Array<{ code: string; name: string; event_count: number; amount?: number }>;
  events: Array<{
    award_event_id: string;
    bid_notice_id: string;
    notice_name?: string;
    notice_published_date?: string;
    award_date?: string;
    contract_date?: string;
    attribution_date?: string;
    attribution_date_basis?: string;
    first_contract_date?: string;
    latest_contract_version_date?: string;
    project_type?: string;
    project_type_label?: string;
    award_amount?: number;
    contract_amount?: number;
    attributed_contract_amount?: number;
    attributed_contract_amount_completeness: "complete" | "partial" | "unknown";
    joint_contract?: boolean;
    company_role?: "sole" | "consortium_lead" | "consortium_member";
    share_percent?: number;
    share_source?: string;
    is_similar_amount?: boolean;
    similar_amount_reason?: string;
  }>;
  pagination: { page: number; page_size: number; total_items: number; total_pages: number };
  data_completeness?: { status?: string; missing_reasons?: string[] };
  registry_version?: string;
};
export function useNoticeOrganizationCompanyRelationship(
  noticeId?: string,
  organizationCode?: string,
  companyNumber?: string,
  page = 1,
) {
  const search = new URLSearchParams({
    organization_code: organizationCode ?? "",
    company_number: companyNumber ?? "",
    page: String(page),
    page_size: "5",
  });
  return useQuery({
    queryKey: ["notice-organization-company-relationship", noticeId, organizationCode, companyNumber, page],
    queryFn: ({ signal }) =>
      api<OrganizationCompanyRelationshipResponse>(
        `/bids/${encodeURIComponent(noticeId!)}/organization-company-relationship?${search}`,
        { signal },
      ),
    enabled: Boolean(noticeId && organizationCode && companyNumber),
    staleTime: 10 * 60_000,
    placeholderData: (previous) => previous,
    retry: false,
  });
}
export type ProjectLineageResponse = {
  bid_notice_id: string;
  items: Array<{
    relationship_type: string;
    candidate_relationship_type?: string;
    predecessor_bid_notice_id: string;
    successor_bid_notice_id: string;
    project_stage?: { predecessor?: string[]; successor?: string[] };
    performing_company_number?: string;
    performing_company_name?: string;
    contract_amount?: number;
    performance_period?: string;
    confidence?: number;
    reason_codes?: string[];
    evidence?: Array<{ source_type?: string; bid_notice_id?: string; original_text?: string }>;
    confirmation_status?: string;
  }>;
  policy?: Record<string, unknown>;
  registry_version?: string;
};
export function useNoticeProjectLineage(noticeId?: string, enabled = true) {
  return useQuery({
    queryKey: ["notice-project-lineage", noticeId],
    queryFn: ({ signal }) =>
      api<ProjectLineageResponse>(`/bids/${encodeURIComponent(noticeId!)}/project-lineage`, { signal }),
    enabled: Boolean(noticeId) && enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
}
export type AssessmentOutcome = "satisfied" | "unsatisfied" | "needs_review";
export type RequirementAssessment = Record<string, unknown> & {
  id: string;
  requirement_id?: string;
  outcome?: AssessmentOutcome;
  reason_code?: string;
  summary?: string;
  assessment_summary?: string;
  reasoning_summary?: string;
};
export type AssessmentResponse = {
  assessment:
    | (Record<string, unknown> & {
        outcome?: AssessmentOutcome;
        satisfied_count?: number;
        unsatisfied_count?: number;
        needs_review_count?: number;
        lifecycle_status?: string;
      })
    | null;
  requirement_assessments: RequirementAssessment[];
  evidence: Array<Record<string, unknown>>;
  registry_version?: string;
};
export function useAssessment(noticeId?: string, businessNumber?: string) {
  return useQuery({
    queryKey: ["assessment", noticeId, businessNumber],
    queryFn: () =>
      api<AssessmentResponse>("/assessments", {
        method: "POST",
        body: JSON.stringify({ notice_id: noticeId, business_registration_number: businessNumber }),
      }),
    enabled: Boolean(noticeId && /^[0-9]{10}$/.test(businessNumber ?? "")),
    staleTime: 60_000,
  });
}

export type AssessmentPreviewIssue = {
  requirement_id?: string;
  outcome?: "satisfied" | "unsatisfied" | "needs_review";
  summary?: string;
};
export type KeyOutcome = {
  applicability: "applicable" | "not_applicable" | "unknown";
  outcome: "satisfied" | "unsatisfied" | "needs_review" | null;
  satisfied_count: number;
  unsatisfied_count: number;
  needs_review_count: number;
  requirement_ids: string[];
};
export type AssessmentPreview = {
  bid_notice_id: string;
  status: "completed" | "error";
  error_code?: string;
  outcome?: "satisfied" | "unsatisfied" | "needs_review";
  satisfied_count?: number;
  unsatisfied_count?: number;
  needs_review_count?: number;
  key_outcomes?: Record<string, KeyOutcome>;
  issues?: AssessmentPreviewIssue[];
};
type BatchAssessmentResponse = {
  items: AssessmentPreview[];
  registry_version?: string;
};
export function useAssessmentPreviews(noticeIds: string[], businessNumber?: string) {
  return useQuery({
    queryKey: ["assessment-previews", businessNumber, noticeIds],
    queryFn: ({ signal }) =>
      api<BatchAssessmentResponse>("/assessments/batch", {
        method: "POST",
        body: JSON.stringify({
          business_registration_number: businessNumber,
          bid_notice_ids: noticeIds,
          participation_mode: "single",
        }),
        signal,
      }),
    enabled: Boolean(noticeIds.length && /^[0-9]{10}$/.test(businessNumber ?? "")),
    staleTime: 5 * 60_000,
  });
}
