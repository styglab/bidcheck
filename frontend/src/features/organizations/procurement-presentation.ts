import type { ProcurementActivityGroup, ProcurementRelationship, SupplierEntryCompany } from "./api";

export type ProcurementCompanySort = "contract_amount_desc" | "contract_count_desc" | "latest_contract_desc";

export function filterAndSortCompanyRelationships(
  items: ProcurementRelationship[],
  query: string,
  sort: ProcurementCompanySort,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filtered = normalizedQuery
    ? items.filter((company) => company.company_name?.toLocaleLowerCase("ko-KR").includes(normalizedQuery))
    : items;
  return [...filtered].sort((left, right) => {
    if (sort === "contract_count_desc") {
      return right.contract_event_count - left.contract_event_count;
    }
    if (sort === "latest_contract_desc") {
      return (right.latest_contract_date ?? "").localeCompare(left.latest_contract_date ?? "");
    }
    return (right.total_attributed_contract_amount ?? 0) - (left.total_attributed_contract_amount ?? 0);
  });
}

export const formatProcurementCount = (value?: number) =>
  value == null ? "-" : value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

export const formatMonthDay = (value?: string) => {
  if (!value) return undefined;
  const [, month, day] = value.slice(0, 10).split("-").map(Number);
  return month && day ? `${month}월 ${day}일` : undefined;
};

export const procurementWorkTypeLabel: Record<string, string> = {
  goods: "물품",
  service: "용역",
  construction: "공사",
  foreign: "외자",
  other: "기타",
  unknown: "미분류",
};

export const supplierEntryToRelationship = (company: SupplierEntryCompany): ProcurementRelationship => ({
  company_number: company.company_number,
  company_name: company.company_name,
  participation_count: 0,
  award_event_count: 0,
  contract_event_count: company.target_year_contract_count,
  total_attributed_contract_amount: company.target_year_attributed_contract_amount,
  amount_completeness: company.amount_completeness ?? "unknown",
  first_activity_date: company.target_year_first_contract_date,
  latest_activity_date: company.target_year_latest_contract_date,
  latest_contract_date: company.target_year_latest_contract_date,
  active_years: company.target_year_first_contract_date
    ? [Number(company.target_year_first_contract_date.slice(0, 4))]
    : [],
  active_year_count: company.target_year_first_contract_date ? 1 : 0,
  yearly_activity: [],
  major_fields: [],
  representative_notices: [],
});

export const procurementActivityStatus: Record<string, { label: string; className: string }> = {
  scheduled: {
    label: "입찰 예정",
    className: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
  open: {
    label: "접수 중",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  closed: {
    label: "입찰 마감",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  awarded: {
    label: "낙찰",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },
  contracted: {
    label: "계약",
    className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  },
  cancelled: {
    label: "취소",
    className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  },
  unknown: {
    label: "상태 확인",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
};

export function getLatestConfirmedContract(item: ProcurementActivityGroup) {
  const confirmedEventId = item.result_summary.latest_confirmed_contract_event_id;
  const confirmedContract = confirmedEventId
    ? item.contracts.find((contract) => contract.contract_event_id === confirmedEventId)
    : undefined;
  if (confirmedContract) return confirmedContract;

  return [...item.contracts]
    .filter((contract) => contract.relationship_status === "confirmed" && contract.is_current_record)
    .sort((left, right) =>
      (left.latest_contract_version_date ?? left.first_contract_date ?? "").localeCompare(
        right.latest_contract_version_date ?? right.first_contract_date ?? "",
      ),
    )
    .at(-1);
}

export function getProcurementActivityView(item: ProcurementActivityGroup) {
  const styleKey =
    item.latest_stage === "award"
      ? "awarded"
      : item.latest_stage === "contract"
        ? "contracted"
        : item.latest_stage === "failed_or_cancelled"
          ? "cancelled"
          : item.latest_stage;
  const status = procurementActivityStatus[styleKey] ?? procurementActivityStatus.unknown;
  const projectAmount = item.notice?.project_amount;
  const projectAmountBasis = item.notice?.project_amount_basis_name;
  const noticeDetail =
    item.latest_stage === "scheduled"
      ? { label: "입찰 시작 전", dateLabel: "마감", date: item.notice?.deadline_at }
      : item.latest_stage === "open"
        ? { label: "입찰 진행 중", dateLabel: "마감", date: item.notice?.deadline_at }
        : item.latest_stage === "failed_or_cancelled"
          ? { label: "유찰·취소", dateLabel: "처리", date: item.latest_activity_date }
          : { label: "입찰 마감", dateLabel: "마감", date: item.notice?.deadline_at };
  const latestContract = getLatestConfirmedContract(item);
  const latestContractDate =
    latestContract?.latest_contract_version_date ?? latestContract?.first_contract_date;
  const isContractChange = Boolean(
    latestContract?.latest_contract_version_date &&
    latestContract.first_contract_date &&
    latestContract.latest_contract_version_date !== latestContract.first_contract_date,
  );

  return {
    status,
    projectAmount,
    projectAmountBasis,
    noticeDetail,
    resultDate:
      item.latest_stage === "contract"
        ? (latestContractDate ?? item.latest_activity_date ?? noticeDetail.date)
        : item.latest_stage === "award" || item.latest_stage === "failed_or_cancelled"
          ? (item.latest_activity_date ?? noticeDetail.date)
          : (noticeDetail.date ?? item.latest_activity_date),
    resultDateLabel:
      item.latest_stage === "contract"
        ? isContractChange
          ? "최근 변경"
          : "계약일"
        : item.latest_stage === "award"
          ? "낙찰일"
          : noticeDetail.dateLabel,
  };
}
