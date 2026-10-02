import { ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { EntityTabs } from "@/components/common/entity-tabs";
import { HistoryBackLink } from "@/components/common/history-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactMoney } from "@/shared/format/money";
import {
  useNotice,
  useNoticeActivity,
  useBidRelationshipContext,
} from "../features/notices/api";

const money = (value?: number) => value == null ? "-" : formatCompactMoney(value);
const workType = (value?: string) =>
  ({ service: "용역", goods: "물품", construction: "공사", foreign: "외자", other: "기타" })[value ?? ""] ??
  value ??
  "-";
const date = (value?: string) => (value ? value.slice(0, 10).replaceAll("-", ".") : "-");
const rate = (value?: number | string) => {
  if (value == null || value === "") return "-";
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? `${parsed.toLocaleString("ko-KR", { maximumFractionDigits: 3 })}%` : String(value);
};
const statusLabel = (value?: string) =>
  ({ scheduled: "입찰예정", active: "진행중", closed: "마감", awarded: "낙찰", contracted: "계약" })[
    value ?? ""
  ] ??
  value ??
  "상태 미상";

export function NoticeProfilePage() {
  const { noticeId } = useParams();
  const [tab, setTab] = useState("info");
  const detail = useNotice(noticeId);
  const activity = useNoticeActivity(noticeId);
  const relationshipContext = useBidRelationshipContext(noticeId);
  const winner = activity.data?.awards[0];
  if (detail.isLoading)
    return (
      <PageContainer>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-8 h-80 rounded-2xl" />
      </PageContainer>
    );
  if (detail.isError || !detail.data)
    return (
      <PageContainer>
        <p className="rounded-xl bg-red-50 p-5 text-red-700">공고 정보를 불러오지 못했습니다.</p>
      </PageContainer>
    );
  const { notice, requirements, requirement_set: requirementSet } = detail.data;
  const participations = [...(activity.data?.participations ?? [])].sort(
    (left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER),
  );
  const relationshipByCompany = new Map(
    (relationshipContext.data?.participants ?? []).map((item) => [item.business_registration_number, item]),
  );
  const winnerContext = winner?.company_number ? relationshipByCompany.get(winner.company_number) : undefined;
  const region = requirements.filter((item) => item.type === "region");
  const industries = requirements.filter(
    (item) => item.type === "industry" || item.type === "license" || item.industry_code,
  );
  const regionState = requirementSet?.requirement_categories?.region;

  return (
    <PageContainer className="max-w-5xl">
      <HistoryBackLink fallbackTo="/notices" />
      <article className="mt-7 overflow-hidden rounded-2xl border bg-card">
        <header className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-blue-100 text-blue-800 hover:bg-blue-100">공고</Badge>
              <Badge className="border-0" variant="secondary">
                {statusLabel(notice.status)}
              </Badge>
            </div>
            {notice.detail_url && (
              <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground">
                <a href={notice.detail_url} target="_blank" rel="noreferrer">
                  나라장터 원문 <ExternalLink className="ml-1 size-3.5" />
                </a>
              </Button>
            )}
          </div>
          <h1 className="mt-5 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{notice.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {notice.organization_code ? (
              <Link
                className="font-medium text-foreground hover:underline"
                to={`/organizations/${encodeURIComponent(notice.organization_code)}`}
              >
                {notice.organization}
              </Link>
            ) : (
              <span>{notice.organization}</span>
            )}
            <span>
              {notice.notice_number}-{notice.notice_order}
            </span>
          </div>
          <dl className="mt-7 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-muted/50 p-4">
              <dt className="text-xs text-muted-foreground">업무구분</dt>
              <dd className="mt-1 font-bold">{workType(notice.work_type)}</dd>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <dt className="text-xs text-muted-foreground">예산</dt>
              <dd className="mt-1 font-bold">{money(notice.allocated_budget ?? notice.estimated_price)}</dd>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <dt className="text-xs text-muted-foreground">게시일</dt>
              <dd className="mt-1 font-bold">{date(notice.published_at)}</dd>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <dt className="text-xs text-muted-foreground">마감일</dt>
              <dd className="mt-1 font-bold">{date(notice.deadline_at)}</dd>
            </div>
          </dl>
        </header>
        <div className="border-t px-6 sm:px-8">
          <EntityTabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "info", label: "공고정보" },
              { id: "opening", label: "참여/개찰", count: participations.length || undefined },
              { id: "award", label: "낙찰", count: activity.data?.awards.length || undefined },
              { id: "contract", label: "계약", count: activity.data?.contracts.length || undefined },
            ]}
          />
        </div>
        {tab === "info" && <section className="border-t p-6 sm:p-8">
          <h2 className="text-lg font-bold">공고 정보</h2>
          <dl className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
            <div className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
              <dt className="text-muted-foreground">공고기관</dt>
              <dd className="font-medium">{notice.notice_organization || "-"}</dd>
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
              <dt className="text-muted-foreground">수요기관</dt>
              <dd className="font-medium">{notice.organization || "-"}</dd>
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
              <dt className="text-muted-foreground">계약방법</dt>
              <dd className="font-medium">{notice.contract_method || notice.bid_method || "-"}</dd>
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
              <dt className="text-muted-foreground">개찰일</dt>
              <dd className="font-medium">{date(notice.opening_at)}</dd>
            </div>
          </dl>
        </section>}
        {tab === "info" && <section className="border-t p-6 sm:p-8">
          <h2 className="text-lg font-bold">참가 조건</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-[8rem_1fr]">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">지역</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {region.map((item) => (
                <Badge className="border-0" variant="secondary" key={item.id}>
                  {item.title}
                </Badge>
              ))}
              {!region.length && (
                <span className="text-sm">
                  {regionState?.applicability === "not_applicable"
                    ? "제한 없음"
                    : regionState?.completeness === "complete"
                      ? "제한 없음"
                      : "확인 필요"}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">업종·면허</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {industries.map((item) => (
                <Badge className="border-0 bg-blue-50 text-blue-800 hover:bg-blue-50" key={item.id}>
                  {item.title}
                  {item.industry_code ? ` ${item.industry_code}` : ""}
                </Badge>
              ))}
              {!industries.length && (
                <span className="text-sm text-muted-foreground">확인된 조건이 없습니다.</span>
              )}
            </div>
          </div>
        </section>}
        {tab === "opening" && (
          <section className="border-t p-6 sm:p-8">
            <h2 className="text-lg font-bold">참여·개찰 결과</h2>
            {participations.length > 0 && (
              <div className="mt-5 overflow-hidden rounded-xl border">
                <div className="grid grid-cols-[4rem_minmax(0,1fr)_7rem_6rem_7rem] gap-3 bg-muted/50 px-4 py-3 text-xs font-semibold text-muted-foreground max-sm:grid-cols-[3.5rem_minmax(0,1fr)_6rem]">
                  <span>순위</span>
                  <span>업체</span>
                  <span className="text-right">투찰금액</span>
                  <span className="text-right max-sm:hidden">투찰률</span>
                  <span className="text-right max-sm:hidden">기관 과거 계약</span>
                </div>
                {participations.map((item) => (
                  <div
                    className="grid grid-cols-[4rem_minmax(0,1fr)_7rem_6rem_7rem] items-center gap-3 border-t px-4 py-3 text-sm max-sm:grid-cols-[3.5rem_minmax(0,1fr)_6rem]"
                    key={item.id}
                  >
                    <span className={item.rank === 1 ? "font-bold text-blue-700" : "text-muted-foreground"}>
                      {item.rank != null ? `${item.rank}위` : "-"}
                    </span>
                    {item.company_number ? (
                      <Link
                        className="truncate font-medium hover:underline"
                        to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name ?? "업체")}`}
                      >
                        {item.company_name ?? "업체명 미확인"}
                      </Link>
                    ) : (
                      <span className="truncate font-medium">{item.company_name ?? "업체명 미확인"}</span>
                    )}
                    <span className="text-right tabular-nums">{money(item.bid_amount)}</span>
                    <span className="text-right tabular-nums text-muted-foreground max-sm:hidden">{rate(item.bid_rate)}</span>
                    <span className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {relationshipByCompany.get(item.company_number)?.prior_organization_relationship?.contract_event_count ?? 0}건
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!participations.length && !activity.isLoading && (
              <p className="mt-5 rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">
                확인된 참여·개찰 결과가 없습니다.
              </p>
            )}
          </section>
        )}
        {tab === "award" && (
          <section className="border-t p-6 sm:p-8">
            <h2 className="text-lg font-bold">낙찰 결과</h2>
            {Boolean(activity.data?.awards.length) ? (
              <div className="mt-5 space-y-3">
              {activity.data?.awards.map((award) => (
                <div className="rounded-xl bg-muted/40 p-4" key={award.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {award.company_number ? (
                        <Link
                          className="font-bold hover:underline"
                          to={`/companies/${encodeURIComponent(award.company_number)}?name=${encodeURIComponent(award.company_name ?? "업체")}`}
                        >
                          {award.company_name}
                        </Link>
                      ) : (
                        <strong>{award.company_name}</strong>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">낙찰일 {date(award.award_date)}</p>
                    </div>
                    <div className="text-right">
                      <strong>{money(award.winning_amount)}</strong>
                      {award.winning_rate != null && (
                        <p className="mt-1 text-xs text-muted-foreground">낙찰률 {rate(award.winning_rate)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              </div>
            ) : !activity.isLoading ? (
              <p className="mt-5 rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">
                확인된 낙찰 결과가 없습니다.
              </p>
            ) : null}
            {winner?.company_number && winnerContext?.prior_organization_relationship && (
              <div className="mt-8 rounded-2xl border bg-card p-5 sm:p-6">
                <p className="text-xs font-semibold text-violet-700">발주기관 ↔ 낙찰업체</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-lg font-bold">
                  <Link
                    className="hover:underline"
                    to={`/organizations/${encodeURIComponent(notice.organization_code ?? "")}`}
                  >
                    {notice.organization}
                  </Link>
                  <span className="text-muted-foreground">↔</span>
                  <Link
                    className="hover:underline"
                    to={`/companies/${encodeURIComponent(winner.company_number)}?name=${encodeURIComponent(winner.company_name ?? "업체")}`}
                  >
                    {winner.company_name}
                  </Link>
                </div>
                <dl className="mt-5 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">과거 수주</dt>
                    <dd className="mt-1 font-bold">{winnerContext.prior_organization_relationship.contract_event_count ?? 0}건</dd>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">활동 연도</dt>
                    <dd className="mt-1 font-bold">
                      {Math.min(5, winnerContext.prior_organization_relationship.active_years?.length ?? 0)}개 연도
                    </dd>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">최초 수주</dt>
                    <dd className="mt-1 font-bold">{date(winnerContext.prior_organization_relationship.first_activity_date)}</dd>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">최근 수주</dt>
                    <dd className="mt-1 font-bold">{date(winnerContext.prior_organization_relationship.latest_activity_date)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </section>
        )}
        {tab === "contract" && (
          <section className="border-t p-6 sm:p-8">
            <h2 className="text-lg font-bold">계약 정보</h2>
            {Boolean(activity.data?.contracts.length) ? <div className="mt-5 space-y-3">
              {activity.data?.contracts.map((contract) => (
                <div className="rounded-xl bg-muted/40 p-4" key={contract.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong>{contract.name ?? "계약"}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">
                        계약일 {date(contract.concluded_date ?? contract.contract_date)}
                      </p>
                    </div>
                    <strong>{money(contract.amount)}</strong>
                  </div>
                </div>
              ))}
            </div> : !activity.isLoading ? (
              <p className="mt-5 rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">
                확인된 계약 정보가 없습니다.
              </p>
            ) : null}
          </section>
        )}
      </article>
    </PageContainer>
  );
}
