import { ArrowUpRight, BriefcaseBusiness, Hammer, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { EntitySectionHeader } from "@/components/common/entity-detail-section";
import { SectionError } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKoreanDate } from "@/shared/format/date";
import { formatCompactMoney } from "@/shared/format/money";
import { entityDetailPath } from "@/shared/navigation/entity-links";
import { useCompanySectorDiscovery } from "./api";

const sectors = [
  {
    workType: "goods",
    title: "물품",
    description: "어떤 제품 분야에서 실적을 쌓고 있을까요?",
    icon: Package,
  },
  {
    workType: "service",
    title: "용역",
    description: "어떤 서비스 분야에서 주요 업체가 활동할까요?",
    icon: BriefcaseBusiness,
  },
  {
    workType: "construction",
    title: "공사",
    description: "어떤 공사 분야에서 계약 실적이 두드러질까요?",
    icon: Hammer,
  },
] as const;

export function CompanySectorDiscovery() {
  const query = useCompanySectorDiscovery();
  return (
    <section className="mt-10" aria-label="물품 용역 공사별 주요 실적 업체">
      <EntitySectionHeader
        title="분야에서 찾는 주요 실적 업체"
        description="물품·용역·공사의 대형 계약에서 확인된 분야와 해당 분야 업체의 연간 실적을 함께 살펴보세요."
        meta={query.data && `${query.data.year}년 계약 실적`}
      />
      {query.isError ? (
        <div className="mt-5">
          <SectionError title="분야별 실적 업체" error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {sectors.map(({ workType, title, description, icon: Icon }) => {
            const sector = query.data?.sectors.find((item) => item.work_type === workType);
            return (
              <section key={workType} aria-label={`${title} 주요 분야와 업체`}>
                <div className="flex items-center gap-3 border-b pb-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold">{title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-5 lg:grid-cols-2" aria-busy={query.isFetching}>
                  {query.isFetching ? (
                    [1, 2].map((key) => <Skeleton key={key} className="h-80 rounded-2xl" />)
                  ) : sector?.status === "unavailable" ? (
                    <div className="col-span-full rounded-2xl border border-dashed p-7">
                      <p className="text-sm text-muted-foreground">{title} 분야를 조회하지 못했습니다.</p>
                      <Button
                        className="mt-3"
                        variant="outline"
                        size="sm"
                        onClick={() => void query.refetch()}
                      >
                        다시 불러오기
                      </Button>
                    </div>
                  ) : !sector?.fields.length ? (
                    <p className="col-span-full rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      공식 분야가 확인된 {title} 계약을 찾지 못했습니다.
                    </p>
                  ) : (
                    sector.fields.map((field) => {
                      const params = new URLSearchParams({
                        fromYear: String(query.data!.year),
                        toYear: String(query.data!.year),
                        workType,
                        field: field.field_code,
                      });
                      return (
                        <article
                          key={field.field_code}
                          className="overflow-hidden rounded-2xl border bg-card"
                        >
                          <div className="border-b bg-muted/20 p-5">
                            <p className="text-xs font-medium text-primary">
                              {field.selection_basis === "supplier_official_field"
                                ? "대형 계약업체의 공식 물품 분야"
                                : "대형 계약이 확인된 분야"}
                            </p>
                            <Link
                              className="mt-2 inline-flex items-center gap-2 text-lg font-bold hover:text-primary"
                              to={`/companies?q=${encodeURIComponent(field.field_name)}`}
                            >
                              {field.field_name}
                              <ArrowUpRight className="size-4 shrink-0" />
                            </Link>
                            {field.selection_basis !== "supplier_official_field" && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                조회된 대표 계약{" "}
                                {field.representative_contract_amount == null
                                  ? "금액 확인 필요"
                                  : formatCompactMoney(field.representative_contract_amount)}
                              </p>
                            )}
                          </div>
                          <div className="p-5">
                            <p className="mb-4 text-xs text-muted-foreground">
                              해당 분야의 주요 실적 업체 · 업체 귀속 계약금액순
                            </p>
                            {field.status === "unavailable" ? (
                              <p className="py-5 text-sm text-muted-foreground">
                                업체 실적을 조회하지 못했습니다.
                              </p>
                            ) : field.companies.length === 0 ? (
                              <p className="py-5 text-sm text-muted-foreground">
                                확인된 업체 실적이 없습니다.
                              </p>
                            ) : (
                              <div className="space-y-5">
                                {field.companies.map((company, index) => (
                                  <div
                                    key={company.business_registration_number}
                                    className="border-b pb-5 last:border-0 last:pb-0"
                                  >
                                    <div className="flex items-start gap-3">
                                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                                        {index + 1}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <Link
                                          to={entityDetailPath(
                                            "company",
                                            company.business_registration_number,
                                            { source: "relationship", params, name: company.name },
                                          )}
                                          className="inline-flex items-center gap-1 text-sm font-bold hover:text-primary"
                                        >
                                          {company.name}
                                          <ArrowUpRight className="size-3.5 shrink-0" />
                                        </Link>
                                        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                                          <strong className="text-lg">
                                            {company.total_attributed_contract_amount == null
                                              ? "금액 확인 필요"
                                              : formatCompactMoney(company.total_attributed_contract_amount)}
                                          </strong>
                                          <span className="text-xs text-muted-foreground">
                                            {company.contract_event_count == null
                                              ? "건수 확인 필요"
                                              : `계약 ${company.contract_event_count.toLocaleString()}건`}
                                            {company.organization_count != null &&
                                              ` · 거래기관 ${company.organization_count}곳`}
                                          </span>
                                        </div>
                                        {company.major_organizations.length > 0 && (
                                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                            주요 거래기관 ·{" "}
                                            {company.major_organizations
                                              .map(
                                                (organization) =>
                                                  organization.organization_name ?? "기관명 확인 필요",
                                              )
                                              .join(" · ")}
                                          </p>
                                        )}
                                        {company.amount_completeness !== "complete" && (
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            금액 정보 일부 또는 미확인
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {field.partial && (
                              <p className="mt-4 text-xs text-amber-700 dark:text-amber-300">
                                일부 업체 또는 계약 정보를 확인하지 못했습니다.
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {query.data?.snapshot_updated_at && (
        <p className="mt-5 text-xs text-muted-foreground">
          목록 갱신{" "}
          {formatKoreanDate(
            query.data.snapshot_updated_at,
            { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" },
            "시각 확인 필요",
          )}{" "}
          · 백그라운드에서 주기적으로 갱신됩니다.
        </p>
      )}
      <p className="mt-7 text-xs leading-5 text-muted-foreground">
        직전 완료 연도의 유형별 금액순 계약 최대 100건에서 공식 분류가 있는 분야 2개를 선택합니다. 물품 계약에
        분류가 없으면 대형 계약업체의 공식 물품 분야를 사용합니다. 후보 업체 최대 3곳의 분야별 연간 실적을
        비교하며, 전체 시장의 분야 규모나 업체 순위는 아닙니다.
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        계약 건수는 최초 계약일, 금액은 조회 종료일 현재 최신 업체 귀속 계약금액 기준입니다. 공동수급 전체
        금액을 업체마다 중복 합산하지 않습니다.
      </p>
    </section>
  );
}
