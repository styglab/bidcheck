import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ProcurementRelationship } from "@/features/organizations/api";
import { RelationshipTreemap } from "@/features/relationships/RelationshipTreemap";

const relationships: ProcurementRelationship[] = [
  {
    company_number: "1234567890",
    company_name: "테스트정보기술",
    participation_count: 4,
    award_event_count: 3,
    contract_event_count: 3,
    total_attributed_contract_amount: 30_000_000,
    amount_completeness: "complete",
    latest_contract_date: "2026-07-01",
    active_years: [2025, 2026],
    active_year_count: 2,
    yearly_activity: [],
    major_fields: [],
    representative_notices: [],
  },
];

describe("RelationshipTreemap", () => {
  it("관계 타일을 선택하면 인라인 요약과 이동 동작을 제공한다", async () => {
    const user = userEvent.setup();
    const onOpenContracts = vi.fn();
    render(
      <MemoryRouter>
        <RelationshipTreemap
          title="계약업체 구성"
          description="계약금액 비중으로 비교합니다."
          counterpartType="company"
          relationships={relationships}
          counterpartCount={1}
          totalAmount={30_000_000}
          topFiveShare={1}
          getCounterpartHref={() => "/companies/1234567890"}
          onOpenContracts={onOpenContracts}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /테스트정보기술, 계약 3건/ }));

    expect(screen.getByText("선택 관계")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /업체 상세/ })).toHaveAttribute("href", "/companies/1234567890");
    await user.click(screen.getByRole("button", { name: "계약 내역 보기" }));
    expect(onOpenContracts).toHaveBeenCalledWith(relationships[0]);
  });

  it("전체 집계가 있으면 불러오지 않은 업체를 실제 잔여 금액으로 묶는다", () => {
    const view = render(
      <MemoryRouter>
        <RelationshipTreemap
          title="업체별 계약 분포"
          description="계약금액 비중으로 비교합니다."
          counterpartType="company"
          relationships={relationships}
          counterpartCount={3}
          totalAmount={100_000_000}
          topFiveShare={0.6}
          aggregateUnlisted
          showMetrics={false}
          getCounterpartHref={() => undefined}
          onOpenContracts={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(within(view.container).getByRole("button", { name: /기타 2곳.*7,000/ })).toBeDisabled();
    expect(within(view.container).queryByText("귀속 계약금액")).not.toBeInTheDocument();
  });

  it("전체 분포와 주요 업체 비교를 함께 보여주고 업체 상세 시트를 연다", async () => {
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter>
        <RelationshipTreemap
          title="업체별 계약 분포"
          description="주요 업체를 비교합니다."
          counterpartType="company"
          relationships={relationships}
          counterpartCount={3}
          totalAmount={100_000_000}
          topFiveShare={0.3}
          enableDistributionView
          showMetrics={false}
          getCounterpartHref={() => undefined}
          onOpenContracts={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(within(view.container).queryByText(/기타 2곳/)).not.toBeInTheDocument();
    expect(within(view.container).getByText(/1개 · 전체의 30.0%/)).toBeInTheDocument();
    expect(within(view.container).getByText("상위 5개")).toBeInTheDocument();
    expect(within(view.container).getByText("나머지 2개")).toBeInTheDocument();

    await user.click(within(view.container).getByRole("button", { name: /테스트정보기술, 계약 3건/ }));

    expect(
      within(view.container).getByRole("dialog", { name: "테스트정보기술 계약 관계 상세" }),
    ).toBeInTheDocument();
    expect(within(view.container).queryByText("선택 업체")).not.toBeInTheDocument();
    expect(within(view.container).getByText("조회 조건 내 계약금액 비중")).toBeInTheDocument();
    expect(
      within(view.container).getByText("현재 조회 기간·분야의 전체 업체 귀속 계약금액 기준"),
    ).toBeInTheDocument();
  });
});
