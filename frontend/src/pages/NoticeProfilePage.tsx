import { ParticipationFindingsSection } from "@/features/notices/ParticipationFindingsSection";
import { NoticeResultsSection } from "@/features/notices/NoticeResultsSection";
import {
  noticeProfilePresentation,
  money,
  exactMoney,
  insightMoney,
  workType,
  date,
  dateTime,
  remainingDays,
} from "@/features/notices/notice-profile-presentation";
import { NoticeCompanyAssessment } from "@/features/notices/NoticeCompanyAssessment";
import { ExternalLink, FileText } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  EntityDetailContentSkeleton,
  EntityDetailHeaderSkeleton,
  EntityDetailLayout,
} from "@/components/layout/entity-detail-layout";
import { EntityDetailHeader } from "@/components/layout/entity-detail-header";
import {
  EntityDetailAction,
  EntityDetailSection,
  EntityMetric,
  EntityMetricGrid,
  EntityMetricValue,
} from "@/components/common/entity-detail-section";
import { SectionError } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { MetricHelp } from "@/components/common/metric-help";
import { NoticeRequirementsSection } from "@/features/notices/NoticeRequirementsSection";
import { NoticeSectionNav } from "@/features/notices/NoticeSectionNav";

import {
  useBidParticipationContext,
  useNotice,
  useNoticeActivity,
  useNoticeRelatedProjects,
} from "../features/notices/api";

export function NoticeProfilePage() {
  const { noticeId } = useParams();
  const [participationPagination, setParticipationPagination] = useState({ noticeId, page: 1 });
  const participationResultsRef = useRef<HTMLDivElement>(null);
  const participationPage = participationPagination.noticeId === noticeId ? participationPagination.page : 1;
  const detail = useNotice(noticeId);
  const shouldLoadActivity = Boolean(
    detail.data && !["scheduled", "active", "open"].includes(detail.data.notice.status),
  );
  const shouldAnalyzeNotice = Boolean(
    detail.data &&
    ["scheduled", "active", "open"].includes(detail.data.notice.status) &&
    detail.data.notice.is_latest_in_lineage !== false,
  );
  const activity = useNoticeActivity(noticeId, shouldLoadActivity);
  const participationContext = useBidParticipationContext(noticeId, shouldAnalyzeNotice);
  const relatedProjects = useNoticeRelatedProjects(noticeId, [], 1, shouldAnalyzeNotice);

  if (detail.isLoading)
    return (
      <EntityDetailLayout fallbackTo="/notices">
        <EntityDetailHeaderSkeleton />
        <EntityDetailContentSkeleton variant="notice" />
      </EntityDetailLayout>
    );
  if (detail.isError || !detail.data)
    return (
      <EntityDetailLayout fallbackTo="/notices">
        <SectionError error={detail.error} title="공고 정보" onRetry={() => detail.refetch()} />
      </EntityDetailLayout>
    );

  const view = noticeProfilePresentation(
    detail.data,
    activity.data,
    participationContext.data,
    relatedProjects.data,
    participationPage,
  );
  const {
    notice,
    requirements,
    isFailed,
    isCancelled,
    isStopped,
    isSuperseded,
    latestNoticeId,
    isOutcome,
    status,
    isBidding,
    projectAmount,
    regionState,
    currentLifecycleIndex,
    lifecycleSteps,
    sectionNavItems,
    scale,
    peerConcentration,
    peerCompetition,
    entryCases,
    firstEntryCase,
    attentionSuppliers,
    relatedProjectItems,
    relatedHistoryHref,
    relatedProjectTags,
    contractVersionLabel,
    contractorNames,
    scaleTopPercent,
    participantMedian,
    peerParticipantMedian,
    incumbentAmountShare,
    peerIncumbentAmountShare,
    singleBidCount,
    organizationFieldInsight,
    currentNoticeInsight,
    supplierReasons,
  } = view;
  return (
    <EntityDetailLayout fallbackTo="/notices">
      <EntityDetailHeader
        actions={
          notice.detail_url ? (
            <EntityDetailAction asChild>
              <a href={notice.detail_url} target="_blank" rel="noreferrer">
                나라장터 원문 <ExternalLink className="ml-1 size-3.5" />
              </a>
            </EntityDetailAction>
          ) : undefined
        }
        entityLabel="공고"
        icon={<FileText className="size-5" />}
        meta={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge
              className={`h-5 border-0 px-2 text-[11px] font-semibold leading-none ${isSuperseded ? "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950/50" : isBidding ? "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-950/50" : isFailed ? "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-950/50 dark:text-orange-200 dark:hover:bg-orange-950/50" : isCancelled ? "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/50" : "bg-muted text-foreground hover:bg-muted"}`}
            >
              {status}
            </Badge>
            {notice.is_re_notice && (
              <Badge className="h-5 border-0 bg-blue-50 px-2 text-[11px] font-semibold text-blue-800 hover:bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950/50">
                재공고
              </Badge>
            )}
            <span>
              {workType(notice.work_type)} · {notice.notice_number}-{notice.notice_order}
            </span>
          </span>
        }
        title={notice.name}
        tone="notice"
      >
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {notice.organization_code ? (
            <>
              <Link
                className="font-medium text-foreground hover:underline"
                to={`/organizations/${encodeURIComponent(notice.organization_code)}`}
              >
                {notice.organization}
              </Link>
              <Link
                className="text-xs font-medium text-blue-800 hover:underline dark:text-blue-300"
                to={`/organizations/${encodeURIComponent(notice.organization_code)}`}
              >
                계약업체 구성 보기
              </Link>
            </>
          ) : (
            <span>{notice.organization}</span>
          )}
          {!isSuperseded && notice.previous_bid_notice_id && (
            <Link
              className="text-xs font-medium text-blue-800 hover:underline dark:text-blue-300"
              to={`/notices/${encodeURIComponent(notice.previous_bid_notice_id)}`}
            >
              이전 공고 이력
            </Link>
          )}
          {(notice.lineage_count ?? 1) > 1 && (
            <span className="text-xs">공고 이력 {notice.lineage_count}건</span>
          )}
          <span className="text-xs tabular-nums">게시 {date(notice.published_at)}</span>
        </div>
      </EntityDetailHeader>
      <EntityMetricGrid className="mt-6 grid-cols-2 sm:grid-cols-4">
        {[
          ["사업금액", exactMoney(projectAmount)],
          ["접수마감", dateTime(notice.deadline_at)],
          ["남은 기간", remainingDays(notice.deadline_at)],
          ["계약방식", notice.contract_method ?? notice.bid_method ?? "-"],
        ].map(([label, value]) => (
          <EntityMetric
            className="border-b px-1 even:border-l even:pl-5 [&:nth-child(n+3)]:border-b-0 sm:border-b-0 sm:border-l sm:px-5 sm:first:border-l-0 sm:first:pl-1"
            key={label}
            label={label}
            value={
              label === "사업금액" && value.includes("\u00a0") ? (
                <EntityMetricValue value={value.split("\u00a0")[0]} unit={value.split("\u00a0")[1]} />
              ) : (
                <span className="text-lg">{value}</span>
              )
            }
          />
        ))}
      </EntityMetricGrid>
      <section className="mt-6 border-y py-5" aria-label="공고 진행 상태">
        {isSuperseded ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong className="text-sm text-amber-900 dark:text-amber-200">
                이 공고는 재공고로 대체되었습니다.
              </strong>
              <p className="mt-1 text-xs text-muted-foreground">
                일정과 참가 조건은 최신 공고를 기준으로 확인해 주세요.
              </p>
            </div>
            {latestNoticeId && latestNoticeId !== notice.id && (
              <Button asChild size="sm">
                <Link to={`/notices/${encodeURIComponent(latestNoticeId)}`}>최신 재공고 보기</Link>
              </Button>
            )}
          </div>
        ) : isStopped ? (
          <div className="flex items-center gap-3">
            <Badge
              className={`border-0 ${isFailed ? "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-950/50 dark:text-orange-200 dark:hover:bg-orange-950/50" : "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/50"}`}
            >
              {isFailed ? "유찰" : "취소"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {isFailed
                ? notice.failure_reason || "유찰 사유는 나라장터 원문에서 확인해 주세요."
                : notice.cancellation_reason || "취소 사유는 나라장터 원문에서 확인해 주세요."}
            </p>
          </div>
        ) : (
          <ol className="grid sm:grid-cols-5">
            {lifecycleSteps.map((step, index) => (
              <li
                className="relative min-h-16 pb-4 pl-9 last:min-h-0 last:pb-0 sm:min-h-0 sm:pb-0 sm:pl-0 sm:text-center"
                key={step.label}
              >
                {index < lifecycleSteps.length - 1 && (
                  <span
                    className={`absolute left-[0.4375rem] top-4 h-[calc(100%-0.25rem)] w-0.5 sm:left-1/2 sm:top-2 sm:h-0.5 sm:w-full ${index < currentLifecycleIndex ? "bg-primary" : "bg-border"}`}
                  />
                )}
                <span
                  className={`absolute left-0 top-0 z-10 flex size-4 items-center justify-center rounded-full border-2 text-[9px] font-bold sm:left-1/2 sm:-translate-x-1/2 ${index === currentLifecycleIndex ? `border-primary ${step.completed ? "bg-primary text-primary-foreground" : "bg-background text-primary"} ring-4 ring-primary/10` : step.completed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
                >
                  {step.completed ? "✓" : ""}
                </span>
                <div className="sm:mt-7 sm:px-2">
                  <strong
                    className={
                      index === currentLifecycleIndex
                        ? "text-sm text-primary"
                        : step.reached
                          ? "text-sm"
                          : "text-sm text-muted-foreground"
                    }
                  >
                    {step.label}
                  </strong>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">{step.dateText}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      {activity.isError && (
        <div className="mt-6">
          <SectionError error={activity.error} title="낙찰·계약 정보" onRetry={() => activity.refetch()} />
        </div>
      )}
      {sectionNavItems.length > 1 && <NoticeSectionNav items={sectionNavItems} />}
      {isOutcome ? (
        <>
          <section
            className="scroll-mt-[calc(var(--site-header-height,70px)+4.5rem)] pt-8"
            id="notice-result"
          >
            <NoticeResultsSection
              view={view}
              resultsRef={participationResultsRef}
              onPageChange={(page) => {
                setParticipationPagination({ noticeId, page });
                window.requestAnimationFrame(() => {
                  participationResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  participationResultsRef.current?.focus({ preventScroll: true });
                });
              }}
            />
          </section>
        </>
      ) : (
        <div className="mt-8 flex flex-col">
          {!isOutcome && !isStopped && !isSuperseded && (
            <>
              <EntityDetailSection
                className="order-2 scroll-mt-[calc(var(--site-header-height,70px)+4.5rem)]"
                divided
                sectionId="notice-analysis"
                title="공고 분석"
                description="과거 계약과 입찰을 기준으로 이번 공고를 비교했습니다."
              >
                {participationContext.isLoading ? (
                  <Skeleton className="mt-4 h-64 rounded-xl" />
                ) : participationContext.isError ? (
                  <div className="mt-4">
                    <SectionError
                      error={participationContext.error}
                      title="발주 분석"
                      onRetry={() => participationContext.refetch()}
                    />
                  </div>
                ) : (
                  <div className="mt-6 space-y-8">
                    <div>
                      <h3 className="text-base font-bold">이 기관은 어떤가요?</h3>
                      <div className="mt-3 rounded-xl bg-muted/35 px-4 py-3.5 sm:px-5">
                        <p className="max-w-4xl text-sm font-medium leading-6 text-foreground">
                          {organizationFieldInsight}
                        </p>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <article className="rounded-xl border bg-card p-5">
                          <div className="flex items-center gap-1">
                            <h4 className="text-sm font-semibold">기존 업체 계약금액</h4>
                            <MetricHelp label="기존 업체 계약금액 산정 기준">
                              기존 업체는 계약일 이전 3개 회계연도 동안 이 기관의 같은 분야에서 계약 이력이
                              확인되는 업체입니다. 화면의 비중은 기존 업체와 최근 거래가 없던 업체로 분류된
                              귀속 계약금액을 기준으로 합니다. 참고로 상위 5개 업체 비중은 이 기관{" "}
                              {peerConcentration?.current_value != null
                                ? `${(peerConcentration.current_value * 100).toFixed(1)}%`
                                : "-"}
                              , 같은 분야 다른 기관{" "}
                              {peerConcentration?.peer_median != null
                                ? `${(peerConcentration.peer_median * 100).toFixed(1)}%`
                                : "-"}
                              입니다.
                            </MetricHelp>
                          </div>
                          <strong className="mt-4 block text-2xl tabular-nums">
                            {incumbentAmountShare != null
                              ? `${(incumbentAmountShare * 100).toFixed(1)}%`
                              : "-"}
                          </strong>
                          <p className="mt-2 text-xs text-muted-foreground">
                            같은 분야 다른 기관{" "}
                            {peerIncumbentAmountShare != null
                              ? `${(peerIncumbentAmountShare * 100).toFixed(1)}%`
                              : "-"}
                          </p>
                        </article>
                        <article className="rounded-xl border bg-card p-5">
                          <div className="flex items-center gap-1">
                            <h4 className="text-sm font-semibold">입찰 참여</h4>
                            <MetricHelp label="입찰 참여 산정 기준">
                              참여업체 수가 확인되는 같은 기관·업무·공식 조달분야의 입찰을 기준으로 하며, 다른
                              기관 값은 같은 분야 기관별 지표의 중앙값입니다.
                            </MetricHelp>
                          </div>
                          <strong className="mt-4 block text-2xl tabular-nums">
                            보통 {participantMedian != null ? `${participantMedian.toFixed(0)}개 업체` : "-"}
                          </strong>
                          <p className="mt-2 text-xs text-muted-foreground">
                            같은 분야 다른 기관{" "}
                            {peerParticipantMedian != null ? `${peerParticipantMedian.toFixed(0)}개` : "-"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            최근 {peerCompetition?.current_bid_count ?? 0}건 중 {singleBidCount ?? 0}건은 1개
                            업체만 참여
                          </p>
                        </article>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-bold">이번 공고는 어떤가요?</h3>
                      <div className="mt-3 rounded-xl bg-muted/35 px-4 py-3.5 sm:px-5">
                        <p className="max-w-4xl text-sm font-medium leading-6 text-foreground">
                          {currentNoticeInsight}
                        </p>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <article className="rounded-xl border bg-card p-5">
                          <div className="flex items-center gap-1">
                            <h4 className="text-sm font-semibold">사업 규모</h4>
                            <MetricHelp label="사업 규모 산정 기준">
                              이 기관이 같은 업무·공식 조달분야에서 과거에 발주한 계약사업 금액과 비교합니다.
                            </MetricHelp>
                          </div>
                          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <strong className="text-2xl tabular-nums">
                              {scale?.current_project_amount != null
                                ? insightMoney(scale.current_project_amount)
                                : "-"}
                            </strong>
                            {scaleTopPercent != null && (
                              <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                                상위 {scaleTopPercent}%
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            과거 사업은 보통 {insightMoney(scale?.median_project_amount)} ·{" "}
                            {scale?.comparison_event_count ?? 0}건 기준
                          </p>
                        </article>
                        <article className="rounded-xl border bg-card p-5">
                          <div className="flex items-center gap-1">
                            <h4 className="text-sm font-semibold">비슷한 규모의 진입 사례</h4>
                            <MetricHelp label="진입 사례 산정 기준">
                              이번 사업금액의 50~200% 범위 계약 중, 계약 이전 3개 회계연도에 이 기관의 같은
                              분야 계약이 없던 업체의 사례입니다. 역사상 첫 계약을 의미하지는 않습니다.
                            </MetricHelp>
                          </div>
                          <strong className="mt-4 block text-2xl tabular-nums">
                            {entryCases?.eligible_case_count ?? 0}건
                          </strong>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {firstEntryCase
                              ? `${firstEntryCase.company_name} · ${insightMoney(firstEntryCase.attributed_contract_amount)} · ${firstEntryCase.first_contract_date?.slice(0, 7).replace("-", ".") ?? "-"}`
                              : `비슷한 규모의 비교 계약 ${entryCases?.similar_amount_contract_event_count ?? 0}건 기준`}
                          </p>
                        </article>
                      </div>
                    </div>
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  과거 데이터에 기반한 참고 정보이며 참여 여부를 판단하지 않습니다.
                </p>
              </EntityDetailSection>

              <EntityDetailSection
                className="order-4 scroll-mt-[calc(var(--site-header-height,70px)+4.5rem)]"
                divided
                sectionId="related-contracts"
                title="유사 계약 이력"
                description="같은 기관·업무·조달분야에서 최근 확인된 계약 5건입니다."
              >
                {relatedProjects.isLoading ? (
                  <Skeleton className="mt-4 h-64 rounded-xl" />
                ) : relatedProjects.isError ? (
                  <div className="mt-4">
                    <SectionError
                      error={relatedProjects.error}
                      title="유사 계약 이력"
                      onRetry={() => relatedProjects.refetch()}
                    />
                  </div>
                ) : (
                  <>
                    <div className="mt-4 hidden overflow-hidden rounded-xl border sm:block">
                      <div className="grid grid-cols-[minmax(0,1fr)_7rem_8rem_12rem] gap-3 bg-muted/50 px-4 py-3 text-xs font-semibold text-muted-foreground">
                        <span>사업</span>
                        <span>최초 계약일</span>
                        <span className="text-right">총계약금액</span>
                        <span>계약업체</span>
                      </div>
                      {relatedProjectItems.map((item) => {
                        const primaryCompanyNumber =
                          item.company_number ?? item.contractors?.[0]?.company_number;
                        const href = item.bid_notice_id
                          ? `/notices/${encodeURIComponent(item.bid_notice_id)}`
                          : notice.organization_code && primaryCompanyNumber
                            ? `/organizations/${encodeURIComponent(notice.organization_code)}?tab=companies&company=${encodeURIComponent(primaryCompanyNumber)}&contractEvent=${encodeURIComponent(item.contract_event_id ?? "")}`
                            : undefined;
                        const content = (
                          <>
                            <span className="min-w-0">
                              <strong className="line-clamp-2">{item.notice_name}</strong>
                              {relatedProjectTags(item) && (
                                <small className="mt-1 block text-muted-foreground">
                                  {relatedProjectTags(item)}
                                </small>
                              )}
                              {contractVersionLabel(item) && (
                                <small className="mt-1 block text-muted-foreground">
                                  {contractVersionLabel(item)}
                                </small>
                              )}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {date(item.first_contract_date ?? item.contract_date)}
                            </span>
                            <strong className="text-right tabular-nums">
                              {insightMoney(item.contract_amount)}
                            </strong>
                            <span className="line-clamp-2">{contractorNames(item)}</span>
                          </>
                        );
                        const key =
                          item.contract_event_id ||
                          item.unified_contract_number ||
                          `${item.notice_name}:${item.contract_date ?? ""}`;
                        return href ? (
                          <Link
                            className="grid grid-cols-[minmax(0,1fr)_7rem_8rem_12rem] items-center gap-3 border-t px-4 py-3 text-sm hover:bg-muted/40"
                            key={key}
                            to={href}
                          >
                            {content}
                          </Link>
                        ) : (
                          <div
                            className="grid grid-cols-[minmax(0,1fr)_7rem_8rem_12rem] items-center gap-3 border-t px-4 py-3 text-sm"
                            key={key}
                          >
                            {content}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 divide-y overflow-hidden rounded-xl border sm:hidden">
                      {relatedProjectItems.map((item) => {
                        const primaryCompanyNumber =
                          item.company_number ?? item.contractors?.[0]?.company_number;
                        const href = item.bid_notice_id
                          ? `/notices/${encodeURIComponent(item.bid_notice_id)}`
                          : notice.organization_code && primaryCompanyNumber
                            ? `/organizations/${encodeURIComponent(notice.organization_code)}?tab=companies&company=${encodeURIComponent(primaryCompanyNumber)}`
                            : undefined;
                        const card = (
                          <>
                            <strong className="line-clamp-2 text-sm">{item.notice_name}</strong>
                            {relatedProjectTags(item) && (
                              <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
                                {relatedProjectTags(item)}
                              </p>
                            )}
                            {contractVersionLabel(item) && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {contractVersionLabel(item)}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>최초 {date(item.first_contract_date ?? item.contract_date)}</span>
                              <span>{insightMoney(item.contract_amount)}</span>
                              <span>{contractorNames(item)}</span>
                            </div>
                          </>
                        );
                        const key =
                          item.contract_event_id ||
                          item.unified_contract_number ||
                          `${item.notice_name}:${item.contract_date ?? ""}`;
                        return href ? (
                          <Link className="block p-4 hover:bg-muted/40" key={key} to={href}>
                            {card}
                          </Link>
                        ) : (
                          <div className="p-4" key={key}>
                            {card}
                          </div>
                        );
                      })}
                    </div>
                    {!relatedProjectItems.length && (
                      <div className="mt-4 rounded-xl border p-5">
                        <p className="text-sm text-muted-foreground">확인된 유사 계약이 없습니다.</p>
                      </div>
                    )}
                    {relatedHistoryHref && (
                      <div className="mt-4 flex justify-end">
                        <Button asChild size="sm" variant="outline">
                          <Link to={relatedHistoryHref}>기관 공고·계약 전체 보기</Link>
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </EntityDetailSection>

              <EntityDetailSection
                className="order-3"
                divided
                title={
                  <span className="flex items-center gap-1.5">
                    주목할 업체
                    <MetricHelp label="주목할 업체 선정 기준">
                      이번 공고와 관련해 확인할 이유가 있는 업체를 유사 규모 경험, 신규·재개 후 반복 거래,
                      반복 거래, 계약금액, 최근 계약 순으로 선정합니다. 예상 경쟁업체 순위는 아닙니다.
                    </MetricHelp>
                  </span>
                }
                description="이번 공고를 검토할 때 함께 확인할 동일 기관·분야의 계약업체입니다."
              >
                {!participationContext.isError && (
                  <div className="mt-4 hidden overflow-hidden rounded-xl border sm:block">
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)_10rem] gap-3 bg-muted/50 px-4 py-3 text-xs font-semibold text-muted-foreground">
                      <span>업체</span>
                      <span>주목할 이유</span>
                      <span className="text-right">계약 이력</span>
                    </div>
                    {attentionSuppliers.map((supplier) => (
                      <Link
                        className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)_10rem] items-center gap-3 border-t px-4 py-3 text-sm hover:bg-muted/40"
                        key={supplier.company_number}
                        to={
                          notice.organization_code
                            ? `/organizations/${encodeURIComponent(notice.organization_code)}?tab=companies&company=${encodeURIComponent(supplier.company_number)}`
                            : `/companies/${encodeURIComponent(supplier.company_number)}?name=${encodeURIComponent(supplier.company_name)}`
                        }
                      >
                        <span className="min-w-0">
                          <strong className="block truncate">{supplier.company_name}</strong>
                          <small className="mt-1 block text-muted-foreground">
                            최근 계약 {date(supplier.latest_contract_date)}
                          </small>
                        </span>
                        <span className="flex flex-wrap gap-1.5">
                          {supplierReasons(supplier).map((reason) => (
                            <Badge className="border-0" key={reason} variant="secondary">
                              {reason}
                            </Badge>
                          ))}
                        </span>
                        <strong className="text-right tabular-nums">
                          {supplier.contract_event_count ?? 0}건 ·{" "}
                          {money(supplier.attributed_contract_amount)}
                        </strong>
                      </Link>
                    ))}
                  </div>
                )}
                {!participationContext.isError && (
                  <div className="mt-4 divide-y overflow-hidden rounded-xl border sm:hidden">
                    {attentionSuppliers.map((supplier) => (
                      <Link
                        className="block p-4 hover:bg-muted/40"
                        key={supplier.company_number}
                        to={
                          notice.organization_code
                            ? `/organizations/${encodeURIComponent(notice.organization_code)}?tab=companies&company=${encodeURIComponent(supplier.company_number)}`
                            : `/companies/${encodeURIComponent(supplier.company_number)}?name=${encodeURIComponent(supplier.company_name)}`
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <strong className="min-w-0 truncate text-sm">{supplier.company_name}</strong>
                          <strong className="shrink-0 text-sm tabular-nums">
                            {money(supplier.attributed_contract_amount)}
                          </strong>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {supplierReasons(supplier).map((reason) => (
                            <Badge className="border-0" key={reason} variant="secondary">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                        <small className="mt-2 block text-muted-foreground">
                          계약 {supplier.contract_event_count ?? 0}건 · 최근{" "}
                          {date(supplier.latest_contract_date)}
                        </small>
                      </Link>
                    ))}
                  </div>
                )}
                {participationContext.isError ? (
                  <div className="mt-4">
                    <SectionError
                      error={participationContext.error}
                      title="주목할 업체"
                      onRetry={() => participationContext.refetch()}
                    />
                  </div>
                ) : !participationContext.isLoading && !attentionSuppliers.length ? (
                  <p className="mt-4 rounded-xl border p-5 text-sm text-muted-foreground">
                    확인된 주목할 업체가 없습니다.
                  </p>
                ) : null}
              </EntityDetailSection>
            </>
          )}

          {!isSuperseded && (
            <>
              <NoticeRequirementsSection
                regionApplicability={regionState}
                requirements={requirements}
                expression={
                  detail.data.requirement_set?.requirement_expression ?? notice.requirement_expression
                }
              />
              <NoticeCompanyAssessment noticeId={notice.id} requirements={requirements} />
              {detail.data.participation_findings?.length > 0 && (
                <ParticipationFindingsSection findings={detail.data.participation_findings} />
              )}
            </>
          )}
        </div>
      )}
    </EntityDetailLayout>
  );
}
