import { createContext } from "react";

import type { CompanySummary } from "./company";

export type CompanyContextValue = {
  currentCompany: CompanySummary | null;
  selectCompany: (company: CompanySummary) => void;
  clearCompany: () => void;
};

export const CompanyContext = createContext<CompanyContextValue | null>(null);
