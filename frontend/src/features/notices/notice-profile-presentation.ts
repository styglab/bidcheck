import { formatKoreanDate } from "@/shared/format/date";
import { procurementWorkTypeLabels } from "@/shared/procurement/presentation";
import { type NoticeSectionNavItem } from "@/features/notices/NoticeSectionNav";
import {
  selectPrimaryAward,
  sortAwardsByLatest,
  sortContractsByLatest,
} from "@/features/notices/procurement-result-presentation";
import { formatCompactMoney, formatExactMoney } from "@/shared/format/money";
import {
  useBidParticipationContext,
  useNotice,
  useNoticeActivity,
  useNoticeRelatedProjects,
} from "@/features/notices/api";

export const money = (value?: number) => (value == null ? "-" : formatCompactMoney(value));
export const exactMoney = (value?: number) => (value == null ? "-" : formatExactMoney(value, "-"));
export const insightMoney = (value?: number) =>
  value == null
    ? "-"
    : Math.abs(value) >= 100_000_000
      ? `${(value / 100_000_000).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\u00a0억원`
      : formatCompactMoney(value);
export const workType = (value?: string) => procurementWorkTypeLabels[value ?? ""] ?? value ?? "-";
export const date = (value?: string) => (value ? value.slice(0, 10).replaceAll("-", ".") : "-");
export const dateTime = (value?: string) =>
  formatKoreanDate(
    value,
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
    "-",
  )
    .replaceAll(". ", ".")
    .replace(/\.(\d{2}:\d{2})$/, " $1");
export const percent = (value?: number | string) =>
  value == null || value === ""
    ? "미제공"
    : `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 3 })}%`;
export const remainingDays = (value?: string) => {
  if (!value) return "-";
  const deadline = new Date(value).getTime();
  if (!Number.isFinite(deadline)) return "-";
  const days = Math.ceil((deadline - Date.now()) / 86_400_000);
  if (days < 0) return "마감";
  if (days === 0) return "D-Day";
  return `D-${days}`;
};
export const PARTICIPATION_PAGE_SIZE = 20;

export function noticeProfilePresentation(
  detailData: NonNullable<ReturnType<typeof useNotice>["data"]>,
  activityData: ReturnType<typeof useNoticeActivity>["data"],
  participationData: ReturnType<typeof useBidParticipationContext>["data"],
  relatedData: ReturnType<typeof useNoticeRelatedProjects>["data"],
  participationPage: number,
) {
  const { notice, requirements, requirement_set: requirementSet } = detailData;
  const awards = sortAwardsByLatest(activityData?.awards ?? []);
  const contracts = sortContractsByLatest(activityData?.contracts ?? []);
  const participations = [...(activityData?.participations ?? [])].sort(
    (left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER),
  );
  const participationSummary = activityData?.participation_summary;
  const participationTotalPages = Math.ceil(participations.length / PARTICIPATION_PAGE_SIZE);
  const safeParticipationPage = Math.min(participationPage, Math.max(1, participationTotalPages));
  const visibleParticipations = participations.slice(
    (safeParticipationPage - 1) * PARTICIPATION_PAGE_SIZE,
    safeParticipationPage * PARTICIPATION_PAGE_SIZE,
  );
  const participationPartial =
    activityData?.truncated || participationSummary?.data_completeness?.status === "partial";
  const hasContract = contracts.length > 0;
  const hasAward = awards.length > 0;
  const hasOpening = participations.length > 0;
  const isFailed = notice.status === "failed";
  const isCancelled = notice.status === "cancelled";
  const isStopped = isFailed || isCancelled;
  const isSuperseded = notice.lineage_status === "superseded" || notice.is_latest_in_lineage === false;
  const latestNoticeId = notice.latest_bid_notice_id ?? notice.superseded_by_bid_notice_id;
  const isOutcome = hasContract || hasAward || notice.status === "awarded" || notice.status === "contracted";
  const status = isSuperseded
    ? "재공고로 대체됨"
    : hasContract
      ? "계약 완료"
      : notice.status === "contracted"
        ? "계약 완료"
        : hasAward
          ? "낙찰 완료"
          : notice.status === "awarded"
            ? "낙찰 완료"
            : isFailed
              ? "유찰"
              : isCancelled
                ? "취소"
                : hasOpening
                  ? "개찰 완료"
                  : notice.status === "scheduled"
                    ? "입찰 예정"
                    : notice.status === "active" || notice.status === "open"
                      ? "접수 중"
                      : notice.status === "closed"
                        ? "입찰 마감"
                        : "상태 미상";
  const isBidding = notice.status === "active" || notice.status === "open";
  const projectAmount = notice.allocated_budget ?? notice.estimated_price;
  const regionState = requirementSet?.requirement_categories?.region;
  const relationshipByCompany = new Map(
    (activityData?.relationship_context?.participants ?? []).map((item) => [
      item.business_registration_number,
      item,
    ]),
  );
  const winner = selectPrimaryAward(awards, participations);
  const winnerContext = winner?.company_number ? relationshipByCompany.get(winner.company_number) : undefined;
  const decision = participationData;
  const currentLifecycleIndex =
    hasContract || notice.status === "contracted"
      ? 4
      : hasAward || notice.status === "awarded"
        ? 3
        : hasOpening || notice.status === "closed"
          ? 2
          : notice.status === "active" || notice.status === "open"
            ? 1
            : 0;
  const lifecycleSteps = [
    {
      label: "공고 게시",
      value: notice.published_at,
      dateText: date(notice.published_at),
    },
    {
      label: "입찰 접수",
      value: notice.bid_begin_at ?? notice.deadline_at,
      dateText:
        notice.bid_begin_at && notice.deadline_at
          ? `${dateTime(notice.bid_begin_at)}–${dateTime(notice.deadline_at)}`
          : notice.bid_begin_at
            ? `${dateTime(notice.bid_begin_at)} 시작`
            : `${dateTime(notice.deadline_at)} 마감`,
    },
    {
      label: "개찰",
      value: notice.opening_at,
      dateText: dateTime(notice.opening_at),
    },
    {
      label: "낙찰",
      value: winner?.award_date ?? winner?.opening_at,
      dateText: date(winner?.award_date ?? winner?.opening_at),
    },
    {
      label: "계약",
      value: contracts[0]?.concluded_date ?? contracts[0]?.contract_date,
      dateText: date(contracts[0]?.concluded_date ?? contracts[0]?.contract_date),
    },
  ].map((step, index) => ({
    ...step,
    reached: index <= currentLifecycleIndex,
    completed:
      index === 0 ||
      index < currentLifecycleIndex ||
      (index === 2 && (hasOpening || notice.status === "closed")) ||
      (index === 3 && (hasAward || notice.status === "awarded" || notice.status === "contracted")) ||
      (index === 4 && (hasContract || notice.status === "contracted")),
  }));
  const sectionNavItems: NoticeSectionNavItem[] = isOutcome
    ? [{ id: "notice-result", label: "낙찰·계약 결과" }]
    : isStopped
      ? []
      : isSuperseded
        ? []
        : [
            { id: "participation-requirements", label: "참가 조건" },
            { id: "notice-analysis", label: "발주 분석" },
            { id: "related-contracts", label: "관련 이력" },
          ];
  const scale = decision?.project_scale;
  const peer = decision?.peer_benchmark;
  const peerConcentration = peer?.supplier_concentration;
  const peerEntry = peer?.new_supplier_amount_share;
  const peerCompetition = peer?.competition;
  const entryCases = decision?.new_supplier_similar_amount_cases;
  const firstEntryCase = entryCases?.items?.[0];
  const attentionSuppliers = decision?.attention_suppliers ?? decision?.top_suppliers ?? [];
  const relatedProjectItems = Array.from(
    (relatedData?.items ?? [])
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
      }, new Map<string, NonNullable<typeof relatedData>["items"][number]>())
      .values(),
  ).slice(0, 5);
  const relatedHistoryHref = notice.organization_code
    ? (() => {
        const params = new URLSearchParams({ tab: "notices" });
        if (notice.work_type) params.set("workType", notice.work_type);
        if (notice.large_category) params.set("large", notice.large_category);
        if (notice.middle_category) params.set("middle", notice.middle_category);
        if (notice.field_code) params.set("field", notice.field_code);
        return `/organizations/${encodeURIComponent(notice.organization_code)}?${params.toString()}`;
      })()
    : undefined;
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
  const contractorNames = (item: NonNullable<typeof relatedData>["items"][number]) =>
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

  return {
    awards,
    contracts,
    participations,
    participationSummary,
    participationTotalPages,
    safeParticipationPage,
    visibleParticipations,
    participationPartial,
    hasContract,
    hasAward,
    winner,
    winnerContext,
    contractPartial: Boolean(
      activityData?.truncated || (activityData?.contract_pagination?.total_items ?? 0) > contracts.length,
    ),
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
  };
}
