import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CompanyVisualOverview } from "./CompanyVisualOverview";
import type { CompanyProcurementProfile } from "./api";
import type { ProcurementRelationship } from "@/features/organizations/api";
import type { EChartsCoreOption } from "echarts/core";
const { apiMock, chartOptions } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  chartOptions: [] as EChartsCoreOption[],
}));
vi.mock("@/shared/api/client", () => ({ api: apiMock }));
vi.mock("./CompanyRelationshipNetwork", () => ({
  CompanyRelationshipNetwork: () => <div>관계 네트워크</div>,
}));
vi.mock("./CompanyAnalysisChart", () => ({
  CompanyAnalysisChart: ({ label, option }: { label: string; option: EChartsCoreOption }) => {
    chartOptions.push(option);
    return <div role="img" aria-label={label} />;
  },
}));
const relationship = (code: string, name: string, amount?: number): ProcurementRelationship => ({
  organization_code: code,
  organization_name: name,
  company_number: code,
  company_name: name,
  participation_count: 0,
  award_event_count: 0,
  contract_event_count: 2,
  total_attributed_contract_amount: amount,
  amount_completeness: "complete",
  active_years: [2024],
  active_year_count: 1,
  yearly_activity: [],
  major_fields: [],
  representative_notices: [],
});
const profile: CompanyProcurementProfile = {
  company: { name: "중심 업체", business_registration_number: "1234567890" },
  summary: {
    notice_count: 0,
    participation_count: 0,
    award_event_count: 0,
    contract_event_count: 4,
    company_count: 1,
    organization_count: 2,
    total_attributed_contract_amount: 200,
    amount_completeness: "complete",
  },
  organization_relationships: [relationship("ORG1", "기관 하나", 100), relationship("ORG2", "기관 둘", 90)],
  yearly_activity: [
    {
      year: 2024,
      notice_count: 0,
      participation_count: 0,
      award_event_count: 0,
      contract_event_count: 0,
      attributed_contract_amount: 0,
      amount_completeness: "complete",
    },
  ],
  field_distribution: [],
  recent_activity: [],
  analysis_basis: {},
  data_completeness: {},
};
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/companies/1234567890?workType=service&field=FIELD"]}>
        <CompanyVisualOverview
          name="중심 업체"
          profile={profile}
          fromYear={2024}
          toYear={2025}
          competitors={{
            pagination: { page: 1, page_size: 5, total_items: 1, total_pages: 1 },
            items: [{ company_number: "0987654321", company_name: "경쟁 업체", co_participation_count: 3 }],
          }}
          competitorLoading={false}
          competitorError={false}
          onRetryCompetitors={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  apiMock.mockReset();
  chartOptions.length = 0;
  apiMock.mockResolvedValue({
    organization: { name: "기관" },
    company_relationships: [
      relationship("1234567890", "중심 업체", 100),
      relationship("2222222222", "금액 미확인 업체"),
      relationship("3333333333", "영원 업체", 0),
    ],
    truncated: true,
    data_completeness: { status: "partial" },
  });
});
afterEach(cleanup);
it("기관을 선택하면 동일 연도·분야의 분포를 조회하고 상세 연결을 유지한다", async () => {
  const user = userEvent.setup();
  mount();
  expect(await screen.findByText("기관 분석은 일부 데이터입니다.")).toBeInTheDocument();
  expect(apiMock.mock.calls[0][0]).toContain("/organizations/ORG1/procurement-profile?");
  expect(apiMock.mock.calls[0][0]).toContain("period_from_year=2024");
  expect(apiMock.mock.calls[0][0]).toContain("field_code=FIELD");
  await user.click(screen.getByRole("button", { name: "거래기관 · 기관 둘" }));
  expect(apiMock.mock.calls.some(([path]) => path.includes("/organizations/ORG2/procurement-profile"))).toBe(
    true,
  );
  await user.click(screen.getByRole("button", { name: "공동 참여 · 경쟁 업체" }));
  expect(screen.getByText("중심 업체 ↔ 경쟁 업체")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "경쟁업체 상세" })).toHaveAttribute(
    "href",
    expect.stringContaining("field=FIELD"),
  );
});
it("Treemap은 누락·0 금액에 면적을 만들지 않고 원래 값은 목록에 보존한다", async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByText("기관 분석은 일부 데이터입니다.");
  await user.click(screen.getByText("업체 금액 목록 · 3개"));
  expect(screen.getByRole("button", { name: /금액 미확인 업체.*금액 미상/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /영원 업체.*0/ })).toBeInTheDocument();
  const treemap = chartOptions.find((option) => (option.series as { type: string }[])[0].type === "treemap")!;
  expect((treemap.series as { data: unknown[] }[])[0].data).toHaveLength(1);
});
it("실적 차트는 확인된 0과 누락 연도를 구분한다", async () => {
  mount();
  await screen.findByText("기관 분석은 일부 데이터입니다.");
  const bar = chartOptions.find((option) => (option.series as { type: string }[])[0].type === "bar")!;
  expect((bar.series as { data: unknown[] }[])[0].data).toEqual([0, null]);
  const region = screen.getByRole("region", { name: "중심 업체 연도별 계약금액" });
  expect(within(region).getByText(/연도별 정확한 수치/)).toBeInTheDocument();
});
it("기관 조회 오류는 빈 분포로 처리하지 않고 재시도를 제공한다", async () => {
  apiMock.mockRejectedValue(new Error("unavailable"));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("기관 분석을 불러오지 못했습니다");
  expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
});
