import { useOrganizationDetailPage } from "@/features/organizations/useOrganizationDetailPage";
import { Search, X } from "lucide-react";

import {
  ENTITY_RELATIONSHIP_PAGE_SIZE,
  EntityRelationshipList,
} from "@/components/common/entity-relationship-list";
import { EntityDetailToolbar, EntitySectionHeader } from "@/components/common/entity-detail-section";
import { ListPagination } from "@/components/common/list-pagination";
import { ListEmptyState } from "@/components/common/list-empty-state";

import { UpdatingOverlay } from "@/components/common/updating-overlay";

import { RelationshipAnalysis } from "@/components/procurement/relationship-analysis";

import { SectionError } from "@/components/common/error-state";

import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RelationshipTreemap } from "@/features/relationships/RelationshipTreemap";

import {
  formatProcurementCount as count,
  type ProcurementCompanySort,
} from "@/features/organizations/procurement-presentation";

import { formatCompactMoney as money } from "@/shared/format/money";

export function OrganizationCompaniesSection({
  view,
}: {
  view: Pick<
    ReturnType<typeof useOrganizationDetailPage>,
    | "searchParams"
    | "setSearchParams"
    | "fiscalStartYear"
    | "fiscalEndYear"
    | "periodLabel"
    | "overviewCompanyPage"
    | "setOverviewCompanyPage"
    | "overviewCompanyQuery"
    | "overviewCompanySearch"
    | "setOverviewCompanySearch"
    | "overviewCompanySort"
    | "setOverviewCompanySort"
    | "overviewCompanyFilter"
    | "setOverviewCompanyFilter"
    | "setOverviewSelectedSupplier"
    | "supplierEntries"
    | "legacySelectedCompanyNumber"
    | "overviewCompanyListQuery"
    | "organization"
    | "companyRelationships"
    | "overviewCompanyListData"
    | "summary"
    | "supplierEntry"
    | "companyStructure"
    | "newSupplierNumbers"
    | "majorSupplierNumbers"
    | "locallyFilteredCompanies"
    | "displayedOverviewCompanies"
    | "companyListQueryError"
    | "companyListHasError"
    | "retryCompanyList"
    | "isAnalysisUpdating"
    | "selectedCompany"
    | "companyRelationship"
    | "selectedCompanyForSheet"
    | "contractedCompanyCount"
    | "visibleRelationshipEvents"
    | "submitOverviewCompanySearch"
    | "clearOverviewCompanySearch"
    | "resetCompanyListView"
    | "openSelectedCompanyNotices"
    | "relationshipFilterLabel"
    | "companyHref"
  >;
}) {
  const {
    searchParams,
    setSearchParams,
    fiscalStartYear,
    fiscalEndYear,
    periodLabel,
    overviewCompanyPage,
    setOverviewCompanyPage,
    overviewCompanyQuery,
    overviewCompanySearch,
    setOverviewCompanySearch,
    overviewCompanySort,
    setOverviewCompanySort,
    overviewCompanyFilter,
    setOverviewCompanyFilter,
    setOverviewSelectedSupplier,
    supplierEntries,
    legacySelectedCompanyNumber,
    overviewCompanyListQuery,
    organization,
    companyRelationships,
    overviewCompanyListData,
    summary,
    supplierEntry,
    companyStructure,
    newSupplierNumbers,
    majorSupplierNumbers,
    locallyFilteredCompanies,
    displayedOverviewCompanies,
    companyListQueryError,
    companyListHasError,
    retryCompanyList,
    isAnalysisUpdating,
    selectedCompany,
    companyRelationship,
    selectedCompanyForSheet,
    contractedCompanyCount,
    visibleRelationshipEvents,
    submitOverviewCompanySearch,
    clearOverviewCompanySearch,
    resetCompanyListView,
    openSelectedCompanyNotices,
    relationshipFilterLabel,
    companyHref,
  } = view;

  return (
    <div>
      <RelationshipTreemap
        className="!mt-6"
        title="계약업체 분포"
        description="전체 계약금액 분포와 주요 업체의 규모를 함께 비교합니다."
        counterpartType="company"
        relationships={companyRelationships}
        counterpartCount={companyStructure?.contracted_company_count ?? summary?.company_count}
        totalAmount={
          companyStructure?.total_company_attributed_contract_amount ??
          summary?.total_attributed_contract_amount
        }
        topFiveShare={
          companyStructure?.concentration_computable === false
            ? null
            : companyStructure?.top_5_company_amount_share
        }
        aggregateUnlisted
        showMetrics={false}
        enableDistributionView
        selectedRelationship={selectedCompanyForSheet}
        onSelectRelationship={(relationship) => {
          setOverviewSelectedSupplier(relationship);
          if (!relationship && legacySelectedCompanyNumber) {
            const next = new URLSearchParams(searchParams);
            next.delete("company");
            setSearchParams(next, { replace: true });
          }
        }}
        relationshipDetailLoading={companyRelationship.isFetching && Boolean(selectedCompany)}
        relationshipDetail={
          selectedCompanyForSheet && companyRelationship.data && !companyRelationship.isFetching ? (
            <RelationshipAnalysis
              compact
              eyebrow="기관 × 업체"
              title={`${organization?.name} × ${selectedCompanyForSheet.company_name}`}
              context={`${periodLabel}${relationshipFilterLabel ? ` · ${relationshipFilterLabel}` : ""} 계약 기준`}
              summary={{
                contractCount: selectedCompanyForSheet.contract_event_count,
                amount: selectedCompanyForSheet.total_attributed_contract_amount,
                activeYearCount: selectedCompanyForSheet.active_year_count,
                latestContract:
                  selectedCompanyForSheet.latest_contract_date ??
                  selectedCompanyForSheet.latest_activity_date,
              }}
              years={Array.from(
                { length: fiscalEndYear - fiscalStartYear + 1 },
                (_, index) => fiscalStartYear + index,
              )}
              yearlyActivity={
                companyRelationship.data.yearly_activity ?? selectedCompanyForSheet.yearly_activity ?? []
              }
              fields={companyRelationship.data.major_fields ?? selectedCompanyForSheet.major_fields ?? []}
              events={visibleRelationshipEvents}
              eventPreviewLimit={5}
              eventTotalCount={companyRelationship.data.pagination.total_items}
              onOpenAllEvents={openSelectedCompanyNotices}
              money={money}
            />
          ) : undefined
        }
        getCounterpartHref={(relationship) =>
          relationship.company_number
            ? companyHref(relationship.company_number, relationship.company_name)
            : undefined
        }
      />
      <div className="mt-8 border-t pt-8">
        <EntitySectionHeader
          level={3}
          title="계약업체 목록"
          description="업체를 선택하면 계약 규모와 주요 계약을 먼저 확인할 수 있습니다."
        />
        <EntityDetailToolbar className="mt-4">
          <div className="flex flex-wrap gap-2" aria-label="계약업체 필터">
            {(
              [
                ["all", `전체 ${count(contractedCompanyCount)}`],
                ["major", `주요 업체 ${count(Math.min(5, contractedCompanyCount))}`],
                [
                  "new",
                  `${supplierEntry?.target_year ?? fiscalEndYear}년 신규 관측 ${count(supplierEntry?.first_observed_company_count)}`,
                ],
              ] as const
            ).map(([value, label]) => (
              <FilterChip
                selected={overviewCompanyFilter === value}
                key={value}
                onClick={() => {
                  setOverviewCompanyFilter(value);
                  setOverviewCompanyPage(1);
                }}
              >
                {label}
              </FilterChip>
            ))}
          </div>
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto]"
            onSubmit={submitOverviewCompanySearch}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 pr-9"
                value={overviewCompanySearch}
                onChange={(event) => setOverviewCompanySearch(event.target.value)}
                placeholder="업체명 검색"
              />
              {overviewCompanySearch && (
                <Button
                  aria-label="업체 검색 초기화"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={clearOverviewCompanySearch}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
            <Select
              value={overviewCompanySort}
              onValueChange={(value) => {
                setOverviewCompanySort(value as ProcurementCompanySort);
                setOverviewCompanyPage(1);
              }}
            >
              <SelectTrigger aria-label="계약업체 정렬" className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contract_amount_desc">계약금액순</SelectItem>
                <SelectItem value="contract_count_desc">계약 건수순</SelectItem>
                <SelectItem value="latest_contract_desc">최근 계약순</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">검색</Button>
          </form>
        </EntityDetailToolbar>
        <div className="relative mt-4 min-h-40">
          {!isAnalysisUpdating &&
            (overviewCompanyListQuery.isFetching ||
              (overviewCompanyFilter === "new" && supplierEntries.isFetching)) && (
              <UpdatingOverlay show label="계약업체 조회 중" />
            )}
          {companyListHasError ? (
            <SectionError error={companyListQueryError} title="계약업체 목록" onRetry={retryCompanyList} />
          ) : displayedOverviewCompanies.length === 0 ? (
            <ListEmptyState
              title="표시할 계약업체가 없습니다"
              description="검색어 또는 업체 필터를 변경해 다시 확인해 주세요."
              onReset={
                overviewCompanyFilter !== "all" ||
                Boolean(overviewCompanyQuery) ||
                overviewCompanySort !== "contract_amount_desc"
                  ? resetCompanyListView
                  : undefined
              }
            />
          ) : (
            <EntityRelationshipList
              entityLabel="계약업체"
              items={displayedOverviewCompanies.map((company, index) => ({
                key: company.company_number ?? `${company.company_name ?? "unknown"}-${index}`,
                name: company.company_name ?? "업체명 미확인",
                amount: company.total_attributed_contract_amount,
                contractCount: company.contract_event_count,
                latestContractDate: company.latest_contract_date,
                badges: [
                  ...(company.company_number && majorSupplierNumbers.has(company.company_number)
                    ? [{ label: "주요 업체", variant: "secondary" as const }]
                    : []),
                  ...(company.company_number && newSupplierNumbers.has(company.company_number)
                    ? [{ label: "신규 관측", variant: "outline" as const }]
                    : []),
                ],
              }))}
              money={money}
              onSelect={(item) => {
                const company = displayedOverviewCompanies.find(
                  (candidate, index) =>
                    (candidate.company_number ?? `${candidate.company_name ?? "unknown"}-${index}`) ===
                    item.key,
                );
                if (company) setOverviewSelectedSupplier(company);
              }}
              startRank={
                overviewCompanyFilter === "major"
                  ? 1
                  : (overviewCompanyPage - 1) * ENTITY_RELATIONSHIP_PAGE_SIZE + 1
              }
            />
          )}
        </div>
        {!companyListHasError &&
          displayedOverviewCompanies.length > 0 &&
          overviewCompanyFilter !== "major" && (
            <ListPagination
              page={overviewCompanyPage}
              totalPages={
                overviewCompanyFilter === "new"
                  ? Math.ceil(locallyFilteredCompanies.length / ENTITY_RELATIONSHIP_PAGE_SIZE)
                  : Math.ceil(
                      (overviewCompanyListData?.pagination?.total_items ?? 0) / ENTITY_RELATIONSHIP_PAGE_SIZE,
                    )
              }
              onChange={setOverviewCompanyPage}
              loading={
                overviewCompanyFilter === "new"
                  ? supplierEntries.isFetching
                  : overviewCompanyListQuery.isFetching
              }
              label="계약업체 페이지"
            />
          )}
      </div>
    </div>
  );
}
