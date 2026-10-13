import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NetworkExplorerPage } from "./NetworkExplorerPage";
import type { ExplorerEntity } from "@/features/network-explorer/useNetworkExplorer";
const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock("@/shared/api/client", () => ({ api: apiMock }));
vi.mock("@/features/network-explorer/ExplorerGraph", () => ({
  ExplorerGraph: ({
    entities,
    onSelect,
  }: {
    entities: ExplorerEntity[];
    onSelect: (entity: ExplorerEntity) => void;
  }) => (
    <div>
      {entities.map((entity) => (
        <button key={`${entity.type}:${entity.id}`} onClick={() => onSelect(entity)}>
          {entity.name} 노드
        </button>
      ))}
    </div>
  ),
}));
const summary = {
  contract_event_count: 2,
  total_attributed_contract_amount: 100,
  organization_count: 2,
  amount_completeness: "complete",
};
const relation = (id: string, name: string) => ({
  company_number: id,
  company_name: name,
  organization_code: id,
  organization_name: name,
  contract_event_count: 2,
  total_attributed_contract_amount: 100,
});
function Back() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>뒤로</button>;
}
function mount(path = "/relations") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Back />
        <NetworkExplorerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation(async (path: string) => {
    if (path.includes("/search/suggest"))
      return {
        organizations: [{ organization_code: "ORG1", name: "기관 하나" }],
        companies: [],
        notices: [],
      };
    if (path.includes("contract-discovery"))
      return { items: [], analysis_basis: { period_from_year: 2024, period_to_year: 2026 } };
    if (path.includes("/relationship?"))
      return {
        events: [
          {
            award_event_id: "E1",
            bid_notice_id: "N:001",
            notice_name: "실제 계약 근거",
            attributed_contract_amount: 0,
          },
        ],
        pagination: { total_pages: 1 },
        data_completeness: {},
      };
    if (path.includes("/organizations/"))
      return {
        organization: { name: path.includes("ORG2") ? "기관 둘" : "기관 하나" },
        summary,
        company_relationships: [relation("1234567890", "업체 A"), relation("0987654321", "업체 B")],
        field_distribution: [
          {
            field_code: "FIELD",
            field_name: "유지관리",
            selection_filter: { field_code: "FIELD", work_type: "service" },
          },
        ],
        data_completeness: {},
      };
    return {
      company: { name: "업체 A" },
      summary,
      organization_relationships: [relation("ORG1", "기관 하나"), relation("ORG2", "기관 둘")],
      data_completeness: {},
    };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("처음에는 패널을 접고 검색에서 기관을 선택해 탐색을 시작한다", async () => {
  const user = userEvent.setup();
  mount();
  expect(apiMock).not.toHaveBeenCalled();
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  await user.type(screen.getByRole("textbox", { name: "기관·업체·사업 분야 검색" }), "기관");
  await user.click(screen.getByRole("button", { name: "검색" }));
  await user.click(await screen.findByRole("button", { name: "기관 · 기관 하나" }));
  expect(await screen.findByRole("button", { name: "업체 A 노드" })).toBeInTheDocument();
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});
it("기관→업체→다른 기관을 펼치고 같은 기관은 중복하지 않는다", async () => {
  const user = userEvent.setup();
  mount(
    "/relations?center_type=organization&center_id=ORG1&center_name=기관%20하나&fromYear=2024&toYear=2026",
  );
  await user.click(await screen.findByRole("button", { name: "업체 A 노드" }));
  expect(screen.getByRole("complementary", { name: "선택 노드 분석" })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "기관 둘 노드" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "기관 하나 노드" })).toHaveLength(1);
  expect(await screen.findByText("실제 계약 근거")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "분석 패널 닫기" }));
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "기관 둘 노드" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "뒤로" }));
  expect(screen.getByRole("complementary")).toBeInTheDocument();
});
it("분야 변경은 확장·선택을 초기화하고 실제 필터를 전달한다", async () => {
  const user = userEvent.setup();
  mount("/relations?center_type=organization&center_id=ORG1");
  await user.click(await screen.findByRole("button", { name: "업체 A 노드" }));
  await user.selectOptions(screen.getByRole("combobox", { name: "관계 조회 분야" }), "field:FIELD:service");
  await waitFor(() =>
    expect(
      apiMock.mock.calls.some(
        ([path]) => path.includes("field_code=FIELD") && path.includes("work_type=service"),
      ),
    ).toBe(true),
  );
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});
it("모바일은 선택 분석을 하단 Dialog로 표시하고 Escape로 닫는다", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const user = userEvent.setup();
  mount("/relations?seed_type=organization&seed_id=ORG1");
  await user.click(await screen.findByRole("button", { name: "업체 A 노드" }));
  expect(screen.getByRole("dialog", { name: "선택 노드 분석" })).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
