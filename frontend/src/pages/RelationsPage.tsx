import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { LoaderCircle, Maximize2, Minus, Plus, Search, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactMoney as money } from "@/shared/format/money";
import {
  useNotice,
  useNoticeOrganizationCompanyRelationship,
  useNoticeOrganizationFieldCompanies,
  type OrganizationFieldCompany,
} from "../features/notices/api";

type GraphSelection =
  | {
      type: "node";
      id: string;
      kind: "organization" | "company";
      label: string;
      company?: OrganizationFieldCompany;
    }
  | {
      type: "edge";
      id: string;
      relation: string;
      relationType: "confirmed" | "aggregate" | "analysis";
      sourceLabel: string;
      targetLabel: string;
    };

const EXAMPLE_ELEMENTS: ElementDefinition[] = [
  ...[
    ["org-welfare", "복지정책기관", "organization", "true"],
    ["org-digital", "디지털행정기관", "organization"],
    ["org-local", "지역공공기관", "organization"],
    ["org-health", "공공보건기관", "organization"],
    ["org-data", "데이터진흥기관", "organization"],
    ["company-alpha", "알파시스템", "company"],
    ["company-beta", "베타데이터", "company"],
    ["company-cloud", "클라우드웍스", "company"],
    ["company-secure", "시큐어테크", "company"],
    ["company-ai", "에이아이랩", "company"],
    ["company-service", "서비스파트너스", "company"],
    ["company-network", "네트워크솔루션", "company"],
    ["company-public", "퍼블릭테크", "company"],
    ["company-next", "넥스트플랫폼", "company"],
    ["company-smart", "스마트웍스", "company"],
  ].map(([id, label, kind, isCenter]) => ({ data: { id, label, kind, ...(isCenter ? { isCenter } : {}) } })),
  ...[
    ["org-welfare", "company-alpha", "계약 8건", "aggregate"],
    ["org-welfare", "company-beta", "낙찰 5건", "aggregate"],
    ["org-welfare", "company-service", "계약 3건", "aggregate"],
    ["org-welfare", "company-public", "참여 11건", "confirmed"],
    ["org-welfare", "company-next", "관련 분야", "analysis"],
    ["org-digital", "company-alpha", "낙찰 4건", "aggregate"],
    ["org-digital", "company-cloud", "계약 7건", "aggregate"],
    ["org-digital", "company-ai", "참여 9건", "confirmed"],
    ["org-digital", "company-next", "계약 2건", "aggregate"],
    ["org-local", "company-service", "계약 6건", "aggregate"],
    ["org-local", "company-network", "낙찰 4건", "aggregate"],
    ["org-local", "company-smart", "참여 7건", "confirmed"],
    ["org-health", "company-secure", "계약 5건", "aggregate"],
    ["org-health", "company-cloud", "참여 8건", "confirmed"],
    ["org-health", "company-smart", "낙찰 3건", "aggregate"],
    ["org-data", "company-beta", "계약 9건", "aggregate"],
    ["org-data", "company-ai", "낙찰 5건", "aggregate"],
    ["org-data", "company-public", "참여 6건", "confirmed"],
    ["org-data", "company-next", "관련 분야", "analysis"],
    ["org-data", "company-alpha", "참여 4건", "confirmed"],
  ].map(([source, target, relation, relationType], index) => ({ data: { id: `example-edge-${index}`, source, target, relation, relationType } })),
];

function ProcurementGraph({
  elements,
  onSelect,
}: {
  elements: ElementDefinition[];
  onSelect: (selection?: GraphSelection) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const graph = useRef<Core | null>(null);
  const nodeCount = elements.filter((element) => !element.data.source).length;
  const edgeCount = elements.length - nodeCount;
  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      elements,
      wheelSensitivity: 0.22,
      minZoom: 0.45,
      maxZoom: 2.2,
      boxSelectionEnabled: false,
      panningEnabled: true,
      userPanningEnabled: true,
      zoomingEnabled: true,
      userZoomingEnabled: true,
      autoungrabify: false,
      style: [
        {
          selector: "node",
          style: {
            width: 26,
            height: 26,
            "background-color": "#67e8f9",
            "border-width": 1.5,
            "border-color": "#cffafe",
            label: "data(label)",
            color: "#e2e8f0",
            "font-size": 10,
            "font-weight": 650,
            "text-wrap": "wrap",
            "text-max-width": "112px",
            "text-valign": "bottom",
            "text-margin-y": 9,
            "text-outline-color": "#020617",
            "text-outline-width": 2,
            "underlay-color": "#22d3ee",
            "underlay-opacity": 0.2,
            "underlay-padding": 7,
            "overlay-opacity": 0,
            "transition-property": "opacity, border-width, width, height",
            "transition-duration": 180,
          },
        },
        {
          selector: 'node[kind = "notice"]',
          style: {
            width: 38,
            height: 38,
            "background-color": "#60a5fa",
            "border-color": "#dbeafe",
            "underlay-color": "#3b82f6",
          },
        },
        {
          selector: 'node[kind = "organization"]',
          style: {
            shape: "diamond",
            width: 46,
            height: 46,
            "background-color": "#a78bfa",
            "border-color": "#ede9fe",
            "underlay-color": "#8b5cf6",
          },
        },
        {
          selector: 'node[kind = "company"]',
          style: {
            "background-color": "#2dd4bf",
            "border-color": "#ccfbf1",
            "underlay-color": "#14b8a6",
          },
        },
        {
          selector: 'node[isCenter = "true"]',
          style: {
            width: 64,
            height: 64,
            "border-width": 2.5,
            "font-size": 11,
            "text-max-width": "148px",
            "underlay-opacity": 0.32,
            "underlay-padding": 14,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#ffffff",
            "underlay-color": "#ffffff",
            "underlay-opacity": 0.12,
            "underlay-padding": 12,
          },
        },
        {
          selector: "node:active",
          style: {
            "overlay-color": "#2563eb",
            "overlay-opacity": 0.08,
            "overlay-padding": 10,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#64748b",
            "target-arrow-color": "#64748b",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.55,
            opacity: 0.48,
            "overlay-opacity": 0,
            label: "data(relation)",
            color: "#94a3b8",
            "font-size": 8,
            "font-weight": 650,
            "text-outline-color": "#020617",
            "text-outline-width": 2,
          },
        },
        {
          selector: 'edge[relationType = "aggregate"]',
          style: { width: 1.8, "line-color": "#2dd4bf", "target-arrow-color": "#2dd4bf", opacity: 0.7 },
        },
        {
          selector: 'edge[relationType = "analysis"]',
          style: {
            width: 1.5,
            "line-color": "#60a5fa",
            "target-arrow-color": "#60a5fa",
            "line-style": "dashed",
            "line-dash-pattern": [7, 6],
          },
        },
        {
          selector: "edge:selected",
          style: { width: 3, "line-color": "#f8fafc", "target-arrow-color": "#f8fafc", opacity: 1 },
        },
        {
          selector: ".is-muted",
          style: { opacity: 0.1 },
        },
        {
          selector: ".is-related",
          style: { "z-index": 8 },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        fit: true,
        padding: 72,
        nodeRepulsion: () => 240000,
        idealEdgeLength: () => 135,
        edgeElasticity: () => 90,
        nestingFactor: 1.15,
        gravity: 0.22,
        numIter: 1400,
        initialTemp: 180,
        coolingFactor: 0.96,
        minTemp: 1,
      },
    });
    graph.current = cy;
    cy.on("tap", "node", (event) => {
      const node = event.target;
      const data = node.data();
      const related = node.closedNeighborhood();
      cy.elements().removeClass("is-muted is-related");
      cy.elements().difference(related).addClass("is-muted");
      related.addClass("is-related");
      onSelect({ type: "node", id: data.id, kind: data.kind, label: data.label, company: data.company });
    });
    cy.on("tap", "edge", (event) => {
      const edge = event.target;
      const data = edge.data();
      const related = edge.add(edge.connectedNodes());
      cy.elements().removeClass("is-muted is-related");
      cy.elements().difference(related).addClass("is-muted");
      related.addClass("is-related");
      onSelect({
        type: "edge",
        id: data.id,
        relation: data.relation,
        relationType: data.relationType,
        sourceLabel: edge.source().data("label"),
        targetLabel: edge.target().data("label"),
      });
    });
    cy.on("tap", (event) => {
      if (event.target === cy) {
        cy.elements().removeClass("is-muted is-related");
        cy.elements().unselect();
        onSelect(undefined);
      }
    });
    const resize = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 70);
    });
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      graph.current = null;
      cy.destroy();
    };
  }, [elements, onSelect]);
  return (
    <div className="graph-map" aria-label="기관·업체 관계 지도">
      <div className="cytoscape-canvas" ref={container} />
      <div className="graph-map-status" aria-hidden="true">
        <span>RELATION UNIVERSE</span>
        <strong>{nodeCount}개 개체</strong>
        <i />
        <strong>{edgeCount}개 연결</strong>
      </div>
      <div className="graph-map-hint">빈 공간을 드래그해 이동 · 노드를 드래그해 배치</div>
      <div className="graph-map-controls" aria-label="지도 확대 및 축소">
        <button type="button" aria-label="확대" onClick={() => graph.current?.zoom({ level: Math.min(graph.current.zoom() * 1.25, graph.current.maxZoom()), renderedPosition: { x: graph.current.width() / 2, y: graph.current.height() / 2 } })}><Plus /></button>
        <button type="button" aria-label="축소" onClick={() => graph.current?.zoom({ level: Math.max(graph.current.zoom() / 1.25, graph.current.minZoom()), renderedPosition: { x: graph.current.width() / 2, y: graph.current.height() / 2 } })}><Minus /></button>
        <button type="button" aria-label="화면에 맞추기" onClick={() => graph.current?.fit(undefined, 70)}><Maximize2 /></button>
      </div>
    </div>
  );
}

export function RelationsPage({ embedded = false }: { embedded?: boolean }) {
  const [params, setParams] = useSearchParams();
  const noticeId = params.get("notice") ?? "";
  const [input, setInput] = useState(noticeId);
  const [selection, setSelection] = useState<GraphSelection>();
  const detail = useNotice(noticeId || undefined);
  const relations = useNoticeOrganizationFieldCompanies(noticeId || undefined);
  const notice = detail.data?.notice;
  const selectedCompany = selection?.type === "node" ? selection.company : undefined;
  const organizationCode = relations.data?.organization?.code ?? notice?.organization_code;
  const relationship = useNoticeOrganizationCompanyRelationship(
    noticeId || undefined,
    organizationCode,
    selectedCompany?.company_number,
    1,
  );

  const companies = useMemo(() => {
    const all = [
      ...(relations.data?.organization_field_companies ?? []),
      ...(relations.data?.market_similar_companies ?? []),
    ];
    return all
      .filter(
        (item, index) =>
          all.findIndex((candidate) => candidate.company_number === item.company_number) === index,
      )
      .sort(
        (a, b) =>
          (b.organization_relationship?.award_event_count ?? 0) +
          (b.similar_project_experience?.event_count ?? 0) -
          ((a.organization_relationship?.award_event_count ?? 0) +
            (a.similar_project_experience?.event_count ?? 0)),
      )
      .slice(0, 5);
  }, [relations.data]);

  const elements = useMemo<ElementDefinition[]>(() => {
    if (!notice) return [];
    const result: ElementDefinition[] = [
      { data: { id: "organization", label: notice.organization, kind: "organization", isCenter: "true" } },
    ];
    companies.forEach((company) => {
      const id = `company-${company.company_number}`;
      const orgCount = company.organization_relationship?.award_event_count ?? 0;
      result.push({ data: { id, label: company.company_name, kind: "company", company } });
      result.push({
        data: {
          id: `related-${id}`,
          source: "organization",
          target: id,
          relation: orgCount > 0 ? `낙찰·계약 ${orgCount}건` : "동일 분야 활동",
          relationType: orgCount > 0 ? "aggregate" : "analysis",
        },
      });
    });
    return result;
  }, [companies, notice]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (value) {
      setSelection(undefined);
      setParams({ notice: value });
    }
  };
  return (
    <PageContainer className={embedded ? "max-w-none p-0 sm:p-0" : "max-w-7xl"}>
      {!embedded && <>
        <header className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">관계 탐색 · NETWORK INTELLIGENCE</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">기관과 업체 사이, 보이지 않던 조달 관계를 발견하세요</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">공고를 출발점으로 기관의 낙찰·계약 업체와 동일 분야 활동을 하나의 관계망에서 탐색합니다.</p>
        </header>
        <form className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" onSubmit={submit}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input value={input} onChange={(event) => setInput(event.target.value)} className="h-12 bg-muted/35 pl-11" placeholder="공고 ID 입력 (예: R26BK01759670:000)" aria-label="관계 탐색 공고 ID" />
            </div>
            <Button className="h-12 bg-blue-800 px-6 hover:bg-blue-700" disabled={!input.trim()}>관계 열기</Button>
          </div>
        </form>
      </>}
      {!noticeId && !embedded && (
        <section className="relative mt-8 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b p-4 sm:px-5">
            <div className="min-w-0">
              <Badge className="border-0 bg-amber-100 text-amber-900 hover:bg-amber-100">화면 예시</Badge>
              <strong className="ml-3 align-middle text-sm">기관·업체 조달 네트워크</strong>
            </div>
            <Button asChild size="sm" variant="outline"><Link to="/notices">공고 찾기</Link></Button>
          </div>
          <ProcurementGraph elements={EXAMPLE_ELEMENTS} onSelect={setSelection} />
          <div className="flex flex-wrap items-center gap-4 border-t px-5 py-3 text-xs">
            <span><i className="legend-dot organization" />기관</span>
            <span><i className="legend-dot company" />업체</span>
            <span className="text-muted-foreground">빈 공간 드래그로 이동 · 휠로 확대/축소 · 노드는 직접 재배치</span>
          </div>
          {selection && <ExampleRelationDrawer selection={selection} onClose={() => setSelection(undefined)} />}
        </section>
      )}
      {noticeId && (detail.isLoading || relations.isLoading) && (
        <Skeleton className="mt-8 h-[620px] rounded-2xl" />
      )}
      {notice && (
        <section className="relative mt-8 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b p-4 sm:px-5">
            <div className="min-w-0">
              <Badge className="border-0 bg-violet-100 text-violet-800 hover:bg-violet-100">중심 기관</Badge>
              <strong className="ml-3 align-middle text-sm">{notice.organization}</strong>
              <span className="ml-3 hidden text-xs text-muted-foreground lg:inline">출발 공고: {notice.name}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelection(undefined)}>선택 해제</Button>
          </div>
          <ProcurementGraph elements={elements} onSelect={setSelection} />
          <div className="flex flex-wrap items-center gap-4 border-t px-5 py-3 text-xs">
            <span><i className="legend-dot organization" />기관</span>
            <span><i className="legend-dot company" />업체</span>
            <span className="text-muted-foreground">빈 공간 드래그로 이동 · 휠로 확대/축소 · 노드는 직접 재배치</span>
          </div>
          {selection && (
            <RelationDrawer
              selection={selection}
              organizationName={notice.organization}
              relationship={relationship}
              onClose={() => setSelection(undefined)}
            />
          )}
        </section>
      )}
    </PageContainer>
  );
}

function ExampleRelationDrawer({
  selection,
  onClose,
}: {
  selection: GraphSelection;
  onClose: () => void;
}) {
  const descriptions = {
    organization: "조달 사업을 발주하고 업체와 낙찰·계약 관계를 형성한 기관입니다.",
    company: "기관의 사업에 참여·낙찰·계약했거나 같은 분야에서 활동한 업체입니다.",
  };
  return (
    <aside className="network-drawer">
      <div className="border-b p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-700">예시 {selection.type === "edge" ? "관계" : "노드"}</p>
            <h2 className="mt-2 text-lg font-bold">{selection.type === "edge" ? selection.relation : selection.label}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기"><X className="size-4 text-muted-foreground" /></button>
        </div>
      </div>
      <div className="p-6">
        {selection.type === "edge" ? (
          <>
            <Badge className="border-0" variant={selection.relationType === "analysis" ? "secondary" : "default"}>
              {selection.relationType === "analysis" ? "분석 관계" : "확인된 관계"}
            </Badge>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {selection.sourceLabel}과 {selection.targetLabel} 사이의 {selection.relation} 관계입니다. 실제 화면에서는 날짜·금액·원천 근거를 함께 표시합니다.
            </p>
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">{descriptions[selection.kind]}</p>
        )}
        <p className="mt-6 rounded-xl bg-muted/50 p-4 text-xs leading-5 text-muted-foreground">
          이 그래프는 화면 구성을 설명하기 위한 예시이며 실제 조달 관계가 아닙니다.
        </p>
      </div>
    </aside>
  );
}

function RelationDrawer({
  selection,
  organizationName,
  relationship,
  onClose,
}: {
  selection: GraphSelection;
  organizationName: string;
  relationship: ReturnType<typeof useNoticeOrganizationCompanyRelationship>;
  onClose: () => void;
}) {
  const company = selection.type === "node" ? selection.company : undefined;
  return (
    <aside className="network-drawer">
      <div className="border-b p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-700">
              {selection.type === "edge"
                ? "관계"
                : selection.kind === "company"
                  ? "업체"
                  : selection.kind === "organization"
                    ? "기관"
                    : "개체"}
            </p>
            <h2 className="mt-2 text-lg font-bold">
              {selection.type === "edge" ? selection.relation : selection.label}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="p-6">
        {selection.type === "edge" && (
          <>
            <Badge
              className="border-0"
              variant={selection.relationType === "confirmed" ? "default" : "secondary"}
            >
              {selection.relationType === "confirmed"
                ? "확정 관계"
                : selection.relationType === "aggregate"
                  ? "집계 관계"
                  : "분석 관계"}
            </Badge>
            <div className="mt-5 rounded-xl bg-muted/45 p-4 text-sm">
              <strong>{selection.sourceLabel}</strong>
              <span className="mx-2 text-muted-foreground">↔</span>
              <strong>{selection.targetLabel}</strong>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {selection.relationType === "confirmed"
                ? "공개된 공고 정보에서 직접 확인되는 관계입니다."
                : selection.relationType === "aggregate"
                  ? "낙찰·계약 이력을 중복 제거해 집계한 관계입니다."
                  : "과거 이력을 바탕으로 탐색을 위해 연결한 관계입니다."}
            </p>
          </>
        )}
        {selection.type === "node" && selection.kind === "organization" && (
          <p className="text-sm leading-6 text-muted-foreground">
            {organizationName}을 중심으로 낙찰·계약 이력과 동일 분야 업체를 탐색하고 있습니다.
          </p>
        )}
        {company && (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-[11px] text-muted-foreground">기관 수주</dt>
                <dd className="mt-1 font-bold">
                  {company.organization_relationship?.award_event_count ?? 0}건
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-[11px] text-muted-foreground">유사·관련사업</dt>
                <dd className="mt-1 font-bold">{company.similar_project_experience?.event_count ?? 0}건</dd>
              </div>
              <div className="col-span-2 rounded-xl bg-muted/50 p-3">
                <dt className="text-[11px] text-muted-foreground">기관 누적 계약금액</dt>
                <dd className="mt-1 font-bold">
                  {money(company.organization_relationship?.total_attributed_contract_amount)}
                </dd>
              </div>
            </dl>
            <h3 className="mt-7 font-bold">실제 기관 수주공고</h3>
            {relationship.isFetching && <LoaderCircle className="mt-3 size-4 animate-spin" />}
            <div className="mt-2 divide-y">
              {relationship.data?.events.slice(0, 5).map((event) => (
                <Link
                  key={event.award_event_id}
                  to={`/notices/${encodeURIComponent(event.bid_notice_id)}`}
                  className="block py-3"
                >
                  <strong className="line-clamp-2 text-sm hover:text-blue-700">
                    {event.notice_name ?? event.bid_notice_id}
                  </strong>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.contract_date ?? event.award_date ?? "일자 미상"} ·{" "}
                    {money(event.attributed_contract_amount ?? event.contract_amount ?? event.award_amount)}
                  </p>
                </Link>
              ))}
            </div>
            <Button asChild variant="outline" className="mt-5 w-full">
              <Link
                to={`/companies/${encodeURIComponent(company.company_number)}?name=${encodeURIComponent(company.company_name)}`}
              >
                업체 프로필
              </Link>
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
