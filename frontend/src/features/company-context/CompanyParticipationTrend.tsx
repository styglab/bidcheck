import { EntitySectionHeader } from "@/components/common/entity-detail-section";
import { MetricHelp } from "@/components/common/metric-help";
import { Badge } from "@/components/ui/badge";
import { formatCompactMoney } from "@/shared/format/money";
import type { CompanyParticipationAnalysis, CompanyProcurementProfile } from "./api";
import { participationCollectionLabel, participationSuccessRate } from "./participation-presentation";

export function CompanyParticipationTrend({
  analysis,
  contractYears,
  currentYear,
}: {
  analysis?: CompanyParticipationAnalysis;
  contractYears: CompanyProcurementProfile["yearly_activity"];
  currentYear: number;
}) {
  const years = [...(analysis?.yearly_activity ?? [])].sort((left, right) => left.year - right.year);
  const maximum = Math.max(1, ...years.map((item) => item.participation_count ?? 0));
  const contractsByYear = new Map(contractYears.map((item) => [item.year, item]));
  const rank = analysis?.basis?.maximum_opening_rank;
  const includesWinner = analysis?.basis?.retain_available_final_winner_regardless_of_rank;
  return (
    <>
      <EntitySectionHeader
        title="입찰·수주 추이"
        description="연도별로 관측된 참여와 낙찰 실적입니다."
        meta={
          <MetricHelp label="참여·성공률 집계 기준">
            <p>
              {rank != null && rank > 0
                ? `참여는 개찰 순위 1~${rank}위${includesWinner === true ? "와 원천 응답에 있는 최종 낙찰업체" : ""}를 기준으로 집계합니다.`
                : "참여의 개찰 순위 집계 범위는 확인이 필요합니다."}
            </p>
            <p className="mt-2">
              성공률은 수집된 참여 중 최종 결과가 확인된 기록의 비율이며, 업체 전체 참여 성공률과 다를 수
              있습니다. 최종 결과가 확인된 기록이 없으면 성공률을 표시하지 않습니다.
            </p>
            <p className="mt-2">
              ‘수집 중’은 알려진 입찰의 보존 대상 자료를 수집하는 상태입니다. 수집 완료도 전체 참여 이력의
              완전성을 의미하지 않습니다.
            </p>
            <p className="mt-2">
              별도 낙찰 실적은 참여 기록과 독립된 낙찰 건수로, 성공률의 분자에 포함하지 않습니다. 계약금액은
              기존 계약 집계의 연도 기준입니다.
            </p>
          </MetricHelp>
        }
      />
      <div className="mt-5 space-y-4" role="list" aria-label="연도별 참여 실적">
        {years.map((item) => {
          const rate = participationSuccessRate(item);
          const contractAmount = contractsByYear.get(item.year)?.attributed_contract_amount;
          const participation = item.participation_count;
          const hasParticipation = participation != null;
          return (
            <div role="listitem" aria-label={`${item.year}년 참여 실적`} key={item.year}>
              <div className="mb-2 flex flex-col gap-2 text-sm sm:flex-row sm:justify-between sm:gap-4">
                <span className="font-medium">
                  {item.year}년{item.year === currentYear ? " 누적" : ""}
                </span>
                <div className="space-y-1 sm:text-right">
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {hasParticipation && (
                      <strong>
                        참여 {participation.toLocaleString("ko-KR")}건 · 그중 낙찰{" "}
                        {item.observed_award_count.toLocaleString("ko-KR")}건
                        {rate ? ` · 관측 성공률 ${rate}` : ""}
                      </strong>
                    )}
                    <Badge variant="secondary">{participationCollectionLabel(item)}</Badge>
                  </div>
                  {hasParticipation && rate && (
                    <p className="text-xs text-muted-foreground">
                      성공률 기준: {item.success_rate_numerator.toLocaleString("ko-KR")} /{" "}
                      {item.success_rate_denominator.toLocaleString("ko-KR")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {item.independent_award_event_count > 0
                      ? `별도 낙찰 ${item.independent_award_event_count.toLocaleString("ko-KR")}건 · `
                      : ""}
                    계약금액 {contractAmount != null ? formatCompactMoney(contractAmount) : "확인 필요"}
                  </p>
                </div>
              </div>
              {hasParticipation && (
                <span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-chart-1"
                    style={{ width: `${(participation / maximum) * 100}%` }}
                  />
                </span>
              )}
            </div>
          );
        })}
        {!years.length && <p className="text-sm text-muted-foreground">참여 수집 상태 확인 필요</p>}
      </div>
    </>
  );
}
