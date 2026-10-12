import { OrganizationCompaniesSection } from "@/features/organizations/OrganizationCompaniesSection";
import { useOrganizationDetailPage } from "@/features/organizations/useOrganizationDetailPage";

import { Landmark } from "lucide-react";
import { Link } from "react-router-dom";

import { EntityDetailContextBar } from "@/components/common/entity-detail-context-bar";

import {
  EntityDetailAction,
  EntityDetailPanel,
  EntityDetailSection,
  EntityMetric,
  EntityMetricGrid,
  EntityMetricValue,
} from "@/components/common/entity-detail-section";

import { MetricHelp } from "@/components/common/metric-help";

import { ProcurementFilterPanel } from "@/components/procurement/procurement-filter-panel";

import {
  EntityDetailContentSkeleton,
  EntityDetailHeaderSkeleton,
  EntityDetailLayout,
} from "@/components/layout/entity-detail-layout";
import { EntityDetailHeader } from "@/components/layout/entity-detail-header";
import { PageError, SectionError } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";

import { OrganizationActivityPanel } from "@/features/organizations/OrganizationActivityPanel";
import { OrganizationNoticeTiming } from "@/features/organizations/OrganizationNoticeTiming";
import { OrganizationProcurementStructure } from "@/features/organizations/OrganizationProcurementStructure";
import {
  formatProcurementCount as count,
  getProcurementActivityView as procurementActivityView,
  procurementWorkTypeLabel as workTypeLabel,
} from "@/features/organizations/procurement-presentation";

import {
  procurementFieldIdentity as fieldIdentity,
  procurementFieldOptionLabel,
} from "@/shared/procurement/field-options";
import { formatCompactMoney as money } from "@/shared/format/money";
import { procurementDistributionColor } from "@/shared/ui/procurement-chart-palette";

function CountMetricValue({ value, unit }: { value?: number; unit: string }) {
  return value == null ? (
    <EntityMetricValue value="-" />
  ) : (
    <EntityMetricValue value={count(value)} unit={unit} />
  );
}

function MoneyMetricValue({ value }: { value?: number }) {
  const [amount, unit] = money(value).split("\u00a0");
  return <EntityMetricValue value={amount} unit={unit} />;
}

function CompanyConcentrationMetric({
  className,
  label = "상위 5개 집중도",
  share,
  computable,
  excludedContractCount,
  smallPopulation,
}: {
  className?: string;
  label?: string;
  share?: number;
  computable?: boolean;
  excludedContractCount?: number;
  smallPopulation?: boolean;
}) {
  return (
    <EntityMetric
      className={className}
      label={
        <>
          {label}
          <MetricHelp label="상위 5개 업체 집중도 계산 기준">
            금액이 확인된 계약을 기준으로 계산한 상위 5개 업체 비중입니다.
            {Boolean(excludedContractCount) && (
              <span className="mt-2 block text-[11px] text-muted-foreground">
                금액 미확인 {count(excludedContractCount)}건 제외
              </span>
            )}
            {smallPopulation && (
              <span className="mt-2 block text-[11px] text-muted-foreground">
                계약 업체가 5개 이하이면 집중도가 100%로 표시될 수 있습니다.
              </span>
            )}
          </MetricHelp>
        </>
      }
      value={
        computable === false
          ? "산출 불가"
          : `${((share ?? 0) * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`
      }
    />
  );
}

export function OrganizationDetailPage() {
  const view = useOrganizationDetailPage();
  const {
    organizationId,
    searchParams,
    currentYear,
    earliestYear,
    fiscalEndYear,
    periodLabel,
    draftPeriod,
    setDraftPeriod,
    tab,
    selectedLargeCategory,
    selectedFieldCode,
    selectedWorkType,
    listPage,
    listQuery,
    activityStage,
    showProcurementFilters,
    setShowProcurementFilters,
    organizationQuery,
    activity,
    procurement,
    listSearch,
    setListSearch,
    organization,
    summary,
    supplierEntry,
    quarterDistribution,
    visibleContractMethods,
    contractMethodAmountTotal,
    companyStructure,
    companyAmountTotal,
    topFiveCompanyShare,
    loadedCompanyShare,
    middleCompanyShare,
    remainingCompanyShare,
    sortedWorkTypeDistribution,
    fieldDistribution,
    rankedFields,
    overviewFields,
    contractMethodInsight,
    appliedField,
    isSingleLevelField,
    visibleYearlyActivity,
    loadedCompanyCount,
    remainingCompanyCount,
    openNoticeCount,
    openNoticePreview,
    currentYearPeriodEnd,
    activeTabConditionUpdating,
    activeTabConditionError,
    retryActiveTabConditions,
    setTab,
    setListPage,
    setActivityStage,
    submitListSearch,
    clearListSearch,
    resetActivityView,
    openActiveNotices,
    setPeriodRange,
    selectField,
    setWorkType,
    resetFilters,
    appliedProcurementFilters,
    procurementConditionSummary,
    fieldInsight,
  } = view;
  if (organizationQuery.isLoading)
    return (
      <EntityDetailLayout fallbackTo="/organizations" surface={false}>
        <article className="mt-5">
          <EntityDetailHeaderSkeleton />
          <EntityDetailContentSkeleton />
        </article>
      </EntityDetailLayout>
    );
  if (organizationQuery.isError)
    return (
      <PageError
        error={organizationQuery.error}
        entity="기관 정보"
        onRetry={() => organizationQuery.refetch()}
      />
    );

  return (
    <EntityDetailLayout fallbackTo="/organizations" surface={false}>
      <article className="mt-5">
        {procurement.data?.truncated && (
          <p className="mt-4 rounded-xl border p-4 text-sm text-muted-foreground">
            조회 데이터 일부만 확인되었습니다. 집계와 관계 정보의 추가 확인이 필요합니다.
          </p>
        )}
        <EntityDetailHeader
          divided={false}
          entityLabel="기관"
          icon={<Landmark className="size-5" />}
          meta={
            <span>
              {organization?.jurisdiction_type ?? "기관 유형 미상"} · 기관코드 {organizationId}
            </span>
          }
          title={organization?.name}
          tone="organization"
        />

        {procurement.isLoading && !procurement.data && <EntityDetailContentSkeleton />}
        {procurement.isError && !procurement.data && (
          <div className="mt-6">
            <SectionError error={procurement.error} title="조달 현황" onRetry={() => procurement.refetch()} />
          </div>
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
              hasError={activeTabConditionError}
              isUpdating={activeTabConditionUpdating}
              onRetry={retryActiveTabConditions}
              value={tab}
              onFilterOpenChange={setShowProcurementFilters}
              onTabChange={setTab}
              tabs={[
                { id: "overview", label: "개요" },
                {
                  id: "notices",
                  label: "공고·계약",
                  count: activity.data?.stage_counts?.all ?? activity.data?.pagination.total_items,
                },
                {
                  id: "companies",
                  label: "계약업체",
                  count: companyStructure?.contracted_company_count ?? summary?.company_count,
                },
              ]}
            >
              <ProcurementFilterPanel
                compact
                earliestYear={earliestYear}
                currentYear={currentYear}
                period={draftPeriod}
                onPeriodChange={setDraftPeriod}
                onPeriodCommit={setPeriodRange}
                workTypeValue={selectedWorkType ?? "all"}
                workTypeOptions={[
                  { value: "all", label: "전체" },
                  ...Object.entries(workTypeLabel).map(([value, label]) => ({ value, label })),
                ]}
                onWorkTypeChange={setWorkType}
                fieldValue="current"
                fieldOptions={[
                  {
                    value: "current",
                    label: selectedFieldCode
                      ? (appliedField?.field_name ?? "선택 분야")
                      : isSingleLevelField
                        ? (appliedField?.large_category ?? "선택 분야")
                        : selectedLargeCategory
                          ? "세부 분야 선택"
                          : "분야 선택",
                  },
                  ...[...fieldDistribution]
                    .sort(
                      (left, right) =>
                        (right.attributed_contract_amount ?? 0) - (left.attributed_contract_amount ?? 0),
                    )
                    .map((field) => ({
                      value: fieldIdentity(field),
                      label: procurementFieldOptionLabel(field, money, workTypeLabel),
                    }))
                    .filter((option) => Boolean(option.value)),
                ]}
                fieldDisabled={Boolean(selectedFieldCode || isSingleLevelField)}
                onFieldChange={(value) => {
                  const field = fieldDistribution.find((item) => fieldIdentity(item) === value);
                  if (field) selectField(field);
                }}
                appliedFilters={appliedProcurementFilters}
                onReset={resetFilters}
              />
            </EntityDetailContextBar>

            <div className="relative" aria-busy={activeTabConditionUpdating}>
              <div
                className={`transition-opacity ${activeTabConditionUpdating ? "pointer-events-none opacity-60" : "opacity-100"}`}
              >
                {tab === "overview" && (
                  <EntityDetailSection
                    className="relative"
                    headingId="procurement-summary-title"
                    title="조달 현황"
                    description="기관의 핵심 조달 특징과 현재 진행 공고입니다."
                    meta={`${periodLabel} 기준`}
                  >
                    <p className="mt-5 rounded-xl bg-muted/35 px-4 py-3.5 text-[15px] leading-7 text-foreground sm:px-5">
                      {fieldInsight} {contractMethodInsight}
                    </p>
                    <EntityMetricGrid className="mt-6 grid-cols-2 lg:grid-cols-4">
                      <EntityMetric
                        className="border-b lg:border-b-0 lg:px-5 lg:first:pl-1"
                        label={
                          <>
                            공고
                            <MetricHelp label="공고 수 집계 기준">
                              게시일 기준 공고를 공고번호로 중복 제거한 수입니다.
                            </MetricHelp>
                          </>
                        }
                        value={<CountMetricValue value={summary?.notice_count} unit="건" />}
                      />
                      <EntityMetric
                        className="border-b border-l pl-5 lg:border-b-0 lg:px-5"
                        label={
                          <>
                            계약
                            <MetricHelp label="계약 수 집계 기준">
                              최초 계약일이 조회 기간에 포함된 계약을 계약사건 기준으로 집계합니다.
                            </MetricHelp>
                          </>
                        }
                        value={<CountMetricValue value={summary?.contract_event_count} unit="건" />}
                      />
                      <EntityMetric
                        className="lg:border-l lg:px-5"
                        label={
                          <>
                            계약금액
                            <MetricHelp label="계약금액 집계 기준">
                              최초 계약일이 조회 기간에 포함된 계약 중 금액이 확인된 계약만 합산합니다.
                              계약금액은 조회 종료일 현재의 최신 금액입니다.
                            </MetricHelp>
                          </>
                        }
                        value={<MoneyMetricValue value={summary?.total_attributed_contract_amount} />}
                      />
                      <EntityMetric
                        className="border-l pl-5 lg:px-5"
                        label="계약업체"
                        value={<CountMetricValue value={summary?.company_count} unit="개" />}
                      />
                    </EntityMetricGrid>
                    <EntityDetailPanel className="mt-6 rounded-xl border !py-0">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                        <div>
                          <strong className="text-sm">현재 진행 공고 {count(openNoticeCount)}건</strong>
                          {openNoticeCount > 0 ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              최근 게시된 공고 {count(openNoticePreview.length)}건
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs text-muted-foreground">접수 중인 공고가 없습니다.</p>
                          )}
                        </div>
                        {openNoticeCount > openNoticePreview.length && (
                          <EntityDetailAction onClick={openActiveNotices}>
                            진행 공고 {count(openNoticeCount)}건 모두 보기
                          </EntityDetailAction>
                        )}
                      </div>
                      {openNoticePreview.length > 0 && (
                        <div className="divide-y border-t">
                          {openNoticePreview.map((item) => {
                            const view = procurementActivityView(item);
                            return (
                              <Link
                                className="group grid gap-1 px-4 py-4 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-5"
                                key={item.activity_group_id}
                                to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
                              >
                                <span className="min-w-0">
                                  <span className="flex min-w-0 items-center gap-2">
                                    <Badge className="shrink-0 border-0 bg-emerald-50 text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      접수 중
                                    </Badge>
                                    <span className="block min-w-0 truncate text-sm font-semibold group-hover:text-primary">
                                      {item.notice_name ?? "공고명 미상"}
                                    </span>
                                  </span>
                                  <span className="mt-1 block text-xs text-muted-foreground">
                                    게시{" "}
                                    {(item.notice?.published_at ?? item.latest_activity_date)?.slice(0, 10) ??
                                      "일자 미상"}
                                  </span>
                                </span>
                                <span className="flex items-center gap-4 text-xs sm:text-right">
                                  {view.projectAmount != null && (
                                    <strong className="tabular-nums">{money(view.projectAmount)}</strong>
                                  )}
                                  <span className="text-muted-foreground">
                                    마감 {item.notice?.deadline_at?.slice(0, 10) ?? "미정"}
                                  </span>
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </EntityDetailPanel>
                  </EntityDetailSection>
                )}

                {(tab === "overview" || tab === "companies") && (
                  <section
                    className="organization-detail-analysis relative grid gap-0 lg:grid-cols-2"
                    data-view={tab}
                  >
                    {tab === "overview" && (
                      <>
                        <OrganizationProcurementStructure
                          contractMethodAmountTotal={contractMethodAmountTotal}
                          contractMethods={visibleContractMethods}
                          fields={overviewFields}
                          isLeafFieldSelection={isSingleLevelField}
                          selectedFieldCode={selectedFieldCode}
                          selectedLargeCategory={selectedLargeCategory}
                          selectedWorkType={selectedWorkType}
                          totalContractAmount={summary?.total_attributed_contract_amount}
                          totalFieldCount={rankedFields.length}
                          workTypes={sortedWorkTypeDistribution}
                        />
                        <EntityDetailSection
                          className="lg:col-span-2"
                          divided
                          title={
                            <span className="flex items-center gap-1">
                              계약 추이
                              <MetricHelp label="계약 추이 집계 기준">
                                최초 계약일 기준으로 연도를 나누고, 조회 종료일 현재의 최신 계약금액을
                                표시합니다.
                              </MetricHelp>
                            </span>
                          }
                          description="연도별 계약 규모와 변화를 보여줍니다."
                        >
                          <div className="mt-5 flex-1 space-y-4">
                            {visibleYearlyActivity.map((item, index) => {
                              const max = Math.max(
                                1,
                                ...visibleYearlyActivity.map((row) => row.attributed_contract_amount ?? 0),
                              );
                              const previous = visibleYearlyActivity[index - 1]?.attributed_contract_amount;
                              const isCurrentYear = item.year === new Date().getUTCFullYear();
                              const growth =
                                previous && !isCurrentYear
                                  ? (((item.attributed_contract_amount ?? 0) - previous) / previous) * 100
                                  : undefined;
                              return (
                                <div className="p-1" key={item.year}>
                                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                                    <span className="inline-flex items-center gap-2 font-medium">
                                      {isCurrentYear ? `${item.year}년 누적` : `${item.year}년`}
                                    </span>
                                    <span className="text-right">
                                      <strong>{money(item.attributed_contract_amount)}</strong>
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        계약 {count(item.contract_event_count)}건
                                        {growth != null
                                          ? ` · 금액 전년 대비 ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`
                                          : ""}
                                      </span>
                                    </span>
                                  </div>
                                  <span className="block h-2 overflow-hidden rounded-full bg-muted">
                                    <span
                                      className="block h-full rounded-full bg-chart-1"
                                      style={{
                                        width: `${((item.attributed_contract_amount ?? 0) / max) * 100}%`,
                                      }}
                                    />
                                  </span>
                                </div>
                              );
                            })}
                            {visibleYearlyActivity.some((item) => item.year === currentYear) && (
                              <p className="border-t pt-3 text-[11px] text-muted-foreground">
                                {currentYear}년은 {currentYearPeriodEnd ?? "조회 종료일"}까지의 누적
                                실적입니다.
                              </p>
                            )}
                            <OrganizationNoticeTiming items={quarterDistribution} periodLabel={periodLabel} />
                          </div>
                        </EntityDetailSection>
                      </>
                    )}

                    <EntityDetailSection
                      className="supplier-analysis lg:col-span-2"
                      divided={tab === "overview"}
                      title={tab === "overview" ? "계약업체 구조" : "계약업체 분석"}
                      description={
                        tab === "overview"
                          ? "계약금액의 업체별 집중도를 보여줍니다."
                          : "계약금액 분포를 비교하고 개별 업체의 계약 관계를 확인합니다."
                      }
                    >
                      <EntityMetricGrid className="mt-5 sm:grid-cols-3">
                        <EntityMetric
                          className="border-b sm:border-b-0 sm:border-r sm:px-4"
                          label="선택 기간 계약업체"
                          value={`${count(companyStructure?.contracted_company_count ?? summary?.company_count)}개`}
                        />
                        {tab === "companies" ? (
                          <EntityMetric
                            className="border-b sm:border-b-0 sm:border-r sm:px-4"
                            label={
                              <>
                                귀속 계약금액
                                <MetricHelp label="귀속 계약금액 계산 기준">
                                  공동수급은 해당 업체에 귀속된 금액을 기준으로 합산합니다.
                                  {Boolean(companyStructure?.excluded_contract_event_count) && (
                                    <span className="mt-2 block text-[11px] text-muted-foreground">
                                      금액 미확인 {count(companyStructure?.excluded_contract_event_count)}건
                                      제외
                                    </span>
                                  )}
                                </MetricHelp>
                              </>
                            }
                            value={<MoneyMetricValue value={companyAmountTotal} />}
                          />
                        ) : (
                          <CompanyConcentrationMetric
                            className="border-b sm:border-b-0 sm:border-r sm:px-4"
                            label="선택 기간 상위 5개 집중도"
                            share={companyStructure?.top_5_company_amount_share}
                            computable={companyStructure?.concentration_computable}
                            excludedContractCount={companyStructure?.excluded_contract_event_count}
                            smallPopulation={companyStructure?.small_supplier_population}
                          />
                        )}
                        {tab === "companies" ? (
                          <CompanyConcentrationMetric
                            className="sm:px-4"
                            share={companyStructure?.top_5_company_amount_share}
                            computable={companyStructure?.concentration_computable}
                            excludedContractCount={companyStructure?.excluded_contract_event_count}
                            smallPopulation={companyStructure?.small_supplier_population}
                          />
                        ) : (
                          <EntityMetric
                            className="sm:px-4"
                            label={
                              <>
                                {supplierEntry?.target_year ?? fiscalEndYear}년 신규 관측 업체 비중
                                <MetricHelp label="신규 관측 업체 비중 계산 기준">
                                  조회 종료 연도 계약업체 중 조회 가능한 과거 계약 이력이 확인되지 않은 업체의
                                  비중입니다.
                                  {supplierEntry && (
                                    <span className="mt-2 block space-y-0.5 text-[11px] text-muted-foreground">
                                      <span className="block">
                                        산정 기간 {supplierEntry.period_from.slice(0, 10)}–
                                        {supplierEntry.period_to.slice(0, 10)}
                                      </span>
                                      <span className="block">
                                        신규 {count(supplierEntry.first_observed_company_count)}개 / 대상{" "}
                                        {count(supplierEntry.total_company_count)}개
                                      </span>
                                      {supplierEntry.history_available_from && (
                                        <span className="block">
                                          과거 이력 확인 시작{" "}
                                          {supplierEntry.history_available_from.slice(0, 10)}
                                        </span>
                                      )}
                                      {supplierEntry.history_complete_for_first_observed === false && (
                                        <span className="block">
                                          전체 과거 거래 이력을 보장하지 않습니다.
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </MetricHelp>
                              </>
                            }
                            value={
                              supplierEntry
                                ? supplierEntry.total_company_count > 0
                                  ? `${(supplierEntry.first_observed_company_rate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`
                                  : "산출 불가"
                                : "데이터 없음"
                            }
                            note={
                              supplierEntry?.total_company_count === 0
                                ? "해당 기간에 계약 업체가 없습니다."
                                : undefined
                            }
                          />
                        )}
                      </EntityMetricGrid>
                      {tab === "overview" && (
                        <EntityDetailPanel className="mt-5" muted={false}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="flex items-center gap-1 text-sm">
                              계약금액 분포
                              <MetricHelp label="계약금액 분포 계산 기준">
                                금액이 확인된 계약만 합산해 업체별 비중을 계산합니다.
                                {Boolean(companyStructure?.excluded_contract_event_count) && (
                                  <span className="mt-2 block text-[11px] text-muted-foreground">
                                    금액 미확인 {count(companyStructure?.excluded_contract_event_count)}건
                                    제외
                                  </span>
                                )}
                              </MetricHelp>
                            </strong>
                            <span className="text-xs text-muted-foreground">선택 기간·분야 기준</span>
                          </div>
                          {companyStructure?.concentration_computable !== false && companyAmountTotal > 0 ? (
                            <>
                              <div
                                className="mt-4 flex h-9 overflow-hidden rounded-lg bg-muted"
                                aria-label="계약업체별 계약금액 분포 요약"
                              >
                                {[
                                  ["상위 5개", topFiveCompanyShare, procurementDistributionColor.leading],
                                  [
                                    loadedCompanyCount > 5 ? `6–${loadedCompanyCount}위` : "6위 이하",
                                    middleCompanyShare,
                                    procurementDistributionColor.middle,
                                  ],
                                  [
                                    remainingCompanyCount > 0
                                      ? `나머지 ${count(remainingCompanyCount)}개`
                                      : "나머지",
                                    remainingCompanyShare,
                                    procurementDistributionColor.remainder,
                                  ],
                                ].map(([label, ratio, className]) =>
                                  typeof ratio === "number" && ratio > 0 ? (
                                    <span
                                      className={`grid min-w-0 place-items-center px-2 text-xs font-semibold ${className} ${String(label).startsWith("나머지") ? "text-foreground" : "text-white"}`}
                                      key={label}
                                      style={{ width: `${ratio * 100}%` }}
                                    >
                                      {ratio >= 0.12 ? `${(ratio * 100).toFixed(1)}%` : ""}
                                    </span>
                                  ) : null,
                                )}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                                {[
                                  ["상위 5개", topFiveCompanyShare],
                                  [
                                    loadedCompanyCount > 5 ? `6–${loadedCompanyCount}위` : "6위 이하",
                                    middleCompanyShare,
                                  ],
                                  [
                                    remainingCompanyCount > 0
                                      ? `나머지 ${count(remainingCompanyCount)}개`
                                      : "나머지",
                                    remainingCompanyShare,
                                  ],
                                ].map(([label, ratio]) => (
                                  <span key={label}>
                                    <span className="text-muted-foreground">{label}</span>{" "}
                                    <strong>{(Number(ratio) * 100).toFixed(1)}%</strong>
                                  </span>
                                ))}
                              </div>
                              <p className="mt-4 border-l-2 border-slate-300 pl-3 text-sm leading-6 dark:border-slate-600">
                                상위 {count(loadedCompanyCount)}개 업체가 전체 계약금액의{" "}
                                <strong>{(loadedCompanyShare * 100).toFixed(1)}%</strong>를 차지하며,
                                {remainingCompanyCount > 0
                                  ? ` 나머지 ${count(remainingCompanyCount)}개 업체가 ${(remainingCompanyShare * 100).toFixed(1)}%를 차지합니다.`
                                  : ""}
                              </p>
                            </>
                          ) : (
                            <p className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                              업체별 귀속 계약금액이 충분하지 않아 금액 분포를 산출할 수 없습니다.
                            </p>
                          )}
                          <div className="mt-5 border-t pt-4 text-right">
                            <EntityDetailAction onClick={() => setTab("companies")}>
                              계약업체 자세히 보기
                            </EntityDetailAction>
                          </div>
                        </EntityDetailPanel>
                      )}
                      {tab === "companies" && <OrganizationCompaniesSection view={view} />}
                    </EntityDetailSection>
                  </section>
                )}

                {tab === "notices" && (
                  <OrganizationActivityPanel
                    appliedSearch={listQuery}
                    contextParams={searchParams}
                    data={activity.data}
                    error={activity.error}
                    isError={activity.isError}
                    isFetching={activity.isFetching}
                    isLoading={activity.isLoading}
                    onPageChange={setListPage}
                    onReset={resetActivityView}
                    onRetry={() => void activity.refetch()}
                    onSearchClear={clearListSearch}
                    onSearchSubmit={submitListSearch}
                    onSearchValueChange={setListSearch}
                    onStageChange={setActivityStage}
                    organizationName={organization?.name}
                    page={listPage}
                    periodLabel={periodLabel}
                    searchValue={listSearch}
                    stage={activityStage}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </article>
    </EntityDetailLayout>
  );
}
