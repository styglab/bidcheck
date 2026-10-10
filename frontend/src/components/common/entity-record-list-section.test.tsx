import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityRecordListSection } from "@/components/common/entity-record-list-section";

describe("EntityRecordListSection", () => {
  it("상세 조회 탭이 공유하는 제목, 검색, 결과 헤더를 제공한다", async () => {
    const user = userEvent.setup();
    const onSearchSubmit = vi.fn((event) => event.preventDefault());
    const onSearchValueChange = vi.fn();
    render(
      <EntityRecordListSection
        title="입찰 이력 조회"
        description="입찰 결과를 조회합니다."
        searchPlaceholder="공고명·발주기관명 검색"
        searchValue="정보시스템"
        appliedSearch="정보시스템"
        isLoading={false}
        isFetching={false}
        isError={false}
        error={undefined}
        errorTitle="입찰 이력"
        resultLabel="전체 입찰 이력"
        total={12}
        itemCount={1}
        emptyTitle="결과 없음"
        emptyDescription="조건을 바꿔 주세요."
        page={1}
        totalPages={3}
        onSearchValueChange={onSearchValueChange}
        onSearchSubmit={onSearchSubmit}
        onSearchClear={vi.fn()}
        onRetry={vi.fn()}
        onPageChange={vi.fn()}
      >
        <div>목록 내용</div>
      </EntityRecordListSection>,
    );

    expect(screen.getByRole("heading", { name: "입찰 이력 조회" })).toBeInTheDocument();
    expect(screen.getByText("전체 입찰 이력")).toBeInTheDocument();
    expect(screen.getByText("12건")).toBeInTheDocument();
    expect(screen.getByText("1 / 3페이지")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "검색" }));
    expect(onSearchSubmit).toHaveBeenCalledOnce();
  });
});
