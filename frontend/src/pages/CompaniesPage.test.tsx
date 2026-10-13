import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompaniesPage } from "./CompaniesPage";

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock("@/shared/api/client", () => ({ api: apiMock }));
const candidate = (number: string, name: string, amount?: number) => ({
  business_registration_number: number,
  name,
  contract_count: 2,
  contracts: [{ id: `C-${number}`, name: "통합정보시스템 유지관리", amount, bid_notice_id: "NOTICE:001" }],
});
const candidates = [candidate("1234567890", "A테크", 100000000), candidate("0987654321", "B시스템")];
function BackButton() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>뒤로</button>;
}
function mount(path = "/companies") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <BackButton />
        <CompaniesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation(async (path: string) => {
    if (path.includes("contract-discovery"))
      return {
        items: candidates,
        sampled_contract_count: 2,
        partial: true,
        unidentified_contract_count: 0,
        analysis_basis: { period_from_year: 2024, period_to_year: 2026 },
      };
    if (path.includes("/competitors"))
      return {
        items: [{ company_number: "0987654321", company_name: "B시스템", co_participation_count: 4 }],
        data_completeness: { status: "partial" },
      };
    if (path.includes("procurement-profile"))
      return {
        company: { name: "업체" },
        summary: {
          total_attributed_contract_amount: 0,
          contract_event_count: 0,
          organization_count: 0,
          amount_completeness: "complete",
        },
        yearly_activity: [{ year: 2026, attributed_contract_amount: 0, amount_completeness: "complete" }],
        organization_relationships: [],
        participation_analysis: {
          summary: {
            observed_success_rate: 0,
            success_rate_numerator: 0,
            success_rate_denominator: 5,
            collection_status: "collecting",
          },
        },
        data_completeness: {},
      };
    return { items: [] };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("실적 업체 탐색", () => {
  it("검색 전에는 상세 분석 요청 없이 검색창을 제공한다", () => {
    mount();
    expect(screen.getByRole("heading", { name: "어떤 업체를 찾으세요?" })).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });
  it("검색 후 업체를 선택하면 같은 화면에서 근거와 관측 경쟁관계를 확인한다", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByRole("textbox", { name: "사업 분야 또는 업체명 검색" }), "유지관리");
    await user.click(screen.getByRole("button", { name: "검색" }));
    await user.click(await screen.findByRole("button", { name: "A테크 분석 보기" }));
    const panel = screen.getByRole("complementary", { name: "선택 업체 분석" });
    expect(await within(panel).findByText("0.0%")).toBeInTheDocument();
    expect(within(panel).getByText(/검색어에 해당하는 계약만의 합계가 아닙니다/)).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "공고 근거 보기 →" })).toHaveAttribute(
      "href",
      "/notices/NOTICE%3A001",
    );
    await user.click(await within(panel).findByRole("button", { name: /B시스템.*공동 참여 4건/ }));
    expect(
      within(panel).getByText(/업체 쌍별 낙찰 결과와 공동 참여 공고 목록은 현재 제공되지 않습니다/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "선택 해제" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "뒤로" }));
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });
  it("두 업체 비교를 열고 기간 변경 시 선택과 비교를 초기화한다", async () => {
    const user = userEvent.setup();
    mount("/companies?q=유지관리");
    await user.click(await screen.findByRole("button", { name: "비교 추가 A테크" }));
    await user.click(screen.getByRole("button", { name: "비교 추가 B시스템" }));
    await user.click(screen.getByRole("button", { name: "비교하기" }));
    expect(screen.getByRole("region", { name: "업체 실적 비교" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "조회 기간" }), { target: { value: "1" } });
    expect(screen.queryByRole("region", { name: "업체 실적 비교" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "비교하기" })).not.toBeInTheDocument();
  });
  it("모바일에서 업체 선택을 접근 가능한 Dialog로 제공한다", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const user = userEvent.setup();
    mount("/companies?q=유지관리");
    await user.click(await screen.findByRole("button", { name: "A테크 분석 보기" }));
    expect(screen.getByRole("dialog", { name: "선택 업체 분석" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A테크 분석 보기" })).toHaveFocus();
  });
  it("검색 오류를 빈 결과로 표시하지 않고 재시도를 제공한다", async () => {
    apiMock.mockRejectedValue(new Error("unavailable"));
    mount("/companies?q=유지관리");
    expect(await screen.findByRole("alert")).toHaveTextContent("검색 결과를 불러오지 못했습니다");
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.queryByText("검색된 업체가 없습니다.")).not.toBeInTheDocument();
  });
});
