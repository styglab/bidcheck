import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import type {
  ProcurementRelationship,
  SupplierEntryCompany,
  OrganizationProcurementProfile,
} from "@/features/organizations/api";

export type RelationshipDiscovery = {
  snapshot_updated_at?: string;
  organizations: Array<{
    organization_code: string;
    organization_name?: string;
    relationships: ProcurementRelationship[];
    company_structure?: OrganizationProcurementProfile["company_structure"] | null;
    data_completeness?: { status?: string } | null;
    truncated: boolean;
  }>;
  items: Array<ProcurementRelationship & { organization_code: string; organization_name?: string }>;
  new_relationships: Array<
    SupplierEntryCompany & { organization_code: string; organization_name?: string; target_year: number }
  >;
  failed_new_relationship_count: number;
  analysis_basis: {
    from_year: number;
    to_year: number;
    work_type?: string;
    seed_award_count: number;
    organization_count: number;
    organization_limit: number;
    relationships_per_organization: number;
  };
  partial: boolean;
  truncated: boolean;
  failed_organization_count: number;
};

export function useRelationshipDiscovery(periodYears: number, workType: string, organizationLimit = 12) {
  const params = new URLSearchParams({
    period_years: String(periodYears),
    organization_limit: String(organizationLimit),
    include_profiles: "false",
  });
  if (workType) params.set("work_type", workType);
  return useQuery({
    queryKey: ["relationship-discovery", periodYears, workType, organizationLimit],
    queryFn: ({ signal }) => api<RelationshipDiscovery>(`/home/relationships?${params}`, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
