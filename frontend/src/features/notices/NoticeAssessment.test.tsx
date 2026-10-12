import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { CompanyProvider } from "@/features/company-context/CompanyContext";
import { useCompany } from "@/features/company-context/useCompany";
import { api, ApiError } from "@/shared/api/client";
import { NoticeTable } from "./NoticeTable";
import { NoticeCompanyAssessment } from "./NoticeCompanyAssessment";
import type { Requirement } from "./api";

vi.mock("@/shared/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/api/client")>()),
  api: vi.fn(),
}));

const notice = {
  id: "NOTICE:003",
  notice_number: "NOTICE",
  notice_order: "003",
  name: "테스트 공고",
  status: "open",
  work_type: "service",
  organization: "테스트 기관",
  requires_review: false,
};
const requirements: Requirement[] = [
  {
    id: "req-1",
    type: "region",
    title: "서울 소재",
    mandatory: true,
    original_text: "서울 소재 업체",
    evidence: [],
  },
];

function CompanyControls() {
  const { selectCompany, clearCompany } = useCompany();
  return (
    <>
      {["1234567890", "0987654321"].map((number, index) => (
        <button
          key={number}
          onClick={() =>
            selectCompany({
              id: number,
              name: `회사 ${index + 1}`,
              legalName: `회사 ${index + 1}`,
              businessNumber: number,
              location: "서울",
            })
          }
        >
          회사 {index + 1} 적용
        </button>
      ))}
      <button onClick={clearCompany}>회사 해제</button>
    </>
  );
}

function renderAssessment(detail = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CompanyProvider>
          <CompanyControls />
          {detail ? (
            <NoticeCompanyAssessment noticeId="NOTICE:003" requirements={requirements} />
          ) : (
            <NoticeTable />
          )}
        </CompanyProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("공고의 회사 기준 평가", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    (api as Mock).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/bids?"))
        return {
          items: [notice],
          pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 },
          truncated: false,
        };
      const company = JSON.parse(String(init?.body)).business_registration_number;
      const outcome = company === "1234567890" ? "satisfied" : "needs_review";
      if (path === "/assessments/batch")
        return {
          items: [
            {
              bid_notice_id: "NOTICE:003",
              status: "completed",
              outcome,
              satisfied_count: 1,
              unsatisfied_count: 0,
              needs_review_count: outcome === "needs_review" ? 1 : 0,
              issues: [{ summary: `회사 ${company} 조건`, outcome }],
            },
          ],
        };
      return {
        assessment: {
          outcome,
          lifecycle_status: "completed",
          satisfied_count: 1,
          unsatisfied_count: 0,
          needs_review_count: 1,
        },
        requirement_assessments: [
          {
            id: "assessment-1",
            requirement_id: "req-1",
            evidence_ids: ["evidence-1"],
            outcome,
            summary: `회사 ${company} 근거`,
          },
        ],
        evidence: [
          { id: "evidence-1", source_document: "공고문.pdf", source_page: 2, source_excerpt: "확인된 출처" },
        ],
      };
    });
  });

  it("현재 페이지를 일괄 평가하고 회사 변경·해제를 반영한다", async () => {
    const user = userEvent.setup();
    renderAssessment();
    await screen.findByText("테스트 공고");
    expect((api as Mock).mock.calls.some(([path]) => path === "/assessments/batch")).toBe(false);
    await user.click(screen.getByRole("button", { name: "회사 1 적용" }));
    await screen.findByText("주요요건 충족");
    const calls = (api as Mock).mock.calls.filter(([path]) => path === "/assessments/batch");
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0][1].body)).toMatchObject({
      business_registration_number: "1234567890",
      bid_notice_ids: ["NOTICE:003"],
    });
    await user.click(screen.getByRole("button", { name: "회사 2 적용" }));
    await screen.findByText("회사 0987654321 조건 · 확인 필요");
    expect(screen.queryByText("주요요건 충족")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "회사 해제" }));
    expect(screen.queryByLabelText("회사 기준 검토 결과")).not.toBeInTheDocument();
  });

  it("상세에서 요건·판정·근거를 표시하고 회사 변경 시 평가를 갱신한다", async () => {
    const user = userEvent.setup();
    renderAssessment(true);
    expect(screen.getByRole("link", { name: "회사 프로필 만들기" })).toHaveAttribute(
      "href",
      "/company/setup?returnTo=%2Fnotices%2FNOTICE%253A003",
    );
    await user.click(screen.getByRole("button", { name: "회사 1 적용" }));
    await screen.findByText("회사 1234567890 근거");
    expect(screen.getByText("공고 요구사항: 서울 소재 업체")).toBeInTheDocument();
    await user.click(screen.getByText("판정 근거 (1건)"));
    expect(screen.getByText("공고문.pdf · 2쪽")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "회사 2 적용" }));
    await screen.findByText("회사 0987654321 근거");
    expect(
      within(screen.getByRole("article", { name: "서울 소재" })).getByLabelText("요건 판정"),
    ).toHaveTextContent("확인 필요");
    expect(screen.queryByText("회사 1234567890 근거")).not.toBeInTheDocument();
  });

  it("연결된 근거만 각 요건에 표시하고 연결되지 않은 자료는 구분한다", async () => {
    const user = userEvent.setup();
    (api as Mock).mockResolvedValue({
      assessment: {
        outcome: "needs_review",
        lifecycle_status: "review_required",
        reference_date: "2026-10-12",
        ruleset_version: "rules-v1",
      },
      requirement_assessments: [
        { id: "a1", requirement_id: "req-1", outcome: "needs_review", evidence_ids: ["e1"] },
        { id: "a2", requirement_id: "req-2", outcome: "satisfied", evidence_ids: [] },
      ],
      evidence: [
        { id: "e2", source_document: "연결되지 않은 자료.pdf" },
        {
          id: "e1",
          excerpt: "지역 증빙 발췌",
          evidence_kind: "structured_api",
          observed_at_values: ["2026-10-11T00:00:00Z"],
          valid_from: "2026-01-01",
          valid_until: "2026-12-31",
          source_url: "https://example.com/evidence",
        },
      ],
      registry_version: "registry-v1",
    });
    renderAssessment(true);
    await user.click(screen.getByRole("button", { name: "회사 1 적용" }));
    await screen.findByText("서울 소재");
    const first = screen.getByRole("article", { name: "서울 소재" });
    await user.click(within(first).getByText("판정 근거 (1건)"));
    expect(within(first).getByText("지역 증빙 발췌")).toBeVisible();
    expect(within(first).queryByText("연결되지 않은 자료.pdf")).not.toBeInTheDocument();
    expect(within(first).getByText("2026-10-11T00:00:00Z")).toBeVisible();
    expect(within(first).getByText("2026-01-01 ~ 2026-12-31")).toBeVisible();
    expect(screen.getByText("연결된 판정 근거 확인 필요")).toBeInTheDocument();
    await user.click(screen.getByText("요건 연결 확인이 필요한 근거 (1건)"));
    expect(screen.getByText("연결되지 않은 자료.pdf")).toBeVisible();
    await user.click(screen.getByText("평가 기준·버전"));
    expect(screen.getByText("rules-v1")).toBeVisible();
    expect(screen.getByText("registry-v1")).toBeVisible();
  });

  it("평가 실패를 미충족으로 바꾸지 않고 재시도 경로를 제공한다", async () => {
    const user = userEvent.setup();
    (api as Mock).mockRejectedValue(new ApiError(502, "teoria_truncated", "근거 일부 누락"));
    renderAssessment(true);
    await user.click(screen.getByRole("button", { name: "회사 1 적용" }));
    await screen.findByRole("button", { name: "다시 불러오기" });
    expect(screen.queryByText("미충족")).not.toBeInTheDocument();
    expect(screen.queryByText("충족")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다시 불러오기" }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  });

  it.each([
    ["failed", "평가 실행 실패"],
    ["unknown", "평가 상태 확인 필요"],
    [undefined, "평가 상태 확인 필요"],
  ])("실행 상태 %s에서는 완료된 판정을 표시하지 않는다", async (lifecycle, label) => {
    (api as Mock).mockResolvedValue({
      assessment: { outcome: "satisfied", lifecycle_status: lifecycle, satisfied_count: 1 },
      requirement_assessments: [{ id: "a1", outcome: "satisfied", requirement_id: "req-1" }],
      evidence: [],
    });
    renderAssessment(true);
    await userEvent.click(screen.getByRole("button", { name: "회사 1 적용" }));
    await screen.findByText(label);
    expect(screen.getByLabelText("종합 판정")).toHaveTextContent("확인 필요");
    expect(screen.queryByLabelText("요건 판정")).not.toBeInTheDocument();
  });

  it("검토 필요 상태에서는 원천의 세 가지 판정값을 보존한다", async () => {
    (api as Mock).mockResolvedValue({
      assessment: { outcome: "unsatisfied", lifecycle_status: "review_required" },
      requirement_assessments: [],
      evidence: [],
    });
    renderAssessment(true);
    await userEvent.click(screen.getByRole("button", { name: "회사 1 적용" }));
    await screen.findByText("추가 검토 필요");
    expect(screen.getByLabelText("종합 판정")).toHaveTextContent("미충족");
  });

  it("수동 갱신 중 이전 결과임을 표시하고 갱신 실패 시 이전 판정을 숨긴다", async () => {
    const user = userEvent.setup();
    renderAssessment(true);
    await user.click(screen.getByRole("button", { name: "회사 1 적용" }));
    await screen.findByText("평가 완료");
    expect(screen.getByText(/조회 시각:/)).toBeInTheDocument();
    let rejectRequest!: (reason: Error) => void;
    (api as Mock).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        }),
    );
    await user.click(screen.getByRole("button", { name: "다시 평가" }));
    await screen.findByText("평가 갱신 중 · 이전 조회 결과를 표시하고 있습니다.");
    expect(screen.getByRole("button", { name: "다시 평가" })).toBeDisabled();
    rejectRequest(new ApiError(502, "assessment_response_mismatch", "평가 소속 확인 필요"));
    await screen.findByRole("button", { name: "다시 불러오기" });
    expect(screen.queryByLabelText("종합 판정")).not.toBeInTheDocument();
  });

  it("목록에서 사용자가 회사 기준 결과를 다시 평가할 수 있다", async () => {
    const user = userEvent.setup();
    renderAssessment();
    await user.click(screen.getByRole("button", { name: "회사 1 적용" }));
    await screen.findByText("주요요건 충족");
    expect(screen.getByText(/회사 기준 결과 조회 시각:/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "회사 기준 결과 다시 평가" }));
    await waitFor(() =>
      expect((api as Mock).mock.calls.filter(([path]) => path === "/assessments/batch")).toHaveLength(2),
    );
  });
});

afterEach(cleanup);
