import type { ReactNode } from "react";
import { HistoryBackLink } from "@/components/common/history-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  fallbackTo: string;
  filters?: ReactNode;
  children: ReactNode;
  surface?: boolean;
};

export function EntityDetailLayout({ fallbackTo, filters, children, surface = false }: Props) {
  return (
    <PageContainer className="max-w-6xl !pt-5 sm:!pt-7">
      <HistoryBackLink fallbackTo={fallbackTo} />
      {filters}
      {surface ? (
        <article className="mt-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">{children}</article>
      ) : (
        children
      )}
    </PageContainer>
  );
}

function MetricSkeletonGrid() {
  return (
    <div className="mt-6 grid grid-cols-2 border-y lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          className="border-b px-1 py-5 even:border-l even:pl-5 [&:nth-child(n+3)]:border-b-0 lg:border-b-0 lg:border-l lg:px-5 lg:first:border-l-0 lg:first:pl-1"
          key={index}
        >
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function AnalysisContentSkeleton() {
  return (
    <>
      <div className="-mx-5 mt-6 flex h-14 items-center justify-between border-y bg-card px-7 sm:-mx-7 sm:px-11">
        <div className="flex h-full items-center gap-5">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="hidden h-3 w-36 md:block" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      <section className="mt-8">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-5 rounded-xl bg-muted/35 px-5 py-4">
          <Skeleton className="h-4 w-4/5 max-w-2xl" />
          <Skeleton className="mt-2 h-4 w-3/5 max-w-xl" />
        </div>
        <MetricSkeletonGrid />
      </section>

      <section className="mt-9 border-t pt-9 sm:mt-12 sm:pt-12">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, column) => (
            <div
              className={column === 1 ? "border-t pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0" : ""}
              key={column}
            >
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-2 h-3 w-36" />
              <div className="mt-6 space-y-5">
                {Array.from({ length: 3 }, (_, row) => (
                  <div key={row}>
                    <div className="flex justify-between gap-4">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="mt-2.5 h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function NoticeContentSkeleton() {
  return (
    <>
      <MetricSkeletonGrid />
      <div className="mt-6 grid grid-cols-1 gap-4 border-y py-6 sm:grid-cols-5 sm:gap-0">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="flex items-center gap-3 sm:flex-col" key={index}>
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-3 w-12 max-w-[70%]" />
            <Skeleton className="h-3 w-16 max-w-[80%]" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex h-12 items-center gap-6 border-y px-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
      <section className="mt-8">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-5 space-y-5 border-y py-5">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="flex items-center justify-between gap-5" key={index}>
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="mt-2 h-3 w-4/5" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function EntityDetailContentSkeleton({ variant = "analysis" }: { variant?: "analysis" | "notice" }) {
  return (
    <div
      className="mt-6"
      aria-label={variant === "notice" ? "공고 상세 정보를 불러오는 중" : "분석 정보를 불러오는 중"}
      role="status"
    >
      {variant === "notice" ? <NoticeContentSkeleton /> : <AnalysisContentSkeleton />}
      <span className="sr-only">상세 정보를 불러오고 있습니다.</span>
    </div>
  );
}

export function EntityDetailHeaderSkeleton() {
  return (
    <div className="flex items-start gap-3" aria-hidden="true">
      <Skeleton className="size-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-12 rounded-md" />
          <Skeleton className="h-3 w-44 max-w-[60%]" />
        </div>
        <Skeleton className="mt-2.5 h-8 w-72 max-w-[80%]" />
      </div>
    </div>
  );
}
