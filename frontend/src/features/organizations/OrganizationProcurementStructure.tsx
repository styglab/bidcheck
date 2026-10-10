import { EntityDetailSection } from "@/components/common/entity-detail-section";
import { MetricHelp } from "@/components/common/metric-help";
import { formatCompactMoney as money } from "@/shared/format/money";
import { procurementFieldIdentity } from "@/shared/procurement/field-options";
import { procurementChartSeries, procurementWorkTypeColor } from "@/shared/ui/procurement-chart-palette";
import type { OrganizationProcurementProfile } from "./api";
import { formatProcurementCount as count, procurementWorkTypeLabel } from "./procurement-presentation";

type WorkTypeDistribution = NonNullable<OrganizationProcurementProfile["work_type_distribution"]>;
type FieldDistribution = OrganizationProcurementProfile["field_distribution"];
type ContractMethodDistribution = NonNullable<OrganizationProcurementProfile["contract_method_distribution"]>;

type Props = {
  workTypes: WorkTypeDistribution;
  fields: FieldDistribution;
  totalFieldCount: number;
  totalContractAmount?: number;
  contractMethods: ContractMethodDistribution;
  contractMethodAmountTotal: number;
  selectedWorkType?: string;
  selectedLargeCategory?: string;
  selectedFieldCode?: string;
  isLeafFieldSelection?: boolean;
};

function WorkTypeOverview({ items }: { items: WorkTypeDistribution }) {
  const totalAmount = items.reduce((sum, item) => sum + Math.max(0, item.attributed_contract_amount ?? 0), 0);

  return (
    <div>
      <h3 className="text-base font-semibold">업무구분</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">계약금액과 계약 건수 구성</p>
      <div className="mt-4">
        {items.length === 0 ? (
          <p className="py-5 text-center text-sm text-muted-foreground">
            선택한 조건에서 업무구분 정보가 없습니다.
          </p>
        ) : (
          <div className="space-y-5">
            {items.map((item) => {
              const share = totalAmount > 0 ? (item.attributed_contract_amount ?? 0) / totalAmount : 0;
              return (
                <div key={item.work_type}>
                  <div className="flex items-start justify-between gap-4 text-sm">
                    <span className="min-w-0">
                      <strong className="block truncate">
                        {item.work_type_name || procurementWorkTypeLabel[item.work_type]}
                      </strong>
                      <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                        {(share * 100).toFixed(1)}% · 계약 {count(item.contract_event_count)}건
                      </span>
                    </span>
                    <strong className="shrink-0 text-right tabular-nums">
                      {money(item.attributed_contract_amount)}
                    </strong>
                  </div>
                  <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className={`block h-full rounded-full ${procurementWorkTypeColor[item.work_type] ?? procurementWorkTypeColor.unknown}`}
                      style={{ width: `${share * 100}%` }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldOverview({
  items,
  totalFieldCount,
  totalContractAmount,
  selectedLargeCategory,
  selectedFieldCode,
}: {
  items: FieldDistribution;
  totalFieldCount: number;
  totalContractAmount?: number;
  selectedLargeCategory?: string;
  selectedFieldCode?: string;
}) {
  const maxAmount = Math.max(1, ...items.map((item) => item.attributed_contract_amount ?? 0));

  return (
    <div>
      <h3 className="text-base font-semibold">{selectedLargeCategory ? "세부 분야" : "주요 분야"}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {items.length > 0 ? `계약금액 상위 ${count(items.length)}개 분야` : "선택한 조건의 분야별 계약 규모"}
      </p>
      <div className="mt-4">
        {items.length > 0 ? (
          <div className="divide-y">
            {items.map((field, index) => {
              const amount = field.attributed_contract_amount ?? 0;
              const share = totalContractAmount && totalContractAmount > 0 ? amount / totalContractAmount : 0;
              return (
                <div
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 py-3.5 text-sm sm:grid-cols-[1.5rem_minmax(9rem,15rem)_minmax(5rem,1fr)_auto]"
                  key={procurementFieldIdentity(field)}
                >
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {field.display_name ??
                        field.field_name ??
                        field.middle_category ??
                        field.large_category ??
                        "분야명 미확인"}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] tabular-nums text-muted-foreground">
                      {field.work_types?.length
                        ? `${field.work_types
                            .map((workType) => procurementWorkTypeLabel[workType] ?? workType)
                            .join(" · ")} · `
                        : ""}
                      전체의 {(share * 100).toFixed(1)}%
                    </span>
                  </span>
                  <span className="hidden h-1.5 overflow-hidden rounded-full bg-muted sm:block">
                    <span
                      className="block h-full rounded-full bg-chart-1"
                      style={{ width: `${(amount / maxAmount) * 100}%` }}
                    />
                  </span>
                  <strong className="min-w-20 text-right tabular-nums sm:min-w-24">
                    {money(field.attributed_contract_amount)}
                  </strong>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-5 text-center text-sm text-muted-foreground">
            선택한 조건에서 분류된 조달 분야가 없습니다.
          </p>
        )}
        {!selectedFieldCode && totalFieldCount > items.length && (
          <p className="mt-3 border-t pt-3 text-right text-xs text-muted-foreground">
            전체 {count(totalFieldCount)}개 분야
          </p>
        )}
      </div>
    </div>
  );
}

function ContractMethodOverview({
  items,
  amountTotal,
  divided,
}: {
  items: ContractMethodDistribution;
  amountTotal: number;
  divided: boolean;
}) {
  const onlyMethod = items.length === 1 ? items[0] : undefined;

  return (
    <div className={divided ? "mt-7 border-t pt-7" : undefined}>
      <h3 className="flex items-center gap-1 text-base font-semibold">
        계약 방식
        {onlyMethod && (
          <MetricHelp label="계약 방식 집계 기준">
            계약 건수는 선택한 조회 조건의 계약을 기준으로 집계합니다. 계약금액은 금액이 확인된 계약만
            합산합니다.
          </MetricHelp>
        )}
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {onlyMethod ? "선택한 조건의 계약 방식을 요약합니다." : "계약 건수와 금액의 비중 비교"}
      </p>
      <div className="mt-4">
        {items.length === 0 ? (
          <p className="py-5 text-center text-sm text-muted-foreground">
            선택한 조건에서 계약 방식 정보가 없습니다.
          </p>
        ) : onlyMethod ? (
          <div className="py-1">
            <p className="text-sm leading-6">
              조회된 계약 <strong>{count(onlyMethod.contract_event_count)}건</strong>은 모두
              <strong> {onlyMethod.method_name}</strong>입니다.
            </p>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {onlyMethod.attributed_contract_amount == null
                ? "계약금액 미확인"
                : `${money(onlyMethod.attributed_contract_amount)} · 금액 확인 계약 기준`}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
              {[
                { label: "계약 건수", kind: "count" as const },
                { label: "계약금액", kind: "amount" as const },
              ].map(({ label, kind }) => (
                <div key={kind}>
                  <strong className="flex items-center gap-1 text-xs">
                    {label} 비중
                    {kind === "amount" && (
                      <MetricHelp label="계약금액 비중 계산 기준">
                        금액이 확인된 계약만 합산해 계약 방식별 비중을 계산합니다. 계약 건수와 계약금액의 집계
                        대상이 다를 수 있습니다.
                      </MetricHelp>
                    )}
                  </strong>
                  <div
                    className="mt-2 flex h-8 overflow-hidden rounded-lg bg-muted"
                    aria-label={`${label} 비중`}
                  >
                    {items.map((item, index) => {
                      const share =
                        kind === "count"
                          ? item.contract_share
                          : (item.amount_share ??
                            (amountTotal > 0 ? (item.attributed_contract_amount ?? 0) / amountTotal : 0));
                      return share > 0 ? (
                        <span
                          className={`${procurementChartSeries[index % procurementChartSeries.length]} grid min-w-0 place-items-center px-1 text-[11px] font-semibold text-white`}
                          key={item.method}
                          style={{ width: `${share * 100}%` }}
                          title={`${item.method_name} ${(share * 100).toFixed(1)}%`}
                        >
                          {share >= 0.16 ? `${(share * 100).toFixed(1)}%` : ""}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap border-t">
              {items.map((item, index) => {
                const amountShare =
                  item.amount_share ??
                  (amountTotal > 0 ? (item.attributed_contract_amount ?? 0) / amountTotal : 0);
                return (
                  <div
                    className="min-w-40 flex-1 border-b py-3 text-xs last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0"
                    key={item.method}
                  >
                    <strong className="flex items-center gap-2">
                      <span
                        className={`size-2.5 rounded-full ${procurementChartSeries[index % procurementChartSeries.length]}`}
                        aria-hidden="true"
                      />
                      {item.method_name}
                    </strong>
                    <span className="mt-1.5 block tabular-nums text-muted-foreground">
                      {count(item.contract_event_count)}건 · {(item.contract_share * 100).toFixed(1)}%
                    </span>
                    <span className="mt-0.5 block tabular-nums text-muted-foreground">
                      {item.attributed_contract_amount == null
                        ? "금액 미확인"
                        : `${money(item.attributed_contract_amount)} · ${(amountShare * 100).toFixed(1)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function OrganizationProcurementStructure({
  workTypes,
  fields,
  totalFieldCount,
  totalContractAmount,
  contractMethods,
  contractMethodAmountTotal,
  selectedWorkType,
  selectedLargeCategory,
  selectedFieldCode,
  isLeafFieldSelection = false,
}: Props) {
  const showWorkTypeComparison = !selectedWorkType;
  const hasComparableFields = totalFieldCount > 1 && fields.length > 1;
  const showFieldComparison = !selectedFieldCode && !isLeafFieldSelection && hasComparableFields;
  const showComparisonGrid = showWorkTypeComparison || showFieldComparison;

  return (
    <EntityDetailSection
      className="lg:col-span-2"
      divided
      title="조달 구조"
      description={
        showFieldComparison
          ? "선택한 조건의 계약금액이 어디에 집중되는지 보여줍니다."
          : "선택한 세부 분야의 계약 방식을 보여줍니다."
      }
    >
      <div className="mt-5 rounded-xl border bg-card p-5 sm:p-6">
        {showComparisonGrid && (
          <div
            className={`grid items-start gap-8 ${showWorkTypeComparison && showFieldComparison ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "grid-cols-1"}`}
          >
            {showWorkTypeComparison && <WorkTypeOverview items={workTypes} />}
            {showFieldComparison && (
              <FieldOverview
                items={fields}
                totalFieldCount={totalFieldCount}
                totalContractAmount={totalContractAmount}
                selectedLargeCategory={selectedLargeCategory}
                selectedFieldCode={selectedFieldCode}
              />
            )}
          </div>
        )}
        <ContractMethodOverview
          items={contractMethods}
          amountTotal={contractMethodAmountTotal}
          divided={showComparisonGrid}
        />
      </div>
    </EntityDetailSection>
  );
}
