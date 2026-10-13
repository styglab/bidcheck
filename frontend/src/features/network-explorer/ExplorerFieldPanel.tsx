import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fieldContextQueryOptions, fieldMarketQueryOptions } from "./api";
import { linkKey, linkLabel, type ExplorerLink, type ExplorerEntity } from "./useNetworkExplorer";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactMoney, formatExactMoney } from "@/shared/format/money";
const Chart = lazy(() =>
  import("@/features/company-context/CompanyAnalysisChart").then((m) => ({
    default: m.CompanyAnalysisChart,
  })),
);
export function ExplorerFieldPanel({
  entity,
  params,
  fromYear,
  toYear,
  onSelect,
  links,
}: {
  entity: ExplorerEntity;
  params: URLSearchParams;
  fromYear: number;
  toYear: number;
  onSelect: (entity: ExplorerEntity) => void;
  links: ExplorerLink[];
}) {
  const officialField = Boolean(params.get("field"));
  const marketQuery = useQuery(fieldMarketQueryOptions(params, fromYear, toYear));
  const contextQuery = useQuery({ ...fieldContextQueryOptions(params, fromYear, toYear), enabled: !officialField });
  const query = officialField ? marketQuery : contextQuery;
  const [metric, setMetric] = useState<"contract_amount" | "contract_record_count" | "supplier_count">(
    "contract_amount",
  );
  const market = officialField && !marketQuery.isError ? marketQuery.data : undefined;
  const data = !officialField && !contextQuery.isError ? contextQuery.data : undefined;
  const relation = links.find(
    (link) =>
      linkKey(link) ===
      params.get("selectedRelation")?.replace(/\|(contract|award|participation|competition|field)$/, ""),
  );
  const title = {
    contract_amount: "계약금액",
    contract_record_count: "확인된 계약 건수",
    supplier_count: "계약업체 수",
  }[metric];
  const rows = market
    ? market.yearly.map((row) => ({
        year: row.year,
        contract_amount: row.total_attributed_contract_amount,
        contract_record_count: row.contract_count,
        supplier_count: row.company_count,
        total_records: row.contract_count,
        truncated: false,
      }))
    : (data?.yearly_activity ?? []);
  const option = {
    animation: false,
    aria: { enabled: true },
    grid: { left: 65, right: 12, top: 20, bottom: 30 },
    xAxis: { type: "category", data: rows.map((r) => String(r.year)) },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: (v: number) => (metric === "contract_amount" ? formatCompactMoney(v) : String(v)),
      },
    },
    tooltip: { trigger: "axis", renderMode: "richText" },
    series: [
      {
        type: "bar",
        barMaxWidth: 30,
        itemStyle: { color: "#2563eb", borderRadius: [4, 4, 0, 0] },
        data: rows.map((r) => r[metric]),
      },
    ],
  };
  const suppliers = officialField
    ? [...new Map(links.flatMap((link) => [link.source, link.target]).filter((e) => e.type === "company").map((e) => [e.id, e])).values()]
    : (data?.entities ?? []).filter((e) => e.type === "company");
  const organizations = officialField
    ? [...new Map(links.flatMap((link) => [link.source, link.target]).filter((e) => e.type === "organization").map((e) => [e.id, e])).values()]
    : (data?.organizations ?? []);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium text-primary">분야·품목 탐색</p>
        <h2 className="mt-2 text-xl font-bold">{entity.name}</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {fromYear}–{toYear}년 · 선택 업무구분
        </p>
      </header>
      {relation && (
        <section className="rounded-xl border p-3">
          <h3 className="text-sm font-semibold">{linkLabel(relation)}</h3>
          <p className="mt-2 text-xs">
            {relation.source.name} ↔ {relation.target.name}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">확인된 계약 기록을 기준으로 보여드립니다.</p>
          <button className="mt-3 text-xs text-primary" onClick={() => onSelect(relation.target)}>
            기관 정보 보기 →
          </button>
        </section>
      )}
      <p className="rounded-xl bg-muted p-3 text-xs leading-6 text-muted-foreground">
        {officialField
          ? "Teoria가 수집한 계약 범위의 집계입니다. 전체 조달시장을 뜻하지 않습니다."
          : "각 연도의 계약금액 상위 최대 100건을 기준으로 보여드립니다. 전체 시장 실적은 아닙니다."}
      </p>
      {rows.some((row) => row.truncated) && (
        <p className="text-xs text-amber-700">일부 기록을 불러오지 못했습니다. 확인된 기록만 표시합니다.</p>
      )}
      {query.isLoading ? (
        <Skeleton className="h-48" />
      ) : query.isError ? (
        <p role="alert" className="text-xs">
          분야 정보를 불러오지 못했습니다.{" "}
          <button onClick={() => void query.refetch()} className="text-primary underline">
            다시 시도
          </button>
        </p>
      ) : (
        <>
          <section>
            <h3 className="text-sm font-semibold">연도별 계약 실적</h3>
            <select
              className="mt-3 w-full rounded-lg border bg-background p-2 text-xs"
              value={metric}
              aria-label="분야 추이 지표"
              onChange={(e) => setMetric(e.target.value as typeof metric)}
            >
              <option value="contract_amount">계약금액</option>
              <option value="contract_record_count">확인된 계약 건수</option>
              <option value="supplier_count">계약업체 수</option>
            </select>
            <Suspense fallback={<Skeleton className="h-52" />}>
              <Chart option={option} label={`확인된 계약의 연도별 ${title}`} height={230} />
            </Suspense>
            <dl className="space-y-2 text-xs">
              {rows.map((r) => (
                <div className="flex justify-between" key={r.year}>
                  <dt>
                    {r.year}년{r.year === new Date().getUTCFullYear() ? " 누적" : ""}
                  </dt>
                  <dd>
                    {metric === "contract_amount"
                      ? formatExactMoney(r.contract_amount ?? undefined)
                      : r[metric]}
                  </dd>
                </div>
              ))}
            </dl>
            {market && <p className="mt-3 text-xs text-muted-foreground">수집된 계약 {market.summary.contract_count.toLocaleString()}건 · 금액 미확인 {market.summary.missing_attributed_amount_count.toLocaleString()}건</p>}
            {!officialField && <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              확인한 기록:{" "}
              {rows
                .map(
                  (r) =>
                    `${r.year}년 ${r.contract_record_count}/${r.total_records ?? "전체 건수 알 수 없음"}개 기록`,
                )
                .join(" · ")}
            </p>}
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              {officialField
                ? "계약 건수는 최초 계약일 기준이며, 금액은 수집된 최신 계약 버전의 업체 귀속금액입니다."
                : "검색된 계약의 체결일 기준입니다. 변경 계약이 포함될 수 있어 처음 체결한 계약 건수와는 다릅니다. 확인되지 않은 금액은 표시하지 않습니다."}
            </p>
          </section>
          <section>
            <h3 className="text-sm font-semibold">주요 발주기관</h3>
            <ul className="mt-3 space-y-3">
              {organizations.map((org) => (
                <li key={org.id}>
                  <button
                    className="flex w-full justify-between gap-3 text-left text-xs"
                    onClick={() => onSelect(org)}
                  >
                    <span>{org.name}</span>
                    <span>{"record_count" in org ? `${org.record_count}건` : "보기"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-semibold">주요 계약업체</h3>
            <ul className="mt-3 space-y-3">
              {suppliers.map((company) => (
                <li key={company.id}>
                  <button className="text-left text-xs hover:text-primary" onClick={() => onSelect(company)}>
                    {company.name}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              그래프에 표시된 업체입니다. 전체 시장 순위는 아닙니다.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
