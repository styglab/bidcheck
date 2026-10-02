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

export function EntityDetailLayout({ fallbackTo, filters, children, surface = true }: Props) {
  return <PageContainer className="max-w-6xl !pt-5 sm:!pt-7">
    <HistoryBackLink fallbackTo={fallbackTo} />
    {filters}
    {surface ? <article className="mt-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">{children}</article> : children}
  </PageContainer>;
}

export function EntityDetailContentSkeleton() {
  return <div className="mt-6 animate-pulse" aria-label="상세 정보를 불러오는 중" role="status">
    <div className="flex gap-3 border-b pb-3"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-24" /></div>
    <div className="mt-8"><Skeleton className="h-6 w-36" /><Skeleton className="mt-2 h-4 w-64 max-w-full" /><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton className="h-24 rounded-xl" key={index} />)}</div></div>
    <div className="mt-10 grid gap-6 lg:grid-cols-2"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
  </div>;
}
