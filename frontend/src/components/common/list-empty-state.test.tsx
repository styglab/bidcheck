import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListEmptyState } from "./list-empty-state";

describe("ListEmptyState", () => {
  it("explains an empty result and lets the user reset its conditions", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(
      <ListEmptyState
        title="선택한 조건에 해당하는 결과가 없습니다"
        description="검색어나 필터를 변경해 주세요."
        onReset={onReset}
      />,
    );

    expect(screen.getByText("선택한 조건에 해당하는 결과가 없습니다")).toBeInTheDocument();
    expect(screen.getByText("검색어나 필터를 변경해 주세요.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "조건 초기화" }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
