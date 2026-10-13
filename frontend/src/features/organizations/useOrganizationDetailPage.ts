import { integerParam, yearRange } from "@/shared/navigation/search-params";

import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ENTITY_RELATIONSHIP_PAGE_SIZE } from "@/components/common/entity-relationship-list";

import {
  filterAndSortCompanyRelationships,
  formatMonthDay as monthDay,
  procurementWorkTypeLabel as workTypeLabel,
  supplierEntryToRelationship as supplierEntryRelationship,
  type ProcurementCompanySort,
} from "@/features/organizations/procurement-presentation";
import { entityDetailPath } from "@/shared/navigation/entity-links";
import { procurementFieldSelection } from "@/shared/procurement/field-options";
import { formatCompactMoney as money } from "@/shared/format/money";

import {
  useOrganization,
  useOrganizationCompanyRelationship,
  useOrganizationProcurementActivity,
  useOrganizationProcurementProfile,
  useOrganizationSupplierEntries,
  type ProcurementActivityStage,
  type ProcurementRelationship,
} from "@/features/organizations/api";

export function useOrganizationDetailPage() {
  const { organizationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentYear = new Date().getUTCFullYear();
  const earliestYear = 2022;
  const legacyPeriod = Number(searchParams.get("period") ?? 5);
  const { from: fiscalStartYear, to: fiscalEndYear } = yearRange(
    searchParams,
    currentYear,
    earliestYear,
    legacyPeriod === 1 || legacyPeriod === 3 ? legacyPeriod : 5,
  );
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
      : requestedTab === "companies" || requestedTab === "notices"
        ? requestedTab
        : "overview";
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
  const listPage = integerParam(searchParams.get("page"), 1);
  const listQuery = searchParams.get("q") ?? "";
  const requestedStage = searchParams.get("stage") ?? "all";
  const activityStage: ProcurementActivityStage = [
    "all",
    "scheduled",
    "open",
    "closed",
    "award",
    "contract",
    "failed",
    "cancelled",
  ].includes(requestedStage)
    ? (requestedStage as ProcurementActivityStage)
    : "all";
  const [overviewCompanyPage, setOverviewCompanyPage] = useState(1);
  const [overviewCompanyQuery, setOverviewCompanyQuery] = useState("");
  const [overviewCompanySearch, setOverviewCompanySearch] = useState("");
  const [overviewCompanySort, setOverviewCompanySort] =
    useState<ProcurementCompanySort>("contract_amount_desc");
  const [overviewCompanyFilter, setOverviewCompanyFilter] = useState<"all" | "major" | "new">("all");
  const [supplierSelection, setSupplierSelection] = useState<{
    organizationId?: string;
    value?: ProcurementRelationship;
  }>({ organizationId });
  const overviewSelectedSupplier =
    supplierSelection.organizationId === organizationId ? supplierSelection.value : undefined;
  const setOverviewSelectedSupplier = (value: ProcurementRelationship | undefined) =>
    setSupplierSelection({ organizationId, value });
  const [showProcurementFilters, setShowProcurementFilters] = useState(false);
  const organizationQuery = useOrganization(organizationId);
  const activity = useOrganizationProcurementActivity(
    organizationId,
    tab === "overview" || tab === "notices",
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
      pageSize: 30,
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
    tab === "companies" && overviewCompanyFilter === "new",
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
    () =>
      new Set([
        ...(supplierEntries.data?.items ?? []).map((company) => company.company_number),
        ...companyRelationships
          .filter((company) => company.supplier_entry?.entry_status === "first_observed")
          .map((company) => company.company_number),
      ]),
    [supplierEntries.data?.items, companyRelationships],
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
  return {
    organizationId,
    searchParams,
    setSearchParams,
    currentYear,
    earliestYear,
    fiscalStartYear,
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
    showProcurementFilters,
    setShowProcurementFilters,
    organizationQuery,
    activity,
    procurement,
    supplierEntries,
    legacySelectedCompanyNumber,
    listSearch,
    setListSearch,
    overviewCompanyListQuery,
    organization,
    companyRelationships,
    overviewCompanyListData,
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
    newSupplierNumbers,
    majorSupplierNumbers,
    locallyFilteredCompanies,
    displayedOverviewCompanies,
    companyListQueryError,
    companyListHasError,
    retryCompanyList,
    isAnalysisUpdating,
    sortedWorkTypeDistribution,
    fieldDistribution,
    rankedFields,
    overviewFields,
    contractMethodInsight,
    appliedField,
    isSingleLevelField,
    selectedCompany,
    companyRelationship,
    selectedCompanyForSheet,
    visibleYearlyActivity,
    contractedCompanyCount,
    loadedCompanyCount,
    remainingCompanyCount,
    openNoticeCount,
    openNoticePreview,
    currentYearPeriodEnd,
    activeTabConditionUpdating,
    activeTabConditionError,
    retryActiveTabConditions,
    visibleRelationshipEvents,
    setTab,
    setListPage,
    setActivityStage,
    submitListSearch,
    clearListSearch,
    resetActivityView,
    submitOverviewCompanySearch,
    clearOverviewCompanySearch,
    resetCompanyListView,
    openSelectedCompanyNotices,
    openActiveNotices,
    setPeriodRange,
    selectField,
    setWorkType,
    resetFilters,
    appliedProcurementFilters,
    relationshipFilterLabel,
    procurementConditionSummary,
    fieldInsight,
    companyHref,
  };
}
