import { ArrowLeft, ArrowUpRight, Building2, ExternalLink } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { EntityTabs } from "@/components/common/entity-tabs";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyActivity, useCompanyProfile } from "../features/company-context/api";

const money = (value?: number) => value == null ? "금액 미상" : `${value.toLocaleString("ko-KR")}원`;
const day = (value?: string) => value ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : "일자 미상";

export function CompanyDetailPage() {
  const { businessNumber } = useParams();
  const [params] = useSearchParams();
  const query = useCompanyProfile(businessNumber);
  const activity = useCompanyActivity(businessNumber);
  const [tab, setTab] = useState("overview");
  if (query.isLoading) return <PageContainer><Skeleton className="h-8 w-40" /><Skeleton className="mt-8 h-48 rounded-xl" /></PageContainer>;
  if (query.isError) return <PageContainer><p className="rounded-xl bg-red-50 p-5 text-red-700">업체 정보를 불러오지 못했습니다. {query.error.message}</p></PageContainer>;
  const data = query.data!; const registration = data.business_registration[0] ?? {};
  const name = params.get("name") ?? String(registration.business_name ?? registration.company_name ?? "업체 정보");
  return <PageContainer>
    <Link className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-blue-800" to="/companies"><ArrowLeft size={15} />업체 찾기</Link>
    <header className="mt-7 flex items-start gap-4"><span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-800"><Building2 /></span><div><h1 className="text-3xl font-bold tracking-tight">{name}</h1><p className="mt-2 text-sm text-muted-foreground">사업자등록번호 {businessNumber}</p></div></header>
    <div className="mt-8 grid gap-4 md:grid-cols-3"><Card className="shadow-none"><CardContent className="p-5"><small className="text-muted-foreground">최근 1년 참여</small><strong className="mt-1 block text-2xl">{activity.data?.pagination.total_items ?? "-"}건</strong></CardContent></Card><Card className="shadow-none"><CardContent className="p-5"><small className="text-muted-foreground">최근 1년 낙찰</small><strong className="mt-1 block text-2xl">{activity.data?.award_pagination.total_items ?? "-"}건</strong></CardContent></Card><Card className="shadow-none"><CardContent className="p-5"><small className="text-muted-foreground">전체 계약</small><strong className="mt-1 block text-2xl">{activity.data?.contract_count ?? "-"}건</strong></CardContent></Card></div>
    {activity.isLoading && <Skeleton className="mt-10 h-48 rounded-xl" />}{activity.isError && <p className="mt-10 rounded-xl border p-5 text-sm text-muted-foreground">조달 활동을 불러오지 못했습니다.</p>}
    {activity.data && <>
      <EntityTabs value={tab} onChange={setTab} items={[{ id: "overview", label: "개요" }, { id: "participations", label: "참여공고", count: activity.data.pagination.total_items }, { id: "awards", label: "낙찰", count: activity.data.award_pagination.total_items }, { id: "contracts", label: "계약", count: activity.data.contract_count }]} />
      {tab === "overview" && <section className="mt-6 grid gap-6 lg:grid-cols-2"><div><h2 className="text-lg font-bold">최근 낙찰</h2><div className="mt-3 divide-y rounded-xl border">{activity.data.awards.slice(0, 3).map((item) => <Link className="block p-4 hover:bg-muted/50" key={item.id} to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}><strong className="block truncate text-sm">{item.notice_name}</strong><p className="mt-1 text-xs text-muted-foreground">{item.organization_name} · {money(item.winning_amount)}</p></Link>)}</div></div><div><h2 className="text-lg font-bold">등록 업종</h2><div className="mt-3 flex flex-wrap gap-2 rounded-xl border p-4">{data.industries.map((item, index) => <Badge variant="secondary" key={index}>{String(item.industry_name ?? item.name ?? item.industry_code ?? "업종정보")}</Badge>)}{!data.industries.length && <p className="text-sm text-muted-foreground">등록된 업종정보가 없습니다.</p>}</div></div></section>}
      {tab === "participations" && <section className="mt-6"><div className="divide-y rounded-xl border">{activity.data.items.map((item) => <Link key={item.id} to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`} className="flex items-center justify-between gap-5 p-4 hover:bg-muted/50"><div><strong className="text-sm">공고 {item.notice_number}-{item.notice_order}</strong><p className="mt-1 text-xs text-muted-foreground">{day(item.bid_at)} · 투찰 {money(item.bid_amount)}</p></div><div className="flex items-center gap-2">{item.rank != null && <Badge variant="secondary">{item.rank}순위</Badge>}<ArrowUpRight className="size-4 text-muted-foreground" /></div></Link>)}</div></section>}
      {tab === "awards" && <section className="mt-6"><div className="divide-y rounded-xl border">{activity.data.awards.map((item) => <div className="flex items-center justify-between gap-5 p-4" key={item.id}><div><Link className="font-semibold hover:text-blue-800 hover:underline" to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}>{item.notice_name ?? item.notice_number}</Link><p className="mt-1 text-xs text-muted-foreground">{item.organization_code ? <Link className="hover:underline" to={`/organizations/${encodeURIComponent(item.organization_code)}`}>{item.organization_name}</Link> : item.organization_name} · {money(item.winning_amount)}</p></div><Badge>낙찰</Badge></div>)}</div></section>}
      {tab === "contracts" && <section className="mt-6"><div className="divide-y rounded-xl border">{activity.data.contracts.map((item) => <div className="flex items-center justify-between gap-5 p-4" key={item.id}><div><strong className="text-sm">{item.name ?? item.id}</strong><p className="mt-1 text-xs text-muted-foreground">{item.organization_code && <><Link className="hover:underline" to={`/organizations/${encodeURIComponent(item.organization_code)}`}>기관 {item.organization_code}</Link> · </>}{day(item.concluded_date)} · {money(item.amount)}</p></div><div className="flex gap-3">{item.bid_notice_id && <Link className="text-sm font-medium text-blue-800 hover:underline" to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}>공고</Link>}{item.detail_url && <a href={item.detail_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>}</div></div>)}</div></section>}
    </>}
  </PageContainer>;
}
