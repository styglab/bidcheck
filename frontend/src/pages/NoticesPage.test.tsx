import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { NoticesPage } from "@/pages/NoticesPage";

const { useNoticesMock } = vi.hoisted(() => ({ useNoticesMock: vi.fn() }));

vi.mock("@/features/notices/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/notices/api")>();
  return { ...actual, useNotices: useNoticesMock };
});

const response = {
  items: [
    {
      id: "20261010001-00",
      notice_number: "20261010001",
      notice_order: "00",
      name: "공공 정보시스템 구축 사업",
      work_type: "service",
      status: "open",
      organization: "테스트 발주기관",
      organization_code: "ORG001",
      notice_organization: "테스트 발주기관",
      notice_organization_code: "ORG001",
      published_at: "2026-10-10T00:00:00Z",
      deadline_at: "2026-10-20T00:00:00Z",
      estimated_price: 300_000_000,
      requires_review: false,
    },
  ],
  pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 },
  truncated: false,
};

describe("NoticesPage", () => {
  it("공통 탐색 구조와 공고 목록을 보여주고 업무 구분을 적용한다", async () => {
    const user = userEvent.setup();
    useNoticesMock.mockReturnValue({
      data: response,
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/notices"]}>
        <NoticesPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("공고 탐색")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "참여할 공고를 찾아보세요" })).toBeInTheDocument();
    expect(screen.getByText("접수 중")).toBeInTheDocument();
    expect(screen.getByText(/3\.0\s*억원/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "용역" }));
    await user.click(screen.getByRole("button", { name: "검색" }));

    await waitFor(() =>
      expect(useNoticesMock).toHaveBeenCalledWith(expect.objectContaining({ work_type: "service" })),
    );
  });
});
