import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyProvider, STORAGE_KEY } from "./CompanyContext";
import { CompanySelector } from "./CompanySelector";
import { demoCompany } from "./company";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
function renderSelector() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CompanyProvider>
        <CompanySelector />
      </CompanyProvider>
    </QueryClientProvider>,
  );
}
describe("CompanySelector", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  it("clears the current company", async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoCompany, businessNumber: "1234567890" }));
    renderSelector();
    expect(screen.getByRole("button", { name: /ABC소프트/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ABC소프트/ }));
    await user.click(screen.getByRole("button", { name: "검토 업체 해제" }));
    expect(screen.getByRole("button", { name: "+ 회사 적용" })).toBeInTheDocument();
  });
  it("restores the selected company from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoCompany, businessNumber: "1234567890" }));
    renderSelector();
    expect(screen.getByRole("button", { name: /ABC소프트/ })).toBeInTheDocument();
  });
  it("informs the user when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    renderSelector();
    expect(screen.getByRole("status")).toHaveTextContent("회사 선택을 브라우저에 저장하지 못했습니다.");
    expect(screen.getByRole("button", { name: "+ 회사 적용" })).toBeInTheDocument();
  });
});
