import * as Popover from "@radix-ui/react-popover";
import { ArrowUpRight, ChevronDown, CircleHelp, Landmark, LoaderCircle, Search, X } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EntityTabs } from "@/components/common/entity-tabs";
import { ListPagination } from "@/components/common/list-pagination";
import { ProcurementFilterPanel } from "@/components/procurement/procurement-filter-panel";
import { RelationshipAnalysis } from "@/components/procurement/relationship-analysis";
import { EntityDetailContentSkeleton, EntityDetailLayout } from "@/components/layout/entity-detail-layout";
import { PageError, SectionError } from "@/components/common/error-state";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { entityDetailPath } from "@/shared/navigation/entity-links";
import { procurementFieldIdentity as fieldIdentity, procurementFieldOptionLabel, procurementFieldSelection } from "@/shared/procurement/field-options";
import { formatCompactMoney as money } from "@/shared/format/money";
import {
  useOrganization,
  useOrganizationCompanyRelationship,
  useOrganizationProcurementActivity,
  useOrganizationProcurementProfile,
  useOrganizationSupplierEntries,
  type ProcurementActivity,
  type ProcurementActivityStage,
} from "../features/organizations/api";

const count = (value?: number) => value == null ? "-" : value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

const workTypeLabel: Record<string, string> = {
  goods: "물품", service: "용역", construction: "공사", foreign: "외자", other: "기타", unknown: "미분류",
};

const workTypeStyle: Record<string, string> = {
  goods: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  service: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  construction: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  foreign: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  other: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  unknown: "bg-muted text-muted-foreground",
};

function UpdatingOverlay({ show, label = "불러오는 중" }: { show: boolean; label?: string }) {
  if (!show) return null;
  return <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-background/45 backdrop-blur-[1px]" role="status"><span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-sm"><LoaderCircle className="size-4 animate-spin text-[var(--brand)]" />{label}</span></div>;
}

function MetricHelp({ label, children }: { label: string; children: React.ReactNode }) {
  return <button className="group relative inline-flex rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={label} type="button"><CircleHelp className="size-3.5" aria-hidden="true" /><span className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden w-64 rounded-xl border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-lg group-hover:block group-focus:block">{children}</span></button>;
}

function ContractCompanyPicker({ companies, label, contextParams }: { companies: Array<{ business_registration_number?: string; company_name?: string; company_role_label?: string; share_percent?: number | null }>; label: string; contextParams?: URLSearchParams }) {
  const available = companies.filter((company) => company.company_name);
  if (available.length <= 1) {
    const company = available[0];
    return company?.business_registration_number
      ? <Link className="activity-company-link block truncate text-sm font-semibold" to={entityDetailPath("company", company.business_registration_number, { source: contextParams ? "relationship" : "notice", params: contextParams, name: company.company_name })}>{company.company_name}</Link>
      : <span className="block truncate text-sm font-medium">{company?.company_name ?? label}</span>;
  }
  return <Popover.Root>
    <Popover.Trigger asChild>
      <button className="activity-company-link contract-company-picker-trigger inline-flex max-w-full items-center gap-1 rounded-sm text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2" type="button">
        <strong className="truncate">{label}</strong><ChevronDown className="size-3.5 shrink-0" />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="start" className="z-50 w-72 overflow-hidden rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg" collisionPadding={12} sideOffset={8}>
        <div className="border-b px-2 py-2">
          <strong className="block text-sm">계약 업체</strong>
          <span className="mt-0.5 block text-xs text-muted-foreground">업체를 선택하면 상세로 이동합니다.</span>
        </div>
        <div className="max-h-64 overflow-y-auto pt-1.5">
          {available.map((company, index) => company.business_registration_number
            ? <Popover.Close asChild key={`${company.business_registration_number}-${index}`}><Link className="group flex items-center justify-between gap-3 rounded-lg px-2.5 py-2.5 hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none dark:hover:bg-blue-950/40" to={entityDetailPath("company", company.business_registration_number, { source: contextParams ? "relationship" : "notice", params: contextParams, name: company.company_name })}><strong className="activity-company-link min-w-0 truncate text-sm">{company.company_name}</strong>{company.share_percent != null && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--brand)] group-hover:bg-white dark:bg-blue-950/50 dark:group-hover:bg-blue-950">{company.share_percent}%</span>}</Link></Popover.Close>
            : <div className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2.5" key={`${company.company_name}-${index}`}><strong className="min-w-0 truncate text-sm">{company.company_name}</strong>{company.share_percent != null && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{company.share_percent}%</span>}</div>)}
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

const noticeStatus: Record<string, { label: string; className: string }> = {
  scheduled: { label: "입찰 예정", className: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
  open: { label: "입찰 중", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  closed: { label: "입찰 마감", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  awarded: { label: "낙찰", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  contracted: { label: "계약", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" },
  cancelled: { label: "취소", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  unknown: { label: "상태 확인", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
};

function ProcurementActivityRow({ item, organizationName }: { item: ProcurementActivity; organizationName?: string }) {
  const award = item.award;
  const contract = item.contract;
  const lead = contract?.lead_contractor ?? contract?.contractors?.[0];
  const contractCompanies = contract?.contractors?.length ? contract.contractors : lead ? [lead] : [];
  const additionalCount = Math.max(0, (contract?.contractor_count ?? contract?.contractors?.length ?? 0) - 1);
  const contractCompany = lead?.company_name ? `${lead.company_name}${additionalCount ? ` 외 ${additionalCount}개 업체` : ""}` : "계약 업체 미상";
  const styleKey = item.stage === "award" ? "awarded" : item.stage === "contract" ? "contracted" : item.stage === "failed_or_cancelled" ? "cancelled" : item.stage;
  const status = noticeStatus[styleKey] ?? noticeStatus.unknown;
  const projectAmount = item.project_amount ?? item.notice?.display_amount ?? item.notice?.allocated_budget ?? item.notice?.estimated_price ?? item.notice?.base_amount;
  const projectAmountBasis = item.project_amount_basis_name ?? item.notice?.display_amount_basis_name;
  const noticeDetail = item.stage === "scheduled"
    ? { label: "입찰 시작 전", dateLabel: "마감", date: item.notice?.deadline_at }
    : item.stage === "open"
      ? { label: "입찰 진행 중", dateLabel: "마감", date: item.notice?.deadline_at }
      : item.stage === "failed_or_cancelled"
        ? { label: "유찰·취소", dateLabel: "처리일", date: item.latest_activity_date }
        : { label: "입찰 마감", dateLabel: "마감", date: item.notice?.deadline_at };

  return <article className="grid border-b transition-colors last:border-b-0 hover:bg-blue-50/60 dark:hover:bg-blue-950/20 md:grid-cols-[minmax(0,1.85fr)_minmax(19rem,1fr)]">
    <div className="min-w-0 p-4">
      <div className="flex min-w-0 items-start gap-2"><Badge className={`mt-0.5 shrink-0 border-0 text-[10px] ${status.className}`}>{item.stage_name ?? status.label}</Badge>{item.bid_notice_id ? <Link className="activity-notice-link line-clamp-2 min-w-0 flex-1 rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 md:line-clamp-1" title={item.notice_name} to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}>{item.notice_name ?? "공고명 미상"}</Link> : <strong className="line-clamp-2 min-w-0 flex-1 text-sm md:line-clamp-1" title={item.notice_name}>{item.notice_name ?? "계약명 미상"}</strong>}{item.notice_linkage === "unlinked" && <span className="shrink-0 text-[11px] text-muted-foreground">공고 미연결</span>}</div>
      <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span className="truncate">{item.organization_name ?? organizationName}</span><span>·</span><span className="shrink-0">{(item.notice?.published_at ?? item.latest_activity_date)?.slice(0, 10) ?? "일자 미상"}</span>{item.work_type && <><span>·</span><span>{workTypeLabel[item.work_type] ?? item.work_type}</span></>}{projectAmount != null && <><span>·</span><span className="shrink-0 font-medium tabular-nums text-foreground" title={projectAmountBasis}>{money(projectAmount)}</span></>}</p>
    </div>
    <div className="flex min-w-0 items-center justify-between gap-3 border-t bg-muted/[0.12] px-4 py-3 md:border-l md:border-t-0">
      {(award || contract) ? <><div className="min-w-0">{contract ? <ContractCompanyPicker companies={contractCompanies} label={contractCompany} /> : award?.winner_business_registration_number ? <Link className="activity-company-link block truncate text-sm font-semibold" to={`/companies/${encodeURIComponent(award.winner_business_registration_number)}`}>{award.winner_name ?? "업체명 미상"}</Link> : <span className="block truncate text-sm font-medium">{award?.winner_name ?? "업체명 미상"}</span>}<span className="mt-0.5 block text-[11px] text-muted-foreground">{contract ? "계약 업체" : "낙찰 업체"}</span></div><span className="shrink-0 text-right"><strong className="block text-sm tabular-nums">{money(contract?.contract_amount ?? award?.winning_amount)}</strong><span className="text-[11px] text-muted-foreground">{contract?.contract_date ?? award?.award_date ?? "일자 미상"}</span></span></> : <><strong className="min-w-0 truncate text-sm">{noticeDetail.label}</strong><span className="shrink-0 text-right"><span className="block text-[11px] text-muted-foreground">{noticeDetail.dateLabel}</span><strong className="block text-sm tabular-nums">{noticeDetail.date?.slice(0, 10) ?? "일자 미상"}</strong></span></>}
    </div>
  </article>;
}

export function OrganizationDetailPage() {
  const { organizationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentYear = new Date().getUTCFullYear();
  const earliestYear = 2022;
  const legacyPeriod = Number(searchParams.get("period") ?? 5);
  const requestedFromYear = Number(searchParams.get("fromYear") ?? currentYear - (legacyPeriod === 1 || legacyPeriod === 3 ? legacyPeriod : 5) + 1);
  const requestedToYear = Number(searchParams.get("toYear") ?? currentYear);
  const fiscalStartYear = Math.max(earliestYear, Math.min(requestedFromYear, currentYear));
  const fiscalEndYear = Math.max(fiscalStartYear, Math.min(requestedToYear, currentYear));
  const periodYears = fiscalEndYear - fiscalStartYear + 1;
  const periodLabel = fiscalStartYear === fiscalEndYear ? `${fiscalStartYear}년` : `${fiscalStartYear}–${fiscalEndYear}년`;
  const periodRange = { from: fiscalStartYear, to: fiscalEndYear };
  const [draftPeriod, setDraftPeriod] = useState([fiscalStartYear, fiscalEndYear]);
  useEffect(() => setDraftPeriod([fiscalStartYear, fiscalEndYear]), [fiscalStartYear, fiscalEndYear]);
  const requestedTab = searchParams.get("tab") ?? "overview";
  const tab = requestedTab === "awards" || requestedTab === "contracts" || requestedTab === "outcomes" ? "notices" : requestedTab;
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
  const activityStage: ProcurementActivityStage = ["all", "scheduled", "open", "closed", "award", "contract", "failed_or_cancelled"].includes(requestedStage) ? requestedStage as ProcurementActivityStage : "all";
  const companyQuery = searchParams.get("companyQ") ?? "";
  const organizationQuery = useOrganization(organizationId);
  const activity = useOrganizationProcurementActivity(organizationId, true, periodRange, tab === "notices" ? listPage : 1, tab === "notices" ? listQuery || undefined : undefined, tab === "notices" ? activityStage : "all", {
    largeCategory: selectedLargeCategory, middleCategory: selectedMiddleCategory, fieldCode: selectedFieldCode, workType: selectedWorkType,
  });
  const procurement = useOrganizationProcurementProfile(organizationId, periodYears, {
    largeCategory: selectedLargeCategory,
    middleCategory: selectedMiddleCategory,
    fieldCode: selectedFieldCode,
    workType: selectedWorkType,
  }, true, periodRange, { page: 1, query: tab === "companies" ? companyQuery || undefined : undefined, sort: "contract_amount_desc" });
  const supplierEntries = useOrganizationSupplierEntries(organizationId, fiscalEndYear, {
    largeCategory: selectedLargeCategory, middleCategory: selectedMiddleCategory, fieldCode: selectedFieldCode, workType: selectedWorkType,
  }, tab === "overview");
  const overallProcurement = useOrganizationProcurementProfile(organizationId, periodYears, {}, Boolean(selectedWorkType), periodRange);
  const selectedCompanyNumber = searchParams.get("company") ?? undefined;
  const [companySearch, setCompanySearch] = useState(companyQuery);
  useEffect(() => setCompanySearch(companyQuery), [companyQuery]);
  const [listSearch, setListSearch] = useState(listQuery);
  const [showAllFields, setShowAllFields] = useState(false);
  const organization = organizationQuery.data?.organization;
  const companyRelationships = (procurement.data?.company_relationships ?? []).filter((item) => item.contract_event_count > 0);
  const summary = procurement.data?.summary;
  const supplierEntry = summary?.supplier_entry ?? procurement.data?.supplier_entry;
  const quarterDistribution = procurement.data?.notice_quarter_distribution ?? [];
  const contractMethodDistribution = procurement.data?.contract_method_distribution ?? [];
  const companyStructure = procurement.data?.company_structure;
  const isUpdating = procurement.isFetching && Boolean(procurement.data);
  const workTypeDistribution = useMemo(
    () => (selectedWorkType ? overallProcurement.data?.work_type_distribution : procurement.data?.work_type_distribution) ?? procurement.data?.work_type_distribution ?? [],
    [overallProcurement.data?.work_type_distribution, procurement.data?.work_type_distribution, selectedWorkType],
  );
  const sortedWorkTypeDistribution = useMemo(
    () => [...workTypeDistribution].sort((left, right) => (right.attributed_contract_amount ?? 0) - (left.attributed_contract_amount ?? 0)),
    [workTypeDistribution],
  );
  const fieldDistribution = useMemo(
    () => procurement.data?.field_distribution ?? [],
    [procurement.data?.field_distribution],
  );
  const rankedFields = useMemo(
    () => [...fieldDistribution]
      .filter((field) => (field.attributed_contract_amount ?? 0) > 0)
      .sort((left, right) => (right.attributed_contract_amount ?? 0) - (left.attributed_contract_amount ?? 0)),
    [fieldDistribution],
  );
  const topFields = rankedFields.slice(0, 5);
  const appliedField = procurement.data?.analysis_basis?.field_filter;
  const isSingleLevelField = Boolean(
    selectedLargeCategory &&
    (selectedLargeCategory === "미분류" || (
      !selectedMiddleCategory &&
      !selectedFieldCode &&
      fieldDistribution.length > 0 &&
      fieldDistribution.every((field) => !field.middle_category) &&
      fieldDistribution.some((field) => field.field_code)
    )),
  );
  const selectedCompany = companyRelationships.find((item) => item.company_number === selectedCompanyNumber);
  const companyRelationship = useOrganizationCompanyRelationship(
    organizationId,
    selectedCompanyNumber,
    1,
    periodYears,
    { largeCategory: selectedLargeCategory, middleCategory: selectedMiddleCategory, fieldCode: selectedFieldCode, workType: selectedWorkType },
    tab === "companies",
    periodRange,
  );
  const filteredCompanies = companyRelationships;
  const defaultCompanyNumber = filteredCompanies[0]?.company_number;
  useEffect(() => {
    if (tab !== "companies" || selectedCompanyNumber || procurement.isFetching || !defaultCompanyNumber) return;
    const next = new URLSearchParams(searchParams);
    next.set("company", defaultCompanyNumber);
    setSearchParams(next, { replace: true });
  }, [defaultCompanyNumber, procurement.isFetching, searchParams, selectedCompanyNumber, setSearchParams, tab]);
  const visibleYearlyActivity = [...(procurement.data?.yearly_activity ?? [])]
    .sort((left, right) => right.year - left.year)
    .slice(0, 5)
    .sort((left, right) => left.year - right.year);
  const visibleRelationshipEvents = useMemo(
    () =>
      (companyRelationship.data?.events ?? []).filter((event) => {
        const value = event.attribution_date ?? event.notice_published_date ?? event.first_contract_date ?? event.contract_date ?? event.award_date;
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
    if (page <= 1) next.delete("page"); else next.set("page", String(page));
    setSearchParams(next);
  };
  const setActivityStage = (stage: ProcurementActivityStage) => {
    const next = new URLSearchParams(searchParams);
    if (stage === "all") next.delete("stage"); else next.set("stage", stage);
    next.delete("page");
    setSearchParams(next);
  };
  const openActivityStage = (stage: ProcurementActivityStage) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "notices");
    if (stage === "all") next.delete("stage"); else next.set("stage", stage);
    next.delete("page");
    next.delete("q");
    setListSearch("");
    setSearchParams(next);
  };
  const openCompanyList = () => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "companies");
    next.delete("company");
    next.delete("companyQ");
    setCompanySearch("");
    setSearchParams(next);
  };
  const submitListSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    const value = listSearch.trim();
    if (value) next.set("q", value); else next.delete("q");
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
  const submitCompanySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    const value = companySearch.trim();
    if (value) next.set("companyQ", value); else next.delete("companyQ");
    next.delete("company");
    setSearchParams(next);
  };
  const clearCompanySearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("companyQ");
    next.delete("company");
    setCompanySearch("");
    setSearchParams(next);
  };
  const selectCompany = (companyNumber: string, nextTab = tab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    if (selectedCompanyNumber === companyNumber && nextTab === tab) next.delete("company");
    else next.set("company", companyNumber);
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
    if (value === "all") next.delete("workType"); else next.set("workType", value);
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
    ["period", "fromYear", "toYear", "workType", "large", "middle", "field", "company", "page", "companyQ"].forEach((key) => next.delete(key));
    setSearchParams(next);
  };
  const selectedLargeLabel = selectedLargeCategory ? (appliedField?.large_category ?? selectedLargeCategory) : undefined;
  const selectedMiddleLabel = selectedMiddleCategory ? (appliedField?.middle_category ?? selectedMiddleCategory) : undefined;
  const selectedFieldOption = selectedFieldCode ? fieldDistribution.find((field) => field.selection_filter?.field_code === selectedFieldCode || field.field_code === selectedFieldCode || field.display_code === selectedFieldCode) : undefined;
  const selectedFieldLabel = selectedFieldCode ? (appliedField?.field_name ?? selectedFieldOption?.display_name ?? selectedFieldOption?.field_name ?? selectedMiddleLabel ?? selectedLargeLabel ?? "선택 분야") : undefined;
  const appliedProcurementFilters = [
    ...(selectedWorkType ? [{ key: "workType", label: workTypeLabel[selectedWorkType], onRemove: clearWorkType }] : []),
    ...(selectedLargeLabel ? [{ key: "large", label: selectedLargeLabel, onRemove: () => resetFieldTo("all") }] : []),
    ...(selectedMiddleLabel ? [{ key: "middle", label: selectedMiddleLabel, onRemove: () => resetFieldTo("large") }] : []),
    ...(selectedFieldLabel ? [{ key: "field", label: selectedFieldLabel, onRemove: () => resetFieldTo("middle") }] : []),
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index);
  const fieldPathLabel = [...new Set([selectedLargeLabel, selectedMiddleLabel, selectedFieldLabel].filter((label): label is string => Boolean(label)))].join(" > ");
  const relationshipFilterLabel = [
    selectedWorkType ? workTypeLabel[selectedWorkType] ?? selectedWorkType : undefined,
    fieldPathLabel || undefined,
  ].filter(Boolean).join(" · ");
  const companyHref = (companyNumber: string, companyName?: string) => entityDetailPath("company", companyNumber, { source: "relationship", params: searchParams, name: companyName });
  if (organizationQuery.isLoading)
    return (
      <PageContainer className="max-w-6xl !pt-5 sm:!pt-7">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-8 h-40 rounded-xl" />
      </PageContainer>
    );
  if (organizationQuery.isError)
    return <PageError error={organizationQuery.error} entity="기관 정보" onRetry={() => organizationQuery.refetch()} />;

  return (
    <EntityDetailLayout fallbackTo="/organizations" surface={false}>
      <ProcurementFilterPanel earliestYear={earliestYear} currentYear={currentYear} period={draftPeriod} onPeriodChange={setDraftPeriod} onPeriodCommit={setPeriodRange} workTypeValue={selectedWorkType ?? "all"} workTypeOptions={[{ value: "all", label: "전체" }, ...Object.entries(workTypeLabel).map(([value, label]) => ({ value, label }))]} onWorkTypeChange={setWorkType} fieldValue="current" fieldOptions={[{ value: "current", label: selectedFieldCode ? appliedField?.field_name ?? "선택 분야" : isSingleLevelField ? appliedField?.large_category ?? "선택 분야" : selectedLargeCategory ? "세부 분야 선택" : "분야 선택" }, ...[...fieldDistribution].sort((left, right) => (right.attributed_contract_amount ?? 0) - (left.attributed_contract_amount ?? 0)).map((field) => ({ value: fieldIdentity(field), label: procurementFieldOptionLabel(field, money, workTypeLabel) })).filter((option) => Boolean(option.value))]} fieldDisabled={Boolean(selectedFieldCode || isSingleLevelField)} onFieldChange={(value) => { const field = fieldDistribution.find((item) => fieldIdentity(item) === value); if (field) selectField(field); }} appliedFilters={appliedProcurementFilters} onReset={resetFilters} isUpdating={isUpdating} />
      <article className="mt-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
      <header className="border-b pb-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <Landmark className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge className="border-0 bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-200">기관</Badge><span>{organization?.jurisdiction_type ?? "기관 유형 미상"} · 기관코드 {organizationId}</span></div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{organization?.name}</h1>
          </div>
        </div>
      </header>

      {procurement.isLoading && !procurement.data && (
        <EntityDetailContentSkeleton />
      )}
      {procurement.isError && !procurement.data && (
        <div className="mt-6"><SectionError error={procurement.error} title="조달 현황" onRetry={() => procurement.refetch()} /></div>
      )}

      <>
          <EntityTabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "overview", label: "개요" },
              { id: "notices", label: "공고", count: activity.data?.stage_counts?.all ?? activity.data?.pagination.total_items },
              { id: "companies", label: "계약 업체", count: summary?.company_count },
            ]}
          />

          {tab === "overview" && <section className={`relative mt-8 transition-opacity ${isUpdating ? "opacity-60" : "opacity-100"}`} aria-busy={isUpdating} aria-labelledby="procurement-summary-title">
            <UpdatingOverlay show={isUpdating} label="조건 적용 중" />
            <h2 className="text-xl font-bold tracking-tight" id="procurement-summary-title">조달 현황</h2>
            <p className="mt-2 text-sm text-muted-foreground">선택한 기간의 조달 규모입니다.</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["계약금액", money(summary?.total_attributed_contract_amount), undefined],
                ["계약", `${count(summary?.contract_event_count)}건`, undefined],
                ["공고", `${count(summary?.notice_count)}건`, undefined],
                ["계약 업체", summary ? `${count(summary.company_count)}개` : "-", undefined],
              ].map(([label, value, note]) => <div className="rounded-xl bg-muted/50 p-4" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-bold">{value}</dd>{note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}</div>)}
            </dl>
          </section>}

          {tab === "overview" && (
            <section className={`relative mt-8 grid gap-10 transition-opacity lg:grid-cols-2 ${isUpdating ? "pointer-events-none opacity-60" : "opacity-100"}`} aria-busy={isUpdating}>
              <UpdatingOverlay show={isUpdating} label="조건 적용 중" />
              <div className="grid gap-8 lg:col-span-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="flex h-full flex-col">
                <h2 className="text-xl font-bold tracking-tight">조달 유형</h2>
                <p className="mt-2 text-sm text-muted-foreground">항목을 선택하면 해당 유형만 볼 수 있습니다.</p>
                <div className="mt-5 flex flex-1 flex-col rounded-2xl border bg-card p-5 lg:min-h-[22rem]">
                <div className="flex h-10 overflow-hidden rounded-xl bg-muted" aria-label="계약금액 구성">
                  {sortedWorkTypeDistribution.filter((item) => (item.attributed_contract_amount ?? 0) > 0).map((item) => { const total = sortedWorkTypeDistribution.reduce((sum, row) => sum + (row.attributed_contract_amount ?? 0), 0); const share = total ? ((item.attributed_contract_amount ?? 0) / total) * 100 : 0; const selected = selectedWorkType === item.work_type; return <button aria-pressed={selected} className={`${item.work_type === "goods" ? "bg-blue-600" : item.work_type === "construction" ? "bg-amber-500" : item.work_type === "service" ? "bg-violet-600" : "bg-slate-500"} min-w-fit px-3 text-xs font-semibold text-white ${selected ? "ring-2 ring-[var(--brand)] ring-inset dark:ring-blue-300" : ""}`} key={item.work_type} onClick={() => setWorkType(selected ? "all" : item.work_type)} style={{ width: `${share}%` }} title={selected ? `${item.work_type_name} 선택 해제` : `${item.work_type_name} ${share.toFixed(1)}%`} type="button">{item.work_type_name} {share.toFixed(1)}%</button>; })}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {sortedWorkTypeDistribution.map((item) => { const selected = selectedWorkType === item.work_type; return (
                    <button aria-pressed={selected} className={`w-full rounded-xl border p-4 text-left transition-all ${selected ? "border-[var(--brand)] bg-blue-50/70 ring-1 ring-[var(--brand)] dark:border-blue-300 dark:bg-blue-950/25 dark:ring-blue-300" : "border-transparent bg-muted/35 hover:border-border hover:bg-muted/60"}`} key={item.work_type} onClick={() => setWorkType(selected ? "all" : item.work_type)} type="button">
                      <div className="flex items-center justify-between gap-3"><span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${workTypeStyle[item.work_type] ?? workTypeStyle.unknown}`}>{item.work_type_name || workTypeLabel[item.work_type]}</span><strong className="text-lg">{money(item.attributed_contract_amount)}</strong></div>
                      <p className="mt-1 text-xs text-muted-foreground">계약 {count(item.contract_event_count)}건</p>
                    </button>
                  ); })}
                </div>
                </div>
              </div>

              <div className="flex h-full flex-col">
                <h2 className="text-xl font-bold tracking-tight">{selectedLargeCategory ? "세부 분야" : "주요 분야"}</h2>
                <p className="mt-2 text-sm text-muted-foreground">항목을 선택하면 해당 분야만 볼 수 있습니다.</p>
                <div className="mt-5 flex flex-1 flex-col rounded-2xl border bg-card p-5 lg:min-h-[22rem]">
                  {selectedFieldCode && <div className="grid flex-1 gap-3" style={{ gridTemplateRows: `repeat(${Math.max(fieldDistribution.length, 1)}, minmax(0, 1fr))` }}>{fieldDistribution.map((field) => { const max = Math.max(1, ...fieldDistribution.map((item) => item.attributed_contract_amount ?? 0)); return <div className="grid h-full w-full grid-cols-[minmax(9rem,15rem)_1fr_auto] items-center gap-3 rounded-lg px-1 text-sm" key={fieldIdentity(field)}><span className="flex min-w-0 items-center gap-2">{field.work_types?.map((workType) => <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${workTypeStyle[workType] ?? workTypeStyle.unknown}`} key={workType}>{workTypeLabel[workType] ?? workType}</span>)}<span className="truncate font-medium">{field.display_name ?? field.field_name ?? field.middle_category ?? field.large_category ?? "미분류"}</span></span><span className="h-2.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-800 dark:bg-blue-500" style={{ width: `${((field.attributed_contract_amount ?? 0) / max) * 100}%` }} /></span><strong className="min-w-24 text-right">{money(field.attributed_contract_amount)}</strong></div>; })}</div>}
                  {!selectedFieldCode && <div className="grid flex-1 gap-3" style={{ gridTemplateRows: `repeat(${Math.max(topFields.length, 1)}, minmax(0, 1fr))` }}>{topFields.map((field) => { const max = Math.max(1, ...topFields.map((item) => item.attributed_contract_amount ?? 0)); return <button className={`grid h-full w-full grid-cols-[minmax(9rem,15rem)_1fr_auto] items-center gap-3 rounded-lg px-1 text-left text-sm hover:bg-muted/35 ${isSingleLevelField ? "cursor-default" : ""}`} key={fieldIdentity(field)} onClick={() => selectField(field)} type="button"><span className="flex min-w-0 items-center gap-2">{field.work_types?.map((workType) => <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${workTypeStyle[workType] ?? workTypeStyle.unknown}`} key={workType}>{workTypeLabel[workType] ?? workType}</span>)}<span className="truncate font-medium hover:text-blue-800 dark:hover:text-blue-400">{field.display_name ?? field.field_name ?? field.middle_category ?? field.large_category ?? "미분류"}</span></span><span className="h-2.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-800 dark:bg-blue-500" style={{ width: `${((field.attributed_contract_amount ?? 0) / max) * 100}%` }} /></span><strong className="min-w-24 text-right">{money(field.attributed_contract_amount)}</strong></button>; })}</div>}
                  {!topFields.length && <p className="py-5 text-center text-sm text-muted-foreground">선택한 조건에서 분류된 조달 분야가 없습니다.</p>}
                  {!selectedFieldCode && rankedFields.length > 5 && <div className="mt-4 border-t pt-4 text-right"><Button size="sm" variant="ghost" onClick={() => setShowAllFields(true)}>전체 {count(rankedFields.length)}개 보기</Button></div>}
                </div>
              </div>
              </div>

              {showAllFields && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="전체 조달 분야" onClick={() => setShowAllFields(false)}><div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl border bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="text-lg font-bold">전체 {selectedLargeCategory ? "세부 분야" : "분야"}</h2><p className="mt-1 text-xs text-muted-foreground">계약금액이 큰 순서입니다.</p></div><Button size="icon" variant="ghost" aria-label="닫기" onClick={() => setShowAllFields(false)}><X className="size-4" /></Button></div><div className="max-h-[calc(80vh-5rem)] space-y-3 overflow-y-auto p-5">{rankedFields.map((field) => { const max = Math.max(1, rankedFields[0]?.attributed_contract_amount ?? 0); return <button className="grid w-full grid-cols-[minmax(9rem,15rem)_1fr_auto] items-center gap-3 text-left text-sm" key={fieldIdentity(field)} onClick={() => { selectField(field); setShowAllFields(false); }} type="button"><span className="flex min-w-0 items-center gap-2">{field.work_types?.map((workType) => <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${workTypeStyle[workType] ?? workTypeStyle.unknown}`} key={workType}>{workTypeLabel[workType] ?? workType}</span>)}<span className="truncate font-medium hover:text-blue-800 dark:hover:text-blue-400">{field.display_name ?? field.field_name ?? field.middle_category ?? field.large_category ?? "미분류"}</span></span><span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-800 dark:bg-blue-500" style={{ width: `${((field.attributed_contract_amount ?? 0) / max) * 100}%` }} /></span><strong className="min-w-24 text-right">{money(field.attributed_contract_amount)}</strong></button>; })}</div></div></div>}

              <div className="lg:col-span-2">
                <h2 className="text-xl font-bold tracking-tight">계약 추이</h2>
                <div className="mt-5 space-y-4 rounded-2xl border bg-card p-5">
                  {visibleYearlyActivity.map((item, index) => {
                    const max = Math.max(1, ...visibleYearlyActivity.map((row) => row.attributed_contract_amount ?? 0));
                    const previous = visibleYearlyActivity[index - 1]?.attributed_contract_amount;
                    const isCurrentYear = item.year === new Date().getUTCFullYear();
                    const growth = previous && !isCurrentYear ? (((item.attributed_contract_amount ?? 0) - previous) / previous) * 100 : undefined;
                    return (
                      <div key={item.year}>
                        <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                          <span className="font-medium">{item.year}년{isCurrentYear ? " 누적" : ""}</span>
                          <span className="text-right"><strong>{money(item.attributed_contract_amount)}</strong><span className="ml-2 text-xs text-muted-foreground">계약 {count(item.contract_event_count)}건{growth != null ? ` · 금액 전년 대비 ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%` : ""}</span></span>
                        </div>
                        <span className="block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-800 dark:bg-blue-500" style={{ width: `${((item.attributed_contract_amount ?? 0) / max) * 100}%` }} /></span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex h-full flex-col">
                <h2 className="text-xl font-bold tracking-tight">발주 시기</h2>
                <p className="mt-2 text-sm text-muted-foreground">공고 게시 시점을 기준으로 한 분기별 비중입니다.</p>
                <div className="mt-5 flex-1 rounded-2xl border bg-card p-5">
                  <div className="flex h-9 overflow-hidden rounded-lg bg-muted">{quarterDistribution.map((item) => <span className="grid min-w-fit place-items-center bg-blue-800 px-2 text-xs font-semibold text-white dark:bg-blue-500" key={item.quarter} style={{ width: `${item.notice_share * 100}%`, opacity: 0.45 + item.notice_share * 0.9 }}>{item.quarter}분기</span>)}</div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">{quarterDistribution.map((item) => <div key={item.quarter}><strong className="block text-sm">{(item.notice_share * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%</strong><span className="text-[11px] text-muted-foreground">{count(item.notice_count)}건</span></div>)}</div>
                  {!quarterDistribution.length && <p className="text-sm text-muted-foreground">분기별 공고 데이터가 없습니다.</p>}
                </div>
              </div>

              <div className="flex h-full flex-col">
                <h2 className="text-xl font-bold tracking-tight">계약 방식</h2>
                <p className="mt-2 text-sm text-muted-foreground">계약 건수 기준 구성입니다.</p>
                <div className="mt-5 flex-1 overflow-hidden rounded-2xl border bg-card">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground"><span>계약 방식</span><span className="min-w-24 text-right">계약 건수</span><span className="min-w-24 text-right">계약금액</span></div>
                  {contractMethodDistribution.filter((item) => item.contract_event_count > 0).map((item) => <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0" key={item.method}><strong>{item.method_name}</strong><span className="min-w-24 text-right tabular-nums">{count(item.contract_event_count)}건 <span className="text-xs text-muted-foreground">{(item.contract_share * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%</span></span><strong className="min-w-24 text-right tabular-nums">{money(item.attributed_contract_amount)}</strong></div>)}
                </div>
              </div>

              <div className="lg:col-span-2">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">업체 구조</h2>
                  <p className="mt-2 text-sm text-muted-foreground">계약 업체의 진입과 계약금액 집중도를 보여줍니다.</p>
                </div>
                <div className="mt-5 grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-3">
                  <div className="rounded-xl bg-muted/40 p-4"><span className="text-xs text-muted-foreground">선택 기간 계약 업체</span><strong className="mt-1 block text-2xl">{count(companyStructure?.contracted_company_count ?? summary?.company_count)}개</strong></div>
                  <div className="rounded-xl bg-muted/40 p-4"><span className="flex items-center gap-1 text-xs text-muted-foreground">선택 기간 상위 5개 집중도<MetricHelp label="상위 5개 업체 집중도 계산 기준"><strong className="mb-1 block text-foreground">계산 기준</strong>선택한 기간의 전체 계약금액 중 계약금액 상위 5개 업체가 차지하는 비율입니다.{Boolean(companyStructure?.excluded_contract_event_count) && <span className="mt-2 block text-[11px] text-muted-foreground">업체별 귀속금액을 확인할 수 없는 계약 {count(companyStructure?.excluded_contract_event_count)}건은 계산에서 제외했습니다.</span>}{companyStructure?.small_supplier_population && <span className="mt-2 block text-[11px] text-muted-foreground">계약 업체가 5개 이하이면 집중도가 100%로 표시될 수 있습니다.</span>}</MetricHelp></span><strong className="mt-1 block text-2xl">{companyStructure?.concentration_computable === false ? "산출 불가" : `${((companyStructure?.top_5_company_amount_share ?? 0) * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`}</strong></div>
                  <div className="rounded-xl bg-muted/40 p-4"><span className="flex items-center gap-1 text-xs text-muted-foreground">{supplierEntry?.target_year ?? fiscalEndYear}년 신규 업체 비중<MetricHelp label="신규 업체 비중 계산 기준"><strong className="mb-1 block text-foreground">계산 기준</strong>조회 종료 연도에 계약한 업체 중 직전 3개 연도 동안 이 기관과 계약하지 않은 신규 관측 업체의 비율입니다.{supplierEntry && <span className="mt-2 block space-y-0.5 text-[11px] text-muted-foreground"><span className="block">산정 기간 {supplierEntry.period_from.slice(0, 10)}–{supplierEntry.period_to.slice(0, 10)}</span><span className="block">신규 {count(supplierEntry.first_observed_company_count)}개 / 대상 {count(supplierEntry.total_company_count)}개</span></span>}</MetricHelp></span><strong className="mt-1 block text-2xl">{supplierEntry ? supplierEntry.total_company_count > 0 ? `${(supplierEntry.first_observed_company_rate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%` : "산출 불가" : "데이터 없음"}</strong>{supplierEntry?.total_company_count === 0 && <span className="mt-1 block text-[11px] text-muted-foreground">해당 기간에 계약 업체가 없습니다.</span>}</div>
                </div>
                <div className="mt-7 grid gap-6 xl:grid-cols-2">
                  <div><h3 className="text-base font-semibold">계약금액 상위 5개 업체</h3><p className="mt-1 text-sm text-muted-foreground">선택 기간 계약금액 기준입니다.</p><div className="mt-4 space-y-3 rounded-2xl border bg-card p-5">{companyRelationships.slice(0, 5).map((company, index) => <button className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-muted/35" key={company.company_number} onClick={() => selectCompany(company.company_number ?? "", "companies")} type="button"><span className="text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}</span><span className="min-w-0"><span className="block truncate font-medium hover:text-blue-800 dark:hover:text-blue-400">{company.company_name}</span><span className="block truncate text-[11px] text-muted-foreground">최근 계약 {company.latest_contract_date?.slice(0, 10) ?? "일자 미상"} · 계약 {count(company.contract_event_count)}건</span></span><span className="min-w-24 text-right"><strong className="block tabular-nums">{money(company.total_attributed_contract_amount)}</strong></span></button>)}</div></div>
                  <div><h3 className="text-base font-semibold">{supplierEntry?.target_year ?? fiscalEndYear}년 신규 업체</h3><p className="mt-1 text-sm text-muted-foreground">종료 연도 계약금액 기준입니다.</p><div className="relative mt-4 min-h-40 space-y-3 rounded-2xl border bg-card p-5">{supplierEntries.isFetching && <UpdatingOverlay show label="신규 업체 조회 중" />}{(supplierEntries.data?.items ?? []).map((company, index) => <button className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-muted/35" key={company.company_number} onClick={() => selectCompany(company.company_number ?? "", "companies")} type="button"><span className="text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}</span><span className="min-w-0"><span className="block truncate font-medium hover:text-blue-800 dark:hover:text-blue-400">{company.company_name}</span><span className="block truncate text-[11px] text-muted-foreground">첫 계약 {company.target_year_first_contract_date?.slice(0, 10) ?? "일자 미상"} · 계약 {count(company.target_year_contract_count)}건</span></span><span className="min-w-24 text-right"><strong className="block tabular-nums">{money(company.target_year_attributed_contract_amount)}</strong></span></button>)}{!supplierEntries.isLoading && !(supplierEntries.data?.items ?? []).length && <p className="py-5 text-center text-sm text-muted-foreground">{supplierEntry?.total_company_count === 0 ? "해당 기간에 계약 업체가 없습니다." : "표시할 신규 업체가 없습니다."}</p>}</div></div>
                </div>
                <div className="mt-4 flex justify-end border-t pt-3"><Button className="text-[var(--brand)] hover:text-[var(--brand)]" size="sm" variant="ghost" onClick={openCompanyList}>계약 업체 분석 보기 <ArrowUpRight className="ml-1 size-4" /></Button></div>
              </div>
            </section>
          )}

          {tab === "companies" && (
            <section className={`relative mt-8 transition-opacity ${procurement.isFetching || companyRelationship.isFetching ? "opacity-60" : "opacity-100"}`} aria-busy={procurement.isFetching || companyRelationship.isFetching}>
              <UpdatingOverlay show={(procurement.isFetching && Boolean(procurement.data)) || (companyRelationship.isFetching && Boolean(companyRelationship.data))} />
              <div className="mb-5">
                <h2 className="text-xl font-bold tracking-tight">계약 업체 조회</h2>
                <p className="mt-2 text-sm text-muted-foreground">이 기관과 계약한 업체를 선택해 {periodLabel}의 거래 관계를 확인합니다.</p>
              </div>

              <form className="flex w-full max-w-xl gap-2" onSubmit={submitCompanySearch}><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9 pr-9" disabled={procurement.isFetching} value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="업체명 검색" />{companySearch && <button aria-label="업체 검색 초기화" className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground" onClick={clearCompanySearch} type="button"><X className="size-4" /></button>}</div><Button disabled={procurement.isFetching} type="submit">검색</Button></form>

              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {filteredCompanies.slice(0, companyQuery ? 20 : 12).map((company) => <button aria-pressed={company.company_number === selectedCompanyNumber} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${company.company_number === selectedCompanyNumber ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "bg-background text-muted-foreground hover:border-blue-300 hover:text-[var(--brand)]"}`} key={company.company_number} onClick={() => selectCompany(company.company_number ?? "", "companies")} title={`${company.company_name} · ${money(company.total_attributed_contract_amount)}`} type="button">{company.company_name}</button>)}
                  {!filteredCompanies.length && <p className="py-2 text-sm text-muted-foreground">검색 결과가 없습니다.</p>}
                </div>
              </div>

              {!selectedCompany && <div className="mt-8 rounded-2xl border bg-muted/20 p-8 text-center text-sm text-muted-foreground">주요 업체를 선택하거나 업체명을 검색해 거래 관계를 확인해 주세요.</div>}

                {selectedCompany && <RelationshipAnalysis eyebrow="기관 × 업체" title={`${organization?.name} × ${selectedCompany.company_name}`} context={`${periodLabel}${relationshipFilterLabel ? ` · ${relationshipFilterLabel}` : ""} 계약 기준`} summary={{ contractCount: selectedCompany.contract_event_count, amount: selectedCompany.total_attributed_contract_amount, activeYearCount: (selectedCompany.yearly_activity ?? []).filter((item) => item.contract_event_count > 0).length, latestContract: selectedCompany.latest_contract_date ?? selectedCompany.latest_activity_date }} years={Array.from({ length: fiscalEndYear - fiscalStartYear + 1 }, (_, index) => fiscalStartYear + index)} yearlyActivity={selectedCompany.yearly_activity ?? []} fields={selectedCompany.major_fields ?? []} events={visibleRelationshipEvents} money={money} profileLink={{ to: companyHref(selectedCompany.company_number ?? "", selectedCompany.company_name ?? "업체"), label: "업체 프로필" }} />}
            </section>
          )}

          {tab === "notices" && (
            <section className={`relative mt-8 transition-opacity ${activity.isFetching ? "opacity-60" : "opacity-100"}`} aria-busy={activity.isFetching}>
              <UpdatingOverlay show={activity.isFetching && Boolean(activity.data)} />
              <div className="mb-5">
                <h2 className="text-xl font-bold tracking-tight">공고 조회</h2>
                <p className="mt-2 text-sm text-muted-foreground">이 기관의 발주부터 낙찰·계약까지 {periodLabel}의 전체 조달 이력을 확인합니다.</p>
              </div>
              <form className="mb-3 flex max-w-xl gap-2" onSubmit={submitListSearch}><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9 pr-9" disabled={activity.isFetching} onChange={(event) => setListSearch(event.target.value)} placeholder="공고명·업체명 검색" value={listSearch} />{listSearch && <button aria-label="검색 초기화" className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground" onClick={clearListSearch} type="button"><X className="size-4" /></button>}</div><Button disabled={activity.isFetching} type="submit">검색</Button></form>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="공고 상태 필터">{([
                ["all", "전체"], ["scheduled", "예정"], ["open", "진행 중"], ["closed", "마감"], ["award", "낙찰"], ["contract", "계약"], ["failed_or_cancelled", "유찰·취소"],
              ] as Array<[ProcurementActivityStage, string]>).map(([value, label]) => <button className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${activityStage === value ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "bg-background text-muted-foreground hover:border-blue-300 hover:text-[var(--brand)]"}`} disabled={activity.isFetching} key={value} onClick={() => setActivityStage(value)} type="button">{label} <span className={activityStage === value ? "text-blue-100" : "text-muted-foreground"}>{count(activity.data?.stage_counts?.[value])}</span></button>)}</div>
              {activity.isLoading && <Skeleton className="h-48 rounded-xl" />}
              {activity.isError && <p className="rounded-xl border p-5 text-sm text-muted-foreground">공고 정보를 불러오지 못했습니다.</p>}
              <div className="overflow-hidden rounded-xl border">
                {(activity.data?.items ?? []).map((item) => {
                  const award = item.award;
                  const contract = item.contract;
                  const lead = contract?.lead_contractor ?? contract?.contractors?.[0];
                  const contractCompanies = contract?.contractors?.length ? contract.contractors : lead ? [lead] : [];
                  const additionalCount = Math.max(0, (contract?.contractor_count ?? contract?.contractors?.length ?? 0) - 1);
                  const contractCompany = lead?.company_name ? `${lead.company_name}${additionalCount ? ` 외 ${additionalCount}개 업체` : ""}` : "계약 업체 미상";
                  const styleKey = item.stage === "award" ? "awarded" : item.stage === "contract" ? "contracted" : item.stage === "failed_or_cancelled" ? "cancelled" : item.stage;
                  const status = noticeStatus[styleKey] ?? noticeStatus.unknown;
                  const projectAmount = item.project_amount ?? item.notice?.display_amount ?? item.notice?.allocated_budget ?? item.notice?.estimated_price ?? item.notice?.base_amount;
                  const projectAmountBasis = item.project_amount_basis_name ?? item.notice?.display_amount_basis_name;
                  const noticeDetail = item.stage === "scheduled"
                    ? { label: "입찰 시작 전", dateLabel: "마감", date: item.notice?.deadline_at }
                    : item.stage === "open"
                      ? { label: "입찰 진행 중", dateLabel: "마감", date: item.notice?.deadline_at }
                      : item.stage === "failed_or_cancelled"
                        ? { label: "유찰·취소", dateLabel: "처리일", date: item.latest_activity_date }
                        : { label: "입찰 마감", dateLabel: "마감", date: item.notice?.deadline_at };
                  return <article className="grid border-b transition-colors last:border-b-0 hover:bg-blue-50/60 dark:hover:bg-blue-950/20 md:grid-cols-[minmax(0,1.85fr)_minmax(19rem,1fr)]" key={item.activity_id}>
                    <div className="min-w-0 p-4">
                      <div className="flex min-w-0 items-start gap-2"><Badge className={`mt-0.5 shrink-0 border-0 text-[10px] ${status.className}`}>{item.stage_name ?? status.label}</Badge>{item.bid_notice_id ? <Link className="activity-notice-link line-clamp-2 min-w-0 flex-1 rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 md:line-clamp-1" title={item.notice_name} to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}>{item.notice_name ?? "공고명 미상"}</Link> : <strong className="line-clamp-2 min-w-0 flex-1 text-sm md:line-clamp-1" title={item.notice_name}>{item.notice_name ?? "계약명 미상"}</strong>}{item.notice_linkage === "unlinked" && <span className="shrink-0 text-[11px] text-muted-foreground">공고 미연결</span>}</div>
                      <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span className="truncate">{item.organization_name ?? organization?.name}</span><span>·</span><span className="shrink-0">{(item.notice?.published_at ?? item.latest_activity_date)?.slice(0, 10) ?? "일자 미상"}</span>{item.work_type && <><span>·</span><span>{workTypeLabel[item.work_type] ?? item.work_type}</span></>}{projectAmount != null && <><span>·</span><span className="shrink-0 font-medium tabular-nums text-foreground" title={projectAmountBasis}>{money(projectAmount)}</span></>}</p>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3 border-t bg-muted/[0.12] px-4 py-3 md:border-l md:border-t-0">
                      {(award || contract) ? <><div className="min-w-0">{contract ? <ContractCompanyPicker companies={contractCompanies} label={contractCompany} contextParams={searchParams} /> : award?.winner_business_registration_number ? <Link className="activity-company-link block truncate text-sm font-semibold" to={companyHref(award.winner_business_registration_number, award.winner_name)}>{award.winner_name ?? "업체명 미상"}</Link> : <span className="block truncate text-sm font-medium">{award?.winner_name ?? "업체명 미상"}</span>}<span className="mt-0.5 block text-[11px] text-muted-foreground">{contract ? "계약 업체" : "낙찰 업체"}</span></div><span className="shrink-0 text-right"><strong className="block text-sm tabular-nums">{money(contract?.contract_amount ?? award?.winning_amount)}</strong><span className="text-[11px] text-muted-foreground">{contract?.contract_date ?? award?.award_date ?? "일자 미상"}</span></span></> : <><strong className="min-w-0 truncate text-sm">{noticeDetail.label}</strong><span className="shrink-0 text-right"><span className="block text-[11px] text-muted-foreground">{noticeDetail.dateLabel}</span><strong className="block text-sm tabular-nums">{noticeDetail.date?.slice(0, 10) ?? "일자 미상"}</strong></span></>}
                    </div>
                  </article>;
                })}
                {!activity.isLoading && (activity.data?.items ?? []).length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">선택한 조건에 해당하는 공고가 없습니다.</p>}
              </div>
              <ListPagination loading={activity.isFetching} page={listPage} totalPages={activity.data?.pagination.total_pages} onChange={setListPage} />
            </section>
          )}
      </>
      </article>
    </EntityDetailLayout>
  );
}
