import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/client";
export type Notice = {
  id: string;
  notice_number: string;
  notice_order: string;
  name: string;
  work_type: string;
  status: string;
  organization: string;
  notice_organization: string;
  published_at?: string;
  deadline_at?: string;
  opening_at?: string;
  bid_method?: string;
  contract_method?: string;
  estimated_price?: number;
  allocated_budget?: number;
  detail_url?: string;
  extraction_completeness?: string;
  requires_review: boolean;
};
export type Requirement = {
  id: string;
  local_id?: string;
  type: string;
  operator?: string;
  title: string;
  original_text?: string;
  proposition_text?: string;
  mandatory: boolean;
  confidence?: string;
  evidence_summary?: string;
  proof_summary?: string;
  comparison_mode?: string;
  observed_at?: string;
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
  requirement_state: string;
  participation_findings: ParticipationFinding[];
  registry_version?: string;
};
export function useNotices(filters: NoticeFilters = {}) {
  const search = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  return useQuery({
    queryKey: ["notices", filters],
    queryFn: ({ signal }) => api<SearchResponse>(`/bids?${search}`, { signal }),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });
}
export function useNotice(noticeId?: string) {
  return useQuery({
    queryKey: ["notice", noticeId],
    queryFn: ({ signal }) => api<DetailResponse>(`/bids/${encodeURIComponent(noticeId!)}`, { signal }),
    enabled: Boolean(noticeId),
    staleTime: 60_000,
  });
}
type AssessmentResponse = {
  assessment: Record<string, unknown> | null;
  requirement_assessments: Array<Record<string, unknown>>;
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
export type AssessmentPreview = {
  bid_notice_id: string;
  status: "completed" | "error";
  error_code?: string;
  outcome?: "satisfied" | "unsatisfied" | "needs_review";
  satisfied_count?: number;
  unsatisfied_count?: number;
  needs_review_count?: number;
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
