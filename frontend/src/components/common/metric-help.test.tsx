import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MetricHelp } from "./metric-help";

describe("MetricHelp", () => {
  it("shows help content from a portal when the trigger is focused", async () => {
    const user = userEvent.setup();
    render(<MetricHelp label="집계 기준">최초 계약일 기준입니다.</MetricHelp>);

    await user.tab();

    expect(screen.getByRole("button", { name: "집계 기준" })).toHaveFocus();
    expect(screen.getByText("최초 계약일 기준입니다.")).toBeInTheDocument();
  });
});
