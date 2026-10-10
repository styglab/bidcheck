import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrganizationProcurementStructure } from "./OrganizationProcurementStructure";

afterEach(cleanup);

describe("OrganizationProcurementStructure", () => {
  it("combines work type, top fields, and contract methods without duplicated summaries", () => {
    render(
      <OrganizationProcurementStructure
        workTypes={[
          {
            work_type: "goods",
            work_type_name: "물품",
            event_count: 10,
            participation_count: 0,
            award_event_count: 0,
            contract_event_count: 8,
            attributed_contract_amount: 60,
          },
          {
            work_type: "service",
            work_type_name: "용역",
            event_count: 10,
            participation_count: 0,
            award_event_count: 0,
            contract_event_count: 5,
            attributed_contract_amount: 40,
          },
        ]}
        fields={Array.from({ length: 5 }, (_, index) => ({
          field_code: `field-${index + 1}`,
          field_name: `분야 ${index + 1}`,
          work_types: ["service"],
          event_count: 1,
          attributed_contract_amount: 28 - index,
        }))}
        totalFieldCount={6}
        totalContractAmount={100}
        contractMethods={[
          {
            method: "competitive",
            method_name: "경쟁계약",
            contract_event_count: 4,
            attributed_contract_amount: 70,
            contract_share: 0.4,
            amount_share: 0.7,
          },
          {
            method: "direct",
            method_name: "수의계약",
            contract_event_count: 6,
            attributed_contract_amount: 30,
            contract_share: 0.6,
            amount_share: 0.3,
          },
        ]}
        contractMethodAmountTotal={100}
      />,
    );

    expect(screen.getByRole("heading", { name: "조달 구조" })).toBeInTheDocument();
    expect(screen.getByText("계약금액 상위 5개 분야")).toBeInTheDocument();
    expect(screen.getByText("전체 6개 분야")).toBeInTheDocument();
    expect(screen.getByText(/전체의 28.0%/)).toBeInTheDocument();
    expect(screen.getByLabelText("계약 건수 비중")).toBeInTheDocument();
    expect(screen.getByLabelText("계약금액 비중")).toBeInTheDocument();
  });

  it("collapses meaningless 100 percent comparisons for a selected leaf field", () => {
    render(
      <OrganizationProcurementStructure
        workTypes={[
          {
            work_type: "goods",
            work_type_name: "물품",
            event_count: 11,
            participation_count: 0,
            award_event_count: 0,
            contract_event_count: 11,
            attributed_contract_amount: 13_700_000_000,
          },
        ]}
        fields={[
          {
            field_code: "needle",
            field_name: "피하주사용바늘",
            work_types: ["goods"],
            event_count: 11,
            attributed_contract_amount: 13_700_000_000,
          },
        ]}
        totalFieldCount={1}
        totalContractAmount={13_700_000_000}
        contractMethods={[
          {
            method: "competitive",
            method_name: "경쟁계약",
            contract_event_count: 11,
            attributed_contract_amount: 13_700_000_000,
            contract_share: 1,
            amount_share: 1,
          },
        ]}
        contractMethodAmountTotal={13_700_000_000}
        selectedWorkType="goods"
        selectedLargeCategory="피하주사용바늘"
      />,
    );

    expect(screen.queryByText("피하주사용바늘")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("계약 건수 비중")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("계약금액 비중")).not.toBeInTheDocument();
    expect(screen.getByText(/조회된 계약/)).toHaveTextContent("조회된 계약 11건은 모두 경쟁계약입니다.");
    expect(screen.getByText(/137 억원/)).toHaveTextContent("137 억원 · 금액 확인 계약 기준");
  });
});
