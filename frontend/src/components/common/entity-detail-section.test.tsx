import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EntityDetailAction,
  EntityDetailSection,
  EntityMetric,
  EntityMetricGrid,
  EntityMetricValue,
  EntitySectionHeader,
} from "./entity-detail-section";

describe("entity detail section primitives", () => {
  it("exposes a consistent section hierarchy and secondary action", () => {
    render(
      <section>
        <EntitySectionHeader title="조달 현황" description="선택 조건의 집계입니다." />
        <EntityMetricGrid>
          <EntityMetric label="계약" value={<EntityMetricValue value="120" unit="건" />} />
        </EntityMetricGrid>
        <EntityDetailAction>전체 보기</EntityDetailAction>
      </section>,
    );

    expect(screen.getByRole("heading", { name: "조달 현황", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("선택 조건의 집계입니다.")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("건")).toHaveClass("text-sm");
    expect(screen.getByRole("button", { name: "전체 보기" })).toHaveAttribute("data-variant", "outline");
  });

  it("applies the shared spacing and divider to subsequent sections", () => {
    render(
      <EntityDetailSection divided headingId="history-title" title="계약 추이">
        <p>연도별 계약 정보</p>
      </EntityDetailSection>,
    );

    const heading = screen.getByRole("heading", { name: "계약 추이", level: 2 });
    expect(heading).toHaveAttribute("id", "history-title");
    expect(heading.closest("section")).toHaveClass("border-t", "sm:mt-12");
  });
});
