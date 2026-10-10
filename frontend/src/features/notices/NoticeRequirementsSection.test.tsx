import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoticeRequirementsSection } from "./NoticeRequirementsSection";
import type { Requirement } from "./api";

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
    expect(screen.getByText("서울특별시")).toBeInTheDocument();
    expect(screen.getByText("소프트웨어사업자 1468")).toBeInTheDocument();
    expect(screen.getByText("직접생산확인")).toBeInTheDocument();
    expect(screen.queryByText("충족")).not.toBeInTheDocument();
    expect(screen.queryByText("미충족")).not.toBeInTheDocument();
    expect(screen.getByText(/최종 참가 조건은 공고 원문을 함께 확인/)).toBeInTheDocument();
  });
});
