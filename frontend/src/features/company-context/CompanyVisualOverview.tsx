import { lazy, Suspense, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { EChartsCoreOption } from "echarts/core";
import { CompanyRelationshipNetwork } from "./CompanyRelationshipNetwork";
import type { CompanyCompetitorsResponse, CompanyProcurementProfile } from "./api";
import { useOrganizationProcurementProfile } from "@/features/organizations/api";
import { entityDetailPath } from "@/shared/navigation/entity-links";
import { formatCompactMoney, formatExactMoney } from "@/shared/format/money";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const CompanyAnalysisChart = lazy(() =>
  import("./CompanyAnalysisChart").then(({ CompanyAnalysisChart }) => ({ default: CompanyAnalysisChart })),
);

type Props = {
  name: string;
  profile: CompanyProcurementProfile;
  competitors?: CompanyCompetitorsResponse;
  competitorLoading: boolean;
  competitorError: boolean;
  onRetryCompetitors: () => void;
  fromYear: number;
  toYear: number;
};
export function CompanyVisualOverview({
  name,
  profile,
  competitors,
  competitorLoading,
  competitorError,
  onRetryCompetitors,
  fromYear,
  toYear,
}: Props) {
  const [params, setParams] = useSearchParams();
  const organizations = useMemo(
    () =>
      [...(profile.organization_relationships ?? [])]
        .filter((item) => item.organization_code && item.contract_event_count > 0)
        .sort(
          (a, b) => (b.total_attributed_contract_amount ?? -1) - (a.total_attributed_contract_amount ?? -1),
        )
        .slice(0, 5),
    [profile],
  );
  const organization =
    organizations.find((item) => item.organization_code === params.get("visualOrganization")) ??
    organizations[0];
  const node =
    params.get("visualNode") ?? (organization ? `organization:${organization.organization_code}` : undefined);
  const competitor = competitors?.items.find((item) => node === `competitor:${item.company_number}`);
  const filters = {
    workType: params.get("workType") ?? undefined,
    largeCategory: params.get("large") ?? undefined,
    middleCategory: params.get("middle") ?? undefined,
    fieldCode: params.get("field") ?? undefined,
  };
  const institution = useOrganizationProcurementProfile(
    organization?.organization_code,
    toYear - fromYear + 1,
    filters,
    Boolean(organization),
    { from: fromYear, to: toYear },
    { pageSize: 30, sort: "contract_amount_desc" },
  );
  const institutionData = institution.isPlaceholderData ? undefined : institution.data;
  const suppliers = institutionData?.company_relationships ?? [];
  const known = suppliers.filter(
    (item) =>
      item.company_number &&
      item.total_attributed_contract_amount != null &&
      Number.isFinite(item.total_attributed_contract_amount) &&
      item.total_attributed_contract_amount > 0,
  );
  const supplier = suppliers.find((item) => item.company_number === params.get("visualSupplier"));
  const selectNode = (key: string) => {
    const next = new URLSearchParams(params);
    next.set("visualNode", key);
    if (key.startsWith("organization:")) {
      next.set("visualOrganization", key.slice("organization:".length));
      next.delete("visualSupplier");
    }
    setParams(next);
  };
  const selectSupplier = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("visualSupplier", id);
    setParams(next);
  };
  const treemap: EChartsCoreOption = {
    animation: false,
    aria: { enabled: true },
    tooltip: {
      renderMode: "richText",
      formatter: (value: unknown) => {
        const item = (value as { data: { name: string; value: number } }).data;
        return `${item.name}\n${formatExactMoney(item.value)}`;
      },
    },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        label: { show: true, formatter: "{b}", color: "#fff", overflow: "truncate" },
        itemStyle: { borderColor: "#fff", borderWidth: 3, gapWidth: 2 },
        data: known.map((item, index) => ({
          id: item.company_number,
          name: item.company_name ?? "업체명 확인 필요",
          value: item.total_attributed_contract_amount,
          itemStyle: {
            color:
              item.company_number === profile.company.business_registration_number
                ? "#0e7490"
                : ["#2563eb", "#4f46e5", "#7c3aed", "#0284c7", "#475569"][index % 5],
            borderColor: item.company_number === supplier?.company_number ? "#f59e0b" : "#fff",
          },
        })),
      },
    ],
  };
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, index) => fromYear + index);
  const annual = years.map((year) => profile.yearly_activity?.find((item) => item.year === year));
  const bar: EChartsCoreOption = {
    animation: false,
    aria: { enabled: true },
    grid: { top: 20, bottom: 35, left: 80, right: 20 },
    xAxis: {
      type: "category",
      data: years.map(String),
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: (amount: number) => formatCompactMoney(amount) },
      splitLine: { lineStyle: { color: "#94a3b833" } },
    },
    tooltip: {
      trigger: "axis",
      renderMode: "richText",
      formatter: (value: unknown) => {
        const item = (value as { dataIndex: number }[])[0];
        const year = annual[item.dataIndex];
        return `${years[item.dataIndex]}년${years[item.dataIndex] === new Date().getUTCFullYear() ? " 누적" : ""}\n${formatExactMoney(year?.attributed_contract_amount)}\n계약 ${year?.contract_event_count == null ? "확인 필요" : `${year.contract_event_count}건`}`;
      },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 64,
        itemStyle: { color: "#2563eb", borderRadius: [6, 6, 0, 0] },
        data: annual.map((item) => item?.attributed_contract_amount ?? null),
      },
    ],
  };
  return (
    <div className="mt-7 space-y-7">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="min-w-0">
          <CompanyRelationshipNetwork
            name={name}
            organizations={organizations}
            competitors={competitorLoading || competitorError ? [] : (competitors?.items ?? [])}
            selected={node}
            onSelect={selectNode}
          />
          {competitorLoading && (
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              공동 참여 관계 조회 중
            </p>
          )}
          {competitorError && (
            <p role="alert" className="mt-3 text-sm">
              경쟁관계를 불러오지 못했습니다.{" "}
              <Button variant="link" onClick={onRetryCompetitors}>
                다시 시도
              </Button>
            </p>
          )}
          {(competitors?.truncated ||
            competitors?.data_completeness?.status === "partial" ||
            profile.truncated) && (
            <p className="mt-3 text-xs text-muted-foreground">
              일부 관계만 관측되었습니다. 표시되지 않은 관계가 없다는 뜻은 아닙니다.
            </p>
          )}
        </div>
        <section aria-label="선택 관계 분석" className="min-w-0 rounded-2xl border bg-card p-5">
          <p className="text-xs font-semibold text-primary">선택 관계</p>
          {competitor ? (
            <div className="mt-3 space-y-4">
              <h3 className="text-lg font-bold">
                {name} ↔ {competitor.company_name}
              </h3>
              <p className="text-sm">
                관측 공동 참여 <strong>{competitor.co_participation_count}건</strong>
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {fromYear}–{toYear}년 · 현재 분야·업무구분 기준. 공동 참여는 계약 거래와 다른 관계입니다. 업체
                쌍별 낙찰 결과는 확인되지 않아 표시하지 않습니다.
              </p>
              <Button asChild variant="outline">
                <Link
                  to={entityDetailPath("company", competitor.company_number, {
                    source: "relationship",
                    params,
                    name: competitor.company_name,
                  })}
                >
                  경쟁업체 상세
                </Link>
              </Button>
            </div>
          ) : organization ? (
            <div className="mt-3">
              <h3 className="text-lg font-bold">
                {organization.organization_name ?? organization.organization_code}
              </h3>
              <p className="mt-2 text-sm">
                중심 업체와 계약 {organization.contract_event_count}건 ·{" "}
                {formatCompactMoney(organization.total_attributed_contract_amount)}
              </p>
              <Button asChild className="mt-4" variant="outline" size="sm">
                <Link
                  to={entityDetailPath("organization", organization.organization_code!, {
                    source: "relationship",
                    params,
                    company: profile.company.business_registration_number,
                  })}
                >
                  기관·계약 근거 보기
                </Link>
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">노드를 선택해 관계를 확인하세요.</p>
          )}
          <div className="mt-5 border-t pt-4">
            <h4 className="text-sm font-semibold">관계 목록</h4>
            <div className="mt-2 space-y-1">
              {organizations.map((item) => (
                <button
                  className="block w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  type="button"
                  key={item.organization_code}
                  aria-pressed={node === `organization:${item.organization_code}`}
                  onClick={() => selectNode(`organization:${item.organization_code}`)}
                >
                  거래기관 · {item.organization_name ?? item.organization_code}
                </button>
              ))}
              {!competitorLoading &&
                !competitorError &&
                competitors?.items.slice(0, 5).map((item) => (
                  <button
                    className="block w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    type="button"
                    key={item.company_number}
                    aria-pressed={node === `competitor:${item.company_number}`}
                    onClick={() => selectNode(`competitor:${item.company_number}`)}
                  >
                    공동 참여 · {item.company_name}
                  </button>
                ))}
            </div>
          </div>
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section aria-label="선택 기관 업체별 계약금액" className="min-w-0 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">기관 내 업체별 계약금액</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {organization?.organization_name ?? "거래기관 선택 필요"} · {fromYear}–{toYear}년 · 현재 분야
              </p>
            </div>
            <span className="text-xs text-muted-foreground">면적 = 업체 귀속 계약금액</span>
          </div>
          {!organization ? (
            <p className="py-10 text-sm text-muted-foreground">
              확인된 거래기관이 없어 분포를 표시할 수 없습니다.
            </p>
          ) : institution.isLoading || institution.isPlaceholderData ? (
            <Skeleton className="mt-5 h-80" />
          ) : institution.isError ? (
            <p role="alert" className="py-10 text-sm">
              기관 분석을 불러오지 못했습니다.{" "}
              <Button variant="link" onClick={() => void institution.refetch()}>
                다시 시도
              </Button>
            </p>
          ) : (
            <>
              {known.length > 0 ? (
                <div className="mt-5">
                  <Suspense fallback={<Skeleton className="h-80" />}>
                    <CompanyAnalysisChart
                      option={treemap}
                      label="조회 업체의 귀속 계약금액 비교. 상세 수치는 아래 목록에서 확인할 수 있습니다."
                      onSelect={selectSupplier}
                    />
                  </Suspense>
                </div>
              ) : (
                <p className="py-10 text-sm text-muted-foreground">
                  면적으로 표시할 수 있는 계약금액이 없습니다.
                </p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                조회된 상위 최대 30개 업체의 확인된 양수 금액을 비교합니다. 전체 시장 점유율이 아닙니다.
                금액이 없거나 0인 업체는 면적을 부여하지 않습니다.
              </p>
              {(institutionData?.truncated || institutionData?.data_completeness?.status === "partial") && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  기관 분석은 일부 데이터입니다.
                </p>
              )}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">
                  업체 금액 목록 · {suppliers.length}개
                </summary>
                <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto">
                  {suppliers.map((item, index) => (
                    <li key={item.company_number ?? index}>
                      <button
                        className="flex w-full justify-between gap-3 rounded-lg p-2 text-left text-xs hover:bg-muted"
                        disabled={!item.company_number}
                        onClick={() => item.company_number && selectSupplier(item.company_number)}
                      >
                        <span>{item.company_name ?? "업체명 확인 필요"}</span>
                        <span>{formatExactMoney(item.total_attributed_contract_amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
              {supplier && (
                <div className="mt-4 rounded-xl bg-muted/50 p-4">
                  <strong className="text-sm">{supplier.company_name}</strong>
                  <p className="mt-2 text-xs">
                    계약 {supplier.contract_event_count}건 ·{" "}
                    {formatExactMoney(supplier.total_attributed_contract_amount)}
                    {supplier.amount_completeness !== "complete" ? " · 금액 일부 확인" : ""}
                  </p>
                  <Link
                    className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
                    to={entityDetailPath("company", supplier.company_number!, {
                      source: "relationship",
                      params,
                      name: supplier.company_name,
                    })}
                  >
                    업체 상세 보기 →
                  </Link>
                </div>
              )}
            </>
          )}
        </section>
        <section aria-label="중심 업체 연도별 계약금액" className="min-w-0 rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">{name} · 연도별 수주 실적</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            계약 건수는 최초 계약일 기준이며, 금액은 조회 종료일 현재의 최신 계약금액입니다.
          </p>
          <div className="mt-5">
            <Suspense fallback={<Skeleton className="h-80" />}>
              <CompanyAnalysisChart
                option={bar}
                label="중심 업체의 연도별 계약금액. 누락 연도는 확인 필요이며 아래 목록에서 정확한 수치를 확인할 수 있습니다."
              />
            </Suspense>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">연도별 정확한 수치</summary>
            <dl className="mt-3 space-y-3">
              {years.map((year, index) => (
                <div key={year} className="flex justify-between gap-3 text-xs">
                  <dt>
                    {year}년{year === new Date().getUTCFullYear() ? " 누적" : ""}
                  </dt>
                  <dd>
                    {formatExactMoney(annual[index]?.attributed_contract_amount)}
                    {annual[index]?.amount_completeness !== "complete" ? " · 금액 확인 필요" : ""}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </section>
      </div>
    </div>
  );
}
