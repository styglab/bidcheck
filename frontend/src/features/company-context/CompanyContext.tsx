import { type PropsWithChildren, useEffect, useMemo, useState } from "react";
import { type CompanySummary } from "./company";
import { CompanyContext } from "./context";

export const STORAGE_KEY = "bidcheck-current-company";
function restoreCompany(): CompanySummary | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as CompanySummary) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function CompanyProvider({ children }: PropsWithChildren) {
  const [currentCompany, setCurrentCompany] = useState<CompanySummary | null>(restoreCompany);
  useEffect(() => {
    if (currentCompany) localStorage.setItem(STORAGE_KEY, JSON.stringify(currentCompany));
    else localStorage.removeItem(STORAGE_KEY);
  }, [currentCompany]);
  const value = useMemo(
    () => ({ currentCompany, selectCompany: setCurrentCompany, clearCompany: () => setCurrentCompany(null) }),
    [currentCompany],
  );
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}
