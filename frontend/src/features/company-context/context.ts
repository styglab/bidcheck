import { createContext } from "react";

import type { CompanySummary } from "./company";

export type CompanyContextValue = {
  currentCompany: CompanySummary | null;
  storageError: boolean;
  selectCompany: (company: CompanySummary) => void;
  clearCompany: () => void;
};

export const CompanyContext = createContext<CompanyContextValue | null>(null);
