import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OrganizationActivityPanel } from "./OrganizationActivityPanel";

describe("OrganizationActivityPanel", () => {
  it("shows one resettable empty state for a filtered result", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(
      <MemoryRouter>
        <OrganizationActivityPanel
          periodLabel="2022–2026년"
          data={{
            items: [],
            stage_counts: {
              all: 0,
              scheduled: 0,
              open: 0,
              closed: 0,
              award: 0,
              contract: 0,
              failed_or_cancelled: 0,
            },
            pagination: { page: 1, total_items: 0, total_pages: 0 },
          }}
          isLoading={false}
          isFetching={false}
          error={null}
          isError={false}
          stage="contract"
          searchValue=""
          page={1}
          contextParams={new URLSearchParams()}
          onSearchValueChange={vi.fn()}
          onSearchSubmit={vi.fn()}
          onSearchClear={vi.fn()}
          onStageChange={vi.fn()}
          onReset={onReset}
          onRetry={vi.fn()}
          onPageChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "공고·계약 조회" })).toBeInTheDocument();
    expect(screen.getByText("선택한 조건에 해당하는 공고·계약이 없습니다")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "조건 초기화" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("shows notice and result amounts without inline contract history", () => {
    render(
      <MemoryRouter>
        <OrganizationActivityPanel
          periodLabel="2022–2026년"
          data={{
            items: [
              {
                activity_group_id: "contract-1",
                bid_notice_id: "R1:000",
                notice_linkage: "linked",
                notice_name: "정보시스템 구축",
                latest_stage: "contract",
                latest_activity_date: "2026-02-10",
                notice: {
                  published_at: "2026-01-03",
                  project_amount: 6_000_000_000,
                  project_amount_basis_name: "추정가격",
                },
                awards: [],
                contracts: [
                  {
                    contract_event_id: "event-1",
                    first_contract_date: "2026-02-01",
                    latest_contract_version_date: "2026-02-10",
                    current_contract_amount: 5_500_000_000,
                    contract_version_count: 2,
                    contract_family_id: "family-1",
                    contract_structure: "long_term_continuing",
                    contract_record_type: "original",
                    phase_number: 3,
                    total_contract_amount: 5_500_000_000,
                    phase_contract_amount: 2_963_336_000,
                    effective_contract_amount: 5_500_000_000,
                    amount_record_type: "initial_total",
                    is_current_record: true,
                    include_in_family_total: true,
                    amount_tax_basis: "unknown",
                    relationship_status: "confirmed",
                    lead_contractor: {
                      company_name: "테스트 계약업체",
                      business_registration_number: "1234567890",
                    },
                    contractor_count: 2,
                    contractors: [
                      {
                        company_name: "테스트 구성업체",
                        business_registration_number: "0987654321",
                        company_role: "consortium_member",
                      },
                      {
                        company_name: "테스트 계약업체",
                        business_registration_number: "1234567890",
                        company_role: "consortium_lead",
                      },
                    ],
                  },
                  {
                    contract_event_id: "event-unconfirmed",
                    first_contract_date: "2025-12-01",
                    latest_contract_version_date: "2025-12-01",
                    current_contract_amount: 1_000_000_000,
                    contract_version_count: 1,
                    contract_family_id: "family-unconfirmed",
                    contract_structure: "long_term_continuing",
                    contract_record_type: "original",
                    effective_contract_amount: 1_000_000_000,
                    amount_record_type: "unknown",
                    is_current_record: true,
                    include_in_family_total: true,
                    relationship_status: "confirmed",
                  },
                ],
                result_summary: {
                  award_count: 0,
                  contract_event_count: 2,
                  contract_version_count: 3,
                  effective_contract_amount: 5_500_000_000,
                  effective_contract_event_id: "event-1",
                  latest_confirmed_contract_amount: 5_500_000_000,
                  latest_confirmed_contract_event_id: "event-1",
                  contract_family_count: 2,
                  included_contract_family_count: 2,
                  amount_aggregation_status: "unresolved",
                  amount_aggregation_reason: "long_term_continuation_relationship_unresolved",
                },
              },
            ],
            stage_counts: {
              all: 1,
              scheduled: 0,
              open: 0,
              closed: 0,
              award: 0,
              contract: 1,
              failed_or_cancelled: 0,
            },
            pagination: { page: 1, total_items: 1, total_pages: 1 },
          }}
          isLoading={false}
          isFetching={false}
          error={null}
          isError={false}
          stage="all"
          searchValue=""
          page={1}
          contextParams={new URLSearchParams()}
          onSearchValueChange={vi.fn()}
          onSearchSubmit={vi.fn()}
          onSearchClear={vi.fn()}
          onStageChange={vi.fn()}
          onReset={vi.fn()}
          onRetry={vi.fn()}
          onPageChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("columnheader", { name: "공고금액" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "낙찰·계약 결과" })).toBeInTheDocument();
    expect(screen.getAllByText("테스트 계약업체 외 1개 업체").length).toBeGreaterThan(0);
    expect(screen.getAllByText("장기계속 총액").length).toBeGreaterThan(0);
    expect(screen.getAllByText("55 억원").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3차 계약 30 억원/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/계보 미확정/)).not.toBeInTheDocument();
    expect(screen.getByText("최근 변경")).toBeInTheDocument();
    expect(screen.queryByText("산정 불가")).not.toBeInTheDocument();
    expect(screen.queryByText(/낙찰업체와 동일/)).not.toBeInTheDocument();
    expect(screen.queryByText("현재 계약금액")).not.toBeInTheDocument();
    expect(screen.queryByText(/계약 기록 1건 · 낙찰 0건/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /접수 중/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /예정/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이력 보기" })).not.toBeInTheDocument();
    expect(screen.queryByText("이 공고의 낙찰·계약")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "정보시스템 구축" })[0]).toHaveAttribute(
      "href",
      "/notices/R1%3A000",
    );
  });
});
