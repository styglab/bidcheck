import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { EntityRecordListSection } from "@/components/common/entity-record-list-section";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { formatCompactMoney as money } from "@/shared/format/money";
import type { CompanyActivityResponse } from "./api";

type Props = {
  periodLabel: string;
  data?: CompanyActivityResponse;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  searchValue: string;
  appliedSearch?: string;
  page: number;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSearchClear: () => void;
  onReset: () => void;
  onRetry: () => void;
  onPageChange: (page: number) => void;
};

const resultLabel = {
  contract: "계약",
  award: "낙찰",
  unsuccessful: "미낙찰",
  unknown: "결과 미상",
} as const;

function ParticipationStatus({ result }: { result?: keyof typeof resultLabel }) {
  const successful = result === "contract" || result === "award";
  return (
    <Badge className="border-0 text-[10px]" variant={successful ? "default" : "secondary"}>
      {resultLabel[result ?? "unknown"]}
    </Badge>
  );
}

export function CompanyParticipationPanel({
  periodLabel,
  data,
  isLoading,
  isFetching,
  isError,
  error,
  searchValue,
  appliedSearch,
  page,
  onSearchValueChange,
  onSearchSubmit,
  onSearchClear,
  onReset,
  onRetry,
  onPageChange,
}: Props) {
  const items = data?.items ?? [];
  const total = data?.pagination.total_items ?? 0;

  return (
    <EntityRecordListSection
      title="입찰 이력 조회"
      description={`${periodLabel}에 이 업체가 참여한 입찰과 결과를 조회합니다.`}
      searchPlaceholder="공고명·발주기관명 검색"
      searchValue={searchValue}
      appliedSearch={appliedSearch}
      isLoading={isLoading && !data}
      isFetching={isFetching}
      isError={isError && !data}
      error={error}
      errorTitle="입찰 이력 목록"
      resultLabel="전체 입찰 이력"
      total={total}
      itemCount={items.length}
      emptyTitle="선택한 조건에 해당하는 입찰 이력이 없습니다"
      emptyDescription="검색어 또는 조회 조건을 변경해 다시 확인해 주세요."
      page={data?.pagination.page ?? page}
      totalPages={data?.pagination.total_pages}
      onSearchValueChange={onSearchValueChange}
      onSearchSubmit={onSearchSubmit}
      onSearchClear={onSearchClear}
      onReset={appliedSearch ? onReset : undefined}
      onRetry={onRetry}
      onPageChange={onPageChange}
    >
      <div className="overflow-hidden rounded-xl border bg-card md:hidden">
        {items.map((item) => (
          <article
            className="border-b transition-colors last:border-b-0 hover:bg-muted/30"
            key={item.bid_notice_id ?? item.id}
          >
            <Link
              className="grid sm:grid-cols-[minmax(0,1.7fr)_minmax(12rem,0.8fr)]"
              to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
            >
              <div className="min-w-0 p-4">
                <div className="flex min-w-0 items-start gap-2">
                  <ParticipationStatus result={item.result} />
                  <strong className="line-clamp-2 min-w-0 text-sm font-medium">
                    {item.notice_name ?? `공고 ${item.notice_number ?? ""}-${item.notice_order ?? ""}`}
                  </strong>
                </div>
                <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span>{item.organization_name ?? "기관 미상"}</span>
                  <span>·</span>
                  <span>{(item.participation_date ?? item.bid_at)?.slice(0, 10) ?? "일자 미상"}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t bg-muted/[0.08] px-4 py-3 text-xs sm:border-l sm:border-t-0">
                <span>
                  <span className="block text-muted-foreground">투찰금액</span>
                  <strong className="mt-1 block text-sm tabular-nums">{money(item.bid_amount)}</strong>
                </span>
                <span className="text-right">
                  <span className="block text-muted-foreground">순위</span>
                  <strong className="mt-1 block text-sm tabular-nums">
                    {item.rank != null ? `${item.rank}위` : "-"}
                  </strong>
                </span>
              </div>
            </Link>
          </article>
        ))}
      </div>

      <DataTable className="hidden md:block" minWidth={840}>
        <thead>
          <tr>
            <th className="w-24">결과</th>
            <th>공고명</th>
            <th className="w-52">발주기관</th>
            <th className="w-32 text-right">투찰금액</th>
            <th className="w-20 text-right">순위</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.bid_notice_id ?? item.id}>
              <td>
                <ParticipationStatus result={item.result} />
              </td>
              <td className="max-w-96">
                <Link
                  className="line-clamp-2 font-medium transition-colors hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
                >
                  {item.notice_name ?? `공고 ${item.notice_number ?? ""}-${item.notice_order ?? ""}`}
                </Link>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {(item.participation_date ?? item.bid_at)?.slice(0, 10) ?? "일자 미상"}
                </span>
              </td>
              <td>{item.organization_name ?? "기관 미상"}</td>
              <td className="text-right font-medium">{money(item.bid_amount)}</td>
              <td className="text-right">{item.rank != null ? `${item.rank}위` : "-"}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </EntityRecordListSection>
  );
}
