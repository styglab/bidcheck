import { Landmark, Search, X } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
import { MetricHelp } from "@/components/common/metric-help";
import { UpdatingOverlay } from "@/components/common/updating-overlay";
import { ProcurementFilterPanel } from "@/components/procurement/procurement-filter-panel";
import { RelationshipAnalysis } from "@/components/procurement/relationship-analysis";
import {
  EntityDetailContentSkeleton,
  EntityDetailHeaderSkeleton,
  EntityDetailLayout,
} from "@/components/layout/entity-detail-layout";
import { EntityDetailHeader } from "@/components/layout/entity-detail-header";
import { PageError, SectionError } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RelationshipTreemap } from "@/features/relationships/RelationshipTreemap";
import { OrganizationActivityPanel } from "@/features/organizations/OrganizationActivityPanel";
import { OrganizationNoticeTiming } from "@/features/organizations/OrganizationNoticeTiming";
import { OrganizationProcurementStructure } from "@/features/organizations/OrganizationProcurementStructure";
import {
  filterAndSortCompanyRelationships,
  formatMonthDay as monthDay,
  formatProcurementCount as count,
  getProcurementActivityView as procurementActivityView,
  procurementWorkTypeLabel as workTypeLabel,
  supplierEntryToRelationship as supplierEntryRelationship,
  type ProcurementCompanySort,
} from "@/features/organizations/procurement-presentation";
import { entityDetailPath } from "@/shared/navigation/entity-links";
import {
  procurementFieldIdentity as fieldIdentity,
  procurementFieldOptionLabel,
  procurementFieldSelection,
} from "@/shared/procurement/field-options";
import { formatCompactMoney as money } from "@/shared/format/money";
import { procurementDistributionColor } from "@/shared/ui/procurement-chart-palette";
import {
  useOrganization,
  useOrganizationCompanyRelationship,
  useOrganizationProcurementActivity,
  useOrganizationProcurementProfile,
  useOrganizationSupplierEntries,
  type ProcurementActivityStage,
  type ProcurementRelationship,
} from "../features/organizations/api";

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
  const { organizationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentYear = new Date().getUTCFullYear();
  const earliestYear = 2022;
  const legacyPeriod = Number(searchParams.get("period") ?? 5);
  const requestedFromYear = Number(
    searchParams.get("fromYear") ??
      currentYear - (legacyPeriod === 1 || legacyPeriod === 3 ? legacyPeriod : 5) + 1,
  );
  const requestedToYear = Number(searchParams.get("toYear") ?? currentYear);
  const fiscalStartYear = Math.max(earliestYear, Math.min(requestedFromYear, currentYear));
  const fiscalEndYear = Math.max(fiscalStartYear, Math.min(requestedToYear, currentYear));
  const periodYears = fiscalEndYear - fiscalStartYear + 1;
  const periodLabel =
    fiscalStartYear === fiscalEndYear ? `${fiscalStartYear}년` : `${fiscalStartYear}–${fiscalEndYear}년`;
  const periodRange = { from: fiscalStartYear, to: fiscalEndYear };
  const periodKey = `${fiscalStartYear}:${fiscalEndYear}`;
  const [draftPeriodState, setDraftPeriodState] = useState({
    basis: periodKey,
    value: [fiscalStartYear, fiscalEndYear],
  });
  const draftPeriod =
    draftPeriodState.basis === periodKey ? draftPeriodState.value : [fiscalStartYear, fiscalEndYear];
  const setDraftPeriod = (value: number[]) => setDraftPeriodState({ basis: periodKey, value });
  const requestedTab = searchParams.get("tab") ?? "overview";
  const tab =
    requestedTab === "awards" || requestedTab === "contracts" || requestedTab === "outcomes"
      ? "notices"
      : requestedTab;
  const selectedLargeCategory = searchParams.get("large") ?? undefined;
  const selectedMiddleCategory = searchParams.get("middle") ?? undefined;
  const selectedFieldCode = searchParams.get("field") ?? undefined;
  const selectedWorkType = searchParams.get("workType") ?? undefined;
  useEffect(() => {
    if (selectedWorkType !== "goods" || selectedLargeCategory !== "물품") return;
    const next = new URLSearchParams(searchParams);
    next.delete("large");
    next.delete("middle");
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedLargeCategory, selectedWorkType, setSearchParams]);
  const requestedPage = Number(searchParams.get("page") ?? 1);
  const listPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const listQuery = searchParams.get("q") ?? "";
  const requestedStage = searchParams.get("stage") ?? "all";
  const activityStage: ProcurementActivityStage = [
    "all",
    "scheduled",
    "open",
    "closed",
    "award",
    "contract",
    "failed_or_cancelled",
  ].includes(requestedStage)
    ? (requestedStage as ProcurementActivityStage)
    : "all";
  const [overviewCompanyPage, setOverviewCompanyPage] = useState(1);
  const [overviewCompanyQuery, setOverviewCompanyQuery] = useState("");
  const [overviewCompanySearch, setOverviewCompanySearch] = useState("");
  const [overviewCompanySort, setOverviewCompanySort] =
    useState<ProcurementCompanySort>("contract_amount_desc");
  const [overviewCompanyFilter, setOverviewCompanyFilter] = useState<"all" | "major" | "new">("all");
  const [overviewSelectedSupplier, setOverviewSelectedSupplier] = useState<ProcurementRelationship>();
  const [showProcurementFilters, setShowProcurementFilters] = useState(false);
  const organizationQuery = useOrganization(organizationId);
  const activity = useOrganizationProcurementActivity(
    organizationId,
    true,
    periodRange,
    tab === "notices" ? listPage : 1,
    tab === "notices" ? listQuery || undefined : undefined,
    tab === "notices" ? activityStage : tab === "overview" ? "open" : "all",
    {
      largeCategory: selectedLargeCategory,
      middleCategory: selectedMiddleCategory,
      fieldCode: selectedFieldCode,
      workType: selectedWorkType,
    },
  );
  const procurement = useOrganizationProcurementProfile(
    organizationId,
    periodYears,
    {
      largeCategory: selectedLargeCategory,
      middleCategory: selectedMiddleCategory,
      fieldCode: selectedFieldCode,
      workType: selectedWorkType,
    },
    true,
    periodRange,
    {
      page: 1,
      pageSize: tab === "overview" || tab === "companies" ? 30 : 20,
      sort: "contract_amount_desc",
    },
  );
  const supplierEntries = useOrganizationSupplierEntries(
    organizationId,
    fiscalEndYear,
    {
      largeCategory: selectedLargeCategory,
      middleCategory: selectedMiddleCategory,
      fieldCode: selectedFieldCode,
      workType: selectedWorkType,
    },
    tab === "companies",
    1,
    100,
  );
  const legacySelectedCompanyNumber = searchParams.get("company") ?? undefined;
  const [listSearch, setListSearch] = useState(listQuery);
  const hasCustomOverviewCompanyList =
    overviewCompanyFilter === "all" &&
    (overviewCompanyPage !== 1 ||
      Boolean(overviewCompanyQuery) ||
      overviewCompanySort !== "contract_amount_desc");
  const overviewCompanyListQuery = useOrganizationProcurementProfile(
    organizationId,
    periodYears,
    {
      largeCategory: selectedLargeCategory,
      middleCategory: selectedMiddleCategory,
      fieldCode: selectedFieldCode,
      workType: selectedWorkType,
    },
    tab === "companies" && hasCustomOverviewCompanyList,
    periodRange,
    {
      page: overviewCompanyPage,
      pageSize: ENTITY_RELATIONSHIP_PAGE_SIZE,
      query: overviewCompanyQuery || undefined,
      sort: overviewCompanySort,
    },
  );
  const organization = organizationQuery.data?.organization;
  const companyRelationships = useMemo(
    () => (procurement.data?.company_relationships ?? []).filter((item) => item.contract_event_count > 0),
    [procurement.data?.company_relationships],
  );
  const overviewCompanyListData = hasCustomOverviewCompanyList
    ? overviewCompanyListQuery.data
    : procurement.data;
  const overviewCompanyRelationships = (overviewCompanyListData?.company_relationships ?? []).filter(
    (item) => item.contract_event_count > 0,
  );
  const summary = procurement.data?.summary;
  const supplierEntry = summary?.supplier_entry ?? procurement.data?.supplier_entry;
  const quarterDistribution = procurement.data?.notice_quarter_distribution ?? [];
  const contractMethodDistribution = procurement.data?.contract_method_distribution ?? [];
  const visibleContractMethods = contractMethodDistribution.filter((item) => item.contract_event_count > 0);
  const contractMethodAmountTotal = visibleContractMethods.reduce(
    (total, item) => total + Math.max(0, item.attributed_contract_amount ?? 0),
    0,
  );
  const leadingContractCountMethod = [...visibleContractMethods].sort(
    (left, right) => right.contract_share - left.contract_share,
  )[0];
  const leadingContractAmountMethod = [...visibleContractMethods].sort(
    (left, right) =>
      (right.amount_share ??
        (contractMethodAmountTotal > 0
          ? (right.attributed_contract_amount ?? 0) / contractMethodAmountTotal
          : 0)) -
      (left.amount_share ??
        (contractMethodAmountTotal > 0
          ? (left.attributed_contract_amount ?? 0) / contractMethodAmountTotal
          : 0)),
  )[0];
  const leadingContractAmountShare = leadingContractAmountMethod
    ? (leadingContractAmountMethod.amount_share ??
      (contractMethodAmountTotal > 0
        ? (leadingContractAmountMethod.attributed_contract_amount ?? 0) / contractMethodAmountTotal
        : 0))
    : undefined;
  const companyStructure = procurement.data?.company_structure;
  const companyAmountTotal =
    companyStructure?.total_company_attributed_contract_amount ??
    summary?.total_attributed_contract_amount ??
    0;
  const loadedCompanyAmount = companyRelationships.reduce(
    (total, company) => total + Math.max(0, company.total_attributed_contract_amount ?? 0),
    0,
  );
  const topFiveCompanyShare =
    companyStructure?.concentration_computable === false
      ? 0
      : (companyStructure?.top_5_company_amount_share ?? 0);
  const loadedCompanyShare =
    companyAmountTotal > 0 ? Math.min(1, loadedCompanyAmount / companyAmountTotal) : 0;
  const middleCompanyShare = Math.max(0, loadedCompanyShare - topFiveCompanyShare);
  const remainingCompanyShare = Math.max(0, 1 - loadedCompanyShare);
  const newSupplierNumbers = useMemo(
    () => new Set((supplierEntries.data?.items ?? []).map((company) => company.company_number)),
    [supplierEntries.data?.items],
  );
  const majorSupplierNumbers = useMemo(
    () => new Set(companyRelationships.slice(0, 5).map((company) => company.company_number)),
    [companyRelationships],
  );
  const newSupplierRelationships = useMemo(
    () => (supplierEntries.data?.items ?? []).map(supplierEntryRelationship),
    [supplierEntries.data?.items],
  );
  const locallyFilteredCompanies = useMemo(() => {
    const source =
      overviewCompanyFilter === "major" ? companyRelationships.slice(0, 5) : newSupplierRelationships;
    return filterAndSortCompanyRelationships(source, overviewCompanyQuery, overviewCompanySort);
  }, [
    companyRelationships,
    newSupplierRelationships,
    overviewCompanyFilter,
    overviewCompanyQuery,
    overviewCompanySort,
  ]);
  const displayedOverviewCompanies =
    overviewCompanyFilter === "all"
      ? overviewCompanyRelationships.slice(0, ENTITY_RELATIONSHIP_PAGE_SIZE)
      : overviewCompanyFilter === "major"
        ? locallyFilteredCompanies
        : locallyFilteredCompanies.slice(
            (overviewCompanyPage - 1) * ENTITY_RELATIONSHIP_PAGE_SIZE,
            overviewCompanyPage * ENTITY_RELATIONSHIP_PAGE_SIZE,
          );
  const companyListQueryError =
    overviewCompanyFilter === "new"
      ? supplierEntries.error
      : overviewCompanyFilter === "all" && hasCustomOverviewCompanyList
        ? overviewCompanyListQuery.error
        : procurement.error;
  const companyListHasError =
    overviewCompanyFilter === "new"
      ? supplierEntries.isError
      : overviewCompanyFilter === "all" && hasCustomOverviewCompanyList
        ? overviewCompanyListQuery.isError
        : procurement.isError;
  const retryCompanyList = () => {
    if (overviewCompanyFilter === "new") return supplierEntries.refetch();
    if (hasCustomOverviewCompanyList) return overviewCompanyListQuery.refetch();
    return procurement.refetch();
  };
  const isUpdating = procurement.isFetching && Boolean(procurement.data);
  const isCompanyConditionUpdating = isUpdating || supplierEntries.isFetching;
  const isAnalysisUpdating = tab === "companies" ? isCompanyConditionUpdating : isUpdating;
  const workTypeDistribution = useMemo(
    () => procurement.data?.work_type_distribution ?? [],
    [procurement.data?.work_type_distribution],
  );
  const sortedWorkTypeDistribution = useMemo(
    () =>
      [...workTypeDistribution].sort(
        (left, right) => (right.attributed_contract_amount ?? 0) - (left.attributed_contract_amount ?? 0),
      ),
    [workTypeDistribution],
  );
  const fieldDistribution = useMemo(
    () => procurement.data?.field_distribution ?? [],
    [procurement.data?.field_distribution],
  );
  const rankedFields = useMemo(
    () =>
      [...fieldDistribution]
        .filter((field) => (field.attributed_contract_amount ?? 0) > 0)
        .sort(
          (left, right) => (right.attributed_contract_amount ?? 0) - (left.attributed_contract_amount ?? 0),
        ),
    [fieldDistribution],
  );
  const topFields = rankedFields.slice(0, 3);
  const overviewFields = selectedFieldCode ? rankedFields : rankedFields.slice(0, 5);
  const insightFields = topFields.slice(0, 2);
  const leadingFieldAmount = insightFields.reduce(
    (total, field) => total + Math.max(0, field.attributed_contract_amount ?? 0),
    0,
  );
  const leadingFieldShare =
    (summary?.total_attributed_contract_amount ?? 0) > 0
      ? leadingFieldAmount / (summary?.total_attributed_contract_amount ?? 1)
      : undefined;
  const contractMethodInsight =
    leadingContractCountMethod && leadingContractAmountMethod && leadingContractAmountShare != null
      ? leadingContractCountMethod.method === leadingContractAmountMethod.method
        ? `${leadingContractCountMethod.method_name}은 계약 건수의 ${(leadingContractCountMethod.contract_share * 100).toFixed(1)}%, 계약금액의 ${(leadingContractAmountShare * 100).toFixed(1)}%를 차지합니다.`
        : `계약 건수는 ${leadingContractCountMethod.method_name} ${(leadingContractCountMethod.contract_share * 100).toFixed(1)}%, 계약금액은 ${leadingContractAmountMethod.method_name} ${(leadingContractAmountShare * 100).toFixed(1)}%가 가장 큽니다.`
      : "";
  const appliedField = procurement.data?.analysis_basis?.field_filter;
  const isSingleLevelField = Boolean(
    selectedLargeCategory &&
    (selectedLargeCategory === "미분류" ||
      (!selectedMiddleCategory &&
        !selectedFieldCode &&
        fieldDistribution.length > 0 &&
        fieldDistribution.every((field) => !field.middle_category) &&
        fieldDistribution.some((field) => field.field_code))),
  );
  const selectedCompanyNumber = overviewSelectedSupplier?.company_number ?? legacySelectedCompanyNumber;
  const selectedCompany =
    overviewSelectedSupplier ??
    companyRelationships.find((item) => item.company_number === selectedCompanyNumber);
  const companyRelationship = useOrganizationCompanyRelationship(
    organizationId,
    selectedCompanyNumber,
    1,
    periodYears,
    {
      largeCategory: selectedLargeCategory,
      middleCategory: selectedMiddleCategory,
      fieldCode: selectedFieldCode,
      workType: selectedWorkType,
    },
    tab === "companies",
    periodRange,
  );
  const selectedCompanyForSheet = useMemo(() => {
    if (!selectedCompany) return undefined;
    const detail = companyRelationship.data;
    if (companyRelationship.isFetching || !detail?.summary) return selectedCompany;
    const activeYears = detail.summary.active_years ?? selectedCompany.active_years;
    return {
      ...selectedCompany,
      company_name: detail.company?.name ?? selectedCompany.company_name,
      contract_event_count: detail.summary.contract_event_count ?? selectedCompany.contract_event_count,
      total_attributed_contract_amount:
        detail.summary.total_attributed_contract_amount ?? selectedCompany.total_attributed_contract_amount,
      active_years: activeYears,
      active_year_count: detail.summary.active_year_count ?? activeYears.length,
      major_fields: detail.major_fields ?? selectedCompany.major_fields,
    } satisfies ProcurementRelationship;
  }, [companyRelationship.data, companyRelationship.isFetching, selectedCompany]);
  const visibleYearlyActivity = [...(procurement.data?.yearly_activity ?? [])]
    .sort((left, right) => right.year - left.year)
    .slice(0, 5)
    .sort((left, right) => left.year - right.year);
  const contractedCompanyCount = companyStructure?.contracted_company_count ?? summary?.company_count ?? 0;
  const loadedCompanyCount = Math.min(companyRelationships.length, contractedCompanyCount);
  const remainingCompanyCount = Math.max(0, contractedCompanyCount - loadedCompanyCount);
  const openNoticeCount = activity.data?.stage_counts?.open ?? 0;
  const openNoticePreview = tab === "overview" ? (activity.data?.items ?? []).slice(0, 2) : [];
  const currentYearPeriodEnd = monthDay(procurement.data?.analysis_basis.period_to);
  const activeTabConditionUpdating =
    tab === "notices"
      ? activity.isFetching
      : tab === "companies"
        ? isCompanyConditionUpdating
        : procurement.isFetching || activity.isFetching;
  const activeTabConditionError =
    tab === "notices"
      ? Boolean(activity.data && activity.isError)
      : tab === "companies"
        ? companyListHasError
        : Boolean(procurement.data && (procurement.isError || activity.isError));
  const retryActiveTabConditions = () => {
    if (tab === "notices") {
      void activity.refetch();
      return;
    }
    if (tab === "companies") {
      void retryCompanyList();
      return;
    }
    void procurement.refetch();
    void activity.refetch();
  };
  const visibleRelationshipEvents = useMemo(
    () =>
      (companyRelationship.data?.events ?? []).filter((event) => {
        const value =
          event.attribution_date ??
          event.notice_published_date ??
          event.first_contract_date ??
          event.contract_date ??
          event.award_date;
        const year = value ? Number(value.slice(0, 4)) : undefined;
        return !year || (year >= fiscalStartYear && year <= fiscalEndYear);
      }),
    [companyRelationship.data?.events, fiscalEndYear, fiscalStartYear],
  );
  const setTab = (nextTab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    next.delete("page");
    next.delete("q");
    setShowProcurementFilters(false);
    setListSearch("");
    setSearchParams(next);
  };
  const setListPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    if (page <= 1) next.delete("page");
    else next.set("page", String(page));
    setSearchParams(next);
  };
  const setActivityStage = (stage: ProcurementActivityStage) => {
    const next = new URLSearchParams(searchParams);
    if (stage === "all") next.delete("stage");
    else next.set("stage", stage);
    next.delete("page");
    setSearchParams(next);
  };
  const submitListSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    const value = listSearch.trim();
    if (value) next.set("q", value);
    else next.delete("q");
    next.delete("page");
    setSearchParams(next);
  };
  const clearListSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    next.delete("page");
    setListSearch("");
    setSearchParams(next);
  };
  const resetActivityView = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    next.delete("stage");
    next.delete("page");
    setListSearch("");
    setSearchParams(next);
  };
  const submitOverviewCompanySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOverviewCompanyQuery(overviewCompanySearch.trim());
    setOverviewCompanyPage(1);
  };
  const clearOverviewCompanySearch = () => {
    setOverviewCompanySearch("");
    setOverviewCompanyQuery("");
    setOverviewCompanyPage(1);
  };
  const resetCompanyListView = () => {
    setOverviewCompanyFilter("all");
    setOverviewCompanySearch("");
    setOverviewCompanyQuery("");
    setOverviewCompanySort("contract_amount_desc");
    setOverviewCompanyPage(1);
  };
  const openSelectedCompanyNotices = () => {
    const companyName = selectedCompanyForSheet?.company_name;
    if (!companyName) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", "notices");
    next.set("q", companyName);
    next.delete("page");
    next.delete("stage");
    next.delete("company");
    next.delete("companyQ");
    setListSearch(companyName);
    setOverviewSelectedSupplier(undefined);
    setSearchParams(next);
  };
  const openActiveNotices = () => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "notices");
    next.set("stage", "open");
    next.delete("page");
    next.delete("q");
    setListSearch("");
    setSearchParams(next);
  };
  const setPeriodRange = (range: number[]) => {
    const next = new URLSearchParams(searchParams);
    next.set("fromYear", String(range[0]));
    next.set("toYear", String(range[1]));
    next.delete("period");
    next.delete("page");
    setSearchParams(next);
  };
  const selectField = (field: (typeof fieldDistribution)[number]) => {
    if (isSingleLevelField) return;
    const next = new URLSearchParams(searchParams);
    const selection = procurementFieldSelection(field);
    next.delete("large");
    next.delete("middle");
    next.delete("field");
    if (selection.large_category) next.set("large", selection.large_category);
    if (selection.middle_category) next.set("middle", selection.middle_category);
    if (selection.field_code) next.set("field", selection.field_code);
    if (selection.work_type) next.set("workType", selection.work_type);
    if (selection.field_code || field.has_children === false) setShowProcurementFilters(false);
    next.delete("company");
    next.delete("page");
    setSearchParams(next);
  };
  const resetFieldTo = (level: "all" | "large" | "middle") => {
    const next = new URLSearchParams(searchParams);
    if (level === "all") next.delete("large");
    if (level === "all" || level === "large") next.delete("middle");
    if (level !== "middle" || selectedFieldCode) next.delete("field");
    next.delete("company");
    next.delete("page");
    setSearchParams(next);
  };
  const setWorkType = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("workType");
    else next.set("workType", value);
    next.delete("large");
    next.delete("middle");
    next.delete("field");
    next.delete("company");
    next.delete("page");
    setSearchParams(next);
  };
  const clearWorkType = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("workType");
    next.delete("large");
    next.delete("middle");
    next.delete("field");
    next.delete("company");
    next.delete("page");
    setSearchParams(next);
  };
  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    [
      "period",
      "fromYear",
      "toYear",
      "workType",
      "large",
      "middle",
      "field",
      "company",
      "page",
      "companyQ",
    ].forEach((key) => next.delete(key));
    setSearchParams(next);
  };
  const selectedLargeLabel = selectedLargeCategory
    ? (appliedField?.large_category ?? selectedLargeCategory)
    : undefined;
  const selectedMiddleLabel = selectedMiddleCategory
    ? (appliedField?.middle_category ?? selectedMiddleCategory)
    : undefined;
  const selectedFieldOption = selectedFieldCode
    ? fieldDistribution.find(
        (field) =>
          field.selection_filter?.field_code === selectedFieldCode ||
          field.field_code === selectedFieldCode ||
          field.display_code === selectedFieldCode,
      )
    : undefined;
  const selectedFieldLabel = selectedFieldCode
    ? (appliedField?.field_name ??
      selectedFieldOption?.display_name ??
      selectedFieldOption?.field_name ??
      selectedMiddleLabel ??
      selectedLargeLabel ??
      "선택 분야")
    : undefined;
  const appliedProcurementFilters = [
    ...(selectedWorkType
      ? [{ key: "workType", label: workTypeLabel[selectedWorkType], onRemove: clearWorkType }]
      : []),
    ...(selectedLargeLabel
      ? [{ key: "large", label: selectedLargeLabel, onRemove: () => resetFieldTo("all") }]
      : []),
    ...(selectedMiddleLabel
      ? [{ key: "middle", label: selectedMiddleLabel, onRemove: () => resetFieldTo("large") }]
      : []),
    ...(selectedFieldLabel
      ? [{ key: "field", label: selectedFieldLabel, onRemove: () => resetFieldTo("middle") }]
      : []),
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index);
  const fieldPathLabel = [
    ...new Set(
      [selectedLargeLabel, selectedMiddleLabel, selectedFieldLabel].filter((label): label is string =>
        Boolean(label),
      ),
    ),
  ].join(" > ");
  const relationshipFilterLabel = [
    selectedWorkType ? (workTypeLabel[selectedWorkType] ?? selectedWorkType) : undefined,
    fieldPathLabel || undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  const summaryFilterLabel = relationshipFilterLabel ? `${relationshipFilterLabel} 기준` : "";
  const procurementConditionSummary = `${periodLabel} · ${
    selectedWorkType ? workTypeLabel[selectedWorkType] : "전체 업무"
  } · ${fieldPathLabel || "전체 분야"}`;
  const fieldInsight =
    insightFields.length > 0 && leadingFieldShare != null
      ? `계약금액의 ${(leadingFieldShare * 100).toFixed(1)}%가 상위 ${insightFields.length}개 분야에 집중되어 있습니다.`
      : `${periodLabel} ${summaryFilterLabel ? `${summaryFilterLabel} ` : ""}계약금액은 ${money(summary?.total_attributed_contract_amount)}입니다.`;
  const companyHref = (companyNumber: string, companyName?: string) =>
    entityDetailPath("company", companyNumber, {
      source: "relationship",
      params: searchParams,
      name: companyName,
    });
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
                      {tab === "companies" && (
                        <div>
                          <RelationshipTreemap
                            className="!mt-6"
                            title="계약업체 분포"
                            description="전체 계약금액 분포와 주요 업체의 규모를 함께 비교합니다."
                            counterpartType="company"
                            relationships={companyRelationships}
                            counterpartCount={
                              companyStructure?.contracted_company_count ?? summary?.company_count
                            }
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
                            relationshipDetailLoading={
                              companyRelationship.isFetching && Boolean(selectedCompany)
                            }
                            relationshipDetail={
                              selectedCompanyForSheet &&
                              companyRelationship.data &&
                              !companyRelationship.isFetching ? (
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
                                    companyRelationship.data.yearly_activity ??
                                    selectedCompanyForSheet.yearly_activity ??
                                    []
                                  }
                                  fields={
                                    companyRelationship.data.major_fields ??
                                    selectedCompanyForSheet.major_fields ??
                                    []
                                  }
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
                                <SectionError
                                  error={companyListQueryError}
                                  title="계약업체 목록"
                                  onRetry={retryCompanyList}
                                />
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
                                    key:
                                      company.company_number ??
                                      `${company.company_name ?? "unknown"}-${index}`,
                                    name: company.company_name ?? "업체명 미확인",
                                    amount: company.total_attributed_contract_amount,
                                    contractCount: company.contract_event_count,
                                    latestContractDate: company.latest_contract_date,
                                    badges: [
                                      ...(company.company_number &&
                                      majorSupplierNumbers.has(company.company_number)
                                        ? [{ label: "주요 업체", variant: "secondary" as const }]
                                        : []),
                                      ...(company.company_number &&
                                      newSupplierNumbers.has(company.company_number)
                                        ? [{ label: "신규 관측", variant: "outline" as const }]
                                        : []),
                                    ],
                                  }))}
                                  money={money}
                                  onSelect={(item) => {
                                    const company = displayedOverviewCompanies.find(
                                      (candidate, index) =>
                                        (candidate.company_number ??
                                          `${candidate.company_name ?? "unknown"}-${index}`) === item.key,
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
                                      ? Math.ceil(
                                          locallyFilteredCompanies.length / ENTITY_RELATIONSHIP_PAGE_SIZE,
                                        )
                                      : Math.ceil(
                                          (overviewCompanyListData?.pagination?.total_items ?? 0) /
                                            ENTITY_RELATIONSHIP_PAGE_SIZE,
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
                      )}
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
