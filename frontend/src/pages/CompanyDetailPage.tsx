import { Building2, Search, X } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EntityDetailContextBar } from "@/components/common/entity-detail-context-bar";
import {
  ENTITY_RELATIONSHIP_PAGE_SIZE,
  EntityRelationshipList,
} from "@/components/common/entity-relationship-list";
import {
  EntityDetailAction,
  EntityDetailPanel,
  EntityDetailSection,
  EntityDetailToolbar,
  EntityMetric,
  EntityMetricGrid,
  EntityMetricValue,
  EntitySectionHeader,
} from "@/components/common/entity-detail-section";
import { ListPagination } from "@/components/common/list-pagination";
import { ListEmptyState } from "@/components/common/list-empty-state";
import { SectionError } from "@/components/common/error-state";
import { ProcurementFilterPanel } from "@/components/procurement/procurement-filter-panel";
import { RelationshipAnalysis } from "@/components/procurement/relationship-analysis";
import { EntityDetailContentSkeleton, EntityDetailLayout } from "@/components/layout/entity-detail-layout";
import { EntityDetailHeader } from "@/components/layout/entity-detail-header";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { MetricHelp } from "@/components/common/metric-help";
import { UpdatingOverlay } from "@/components/common/updating-overlay";
import { entityDetailPath } from "@/shared/navigation/entity-links";
import { CompanyInformationPanel } from "@/features/company-context/CompanyInformationPanel";
import { CompanyParticipationPanel } from "@/features/company-context/CompanyParticipationPanel";
import { RelationshipTreemap } from "@/features/relationships/RelationshipTreemap";
import {
  procurementFieldIdentity,
  procurementFieldOptionLabel,
  procurementFieldSelection,
} from "@/shared/procurement/field-options";
import { formatCompactMoney as money } from "@/shared/format/money";
import { procurementDistributionColor } from "@/shared/ui/procurement-chart-palette";
import { useOrganizationCompanyRelationship } from "../features/organizations/api";
import {
  useCompanyActivity,
  useCompanyCompetitors,
  useCompanyDetailContext,
  useCompanyProcurementProfile,
  useCompanyProfile,
} from "../features/company-context/api";

const workTypeLabels: Record<string, string> = {
  goods: "물품",
  service: "용역",
  construction: "공사",
  foreign: "외자",
  other: "기타",
  unknown: "미분류",
};

export function CompanyDetailPage() {
  const { businessNumber } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const currentYear = new Date().getUTCFullYear();
  const earliestYear = 2022;
  const fromYear = Math.max(
    earliestYear,
    Number(params.get("fromYear")) || Math.max(earliestYear, currentYear - 4),
  );
  const toYear = Math.min(currentYear, Number(params.get("toYear")) || currentYear);
  const workType = params.get("workType") ?? "";
  const largeCategory = params.get("large") ?? "";
  const middleCategory = params.get("middle") ?? "";
  const fieldCode = params.get("field") ?? "";
  const participationPage = Math.max(1, Number(params.get("participationPage")) || 1);
  const participationQuery = params.get("participationQ") ?? "";
  const organizationPage = Math.max(1, Number(params.get("organizationPage")) || 1);
  const selectedOrganizationCode = params.get("organization") ?? "";
  const organizationQuery = params.get("organizationQ") ?? "";
  const [organizationDraft, setOrganizationDraft] = useState({
    basis: organizationQuery,
    value: organizationQuery,
  });
  const organizationSearch =
    organizationDraft.basis === organizationQuery ? organizationDraft.value : organizationQuery;
  const setOrganizationSearch = (value: string) => setOrganizationDraft({ basis: organizationQuery, value });
  const [participationDraft, setParticipationDraft] = useState({
    basis: participationQuery,
    value: participationQuery,
  });
  const participationSearch =
    participationDraft.basis === participationQuery ? participationDraft.value : participationQuery;
  const setParticipationSearch = (value: string) =>
    setParticipationDraft({ basis: participationQuery, value });
  const [organizationListFilter, setOrganizationListFilter] = useState<"all" | "major" | "new">("all");
  const periodKey = `${fromYear}:${toYear}`;
  const [draftPeriodState, setDraftPeriodState] = useState({ basis: periodKey, value: [fromYear, toYear] });
  const draftPeriod = draftPeriodState.basis === periodKey ? draftPeriodState.value : [fromYear, toYear];
  const setDraftPeriod = (value: number[]) => setDraftPeriodState({ basis: periodKey, value });
  const [showProcurementFilters, setShowProcurementFilters] = useState(false);
  useEffect(() => {
    if (workType !== "goods" || largeCategory !== "물품") return;
    const next = new URLSearchParams(params);
    next.delete("large");
    next.delete("middle");
    setParams(next, { replace: true });
  }, [largeCategory, params, setParams, workType]);
  const updateFilters = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    next.delete("participationPage");
    next.delete("organizationPage");
    setParams(next, { replace: true });
  };
  const setListPage = (key: "participationPage" | "organizationPage", page: number) => {
    const next = new URLSearchParams(params);
    if (page <= 1) next.delete(key);
    else next.set(key, String(page));
    setParams(next);
  };
  const query = useCompanyProfile(businessNumber);
  const requestedTab = params.get("tab");
  const tab =
    requestedTab === "participations" || requestedTab === "organizations" || requestedTab === "companyInfo"
      ? requestedTab
      : "relationships";
  const setTab = (nextTab: string) => {
    const next = new URLSearchParams(params);
    if (nextTab === "relationships") next.delete("tab");
    else next.set("tab", nextTab);
    next.delete("participationPage");
    next.delete("organizationPage");
    if (nextTab !== "organizations") next.delete("organization");
    setShowProcurementFilters(false);
    setParams(next);
  };
  const activity = useCompanyActivity(
    businessNumber,
    {
      fromYear,
      toYear,
      workType: workType || undefined,
      largeCategory: largeCategory || undefined,
      middleCategory: middleCategory || undefined,
      fieldCode: fieldCode || undefined,
      query: participationQuery || undefined,
      page: participationPage,
      pageSize: 20,
    },
    tab === "participations",
  );
  const procurement = useCompanyProcurementProfile(businessNumber, {
    fromYear,
    toYear,
    workType: workType || undefined,
    largeCategory: largeCategory || undefined,
    middleCategory: middleCategory || undefined,
    fieldCode: fieldCode || undefined,
    targetYear: toYear,
    page: 1,
    pageSize: 20,
  });
  const organizationProcurement = useCompanyProcurementProfile(
    businessNumber,
    {
      fromYear,
      toYear,
      workType: workType || undefined,
      largeCategory: largeCategory || undefined,
      middleCategory: middleCategory || undefined,
      fieldCode: fieldCode || undefined,
      organizationQuery: organizationQuery || undefined,
      targetYear: toYear,
      organizationEntryStatus: organizationListFilter === "new" ? "first_observed" : undefined,
      page: organizationPage,
      pageSize: ENTITY_RELATIONSHIP_PAGE_SIZE,
    },
    tab === "organizations",
  );
  const competitors = useCompanyCompetitors(
    businessNumber,
    {
      fromYear,
      toYear,
      workType: workType || undefined,
      largeCategory: largeCategory || undefined,
      middleCategory: middleCategory || undefined,
      fieldCode: fieldCode || undefined,
    },
    tab === "relationships",
  );
  const overviewOrganizationRelationships = useMemo(
    () =>
      [...(procurement.data?.organization_relationships ?? [])].sort(
        (left, right) =>
          (right.total_attributed_contract_amount ?? 0) - (left.total_attributed_contract_amount ?? 0),
      ),
    [procurement.data?.organization_relationships],
  );
  const organizationRelationships =
    tab === "organizations"
      ? (organizationProcurement.data?.organization_relationships ?? overviewOrganizationRelationships)
      : overviewOrganizationRelationships;
  const filteredOrganizations = organizationRelationships;
  const contractedOrganizations = filteredOrganizations.filter(
    (organization) => organization.contract_event_count > 0,
  );
  const displayedOrganizations = [...contractedOrganizations]
    .sort(
      (left, right) =>
        (right.total_attributed_contract_amount ?? 0) - (left.total_attributed_contract_amount ?? 0),
    )
    .slice(0, organizationListFilter === "major" ? 5 : undefined);
  const selectedOrganization = contractedOrganizations.find(
    (organization) => organization.organization_code === selectedOrganizationCode,
  );
  const organizationRelationship = useOrganizationCompanyRelationship(
    selectedOrganization?.organization_code,
    businessNumber,
    1,
    toYear - fromYear + 1,
    {
      workType: workType || undefined,
      largeCategory: largeCategory || undefined,
      middleCategory: middleCategory || undefined,
      fieldCode: fieldCode || undefined,
    },
    tab === "organizations" && Boolean(selectedOrganization),
    { from: fromYear, to: toYear },
  );
  const summary = procurement.data?.summary;
  const organizationEntry = procurement.data?.organization_entry;
  const overviewContractedOrganizations = overviewOrganizationRelationships.filter(
    (organization) => organization.contract_event_count > 0,
  );
  const organizationAmountTotal = summary?.total_attributed_contract_amount ?? 0;
  const loadedOrganizationAmount = overviewContractedOrganizations.reduce(
    (sum, organization) => sum + Math.max(0, organization.total_attributed_contract_amount ?? 0),
    0,
  );
  const topFiveOrganizationAmount = overviewContractedOrganizations
    .slice(0, 5)
    .reduce((sum, organization) => sum + Math.max(0, organization.total_attributed_contract_amount ?? 0), 0);
  const loadedOrganizationShare =
    organizationAmountTotal > 0 ? Math.min(1, loadedOrganizationAmount / organizationAmountTotal) : 0;
  const topFiveOrganizationShare =
    organizationAmountTotal > 0 ? topFiveOrganizationAmount / organizationAmountTotal : 0;
  const middleOrganizationShare = Math.max(0, loadedOrganizationShare - topFiveOrganizationShare);
  const remainingOrganizationShare = Math.max(0, 1 - loadedOrganizationShare);
  const remainingOrganizationCount = Math.max(
    0,
    (summary?.organization_count ?? overviewContractedOrganizations.length) -
      overviewContractedOrganizations.length,
  );
  const fields = useMemo(
    () => procurement.data?.field_distribution ?? [],
    [procurement.data?.field_distribution],
  );
  const appliedField = procurement.data?.analysis_basis?.field_filter;
  const fieldOptions = useMemo(
    () =>
      [...fields]
        .sort(
          (left, right) => (right.attributed_contract_amount ?? 0) - (left.attributed_contract_amount ?? 0),
        )
        .map((field) => ({
          value: procurementFieldIdentity(field) ?? "",
          label: procurementFieldOptionLabel(field, money, workTypeLabels),
        }))
        .filter((option) => Boolean(option.value)),
    [fields],
  );
  const selectedFieldValue =
    fieldCode ||
    middleCategory ||
    (largeCategory === "미분류" && workType ? `${largeCategory}::${workType}` : largeCategory);
  const selectedFieldOption = fieldCode
    ? fields.find(
        (field) =>
          field.selection_filter?.field_code === fieldCode ||
          field.field_code === fieldCode ||
          field.display_code === fieldCode,
      )
    : undefined;
  const selectedFieldText =
    appliedField?.field_name ||
    selectedFieldOption?.display_name ||
    selectedFieldOption?.field_name ||
    appliedField?.middle_category ||
    appliedField?.large_category ||
    middleCategory ||
    largeCategory ||
    "선택 분야";
  const visibleFieldOptions =
    selectedFieldValue && !fieldOptions.some((option) => option.value === selectedFieldValue)
      ? [{ value: selectedFieldValue, label: selectedFieldText }, ...fieldOptions]
      : fieldOptions;
  const periodLabel = fromYear === toYear ? `${fromYear}년` : `${fromYear}–${toYear}년`;
  const setPeriod = (value: number[]) =>
    updateFilters({ fromYear: String(value[0]), toYear: String(value[1]) });
  const selectField = (value: string) => {
    if (!value) return updateFilters({ large: undefined, middle: undefined, field: undefined });
    const field = fields.find((item) => procurementFieldIdentity(item) === value);
    if (!field) return;
    const selection = procurementFieldSelection(field);
    if (selection.field_code || field.has_children === false) setShowProcurementFilters(false);
    updateFilters({
      workType: (selection.work_type ?? workType) || undefined,
      large: selection.large_category ?? undefined,
      middle: selection.middle_category ?? undefined,
      field: selection.field_code ?? undefined,
    });
  };
  const clearFieldLevel = (level: "large" | "middle" | "field") => {
    const next = new URLSearchParams(params);
    if (level === "large") next.delete("large");
    if (level === "large" || level === "middle") next.delete("middle");
    next.delete("field");
    next.delete("participationPage");
    next.delete("organizationPage");
    setParams(next, { replace: true });
  };
  const organizationHref = (organizationCode: string) => {
    return entityDetailPath("organization", organizationCode, {
      source: "relationship",
      params,
      company: businessNumber,
    });
  };
  const selectOrganization = (organizationCode: string) => {
    const next = new URLSearchParams(params);
    next.set("organization", organizationCode);
    setParams(next, { replace: true });
  };
  const submitOrganizationSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    const value = organizationSearch.trim();
    if (value) next.set("organizationQ", value);
    else next.delete("organizationQ");
    next.delete("organization");
    next.delete("organizationPage");
    setParams(next);
  };
  const clearOrganizationSearch = () => {
    const next = new URLSearchParams(params);
    next.delete("organizationQ");
    next.delete("organization");
    next.delete("organizationPage");
    setOrganizationSearch("");
    setParams(next);
  };
  const submitParticipationSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    const value = participationSearch.trim();
    if (value) next.set("participationQ", value);
    else next.delete("participationQ");
    next.delete("participationPage");
    setParams(next);
  };
  const clearParticipationSearch = () => {
    const next = new URLSearchParams(params);
    next.delete("participationQ");
    next.delete("participationPage");
    setParticipationSearch("");
    setParams(next);
  };
  const openSelectedOrganizationNotices = () => {
    const organizationCode = selectedOrganization?.organization_code;
    if (!organizationCode) return;
    const next = new URLSearchParams(params);
    next.set("tab", "notices");
    next.set("q", name);
    next.delete("organization");
    next.delete("organizationQ");
    next.delete("organizationPage");
    next.delete("participationPage");
    navigate(`/organizations/${encodeURIComponent(organizationCode)}?${next.toString()}`);
  };

  const data = query.data ?? {
    business_registration: [],
    suppliers: [],
    industries: [],
    products: [],
    sanctions: [],
    qualifications: [],
    direct_production: [],
    partial: true,
  };
  const registration = data.business_registration[0] ?? {};
  const name =
    params.get("name") ??
    String(
      registration.business_name ??
        registration.company_name ??
        procurement.data?.company.name ??
        "업체 정보",
    );
  const industryNames = data.industries.map((item) =>
    String(item.industry_name ?? item.name ?? item.industry_code ?? "업종정보"),
  );
  const visibleFields = fields.filter(
    (field) =>
      (field.participation_count ?? 0) > 0 ||
      (field.award_event_count ?? 0) > 0 ||
      (field.contract_event_count ?? 0) > 0 ||
      (field.attributed_contract_amount ?? 0) !== 0,
  );
  const appliedProcurementFilters = [
    ...(workType
      ? [
          {
            key: "workType",
            label: workTypeLabels[workType] ?? workType,
            onRemove: () =>
              updateFilters({ workType: undefined, large: undefined, middle: undefined, field: undefined }),
          },
        ]
      : []),
    ...(largeCategory
      ? [
          {
            key: "large",
            label: appliedField?.large_category ?? largeCategory,
            onRemove: () => clearFieldLevel("large"),
          },
        ]
      : []),
    ...(middleCategory
      ? [
          {
            key: "middle",
            label: appliedField?.middle_category ?? middleCategory,
            onRemove: () => clearFieldLevel("middle"),
          },
        ]
      : []),
    ...(fieldCode
      ? [{ key: "field", label: selectedFieldText, onRemove: () => clearFieldLevel("field") }]
      : []),
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index);
  const companyDetail = useCompanyDetailContext(
    businessNumber,
    name === "업체 정보" ? undefined : name,
    tab === "companyInfo",
  );
  const procurementConditionSummary = `${periodLabel} · ${workType ? workTypeLabels[workType] : "전체 업무"} · ${
    largeCategory || middleCategory || fieldCode ? selectedFieldText : "전체 분야"
  }`;
  const isProcurementUpdating = procurement.isFetching && Boolean(procurement.data);
  const hasProcurementConditionError =
    procurement.isError ||
    (tab === "participations" && activity.isError) ||
    (tab === "organizations" && organizationProcurement.isError);
  const retryProcurementConditions = () => {
    void procurement.refetch();
    if (tab === "participations") void activity.refetch();
    if (tab === "organizations") void organizationProcurement.refetch();
  };
  const successRateLabel =
    summary?.award_success_rate == null
      ? "산출 불가"
      : `${(summary.award_success_rate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  const overviewInsight = `${periodLabel} 입찰 참여 ${summary?.participation_count.toLocaleString("ko-KR") ?? "-"}건 중 낙찰 ${summary?.award_event_count.toLocaleString("ko-KR") ?? "-"}건이 확인됐습니다. 수주 성공률은 ${successRateLabel}이며, 계약금액은 ${money(summary?.total_attributed_contract_amount)}입니다.`;

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
              { id: "participations", label: "입찰 이력", count: summary?.participation_count },
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
                      label="입찰 참여"
                      value={
                        <EntityMetricValue
                          value={summary?.participation_count.toLocaleString("ko-KR") ?? "-"}
                          unit="건"
                        />
                      }
                    />
                    <EntityMetric
                      className="border-b border-l pl-5 lg:border-b-0 lg:px-5"
                      label="낙찰"
                      note={`수주 성공률 ${successRateLabel}`}
                      value={
                        <EntityMetricValue
                          value={summary?.award_event_count.toLocaleString("ko-KR") ?? "-"}
                          unit="건"
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
                    <EntitySectionHeader
                      title="입찰·수주 추이"
                      description="연도별 참여와 낙찰 실적입니다."
                    />
                    <div className="mt-5 space-y-4">
                      {(procurement.data?.yearly_activity ?? [])
                        .slice()
                        .sort((a, b) => a.year - b.year)
                        .map((item) => {
                          const max = Math.max(
                            1,
                            ...(procurement.data?.yearly_activity ?? []).map(
                              (row) => row.participation_count ?? 0,
                            ),
                          );
                          return (
                            <div key={item.year}>
                              <div className="mb-2 flex justify-between gap-4 text-sm">
                                <span className="font-medium">
                                  {item.year}년{item.year === currentYear ? " 누적" : ""}
                                </span>
                                <span>
                                  <strong>
                                    참여 {item.participation_count.toLocaleString("ko-KR")}건 · 낙찰{" "}
                                    {item.award_event_count.toLocaleString("ko-KR")}건
                                  </strong>
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    성공률{" "}
                                    {item.award_success_rate != null
                                      ? (item.award_success_rate * 100).toFixed(1)
                                      : "-"}
                                    % · {money(item.attributed_contract_amount)}
                                  </span>
                                </span>
                              </div>
                              <span className="block h-2 overflow-hidden rounded-full bg-muted">
                                <span
                                  className="block h-full rounded-full bg-chart-1"
                                  style={{ width: `${((item.participation_count ?? 0) / max) * 100}%` }}
                                />
                              </span>
                            </div>
                          );
                        })}
                    </div>
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
              {tab === "organizations" && (
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
                            {periodLabel} 최초 계약일 기준이며, 조회 종료일 현재의 최신 계약금액을 합산합니다.
                            공동수급 계약은 이 업체에 귀속된 금액만 포함합니다.
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
                        organizationAmountTotal > 0
                          ? `${(topFiveOrganizationShare * 100).toFixed(1)}%`
                          : "산출 불가"
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
                    relationshipDetailLoading={
                      organizationRelationship.isFetching && Boolean(selectedOrganization)
                    }
                    relationshipDetail={
                      selectedOrganization &&
                      organizationRelationship.data &&
                      !organizationRelationship.isFetching ? (
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
                              selectedOrganization.latest_contract_date ??
                              selectedOrganization.latest_activity_date,
                          }}
                          years={Array.from(
                            { length: toYear - fromYear + 1 },
                            (_, index) => fromYear + index,
                          )}
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
                      relationship.organization_code
                        ? organizationHref(relationship.organization_code)
                        : undefined
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
                          {(organizationEntry?.first_observed_organization_count ?? 0).toLocaleString(
                            "ko-KR",
                          )}
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
                              organization.organization_code ??
                              `${organization.organization_name ?? "unknown"}-${index}`,
                            name: organization.organization_name ?? "기관명 미확인",
                            amount: organization.total_attributed_contract_amount,
                            contractCount: organization.contract_event_count,
                            latestContractDate:
                              organization.latest_contract_date ?? organization.latest_activity_date,
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
              )}
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
