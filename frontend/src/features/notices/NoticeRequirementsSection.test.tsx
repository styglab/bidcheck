import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NoticeRequirementsSection } from "./NoticeRequirementsSection";
import type { Requirement } from "./api";

afterEach(cleanup);

const requirements: Requirement[] = [
  {
    id: "region-1",
    type: "region",
    title: "서울특별시",
    mandatory: true,
    evidence: [],
  },
  {
    id: "industry-1",
    type: "industry",
    title: "소프트웨어사업자",
    industry_code: "1468",
    mandatory: true,
    evidence: [],
  },
  {
    id: "certificate-1",
    type: "certificate",
    title: "직접생산확인",
    mandatory: true,
    proposition_text: "유효한 직접생산확인증명서가 필요합니다.",
    evidence: [],
  },
];

describe("NoticeRequirementsSection", () => {
  it("shows notice requirements without company-specific assessment", () => {
    render(<NoticeRequirementsSection requirements={requirements} />);

    expect(screen.getByRole("heading", { name: "참가 조건" })).toBeInTheDocument();
    expect(screen.getAllByText("서울특별시")).toHaveLength(2);
    expect(screen.getByText("소프트웨어사업자 1468")).toBeInTheDocument();
    expect(screen.getByText("직접생산확인")).toBeInTheDocument();
    expect(screen.queryByText("충족")).not.toBeInTheDocument();
    expect(screen.queryByText("미충족")).not.toBeInTheDocument();
    expect(screen.getByText(/최종 참가 조건은 공고 원문을 함께 확인/)).toBeInTheDocument();
  });
});

it("allows every requirement to be opened, including clauses with the same industry code", async () => {
  const { default: userEvent } = await import("@testing-library/user-event");
  const items = Array.from({ length: 12 }, (_, index) => ({
    ...requirements[1],
    id: `industry-${index}`,
    title: `독립 조건 ${index + 1}`,
    proposition_text: `세부 조항 ${index + 1}`,
  }));
  render(<NoticeRequirementsSection requirements={items} />);
  await userEvent.click(screen.getByText("전체 참가요건 (12개)"));
  expect(screen.getByText("세부 조항 12")).toBeVisible();
  expect(screen.getByText("독립 조건 1 1468")).toBeVisible();
  expect(screen.getByText("독립 조건 12 1468")).toBeVisible();
});

it("shows nested all, any and not relationships without assigning an assessment", () => {
  render(
    <NoticeRequirementsSection
      requirements={requirements}
      expression={{
        operator: "all",
        conditions: [
          { operator: "leaf", requirement_id: "region-1" },
          {
            operator: "any",
            conditions: [
              { operator: "leaf", requirement_id: "industry-1" },
              { operator: "not", conditions: [{ operator: "leaf", requirement_id: "certificate-1" }] },
            ],
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("다음 조건을 모두 충족")).toBeVisible();
  expect(screen.getByText("다음 조건 중 하나 이상 충족")).toBeVisible();
  expect(screen.getByText("다음 조건에 해당하지 않아야 함")).toBeVisible();
  expect(screen.getByText("요건: 직접생산확인")).toBeVisible();
  expect(screen.queryByText("참여 가능")).not.toBeInTheDocument();
});

it("keeps unresolved conditions as requiring review", () => {
  render(
    <NoticeRequirementsSection
      requirements={requirements}
      expression={{
        operator: "all",
        conditions: [
          { operator: "leaf", requirement_id: "missing" },
          { operator: "any", conditions: [] },
        ],
      }}
    />,
  );
  expect(screen.getByText("참조된 요건 확인 필요")).toBeVisible();
  expect(screen.getByText("조건 관계 확인 필요")).toBeVisible();
});

it("does not match a missing leaf reference to a requirement with no local id", () => {
  render(<NoticeRequirementsSection requirements={requirements} expression={{ operator: "leaf" }} />);
  expect(screen.getByText("참조된 요건 확인 필요")).toBeVisible();
  expect(screen.queryByText("요건: 서울특별시")).not.toBeInTheDocument();
});

it("shows unknown expression operators as requiring review", () => {
  render(
    <NoticeRequirementsSection
      requirements={requirements}
      expression={
        {
          operator: "constructor",
          conditions: [{ operator: "leaf", requirement_id: "region-1" }],
        } as unknown as import("./api").RequirementExpression
      }
    />,
  );
  expect(screen.getByText("조건 관계 확인 필요")).toBeVisible();
});
