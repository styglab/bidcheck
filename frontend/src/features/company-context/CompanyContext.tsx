import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import { type CompanySummary } from "./company";
import { CompanyContext } from "./context";

export const STORAGE_KEY = "bidcheck-current-company";
type CompanyState = { currentCompany: CompanySummary | null; storageError: boolean };

function isStoredCompany(value: unknown): value is CompanySummary {
  if (typeof value !== "object" || value === null) return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.id === "string" &&
    fields.id.trim().length > 0 &&
    typeof fields.name === "string" &&
    fields.name.trim().length > 0 &&
    typeof fields.legalName === "string" &&
    typeof fields.location === "string" &&
    typeof fields.businessNumber === "string" &&
    /^\d{10}$/.test(fields.businessNumber)
  );
}

function restoreCompany(): CompanyState {
  let stored: string | null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { currentCompany: null, storageError: true };
  }
  if (stored === null) return { currentCompany: null, storageError: false };
  try {
    const value: unknown = JSON.parse(stored);
    if (isStoredCompany(value)) return { currentCompany: value, storageError: false };
  } catch {
    // Discard corrupt JSON along with values that fail shape validation.
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
    return { currentCompany: null, storageError: false };
  } catch {
    return { currentCompany: null, storageError: true };
  }
}

function persistCompany(currentCompany: CompanySummary | null): CompanyState {
  try {
    if (currentCompany) localStorage.setItem(STORAGE_KEY, JSON.stringify(currentCompany));
    else localStorage.removeItem(STORAGE_KEY);
    return { currentCompany, storageError: false };
  } catch {
    return { currentCompany, storageError: true };
  }
}

export function CompanyProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<CompanyState>(restoreCompany);
  const selectCompany = useCallback((company: CompanySummary) => setState(persistCompany(company)), []);
  const clearCompany = useCallback(() => setState(persistCompany(null)), []);
  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        if (event.storageArea && event.storageArea !== localStorage) return;
      } catch {
        setState((previous) => ({ ...previous, storageError: true }));
        return;
      }
      // Read the latest value and avoid writing it back to other tabs.
      setState(restoreCompany());
    };
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, []);
  const value = useMemo(
    () => ({ ...state, selectCompany, clearCompany }),
    [state, selectCompany, clearCompany],
  );
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}
