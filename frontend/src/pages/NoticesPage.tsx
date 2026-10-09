import { LoaderCircle, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { NoticeTable } from "../features/notices/NoticeTable";
import { useNotices, type NoticeFilters } from "../features/notices/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer } from "@/components/layout/page-container";
import { ListPagination } from "@/components/common/list-pagination";

export function NoticesPage() {
  const [params, setParams] = useSearchParams();
  const workTypes = [
    ["goods", "물품"],
    ["service", "용역"],
    ["construction", "공사"],
    ["foreign", "외자"],
    ["other", "기타"],
  ] as const;
  const validWorkTypes = workTypes.map(([value]) => value);
  const workTypeParam = params.get("work_type") ?? "";
  const selectedWorkType = validWorkTypes.includes(workTypeParam as (typeof validWorkTypes)[number])
    ? workTypeParam
    : undefined;
  const historyScope = params.get("scope") === "all";
  const filters: NoticeFilters = {
    q: params.get("q") || undefined,
    work_type: selectedWorkType,
    include_history: historyScope,
    lineage_mode: "grouped",
    sort: "published_desc",
    page: Number(params.get("page") || 1),
    page_size: Number(params.get("page_size") || 20),
  };
  const update = useCallback(
    (values: Record<string, string>) => {
      const next = new URLSearchParams(params);
      Object.entries(values).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      if (!("page" in values)) next.set("page", "1");
      setParams(next);
    },
    [params, setParams],
  );
  const [keyword, setKeyword] = useState(filters.q ?? "");
  const [draftWorkType, setDraftWorkType] = useState<string | undefined>(selectedWorkType);
  const noticeQuery = useNotices(filters);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeyword(filters.q ?? "");
      setDraftWorkType(selectedWorkType);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filters.q, selectedWorkType]);
  return (
    <PageContainer className="max-w-7xl">
      <header className="mb-8">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">공고 탐색</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          전체 공고를 확인하세요
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          발주 공고를 검색하고 이후 낙찰·계약 결과까지 이어서 확인할 수 있습니다.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          나라장터 API 제공 범위에 따라 일부 공고는 표시되지 않을 수 있습니다.
        </p>
      </header>
      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap gap-2" aria-label="공고 조회 범위">
          <Button
            type="button"
            size="sm"
            variant={!historyScope ? "default" : "outline"}
            className="rounded-full px-4"
            aria-pressed={!historyScope}
            onClick={() => update({ scope: "" })}
          >
            진행 공고
          </Button>
          <Button
            type="button"
            size="sm"
            variant={historyScope ? "default" : "outline"}
            className="rounded-full px-4"
            aria-pressed={historyScope}
            onClick={() => update({ scope: "all" })}
          >
            전체 이력
          </Button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2" aria-label="업무 구분">
          <Button
            type="button"
            size="sm"
            variant={!draftWorkType ? "default" : "outline"}
            className="rounded-full px-4"
            aria-pressed={!draftWorkType}
            onClick={() => setDraftWorkType(undefined)}
          >
            전체
          </Button>
          {workTypes.map(([value, label]) => {
            const selected = draftWorkType === value;
            return (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                className="rounded-full px-4"
                aria-pressed={selected}
                onClick={() => setDraftWorkType(value)}
              >
                {label}
              </Button>
            );
          })}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: keyword.trim(), work_type: draftWorkType ?? "" });
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              className="h-12 bg-muted/35 pl-11 text-sm"
              name="q"
              aria-label="공고 검색"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="공고명, 공고번호 또는 발주기관 검색"
            />
          </div>
          <Button
            className="h-12 bg-blue-800 px-6 hover:bg-blue-700"
            disabled={
              noticeQuery.isFetching ||
              (keyword.trim() === (filters.q ?? "") && draftWorkType === selectedWorkType)
            }
            type="submit"
          >
            {noticeQuery.isFetching ? (
              <LoaderCircle className="animate-spin" aria-label="공고 검색 중" />
            ) : (
              "검색"
            )}
          </Button>
        </form>
      </div>
      <div className="mt-8 flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong className="text-base text-foreground">
            공고 {noticeQuery.data?.pagination.total_items.toLocaleString() ?? "-"}건
          </strong>
          {noticeQuery.isFetching && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <LoaderCircle className="animate-spin" size={13} />
              갱신 중
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {noticeQuery.data && (
            <span>
              {(noticeQuery.data.pagination.page - 1) * noticeQuery.data.pagination.page_size + 1}–
              {Math.min(
                noticeQuery.data.pagination.page * noticeQuery.data.pagination.page_size,
                noticeQuery.data.pagination.total_items,
              )}{" "}
              표시
            </span>
          )}
          <Select value={String(filters.page_size)} onValueChange={(value) => update({ page_size: value })}>
            <SelectTrigger className="h-9 w-[94px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="20">20개씩</SelectItem>
              <SelectItem value="50">50개씩</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="page-table">
        <NoticeTable filters={filters} />
      </div>
      <ListPagination
        label="공고 페이지"
        loading={noticeQuery.isFetching}
        page={noticeQuery.data?.pagination.page ?? filters.page ?? 1}
        totalPages={noticeQuery.data?.pagination.total_pages}
        onChange={(page) => update({ page: String(page) })}
      />
    </PageContainer>
  );
}
