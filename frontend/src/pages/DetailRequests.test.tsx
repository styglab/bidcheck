import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCompanyDetailPage } from "@/features/company-context/useCompanyDetailPage";
import { useOrganizationDetailPage } from "@/features/organizations/useOrganizationDetailPage";

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock("@/shared/api/client", () => ({ api: apiMock }));
function wrapper(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/companies/:businessNumber" element={children} />
          <Route path="/organizations/:organizationId" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockResolvedValue({
    company: { name: "업체", business_registration_number: "1234567890" },
    organization: { name: "기관", organization_code: "ORG" },
    summary: { total_attributed_contract_amount: 0, contract_event_count: 0 },
    company_relationships: [],
    organization_relationships: [],
    field_distribution: [],
    yearly_activity: [],
    analysis_basis: {},
    items: [],
    business_registration: [],
    industries: [],
    suppliers: [],
    products: [],
  });
});
afterEach(cleanup);

describe("상세 화면의 필요한 요청", () => {
  it("업체 개요에서는 자격·기업 정보 요청을 시작하지 않고 정보 탭에서 불러온다", async () => {
    const { result } = renderHook(useCompanyDetailPage, { wrapper: wrapper("/companies/1234567890") });
    await waitFor(() => expect(result.current.procurement.isSuccess).toBe(true));
    expect(apiMock.mock.calls.some(([path]) => path.endsWith("/profile"))).toBe(false);
    expect(apiMock.mock.calls.some(([path]) => path.includes("/detail-context"))).toBe(false);
    await act(() => result.current.setTab("companyInfo"));
    await waitFor(() => expect(apiMock.mock.calls.some(([path]) => path.endsWith("/profile"))).toBe(true));
  });
  it("기관 업체 탭에서는 공고 활동과 신규 업체 전체 목록을 요청하지 않는다", async () => {
    const { result } = renderHook(useOrganizationDetailPage, {
      wrapper: wrapper("/organizations/ORG?tab=companies"),
    });
    await waitFor(() => expect(result.current.procurement.isSuccess).toBe(true));
    expect(apiMock.mock.calls.some(([path]) => path.includes("/procurement-activity"))).toBe(false);
    expect(apiMock.mock.calls.some(([path]) => path.includes("/supplier-entries"))).toBe(false);
    await act(() => result.current.setOverviewCompanyFilter("new"));
    await waitFor(() =>
      expect(apiMock.mock.calls.some(([path]) => path.includes("/supplier-entries"))).toBe(true),
    );
  });
});
