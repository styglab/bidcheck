import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useCompanyCompetitors, type CompanyProcurementProfile } from "@/features/company-context/api";
import {
  useOrganizationProcurementActivity,
  type OrganizationProcurementProfile,
} from "@/features/organizations/api";
import { useNotices } from "@/features/notices/api";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactMoney, formatExactMoney } from "@/shared/format/money";
import type { ExplorerEntity } from "./useNetworkExplorer";
const Chart = lazy(() =>
  import("@/features/company-context/CompanyAnalysisChart").then((m) => ({
    default: m.CompanyAnalysisChart,
  })),
);

export function ExplorerProfileSections({
  entity,
  company,
  organization,
  fromYear,
  toYear,
  params,
  onSelect,
}: {
  entity: ExplorerEntity;
  company?: CompanyProcurementProfile;
  organization?: OrganizationProcurementProfile;
  fromYear: number;
  toYear: number;
  params: URLSearchParams;
  onSelect: (entity: ExplorerEntity) => void;
}) {
  const filters = {
    workType: params.get("workType") ?? undefined,
    fieldCode: params.get("field") ?? undefined,
    largeCategory: params.get("large") ?? undefined,
    middleCategory: params.get("middle") ?? undefined,
  };
  const competitors = useCompanyCompetitors(entity.type === "company" ? entity.id : undefined, {
    fromYear,
    toYear,
    ...filters,
  });
  const recent = useOrganizationProcurementActivity(
    entity.type === "organization" ? entity.id : undefined,
    entity.type === "organization",
    { from: fromYear, to: toYear },
    1,
    undefined,
    "contract",
    filters,
  );
  const notices = useNotices(
    {
      demand_organization_code: entity.id,
      include_history: true,
      published_from: `${fromYear}-01-01T00:00:00+09:00`,
      published_to: `${toYear}-12-31T23:59:59+09:00`,
      work_type: filters.workType,
      field_code: filters.fieldCode,
      large_category: filters.largeCategory,
      middle_category: filters.middleCategory,
      page_size: 5,
    },
    entity.type === "organization",
  );
  const rows = (company?.organization_relationships ?? organization?.company_relationships ?? []).slice(0, 5);
  const known = rows.filter(
    (r) => r.total_attributed_contract_amount != null && r.total_attributed_contract_amount > 0,
  );
  const peers = rows
    .map((r) => ({
      type: company ? ("organization" as const) : ("company" as const),
      id: (company ? r.organization_code : r.company_number) ?? "",
      name: (company ? r.organization_name : r.company_name) ?? "이름 확인 필요",
      amount: r.total_attributed_contract_amount,
      count: r.contract_event_count,
    }))
    .filter((r) => r.id);
  const title = company ? "주요 거래기관" : "주요 거래업체";
  const treemap = {
    animation: false,
    aria: { enabled: true },
    tooltip: {
      renderMode: "richText",
      formatter: (p: unknown) => {
        const data = (p as { data: { name: string; value: number } }).data;
        return `${data.name}\n${formatExactMoney(data.value)}`;
      },
    },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: { show: true, fontSize: 11, formatter: "{b}" },
        itemStyle: { borderColor: "#ffffff", borderWidth: 2, gapWidth: 2 },
        color: ["#2563eb", "#0891b2", "#0d9488", "#7c3aed", "#4f46e5"],
        data: known.map((r) => ({
          id: company ? r.organization_code : r.company_number,
          name: (company ? r.organization_name : r.company_name) ?? "확인 필요",
          value: r.total_attributed_contract_amount,
        })),
      },
    ],
  };
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold">{title} · 계약금액</h3>
        {known.length ? (
          <Suspense fallback={<Skeleton className="mt-3 h-48" />}>
            <Chart
              option={treemap}
              label={`${title} 계약금액 비교`}
              height={190}
              onSelect={(id) => {
                const peer = peers.find((p) => p.id === id);
                if (peer) onSelect(peer);
              }}
            />
          </Suspense>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">그래프로 표시할 계약금액이 없습니다.</p>
        )}
        <p className="text-[11px] leading-5 text-muted-foreground">
          주요 거래처 최대 5곳 중 금액이 확인된 곳만 그래프에 표시합니다. 공동계약은 해당 업체의 몫만
          포함합니다.
        </p>
        <ul className="mt-3 space-y-2">
          {peers.map((peer) => (
            <li key={peer.id}>
              <button
                className="flex w-full justify-between gap-3 rounded-lg px-2 py-2 text-left text-xs hover:bg-muted"
                onClick={() => onSelect(peer)}
              >
                <span className="min-w-0 truncate">{peer.name}</span>
                <span className="shrink-0">{formatCompactMoney(peer.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {company && (
        <>
          <section>
            <h3 className="text-sm font-semibold">같은 입찰에 참여한 업체</h3>
            {competitors.isLoading ? (
              <Skeleton className="mt-3 h-20" />
            ) : competitors.isError ? (
              <p role="alert" className="mt-3 text-xs">
                업체 정보를 불러오지 못했습니다.{" "}
                <button className="text-primary underline" onClick={() => void competitors.refetch()}>
                  다시 시도
                </button>
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(!competitors.isPlaceholderData ? competitors.data?.items : [])?.map((item) => (
                  <li key={item.company_number}>
                    <button
                      className="flex w-full justify-between gap-3 text-left text-xs"
                      onClick={() =>
                        onSelect({ type: "company", id: item.company_number, name: item.company_name })
                      }
                    >
                      <span>{item.company_name}</span>
                      <span className="shrink-0">{item.co_participation_count}회</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {competitors.isSuccess && !competitors.isPlaceholderData && !competitors.data?.items.length && (
              <p className="mt-3 text-xs text-muted-foreground">같은 입찰에 참여한 기록이 없습니다.</p>
            )}
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              개찰 순위 상위 10개 업체와 낙찰업체를 중심으로 확인한 목록입니다. 모든 참여업체가 포함되지는
              않습니다.
            </p>
          </section>
          <RecentProfile
            title="최근 계약"
            items={company.recent_activity.filter((i) => i.activity_type === "contract").slice(0, 5)}
          />
          <RecentProfile
            title="최근 참여·낙찰"
            items={company.recent_activity.filter((i) => i.activity_type !== "contract").slice(0, 5)}
          />
        </>
      )}
      {organization && (
        <>
          <section>
            <h3 className="text-sm font-semibold">거래 구조</h3>
            <dl className="mt-3 space-y-3 text-xs">
              <div className="flex justify-between">
                <dt>상위 5개 업체 계약금액 비중</dt>
                <dd>
                  {organization.company_structure?.concentration_computable !== false &&
                  organization.company_structure?.top_5_company_amount_share != null
                    ? `${(organization.company_structure.top_5_company_amount_share * 100).toFixed(1)}%`
                    : "확인 필요"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>{toYear}년 처음 확인된 업체</dt>
                <dd>
                  {(organization.supplier_entry ?? organization.summary.supplier_entry)
                    ?.first_observed_company_count ?? "확인 필요"}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              수집된 과거 기록에서 처음 확인된 업체입니다. 실제 첫 거래와는 다를 수 있습니다.{" "}
              {organization.company_structure?.concentration_note}
            </p>
          </section>
          <section>
            <h3 className="text-sm font-semibold">최근 공고</h3>
            {notices.isLoading ? (
              <Skeleton className="mt-3 h-20" />
            ) : notices.isError ? (
              <p role="alert" className="mt-3 text-xs">
                공고를 불러오지 못했습니다.{" "}
                <button className="text-primary underline" onClick={() => void notices.refetch()}>
                  다시 시도
                </button>
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {notices.data?.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      className="text-xs hover:text-primary"
                      to={`/notices/${encodeURIComponent(item.id)}`}
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {item.published_at?.slice(0, 10) ?? "게시일 확인 필요"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {notices.isSuccess && !notices.data?.items.length && (
              <p className="mt-3 text-xs text-muted-foreground">현재 조건에서 확인된 공고가 없습니다.</p>
            )}
          </section>
          <section>
            <h3 className="text-sm font-semibold">최근 계약</h3>
            {recent.isLoading ? (
              <Skeleton className="mt-3 h-20" />
            ) : recent.isError ? (
              <p role="alert" className="mt-3 text-xs">
                계약 내역을 불러오지 못했습니다.{" "}
                <button className="text-primary underline" onClick={() => void recent.refetch()}>
                  다시 시도
                </button>
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {(!recent.isPlaceholderData ? recent.data?.items : [])?.slice(0, 5).map((item) => (
                  <li key={item.activity_group_id} className="rounded-lg border p-3">
                    <p className="text-xs">
                      {item.notice_name ?? item.contracts[0]?.unified_contract_number ?? "계약명 확인 필요"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {item.latest_activity_date?.slice(0, 10) ?? "일자 확인 필요"}
                    </p>
                    {item.bid_notice_id && (
                      <Link
                        className="mt-2 inline-block text-xs text-primary"
                        to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}
                      >
                        공고 보기 →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {recent.isSuccess && !recent.isPlaceholderData && !recent.data?.items.length && (
              <p className="mt-3 text-xs text-muted-foreground">확인된 계약이 없습니다.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
function RecentProfile({
  title,
  items,
}: {
  title: string;
  items: CompanyProcurementProfile["recent_activity"];
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={`${item.bid_notice_id}-${index}`}>
            <Link
              className="text-xs hover:text-primary"
              to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}
            >
              {item.notice_name}
            </Link>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {{ contract: "계약", award: "낙찰", participation: "참여" }[item.activity_type]} ·{" "}
              {item.activity_date?.slice(0, 10) ?? "일자 확인 필요"}
            </p>
          </li>
        ))}
      </ul>
      {!items.length && <p className="mt-3 text-xs text-muted-foreground">확인된 최근 이력이 없습니다.</p>}
    </section>
  );
}
