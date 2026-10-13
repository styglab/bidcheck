import { useQueries, useQuery } from "@tanstack/react-query";
import {
  allCompanyOrganizationsQueryOptions,
  networkProfileQueryOptions,
  fieldContextQueryOptions,
  networkQueryOptions,
} from "./api";
import { useSearchParams } from "react-router-dom";
import { useCompanyCompetitors, type CompanyProcurementProfile } from "@/features/company-context/api";
import { useOrganizationProcurementProfile } from "@/features/organizations/api";
import type { ProcurementRelationship } from "@/features/organizations/api";

export type ExplorerEntity = { type: "organization" | "company" | "field"; id: string; name: string };
export const entityKey = (entity: ExplorerEntity) => `${entity.type}:${entity.id}`;
export type ExplorerLink = {
  source: ExplorerEntity;
  target: ExplorerEntity;
  relationship: Pick<ProcurementRelationship, "contract_event_count" | "amount_completeness"> &
    Partial<ProcurementRelationship>;
  kind?: "contract" | "award" | "participation" | "competition" | "field";
  networkSnapshot?: boolean;
  label?: string;
  count?: number;
};

export const linkKey = (link: ExplorerLink) =>
  [entityKey(link.source), entityKey(link.target)].sort().join("|");
export const linkLabel = (link: ExplorerLink) =>
  link.label?.replace(/^조회 계약/, "확인된 계약").replace(/공동 참여/g, "같은 입찰 참여") ??
  {
    contract: "거래 관계",
    award: `낙찰 ${link.count ?? 0}건`,
    participation: `참여 ${link.count ?? 0}건`,
    competition: `같은 입찰 참여 ${link.count ?? 0}건`,
    field: "분야 계약",
  }[link.kind ?? "contract"];

export function useNetworkExplorer() {
  const [params, setParams] = useSearchParams();
  const year = new Date().getUTCFullYear();
  const parsedFrom = Number(params.get("fromYear"));
  const parsedTo = Number(params.get("toYear"));
  const toYear = Number.isInteger(parsedTo) && parsedTo >= 2000 && parsedTo <= year ? parsedTo : year;
  const fromYear =
    Number.isInteger(parsedFrom) && parsedFrom >= toYear - 4 && parsedFrom <= toYear
      ? parsedFrom
      : toYear - 2;
  const filters = {
    workType: params.get("workType") ?? undefined,
    fieldCode: params.get("field") ?? undefined,
    largeCategory: params.get("large") ?? undefined,
    middleCategory: params.get("middle") ?? undefined,
  };
  const rootType = params.get("center_type") ?? params.get("seed_type");
  const rootId = params.get("center_id") ?? params.get("seed_id");
  const root: ExplorerEntity | undefined =
    rootId && (rootType === "company" || rootType === "organization" || rootType === "field")
      ? { type: rootType, id: rootId, name: params.get("center_name") ?? params.get("seed_name") ?? rootId }
      : undefined;
  const hasFieldSelection = Boolean(filters.fieldCode || filters.largeCategory || filters.middleCategory);
  const showCompetitorOrganizations = params.get("competitorOrganizations") === "show";
  const requestedLimit = Number(params.get("nodeLimit"));
  const nodeLimit = [5, 10, 20].includes(requestedLimit) ? requestedLimit : 20;
  const useBatch = Boolean(root && root.type !== "company" && filters.fieldCode);
  const networkQuery = useQuery(
    networkQueryOptions(root, fromYear, toYear, filters.fieldCode, filters.workType, nodeLimit),
  );
  const period = { from: fromYear, to: toYear };
  const rootCompany = useQuery(
    allCompanyOrganizationsQueryOptions(
      root?.type === "company" ? root.id : undefined,
      fromYear,
      toYear,
      filters,
      root?.type === "company" && hasFieldSelection,
    ),
  );
  const rootOrganization = useOrganizationProcurementProfile(
    root?.type === "organization" ? root.id : undefined,
    toYear - fromYear + 1,
    filters,
    Boolean(root?.type === "organization" && !useBatch),
    period,
    { pageSize: nodeLimit, sort: "contract_amount_desc" },
  );
  const companyData = rootCompany.isPlaceholderData || rootCompany.isError ? undefined : rootCompany.data;
  const organizationData =
    rootOrganization.isPlaceholderData || rootOrganization.isError ? undefined : rootOrganization.data;
  // Retain the already-fetched unfiltered category catalog when the analysis is narrowed.
  // This cache subscription makes no additional Runtime request.
  const categoryCatalog = useQuery({
    ...networkProfileQueryOptions(
      root ?? { type: "organization", id: "", name: "" },
      fromYear,
      toYear,
      { workType: filters.workType },
      nodeLimit,
    ),
    enabled: false,
  });
  const fieldQuery = useQuery({
    ...fieldContextQueryOptions(params, fromYear, toYear),
    enabled: !useBatch && root?.type === "field",
  });
  const competitors = useCompanyCompetitors(
    root?.type === "company" ? root.id : undefined,
    {
      fromYear,
      toYear,
      ...filters,
    },
    hasFieldSelection,
    nodeLimit,
  );
  const competitorEntities: ExplorerEntity[] =
    root?.type === "company" && !competitors.isPlaceholderData && !competitors.isError
      ? (competitors.data?.items ?? [])
          .filter((item) => item.co_participation_count > 0 && item.company_number !== root.id)
          .slice(0, nodeLimit)
          .map((item) => ({ type: "company", id: item.company_number, name: item.company_name }))
      : [];
  const competitorProfiles = useQueries({
    queries: competitorEntities.map((entity) =>
      allCompanyOrganizationsQueryOptions(
        entity.id,
        fromYear,
        toYear,
        filters,
        showCompetitorOrganizations,
      ),
    ),
  });
  const companyProfiles = new Map<string, CompanyProcurementProfile>();
  if (root?.type === "company" && companyData) companyProfiles.set(root.id, companyData);
  competitorEntities.forEach((entity, index) => {
    const profile = competitorProfiles[index];
    if (profile?.data && !profile.isPlaceholderData && !profile.isError)
      companyProfiles.set(entity.id, profile.data);
  });
  const rootQuery = useBatch
    ? networkQuery
    : root?.type === "field"
      ? fieldQuery
      : root?.type === "company"
        ? rootCompany
        : rootOrganization;
  const actualRoot = root && {
    ...root,
    name: companyData?.company?.name ?? organizationData?.organization?.name ?? root.name,
  };
  const baseRelationships =
    root?.type === "company"
      ? (companyData?.organization_relationships ?? [])
      : (organizationData?.company_relationships ?? []);
  const children: ExplorerEntity[] = (!useBatch && hasFieldSelection ? baseRelationships : [])
    .filter((item) => item.contract_event_count > 0)
    .slice(0, root?.type === "company" ? undefined : nodeLimit)
    .flatMap((item) => {
      const id = root?.type === "company" ? item.organization_code : item.company_number;
      return id
        ? [
            {
              type: root!.type === "company" ? ("organization" as const) : ("company" as const),
              id,
              name: (root?.type === "company" ? item.organization_name : item.company_name) ?? id,
            },
          ]
        : [];
    });
  const branches = useQueries({
    queries:
      root?.type === "organization"
        ? children.map((child) => networkProfileQueryOptions(child, fromYear, toYear, filters))
        : [],
  });
  const expanded = children.find((item) => entityKey(item) === params.get("expanded")) ?? children[0];
  const expansionQuery = {
    isLoading: branches.some((result) => result.isLoading),
    isPlaceholderData: false,
    isError: branches.some((result) => result.isError),
    refetch: () => Promise.all(branches.filter((result) => result.isError).map((result) => result.refetch())),
  };
  // Publish a complete two-hop graph instead of relaying each branch response to the layout.
  // Failed branches settle too, so a partial result can still be explored and retried.
  const companyRelationsLoading =
    root?.type === "company" &&
    (competitors.isPending ||
      (showCompetitorOrganizations && competitorProfiles.some((result) => result.isPending)));
  const graphLoading = useBatch
    ? networkQuery.isPending || companyRelationsLoading
    : Boolean(
        root &&
        hasFieldSelection &&
        (rootQuery.isLoading ||
          rootQuery.isPlaceholderData ||
          branches.some((result) => result.isPending) ||
          companyRelationsLoading),
      );
  const loadedBranches = branches.filter((result) => result.isSuccess || result.isError).length;
  const entities = new Map<string, ExplorerEntity>();
  const linkMap = new Map<string, ExplorerLink>();
  const addLink = (source: ExplorerEntity, target: ExplorerEntity, relationship: ProcurementRelationship) => {
    if (
      relationship.contract_event_count <= 0 &&
      relationship.award_event_count <= 0 &&
      relationship.participation_count <= 0
    )
      return;
    const link: ExplorerLink = { source, target, relationship, kind: "contract" };
    const key = linkKey(link);
    if (!linkMap.has(key)) linkMap.set(key, link);
  };
  if (actualRoot) entities.set(entityKey(actualRoot), actualRoot);
  for (const child of children) {
    entities.set(entityKey(child), child);
    const relationship = baseRelationships.find(
      (item) => (child.type === "company" ? item.company_number : item.organization_code) === child.id,
    )!;
    addLink(actualRoot!, child, relationship);
  }
  children.forEach((child, index) => {
    const result = branches[index];
    if (!result?.data || result.isError) return;
    const relationships =
      "organization_relationships" in result.data
        ? result.data.organization_relationships
        : result.data.company_relationships;
    let added = 0;
    for (const relationship of relationships ?? []) {
      if (relationship.contract_event_count <= 0) continue;
      const type = child.type === "company" ? "organization" : "company";
      const id = type === "company" ? relationship.company_number : relationship.organization_code;
      if (!id) continue;
      const target: ExplorerEntity = {
        type,
        id,
        name: (type === "company" ? relationship.company_name : relationship.organization_name) ?? id,
      };
      if (actualRoot && entityKey(target) === entityKey(actualRoot)) continue;
      if (!entities.has(entityKey(target))) entities.set(entityKey(target), target);
      addLink(child, target, relationship);
      if (++added >= 2) break;
    }
  });
  if (hasFieldSelection && actualRoot?.type === "company") {
    for (const item of competitors.data?.items ?? []) {
      if (!competitorEntities.some((entity) => entity.id === item.company_number)) continue;
      const target: ExplorerEntity = { type: "company", id: item.company_number, name: item.company_name };
      entities.set(entityKey(target), target);
      const link: ExplorerLink = {
        source: actualRoot,
        target,
        kind: "competition",
        count: item.co_participation_count,
        relationship: { contract_event_count: 0, amount_completeness: "unknown" },
      };
      linkMap.set(linkKey(link), link);
    }
  }
  if (
    !useBatch &&
    actualRoot?.type === "field" &&
    fieldQuery.data &&
    !fieldQuery.isPlaceholderData &&
    !fieldQuery.isError
  ) {
    for (const entity of fieldQuery.data.entities) entities.set(entityKey(entity), entity);
    for (const link of fieldQuery.data.links) linkMap.set(linkKey(link), link);
    for (const org of fieldQuery.data.organizations) {
      const link: ExplorerLink = {
        source: actualRoot,
        target: org,
        kind: "field",
        label: `분야 계약 ${org.record_count}건`,
        relationship: { contract_event_count: org.record_count, amount_completeness: "unknown" },
      };
      linkMap.set(linkKey(link), link);
    }
  }
  if (useBatch && networkQuery.data) {
    const byKey = new Map<string, ExplorerEntity>();
    for (const node of networkQuery.data.nodes) {
      if (actualRoot?.type === "company" && node.type === "company" && node.id !== actualRoot.id) continue;
      const entity: ExplorerEntity = {
        type: node.type,
        id: node.id,
        name:
          node.name ||
          (actualRoot && node.type === actualRoot.type && node.id === actualRoot.id
            ? actualRoot.name
            : node.id),
      };
      byKey.set(entityKey(entity), entity);
      entities.set(entityKey(entity), entity);
    }
    if (actualRoot) byKey.set(entityKey(actualRoot), actualRoot);
    for (const edge of networkQuery.data.edges) {
      const source = byKey.get(`${edge.source.type}:${edge.source.id}`);
      const target = byKey.get(`${edge.target.type}:${edge.target.id}`);
      if (
        actualRoot?.type === "company" &&
        ![source, target].some((entity) => entity && entityKey(entity) === entityKey(actualRoot))
      )
        continue;
      const contract = edge.relationships.contract;
      if (!source || !target || !contract || contract.event_count <= 0) continue;
      const link: ExplorerLink = {
        source,
        target,
        kind: "contract",
        networkSnapshot: true,
        relationship: {
          contract_event_count: contract.event_count,
          total_attributed_contract_amount: contract.attributed_amount ?? undefined,
          amount_completeness: contract.amount_completeness,
          latest_contract_date: contract.latest_contract_date,
        },
      };
      linkMap.set(linkKey(link), link);
    }
    if (actualRoot?.type === "field") {
      for (const org of [...byKey.values()].filter((entity) => entity.type === "organization")) {
        const visibleCount = [...linkMap.values()]
          .filter(
            (link) => entityKey(link.source) === entityKey(org) || entityKey(link.target) === entityKey(org),
          )
          .reduce((sum, link) => sum + link.relationship.contract_event_count, 0);
        if (!visibleCount) continue;
        const link: ExplorerLink = {
          source: actualRoot,
          target: org,
          kind: "field",
          label: `표시된 계약 ${visibleCount}건`,
          relationship: { contract_event_count: visibleCount, amount_completeness: "unknown" },
        };
        linkMap.set(linkKey(link), link);
      }
    }
  }
  if (actualRoot?.type === "company") {
    competitorEntities.forEach((competitor, index) => {
      const profile = competitorProfiles[index];
      if (!profile?.data || profile.isError || !("organization_relationships" in profile.data)) return;
      for (const relationship of profile.data.organization_relationships.filter(
        (item) => item.contract_event_count > 0,
      )) {
        if (!relationship.organization_code) continue;
        const organization: ExplorerEntity = {
          type: "organization",
          id: relationship.organization_code,
          name: relationship.organization_name ?? relationship.organization_code,
        };
        if (!entities.has(entityKey(organization))) entities.set(entityKey(organization), organization);
        addLink(competitor, organization, relationship);
      }
    });
  }
  const links = [...linkMap.values()];
  const batchChildren =
    useBatch && actualRoot
      ? [...entities.values()].filter(
          (entity) =>
            entityKey(entity) !== entityKey(actualRoot) &&
            (actualRoot.type === "field"
              ? entity.type === "organization"
              : networkQuery.data?.edges.some(
                  (edge) =>
                    edge.hop === 1 &&
                    [
                      `${edge.source.type}:${edge.source.id}`,
                      `${edge.target.type}:${edge.target.id}`,
                    ].includes(entityKey(entity)),
                )),
        )
      : children;
  const relationId = params
    .get("selectedRelation")
    ?.replace(/\|(contract|award|participation|competition|field)$/, "");
  const selectedLink = hasFieldSelection ? links.find((link) => linkKey(link) === relationId) : undefined;
  const selected =
    hasFieldSelection && !selectedLink ? entities.get(params.get("selected") ?? "") : undefined;
  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  };
  const chooseRoot = (entity: ExplorerEntity, extra: Record<string, string | undefined> = {}) =>
    update({
      ...extra,
      center_type: entity.type,
      center_id: entity.id,
      center_name: entity.name,
      seed_type: undefined,
      seed_id: undefined,
      seed_name: undefined,
      selected: extra.selected,
      selectedRelation: undefined,
      expanded: undefined,
    });
  const select = (entity: ExplorerEntity) =>
    update({
      selected: entityKey(entity),
      selectedRelation: undefined,
      ...(children.some((child) => entityKey(child) === entityKey(entity))
        ? { expanded: entityKey(entity) }
        : {}),
    });
  const changeFilters = (changes: Record<string, string | undefined>) =>
    update({ ...changes, selected: undefined, selectedRelation: undefined, expanded: undefined });
  return {
    params,
    update,
    root: actualRoot,
    selected,
    selectedLink,
    expanded: useBatch ? batchChildren[0] : expanded,
    children: batchChildren,
    entities: [...entities.values()],
    links,
    rootQuery,
    expansionQuery: useBatch
      ? { isLoading: false, isPlaceholderData: false, isError: false, refetch: () => networkQuery.refetch() }
      : expansionQuery,
    graphLoading,
    loadedBranches: useBatch ? batchChildren.length : loadedBranches,
    companyData,
    companyProfiles,
    organizationData,
    fieldData: fieldQuery.isError ? undefined : fieldQuery.data,
    competitorQuery: competitors,
    competitorOrganizationError: competitorProfiles.some((result) => result.isError),
    companyRelationsLoading,
    snapshotId: useBatch ? networkQuery.data?.snapshot_id : undefined,
    networkTruncation: useBatch ? networkQuery.data?.truncation : undefined,
    networkUpdatedAt: useBatch ? networkQuery.data?.updated_at : undefined,
    fromYear,
    toYear,
    filters,
    categoryFields: categoryCatalog.data?.field_distribution ?? [],
    hasFieldSelection,
    nodeLimit,
    rootTotal: useBatch
      ? networkQuery.data?.summary?.node_count
      : root?.type === "company"
        ? companyData?.pagination?.total_items
        : organizationData?.pagination?.total_items,
    chooseRoot,
    select,
    changeFilters,
  };
}
