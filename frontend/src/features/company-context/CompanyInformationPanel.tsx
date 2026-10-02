import { ExternalLink } from "lucide-react";
import { SectionError } from "@/components/common/error-state";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactMoney } from "@/shared/format/money";
import type { CompanyDetailContext, CompanyFinancialPeriod } from "./api";

const statusLabels: Record<string, string> = {
  active: "계속사업자",
  closed: "폐업자",
  suspended: "휴업자",
  general_taxpayer: "일반과세자",
  simplified_taxpayer: "간이과세자",
  tax_exempt: "면세사업자",
};
const factLabels: Record<string, string> = {
  revenue: "매출액",
  operating_profit: "영업이익",
  net_income: "당기순이익",
  total_assets: "자산총계",
  total_liabilities: "부채총계",
  total_equity: "자본총계",
};

const value = (input: unknown) => input == null || input === "" ? undefined : String(input);
const amount = (input: unknown) => {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? formatCompactMoney(parsed) : "-";
};
const objectProperties = (data: CompanyDetailContext, type: string) =>
  data.company_profile.find((item) => item.type === type)?.properties ?? {};
const financialValue = (period: CompanyFinancialPeriod, accountId: string) =>
  period.objects.find((item) => item.type === "financial_fact" && item.properties.account_id === accountId)?.properties.amount;

export function CompanyInformationPanel({ query, industries }: { query: { data?: CompanyDetailContext; isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown }; industries: Array<Record<string, unknown>> }) {
  if (query.isLoading) return <div className="mt-8 space-y-6" aria-label="기업 정보를 불러오는 중" role="status"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>;
  if (query.isError) return <div className="mt-8"><SectionError error={query.error} title="기업 정보" onRetry={() => query.refetch()} /></div>;
  if (!query.data) return null;

  const data = query.data;
  const legal = objectProperties(data, "legal_entity");
  const address = objectProperties(data, "postal_address");
  const taxpayer = data.business_status[0]?.properties ?? {};
  const representatives = Array.isArray(legal.representative_names) ? legal.representative_names.join(", ") : value(legal.representative_names);
  const profileItems = [
    ["법인명", value(legal.legal_name)], ["대표자", representatives], ["설립일", value(legal.established_date)],
    ["법인등록번호", data.resolution.corporate_registration_number], ["업종", value(legal.standard_industry_classification_name)],
    ["주소", value(address.full_address)], ["전화", value(legal.telephone_number)], ["홈페이지", value(legal.website_url)],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const availableFinancials = data.financials.filter((item) => item.status === "available").sort((a, b) => b.fiscal_year - a.fiscal_year);

  return <section className="mt-8 space-y-10">
    <div>
      <h2 className="text-xl font-bold tracking-tight">기업 기본정보</h2>
      <p className="mt-2 text-sm text-muted-foreground">금융위원회에서 확인된 기업 기본정보입니다.</p>
      {data.resolution.status === "unresolved" && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">사업자등록번호와 일치하는 법인정보를 확인하지 못했습니다. 확인 가능한 사업자 정보만 표시합니다.</p>}
      <div className="mt-5 rounded-2xl border">
        <div className="flex flex-wrap items-center gap-2 border-b p-4 text-sm"><strong>{statusLabels[String(taxpayer.operating_status)] ?? "사업자 상태 확인 필요"}</strong>{Boolean(taxpayer.current_taxation_type) && <span className="text-muted-foreground">· {statusLabels[String(taxpayer.current_taxation_type)] ?? String(taxpayer.current_taxation_type)}</span>}<span className="ml-auto text-xs text-muted-foreground">국세청 기준 · {value(taxpayer.observed_at)?.slice(0, 10) ?? "확인일 미상"} 확인</span></div>
        {profileItems.length ? <dl className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2">{profileItems.map(([label, itemValue]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{label === "홈페이지" ? <a className="inline-flex items-center gap-1 hover:underline" href={itemValue.startsWith("http") ? itemValue : `https://${itemValue}`} rel="noreferrer" target="_blank">{itemValue}<ExternalLink className="size-3" /></a> : itemValue}</dd></div>)}</dl> : <p className="p-5 text-sm text-muted-foreground">확인된 기업 기본정보가 없습니다.</p>}
      </div>
    </div>

    <div>
      <h2 className="text-xl font-bold tracking-tight">등록 업종</h2>
      <p className="mt-2 text-sm text-muted-foreground">조달 등록정보에서 확인된 업종입니다.</p>
      <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border p-5">
        {industries.map((item, index) => <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium" key={`${String(item.industry_code ?? "")}-${index}`}>{String(item.industry_name ?? item.name ?? item.industry_code ?? "업종정보")}</span>)}
        {!industries.length && <p className="text-sm text-muted-foreground">등록된 업종정보가 없습니다.</p>}
      </div>
    </div>

    <div>
      <h2 className="text-xl font-bold tracking-tight">재무정보</h2>
      <p className="mt-2 text-sm text-muted-foreground">금융위원회에서 확인 가능한 최근 사업연도의 요약 재무정보입니다.</p>
      {availableFinancials.length ? <DataTable className="mt-5" minWidth={680}><thead><tr><th>사업연도</th>{Object.values(factLabels).map((label) => <th className="text-right" key={label}>{label}</th>)}</tr></thead><tbody>{availableFinancials.map((period) => <tr key={period.fiscal_year}><td className="font-semibold">{period.fiscal_year}년</td>{Object.keys(factLabels).map((account) => <td className="text-right tabular-nums" key={account}>{amount(financialValue(period, account))}</td>)}</tr>)}</tbody></DataTable> : <p className="mt-5 rounded-xl border p-5 text-sm text-muted-foreground">확인 가능한 재무정보가 없습니다.</p>}
      {data.sections.financials?.completeness === "partial" && <p className="mt-2 text-xs text-muted-foreground">최근 조회 범위에서 자료가 확인된 연도만 표시합니다.</p>}
    </div>

    <div>
      <h2 className="text-xl font-bold tracking-tight">기업 관계</h2>
      <p className="mt-2 text-sm text-muted-foreground">금융위원회에서 확인된 계열회사·종속기업 관계입니다.</p>
      {data.relationships.length ? <div className="mt-5 divide-y rounded-xl border">{data.relationships.map((relationship) => <div className="p-4 text-sm" key={relationship.id}><strong>{value(relationship.properties.related_company_name) ?? value(relationship.properties.company_name) ?? "관계 기업"}</strong><p className="mt-1 text-xs text-muted-foreground">{value(relationship.properties.relationship_type_name) ?? value(relationship.properties.relationship_type) ?? "기업 관계"}</p></div>)}</div> : <p className="mt-5 rounded-xl border p-5 text-sm text-muted-foreground">확인된 기업 관계정보가 없습니다.</p>}
    </div>

    <div className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
      <p>출처: {data.sources.map((source) => ({ fsc_company_basic: "금융위원회 기업개요", fsc_company_financial: "금융위원회 재무정보", nts_business_registration: "국세청 사업자등록 상태" })[source] ?? source).join(" · ") || "공공데이터"}{data.observed_at ? ` · 조회 ${data.observed_at.slice(0, 10)}` : ""}</p>
      <p className="mt-1">출처별 갱신 시점과 제공 범위에 따라 실제 현황과 차이가 있을 수 있습니다.</p>
    </div>
  </section>;
}
