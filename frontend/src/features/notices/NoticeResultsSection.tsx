import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { EntitySectionHeader } from "@/components/common/entity-detail-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListPagination } from "@/components/common/list-pagination";

import type { RefObject } from "react";
import { noticeProfilePresentation, exactMoney, date, percent } from "./notice-profile-presentation";

export function NoticeResultsSection({
  view,
  resultsRef,
  onPageChange,
}: {
  view: Pick<
    ReturnType<typeof noticeProfilePresentation>,
    | "notice"
    | "awards"
    | "contracts"
    | "participations"
    | "participationSummary"
    | "participationTotalPages"
    | "safeParticipationPage"
    | "visibleParticipations"
    | "participationPartial"
    | "hasContract"
    | "hasAward"
    | "winner"
    | "winnerContext"
    | "contractPartial"
  >;
  resultsRef: RefObject<HTMLDivElement | null>;
  onPageChange: (page: number) => void;
}) {
  const {
    notice,
    awards,
    contracts,
    participations,
    participationSummary,
    participationTotalPages,
    safeParticipationPage,
    visibleParticipations,
    participationPartial,
    hasContract,
    hasAward,
    winner,
    winnerContext,
    contractPartial,
  } = view;
  return (
    <div className="space-y-6">
      <section>
        <div className="scroll-mt-[calc(var(--site-header-height,70px)+1rem)]" ref={resultsRef} tabIndex={-1}>
          <EntitySectionHeader
            title="낙찰 정보"
            description="개찰 참여업체의 순위와 낙찰 결과입니다."
            meta={
              <strong className="text-sm text-foreground">
                {participationSummary?.source_participant_count != null
                  ? `참여 ${participationSummary.source_participant_count.toLocaleString("ko-KR")}개 · 확인 ${participations.length.toLocaleString("ko-KR")}개`
                  : `확인된 업체 ${participations.length.toLocaleString("ko-KR")}개`}
              </strong>
            }
          />
        </div>
        {participations.length > 0 ? (
          <>
            <div className="mt-4 hidden overflow-hidden rounded-xl border sm:block">
              <div className="grid grid-cols-[4rem_minmax(0,1fr)_9rem_7rem_6rem] gap-3 bg-muted/50 px-4 py-3 text-xs font-semibold text-muted-foreground">
                <span>순위</span>
                <span>업체</span>
                <span className="text-right">투찰금액</span>
                <span className="text-right">투찰률</span>
                <span className="text-center">결과</span>
              </div>
              {visibleParticipations.map((item) => {
                const itemAward = awards.find((award) => award.company_number === item.company_number);
                const resultLabel = itemAward ? "낙찰" : hasAward ? "미낙찰" : "확인 중";
                return (
                  <div
                    className={`grid grid-cols-[4rem_minmax(0,1fr)_9rem_7rem_6rem] items-center gap-3 border-t px-4 py-3 text-sm ${item.rank === 1 ? "bg-blue-50/60" : ""}`}
                    key={item.id}
                  >
                    <strong
                      className={
                        item.rank === 1 ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"
                      }
                    >
                      {item.rank != null ? `${item.rank}위` : "-"}
                    </strong>
                    {item.company_number ? (
                      <Link
                        className="truncate font-semibold hover:underline"
                        to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name ?? "업체")}`}
                      >
                        {item.company_name ?? "업체명 미확인"}
                      </Link>
                    ) : (
                      <strong className="truncate">{item.company_name ?? "업체명 미확인"}</strong>
                    )}
                    <span className="text-right tabular-nums">{exactMoney(item.bid_amount)}</span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {percent(item.bid_rate)}
                    </span>
                    <span className="text-center">
                      <Badge
                        className={
                          itemAward
                            ? "border-0 bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-950/60"
                            : ""
                        }
                        variant={itemAward ? "default" : "secondary"}
                      >
                        {resultLabel}
                      </Badge>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 divide-y overflow-hidden rounded-xl border sm:hidden">
              {visibleParticipations.map((item) => {
                const itemAward = awards.find((award) => award.company_number === item.company_number);
                const resultLabel = itemAward ? "낙찰" : hasAward ? "미낙찰" : "확인 중";
                return (
                  <article className={item.rank === 1 ? "bg-blue-50/60 p-4" : "p-4"} key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <strong
                          className={
                            item.rank === 1
                              ? "shrink-0 text-blue-700 dark:text-blue-300"
                              : "shrink-0 text-muted-foreground"
                          }
                        >
                          {item.rank != null ? `${item.rank}위` : "-"}
                        </strong>
                        {item.company_number ? (
                          <Link
                            className="font-semibold hover:underline"
                            to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name ?? "업체")}`}
                          >
                            {item.company_name ?? "업체명 미확인"}
                          </Link>
                        ) : (
                          <strong>{item.company_name ?? "업체명 미확인"}</strong>
                        )}
                      </div>
                      <Badge
                        className={
                          itemAward
                            ? "border-0 bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-950/60"
                            : ""
                        }
                        variant={itemAward ? "default" : "secondary"}
                      >
                        {resultLabel}
                      </Badge>
                    </div>
                    <p className="mt-2 pl-9 text-xs text-muted-foreground">
                      투찰 {exactMoney(item.bid_amount)} · 투찰률 {percent(item.bid_rate)}
                    </p>
                  </article>
                );
              })}
            </div>
            {participationPartial ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                원천 참여업체{" "}
                {participationSummary?.source_participant_count.toLocaleString("ko-KR") ?? "확인 필요"}개 중{" "}
                {participationSummary?.returned_participant_count.toLocaleString("ko-KR")}개가 확인되었습니다.
                일부 참여업체 또는 관계 정보가 누락되어 확인이 필요합니다.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                현재 데이터에서 확인 가능한 업체를 표시합니다.
              </p>
            )}
            <ListPagination
              label="참여업체 페이지"
              page={safeParticipationPage}
              totalPages={participationTotalPages}
              onChange={(page) => {
                onPageChange(page);
              }}
            />
          </>
        ) : (
          <p className="mt-4 rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">
            확인된 참여 업체 명단이 없습니다.
          </p>
        )}
      </section>
      {contractPartial && (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          계약 또는 관계 데이터 일부만 확인되었습니다. 전체 계약 이력은 공고 원문을 확인해 주세요.
        </p>
      )}
      {hasContract && (
        <section className="mt-9 border-t pt-9 sm:mt-12 sm:pt-12">
          <EntitySectionHeader
            title="계약 정보"
            description="최종 계약업체와 계약 결과입니다."
            meta={
              contracts[0]?.detail_url ? (
                <Button asChild size="sm" variant="outline">
                  <a href={contracts[0].detail_url} target="_blank" rel="noreferrer">
                    계약 원문 <ExternalLink className="ml-1 size-3.5" />
                  </a>
                </Button>
              ) : undefined
            }
          />
          <div className="mt-4 hidden overflow-hidden rounded-xl border sm:block">
            <div className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr_1.2fr] gap-3 bg-muted/50 px-4 py-3 text-xs font-semibold text-muted-foreground">
              <span>계약업체</span>
              <span className="text-right">계약금액</span>
              <span className="text-right">계약일</span>
              <span className="text-right">계약번호</span>
            </div>
            {contracts.map((contract) => (
              <div
                className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr_1.2fr] items-center gap-3 border-t px-4 py-4 text-sm"
                key={contract.id}
              >
                <strong className="truncate">
                  {contract.lead_contractor?.company_name ?? winner?.company_name ?? "업체명 미확인"}
                  {(contract.contractor_count ?? 0) > 1
                    ? ` 외 ${(contract.contractor_count ?? 1) - 1}개 업체`
                    : ""}
                </strong>
                <strong className="text-right tabular-nums">{exactMoney(contract.amount)}</strong>
                <span className="text-right tabular-nums text-muted-foreground">
                  {date(contract.concluded_date ?? contract.contract_date)}
                </span>
                <span className="truncate text-right font-mono text-xs text-muted-foreground">
                  {contract.contract_number ?? contract.unified_contract_number ?? "-"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 divide-y overflow-hidden rounded-xl border sm:hidden">
            {contracts.map((contract) => (
              <article className="p-4" key={contract.id}>
                <strong className="block">
                  {contract.lead_contractor?.company_name ?? winner?.company_name ?? "업체명 미확인"}
                  {(contract.contractor_count ?? 0) > 1
                    ? ` 외 ${(contract.contractor_count ?? 1) - 1}개 업체`
                    : ""}
                </strong>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">계약금액</dt>
                    <dd className="font-semibold tabular-nums">{exactMoney(contract.amount)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">계약일</dt>
                    <dd className="tabular-nums">
                      {date(contract.concluded_date ?? contract.contract_date)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">계약번호</dt>
                    <dd className="font-mono text-xs">
                      {contract.contract_number ?? contract.unified_contract_number ?? "-"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
      {!hasAward && !hasContract && (
        <p className="rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">
          확인된 낙찰·계약 결과가 없습니다.
        </p>
      )}
      {winner?.company_number &&
        (winnerContext?.prior_organization_relationship?.contract_event_count ?? 0) > 0 && (
          <section className="rounded-xl border bg-muted/20 p-5">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">이전 계약 이력</p>
            <p className="mt-2 font-bold">
              {notice.organization} ↔ {winner.company_name}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              이 공고 이전 계약 {winnerContext?.prior_organization_relationship?.contract_event_count}건 ·
              최근 계약 {date(winnerContext?.prior_organization_relationship?.latest_contract_date)}
            </p>
          </section>
        )}
    </div>
  );
}
