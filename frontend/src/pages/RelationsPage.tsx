import cytoscape, { type ElementDefinition } from "cytoscape";
import { Building2, FileText, Landmark, LoaderCircle, Search, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useNotice,
  useNoticeMarketContext,
  useNoticeOrganizationCompanyRelationship,
  useNoticeOrganizationFieldCompanies,
  type OrganizationFieldCompany,
} from "../features/notices/api";

type GraphSelection =
  | {
      type: "node";
      id: string;
      kind: "notice" | "organization" | "company";
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

const money = (value?: number) =>
  value == null
    ? "금액 미상"
    : value >= 100_000_000
      ? `${(value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`
      : `${value.toLocaleString("ko-KR")}원`;

function ProcurementGraph({
  elements,
  onSelect,
}: {
  elements: ElementDefinition[];
  onSelect: (selection?: GraphSelection) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      elements,
      wheelSensitivity: 0.22,
      minZoom: 0.45,
      maxZoom: 1.7,
      boxSelectionEnabled: false,
      style: [
        {
          selector: "node",
          style: {
            width: 56,
            height: 56,
            "background-color": "#ffffff",
            "border-width": 3,
            "border-color": "#94a3b8",
            label: "data(label)",
            color: "#0f172a",
            "font-size": 11,
            "font-weight": 650,
            "text-wrap": "wrap",
            "text-max-width": "126px",
            "text-valign": "bottom",
            "text-margin-y": 13,
            "overlay-opacity": 0,
          },
        },
        {
          selector: 'node[kind = "notice"]',
          style: {
            shape: "round-rectangle",
            width: 76,
            height: 58,
            "background-color": "#eff6ff",
            "border-color": "#2563eb",
          },
        },
        {
          selector: 'node[kind = "organization"]',
          style: { "background-color": "#f5f3ff", "border-color": "#7c3aed" },
        },
        {
          selector: 'node[kind = "company"]',
          style: { "background-color": "#f0fdfa", "border-color": "#0f766e" },
        },
        {
          selector: 'node[isCenter = "true"]',
          style: {
            width: 92,
            height: 68,
            "border-width": 4,
            "font-size": 12,
            "text-max-width": "155px",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 5,
            "border-color": "#0f172a",
            "underlay-color": "#2563eb",
            "underlay-opacity": 0.12,
            "underlay-padding": 8,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.6,
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.72,
            "overlay-opacity": 0,
          },
        },
        {
          selector: 'edge[relationType = "aggregate"]',
          style: { width: 2.6, "line-color": "#0f766e", "target-arrow-color": "#0f766e" },
        },
        {
          selector: 'edge[relationType = "analysis"]',
          style: {
            width: 1.5,
            "line-color": "#93c5fd",
            "target-arrow-color": "#93c5fd",
            "line-style": "dashed",
            "line-dash-pattern": [7, 6],
          },
        },
        {
          selector: "edge:selected",
          style: { width: 4, "line-color": "#0f172a", "target-arrow-color": "#0f172a" },
        },
      ],
      layout: {
        name: "concentric",
        animate: false,
        fit: true,
        padding: 58,
        minNodeSpacing: 48,
        spacingFactor: 1.08,
        startAngle: -Math.PI / 2,
        sweep: Math.PI * 2,
        concentric: (node) =>
          node.data("isCenter") === "true" ? 3 : node.data("kind") === "organization" ? 2 : 1,
        levelWidth: () => 1,
      },
    });
    cy.on("tap", "node", (event) => {
      const data = event.target.data();
      onSelect({ type: "node", id: data.id, kind: data.kind, label: data.label, company: data.company });
    });
    cy.on("tap", "edge", (event) => {
      const edge = event.target;
      const data = edge.data();
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
      if (event.target === cy) onSelect(undefined);
    });
    const resize = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 70);
    });
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      cy.destroy();
    };
  }, [elements, onSelect]);
  return <div className="cytoscape-canvas" ref={container} />;
}

export function RelationsPage({ embedded = false }: { embedded?: boolean }) {
  const [params, setParams] = useSearchParams();
  const noticeId = params.get("notice") ?? "";
  const [input, setInput] = useState(noticeId);
  const [selection, setSelection] = useState<GraphSelection>();
  const [showPastNotices, setShowPastNotices] = useState(false);
  const detail = useNotice(noticeId || undefined);
  const relations = useNoticeOrganizationFieldCompanies(noticeId || undefined);
  const market = useNoticeMarketContext(noticeId || undefined, showPastNotices);
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
      { data: { id: "current-notice", label: notice.name, kind: "notice", isCenter: "true" } },
      { data: { id: "organization", label: notice.organization, kind: "organization" } },
      {
        data: {
          id: "edge-issued",
          source: "organization",
          target: "current-notice",
          relation: "발주",
          relationType: "confirmed",
        },
      },
    ];
    companies.forEach((company) => {
      const id = `company-${company.company_number}`;
      const orgCount = company.organization_relationship?.award_event_count ?? 0;
      result.push({ data: { id, label: company.company_name, kind: "company", company } });
      result.push({
        data: {
          id: `related-${id}`,
          source: "current-notice",
          target: id,
          relation: "현재 공고 관련 이력",
          relationType: "analysis",
        },
      });
      if (orgCount > 0)
        result.push({
          data: {
            id: `awarded-${id}`,
            source: "organization",
            target: id,
            relation: `기관 수주 ${orgCount}건`,
            relationType: "aggregate",
          },
        });
    });
    if (showPastNotices)
      (market.data?.similar_notices ?? []).slice(0, 4).forEach((item, index) => {
        const id = `past-${item.bid_notice_id ?? item.id}`;
        result.push({ data: { id, label: item.notice_name ?? "과거 공고", kind: "notice" } });
        result.push({
          data: {
            id: `past-edge-${index}`,
            source: id,
            target: "current-notice",
            relation: "관련 공고",
            relationType: "analysis",
          },
        });
      });
    return result;
  }, [companies, market.data?.similar_notices, notice, showPastNotices]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (value) {
      setSelection(undefined);
      setParams({ notice: value });
    }
  };
  return (
    <div className={`relation-workspace ${embedded ? "is-embedded" : ""}`}>
      {!embedded && (
        <PageContainer className="max-w-[1600px] pb-5 pt-7">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold text-blue-800">관계 탐색</p>
              <h1 className="mt-1 text-2xl font-bold">검색하고 연결을 탐색하세요</h1>
            </div>
            <form className="flex w-full max-w-2xl gap-2" onSubmit={submit}>
              <div className="relative flex-1">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={18}
                />
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  className="h-11 bg-card pl-11"
                  placeholder="공고 ID 입력"
                />
              </div>
              <Button className="h-11 bg-blue-800">그래프 열기</Button>
            </form>
          </div>
        </PageContainer>
      )}
      {!embedded && !noticeId && (
        <PageContainer className="max-w-[1600px]">
          <section className="mt-12 rounded-3xl border border-dashed bg-card p-14 text-center">
            <Search className="mx-auto text-blue-700" />
            <h2 className="mt-4 text-xl font-bold">홈에서 공고를 검색하세요</h2>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/">홈으로</Link>
            </Button>
          </section>
        </PageContainer>
      )}
      {noticeId && (detail.isLoading || relations.isLoading) && (
        <PageContainer className="max-w-[1600px]">
          <Skeleton className="mt-5 h-[700px] rounded-2xl" />
        </PageContainer>
      )}
      {notice && (
        <div className="network-stage">
          <div className="network-toolbar">
            <div className="min-w-0">
              <Badge className="border-0 bg-blue-100 text-blue-800 hover:bg-blue-100">중심 공고</Badge>
              <strong className="ml-3 align-middle text-sm">{notice.name}</strong>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowPastNotices((value) => !value)}>
                {showPastNotices ? "과거 공고 숨기기" : "과거 공고 보기"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelection(undefined)}>
                선택 해제
              </Button>
            </div>
          </div>
          <div className="network-legend">
            <span>
              <i className="legend-dot organization" />
              기관
            </span>
            <span>
              <i className="legend-dot company" />
              업체
            </span>
            <span>
              <i className="legend-square notice" />
              공고
            </span>
            <span className="text-muted-foreground">노드 클릭 · 선 클릭으로 근거 확인</span>
          </div>
          <ProcurementGraph elements={elements} onSelect={setSelection} />
          {selection && (
            <RelationDrawer
              selection={selection}
              noticeId={noticeId}
              organizationName={notice.organization}
              relationship={relationship}
              onClose={() => setSelection(undefined)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RelationDrawer({
  selection,
  noticeId,
  organizationName,
  relationship,
  onClose,
}: {
  selection: GraphSelection;
  noticeId: string;
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
                    : "공고"}
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
        {selection.type === "node" && selection.kind === "notice" && (
          <Button asChild variant="outline" className="w-full">
            <Link
              to={`/notices/${encodeURIComponent(selection.id === "current-notice" ? noticeId : selection.id.replace("past-", ""))}`}
            >
              공고 프로필
            </Link>
          </Button>
        )}
        {selection.type === "node" && selection.kind === "organization" && (
          <p className="text-sm leading-6 text-muted-foreground">
            {organizationName}이 현재 공고를 발주했습니다.
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
