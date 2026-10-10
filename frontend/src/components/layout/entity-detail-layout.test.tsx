import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { EntityDetailContentSkeleton, EntityDetailLayout } from "./entity-detail-layout";

describe("EntityDetailLayout", () => {
  it("uses the flat detail-page surface by default", () => {
    render(
      <MemoryRouter>
        <EntityDetailLayout fallbackTo="/notices">
          <div>상세 내용</div>
        </EntityDetailLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText("상세 내용").closest("article")).toBeNull();
  });

  it("keeps an explicit contained surface available", () => {
    render(
      <MemoryRouter>
        <EntityDetailLayout fallbackTo="/notices" surface>
          <div>카드 상세</div>
        </EntityDetailLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText("카드 상세").closest("article")).toHaveClass("rounded-2xl", "border");
  });

  it("uses loading structures that match analysis and notice detail pages", () => {
    const { rerender } = render(<EntityDetailContentSkeleton />);

    expect(screen.getByRole("status", { name: "분석 정보를 불러오는 중" })).toBeInTheDocument();

    rerender(<EntityDetailContentSkeleton variant="notice" />);
    expect(screen.getByRole("status", { name: "공고 상세 정보를 불러오는 중" })).toBeInTheDocument();
  });
});
