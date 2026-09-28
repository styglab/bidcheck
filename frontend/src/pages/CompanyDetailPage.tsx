import { ArrowUpRight, Building2, ExternalLink, Landmark, Trophy } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { EntityTabs } from "@/components/common/entity-tabs";
import { HistoryBackLink } from "@/components/common/history-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyActivity, useCompanyProfile } from "../features/company-context/api";

const money = (value?: number) =>
  value == null
    ? "금액 미상"
    : value >= 100_000_000
      ? `${(value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`
      : `${value.toLocaleString("ko-KR")}원`;
const day = (value?: string) => (value ? value.replaceAll("-", ".") : "일자 미상");

export function CompanyDetailPage() {
  const { businessNumber } = useParams();
  const [params] = useSearchParams();
  const query = useCompanyProfile(businessNumber);
  const activity = useCompanyActivity(businessNumber);
  const [tab, setTab] = useState("relationships");
  const organizationRelationships = useMemo(() => {
    const grouped = new Map<
      string,
      { code?: string; name: string; count: number; amount: number; latest?: string }
    >();
    for (const award of activity.data?.awards ?? []) {
      const key = award.organization_code || award.organization_name || "unknown";
      const current = grouped.get(key) ?? {
        code: award.organization_code,
        name: award.organization_name ?? "기관명 미상",
        count: 0,
        amount: 0,
      };
      current.count += 1;
      current.amount += award.winning_amount ?? 0;
      if (!current.latest || (award.award_date ?? "") > current.latest) current.latest = award.award_date;
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => b.count - a.count || b.amount - a.amount);
  }, [activity.data?.awards]);

  if (query.isLoading)
    return (
      <PageContainer>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-8 h-48 rounded-xl" />
      </PageContainer>
    );
  if (query.isError)
    return (
      <PageContainer>
        <p className="rounded-xl bg-red-50 p-5 text-red-700">
          업체 정보를 불러오지 못했습니다. {query.error.message}
        </p>
      </PageContainer>
    );
  const data = query.data!;
  const registration = data.business_registration[0] ?? {};
  const name =
    params.get("name") ?? String(registration.business_name ?? registration.company_name ?? "업체 정보");

  return (
    <PageContainer className="max-w-7xl">
      <HistoryBackLink fallbackTo="/companies" />
      <header className="mt-7 rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            <Building2 />
          </span>
          <div className="min-w-0">
            <Badge className="border-0 bg-teal-100 text-teal-800 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-200">
              업체
            </Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">사업자등록번호 {businessNumber}</p>
          </div>
        </div>
        <dl className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/50 p-4">
            <dt className="text-xs text-muted-foreground">확인된 낙찰</dt>
            <dd className="mt-1 text-xl font-bold">{activity.data?.award_pagination.total_items ?? "-"}건</dd>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <dt className="text-xs text-muted-foreground">연결된 기관</dt>
            <dd className="mt-1 text-xl font-bold">
              {activity.data ? `${organizationRelationships.length}곳` : "-"}
            </dd>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <dt className="text-xs text-muted-foreground">확인된 계약</dt>
            <dd className="mt-1 text-xl font-bold">{activity.data?.contract_count ?? "-"}건</dd>
          </div>
        </dl>
      </header>

      {activity.isLoading && <Skeleton className="mt-10 h-48 rounded-xl" />}
      {activity.isError && (
        <p className="mt-10 rounded-xl border p-5 text-sm text-muted-foreground">
          조달 활동을 불러오지 못했습니다.
        </p>
      )}
      {activity.data && (
        <>
          <EntityTabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "relationships", label: "주요 관계" },
              { id: "awards", label: "수주 공고", count: activity.data.award_pagination.total_items },
              { id: "participations", label: "참여 이력", count: activity.data.pagination.total_items },
              { id: "contracts", label: "계약", count: activity.data.contract_count },
            ]}
          />

          {tab === "relationships" && (
            <section className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_.85fr]">
              <div>
                <p className="text-xs font-semibold text-teal-700">업체 ↔ 기관</p>
                <h2 className="mt-2 text-xl font-bold">주요 거래기관</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  확인된 낙찰 이력을 기준으로 이 업체와 연결된 발주기관을 보여줍니다.
                </p>
                <div className="mt-5 divide-y overflow-hidden rounded-2xl border bg-card">
                  {organizationRelationships.slice(0, 6).map((organization) =>
                    organization.code ? (
                      <Link
                        key={organization.code}
                        to={`/organizations/${encodeURIComponent(organization.code)}`}
                        className="group grid gap-3 p-5 hover:bg-teal-50/35 dark:hover:bg-teal-950/10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <strong className="block truncate group-hover:text-teal-700">
                            {organization.name}
                          </strong>
                          <p className="mt-1 text-xs text-muted-foreground">
                            낙찰 {organization.count}건 · 확인 금액 {money(organization.amount)}
                            {organization.latest ? ` · 최근 ${organization.latest}` : ""}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                          기관 관계 보기 <ArrowUpRight size={13} />
                        </span>
                      </Link>
                    ) : (
                      <div key={organization.name} className="p-5">
                        <strong>{organization.name}</strong>
                        <p className="mt-1 text-xs text-muted-foreground">
                          낙찰 {organization.count}건 · {money(organization.amount)}
                        </p>
                      </div>
                    ),
                  )}
                  {!organizationRelationships.length && (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      연결된 발주기관이 아직 확인되지 않았습니다.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-700">업체 ↔ 분야</p>
                <h2 className="mt-2 text-xl font-bold">등록 업종</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  업체가 등록한 업종을 확인하고 관련 수주 이력으로 이동합니다.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border bg-card p-5">
                  {data.industries.map((item, index) => (
                    <Badge className="border-0" variant="secondary" key={index}>
                      {String(item.industry_name ?? item.name ?? item.industry_code ?? "업종정보")}
                    </Badge>
                  ))}
                  {!data.industries.length && (
                    <p className="text-sm text-muted-foreground">등록된 업종정보가 없습니다.</p>
                  )}
                </div>
                <div className="mt-8">
                  <h3 className="font-bold">최근 수주 공고</h3>
                  <div className="mt-3 divide-y overflow-hidden rounded-2xl border bg-card">
                    {activity.data.awards.slice(0, 4).map((item) => (
                      <Link
                        className="group flex gap-3 p-4 hover:bg-blue-50/35 dark:hover:bg-blue-950/10"
                        key={item.id}
                        to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
                      >
                        <Trophy className="mt-0.5 size-4 shrink-0 text-amber-600" />
                        <span className="min-w-0">
                          <strong className="block truncate text-sm group-hover:text-blue-700">
                            {item.notice_name}
                          </strong>
                          <small className="mt-1 block truncate text-muted-foreground">
                            {item.organization_name} · {money(item.winning_amount)}
                          </small>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === "participations" && (
            <section className="mt-6">
              <div className="divide-y rounded-xl border">
                {activity.data.items.map((item) => (
                  <Link
                    key={item.id}
                    to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
                    className="flex items-center justify-between gap-5 p-4 hover:bg-muted/50"
                  >
                    <div>
                      <strong className="text-sm">
                        공고 {item.notice_number}-{item.notice_order}
                      </strong>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {day(item.bid_at)} · 투찰 {money(item.bid_amount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.rank != null && <Badge variant="secondary">{item.rank}순위</Badge>}
                      <ArrowUpRight className="size-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {tab === "awards" && (
            <section className="mt-6">
              <div className="divide-y rounded-xl border">
                {activity.data.awards.map((item) => (
                  <div className="flex items-center justify-between gap-5 p-4" key={item.id}>
                    <div className="min-w-0">
                      <Link
                        className="block truncate font-semibold hover:text-blue-800 hover:underline"
                        to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
                      >
                        {item.notice_name ?? item.notice_number}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.organization_code ? (
                          <Link
                            className="hover:underline"
                            to={`/organizations/${encodeURIComponent(item.organization_code)}`}
                          >
                            {item.organization_name}
                          </Link>
                        ) : (
                          item.organization_name
                        )}{" "}
                        · {money(item.winning_amount)}
                      </p>
                    </div>
                    <Badge className="border-0">낙찰</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}
          {tab === "contracts" && (
            <section className="mt-6">
              <div className="divide-y rounded-xl border">
                {activity.data.contracts.map((item) => (
                  <div className="flex items-center justify-between gap-5 p-4" key={item.id}>
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">{item.name ?? item.id}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.organization_code && (
                          <>
                            <Link
                              className="hover:underline"
                              to={`/organizations/${encodeURIComponent(item.organization_code)}`}
                            >
                              <Landmark className="mr-1 inline size-3" />
                              기관 보기
                            </Link>{" "}
                            ·{" "}
                          </>
                        )}
                        {day(item.concluded_date)} · {money(item.amount)}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      {item.bid_notice_id && (
                        <Link
                          className="text-sm font-medium text-blue-800 hover:underline"
                          to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}
                        >
                          공고
                        </Link>
                      )}
                      {item.detail_url && (
                        <a href={item.detail_url} target="_blank" rel="noreferrer">
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </PageContainer>
  );
}
