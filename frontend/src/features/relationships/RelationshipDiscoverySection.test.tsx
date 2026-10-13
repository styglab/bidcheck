import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RelationshipDiscoverySection } from "./RelationshipDiscoverySection";

const { discovery, profile, suppliers } = vi.hoisted(() => ({
  discovery: vi.fn(),
  profile: vi.fn(),
  suppliers: vi.fn(),
}));
vi.mock("./api", () => ({ useRelationshipDiscovery: discovery }));
vi.mock("@/features/organizations/api", () => ({
  useOrganizationProcurementProfile: profile,
  useOrganizationSupplierEntries: suppliers,
}));
const relationship = {
  company_number: "1234567890",
  company_name: "주요 업체",
  contract_event_count: 3,
  total_attributed_contract_amount: 300000000,
  amount_completeness: "complete",
};
const data = {
  organizations: Array.from({ length: 12 }, (_, index) => ({
    organization_code: `ORG${index}`,
    organization_name: `기관 ${index + 1}`,
    relationships: [relationship],
    company_structure: {
      contracted_company_count: 4,
      total_company_attributed_contract_amount: 1000000000,
      concentration_computable: true,
    },
    truncated: false,
  })),
  new_relationships: [{ organization_code: "ORG0", company_number: "1234567890", target_year: 2026 }],
  analysis_basis: { from_year: 2024, to_year: 2026 },
  partial: false,
};
beforeEach(() => {
  discovery.mockReturnValue({ data, isError: false, isLoading: false, isFetching: false });
  profile.mockReturnValue({ isError: false, isLoading: false });
  suppliers.mockImplementation((code) => ({
    isError: false,
    data: { items: data.new_relationships.filter((item) => item.organization_code === code) },
  }));
});
afterEach(cleanup);
const renderSection = () =>
  render(
    <MemoryRouter>
      <RelationshipDiscoverySection />
    </MemoryRouter>,
  );

it("실제 기관을 하나씩 넘기고 기타 비중 및 신규 관측 표시를 제공한다", async () => {
  const user = userEvent.setup();
  renderSection();
  expect(screen.getByRole("status")).toHaveTextContent("1 / 12");
  const map = within(screen.getByRole("region", { name: "기관 1" }));
  expect(map.getByText("30.0%")).toBeInTheDocument();
  expect(map.getByText("기타 3곳")).toBeInTheDocument();
  expect(map.getByText("70.0%")).toBeInTheDocument();
  expect(map.getByText("2026년 신규 관측")).toBeInTheDocument();
  expect(map.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "이전 기관" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "다음 기관" }));
  expect(screen.getByRole("region", { name: "기관 2" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("2 / 12");
  expect(screen.queryByRole("region", { name: "기관 1" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "이전 기관" }));
  expect(screen.getByRole("region", { name: "기관 1" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "기관 더 불러오기" }));
  expect(discovery).toHaveBeenLastCalledWith(3, "", 24);
  expect(screen.queryByRole("tab")).not.toBeInTheDocument();
});

it("좌우 스와이프는 기관을 바꾸고 세로 스크롤은 바꾸지 않는다", () => {
  renderSection();
  const slide = screen.getByRole("group", { name: "기관 1, 1 / 12" });
  fireEvent.touchStart(slide, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchEnd(slide, { changedTouches: [{ clientX: 50, clientY: 110 }] });
  expect(screen.getByRole("status")).toHaveTextContent("2 / 12");
  const next = screen.getByRole("group", { name: "기관 2, 2 / 12" });
  fireEvent.touchStart(next, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchEnd(next, { changedTouches: [{ clientX: 190, clientY: 250 }] });
  expect(screen.getByRole("status")).toHaveTextContent("2 / 12");
});

it("전체 집계 불확실성과 금액 누락을 0이나 전체 비중으로 보여주지 않는다", () => {
  suppliers.mockReturnValue({ isError: true });
  discovery.mockReturnValue({
    data: {
      ...data,
      partial: true,
      failed_new_relationship_count: 1,
      organizations: [
        {
          ...data.organizations[0],
          company_structure: { ...data.organizations[0].company_structure, concentration_computable: false },
          relationships: [
            relationship,
            {
              ...relationship,
              company_number: "UNKNOWN",
              company_name: "금액 미확인 업체",
              total_attributed_contract_amount: null,
            },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
  });
  renderSection();
  expect(screen.queryByText("30.0%")).not.toBeInTheDocument();
  expect(screen.queryByText("기타 3곳")).not.toBeInTheDocument();
  expect(screen.queryByText("금액 미확인 업체")).not.toBeInTheDocument();
  expect(screen.getByText(/전체 비중은 확인 필요/)).toBeInTheDocument();
  expect(screen.getByText(/신규 관계를 조회하지 못했습니다/)).toBeInTheDocument();
});

it("기관 목록은 먼저 보여주고 현재 기관의 맵만 로딩한다", async () => {
  const user = userEvent.setup();
  profile.mockReturnValue({ isLoading: true, isError: false });
  renderSection();
  expect(screen.getByRole("heading", { name: "기관 1" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("1 / 12");
  await user.click(screen.getByRole("button", { name: "다음 기관" }));
  expect(screen.getByRole("heading", { name: "기관 2" })).toBeInTheDocument();
  expect(profile).toHaveBeenLastCalledWith(
    "ORG1",
    3,
    {},
    true,
    { from: 2024, to: 2026 },
    { pageSize: 30, sort: "contract_amount_desc" },
  );
});
