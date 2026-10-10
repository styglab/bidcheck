import { Search, X } from "lucide-react";
import { type FormEvent, type ReactNode, useRef } from "react";
import { EntityDetailSection, EntityDetailToolbar } from "@/components/common/entity-detail-section";
import { SectionError } from "@/components/common/error-state";
import { ListEmptyState } from "@/components/common/list-empty-state";
import { ListPagination } from "@/components/common/list-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  title: string;
  description: string;
  searchPlaceholder: string;
  searchValue: string;
  appliedSearch?: string;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  errorTitle: string;
  resultLabel: ReactNode;
  resultHelp?: ReactNode;
  total: number;
  itemCount: number;
  emptyTitle: string;
  emptyDescription: string;
  page: number;
  totalPages?: number;
  filters?: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSearchClear: () => void;
  onReset?: () => void;
  onRetry: () => void;
  onPageChange: (page: number) => void;
};

export function EntityRecordListSection({
  title,
  description,
  searchPlaceholder,
  searchValue,
  appliedSearch,
  isLoading,
  isFetching,
  isError,
  error,
  errorTitle,
  resultLabel,
  resultHelp,
  total,
  itemCount,
  emptyTitle,
  emptyDescription,
  page,
  totalPages,
  filters,
  notice,
  children,
  onSearchValueChange,
  onSearchSubmit,
  onSearchClear,
  onReset,
  onRetry,
  onPageChange,
}: Props) {
  const resultsRef = useRef<HTMLDivElement>(null);
  const changePage = (nextPage: number) => {
    onPageChange(nextPage);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    resultsRef.current?.focus({ preventScroll: true });
  };

  return (
    <EntityDetailSection className="relative" title={title} description={description}>
      <EntityDetailToolbar className="mb-5 mt-5">
        <form className="flex max-w-2xl gap-2" onSubmit={onSearchSubmit}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              disabled={isFetching}
              onChange={(event) => onSearchValueChange(event.target.value)}
              placeholder={searchPlaceholder}
              value={searchValue}
            />
            {searchValue && (
              <Button
                aria-label="검색 초기화"
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={onSearchClear}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          <Button disabled={isFetching} type="submit">
            검색
          </Button>
        </form>
        {filters && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{filters}</div>}
      </EntityDetailToolbar>

      {isLoading && <Skeleton className="h-48 rounded-xl" />}
      {isError && <SectionError error={error} title={errorTitle} onRetry={onRetry} />}
      {notice}
      {!isLoading && !isError && (
        <div
          className="mb-3 flex scroll-mt-[calc(var(--site-header-height,70px)+5rem)] items-center justify-between gap-3"
          ref={resultsRef}
          tabIndex={-1}
        >
          <strong className="flex items-center gap-1 text-sm">
            {resultLabel}
            {resultHelp}
          </strong>
          <span className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <span>{total.toLocaleString("ko-KR")}건</span>
            {Boolean(totalPages) && (
              <span className="rounded-full border bg-muted/30 px-2 py-1 font-medium tabular-nums text-foreground">
                {isFetching ? `${page}페이지 불러오는 중` : `${page} / ${totalPages}페이지`}
              </span>
            )}
          </span>
        </div>
      )}
      {!isLoading && !isError && itemCount === 0 && (
        <ListEmptyState
          title={emptyTitle}
          description={emptyDescription}
          onReset={appliedSearch || onReset ? onReset : undefined}
        />
      )}
      {!isError && itemCount > 0 && (
        <>
          {children}
          <ListPagination loading={isFetching} page={page} totalPages={totalPages} onChange={changePage} />
        </>
      )}
    </EntityDetailSection>
  );
}
