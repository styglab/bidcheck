import { queryOptions, useInfiniteQuery, useQuery, type QueryFunction } from "@tanstack/react-query";
import {
  companyProcurementQueryOptions,
  companyProcurementProfilePath,
  type CompanyActivityItem,
  type CompanyProcurementProfile,
} from "@/features/company-context/api";
import {
  organizationProcurementQueryOptions,
  type OrganizationProcurementProfile,
} from "@/features/organizations/api";
import { api } from "@/shared/api/client";
import type { ExplorerEntity } from "./useNetworkExplorer";

export type NetworkProfile = CompanyProcurementProfile | OrganizationProcurementProfile;

type ParticipationPage = {
  items: CompanyActivityItem[];
  pagination?: { total_pages?: number };
  data_completeness?: { status?: string };
};

export type SharedParticipationNotice = {
  bid_notice_id: string;
  notice_name?: string;
  notice_number?: string;
  participation_date?: string;
};

export function sharedParticipationsQueryOptions(
  firstCompanyNumber: string | undefined,
  secondCompanyNumber: string | undefined,
  fromYear: number,
  toYear: number,
  filters: { workType?: string; fieldCode?: string; largeCategory?: string; middleCategory?: string },
) {
  const baseSearch = new URLSearchParams({
    period_from_year: String(fromYear),
    period_to_year: String(toYear),
    page_size: "50",
  });
  for (const [value, key] of [
    [filters.workType, "work_type"],
    [filters.fieldCode, "field_code"],
    [filters.largeCategory, "large_category"],
    [filters.middleCategory, "middle_category"],
  ] as const) {
    if (value) baseSearch.set(key, value);
  }
  return queryOptions({
    queryKey: [
      "explorer-shared-participations",
      firstCompanyNumber,
      secondCompanyNumber,
      baseSearch.toString(),
    ],
    queryFn: async ({ signal }) => {
      const fetchCompany = async (companyNumber: string) => {
        const fetchPage = (page: number) => {
          const search = new URLSearchParams(baseSearch);
          search.set("page", String(page));
          return api<ParticipationPage>(
            `/companies/${encodeURIComponent(companyNumber)}/activity?${search}`,
            { signal },
          );
        };
        const first = await fetchPage(1);
        const totalPages = first.pagination?.total_pages ?? 1;
        const pageLimit = Math.min(totalPages, 5);
        const pages = [first];
        if (pageLimit > 1) {
          pages.push(
            ...(await Promise.all(Array.from({ length: pageLimit - 1 }, (_, index) => fetchPage(index + 2)))),
          );
        }
        return {
          items: pages.flatMap((page) => page.items ?? []),
          partial:
            totalPages > pageLimit || pages.some((page) => page.data_completeness?.status === "partial"),
        };
      };
      const [first, second] = await Promise.all([
        fetchCompany(firstCompanyNumber!),
        fetchCompany(secondCompanyNumber!),
      ]);
      const secondNoticeIds = new Set(
        second.items.map((item) => item.bid_notice_id).filter((id): id is string => Boolean(id)),
      );
      const notices = new Map<string, SharedParticipationNotice>();
      for (const item of first.items) {
        if (
          !item.bid_notice_id ||
          !secondNoticeIds.has(item.bid_notice_id) ||
          notices.has(item.bid_notice_id)
        )
          continue;
        notices.set(item.bid_notice_id, {
          bid_notice_id: item.bid_notice_id,
          notice_name: item.notice_name,
          notice_number: item.notice_number,
          participation_date: item.participation_date ?? item.bid_at,
        });
      }
      return { items: [...notices.values()].slice(0, 5), partial: first.partial || second.partial };
    },
    enabled: Boolean(firstCompanyNumber && secondCompanyNumber),
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function allCompanyOrganizationsQueryOptions(
  businessNumber: string | undefined,
  fromYear: number,
  toYear: number,
  filters: { workType?: string; fieldCode?: string; largeCategory?: string; middleCategory?: string },
  enabled = true,
) {
  const base = { fromYear, toYear, ...filters, pageSize: 100 };
  const firstPageKey = companyFirstPageQueryOptions(businessNumber, fromYear, toYear, filters).queryKey;
  return queryOptions({
    queryKey: ["explorer-all-company-organizations", businessNumber, base],
    queryFn: async ({ signal, client }) => {
      const fetchPage = (page: number) =>
        api<CompanyProcurementProfile>(companyProcurementProfilePath(businessNumber!, { ...base, page }), {
          signal,
        });
      const first = await fetchPage(1);
      client.setQueryData(firstPageKey, first);
      const pages = [first];
      const totalPages = first.pagination?.total_pages ?? 1;
      // Fetch all filtered institutions without sending an unbounded burst of requests.
      for (let page = 2; page <= totalPages; page += 5) {
        const batch = Array.from({ length: Math.min(5, totalPages - page + 1) }, (_, index) => page + index);
        pages.push(...(await Promise.all(batch.map(fetchPage))));
      }
      return {
        ...first,
        organization_relationships: pages.flatMap((result) => result.organization_relationships ?? []),
      };
    },
    enabled: Boolean(businessNumber) && enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function companyFirstPageQueryOptions(
  businessNumber: string | undefined,
  fromYear: number,
  toYear: number,
  filters: { workType?: string; fieldCode?: string; largeCategory?: string; middleCategory?: string },
) {
  const base = { fromYear, toYear, ...filters, pageSize: 100 };
  return queryOptions({
    queryKey: ["explorer-company-first-page", businessNumber, base],
    queryFn: ({ signal }) =>
      api<CompanyProcurementProfile>(companyProcurementProfilePath(businessNumber!, base), { signal }),
    enabled: false,
    staleTime: 10 * 60_000,
  });
}

export type ExplorerCandidate = {
  type: "bid_notice" | "organization" | "company" | "classification";
  id: string;
  name: string;
  number?: string | null;
  context?: {
    work_type?: string | null;
    field_code?: string | null;
    field_name?: string | null;
    large_category?: string | null;
    middle_category?: string | null;
    demand_organization_code?: string | null;
    demand_organization_name?: string | null;
    notice_organization_code?: string | null;
    notice_organization_name?: string | null;
  };
  applicable_filters?: string[];
  missing_filters?: string[];
  unsupported_filters?: string[];
};
export function useExplorerAutocomplete(query: string) {
  return useInfiniteQuery({
    queryKey: ["explorer-autocomplete", query],
    queryFn: ({ signal, pageParam }) => {
      const search = new URLSearchParams({ q: query, limit: "20" });
      if (pageParam) search.set("cursor", pageParam);
      return api<{ candidates: ExplorerCandidate[]; cursor: string | null; has_more: boolean }>(
        `/explorer/autocomplete?${search}`,
        { signal },
      );
    },
    initialPageParam: "",
    getNextPageParam: (page) => (page.has_more && page.cursor ? page.cursor : undefined),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export type ProcurementNetwork = {
  root: { type: ExplorerEntity["type"]; id: string };
  snapshot_id: string;
  nodes: Array<ExplorerEntity & { is_root?: boolean }>;
  edges: Array<{
    id: string;
    source: { type: ExplorerEntity["type"]; id: string };
    target: { type: ExplorerEntity["type"]; id: string };
    hop: number;
    relationships: {
      contract?: {
        event_count: number;
        attributed_amount: number | null;
        amount_completeness: "complete" | "partial" | "unknown";
        first_contract_date?: string;
        latest_contract_date?: string;
      } | null;
    };
  }>;
  summary: { node_count: number; edge_count: number; contract_event_count: number };
  truncation: { truncated: boolean; omitted_node_count: number | null; omitted_edge_count: number | null };
  coverage: Record<string, string>;
  updated_at?: string;
};
export function networkQueryOptions(
  root: ExplorerEntity | undefined,
  fromYear: number,
  toYear: number,
  fieldCode: string | undefined,
  workType: string | undefined,
  firstHopLimit: number,
) {
  const search = new URLSearchParams({
    root_type: root?.type ?? "organization",
    root_id: root?.id ?? "",
    field_code: fieldCode ?? "",
    from_year: String(fromYear),
    to_year: String(toYear),
    first_hop_limit: String(firstHopLimit),
    second_hop_limit: String(firstHopLimit * 2),
  });
  if (workType) search.set("work_type", workType);
  return queryOptions({
    queryKey: ["explorer-network", search.toString()],
    queryFn: ({ signal }) => api<ProcurementNetwork>(`/explorer/network?${search}`, { signal }),
    enabled: Boolean(root && fieldCode),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
export type FieldMarket = {
  field_code: string;
  summary: {
    contract_count: number;
    total_attributed_contract_amount: number | null;
    missing_attributed_amount_count: number;
    organization_count: number | null;
    company_count: number | null;
  };
  yearly: Array<{
    year: number;
    field_name?: string;
    company_count: number;
    organization_count: number;
    contract_count: number;
    total_attributed_contract_amount: number | null;
    missing_attributed_amount_count: number;
  }>;
  coverage: { is_full_market: boolean; sample?: boolean; missing_amount_count?: number };
  updated_at?: string;
};
export function fieldMarketQueryOptions(params: URLSearchParams, fromYear: number, toYear: number) {
  const fieldCode = params.get("field");
  const search = new URLSearchParams({
    field_code: fieldCode ?? "",
    from_year: String(fromYear),
    to_year: String(toYear),
  });
  if (params.get("workType")) search.set("work_type", params.get("workType")!);
  return queryOptions({
    queryKey: ["explorer-field-market", search.toString()],
    queryFn: ({ signal }) => api<FieldMarket>(`/explorer/field-market?${search}`, { signal }),
    enabled: Boolean(fieldCode),
    staleTime: 10 * 60_000,
    retry: false,
  });
}
export function networkProfileQueryOptions(
  entity: ExplorerEntity,
  fromYear: number,
  toYear: number,
  filters: { workType?: string; fieldCode?: string; largeCategory?: string; middleCategory?: string },
  pageSize = 5,
) {
  const base =
    entity.type === "company"
      ? companyProcurementQueryOptions(entity.id, { fromYear, toYear, ...filters, pageSize })
      : organizationProcurementQueryOptions(
          entity.id,
          toYear - fromYear + 1,
          filters,
          true,
          { from: fromYear, to: toYear },
          { pageSize, sort: "contract_amount_desc" },
        );
  return queryOptions({
    queryKey: base.queryKey,
    queryFn: base.queryFn as QueryFunction<NetworkProfile>,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export type FieldContext = {
  entities: ExplorerEntity[];
  links: import("./useNetworkExplorer").ExplorerLink[];
  organizations: Array<ExplorerEntity & { record_count: number }>;
  yearly_activity: Array<{
    year: number;
    contract_record_count: number;
    supplier_count: number;
    contract_amount: number | null;
    total_records?: number;
    truncated: boolean;
  }>;
  sampled: boolean;
  basis: string;
};
export function fieldContextQueryOptions(params: URLSearchParams, fromYear: number, toYear: number) {
  const search = new URLSearchParams({ from_year: String(fromYear), to_year: String(toYear) });
  for (const [key, apiKey] of [
    ["field", "field_code"],
    ["large", "large_category"],
    ["middle", "middle_category"],
    ["workType", "work_type"],
  ]) {
    const value = params.get(key);
    if (value) search.set(apiKey, value);
  }
  if (!search.has("field_code") && !search.has("large_category") && !search.has("middle_category"))
    search.set("q", params.get("center_name") ?? "");
  return queryOptions({
    queryKey: ["explorer-field-context", search.toString()],
    queryFn: ({ signal }) => api<FieldContext>(`/explorer/field-context?${search}`, { signal }),
    enabled:
      params.get("center_type") === "field" &&
      Boolean(params.get("field") || params.get("large") || params.get("middle")),
    staleTime: 10 * 60_000,
    retry: false,
  });
}
export type ClassificationCatalogItem = {
  field_code: string;
  field_name: string;
  large_category?: string;
  middle_category?: string;
  work_types?: string[];
  observed_notice_count?: number;
};
export function useFieldSearch(query: string, fromYear: number, toYear: number) {
  const search = new URLSearchParams({ q: query, from_year: String(fromYear), to_year: String(toYear) });
  return useQuery({
    queryKey: ["explorer-field-search", search.toString()],
    queryFn: ({ signal }) =>
      api<{
        items: ClassificationCatalogItem[];
        sampled: boolean;
      }>(`/explorer/fields?${search}`, { signal }),
    enabled: query.trim().length >= 2,
    staleTime: 10 * 60_000,
    retry: false,
  });
}
export function useExplorerNoticeContext(noticeId?: string) {
  return useQuery({
    queryKey: ["explorer-notice-context", noticeId],
    queryFn: ({ signal }) =>
      api<{
        notice: import("@/features/notices/api").Notice;
        region_code?: string;
        region_name?: string;
        truncated: boolean;
      }>(`/explorer/notice-context/${encodeURIComponent(noticeId!)}`, { signal }),
    enabled: Boolean(noticeId),
    staleTime: 10 * 60_000,
    retry: false,
  });
}
