import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExplorerRelationshipPanel } from "./ExplorerRelationshipPanel";
import type { ExplorerLink } from "./useNetworkExplorer";

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock("@/shared/api/client", () => ({ api: apiMock }));

const link: ExplorerLink = {
  source: { type: "company", id: "1111111111", name: "업체 하나" },
  target: { type: "company", id: "2222222222", name: "업체 둘" },
  kind: "competition",
  count: 2,
  relationship: { contract_event_count: 0, amount_completeness: "unknown" },
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ExplorerRelationshipPanel
          link={link}
          params={new URLSearchParams("workType=service&field=FIELD")}
          fromYear={2024}
          toYear={2026}
          onSelect={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation(async (path: string) => ({
    items: path.includes("1111111111")
      ? [
          {
            bid_notice_id: "NOTICE:001",
            notice_number: "NOTICE",
            notice_name: "통합 유지관리 용역",
            participation_date: "2026-04-03T00:00:00Z",
          },
          { bid_notice_id: "ONLY-FIRST:001", notice_name: "첫 업체만 참여" },
        ]
      : [
          { bid_notice_id: "NOTICE:001", notice_name: "통합 유지관리 용역" },
          { bid_notice_id: "ONLY-SECOND:001", notice_name: "둘째 업체만 참여" },
        ],
    pagination: { total_pages: 1 },
    data_completeness: { status: "complete" },
  }));
});

afterEach(cleanup);

it("같은 입찰 참여 관계를 선택하면 두 업체가 함께 참여한 공고를 보여준다", async () => {
  mount();

  expect(await screen.findByRole("link", { name: "통합 유지관리 용역" })).toHaveAttribute(
    "href",
    "/notices/NOTICE%3A001",
  );
  expect(screen.getByText(/공고번호 NOTICE · 참여일 2026-04-03/)).toBeInTheDocument();
  expect(screen.queryByText("첫 업체만 참여")).not.toBeInTheDocument();
  expect(screen.queryByText("둘째 업체만 참여")).not.toBeInTheDocument();
  expect(apiMock).toHaveBeenCalledTimes(2);
  expect(apiMock.mock.calls[0][0]).toContain("work_type=service");
  expect(apiMock.mock.calls[0][0]).toContain("field_code=FIELD");
});
