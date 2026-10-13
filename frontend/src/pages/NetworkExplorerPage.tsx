import { useRef, useState, useSyncExternalStore } from "react";
import { Dialog } from "radix-ui";
import { X, List, LoaderCircle } from "lucide-react";
import { EntityDetailContextBar } from "@/components/common/entity-detail-context-bar";
import { Button } from "@/components/ui/button";
import { ExplorerGraph } from "@/features/network-explorer/ExplorerGraph";
import { visibleCompanyGraph } from "@/features/network-explorer/graph-layout";
import { explorerNodePresentation } from "@/features/network-explorer/graph-presentation";
import { useExplorerFilters } from "@/features/network-explorer/useExplorerFilters";
import { ProcurementFilterPanel } from "@/components/procurement/procurement-filter-panel";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { procurementWorkTypeLabels } from "@/shared/procurement/presentation";
import { ExplorerFieldPanel } from "@/features/network-explorer/ExplorerFieldPanel";
import { ExplorerSearch } from "@/features/network-explorer/ExplorerSearch";
import { ExplorerRelationshipPanel } from "@/features/network-explorer/ExplorerRelationshipPanel";
import { ExplorerInspector } from "@/features/network-explorer/ExplorerInspector";
import {
  entityKey,
  linkKey,
  linkLabel,
  useNetworkExplorer,
  type ExplorerEntity,
} from "@/features/network-explorer/useNetworkExplorer";
import { procurementFieldIdentity, procurementFieldSelection } from "@/shared/procurement/field-options";

function subscribe(callback: () => void) {
  const media = window.matchMedia?.("(min-width: 1024px)");
  media?.addEventListener("change", callback);
  return () => media?.removeEventListener("change", callback);
}
function desktopSnapshot() {
  return window.matchMedia?.("(min-width: 1024px)").matches ?? true;
}
export function NetworkExplorerPage() {
  return <ExplorerWorkspace />;
}
function ExplorerWorkspace() {
  const view = useNetworkExplorer();
  const { params, root, selected, selectedLink, expanded, rootQuery, expansionQuery, fromYear, toYear } =
    view;
  const [listOpen, setListOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const draft = useExplorerFilters(view, filterOpen);
  const { noticeId, noticeContext } = draft;
  const desktop = useSyncExternalStore(subscribe, desktopSnapshot, () => true);
  const focusTarget = useRef<HTMLElement | null>(null);
  const choose = (entity: ExplorerEntity) => {
    draft.chooseRoot(entity);
    setFilterOpen(true);
  };
  const largeNames = [
    ...new Set(
      draft.fields
        .map((field) => procurementFieldSelection(field).large_category)
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  if (draft.values.large && !largeNames.includes(draft.values.large)) largeNames.unshift(draft.values.large);
  const detailFields = draft.fields.filter((field) => {
    const selection = procurementFieldSelection(field);
    return (
      (selection.field_code || selection.middle_category) &&
      (!draft.values.large ||
        selection.large_category === draft.values.large ||
        field.large_category === draft.values.large)
    );
  });
  const detailOptions = detailFields.map((field) => ({
    value: procurementFieldIdentity(field),
    label: field.display_name ?? field.field_name ?? field.middle_category ?? field.field_code ?? "미분류",
  }));
  if (draft.values.field || draft.values.middle) {
    if (!detailOptions.some((option) => option.value === draft.fieldValue))
      detailOptions.unshift({ value: draft.fieldValue, label: draft.selectedName ?? "선택 분야" });
  }
  const apply = () => {
    if (draft.apply()) setFilterOpen(false);
    else setFilterOpen(true);
  };
  const select = (entity: ExplorerEntity) => {
    focusTarget.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (view.entities.some((item) => entityKey(item) === entityKey(entity))) view.select(entity);
    else view.chooseRoot(entity, { selected: entityKey(entity) });
  };
  const entityView =
    params.get("entityView") === "organization"
      ? "organization"
      : params.get("entityView") === "company"
        ? "company"
        : "all";
  const showCompetitorOrganizations = params.get("competitorOrganizations") === "show";
  const graph = visibleCompanyGraph(root, view.entities, view.links, showCompetitorOrganizations);
  const visibleEntities = graph.entities.filter(
    (entity) =>
      entityView === "all" || entity.type === entityView || (root && entityKey(entity) === entityKey(root)),
  );
  const visibleLinks = graph.links.filter(
    (link) =>
      entityView === "all" ||
      [link.source, link.target].every(
        (entity) => entity.type === entityView || (root && entityKey(entity) === entityKey(root)),
      ),
  );
  const rootContractOrganizations =
    root?.type === "company"
      ? new Set(
          view.links
            .filter(
              (link) =>
                (link.kind ?? "contract") === "contract" &&
                [link.source, link.target].some((entity) => entityKey(entity) === entityKey(root)),
            )
            .flatMap((link) => [link.source, link.target].filter((entity) => entity.type === "organization"))
            .map(entityKey),
        ).size
      : 0;
  const shownCompetitors =
    root?.type === "company" ? view.links.filter((link) => link.kind === "competition").length : 0;
  const closePanel = () => view.update({ selected: undefined, selectedRelation: undefined });
  const panelOpen = Boolean(selected || selectedLink);
  const selectLink = (link: (typeof view.links)[number]) => {
    focusTarget.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    view.update({ selected: undefined, selectedRelation: linkKey(link) });
  };
  const inspector = selectedLink ? (
    <ExplorerRelationshipPanel
      key={`${linkKey(selectedLink)}-${fromYear}-${toYear}-${params.get("field")}`}
      link={selectedLink}
      params={params}
      fromYear={fromYear}
      toYear={toYear}
      onSelect={select}
      snapshotId={selectedLink.networkSnapshot ? view.snapshotId : undefined}
    />
  ) : (
    selected &&
    (selected.type === "field" ? (
      <ExplorerFieldPanel
        entity={selected}
        links={view.links}
        params={params}
        fromYear={fromYear}
        toYear={toYear}
        onSelect={select}
      />
    ) : (
      <ExplorerInspector
        key={`${entityKey(selected)}-${fromYear}-${toYear}-${params.get("field")}-${params.get("selectedRelation")}`}
        entity={selected}
        params={params}
        fromYear={fromYear}
        toYear={toYear}
        links={view.links}
        preloadedCompany={selected.type === "company" ? view.companyProfiles.get(selected.id) : undefined}
        preloadedOrganization={
          selected.type === "organization" && root && entityKey(root) === entityKey(selected)
            ? view.organizationData
            : undefined
        }
        pageSize={root && entityKey(root) === entityKey(selected) ? view.nodeLimit : 5}
        onCenter={() => choose(selected)}
        onSelect={select}
      />
    ))
  );
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-8 sm:py-5" aria-label="관계 탐색">
      <EntityDetailContextBar
        className="mx-0! mt-0! rounded-lg"
        tabs={[]}
        value="network"
        onTabChange={() => {}}
        conditionSummary={`${procurementWorkTypeLabels[draft.values.workType ?? ""] ?? "전체 업무"} · ${draft.selectedName ?? "분야 선택"} · ${draft.fromYear}–${draft.toYear}년`}
        compactConditionSummary={draft.selectedName ?? "분야 선택"}
        appliedFilterCount={draft.chips.length}
        filterOpen={filterOpen}
        onFilterOpenChange={setFilterOpen}
        trailingAction={
          <Button className="h-9 shrink-0 px-4" size="sm" onClick={apply}>
            조회
          </Button>
        }
        primaryContent={
          <div className="flex min-w-0 flex-1 items-center gap-2 py-2">
            <ExplorerSearch
              key={`${draft.basis}-${draft.values.searchLabel ?? ""}`}
              initialQuery={draft.values.q ?? ""}
              selectedLabel={draft.values.searchLabel ?? draft.root?.name}
              fromYear={draft.fromYear}
              toYear={draft.toYear}
              onSearch={apply}
              onInputChange={(text) => draft.edit({ q: text })}
              onChoose={(entity) => {
                draft.chooseRoot(entity);
                setFilterOpen(true);
              }}
              onNotice={(notice) => {
                draft.chooseNotice(notice);
                setFilterOpen(true);
              }}
              onField={(field) => {
                const workType = field.work_types?.length === 1 ? field.work_types[0] : undefined;
                draft.chooseRoot(
                  { type: "field", id: field.field_code, name: field.field_name },
                  {
                    q: field.field_name,
                    field: field.field_code,
                    fieldName: field.field_name,
                    fieldOption: undefined,
                    workType,
                    large: field.large_category,
                    middle: field.middle_category,
                  },
                );
                setFilterOpen(true);
              }}
            />
          </div>
        }
      >
        <ProcurementFilterPanel
          compact
          earliestYear={2022}
          currentYear={new Date().getUTCFullYear()}
          period={[draft.fromYear, draft.toYear]}
          onPeriodChange={(period) =>
            draft.edit({ fromYear: String(Math.max(period[0], period[1] - 4)), toYear: String(period[1]) })
          }
          onPeriodCommit={(period) =>
            draft.edit({ fromYear: String(Math.max(period[0], period[1] - 4)), toYear: String(period[1]) })
          }
          workTypeValue={draft.values.workType ?? "all"}
          workTypeOptions={[
            { value: "all", label: "전체" },
            ...Object.entries(procurementWorkTypeLabels).map(([value, label]) => ({ value, label })),
          ]}
          onWorkTypeChange={(value) =>
            draft.edit({
              workType: value === "all" ? undefined : value,
              large: undefined,
              middle: undefined,
              field: undefined,
              fieldName: undefined,
              fieldOption: undefined,
            })
          }
          fieldValue={draft.fieldValue}
          fieldOptions={detailOptions}
          onFieldChange={draft.selectField}
          fieldContent={
            <div className="grid grid-cols-2 gap-2">
              <SearchableSelect
                ariaLabel="대분류"
                placeholder="대분류 선택"
                searchPlaceholder="대분류 검색"
                value={draft.values.large ?? "all"}
                options={[
                  { value: "all", label: "대분류 선택" },
                  ...largeNames.map((name) => ({ value: name, label: name })),
                ]}
                disabled={!largeNames.length}
                onValueChange={(value) =>
                  draft.edit({
                    large: value === "all" ? undefined : value,
                    middle: undefined,
                    field: undefined,
                    fieldOption: undefined,
                    fieldName: value === "all" ? undefined : value,
                  })
                }
              />
              <SearchableSelect
                ariaLabel="세부분야·품목"
                placeholder="세부분야·품목 선택"
                searchPlaceholder="분야·품목명 검색"
                value={draft.values.field || draft.values.middle ? draft.fieldValue : "all"}
                options={[{ value: "all", label: "전체 세부분야" }, ...detailOptions]}
                onValueChange={(value) =>
                  value === "all" ? draft.clearField("middle") : draft.selectField(value)
                }
              />
            </div>
          }
          appliedFilters={draft.chips}
          appliedLabel="선택한 조건"
          onReset={draft.reset}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          조건을 고른 뒤 오른쪽 위 조회를 눌러 주세요. 지역별 검색은 아직 사용할 수 없습니다.
        </p>
        {draft.catalog.isFetching && (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            선택할 분야를 불러오고 있습니다.
          </p>
        )}
        {draft.catalog.isError && (
          <p role="alert" className="mt-2 text-xs">
            분야를 불러오지 못했습니다.{" "}
            <button className="underline" onClick={() => void draft.catalog.refetch()}>
              다시 시도
            </button>
          </p>
        )}
        {draft.error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {draft.error}
          </p>
        )}
      </EntityDetailContextBar>
      {!filterOpen && draft.chips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            선택한 조건{draft.hasChanges ? " · 조회 후 적용" : ""}
          </span>
          {draft.chips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 px-2.5 py-1 text-primary"
            >
              {chip.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
      {noticeId && noticeContext.isFetching && (
        <p role="status" className="mt-4 text-xs text-muted-foreground">
          공고 정보를 확인하고 있습니다.
        </p>
      )}
      {noticeId &&
        (noticeContext.isError ||
          (noticeContext.data &&
            (!noticeContext.data.notice.organization_code || noticeContext.data.truncated))) && (
          <p role="alert" className="mt-4 text-xs">
            공고의 기관이나 분야를 확인하지 못했습니다.{" "}
            <button
              className="text-primary underline"
              onClick={() => {
                void noticeContext.refetch();
              }}
            >
              다시 시도
            </button>
          </p>
        )}
      {params.get("sourceNotice") && (
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          선택 공고: {params.get("sourceNoticeName")}
          {params.get("contextMissing") ? " · 분야를 직접 선택해 주세요" : ""} ·{" "}
          {params.get("regionName") ? `기관 소재지 ${params.get("regionName")}` : "기관 지역 정보 없음"}. 현재
          지역별 검색은 아직 사용할 수 없습니다.
        </p>
      )}
      <section
        className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-card"
        aria-label="계약 관계 탐색 결과"
      >
        <div
          className={`grid h-[520px] min-w-0 sm:h-[clamp(520px,calc(100dvh-220px),780px)] ${panelOpen && desktop ? "lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]" : "grid-cols-1"}`}
        >
          <section
            className="relative min-h-0 min-w-0 overflow-hidden bg-[#0b1220]"
            aria-label="인터랙티브 관계 그래프"
          >
            <div
              className="absolute inset-x-4 top-4 z-10 flex min-w-0 items-center gap-2 text-xs"
              aria-label="현재 탐색 조건"
            >
              <div className="flex min-w-0 items-center gap-2 bg-[#0b1220]/80 py-1">
                <span className="max-w-48 truncate font-medium text-slate-200" title={root?.name}>
                  {root?.name ?? "거래 관계"}
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  /
                </span>
                <span
                  className="max-w-56 truncate text-slate-400"
                  title={params.get("fieldName") ?? undefined}
                >
                  {params.get("fieldName") ?? "분야 선택"}
                </span>
                <span className="hidden text-slate-400 lg:inline">
                  {root?.type === "company"
                    ? `계약기관 ${rootContractOrganizations}곳 · 경쟁사 ${shownCompetitors}/${view.competitorQuery.data?.pagination.total_items ?? 0}곳 · 그래프 전체 ${visibleEntities.length}곳`
                    : `${visibleEntities.length}곳 · 거래 관계 ${visibleLinks.length}개`}
                </span>
              </div>
              <div
                className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 bg-[#132033]/95 p-1 text-[11px] text-slate-400"
                role="group"
                aria-label="표시할 대상"
              >
                {root?.type === "company" && (
                  <button
                    aria-label="경쟁 업체 발주기관 보기"
                    aria-pressed={showCompetitorOrganizations}
                    onClick={() =>
                      view.update({
                        competitorOrganizations: showCompetitorOrganizations ? undefined : "show",
                        selected: undefined,
                        selectedRelation: undefined,
                      })
                    }
                    className={`flex h-7 items-center rounded-md px-2 transition-colors ${showCompetitorOrganizations ? "bg-slate-700 text-white" : "hover:bg-slate-800 hover:text-slate-200"}`}
                  >
                    <span className="hidden sm:inline">경쟁 업체 발주기관</span>
                    <span className="sm:hidden">경쟁 기관</span>
                  </button>
                )}
                {root?.type === "company" && <span className="h-4 w-px bg-slate-700" aria-hidden="true" />}
                {(
                  [
                    ["all", "전체"],
                    ["organization", "기관"],
                    ["company", "업체"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={entityView === value}
                    onClick={() =>
                      view.update({
                        entityView: value === "all" ? undefined : value,
                        selected: undefined,
                        selectedRelation: undefined,
                      })
                    }
                    className={`flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors ${entityView === value ? "bg-slate-700 text-white" : "hover:bg-slate-800 hover:text-slate-200"}`}
                  >
                    {value !== "all" && (
                      <span
                        className={`size-1.5 rounded-full ${explorerNodePresentation[value].filterDotClass}`}
                        aria-hidden="true"
                      />
                    )}
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {(entityView !== "all" || view.networkTruncation?.truncated) && (
              <p className="pointer-events-none absolute left-4 top-16 z-10 text-[10px] text-slate-400">
                {entityView !== "all" ? "다른 대상과 연결선은 숨김" : ""}
                {entityView !== "all" && view.networkTruncation?.truncated ? " · " : ""}
                {view.networkTruncation?.truncated ? "상위 관계만 표시" : ""}
              </p>
            )}
            <div
              className="absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-132px)] flex-wrap items-center gap-1 sm:max-w-none rounded-lg border border-slate-700 bg-[#132033]/95 p-1 shadow-sm text-slate-300"
              role="toolbar"
              aria-label="그래프 보기 설정"
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs hover:bg-slate-700 hover:text-white"
                onClick={() => setListOpen(!listOpen)}
                aria-expanded={listOpen}
                aria-label="기관·업체 목록"
                aria-controls="explorer-node-list"
                aria-pressed={listOpen}
              >
                <List className="size-3.5" />
                <span className="hidden sm:inline">목록</span>
              </Button>
              {(root?.type === "organization" || root?.type === "company") && (
                <span className="h-4 w-px bg-slate-700" aria-hidden="true" />
              )}
              {(root?.type === "organization" || root?.type === "company") && (
                <select
                  aria-label={root.type === "company" ? "표시할 경쟁 업체 수" : "표시할 거래 업체 수"}
                  title={
                    root.type === "company"
                      ? "경쟁 업체를 몇 곳까지 표시할까요?"
                      : "거래 업체를 몇 곳까지 표시할까요?"
                  }
                  className="h-8 rounded-md bg-transparent pl-2 pr-1 text-xs text-slate-300 outline-offset-2"
                  value={view.nodeLimit}
                  onChange={(e) => view.changeFilters({ nodeLimit: e.target.value })}
                >
                  {[5, 10, 20].map((value) => (
                    <option className="bg-slate-900 text-slate-200" value={value} key={value}>
                      상위 {value}개
                    </option>
                  ))}
                </select>
              )}
            </div>
            {!view.graphLoading && view.hasFieldSelection && (
              <ExplorerGraph
                root={root}
                entityVisibility={entityView}
                entities={graph.entities}
                links={graph.links}
                selected={selected}
                selectedRelation={selectedLink ? linkKey(selectedLink) : undefined}
                onSelect={select}
                onSelectLink={selectLink}
                onClear={closePanel}
              />
            )}
            {(!root || !view.hasFieldSelection) && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-slate-400">
                <div>
                  <h2 className="text-base font-semibold text-slate-200">
                    기관·업체·공고를 검색해 시작하세요
                  </h2>
                  <p className="mt-3 text-sm leading-7">
                    분야를 선택하면 거래처와 연관 기관을 함께 보여드립니다.
                  </p>
                  {root && !view.hasFieldSelection && rootQuery.isSuccess && !draft.fields.length && (
                    <p className="mt-4 text-xs">
                      확인된 분야 목록이 없습니다. 검색창에서 분야·품목명으로 찾아 선택하세요.
                    </p>
                  )}
                </div>
              </div>
            )}
            {view.graphLoading && (
              <div
                role="status"
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b1220] text-center text-slate-400"
              >
                <LoaderCircle className="size-6 animate-spin text-blue-500" aria-hidden="true" />
                <strong className="text-sm font-medium text-slate-200">정보를 불러오고 있습니다</strong>
                <p className="text-xs text-slate-500">
                  {rootQuery.isLoading || rootQuery.isPlaceholderData
                    ? "선택한 정보를 확인하고 있습니다."
                    : root?.type === "company" && view.companyRelationsLoading
                      ? "같은 입찰에 참여한 업체와 거래기관을 확인하고 있습니다."
                      : `거래처 확인 중 · ${view.loadedBranches}/${view.children.length}곳`}
                </p>
              </div>
            )}
            {root && rootQuery.isError && (
              <div
                role="alert"
                className="absolute left-4 top-24 rounded-xl border bg-white p-4 text-sm text-slate-700"
              >
                정보를 불러오지 못했습니다.{" "}
                <Button variant="secondary" onClick={() => void rootQuery.refetch()}>
                  다시 시도
                </Button>
              </div>
            )}
            {root &&
              root.type !== "field" &&
              view.hasFieldSelection &&
              rootQuery.isSuccess &&
              !rootQuery.isPlaceholderData &&
              view.children.length === 0 && (
                <p className="absolute left-4 top-24 rounded-xl border bg-white/95 p-3 text-sm text-slate-700">
                  선택한 조건에 맞는 계약이 없습니다.
                </p>
              )}
            {expanded && expansionQuery.isError && (
              <div
                role="alert"
                className="absolute left-4 top-24 rounded-xl border bg-white p-4 text-sm text-slate-700"
              >
                추가 거래처를 불러오지 못했습니다.{" "}
                <Button variant="secondary" onClick={() => void expansionQuery.refetch()}>
                  다시 시도
                </Button>
              </div>
            )}
            {root?.type === "company" && view.competitorQuery.isError && (
              <p
                role="alert"
                className="absolute left-4 top-24 rounded-xl border bg-white p-3 text-xs text-slate-700"
              >
                같은 입찰에 참여한 업체를 불러오지 못했습니다.{" "}
                <button className="underline" onClick={() => void view.competitorQuery.refetch()}>
                  다시 시도
                </button>
              </p>
            )}
            {root?.type === "company" && view.competitorOrganizationError && (
              <p
                role="alert"
                className="absolute left-4 top-36 rounded-xl border bg-white p-3 text-xs text-slate-700"
              >
                일부 경쟁사의 거래기관을 확인하지 못했습니다.
              </p>
            )}
            {root?.type === "company" &&
              !view.graphLoading &&
              !view.competitorQuery.isError &&
              view.competitorQuery.data?.items.length === 0 && (
                <p className="absolute left-4 top-36 rounded-xl border bg-white/95 p-3 text-xs text-slate-700">
                  같은 입찰 참여 업체가 확인되지 않아 거래기관만 표시합니다.
                </p>
              )}
            {listOpen && view.hasFieldSelection && (
              <section
                className="absolute left-3 bottom-32 z-20 sm:bottom-16 max-h-[65%] w-72 max-w-[calc(100%-24px)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-slate-700 shadow-lg"
                id="explorer-node-list"
                aria-label="기관·업체 목록"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-600">기관·업체 목록</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="목록 닫기"
                    onClick={() => setListOpen(false)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                {visibleEntities.map((entity) => (
                  <button
                    className="block w-full rounded p-2 text-left text-xs hover:bg-slate-100"
                    key={entityKey(entity)}
                    onClick={() => select(entity)}
                  >
                    {entity.type === "company" ? "업체" : entity.type === "field" ? "분야" : "기관"} ·{" "}
                    {entity.name}
                  </button>
                ))}
                <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">거래 관계</p>
                {visibleLinks.map((link) => (
                  <button
                    key={linkKey(link)}
                    className="mt-2 block w-full rounded p-2 text-left text-xs hover:bg-slate-100"
                    onClick={() => selectLink(link)}
                  >
                    {link.source.name} ↔ {link.target.name}
                    <span className="mt-1 block text-slate-400">{linkLabel(link)}</span>
                  </button>
                ))}
              </section>
            )}
          </section>
          {panelOpen && desktop && (
            <aside
              key={selectedLink ? linkKey(selectedLink) : selected ? entityKey(selected) : "panel"}
              className="min-h-0 overflow-y-auto border-l bg-card p-5"
              aria-label={selectedLink ? "선택한 거래 정보" : "선택한 기관·업체 정보"}
            >
              <div className="mb-4 flex justify-end">
                <Button variant="ghost" size="sm" aria-label="분석 패널 닫기" onClick={closePanel}>
                  <X />
                </Button>
              </div>
              {inspector}
            </aside>
          )}
        </div>
      </section>
      {!desktop && (
        <Dialog.Root
          open={panelOpen}
          onOpenChange={(open) => {
            if (!open) closePanel();
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
            <Dialog.Content
              className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-background p-5"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                focusTarget.current?.focus();
              }}
            >
              <Dialog.Title className="sr-only">
                {selectedLink ? "선택한 거래 정보" : "선택한 기관·업체 정보"}
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                선택한 기관·업체의 실적이나 거래 내역을 보여줍니다.
              </Dialog.Description>
              <Dialog.Close asChild>
                <Button className="mb-3 ml-auto flex" variant="ghost" aria-label="분석 패널 닫기">
                  <X />
                </Button>
              </Dialog.Close>
              {inspector}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </main>
  );
}
