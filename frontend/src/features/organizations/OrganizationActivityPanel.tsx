import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import { type FormEvent } from "react";
import { Link } from "react-router-dom";
import { EntityRecordListSection } from "@/components/common/entity-record-list-section";
import { MetricHelp } from "@/components/common/metric-help";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { FilterChip } from "@/components/ui/filter-chip";
import { formatCompactMoney as money } from "@/shared/format/money";
import { entityDetailPath } from "@/shared/navigation/entity-links";
import type {
  ProcurementActivityContract,
  ProcurementActivityGroup,
  ProcurementActivityStage,
  ProcurementOutcomeCompany,
} from "./api";
import {
  formatProcurementCount as count,
  getLatestConfirmedContract,
  getProcurementActivityView,
  procurementActivityStatus,
  procurementWorkTypeLabel,
} from "./procurement-presentation";

type ActivityData = {
  items: ProcurementActivityGroup[];
  stage_counts: Record<ProcurementActivityStage, number>;
  pagination: { page: number; total_items: number; total_pages: number };
  truncated?: boolean;
};

type Props = {
  periodLabel: string;
  data?: ActivityData;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  isError: boolean;
  stage: ProcurementActivityStage;
  searchValue: string;
  appliedSearch?: string;
  page: number;
  organizationName?: string;
  contextParams: URLSearchParams;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSearchClear: () => void;
  onStageChange: (stage: ProcurementActivityStage) => void;
  onReset: () => void;
  onRetry: () => void;
  onPageChange: (page: number) => void;
};

const stageOptions: Array<[ProcurementActivityStage, string]> = [
  ["all", "전체"],
  ["open", "접수 중"],
  ["closed", "마감"],
  ["award", "낙찰"],
  ["contract", "계약"],
  ["failed_or_cancelled", "유찰·취소"],
];

function companyPath(company: ProcurementOutcomeCompany, contextParams: URLSearchParams) {
  return entityDetailPath("company", company.business_registration_number!, {
    source: "relationship",
    params: contextParams,
    name: company.company_name,
  });
}

function CompanyName({
  company,
  contextParams,
  fallback = "업체명 미상",
}: {
  company?: ProcurementOutcomeCompany;
  contextParams: URLSearchParams;
  fallback?: string;
}) {
  if (!company?.company_name) return <span>{fallback}</span>;
  if (!company.business_registration_number) return <span>{company.company_name}</span>;
  return (
    <Link
      className="activity-company-link block truncate font-semibold"
      to={companyPath(company, contextParams)}
    >
      {company.company_name}
    </Link>
  );
}

function ContractCompanyPicker({
  contract,
  contextParams,
}: {
  contract: ProcurementActivityContract;
  contextParams: URLSearchParams;
}) {
  const lead = contract.lead_contractor ?? contract.contractors?.[0];
  const available = (contract.contractors?.length ? contract.contractors : lead ? [lead] : []).filter(
    (company) => company.company_name,
  );
  const additionalCount = Math.max(0, (contract.contractor_count ?? available.length) - 1);
  const label = lead?.company_name
    ? `${lead.company_name}${additionalCount ? ` 외 ${additionalCount}개 업체` : ""}`
    : "계약 업체 미상";

  if (available.length <= 1) {
    return <CompanyName company={available[0]} contextParams={contextParams} fallback={label} />;
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="activity-company-link contract-company-picker-trigger inline-flex max-w-full items-center gap-1 rounded-sm text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          type="button"
        >
          <strong className="truncate">{label}</strong>
          <ChevronDown className="size-3.5 shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="z-50 w-72 overflow-hidden rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg"
          collisionPadding={12}
          sideOffset={8}
        >
          <div className="border-b px-2 py-2">
            <strong className="block text-sm">계약업체</strong>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              업체를 선택하면 상세로 이동합니다.
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto pt-1.5">
            {available.map((company, index) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2.5 hover:bg-primary/[0.06]"
                key={`${company.business_registration_number ?? company.company_name}-${index}`}
              >
                <div className="min-w-0 text-sm">
                  <CompanyName company={company} contextParams={contextParams} />
                </div>
                {company.share_percent != null && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {company.share_percent}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ActivityTitle({ item }: { item: ProcurementActivityGroup }) {
  const title = item.notice?.notice_name ?? item.notice_name;
  return item.bid_notice_id ? (
    <Link
      className="line-clamp-2 font-medium hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={title}
      to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}
    >
      {title ?? "공고명 미상"}
    </Link>
  ) : (
    <strong className="line-clamp-2 font-medium" title={title}>
      {title ?? "계약명 미상"}
    </strong>
  );
}

function uniqueContractCompanies(item: ProcurementActivityGroup) {
  const companies = item.contracts.flatMap((contract) => [
    ...(contract.lead_contractor ? [contract.lead_contractor] : []),
    ...(contract.contractors ?? []),
  ]);
  const seen = new Set<string>();
  return companies.filter((company) => {
    const key = company.business_registration_number ?? company.company_name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type ResultAmount = {
  label: string;
  amount?: number;
  unavailable?: boolean;
  phaseLabel?: string;
};

function getResultAmount(item: ProcurementActivityGroup): ResultAmount | undefined {
  if (item.latest_stage === "contract" && item.contracts.length) {
    const aggregationStatus = item.result_summary.amount_aggregation_status;
    const effectiveAmount = item.result_summary.effective_contract_amount;
    if (aggregationStatus === "confirmed" && effectiveAmount != null) {
      return { label: "계약금액", amount: effectiveAmount };
    }
    if (aggregationStatus === "partially_confirmed") {
      return effectiveAmount == null
        ? { label: "계약금액", unavailable: true }
        : { label: "확인 계약금액", amount: effectiveAmount };
    }
    if (aggregationStatus === "unresolved") {
      const latestConfirmedAmount = item.result_summary.latest_confirmed_contract_amount;
      if (latestConfirmedAmount != null) {
        const latestContract = getLatestConfirmedContract(item);
        const isLongTerm = latestContract?.contract_structure === "long_term_continuing";
        return {
          label: isLongTerm ? "장기계속 총액" : "최근 확인 계약금액",
          amount: latestConfirmedAmount,
          phaseLabel:
            latestContract?.phase_number != null && latestContract.phase_contract_amount != null
              ? `${latestContract.phase_number}차 계약 ${money(latestContract.phase_contract_amount)}`
              : undefined,
        };
      }
      const confirmedCurrentFamilies = new Set(
        item.contracts
          .filter(
            (contract) =>
              contract.relationship_status === "confirmed" &&
              contract.is_current_record &&
              contract.include_in_family_total !== false,
          )
          .map((contract) => contract.contract_family_id ?? contract.contract_event_id)
          .filter((familyId): familyId is string => Boolean(familyId)),
      );
      return effectiveAmount != null && confirmedCurrentFamilies.size === 1
        ? { label: "확인 계약금액", amount: effectiveAmount }
        : { label: "계약금액", unavailable: true };
    }

    const families = new Set(
      item.contracts.map(
        (contract) => contract.contract_family_id ?? contract.contract_event_id ?? "unclassified",
      ),
    );
    if (families.size > 1) return { label: "계약금액", unavailable: true };

    const contracts = [...item.contracts].sort((left, right) =>
      (left.first_contract_date ?? "").localeCompare(right.first_contract_date ?? ""),
    );
    const total = [...contracts]
      .reverse()
      .find(
        (contract) => contract.total_contract_amount != null && contract.total_contract_amount > 0,
      )?.total_contract_amount;
    if (total != null) return { label: "계약금액", amount: total };

    if (contracts.length === 1) {
      const amount = contracts[0].current_contract_amount ?? contracts[0].phase_contract_amount;
      return amount == null ? { label: "계약금액", unavailable: true } : { label: "계약금액", amount };
    }
    return { label: "계약금액", unavailable: true };
  }

  const latestAward = [...item.awards]
    .sort((left, right) => (left.award_date ?? "").localeCompare(right.award_date ?? ""))
    .at(-1);
  if (latestAward) {
    return latestAward.winning_amount == null
      ? { label: "낙찰금액", unavailable: true }
      : { label: "낙찰금액", amount: latestAward.winning_amount };
  }
  return undefined;
}

function ResultSummary({
  item,
  contextParams,
}: {
  item: ProcurementActivityGroup;
  contextParams: URLSearchParams;
}) {
  const contract = item.contracts[0];
  const award = [...item.awards]
    .sort((left, right) => (left.award_date ?? "").localeCompare(right.award_date ?? ""))
    .at(-1);
  const resultAmount = getResultAmount(item);
  const contractCompanies = uniqueContractCompanies(item);
  const primaryContractCompany = contractCompanies[0];
  const awardCompany = award
    ? {
        company_name: award.winner_name,
        business_registration_number: award.winner_business_registration_number,
      }
    : undefined;
  const groupedContract = contract
    ? {
        ...contract,
        lead_contractor: primaryContractCompany ?? contract.lead_contractor,
        contractors: contractCompanies.length ? contractCompanies : contract.contractors,
        contractor_count: contractCompanies.length || contract.contractor_count,
      }
    : undefined;

  return (
    <div className="min-w-0">
      {groupedContract ? (
        <ContractCompanyPicker contract={groupedContract} contextParams={contextParams} />
      ) : award ? (
        <CompanyName company={awardCompany} contextParams={contextParams} />
      ) : (
        <span className="text-sm text-muted-foreground">업체 미확인</span>
      )}
      {resultAmount && (
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <span className="text-muted-foreground">{resultAmount.label}</span>{" "}
          <strong className="font-semibold tabular-nums">
            {resultAmount.unavailable ? "산정 불가" : money(resultAmount.amount!)}
          </strong>
          {resultAmount.phaseLabel && (
            <span className="text-muted-foreground">· {resultAmount.phaseLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  item,
  organizationName,
  contextParams,
}: {
  item: ProcurementActivityGroup;
  organizationName?: string;
  contextParams: URLSearchParams;
}) {
  const view = getProcurementActivityView(item);
  return (
    <article className="border-b transition-colors last:border-b-0 hover:bg-muted/30">
      <div className="grid sm:grid-cols-[minmax(0,1.85fr)_minmax(16rem,1fr)]">
        <div className="min-w-0 p-4">
          <div className="flex min-w-0 items-start gap-2">
            <Badge className={`mt-0.5 shrink-0 border-0 text-[10px] ${view.status.className}`}>
              {view.status.label}
            </Badge>
            <div className="min-w-0 flex-1">
              <ActivityTitle item={item} />
            </div>
            {item.notice_linkage === "unlinked" && (
              <span className="shrink-0 text-[11px] text-muted-foreground">공고 미연결</span>
            )}
          </div>
          <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="truncate">{item.organization_name ?? organizationName}</span>
            <span>·</span>
            <span className="shrink-0">
              {(item.notice?.published_at ?? item.latest_activity_date)?.slice(0, 10) ?? "일자 미상"}
            </span>
            {item.work_type && (
              <>
                <span>·</span>
                <span>{procurementWorkTypeLabel[item.work_type] ?? item.work_type}</span>
              </>
            )}
            {view.projectAmount != null && (
              <>
                <span>·</span>
                <span className="shrink-0 font-medium tabular-nums text-foreground">
                  {view.projectAmountBasis ?? "공고금액"} {money(view.projectAmount)}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="min-w-0 border-t bg-muted/[0.08] px-4 py-3 sm:border-l sm:border-t-0">
          <ResultSummary contextParams={contextParams} item={item} />
        </div>
      </div>
    </article>
  );
}

function ActivityTable({
  items,
  contextParams,
}: {
  items: ProcurementActivityGroup[];
  contextParams: URLSearchParams;
}) {
  return (
    <DataTable className="hidden lg:block" minWidth={840}>
      <thead>
        <tr>
          <th className="w-24">진행 상태</th>
          <th>공고명</th>
          <th className="w-32 text-right">공고금액</th>
          <th className="w-64">낙찰·계약 결과</th>
          <th className="w-32 text-right">주요 일자</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const view = getProcurementActivityView(item);
          return (
            <tr key={item.activity_group_id}>
              <td>
                <Badge className={`border-0 text-[10px] ${view.status.className}`}>{view.status.label}</Badge>
              </td>
              <td className="max-w-96">
                <ActivityTitle item={item} />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {item.work_type ? `${procurementWorkTypeLabel[item.work_type] ?? item.work_type} · ` : ""}
                  {item.notice?.published_at
                    ? `게시 ${item.notice.published_at.slice(0, 10)}`
                    : `최근 ${item.latest_activity_date?.slice(0, 10) ?? "일자 미상"}`}
                  {item.notice_linkage === "unlinked" ? " · 공고 미연결" : ""}
                </span>
              </td>
              <td className="text-right" title={view.projectAmountBasis}>
                <strong className="block font-medium">
                  {view.projectAmount == null ? "—" : money(view.projectAmount)}
                </strong>
                {view.projectAmount != null && (
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {view.projectAmountBasis ?? "금액 기준 미확인"}
                  </span>
                )}
              </td>
              <td className="max-w-64">
                <ResultSummary contextParams={contextParams} item={item} />
              </td>
              <td className="text-right">
                <span className="block font-medium tabular-nums">{view.resultDate?.slice(0, 10) ?? "—"}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{view.resultDateLabel}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

export function OrganizationActivityPanel({
  periodLabel,
  data,
  isLoading,
  isFetching,
  error,
  isError,
  stage,
  searchValue,
  appliedSearch,
  page,
  organizationName,
  contextParams,
  onSearchValueChange,
  onSearchSubmit,
  onSearchClear,
  onStageChange,
  onReset,
  onRetry,
  onPageChange,
}: Props) {
  return (
    <EntityRecordListSection
      title="공고·계약 조회"
      description={`이 기관의 발주부터 낙찰·계약까지 ${periodLabel}의 전체 조달 이력을 확인합니다.`}
      searchPlaceholder="공고명·업체명 검색"
      searchValue={searchValue}
      appliedSearch={appliedSearch}
      isLoading={isLoading && !data}
      isFetching={isFetching}
      isError={isError && !data}
      error={error}
      errorTitle="공고·계약 목록"
      resultLabel={
        stage === "all" ? "전체 공고·계약" : (procurementActivityStatus[stage]?.label ?? "선택 결과")
      }
      resultHelp={
        stage === "all" ? (
          <MetricHelp label="공고·계약 건수 기준">
            공고 ID를 기준으로 묶은 결과입니다. 공고와 연결되지 않은 계약은 계약사건별로 표시합니다.
          </MetricHelp>
        ) : undefined
      }
      total={data?.pagination.total_items ?? 0}
      itemCount={data?.items.length ?? 0}
      emptyTitle="선택한 조건에 해당하는 공고·계약이 없습니다"
      emptyDescription="검색어 또는 상태 필터를 변경해 다시 확인해 주세요."
      page={page}
      totalPages={data?.pagination.total_pages}
      filters={
        <div className="contents" aria-label="공고 상태 필터">
          {stageOptions.map(([value, label]) => (
            <FilterChip
              selected={stage === value}
              disabled={isFetching}
              key={value}
              onClick={() => onStageChange(value)}
            >
              {label}{" "}
              <span className={stage === value ? "text-primary-foreground/80" : "text-muted-foreground"}>
                {count(data?.stage_counts?.[value])}
              </span>
            </FilterChip>
          ))}
        </div>
      }
      notice={
        data?.truncated ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-200">
            조회 한도로 일부 연결 기록이 생략되었습니다. 조건을 좁혀 다시 확인해 주세요.
          </p>
        ) : undefined
      }
      onSearchValueChange={onSearchValueChange}
      onSearchSubmit={onSearchSubmit}
      onSearchClear={onSearchClear}
      onReset={stage !== "all" || Boolean(appliedSearch) ? onReset : undefined}
      onRetry={onRetry}
      onPageChange={onPageChange}
    >
      {data && data.items.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-xl border bg-card lg:hidden">
            {data.items.map((item) => (
              <ActivityCard
                contextParams={contextParams}
                item={item}
                key={item.activity_group_id}
                organizationName={organizationName}
              />
            ))}
          </div>
          <ActivityTable contextParams={contextParams} items={data.items} />
        </>
      ) : null}
    </EntityRecordListSection>
  );
}
