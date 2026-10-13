import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyProcurementProfile, type CompanyProcurementProfile } from "@/features/company-context/api";
import {
  useOrganizationProcurementProfile,
  type OrganizationProcurementProfile,
} from "@/features/organizations/api";
import { participationSuccessRate } from "@/features/company-context/participation-presentation";
import { entityDetailPath } from "@/shared/navigation/entity-links";
import { formatExactMoney } from "@/shared/format/money";
import { ExplorerProfileSections } from "./ExplorerProfileSections";
import { entityKey, type ExplorerEntity, type ExplorerLink } from "./useNetworkExplorer";

export function ExplorerInspector({
  entity,
  params,
  fromYear,
  toYear,
  onCenter,
  onSelect,
  links,
  preloadedCompany,
  preloadedOrganization,
  pageSize = 5,
}: {
  entity: ExplorerEntity;
  params: URLSearchParams;
  fromYear: number;
  toYear: number;
  onCenter: () => void;
  onSelect: (entity: ExplorerEntity) => void;
  links: ExplorerLink[];
  preloadedCompany?: CompanyProcurementProfile;
  preloadedOrganization?: OrganizationProcurementProfile;
  pageSize?: number;
}) {
  const filters = {
    workType: params.get("workType") ?? undefined,
    fieldCode: params.get("field") ?? undefined,
    largeCategory: params.get("large") ?? undefined,
    middleCategory: params.get("middle") ?? undefined,
  };
  const company = useCompanyProcurementProfile(
    entity.type === "company" ? entity.id : undefined,
    {
      fromYear,
      toYear,
      ...filters,
      pageSize,
    },
    !preloadedCompany,
  );
  const organization = useOrganizationProcurementProfile(
    entity.type === "organization" ? entity.id : undefined,
    toYear - fromYear + 1,
    filters,
    entity.type === "organization" && !preloadedOrganization,
    { from: fromYear, to: toYear },
    { pageSize, sort: "contract_amount_desc" },
  );
  const query = entity.type === "company" ? company : organization;
  const companyData =
    preloadedCompany ?? (!company.isPlaceholderData && !company.isError ? company.data : undefined);
  const organizationData =
    preloadedOrganization ??
    (!organization.isPlaceholderData && !organization.isError ? organization.data : undefined);
  const data = entity.type === "company" ? companyData : organizationData;
  const visibleRelationships = links
    .filter(
      (link) =>
        link.kind === "contract" &&
        (entityKey(link.source) === entityKey(entity) || entityKey(link.target) === entityKey(entity)),
    )
    .map((link) => ({
      peer: entityKey(link.source) === entityKey(entity) ? link.target : link.source,
      relationship: link.relationship,
    }))
    .sort(
      (a, b) =>
        (b.relationship.total_attributed_contract_amount ?? 0) -
        (a.relationship.total_attributed_contract_amount ?? 0),
    );
  const visibleAmount = visibleRelationships.reduce(
    (sum, item) => sum + (item.relationship.total_attributed_contract_amount ?? 0),
    0,
  );
  const visibleCount = visibleRelationships.reduce(
    (sum, item) => sum + item.relationship.contract_event_count,
    0,
  );
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium text-primary">
          {entity.type === "company" ? "계약업체" : "발주기관"}
        </p>
        <h2 className="mt-2 text-xl font-bold">{entity.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {fromYear}–{toYear}년 · 선택 조건 기준
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onCenter}>이곳의 거래처 보기</Button>
          <Button asChild variant="outline">
            <Link
              to={entityDetailPath(entity.type === "company" ? "company" : "organization", entity.id, {
                source: "relationship",
                params,
                name: entity.name,
              })}
            >
              상세 보기
            </Link>
          </Button>
        </div>
      </header>
      {data ? (
        <dl className="space-y-3 border-y py-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">계약금액</dt>
            <dd className="font-semibold">
              {formatExactMoney(data?.summary.total_attributed_contract_amount)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">계약 건수</dt>
            <dd>
              {data?.summary.contract_event_count == null
                ? "확인 필요"
                : `${data.summary.contract_event_count}건`}
            </dd>
          </div>
          {entity.type === "company" && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">거래기관</dt>
                <dd>{companyData?.summary.organization_count ?? "확인 필요"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">낙찰률 (수집 기록)</dt>
                <dd>
                  {participationSuccessRate(companyData?.participation_analysis?.summary) ?? "확인 필요"}
                </dd>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                수집된 참여 기록 중 결과가 확인된 건만 계산했습니다. 실제 낙찰률과 다를 수 있습니다.
              </p>
            </>
          )}
        </dl>
      ) : visibleRelationships.length ? (
        <section className="space-y-3 border-y py-4 text-sm" aria-label="표시된 관계 요약">
          <p className="text-xs text-muted-foreground">화면에 표시된 관계 기준 · 전체 분석은 별도 조회</p>
          <dl className="space-y-2">
            <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">표시된 관계 금액</dt>
              <dd className="font-semibold">
                {visibleRelationships.some(
                  (item) => item.relationship.total_attributed_contract_amount != null,
                )
                  ? formatExactMoney(visibleAmount)
                  : "확인 필요"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">관계별 계약 건수</dt>
              <dd>{visibleCount}건</dd>
            </div>
          </dl>
          <div>
            <h3 className="text-xs font-semibold">
              연결된 {entity.type === "organization" ? "업체" : "기관"}
            </h3>
            <ul className="mt-2 space-y-1">
              {visibleRelationships.slice(0, 5).map(({ peer, relationship }) => (
                <li key={entityKey(peer)} className="flex justify-between gap-2 text-xs">
                  <span className="truncate">{peer.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {relationship.contract_event_count}건
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <Skeleton className="h-28" />
      )}
      {!data && query.isError && (
        <p role="alert" className="text-sm">
          전체 분석을 불러오지 못했습니다.{" "}
          <Button variant="link" onClick={() => void query.refetch()}>
            다시 시도
          </Button>
        </p>
      )}
      {data &&
        (data.truncated ||
          data.data_completeness?.status === "partial" ||
          data.summary.amount_completeness !== "complete") && (
          <p className="text-xs text-amber-700 dark:text-amber-400">일부 실적·금액만 확인됐습니다.</p>
        )}
      {data && (
        <ExplorerProfileSections
          entity={entity}
          company={companyData}
          organization={organizationData}
          fromYear={fromYear}
          toYear={toYear}
          params={params}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
