import { expect, test } from "@playwright/test";

const collecting = {
  participation_count: null,
  observed_participation_count: 0,
  result_confirmed_participation_count: 0,
  observed_award_count: 0,
  independent_award_event_count: 85,
  observed_success_rate: null,
  success_rate_numerator: 0,
  success_rate_denominator: 0,
  overall_success_rate: null,
  collection_status: "collecting",
  collection_status_label: "수집 중",
};
const observed = {
  ...collecting,
  participation_count: 125,
  observed_participation_count: 125,
  result_confirmed_participation_count: 125,
  observed_award_count: 73,
  independent_award_event_count: 98,
  observed_success_rate: 0.584,
  success_rate_numerator: 73,
  success_rate_denominator: 125,
};
const legacy = {
  year: 2024,
  notice_count: 1,
  participation_count: 999,
  award_event_count: 999,
  award_success_rate: 0.999,
  contract_event_count: 1,
  attributed_contract_amount: 100_000_000,
  amount_completeness: "complete",
};

test("업체 상세에서 새 참여 계약과 수집 상태를 사용하고 별도 실적과 계약금액을 구분한다", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { items: [], pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 0 } };
    if (path.endsWith("/profile"))
      body = {
        business_registration: [{ business_name: "참여 검증 회사" }],
        suppliers: [],
        industries: [],
        products: [],
        sanctions: [],
        qualifications: [],
        direct_production: [],
        partial: false,
      };
    if (path.endsWith("/procurement-profile"))
      body = {
        company: { business_registration_number: "1234567890", name: "참여 검증 회사" },
        summary: {
          notice_count: 1,
          participation_count: 999,
          award_event_count: 999,
          award_success_rate: 0.999,
          contract_event_count: 2,
          company_count: 1,
          organization_count: 1,
          total_attributed_contract_amount: 120_000_000,
          amount_completeness: "complete",
        },
        yearly_activity: [legacy, { ...legacy, year: 2022, attributed_contract_amount: 20_000_000 }],
        participation_analysis: {
          summary: observed,
          yearly_activity: [
            { ...observed, year: 2024 },
            { ...collecting, year: 2023 },
            { ...collecting, year: 2022 },
          ],
          basis: {
            maximum_opening_rank: 10,
            retain_available_final_winner_regardless_of_rank: true,
            all_participants_retained: false,
          },
        },
        organization_relationships: [],
        field_distribution: [],
        project_type_distribution: [],
        work_type_distribution: [],
        pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 0 },
      };
    await route.fulfill({ json: body });
  });
  await page.goto("/companies/1234567890?fromYear=2022&toYear=2024");
  await expect(page.getByRole("heading", { name: "참여 검증 회사", exact: true })).toBeVisible();
  const older = page.getByRole("listitem", { name: "2022년 참여 실적" });
  await expect(older).toContainText("수집 중");
  await expect(older).toContainText("별도 낙찰 85건");
  await expect(older).toContainText("계약금액 2,000 만원");
  await expect(older).not.toContainText(/참여 0건|그중 낙찰|산정 불가|산출 불가|-%|관측 성공률/);
  const recent = page.getByRole("listitem", { name: "2024년 참여 실적" });
  await expect(recent).toContainText("참여 125건 · 그중 낙찰 73건 · 관측 성공률 58.4%");
  await expect(recent).toContainText("성공률 기준: 73 / 125");
  await expect(recent).toContainText("수집 중");
  await expect(recent).toContainText("별도 낙찰 98건");
  await expect(recent).toContainText("계약금액 1.0 억원");
  await expect(page.getByText(/999|99.9%/)).toHaveCount(0);
  await page.getByRole("button", { name: "참여·성공률 집계 기준" }).click();
  await expect(page.getByText(/개찰 순위 1~10위와 원천 응답에 있는 최종 낙찰업체/)).toBeVisible();
  await expect(page.getByText(/업체 전체 참여 성공률과 다를 수/)).toBeVisible();
  await expect(page.getByText(/수집 완료도 전체 참여 이력의 완전성을 의미하지/)).toBeVisible();
  expect(pageErrors).toEqual([]);
});
