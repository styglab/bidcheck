import { ArrowUpRight, ExternalLink, FileText, Landmark } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { EntityTabs } from "@/components/common/entity-tabs";
import { HistoryBackLink } from "@/components/common/history-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotices } from "../features/notices/api";
import { useOrganization, useOrganizationActivity } from "../features/organizations/api";

const money = (value?: number) =>
  value == null
    ? "금액 미상"
    : value >= 100_000_000
      ? `${(value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`
      : `${value.toLocaleString("ko-KR")}원`;

export function OrganizationDetailPage() {
  const { organizationId } = useParams();
  const organizationQuery = useOrganization(organizationId);
  const noticeQuery = useNotices({ demand_organization_code: organizationId, page_size: 10 });
  const activity = useOrganizationActivity(organizationId);
  const [tab, setTab] = useState("relationships");
  const organization = organizationQuery.data?.organization;
  const notices = noticeQuery.data?.items ?? [];
  const companyRelationships = useMemo(() => {
    const grouped = new Map<
      string,
      { number: string; name: string; count: number; amount: number; latest?: string }
    >();
    for (const award of activity.data?.awards ?? []) {
      if (!award.company_number) continue;
      const current = grouped.get(award.company_number) ?? {
        number: award.company_number,
        name: award.company_name ?? "업체명 미상",
        count: 0,
        amount: 0,
      };
      current.count += 1;
      current.amount += award.winning_amount ?? 0;
      if (!current.latest || (award.award_date ?? "") > current.latest) current.latest = award.award_date;
      grouped.set(award.company_number, current);
    }
    return [...grouped.values()].sort((a, b) => b.count - a.count || b.amount - a.amount);
  }, [activity.data?.awards]);

  if (organizationQuery.isLoading)
    return (
      <PageContainer>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-8 h-40 rounded-xl" />
      </PageContainer>
    );
  if (organizationQuery.isError)
    return (
      <PageContainer>
        <p className="rounded-xl bg-red-50 p-5 text-red-700">
          기관 정보를 불러오지 못했습니다. {organizationQuery.error.message}
        </p>
      </PageContainer>
    );

  return (
    <PageContainer className="max-w-7xl">
      <HistoryBackLink fallbackTo="/organizations" />
      <header className="mt-7 rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <Landmark />
          </span>
          <div className="min-w-0">
            <Badge className="border-0 bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-200">
              기관
            </Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{organization?.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {organization?.jurisdiction_type ?? "기관 유형 미상"} · 기관코드 {organizationId}
            </p>
          </div>
        </div>
        <dl className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/50 p-4">
            <dt className="text-xs text-muted-foreground">최근 공고</dt>
            <dd className="mt-1 text-xl font-bold">{noticeQuery.data?.pagination.total_items ?? "-"}건</dd>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <dt className="text-xs text-muted-foreground">확인된 낙찰</dt>
            <dd className="mt-1 text-xl font-bold">{activity.data?.award_pagination.total_items ?? "-"}건</dd>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <dt className="text-xs text-muted-foreground">연결된 업체</dt>
            <dd className="mt-1 text-xl font-bold">
              {activity.data ? `${companyRelationships.length}곳` : "-"}
            </dd>
          </div>
        </dl>
      </header>

      {activity.isLoading && <Skeleton className="mt-10 h-48 rounded-xl" />}
      {activity.isError && (
        <p className="mt-10 rounded-xl border p-5 text-sm text-muted-foreground">
          낙찰·계약 정보를 불러오지 못했습니다.
        </p>
      )}
      {activity.data && (
        <>
          <EntityTabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "relationships", label: "주요 관계" },
              { id: "notices", label: "공고", count: noticeQuery.data?.pagination.total_items },
              { id: "awards", label: "낙찰", count: activity.data.award_pagination.total_items },
              { id: "contracts", label: "계약", count: activity.data.contract_pagination.total_items },
            ]}
          />

          {tab === "relationships" && (
            <section className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_.85fr]">
              <div>
                <div>
                  <p className="text-xs font-semibold text-violet-700">기관 ↔ 업체</p>
                  <h2 className="mt-2 text-xl font-bold">주요 관계업체</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    확인된 낙찰 이력을 기준으로 이 기관과 연결된 업체를 보여줍니다.
                  </p>
                </div>
                <div className="mt-5 divide-y overflow-hidden rounded-2xl border bg-card">
                  {companyRelationships.slice(0, 6).map((company) => (
                    <Link
                      key={company.number}
                      to={`/companies/${encodeURIComponent(company.number)}?name=${encodeURIComponent(company.name)}`}
                      className="group grid gap-3 p-5 hover:bg-violet-50/35 dark:hover:bg-violet-950/10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <strong className="block truncate group-hover:text-violet-700">{company.name}</strong>
                        <p className="mt-1 text-xs text-muted-foreground">
                          낙찰 {company.count}건 · 확인 금액 {money(company.amount)}
                          {company.latest ? ` · 최근 ${company.latest}` : ""}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700">
                        관계 보기 <ArrowUpRight size={13} />
                      </span>
                    </Link>
                  ))}
                  {!companyRelationships.length && (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      연결된 낙찰업체가 아직 확인되지 않았습니다.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <div>
                  <p className="text-xs font-semibold text-blue-700">기관 ↔ 공고</p>
                  <h2 className="mt-2 text-xl font-bold">최근 발주공고</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    기관이 최근 발주한 사업에서 관계 탐색을 이어갈 수 있습니다.
                  </p>
                </div>
                <div className="mt-5 divide-y overflow-hidden rounded-2xl border bg-card">
                  {notices.slice(0, 6).map((notice) => (
                    <Link
                      className="group flex items-start gap-3 p-4 hover:bg-blue-50/35 dark:hover:bg-blue-950/10"
                      key={notice.id}
                      to={`/notices/${encodeURIComponent(notice.id)}`}
                    >
                      <FileText className="mt-0.5 size-4 shrink-0 text-blue-700" />
                      <span className="min-w-0">
                        <strong className="block truncate text-sm group-hover:text-blue-700">
                          {notice.name}
                        </strong>
                        <small className="mt-1 block text-muted-foreground">
                          {notice.notice_number}-{notice.notice_order}
                        </small>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "notices" && (
            <section className="mt-6">
              <div className="divide-y rounded-xl border">
                {notices.map((notice) => (
                  <Link
                    className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
                    key={notice.id}
                    to={`/notices/${encodeURIComponent(notice.id)}`}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate">{notice.name}</strong>
                      <small className="mt-1 block text-muted-foreground">
                        {notice.notice_number}-{notice.notice_order}
                      </small>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
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
                        className="font-semibold hover:text-blue-800 hover:underline"
                        to={`/companies/${item.company_number}`}
                      >
                        {item.company_name}
                      </Link>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        <Link
                          className="hover:underline"
                          to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
                        >
                          {item.notice_name}
                        </Link>{" "}
                        · {money(item.winning_amount)}
                      </p>
                    </div>
                    <Badge className="border-0" variant="secondary">
                      {item.award_date ?? "낙찰"}
                    </Badge>
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
                      <strong className="block truncate text-sm">{item.name}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.concluded_date ?? "계약일 미상"} · {money(item.amount)}
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
