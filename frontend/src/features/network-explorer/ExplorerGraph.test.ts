import { expect, it } from "vitest";
import { companyNodeScopes, graphRanks, visibleCompanyGraph } from "./graph-layout";
import { entityKey, type ExplorerEntity, type ExplorerLink } from "./useNetworkExplorer";

const current: ExplorerEntity = { type: "company", id: "CURRENT", name: "현재 업체" };
const competitor: ExplorerEntity = { type: "company", id: "COMPETITOR", name: "경쟁 업체" };
const shared: ExplorerEntity = { type: "organization", id: "SHARED", name: "공통 기관" };
const currentOnly: ExplorerEntity = { type: "organization", id: "CURRENT_ONLY", name: "현재 기관" };
const competitorOnly: ExplorerEntity = { type: "organization", id: "COMPETITOR_ONLY", name: "경쟁 기관" };
const relationship = { contract_event_count: 1, amount_completeness: "complete" as const };
const links: ExplorerLink[] = [
  { source: current, target: competitor, kind: "competition", count: 2, relationship },
  { source: current, target: shared, kind: "contract", relationship },
  { source: competitor, target: shared, kind: "contract", relationship },
  { source: current, target: currentOnly, kind: "contract", relationship },
  { source: competitor, target: competitorOnly, kind: "contract", relationship },
];
const entities = [current, competitor, shared, currentOnly, competitorOnly];

it("경쟁 업체, 선택 업체의 발주기관, 나머지 발주기관을 세 원에 나눠 배치한다", () => {
  const scopes = companyNodeScopes(current, entities, links);
  const ranks = graphRanks(current, entities, links);

  expect(scopes.get("company:COMPETITOR")).toBe("co_bidder");
  expect(scopes.get("organization:SHARED")).toBe("both_contract_organization");
  expect(scopes.get("organization:CURRENT_ONLY")).toBe("current_contract_organization");
  expect(scopes.get("organization:COMPETITOR_ONLY")).toBe("co_bidder_contract_organization");
  expect(ranks.get("company:CURRENT")).toBeGreaterThan(ranks.get("company:COMPETITOR")!);
  expect(ranks.get("company:COMPETITOR")).toBeGreaterThan(ranks.get("organization:SHARED")!);
  expect(ranks.get("organization:SHARED")).toBe(ranks.get("organization:CURRENT_ONLY"));
  expect(ranks.get("organization:CURRENT_ONLY")).toBeGreaterThan(
    ranks.get("organization:COMPETITOR_ONLY")!,
  );
});

it("경쟁 업체의 발주기관은 기본으로 숨기고 요청할 때 표시한다", () => {
  const collapsed = visibleCompanyGraph(current, entities, links, false);
  const expanded = visibleCompanyGraph(current, entities, links, true);

  expect(collapsed.entities.map(entityKey)).not.toContain("organization:COMPETITOR_ONLY");
  expect(collapsed.entities.map(entityKey)).toContain("organization:SHARED");
  expect(collapsed.links.some((link) => entityKey(link.target) === "organization:COMPETITOR_ONLY")).toBe(false);
  expect(expanded.entities).toEqual(entities);
  expect(expanded.links).toEqual(links);
});

it("같은 단계의 발주기관이 많으면 기관 그래프처럼 가까운 보조 원에 나눈다", () => {
  const organizations = Array.from({ length: 71 }, (_, index): ExplorerEntity => ({
    type: "organization",
    id: `ORG_${index}`,
    name: `기관 ${index}`,
  }));
  const denseLinks: ExplorerLink[] = organizations.map((organization) => ({
    source: current,
    target: organization,
    kind: "contract",
    relationship,
  }));
  const ranks = graphRanks(current, [current, competitor, ...organizations], [
    links[0],
    ...denseLinks,
  ]);

  expect(ranks.get("organization:ORG_0")).toBe(8_000);
  expect(ranks.get("organization:ORG_69")).toBe(8_000);
  expect(ranks.get("organization:ORG_70")).toBe(7_999);
  expect(ranks.get("company:COMPETITOR")).toBeGreaterThan(ranks.get("organization:ORG_0")!);
});
