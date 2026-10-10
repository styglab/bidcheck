import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntityDetailContextBar } from "./entity-detail-context-bar";

afterEach(cleanup);

describe("EntityDetailContextBar", () => {
  it("keeps tabs and condition controls together and toggles the filter panel", async () => {
    const user = userEvent.setup();
    const onFilterOpenChange = vi.fn();
    const onTabChange = vi.fn();

    const { rerender } = render(
      <EntityDetailContextBar
        appliedFilterCount={2}
        conditionSummary="2022–2026년 · 용역 · 기술용역"
        filterOpen={false}
        onFilterOpenChange={onFilterOpenChange}
        onTabChange={onTabChange}
        tabs={[
          { id: "overview", label: "개요" },
          { id: "notices", label: "공고·계약", count: 12 },
        ]}
        value="overview"
      >
        <div>조회 조건 패널</div>
      </EntityDetailContextBar>,
    );

    expect(screen.getByText("2022–2026년 · 용역 · 기술용역")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /공고·계약/ }));
    expect(onTabChange).toHaveBeenCalledWith("notices");

    await user.click(screen.getByRole("button", { name: /조건 변경/ }));
    expect(onFilterOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <EntityDetailContextBar
        appliedFilterCount={2}
        conditionSummary="2022–2026년 · 용역 · 기술용역"
        filterOpen
        onFilterOpenChange={onFilterOpenChange}
        onTabChange={onTabChange}
        tabs={[{ id: "overview", label: "개요" }]}
        value="overview"
      >
        <div>조회 조건 패널</div>
      </EntityDetailContextBar>,
    );

    expect(screen.getByText("조회 조건 패널")).toBeInTheDocument();

    onFilterOpenChange.mockClear();
    await user.keyboard("{Escape}");
    expect(onFilterOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: /조건 변경/ })).toHaveFocus();

    const onRetry = vi.fn();
    rerender(
      <EntityDetailContextBar
        appliedFilterCount={2}
        conditionSummary="2022–2026년 · 용역 · 기술용역"
        filterOpen={false}
        hasError
        onFilterOpenChange={onFilterOpenChange}
        onRetry={onRetry}
        onTabChange={onTabChange}
        tabs={[{ id: "overview", label: "개요" }]}
        value="overview"
      >
        <div>조회 조건 패널</div>
      </EntityDetailContextBar>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("적용 실패");
    await user.click(screen.getByRole("button", { name: "재시도" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
