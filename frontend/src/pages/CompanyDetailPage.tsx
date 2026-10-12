import { CompanyParticipationTrend } from "@/features/company-context/CompanyParticipationTrend";
import { participationCollectionLabel } from "@/features/company-context/participation-presentation";
import { CompanyOrganizationsSection } from "@/features/company-context/CompanyOrganizationsSection";
import { procurementWorkTypeLabels as workTypeLabels } from "@/shared/procurement/presentation";
import { useCompanyDetailPage } from "@/features/company-context/useCompanyDetailPage";

import { Building2 } from "lucide-react";
import { Link } from "react-router-dom";

import { EntityDetailContextBar } from "@/components/common/entity-detail-context-bar";

import {
  EntityDetailAction,
  EntityDetailPanel,
  EntityDetailSection,
  EntityMetric,
  EntityMetricGrid,
  EntityMetricValue,
  EntitySectionHeader,
} from "@/components/common/entity-detail-section";

import { ProcurementFilterPanel } from "@/components/procurement/procurement-filter-panel";

import { EntityDetailContentSkeleton, EntityDetailLayout } from "@/components/layout/entity-detail-layout";
import { EntityDetailHeader } from "@/components/layout/entity-detail-header";

import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";

import { entityDetailPath } from "@/shared/navigation/entity-links";
import { CompanyInformationPanel } from "@/features/company-context/CompanyInformationPanel";
import { CompanyParticipationPanel } from "@/features/company-context/CompanyParticipationPanel";

import { formatCompactMoney as money } from "@/shared/format/money";
import { procurementDistributionColor } from "@/shared/ui/procurement-chart-palette";

export function CompanyDetailPage() {
  const view = useCompanyDetailPage();
  const {
    params,
    businessNumber,
    currentYear,
    earliestYear,
    workType,
    participationPage,
    participationQuery,
    participationSearch,
    setParticipationSearch,
    draftPeriod,
    setDraftPeriod,
    showProcurementFilters,
    setShowProcurementFilters,
    updateFilters,
    setListPage,
    tab,
    setTab,
    activity,
    procurement,
    competitors,
    summary,
    participationSummary,
    overviewContractedOrganizations,
    organizationAmountTotal,
    topFiveOrganizationShare,
    middleOrganizationShare,
    remainingOrganizationShare,
    remainingOrganizationCount,
    selectedFieldValue,
    visibleFieldOptions,
    periodLabel,
    setPeriod,
    selectField,
    submitParticipationSearch,
    clearParticipationSearch,
    data,
    name,
    industryNames,
    visibleFields,
    appliedProcurementFilters,
    companyDetail,
    procurementConditionSummary,
    isProcurementUpdating,
    hasProcurementConditionError,
    retryProcurementConditions,
    successRateLabel,
    overviewInsight,
  } = view;
  return (
    <EntityDetailLayout fallbackTo="/companies">
      <EntityDetailHeader
        divided={false}
        entityLabel="업체"
        icon={<Building2 className="size-5" />}
        meta={<span>사업자등록번호 {businessNumber}</span>}
        title={name}
        tone="company"
      >
        {industryNames.length > 0 && (
          <button
            className="mt-2 text-left text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setTab("companyInfo")}
            type="button"
          >
            <span className="font-medium text-foreground">등록 업종</span> ·{" "}
            {industryNames.slice(0, 2).join(" · ")}
            {industryNames.length > 2 ? ` · +${industryNames.length - 2}` : ""}{" "}
            <span className="whitespace-nowrap">전체 보기</span>
          </button>
        )}
      </EntityDetailHeader>

      {procurement.isLoading && !procurement.data && <EntityDetailContentSkeleton />}
      {procurement.isError && (
        <p className="mt-10 rounded-xl border p-5 text-sm text-muted-foreground">
          조달 활동을 불러오지 못했습니다.
        </p>
      )}
      {procurement.data?.truncated && (
        <p className="mt-4 rounded-xl border p-4 text-sm text-muted-foreground">
          조회 데이터 일부만 확인되었습니다. 집계와 관계 정보의 추가 확인이 필요합니다.
        </p>
      )}
      {procurement.data && (
        <>
          <EntityDetailContextBar
            appliedFilterCount={appliedProcurementFilters.length}
            compactConditionSummary={`${periodLabel} · ${
              appliedProcurementFilters.length > 0 ? `필터 ${appliedProcurementFilters.length}` : "전체"
            }`}
            conditionSummary={procurementConditionSummary}
            filterOpen={showProcurementFilters}
            hasError={hasProcurementConditionError}
            isUpdating={isProcurementUpdating}
            onRetry={retryProcurementConditions}
            value={tab}
            onFilterOpenChange={setShowProcurementFilters}
            onTabChange={setTab}
            tabs={[
              { id: "relationships", label: "개요" },
              {
                id: "participations",
                label: "입찰 이력",
                count: participationSummary?.participation_count ?? undefined,
              },
              { id: "organizations", label: "발주기관", count: summary?.organization_count },
              { id: "companyInfo", label: "업체 정보" },
            ]}
          >
            <ProcurementFilterPanel
              compact
              earliestYear={earliestYear}
              currentYear={currentYear}
              period={draftPeriod}
              onPeriodChange={setDraftPeriod}
              onPeriodCommit={setPeriod}
              workTypeValue={workType || "all"}
              workTypeOptions={[
                { value: "all", label: "전체" },
                ...Object.entries(workTypeLabels).map(([value, label]) => ({ value, label })),
              ]}
              onWorkTypeChange={(value) =>
                updateFilters({
                  workType: value === "all" ? undefined : value,
                  large: undefined,
                  middle: undefined,
                  field: undefined,
                })
              }
              fieldValue={selectedFieldValue || "all"}
              fieldOptions={[{ value: "all", label: "전체 분야" }, ...visibleFieldOptions]}
              onFieldChange={(value) => selectField(value === "all" ? "" : value)}
              appliedFilters={appliedProcurementFilters}
              onReset={() => {
                setDraftPeriod([Math.max(earliestYear, currentYear - 4), currentYear]);
                updateFilters({
                  fromYear: undefined,
                  toYear: undefined,
                  workType: undefined,
                  large: undefined,
                  middle: undefined,
                  field: undefined,
                });
              }}
            />
          </EntityDetailContextBar>

          <div className="relative" aria-busy={isProcurementUpdating}>
            <div
              className={`transition-opacity ${isProcurementUpdating ? "pointer-events-none opacity-60" : "opacity-100"}`}
            >
              {tab === "relationships" && (
                <EntityDetailSection
                  title="입찰·수주 현황"
                  description="입찰 참여부터 낙찰·계약까지 핵심 실적을 보여줍니다."
                  meta={`${periodLabel} 기준`}
                >
                  <p className="mt-5 rounded-xl bg-muted/35 px-4 py-3.5 text-[15px] leading-7 sm:px-5">
                    {overviewInsight}
                  </p>
                  <EntityMetricGrid className="mt-6 grid-cols-2 lg:grid-cols-4">
                    <EntityMetric
                      className="border-b lg:border-b-0 lg:px-5 lg:first:pl-1"
                      label="관측 입찰 참여"
                      value={
                        <EntityMetricValue
                          value={
                            participationSummary?.participation_count != null
                              ? participationSummary.participation_count.toLocaleString("ko-KR")
                              : participationCollectionLabel(participationSummary)
                          }
                          unit={participationSummary?.participation_count != null ? "건" : undefined}
                        />
                      }
                    />
                    <EntityMetric
                      className="border-b border-l pl-5 lg:border-b-0 lg:px-5"
                      label="참여 중 확인된 낙찰"
                      note={
                        successRateLabel
                          ? `관측 성공률 ${successRateLabel} · ${participationCollectionLabel(participationSummary)}`
                          : participationCollectionLabel(participationSummary)
                      }
                      value={
                        <EntityMetricValue
                          value={
                            participationSummary?.participation_count != null
                              ? participationSummary.observed_award_count.toLocaleString("ko-KR")
                              : participationCollectionLabel(participationSummary)
                          }
                          unit={participationSummary?.participation_count != null ? "건" : undefined}
                        />
                      }
                    />
                    <EntityMetric
                      className="lg:border-l lg:px-5"
                      label="계약금액"
                      note={`계약 ${summary?.contract_event_count.toLocaleString("ko-KR") ?? "-"}건`}
                      value={(() => {
                        const [amount, unit] = money(summary?.total_attributed_contract_amount).split(
                          "\u00a0",
                        );
                        return <EntityMetricValue value={amount} unit={unit} />;
                      })()}
                    />
                    <EntityMetric
                      className="border-l pl-5 lg:px-5"
                      label="발주기관"
                      value={
                        <EntityMetricValue
                          value={summary?.organization_count.toLocaleString("ko-KR") ?? "-"}
                          unit="개"
                        />
                      }
                    />
                  </EntityMetricGrid>
                  <div className="mt-9 border-t pt-9 sm:mt-12 sm:pt-12">
                    <div className="lg:col-span-2">
                      <EntitySectionHeader
                        title="주요 활동 분야"
                        description="주로 참여하는 분야와 수주 성과입니다."
                      />
                      <DataTable className="mt-5" minWidth={640}>
                        <thead>
                          <tr>
                            <th>분야</th>
                            <th className="text-right">참여</th>
                            <th className="text-right">낙찰</th>
                            <th className="text-right">성공률</th>
                            <th className="text-right">계약금액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleFields.slice(0, 8).map((field) => {
                            const label =
                              field.display_name ??
                              field.field_name ??
                              field.middle_category ??
                              field.large_category ??
                              "미분류";
                            const participation = field.participation_count ?? 0;
                            const awards = field.award_event_count ?? 0;
                            return (
                              <tr key={`${label}-${field.display_code ?? field.field_code ?? ""}`}>
                                <td className="font-medium">{label}</td>
                                <td className="text-right">{participation.toLocaleString("ko-KR")}건</td>
                                <td className="text-right">{awards.toLocaleString("ko-KR")}건</td>
                                <td className="text-right">
                                  {field.award_success_rate != null
                                    ? `${(field.award_success_rate * 100).toFixed(1)}%`
                                    : "-"}
                                </td>
                                <td className="text-right font-semibold">
                                  {money(field.attributed_contract_amount)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </DataTable>
                      {!visibleFields.length && (
                        <p className="p-6 text-center text-sm text-muted-foreground">
                          분야 데이터가 없습니다.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-9 border-t pt-9 sm:mt-12 sm:pt-12">
                    <CompanyParticipationTrend
                      analysis={procurement.data?.participation_analysis}
                      contractYears={procurement.data?.yearly_activity ?? []}
                      currentYear={currentYear}
                    />
                  </div>
                  <div className="mt-9 border-t pt-9 sm:mt-12 sm:pt-12">
                    <EntitySectionHeader
                      title="발주기관 구조"
                      description="계약금액이 어떤 발주기관에 분포하는지 요약합니다."
                    />
                    <EntityMetricGrid className="mt-5 grid-cols-2">
                      <EntityMetric
                        className="border-r pr-5"
                        label="발주기관"
                        value={
                          <EntityMetricValue
                            value={summary?.organization_count.toLocaleString("ko-KR") ?? "-"}
                            unit="개"
                          />
                        }
                      />
                      <EntityMetric
                        className="pl-5"
                        label="상위 5개 기관 비중"
                        value={
                          organizationAmountTotal > 0
                            ? `${(topFiveOrganizationShare * 100).toFixed(1)}%`
                            : "산출 불가"
                        }
                      />
                    </EntityMetricGrid>
                    <EntityDetailPanel className="mt-5" muted={false}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm">계약금액 분포</strong>
                        <span className="text-xs text-muted-foreground">선택 기간·분야 기준</span>
                      </div>
                      {organizationAmountTotal > 0 ? (
                        <>
                          <div
                            className="mt-4 flex h-9 overflow-hidden rounded-lg bg-muted"
                            aria-label="발주기관별 계약금액 분포 요약"
                          >
                            {[
                              ["상위 5개", topFiveOrganizationShare, procurementDistributionColor.leading],
                              [
                                overviewContractedOrganizations.length > 5
                                  ? `6–${overviewContractedOrganizations.length}위`
                                  : "6위 이하",
                                middleOrganizationShare,
                                procurementDistributionColor.middle,
                              ],
                              [
                                remainingOrganizationCount > 0
                                  ? `나머지 ${remainingOrganizationCount.toLocaleString("ko-KR")}개`
                                  : "나머지",
                                remainingOrganizationShare,
                                procurementDistributionColor.remainder,
                              ],
                            ].map(([label, ratio, className]) =>
                              typeof ratio === "number" && ratio > 0 ? (
                                <span
                                  className={`grid min-w-0 place-items-center px-2 text-xs font-semibold ${className} ${String(label).startsWith("나머지") ? "text-foreground" : "text-white"}`}
                                  key={String(label)}
                                  style={{ width: `${ratio * 100}%` }}
                                >
                                  {ratio >= 0.12 ? `${(ratio * 100).toFixed(1)}%` : ""}
                                </span>
                              ) : null,
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                            {[
                              ["상위 5개", topFiveOrganizationShare],
                              [
                                overviewContractedOrganizations.length > 5
                                  ? `6–${overviewContractedOrganizations.length}위`
                                  : "6위 이하",
                                middleOrganizationShare,
                              ],
                              [
                                remainingOrganizationCount > 0
                                  ? `나머지 ${remainingOrganizationCount.toLocaleString("ko-KR")}개`
                                  : "나머지",
                                remainingOrganizationShare,
                              ],
                            ].map(([label, ratio]) => (
                              <span key={String(label)}>
                                <span className="text-muted-foreground">{label}</span>{" "}
                                <strong>{(Number(ratio) * 100).toFixed(1)}%</strong>
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                          기관별 계약금액이 충분하지 않아 분포를 산출할 수 없습니다.
                        </p>
                      )}
                      <div className="mt-5 border-t pt-4 text-right">
                        <EntityDetailAction onClick={() => setTab("organizations")}>
                          발주기관 자세히 보기
                        </EntityDetailAction>
                      </div>
                    </EntityDetailPanel>
                  </div>
                  <div className="mt-9 border-t pt-9 sm:mt-12 sm:pt-12">
                    <EntitySectionHeader
                      title="주요 경쟁 업체"
                      description="동일한 입찰에 자주 참여한 업체입니다."
                    />
                    {competitors.isLoading && <Skeleton className="mt-5 h-44 rounded-xl" />}
                    {!competitors.isLoading && (
                      <DataTable className="mt-5" minWidth={520}>
                        <thead>
                          <tr>
                            <th>업체</th>
                            <th className="text-right">동시 참여</th>
                            <th className="text-right">최근 동시 참여</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(competitors.data?.items ?? []).map((company) => (
                            <tr key={company.company_number}>
                              <td>
                                <Link
                                  className="font-semibold hover:underline"
                                  to={entityDetailPath("company", company.company_number, {
                                    source: "relationship",
                                    params,
                                    name: company.company_name,
                                  })}
                                >
                                  {company.company_name}
                                </Link>
                              </td>
                              <td className="text-right font-medium">
                                {company.co_participation_count.toLocaleString("ko-KR")}회
                              </td>
                              <td className="text-right text-muted-foreground">
                                {company.latest_co_participation_date?.slice(0, 7) ?? "-"}
                              </td>
                            </tr>
                          ))}
                          {!competitors.data?.items.length && (
                            <tr>
                              <td className="app-data-table-empty" colSpan={3}>
                                확인된 경쟁 업체가 없습니다.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </DataTable>
                    )}
                    {competitors.data?.data_completeness?.status === "partial" && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        개찰 상위 10개 업체 및 낙찰업체로 확인 가능한 범위입니다.
                      </p>
                    )}
                  </div>
                </EntityDetailSection>
              )}

              {tab === "participations" && (
                <CompanyParticipationPanel
                  periodLabel={periodLabel}
                  data={activity.data}
                  error={activity.error}
                  isError={activity.isError}
                  isFetching={activity.isFetching}
                  isLoading={activity.isLoading}
                  searchValue={participationSearch}
                  appliedSearch={participationQuery}
                  page={participationPage}
                  onSearchValueChange={setParticipationSearch}
                  onSearchSubmit={submitParticipationSearch}
                  onSearchClear={clearParticipationSearch}
                  onReset={clearParticipationSearch}
                  onRetry={() => activity.refetch()}
                  onPageChange={(page) => setListPage("participationPage", page)}
                />
              )}
              {tab === "organizations" && <CompanyOrganizationsSection view={view} />}
              {tab === "companyInfo" && (
                <CompanyInformationPanel industries={data.industries} query={companyDetail} />
              )}
            </div>
          </div>
        </>
      )}
    </EntityDetailLayout>
  );
}
