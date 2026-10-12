import { procurementWorkTypeLabels as workTypeLabels } from "@/shared/procurement/presentation";
import { useCompanyDetailPage } from "@/features/company-context/useCompanyDetailPage";
import { Search, X } from "lucide-react";

import {
  ENTITY_RELATIONSHIP_PAGE_SIZE,
  EntityRelationshipList,
} from "@/components/common/entity-relationship-list";
import {
  EntityDetailSection,
  EntityDetailToolbar,
  EntityMetric,
  EntityMetricGrid,
  EntitySectionHeader,
} from "@/components/common/entity-detail-section";
import { ListPagination } from "@/components/common/list-pagination";
import { ListEmptyState } from "@/components/common/list-empty-state";
import { SectionError } from "@/components/common/error-state";

import { RelationshipAnalysis } from "@/components/procurement/relationship-analysis";

import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { MetricHelp } from "@/components/common/metric-help";
import { UpdatingOverlay } from "@/components/common/updating-overlay";

import { RelationshipTreemap } from "@/features/relationships/RelationshipTreemap";
import { formatCompactMoney as money } from "@/shared/format/money";

export function CompanyOrganizationsSection({
  view,
}: {
  view: Pick<
    ReturnType<typeof useCompanyDetailPage>,
    | "params"
    | "setParams"
    | "fromYear"
    | "toYear"
    | "workType"
    | "organizationPage"
    | "organizationSearch"
    | "setOrganizationSearch"
    | "organizationListFilter"
    | "setOrganizationListFilter"
    | "updateFilters"
    | "setListPage"
    | "organizationProcurement"
    | "overviewOrganizationRelationships"
    | "contractedOrganizations"
    | "displayedOrganizations"
    | "selectedOrganization"
    | "organizationRelationship"
    | "summary"
    | "organizationEntry"
    | "organizationAmountTotal"
    | "topFiveOrganizationShare"
    | "selectedFieldText"
    | "periodLabel"
    | "organizationHref"
    | "selectOrganization"
    | "submitOrganizationSearch"
    | "clearOrganizationSearch"
    | "openSelectedOrganizationNotices"
    | "name"
    | "isProcurementUpdating"
  >;
}) {
  const {
    params,
    setParams,
    fromYear,
    toYear,
    workType,
    organizationPage,
    organizationSearch,
    setOrganizationSearch,
    organizationListFilter,
    setOrganizationListFilter,
    updateFilters,
    setListPage,
    organizationProcurement,
    overviewOrganizationRelationships,
    contractedOrganizations,
    displayedOrganizations,
    selectedOrganization,
    organizationRelationship,
    summary,
    organizationEntry,
    organizationAmountTotal,
    topFiveOrganizationShare,
    selectedFieldText,
    periodLabel,
    organizationHref,
    selectOrganization,
    submitOrganizationSearch,
    clearOrganizationSearch,
    openSelectedOrganizationNotices,
    name,
    isProcurementUpdating,
  } = view;

  return (
    <EntityDetailSection
      title="발주기관 분석"
      description="계약금액 분포를 비교하고 개별 기관의 계약 관계를 확인합니다."
    >
      <EntityMetricGrid className="mt-5 sm:grid-cols-3">
        <EntityMetric
          className="border-b sm:border-b-0 sm:border-r sm:px-4"
          label="선택 기간 발주기관"
          value={`${(summary?.organization_count ?? 0).toLocaleString("ko-KR")}개`}
        />
        <EntityMetric
          className="border-b sm:border-b-0 sm:border-r sm:px-4"
          label={
            <>
              귀속 계약금액
              <MetricHelp label="귀속 계약금액 계산 기준">
                {periodLabel} 최초 계약일 기준이며, 조회 종료일 현재의 최신 계약금액을 합산합니다. 공동수급
                계약은 이 업체에 귀속된 금액만 포함합니다.
                {summary?.amount_completeness !== "complete" && (
                  <span className="mt-2 block text-[11px] text-muted-foreground">
                    일부 계약은 귀속금액을 확인할 수 없어 합계에서 제외되었습니다.
                  </span>
                )}
              </MetricHelp>
            </>
          }
          value={money(organizationAmountTotal)}
        />
        <EntityMetric
          className="sm:px-4"
          label={
            <>
              상위 5개 기관 집중도
              <MetricHelp label="상위 5개 기관 집중도 계산 기준">
                전체 귀속 계약금액 중 계약금액 상위 5개 발주기관이 차지하는 비중입니다.
              </MetricHelp>
            </>
          }
          value={
            organizationAmountTotal > 0 ? `${(topFiveOrganizationShare * 100).toFixed(1)}%` : "산출 불가"
          }
        />
      </EntityMetricGrid>
      <RelationshipTreemap
        className="!mt-6"
        title="발주기관 분포"
        description="전체 계약금액 분포와 주요 발주기관의 규모를 함께 비교합니다."
        counterpartType="organization"
        relationships={overviewOrganizationRelationships}
        counterpartCount={summary?.organization_count}
        totalAmount={summary?.total_attributed_contract_amount}
        topFiveShare={organizationAmountTotal > 0 ? topFiveOrganizationShare : null}
        aggregateUnlisted
        showMetrics={false}
        enableDistributionView
        selectedRelationship={selectedOrganization}
        onSelectRelationship={(relationship) => {
          const organizationCode = relationship?.organization_code;
          if (organizationCode) {
            selectOrganization(organizationCode);
            return;
          }
          const next = new URLSearchParams(params);
          next.delete("organization");
          setParams(next, { replace: true });
        }}
        relationshipDetailLoading={organizationRelationship.isFetching && Boolean(selectedOrganization)}
        relationshipDetail={
          selectedOrganization && organizationRelationship.data && !organizationRelationship.isFetching ? (
            <RelationshipAnalysis
              compact
              eyebrow="업체 × 기관"
              title={`${name} × ${selectedOrganization.organization_name}`}
              context={`${periodLabel}${[workType ? (workTypeLabels[workType] ?? workType) : "", selectedFieldText].filter(Boolean).length ? ` · ${[workType ? (workTypeLabels[workType] ?? workType) : "", selectedFieldText].filter(Boolean).join(" · ")}` : ""} 계약 기준`}
              summary={{
                contractCount: selectedOrganization.contract_event_count,
                amount: selectedOrganization.total_attributed_contract_amount,
                activeYearCount: selectedOrganization.active_year_count,
                latestContract:
                  selectedOrganization.latest_contract_date ?? selectedOrganization.latest_activity_date,
              }}
              years={Array.from({ length: toYear - fromYear + 1 }, (_, index) => fromYear + index)}
              yearlyActivity={selectedOrganization.yearly_activity}
              fields={selectedOrganization.major_fields ?? []}
              events={organizationRelationship.data.events ?? []}
              eventPreviewLimit={5}
              eventTotalCount={organizationRelationship.data.pagination?.total_items}
              onOpenAllEvents={openSelectedOrganizationNotices}
              money={money}
            />
          ) : undefined
        }
        getCounterpartHref={(relationship) =>
          relationship.organization_code ? organizationHref(relationship.organization_code) : undefined
        }
      />

      <div className="mt-8 border-t pt-8">
        <EntitySectionHeader
          level={3}
          title="발주기관 목록"
          description="기관을 선택하면 계약 규모와 주요 계약을 먼저 확인할 수 있습니다."
        />
        <EntityDetailToolbar className="mt-4">
          <div className="flex flex-wrap gap-2" aria-label="발주기관 필터">
            <FilterChip
              selected={organizationListFilter === "all"}
              onClick={() => {
                setOrganizationListFilter("all");
                setListPage("organizationPage", 1);
              }}
            >
              전체 {(summary?.organization_count ?? 0).toLocaleString("ko-KR")}
            </FilterChip>
            <FilterChip
              selected={organizationListFilter === "major"}
              onClick={() => {
                setOrganizationListFilter("major");
                setListPage("organizationPage", 1);
              }}
            >
              주요 기관 {Math.min(5, summary?.organization_count ?? 0).toLocaleString("ko-KR")}
            </FilterChip>
            <FilterChip
              selected={organizationListFilter === "new"}
              onClick={() => {
                setOrganizationListFilter("new");
                setListPage("organizationPage", 1);
              }}
            >
              {organizationEntry?.target_year ?? toYear}년 신규 관측{" "}
              {(organizationEntry?.first_observed_organization_count ?? 0).toLocaleString("ko-KR")}
            </FilterChip>
          </div>
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={submitOrganizationSearch}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 pr-9"
                onChange={(event) => setOrganizationSearch(event.target.value)}
                placeholder="발주기관명 검색"
                value={organizationSearch}
              />
              {organizationSearch && (
                <Button
                  aria-label="기관 검색 초기화"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={clearOrganizationSearch}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
            <Button type="submit">검색</Button>
          </form>
        </EntityDetailToolbar>
        <div className="relative mt-4 min-h-40">
          <UpdatingOverlay
            show={
              !isProcurementUpdating &&
              organizationProcurement.isFetching &&
              Boolean(organizationProcurement.data)
            }
            label="발주기관 조회 중"
          />
          {organizationProcurement.isLoading && !organizationProcurement.data && (
            <div className="space-y-3 rounded-xl border p-5">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
          {organizationProcurement.isError && (
            <SectionError
              error={organizationProcurement.error}
              title="발주기관"
              onRetry={() => organizationProcurement.refetch()}
            />
          )}
          {!organizationProcurement.isLoading &&
            !organizationProcurement.isError &&
            !contractedOrganizations.length && (
              <ListEmptyState
                title="발주기관이 없습니다"
                description="선택한 조건에서 계약이 확인된 발주기관이 없습니다."
                onReset={() =>
                  updateFilters({
                    fromYear: undefined,
                    toYear: undefined,
                    workType: undefined,
                    large: undefined,
                    middle: undefined,
                    field: undefined,
                  })
                }
              />
            )}
          {!organizationProcurement.isError && displayedOrganizations.length > 0 && (
            <EntityRelationshipList
              entityLabel="발주기관"
              items={displayedOrganizations.map((organization, index) => ({
                key:
                  organization.organization_code ?? `${organization.organization_name ?? "unknown"}-${index}`,
                name: organization.organization_name ?? "기관명 미확인",
                amount: organization.total_attributed_contract_amount,
                contractCount: organization.contract_event_count,
                latestContractDate: organization.latest_contract_date ?? organization.latest_activity_date,
                badges:
                  organization.supplier_entry?.entry_status === "first_observed"
                    ? [
                        {
                          label: `${organization.supplier_entry.target_year ?? toYear}년 신규 관측`,
                          variant: "outline" as const,
                        },
                      ]
                    : [],
              }))}
              money={money}
              onSelect={(item) => {
                const organization = displayedOrganizations.find(
                  (candidate, index) =>
                    (candidate.organization_code ??
                      `${candidate.organization_name ?? "unknown"}-${index}`) === item.key,
                );
                if (organization?.organization_code) {
                  selectOrganization(organization.organization_code);
                }
              }}
              startRank={
                organizationListFilter === "major"
                  ? 1
                  : (organizationPage - 1) * ENTITY_RELATIONSHIP_PAGE_SIZE + 1
              }
            />
          )}
        </div>
        {organizationListFilter !== "major" && (
          <ListPagination
            label="발주기관 페이지"
            loading={organizationProcurement.isFetching}
            page={organizationProcurement.data?.pagination?.page ?? organizationPage}
            totalPages={organizationProcurement.data?.pagination?.total_pages}
            onChange={(page) => setListPage("organizationPage", page)}
          />
        )}
      </div>
    </EntityDetailSection>
  );
}
