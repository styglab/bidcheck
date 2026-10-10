import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityRelationshipList } from "@/components/common/entity-relationship-list";

describe("EntityRelationshipList", () => {
  it("기관과 업체가 공유하는 행 스타일과 선택 동작을 제공한다", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <EntityRelationshipList
        entityLabel="발주기관"
        items={[
          {
            key: "ORG-1",
            name: "테스트기관",
            amount: 120_000_000,
            contractCount: 3,
            latestContractDate: "2026-10-10",
            badges: [{ label: "신규 관측", variant: "outline" }],
          },
        ]}
        money={(value) => `${value ?? 0}원`}
        onSelect={onSelect}
      />,
    );

    expect(screen.getAllByText("테스트기관")).toHaveLength(2);
    expect(screen.getAllByText("신규 관측")).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: /테스트기관/ })[0]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: "ORG-1" }));
  });
});
