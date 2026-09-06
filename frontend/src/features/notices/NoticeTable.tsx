import { ArrowRight, Building2, CalendarClock, CircleAlert, FileCheck2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "../company-context/useCompany";
import { useNotices, type NoticeFilters } from "./api";
function dday(deadline?: string) {
  if (!deadline) return "-";
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return days >= 0 ? `D-${days}` : "마감";
}
function price(value?: number) {
  if (!value) return "가격 미정";
  return value >= 100000000
    ? `${(value / 100000000).toFixed(1)}억원`
    : `${Math.round(value / 10000).toLocaleString()}만원`;
}
function shortDate(value?: string) {
  if (!value) return "미정";
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(value));
}
export function NoticeTable({ filters = {} }: { filters?: NoticeFilters }) {
  const { currentCompany } = useCompany();
  const query = useNotices(filters);
  if (query.isLoading) return <div className="grid gap-3">{[1, 2, 3].map((item) => <Skeleton className="h-40 rounded-xl" key={item} />)}</div>;
  if (query.isError)
    return (
      <div className="table-state error">
        <strong>공고를 불러오지 못했습니다.</strong>
        <span>{query.error.message}</span>
        <button onClick={() => query.refetch()}>다시 시도</button>
      </div>
    );
  if (!query.data?.items.length)
    return <div className="table-state">조건에 맞는 진행 중 공고가 없습니다.</div>;
  return (
    <>
      <div className="notice-result-meta !text-slate-600">
        진행 중인 {filters.work_type === "goods" ? "물품" : filters.work_type === "construction" ? "공사" : filters.work_type === "foreign" ? "외자" : filters.work_type === "service" ? "용역" : "전체"} 공고 <strong className="!text-slate-950">{query.data.pagination.total_items.toLocaleString()}건</strong>
        {currentCompany && <span>· {currentCompany.name} 선택됨</span>}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[minmax(280px,1fr)_150px_160px_170px_130px] gap-5 border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-xs font-medium text-slate-500 lg:grid">
          <span>공고명 · 발주기관</span>
          <span>입찰 방식</span>
          <span>사업 금액</span>
          <span>주요 일정</span>
          <span className="text-right">참가요건</span>
        </div>
        {query.data.items.map((notice) => (
          <Link
            className="group grid gap-4 border-b border-slate-100 px-5 py-4 transition last:border-0 hover:bg-emerald-50/30 lg:grid-cols-[minmax(280px,1fr)_150px_160px_170px_130px] lg:items-center lg:gap-5"
            to={`/notices/${encodeURIComponent(notice.id)}`}
            key={notice.id}
          >
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2">
                <Badge variant="outline" className="h-5 px-1.5 text-[11px]">용역</Badge>
                <span className="flex min-w-0 items-center gap-1 truncate text-xs text-slate-500"><Building2 size={12} /> {notice.organization}</span>
              </div>
              <h2 className="truncate text-[15px] font-semibold text-slate-950 group-hover:text-emerald-800">{notice.name}</h2>
              <p className="mt-1 flex gap-2 text-xs text-slate-400"><span>{notice.notice_number}-{notice.notice_order}</span><span>·</span><span>게시 {shortDate(notice.published_at)}</span></p>
            </div>
            <div className="text-sm text-slate-700">
              <b className="font-medium text-slate-900">{notice.contract_method ?? "계약방법 미상"}</b>
              <small className="mt-1 block text-xs text-slate-500">{notice.bid_method ?? "입찰방법 미상"}</small>
            </div>
            <div className="text-sm">
              <span className="font-semibold text-slate-900">추정 {price(notice.estimated_price)}</span>
              <small className="mt-1 block text-xs text-slate-500">예산 {price(notice.allocated_budget)}</small>
            </div>
            <div className="text-sm text-slate-700">
              <div className="flex items-center gap-2"><Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50">{dday(notice.deadline_at)}</Badge><b className="font-medium">마감 {shortDate(notice.deadline_at)}</b></div>
              <small className="mt-1.5 flex items-center gap-1 text-xs text-slate-500"><CalendarClock size={12} />개찰 {shortDate(notice.opening_at)}</small>
            </div>
            <div className="flex items-center justify-between gap-2 lg:block lg:text-right">
              {notice.requires_review ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700"><CircleAlert size={14} />원문 확인 필요</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600"><FileCheck2 size={14} />요건 확인</span>
              )}
              <span className="mt-2 flex items-center justify-end gap-1 text-xs font-semibold text-emerald-800">{currentCompany ? "회사 기준 검토" : "상세 보기"} <ArrowRight size={14} /></span>
            </div>
          </Link>
        ))}
      </div>
      {query.data.truncated && (
        <p className="truncated-note">검색 결과가 많아 일부만 표시합니다. 검색 기간을 줄여 확인해 주세요.</p>
      )}
    </>
  );
}
