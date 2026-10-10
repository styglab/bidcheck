import type { ProcurementAward, ProcurementContract, ProcurementParticipation } from "./api";

const awardDate = (item: ProcurementAward) => item.award_date ?? item.opening_at ?? "";
const contractDate = (item: ProcurementContract) => item.concluded_date ?? item.contract_date ?? "";

export function sortAwardsByLatest(items: ProcurementAward[]) {
  return [...items].sort(
    (left, right) =>
      awardDate(right).localeCompare(awardDate(left)) ||
      (left.company_number ?? left.id).localeCompare(right.company_number ?? right.id),
  );
}

export function sortContractsByLatest(items: ProcurementContract[]) {
  return [...items].sort(
    (left, right) => contractDate(right).localeCompare(contractDate(left)) || left.id.localeCompare(right.id),
  );
}

export function selectPrimaryAward(awards: ProcurementAward[], participations: ProcurementParticipation[]) {
  const rankedFirst = participations.find((item) => item.rank === 1 && item.company_number);
  return (
    (rankedFirst && awards.find((item) => item.company_number === rankedFirst.company_number)) ??
    sortAwardsByLatest(awards)[0]
  );
}
