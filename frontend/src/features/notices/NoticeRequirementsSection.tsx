import { EntityDetailSection } from "@/components/common/entity-detail-section";
import { Badge } from "@/components/ui/badge";
import type { Requirement, RequirementExpression } from "./api";

export function NoticeRequirementsSection({
  requirements,
  regionApplicability,
  expression,
}: {
  requirements: Requirement[];
  expression?: RequirementExpression;
  regionApplicability?: { applicability?: string; completeness?: string };
}) {
  const region = requirements.filter((item) => ["region", "participation_region"].includes(item.type));
  const industries = requirements.filter(
    (item) => ["industry", "license", "industry_license"].includes(item.type) || item.industry_code,
  );

  return (
    <EntityDetailSection
      className="order-1 scroll-mt-[calc(var(--site-header-height,70px)+4.5rem)]"
      sectionId="participation-requirements"
      title="참가 조건"
      description="공고에서 확인된 입찰 참가자격입니다."
    >
      <div className="mt-5 overflow-hidden rounded-xl border bg-card">
        <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5 border-b">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">지역</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {region.length ? (
                region.map((item) => (
                  <Badge className="border-0" key={item.id} variant="secondary">
                    {item.title}
                  </Badge>
                ))
              ) : (
                <span className="text-sm">
                  {regionApplicability?.applicability === "not_applicable" ||
                  regionApplicability?.completeness === "complete"
                    ? "제한 없음"
                    : "확인 필요"}
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">업종·면허</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {industries.length ? (
                industries.map((item) => (
                  <Badge
                    className="border-0 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                    key={item.id}
                  >
                    {item.title}
                    {item.industry_code ? ` ${item.industry_code}` : ""}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">확인된 조건 없음</span>
              )}
            </div>
          </div>
        </div>
        {requirements.length > 0 && (
          <details className="p-4 sm:p-5">
            <summary className="cursor-pointer text-sm font-semibold">
              전체 참가요건 ({requirements.length}개)
            </summary>
            <div className="divide-y">
              {requirements.map((item) => (
                <div
                  className="grid gap-2 p-4 text-sm sm:grid-cols-[minmax(10rem,14rem)_auto_minmax(0,1fr)] sm:p-5"
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
          </details>
        )}
        {!requirements.length && (
          <p className="p-5 text-sm text-muted-foreground">구조화된 참가 조건이 아직 확인되지 않았습니다.</p>
        )}
      </div>
      {requirements.length > 0 && (
        <div className="mt-4 rounded-xl border p-4 text-sm">
          <h3 className="font-semibold">참가요건 조건 관계</h3>
          {expression ? (
            <RequirementCondition expression={expression} requirements={requirements} />
          ) : (
            <p className="mt-2 text-muted-foreground">조건 간 관계는 확인이 필요합니다.</p>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">최종 참가 조건은 공고 원문을 함께 확인해 주세요.</p>
    </EntityDetailSection>
  );
}

function RequirementCondition({
  expression,
  requirements,
  depth = 0,
}: {
  expression: RequirementExpression;
  requirements: Requirement[];
  depth?: number;
}) {
  if (depth > 30 || !expression || typeof expression !== "object") {
    return <p className="mt-2 text-muted-foreground">조건 관계 확인 필요</p>;
  }
  if (expression.operator === "leaf") {
    const requirement =
      typeof expression.requirement_id === "string" && expression.requirement_id
        ? requirements.find(
            (item) => item.id === expression.requirement_id || item.local_id === expression.requirement_id,
          )
        : undefined;
    return (
      <p className="mt-2">
        {requirement ? `요건: ${requirement.title || "제목 없음"}` : "참조된 요건 확인 필요"}
      </p>
    );
  }
  const labels = {
    all: "다음 조건을 모두 충족",
    any: "다음 조건 중 하나 이상 충족",
    not: "다음 조건에 해당하지 않아야 함",
  };
  const label =
    expression.operator === "all" || expression.operator === "any" || expression.operator === "not"
      ? labels[expression.operator]
      : undefined;
  const children = expression.conditions;
  if (
    !label ||
    !Array.isArray(children) ||
    !children.length ||
    (expression.operator === "not" && children.length !== 1)
  ) {
    return <p className="mt-2 text-muted-foreground">조건 관계 확인 필요</p>;
  }
  return (
    <div className="mt-2">
      <p className="font-medium">{label}</p>
      <ul className="ml-3 border-l pl-3">
        {children.map((child, index) => (
          <li key={index}>
            <RequirementCondition expression={child} requirements={requirements} depth={depth + 1} />
          </li>
        ))}
      </ul>
    </div>
  );
}
