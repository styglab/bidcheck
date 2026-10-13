import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanySectorDiscovery } from "./CompanySectorDiscovery";

const { discovery } = vi.hoisted(() => ({ discovery: vi.fn() }));
vi.mock("./api", () => ({ useCompanySectorDiscovery: discovery }));
const data = {
  year: 2025,
  sectors: ["goods", "service", "construction"].map((work_type) => ({
    work_type,
    status: "available",
    fields: [
      {
        field_code: `FIELD-${work_type}`,
        field_name: `${work_type} 공식 분야`,
        representative_contract_amount: 9000,
        status: "available",
        partial: false,
        companies: [
          {
            business_registration_number: "1234567890",
            name: `${work_type} 실적 업체`,
            contract_event_count: 7,
            total_attributed_contract_amount: work_type === "goods" ? 0 : null,
            amount_completeness: "unknown",
            organization_count: 2,
            major_organizations: [{ organization_name: "주요 거래기관" }],
          },
        ],
      },
    ],
  })),
};
beforeEach(() => discovery.mockReturnValue({ data, isError: false, isFetching: false }));
afterEach(cleanup);
function renderSection() {
  return render(
    <MemoryRouter>
      <CompanySectorDiscovery />
    </MemoryRouter>,
  );
}

describe("물품 용역 공사별 업체 탐색", () => {
  it("세 업무 유형을 동시에 펼치고 업체 상세에 분야와 실적 연도를 보존한다", () => {
    renderSection();
    for (const title of ["물품", "용역", "공사"])
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    const goods = within(screen.getByRole("region", { name: "물품 주요 분야와 업체" }));
    expect(goods.getByRole("link", { name: "goods 실적 업체" })).toHaveAttribute(
      "href",
      "/companies/1234567890?fromYear=2025&toYear=2025&workType=goods&field=FIELD-goods&name=goods+%EC%8B%A4%EC%A0%81+%EC%97%85%EC%B2%B4",
    );
    expect(goods.getByText(/^0\s*원$/)).toBeInTheDocument();
    expect(goods.getByText(/계약 7건 · 거래기관 2곳/)).toBeInTheDocument();
    expect(goods.getByText(/주요 거래기관/)).toBeInTheDocument();
    expect(screen.getAllByText("금액 확인 필요")).toHaveLength(2);
  });
  it("한 유형의 실패를 다른 유형의 결과와 구분한다", () => {
    discovery.mockReturnValue({
      data: {
        ...data,
        sectors: data.sectors.map((sector) =>
          sector.work_type === "service" ? { ...sector, status: "unavailable", fields: [] } : sector,
        ),
      },
      isError: false,
      isFetching: false,
    });
    renderSection();
    expect(screen.getByText("용역 분야를 조회하지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "goods 실적 업체" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "construction 실적 업체" })).toBeInTheDocument();
  });
  it("물품 프로필의 공식 분야를 사용한 경우 대표 계약금액을 추정해서 표시하지 않는다", () => {
    discovery.mockReturnValue({
      data: {
        ...data,
        sectors: [
          {
            ...data.sectors[0],
            fields: [
              {
                ...data.sectors[0].fields[0],
                selection_basis: "supplier_official_field",
                representative_contract_amount: null,
              },
            ],
          },
        ],
      },
      isError: false,
      isFetching: false,
    });
    renderSection();
    const goods = within(screen.getByRole("region", { name: "물품 주요 분야와 업체" }));
    expect(goods.getByText("대형 계약업체의 공식 물품 분야")).toBeInTheDocument();
    expect(goods.queryByText(/조회된 대표 계약/)).not.toBeInTheDocument();
  });
});
