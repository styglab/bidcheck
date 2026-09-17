import { ArrowLeft, ExternalLink, Landmark } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { EntityTabs } from "@/components/common/entity-tabs";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotices } from "../features/notices/api";
import { useOrganization, useOrganizationActivity } from "../features/organizations/api";

const money = (value?: number) => value == null ? "금액 미상" : `${value.toLocaleString("ko-KR")}원`;

export function OrganizationDetailPage() {
  const { organizationId } = useParams();
  const organizationQuery = useOrganization(organizationId);
  const noticeQuery = useNotices({ demand_organization_code: organizationId, page_size: 10 });
  const activity = useOrganizationActivity(organizationId);
  const [tab, setTab] = useState("overview");
  const organization = organizationQuery.data?.organization; const notices = noticeQuery.data?.items ?? [];
  if (organizationQuery.isLoading) return <PageContainer><Skeleton className="h-8 w-40" /><Skeleton className="mt-8 h-40 rounded-xl" /></PageContainer>;
  if (organizationQuery.isError) return <PageContainer><p className="rounded-xl bg-red-50 p-5 text-red-700">기관 정보를 불러오지 못했습니다. {organizationQuery.error.message}</p></PageContainer>;
  return <PageContainer>
    <Link className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-blue-800" to="/organizations"><ArrowLeft size={15} />기관 찾기</Link>
    <header className="mt-7 flex items-start gap-4"><span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-800"><Landmark /></span><div><h1 className="text-3xl font-bold tracking-tight">{organization?.name}</h1><p className="mt-2 text-sm text-muted-foreground">{organization?.jurisdiction_type ?? "기관 유형 미상"} · 기관코드 {organizationId}</p></div></header>
    <div className="mt-8 grid gap-4 md:grid-cols-3"><Card className="shadow-none"><CardContent className="p-5"><small className="text-muted-foreground">최근 90일 공고</small><strong className="mt-1 block text-2xl">{noticeQuery.data?.pagination.total_items ?? "-"}건</strong></CardContent></Card><Card className="shadow-none"><CardContent className="p-5"><small className="text-muted-foreground">최근 1년 낙찰</small><strong className="mt-1 block text-2xl">{activity.data?.award_pagination.total_items ?? "-"}건</strong></CardContent></Card><Card className="shadow-none"><CardContent className="p-5"><small className="text-muted-foreground">최근 1년 계약</small><strong className="mt-1 block text-2xl">{activity.data?.contract_pagination.total_items ?? "-"}건</strong></CardContent></Card></div>
    {activity.isLoading && <Skeleton className="mt-10 h-48 rounded-xl" />}{activity.isError && <p className="mt-10 rounded-xl border p-5 text-sm text-muted-foreground">낙찰·계약 정보를 불러오지 못했습니다.</p>}{activity.data && <>
      <EntityTabs value={tab} onChange={setTab} items={[{ id: "overview", label: "개요" }, { id: "notices", label: "공고", count: noticeQuery.data?.pagination.total_items }, { id: "awards", label: "낙찰", count: activity.data.award_pagination.total_items }, { id: "contracts", label: "계약", count: activity.data.contract_pagination.total_items }]} />
      {tab === "overview" && <section className="mt-6 grid gap-6 lg:grid-cols-2"><div><h2 className="text-lg font-bold">최근 공고</h2><div className="mt-3 divide-y rounded-xl border">{notices.slice(0, 3).map((notice) => <Link className="block p-4 hover:bg-muted/50" key={notice.id} to={`/notices/${encodeURIComponent(notice.id)}`}><strong className="block truncate text-sm">{notice.name}</strong><small className="mt-1 block text-muted-foreground">{notice.notice_number}-{notice.notice_order}</small></Link>)}</div></div><div><h2 className="text-lg font-bold">최근 낙찰업체</h2><div className="mt-3 divide-y rounded-xl border">{activity.data.awards.slice(0, 3).map((item) => <Link className="block p-4 hover:bg-muted/50" key={item.id} to={`/companies/${item.company_number}`}><strong className="text-sm">{item.company_name}</strong><p className="mt-1 text-xs text-muted-foreground">{item.notice_name} · {money(item.winning_amount)}</p></Link>)}</div></div></section>}
      {tab === "notices" && <section className="mt-6">{noticeQuery.isLoading ? <Skeleton className="h-40 rounded-xl" /> : <div className="divide-y rounded-xl border">{notices.map((notice) => <Link className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50" key={notice.id} to={`/notices/${encodeURIComponent(notice.id)}`}><span><strong className="block truncate">{notice.name}</strong><small className="mt-1 block text-muted-foreground">{notice.notice_number}-{notice.notice_order}</small></span><span className="text-sm text-blue-800">공고 보기</span></Link>)}</div>}</section>}
      {tab === "awards" && <section className="mt-6"><div className="divide-y rounded-xl border">{activity.data.awards.map((item) => <div className="flex items-center justify-between gap-5 p-4" key={item.id}><div><Link className="font-semibold hover:text-blue-800 hover:underline" to={`/companies/${item.company_number}`}>{item.company_name}</Link><p className="mt-1 text-xs text-muted-foreground"><Link className="hover:underline" to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}>{item.notice_name}</Link> · {money(item.winning_amount)}</p></div><Badge variant="secondary">{item.award_date ?? "낙찰"}</Badge></div>)}</div></section>}
      {tab === "contracts" && <section className="mt-6"><div className="divide-y rounded-xl border">{activity.data.contracts.map((item) => <div className="flex items-center justify-between gap-5 p-4" key={item.id}><div><strong className="text-sm">{item.name}</strong><p className="mt-1 text-xs text-muted-foreground">{item.concluded_date ?? "계약일 미상"} · {money(item.amount)}</p></div><div className="flex gap-3">{item.bid_notice_id && <Link className="text-sm font-medium text-blue-800 hover:underline" to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}>공고</Link>}{item.detail_url && <a href={item.detail_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>}</div></div>)}</div></section>}
    </>}
  </PageContainer>;
}
