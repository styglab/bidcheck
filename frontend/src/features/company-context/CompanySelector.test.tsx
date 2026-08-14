import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
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
  it("clears the current company", async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoCompany));
    renderSelector();
    expect(screen.getByRole("button", { name: /ABC소프트/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ABC소프트/ }));
    await user.click(screen.getByRole("button", { name: "검토 업체 해제" }));
    expect(screen.getByRole("button", { name: "+ 업체 선택" })).toBeInTheDocument();
  });
  it("restores the selected company from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoCompany));
    renderSelector();
    expect(screen.getByRole("button", { name: /ABC소프트/ })).toBeInTheDocument();
  });
});
