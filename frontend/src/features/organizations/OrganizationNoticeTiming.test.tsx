import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrganizationNoticeTiming } from "./OrganizationNoticeTiming";

describe("OrganizationNoticeTiming", () => {
  it("states that the distribution uses notice counts", () => {
    render(
      <OrganizationNoticeTiming
        periodLabel="2022–2026년"
        items={[
          { quarter: 1, notice_count: 19, notice_share: 0.25 },
          { quarter: 2, notice_count: 37, notice_share: 0.75 },
        ]}
      />,
    );

    expect(screen.getByText("2022–2026년 · 공고 56건 기준")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "분기별 공고 게시 비중 계산 기준" })).toBeInTheDocument();
  });
});
