import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyProvider, STORAGE_KEY } from "./CompanyContext";
import { demoCompany } from "./company";
import { useCompany } from "./useCompany";

const company = { ...demoCompany, businessNumber: "1234567890" };
function Harness() {
  const { currentCompany, storageError, selectCompany, clearCompany } = useCompany();
  return (
    <>
      <p>{currentCompany?.name ?? "미적용"}</p>
      <p>{storageError ? "저장 실패" : "저장 가능"}</p>
      <button onClick={() => selectCompany(company)}>적용</button>
      <button onClick={clearCompany}>해제</button>
    </>
  );
}
function renderContext() {
  render(
    <CompanyProvider>
      <Harness />
    </CompanyProvider>,
  );
}
function synchronize(key: string | null = STORAGE_KEY, storageArea: Storage = localStorage) {
  act(() => window.dispatchEvent(new StorageEvent("storage", { key, storageArea })));
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("CompanyProvider", () => {
  it.each([
    "{",
    "null",
    "{}",
    JSON.stringify({ ...company, businessNumber: "123-45-*****" }),
    JSON.stringify({ ...company, location: 42 }),
  ])("discards invalid stored company: %s", (stored) => {
    localStorage.setItem(STORAGE_KEY, stored);
    renderContext();
    expect(screen.getByText("미적용")).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it("keeps selection usable when reads, writes, and removal are blocked", async () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const)
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
    renderContext();
    expect(screen.getByText("저장 실패")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "적용" }));
    expect(screen.getByText(company.name)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "해제" }));
    expect(screen.getByText("미적용")).toBeInTheDocument();
  });
  it("preserves in-memory selection when storage quota is exhausted", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    renderContext();
    await userEvent.click(screen.getByRole("button", { name: "적용" }));
    expect(screen.getByText(company.name)).toBeInTheDocument();
    expect(screen.getByText("저장 실패")).toBeInTheDocument();
  });
  it("synchronizes selection, removal and clear from other tabs without echo writes", () => {
    renderContext();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(company));
    const write = vi.spyOn(Storage.prototype, "setItem");
    synchronize();
    expect(screen.getByText(company.name)).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    localStorage.removeItem(STORAGE_KEY);
    synchronize();
    expect(screen.getByText("미적용")).toBeInTheDocument();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(company));
    synchronize();
    localStorage.clear();
    synchronize(null);
    expect(screen.getByText("미적용")).toBeInTheDocument();
  });
  it("ignores unrelated keys and session storage events", () => {
    renderContext();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(company));
    synchronize("unrelated");
    synchronize(STORAGE_KEY, sessionStorage);
    expect(screen.getByText("미적용")).toBeInTheDocument();
  });
  it("recovers from corrupt cross-tab changes even if cleanup fails", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(company));
    renderContext();
    localStorage.setItem(STORAGE_KEY, "{");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    synchronize();
    expect(screen.getByText("미적용")).toBeInTheDocument();
    expect(screen.getByText("저장 실패")).toBeInTheDocument();
  });
});

it("persists a local choice and removes it when cleared", async () => {
  renderContext();
  await userEvent.click(screen.getByRole("button", { name: "적용" }));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(company);
  await userEvent.click(screen.getByRole("button", { name: "해제" }));
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  expect(screen.getByText("미적용")).toBeInTheDocument();
});
