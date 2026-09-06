import { LoaderCircle, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { NoticeTable } from "../features/notices/NoticeTable";
import { useNotices, type NoticeFilters } from "../features/notices/api";
import { CompanyProfileBanner } from "../features/company-context/CompanyProfileBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function Pagination({ filters, setPage }: { filters: NoticeFilters; setPage: (page: number) => void }) {
  const { data } = useNotices(filters);
  if (!data || data.pagination.total_pages <= 1) return null;
  const { page, total_pages: total } = data.pagination;
  const start = Math.max(1, Math.min(page - 2, total - 4));
  const pages = Array.from({ length: Math.min(5, total) }, (_, index) => start + index);
  return (
    <nav className="pagination" aria-label="공고 페이지">
      <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
        이전
      </button>
      {start > 1 && (
        <>
          <button onClick={() => setPage(1)}>1</button>
          <span>…</span>
        </>
      )}
      {pages.map((value) => (
        <button
          className={value === page ? "active" : ""}
          aria-current={value === page ? "page" : undefined}
          key={value}
          onClick={() => setPage(value)}
        >
          {value}
        </button>
      ))}
      {start + pages.length - 1 < total && (
        <>
          <span>…</span>
          <button onClick={() => setPage(total)}>{total}</button>
        </>
      )}
      <button disabled={page >= total} onClick={() => setPage(page + 1)}>
        다음
      </button>
    </nav>
  );
}

export function NoticesPage() {
  const [params, setParams] = useSearchParams();
  const filters: NoticeFilters = {
    q: params.get("q") || undefined,
    work_type: params.get("work_type") || undefined,
    published_from: params.get("published_from") || undefined,
    published_to: params.get("published_to") || undefined,
    deadline_to: params.get("deadline_to") || undefined,
    contract_method: params.get("contract_method") || undefined,
    price_min: params.get("price_min") || undefined,
    price_max: params.get("price_max") || undefined,
    sort: params.get("sort") || "deadline_asc",
    page: Number(params.get("page") || 1),
    page_size: 20,
  };
  const update = useCallback((values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!("page" in values)) next.set("page", "1");
    setParams(next);
  }, [params, setParams]);
  const [keyword, setKeyword] = useState(filters.q ?? "");
  const noticeQuery = useNotices(filters);
  useEffect(() => {
    if (keyword === (filters.q ?? "")) return;
    const timer = window.setTimeout(() => update({ q: keyword.trim() }), 450);
    return () => window.clearTimeout(timer);
  }, [keyword, filters.q, update]);
  const activeFilters = [
    filters.q && { key: "q", label: `검색어 “${filters.q}”` },
    filters.work_type && {
      key: "work_type",
      label: `업무 ${filters.work_type === "goods" ? "물품" : filters.work_type === "service" ? "용역" : filters.work_type === "construction" ? "공사" : filters.work_type === "foreign" ? "외자" : "기타"}`,
    },
    filters.published_from && {
      key: "published_from",
      label: `게시 ${filters.published_from.slice(0, 10)}부터`,
    },
    filters.published_to && { key: "published_to", label: `게시 ${filters.published_to.slice(0, 10)}까지` },
    filters.deadline_to && { key: "deadline_to", label: `마감 ${filters.deadline_to.slice(0, 10)}까지` },
    filters.contract_method && { key: "contract_method", label: filters.contract_method },
  ].filter(Boolean) as Array<{ key: string; label: string }>;
  return (
    <main className="mx-auto min-h-[calc(100vh-70px)] w-[min(1080px,calc(100%-32px))] py-10 sm:py-14">
      <header className="mb-7">
        <p className="mb-2 text-sm font-semibold text-emerald-800">공공입찰 탐색</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">공고 찾기</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">로그인 없이 공고를 찾고, 회사 프로필로 참가요건을 비교하세요.</p>
      </header>
      <CompanyProfileBanner />
      <Card className="mt-5 shadow-sm">
        <CardContent className="p-4 sm:p-5">
        <form
          className="flex"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: keyword.trim() });
          }}
        >
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            className="h-11 pl-10 pr-10 text-sm"
            name="q"
            aria-label="공고 검색"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="공고명 · 공고번호 · 발주기관 검색"
          />
          {noticeQuery.isFetching && <LoaderCircle className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-700" size={17} aria-label="공고 검색 중" />}
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-500">검색어와 조건은 변경하면 자동으로 적용됩니다.</p>
        <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <SlidersHorizontal size={15} /> 검색 조건
        </div>
        <div className="notice-filters !grid-cols-1 sm:!grid-cols-2 lg:!grid-cols-5">
          <label className="gap-1.5 text-xs font-medium text-slate-600">
            업무 구분
            <Select value={filters.work_type || "all"} onValueChange={(value) => update({ work_type: value === "all" ? "" : value })}>
              <SelectTrigger className="h-9 w-full bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="goods">물품</SelectItem>
                <SelectItem value="service">용역</SelectItem>
                <SelectItem value="construction">공사</SelectItem>
                <SelectItem value="foreign">외자</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="gap-1.5 text-xs font-medium text-slate-600">
            게시 시작
            <Input className="h-9 bg-white text-sm"
              type="date"
              value={filters.published_from?.slice(0, 10) ?? ""}
              onChange={(event) => update({ published_from: event.target.value })}
            />
          </label>
          <label className="gap-1.5 text-xs font-medium text-slate-600">
            게시 종료
            <Input className="h-9 bg-white text-sm"
              type="date"
              value={filters.published_to?.slice(0, 10) ?? ""}
              onChange={(event) => update({ published_to: event.target.value })}
            />
          </label>
          <label className="gap-1.5 text-xs font-medium text-slate-600">
            마감 기한
            <Input className="h-9 bg-white text-sm"
              type="date"
              value={filters.deadline_to?.slice(0, 10) ?? ""}
              onChange={(event) => update({ deadline_to: event.target.value })}
            />
          </label>
          <label className="gap-1.5 text-xs font-medium text-slate-600">
            계약방법
            <Select value={filters.contract_method || "all"} onValueChange={(value) => update({ contract_method: value === "all" ? "" : value })}>
              <SelectTrigger className="h-9 w-full bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="일반경쟁">일반경쟁</SelectItem>
                <SelectItem value="제한경쟁">제한경쟁</SelectItem>
                <SelectItem value="수의계약">수의계약</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="filter-footer -mx-5 -mb-5 mt-1 rounded-b-xl">
          <div className="active-filters">
            {activeFilters.map((filter) => (
              <button key={filter.key} onClick={() => {
                if (filter.key === "q") setKeyword("");
                update({ [filter.key]: "" });
              }}>
                {filter.label} <span>×</span>
              </button>
            ))}
            {!activeFilters.length && <span>적용된 상세 조건이 없습니다.</span>}
          </div>
          <button
            className="filter-reset"
            onClick={() => {
              setKeyword("");
              setParams({ sort: filters.sort ?? "deadline_asc", page: "1" });
            }}
          >
            <RotateCcw size={13} /> 초기화
          </button>
        </div>
        </CardContent>
      </Card>
      <div className="mt-8 flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs defaultValue="all">
          <TabsList className="h-8 gap-0.5 rounded-lg p-0.5">
            <TabsTrigger className="h-7 px-2.5 text-xs" value="all">전체</TabsTrigger>
            <TabsTrigger className="h-7 px-2.5 text-xs" value="satisfied" disabled>주요요건 충족</TabsTrigger>
            <TabsTrigger className="h-7 px-2.5 text-xs" value="review" disabled>확인 필요</TabsTrigger>
            <TabsTrigger className="h-7 px-2.5 text-xs" value="unsatisfied" disabled>명확한 미충족</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>정렬</span>
          <Select value={filters.sort} onValueChange={(value) => update({ sort: value })}>
            <SelectTrigger className="h-9 w-[132px] bg-white"><SelectValue /></SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="deadline_asc">마감 임박순</SelectItem>
              <SelectItem value="published_desc">최신순</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="page-table">
        <NoticeTable filters={filters} />
      </div>
      <Pagination filters={filters} setPage={(page) => update({ page: String(page) })} />
    </main>
  );
}
