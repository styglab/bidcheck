import { participationCollectionLabel, participationSuccessRate } from "./participation-presentation";
import { procurementWorkTypeLabels as workTypeLabels } from "@/shared/procurement/presentation";
import { integerParam, yearRange } from "@/shared/navigation/search-params";

import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ENTITY_RELATIONSHIP_PAGE_SIZE } from "@/components/common/entity-relationship-list";

import { entityDetailPath } from "@/shared/navigation/entity-links";

import {
  procurementFieldIdentity,
  procurementFieldOptionLabel,
  procurementFieldSelection,
} from "@/shared/procurement/field-options";
import { formatCompactMoney as money } from "@/shared/format/money";

import { useOrganizationCompanyRelationship } from "@/features/organizations/api";
import {
  useCompanyActivity,
  useCompanyCompetitors,
  useCompanyDetailContext,
  useCompanyProcurementProfile,
  useCompanyProfile,
} from "@/features/company-context/api";

export function useCompanyDetailPage() {
  const { businessNumber } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const currentYear = new Date().getUTCFullYear();
  const earliestYear = 2022;
  const { from: fromYear, to: toYear } = yearRange(params, currentYear, earliestYear);
  const workType = params.get("workType") ?? "";
  const largeCategory = params.get("large") ?? "";
  const middleCategory = params.get("middle") ?? "";
  const fieldCode = params.get("field") ?? "";
  const participationPage = integerParam(params.get("participationPage"), 1);
  const participationQuery = params.get("participationQ") ?? "";
  const organizationPage = integerParam(params.get("organizationPage"), 1);
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
  const requestedTab = params.get("tab");
  const tab =
    requestedTab === "participations" || requestedTab === "organizations" || requestedTab === "companyInfo"
      ? requestedTab
      : "relationships";
  const query = useCompanyProfile(businessNumber, tab === "companyInfo");
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
  const participationSummary = procurement.data?.participation_analysis?.summary;
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
  const successRateLabel = participationSuccessRate(participationSummary);
  const participationInsight =
    participationSummary?.participation_count != null
      ? `관측 참여 ${participationSummary.participation_count.toLocaleString("ko-KR")}건 · 그중 낙찰 ${participationSummary.observed_award_count.toLocaleString("ko-KR")}건${successRateLabel ? ` · 관측 성공률 ${successRateLabel}` : ""}`
      : "";
  const independentAwards =
    participationSummary && participationSummary.independent_award_event_count > 0
      ? ` · 별도 낙찰 ${participationSummary.independent_award_event_count.toLocaleString("ko-KR")}건`
      : "";
  const overviewInsight = `${periodLabel} ${participationInsight}${participationInsight ? " · " : ""}${participationCollectionLabel(participationSummary)}${independentAwards} · 계약금액 ${money(summary?.total_attributed_contract_amount)}`;

  return {
    businessNumber,
    params,
    setParams,
    currentYear,
    earliestYear,
    fromYear,
    toYear,
    workType,
    participationPage,
    participationQuery,
    organizationPage,
    organizationSearch,
    setOrganizationSearch,
    participationSearch,
    setParticipationSearch,
    organizationListFilter,
    setOrganizationListFilter,
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
    organizationProcurement,
    competitors,
    overviewOrganizationRelationships,
    contractedOrganizations,
    displayedOrganizations,
    selectedOrganization,
    organizationRelationship,
    summary,
    participationSummary,
    organizationEntry,
    overviewContractedOrganizations,
    organizationAmountTotal,
    topFiveOrganizationShare,
    middleOrganizationShare,
    remainingOrganizationShare,
    remainingOrganizationCount,
    selectedFieldValue,
    selectedFieldText,
    visibleFieldOptions,
    periodLabel,
    setPeriod,
    selectField,
    organizationHref,
    selectOrganization,
    submitOrganizationSearch,
    clearOrganizationSearch,
    submitParticipationSearch,
    clearParticipationSearch,
    openSelectedOrganizationNotices,
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
  };
}
