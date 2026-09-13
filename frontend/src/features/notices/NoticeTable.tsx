import { Building2, Check, CircleAlert, FileCheck2, LoaderCircle, SearchX, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusState } from "@/components/common/status-state";
import { useCompany } from "../company-context/useCompany";
import { useAssessmentPreviews, useNotices, type AssessmentPreview, type KeyOutcome, type NoticeFilters } from "./api";
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
function shortDateTime(value?: string) {
  if (!value) return "미정";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
const workTypeLabels: Record<string, string> = {
  goods: "물품",
  service: "용역",
  construction: "공사",
  foreign: "외자",
  other: "기타",
};
function workTypeLabel(value?: string) {
  if (!value) return "구분 미상";
  return workTypeLabels[value] ?? value;
}
function assessmentErrorLabel(code?: string) {
  if (code?.includes("requirement")) return "요건 추출 전";
  if (code?.includes("notice")) return "공고 확인 필요";
  if (code?.includes("company")) return "회사정보 확인 필요";
  return "평가 확인 필요";
}
function keyRequirementOutcome(preview: AssessmentPreview, type: "participation_region" | "industry_license") {
  return preview.key_outcomes?.[type];
}
function keyRequirementStatus(label: string, result?: KeyOutcome) {
  const status = result?.applicability === "not_applicable"
    ? { text: "해당 없음", className: "bg-muted text-muted-foreground", icon: null }
    : result?.applicability === "unknown"
      ? { text: "확인 필요", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", icon: <CircleAlert size={12} /> }
      : result?.outcome === "unsatisfied"
    ? { text: "미충족", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300", icon: <X size={12} /> }
    : result?.outcome === "needs_review"
      ? { text: "확인 필요", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", icon: <CircleAlert size={12} /> }
      : result?.outcome === "satisfied"
        ? { text: "충족", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", icon: <Check size={12} /> }
        : { text: "정보 없음", className: "bg-muted text-muted-foreground", icon: null };
  return <span className="flex items-center gap-2"><span className="w-7 shrink-0 text-muted-foreground">{label}</span><strong className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 font-semibold ${status.className}`}>{status.icon}{status.text}</strong></span>;
}
function overallStatus(preview: AssessmentPreview) {
  if ((preview.unsatisfied_count ?? 0) > 0) return { text: "미충족", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300", icon: <X size={12} /> };
  if ((preview.needs_review_count ?? 0) > 0) return { text: "확인 필요", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", icon: <CircleAlert size={12} /> };
  return { text: "충족", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", icon: <Check size={12} /> };
}
export function NoticeTable({ filters = {} }: { filters?: NoticeFilters }) {
  const { currentCompany } = useCompany();
  const query = useNotices(filters);
  const noticeIds = query.data?.items.map((notice) => notice.id) ?? [];
  const previews = useAssessmentPreviews(noticeIds, currentCompany?.businessNumber);
  const previewsByNotice = new Map(previews.data?.items.map((item) => [item.bid_notice_id, item]));
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
    return <StatusState icon={<SearchX size={30} />} title="조건에 맞는 공고가 없습니다" description="검색어를 줄이거나 금액·마감 조건을 해제해 보세요." action={<Button variant="outline" asChild><Link to="/notices">검색 조건 전체 초기화</Link></Button>} />;
  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="hidden grid-cols-[minmax(260px,1fr)_205px_105px_165px_165px_170px] gap-5 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground xl:grid">
          <span>공고명</span>
          <span>발주기관</span>
          <span className="text-right">금액</span>
          <span>마감</span>
          <span className="border-l border-border/70 pl-3">지역·업종</span>
          <span className="border-l border-border/70 pl-3">전체 요건</span>
        </div>
        {query.data.items.map((notice) => {
          const preview = previewsByNotice.get(notice.id);
          return (
          <article
            className="group relative grid gap-4 border-b border-border/80 px-5 py-4 transition-colors last:border-0 hover:bg-blue-50/40 dark:hover:bg-blue-950/10 xl:grid-cols-[minmax(260px,1fr)_205px_105px_165px_165px_170px] xl:items-center xl:gap-5"
            key={notice.id}
          >
            <Link className="absolute inset-0" to={`/notices/${encodeURIComponent(notice.id)}`} aria-label={`${notice.name} 상세 보기`} />
            <div className="pointer-events-none min-w-0">
              <div className="mb-1.5 flex items-center">
                <Badge variant="outline" className="h-5 px-1.5 text-[11px]">{workTypeLabel(notice.work_type)}</Badge>
              </div>
              <h2 className="truncate text-[15px] font-semibold text-foreground group-hover:text-blue-800 dark:text-blue-300">{notice.name}</h2>
              <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground"><span>{notice.notice_number}-{notice.notice_order}</span><span>· 게시 {shortDateTime(notice.published_at)}</span></p>
            </div>
            <div className="pointer-events-none min-w-0 text-sm">
              <span className="flex items-center gap-1.5 text-foreground"><Building2 className="shrink-0 text-muted-foreground" size={14} /><b className="truncate font-medium" title={notice.organization}>{notice.organization}</b></span>
              <small className="mt-1 block truncate text-xs text-muted-foreground" title={notice.contract_method ?? "계약방법 미상"}>{notice.contract_method ?? "계약방법 미상"}</small>
            </div>
            <div className="pointer-events-none text-sm xl:text-right">
              <span className="font-semibold tabular-nums text-foreground">{price(notice.allocated_budget)}</span>
            </div>
            <div className="pointer-events-none text-sm text-muted-foreground">
              <div className="flex items-center gap-2">{notice.deadline_at && <Badge className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:bg-rose-950/40">{dday(notice.deadline_at)}</Badge>}<b className="font-medium tabular-nums">{shortDateTime(notice.deadline_at)}</b></div>
              {notice.status === "unknown" && <small className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400"><CircleAlert size={13} />일정 원문 확인 필요</small>}
            </div>
            <div className="pointer-events-none min-w-0 text-xs xl:border-l xl:border-border/70 xl:pl-3">
              <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground xl:hidden">지역·업종</span>
              {currentCompany ? (
                preview?.status === "completed" ? <div className="space-y-1">{keyRequirementStatus("지역", keyRequirementOutcome(preview, "participation_region"))}{keyRequirementStatus("업종", keyRequirementOutcome(preview, "industry_license"))}</div>
                  : previews.isFetching ? <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground"><LoaderCircle className="animate-spin" size={14} />요건 검토 중</span>
                    : <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground"><FileCheck2 size={14} />판정 전</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <FileCheck2 size={14} />회사 선택 후 확인
                </span>
              )}
            </div>
            <div className="pointer-events-none min-w-0 text-xs xl:border-l xl:border-border/70 xl:pl-3">
              <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground xl:hidden">전체 요건</span>
              {currentCompany ? (
                preview?.status === "error" ? <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400"><CircleAlert size={14} />{assessmentErrorLabel(preview.error_code)}</span>
                  : preview ? (() => { const status = overallStatus(preview); return <div><strong className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold ${status.className}`}>{status.icon}{status.text}</strong><p className="mt-1.5 whitespace-nowrap text-[11px] tabular-nums"><span className="text-emerald-700 dark:text-emerald-300">충족 {preview.satisfied_count ?? 0}</span><span className="px-1 text-border">·</span><span className="text-red-700 dark:text-red-300">미충족 {preview.unsatisfied_count ?? 0}</span><span className="px-1 text-border">·</span><span className="text-amber-700 dark:text-amber-300">확인 {preview.needs_review_count ?? 0}</span></p>{previews.isFetching && <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground"><LoaderCircle className="animate-spin" size={11} />갱신 중</span>}</div>; })()
                    : previews.isFetching ? <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground"><LoaderCircle className="animate-spin" size={14} />검토 중</span>
                      : previews.isError ? <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400"><CircleAlert size={14} />불러오기 실패</span>
                        : notice.requires_review ? <span className="font-medium text-amber-700 dark:text-amber-400">원문 확인 필요</span>
                          : <span className="text-muted-foreground">검토 전</span>
              ) : <span className="text-muted-foreground">-</span>}
            </div>
          </article>
          );
        })}
      </div>
      {query.data.truncated && (
        <p className="truncated-note">검색 결과가 많아 일부만 표시합니다. 검색 기간을 줄여 확인해 주세요.</p>
      )}
    </>
  );
}
