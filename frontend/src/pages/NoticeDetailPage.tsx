import { ArrowLeft, Building2, ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { EntityTabs } from "@/components/common/entity-tabs";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotice, useNoticeActivity } from "../features/notices/api";

const money = (value?: number) => value == null ? "미정" : `${value.toLocaleString("ko-KR")}원`;
const dateTime = (value?: string) => value ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "미정";

export function NoticeDetailPage() {
  const { noticeId } = useParams();
  const query = useNotice(noticeId);
  const activity = useNoticeActivity(noticeId);
  const [tab, setTab] = useState("overview");
  if (query.isLoading) return <PageContainer><Skeleton className="h-8 w-32" /><Skeleton className="mt-8 h-48 rounded-xl" /></PageContainer>;
  if (query.isError) return <PageContainer><p className="rounded-xl bg-red-50 p-5 text-red-700">공고를 불러오지 못했습니다. {query.error.message}</p></PageContainer>;
  const notice = query.data!.notice;
  return <PageContainer>
    <Link className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-blue-800" to="/notices"><ArrowLeft size={15} />공고 찾기</Link>
    <header className="mt-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-start"><div className="min-w-0"><p className="text-xs text-muted-foreground">{notice.notice_number}-{notice.notice_order}</p><h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight">{notice.name}</h1><p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><Building2 size={15} />{notice.organization_code ? <Link className="font-medium hover:text-blue-800 hover:underline" to={`/organizations/${encodeURIComponent(notice.organization_code)}`}>{notice.organization}</Link> : notice.organization}</p></div>{notice.detail_url && <Button variant="outline" asChild><a href={notice.detail_url} target="_blank" rel="noreferrer">나라장터 원문 <ExternalLink size={14} /></a></Button>}</header>
    <dl className="mt-7 grid grid-cols-2 overflow-hidden rounded-xl border lg:grid-cols-4">{[["예산", money(notice.allocated_budget)], ["계약방법", notice.contract_method ?? "-"], ["게시일", dateTime(notice.published_at)], ["마감일", dateTime(notice.deadline_at)]].map(([label, value]) => <div className="border-b border-r p-4 lg:border-b-0" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1.5 text-sm font-semibold">{value}</dd></div>)}</dl>
    <EntityTabs value={tab} onChange={setTab} items={[{ id: "overview", label: "공고 개요" }, { id: "opening", label: "개찰·낙찰", count: activity.data?.participations.length }, { id: "contracts", label: "계약", count: activity.data?.contracts.length }]} />
    {activity.isLoading && tab !== "overview" && <Skeleton className="mt-6 h-44 rounded-xl" />}{activity.isError && tab !== "overview" && <p className="mt-6 rounded-xl border p-5 text-sm text-muted-foreground">조달 활동을 불러오지 못했습니다.</p>}
    {tab === "overview" && <section className="mt-6 rounded-xl border p-5"><h2 className="font-semibold">공고 정보</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">발주기관</dt><dd className="mt-1 font-medium">{notice.organization}</dd></div><div><dt className="text-muted-foreground">입찰방법</dt><dd className="mt-1 font-medium">{notice.bid_method ?? "미정"}</dd></div><div><dt className="text-muted-foreground">개찰일</dt><dd className="mt-1 font-medium">{dateTime(notice.opening_at)}</dd></div><div><dt className="text-muted-foreground">업무구분</dt><dd className="mt-1 font-medium">{notice.work_type ?? "미정"}</dd></div></dl></section>}
    {tab === "opening" && activity.data && <section className="mt-6"><div className="overflow-hidden rounded-xl border">{activity.data.awards.map((item) => <div className="flex items-center justify-between gap-4 border-b bg-emerald-50/50 p-4" key={item.id}><div><Badge className="mb-2 bg-emerald-700">낙찰</Badge><Link className="block font-semibold hover:text-blue-800 hover:underline" to={`/companies/${item.company_number}`}>{item.company_name}</Link><p className="mt-1 text-xs text-muted-foreground">낙찰금액 {money(item.winning_amount)}{item.winning_rate ? ` · 낙찰률 ${item.winning_rate}%` : ""}</p></div><span className="text-sm text-muted-foreground">{item.award_date ?? ""}</span></div>)}{activity.data.participations.map((item) => <div className="flex items-center justify-between gap-4 border-b p-4 last:border-0" key={item.id}><div><Link className="font-semibold hover:text-blue-800 hover:underline" to={`/companies/${item.company_number}`}>{item.company_name}</Link><p className="mt-1 text-xs text-muted-foreground">투찰 {money(item.bid_amount)} · {item.remark ?? item.result ?? "결과 확인"}</p></div>{item.rank != null && <Badge variant="secondary">{item.rank}순위</Badge>}</div>)}{!activity.data.awards.length && !activity.data.participations.length && <p className="p-8 text-center text-sm text-muted-foreground">확인된 개찰·낙찰 정보가 없습니다.</p>}</div></section>}
    {tab === "contracts" && activity.data && <section className="mt-6"><div className="overflow-hidden rounded-xl border">{activity.data.contracts.map((item) => <div className="flex items-center justify-between gap-4 border-b p-4 last:border-0" key={item.id}><div><strong className="text-sm">{item.name}</strong><p className="mt-1 text-xs text-muted-foreground">{item.concluded_date ?? "계약일 미상"} · {money(item.amount)}{item.period ? ` · ${item.period}` : ""}</p></div>{item.detail_url && <a className="text-sm font-medium text-blue-800 hover:underline" href={item.detail_url} target="_blank" rel="noreferrer">계약 원문</a>}</div>)}{!activity.data.contracts.length && <p className="p-8 text-center text-sm text-muted-foreground">연결된 계약 정보가 없습니다.</p>}</div></section>}
  </PageContainer>;
}
