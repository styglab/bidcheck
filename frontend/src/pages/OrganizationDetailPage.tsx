import { ArrowUpRight, CircleHelp, ExternalLink, FileText, Landmark, LoaderCircle, Search, X } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { EntityTabs } from "@/components/common/entity-tabs";
import { PageError, SectionError } from "@/components/common/error-state";
import { HistoryBackLink } from "@/components/common/history-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotices } from "../features/notices/api";
import {
  useOrganization,
  useOrganizationActivity,
  useOrganizationCompanyRelationship,
  useOrganizationProcurementProfile,
} from "../features/organizations/api";

const money = (value?: number) => {
  if (value == null) return "금액 미상";
  if (value === 0) return "0억원";
  if (value > 0 && value < 10_000_000) return "<0.1억원";
  if (value < 100_000_000) {
    return `${(value / 100_000_000).toLocaleString("ko-KR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}억원`;
  }
  return `${(value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}억원`;
};
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

const fieldIdentity = (field: { field_code?: string; middle_category?: string; large_category?: string; work_types?: string[] }) => {
  const base = field.field_code ?? field.middle_category ?? field.large_category;
  if (!base) return undefined;
  return field.large_category === "미분류" && field.work_types?.length === 1
    ? `${base}::${field.work_types[0]}`
    : base;
};

const noticeStatus: Record<string, { label: string; className: string }> = {
  scheduled: { label: "입찰 예정", className: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
  open: { label: "진행 중", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  closed: { label: "마감", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  awarded: { label: "낙찰", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  contracted: { label: "계약", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" },
  cancelled: { label: "취소", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  unknown: { label: "상태 확인", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
};

export function OrganizationDetailPage() {
  const { organizationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPeriod = Number(searchParams.get("period") ?? 5);
  const periodYears = requestedPeriod === 1 || requestedPeriod === 3 ? requestedPeriod : 5;
  const currentYear = new Date().getUTCFullYear();
  const fiscalStartYear = currentYear - periodYears + 1;
  const periodLabel = periodYears === 1 ? `${currentYear}년` : `${fiscalStartYear}–${currentYear}년`;
  const tab = searchParams.get("tab") ?? "overview";
  const selectedLargeCategory = searchParams.get("large") ?? undefined;
  const selectedMiddleCategory = searchParams.get("middle") ?? undefined;
  const selectedFieldCode = searchParams.get("field") ?? undefined;
  const selectedWorkType = searchParams.get("workType") ?? undefined;
  const organizationQuery = useOrganization(organizationId);
  const noticeQuery = useNotices({
    demand_organization_code: organizationId,
    published_from: `${fiscalStartYear}-01-01`,
    include_history: true,
    work_type: selectedWorkType && selectedWorkType !== "unknown" ? selectedWorkType : undefined,
    large_category: selectedLargeCategory,
    middle_category: selectedMiddleCategory,
    field_code: selectedFieldCode,
    sort: "published_desc",
    page_size: tab === "overview" ? 5 : 20,
  }, tab === "overview" || tab === "notices");
  const activity = useOrganizationActivity(
    organizationId,
    tab === "awards" || tab === "contracts",
    periodYears,
  );
  const procurement = useOrganizationProcurementProfile(organizationId, periodYears, {
    largeCategory: selectedLargeCategory,
    middleCategory: selectedMiddleCategory,
    fieldCode: selectedFieldCode,
    workType: selectedWorkType,
  });
  const overallProcurement = useOrganizationProcurementProfile(organizationId, periodYears, {}, Boolean(selectedWorkType));
  const selectedCompanyNumber = searchParams.get("company") ?? undefined;
  const [companySearch, setCompanySearch] = useState("");
  const [showAllFields, setShowAllFields] = useState(false);
  const organization = organizationQuery.data?.organization;
  const notices = noticeQuery.data?.items ?? [];
  const companyRelationships = procurement.data?.company_relationships ?? [];
  const summary = procurement.data?.summary;
  const supplierEntry = summary?.rolling_12m_supplier_entry;
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
    undefined,
    tab === "companies",
  );
  const filteredCompanies = companyRelationships.filter((item) =>
    (item.company_name ?? "").toLocaleLowerCase().includes(companySearch.trim().toLocaleLowerCase()),
  );
  const visibleYearlyActivity = [...(procurement.data?.yearly_activity ?? [])]
    .sort((left, right) => right.year - left.year)
    .slice(0, 5)
    .sort((left, right) => left.year - right.year);
  const visibleRelationshipEvents = useMemo(
    () =>
      (companyRelationship.data?.events ?? []).filter((event) => {
        const value = event.contract_date ?? event.award_date ?? event.notice_published_date;
        return !value || Number(value.slice(0, 4)) >= fiscalStartYear;
      }),
    [companyRelationship.data?.events, fiscalStartYear],
  );
  const setTab = (nextTab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    setSearchParams(next);
  };
  const selectCompany = (companyNumber: string, nextTab = tab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    if (selectedCompanyNumber === companyNumber && nextTab === tab) next.delete("company");
    else next.set("company", companyNumber);
    setSearchParams(next);
  };
  const setPeriod = (years: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("period", String(years));
    setSearchParams(next);
  };
  const selectField = (field: (typeof fieldDistribution)[number]) => {
    if (isSingleLevelField) return;
    const next = new URLSearchParams(searchParams);
    if (!selectedLargeCategory && field.large_category) next.set("large", field.large_category);
    else if (!selectedMiddleCategory && field.middle_category) next.set("middle", field.middle_category);
    else if (!selectedFieldCode && field.field_code) next.set("field", field.field_code);
    if (!selectedWorkType && field.work_types?.length === 1) next.set("workType", field.work_types[0]);
    next.delete("company");
    setSearchParams(next);
  };
  const resetFieldTo = (level: "all" | "large" | "middle") => {
    const next = new URLSearchParams(searchParams);
    if (level === "all") next.delete("large");
    if (level === "all" || level === "large") next.delete("middle");
    if (level !== "middle" || selectedFieldCode) next.delete("field");
    next.delete("company");
    setSearchParams(next);
  };
  const setWorkType = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("workType"); else next.set("workType", value);
    next.delete("large");
    next.delete("middle");
    next.delete("field");
    next.delete("company");
    setSearchParams(next);
  };
  const clearWorkType = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("workType");
    next.delete("large");
    next.delete("middle");
    next.delete("field");
    next.delete("company");
    setSearchParams(next);
  };
  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    ["period", "workType", "large", "middle", "field", "company"].forEach((key) => next.delete(key));
    setSearchParams(next);
  };
  const selectedLargeLabel = selectedLargeCategory ? (appliedField?.large_category ?? selectedLargeCategory) : undefined;
  const selectedMiddleLabel = selectedMiddleCategory ? (appliedField?.middle_category ?? selectedMiddleCategory) : undefined;
  const selectedFieldLabel = selectedFieldCode ? (appliedField?.field_name ?? selectedFieldCode) : undefined;
  if (organizationQuery.isLoading)
    return (
      <PageContainer>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-8 h-40 rounded-xl" />
      </PageContainer>
    );
  if (organizationQuery.isError)
    return <PageError error={organizationQuery.error} entity="기관 정보" onRetry={() => organizationQuery.refetch()} />;

  return (
    <PageContainer className="max-w-7xl">
      <HistoryBackLink fallbackTo="/organizations" />
      <header className="mt-7 rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <Landmark />
          </span>
          <div className="min-w-0">
            <Badge className="border-0 bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-200">
              기관
            </Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{organization?.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {organization?.jurisdiction_type ?? "기관 유형 미상"} · 기관코드 {organizationId}
            </p>
          </div>
        </div>
      </header>

      {procurement.isLoading && !procurement.data && (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      )}
      {procurement.isError && !procurement.data && (
        <div className="mt-6"><SectionError error={procurement.error} title="조달 현황" onRetry={() => procurement.refetch()} /></div>
      )}

      <>
          <section className="mt-6 rounded-2xl border bg-card p-5 sm:p-6" aria-label="조회 조건">
            <div className="flex flex-wrap items-end gap-4 lg:flex-nowrap">
              <div className="order-3 shrink-0 lg:ml-auto">
                <p className="mb-2 text-xs font-medium text-muted-foreground">조회 기간 <span className="font-normal">(회계연도)</span></p>
                <div className="flex rounded-xl bg-muted p-1" aria-label="조회 기간">
                  {[1, 3, 5].map((years) => { const from = currentYear - years + 1; const label = years === 1 ? `${currentYear}년` : `${from}–${currentYear}`; return <button className={`rounded-lg px-3 py-1.5 text-sm font-medium ${periodYears === years ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} key={years} onClick={() => setPeriod(years)} title={years === 1 ? `${currentYear}년 1월 1일부터 현재까지` : `${from}년 1월 1일부터 ${currentYear}년 현재까지`} type="button">{label}</button>; })}
                </div>
              </div>
              <div className="order-1 shrink-0">
                <p className="mb-2 text-xs font-medium text-muted-foreground">조달 유형</p>
                <Select value={selectedWorkType ?? "all"} onValueChange={setWorkType}>
                  <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="all">전체</SelectItem>
                    {Object.entries(workTypeLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="order-2 min-w-64 flex-1">
                <p className="mb-2 text-xs font-medium text-muted-foreground">분야</p>
                <Select value="current" onValueChange={(value) => { const field = fieldDistribution.find((item) => fieldIdentity(item) === value); if (field) selectField(field); }} disabled={Boolean(selectedFieldCode || isSingleLevelField)}>
                  <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="current">{selectedFieldCode ? appliedField?.field_name : isSingleLevelField ? appliedField?.large_category : selectedLargeCategory ? "세부 분야 선택" : "분야 선택"}</SelectItem>
                    {[...fieldDistribution].sort((left, right) => (right.attributed_contract_amount ?? 0) - (left.attributed_contract_amount ?? 0)).map((field) => { const value = fieldIdentity(field); const type = field.large_category === "미분류" && field.work_types?.length === 1 ? workTypeLabel[field.work_types[0]] : undefined; const label = field.field_name ?? field.middle_category ?? field.large_category ?? "미분류"; return value ? <SelectItem key={value} value={value}>{type ? `${type} ${label}` : label} · {money(field.attributed_contract_amount)}</SelectItem> : null; })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(selectedWorkType || selectedLargeLabel || selectedMiddleLabel || selectedFieldLabel) && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs dark:border-violet-900 dark:bg-violet-950/20"><span className="mr-1 font-semibold text-violet-800 dark:text-violet-200">적용 필터</span>{selectedWorkType && <button className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-background px-3 py-1.5 font-semibold text-violet-800 shadow-sm hover:bg-violet-100 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950" onClick={clearWorkType} type="button">{workTypeLabel[selectedWorkType]}<X className="size-3" /></button>}{selectedLargeLabel && <button className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-background px-3 py-1.5 font-semibold text-violet-800 shadow-sm hover:bg-violet-100 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950" onClick={() => resetFieldTo("all")} type="button">{selectedLargeLabel}<X className="size-3" /></button>}{selectedMiddleLabel && <button className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-background px-3 py-1.5 font-semibold text-violet-800 shadow-sm hover:bg-violet-100 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950" onClick={() => resetFieldTo("large")} type="button">{selectedMiddleLabel}<X className="size-3" /></button>}{selectedFieldLabel && <button className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-background px-3 py-1.5 font-semibold text-violet-800 shadow-sm hover:bg-violet-100 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950" onClick={() => resetFieldTo("middle")} type="button">{selectedFieldLabel}<X className="size-3" /></button>}<button className="ml-auto px-2 py-1.5 font-medium text-violet-800 hover:underline dark:text-violet-200" onClick={resetFilters} type="button">전체 초기화</button></div>}
            {isUpdating && <div className="mt-4 flex items-center justify-end gap-1.5 text-xs font-medium text-violet-700" role="status"><LoaderCircle className="size-3.5 animate-spin" /> 조건 적용 중</div>}
          </section>

          <EntityTabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "overview", label: "개요" },
              { id: "notices", label: "공고", count: summary?.notice_count },
              { id: "awards", label: "낙찰 공고", count: summary?.award_event_count },
              { id: "contracts", label: "계약 공고", count: summary?.contract_event_count },
              { id: "companies", label: "관련 업체", count: summary?.company_count },
            ]}
          />

          {tab === "overview" && <section className={`mt-5 transition-opacity ${isUpdating ? "opacity-55" : "opacity-100"}`} aria-busy={isUpdating} aria-labelledby="procurement-summary-title">
            <h2 className="text-xl font-bold" id="procurement-summary-title">조달 현황</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[["공고", `${count(summary?.notice_count ?? noticeQuery.data?.pagination.total_items)}건`], ["계약", `${count(summary?.contract_event_count)}건`], ["관련 업체", summary ? `${count(summary.company_count)}개` : "-"], ["계약금액", money(summary?.total_attributed_contract_amount)]].map(([label, value]) => <div className="rounded-xl bg-muted/50 p-4" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-bold">{value}</dd></div>)}
              <div className="rounded-xl bg-muted/50 p-4">
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  신규 업체 비중
                  <button
                    className="group relative inline-flex rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="신규 업체 비중 계산 기준"
                    type="button"
                  >
                    <CircleHelp className="size-3.5" aria-hidden="true" />
                    <span className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden w-64 rounded-xl border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-lg group-hover:block group-focus:block">
                      <strong className="mb-1 block text-foreground">계산 기준</strong>
                      최근 12개월 계약업체 중 최근 5개 회계연도 이력에서 처음 확인된 업체의 비율입니다.
                      <span className="mt-2 block space-y-0.5 text-[11px] text-muted-foreground">
                        <span className="block">대상 기간 {supplierEntry?.period_from && supplierEntry?.period_to ? `${supplierEntry.period_from.replaceAll("-", ".")}–${supplierEntry.period_to.replaceAll("-", ".")}` : "최근 12개월"}</span>
                        {supplierEntry?.history_from && <span className="block">확인 이력 {supplierEntry.history_from.slice(0, 4)}년부터</span>}
                      </span>
                    </span>
                  </button>
                </dt>
                <dd className="mt-1 text-xl font-bold">{supplierEntry ? `${(supplierEntry.first_observed_company_rate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%` : "데이터 없음"}</dd>
                {supplierEntry && <><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><span className="block h-full rounded-full bg-blue-800 dark:bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, supplierEntry.first_observed_company_rate * 100))}%` }} /></div><p className="mt-1.5 text-[11px] text-muted-foreground">신규 {count(supplierEntry.first_observed_company_count)}개 · 계약업체 {count(supplierEntry.total_company_count)}개 · 최근 12개월</p></>}
              </div>
            </dl>
          </section>}

          {tab === "overview" && (
            <section className={`mt-8 grid gap-10 transition-opacity lg:grid-cols-2 ${isUpdating ? "pointer-events-none opacity-55" : "opacity-100"}`} aria-busy={isUpdating}>
              <div className="grid gap-8 lg:col-span-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="flex h-full flex-col">
                <h2 className="text-xl font-bold">조달 유형</h2>
                <p className="mt-2 text-sm text-muted-foreground">항목을 선택하면 해당 유형만 볼 수 있습니다.</p>
                <div className="mt-5 flex flex-1 flex-col rounded-2xl border bg-card p-5 lg:min-h-[22rem]">
                <div className="flex h-10 overflow-hidden rounded-xl bg-muted" aria-label="계약금액 구성">
                  {sortedWorkTypeDistribution.filter((item) => (item.attributed_contract_amount ?? 0) > 0).map((item) => { const total = sortedWorkTypeDistribution.reduce((sum, row) => sum + (row.attributed_contract_amount ?? 0), 0); const share = total ? ((item.attributed_contract_amount ?? 0) / total) * 100 : 0; const selected = selectedWorkType === item.work_type; const dimmed = Boolean(selectedWorkType && !selected); return <button aria-pressed={selected} className={`${item.work_type === "goods" ? "bg-blue-600" : item.work_type === "construction" ? "bg-amber-500" : item.work_type === "service" ? "bg-violet-600" : "bg-slate-500"} min-w-fit px-3 text-xs font-semibold text-white transition-opacity ${selected ? "ring-2 ring-[var(--brand)] ring-inset dark:ring-blue-300" : ""} ${dimmed ? "opacity-50 hover:opacity-[0.85]" : "opacity-100"}`} key={item.work_type} onClick={() => setWorkType(selected ? "all" : item.work_type)} style={{ width: `${share}%` }} title={selected ? `${item.work_type_name} 선택 해제` : `${item.work_type_name} ${share.toFixed(1)}%`} type="button">{item.work_type_name} {share.toFixed(1)}%</button>; })}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {sortedWorkTypeDistribution.map((item) => { const selected = selectedWorkType === item.work_type; const dimmed = Boolean(selectedWorkType && !selected); return (
                    <button aria-pressed={selected} className={`w-full rounded-xl border p-4 text-left transition-all ${selected ? "border-[var(--brand)] bg-blue-50/70 ring-1 ring-[var(--brand)] dark:border-blue-300 dark:bg-blue-950/25 dark:ring-blue-300" : "border-transparent bg-muted/35 hover:border-border hover:bg-muted/60"} ${dimmed ? "opacity-[0.65] hover:opacity-[0.85]" : "opacity-100"}`} key={item.work_type} onClick={() => setWorkType(selected ? "all" : item.work_type)} type="button">
                      <div className="flex items-center justify-between gap-3"><span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${workTypeStyle[item.work_type] ?? workTypeStyle.unknown}`}>{item.work_type_name || workTypeLabel[item.work_type]}</span><strong className="text-lg">{money(item.attributed_contract_amount)}</strong></div>
                      <p className="mt-1 text-xs text-muted-foreground">계약 {count(item.contract_event_count)}건 · 낙찰 {count(item.award_event_count)}건 · 참여 {count(item.participation_count)}건</p>
                    </button>
                  ); })}
                </div>
                </div>
              </div>

              <div className="flex h-full flex-col">
                <h2 className="text-xl font-bold">{selectedLargeCategory ? "세부 분야" : "주요 분야"}</h2>
                <p className="mt-2 text-sm text-muted-foreground">항목을 선택하면 해당 분야만 볼 수 있습니다.</p>
                <div className="mt-5 flex flex-1 flex-col rounded-2xl border bg-card p-5 lg:min-h-[22rem]">
                  {selectedFieldCode && fieldDistribution.flatMap((field) => field.detailed_items ?? []).map((item) => <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 p-3 text-sm" key={item.code}><strong>{item.name}</strong><span className="font-mono text-xs text-muted-foreground">{item.code}</span></div>)}
                  {!selectedFieldCode && <div className="grid flex-1 gap-3" style={{ gridTemplateRows: `repeat(${Math.max(topFields.length, 1)}, minmax(0, 1fr))` }}>{topFields.map((field) => { const max = Math.max(1, ...topFields.map((item) => item.attributed_contract_amount ?? 0)); return <button className={`grid h-full w-full grid-cols-[minmax(9rem,15rem)_1fr_auto] items-center gap-3 rounded-lg px-1 text-left text-sm hover:bg-muted/35 ${isSingleLevelField ? "cursor-default" : ""}`} key={fieldIdentity(field)} onClick={() => selectField(field)} type="button"><span className="flex min-w-0 items-center gap-2">{field.work_types?.map((workType) => <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${workTypeStyle[workType] ?? workTypeStyle.unknown}`} key={workType}>{workTypeLabel[workType] ?? workType}</span>)}<span className="truncate font-medium hover:text-violet-700">{field.field_name ?? field.middle_category ?? field.large_category ?? "미분류"}</span></span><span className="h-2.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-800 dark:bg-blue-500" style={{ width: `${((field.attributed_contract_amount ?? 0) / max) * 100}%` }} /></span><strong className="min-w-24 text-right">{money(field.attributed_contract_amount)}</strong></button>; })}</div>}
                  {!topFields.length && <p className="py-5 text-center text-sm text-muted-foreground">선택한 조건에서 분류된 조달 분야가 없습니다.</p>}
                  {!selectedFieldCode && rankedFields.length > 5 && <div className="mt-4 border-t pt-4 text-right"><Button size="sm" variant="ghost" onClick={() => setShowAllFields(true)}>전체 {count(rankedFields.length)}개 보기</Button></div>}
                </div>
              </div>
              </div>

              {showAllFields && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="전체 조달 분야" onClick={() => setShowAllFields(false)}><div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl border bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="text-lg font-bold">전체 {selectedLargeCategory ? "세부 분야" : "분야"}</h2><p className="mt-1 text-xs text-muted-foreground">계약금액이 큰 순서입니다.</p></div><Button size="icon" variant="ghost" aria-label="닫기" onClick={() => setShowAllFields(false)}><X className="size-4" /></Button></div><div className="max-h-[calc(80vh-5rem)] space-y-3 overflow-y-auto p-5">{rankedFields.map((field) => { const max = Math.max(1, rankedFields[0]?.attributed_contract_amount ?? 0); return <button className="grid w-full grid-cols-[minmax(9rem,15rem)_1fr_auto] items-center gap-3 text-left text-sm" key={fieldIdentity(field)} onClick={() => { selectField(field); setShowAllFields(false); }} type="button"><span className="flex min-w-0 items-center gap-2">{field.work_types?.map((workType) => <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${workTypeStyle[workType] ?? workTypeStyle.unknown}`} key={workType}>{workTypeLabel[workType] ?? workType}</span>)}<span className="truncate font-medium hover:text-violet-700">{field.field_name ?? field.middle_category ?? field.large_category ?? "미분류"}</span></span><span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-800 dark:bg-blue-500" style={{ width: `${((field.attributed_contract_amount ?? 0) / max) * 100}%` }} /></span><strong className="min-w-24 text-right">{money(field.attributed_contract_amount)}</strong></button>; })}</div></div></div>}

              <div className="lg:col-span-2">
                <h2 className="text-xl font-bold">계약 추이</h2>
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

              <div className="lg:col-span-2">
                <div>
                  <h2 className="text-xl font-bold">주요 업체</h2>
                  <p className="mt-2 text-sm text-muted-foreground">업체를 선택하면 이 기관과의 계약 관계를 확인할 수 있습니다.</p>
                </div>
                <div className="mt-5 space-y-3 rounded-2xl border bg-card p-5">
                  {companyRelationships.slice(0, 10).map((company) => {
                    const max = Math.max(1, ...(companyRelationships.slice(0, 10).map((item) => item.total_attributed_contract_amount ?? 0)));
                    return (
                      <button className="grid w-full grid-cols-[minmax(8rem,13rem)_1fr_auto] items-center gap-3 text-left text-sm" key={company.company_number} onClick={() => selectCompany(company.company_number ?? "")} type="button">
                        <span className="truncate font-medium hover:text-violet-700">{company.company_name}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-800 dark:bg-blue-500" style={{ width: `${((company.total_attributed_contract_amount ?? 0) / max) * 100}%` }} /></span>
                        <strong className="min-w-24 text-right tabular-nums">{money(company.total_attributed_contract_amount)}</strong>
                      </button>
                    );
                  })}
                </div>
                {selectedCompany && (
                  <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-5 dark:border-violet-900 dark:bg-violet-950/15">
                    <strong className="text-lg">{selectedCompany.company_name} × {organization?.name}</strong>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[["계약", `${count(selectedCompany.contract_event_count)}건`], ["계약금액", money(selectedCompany.total_attributed_contract_amount)], ["계약 이력", `${count(selectedCompany.active_year_count)}개 연도`], ["최근 계약", selectedCompany.latest_activity_date?.slice(0, 7) ?? "-"]].map(([label, value]) => <div className="rounded-xl bg-background/80 p-3" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}
                    </dl>
                    <Button className="mt-4" size="sm" variant="outline" onClick={() => selectCompany(selectedCompany.company_number ?? "", "companies")}>관계 자세히 보기</Button>
                  </div>
                )}
                {companyRelationships.some((item) => item.amount_completeness !== "complete") && (
                  <p className="mt-2 text-xs text-muted-foreground">* 일부 계약은 업체 귀속금액이 불완전할 수 있습니다.</p>
                )}
              </div>
              <div className="lg:col-span-2">
                <div>
                  <h2 className="mt-2 text-xl font-bold">최근 공고</h2>
                  <p className="mt-2 text-sm text-muted-foreground">공고를 클릭하면 상세 내용을 볼 수 있습니다.</p>
                </div>
                <div className="mt-5 divide-y overflow-hidden rounded-2xl border bg-card">
                  {notices.slice(0, 5).map((notice) => {
                    const status = noticeStatus[notice.status] ?? noticeStatus.unknown;
                    return (
                    <Link
                      className="group flex items-start gap-3 p-4 hover:bg-blue-50/35 dark:hover:bg-blue-950/10"
                      key={notice.id}
                      to={`/notices/${encodeURIComponent(notice.id)}`}
                    >
                      <FileText className="mt-0.5 size-4 shrink-0 text-blue-700" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2"><strong className="min-w-0 flex-1 truncate text-sm group-hover:text-blue-700">{notice.name}</strong><Badge className={`shrink-0 border-0 text-[10px] ${status.className}`}>{status.label}</Badge></span>
                        <small className="mt-1 flex flex-wrap justify-between gap-2 text-muted-foreground"><span>{notice.notice_number}-{notice.notice_order}</span><span>{notice.published_at?.slice(0, 10) ?? ""}</span></small>
                      </span>
                    </Link>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-end"><Button size="sm" variant="ghost" onClick={() => setTab("notices")}>전체 공고 보기 <ArrowUpRight className="ml-1 size-4" /></Button></div>
              </div>
            </section>
          )}

          {tab === "companies" && (
            <section className="mt-8">
              <div>
                <p className="text-xs font-semibold text-violet-700">기관 × 업체</p>
                <h2 className="mt-2 text-xl font-bold">업체별 거래 분석</h2>
                <p className="mt-2 text-sm text-muted-foreground">이 기관과 거래한 업체를 선택해 {periodLabel}의 관계를 확인합니다.</p>
              </div>
              <div className="relative mt-5 max-w-xl">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="업체명 검색" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {filteredCompanies.slice(0, 12).map((company) => (
                  <button className={`rounded-full px-3 py-1.5 text-xs font-medium ${company.company_number === selectedCompanyNumber ? "bg-violet-700 text-white" : "bg-muted hover:bg-violet-100 hover:text-violet-800"}`} key={company.company_number} onClick={() => selectCompany(company.company_number ?? "", "companies")} type="button">
                    {company.company_name}
                  </button>
                ))}
              </div>

              {!selectedCompany && (
                <p className="mt-8 rounded-2xl border bg-muted/25 p-8 text-center text-sm text-muted-foreground">분석할 업체를 선택해 주세요.</p>
              )}

              {selectedCompany && (
                <div className="mt-8 space-y-10">
                  <section className="rounded-2xl border bg-card p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{organization?.name}</p>
                        <span className="my-1 block text-muted-foreground">×</span>
                        <h3 className="text-2xl font-bold">{selectedCompany.company_name}</h3>
                      </div>
                      <Button asChild size="sm" variant="outline"><Link to={`/companies/${encodeURIComponent(selectedCompany.company_number ?? "")}?name=${encodeURIComponent(selectedCompany.company_name ?? "업체")}`}>업체 프로필</Link></Button>
                    </div>
                    <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        ["계약", `${count(selectedCompany.contract_event_count)}건`],
                        ["계약금액", money(selectedCompany.total_attributed_contract_amount)],
                        ["계약 이력", `${count(selectedCompany.active_year_count)}개 연도`],
                        ["최근 계약", selectedCompany.latest_activity_date?.slice(0, 7) ?? "-"],
                      ].map(([label, value]) => <div className="rounded-xl bg-muted/50 p-3" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}
                    </dl>
                  </section>

                  <section className="grid gap-8 lg:grid-cols-2">
                    <div>
                      <h3 className="font-bold">거래 추이</h3>
                      <div className="mt-3 space-y-3 rounded-2xl border bg-card p-5">
                        {[...(selectedCompany.yearly_activity ?? [])].sort((a, b) => a.year - b.year).map((item) => {
                          const rows = selectedCompany.yearly_activity ?? [];
                          const max = Math.max(1, ...rows.map((row) => row.attributed_contract_amount ?? 0));
                          return <div className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3 text-sm" key={item.year}><span className="text-muted-foreground">{item.year}</span><span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-800 dark:bg-blue-500" style={{ width: `${((item.attributed_contract_amount ?? 0) / max) * 100}%` }} /></span><strong>{money(item.attributed_contract_amount)}</strong><span className="text-xs text-muted-foreground">{count(item.contract_event_count)}건</span></div>;
                        })}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold">거래 분야</h3>
                      <div className="mt-3 space-y-3 rounded-2xl border bg-card p-5">
                        {(selectedCompany.major_fields ?? []).map((field) => {
                          const max = Math.max(1, ...(selectedCompany.major_fields ?? []).map((item) => item.event_count));
                          return <div className="grid grid-cols-[minmax(7rem,1fr)_2fr_auto] items-center gap-3 text-sm" key={field.code}><span className="truncate">{field.name}</span><span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-800 dark:bg-blue-500" style={{ width: `${(field.event_count / max) * 100}%` }} /></span><strong>{count(field.event_count)}건</strong></div>;
                        })}
                        {!selectedCompany.major_fields?.length && <p className="text-sm text-muted-foreground">분류된 거래 분야가 없습니다.</p>}
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="font-bold">공고에 연결된 수주 이력</h3>
                    <p className="mt-2 text-sm text-muted-foreground">전체 계약 {count(selectedCompany.contract_event_count)}건 중 공고 연결이 확인된 {count(visibleRelationshipEvents.length)}건입니다. 공고번호가 연결되지 않은 계약은 이 목록에 포함되지 않습니다.</p>
                    <div className="mt-3 overflow-x-auto rounded-2xl border bg-card">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">공고</th><th className="px-3 py-3">유형</th><th className="px-3 py-3 text-right">낙찰금액</th><th className="px-3 py-3 text-right">계약금액</th><th className="px-4 py-3 text-right">일자</th></tr></thead>
                        <tbody className="divide-y">
                          {visibleRelationshipEvents.map((event) => <tr key={event.award_event_id}><td className="px-4 py-3"><Link className="font-medium hover:text-blue-700 hover:underline" to={`/notices/${encodeURIComponent(event.bid_notice_id)}`}>{event.notice_name ?? event.bid_notice_id}</Link></td><td className="px-3 py-3 text-muted-foreground">{event.project_type_label ?? event.project_type ?? "-"}</td><td className="px-3 py-3 text-right">{money(event.award_amount)}</td><td className="px-3 py-3 text-right">{money(event.attributed_contract_amount ?? event.contract_amount)}</td><td className="px-4 py-3 text-right text-muted-foreground">{(event.contract_date ?? event.award_date ?? event.notice_published_date)?.slice(0, 10) ?? "-"}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}
            </section>
          )}

          {tab === "notices" && (
            <section className="mt-6">
              <div className="divide-y rounded-xl border">
                {notices.map((notice) => (
                  <Link
                    className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
                    key={notice.id}
                    to={`/notices/${encodeURIComponent(notice.id)}`}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate">{notice.name}</strong>
                      <small className="mt-1 block text-muted-foreground">
                        {notice.notice_number}-{notice.notice_order}
                      </small>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </section>
          )}
          {tab === "awards" && (
            <section className="mt-6">
              {activity.isLoading && <Skeleton className="h-48 rounded-xl" />}
              {activity.isError && <p className="rounded-xl border p-5 text-sm text-muted-foreground">낙찰 정보를 불러오지 못했습니다.</p>}
              <div className="divide-y rounded-xl border">
                {(activity.data?.awards ?? []).map((item) => (
                  <div className="flex items-center justify-between gap-5 p-4" key={item.id}>
                    <div className="min-w-0">
                      <Link
                        className="font-semibold hover:text-blue-800 hover:underline"
                        to={`/companies/${item.company_number}`}
                      >
                        {item.company_name}
                      </Link>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        <Link
                          className="hover:underline"
                          to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
                        >
                          {item.notice_name}
                        </Link>{" "}
                        · {money(item.winning_amount)}
                      </p>
                    </div>
                    <Badge className="border-0" variant="secondary">
                      {item.award_date ?? "낙찰"}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          )}
          {tab === "contracts" && (
            <section className="mt-6">
              {activity.isLoading && <Skeleton className="h-48 rounded-xl" />}
              {activity.isError && <p className="rounded-xl border p-5 text-sm text-muted-foreground">계약 정보를 불러오지 못했습니다.</p>}
              <div className="divide-y rounded-xl border">
                {(activity.data?.contracts ?? []).map((item) => (
                  <div className="flex items-center justify-between gap-5 p-4" key={item.id}>
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">{item.name}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.concluded_date ?? "계약일 미상"} · {money(item.amount)}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      {item.bid_notice_id && (
                        <Link
                          className="text-sm font-medium text-blue-800 hover:underline"
                          to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}
                        >
                          공고
                        </Link>
                      )}
                      {item.detail_url && (
                        <a href={item.detail_url} target="_blank" rel="noreferrer">
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
    </PageContainer>
  );
}
