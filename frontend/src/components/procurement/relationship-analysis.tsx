import { Link } from "react-router-dom";
import { DataTable, DataTableEmpty } from "@/components/ui/data-table";

type YearlyRelationship = { year: number; contract_event_count?: number; attributed_contract_amount?: number; total_attributed_amount?: number };
type RelationshipField = { code: string; name: string; event_count: number; amount?: number };
type RelationshipEvent = { award_event_id: string; bid_notice_id: string; notice_name?: string; contract_date?: string; first_contract_date?: string; latest_contract_version_date?: string; contract_amount?: number; attributed_contract_amount?: number };

type RelationshipAnalysisProps = {
  eyebrow: string;
  title: string;
  context: string;
  summary: { contractCount: number; amount?: number; activeYearCount: number; latestContract?: string };
  years: number[];
  yearlyActivity: YearlyRelationship[];
  fields: RelationshipField[];
  events: RelationshipEvent[];
  money: (value?: number) => string;
  profileLink?: { to: string; label: string };
};

export function RelationshipAnalysis({ eyebrow, title, context, summary, years, yearlyActivity, fields, events, money, profileLink }: RelationshipAnalysisProps) {
  const maxYearAmount = Math.max(1, ...yearlyActivity.map((item) => item.attributed_contract_amount ?? item.total_attributed_amount ?? 0));
  const maxFieldAmount = Math.max(1, ...fields.map((field) => field.amount ?? 0));
  return (
    <div className="mt-8 space-y-8 rounded-2xl border bg-card p-5 sm:p-6">
      <section>
        <p className="text-xs font-semibold text-[var(--brand)]">{eyebrow}</p>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="mt-2 text-xl font-bold sm:text-2xl">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{context}</p></div>{profileLink && <Link className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted" to={profileLink.to}>{profileLink.label}</Link>}</div>
        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["계약", `${summary.contractCount.toLocaleString("ko-KR")}건`], ["계약금액", money(summary.amount)], ["계약 이력", `${summary.activeYearCount.toLocaleString("ko-KR")}개 연도`], ["최근 계약", summary.latestContract?.slice(0, 10) ?? "-"]].map(([label, value]) => <div className="rounded-xl bg-muted/50 p-3" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}</dl>
      </section>
      <section className="grid gap-8 border-t pt-8 xl:grid-cols-2">
        <div><h3 className="font-bold">거래 추이</h3><div className="mt-3 space-y-3 rounded-2xl border bg-card p-5">{years.map((year) => { const item = yearlyActivity.find((row) => row.year === year); const amount = item?.attributed_contract_amount ?? item?.total_attributed_amount ?? 0; return <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 text-sm" key={year}><span className="text-muted-foreground">{year}</span><span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${(amount / maxYearAmount) * 100}%` }} /></span><span className="text-right"><strong className="block">{money(amount)}</strong><span className="text-xs text-muted-foreground">계약 {(item?.contract_event_count ?? 0).toLocaleString("ko-KR")}건</span></span></div>; })}</div></div>
        <div><h3 className="font-bold">주요 거래 분야</h3><div className="mt-3 space-y-3 rounded-2xl border bg-card p-5">{fields.map((field) => <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm sm:grid-cols-[minmax(7rem,1fr)_2fr_auto]" key={field.code}><span className="truncate">{field.name}</span><span className="row-start-2 h-2 overflow-hidden rounded-full bg-muted sm:col-start-2 sm:row-start-1"><span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${field.amount != null ? (field.amount / maxFieldAmount) * 100 : 0}%` }} /></span><strong className="col-start-2 row-start-1 sm:col-start-3">{field.amount != null ? money(field.amount) : `${field.event_count.toLocaleString("ko-KR")}건`}</strong></div>)}{!fields.length && <p className="text-sm text-muted-foreground">분류된 거래 분야가 없습니다.</p>}</div></div>
      </section>
      <section className="border-t pt-8"><h3 className="font-bold">관련 공고 <span className="ml-1 text-sm font-normal text-muted-foreground">{events.length.toLocaleString("ko-KR")}건</span></h3><div className="mt-3 divide-y overflow-hidden rounded-2xl border md:hidden">{events.map((event) => { const first = (event.first_contract_date ?? event.contract_date)?.slice(0, 10); const latest = event.latest_contract_version_date?.slice(0, 10) ?? first; return <Link className="block p-4 hover:bg-muted/35" key={event.award_event_id} to={`/notices/${encodeURIComponent(event.bid_notice_id)}`}><strong className="line-clamp-2 text-sm">{event.notice_name ?? event.bid_notice_id}</strong><span className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground"><span>{money(event.attributed_contract_amount ?? event.contract_amount)}</span><span>{latest ?? "-"}</span></span></Link>; })}{!events.length && <p className="p-8 text-center text-sm text-muted-foreground">관련 공고가 없습니다.</p>}</div><DataTable className="mt-3 hidden md:block" minWidth={620}><thead><tr><th>공고</th><th className="text-right">계약금액</th><th className="text-right">계약일</th></tr></thead><tbody>{events.map((event) => { const first = (event.first_contract_date ?? event.contract_date)?.slice(0, 10); const latest = event.latest_contract_version_date?.slice(0, 10) ?? first; const changed = Boolean(first && latest && first !== latest); return <tr key={event.award_event_id}><td><Link className="font-medium hover:text-[var(--brand)]" to={`/notices/${encodeURIComponent(event.bid_notice_id)}`}>{event.notice_name ?? event.bid_notice_id}</Link></td><td className="text-right font-medium">{money(event.attributed_contract_amount ?? event.contract_amount)}</td><td className="text-right text-muted-foreground">{latest ?? "-"}{changed && <span className="block text-[11px]">최초 계약 {first}</span>}</td></tr>; })}{!events.length && <DataTableEmpty colSpan={3}>관련 공고가 없습니다.</DataTableEmpty>}</tbody></DataTable></section>
    </div>
  );
}
