import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CompanyParticipationTrend } from "./CompanyParticipationTrend";
import type {
  CompanyParticipationAnalysis,
  CompanyParticipationMetrics,
  CompanyProcurementProfile,
} from "./api";

afterEach(cleanup);
const collecting: CompanyParticipationMetrics = {
  participation_count: null,
  observed_participation_count: 0,
  result_confirmed_participation_count: 0,
  observed_award_count: 0,
  independent_award_event_count: 85,
  observed_success_rate: null,
  success_rate_numerator: 0,
  success_rate_denominator: 0,
  overall_success_rate: null,
  collection_status: "collecting",
  collection_status_label: "수집 중",
};
const basis = {
  maximum_opening_rank: 10,
  retain_available_final_winner_regardless_of_rank: true,
  all_participants_retained: false,
};
const legacyYear = {
  year: 2024,
  notice_count: 0,
  participation_count: 999,
  award_event_count: 999,
  contract_event_count: 1,
  attributed_contract_amount: 100_000_000,
  amount_completeness: "complete" as const,
};
const contractYears: CompanyProcurementProfile["yearly_activity"] = [
  legacyYear,
  { ...legacyYear, year: 2022, attributed_contract_amount: 20_000_000 },
];
function show(years: CompanyParticipationAnalysis["yearly_activity"], customBasis = basis) {
  render(
    <CompanyParticipationTrend
      analysis={{ summary: collecting, yearly_activity: years, basis: customBasis }}
      contractYears={contractYears}
      currentYear={2026}
    />,
  );
}

describe("연도별 관측 참여", () => {
  it("shows collection status instead of fabricated zero counts or success rates", () => {
    show([
      { ...collecting, year: 2023 },
      { ...collecting, year: 2022 },
    ]);
    const year = within(screen.getByRole("listitem", { name: "2022년 참여 실적" }));
    expect(year.getByText("수집 중")).toBeVisible();
    expect(year.getByText(/별도 낙찰 85건/)).toBeVisible();
    expect(year.getByText(/계약금액 2,000 만원/)).toBeVisible();
    expect(
      year.queryByText(/참여 0건|그중 낙찰|성공률|산정 불가|참여 수집 중|-%|999/),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0]).toHaveAccessibleName("2022년 참여 실적");
  });
  it("uses observed awards and the API rate and denominator, keeping independent awards separate", () => {
    show([
      {
        ...collecting,
        year: 2024,
        participation_count: 125,
        observed_participation_count: 125,
        result_confirmed_participation_count: 125,
        observed_award_count: 73,
        observed_success_rate: 0.584,
        success_rate_numerator: 73,
        success_rate_denominator: 125,
      },
    ]);
    expect(screen.getByText("참여 125건 · 그중 낙찰 73건 · 관측 성공률 58.4%")).toBeVisible();
    expect(screen.getByText("성공률 기준: 73 / 125")).toBeVisible();
    expect(screen.getByText(/별도 낙찰 85건 · 계약금액 1.0 억원/)).toBeVisible();
    expect(screen.getByText("수집 중")).toBeVisible();
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
  });
  it("preserves a known zero participation count and hides an unavailable rate without claiming collection", () => {
    show([
      {
        ...collecting,
        year: 2024,
        participation_count: 0,
        independent_award_event_count: 0,
        collection_status: "complete",
        collection_status_label: "수집 완료",
      },
    ]);
    expect(screen.getByText("참여 0건 · 그중 낙찰 0건")).toBeVisible();
    expect(screen.getByText("수집 완료")).toBeVisible();
    expect(screen.queryByText("수집 중")).not.toBeInTheDocument();
    expect(screen.queryByText(/관측 성공률/)).not.toBeInTheDocument();
  });
  it("preserves zero percent when final results are confirmed", () => {
    show([
      {
        ...collecting,
        year: 2024,
        participation_count: 10,
        observed_success_rate: 0,
        success_rate_denominator: 10,
      },
    ]);
    expect(screen.getByText(/관측 성공률 0.0%/)).toBeVisible();
  });
  it.each(["failed", "unknown"] as const)("does not relabel %s as collecting", (status) => {
    show([
      {
        ...collecting,
        year: 2022,
        collection_status: status,
        collection_status_label: status === "failed" ? "수집 확인 필요" : "수집 상태 미확인",
      },
    ]);
    expect(screen.queryByText("수집 중")).not.toBeInTheDocument();
    expect(screen.getByText(status === "failed" ? "수집 확인 필요" : "수집 상태 미확인")).toBeVisible();
  });
  it("explains the supplied ranking scope and why collection completion is not full coverage", async () => {
    show([{ ...collecting, year: 2024 }]);
    await userEvent.click(screen.getByRole("button", { name: "참여·성공률 집계 기준" }));
    expect(screen.getByText(/개찰 순위 1~10위와 원천 응답에 있는 최종 낙찰업체/)).toBeVisible();
    expect(screen.getByText(/업체 전체 참여 성공률과 다를 수/)).toBeVisible();
    expect(screen.getByText(/수집 완료도 전체 참여 이력의 완전성을 의미하지/)).toBeVisible();
    expect(screen.getByText(/성공률의 분자에 포함하지/)).toBeVisible();
  });
  it("does not fall back to legacy participation totals when the new analysis is missing", () => {
    render(<CompanyParticipationTrend contractYears={contractYears} currentYear={2026} />);
    expect(screen.getByText("참여 수집 상태 확인 필요")).toBeVisible();
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
  });
});
