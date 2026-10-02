import { ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { EntityLink } from "@/components/common/entity-link";
import { HistoryBackLink } from "@/components/common/history-back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useNotice,
  useNoticeActivity,
  useNoticeMarketContext,
  useNoticeOrganizationFieldCompanies,
  useNoticeOrganizationCompanyRelationship,
  useNoticeProjectLineage,
  type NoticeMarketContext,
  type OrganizationFieldCompany,
} from "../features/notices/api";
import { useOrganizationActivity } from "../features/organizations/api";
import { formatCompactMoney, formatExactMoney } from "@/shared/format/money";

const money = (value?: number) => formatExactMoney(value, "미정");
const shortMoney = (value?: number) => value == null ? "미정" : formatCompactMoney(value);
const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))
    : "미정";
const dday = (value?: string) => {
  if (!value) return "일정 미정";
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "마감";
  if (days === 0) return "오늘 마감";
  return `D-${days}`;
};
const workType: Record<string, string> = {
  service: "용역",
  goods: "물품",
  construction: "공사",
  foreign: "외자",
  other: "기타",
};
const factorLabel: Record<string, string> = {
  same_organization: "동일 기관",
  same_work_type: "동일 업무구분",
  information_system: "정보시스템",
  same_project_type_build: "구축사업",
  same_contract_method: "동일 계약방법",
  repeat_organization_award: "기관 반복 수주",
  industry_license_1468: "SW사업자 1468",
  industry_license_0036: "정보통신공사업 0036",
  similar_amount_range: "유사 금액대",
};
const companyEvidenceLabel = (item: OrganizationFieldCompany) => {
  if (item.relationship_group === "organization_field")
    return `이 기관의 관련 사업 ${Math.max(item.same_field_award_count, item.same_field_contract_count)}건`;
  if (item.relationship_group === "market_similar")
    return `다른 기관 유사사업 ${Math.max(item.same_field_award_count, item.same_field_contract_count)}건`;
  return `이 기관의 다른 사업 ${Math.max(item.same_organization_award_count, item.same_organization_contract_count)}건`;
};
const companyInsight = (item: OrganizationFieldCompany) => {
  const fieldCount =
    item.same_field_event_count ?? Math.max(item.same_field_award_count, item.same_field_contract_count);
  const projectTypeCount = item.same_project_type_event_count ?? item.same_project_type_count;
  const similarAmountCount = item.similar_amount_event_count ?? item.similar_amount_count;
  if (similarAmountCount >= 3 && fieldCount >= 3)
    return "기관 경험과 유사 금액대 사업 경험이 함께 많이 확인됩니다.";
  if (projectTypeCount >= 2)
    return `관련 사업 수주 중 현재와 같은 사업유형 경험이 ${projectTypeCount}건 확인됩니다.`;
  if (similarAmountCount > 0)
    return "동일 사업유형 이력은 상대적으로 적지만 유사 금액대 사업 경험이 확인됩니다.";
  return "이 기관에서 관련 사업을 반복적으로 수주한 이력이 확인됩니다.";
};
type MarketCompany = NoticeMarketContext["companies"][number];
const activityCounts = (company: MarketCompany) =>
  company.activities?.length
    ? {
        participation: company.activities.filter(
          (activity) => activity.is_similar_notice !== false && activity.participated,
        ).length,
        award: company.activities.filter(
          (activity) => activity.is_similar_notice !== false && activity.awarded,
        ).length,
        contract: company.activities.filter(
          (activity) => activity.is_similar_notice !== false && activity.contracted,
        ).length,
      }
    : {
        participation: company.participation_count,
        award: company.award_count,
        contract: company.contract_count,
      };

export function NoticeDetailPage() {
  const { noticeId } = useParams();
  const [selectedHistoryCompany, setSelectedHistoryCompany] = useState<string>();
  const [selectedRelationshipCompany, setSelectedRelationshipCompany] = useState<string>();
  const [selectedPlayerNumber, setSelectedPlayerNumber] = useState<string>();
  const [relationshipPage, setRelationshipPage] = useState(1);
  const [showRelationshipMap, setShowRelationshipMap] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [positionMetric, setPositionMetric] = useState<"award" | "contract">("award");
  const detail = useNotice(noticeId);
  const activity = useNoticeActivity(noticeId);
  const market = useNoticeMarketContext(noticeId);
  const organizationFieldCompanies = useNoticeOrganizationFieldCompanies(noticeId);
  const organizationCompanyRelationship = useNoticeOrganizationCompanyRelationship(
    noticeId,
    detail.data?.notice.organization_code,
    selectedPlayerNumber,
    relationshipPage,
  );
  const projectLineage = useNoticeProjectLineage(noticeId);
  const organizationActivity = useOrganizationActivity(detail.data?.notice.organization_code);

  if (detail.isLoading)
    return (
      <PageContainer>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-8 h-72 rounded-2xl" />
      </PageContainer>
    );
  if (detail.isError)
    return (
      <PageContainer>
        <p className="rounded-xl border p-6">샘플 화면을 불러오지 못했습니다.</p>
      </PageContainer>
    );

  const notice = detail.data!.notice;
  const openPlayerRelationship = (companyNumber: string) => {
    setRelationshipPage(1);
    setSelectedPlayerNumber(companyNumber);
  };
  const awards = activity.data?.awards ?? [];
  const contracts = activity.data?.contracts ?? [];
  const participations = [...(activity.data?.participations ?? [])].sort(
    (left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER),
  );
  const hasContract = contracts.length > 0;
  const hasAward = awards.length > 0;
  const hasOpeningResult = participations.length > 0;
  const isCompleted = hasContract || hasAward || hasOpeningResult;
  const resultLabel = hasContract
    ? "계약 완료"
    : hasAward
      ? "낙찰 완료"
      : hasOpeningResult
        ? "개찰 완료"
        : notice.status === "open"
          ? "진행 중"
          : notice.status === "scheduled"
            ? "입찰 예정"
            : "상태 확인";
  const requirements = detail.data!.requirements.filter(
    (item) => !item.assessment_stage || item.assessment_stage === "bid_entry",
  );
  const regions = requirements.filter((item) => ["participation_region", "region"].includes(item.type));
  const industries = requirements.filter((item) =>
    ["industry_license", "license", "industry"].includes(item.type),
  );
  const requirementSet = detail.data!.requirement_set;
  const regionCategory = requirementSet?.requirement_categories?.region;
  const industryCategory = requirementSet?.requirement_categories?.industry_license;
  const extractionComplete =
    ["complete", "completed", "full"].includes((notice.extraction_completeness ?? "").toLowerCase()) &&
    detail.data!.requirement_state === "ready" &&
    !notice.requires_review;
  const regionComplete = regionCategory?.completeness === "complete" || extractionComplete;
  const industryComplete = industryCategory?.completeness === "complete" || extractionComplete;
  const regionNotApplicable =
    regionComplete &&
    (regionCategory?.applicability === "not_applicable" ||
      requirementSet?.region_requirement_status === "not_applicable");
  const industryNotApplicable =
    industryComplete &&
    (industryCategory?.applicability === "not_applicable" ||
      requirementSet?.industry_license_requirement_status === "not_applicable");
  const regionLabel = regions.length
    ? "지역 조건 있음"
    : regionNotApplicable
      ? "지역 제한 없음"
      : "지역 조건 미확인";
  const industryLabel = industries.length
    ? "업종·면허 조건 있음"
    : industryNotApplicable
      ? "업종·면허 제한 없음"
      : "업종·면허 조건 미확인";
  const companies = market.data?.companies ?? [];
  const similarNotices = [...(market.data?.similar_notices ?? [])].sort((left, right) =>
    (right.notice_published_date ?? right.award_date ?? "").localeCompare(
      left.notice_published_date ?? left.award_date ?? "",
    ),
  );
  const tradeKeywords = ["전기", "통신", "소방", "건축", "토목", "설비", "조경", "기계"];
  const currentTrade = tradeKeywords.find((keyword) => notice.name.includes(keyword));
  const highComparisonNotices = similarNotices.filter(
    (item) =>
      item.comparison_eligible === true ||
      item.relationship_type === "similar_notice" ||
      Boolean(
        item.comparison_eligible == null &&
        item.relationship_type == null &&
        item.organization_code === notice.organization_code &&
        currentTrade &&
        item.notice_name?.includes(currentTrade) &&
        item.matched_features?.work_type === true &&
        Number(item.similarity_score) >= 55,
      ),
  );
  const relatedPastNotices = similarNotices.filter(
    (item) => !highComparisonNotices.some((candidate) => candidate.id === item.id),
  );
  const closestPastNotice = highComparisonNotices[0];
  const hasStrongComparison = highComparisonNotices.length > 0;
  const isLargeBuildService =
    notice.work_type === "service" &&
    notice.name.includes("구축") &&
    (notice.allocated_budget ?? 0) >= 5_000_000_000;
  const rates = (market.data?.similar_notices ?? [])
    .map((item) => ({
      id: item.id,
      name: item.notice_name,
      rate: Number(item.winning_rate),
      awardDate: item.award_date,
      awardTime: new Date(item.award_date ?? "").getTime(),
    }))
    .filter((item) => Number.isFinite(item.rate) && item.rate > 0 && Number.isFinite(item.awardTime));
  const median = rates.length
    ? [...rates].sort((a, b) => a.rate - b.rate)[Math.floor(rates.length / 2)].rate
    : null;
  const comparableStatisticsReady =
    rates.length >= 5 && similarNotices.every((item) => item.comparison_eligible === true);
  const chartEnd = Date.now();
  const chartStartYear = new Date().getFullYear() - 5;
  const chartStart = new Date(chartStartYear, 0, 1).getTime();
  const chartYears = Array.from({ length: 6 }, (_, index) => chartStartYear + index);
  const repeatWinner = [...companies].sort(
    (left, right) => activityCounts(right).award - activityCounts(left).award,
  )[0];
  const repeatAwardCount = repeatWinner ? activityCounts(repeatWinner).award : 0;
  const rateRange = rates.length
    ? { min: Math.min(...rates.map((item) => item.rate)), max: Math.max(...rates.map((item) => item.rate)) }
    : null;
  const companyOptions = companies
    .filter((company) => activityCounts(company).award > 0 || activityCounts(company).contract > 0)
    .slice(0, 6);
  const filteredSimilarNotices = selectedHistoryCompany
    ? relatedPastNotices.filter(
        (item) =>
          item.company_number === selectedHistoryCompany ||
          companies
            .find((company) => company.company_number === selectedHistoryCompany)
            ?.activities?.some((entry) => entry.bid_notice_id === item.bid_notice_id),
      )
    : relatedPastNotices;
  const historyPageSize = 5;
  const historyTotalPages = Math.max(1, Math.ceil(filteredSimilarNotices.length / historyPageSize));
  const historyItems = filteredSimilarNotices.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize,
  );
  const matrixCompanies = companies
    .filter((company) => {
      const counts = activityCounts(company);
      return (
        counts.participation > 0 ||
        counts.award > 0 ||
        counts.contract > 0 ||
        company.organization_participation_count > 0 ||
        company.organization_award_count > 0 ||
        company.organization_contract_count > 0
      );
    })
    .slice(0, 9);
  const selectedMarketCompany = (
    selectedRelationshipCompany
      ? companies.find((company) => company.company_number === selectedRelationshipCompany)
      : undefined
  )!;
  const selectedCompanyCounts = selectedMarketCompany ? activityCounts(selectedMarketCompany) : undefined;
  const uniqueActivityCount = (
    company: MarketCompany,
    scope: "similar" | "organization",
    result: "award" | "contract",
  ) => {
    if (!company.activities?.length) {
      if (scope === "similar") return result === "award" ? company.award_count : company.contract_count;
      return result === "award" ? company.organization_award_count : company.organization_contract_count;
    }
    return new Set(
      company.activities
        .filter((entry) => {
          const scopeMatched =
            scope === "similar" ? entry.is_similar_notice !== false : entry.is_same_organization;
          return scopeMatched && (result === "award" ? entry.awarded : entry.contracted);
        })
        .map((entry) => entry.bid_notice_id),
    ).size;
  };
  const relationshipCompanies = matrixCompanies
    .map((company) => ({
      company,
      similarAward: uniqueActivityCount(company, "similar", "award"),
      similarContract: uniqueActivityCount(company, "similar", "contract"),
      organizationAward: uniqueActivityCount(company, "organization", "award"),
      organizationContract: uniqueActivityCount(company, "organization", "contract"),
    }))
    .filter(
      (item) =>
        item.similarAward > 0 ||
        item.similarContract > 0 ||
        item.organizationAward > 0 ||
        item.organizationContract > 0,
    );
  const positionCompanies = relationshipCompanies
    .map((item) => ({
      company: item.company,
      x: positionMetric === "award" ? item.similarAward : item.similarContract,
      y: positionMetric === "award" ? item.organizationAward : item.organizationContract,
    }))
    .filter((item) => item.x > 0 || item.y > 0);
  const positionMaxValue = Math.max(1, ...positionCompanies.flatMap((item) => [item.x, item.y]));
  const companyRelationshipItems = relationshipCompanies.map((item) => ({
    ...item,
    similarCount: Math.max(item.similarAward, item.similarContract),
    organizationCount: Math.max(item.organizationAward, item.organizationContract),
  }));
  const sortedCompanyRelationshipItems = [...companyRelationshipItems].sort((left, right) => {
    const leftBoth = left.similarCount > 0 && left.organizationCount > 0 ? 1 : 0;
    const rightBoth = right.similarCount > 0 && right.organizationCount > 0 ? 1 : 0;
    return (
      rightBoth - leftBoth ||
      right.similarCount - left.similarCount ||
      right.organizationCount - left.organizationCount
    );
  });
  const overlappingCompanies = companyRelationshipItems.filter(
    (item) => item.similarCount > 0 && item.organizationCount > 0,
  );
  const similarOnlyCompanies = companyRelationshipItems.filter(
    (item) => item.similarCount > 0 && item.organizationCount === 0,
  );
  const organizationOnlyCompanies = companyRelationshipItems.filter(
    (item) => item.similarCount === 0 && item.organizationCount > 0,
  );
  const relationshipMax = Math.max(
    1,
    ...companyRelationshipItems.flatMap((item) => [item.similarCount, item.organizationCount]),
  );
  const organizationSimilarNotices = similarNotices.filter(
    (item) => item.organization_code && item.organization_code === notice.organization_code,
  );
  const recentOrganizationAwards = organizationActivity.data?.awards ?? [];
  const recentOrganizationWinnerCount = new Set(
    recentOrganizationAwards.map((item) => item.company_number).filter(Boolean),
  ).size;
  const recentOrganizationAwardAmount = recentOrganizationAwards.reduce(
    (sum, item) => sum + (item.winning_amount ?? 0),
    0,
  );
  const organizationWinners = new Set(
    organizationSimilarNotices.map((item) => item.company_number).filter(Boolean),
  );
  const organizationWinnerCounts = Array.from(
    organizationSimilarNotices
      .reduce((counts, item) => {
        if (!item.company_number || !item.company_name) return counts;
        const previous = counts.get(item.company_number);
        counts.set(item.company_number, {
          companyNumber: item.company_number,
          companyName: item.company_name,
          count: (previous?.count ?? 0) + 1,
        });
        return counts;
      }, new Map<string, { companyNumber: string; companyName: string; count: number }>())
      .values(),
  ).sort((left, right) => right.count - left.count);
  const topOrganizationWinner = organizationWinnerCounts[0];
  const topOrganizationShare =
    topOrganizationWinner && organizationSimilarNotices.length
      ? (topOrganizationWinner.count / organizationSimilarNotices.length) * 100
      : 0;
  const pastCaseCompanies = Array.from(
    similarNotices.reduce((items, item) => {
      if (item.company_number && item.company_name) items.set(item.company_number, item.company_name);
      return items;
    }, new Map<string, string>()),
  );
  const distinctWinnerCount = new Set(similarNotices.map((item) => item.company_number).filter(Boolean)).size;
  const repeatedWinnerCount = similarNotices.length - distinctWinnerCount;
  const participationReviewItems =
    notice.work_type === "construction"
      ? [
          ["견적 제출 자격", "계약상대자 선정기준과 제출 자격"],
          ["공사기간", "착공·준공 및 공사 가능 기간"],
          ["현장 조건", "공사 위치·범위와 현장설명 여부"],
        ]
      : notice.work_type === "goods"
        ? [
            ["세부품명", "공급자 등록과 세부품명 요건"],
            ["규격 적합성", "필수 규격과 동등 이상 인정 범위"],
            ["납품 조건", "납품기한·장소와 검사 방식"],
          ]
        : [
            ["수행실적", "유사사업 인정 범위와 최소 금액"],
            ["공동수급", "허용 방식과 구성 지분"],
            ["사업자 참여제한", "사업금액에 따른 참여 가능 사업자 범위"],
          ];
  const finalReviewItems =
    notice.work_type === "construction"
      ? [
          ["견적 제출 및 선정 기준", "예정가격 결정과 계약상대자 선정기준"],
          ["세부 공사범위", "도면·내역서상 시공 범위"],
          ["공사기간", "착공·준공과 실제 작업 가능 기간"],
          ["현장 조건", "현장설명과 기존 시설 운용 조건"],
          ["안전·보험 비용", "산업안전보건관리비 등 반영 항목"],
          ["하도급 조건", "허용 범위와 승인 절차"],
        ]
      : notice.work_type === "goods"
        ? [
            ["세부품명·규격", "동등 이상 인정 범위와 필수 사양"],
            ["납품 조건", "납품기한·장소와 분할납품 여부"],
            ["검사·검수", "검수 기준과 시험성적서"],
            ["제조사 요건", "정품·공급확약 요구 여부"],
            ["하자보증", "보증기간과 유지보수 범위"],
            ["계약상대자 선정", "가격·규격 동시평가 여부"],
          ]
        : [
            ["수행실적 기준", "유사사업 인정 범위와 최소 금액"],
            ["공동수급 방식", "공동이행·분담이행 허용 여부와 지분 제한"],
            ["사업자 참여제한", "사업금액에 따른 대기업 참여 가능 여부"],
            ["기술·가격 평가", "배점과 정량·정성 평가항목"],
            ["핵심 투입인력", "PM 및 기술인력의 경력·자격"],
            ["하도급 제한", "승인 절차와 허용 범위"],
          ];
  const organizationFieldGroup = (organizationFieldCompanies.data?.organization_field_companies ?? []).filter(
    (item) => (item.same_field_event_count ?? 0) > 0,
  );
  const marketSimilarGroup = organizationFieldCompanies.data?.market_similar_companies ?? [];
  const organizationOtherGroup = organizationFieldCompanies.data?.organization_other_companies ?? [];
  const relationshipRelevance = (item: OrganizationFieldCompany) => {
    const factorWeight = item.matched_factors.reduce(
      (score, factor) =>
        score +
        (factor === "same_project_type_build"
          ? 8
          : factor === "similar_amount_range"
            ? 8
            : factor.startsWith("industry_license_")
              ? 5
              : factor === "repeat_organization_award"
                ? 4
                : factor === "information_system"
                  ? 3
                  : 1),
      0,
    );
    const recentYear = Number((item.latest_award_date ?? item.latest_activity_date)?.slice(0, 4) ?? 0);
    return (
      (item.same_field_event_count ?? 0) * 3 +
      (item.same_project_type_event_count ?? 0) * 5 +
      (item.similar_amount_event_count ?? 0) * 4 +
      factorWeight +
      Math.max(0, recentYear - 2023)
    );
  };
  const rankedOrganizationFieldGroup = [...organizationFieldGroup].sort(
    (left, right) => relationshipRelevance(right) - relationshipRelevance(left),
  );
  const scaleLeader = [...organizationFieldGroup].sort(
    (left, right) =>
      (right.similar_amount_event_count ?? 0) +
      (right.same_field_event_count ?? 0) -
      ((left.similar_amount_event_count ?? 0) + (left.same_field_event_count ?? 0)),
  )[0];
  const projectTypeLeaders = [...organizationFieldGroup].sort(
    (left, right) =>
      (right.same_project_type_event_count ?? 0) - (left.same_project_type_event_count ?? 0) ||
      (right.latest_award_date ?? "").localeCompare(left.latest_award_date ?? ""),
  );
  const highlightedOrganizationFieldGroup = [
    scaleLeader,
    ...projectTypeLeaders,
    ...rankedOrganizationFieldGroup,
  ]
    .filter(
      (item, index, items): item is OrganizationFieldCompany =>
        Boolean(item) &&
        items.findIndex((candidate) => candidate?.company_number === item?.company_number) === index,
    )
    .slice(0, 3);
  const remainingOrganizationFieldGroup = rankedOrganizationFieldGroup.filter(
    (item) =>
      !highlightedOrganizationFieldGroup.some(
        (highlighted) => highlighted.company_number === item.company_number,
      ),
  );
  const marketStructure = organizationFieldCompanies.data?.market_structure;
  const marketEntry = organizationFieldCompanies.data?.market_entry;
  const analysisBasis = organizationFieldCompanies.data?.analysis_basis;
  const drawerRelationshipCompanies = [
    ...rankedOrganizationFieldGroup,
    ...marketSimilarGroup,
    ...organizationOtherGroup,
  ].filter(
    (item, index, items) =>
      items.findIndex((candidate) => candidate.company_number === item.company_number) === index,
  );
  const selectedPlayer = drawerRelationshipCompanies.find(
    (item) => item.company_number === selectedPlayerNumber,
  );
  const selectedPlayerAnnualActivity = selectedPlayer?.annual_activity ?? [];
  const selectedPlayerOrganizationSummary = organizationCompanyRelationship.data?.summary;
  const selectedPlayerOrganizationYears = organizationCompanyRelationship.data?.yearly_activity ?? [];
  const selectedPlayerContractAmount = selectedPlayerOrganizationYears.length
    ? selectedPlayerOrganizationYears.reduce((sum, item) => sum + (item.total_attributed_amount ?? 0), 0)
    : selectedPlayerAnnualActivity.reduce((sum, item) => sum + (item.attributed_contract_amount ?? 0), 0);
  const selectedPlayerAmountIncomplete =
    selectedPlayerAnnualActivity.some(
      (item) => item.award_event_count > 0 && item.amount_completeness !== "complete",
    ) ||
    Boolean(
      organizationCompanyRelationship.data &&
      organizationCompanyRelationship.data.data_completeness?.status !== "complete",
    );
  const selectedPlayerRoles = selectedPlayerAnnualActivity.reduce(
    (totals, item) => ({
      sole: totals.sole + item.sole_count,
      lead: totals.lead + item.consortium_lead_count,
      member: totals.member + item.consortium_member_count,
    }),
    { sole: 0, lead: 0, member: 0 },
  );
  const concentrationCompanies = [...organizationFieldGroup].sort(
    (left, right) => (right.same_field_event_count ?? 0) - (left.same_field_event_count ?? 0),
  );
  const maxOrganizationActiveYears = Math.max(
    0,
    ...organizationFieldGroup.map((item) => item.active_year_count ?? item.active_years?.length ?? 0),
  );
  const activityTrendCompanies = rankedOrganizationFieldGroup.slice(0, 8);
  const organizationYearlyActivity = (item: OrganizationFieldCompany) =>
    item.organization_relationship?.yearly_activity ?? [];
  const latestActivityYear = Math.max(
    new Date().getFullYear(),
    ...activityTrendCompanies.flatMap((item) =>
      organizationYearlyActivity(item).map((activity) => activity.year),
    ),
  );
  const earliestActivityYear = Math.max(
    latestActivityYear - 6,
    Math.min(
      latestActivityYear,
      ...activityTrendCompanies.flatMap((item) =>
        organizationYearlyActivity(item).map((activity) => activity.year).length
          ? organizationYearlyActivity(item).map((activity) => activity.year)
          : [latestActivityYear],
      ),
    ),
  );
  const activityTrendYears = Array.from(
    { length: latestActivityYear - earliestActivityYear + 1 },
    (_, index) => earliestActivityYear + index,
  );
  const annualContractAmountMax = Math.max(
    1,
    ...activityTrendCompanies.flatMap((item) =>
      organizationYearlyActivity(item).map((activity) => activity.attributed_contract_amount ?? 0),
    ),
  );
  const confirmedLineageItems = (projectLineage.data?.items ?? []).filter(
    (item) =>
      item.relationship_type !== "related_candidate" &&
      item.confirmation_status !== "requires_source_evidence",
  );
  const repeatOrganizationFieldCompanies =
    marketStructure?.repeat_company_count ??
    rankedOrganizationFieldGroup.filter(
      (item) =>
        (item.same_field_event_count ??
          Math.max(item.same_field_award_count, item.same_field_contract_count)) >= 2,
    ).length;
  const similarAmountExperiencedCompanies =
    marketStructure?.similar_amount_company_count ??
    rankedOrganizationFieldGroup.filter(
      (item) => (item.similar_amount_event_count ?? item.similar_amount_count) > 0,
    ).length;
  const relationshipPositionCompanies = [...rankedOrganizationFieldGroup, ...marketSimilarGroup].filter(
    (item, index, items) =>
      items.findIndex((candidate) => candidate.company_number === item.company_number) === index,
  );
  const relationshipX = (item: OrganizationFieldCompany) =>
    item.organization_relationship?.award_event_count ??
    Math.max(item.same_organization_award_count, item.same_organization_contract_count);
  const relationshipY = (item: OrganizationFieldCompany) =>
    item.similar_project_experience?.event_count ??
    item.same_field_event_count ??
    Math.max(item.same_field_award_count, item.same_field_contract_count);
  const relationshipXMax = Math.max(1, ...relationshipPositionCompanies.map(relationshipX));
  const relationshipYMax = Math.max(1, ...relationshipPositionCompanies.map(relationshipY));
  const relationshipAmountMax = Math.max(
    1,
    ...relationshipPositionCompanies.map(
      (item) =>
        item.organization_relationship?.total_attributed_contract_amount ??
        item.same_organization_contract_amount ??
        0,
    ),
  );
  const labeledRelationshipCompanies = new Set([
    ...highlightedOrganizationFieldGroup.slice(0, 5).map((item) => item.company_number),
    ...marketSimilarGroup.slice(0, 1).map((item) => item.company_number),
  ]);
  const relationshipPosition = (value: number, max: number) => 11 + Math.sqrt(value / max) * 78;
  const relationshipDotSize = (item: OrganizationFieldCompany) =>
    12 +
    Math.sqrt(
      (item.organization_relationship?.total_attributed_contract_amount ??
        item.same_organization_contract_amount ??
        0) / relationshipAmountMax,
    ) *
      12;
  const requirementPoint = regionNotApplicable
    ? `지역 제한이 없으며, ${industries.length ? industries.map((item) => `${item.title}${item.industry_code ? `(${item.industry_code})` : ""}`).join(" 및 ") + " 요건이 확인됩니다." : "업종·면허 조건을 확인 중입니다."}`
    : `지역 조건을 확인 중이며, ${industries.length ? industries.map((item) => `${item.title}${item.industry_code ? `(${item.industry_code})` : ""}`).join(" 및 ") + " 요건이 확인됩니다." : "업종·면허 조건도 확인 중입니다."}`;

  return (
    <PageContainer>
      <style>{`#relationships > :nth-child(3) { display: ${showRelationshipMap ? "block" : "none"}; } #project-lineage { display: ${confirmedLineageItems.length ? "block" : "none"}; }`}</style>
      <div className="flex items-center justify-between gap-4">
        <HistoryBackLink fallbackTo="/notices" />
      </div>

      <header className="mt-7 scroll-mt-[86px] rounded-3xl border bg-card p-6 shadow-sm sm:p-8" id="summary">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{resultLabel}</Badge>
              {!isCompleted && (
                <strong className="text-sm text-blue-800 dark:text-blue-300">
                  {dday(notice.deadline_at)}
                </strong>
              )}
            </div>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight">{notice.name}</h1>
            <div className="mt-3 text-base text-muted-foreground">
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
            </div>
          </div>
          {notice.detail_url && (
            <Button variant="outline" asChild>
              <a href={notice.detail_url} target="_blank" rel="noreferrer">
                나라장터 원문 <ExternalLink size={14} />
              </a>
            </Button>
          )}
        </div>
        <dl className="mt-7 grid gap-5 border-t pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-sm text-muted-foreground">업무구분</dt>
            <dd className="mt-1 text-base font-semibold">{workType[notice.work_type] ?? "기타"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">예산</dt>
            <dd className="mt-1 text-base font-semibold">{shortMoney(notice.allocated_budget)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">계약방법</dt>
            <dd className="mt-1 text-base font-semibold">{notice.contract_method ?? "미제공"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">게시일</dt>
            <dd className="mt-1 text-base font-semibold">{date(notice.published_at)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">마감일</dt>
            <dd className="mt-1 text-base font-semibold">{date(notice.deadline_at)}</dd>
          </div>
        </dl>
        <div className="mt-6 space-y-2.5 border-t pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-semibold text-muted-foreground">지역</span>
            {regions.length ? (
              regions.map((item) => (
                <Badge variant="secondary" key={item.id}>
                  {item.title || "지역 조건"}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">{regionLabel}</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-semibold text-muted-foreground">업종·면허</span>
            {industries.length ? (
              industries.map((item) => (
                <Badge variant="secondary" title={item.title} key={item.id}>
                  {item.industry_code === "1468" ? "SW사업자" : item.title || "업종·면허"}
                  {item.industry_code ? ` ${item.industry_code}` : ""}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">{industryLabel}</Badge>
            )}
          </div>
        </div>
      </header>

      <nav className="mt-5 overflow-x-auto border-y py-3" aria-label="공고 상세 바로가기">
        <div className="flex min-w-max items-center gap-2">
          {(isCompleted
            ? [
                { id: "summary", label: "요약" },
                { id: "results", label: "낙찰·계약" },
              ]
            : [
                { id: "similar-notices", label: "유사 공고" },
                { id: "relationships", label: "관련 수주업체" },
                { id: "market-concentration", label: "기관 수주 관계" },
                ...(confirmedLineageItems.length ? [{ id: "project-lineage", label: "사업 이력" }] : []),
              ]
          ).map((item) => (
            <a
              className="rounded-full border bg-background px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-slate-400 hover:bg-muted hover:text-foreground"
              href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault();
                const target = document.getElementById(item.id);
                if (target)
                  window.scrollTo({
                    top: target.getBoundingClientRect().top + window.scrollY - 86,
                    behavior: "smooth",
                  });
                window.history.replaceState(null, "", `#${item.id}`);
              }}
              key={item.id}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      {(activity.isLoading || isCompleted) && (
        <section className="mt-10 scroll-mt-[86px]" id={isCompleted ? "results" : undefined}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {hasContract
                  ? "계약 결과"
                  : hasAward
                    ? "낙찰 결과"
                    : hasOpeningResult
                      ? "개찰 결과"
                      : "결과 확인"}
              </h2>
              {isCompleted && (
                <p className="mt-1 text-sm text-muted-foreground">이 공고에서 확인된 최종 결과입니다.</p>
              )}
            </div>
          </div>
          {activity.isLoading ? (
            <Skeleton className="mt-4 h-40 rounded-2xl" />
          ) : isCompleted ? (
            <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
              {hasOpeningResult && !hasAward && !hasContract && (
                <div className="border-b bg-muted/30 p-5">
                  <p className="font-semibold">개찰 결과가 확인되었습니다.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    아직 최종 낙찰 또는 계약 결과는 확인되지 않았습니다.
                  </p>
                </div>
              )}
              {hasContract && (
                <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">계약명</p>
                    <p className="mt-1 font-semibold">{contracts[0].name ?? notice.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">계약금액</p>
                    <p className="mt-1 text-xl font-bold">{shortMoney(contracts[0].amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">계약일</p>
                    <p className="mt-1 font-semibold">
                      {date(contracts[0].contract_date ?? contracts[0].concluded_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">계약방법</p>
                    <p className="mt-1 font-semibold">{contracts[0].method ?? "정보 미제공"}</p>
                  </div>
                </div>
              )}
              {awards.map((award) => (
                <div
                  className="grid gap-5 border-t p-5 first:border-t-0 sm:grid-cols-2 lg:grid-cols-4"
                  key={award.id}
                >
                  <div>
                    <p className="text-sm text-muted-foreground">낙찰업체</p>
                    <div className="mt-1 font-semibold">
                      {award.company_number && award.company_name ? (
                        <EntityLink
                          type="company"
                          to={`/companies/${encodeURIComponent(award.company_number)}?name=${encodeURIComponent(award.company_name)}`}
                        >
                          {award.company_name}
                        </EntityLink>
                      ) : (
                        (award.company_name ?? "정보 미제공")
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">낙찰금액</p>
                    <p className="mt-1 text-xl font-bold">{shortMoney(award.winning_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">낙찰률</p>
                    <p className="mt-1 font-semibold">
                      {award.winning_rate != null ? `${award.winning_rate}%` : "정보 미제공"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">낙찰일</p>
                    <p className="mt-1 font-semibold">{date(award.award_date ?? award.opening_at)}</p>
                  </div>
                </div>
              ))}
              {participations.length > 0 && (
                <details className="border-t">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
                    개찰 순위 전체 보기 ({participations.length}개 업체)
                  </summary>
                  <div className="overflow-x-auto border-t">
                    <div className="min-w-[640px] divide-y">
                      <div className="grid grid-cols-[5rem_minmax(0,1fr)_9rem_8rem] gap-4 bg-muted/40 px-5 py-3 text-xs font-semibold text-muted-foreground">
                        <span>순위</span>
                        <span>업체</span>
                        <span className="text-right">투찰금액</span>
                        <span className="text-right">투찰률</span>
                      </div>
                      {participations.map((item) => (
                        <div
                          className="grid grid-cols-[5rem_minmax(0,1fr)_9rem_8rem] items-center gap-4 px-5 py-3 text-sm"
                          key={item.id}
                        >
                          <span className={item.rank === 1 ? "font-bold text-blue-800" : "font-medium"}>
                            {item.rank ? `${item.rank}순위${item.rank === 1 ? " · 낙찰" : ""}` : "-"}
                          </span>
                          <span className="truncate font-medium">
                            {item.company_name ?? "업체 정보 미제공"}
                          </span>
                          <span className="text-right">{shortMoney(item.bid_amount)}</span>
                          <span className="text-right text-muted-foreground">
                            {item.bid_rate != null ? `${item.bid_rate}%` : "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              )}
            </div>
          ) : null}
        </section>
      )}

      {!isCompleted && (
        <section className="mt-10 pb-12">
          <section className="scroll-mt-[86px]" id="similar-notices">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">유사 공고</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  현재 공고와 사업유형·기관·규모 등의 접점이 확인된 과거 공고입니다.
                </p>
              </div>
              {similarNotices.length > 3 && (
                <span className="text-sm font-semibold text-muted-foreground">
                  전체 {similarNotices.length}건
                </span>
              )}
            </div>
            {market.isLoading ? (
              <Skeleton className="mt-4 h-48 rounded-2xl" />
            ) : similarNotices.length ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {similarNotices.slice(0, 3).map((item) => {
                  const sameOrganization = Boolean(
                    item.organization_code &&
                    notice.organization_code &&
                    item.organization_code === notice.organization_code,
                  );
                  return (
                    <article
                      className="rounded-2xl border bg-card p-5 shadow-sm"
                      key={`similar-preview-${item.id}`}
                    >
                      <EntityLink
                        type="notice"
                        to={`/notices/${encodeURIComponent(item.bid_notice_id ?? item.id)}`}
                      >
                        {item.notice_name ?? "공고명 미제공"}
                      </EntityLink>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.organization_name ?? "기관 미상"} ·{" "}
                        {item.notice_published_date ?? item.award_date ?? "날짜 미상"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {sameOrganization && (
                          <span className="rounded bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-800">
                            동일기관
                          </span>
                        )}
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">
                          동일 업무구분
                        </span>
                        {item.similarity_reasons.slice(0, 2).map((reason) => (
                          <span
                            className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800"
                            key={reason}
                          >
                            {factorLabel[reason] ?? reason}
                          </span>
                        ))}
                      </div>
                      <div className="mt-5 border-t pt-4 text-sm">
                        <p className="font-semibold">{shortMoney(item.winning_amount)}</p>
                        <div className="mt-2">
                          {item.company_number && item.company_name ? (
                            <EntityLink
                              type="company"
                              to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name)}`}
                            >
                              {item.company_name}
                            </EntityLink>
                          ) : (
                            <span className="text-muted-foreground">낙찰업체 미제공</span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border bg-muted/20 p-5 text-sm text-muted-foreground">
                현재 확인된 유사 공고가 없습니다.
              </p>
            )}
          </section>

          {false && (
            <>
              <div className="mt-10 scroll-mt-[86px]" id="requirements">
                <h2 className="text-2xl font-bold">참여할 수 있는가?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  회사 적용 전에는 공고에서 확인된 참여 문턱을 보여줍니다.
                </p>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="hidden grid-cols-[11rem_11rem_8rem_minmax(0,1fr)] gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-semibold text-muted-foreground sm:grid">
                  <span>확인 항목</span>
                  <span>현재 확인 결과</span>
                  <span>중요도</span>
                  <span>검토 의미</span>
                </div>
                <div className="divide-y text-sm">
                  <div className="grid gap-2 px-5 py-4 sm:grid-cols-[11rem_11rem_8rem_minmax(0,1fr)] sm:gap-4">
                    <strong>지역</strong>
                    <span
                      className={
                        regionNotApplicable
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-amber-700"
                      }
                    >
                      {regionNotApplicable ? "제한 없음" : "확인 필요"}
                    </span>
                    <span className="font-semibold text-muted-foreground">
                      {regionNotApplicable ? "확인 완료" : "우선 확인"}
                    </span>
                    <span className="text-muted-foreground">
                      {regionNotApplicable
                        ? "전국 소재 업체가 참여할 수 있습니다."
                        : "지역 제한 적용 여부를 확인해야 합니다."}
                    </span>
                  </div>
                  {industries.map((item) => (
                    <div
                      className="grid gap-2 px-5 py-4 sm:grid-cols-[11rem_11rem_8rem_minmax(0,1fr)] sm:gap-4"
                      key={item.id}
                    >
                      <strong>{item.industry_code === "1468" ? "SW사업자" : item.title}</strong>
                      <span className="font-semibold">
                        {item.industry_code ? `${item.industry_code} 필요` : "요건 확인"}
                      </span>
                      <span className="font-semibold text-red-700">필수</span>
                      <span className="text-muted-foreground">해당 업종 등록 여부를 확인해야 합니다.</span>
                    </div>
                  ))}
                  {!industries.length && (
                    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[11rem_11rem_8rem_minmax(0,1fr)] sm:gap-4">
                      <strong>업종·면허</strong>
                      <span className="font-semibold text-amber-700">
                        {industryNotApplicable ? "제한 없음" : "확인 필요"}
                      </span>
                      <span className="font-semibold text-muted-foreground">우선 확인</span>
                      <span className="text-muted-foreground">공고의 업종·면허 조건을 확인해야 합니다.</span>
                    </div>
                  )}
                  {participationReviewItems.map(([label, meaning], index) => (
                    <div
                      className="grid gap-2 px-5 py-4 sm:grid-cols-[11rem_11rem_8rem_minmax(0,1fr)] sm:gap-4"
                      key={label}
                    >
                      <strong>{label}</strong>
                      <span className="font-semibold text-amber-700">확인 필요</span>
                      <span className="font-semibold text-muted-foreground">
                        {index < 3 ? "우선 확인" : "확인 필요"}
                      </span>
                      <span className="text-muted-foreground">{meaning}을 확인해야 합니다.</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {false && (
            <>
              <div className="mt-10 scroll-mt-[86px]" id="rfp">
                <h2 className="text-2xl font-bold">어떤 사업인가?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  공고명만 반복하지 않고 원문에서 실제 수행범위를 확인합니다.
                </p>
              </div>
              <div className="mt-4 rounded-2xl border border-dashed bg-muted/20 p-5 sm:p-6">
                <p className="font-semibold">세부 사업범위를 분석 중입니다.</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {notice.work_type === "construction"
                    ? "설계서와 내역서에서 세부 공사범위, 현장 조건, 공사기간과 안전 관련 비용을 확인합니다."
                    : notice.work_type === "goods"
                      ? "규격서에서 필수 사양, 납품 조건, 검사·검수와 하자보증 범위를 확인합니다."
                      : "제안요청서에서 구축 대상 시스템, 주요 기능, 외부 연계, 인프라, 데이터 이관과 운영전환 범위를 확인합니다."}
                </p>
              </div>

              <div className="mt-10">
                <h2 className="text-2xl font-bold">
                  {notice.work_type === "service" ? "제안에서 무엇을 평가하는가?" : "선정 기준은 무엇인가?"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  참가자격과 분리해 평가·선정 기준을 확인합니다.
                </p>
              </div>
              <div className="mt-4 rounded-2xl border border-dashed bg-muted/20 p-5 sm:p-6">
                <p className="font-semibold">
                  {notice.work_type === "service"
                    ? "제안평가 기준을 분석 중입니다."
                    : "계약상대자 선정 기준을 분석 중입니다."}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {notice.work_type === "service"
                    ? "기술·가격 배점, 정량·정성 평가항목, 핵심인력과 발표평가 기준을 확인합니다."
                    : finalReviewItems
                        .slice(0, 3)
                        .map(([title]) => title)
                        .join(" · ") + "을 확인합니다."}
                </p>
              </div>
            </>
          )}

          {market.isLoading ? (
            <Skeleton className="mt-8 h-96 rounded-2xl" />
          ) : (
            <div className="flex flex-col">
              <section className="-order-1 mt-10 scroll-mt-[86px]" id="relationships">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">관련 수주업체</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      이 기관의 수주 경험과 다른 기관을 포함한 유사사업 경험을 함께 비교합니다.
                    </p>
                  </div>
                  {notice.organization_code && (
                    <EntityLink
                      type="organization"
                      to={`/organizations/${encodeURIComponent(notice.organization_code)}`}
                    >
                      {notice.organization}
                    </EntityLink>
                  )}
                </div>
                {organizationFieldCompanies.isLoading ? (
                  <Skeleton className="mt-4 h-48 rounded-2xl" />
                ) : organizationFieldCompanies.isError ? (
                  <p className="mt-4 rounded-xl border p-4 text-sm text-muted-foreground">
                    관련 업체 이력을 불러오지 못했습니다.
                  </p>
                ) : organizationFieldCompanies.data ? (
                  <>
                    <div className="mt-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold">관련 업체 구성</h3>
                        {analysisBasis && (
                          <details className="relative">
                            <summary className="cursor-pointer text-xs font-semibold text-blue-800">
                              분석 기준 보기
                            </summary>
                            <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border bg-background p-4 text-xs leading-5 shadow-xl">
                              <strong>관련 사업 기준</strong>
                              <p className="mt-1 text-muted-foreground">
                                업무구분{" "}
                                {workType[analysisBasis.work_type ?? ""] ?? analysisBasis.work_type ?? "미상"}{" "}
                                · {analysisBasis.field?.label ?? "분야 미상"} ·{" "}
                                {analysisBasis.project_type?.label ??
                                  analysisBasis.project_type_label ??
                                  "사업유형 미상"}
                              </p>
                              <p className="mt-2 text-muted-foreground">
                                {analysisBasis.industries
                                  ?.map((item) => `${item.name} ${item.code}`)
                                  .join(" · ")}
                              </p>
                              {analysisBasis.similar_amount_range?.minimum_amount != null && (
                                <p className="mt-2 text-muted-foreground">
                                  유사 금액대 {shortMoney(analysisBasis.similar_amount_range.minimum_amount)}~
                                  {shortMoney(analysisBasis.similar_amount_range.maximum_amount)}
                                </p>
                              )}
                              <p className="mt-2 text-muted-foreground">
                                최근 {analysisBasis.period_years ?? 5}년 · 관찰 시작{" "}
                                {analysisBasis.observation_started_at ?? "미상"}
                              </p>
                            </div>
                          </details>
                        )}
                      </div>
                      <dl className="mt-3 grid overflow-hidden rounded-2xl border bg-card shadow-sm sm:grid-cols-3 lg:grid-cols-6">
                        <div className="border-b p-4 sm:border-r">
                          <dt className="text-xs text-muted-foreground">관련 사업 수주</dt>
                          <dd className="mt-1 text-xl font-bold">
                            {marketStructure?.award_event_count ?? "-"}건
                          </dd>
                        </div>
                        <div className="border-b p-4 sm:border-r">
                          <dt className="text-xs text-muted-foreground">수주업체</dt>
                          <dd className="mt-1 text-xl font-bold">
                            {marketStructure?.company_count ?? organizationFieldGroup.length}곳
                          </dd>
                        </div>
                        <div className="border-b p-4 lg:border-r">
                          <dt className="text-xs text-muted-foreground">2건 이상 수주</dt>
                          <dd className="mt-1 text-xl font-bold">{repeatOrganizationFieldCompanies}곳</dd>
                        </div>
                        <div className="border-b p-4 sm:border-b-0 sm:border-r">
                          <dt className="text-xs text-muted-foreground">최근 3년 최초 관찰</dt>
                          <dd className="mt-1 text-xl font-bold">
                            {marketEntry?.recent_new_entrant_count ?? "-"}곳
                          </dd>
                        </div>
                        <div className="border-b p-4 sm:border-b-0 sm:border-r">
                          <dt className="text-xs text-muted-foreground">유사 금액대 경험</dt>
                          <dd className="mt-1 text-xl font-bold">{similarAmountExperiencedCompanies}곳</dd>
                        </div>
                        <div className="p-4">
                          <dt className="text-xs text-muted-foreground">상위 5개사 비중</dt>
                          <dd className="mt-1 text-xl font-bold">
                            {marketStructure?.top_5_share != null
                              ? `${(marketStructure.top_5_share * 100).toFixed(1)}%`
                              : "-"}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-2 text-xs text-muted-foreground">
                        관련 사업 업체 {marketStructure?.company_count ?? organizationFieldGroup.length}곳 중{" "}
                        {repeatOrganizationFieldCompanies}곳에서 2건 이상의 수주 이력이 확인됩니다. 신규는{" "}
                        {marketEntry?.classification === "first_observed"
                          ? "관찰기간 내 최초 확인"
                          : "최초 수주"}{" "}
                        기준입니다.
                      </p>
                    </div>
                    {relationshipPositionCompanies.length > 0 && (
                      <div className="mt-5">
                        <div className="hidden rounded-2xl border bg-card p-5 shadow-sm sm:block">
                          <div className="flex justify-end">
                            <div className="flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <i className="size-2.5 rounded-full bg-blue-700" />
                                기관·사업 경험
                              </span>
                              <span className="flex items-center gap-1.5">
                                <i className="size-2.5 rounded-full bg-teal-600" />
                                유사사업 경험
                              </span>
                            </div>
                          </div>
                          <div className="relative mt-6 h-[38rem] pl-24 pb-12 pr-6">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-semibold text-muted-foreground">
                              유사사업 수주 경험
                            </span>
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs font-semibold text-muted-foreground">
                              이 기관 수주 경험
                            </span>
                            <div className="absolute left-24 right-6 top-0 bottom-12 overflow-visible rounded-xl border bg-muted/10">
                              <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-slate-300" />
                              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-300" />
                              <span className="absolute left-4 top-3 text-xs font-semibold text-teal-700">
                                유사사업 경험
                              </span>
                              <span className="absolute right-4 top-3 text-xs font-semibold text-blue-800">
                                기관·사업 경험
                              </span>
                              <span className="absolute bottom-3 left-4 text-xs font-semibold text-slate-400">
                                유사사업 경험 적음
                              </span>
                              <span className="absolute bottom-3 right-4 text-xs font-semibold text-slate-600">
                                기관 경험
                              </span>
                              {relationshipPositionCompanies.map((item) => {
                                const x = relationshipPosition(relationshipX(item), relationshipXMax);
                                const y = relationshipPosition(relationshipY(item), relationshipYMax);
                                const size = relationshipDotSize(item);
                                const color =
                                  item.relationship_group === "organization_field"
                                    ? "bg-blue-700"
                                    : item.relationship_group === "market_similar"
                                      ? "bg-teal-600"
                                      : "bg-slate-400";
                                return (
                                  <button
                                    aria-label={`${item.company_name}, 기관 경험 ${relationshipX(item)}건, 분야 경험 ${relationshipY(item)}건`}
                                    className="group absolute z-10 -translate-x-1/2 translate-y-1/2 outline-none hover:z-40 focus:z-40"
                                    onClick={() => openPlayerRelationship(item.company_number)}
                                    style={{ left: `${x}%`, bottom: `${y}%` }}
                                    key={`position-${item.company_number}`}
                                    type="button"
                                  >
                                    <span
                                      className={`block rounded-full border-2 border-white shadow-md ring-blue-200 transition-transform group-hover:scale-125 group-focus:scale-125 group-focus:ring-4 ${color}`}
                                      style={{ width: size, height: size }}
                                    />
                                    {labeledRelationshipCompanies.has(item.company_number) && (
                                      <span className="pointer-events-none absolute left-1/2 top-full mt-1 w-max max-w-32 -translate-x-1/2 truncate rounded bg-background/90 px-1.5 py-0.5 text-[11px] font-semibold shadow-sm">
                                        {item.company_name}
                                      </span>
                                    )}
                                    <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 rounded-xl bg-slate-950 p-3 text-left text-xs leading-5 text-white shadow-xl group-hover:block group-focus:block">
                                      <strong className="block text-sm">{item.company_name}</strong>
                                      <span className="mt-1 block text-slate-300">
                                        이 기관 수주 {relationshipX(item)}건 · 유사사업 수주{" "}
                                        {relationshipY(item)}건
                                      </span>
                                      <span className="block text-slate-300">
                                        탐색 후보{" "}
                                        {item.similar_project_experience?.candidate_count ??
                                          relationshipY(item)}
                                        건 · 유사규모{" "}
                                        {item.similar_project_experience?.similar_amount_event_count ?? 0}건
                                      </span>
                                      <span className="block text-slate-300">
                                        {item.organization_relationship?.total_attributed_contract_amount !=
                                        null
                                          ? `확인된 기관 계약금액 ${shortMoney(item.organization_relationship.total_attributed_contract_amount)}`
                                          : "기관 계약금액 미제공"}
                                      </span>
                                      <span className="block text-slate-300">
                                        최근 활동 {item.latest_activity_date ?? "미상"}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-muted-foreground">
                            오른쪽일수록 현재 기관 수주 경험이 많고, 위쪽일수록 비교 근거가 있는 유사사업 수주
                            경험이 많습니다. 참고 수준의 탐색 후보는 위치 계산에서 제외하며, 점 크기는 확인된
                            기관 계약금액입니다.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:hidden">
                          <div className="rounded-xl bg-blue-50 p-3">
                            <p className="text-xs text-blue-700">이 기관 · 관련 사업</p>
                            <strong className="mt-1 block">{organizationFieldGroup.length}곳</strong>
                          </div>
                          <div className="rounded-xl bg-teal-50 p-3">
                            <p className="text-xs text-teal-700">다른 기관 · 유사사업</p>
                            <strong className="mt-1 block">{marketSimilarGroup.length}곳</strong>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">관련 업체</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          이번 입찰의 참가업체를 예측한 순위가 아니라, 이 기관 또는 유사사업의 과거 이력에서
                          현재 공고와 접점이 확인된 업체입니다.
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {highlightedOrganizationFieldGroup.length}곳 먼저 보기
                      </Badge>
                    </div>
                    {highlightedOrganizationFieldGroup.length ? (
                      <div className="mt-3 grid gap-3 lg:grid-cols-3">
                        {highlightedOrganizationFieldGroup.map((item) => (
                          <article
                            className="rounded-2xl border bg-card p-5 shadow-sm"
                            key={item.company_number}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <EntityLink
                                type="company"
                                to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name)}`}
                              >
                                {item.company_name}
                              </EntityLink>
                              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                                최근 {item.latest_award_date ?? item.latest_activity_date ?? "미상"}
                              </span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
                              <span className="rounded bg-slate-100 px-2 py-1 font-medium">
                                이 기관 수주 {item.organization_relationship?.award_event_count ?? 0}건
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-1 font-medium">
                                유사사업 {item.similar_project_experience?.event_count ?? 0}건
                              </span>
                              {(item.similar_project_experience?.similar_amount_event_count ?? 0) > 0 && (
                                <span className="rounded bg-blue-50 px-2 py-1 font-medium text-blue-800">
                                  유사규모 {item.similar_project_experience?.similar_amount_event_count ?? 0}
                                  건
                                </span>
                              )}
                            </div>
                            {item.active_years?.length ? (
                              <div className="mt-4 border-t pt-3">
                                <p className="text-xs font-semibold text-muted-foreground">관계 기간</p>
                                <div className="mt-2 flex items-center gap-1">
                                  {item.active_years.map((year) => (
                                    <span
                                      className="flex-1 rounded bg-blue-100 px-1 py-1 text-center text-[10px] font-semibold text-blue-900"
                                      key={year}
                                    >
                                      {year}
                                    </span>
                                  ))}
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {item.first_award_date?.slice(0, 4)}년부터{" "}
                                  {item.latest_award_date?.slice(0, 4)}년까지{" "}
                                  {item.active_year_count ?? item.active_years.length}개 연도에 걸쳐 관련 사업
                                  수주가 확인됩니다.
                                </p>
                              </div>
                            ) : null}
                            {item.representative_notices?.length ? (
                              <details className="mt-4">
                                <summary className="cursor-pointer text-xs font-semibold text-blue-800">
                                  대표 수주공고 {item.representative_notices.length}건 보기
                                </summary>
                                <div className="mt-2 space-y-2 border-l pl-3">
                                  {item.representative_notices.map((representative) => (
                                    <div
                                      className="text-xs"
                                      key={`${item.company_number}-${representative.notice_id}-${representative.awarded_at ?? ""}`}
                                    >
                                      <Link
                                        className="font-medium hover:underline"
                                        to={`/notices/${encodeURIComponent(representative.notice_id)}`}
                                      >
                                        {representative.notice_name ?? representative.notice_id}
                                      </Link>
                                      <p className="mt-0.5 text-muted-foreground">
                                        {representative.awarded_at ?? "날짜 미상"} ·{" "}
                                        {shortMoney(representative.amount)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">
                        현재 기준으로 확인된 이 기관의 관련 사업 경험 업체가 없습니다.
                      </p>
                    )}
                    {remainingOrganizationFieldGroup.length > 0 && (
                      <details className="mt-4 rounded-xl border bg-card">
                        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                          이 기관의 관련 사업 업체 전체 {rankedOrganizationFieldGroup.length}곳 보기
                        </summary>
                        <div className="divide-y border-t">
                          {remainingOrganizationFieldGroup.map((item) => (
                            <div
                              className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_8rem_8rem_7rem] sm:items-center"
                              key={item.company_number}
                            >
                              <EntityLink
                                type="company"
                                to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name)}`}
                              >
                                {item.company_name}
                              </EntityLink>
                              <span className="text-muted-foreground">
                                관련 사업 {item.same_field_event_count ?? 0}건
                              </span>
                              <span className="text-muted-foreground">
                                동일 유형 {item.same_project_type_event_count ?? 0}건
                              </span>
                              <span className="text-muted-foreground">
                                {item.latest_award_date ?? item.latest_activity_date ?? "최근일 미상"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    {activityTrendCompanies.length ? (
                      <details
                        className="mt-6 scroll-mt-[86px] rounded-2xl border bg-card"
                        id="market-structure"
                      >
                        <summary className="cursor-pointer px-5 py-4">
                          <span className="font-semibold">연도별 계약 이력 보기</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            현재 발주기관과 업체 간 계약 규모
                          </span>
                        </summary>
                        <div className="mt-4 overflow-x-auto rounded-2xl border bg-card p-5 shadow-sm">
                          <div className="min-w-[760px]">
                            <div
                              className="grid items-end gap-2 border-b pb-3 text-xs font-semibold text-muted-foreground"
                              style={{
                                gridTemplateColumns: `minmax(12rem, 1.6fr) repeat(${activityTrendYears.length}, minmax(3.5rem, 1fr)) 7rem`,
                              }}
                            >
                              <span>업체</span>
                              {activityTrendYears.map((year) => (
                                <span className="text-center" key={`trend-head-${year}`}>
                                  {year}
                                </span>
                              ))}
                              <span className="text-right">누적 계약금액</span>
                            </div>
                            <div className="divide-y">
                              {activityTrendCompanies.map((item) => {
                                const annualActivity = organizationYearlyActivity(item);
                                const totalAmount =
                                  item.organization_relationship?.total_attributed_contract_amount ??
                                  annualActivity.reduce(
                                    (sum, activity) => sum + (activity.attributed_contract_amount ?? 0),
                                    0,
                                  );
                                const hasIncompleteAmount =
                                  item.organization_relationship?.amount_completeness !== "complete";
                                return (
                                  <button
                                    className="grid w-full items-center gap-2 py-3 text-left hover:bg-muted/30"
                                    style={{
                                      gridTemplateColumns: `minmax(12rem, 1.6fr) repeat(${activityTrendYears.length}, minmax(3.5rem, 1fr)) 7rem`,
                                    }}
                                    key={`trend-${item.company_number}`}
                                    onClick={() => openPlayerRelationship(item.company_number)}
                                    type="button"
                                  >
                                    <span className="truncate text-sm font-semibold">
                                      {item.company_name}
                                    </span>
                                    {activityTrendYears.map((year) => {
                                      const activity = annualActivity.find((entry) => entry.year === year);
                                      const amount = activity?.attributed_contract_amount ?? 0;
                                      const size = activity
                                        ? amount > 0
                                          ? 8 + Math.sqrt(amount / annualContractAmountMax) * 20
                                          : 10
                                        : 8;
                                      const title = activity
                                        ? `${year}년 · 수주 ${activity.award_event_count}건 · ${amount > 0 ? `업체 귀속 계약금액 ${shortMoney(amount)}` : "계약금액 미확인"}`
                                        : `${year}년 확인된 수주 없음`;
                                      return (
                                        <span
                                          className="flex h-8 items-center justify-center"
                                          title={title}
                                          key={`${item.company_number}-${year}`}
                                        >
                                          <i
                                            className={`rounded-full ${!activity ? "bg-slate-100" : activity.amount_completeness === "complete" ? "bg-blue-700" : activity.amount_completeness === "partial" ? "bg-amber-500" : "border-2 border-slate-400 bg-white"}`}
                                            style={{ width: size, height: size }}
                                          />
                                        </span>
                                      );
                                    })}
                                    <span className="text-right text-xs font-semibold">
                                      {totalAmount > 0
                                        ? `${shortMoney(totalAmount)}${hasIncompleteAmount ? "*" : ""}`
                                        : "미확인"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-2">
                            <i className="size-3 rounded-full bg-blue-700" />
                            금액 확인
                          </span>
                          <span className="flex items-center gap-2">
                            <i className="size-3 rounded-full bg-amber-500" />
                            일부 금액 불완전
                          </span>
                          <span className="flex items-center gap-2">
                            <i className="size-3 rounded-full border-2 border-slate-400 bg-white" />
                            금액 미확인
                          </span>
                          <span>원 크기는 해당 연도의 업체 귀속 계약금액을 나타냅니다.</span>
                          <span>* 일부 계약의 업체 귀속금액이 불완전할 수 있습니다.</span>
                        </div>
                      </details>
                    ) : null}
                    {marketStructure?.top_5_share != null && (
                      <section className="mt-10 scroll-mt-[86px]" id="market-concentration">
                        <h3 className="text-lg font-bold">기관 수주 관계</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          현재 발주기관의 관련 사업에서 업체별 귀속 수주 비중을 비교합니다.
                        </p>
                        <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm">
                          <p className="text-sm font-semibold">상위 5개 업체 수주 비중</p>
                          <strong className="mt-2 block text-3xl">
                            {(marketStructure.top_5_share * 100).toFixed(1)}%
                          </strong>
                          <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="bg-blue-700"
                              style={{ width: `${marketStructure.top_5_share * 100}%` }}
                            />
                          </div>
                          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                            <span>상위 5개 업체</span>
                            <span>기타 {((1 - marketStructure.top_5_share) * 100).toFixed(1)}%</span>
                          </div>
                          <p className="mt-4 text-xs leading-5 text-muted-foreground">
                            공동수급 지분을 반영한 업체 귀속 수주량 기준입니다.
                          </p>
                          <details className="mt-5 border-t pt-4">
                            <summary className="cursor-pointer text-sm font-semibold text-blue-800">
                              상세 분포 보기
                            </summary>
                            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                              <div>
                                <dt className="text-xs text-muted-foreground">상위 1개 업체</dt>
                                <dd className="mt-1 text-lg font-bold">
                                  {((marketStructure.top_1_share ?? 0) * 100).toFixed(1)}%
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">상위 3개 업체</dt>
                                <dd className="mt-1 text-lg font-bold">
                                  {((marketStructure.top_3_share ?? 0) * 100).toFixed(1)}%
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">상위 5개 업체</dt>
                                <dd className="mt-1 text-lg font-bold">
                                  {(marketStructure.top_5_share * 100).toFixed(1)}%
                                </dd>
                              </div>
                            </dl>
                          </details>
                        </div>
                      </section>
                    )}
                    {marketSimilarGroup.length > 0 && (
                      <div className="mt-8">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">다른 기관의 유사사업 수주업체</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              현재 기관 이력은 없지만 다른 기관에서 관련 사업을 수주한 업체입니다.
                            </p>
                          </div>
                          <Badge variant="secondary">{marketSimilarGroup.length}곳</Badge>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {marketSimilarGroup.map((item) => (
                            <article className="rounded-xl border bg-card p-4" key={item.company_number}>
                              <EntityLink
                                type="company"
                                to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name)}`}
                              >
                                {item.company_name}
                              </EntityLink>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {companyEvidenceLabel(item)} · 최근 {item.latest_activity_date ?? "미상"}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {item.matched_factors.slice(0, 4).map((factor) => (
                                  <span
                                    className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800"
                                    key={factor}
                                  >
                                    {factorLabel[factor] ?? factor}
                                  </span>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                    {organizationOtherGroup.length > 0 && (
                      <details className="mt-6 rounded-xl border bg-card">
                        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                          이 기관의 다른 사업 업체 {organizationOtherGroup.length}곳
                        </summary>
                        <div className="divide-y border-t">
                          {organizationOtherGroup.map((item) => (
                            <div
                              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                              key={item.company_number}
                            >
                              <EntityLink
                                type="company"
                                to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name)}`}
                              >
                                {item.company_name}
                              </EntityLink>
                              <span className="text-muted-foreground">
                                기관 계약 {item.same_organization_contract_count}건
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                ) : null}
              </section>
              <section className="order-1 mt-10 scroll-mt-[86px]" id="project-lineage">
                <h2 className="text-2xl font-bold">사업 이력</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  직접적인 시스템명·사업내용·원문 근거가 확보된 선행·후속 관계만 제공합니다.
                </p>
                {projectLineage.isLoading ? (
                  <Skeleton className="mt-4 h-32 rounded-2xl" />
                ) : confirmedLineageItems.length ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <div className="divide-y">
                      {confirmedLineageItems.map((item) => {
                        const evidence = item.evidence?.[0];
                        return (
                          <article
                            className="grid gap-4 p-5 sm:grid-cols-[7rem_minmax(0,1fr)_10rem] sm:items-center"
                            key={`${item.predecessor_bid_notice_id}-${item.performing_company_number ?? ""}`}
                          >
                            <div>
                              <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-900">
                                연결 근거 확인
                              </span>
                            </div>
                            <div className="min-w-0">
                              <Link
                                className="font-semibold hover:underline"
                                to={`/notices/${encodeURIComponent(item.predecessor_bid_notice_id)}`}
                              >
                                {evidence?.original_text ?? item.predecessor_bid_notice_id}
                              </Link>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {item.project_stage?.predecessor?.join(" · ") ?? "사업단계 미상"}
                                {item.performing_company_name ? ` · ${item.performing_company_name}` : ""}
                              </p>
                            </div>
                            <div className="text-sm sm:text-right">
                              <p className="font-semibold">{shortMoney(item.contract_amount)}</p>
                              {item.performing_company_number && item.performing_company_name && (
                                <div className="mt-2">
                                  <EntityLink
                                    type="company"
                                    to={`/companies/${encodeURIComponent(item.performing_company_number)}?name=${encodeURIComponent(item.performing_company_name)}`}
                                  >
                                    {item.performing_company_name}
                                  </EntityLink>
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border bg-muted/20 p-5">
                    <p className="font-semibold">현재 확인된 선행사업이 없습니다.</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      공고명·사업내용·시스템명 등의 직접 연결 근거가 확보되면 구축 → 고도화 → 유지관리 관계를
                      제공합니다.
                    </p>
                  </div>
                )}
              </section>
              {false && (organizationActivity.data || organizationSimilarNotices.length > 0) && (
                <>
                  <div className="order-2 mt-10 scroll-mt-[86px]">
                    <h2 className="text-2xl font-bold">발주기관 분석</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      기관 전체 이력과 현재 공고에 가까운 사례를 구분해 보여줍니다.
                    </p>
                  </div>
                  <div className="order-2 mt-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{notice.organization}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">최근 1년 기관 전체 기준</p>
                      </div>
                      {notice.organization_code && (
                        <EntityLink
                          type="organization"
                          to={`/organizations/${encodeURIComponent(notice.organization_code!)}`}
                        >
                          기관 상세
                        </EntityLink>
                      )}
                    </div>
                    <dl className="mt-5 grid gap-5 border-t pt-5 sm:grid-cols-4">
                      <div>
                        <dt className="text-sm text-muted-foreground">낙찰</dt>
                        <dd className="mt-1 text-xl font-bold">
                          {organizationActivity.data?.award_pagination.total_items ?? "-"}건
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">계약</dt>
                        <dd className="mt-1 text-xl font-bold">
                          {organizationActivity.data?.contract_pagination.total_items ?? "-"}건
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">표본 내 낙찰업체</dt>
                        <dd className="mt-1 text-xl font-bold">
                          {recentOrganizationWinnerCount || "-"}
                          {recentOrganizationWinnerCount ? "곳" : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">표본 낙찰금액</dt>
                        <dd className="mt-1 text-xl font-bold">
                          {recentOrganizationAwardAmount ? shortMoney(recentOrganizationAwardAmount) : "-"}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-6 border-t pt-5">
                      <h4 className="text-sm font-semibold">현재 공고에 가까운 기관 사례</h4>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {organizationSimilarNotices.length
                          ? `공고명 기준 ${organizationSimilarNotices.length}건 · 낙찰업체 ${organizationWinners.size}곳`
                          : "현재 기준으로 직접 비교할 기관 사례가 확인되지 않았습니다."}
                      </p>
                    </div>
                    {organizationWinnerCounts.length > 0 && (
                      <div className="mt-6 border-t pt-5">
                        <div className="space-y-4">
                          {organizationWinnerCounts.slice(0, 5).map((item) => (
                            <div
                              className="grid items-center gap-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_4rem]"
                              key={item.companyNumber}
                            >
                              <EntityLink
                                type="company"
                                to={`/companies/${encodeURIComponent(item.companyNumber)}?name=${encodeURIComponent(item.companyName)}`}
                              >
                                {item.companyName}
                              </EntityLink>
                              <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-slate-700"
                                  style={{
                                    width: `${(item.count / organizationSimilarNotices.length) * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="text-right text-sm font-semibold">{item.count}건</span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-5 text-sm leading-6 text-muted-foreground">
                          {topOrganizationWinner && topOrganizationWinner.count >= 2
                            ? `${topOrganizationWinner.companyName}이(가) 이 발주기관의 과거 사례 중 ${topOrganizationShare.toFixed(0)}%를 수주했습니다.`
                            : "과거 사례의 낙찰업체가 여러 업체로 분산되어 있습니다."}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {false && companyRelationshipItems.length > 0 && (
                <div className="order-2">
                  <div className="mt-10">
                    <h2 className="text-2xl font-bold">업체별 과거 이력</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      관련 공고 수주와 현재 발주기관 수주 이력을 함께 확인합니다.
                    </p>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <div className="hidden grid-cols-[minmax(0,1fr)_9rem_10rem_8rem] gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-semibold text-muted-foreground sm:grid">
                      <span>업체</span>
                      <span className="text-right">관련 공고 수주</span>
                      <span className="text-right">이 발주기관 수주</span>
                      <span className="text-right">최근 이력</span>
                    </div>
                    <div className="divide-y">
                      {sortedCompanyRelationshipItems.map((item) => {
                        const latestActivity = [...(item.company.activities ?? [])].sort((left, right) =>
                          (right.activity_date ?? "").localeCompare(left.activity_date ?? ""),
                        )[0];
                        return (
                          <button
                            className={`grid w-full gap-3 px-5 py-4 text-left hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_9rem_10rem_8rem] sm:items-center sm:gap-4 ${selectedRelationshipCompany === item.company.company_number ? "bg-muted/60" : ""}`}
                            onClick={() => setSelectedRelationshipCompany(item.company.company_number)}
                            type="button"
                            key={item.company.company_number}
                          >
                            <span className="font-semibold">{item.company.company_name}</span>
                            <span className="flex justify-between text-sm sm:block sm:text-right">
                              <i className="not-italic text-muted-foreground sm:hidden">과거 사례</i>
                              {item.similarCount}건
                            </span>
                            <span className="flex justify-between text-sm sm:block sm:text-right">
                              <i className="not-italic text-muted-foreground sm:hidden">발주기관</i>
                              {item.organizationCount}건
                            </span>
                            <span className="flex justify-between text-sm text-muted-foreground sm:block sm:text-right">
                              <i className="not-italic sm:hidden">최근 이력</i>
                              {latestActivity?.activity_date ?? item.company.latest_award_date ?? "-"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {selectedMarketCompany && (
                    <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">선택한 업체</p>
                          <div className="mt-2">
                            <EntityLink
                              type="company"
                              to={`/companies/${encodeURIComponent(selectedMarketCompany.company_number)}?name=${encodeURIComponent(selectedMarketCompany.company_name)}`}
                            >
                              {selectedMarketCompany.company_name}
                            </EntityLink>
                          </div>
                        </div>
                        <button
                          className="text-xs font-semibold text-muted-foreground"
                          onClick={() => setSelectedRelationshipCompany(undefined)}
                          type="button"
                        >
                          닫기
                        </button>
                      </div>
                      <div className="mt-5 divide-y border-t">
                        {selectedMarketCompany.activities?.slice(0, 6).map((item, index) => (
                          <div
                            className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
                            key={`${item.bid_notice_id}-${index}`}
                          >
                            <div className="truncate font-medium">
                              {item.bid_notice_id ? (
                                <Link
                                  className="hover:underline"
                                  to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}
                                >
                                  {item.notice_name ?? item.bid_notice_id}
                                </Link>
                              ) : (
                                (item.notice_name ?? "공고명 미제공")
                              )}
                            </div>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <span>
                                {item.is_similar_notice ? "공고명 기준 과거 사례" : ""}
                                {item.is_similar_notice && item.is_same_organization ? " · " : ""}
                                {item.is_same_organization ? "같은 발주기관" : ""}
                              </span>
                              <span>
                                {item.result === "awarded"
                                  ? "낙찰"
                                  : item.result === "contracted"
                                    ? "계약"
                                    : item.opening_rank
                                      ? `${item.opening_rank}순위`
                                      : "참여"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {false && companyRelationshipItems.length > 0 && (
                <>
                  <div className="mt-10">
                    <h2 className="text-2xl font-bold">업체 관계</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      유사 사업 경험과 현재 발주기관 수주 이력을 나누어 확인합니다.
                    </p>
                  </div>
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">두 이력이 모두 있는 업체</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            유사 사업과 현재 발주기관에서 모두 수주 이력이 확인된 업체입니다.
                          </p>
                        </div>
                        <Badge variant="secondary">{overlappingCompanies.length}곳</Badge>
                      </div>
                      {overlappingCompanies.length ? (
                        <div className="mt-5 grid gap-3 lg:grid-cols-2">
                          {overlappingCompanies.map((item) => (
                            <article
                              className={`rounded-xl border p-4 ${selectedHistoryCompany === item.company.company_number ? "border-slate-900 bg-muted/40" : ""}`}
                              key={item.company.company_number}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <EntityLink
                                  type="company"
                                  to={`/companies/${encodeURIComponent(item.company.company_number)}?name=${encodeURIComponent(item.company.company_name)}`}
                                >
                                  {item.company.company_name}
                                </EntityLink>
                                <button
                                  className="shrink-0 text-xs font-semibold text-blue-700"
                                  onClick={() => {
                                    setSelectedHistoryCompany(item.company.company_number);
                                    setHistoryPage(1);
                                  }}
                                  type="button"
                                >
                                  이력 보기
                                </button>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                                <span>
                                  유사 사업 <strong className="text-foreground">{item.similarCount}건</strong>
                                </span>
                                <span>
                                  발주기관{" "}
                                  <strong className="text-foreground">{item.organizationCount}건</strong>
                                </span>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-5 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                          두 이력이 함께 확인된 업체는 없습니다.
                        </p>
                      )}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border bg-card p-5 shadow-sm">
                        <h3 className="font-semibold">유사 사업 수주 업체</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          현재 발주기관 이력 없이 유사 사업 경험이 확인된 업체입니다.
                        </p>
                        <div className="mt-5 space-y-4">
                          {similarOnlyCompanies.map((item) => (
                            <div key={item.company.company_number}>
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <EntityLink
                                  type="company"
                                  to={`/companies/${encodeURIComponent(item.company.company_number)}?name=${encodeURIComponent(item.company.company_name)}`}
                                >
                                  {item.company.company_name}
                                </EntityLink>
                                <button
                                  className="shrink-0 font-semibold"
                                  onClick={() => {
                                    setSelectedHistoryCompany(item.company.company_number);
                                    setHistoryPage(1);
                                  }}
                                  type="button"
                                >
                                  {item.similarCount}건
                                </button>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-blue-600"
                                  style={{ width: `${(item.similarCount / relationshipMax) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                          {!similarOnlyCompanies.length && (
                            <p className="text-sm text-muted-foreground">해당 업체가 없습니다.</p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl border bg-card p-5 shadow-sm">
                        <h3 className="font-semibold">발주기관 거래 업체</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          유사 사업 이력 없이 현재 발주기관 수주 이력이 확인된 업체입니다.
                        </p>
                        <div className="mt-5 space-y-4">
                          {organizationOnlyCompanies.map((item) => (
                            <div key={item.company.company_number}>
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <EntityLink
                                  type="company"
                                  to={`/companies/${encodeURIComponent(item.company.company_number)}?name=${encodeURIComponent(item.company.company_name)}`}
                                >
                                  {item.company.company_name}
                                </EntityLink>
                                <button
                                  className="shrink-0 font-semibold"
                                  onClick={() => {
                                    setSelectedHistoryCompany(item.company.company_number);
                                    setHistoryPage(1);
                                  }}
                                  type="button"
                                >
                                  {item.organizationCount}건
                                </button>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-slate-500"
                                  style={{ width: `${(item.organizationCount / relationshipMax) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                          {!organizationOnlyCompanies.length && (
                            <p className="text-sm text-muted-foreground">해당 업체가 없습니다.</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedMarketCompany && selectedCompanyCounts && (
                      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">선택한 업체</p>
                            <div className="mt-2">
                              <EntityLink
                                type="company"
                                to={`/companies/${encodeURIComponent(selectedMarketCompany.company_number)}?name=${encodeURIComponent(selectedMarketCompany.company_name)}`}
                              >
                                {selectedMarketCompany.company_name}
                              </EntityLink>
                            </div>
                          </div>
                          <button
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSelectedHistoryCompany(undefined);
                              setHistoryPage(1);
                            }}
                            type="button"
                          >
                            선택 해제
                          </button>
                        </div>
                        <dl className="mt-5 grid gap-4 border-t pt-5 text-sm sm:grid-cols-4">
                          <div>
                            <dt className="text-muted-foreground">유사 사업 낙찰</dt>
                            <dd className="mt-1 font-semibold">
                              {uniqueActivityCount(selectedMarketCompany, "similar", "award")}건
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">유사 사업 계약</dt>
                            <dd className="mt-1 font-semibold">
                              {uniqueActivityCount(selectedMarketCompany, "similar", "contract")}건
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">발주기관 낙찰</dt>
                            <dd className="mt-1 font-semibold">
                              {uniqueActivityCount(selectedMarketCompany, "organization", "award")}건
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">발주기관 계약</dt>
                            <dd className="mt-1 font-semibold">
                              {uniqueActivityCount(selectedMarketCompany, "organization", "contract")}건
                            </dd>
                          </div>
                        </dl>
                        {selectedMarketCompany.activities?.length ? (
                          <div className="mt-5 border-t pt-5">
                            <p className="text-sm font-semibold">확인된 이력</p>
                            <div className="mt-3 divide-y">
                              {selectedMarketCompany.activities!.slice(0, 5).map((item, index) => (
                                <div
                                  className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
                                  key={`${item.bid_notice_id}-${item.bid_classification_number ?? ""}-${item.rebid_number ?? ""}-${index}`}
                                >
                                  <div className="min-w-0">
                                    <div className="truncate font-medium">
                                      {item.bid_notice_id ? (
                                        <Link
                                          className="hover:underline"
                                          to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}
                                        >
                                          {item.notice_name ?? item.bid_notice_id}
                                        </Link>
                                      ) : (
                                        (item.notice_name ?? "공고명 미제공")
                                      )}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {item.is_similar_notice && "유사 사업"}
                                      {item.is_similar_notice && item.is_same_organization && " · "}
                                      {item.is_same_organization && "같은 발주기관"}
                                    </p>
                                  </div>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {item.result === "awarded"
                                      ? "낙찰"
                                      : item.result === "contracted"
                                        ? "계약"
                                        : item.opening_rank
                                          ? `${item.opening_rank}순위`
                                          : "참여"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </>
              )}

              {hasStrongComparison && false && (
                <div className="mt-10 scroll-mt-[86px]" id="results">
                  <h2 className="text-2xl font-bold">비교 가능한 과거 사업</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    현재 공고와 직접 비교할 근거가 충분한 경우에만 과거 사례와 실제 낙찰업체를 보여줍니다.
                  </p>
                </div>
              )}
              {highComparisonNotices.length > 0 && false && (
                <section className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold">가장 가까운 과거 사례</h3>
                    <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900">
                      비교 가능성 높음 · {highComparisonNotices.length}건
                    </span>
                  </div>
                  <div className="mt-3 divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
                    {highComparisonNotices.map((item) => (
                      <article className="p-5 sm:p-6" key={`high-${item.id}`}>
                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_12rem]">
                          <div>
                            <div>
                              <EntityLink
                                type="notice"
                                to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
                              >
                                {item.notice_name}
                              </EntityLink>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {item.organization_name} ·{" "}
                              {item.notice_published_date ?? item.award_date ?? "날짜 미상"}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="rounded bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800">
                                동일 발주기관
                              </span>
                              {currentTrade && (
                                <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                                  {currentTrade} 공종
                                </span>
                              )}
                              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">
                                동일 업무구분
                              </span>
                            </div>
                          </div>
                          <dl className="space-y-3 border-t pt-4 text-sm lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                            <div>
                              <dt className="text-muted-foreground">낙찰업체</dt>
                              <dd className="mt-1 font-semibold">
                                {item.company_number && item.company_name ? (
                                  <EntityLink
                                    type="company"
                                    to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name)}`}
                                  >
                                    {item.company_name}
                                  </EntityLink>
                                ) : (
                                  (item.company_name ?? "미제공")
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">낙찰금액</dt>
                              <dd className="mt-1 font-semibold">{shortMoney(item.winning_amount)}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">낙찰률</dt>
                              <dd className="mt-1 font-semibold">
                                {item.winning_rate ? `${item.winning_rate}%` : "미제공"}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {false && !hasStrongComparison && (
                <section className="mt-5 rounded-2xl border bg-muted/20 p-5 sm:p-6">
                  <p className="font-semibold">현재 직접 비교 가능한 과거 사업은 확인되지 않았습니다.</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    공고명만 유사한 탐색 결과는 기본 화면에서 제외합니다.
                  </p>
                </section>
              )}

              {hasStrongComparison && false && (
                <>
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold">관련 과거 사례</h3>
                    <span className="text-sm font-semibold text-muted-foreground">
                      {relatedPastNotices.length}건
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    사업이나 시설은 관련되지만 공종·범위가 다를 수 있는 탐색 결과입니다.
                  </p>
                  {comparableStatisticsReady && (
                    <dl className="mt-4 grid overflow-hidden rounded-2xl border bg-card shadow-sm sm:grid-cols-3 sm:divide-x">
                      <div className="p-5">
                        <dt className="text-sm text-muted-foreground">비교 가능 사례</dt>
                        <dd className="mt-2 text-xl font-bold">{similarNotices.length}건</dd>
                      </div>
                      <div className="border-t p-5 sm:border-t-0">
                        <dt className="text-sm text-muted-foreground">낙찰률 범위</dt>
                        <dd className="mt-2 text-xl font-bold">
                          {rateRange
                            ? `${rateRange!.min.toFixed(1)}~${rateRange!.max.toFixed(1)}%`
                            : "자료 부족"}
                        </dd>
                      </div>
                      <div className="border-t p-5 sm:border-t-0">
                        <dt className="text-sm text-muted-foreground">낙찰률 중앙값</dt>
                        <dd className="mt-2 text-xl font-bold">
                          {median != null ? `${median!.toFixed(1)}%` : "자료 부족"}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <div className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
                    {historyItems.map((item) => {
                      const sameOrganization = Boolean(
                        item.organization_code &&
                        notice.organization_code &&
                        item.organization_code === notice.organization_code,
                      );
                      const contractPartners = companies.filter(
                        (company) =>
                          company.company_number !== item.company_number &&
                          company.activities?.some(
                            (entry) => entry.bid_notice_id === item.bid_notice_id && entry.contracted,
                          ),
                      );
                      return (
                        <article className="p-5 sm:p-6" key={item.id}>
                          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_11rem]">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                                  공고명 유사
                                </span>
                                {sameOrganization && <Badge variant="secondary">같은 발주기관</Badge>}
                              </div>
                              <div className="mt-2">
                                <EntityLink
                                  type="notice"
                                  to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
                                >
                                  {item.notice_name}
                                </EntityLink>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span>
                                  {item.organization_code && item.organization_name ? (
                                    <EntityLink
                                      type="organization"
                                      to={`/organizations/${encodeURIComponent(item.organization_code)}`}
                                    >
                                      {item.organization_name}
                                    </EntityLink>
                                  ) : (
                                    (item.organization_name ?? "발주기관 정보 없음")
                                  )}
                                </span>
                                <span>·</span>
                                <span>{item.notice_published_date ?? item.award_date ?? "날짜 미상"}</span>
                              </div>
                              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                                <div className="flex items-center gap-3">
                                  <dt className="w-24 shrink-0 text-muted-foreground">낙찰업체</dt>
                                  <dd className="font-semibold">
                                    {item.company_number && item.company_name ? (
                                      <EntityLink
                                        type="company"
                                        to={`/companies/${encodeURIComponent(item.company_number)}?name=${encodeURIComponent(item.company_name)}`}
                                      >
                                        {item.company_name}
                                      </EntityLink>
                                    ) : (
                                      (item.company_name ?? "정보 미제공")
                                    )}
                                  </dd>
                                </div>
                                {contractPartners.length > 0 && (
                                  <div className="flex items-start gap-3">
                                    <dt className="w-24 shrink-0 text-muted-foreground">계약 참여</dt>
                                    <dd className="flex flex-wrap gap-2">
                                      {contractPartners.map((company) => (
                                        <EntityLink
                                          type="company"
                                          to={`/companies/${encodeURIComponent(company.company_number)}?name=${encodeURIComponent(company.company_name)}`}
                                          key={company.company_number}
                                        >
                                          {company.company_name}
                                        </EntityLink>
                                      ))}
                                    </dd>
                                  </div>
                                )}
                              </dl>
                            </div>
                            <div className="border-t pt-4 text-sm lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                              <p className="text-muted-foreground">낙찰금액</p>
                              <p className="mt-1 text-lg font-bold">{shortMoney(item.winning_amount)}</p>
                              <p className="mt-3 text-muted-foreground">낙찰률</p>
                              <p className="mt-1 font-semibold">
                                {item.winning_rate ? `${item.winning_rate}%` : "미제공"}
                              </p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    {!historyItems.length && (
                      <p className="p-8 text-center text-sm text-muted-foreground">
                        공고명이 비슷한 과거 사례가 없습니다.
                      </p>
                    )}
                  </div>

                  {historyTotalPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <Button
                        disabled={historyPage <= 1}
                        onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                        variant="outline"
                      >
                        이전
                      </Button>
                      <span className="text-sm font-medium">
                        {historyPage} / {historyTotalPages}
                      </span>
                      <Button
                        disabled={historyPage >= historyTotalPages}
                        onClick={() => setHistoryPage((page) => Math.min(historyTotalPages, page + 1))}
                        variant="outline"
                      >
                        다음
                      </Button>
                    </div>
                  )}

                  {pastCaseCompanies.length > 0 && (
                    <section className="mt-8">
                      <h3 className="text-lg font-bold">과거 사례에서 확인된 업체</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        위 공고의 실제 낙찰 결과를 기준으로 집계했습니다.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {pastCaseCompanies.map(([companyNumber, companyName]) => (
                          <EntityLink
                            type="company"
                            to={`/companies/${encodeURIComponent(companyNumber)}?name=${encodeURIComponent(companyName)}`}
                            key={companyNumber}
                          >
                            {companyName}
                          </EntityLink>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {comparableStatisticsReady && (
                <details className="mt-4 rounded-2xl border bg-card shadow-sm">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
                    낙찰 수준 보기 · 중앙값 {median?.toFixed(1)}%
                  </summary>
                  <div className="border-t p-6">
                    <p className="mb-6 text-sm text-muted-foreground">가로는 낙찰일, 세로는 낙찰률입니다.</p>
                    <div className="relative h-64 pl-12 pb-8">
                      <div className="absolute inset-x-12 top-0 bottom-8 border-b border-l border-slate-300">
                        {[80, 85, 90, 95, 100].map((tick) => (
                          <div
                            className="absolute inset-x-0 border-t border-dashed border-slate-200"
                            style={{ bottom: `${(tick - 80) * 5}%` }}
                            key={tick}
                          >
                            <span className="absolute right-full mr-2 -translate-y-1/2 text-xs text-muted-foreground">
                              {tick}%
                            </span>
                          </div>
                        ))}
                        {chartYears.map((year) => {
                          const position = Math.max(
                            0,
                            Math.min(
                              100,
                              ((new Date(year, 0, 1).getTime() - chartStart) / (chartEnd - chartStart)) * 100,
                            ),
                          );
                          return (
                            <span
                              className="absolute top-full mt-2 -translate-x-1/2 text-xs text-muted-foreground"
                              style={{ left: `${position}%` }}
                              key={year}
                            >
                              {year}
                            </span>
                          );
                        })}
                        {rates.map((item) => (
                          <button
                            aria-label={`${item.name}: ${item.awardDate}, 낙찰률 ${item.rate}%`}
                            className="group absolute z-10 size-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-blue-700 shadow outline-none ring-blue-300 hover:z-40 focus:z-40 focus:ring-4"
                            style={{
                              left: `${Math.max(0, Math.min(100, ((item.awardTime - chartStart) / (chartEnd - chartStart)) * 100))}%`,
                              bottom: `${Math.max(0, Math.min(100, (item.rate - 80) * 5))}%`,
                            }}
                            type="button"
                            key={item.id}
                          >
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-max max-w-64 -translate-x-1/2 rounded-lg bg-slate-950 px-3 py-2 text-left text-xs font-medium leading-5 text-white shadow-xl group-hover:block group-focus:block">
                              {item.name}
                              <br />
                              {item.awardDate ?? "낙찰일 미상"} · 낙찰률 {item.rate}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
              )}

              {(comparableStatisticsReady || closestPastNotice) && (
                <section className="order-3 mt-10">
                  <h2 className="text-2xl font-bold">가격 참고</h2>
                  <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                    {comparableStatisticsReady ? (
                      <p className="text-sm leading-6">
                        비교 가능한 과거 사례 {rates.length}건의 낙찰률 중앙값은{" "}
                        <strong>{median?.toFixed(1)}%</strong>입니다. 위 낙찰 수준에서 분포와 사례를 확인할 수
                        있습니다.
                      </p>
                    ) : closestPastNotice ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">통계 벤치마크는 제공하지 않습니다.</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              대신 동일 발주기관·동종 {workType[notice.work_type] ?? "사업"}의 단일 참고사례를
                              제공합니다.
                            </p>
                          </div>
                          <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                            참고사례 1건
                          </span>
                        </div>
                        <dl className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-3">
                          <div>
                            <dt className="text-sm text-muted-foreground">과거 공고</dt>
                            <dd className="mt-1 font-semibold">{closestPastNotice.notice_name}</dd>
                          </div>
                          <div>
                            <dt className="text-sm text-muted-foreground">낙찰금액</dt>
                            <dd className="mt-1 font-semibold">
                              {shortMoney(closestPastNotice.winning_amount)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm text-muted-foreground">낙찰률</dt>
                            <dd className="mt-1 font-semibold">
                              {closestPastNotice.winning_rate
                                ? `${closestPastNotice.winning_rate}%`
                                : "미제공"}
                            </dd>
                          </div>
                        </dl>
                        <p className="mt-5 text-xs leading-5 text-muted-foreground">
                          단일 사례이며 공사범위·예정가격 차이가 있을 수 있으므로 적정 투찰률을 의미하지
                          않습니다.
                        </p>
                      </>
                    ) : null}
                  </div>
                </section>
              )}
            </div>
          )}
        </section>
      )}
      {selectedPlayer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedPlayer.company_name}과 ${notice.organization} 관계`}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSelectedPlayerNumber(undefined);
          }}
        >
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 px-6 py-5 backdrop-blur sm:px-8">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">업체 × 발주기관 관계</p>
                <h2 className="mt-1 text-xl font-bold">
                  {selectedPlayer.company_name} × {notice.organization}
                </h2>
              </div>
              <button
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
                onClick={() => setSelectedPlayerNumber(undefined)}
                type="button"
              >
                닫기
              </button>
            </div>
            <div className="p-6 sm:p-8">
              <section>
                <h3 className="font-bold">관계 요약</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {(
                    selectedPlayerOrganizationSummary?.first_award_date ?? selectedPlayer.first_award_date
                  )?.slice(0, 4) ?? "확인된 기간"}
                  년부터{" "}
                  {(
                    selectedPlayerOrganizationSummary?.latest_award_date ?? selectedPlayer.latest_award_date
                  )?.slice(0, 4) ?? "최근"}
                  년까지{" "}
                  {selectedPlayerOrganizationSummary?.active_year_count ??
                    selectedPlayer.active_year_count ??
                    selectedPlayer.active_years?.length ??
                    0}
                  개 연도에서 이 기관 수주{" "}
                  {selectedPlayerOrganizationSummary?.award_event_count ??
                    selectedPlayer.same_field_event_count ??
                    0}
                  건이 확인됩니다.
                  {selectedPlayerContractAmount > 0
                    ? ` 확인된 누적 계약금액은 ${shortMoney(selectedPlayerContractAmount)}${selectedPlayerAmountIncomplete ? "*" : ""}입니다.`
                    : ""}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border sm:grid-cols-4">
                  <div className="bg-card p-4">
                    <dt className="text-xs text-muted-foreground">이 기관 수주</dt>
                    <dd className="mt-1 text-xl font-bold">
                      {selectedPlayerOrganizationSummary?.award_event_count ??
                        selectedPlayer.same_field_event_count ??
                        0}
                      건
                    </dd>
                  </div>
                  <div className="bg-card p-4">
                    <dt className="text-xs text-muted-foreground">활동 연도</dt>
                    <dd className="mt-1 text-xl font-bold">
                      {selectedPlayerOrganizationSummary?.active_year_count ??
                        selectedPlayer.active_year_count ??
                        selectedPlayer.active_years?.length ??
                        0}
                      개
                    </dd>
                  </div>
                  <div className="bg-card p-4">
                    <dt className="text-xs text-muted-foreground">누적 계약금액</dt>
                    <dd className="mt-1 text-lg font-bold">
                      {selectedPlayerContractAmount > 0
                        ? `${shortMoney(selectedPlayerContractAmount)}${selectedPlayerAmountIncomplete ? "*" : ""}`
                        : "미확인"}
                    </dd>
                  </div>
                  <div className="bg-card p-4">
                    <dt className="text-xs text-muted-foreground">최근 수주</dt>
                    <dd className="mt-1 text-sm font-bold">
                      {selectedPlayerOrganizationSummary?.latest_award_date ??
                        selectedPlayer.latest_award_date ??
                        selectedPlayer.latest_activity_date ??
                        "미상"}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="mt-8 border-t pt-7">
                <h3 className="font-bold">현재 공고와의 접점</h3>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-md bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-900">
                    기관 관련사업 {selectedPlayer.same_field_event_count ?? 0}건
                  </span>
                  {(selectedPlayer.same_project_type_event_count ?? 0) > 0 && (
                    <span className="rounded-md bg-slate-100 px-2.5 py-1.5 font-semibold">
                      {analysisBasis?.project_type?.label ?? "동일 사업유형"}{" "}
                      {selectedPlayer.same_project_type_event_count}건
                    </span>
                  )}
                  {(selectedPlayer.similar_amount_event_count ?? 0) > 0 && (
                    <span className="rounded-md bg-slate-100 px-2.5 py-1.5 font-semibold">
                      유사 금액대 {selectedPlayer.similar_amount_event_count}건
                    </span>
                  )}
                </div>
              </section>

              {selectedPlayerAnnualActivity.length > 0 && (
                <section className="mt-8 border-t pt-7">
                  <h3 className="font-bold">연도별 계약 이력</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    수주 건수, 업체 귀속 계약금액과 공동수급 역할을 함께 확인합니다.
                  </p>
                  <div className="mt-4 overflow-hidden rounded-xl border">
                    <div className="hidden grid-cols-[4rem_5rem_minmax(7rem,1fr)_minmax(0,1.4fr)] gap-3 bg-muted/40 px-4 py-2.5 text-xs font-semibold text-muted-foreground sm:grid">
                      <span>연도</span>
                      <span>수주</span>
                      <span>계약금액</span>
                      <span>계약 역할</span>
                    </div>
                    <div className="divide-y">
                      {[...selectedPlayerAnnualActivity]
                        .sort((a, b) => b.year - a.year)
                        .map((item) => {
                          const roles = [
                            item.sole_count ? `단독 ${item.sole_count}` : "",
                            item.consortium_lead_count ? `공동수급 대표 ${item.consortium_lead_count}` : "",
                            item.consortium_member_count
                              ? `공동수급 구성원 ${item.consortium_member_count}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ");
                          return (
                            <div
                              className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[4rem_5rem_minmax(7rem,1fr)_minmax(0,1.4fr)] sm:items-center sm:gap-3"
                              key={`drawer-annual-${item.year}`}
                            >
                              <strong>{item.year}</strong>
                              <span>{item.award_event_count}건</span>
                              <span className="font-semibold">
                                {item.attributed_contract_amount != null
                                  ? shortMoney(item.attributed_contract_amount)
                                  : "미확인"}
                                {item.amount_completeness === "partial" ? "*" : ""}
                              </span>
                              <span className="text-xs text-muted-foreground">{roles || "역할 미확인"}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                  {selectedPlayerAmountIncomplete && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      * 일부 연도의 업체 귀속 계약금액이 불완전하거나 확인되지 않았습니다.
                    </p>
                  )}
                </section>
              )}

              {selectedPlayerRoles.sole + selectedPlayerRoles.lead + selectedPlayerRoles.member > 0 && (
                <section className="mt-8 border-t pt-7">
                  <h3 className="font-bold">계약 역할</h3>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">단독</p>
                      <strong className="mt-1 block">{selectedPlayerRoles.sole}건</strong>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">공동수급 대표</p>
                      <strong className="mt-1 block">{selectedPlayerRoles.lead}건</strong>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">공동수급 구성원</p>
                      <strong className="mt-1 block">{selectedPlayerRoles.member}건</strong>
                    </div>
                  </div>
                </section>
              )}

              <section className="mt-8 border-t pt-7">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="font-bold">이 기관의 실제 수주 공고</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      현재 사업과의 유사 여부와 관계없이 이 업체가 해당 기관에서 수주한 전체 이력을 최근순으로
                      보여줍니다.
                    </p>
                  </div>
                  {organizationCompanyRelationship.data?.pagination && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      전체 {organizationCompanyRelationship.data.pagination.total_items}건
                    </span>
                  )}
                </div>
                {organizationCompanyRelationship.isLoading ? (
                  <Skeleton className="mt-4 h-64 rounded-xl" />
                ) : organizationCompanyRelationship.isError ? (
                  <p className="mt-4 rounded-xl border p-4 text-sm text-muted-foreground">
                    전체 수주 공고를 불러오지 못했습니다.
                  </p>
                ) : organizationCompanyRelationship.data?.events.length ? (
                  <>
                    <div className="mt-4 divide-y overflow-hidden rounded-xl border">
                      {organizationCompanyRelationship.data.events.map((item) => {
                        const eventDate = item.contract_date ?? item.award_date ?? item.notice_published_date;
                        const eventDateLabel = item.contract_date
                          ? "계약일"
                          : item.award_date
                            ? "낙찰일"
                            : "게시일";
                        const roleLabel =
                          item.company_role === "sole"
                            ? "단독"
                            : item.company_role === "consortium_lead"
                              ? "공동수급 대표"
                              : item.company_role === "consortium_member"
                                ? "공동수급 구성원"
                                : "역할 미상";
                        const displayedAmount =
                          item.attributed_contract_amount ?? item.contract_amount ?? item.award_amount;
                        return (
                          <article className="p-4" key={item.award_event_id}>
                            <Link
                              className="text-sm font-semibold leading-6 text-blue-900 hover:underline"
                              to={`/notices/${encodeURIComponent(item.bid_notice_id)}`}
                            >
                              {item.notice_name ?? item.bid_notice_id}
                            </Link>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                              <span className="rounded bg-slate-100 px-2 py-1 font-medium">
                                {item.project_type_label ?? "유형 미상"}
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-1 font-medium">
                                {roleLabel}
                                {item.share_percent != null && item.company_role !== "sole"
                                  ? ` · 지분 ${item.share_percent}%`
                                  : ""}
                              </span>
                              {item.is_similar_amount && (
                                <span className="rounded bg-blue-50 px-2 py-1 font-semibold text-blue-800">
                                  유사 금액대
                                </span>
                              )}
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-[8rem_minmax(0,1fr)]">
                              <span>
                                {eventDateLabel} {eventDate ?? "미상"}
                              </span>
                              <span className="sm:text-right">
                                {item.attributed_contract_amount != null
                                  ? "업체 귀속 "
                                  : item.contract_amount != null
                                    ? "계약금액 "
                                    : "낙찰금액 "}
                                <strong className="text-foreground">{shortMoney(displayedAmount)}</strong>
                                {item.attributed_contract_amount_completeness === "partial"
                                  ? "*"
                                  : item.attributed_contract_amount_completeness === "unknown" &&
                                      item.attributed_contract_amount == null
                                    ? " · 귀속금액 미확인"
                                    : ""}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {organizationCompanyRelationship.data.pagination.total_pages > 1 && (
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <Button
                          disabled={relationshipPage <= 1}
                          onClick={() => setRelationshipPage((page) => Math.max(1, page - 1))}
                          size="sm"
                          variant="outline"
                        >
                          이전
                        </Button>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {organizationCompanyRelationship.data.pagination.page} /{" "}
                          {organizationCompanyRelationship.data.pagination.total_pages}
                        </span>
                        <Button
                          disabled={
                            relationshipPage >= organizationCompanyRelationship.data.pagination.total_pages
                          }
                          onClick={() => setRelationshipPage((page) => page + 1)}
                          size="sm"
                          variant="outline"
                        >
                          다음
                        </Button>
                      </div>
                    )}
                    {organizationCompanyRelationship.data.data_completeness?.status !== "complete" && (
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        * 공동수급 지분 또는 일부 계약금액의 업체 귀속이 불완전할 수 있습니다.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-4 rounded-xl border p-4 text-sm text-muted-foreground">
                    확인된 수주 공고가 없습니다.
                  </p>
                )}
              </section>

              <div className="mt-8 flex items-center justify-between gap-4 border-t pt-5">
                <p className="text-xs leading-5 text-muted-foreground">
                  공고명을 선택하면 해당 공고 상세로 이동합니다.
                </p>
                <EntityLink
                  type="company"
                  to={`/companies/${encodeURIComponent(selectedPlayer.company_number)}?name=${encodeURIComponent(selectedPlayer.company_name)}`}
                >
                  업체 전체 분석
                </EntityLink>
              </div>
            </div>
          </aside>
        </div>
      )}
    </PageContainer>
  );
}
