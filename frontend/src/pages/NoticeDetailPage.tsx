import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { EntityLink } from "@/components/common/entity-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useNotice,
  useNoticeActivity,
  useNoticeMarketContext,
  type Notice,
  type NoticeMarketContext,
  type ProcurementAward,
  type ProcurementContract,
  type ProcurementParticipation,
  type Requirement,
} from "../features/notices/api";

const money = (value?: number) => (value == null ? "미정" : `${value.toLocaleString("ko-KR")}원`);
const businessKey = (value?: string) => (value ?? "").replace(/\D/g, "");
const participationRate = (rate?: number | string, amount?: number, estimatedPrice?: number) => {
  const supplied = Number(String(rate ?? "").replace("%", ""));
  if (Number.isFinite(supplied) && supplied > 0) return `${supplied.toFixed(3)}%`;
  if (amount != null && estimatedPrice != null && estimatedPrice > 0) {
    return `${((amount / estimatedPrice) * 100).toFixed(3)}%`;
  }
  return "산정 불가";
};
const workTypeLabels: Record<string, string> = {
  service: "용역",
  goods: "물품",
  construction: "공사",
  foreign: "외자",
  other: "기타",
};
const noticeStatusLabels: Record<string, string> = {
  scheduled: "입찰 예정",
  open: "진행 중",
  unknown: "일정 확인 필요",
  closed: "마감",
  cancelled: "취소",
  canceled: "취소",
};
const dateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : "미정";

const deadlineLabel = (value?: string) => {
  if (!value) return null;
  const remaining = new Date(value).getTime() - Date.now();
  const days = Math.ceil(remaining / 86_400_000);
  if (days < 0) return "마감";
  if (days === 0) return "오늘 마감";
  return `D-${days}`;
};

function SectionPagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-center gap-1" aria-label="목록 페이지">
      <button className="rounded-md px-3 py-2 text-xs text-muted-foreground disabled:opacity-40" disabled={page === 1} onClick={() => onChange(page - 1)} type="button">이전</button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
        <button
          className={`size-8 rounded-md text-xs font-semibold ${number === page ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-muted-foreground hover:bg-muted"}`}
          key={number}
          onClick={() => onChange(number)}
          type="button"
          aria-current={number === page ? "page" : undefined}
        >
          {number}
        </button>
      ))}
      <button className="rounded-md px-3 py-2 text-xs text-muted-foreground disabled:opacity-40" disabled={page === totalPages} onClick={() => onChange(page + 1)} type="button">다음</button>
    </nav>
  );
}

function ParticipationRestrictions({ requirements, state }: { requirements: Requirement[]; state: string }) {
  const bidEntry = requirements.filter((item) => !item.assessment_stage || item.assessment_stage === "bid_entry");
  const regions = bidEntry.filter((item) => ["participation_region", "region"].includes(item.type));
  const industries = bidEntry.filter((item) => ["industry_license", "license", "industry"].includes(item.type));
  const renderValues = (items: Requirement[], noRestrictionText: string) => items.length ? (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span className="rounded-md border bg-background px-2.5 py-1 text-sm font-medium" key={item.id}>
          {item.title || item.proposition_text || item.original_text || "조건 확인 필요"}
        </span>
      ))}
    </div>
  ) : <span className="text-sm text-muted-foreground">{state === "ready" ? noRestrictionText : "공고 원문 확인 필요"}</span>;
  return (
    <section id="participation-restrictions" className="mt-8 scroll-mt-24">
      <h2 className="text-xl font-bold">참가 제한</h2>
      <dl className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card px-5 shadow-sm sm:px-6">
        <div className="grid gap-2 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
          <dt className="text-sm font-semibold">지역</dt>
          <dd>{renderValues(regions, "지역 제한 없음")}</dd>
        </div>
        <div className="grid gap-2 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
          <dt className="text-sm font-semibold">업종·면허</dt>
          <dd>{renderValues(industries, "업종·면허 제한 없음")}</dd>
        </div>
      </dl>
    </section>
  );
}

function KeyMessages({
  data,
}: {
  data: NoticeMarketContext;
}) {
  const leadCompany = data.companies[0];
  const rates = data.similar_notices
    .map((item) => Number(item.winning_rate))
    .filter((value) => Number.isFinite(value) && value > 0);
  const sortedRates = [...rates].sort((left, right) => left - right);
  const averageRate = rates.length >= 3 ? rates.reduce((sum, value) => sum + value, 0) / rates.length : null;
  const medianRate = sortedRates.length >= 3
    ? sortedRates.length % 2
      ? sortedRates[Math.floor(sortedRates.length / 2)]
      : (sortedRates[sortedRates.length / 2 - 1] + sortedRates[sortedRates.length / 2]) / 2
    : null;
  const organizationSimilarCompany = [...data.companies].sort((left, right) => {
    const leftScore = (left.organization_similar_contract_count ?? 0) * 3 + (left.organization_similar_award_count ?? 0) * 2 + (left.organization_similar_participation_count ?? 0);
    const rightScore = (right.organization_similar_contract_count ?? 0) * 3 + (right.organization_similar_award_count ?? 0) * 2 + (right.organization_similar_participation_count ?? 0);
    return rightScore - leftScore;
  }).find((company) => (company.organization_similar_participation_count ?? 0) > 0 || (company.organization_similar_award_count ?? 0) > 0 || (company.organization_similar_contract_count ?? 0) > 0);
  const rows: Array<{ label: string; content: ReactNode; href: string; action: string }> = [];
  if (!leadCompany) {
    rows.push({
      label: "주목할 업체",
      content: <>현재 확인된 <strong>지역·업종·면허 조건을 모두 통과한 관련 업체가 없습니다.</strong></>,
      href: "#participation-restrictions",
      action: "조건 보기",
    });
  } else if (organizationSimilarCompany) {
    rows.push({
      label: "기관 연관 업체",
      content: <><EntityLink type="company" to={`/companies/${organizationSimilarCompany.company_number}?name=${encodeURIComponent(organizationSimilarCompany.company_name)}`}>{organizationSimilarCompany.company_name}</EntityLink>이(가) 이 기관의 관련 공고에서 참여 <strong>{organizationSimilarCompany.organization_similar_participation_count}건</strong>·낙찰 <strong>{organizationSimilarCompany.organization_similar_award_count}건</strong>으로 가장 많이 나타났습니다.</>,
      href: "#related-companies",
      action: "관계 보기",
    });
  } else {
    rows.push({
      label: "기관 연관 업체",
      content: <>이 기관의 관련 공고에서는 <strong>반복적으로 나타난 업체가 확인되지 않았습니다.</strong></>,
      href: "#related-companies",
      action: "업체 보기",
    });
  }
  if (leadCompany && leadCompany.company_number !== organizationSimilarCompany?.company_number) {
    rows.push({
      label: "주목할 업체",
      content: <><EntityLink type="company" to={`/companies/${leadCompany.company_number}?name=${encodeURIComponent(leadCompany.company_name)}`}>{leadCompany.company_name}</EntityLink>은(는) 전체 관련 공고에서 참여 <strong>{leadCompany.participation_count ?? 0}건</strong>·낙찰 <strong>{leadCompany.award_count}건</strong>의 이력이 확인됩니다.</>,
      href: "#related-companies",
      action: "업체 보기",
    });
  }
  rows.push({
    label: "관련 사업 사례",
    content: <>최근 {data.period_years}년간 전체 기관에서 <strong>공고명이 비슷한 낙찰 사례 {data.sample_size}건</strong>을 확인했습니다.</>,
    href: "#similar-notices",
    action: "공고 보기",
  });
  if (averageRate != null && medianRate != null) {
    rows.push({
      label: "낙찰 수준",
      content: <>비교 가능한 관련 사례 {rates.length}건의 낙찰률은 평균 <strong>{averageRate.toFixed(1)}%</strong>, 중앙값 <strong>{medianRate.toFixed(1)}%</strong>입니다.</>,
      href: "#similar-notices",
      action: "비교 보기",
    });
  }
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">주요 포인트</h2>
      <div className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card px-5 shadow-sm sm:px-6">
        {rows.slice(0, 4).map((row) => (
          <div className="grid gap-2 py-4 text-sm sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4" key={row.label}>
            <strong className="text-sm">{row.label}</strong>
            <p className="leading-6">{row.content}</p>
            <a className="justify-self-end text-xs font-semibold text-muted-foreground hover:text-foreground" href={row.href}>{row.action}</a>
          </div>
        ))}
      </div>
    </section>
  );
}

function AwardResults({
  awards,
  participations,
  notice,
}: {
  awards: ProcurementAward[];
  participations: ProcurementParticipation[];
  notice: Notice;
}) {
  const sorted = [...participations].sort(
    (left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER),
  );
  const participantNumbers = new Set(sorted.map((item) => businessKey(item.company_number)).filter(Boolean));
  const unmatchedAwards = awards.filter(
    (item) => !item.company_number || !participantNumbers.has(businessKey(item.company_number)),
  );
  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Result</p>
          <h2 className="mt-1 text-xl font-bold">낙찰 결과</h2>
        </div>
        <span className="text-xs text-muted-foreground">순위순</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">제공된 투찰률을 우선 표시하며, 없는 경우 예정가격을 기준으로 계산합니다.</p>
      <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
        {unmatchedAwards.map((item) => (
          <div className="flex items-center justify-between gap-4 border-b bg-emerald-50/60 p-5 dark:bg-emerald-950/20" key={item.id}>
            <div>
              <EntityLink type="company" to={`/companies/${item.company_number}`}>{item.company_name}</EntityLink>
              <p className="mt-1 text-xs text-muted-foreground">낙찰금액 {money(item.winning_amount)}{item.winning_rate ? ` · 낙찰률 ${item.winning_rate}%` : ""}</p>
            </div>
            <div className="flex items-center gap-2"><Badge className="bg-emerald-700">낙찰</Badge><Badge variant="secondary">1순위</Badge></div>
          </div>
        ))}
        {sorted.map((item) => {
          const award = awards.find((candidate) => businessKey(candidate.company_number) === businessKey(item.company_number));
          const isWinner = Boolean(award) || item.rank === 1;
          const rate = award?.winning_rate
            ? participationRate(award.winning_rate)
            : participationRate(item.bid_rate, item.bid_amount, notice.estimated_price);
          return (
            <div className={`flex items-center justify-between gap-4 border-b p-5 last:border-0 ${isWinner ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`} key={item.id}>
              <div>
                <EntityLink type="company" to={`/companies/${item.company_number}`}>{item.company_name}</EntityLink>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isWinner && award ? "낙찰금액" : "투찰금액"} {money(award?.winning_amount ?? item.bid_amount)} · {isWinner && award?.winning_rate ? "낙찰률" : "투찰률"} {rate} · {item.remark ?? item.result ?? "결과 확인"}
                </p>
              </div>
              <div className="flex items-center gap-2">{isWinner && <Badge className="bg-emerald-700">낙찰</Badge>}{item.rank != null && <Badge variant="secondary">{item.rank}순위</Badge>}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ContractResults({ contracts }: { contracts: ProcurementContract[] }) {
  return (
    <section className="mt-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Result</p>
        <h2 className="mt-1 text-xl font-bold">계약 결과</h2>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
        {contracts.map((item) => (
          <div className="flex items-center justify-between gap-4 border-b p-5 last:border-0" key={item.id}>
            <div>
              <strong className="text-sm">{item.name}</strong>
              <p className="mt-1 text-xs text-muted-foreground">{item.concluded_date ?? "계약일 미상"} · {money(item.amount)}{item.period ? ` · ${item.period}` : ""}</p>
            </div>
            {item.detail_url && <a className="text-sm font-medium text-blue-800 hover:underline" href={item.detail_url} target="_blank" rel="noreferrer">계약 원문</a>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function NoticeDetailPage() {
  const { noticeId } = useParams();
  const query = useNotice(noticeId);
  const activity = useNoticeActivity(noticeId);
  const hasContractResult = Boolean(activity.data?.contracts.length);
  const hasAwardResult = Boolean(activity.data?.awards.length);
  const hasCompletedResult = hasContractResult || hasAwardResult;
  const market = useNoticeMarketContext(
    noticeId,
    activity.isError || (activity.isSuccess && !hasCompletedResult),
  );
  const [similarPage, setSimilarPage] = useState(1);
  const [companyPage, setCompanyPage] = useState(1);
  const [expandedCompanyNumber, setExpandedCompanyNumber] = useState<string>();
  const sectionPageSize = 5;
  if (query.isLoading)
    return (
      <PageContainer>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-8 h-48 rounded-xl" />
      </PageContainer>
    );
  if (query.isError)
    return (
      <PageContainer>
        <p className="rounded-xl bg-red-50 p-5 text-red-700">
          공고를 불러오지 못했습니다. {query.error.message}
        </p>
      </PageContainer>
    );
  const detail = query.data!;
  const notice = detail.notice;
  const bidEntryRequirements = detail.requirements.filter(
    (item) => !item.assessment_stage || item.assessment_stage === "bid_entry",
  );
  const hasRegionRestriction = bidEntryRequirements.some((item) => ["participation_region", "region"].includes(item.type));
  const hasIndustryLicenseRestriction = bidEntryRequirements.some((item) => ["industry_license", "license", "industry"].includes(item.type));
  const displayStatus = hasContractResult
    ? "계약 완료"
    : hasAwardResult
      ? "낙찰 완료"
      : noticeStatusLabels[notice.status] ?? notice.status ?? "확인 필요";
  const deadline = deadlineLabel(notice.deadline_at);
  return (
    <PageContainer>
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-blue-800"
        to="/notices"
      >
        <ArrowLeft size={15} />
        공고 찾기
      </Link>
      <header className="mt-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight">{notice.name}</h1>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            {notice.organization_code ? (
              <EntityLink
                type="organization"
                to={`/organizations/${encodeURIComponent(notice.organization_code)}`}
              >
                {notice.organization}
              </EntityLink>
            ) : (
              notice.organization
            )}
          </p>
        </div>
        {notice.detail_url && (
          <Button variant="outline" asChild>
            <a href={notice.detail_url} target="_blank" rel="noreferrer">
              나라장터 원문 <ExternalLink size={14} />
            </a>
          </Button>
        )}
      </header>
      <dl className="mt-7 grid grid-cols-2 overflow-hidden rounded-xl border lg:grid-cols-5">
        {[
          ["업무구분", workTypeLabels[notice.work_type] ?? notice.work_type ?? "미정"],
          ["예산", money(notice.allocated_budget)],
          ["게시일", dateTime(notice.published_at)],
          ["마감일", `${dateTime(notice.deadline_at)}${deadline ? ` · ${deadline}` : ""}`],
        ].map(([label, value]) => (
          <div className="border-b border-r p-4" key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1.5 text-sm font-semibold">{value}</dd>
          </div>
        ))}
        <div className="border-b border-r p-4">
          <dt className="text-xs text-muted-foreground">상태</dt>
          <dd className="mt-1.5"><Badge variant="secondary">{displayStatus}</Badge></dd>
        </div>
      </dl>
      {activity.data && activity.data.contracts.length > 0 && <ContractResults contracts={activity.data.contracts} />}
      {activity.data && activity.data.contracts.length === 0 && (activity.data.awards.length > 0 || activity.data.participations.length > 0) && (
        <AwardResults awards={activity.data.awards} participations={activity.data.participations} notice={notice} />
      )}
      <ParticipationRestrictions requirements={detail.requirements} state={detail.requirement_state} />
      {!hasCompletedResult && market.data && market.data.sample_size > 0 && (
        <KeyMessages data={market.data} />
      )}
      {!activity.isLoading && !hasCompletedResult && (market.data && market.data.sample_size > 0 ? (
        <div className="mt-10 flex flex-col gap-10">
          <section id="similar-notices" className="order-2 scroll-mt-24">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">공고명 기준 관련 공고</h2>
                <p className="mt-1 text-xs text-muted-foreground">현재는 공고명의 공통 표현을 기준으로 비교하며, 실제 과업 범위는 다를 수 있습니다.</p>
              </div>
              <span className="text-xs text-muted-foreground">
                최근 {market.data.period_years}년 · {market.data.sample_size}건
              </span>
            </div>
            <div className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
              {market.data.similar_notices.slice((similarPage - 1) * sectionPageSize, similarPage * sectionPageSize).map((item) => (
                <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_9rem_8rem] sm:items-center" key={item.id}>
                  <div className="min-w-0">
                    <EntityLink type="notice" className="max-w-full text-sm" to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}>
                      {item.notice_name}
                    </EntityLink>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.organization_code ? (
                        <EntityLink type="organization" to={`/organizations/${encodeURIComponent(item.organization_code)}`}>
                          {item.organization_name ?? "기관명 미상"}
                        </EntityLink>
                      ) : item.organization_name ? <span>{item.organization_name}</span> : null}
                      {item.company_number ? (
                        <EntityLink type="company" to={`/companies/${item.company_number}?name=${encodeURIComponent(item.company_name ?? "업체")}`}>
                          낙찰업체 {item.company_name}
                        </EntityLink>
                      ) : item.company_name ? <span>낙찰업체 {item.company_name}</span> : null}
                      <span>{item.award_date ?? "일자 미상"}</span>
                      {item.similarity_reasons.map((reason) => (
                        <span className="rounded-full bg-muted px-2 py-0.5" key={reason}>{reason}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">낙찰금액</span>
                    <strong className="mt-1 block text-sm">{money(item.winning_amount)}</strong>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">낙찰률</span>
                    <strong className="mt-1 block text-sm">{item.winning_rate ? `${item.winning_rate}%` : "미제공"}</strong>
                    <span className="text-[10px] text-muted-foreground">예정가격 대비</span>
                  </div>
                </div>
              ))}
            </div>
            <SectionPagination
              page={similarPage}
              totalPages={Math.ceil(market.data.similar_notices.length / sectionPageSize)}
              onChange={setSimilarPage}
            />
          </section>

          <div className="contents">
            <section id="related-companies" className="order-1 scroll-mt-24">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">주목할 업체</h2>
                <span className="text-sm font-semibold">{market.data.companies.length}곳</span>
              </div>
              <div className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
                {market.data.companies.slice((companyPage - 1) * sectionPageSize, companyPage * sectionPageSize).map((company) => (
                  <div className="p-4 sm:px-5" key={company.company_number}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <EntityLink type="company" to={`/companies/${company.company_number}?name=${encodeURIComponent(company.company_name)}`}>
                            {company.company_name}
                          </EntityLink>
                          {hasRegionRestriction && company.region_status === "satisfied" && <Badge variant="outline">지역 충족</Badge>}
                          {hasIndustryLicenseRestriction && company.industry_license_status === "satisfied" && <Badge variant="outline">업종·면허 충족</Badge>}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>관련 공고 참여 {company.participation_count ?? 0} · 낙찰 {company.award_count} · 계약 {company.contract_count ?? 0}</span>
                          <span className="text-border">|</span>
                          <span>
                            {(company.organization_participation_count ?? 0) + (company.organization_award_count ?? 0) + (company.organization_contract_count ?? 0) > 0
                              ? `해당 기관 참여 ${company.organization_participation_count} · 낙찰 ${company.organization_award_count} · 계약 ${company.organization_contract_count}`
                              : "해당 기관 활동 없음"}
                          </span>
                          {company.latest_award_date && <><span className="text-border">|</span><span>최근 {company.latest_award_date}</span></>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        <button
                          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                          onClick={() => setExpandedCompanyNumber((current) => current === company.company_number ? undefined : company.company_number)}
                          type="button"
                        >
                          {expandedCompanyNumber === company.company_number ? "이력 닫기" : "이력 보기"}
                        </button>
                      </div>
                    </div>
                    {expandedCompanyNumber === company.company_number && (
                      <div className="mt-4 rounded-xl bg-muted/30 p-4">
                        <dl className="grid gap-4 border-b pb-4 text-xs sm:grid-cols-3">
                          <div><dt className="text-muted-foreground">전체 기관의 관련 공고</dt><dd className="mt-1 font-medium">참여 {company.participation_count ?? 0} · 낙찰 {company.award_count} · 계약 {company.contract_count ?? 0} · {money(company.total_amount)}</dd></div>
                          <div><dt className="text-muted-foreground">이 기관의 관련 공고</dt><dd className="mt-1 font-medium">참여 {company.organization_similar_participation_count ?? 0} · 낙찰 {company.organization_similar_award_count ?? 0} · 계약 {company.organization_similar_contract_count ?? 0}</dd></div>
                          <div><dt className="text-muted-foreground">기관 전체 이력</dt><dd className="mt-1 font-medium">참여 {company.organization_participation_count} · 낙찰 {company.organization_award_count} · 계약 {company.organization_contract_count}</dd></div>
                        </dl>
                        <div className="divide-y">
                        {company.activities?.length ? company.activities.map((activityItem) => (
                          <div className="grid gap-2 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center" key={activityItem.bid_notice_id}>
                            <div className="min-w-0">
                              <EntityLink type="notice" to={`/notices/${encodeURIComponent(activityItem.bid_notice_id)}`}>{activityItem.notice_name ?? activityItem.bid_notice_id}</EntityLink>
                              {activityItem.organization_code && <div className="mt-1"><EntityLink type="organization" to={`/organizations/${encodeURIComponent(activityItem.organization_code)}`}>{activityItem.organization_name ?? "기관명 미상"}</EntityLink></div>}
                            </div>
                            <span className="text-muted-foreground">{activityItem.awarded ? "낙찰" : activityItem.contracted ? "계약" : "참여"}{activityItem.award_date ? ` · ${activityItem.award_date}` : ""}</span>
                            <strong>{activityItem.winning_amount != null ? money(activityItem.winning_amount) : ""}</strong>
                          </div>
                        )) : <p className="py-4 text-xs text-muted-foreground">연결된 공고 이력이 없습니다.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <SectionPagination
                page={companyPage}
                totalPages={Math.ceil(market.data.companies.length / sectionPageSize)}
                onChange={setCompanyPage}
              />
            </section>

          </div>

        </div>
      ) : market.isLoading ? (
        <Skeleton className="mt-9 h-52 rounded-xl" />
      ) : (
        <div className="mt-9 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          전체 낙찰 이력에서 공고명이 비슷한 비교 사례를 찾지 못했습니다.
        </div>
      ))}
      {activity.isLoading && <Skeleton className="mt-6 h-32 rounded-xl" />}
      {activity.isError && (
        <p className="mt-6 rounded-xl border p-5 text-sm text-muted-foreground">
          조달 활동을 불러오지 못했습니다.
        </p>
      )}
    </PageContainer>
  );
}
