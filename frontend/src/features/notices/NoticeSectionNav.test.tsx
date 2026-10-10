import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoticeSectionNav } from "./NoticeSectionNav";

describe("NoticeSectionNav", () => {
  it("moves to the selected detail section", () => {
    const target = document.createElement("section");
    target.id = "participation-requirements";
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    render(
      <NoticeSectionNav
        items={[
          { id: "participation-requirements", label: "참가 조건" },
          { id: "notice-analysis", label: "발주 분석" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "참가 조건" }));

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});
