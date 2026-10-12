import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

const storageKey = "bidcheck-current-company";
const companyA = {
  id: "a",
  name: "테스트 회사 A",
  legalName: "테스트 회사 A",
  businessNumber: "1234567890",
  location: "서울",
};
const companyB = {
  ...companyA,
  id: "b",
  name: "테스트 회사 B",
  legalName: "테스트 회사 B",
  businessNumber: "0987654321",
};
const pagination = { page: 1, page_size: 20, total_items: 1, total_pages: 1 };
const notice = {
  id: "NOTICE:003",
  notice_number: "NOTICE",
  notice_order: "003",
  name: "브라우저 검증 공고",
  status: "open",
  work_type: "service",
  organization: "테스트 기관",
  notice_organization: "테스트 기관",
  requires_review: false,
  is_latest_in_lineage: true,
};
const requirement = { id: "req-1", title: "회사 자격", type: "certificate", mandatory: true, evidence: [] };
function assessment(number: string, lifecycle = "completed") {
  return {
    assessment: {
      outcome: "satisfied",
      lifecycle_status: lifecycle,
      satisfied_count: 1,
      unsatisfied_count: 0,
      needs_review_count: 0,
      reference_date: "2026-10-12",
    },
    requirement_assessments: [
      {
        id: "a1",
        requirement_id: "req-1",
        outcome: "satisfied",
        reasoning_summary: `${number} 회사의 검토 근거`,
        evidence_ids: [],
      },
    ],
    evidence: [],
  };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function seedCompany(page: Page) {
  await page.addInitScript(
    ({ key, company }) => {
      if (!localStorage.getItem("bidcheck-e2e-seeded")) {
        localStorage.setItem(key, JSON.stringify(company));
        localStorage.setItem("bidcheck-e2e-seeded", "1");
      }
    },
    { key: storageKey, company: companyA },
  );
}
async function selectCompany(page: Page) {
  await page.getByRole("button", { name: "회사 변경", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "회사명 또는 사업자등록번호" }).fill("테스트 회사 B");
  await dialog.getByRole("button", { name: "검색", exact: true }).click();
  await dialog.getByRole("button", { name: /테스트 회사 B.*선택/ }).click();
}
async function mockApi(context: BrowserContext, override?: (route: Route, path: string) => Promise<boolean>) {
  await context.route("**/api/v1/**", async (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname.replace("/api/v1", ""));
    if (override && (await override(route, path))) return;
    let body: unknown = {
      items: [],
      pagination,
      summary: {},
      events: [],
      awards: [],
      contracts: [],
      participations: [],
      filter_counts: {},
      truncated: false,
    };
    if (path === "/bids") body = { items: [notice], pagination, truncated: false };
    if (path === "/bids/NOTICE:003" || path === "/bids/NOTICE:004")
      body = {
        notice: { ...notice, id: path.split("/").at(-1) },
        requirements: [requirement],
        requirement_state: "ready",
        participation_findings: [],
      };
    if (path === "/companies/search")
      body = {
        items: [
          {
            id: companyB.id,
            name: companyB.name,
            business_registration_number: companyB.businessNumber,
            properties: { address: companyB.location },
          },
        ],
      };
    if (path === "/assessments")
      body = assessment(route.request().postDataJSON().business_registration_number);
    if (path === "/assessments/batch")
      body = {
        items: [
          {
            bid_notice_id: notice.id,
            status: "completed",
            outcome: "satisfied",
            satisfied_count: 1,
            unsatisfied_count: 0,
            needs_review_count: 0,
            issues: [],
          },
        ],
      };
    await route.fulfill({ json: body });
  });
}

test("회사 변경 후 늦게 도착한 이전 회사 응답을 표시하지 않는다", async ({ page, context }) => {
  const started = deferred();
  const release = deferred();
  const finished = deferred();
  await seedCompany(page);
  await mockApi(context, async (route, path) => {
    if (
      path !== "/assessments" ||
      route.request().postDataJSON().business_registration_number !== companyA.businessNumber
    )
      return false;
    started.resolve();
    await release.promise;
    // A cancelled request may no longer be fulfillable after switching companies.
    try {
      await route.fulfill({ json: assessment(companyA.businessNumber) });
    } catch {
      /* browser cancelled */
    }
    finished.resolve();
    return true;
  });
  await page.goto("/notices/NOTICE%3A003");
  await started.promise;
  await selectCompany(page);
  await expect(page.getByText(`${companyB.businessNumber} 회사의 검토 근거`)).toBeVisible();
  release.resolve();
  await finished.promise;
  await expect(page.getByText(`${companyA.businessNumber} 회사의 검토 근거`)).toHaveCount(0);
  await expect(page.getByText(`${companyB.businessNumber} 회사의 검토 근거`)).toBeVisible();
});

test("다른 실제 탭에서 해제한 회사와 평가를 제거하고 재방문에도 유지한다", async ({ page, context }) => {
  await seedCompany(page);
  await mockApi(context);
  await page.goto("/notices/NOTICE%3A003");
  await expect(page.getByText(`${companyA.businessNumber} 회사의 검토 근거`)).toBeVisible();
  const otherTab = await context.newPage();
  await otherTab.goto("/notices/NOTICE%3A003");
  await otherTab.getByRole("button", { name: "회사 변경", exact: true }).click();
  await otherTab.getByRole("button", { name: "검토 업체 해제", exact: true }).click();
  await expect(page.getByRole("link", { name: "회사 프로필 만들기" })).toBeVisible();
  await expect(page.getByText(`${companyA.businessNumber} 회사의 검토 근거`)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: "회사 프로필 만들기" })).toBeVisible();
});

test("이전 공고에서 명시된 최신 공고로 이동한 뒤 새 공고만 평가한다", async ({ page, context }) => {
  const assessedIds: string[] = [];
  await seedCompany(page);
  await mockApi(context, async (route, path) => {
    if (path === "/bids/NOTICE:003") {
      await route.fulfill({
        json: {
          notice: {
            ...notice,
            is_latest_in_lineage: false,
            lineage_status: "superseded",
            latest_bid_notice_id: "NOTICE:004",
          },
          requirements: [requirement],
          participation_findings: [],
        },
      });
      return true;
    }
    if (path === "/bids/NOTICE:004") {
      await route.fulfill({
        json: {
          notice: { ...notice, id: "NOTICE:004", notice_order: "004", name: "정정된 공고" },
          requirements: [requirement],
          participation_findings: [],
        },
      });
      return true;
    }
    if (path === "/assessments") assessedIds.push(route.request().postDataJSON().notice_id);
    return false;
  });
  await page.goto("/notices/NOTICE%3A003");
  await expect(page.getByText("이 공고는 재공고로 대체되었습니다.")).toBeVisible();
  await page.getByRole("link", { name: "최신 재공고 보기" }).click();
  await expect(page.getByRole("heading", { name: "정정된 공고", exact: true })).toBeVisible();
  await expect(page.getByText(`${companyA.businessNumber} 회사의 검토 근거`)).toBeVisible();
  expect([...new Set(assessedIds)]).toEqual(["NOTICE:004"]);
});

test("브라우저 저장소가 차단되어도 회사 선택과 해제가 동작한다", async ({ page, context }) => {
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      Storage.prototype[method] = () => {
        throw new DOMException("Blocked for test", "SecurityError");
      };
    }
  });
  await mockApi(context);
  await page.goto("/notices/NOTICE%3A003");
  await expect(page.getByText(/회사 선택을 브라우저에 저장하지 못했습니다/).first()).toBeVisible();
  await page.getByRole("button", { name: "다크 모드로 전환", exact: true }).click();
  await expect(page.getByRole("button", { name: "라이트 모드로 전환", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "회사 선택", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "회사명 또는 사업자등록번호" }).fill("테스트 회사 B");
  await dialog.getByRole("button", { name: "검색", exact: true }).click();
  await dialog.getByRole("button", { name: /테스트 회사 B.*선택/ }).click();
  await expect(page.getByText(`${companyB.businessNumber} 회사의 검토 근거`)).toBeVisible();
  await page.getByRole("button", { name: "회사 변경", exact: true }).click();
  await page.getByRole("button", { name: "검토 업체 해제", exact: true }).click();
  await expect(page.getByRole("link", { name: "회사 프로필 만들기" })).toBeVisible();
});

test("평가 갱신 중 상태를 표시하고 실행 실패를 충족으로 표시하지 않는다", async ({ page, context }) => {
  const release = deferred();
  let refreshRequested = false;
  await seedCompany(page);
  await mockApi(context, async (route, path) => {
    if (path !== "/assessments") return false;
    if (!refreshRequested) return false;
    await release.promise;
    await route.fulfill({ json: assessment(companyA.businessNumber, "failed") });
    return true;
  });
  await page.goto("/notices/NOTICE%3A003");
  await expect(page.getByLabel("종합 판정")).toHaveText("충족");
  await expect(page.getByText(/조회 시각:/)).toBeVisible();
  refreshRequested = true;
  await page.getByRole("button", { name: "다시 평가", exact: true }).click();
  await expect(page.getByText("평가 갱신 중 · 이전 조회 결과를 표시하고 있습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 평가", exact: true })).toBeDisabled();
  release.resolve();
  await expect(page.getByText("평가 실행 실패", { exact: true })).toBeVisible();
  await expect(page.getByLabel("종합 판정")).toHaveText("확인 필요");
  await expect(page.getByLabel("요건 판정")).toHaveCount(0);
});

test("목록에서도 회사 기준 결과를 수동으로 갱신한다", async ({ page, context }) => {
  let refreshRequested = false;
  await seedCompany(page);
  await mockApi(context, async (route, path) => {
    if (path !== "/assessments/batch" || !refreshRequested) return false;
    await route.fulfill({
      json: {
        items: [
          {
            bid_notice_id: notice.id,
            status: "completed",
            outcome: "needs_review",
            satisfied_count: 0,
            unsatisfied_count: 0,
            needs_review_count: 1,
            issues: [],
          },
        ],
      },
    });
    return true;
  });
  await page.goto("/notices");
  await expect(page.getByLabel("회사 기준 검토 결과")).toContainText("주요요건 충족");
  await expect(page.getByText(/회사 기준 결과 조회 시각:/)).toBeVisible();
  refreshRequested = true;
  await page.getByRole("button", { name: "회사 기준 결과 다시 평가", exact: true }).click();
  await expect(page.getByLabel("회사 기준 검토 결과")).toContainText("확인 필요 1");
  await expect(page.getByText("주요요건 충족", { exact: true })).toHaveCount(0);
});
