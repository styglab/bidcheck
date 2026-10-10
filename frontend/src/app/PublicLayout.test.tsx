import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicLayout } from "./PublicLayout";

vi.mock("@/components/search/global-search", () => ({
  GlobalSearch: ({ autoFocus }: { autoFocus?: boolean }) => (
    <input aria-label="공고·기관·업체 검색" data-autofocus={autoFocus || undefined} />
  ),
}));

vi.mock("../features/theme/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">화면 설정</button>,
}));

afterEach(cleanup);

function renderLayout(path = "/notices") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PublicLayout />} path="/">
          <Route element={<main>페이지 내용</main>} path="*" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicLayout", () => {
  it("keeps the global search and only the primary product navigation in the header", () => {
    renderLayout();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getByRole("link", { name: "공고 탐색" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(navigation).getByRole("link", { name: "기관 분석" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "업체 분석" })).toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "MCP" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "공고·기관·업체 검색" })).toBeInTheDocument();
  });

  it("uses exclusive mobile search and menu overlays", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "통합검색 열기" }));
    expect(screen.getByRole("button", { name: "통합검색 닫기" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("textbox", { name: "공고·기관·업체 검색" })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "메뉴 열기" }));
    expect(screen.queryByRole("button", { name: "통합검색 닫기" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "모바일 메뉴" })).toBeInTheDocument();
  });
});
