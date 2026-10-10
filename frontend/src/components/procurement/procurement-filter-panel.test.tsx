import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProcurementFilterPanel } from "./procurement-filter-panel";

afterEach(cleanup);

describe("ProcurementFilterPanel", () => {
  it("shows applied conditions and exposes remove, reset, and updating states", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const onReset = vi.fn();

    render(
      <ProcurementFilterPanel
        earliestYear={2022}
        currentYear={2026}
        period={[2022, 2026]}
        onPeriodChange={vi.fn()}
        onPeriodCommit={vi.fn()}
        workTypeValue="all"
        workTypeOptions={[{ value: "all", label: "전체" }]}
        onWorkTypeChange={vi.fn()}
        fieldValue="all"
        fieldOptions={[{ value: "all", label: "전체 분야" }]}
        onFieldChange={vi.fn()}
        appliedFilters={[{ key: "service", label: "용역", onRemove }]}
        onReset={onReset}
        isUpdating
      />,
    );

    expect(screen.getByRole("region", { name: "조회 조건" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("조건 적용 중");

    await user.click(screen.getByRole("button", { name: "용역" }));
    expect(onRemove).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "전체 초기화" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("filters field options by text and selects a matching field", async () => {
    const user = userEvent.setup();
    const onFieldChange = vi.fn();

    render(
      <ProcurementFilterPanel
        earliestYear={2022}
        currentYear={2026}
        period={[2022, 2026]}
        onPeriodChange={vi.fn()}
        onPeriodCommit={vi.fn()}
        workTypeValue="all"
        workTypeOptions={[{ value: "all", label: "전체" }]}
        onWorkTypeChange={vi.fn()}
        fieldValue="all"
        fieldOptions={[
          { value: "all", label: "전체 분야" },
          { value: "ict", label: "ICT 서비스 · 120억원" },
          { value: "construction", label: "건축공사 · 80억원" },
        ]}
        onFieldChange={onFieldChange}
        appliedFilters={[]}
        onReset={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "분야" }));
    await user.type(screen.getByRole("textbox", { name: "분야 검색" }), "ICT");

    expect(screen.getByRole("option", { name: /ICT 서비스/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /건축공사/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /ICT 서비스/ }));
    expect(onFieldChange).toHaveBeenCalledWith("ict");
  });
});
