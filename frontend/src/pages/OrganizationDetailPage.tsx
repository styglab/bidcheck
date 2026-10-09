import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Landmark, LoaderCircle, Search, X } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EntityTabs } from "@/components/common/entity-tabs";
import { ListPagination } from "@/components/common/list-pagination";
import { MetricHelp } from "@/components/common/metric-help";
import { ProcurementFilterPanel } from "@/components/procurement/procurement-filter-panel";
import { RelationshipAnalysis } from "@/components/procurement/relationship-analysis";
import { EntityDetailContentSkeleton, EntityDetailLayout } from "@/components/layout/entity-detail-layout";
import { EntityDetailHeader } from "@/components/layout/entity-detail-header";
import { PageError, SectionError } from "@/components/common/error-state";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableEmpty } from "@/components/ui/data-table";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RelationshipTreemap } from "@/features/relationships/RelationshipTreemap";
import { entityDetailPath } from "@/shared/navigation/entity-links";
import {
  procurementFieldIdentity as fieldIdentity,
  procurementFieldOptionLabel,
  procurementFieldSelection,
} from "@/shared/procurement/field-options";
import { formatCompactMoney as money } from "@/shared/format/money";
import {
  useOrganization,
  useOrganizationCompanyRelationship,
  useOrganizationProcurementActivity,
  useOrganizationProcurementProfile,
  useOrganizationSupplierEntries,
  type ProcurementActivity,
  type ProcurementActivityStage,
  type ProcurementRelationship,
  type SupplierEntryCompany,
} from "../features/organizations/api";

const count = (value?: number) =>
  value == null ? "-" : value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

const workTypeLabel: Record<string, string> = {
  goods: "물품",
  service: "용역",
  construction: "공사",
  foreign: "외자",
  other: "기타",
  unknown: "미분류",
};

const workTypeDotStyle: Record<string, string> = {
  goods: "bg-blue-900",
  service: "bg-blue-700",
  construction: "bg-blue-500",
  foreign: "bg-slate-600",
  other: "bg-slate-500",
  unknown: "bg-slate-400",
};

const contractMethodPalette = [
  "bg-blue-800 dark:bg-blue-500",
  "bg-sky-500 dark:bg-sky-600",
  "bg-slate-500 dark:bg-slate-600",
  "bg-slate-300 dark:bg-slate-700",
];

const supplierEntryRelationship = (company: SupplierEntryCompany): ProcurementRelationship => ({
  company_number: company.company_number,
  company_name: company.company_name,
  participation_count: 0,
  award_event_count: 0,
  contract_event_count: company.target_year_contract_count,
  total_attributed_contract_amount: company.target_year_attributed_contract_amount,
  amount_completeness: company.amount_completeness ?? "unknown",
  first_activity_date: company.target_year_first_contract_date,
  latest_activity_date: company.target_year_latest_contract_date,
  latest_contract_date: company.target_year_latest_contract_date,
  active_years: company.target_year_first_contract_date
    ? [Number(company.target_year_first_contract_date.slice(0, 4))]
    : [],
  active_year_count: company.target_year_first_contract_date ? 1 : 0,
  yearly_activity: [],
  major_fields: [],
  representative_notices: [],
});

function UpdatingOverlay({ show, label = "불러오는 중" }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-background/45 backdrop-blur-[1px]"
      role="status"
    >
      <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-sm">
        <LoaderCircle className="size-4 animate-spin text-[var(--brand)]" />
        {label}
      </span>
    </div>
  );
}

function ConditionUpdatingStatus({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center" role="status">
      <span className="inline-flex items-center gap-2 rounded-full border bg-background/95 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur">
        <LoaderCircle className="size-4 animate-spin text-[var(--brand)]" />
        조건 적용 중
      </span>
    </div>
  );
}

function ContractCompanyPicker({
  companies,
  label,
  contextParams,
}: {
  companies: Array<{
    business_registration_number?: string;
    company_name?: string;
    company_role_label?: string;
    share_percent?: number | null;
  }>;
  label: string;
  contextParams?: URLSearchParams;
}) {
  const available = companies.filter((company) => company.company_name);
  if (available.length <= 1) {
    const company = available[0];
    return company?.business_registration_number ? (
      <Link
        className="activity-company-link block truncate text-sm font-semibold"
        to={entityDetailPath("company", company.business_registration_number, {
          source: contextParams ? "relationship" : "notice",
          params: contextParams,
          name: company.company_name,
        })}
      >
        {company.company_name}
      </Link>
    ) : (
      <span className="block truncate text-sm font-medium">{company?.company_name ?? label}</span>
    );
  }
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="activity-company-link contract-company-picker-trigger inline-flex max-w-full items-center gap-1 rounded-sm text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
          type="button"
        >
          <strong className="truncate">{label}</strong>
          <ChevronDown className="size-3.5 shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="z-50 w-72 overflow-hidden rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg"
          collisionPadding={12}
          sideOffset={8}
        >
          <div className="border-b px-2 py-2">
            <strong className="block text-sm">계약 업체</strong>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              업체를 선택하면 상세로 이동합니다.
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto pt-1.5">
            {available.map((company, index) =>
              company.business_registration_number ? (
                <Popover.Close asChild key={`${company.business_registration_number}-${index}`}>
                  <Link
                    className="group flex items-center justify-between gap-3 rounded-lg px-2.5 py-2.5 hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none dark:hover:bg-blue-950/40"
                    to={entityDetailPath("company", company.business_registration_number, {
                      source: contextParams ? "relationship" : "notice",
                      params: contextParams,
                      name: company.company_name,
                    })}
                  >
                    <strong className="activity-company-link min-w-0 truncate text-sm">
                      {company.company_name}
                    </strong>
                    {company.share_percent != null && (
                      <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--brand)] group-hover:bg-white dark:bg-blue-950/50 dark:group-hover:bg-blue-950">
                        {company.share_percent}%
                      </span>
                    )}
                  </Link>
                </Popover.Close>
              ) : (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2.5"
                  key={`${company.company_name}-${index}`}
                >
                  <strong className="min-w-0 truncate text-sm">{company.company_name}</strong>
                  {company.share_percent != null && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {company.share_percent}%
                    </span>
                  )}
                </div>
              ),
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const noticeStatus: Record<string, { label: string; className: string }> = {
  scheduled: {
    label: "입찰 예정",
    className: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
  open: {
    label: "입찰 중",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  closed: {
    label: "입찰 마감",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  awarded: { label: "낙찰", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  contracted: {
    label: "계약",
    className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  },
  cancelled: { label: "취소", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  unknown: {
    label: "상태 확인",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
};

function procurementActivityView(item: ProcurementActivity) {
  const award = item.award;
  const contract = item.contract;
  const lead = contract?.lead_contractor ?? contract?.contractors?.[0];
  const contractCompanies = contract?.contractors?.length ? contract.contractors : lead ? [lead] : [];
  const additionalCount = Math.max(0, (contract?.contractor_count ?? contract?.contractors?.length ?? 0) - 1);
  const contractCompany = lead?.company_name
    ? `${lead.company_name}${additionalCount ? ` 외 ${additionalCount}개 업체` : ""}`
    : "계약 업체 미상";
  const styleKey =
    item.stage === "award"
      ? "awarded"
      : item.stage === "contract"
        ? "contracted"
        : item.stage === "failed_or_cancelled"
          ? "cancelled"
          : item.stage;
  const status = noticeStatus[styleKey] ?? noticeStatus.unknown;
  const projectAmount =
    item.project_amount ??
    item.notice?.display_amount ??
    item.notice?.allocated_budget ??
    item.notice?.estimated_price ??
    item.notice?.base_amount;
  const projectAmountBasis = item.project_amount_basis_name ?? item.notice?.display_amount_basis_name;
  const noticeDetail =
    item.stage === "scheduled"
      ? { label: "입찰 시작 전", dateLabel: "마감", date: item.notice?.deadline_at }
      : item.stage === "open"
        ? { label: "입찰 진행 중", dateLabel: "마감", date: item.notice?.deadline_at }
        : item.stage === "failed_or_cancelled"
          ? { label: "유찰·취소", dateLabel: "처리", date: item.latest_activity_date }
          : { label: "입찰 마감", dateLabel: "마감", date: item.notice?.deadline_at };
  const resultDate = contract?.contract_date ?? award?.award_date;
  const resultDateLabel = contract ? "계약" : award ? "낙찰" : noticeDetail.dateLabel;
  return {
    award,
    contract,
    contractCompanies,
    contractCompany,
    status,
    projectAmount,
    projectAmountBasis,
    noticeDetail,
    resultAmount: contract?.contract_amount ?? award?.winning_amount,
    resultDate: resultDate ?? noticeDetail.date,
    resultDateLabel,
  };
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
  const [overviewCompanySort, setOverviewCompanySort] = useState<
    "contract_amount_desc" | "contract_count_desc" | "latest_contract_desc"
  >("contract_amount_desc");
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
    tab === "notices" ? activityStage : "all",
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
  const [showAllFields, setShowAllFields] = useState(false);
  const hasCustomOverviewCompanyList =
    overviewCompanyPage !== 1 ||
    Boolean(overviewCompanyQuery) ||
    overviewCompanySort !== "contract_amount_desc";
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
      pageSize: 10,
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
  const displayedOverviewCompanies =
    overviewCompanyFilter === "major"
      ? companyRelationships.slice(0, 5)
      : overviewCompanyFilter === "new"
        ? newSupplierRelationships.slice((overviewCompanyPage - 1) * 10, overviewCompanyPage * 10)
        : overviewCompanyRelationships.slice(0, 10);
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
  const overviewFields = selectedFieldCode ? rankedFields : topFields;
  const overviewFieldMax = Math.max(
    1,
    ...overviewFields.map((field) => field.attributed_contract_amount ?? 0),
  );
  const insightFields = topFields.slice(0, 2);
  const leadingFieldAmount = insightFields.reduce(
    (total, field) => total + Math.max(0, field.attributed_contract_amount ?? 0),
    0,
  );
  const leadingFieldShare =
    (summary?.total_attributed_contract_amount ?? 0) > 0
      ? leadingFieldAmount / (summary?.total_attributed_contract_amount ?? 1)
      : undefined;
  const amountBasisLabel = summary?.amount_completeness === "complete" ? "계약금액" : "확인 가능한 계약금액";
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
  const activeTabConditionUpdating =
    tab === "notices"
      ? activity.isFetching
      : tab === "companies"
        ? isCompanyConditionUpdating
        : procurement.isFetching;
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
  const companyHref = (companyNumber: string, companyName?: string) =>
    entityDetailPath("company", companyNumber, {
      source: "relationship",
      params: searchParams,
      name: companyName,
    });
  if (organizationQuery.isLoading)
    return (
      <PageContainer className="max-w-6xl !pt-5 sm:!pt-7">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-8 h-40 rounded-xl" />
      </PageContainer>
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
      <section className="mt-5 overflow-hidden rounded-xl border bg-card" aria-label="조회 조건">
        <button
          aria-expanded={showProcurementFilters}
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
          onClick={() => setShowProcurementFilters((current) => !current)}
          type="button"
        >
          <span className="min-w-0">
            <span className="block text-xs font-medium text-muted-foreground">조회 조건</span>
            <strong className="mt-0.5 block truncate text-sm">
              {periodLabel} · {selectedWorkType ? workTypeLabel[selectedWorkType] : "전체 업무"} ·{" "}
              {fieldPathLabel || "전체 분야"}
            </strong>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">
            조건 변경
            <ChevronDown
              className={`size-4 transition-transform ${showProcurementFilters ? "rotate-180" : ""}`}
            />
          </span>
        </button>
        {showProcurementFilters && (
          <div className="border-t p-4 sm:p-5">
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
              isUpdating={isUpdating}
            />
          </div>
        )}
      </section>
      <article className="mt-5 rounded-2xl border bg-card p-5 sm:p-7">
        <EntityDetailHeader
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

        <>
          <EntityTabs
            value={tab}
            onChange={setTab}
            items={[
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
          />

          <div className="relative" aria-busy={activeTabConditionUpdating}>
            <ConditionUpdatingStatus show={activeTabConditionUpdating} />
            <div
              className={`transition-opacity ${activeTabConditionUpdating ? "pointer-events-none opacity-60" : "opacity-100"}`}
            >
              {tab === "overview" && (
                <section className="relative mt-8" aria-labelledby="procurement-summary-title">
                  <h2 className="text-lg font-bold tracking-tight" id="procurement-summary-title">
                    기관 한눈에 보기
                  </h2>
                  <p className="mt-3 border-l-4 border-primary bg-blue-50/55 px-4 py-3 text-sm leading-6 text-foreground dark:bg-blue-950/20">
                    {insightFields.length > 0 && leadingFieldShare != null
                      ? `${amountBasisLabel}의 ${(leadingFieldShare * 100).toFixed(1)}%가 ${insightFields
                          .map(
                            (field) =>
                              field.display_name ??
                              field.field_name ??
                              field.middle_category ??
                              field.large_category ??
                              "미분류",
                          )
                          .join("과 ")}에서 발생했습니다.`
                      : `${periodLabel} ${summaryFilterLabel ? `${summaryFilterLabel} ` : ""}${amountBasisLabel}은 ${money(summary?.total_attributed_contract_amount)}입니다.`}
                    {leadingContractCountMethod &&
                    leadingContractAmountMethod &&
                    leadingContractAmountShare != null
                      ? ` 계약 건수는 ${leadingContractCountMethod.method_name} 비중이 ${(leadingContractCountMethod.contract_share * 100).toFixed(1)}%이고, ${amountBasisLabel}은 ${leadingContractAmountMethod.method_name} 비중이 ${(leadingContractAmountShare * 100).toFixed(1)}%입니다.`
                      : ""}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
                    {[
                      ["계약금액", money(summary?.total_attributed_contract_amount), undefined],
                      ["계약", `${count(summary?.contract_event_count)}건`, undefined],
                      ["공고", `${count(summary?.notice_count)}건`, undefined],
                      ["계약업체", summary ? `${count(summary.company_count)}개` : "-", undefined],
                    ].map(([label, value, note]) => (
                      <div
                        className="border-b p-4 even:border-l [&:nth-child(n+3)]:border-b-0 lg:border-b-0 lg:border-l lg:first:border-l-0"
                        key={label}
                      >
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-1 text-xl font-bold">{value}</dd>
                        {note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                    <div>
                      <strong className="text-sm">현재 진행 공고 {count(openNoticeCount)}건</strong>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {openNoticeCount > 0
                          ? "이 기관에서 현재 접수 중인 사업을 확인해 보세요."
                          : "현재 접수 중인 공고가 없습니다."}
                      </p>
                    </div>
                    {openNoticeCount > 0 && (
                      <Button size="sm" variant="outline" onClick={openActiveNotices}>
                        공고 보기
                      </Button>
                    )}
                  </div>
                </section>
              )}

              {(tab === "overview" || tab === "companies") && (
                <section
                  className="organization-detail-analysis relative mt-8 grid gap-10 lg:grid-cols-2"
                  data-view={tab}
                >
                  <div className="lg:col-span-2">
                    <h2 className="text-xl font-bold tracking-tight">조달 구조</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      상단 조회 조건에 따라{" "}
                      {selectedWorkType ? "분야와 계약 방식별" : "업무구분과 분야, 계약 방식별"} 조달금액을
                      집계했습니다.
                    </p>
                  </div>
                  <div
                    className={`grid gap-8 lg:col-span-2 ${selectedWorkType ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"}`}
                  >
                    {!selectedWorkType && (
                      <div className="flex h-full flex-col">
                        <h3 className="text-base font-semibold">업무구분</h3>
                        <p className="mt-2 text-sm text-muted-foreground">계약금액과 계약 건수 구성입니다.</p>
                        <div className="mt-5 flex flex-1 flex-col rounded-2xl border bg-card p-5 lg:min-h-[22rem]">
                          <div
                            className="flex h-10 overflow-hidden rounded-xl bg-muted"
                            aria-label="계약금액 구성"
                          >
                            {sortedWorkTypeDistribution
                              .filter((item) => (item.attributed_contract_amount ?? 0) > 0)
                              .map((item) => {
                                const total = sortedWorkTypeDistribution.reduce(
                                  (sum, row) => sum + (row.attributed_contract_amount ?? 0),
                                  0,
                                );
                                const share = total
                                  ? ((item.attributed_contract_amount ?? 0) / total) * 100
                                  : 0;
                                return (
                                  <span
                                    className={`${workTypeDotStyle[item.work_type] ?? workTypeDotStyle.unknown} grid min-w-fit place-items-center px-3 text-xs font-semibold text-white`}
                                    key={item.work_type}
                                    style={{ width: `${share}%` }}
                                    title={`${item.work_type_name} ${share.toFixed(1)}%`}
                                  >
                                    {item.work_type_name} {share.toFixed(1)}%
                                  </span>
                                );
                              })}
                          </div>
                          <div className="mt-4 divide-y">
                            {sortedWorkTypeDistribution.map((item) => (
                              <div
                                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm"
                                key={item.work_type}
                              >
                                <span
                                  className={`size-2.5 shrink-0 rounded-full ${workTypeDotStyle[item.work_type] ?? workTypeDotStyle.unknown}`}
                                  aria-hidden="true"
                                />
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <strong>{item.work_type_name || workTypeLabel[item.work_type]}</strong>
                                  <span className="text-xs text-muted-foreground">
                                    계약 {count(item.contract_event_count)}건
                                  </span>
                                </div>
                                <strong className="text-right tabular-nums">
                                  {money(item.attributed_contract_amount)}
                                </strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex h-full flex-col">
                      <h3 className="text-base font-semibold">
                        {selectedLargeCategory ? "세부 분야" : "주요 분야"}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">계약금액이 큰 분야 순서입니다.</p>
                      <div
                        className={`mt-5 flex flex-col rounded-2xl border bg-card p-5 ${selectedWorkType ? "" : "flex-1 lg:min-h-[22rem]"}`}
                      >
                        {overviewFields.length > 0 && (
                          <div className="flex-1 divide-y">
                            {overviewFields.map((field, index) => (
                              <div
                                className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 py-4 text-sm sm:grid-cols-[1.5rem_minmax(8rem,14rem)_minmax(5rem,1fr)_auto]"
                                key={fieldIdentity(field)}
                              >
                                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                  {index + 1}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">
                                    {field.display_name ??
                                      field.field_name ??
                                      field.middle_category ??
                                      field.large_category ??
                                      "미분류"}
                                  </span>
                                  {field.work_types?.length ? (
                                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                      {field.work_types
                                        .map((workType) => workTypeLabel[workType] ?? workType)
                                        .join(" · ")}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="hidden h-2 overflow-hidden rounded-full bg-muted sm:block">
                                  <span
                                    className="block h-full rounded-full bg-blue-800 dark:bg-blue-500"
                                    style={{
                                      width: `${((field.attributed_contract_amount ?? 0) / overviewFieldMax) * 100}%`,
                                    }}
                                  />
                                </span>
                                <strong className="min-w-20 text-right tabular-nums sm:min-w-24">
                                  {money(field.attributed_contract_amount)}
                                </strong>
                              </div>
                            ))}
                          </div>
                        )}
                        {!overviewFields.length && (
                          <p className="py-5 text-center text-sm text-muted-foreground">
                            선택한 조건에서 분류된 조달 분야가 없습니다.
                          </p>
                        )}
                        {!selectedFieldCode && rankedFields.length > 3 && (
                          <div className="mt-4 border-t pt-4 text-right">
                            <Button size="sm" variant="ghost" onClick={() => setShowAllFields(true)}>
                              전체 {count(rankedFields.length)}개 보기
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex h-full flex-col">
                    <h3 className="text-base font-semibold">계약 방식</h3>
                    <p className="mt-1 text-sm text-muted-foreground">계약 건수와 금액 구성을 비교합니다.</p>
                    <div className="mt-4 flex-1 rounded-xl border bg-card p-5">
                      {[
                        { label: "계약 건수", kind: "count" as const },
                        { label: amountBasisLabel, kind: "amount" as const },
                      ].map(({ label, kind }) => (
                        <div className="mb-5 last:mb-0" key={kind}>
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                            <strong>{label}</strong>
                            {kind === "amount" && summary?.amount_completeness !== "complete" && (
                              <span className="text-muted-foreground">금액 누락 계약 제외</span>
                            )}
                          </div>
                          <div
                            className="flex h-8 overflow-hidden rounded-lg bg-muted"
                            aria-label={`${label} 비중`}
                          >
                            {visibleContractMethods.map((item, index) => {
                              const share =
                                kind === "count"
                                  ? item.contract_share
                                  : (item.amount_share ??
                                    (contractMethodAmountTotal > 0
                                      ? (item.attributed_contract_amount ?? 0) / contractMethodAmountTotal
                                      : 0));
                              return share > 0 ? (
                                <span
                                  className={`${contractMethodPalette[index % contractMethodPalette.length]} grid min-w-0 place-items-center px-1 text-[11px] font-semibold text-white`}
                                  key={item.method}
                                  style={{ width: `${share * 100}%` }}
                                  title={`${item.method_name} ${(share * 100).toFixed(1)}%`}
                                >
                                  {share >= 0.16 ? `${(share * 100).toFixed(1)}%` : ""}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </div>
                      ))}
                      <div className="mt-5 divide-y border-t">
                        {visibleContractMethods.map((item, index) => {
                          const amountShare =
                            item.amount_share ??
                            (contractMethodAmountTotal > 0
                              ? (item.attributed_contract_amount ?? 0) / contractMethodAmountTotal
                              : 0);
                          return (
                            <div
                              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2.5 text-xs"
                              key={item.method}
                            >
                              <span
                                className={`size-2.5 rounded-full ${contractMethodPalette[index % contractMethodPalette.length]}`}
                                aria-hidden="true"
                              />
                              <strong>{item.method_name}</strong>
                              <span className="text-right tabular-nums text-muted-foreground">
                                {count(item.contract_event_count)}건 {(item.contract_share * 100).toFixed(1)}%
                                ·{" "}
                                {item.attributed_contract_amount == null
                                  ? "금액 미확인"
                                  : `${money(item.attributed_contract_amount)} ${(amountShare * 100).toFixed(
                                      1,
                                    )}%`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {showAllFields && (
                    <div
                      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
                      role="dialog"
                      aria-modal="true"
                      aria-label="전체 조달 분야"
                      onClick={() => setShowAllFields(false)}
                    >
                      <div
                        className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl border bg-background shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-between border-b px-5 py-4">
                          <div>
                            <h2 className="text-lg font-bold">
                              전체 {selectedLargeCategory ? "세부 분야" : "분야"}
                            </h2>
                            <p className="mt-1 text-xs text-muted-foreground">계약금액이 큰 순서입니다.</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="닫기"
                            onClick={() => setShowAllFields(false)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                        <div className="max-h-[calc(80vh-5rem)] space-y-3 overflow-y-auto p-5">
                          {rankedFields.map((field, index) => {
                            const max = Math.max(1, rankedFields[0]?.attributed_contract_amount ?? 0);
                            return (
                              <div
                                className="grid w-full grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 text-left text-sm sm:grid-cols-[1.5rem_minmax(9rem,15rem)_1fr_auto]"
                                key={fieldIdentity(field)}
                              >
                                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                  {index + 1}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">
                                    {field.display_name ??
                                      field.field_name ??
                                      field.middle_category ??
                                      field.large_category ??
                                      "미분류"}
                                  </span>
                                  {field.work_types?.length ? (
                                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                      {field.work_types
                                        .map((workType) => workTypeLabel[workType] ?? workType)
                                        .join(" · ")}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="hidden h-2 overflow-hidden rounded-full bg-muted sm:block">
                                  <span
                                    className="block h-full rounded-full bg-blue-800 dark:bg-blue-500"
                                    style={{
                                      width: `${((field.attributed_contract_amount ?? 0) / max) * 100}%`,
                                    }}
                                  />
                                </span>
                                <strong className="min-w-24 text-right">
                                  {money(field.attributed_contract_amount)}
                                </strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex h-full flex-col">
                    <h2 className="text-base font-semibold">계약 추이</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      계약 건수는 최초 계약일 기준이며, 금액은 조회 종료일 현재의 최신 계약금액입니다.
                    </p>
                    <div className="mt-4 flex-1 space-y-4 rounded-xl border bg-card p-5">
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
                                {item.year}년{isCurrentYear && <Badge variant="outline">누적</Badge>}
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
                                className={`block h-full rounded-full ${isCurrentYear ? "bg-blue-500/70 dark:bg-blue-600/80" : "bg-blue-800 dark:bg-blue-500"}`}
                                style={{ width: `${((item.attributed_contract_amount ?? 0) / max) * 100}%` }}
                              />
                            </span>
                          </div>
                        );
                      })}
                      {visibleYearlyActivity.some((item) => item.year === currentYear) && (
                        <p className="border-t pt-3 text-[11px] text-muted-foreground">
                          {currentYear}년은{" "}
                          {procurement.data?.analysis_basis.period_to?.slice(0, 10) ?? "현재"}까지의 누적
                          실적이며, 이전 연도는 완료 연도입니다.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="supplier-analysis border-t pt-10 lg:col-span-2">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight">
                        {tab === "overview" ? "계약업체 구조" : "계약업체 분석"}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {tab === "overview"
                          ? "계약금액이 여러 업체에 어떻게 분포하는지 요약합니다."
                          : "계약금액 분포를 비교하고 개별 업체의 계약 관계를 확인합니다."}
                      </p>
                    </div>
                    <div className="mt-5 grid overflow-hidden rounded-xl border bg-card sm:grid-cols-3">
                      <div className="border-b p-4 sm:border-b-0 sm:border-r">
                        <span className="text-xs text-muted-foreground">선택 기간 계약업체</span>
                        <strong className="mt-1 block text-2xl">
                          {count(companyStructure?.contracted_company_count ?? summary?.company_count)}개
                        </strong>
                      </div>
                      <div className="border-b p-4 sm:border-b-0 sm:border-r">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          선택 기간 상위 5개 집중도
                          <MetricHelp label="상위 5개 업체 집중도 계산 기준">
                            <strong className="mb-1 block text-foreground">계산 기준</strong>선택한 기간의
                            전체 계약금액 중 계약금액 상위 5개 업체가 차지하는 비율입니다.
                            {Boolean(companyStructure?.excluded_contract_event_count) && (
                              <span className="mt-2 block text-[11px] text-muted-foreground">
                                업체별 귀속금액을 확인할 수 없는 계약{" "}
                                {count(companyStructure?.excluded_contract_event_count)}건은 계산에서
                                제외했습니다.
                              </span>
                            )}
                            {companyStructure?.small_supplier_population && (
                              <span className="mt-2 block text-[11px] text-muted-foreground">
                                계약 업체가 5개 이하이면 집중도가 100%로 표시될 수 있습니다.
                              </span>
                            )}
                          </MetricHelp>
                        </span>
                        <strong className="mt-1 block text-2xl">
                          {companyStructure?.concentration_computable === false
                            ? "산출 불가"
                            : `${((companyStructure?.top_5_company_amount_share ?? 0) * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`}
                        </strong>
                      </div>
                      <div className="p-4">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {supplierEntry?.target_year ?? fiscalEndYear}년 신규 관측 업체 비중
                          <MetricHelp label="신규 업체 비중 계산 기준">
                            <strong className="mb-1 block text-foreground">계산 기준</strong>조회 종료 연도에
                            계약한 업체 중 직전 3개 연도 동안 이 기관과 계약하지 않은 신규 관측 업체의
                            비율입니다.
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
                              </span>
                            )}
                          </MetricHelp>
                        </span>
                        <strong className="mt-1 block text-2xl">
                          {supplierEntry
                            ? supplierEntry.total_company_count > 0
                              ? `${(supplierEntry.first_observed_company_rate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`
                              : "산출 불가"
                            : "데이터 없음"}
                        </strong>
                        {supplierEntry?.total_company_count === 0 && (
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            해당 기간에 계약 업체가 없습니다.
                          </span>
                        )}
                      </div>
                    </div>
                    {tab === "overview" && (
                      <div className="mt-5 rounded-2xl border bg-card p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm">전체 계약금액 분포</strong>
                          <span className="text-xs text-muted-foreground">선택 기간·분야 기준</span>
                        </div>
                        {companyStructure?.concentration_computable !== false && companyAmountTotal > 0 ? (
                          <>
                            <div
                              className="mt-4 flex h-9 overflow-hidden rounded-lg bg-muted"
                              aria-label="계약업체별 계약금액 분포 요약"
                            >
                              {[
                                ["상위 5개", topFiveCompanyShare, "bg-blue-800 dark:bg-blue-500"],
                                [
                                  loadedCompanyCount > 5 ? `6–${loadedCompanyCount}위` : "6위 이하",
                                  middleCompanyShare,
                                  "bg-blue-400 dark:bg-blue-700",
                                ],
                                [
                                  remainingCompanyCount > 0
                                    ? `나머지 ${count(remainingCompanyCount)}개`
                                    : "나머지",
                                  remainingCompanyShare,
                                  "bg-slate-300 dark:bg-slate-700",
                                ],
                              ].map(([label, ratio, className]) =>
                                typeof ratio === "number" && ratio > 0 ? (
                                  <span
                                    className={`grid min-w-0 place-items-center px-2 text-xs font-semibold ${className} ${String(label).startsWith("나머지") ? "text-slate-700 dark:text-slate-200" : "text-white"}`}
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
                            <p className="mt-4 rounded-lg bg-muted/35 px-3 py-2.5 text-sm leading-6">
                              상위 {count(loadedCompanyCount)}개 업체가 {amountBasisLabel}의{" "}
                              <strong>{(loadedCompanyShare * 100).toFixed(1)}%</strong>를 차지합니다.
                              {remainingCompanyCount > 0
                                ? ` 나머지 ${count(remainingCompanyCount)}개 업체의 비중은 ${(remainingCompanyShare * 100).toFixed(1)}%입니다.`
                                : ""}
                            </p>
                          </>
                        ) : (
                          <p className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                            업체별 귀속 계약금액이 충분하지 않아 금액 분포를 산출할 수 없습니다.
                          </p>
                        )}
                        <div className="mt-5 border-t pt-4 text-right">
                          <Button onClick={() => setTab("companies")}>계약업체 자세히 보기</Button>
                        </div>
                      </div>
                    )}
                    {tab === "companies" && (
                      <div>
                        <RelationshipTreemap
                          title="계약업체 분포"
                          description="주요 계약업체의 상대적 규모와 전체 계약금액 분포를 확인합니다."
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
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold">계약업체 목록</h3>
                              <p className="mt-1 text-sm text-muted-foreground">
                                업체를 선택하면 계약 규모와 주요 계약을 먼저 확인할 수 있습니다.
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 rounded-xl border bg-muted/20 p-4">
                            <div className="flex flex-wrap gap-2" aria-label="계약업체 필터">
                              {(
                                [
                                  ["all", "전체"],
                                  ["major", "주요 계약업체 (상위 5)"],
                                  ["new", `${supplierEntry?.target_year ?? fiscalEndYear}년 신규 관측`],
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
                            {overviewCompanyFilter === "all" && (
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
                                      aria-label="전체 업체 검색 초기화"
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
                                    setOverviewCompanySort(value as typeof overviewCompanySort);
                                    setOverviewCompanyPage(1);
                                  }}
                                >
                                  <SelectTrigger aria-label="전체 업체 정렬" className="h-8 w-full">
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
                            )}
                          </div>
                          <div className="relative mt-4 min-h-40">
                            {!isAnalysisUpdating &&
                              (overviewCompanyListQuery.isFetching ||
                                (overviewCompanyFilter === "new" && supplierEntries.isFetching)) && (
                                <UpdatingOverlay show label="계약업체 조회 중" />
                              )}
                            <div className="divide-y overflow-hidden rounded-2xl border bg-card md:hidden">
                              {displayedOverviewCompanies.map((company, index) => (
                                <button
                                  className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 p-4 text-left text-sm transition-colors hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none"
                                  key={company.company_number ?? `${company.company_name}-${index}`}
                                  onClick={() => setOverviewSelectedSupplier(company)}
                                  type="button"
                                >
                                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                    {overviewCompanyFilter === "major"
                                      ? index + 1
                                      : (overviewCompanyPage - 1) * 10 + index + 1}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium">
                                      {company.company_name ?? "업체명 미확인"}
                                    </span>
                                    <span className="mt-1 flex flex-wrap gap-1">
                                      {company.company_number &&
                                        majorSupplierNumbers.has(company.company_number) && (
                                          <Badge variant="secondary">주요 업체</Badge>
                                        )}
                                      {company.company_number &&
                                        newSupplierNumbers.has(company.company_number) && (
                                          <Badge variant="outline">신규 관측</Badge>
                                        )}
                                    </span>
                                    <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                                      계약 {count(company.contract_event_count)}건
                                      {company.latest_contract_date
                                        ? ` · 최근 ${company.latest_contract_date.slice(0, 10)}`
                                        : ""}
                                    </span>
                                  </span>
                                  <strong className="min-w-24 text-right tabular-nums">
                                    {company.total_attributed_contract_amount == null
                                      ? "금액 미확인"
                                      : money(company.total_attributed_contract_amount)}
                                  </strong>
                                </button>
                              ))}
                              {!displayedOverviewCompanies.length && (
                                <p className="p-8 text-center text-sm text-muted-foreground">
                                  표시할 계약업체가 없습니다.
                                </p>
                              )}
                            </div>
                            <DataTable className="hidden md:block" minWidth={720}>
                              <thead>
                                <tr>
                                  <th className="w-14">순위</th>
                                  <th>계약업체</th>
                                  <th className="text-right">계약 건수</th>
                                  <th className="text-right">최근 계약</th>
                                  <th className="text-right">귀속 계약금액</th>
                                </tr>
                              </thead>
                              <tbody>
                                {displayedOverviewCompanies.map((company, index) => (
                                  <tr key={company.company_number ?? `${company.company_name}-${index}`}>
                                    <td className="text-muted-foreground">
                                      {overviewCompanyFilter === "major"
                                        ? index + 1
                                        : (overviewCompanyPage - 1) * 10 + index + 1}
                                    </td>
                                    <td>
                                      <button
                                        className="inline-flex max-w-full items-center gap-2 text-left font-medium hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        onClick={() => setOverviewSelectedSupplier(company)}
                                        type="button"
                                      >
                                        <span className="truncate">
                                          {company.company_name ?? "업체명 미확인"}
                                        </span>
                                        {company.company_number &&
                                          majorSupplierNumbers.has(company.company_number) && (
                                            <Badge variant="secondary">주요 업체</Badge>
                                          )}
                                        {company.company_number &&
                                          newSupplierNumbers.has(company.company_number) && (
                                            <Badge variant="outline">신규 관측</Badge>
                                          )}
                                      </button>
                                    </td>
                                    <td className="text-right">{count(company.contract_event_count)}건</td>
                                    <td className="text-right text-muted-foreground">
                                      {company.latest_contract_date?.slice(0, 10) ?? "-"}
                                    </td>
                                    <td className="text-right font-semibold">
                                      {company.total_attributed_contract_amount == null
                                        ? "금액 미확인"
                                        : money(company.total_attributed_contract_amount)}
                                    </td>
                                  </tr>
                                ))}
                                {!displayedOverviewCompanies.length && (
                                  <DataTableEmpty colSpan={5}>표시할 계약업체가 없습니다.</DataTableEmpty>
                                )}
                              </tbody>
                            </DataTable>
                          </div>
                          {overviewCompanyFilter !== "major" && (
                            <ListPagination
                              page={overviewCompanyPage}
                              totalPages={
                                overviewCompanyFilter === "new"
                                  ? Math.ceil(newSupplierRelationships.length / 10)
                                  : Math.ceil((overviewCompanyListData?.pagination?.total_items ?? 0) / 10)
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
                  </div>
                </section>
              )}

              {tab === "notices" && (
                <section className="relative mt-8">
                  <div className="mb-5">
                    <h2 className="text-xl font-bold tracking-tight">공고·계약 조회</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      이 기관의 발주부터 낙찰·계약까지 {periodLabel}의 전체 조달 이력을 확인합니다.
                    </p>
                  </div>
                  {quarterDistribution.length > 0 && (
                    <div className="mb-5 rounded-xl border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm">분기별 공고 게시 비중</strong>
                        <span className="text-xs text-muted-foreground">{periodLabel}</span>
                      </div>
                      <div className="mt-3 flex h-7 overflow-hidden rounded-md bg-muted">
                        {quarterDistribution.map((item, index) => (
                          <span
                            className="grid min-w-fit place-items-center bg-primary px-2 text-[11px] font-semibold text-primary-foreground"
                            key={item.quarter}
                            style={{
                              width: `${item.notice_share * 100}%`,
                              opacity: 1 - index * 0.14,
                            }}
                            title={`${item.quarter}분기 ${(item.notice_share * 100).toFixed(1)}% · ${count(item.notice_count)}건`}
                          >
                            {item.notice_share >= 0.16 ? `${item.quarter}분기` : ""}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {quarterDistribution.map((item) => (
                          <span key={item.quarter}>
                            {item.quarter}분기{" "}
                            <strong className="text-foreground">{count(item.notice_count)}건</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mb-5 rounded-xl border bg-muted/20 p-4">
                    <form className="flex max-w-2xl gap-2" onSubmit={submitListSearch}>
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-9 pr-9"
                          disabled={activity.isFetching}
                          onChange={(event) => setListSearch(event.target.value)}
                          placeholder="공고명·업체명 검색"
                          value={listSearch}
                        />
                        {listSearch && (
                          <Button
                            aria-label="검색 초기화"
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                            onClick={clearListSearch}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                      <Button disabled={activity.isFetching} type="submit">
                        검색
                      </Button>
                    </form>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="공고 상태 필터">
                      {(
                        [
                          ["all", "전체"],
                          ["scheduled", "예정"],
                          ["open", "진행 중"],
                          ["closed", "마감"],
                          ["award", "낙찰"],
                          ["contract", "계약"],
                          ["failed_or_cancelled", "유찰·취소"],
                        ] as Array<[ProcurementActivityStage, string]>
                      ).map(([value, label]) => (
                        <FilterChip
                          selected={activityStage === value}
                          disabled={activity.isFetching}
                          key={value}
                          onClick={() => setActivityStage(value)}
                        >
                          {label}{" "}
                          <span
                            className={activityStage === value ? "text-blue-100" : "text-muted-foreground"}
                          >
                            {count(activity.data?.stage_counts?.[value])}
                          </span>
                        </FilterChip>
                      ))}
                    </div>
                  </div>
                  {activity.isLoading && <Skeleton className="h-48 rounded-xl" />}
                  {activity.isError && (
                    <p className="rounded-xl border p-5 text-sm text-muted-foreground">
                      공고 정보를 불러오지 못했습니다.
                    </p>
                  )}
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <strong className="text-sm">
                      {activityStage === "all"
                        ? "전체 공고·계약"
                        : `${noticeStatus[activityStage]?.label ?? "선택 결과"}`}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {count(activity.data?.pagination.total_items)}건
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border bg-card md:hidden">
                    {(activity.data?.items ?? []).map((item) => {
                      const {
                        award,
                        contract,
                        contractCompanies,
                        contractCompany,
                        status,
                        projectAmount,
                        projectAmountBasis,
                        noticeDetail,
                      } = procurementActivityView(item);
                      return (
                        <article
                          className="grid border-b transition-colors last:border-b-0 hover:bg-muted/30 md:grid-cols-[minmax(0,1.85fr)_minmax(19rem,1fr)]"
                          key={item.activity_id}
                        >
                          <div className="min-w-0 p-4">
                            <div className="flex min-w-0 items-start gap-2">
                              <Badge className={`mt-0.5 shrink-0 border-0 text-[10px] ${status.className}`}>
                                {item.stage_name ?? status.label}
                              </Badge>
                              {item.bid_notice_id ? (
                                <Link
                                  className="activity-notice-link line-clamp-2 min-w-0 flex-1 rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 md:line-clamp-1"
                                  title={item.notice_name}
                                  to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}
                                >
                                  {item.notice_name ?? "공고명 미상"}
                                </Link>
                              ) : (
                                <strong
                                  className="line-clamp-2 min-w-0 flex-1 text-sm md:line-clamp-1"
                                  title={item.notice_name}
                                >
                                  {item.notice_name ?? "계약명 미상"}
                                </strong>
                              )}
                              {item.notice_linkage === "unlinked" && (
                                <span className="shrink-0 text-[11px] text-muted-foreground">
                                  공고 미연결
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span className="truncate">{item.organization_name ?? organization?.name}</span>
                              <span>·</span>
                              <span className="shrink-0">
                                {(item.notice?.published_at ?? item.latest_activity_date)?.slice(0, 10) ??
                                  "일자 미상"}
                              </span>
                              {item.work_type && (
                                <>
                                  <span>·</span>
                                  <span>{workTypeLabel[item.work_type] ?? item.work_type}</span>
                                </>
                              )}
                              {projectAmount != null && (
                                <>
                                  <span>·</span>
                                  <span
                                    className="shrink-0 font-medium tabular-nums text-foreground"
                                    title={projectAmountBasis}
                                  >
                                    {money(projectAmount)}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          <div className="flex min-w-0 items-center justify-between gap-3 border-t bg-muted/[0.12] px-4 py-3 md:border-l md:border-t-0">
                            {award || contract ? (
                              <>
                                <div className="min-w-0">
                                  {contract ? (
                                    <ContractCompanyPicker
                                      companies={contractCompanies}
                                      label={contractCompany}
                                      contextParams={searchParams}
                                    />
                                  ) : award?.winner_business_registration_number ? (
                                    <Link
                                      className="activity-company-link block truncate text-sm font-semibold"
                                      to={companyHref(
                                        award.winner_business_registration_number,
                                        award.winner_name,
                                      )}
                                    >
                                      {award.winner_name ?? "업체명 미상"}
                                    </Link>
                                  ) : (
                                    <span className="block truncate text-sm font-medium">
                                      {award?.winner_name ?? "업체명 미상"}
                                    </span>
                                  )}
                                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                    {contract ? "계약 업체" : "낙찰 업체"}
                                  </span>
                                </div>
                                <span className="shrink-0 text-right">
                                  <strong className="block text-sm tabular-nums">
                                    {money(contract?.contract_amount ?? award?.winning_amount)}
                                  </strong>
                                  <span className="text-[11px] text-muted-foreground">
                                    {contract?.contract_date ?? award?.award_date ?? "일자 미상"}
                                  </span>
                                </span>
                              </>
                            ) : (
                              <>
                                <strong className="min-w-0 truncate text-sm">{noticeDetail.label}</strong>
                                <span className="shrink-0 text-right">
                                  <span className="block text-[11px] text-muted-foreground">
                                    {noticeDetail.dateLabel}
                                  </span>
                                  <strong className="block text-sm tabular-nums">
                                    {noticeDetail.date?.slice(0, 10) ?? "일자 미상"}
                                  </strong>
                                </span>
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })}
                    {!activity.isLoading && (activity.data?.items ?? []).length === 0 && (
                      <p className="p-8 text-center text-sm text-muted-foreground">
                        선택한 조건에 해당하는 공고가 없습니다.
                      </p>
                    )}
                  </div>
                  <DataTable className="hidden md:block" minWidth={840}>
                    <thead>
                      <tr>
                        <th className="w-20">상태</th>
                        <th>공고·사업명</th>
                        <th className="text-right">사업금액</th>
                        <th>업체·결과</th>
                        <th className="text-right">주요 일자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activity.data?.items ?? []).map((item) => {
                        const {
                          award,
                          contract,
                          contractCompanies,
                          contractCompany,
                          status,
                          projectAmount,
                          projectAmountBasis,
                          resultAmount,
                          resultDate,
                          resultDateLabel,
                        } = procurementActivityView(item);
                        return (
                          <tr key={item.activity_id}>
                            <td>
                              <Badge className={`border-0 text-[10px] ${status.className}`}>
                                {item.stage_name ?? status.label}
                              </Badge>
                            </td>
                            <td className="max-w-96">
                              {item.bid_notice_id ? (
                                <Link
                                  className="line-clamp-2 font-medium hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  title={item.notice_name}
                                  to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}
                                >
                                  {item.notice_name ?? "공고명 미상"}
                                </Link>
                              ) : (
                                <strong className="line-clamp-2 font-medium" title={item.notice_name}>
                                  {item.notice_name ?? "계약명 미상"}
                                </strong>
                              )}
                              <span className="mt-1 block text-[11px] text-muted-foreground">
                                {item.work_type
                                  ? `${workTypeLabel[item.work_type] ?? item.work_type} · `
                                  : ""}
                                {item.notice?.published_at
                                  ? `게시 ${item.notice.published_at.slice(0, 10)}`
                                  : `최근 ${item.latest_activity_date?.slice(0, 10) ?? "일자 미상"}`}
                                {item.notice_linkage === "unlinked" ? " · 공고 미연결" : ""}
                              </span>
                            </td>
                            <td className="text-right font-medium" title={projectAmountBasis}>
                              {projectAmount == null ? "—" : money(projectAmount)}
                            </td>
                            <td className="max-w-56">
                              <div className="min-w-0">
                                {contract ? (
                                  <ContractCompanyPicker
                                    companies={contractCompanies}
                                    label={contractCompany}
                                    contextParams={searchParams}
                                  />
                                ) : award?.winner_business_registration_number ? (
                                  <Link
                                    className="block truncate font-medium hover:text-primary"
                                    to={companyHref(
                                      award.winner_business_registration_number,
                                      award.winner_name,
                                    )}
                                  >
                                    {award.winner_name ?? "업체명 미상"}
                                  </Link>
                                ) : award?.winner_name ? (
                                  <span className="block truncate">{award.winner_name}</span>
                                ) : (
                                  <span>—</span>
                                )}
                                {resultAmount != null && (
                                  <span className="mt-1 block text-[11px] font-medium tabular-nums text-muted-foreground">
                                    결과 {money(resultAmount)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-right">
                              <span className="block text-[11px] text-muted-foreground">
                                {resultDateLabel}
                              </span>
                              <span className="font-medium tabular-nums">
                                {resultDate?.slice(0, 10) ?? "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {!activity.isLoading && (activity.data?.items ?? []).length === 0 && (
                        <DataTableEmpty colSpan={5}>선택한 조건에 해당하는 공고가 없습니다.</DataTableEmpty>
                      )}
                    </tbody>
                  </DataTable>
                  <ListPagination
                    loading={activity.isFetching}
                    page={listPage}
                    totalPages={activity.data?.pagination.total_pages}
                    onChange={setListPage}
                  />
                </section>
              )}
            </div>
          </div>
        </>
      </article>
    </EntityDetailLayout>
  );
}
