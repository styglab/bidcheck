import { ArrowUpRight, Building2, CalendarClock, SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusState } from "@/components/common/status-state";
import { useNotices, type NoticeFilters } from "./api";

function dday(deadline?: string) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return days >= 0 ? `D-${days}` : "마감";
}
function price(value?: number) {
  if (!value) return "금액 미정";
  return value >= 100000000
    ? `${(value / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`
    : `${Math.round(value / 10000).toLocaleString()}만원`;
}
function shortDate(value?: string) {
  if (!value) return "미정";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
const workTypeLabels: Record<string, string> = {
  goods: "물품",
  service: "용역",
  construction: "공사",
  foreign: "외자",
  other: "기타",
};
const statusLabels: Record<string, { label: string; className: string }> = {
  scheduled: {
    label: "입찰 예정",
    className: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
  open: {
    label: "진행 중",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  unknown: {
    label: "일정 확인",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
};

export function NoticeTable({ filters = {} }: { filters?: NoticeFilters }) {
  const query = useNotices(filters);
  if (query.isLoading)
    return (
      <div className="grid gap-3">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton className="h-28 rounded-xl" key={item} />
        ))}
      </div>
    );
  if (query.isError)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <strong>공고를 불러오지 못했습니다.</strong>
        <p className="mt-1">{query.error.message}</p>
        <Button className="mt-4" variant="outline" size="sm" onClick={() => query.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  if (!query.data?.items.length)
    return (
      <StatusState
        icon={<SearchX size={30} />}
        title="조건에 맞는 공고가 없습니다"
        description="검색어나 업무 구분을 변경해 보세요."
        action={
          <Button variant="outline" asChild>
            <Link to="/notices">검색 조건 초기화</Link>
          </Button>
        }
      />
    );
  return (
    <>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="hidden grid-cols-[minmax(320px,1.5fr)_minmax(190px,.8fr)_120px_110px_150px] gap-5 border-b bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground lg:grid">
          <span>공고</span>
          <span>발주기관</span>
          <span className="text-right">금액</span>
          <span>게시일</span>
          <span>마감</span>
        </div>
        {query.data.items.map((notice) => {
          const deadline = dday(notice.deadline_at);
          return (
            <article
              className="grid gap-3 border-b px-5 py-4 transition-colors last:border-0 hover:bg-blue-50/35 dark:hover:bg-blue-950/10 lg:grid-cols-[minmax(320px,1.5fr)_minmax(190px,.8fr)_120px_110px_150px] lg:items-center lg:gap-5"
              key={notice.id}
            >
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {statusLabels[notice.status] && (
                    <Badge className={`h-5 text-[10px] ${statusLabels[notice.status].className}`}>
                      {statusLabels[notice.status].label}
                    </Badge>
                  )}
                  <Badge variant="outline" className="h-5 text-[10px]">
                    {workTypeLabels[notice.work_type] ?? notice.work_type ?? "구분 미상"}
                  </Badge>
                  {notice.contract_method && (
                    <Badge variant="secondary" className="h-5 text-[10px]">
                      {notice.contract_method}
                    </Badge>
                  )}
                </div>
                <Link
                  className="group inline-flex max-w-full items-start gap-1.5"
                  to={`/notices/${encodeURIComponent(notice.id)}`}
                >
                  <h2 className="truncate text-[15px] font-semibold group-hover:text-blue-800 group-hover:underline dark:group-hover:text-blue-300">
                    {notice.name}
                  </h2>
                  <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </div>
              <div className="min-w-0">
                <span className="mb-1 block text-[11px] text-muted-foreground lg:hidden">발주기관</span>
                {notice.organization_code ? (
                  <Link
                    className="flex items-center gap-1.5 truncate text-sm font-medium hover:text-violet-700 hover:underline dark:hover:text-violet-300"
                    title={notice.organization}
                    to={`/organizations/${encodeURIComponent(notice.organization_code)}`}
                  >
                    <Building2 size={14} className="shrink-0 text-violet-600" />
                    {notice.organization}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 truncate text-sm">
                    <Building2 size={14} />
                    {notice.organization}
                  </span>
                )}
              </div>
              <div className="text-sm lg:text-right">
                <span className="mr-2 text-[11px] text-muted-foreground lg:hidden">금액</span>
                <strong className="tabular-nums">{price(notice.allocated_budget)}</strong>
              </div>
              <div className="text-sm">
                <span className="mr-2 text-[11px] text-muted-foreground lg:hidden">게시일</span>
                <span className="tabular-nums text-muted-foreground">{shortDate(notice.published_at)}</span>
              </div>
              <div className="text-sm">
                <span className="mb-1 block text-[11px] text-muted-foreground lg:hidden">마감</span>
                <div className="flex items-center gap-2">
                  {deadline && (
                    <Badge
                      className={
                        deadline === "마감"
                          ? "bg-muted text-muted-foreground"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      }
                    >
                      {deadline}
                    </Badge>
                  )}
                  <span className="tabular-nums">{shortDate(notice.deadline_at)}</span>
                </div>
                {!notice.deadline_at && (
                  <small className="mt-1 inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <CalendarClock size={12} />
                    원문 확인 필요
                  </small>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {query.data.truncated && (
        <p className="mt-3 text-xs text-muted-foreground">
          검색 결과가 많아 일부만 표시합니다. 검색 조건을 좁혀 주세요.
        </p>
      )}
    </>
  );
}
