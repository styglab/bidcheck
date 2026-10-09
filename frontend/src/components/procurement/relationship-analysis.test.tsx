import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RelationshipAnalysis } from "@/components/procurement/relationship-analysis";

describe("RelationshipAnalysis", () => {
  it("팝업에서는 관련 공고를 5건만 보여주고 전체 보기 동작을 제공한다", async () => {
    const user = userEvent.setup();
    const onOpenAllEvents = vi.fn();
    render(
      <MemoryRouter>
        <RelationshipAnalysis
          compact
          eyebrow="기관 × 업체"
          title="기관 × 업체"
          context="계약 기준"
          summary={{ contractCount: 10, activeYearCount: 2 }}
          years={[2025, 2026]}
          yearlyActivity={[]}
          fields={[]}
          events={Array.from({ length: 6 }, (_, index) => ({
            award_event_id: `award-${index + 1}`,
            bid_notice_id: `notice-${index + 1}`,
            notice_name: `관련 공고 ${index + 1}`,
          }))}
          eventPreviewLimit={5}
          eventTotalCount={10}
          onOpenAllEvents={onOpenAllEvents}
          money={(value) => `${value ?? 0}원`}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("관련 공고 1").length).toBeGreaterThan(0);
    expect(screen.queryByText("관련 공고 6")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "관련 공고·계약 10건 전체 보기" }));
    expect(onOpenAllEvents).toHaveBeenCalledOnce();
  });
});
