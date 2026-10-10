import { LoaderCircle, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { NoticeTable } from "../features/notices/NoticeTable";
import { useNotices, type NoticeFilters } from "../features/notices/api";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer } from "@/components/layout/page-container";
import { AnalysisIndexHeader } from "@/components/layout/analysis-index-header";
import { ListPagination } from "@/components/common/list-pagination";
import { EntityDetailToolbar, EntitySectionHeader } from "@/components/common/entity-detail-section";

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
    <PageContainer className="max-w-6xl !pt-7 sm:!pt-10">
      <AnalysisIndexHeader
        description="공고명과 발주기관을 검색하고 낙찰·계약 결과까지 한 흐름으로 확인할 수 있습니다."
        label="공고 탐색"
        title="참여할 공고를 찾아보세요"
      />
      <EntityDetailToolbar className="p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">조회 범위</p>
            <div className="flex flex-wrap gap-2" aria-label="공고 조회 범위">
              <FilterChip selected={!historyScope} onClick={() => update({ scope: "" })}>
                진행 공고
              </FilterChip>
              <FilterChip selected={historyScope} onClick={() => update({ scope: "all" })}>
                전체 이력
              </FilterChip>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">업무 구분</p>
            <div className="flex flex-wrap gap-2" aria-label="업무 구분">
              <FilterChip selected={!draftWorkType} onClick={() => setDraftWorkType(undefined)}>
                전체
              </FilterChip>
              {workTypes.map(([value, label]) => (
                <FilterChip
                  selected={draftWorkType === value}
                  key={value}
                  onClick={() => setDraftWorkType(value)}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>
        <form
          className="mt-5 flex flex-col gap-2 border-t pt-4 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: keyword.trim(), work_type: draftWorkType ?? "" });
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              className="h-11 bg-background pl-11 text-sm"
              name="q"
              aria-label="공고 검색"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="공고명, 공고번호 또는 발주기관 검색"
            />
          </div>
          <Button
            className="h-11 px-6 sm:min-w-24"
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
      </EntityDetailToolbar>
      <div className="mt-9 border-b pb-4">
        <EntitySectionHeader
          title={`공고 ${noticeQuery.data?.pagination.total_items.toLocaleString() ?? "-"}건`}
          description={
            historyScope
              ? "진행 공고와 마감된 과거 공고를 함께 표시합니다."
              : "현재 접수할 수 있는 공고를 최신 게시순으로 표시합니다."
          }
          meta={
            noticeQuery.isFetching ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <LoaderCircle className="size-3.5 animate-spin" /> 갱신 중
              </span>
            ) : undefined
          }
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <p className="text-xs">나라장터 API 제공 범위에 따라 일부 공고는 표시되지 않을 수 있습니다.</p>
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
      </div>
      <div className="page-table mt-4">
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
