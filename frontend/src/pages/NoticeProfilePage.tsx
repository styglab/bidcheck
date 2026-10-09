import { ExternalLink, FileText } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EntityDetailContentSkeleton, EntityDetailLayout } from "@/components/layout/entity-detail-layout";
import { EntityDetailHeader } from "@/components/layout/entity-detail-header";
import { SectionError } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/common/list-pagination";
import { MetricHelp } from "@/components/common/metric-help";
import { formatCompactMoney, formatExactMoney } from "@/shared/format/money";
import {
  useBidRelationshipContext,
  useBidParticipationContext,
  useNotice,
  useNoticeActivity,
  useNoticeRelatedProjects,
  type RelatedProjectFilter,
} from "../features/notices/api";

const money = (value?: number) => (value == null ? "-" : formatCompactMoney(value));
const exactMoney = (value?: number) => (value == null ? "-" : formatExactMoney(value, "-"));
const insightMoney = (value?: number) =>
  value == null
    ? "-"
    : Math.abs(value) >= 100_000_000
      ? `${(value / 100_000_000).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\u00a0억원`
      : formatCompactMoney(value);
const workType = (value?: string) =>
  ({ service: "용역", goods: "물품", construction: "공사", foreign: "외자", other: "기타" })[value ?? ""] ??
  value ??
  "-";
const date = (value?: string) => (value ? value.slice(0, 10).replaceAll("-", ".") : "-");
const dateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(new Date(value))
        .replaceAll(". ", ".")
        .replace(/\.(\d{2}:\d{2})$/, " $1")
    : "-";
const percent = (value?: number | string) =>
  value == null || value === ""
    ? "미제공"
    : `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 3 })}%`;
export function NoticeProfilePage() {
  const { noticeId } = useParams();
  const [relatedFilters, setRelatedFilters] = useState<RelatedProjectFilter[]>([]);
  const [relatedPage, setRelatedPage] = useState(1);
  const detail = useNotice(noticeId);
  const activity = useNoticeActivity(noticeId);
  const relationshipContext = useBidRelationshipContext(noticeId);
  const participationContext = useBidParticipationContext(
    noticeId,
    detail.data?.notice?.is_latest_in_lineage !== false,
  );
  const relatedProjects = useNoticeRelatedProjects(
    noticeId,
    relatedFilters,
    relatedPage,
    detail.data?.notice?.is_latest_in_lineage !== false,
  );

  if (detail.isLoading)
    return (
      <EntityDetailLayout fallbackTo="/notices">
        <EntityDetailContentSkeleton />
      </EntityDetailLayout>
    );
  if (detail.isError || !detail.data)
    return (
      <EntityDetailLayout fallbackTo="/notices">
        <SectionError error={detail.error} title="공고 정보" onRetry={() => detail.refetch()} />
      </EntityDetailLayout>
    );

  const { notice, requirements, requirement_set: requirementSet } = detail.data;
  const awards = activity.data?.awards ?? [];
  const contracts = activity.data?.contracts ?? [];
  const participations = [...(activity.data?.participations ?? [])].sort(
    (left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER),
  );
  const participationSummary = activity.data?.participation_summary;
  const participationPartial = participationSummary?.data_completeness?.status === "partial";
  const hasContract = contracts.length > 0;
  const hasAward = awards.length > 0;
  const hasOpening = participations.length > 0;
  const isCancelled = ["cancelled", "failed", "failed_or_cancelled"].includes(notice.status);
  const isSuperseded = notice.lineage_status === "superseded" || notice.is_latest_in_lineage === false;
  const latestNoticeId = notice.latest_bid_notice_id ?? notice.superseded_by_bid_notice_id;
  const isOutcome = hasContract || hasAward;
  const status = isSuperseded
    ? "재공고로 대체됨"
    : hasContract
      ? "계약 완료"
      : hasAward
        ? "낙찰 완료"
        : isCancelled
          ? "유찰·취소"
          : hasOpening
            ? "개찰 완료"
            : notice.status === "scheduled"
              ? "입찰 예정"
              : notice.status === "active" || notice.status === "open"
                ? "입찰 진행 중"
                : notice.status === "closed"
                  ? "입찰 마감"
                  : "상태 미상";
  const isBidding = notice.status === "active" || notice.status === "open";
  const projectAmount = notice.allocated_budget ?? notice.estimated_price;
  const region = requirements.filter((item) => ["region", "participation_region"].includes(item.type));
  const industries = requirements.filter(
    (item) => ["industry", "license", "industry_license"].includes(item.type) || item.industry_code,
  );
  const industrySummary = Array.from(
    new Map(industries.map((item) => [item.industry_code || item.title, item])).values(),
  );
  const summarizedRequirementIds = new Set([...region, ...industries].map((item) => item.id));
  const additionalRequirements = requirements.filter((item) => !summarizedRequirementIds.has(item.id));
  const regionState = requirementSet?.requirement_categories?.region;
  const relationshipByCompany = new Map(
    (relationshipContext.data?.participants ?? []).map((item) => [item.business_registration_number, item]),
  );
  const winner = awards[0];
  const winnerContext = winner?.company_number ? relationshipByCompany.get(winner.company_number) : undefined;
  const decision = participationContext.data;
  const currentLifecycleIndex = hasContract
    ? 4
    : hasAward
      ? 3
      : hasOpening || notice.status === "closed"
        ? 2
        : notice.status === "active" || notice.status === "open"
          ? 1
          : 0;
  const lifecycleSteps = [
    { label: "공고 게시", value: notice.published_at, detail: undefined, withTime: false },
    {
      label: isBidding ? "마감 예정" : "입찰 마감",
      value: notice.deadline_at,
      detail: undefined,
      withTime: true,
    },
    { label: "개찰", value: notice.opening_at, detail: undefined, withTime: true },
    { label: "낙찰", value: winner?.award_date ?? winner?.opening_at, detail: undefined, withTime: false },
    {
      label: "계약",
      value: contracts[0]?.concluded_date ?? contracts[0]?.contract_date,
      detail: undefined,
      withTime: false,
    },
  ].map((step, index) => ({
    ...step,
    reached: index <= currentLifecycleIndex,
    completed:
      index === 0 ||
      index < currentLifecycleIndex ||
      (index === 2 && (hasOpening || notice.status === "closed")) ||
      (index === 3 && hasAward) ||
      (index === 4 && hasContract),
  }));
  const scale = decision?.project_scale;
  const peer = decision?.peer_benchmark;
  const peerConcentration = peer?.supplier_concentration;
  const peerEntry = peer?.new_supplier_amount_share;
  const peerCompetition = peer?.competition;
  const entryCases = decision?.new_supplier_similar_amount_cases;
  const firstEntryCase = entryCases?.items?.[0];
  const attentionSuppliers = decision?.attention_suppliers ?? decision?.top_suppliers ?? [];
  const relatedFilterLabels: Array<[RelatedProjectFilter, string]> = [
    ["entry_or_reentering_supplier", "신규·재개"],
    ["repeat_supplier", "반복 거래"],
    ["similar_amount", "비슷한 규모"],
  ];
  const relatedProjectItems = Array.from(
    (relatedProjects.data?.items ?? [])
      .reduce((grouped, item, index) => {
        const eventKey =
          item.contract_event_id ||
          item.unified_contract_number ||
          item.bid_notice_id ||
          `${item.notice_name}:${item.contract_date ?? ""}:${index}`;
        const previous = grouped.get(eventKey);
        if (!previous) {
          grouped.set(eventKey, {
            ...item,
            contractors: item.contractors?.length
              ? [...item.contractors]
              : item.company_name
                ? [{ company_number: item.company_number, company_name: item.company_name }]
                : [],
          });
          return grouped;
        }
        const companies = [
          ...(previous.contractors ?? []),
          ...(item.contractors?.length
            ? item.contractors
            : item.company_name
              ? [{ company_number: item.company_number, company_name: item.company_name }]
              : []),
        ];
        previous.contractors = companies.filter(
          (company, companyIndex) =>
            companies.findIndex(
              (candidate) =>
                (company.company_number && candidate.company_number === company.company_number) ||
                (!company.company_number && candidate.company_name === company.company_name),
            ) === companyIndex,
        );
        return grouped;
      }, new Map<string, NonNullable<typeof relatedProjects.data>["items"][number]>())
      .values(),
  );
  const relationshipStatusLabel = (item: {
    relationship_status_summary?: string;
    contract_time_relationship_status?: string;
    supplier_entry_classification?: string;
    is_repeat_supplier?: boolean;
  }) => {
    if (item.relationship_status_summary === "entry_or_reentering") return "신규·재개";
    if (item.relationship_status_summary === "repeat") return "반복 거래";
    if (item.relationship_status_summary === "mixed") return "업체별 상태";
    if (item.contract_time_relationship_status === "entry_or_reentering") return "신규·재개";
    if (item.contract_time_relationship_status === "repeat") return "반복 거래";
    // Registry 2026.10.04.4 이전 응답에 대한 하위 호환 처리입니다.
    if (item.supplier_entry_classification === "entry_or_reentering") return "신규·재개";
    if (item.is_repeat_supplier) return "반복 거래";
    return undefined;
  };
  const relatedProjectTags = (item: {
    is_similar_amount?: boolean;
    relationship_status_summary?: string;
    contract_time_relationship_status?: string;
    supplier_entry_classification?: string;
    is_repeat_supplier?: boolean;
  }) =>
    [
      item.relationship_status_summary === "mixed" ? undefined : relationshipStatusLabel(item),
      item.is_similar_amount ? "비슷한 규모" : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
  const contractVersionLabel = (item: {
    contract_version_count?: number;
    latest_contract_version_date?: string;
  }) =>
    (item.contract_version_count ?? 0) > 1
      ? `차수계약 ${item.contract_version_count}건 · 최신 ${date(item.latest_contract_version_date)}`
      : undefined;
  const contractorStatusLabel = (status?: string) =>
    status === "entry_or_reentering" ? "신규·재개" : status === "repeat" ? "반복 거래" : undefined;
  const contractorNames = (item: NonNullable<typeof relatedProjects.data>["items"][number]) =>
    item.contractors
      ?.map((company) => {
        const statusLabel =
          item.relationship_status_summary === "mixed"
            ? contractorStatusLabel(company.contract_time_relationship_status)
            : undefined;
        return `${company.company_name ?? "업체명 미확인"}${statusLabel ? ` (${statusLabel})` : ""}`;
      })
      .join(", ") ||
    item.company_name ||
    "-";
  const scaleTopPercent =
    scale?.percentile != null ? Math.max(1, Math.round((1 - scale.percentile) * 100)) : undefined;
  const participantMedian = peerCompetition?.participant_count_median?.current_value;
  const peerParticipantMedian = peerCompetition?.participant_count_median?.peer_median;
  const entryAmountShare = peerEntry?.current_value;
  const peerEntryAmountShare = peerEntry?.peer_median;
  const incumbentAmountShare =
    entryAmountShare != null && entryAmountShare >= 0 && entryAmountShare <= 1
      ? 1 - entryAmountShare
      : undefined;
  const peerIncumbentAmountShare =
    peerEntryAmountShare != null && peerEntryAmountShare >= 0 && peerEntryAmountShare <= 1
      ? 1 - peerEntryAmountShare
      : undefined;
  const largeProject = scaleTopPercent != null && scaleTopPercent <= 25;
  const lowerEntryShare =
    entryAmountShare != null && peerEntryAmountShare != null && entryAmountShare < peerEntryAmountShare;
  const higherConcentration =
    peerConcentration?.current_value != null &&
    peerConcentration?.peer_median != null &&
    peerConcentration.current_value > peerConcentration.peer_median;
  const hasSimilarEntryCase = (entryCases?.eligible_case_count ?? 0) > 0;
  const hasSimilarComparison = (entryCases?.similar_amount_contract_event_count ?? 0) > 0;
  const singleBidCount =
    peerCompetition?.single_participant_share?.current_value != null
      ? Math.round(
          peerCompetition.single_participant_share.current_value * (peerCompetition.current_bid_count ?? 0),
        )
      : undefined;
  const organizationFieldInsight = lowerEntryShare
    ? `기존에 거래하던 업체의 계약 비중이 높고${singleBidCount != null ? ", 입찰에 참여하는 업체도 적은 편입니다." : " 있습니다."}`
    : higherConcentration
      ? "일부 업체에 계약금액이 집중되는 편입니다."
      : singleBidCount != null
        ? "비교 가능한 과거 입찰에서 한 업체만 참여한 사례가 확인됩니다."
        : "비교할 수 있는 과거 자료가 충분하지 않습니다.";
  const currentNoticeInsight =
    largeProject && hasSimilarEntryCase
      ? "평소보다 큰 사업이지만, 비슷한 규모의 신규·재개 계약 사례도 있습니다."
      : largeProject
        ? "과거에 발주한 사업보다 규모가 큰 편입니다."
        : hasSimilarEntryCase
          ? "비슷한 규모의 신규·재개 계약 사례가 있습니다."
          : hasSimilarComparison
            ? "비슷한 규모의 신규·재개 계약 사례는 확인되지 않습니다."
            : "이번 공고와 비교할 수 있는 과거 계약 사례가 충분하지 않습니다.";
  const supplierReasons = (supplier: {
    contract_event_count?: number;
    latest_contract_date?: string;
    attention_reasons?: string[];
    display_attention_reasons?: string[];
  }) => {
    const labels: Record<string, string> = {
      new_supplier_contract_case: "신규·재개 계약",
      entry_or_reentering_contract_case: "신규·재개 계약",
      entry_or_reentering_contract: "신규·재개 계약",
      entry_then_repeat: "신규·재개 후 반복 거래",
      contract_amount_leader: "계약금액 상위",
      similar_amount_experience: "비슷한 규모의 계약 경험",
      repeated_contracts: "동일 기관·분야 반복 거래",
      large_contract_history: "동일 분야 상위 규모 계약",
      large_contract_experience: "동일 분야 상위 규모 계약",
      field_upper_quartile_experience: "동일 분야 상위 규모 계약",
      recent_contract: "최근 동일 분야 계약",
      field_specialist: "다른 기관의 동일 분야 계약 다수",
      organization_specialist: "이 기관 중심 계약 이력",
    };
    const source = supplier.display_attention_reasons?.length
      ? supplier.display_attention_reasons
      : (supplier.attention_reasons ?? []);
    const reasons = [...new Set(source.map((item) => labels[item] ?? item).filter(Boolean))].slice(0, 2);
    if (reasons.length) return reasons;
    return [
      (supplier.contract_event_count ?? 0) >= 2 ? "동일 기관·분야 반복 거래" : "동일 기관·분야 계약 이력",
    ];
  };

  const resultContent = (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">낙찰 정보</h2>
            <p className="mt-1 text-sm text-muted-foreground">개찰 참여업체의 순위와 낙찰 결과입니다.</p>
          </div>
          <strong className="text-sm">
            {participationSummary?.source_participant_count != null
              ? `참여 ${participationSummary.source_participant_count.toLocaleString("ko-KR")}개 · 확인 ${participations.length.toLocaleString("ko-KR")}개`
              : `확인된 업체 ${participations.length.toLocaleString("ko-KR")}개`}
          </strong>
        </div>
        {participations.length > 0 ? (
          <>
            <div className="mt-4 hidden overflow-hidden rounded-xl border sm:block">
              <div className="grid grid-cols-[4rem_minmax(0,1fr)_9rem_7rem_6rem] gap-3 bg-muted/50 px-4 py-3 text-xs font-semibold text-muted-foreground">
                <span>순위</span>
                <span>업체</span>
                <span className="text-right">투찰금액</span>
                <span className="text-right">투찰률</span>
                <span className="text-center">결과</span>
              </div>
              {participations.map((item) => {
                const itemAward = awards.find((award) => award.company_number === item.company_number);
                const resultLabel = itemAward ? "낙찰" : hasAward ? "미낙찰" : "확인 중";
                return (
                  <div
                    className={`grid grid-cols-[4rem_minmax(0,1fr)_9rem_7rem_6rem] items-center gap-3 border-t px-4 py-3 text-sm ${item.rank === 1 ? "bg-blue-50/60" : ""}`}
                    key={item.id}
                  >
                    <strong className={item.rank === 1 ? "text-blue-700" : "text-muted-foreground"}>
                      {item.rank != null ? `${item.rank}위` : "-"}
                    </strong>
                    {item.company_number ? (
                      <Link
                        className="truncate font-semibold hover:underline"
                        to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name ?? "업체")}`}
                      >
                        {item.company_name ?? "업체명 미확인"}
                      </Link>
                    ) : (
                      <strong className="truncate">{item.company_name ?? "업체명 미확인"}</strong>
                    )}
                    <span className="text-right tabular-nums">{exactMoney(item.bid_amount)}</span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {percent(item.bid_rate)}
                    </span>
                    <span className="text-center">
                      <Badge
                        className={itemAward ? "border-0 bg-blue-100 text-blue-800 hover:bg-blue-100" : ""}
                        variant={itemAward ? "default" : "secondary"}
                      >
                        {resultLabel}
                      </Badge>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 divide-y overflow-hidden rounded-xl border sm:hidden">
              {participations.map((item) => {
                const itemAward = awards.find((award) => award.company_number === item.company_number);
                const resultLabel = itemAward ? "낙찰" : hasAward ? "미낙찰" : "확인 중";
                return (
                  <article className={item.rank === 1 ? "bg-blue-50/60 p-4" : "p-4"} key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <strong
                          className={
                            item.rank === 1 ? "shrink-0 text-blue-700" : "shrink-0 text-muted-foreground"
                          }
                        >
                          {item.rank != null ? `${item.rank}위` : "-"}
                        </strong>
                        {item.company_number ? (
                          <Link
                            className="font-semibold hover:underline"
                            to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name ?? "업체")}`}
                          >
                            {item.company_name ?? "업체명 미확인"}
                          </Link>
                        ) : (
                          <strong>{item.company_name ?? "업체명 미확인"}</strong>
                        )}
                      </div>
                      <Badge
                        className={itemAward ? "border-0 bg-blue-100 text-blue-800 hover:bg-blue-100" : ""}
                        variant={itemAward ? "default" : "secondary"}
                      >
                        {resultLabel}
                      </Badge>
                    </div>
                    <p className="mt-2 pl-9 text-xs text-muted-foreground">
                      투찰 {exactMoney(item.bid_amount)} · 투찰률 {percent(item.bid_rate)}
                    </p>
                  </article>
                );
              })}
            </div>
            {participationPartial ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                원천 참여업체 {participationSummary?.source_participant_count.toLocaleString("ko-KR")}개 중{" "}
                {participationSummary?.returned_participant_count.toLocaleString("ko-KR")}개가 확인되었습니다.
                누락 업체 정보는 재수집 중입니다.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                현재 데이터에서 확인 가능한 업체를 표시합니다.
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">
            확인된 참여 업체 명단이 없습니다.
          </p>
        )}
      </section>
      {hasContract && (
        <section className="border-t pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">계약 정보</h2>
              <p className="mt-1 text-sm text-muted-foreground">최종 계약업체와 계약 결과입니다.</p>
            </div>
            {contracts[0]?.detail_url && (
              <Button asChild size="sm" variant="outline">
                <a href={contracts[0].detail_url} target="_blank" rel="noreferrer">
                  계약 원문 <ExternalLink className="ml-1 size-3.5" />
                </a>
              </Button>
            )}
          </div>
          <div className="mt-4 hidden overflow-hidden rounded-xl border sm:block">
            <div className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr_1.2fr] gap-3 bg-muted/50 px-4 py-3 text-xs font-semibold text-muted-foreground">
              <span>계약업체</span>
              <span className="text-right">계약금액</span>
              <span className="text-right">계약일</span>
              <span className="text-right">계약번호</span>
            </div>
            {contracts.map((contract) => (
              <div
                className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr_1.2fr] items-center gap-3 border-t px-4 py-4 text-sm"
                key={contract.id}
              >
                <strong className="truncate">
                  {contract.lead_contractor?.company_name ?? winner?.company_name ?? "업체명 미확인"}
                  {(contract.contractor_count ?? 0) > 1
                    ? ` 외 ${(contract.contractor_count ?? 1) - 1}개 업체`
                    : ""}
                </strong>
                <strong className="text-right tabular-nums">{exactMoney(contract.amount)}</strong>
                <span className="text-right tabular-nums text-muted-foreground">
                  {date(contract.concluded_date ?? contract.contract_date)}
                </span>
                <span className="truncate text-right font-mono text-xs text-muted-foreground">
                  {contract.contract_number ?? contract.unified_contract_number ?? "-"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 divide-y overflow-hidden rounded-xl border sm:hidden">
            {contracts.map((contract) => (
              <article className="p-4" key={contract.id}>
                <strong className="block">
                  {contract.lead_contractor?.company_name ?? winner?.company_name ?? "업체명 미확인"}
                  {(contract.contractor_count ?? 0) > 1
                    ? ` 외 ${(contract.contractor_count ?? 1) - 1}개 업체`
                    : ""}
                </strong>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">계약금액</dt>
                    <dd className="font-semibold tabular-nums">{exactMoney(contract.amount)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">계약일</dt>
                    <dd className="tabular-nums">
                      {date(contract.concluded_date ?? contract.contract_date)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">계약번호</dt>
                    <dd className="font-mono text-xs">
                      {contract.contract_number ?? contract.unified_contract_number ?? "-"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
      {!hasAward && !hasContract && (
        <p className="rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">
          확인된 낙찰·계약 결과가 없습니다.
        </p>
      )}
      {winner?.company_number &&
        (winnerContext?.prior_organization_relationship?.contract_event_count ?? 0) > 0 && (
          <section className="rounded-xl border bg-muted/20 p-5">
            <p className="text-xs font-semibold text-blue-700">이전 계약 이력</p>
            <p className="mt-2 font-bold">
              {notice.organization} ↔ {winner.company_name}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              이 공고 이전 계약 {winnerContext?.prior_organization_relationship?.contract_event_count}건 ·
              최근 계약 {date(winnerContext?.prior_organization_relationship?.latest_contract_date)}
            </p>
          </section>
        )}
    </div>
  );

  return (
    <EntityDetailLayout fallbackTo="/notices">
      <EntityDetailHeader
        actions={
          notice.detail_url ? (
            <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground">
              <a href={notice.detail_url} target="_blank" rel="noreferrer">
                나라장터 원문 <ExternalLink className="ml-1 size-3.5" />
              </a>
            </Button>
          ) : undefined
        }
        entityLabel="공고"
        icon={<FileText className="size-5" />}
        meta={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge
              className={`h-5 border-0 px-2 text-[11px] font-semibold leading-none ${isSuperseded ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : isBidding ? "bg-blue-100 text-blue-800 hover:bg-blue-100" : isCancelled ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-muted text-foreground hover:bg-muted"}`}
            >
              {status}
            </Badge>
            {notice.is_re_notice && (
              <Badge className="h-5 border-0 bg-blue-50 px-2 text-[11px] font-semibold text-blue-800 hover:bg-blue-50">
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
                className="text-xs font-medium text-blue-800 hover:underline"
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
              className="text-xs font-medium text-blue-800 hover:underline"
              to={`/notices/${encodeURIComponent(notice.previous_bid_notice_id)}`}
            >
              이전 공고 이력
            </Link>
          )}
          {(notice.lineage_count ?? 1) > 1 && (
            <span className="text-xs">공고 이력 {notice.lineage_count}건</span>
          )}
        </div>
      </EntityDetailHeader>
      <dl className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ["사업금액", exactMoney(projectAmount)],
          ["경쟁방식", notice.contract_method ?? notice.bid_method ?? "-"],
          ["게시일", date(notice.published_at)],
          ["마감일", date(notice.deadline_at)],
        ].map(([label, value]) => (
          <div className="rounded-xl bg-muted/50 p-4" key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-6 border-y py-5" aria-label="공고 진행 상태">
        {isSuperseded ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong className="text-sm text-amber-900">이 공고는 재공고로 대체되었습니다.</strong>
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
        ) : isCancelled ? (
          <div className="flex items-center gap-3">
            <Badge className="border-0 bg-red-100 text-red-700 hover:bg-red-100">유찰·취소</Badge>
            <p className="text-sm text-muted-foreground">자세한 사유는 나라장터 원문에서 확인해 주세요.</p>
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
                    className={`absolute left-[0.4375rem] top-4 h-[calc(100%-0.25rem)] w-0.5 sm:left-1/2 sm:top-2 sm:h-0.5 sm:w-full ${index < currentLifecycleIndex ? "bg-blue-700" : "bg-border"}`}
                  />
                )}
                <span
                  className={`absolute left-0 top-0 z-10 flex size-4 items-center justify-center rounded-full border-2 text-[9px] font-bold sm:left-1/2 sm:-translate-x-1/2 ${index === currentLifecycleIndex ? `border-blue-700 ${step.completed ? "bg-blue-700 text-white" : "bg-white text-blue-700"} ring-4 ring-blue-100` : step.completed ? "border-blue-700 bg-blue-700 text-white" : "border-border bg-background text-muted-foreground"}`}
                >
                  {step.completed ? "✓" : ""}
                </span>
                <div className="sm:mt-7 sm:px-2">
                  <strong
                    className={
                      index === currentLifecycleIndex
                        ? "text-sm text-blue-800"
                        : step.reached
                          ? "text-sm"
                          : "text-sm text-muted-foreground"
                    }
                  >
                    {step.label}
                  </strong>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {step.withTime ? dateTime(step.value) : date(step.value)}
                  </p>
                  {step.detail && <p className="mt-1 line-clamp-2 text-xs font-medium">{step.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      {isOutcome ? (
        <section className="mt-8">{resultContent}</section>
      ) : (
        <div className="mt-8 flex flex-col">
          {!isOutcome && !isCancelled && !isSuperseded && (
            <>
              <section className="order-2 mt-10 border-t pt-10">
                <h2 className="text-xl font-bold">공고 분석</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  과거 계약과 입찰을 기준으로 이번 공고를 비교했습니다.
                </p>
                {participationContext.isLoading ? (
                  <Skeleton className="mt-4 h-64 rounded-xl" />
                ) : (
                  <div className="mt-6 space-y-8">
                    <div>
                      <h3 className="text-base font-bold">이 기관은 어떤가요?</h3>
                      <div className="mt-3 border-l-2 border-blue-700 py-1 pl-4">
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
                      <div className="mt-3 border-l-2 border-blue-700 py-1 pl-4">
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
                              <span className="text-sm font-semibold text-blue-800">
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
              </section>

              <section className="order-4 mt-10 scroll-mt-24 border-t pt-10" id="related-contracts">
                <h2 className="text-xl font-bold">동일 분야 계약 이력</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  동일 기관·업무·공식 조달분야에서 확인된 과거 계약입니다.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    className="rounded-full"
                    onClick={() => {
                      setRelatedFilters([]);
                      setRelatedPage(1);
                    }}
                    size="sm"
                    variant={relatedFilters.length === 0 ? "default" : "outline"}
                  >
                    전체 {relatedProjects.data?.filter_counts?.all ?? ""}
                  </Button>
                  {relatedFilterLabels.map(([value, label]) => {
                    const selected = relatedFilters.includes(value);
                    return (
                      <Button
                        className="rounded-full"
                        key={value}
                        onClick={() => {
                          setRelatedFilters((current) =>
                            selected ? current.filter((item) => item !== value) : [...current, value],
                          );
                          setRelatedPage(1);
                        }}
                        size="sm"
                        variant={selected ? "default" : "outline"}
                      >
                        {label}{" "}
                        {relatedProjects.data?.filter_counts?.[value] != null
                          ? relatedProjects.data.filter_counts[value]
                          : ""}
                      </Button>
                    );
                  })}
                </div>
                {relatedFilters.length > 1 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    선택한 조건을 모두 만족하는 계약{" "}
                    {relatedProjects.data?.applied_filter?.total_items ??
                      relatedProjects.data?.pagination.total_items ??
                      0}
                    건
                  </p>
                )}
                {relatedProjects.isLoading ? (
                  <Skeleton className="mt-4 h-64 rounded-xl" />
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
                              <p className="mt-1 text-xs text-blue-800">{relatedProjectTags(item)}</p>
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
                        <p className="text-sm text-muted-foreground">
                          {relatedFilters.includes("similar_amount") &&
                          relatedFilters.includes("entry_or_reentering_supplier")
                            ? "비슷한 규모의 신규·재개 계약이 없습니다."
                            : "조건에 맞는 동일 분야 계약이 없습니다."}
                        </p>
                        {relatedFilters.length > 0 && (
                          <Button
                            className="mt-3"
                            onClick={() => {
                              setRelatedFilters([]);
                              setRelatedPage(1);
                            }}
                            size="sm"
                            variant="outline"
                          >
                            조건 초기화
                          </Button>
                        )}
                      </div>
                    )}
                    <ListPagination
                      label="동일 분야 계약 페이지"
                      loading={relatedProjects.isFetching}
                      page={relatedProjects.data?.pagination.page ?? relatedPage}
                      totalPages={relatedProjects.data?.pagination.total_pages}
                      onChange={setRelatedPage}
                    />
                  </>
                )}
              </section>

              <section className="order-3 mt-10 border-t pt-10">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xl font-bold">주목할 업체</h2>
                  <MetricHelp label="주목할 업체 선정 기준">
                    이번 공고와 관련해 확인할 이유가 있는 업체를 유사 규모 경험, 신규·재개 후 반복 거래, 반복
                    거래, 계약금액, 최근 계약 순으로 선정합니다. 예상 경쟁업체 순위는 아닙니다.
                  </MetricHelp>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  이번 공고를 검토할 때 함께 확인할 동일 기관·분야의 계약업체입니다.
                </p>
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
                        {supplier.contract_event_count ?? 0}건 · {money(supplier.attributed_contract_amount)}
                      </strong>
                    </Link>
                  ))}
                </div>
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
                {!participationContext.isLoading && !attentionSuppliers.length && (
                  <p className="mt-4 rounded-xl border p-5 text-sm text-muted-foreground">
                    확인된 주목할 업체가 없습니다.
                  </p>
                )}
              </section>
            </>
          )}

          {!isSuperseded && (
            <section className="order-1">
              <h2 className="text-xl font-bold">참가 조건</h2>
              <p className="mt-1 text-sm text-muted-foreground">공고에서 확인된 입찰 참가자격입니다.</p>
              <div className="mt-5 overflow-hidden rounded-xl border">
                <div
                  className={`flex flex-wrap items-center gap-2 p-4 ${additionalRequirements.length ? "border-b" : ""}`}
                >
                  <span className="text-xs font-semibold text-muted-foreground">지역</span>
                  {region.length ? (
                    region.map((item) => (
                      <Badge className="border-0" variant="secondary" key={item.id}>
                        {item.title}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm">
                      {regionState?.applicability === "not_applicable" ||
                      regionState?.completeness === "complete"
                        ? "제한 없음"
                        : "확인 필요"}
                    </span>
                  )}
                  <span className="ml-3 text-xs font-semibold text-muted-foreground">업종·면허</span>
                  {industrySummary.length ? (
                    industrySummary.map((item) => (
                      <Badge
                        className="border-0 bg-blue-50 text-blue-800"
                        key={item.industry_code || item.id}
                      >
                        {item.title}
                        {item.industry_code ? ` ${item.industry_code}` : ""}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">확인된 조건 없음</span>
                  )}
                </div>
                {additionalRequirements.length > 0 && (
                  <div className="divide-y">
                    {additionalRequirements.slice(0, 10).map((item) => (
                      <div
                        className="grid gap-2 p-4 text-sm sm:grid-cols-[minmax(10rem,14rem)_auto_minmax(0,1fr)]"
                        key={item.id}
                      >
                        <strong>{item.title || "추가 조건"}</strong>
                        <Badge className="h-fit w-fit" variant={item.mandatory ? "default" : "secondary"}>
                          {item.mandatory ? "필수" : "확인"}
                        </Badge>
                        <p className="leading-6 text-muted-foreground">
                          {item.proposition_text ??
                            item.evidence_summary ??
                            item.original_text ??
                            "세부 조건은 공고 원문에서 확인해야 합니다."}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </EntityDetailLayout>
  );
}
