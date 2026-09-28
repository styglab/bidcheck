import { ExternalLink, FileText } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { HistoryBackLink } from "@/components/common/history-back-link";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotice, useNoticeActivity } from "../features/notices/api";

const money = (value?: number) =>
  value == null
    ? "-"
    : value >= 100_000_000
      ? `${(value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`
      : `${value.toLocaleString("ko-KR")}원`;
const workType = (value?: string) =>
  ({ service: "용역", goods: "물품", construction: "공사", foreign: "외자", other: "기타" })[value ?? ""] ??
  value ??
  "-";
const date = (value?: string) => (value ? value.slice(0, 10).replaceAll("-", ".") : "-");

export function NoticeProfilePage() {
  const { noticeId } = useParams();
  const detail = useNotice(noticeId);
  const activity = useNoticeActivity(noticeId);
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
  const completed = Boolean(activity.data?.awards.length || activity.data?.contracts.length);
  const region = requirements.filter((item) => item.type === "region");
  const industries = requirements.filter(
    (item) => item.type === "industry" || item.type === "license" || item.industry_code,
  );
  const regionState = requirementSet?.requirement_categories?.region;

  return (
    <PageContainer className="max-w-5xl">
      <HistoryBackLink fallbackTo="/explore?type=notices" />
      <article className="mt-7 overflow-hidden rounded-2xl border bg-card">
        <header className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-blue-100 text-blue-800 hover:bg-blue-100">공고</Badge>
            <Badge className="border-0" variant="secondary">
              {notice.status}
            </Badge>
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
        <section className="border-t p-6 sm:p-8">
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
        </section>
        {completed && (
          <section className="border-t p-6 sm:p-8">
            <h2 className="text-lg font-bold">낙찰·계약 결과</h2>
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
                    <strong>{money(award.winning_amount)}</strong>
                  </div>
                </div>
              ))}
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
            </div>
          </section>
        )}
        <footer className="flex flex-wrap gap-3 border-t bg-muted/20 p-6 sm:px-8">
          <Button asChild>
            <Link to={`/relations?notice=${encodeURIComponent(notice.id)}`}>주변 관계 탐색</Link>
          </Button>
          {notice.detail_url && (
            <Button asChild variant="outline">
              <a href={notice.detail_url} target="_blank" rel="noreferrer">
                나라장터 원문 <ExternalLink className="ml-1 size-4" />
              </a>
            </Button>
          )}
          <span className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <FileText size={14} />
            공고 프로필
          </span>
        </footer>
      </article>
    </PageContainer>
  );
}
