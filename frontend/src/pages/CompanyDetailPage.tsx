import { ArrowUpRight, Building2, Search, X } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EntityTabs } from "@/components/common/entity-tabs";
import { ListPagination } from "@/components/common/list-pagination";
import { ListEmptyState } from "@/components/common/list-empty-state";
import { SectionError } from "@/components/common/error-state";
import { ProcurementFilterPanel } from "@/components/procurement/procurement-filter-panel";
import { RelationshipAnalysis } from "@/components/procurement/relationship-analysis";
import { EntityDetailContentSkeleton, EntityDetailLayout } from "@/components/layout/entity-detail-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { entityDetailPath } from "@/shared/navigation/entity-links";
import { CompanyInformationPanel } from "@/features/company-context/CompanyInformationPanel";
import { procurementFieldIdentity, procurementFieldOptionLabel, procurementFieldSelection } from "@/shared/procurement/field-options";
import { formatCompactMoney as money } from "@/shared/format/money";
import { useOrganizationCompanyRelationship } from "../features/organizations/api";
import {
  useCompanyActivity,
  useCompanyCompetitors,
  useCompanyDetailContext,
  useCompanyProcurementProfile,
  useCompanyProfile,
} from "../features/company-context/api";

const workTypeLabels: Record<string, string> = { goods: "물품", service: "용역", construction: "공사", foreign: "외자", other: "기타", unknown: "미분류" };

export function CompanyDetailPage() {
  const { businessNumber } = useParams();
  const [params, setParams] = useSearchParams();
  const currentYear = new Date().getUTCFullYear();
  const earliestYear = 2022;
  const fromYear = Math.max(earliestYear, Number(params.get("fromYear")) || Math.max(earliestYear, currentYear - 4));
  const toYear = Math.min(currentYear, Number(params.get("toYear")) || currentYear);
  const workType = params.get("workType") ?? "";
  const largeCategory = params.get("large") ?? "";
  const middleCategory = params.get("middle") ?? "";
  const fieldCode = params.get("field") ?? "";
  const participationPage = Math.max(1, Number(params.get("participationPage")) || 1);
  const organizationPage = Math.max(1, Number(params.get("organizationPage")) || 1);
  const selectedOrganizationCode = params.get("organization") ?? "";
  const organizationQuery = params.get("organizationQ") ?? "";
  const [organizationSearch, setOrganizationSearch] = useState(organizationQuery);
  useEffect(() => setOrganizationSearch(organizationQuery), [organizationQuery]);
  const [draftPeriod, setDraftPeriod] = useState([fromYear, toYear]);
  useEffect(() => setDraftPeriod([fromYear, toYear]), [fromYear, toYear]);
  useEffect(() => {
    if (workType !== "goods" || largeCategory !== "물품") return;
    const next = new URLSearchParams(params);
    next.delete("large");
    next.delete("middle");
    setParams(next, { replace: true });
  }, [largeCategory, params, setParams, workType]);
  const updateFilters = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    next.delete("participationPage");
    next.delete("organizationPage");
    setParams(next, { replace: true });
  };
  const setListPage = (key: "participationPage" | "organizationPage", page: number) => {
    const next = new URLSearchParams(params);
    if (page <= 1) next.delete(key); else next.set(key, String(page));
    setParams(next);
  };
  const query = useCompanyProfile(businessNumber);
  const requestedTab = params.get("tab");
  const tab = requestedTab === "participations" || requestedTab === "organizations" || requestedTab === "companyInfo" ? requestedTab : "relationships";
  const setTab = (nextTab: string) => {
    const next = new URLSearchParams(params);
    if (nextTab === "relationships") next.delete("tab"); else next.set("tab", nextTab);
    next.delete("participationPage");
    next.delete("organizationPage");
    if (nextTab !== "organizations") next.delete("organization");
    setParams(next);
  };
  const activity = useCompanyActivity(businessNumber, { fromYear, toYear, workType: workType || undefined, largeCategory: largeCategory || undefined, middleCategory: middleCategory || undefined, fieldCode: fieldCode || undefined, page: participationPage, pageSize: 20 }, tab === "participations");
  const procurement = useCompanyProcurementProfile(businessNumber, { fromYear, toYear, workType: workType || undefined, largeCategory: largeCategory || undefined, middleCategory: middleCategory || undefined, fieldCode: fieldCode || undefined, page: 1, pageSize: 20 });
  const organizationProcurement = useCompanyProcurementProfile(businessNumber, { fromYear, toYear, workType: workType || undefined, largeCategory: largeCategory || undefined, middleCategory: middleCategory || undefined, fieldCode: fieldCode || undefined, organizationQuery: organizationQuery || undefined, page: organizationPage, pageSize: 20 }, tab === "organizations");
  const competitors = useCompanyCompetitors(businessNumber, { fromYear, toYear, workType: workType || undefined, largeCategory: largeCategory || undefined, middleCategory: middleCategory || undefined, fieldCode: fieldCode || undefined }, tab === "relationships");
  const overviewOrganizationRelationships = procurement.data?.organization_relationships ?? [];
  const organizationRelationships = tab === "organizations" ? (organizationProcurement.data?.organization_relationships ?? []) : overviewOrganizationRelationships;
  const filteredOrganizations = organizationRelationships;
  const contractedOrganizations = filteredOrganizations.filter((organization) => organization.contract_event_count > 0);
  const selectedOrganization = contractedOrganizations.find((organization) => organization.organization_code === selectedOrganizationCode) ?? contractedOrganizations[0];
  const organizationRelationship = useOrganizationCompanyRelationship(selectedOrganization?.organization_code, businessNumber, 1, toYear - fromYear + 1, { workType: workType || undefined, largeCategory: largeCategory || undefined, middleCategory: middleCategory || undefined, fieldCode: fieldCode || undefined }, tab === "organizations", { from: fromYear, to: toYear });
  const summary = procurement.data?.summary;
  const fields = procurement.data?.field_distribution ?? [];
  const appliedField = procurement.data?.analysis_basis?.field_filter;
  const fieldOptions = useMemo(() => [...fields]
    .sort((left, right) => (right.attributed_contract_amount ?? 0) - (left.attributed_contract_amount ?? 0))
    .map((field) => ({ value: procurementFieldIdentity(field) ?? "", label: procurementFieldOptionLabel(field, money, workTypeLabels) }))
    .filter((option) => Boolean(option.value)), [fields]);
  const selectedFieldValue = fieldCode || middleCategory || (largeCategory === "미분류" && workType ? `${largeCategory}::${workType}` : largeCategory);
  const selectedFieldOption = fieldCode ? fields.find((field) => field.selection_filter?.field_code === fieldCode || field.field_code === fieldCode || field.display_code === fieldCode) : undefined;
  const selectedFieldText = appliedField?.field_name || selectedFieldOption?.display_name || selectedFieldOption?.field_name || appliedField?.middle_category || appliedField?.large_category || middleCategory || largeCategory || "선택 분야";
  const visibleFieldOptions = selectedFieldValue && !fieldOptions.some((option) => option.value === selectedFieldValue)
    ? [{ value: selectedFieldValue, label: selectedFieldText }, ...fieldOptions]
    : fieldOptions;
  const periodLabel = fromYear === toYear ? `${fromYear}년` : `${fromYear}–${toYear}년`;
  const setPeriod = (value: number[]) => updateFilters({ fromYear: String(value[0]), toYear: String(value[1]) });
  const selectField = (value: string) => {
    if (!value) return updateFilters({ large: undefined, middle: undefined, field: undefined });
    const field = fields.find((item) => procurementFieldIdentity(item) === value);
    if (!field) return;
    const selection = procurementFieldSelection(field);
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
    return entityDetailPath("organization", organizationCode, { source: "relationship", params, company: businessNumber });
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
    if (value) next.set("organizationQ", value); else next.delete("organizationQ");
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

  const data = query.data ?? { business_registration: [], suppliers: [], industries: [], products: [], sanctions: [], qualifications: [], direct_production: [], partial: true };
  const registration = data.business_registration[0] ?? {};
  const name =
    params.get("name") ??
    String(registration.business_name ?? registration.company_name ?? procurement.data?.company.name ?? "업체 정보");
  const industryNames = data.industries.map((item) => String(item.industry_name ?? item.name ?? item.industry_code ?? "업종정보"));
  const visibleFields = fields.filter((field) => (field.participation_count ?? 0) > 0 || (field.award_event_count ?? 0) > 0 || (field.contract_event_count ?? 0) > 0 || (field.attributed_contract_amount ?? 0) !== 0);
  const appliedProcurementFilters = [
    ...(workType ? [{ key: "workType", label: workTypeLabels[workType] ?? workType, onRemove: () => updateFilters({ workType: undefined, large: undefined, middle: undefined, field: undefined }) }] : []),
    ...(largeCategory ? [{ key: "large", label: appliedField?.large_category ?? largeCategory, onRemove: () => clearFieldLevel("large") }] : []),
    ...(middleCategory ? [{ key: "middle", label: appliedField?.middle_category ?? middleCategory, onRemove: () => clearFieldLevel("middle") }] : []),
    ...(fieldCode ? [{ key: "field", label: selectedFieldText, onRemove: () => clearFieldLevel("field") }] : []),
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index);
  const companyDetail = useCompanyDetailContext(businessNumber, name === "업체 정보" ? undefined : name, tab === "companyInfo");

  return (
    <EntityDetailLayout fallbackTo="/companies" filters={<ProcurementFilterPanel earliestYear={earliestYear} currentYear={currentYear} period={draftPeriod} onPeriodChange={setDraftPeriod} onPeriodCommit={setPeriod} workTypeValue={workType || "all"} workTypeOptions={[{ value: "all", label: "전체" }, ...Object.entries(workTypeLabels).map(([value, label]) => ({ value, label }))]} onWorkTypeChange={(value) => updateFilters({ workType: value === "all" ? undefined : value, large: undefined, middle: undefined, field: undefined })} fieldValue={selectedFieldValue || "all"} fieldOptions={[{ value: "all", label: "전체 분야" }, ...visibleFieldOptions]} onFieldChange={(value) => selectField(value === "all" ? "" : value)} appliedFilters={appliedProcurementFilters} onReset={() => { setDraftPeriod([Math.max(earliestYear, currentYear - 4), currentYear]); updateFilters({ fromYear: undefined, toYear: undefined, workType: undefined, large: undefined, middle: undefined, field: undefined }); }} isUpdating={(procurement.isFetching || activity.isFetching || organizationProcurement.isFetching) && Boolean(procurement.data || activity.data || organizationProcurement.data)} />}>
      <header className="border-b pb-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge className="border-0 bg-teal-100 text-teal-800 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-200">업체</Badge><span>사업자등록번호 {businessNumber}</span></div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
            {industryNames.length > 0 && <button className="mt-2 text-left text-xs text-muted-foreground hover:text-foreground" onClick={() => setTab("companyInfo")} type="button"><span className="font-medium text-foreground">등록 업종</span> · {industryNames.slice(0, 2).join(" · ")}{industryNames.length > 2 ? ` · +${industryNames.length - 2}` : ""} <span className="whitespace-nowrap">전체 보기</span></button>}
          </div>
        </div>
      </header>

      {procurement.isLoading && !procurement.data && <EntityDetailContentSkeleton />}
      {procurement.isError && (
        <p className="mt-10 rounded-xl border p-5 text-sm text-muted-foreground">
          조달 활동을 불러오지 못했습니다.
        </p>
      )}
      {procurement.data && (
        <>
          <EntityTabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "relationships", label: "개요" },
              { id: "participations", label: "입찰 이력", count: summary?.participation_count },
              { id: "organizations", label: "계약 기관" },
              { id: "companyInfo", label: "기업 정보" },
            ]}
          />

          {tab === "relationships" && (
            <section className="mt-8">
              <div>
                <h2 className="text-xl font-bold tracking-tight">입찰·수주 현황</h2>
                <p className="mt-2 text-sm text-muted-foreground">{periodLabel}의 입찰 참여와 수주 실적입니다.</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {[
                    ["입찰 참여", summary ? `${summary.participation_count.toLocaleString("ko-KR")}건` : "-"],
                    ["낙찰", summary ? `${summary.award_event_count.toLocaleString("ko-KR")}건` : "-"],
                    ["수주 성공률", summary?.award_success_rate != null ? `${(summary.award_success_rate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%` : "산출 불가"],
                    ["계약금액", money(summary?.total_attributed_contract_amount)],
                    ["발주기관", summary ? `${summary.organization_count.toLocaleString("ko-KR")}개` : "-"],
                  ].map(([label, value]) => <div className="rounded-xl bg-muted/50 p-4" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-bold">{value}</dd></div>)}
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">계약 {summary?.contract_event_count.toLocaleString("ko-KR") ?? "-"}건{summary?.contract_event_count && summary.total_attributed_contract_amount != null ? ` · 건당 평균 ${money(summary.total_attributed_contract_amount / summary.contract_event_count)}` : ""}</p>
              </div>
              <div className="mt-10 grid gap-8 lg:grid-cols-2">
                <div className="lg:col-span-2"><h2 className="text-xl font-bold tracking-tight">주요 활동 분야</h2><p className="mt-2 text-sm text-muted-foreground">주로 참여하는 분야와 수주 성과입니다.</p><DataTable className="mt-5" minWidth={640}><thead><tr><th>분야</th><th className="text-right">참여</th><th className="text-right">낙찰</th><th className="text-right">성공률</th><th className="text-right">계약금액</th></tr></thead><tbody>{visibleFields.slice(0, 8).map((field) => { const label = field.display_name ?? field.field_name ?? field.middle_category ?? field.large_category ?? "미분류"; const participation = field.participation_count ?? 0; const awards = field.award_event_count ?? 0; return <tr key={`${label}-${field.display_code ?? field.field_code ?? ""}`}><td className="font-medium">{label}</td><td className="text-right">{participation.toLocaleString("ko-KR")}건</td><td className="text-right">{awards.toLocaleString("ko-KR")}건</td><td className="text-right">{field.award_success_rate != null ? `${(field.award_success_rate * 100).toFixed(1)}%` : "-"}</td><td className="text-right font-semibold">{money(field.attributed_contract_amount)}</td></tr>; })}</tbody></DataTable>{!visibleFields.length && <p className="p-6 text-center text-sm text-muted-foreground">분야 데이터가 없습니다.</p>}</div>
              </div>
              <div className="mt-10"><h2 className="text-xl font-bold tracking-tight">입찰·수주 추이</h2><p className="mt-2 text-sm text-muted-foreground">연도별 참여와 낙찰 실적입니다.</p><div className="mt-5 space-y-4 rounded-2xl border p-5">{(procurement.data?.yearly_activity ?? []).slice().sort((a, b) => a.year - b.year).map((item) => { const max = Math.max(1, ...(procurement.data?.yearly_activity ?? []).map((row) => row.participation_count ?? 0)); return <div key={item.year}><div className="mb-2 flex justify-between gap-4 text-sm"><span className="font-medium">{item.year}년{item.year === currentYear ? " 누적" : ""}</span><span><strong>참여 {item.participation_count.toLocaleString("ko-KR")}건 · 낙찰 {item.award_event_count.toLocaleString("ko-KR")}건</strong><span className="ml-2 text-xs text-muted-foreground">성공률 {item.award_success_rate != null ? (item.award_success_rate * 100).toFixed(1) : "-"}% · {money(item.attributed_contract_amount)}</span></span></div><span className="block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-800 dark:bg-blue-500" style={{ width: `${((item.participation_count ?? 0) / max) * 100}%` }} /></span></div>; })}</div></div>
              <div className="mt-10">
              <div>
                <h2 className="text-xl font-bold tracking-tight">주요 발주기관</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  선택한 조건에서 이 업체와 연결된 주요 발주기관입니다.
                </p>
                <DataTable className="mt-5" minWidth={760}>
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold">기관</th>
                        <th className="px-3 py-3 text-right font-semibold">참여</th>
                        <th className="px-3 py-3 text-right font-semibold">낙찰</th>
                        <th className="px-3 py-3 text-right font-semibold">성공률</th>
                        <th className="px-3 py-3 text-right font-semibold">계약금액</th>
                        <th className="px-4 py-3 text-right font-semibold">활동 기간</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {overviewOrganizationRelationships.slice(0, 10).map((organization) => (
                        <tr className="hover:bg-teal-50/35 dark:hover:bg-teal-950/10" key={organization.organization_code ?? organization.organization_name}>
                          <td className="px-4 py-3">
                            {organization.organization_code ? (
                              <Link className="font-semibold hover:text-teal-700 hover:underline" to={organizationHref(organization.organization_code)}>
                                {organization.organization_name}
                              </Link>
                            ) : <span className="font-semibold">{organization.organization_name}</span>}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{organization.participation_count}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{organization.award_event_count}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{organization.contract_event_count > 0 && organization.award_event_count === 0 ? "확인 불가" : organization.award_success_rate != null ? `${(organization.award_success_rate * 100).toFixed(1)}%` : "-"}</td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">{money(organization.total_attributed_contract_amount)}{organization.amount_completeness !== "complete" ? "*" : ""}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{organization.active_years?.length ? `${Math.min(...organization.active_years)}–${Math.max(...organization.active_years)}` : "-"}</td>
                        </tr>
                      ))}
                    </tbody>

                  {!overviewOrganizationRelationships.length && (
                    <tbody><tr><td className="app-data-table-empty" colSpan={6}>연결된 발주기관이 아직 확인되지 않았습니다.</td></tr></tbody>
                  )}
                </DataTable>
                {overviewOrganizationRelationships.some((item) => item.amount_completeness !== "complete") && (
                  <p className="mt-2 text-xs text-muted-foreground">* 일부 계약은 업체 귀속금액이 불완전할 수 있습니다.</p>
                )}
              </div>
              <div className="mt-10"><h2 className="text-xl font-bold tracking-tight">주요 경쟁 업체</h2><p className="mt-2 text-sm text-muted-foreground">동일한 입찰에 자주 참여한 업체입니다.</p>{competitors.isLoading && <Skeleton className="mt-5 h-44 rounded-xl" />}{!competitors.isLoading && <DataTable className="mt-5" minWidth={520}><thead><tr><th>업체</th><th className="text-right">동시 참여</th><th className="text-right">최근 동시 참여</th></tr></thead><tbody>{(competitors.data?.items ?? []).map((company) => <tr key={company.company_number}><td><Link className="font-semibold hover:underline" to={entityDetailPath("company", company.company_number, { source: "relationship", params, name: company.company_name })}>{company.company_name}</Link></td><td className="text-right font-medium">{company.co_participation_count.toLocaleString("ko-KR")}회</td><td className="text-right text-muted-foreground">{company.latest_co_participation_date?.slice(0, 7) ?? "-"}</td></tr>)}{!(competitors.data?.items.length) && <tr><td className="app-data-table-empty" colSpan={3}>확인된 경쟁 업체가 없습니다.</td></tr>}</tbody></DataTable>}{competitors.data?.data_completeness?.status === "partial" && <p className="mt-2 text-xs text-muted-foreground">개찰 상위 10개 업체 및 낙찰업체로 확인 가능한 범위입니다.</p>}</div>
              </div>
            </section>
          )}

          {tab === "participations" && (
            <section className="mt-8">
              <div className="mb-5"><h2 className="text-xl font-bold tracking-tight">입찰 이력</h2><p className="mt-2 text-sm text-muted-foreground">이 업체가 참여한 입찰과 순위를 확인합니다.</p></div>
              <div className="divide-y rounded-xl border">
                {(activity.data?.items ?? []).map((item) => (
                  <Link
                    key={item.bid_notice_id ?? item.id}
                    to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
                    className="flex items-center justify-between gap-5 p-4 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">{item.notice_name ?? `공고 ${item.notice_number ?? ""}-${item.notice_order ?? ""}`}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">{item.organization_name ?? "기관 미상"} · {(item.participation_date ?? item.bid_at)?.slice(0, 10) ?? "일자 미상"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">투찰 {money(item.bid_amount)} · 낙찰 {money(item.winning_amount)}{item.participant_count != null ? ` · 참여업체 ${item.participant_count}개` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.result === "contract" || item.result === "award" ? "default" : "secondary"}>{{ contract: "계약", award: "낙찰", unsuccessful: "미낙찰", unknown: "결과 미상" }[item.result ?? "unknown"]}</Badge>
                      {item.rank != null && <Badge variant="secondary">{item.rank}순위</Badge>}
                      <ArrowUpRight className="size-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
              {!activity.isLoading && !activity.isError && !(activity.data?.items.length) && <ListEmptyState title="입찰 이력이 없습니다" description="선택한 연도·조달 유형·분야에 해당하는 참여 이력이 없습니다." onReset={() => updateFilters({ fromYear: undefined, toYear: undefined, workType: undefined, large: undefined, middle: undefined, field: undefined })} />}
              {activity.isLoading && !activity.data && <div className="space-y-3 rounded-2xl border p-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}
              {activity.isError && <SectionError error={activity.error} title="입찰 이력" onRetry={() => activity.refetch()} />}
              <ListPagination label="입찰 이력 페이지" loading={activity.isFetching} page={activity.data?.pagination.page ?? participationPage} totalPages={activity.data?.pagination.total_pages} onChange={(page) => setListPage("participationPage", page)} />
            </section>
          )}
          {tab === "organizations" && (
            <section className="relative mt-8">
              <div className="mb-5"><h2 className="text-xl font-bold tracking-tight">계약 기관 조회</h2><p className="mt-2 text-sm text-muted-foreground">계약한 기관을 선택해 계약 관계를 확인합니다.</p></div>
              <form className="flex w-full max-w-xl gap-2" onSubmit={submitOrganizationSearch}><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9 pr-9" disabled={organizationProcurement.isFetching} onChange={(event) => setOrganizationSearch(event.target.value)} placeholder="계약 기관명 검색" value={organizationSearch} />{organizationSearch && <button aria-label="기관 검색 초기화" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={clearOrganizationSearch} type="button"><X className="size-4" /></button>}</div><Button disabled={organizationProcurement.isFetching} type="submit">검색</Button></form>
              <div className="mt-4 flex flex-wrap gap-2">{contractedOrganizations.slice(0, organizationSearch ? 20 : 12).map((organization) => <button aria-pressed={organization.organization_code === selectedOrganization?.organization_code} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${organization.organization_code === selectedOrganization?.organization_code ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "bg-background text-muted-foreground hover:border-blue-300 hover:text-[var(--brand)]"}`} key={organization.organization_code ?? organization.organization_name} onClick={() => organization.organization_code && selectOrganization(organization.organization_code)} type="button">{organization.organization_name}</button>)}</div>
              {organizationProcurement.isLoading && !organizationProcurement.data && <div className="mt-6 space-y-3 rounded-2xl border p-5"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div>}
              {organizationProcurement.isError && <div className="mt-6"><SectionError error={organizationProcurement.error} title="계약 기관" onRetry={() => organizationProcurement.refetch()} /></div>}
              {!organizationProcurement.isLoading && !organizationProcurement.isError && !contractedOrganizations.length && <div className="mt-6"><ListEmptyState title="계약 기관이 없습니다" description="선택한 조건에서 계약이 확인된 기관이 없습니다." onReset={() => updateFilters({ fromYear: undefined, toYear: undefined, workType: undefined, large: undefined, middle: undefined, field: undefined })} /></div>}
              {selectedOrganization && <RelationshipAnalysis eyebrow="업체 × 기관" title={`${name} × ${selectedOrganization.organization_name}`} context={`${periodLabel}${[workType ? workTypeLabels[workType] ?? workType : "", selectedFieldText].filter(Boolean).length ? ` · ${[workType ? workTypeLabels[workType] ?? workType : "", selectedFieldText].filter(Boolean).join(" · ")}` : ""} 계약 기준`} summary={{ contractCount: selectedOrganization.contract_event_count, amount: selectedOrganization.total_attributed_contract_amount, activeYearCount: selectedOrganization.active_year_count, latestContract: selectedOrganization.latest_contract_date ?? selectedOrganization.latest_activity_date }} years={Array.from({ length: toYear - fromYear + 1 }, (_, index) => fromYear + index)} yearlyActivity={selectedOrganization.yearly_activity} fields={selectedOrganization.major_fields ?? []} events={organizationRelationship.data?.events ?? []} money={money} profileLink={selectedOrganization.organization_code ? { to: organizationHref(selectedOrganization.organization_code), label: "기관 프로필" } : undefined} />}
              <ListPagination label="계약 기관 페이지" loading={organizationProcurement.isFetching} page={organizationProcurement.data?.pagination?.page ?? organizationPage} totalPages={organizationProcurement.data?.pagination?.total_pages} onChange={(page) => setListPage("organizationPage", page)} />
            </section>
          )}
          {tab === "companyInfo" && <CompanyInformationPanel industries={data.industries} query={companyDetail} />}
        </>
      )}
    </EntityDetailLayout>
  );
}
