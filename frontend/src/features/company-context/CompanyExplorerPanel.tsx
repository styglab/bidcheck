import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactMoney, formatExactMoney } from "@/shared/format/money";
import { participationCollectionLabel, participationSuccessRate } from "./participation-presentation";
import { useCompanyCompetitors, useCompanyProcurementProfile, type ContractCompanyCandidate } from "./api";

export function CompanyExplorerPanel({
  candidate,
  fromYear,
  toYear,
  compact = false,
}: {
  candidate: ContractCompanyCandidate;
  fromYear: number;
  toYear: number;
  compact?: boolean;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [competitorNumber, setCompetitorNumber] = useState<string>();
  const profile = useCompanyProcurementProfile(candidate.business_registration_number, { fromYear, toYear });
  const competitors = useCompanyCompetitors(
    candidate.business_registration_number,
    { fromYear, toYear },
    !compact,
  );
  const detail = `/companies/${candidate.business_registration_number}?fromYear=${fromYear}&toYear=${toYear}&name=${encodeURIComponent(candidate.name)}`;
  // Previous-condition placeholders must not appear as current-period evidence.
  const data = profile.isPlaceholderData ? undefined : profile.data;
  const summary = data?.summary;
  const participation = data?.participation_analysis?.summary;
  const years = [...(data?.yearly_activity ?? [])].sort((a, b) => a.year - b.year);
  const maximum = Math.max(1, ...years.map((year) => year.attributed_contract_amount ?? 0));
  const selectedCompetitor = competitors.isPlaceholderData
    ? undefined
    : competitors.data?.items?.find((item) => item.company_number === competitorNumber);
  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">선택 업체</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">{candidate.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{candidate.business_registration_number}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={detail}>
            업체 상세 <ArrowUpRight />
          </Link>
        </Button>
      </div>
      <section aria-label={`${candidate.name} 기간 전체 실적`}>
        <h3 className="text-sm font-semibold">기간 전체 실적</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {fromYear}–{toYear}년 · 전체 분야 · 올해 누적 포함. 검색어에 해당하는 계약만의 합계가 아닙니다.
        </p>
        {profile.isLoading || profile.isPlaceholderData ? (
          <Skeleton className="mt-4 h-20" />
        ) : profile.isError ? (
          <div role="alert" className="mt-3 text-sm">
            실적을 불러오지 못했습니다.{" "}
            <Button variant="link" onClick={() => void profile.refetch()}>
              다시 시도
            </Button>
          </div>
        ) : (
          <dl className="mt-4 grid grid-cols-3 gap-3 border-y py-4">
            <Metric label="계약금액" value={formatCompactMoney(summary?.total_attributed_contract_amount)} />
            <Metric
              label="계약 건수"
              value={
                summary?.contract_event_count == null ? "확인 필요" : `${summary.contract_event_count}건`
              }
            />
            <Metric
              label="거래기관"
              value={summary?.organization_count == null ? "확인 필요" : `${summary.organization_count}곳`}
            />
          </dl>
        )}
        {(data?.truncated ||
          data?.data_completeness?.status === "partial" ||
          (summary?.amount_completeness !== "complete" && summary != null)) && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            일부 실적 또는 금액이 누락될 수 있습니다.
          </p>
        )}
      </section>
      {!compact && (
        <>
          <section>
            <h3 className="text-sm font-semibold">연도별 계약금액</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              최초 계약일 기준 · 조회 종료일까지의 최신 계약금액
            </p>
            <div className="mt-4 space-y-3" aria-label="연도별 계약금액">
              {years.map((year) => (
                <div key={year.year} className="grid grid-cols-[3rem_1fr] gap-3 text-xs">
                  <span className="text-muted-foreground">{year.year}</span>
                  <div>
                    <div className="flex justify-between gap-2">
                      <span>{formatCompactMoney(year.attributed_contract_amount)}</span>
                      <span className="text-muted-foreground">
                        {year.amount_completeness === "complete" ? "" : "금액 확인 필요"}
                      </span>
                    </div>
                    {year.attributed_contract_amount != null && (
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${(Math.max(0, year.attributed_contract_amount) / maximum) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!years.length && <p className="text-xs text-muted-foreground">연도별 금액 확인 필요</p>}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold">관측 낙찰률 · 전체 분야</h3>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {participationSuccessRate(participation) ?? "확인 필요"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {participation
                ? `결과 확인 ${participation.success_rate_denominator}건 중 낙찰 ${participation.success_rate_numerator}건`
                : "참여·결과 데이터 확인 필요"}{" "}
              · {participationCollectionLabel(participation)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              수집된 참여 기록 기준이며 전체 참여의 실제 낙찰률과 다를 수 있습니다.{" "}
              {data?.participation_analysis?.basis?.maximum_opening_rank != null &&
                `개찰 ${data.participation_analysis.basis.maximum_opening_rank}위까지 관측`}
              {data?.participation_analysis?.basis?.retain_available_final_winner_regardless_of_rank &&
                " · 확인된 최종 낙찰업체 포함"}
            </p>
          </section>
          <section>
            <h3 className="text-sm font-semibold">함께 입찰한 업체 · 전체 분야</h3>
            {competitors.isLoading || competitors.isPlaceholderData ? (
              <Skeleton className="mt-3 h-20" />
            ) : competitors.isError ? (
              <p role="alert" className="mt-3 text-xs">
                경쟁관계를 불러오지 못했습니다.{" "}
                <Button variant="link" onClick={() => void competitors.refetch()}>
                  다시 시도
                </Button>
              </p>
            ) : (
              <div className="mt-2 divide-y">
                {competitors.data?.items?.map((item) => (
                  <button
                    type="button"
                    key={item.company_number}
                    aria-expanded={competitorNumber === item.company_number}
                    onClick={() =>
                      setCompetitorNumber(
                        competitorNumber === item.company_number ? undefined : item.company_number,
                      )
                    }
                    className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:text-primary"
                  >
                    <span>{item.company_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      공동 참여 {item.co_participation_count}건
                    </span>
                  </button>
                ))}
                {!competitors.data?.items?.length && (
                  <p className="py-3 text-xs text-muted-foreground">확인된 공동 참여 업체가 없습니다.</p>
                )}
              </div>
            )}
            {selectedCompetitor && (
              <div className="mt-2 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed">
                <strong>
                  {candidate.name} ↔ {selectedCompetitor.company_name}
                </strong>
                <p className="mt-2">
                  {fromYear}–{toYear}년 관측 공동 참여 {selectedCompetitor.co_participation_count}건. 업체
                  쌍별 낙찰 결과와 공동 참여 공고 목록은 현재 제공되지 않습니다.
                </p>
                <Link
                  className="mt-2 inline-block font-semibold text-primary hover:underline"
                  to={`/companies/${encodeURIComponent(selectedCompetitor.company_number)}?fromYear=${fromYear}&toYear=${toYear}`}
                >
                  경쟁업체 상세 보기 →
                </Link>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              수집된 참여 기록에서 확인한 관계입니다.{" "}
              {(competitors.data?.truncated || competitors.data?.data_completeness?.status === "partial") &&
                "일부 참여 데이터가 누락될 수 있습니다."}
            </p>
          </section>
          <section>
            <h3 className="text-sm font-semibold">주요 거래기관 · 전체 분야</h3>
            <ul className="mt-3 space-y-3">
              {data?.organization_relationships?.slice(0, 3).map((item) => (
                <li
                  key={item.organization_code ?? item.organization_name}
                  className="flex justify-between gap-3 text-sm"
                >
                  {item.organization_code ? (
                    <Link
                      className="hover:text-primary hover:underline"
                      to={`/organizations/${encodeURIComponent(item.organization_code)}?fromYear=${fromYear}&toYear=${toYear}`}
                    >
                      {item.organization_name ?? item.organization_code}
                    </Link>
                  ) : (
                    <span>{item.organization_name ?? "기관 확인 필요"}</span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatCompactMoney(item.total_attributed_contract_amount)}
                  </span>
                </li>
              ))}
            </ul>
            {!data?.organization_relationships?.length && (
              <p className="mt-3 text-xs text-muted-foreground">거래기관 확인 필요</p>
            )}
          </section>
        </>
      )}
      <section className="border-t pt-5">
        <h3 className="text-sm font-semibold">검색어와 연결된 계약 근거</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          조회된 표본에서 확인한 {candidate.contract_count}건 · 계약 전체 금액이며 업체 귀속 금액이 아닙니다.
        </p>
        <div className="mt-3 space-y-3">
          {candidate.contracts.slice(0, evidenceOpen ? undefined : 1).map((item) => (
            <article key={item.id} className="rounded-xl border p-3">
              <p className="text-sm font-medium">{item.name ?? "계약명 확인 필요"}</p>
              <p className="mt-2 text-sm font-semibold" title={formatExactMoney(item.amount)}>
                {formatCompactMoney(item.amount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.concluded_date ?? item.contract_date ?? "계약일 확인 필요"} · {item.id}
              </p>
              {item.bid_notice_id && (
                <Link
                  className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                  to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}
                >
                  공고 근거 보기 →
                </Link>
              )}
              {item.detail_url && /^https?:\/\//i.test(item.detail_url) && (
                <a
                  className="ml-3 text-xs text-primary hover:underline"
                  href={item.detail_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  원본 계약
                </a>
              )}
            </article>
          ))}
        </div>
        {!candidate.contracts.length && (
          <p className="mt-3 text-xs text-muted-foreground">
            업체명 검색입니다. 관련 계약은 사업 분야로 검색해 확인하세요.
          </p>
        )}
        {candidate.contracts.length > 1 && (
          <Button
            className="mt-3"
            variant="ghost"
            onClick={() => setEvidenceOpen(!evidenceOpen)}
            aria-expanded={evidenceOpen}
          >
            {evidenceOpen ? "근거 접기" : `계약 근거 ${candidate.contracts.length}건 보기`} <ChevronDown />
          </Button>
        )}
      </section>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-base font-bold tabular-nums">{value}</dd>
    </div>
  );
}
