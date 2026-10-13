import type { ExplorerEntity } from "./useNetworkExplorer";
import type { CompanyNodeScope } from "./graph-layout";

type EntityPresentation = {
  label: string;
  backgroundColor: string;
  borderColor: string;
  underlayColor: string;
  filterDotClass: string;
};

export const explorerNodePresentation: Record<ExplorerEntity["type"], EntityPresentation> = {
  company: {
    label: "업체",
    backgroundColor: "#2dd4bf",
    borderColor: "#99f6e4",
    underlayColor: "#14b8a6",
    filterDotClass: "bg-teal-400",
  },
  organization: {
    label: "발주기관",
    backgroundColor: "#a78bfa",
    borderColor: "#ddd6fe",
    underlayColor: "#8b5cf6",
    filterDotClass: "bg-violet-400",
  },
  field: {
    label: "분야",
    backgroundColor: "#60a5fa",
    borderColor: "#bfdbfe",
    underlayColor: "#3b82f6",
    filterDotClass: "bg-blue-400",
  },
};

export const companyScopeLabels: Partial<Record<CompanyNodeScope, string>> = {
  center: "선택 업체",
  co_bidder: "경쟁 업체",
  both_contract_organization: "선택 업체와 경쟁 업체 모두 계약 이력이 있는 기관",
  current_contract_organization: "선택 업체와 계약 이력이 있는 기관",
  co_bidder_contract_organization: "경쟁 업체와 계약 이력이 있는 기관",
};
