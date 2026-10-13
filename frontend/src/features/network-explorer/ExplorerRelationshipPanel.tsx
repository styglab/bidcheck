import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Landmark, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationCompanyRelationship } from "@/features/organizations/api";
import { formatExactMoney } from "@/shared/format/money";
import { linkLabel, type ExplorerEntity, type ExplorerLink } from "./useNetworkExplorer";
import { api } from "@/shared/api/client";

export function ExplorerRelationshipPanel({
  link,
  params,
  fromYear,
  toYear,
  onSelect,
  snapshotId,
}: {
  link: ExplorerLink;
  params: URLSearchParams;
  fromYear: number;
  toYear: number;
  onSelect: (entity: ExplorerEntity) => void;
  snapshotId?: string;
}) {
  const [page, setPage] = useState(1);
  const institution = [link.source, link.target].find((e) => e.type === "organization");
  const company = [link.source, link.target].find((e) => e.type === "company");
  const kind = link.kind ?? "contract";
  const legacyQuery = useOrganizationCompanyRelationship(
    institution?.id,
    company?.id,
    page,
    toYear - fromYear + 1,
    {
      workType: params.get("workType") ?? undefined,
      fieldCode: params.get("field") ?? undefined,
      largeCategory: params.get("large") ?? undefined,
      middleCategory: params.get("middle") ?? undefined,
    },
    kind === "contract" && !snapshotId && Boolean(institution && company),
    { from: fromYear, to: toYear },
  );
  const networkQuery = useQuery({
    queryKey: ["explorer-network-relationship", institution?.id, company?.id, snapshotId, page, fromYear, toYear, params.get("field")],
    queryFn: ({ signal }) => {
      const search = new URLSearchParams({
        view_mode: "network_edge",
        snapshot_id: snapshotId!,
        period_from_year: String(fromYear),
        period_to_year: String(toYear),
        page: String(page),
        page_size: "20",
      });
      for (const [key, target] of [["field", "field_code"], ["workType", "work_type"]] as const) {
        if (params.get(key)) search.set(target, params.get(key)!);
      }
      return api<{
        events: Array<{ contract_event_id?: string; contract_name?: string; bid_notice_id?: string; attributed_contract_amount?: number; first_contract_date?: string }>;
        pagination: { total_pages: number };
        summary: { contract_count: number; total_attributed_contract_amount: number | null };
        snapshot_id: string;
      }>(`/organizations/${encodeURIComponent(institution!.id)}/companies/${encodeURIComponent(company!.id)}/relationship?${search}`, { signal });
    },
    enabled: kind === "contract" && Boolean(snapshotId && institution && company),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const query = snapshotId ? networkQuery : legacyQuery;
  const evidence = query.isError || query.isPlaceholderData ? undefined : query.data;
  const detail = link.relationship;
  return (
    <div className="space-y-5" aria-label="선택한 거래 정보">
      <header>
        <p className="text-xs font-semibold text-primary">선택한 관계</p>
        <h2 className="mt-2 text-lg font-bold">{linkLabel(link)}</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {fromYear}–{toYear}년 · 선택한 조건의 거래 내역
        </p>
      </header>
      <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
        {[link.source, link.target].map((entity, index) => {
          const Icon =
            entity.type === "organization" ? Landmark : entity.type === "company" ? Building2 : Tags;
          return (
            <div key={entity.id}>
              {index > 0 && (
                <ArrowRight className="mx-auto my-2 size-4 text-muted-foreground" aria-hidden="true" />
              )}
              <button
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-muted"
                onClick={() => onSelect(entity)}
              >
                <Icon
                  className={`size-4 shrink-0 ${entity.type === "organization" ? "text-blue-600" : "text-teal-600"}`}
                />
                <div>
                  <span className="text-[10px] text-muted-foreground">
                    {entity.type === "organization" ? "기관" : entity.type === "company" ? "업체" : "분야"}
                  </span>
                  <p className="text-sm font-semibold">{entity.name}</p>
                </div>
              </button>
            </div>
          );
        })}
      </div>
      {kind === "contract" ? (
        <dl className="divide-y rounded-xl border px-4 text-sm">
          <Metric
            label={link.label?.startsWith("조회 계약") ? "확인된 계약 기록" : "계약 건수"}
            value={detail.contract_event_count == null ? "확인 필요" : `${detail.contract_event_count}건`}
          />
          <Metric
            label="계약금액 (업체 몫)"
            value={formatExactMoney(detail.total_attributed_contract_amount)}
          />
          <Metric
            label="낙찰 건수"
            value={detail.award_event_count == null ? (snapshotId ? "현재 미제공" : "확인 필요") : `${detail.award_event_count}건`}
          />
          <Metric
            label="참여 건수 (수집 기록)"
            value={detail.participation_count == null ? (snapshotId ? "현재 미제공" : "확인 필요") : `${detail.participation_count}건`}
          />
          <Metric label="최근 계약일" value={detail.latest_contract_date?.slice(0, 10) ?? "확인 필요"} />
        </dl>
      ) : (
        <section className="rounded-xl border p-4">
          <p className="text-sm font-semibold">{linkLabel(link)}</p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {kind === "competition"
              ? "두 업체가 같은 입찰에 참여한 횟수입니다. 수집된 기록 기준이며, 누가 낙찰받았는지는 이 수치만으로 알 수 없습니다."
              : "일부 계약 기록에서 확인된 분야와 기관입니다. 전체 시장 실적은 아닙니다."}
          </p>
        </section>
      )}
      {kind === "contract" && detail.amount_completeness !== "complete" && (
        <p className="text-xs text-amber-700">일부 계약금액이 확인되지 않았습니다.</p>
      )}
      {detail.representative_notices?.length ? (
        <section>
          <h3 className="text-sm font-semibold">두 대상의 대표 공고</h3>
          <ul className="mt-3 space-y-3">
            {detail.representative_notices.slice(0, 5).map((notice, index) => (
              <li key={`${notice.bid_notice_id}-${index}`}>
                <Link
                  className="text-xs text-primary hover:underline"
                  to={`/notices/${encodeURIComponent(notice.bid_notice_id)}`}
                >
                  {notice.notice_name}
                </Link>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {{ contract: "계약", award: "낙찰", participation: "참여" }[notice.activity_type] ??
                    notice.activity_type}{" "}
                  · {notice.activity_date?.slice(0, 10) ?? "일자 확인 필요"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {kind === "contract" && (
        <section>
          <h3 className="text-sm font-semibold">관련 계약 내역</h3>
          {query.isLoading || query.isPlaceholderData ? (
            <Skeleton className="mt-3 h-24" />
          ) : query.isError ? (
            <p role="alert" className="mt-3 text-xs">
              계약 내역을 불러오지 못했습니다.{" "}
              <Button variant="link" size="sm" onClick={() => void query.refetch()}>
                다시 시도
              </Button>
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-3">
                {evidence?.events?.map((event, index) => (
                  <li
                    key={`${"contract_event_id" in event ? event.contract_event_id : "award_event_id" in event ? event.award_event_id : ""}-${event.bid_notice_id}-${index}`}
                    className="rounded-xl border p-3"
                  >
                    <p className="text-xs font-medium">{("contract_name" in event ? event.contract_name : "notice_name" in event ? event.notice_name : undefined) ?? "사업명 확인 필요"}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {formatExactMoney(event.attributed_contract_amount)} ·{" "}
                      {event.first_contract_date ?? ("contract_date" in event ? event.contract_date : undefined) ?? "계약일 확인 필요"}
                    </p>
                    {event.bid_notice_id && (
                      <Link
                        className="mt-2 inline-block text-xs text-primary"
                        to={`/notices/${encodeURIComponent(event.bid_notice_id)}`}
                      >
                        공고 보기 →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              {query.isSuccess && !evidence?.events?.length && (
                <p className="mt-3 text-xs text-muted-foreground">선택한 조건에 맞는 계약 내역이 없습니다.</p>
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  이전
                </Button>
                <span className="text-xs">{page}페이지</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!evidence?.pagination || page >= evidence.pagination.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  다음
                </Button>
              </div>
              {evidence && "data_completeness" in evidence && evidence.data_completeness?.status === "partial" && (
                <p className="mt-3 text-xs text-amber-700">일부 계약 내역만 확인됐습니다.</p>
              )}
            </>
          )}
        </section>
      )}
      <p className="text-[11px] leading-5 text-muted-foreground">
        {snapshotId
          ? "현재 관계 그래프는 계약 기록만 제공합니다. 계약은 최초 계약일 기준이며 금액은 읽기 모델 갱신 시점의 최신 업체 귀속금액입니다."
          : "참여 건수는 수집된 기록 기준입니다. 계약은 처음 체결한 날짜로 집계하며, 금액은 선택한 기간 끝의 최신 금액입니다. 공동계약은 해당 업체의 몫만 포함합니다."}
      </p>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
