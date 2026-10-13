import { entityKey, type ExplorerEntity, type ExplorerLink } from "./useNetworkExplorer";

export type CompanyNodeScope =
  | "center"
  | "co_bidder"
  | "both_contract_organization"
  | "current_contract_organization"
  | "co_bidder_contract_organization";

export function companyNodeScopes(
  root: ExplorerEntity | undefined,
  entities: ExplorerEntity[],
  links: ExplorerLink[],
) {
  const scopes = new Map<string, CompanyNodeScope>();
  if (root?.type !== "company") return scopes;
  const center = entityKey(root);
  scopes.set(center, "center");
  const competitors = new Set<string>();
  for (const link of links) {
    if (link.kind !== "competition") continue;
    const source = entityKey(link.source),
      target = entityKey(link.target);
    if (source === center && link.target.type === "company") competitors.add(target);
    if (target === center && link.source.type === "company") competitors.add(source);
  }
  for (const competitor of competitors) scopes.set(competitor, "co_bidder");
  for (const entity of entities) {
    if (entity.type !== "organization") continue;
    const organization = entityKey(entity);
    const connectedCompanies = new Set<string>();
    for (const link of links) {
      if ((link.kind ?? "contract") !== "contract") continue;
      const source = entityKey(link.source),
        target = entityKey(link.target);
      if (source === organization && link.target.type === "company") connectedCompanies.add(target);
      if (target === organization && link.source.type === "company") connectedCompanies.add(source);
    }
    const current = connectedCompanies.has(center);
    const competitor = [...connectedCompanies].some((key) => competitors.has(key));
    scopes.set(
      organization,
      current && competitor
        ? "both_contract_organization"
        : current
          ? "current_contract_organization"
          : "co_bidder_contract_organization",
    );
  }
  return scopes;
}

// Company exploration uses semantic rings; other roots retain hop-based rings.
export function graphRanks(
  root: ExplorerEntity | undefined,
  entities: ExplorerEntity[],
  links: ExplorerLink[],
) {
  const ranks = new Map<string, number>();
  if (!entities.length) return ranks;
  const center = entityKey(root ?? entities[0]);
  const scopes = companyNodeScopes(root, entities, links);
  if (root?.type === "company") {
    ranks.set(center, 10_000);
    const groups = [
      {
        matches: (scope: CompanyNodeScope | undefined) => scope === "co_bidder",
        perRing: 32,
        score: 9_000,
      },
      {
        matches: (scope: CompanyNodeScope | undefined) =>
          scope === "both_contract_organization" || scope === "current_contract_organization",
        perRing: 70,
        score: 8_000,
      },
      {
        matches: (scope: CompanyNodeScope | undefined) => scope === "co_bidder_contract_organization",
        perRing: 70,
        score: 7_000,
      },
    ];
    for (const group of groups) {
      entities
        .filter((entity) => group.matches(scopes.get(entityKey(entity))))
        .forEach((entity, index) =>
          ranks.set(entityKey(entity), group.score - Math.floor(index / group.perRing)),
        );
    }
    for (const entity of entities) {
      if (!ranks.has(entityKey(entity))) ranks.set(entityKey(entity), 6_000);
    }
    return ranks;
  }
  const adjacency = new Map<string, Set<string>>();
  for (const link of links) {
    const source = entityKey(link.source),
      target = entityKey(link.target);
    if (!adjacency.has(source)) adjacency.set(source, new Set());
    if (!adjacency.has(target)) adjacency.set(target, new Set());
    adjacency.get(source)!.add(target);
    adjacency.get(target)!.add(source);
  }
  ranks.set(center, 10_000);
  let frontier = [center];
  for (let depth = 1; depth <= 2; depth++) {
    const next: string[] = [];
    for (const key of frontier) {
      for (const neighbor of adjacency.get(key) ?? []) {
        if (ranks.has(neighbor)) continue;
        ranks.set(neighbor, depth);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  // Many institutions on a single circumference become sub-pixel dots after fit.
  // Spread each hop across several balanced rings without dropping any nodes.
  for (const [depth, perRing, score] of [[1, 32, 9_000], [2, 70, 8_000]] as const) {
    entities.filter((entity) => ranks.get(entityKey(entity)) === depth)
      .forEach((entity, index) => ranks.set(entityKey(entity), score - Math.floor(index / perRing)));
  }
  return ranks;
}

export function visibleCompanyGraph(
  root: ExplorerEntity | undefined,
  entities: ExplorerEntity[],
  links: ExplorerLink[],
  showCompetitorOrganizations: boolean,
) {
  if (root?.type !== "company" || showCompetitorOrganizations) return { entities, links };
  const scopes = companyNodeScopes(root, entities, links);
  const visibleEntities = entities.filter(
    (entity) => scopes.get(entityKey(entity)) !== "co_bidder_contract_organization",
  );
  const visibleKeys = new Set(visibleEntities.map(entityKey));
  return {
    entities: visibleEntities,
    links: links.filter(
      (link) => visibleKeys.has(entityKey(link.source)) && visibleKeys.has(entityKey(link.target)),
    ),
  };
}
