import { EntityDetailSection } from "@/components/common/entity-detail-section";
import { Badge } from "@/components/ui/badge";
import type { Requirement } from "./api";

export function NoticeRequirementsSection({
  requirements,
  regionApplicability,
}: {
  requirements: Requirement[];
  regionApplicability?: { applicability?: string; completeness?: string };
}) {
  const region = requirements.filter((item) => ["region", "participation_region"].includes(item.type));
  const industries = requirements.filter(
    (item) => ["industry", "license", "industry_license"].includes(item.type) || item.industry_code,
  );
  const industrySummary = Array.from(
    new Map(industries.map((item) => [item.industry_code || item.title, item])).values(),
  );
  const summarizedIds = new Set([...region, ...industries].map((item) => item.id));
  const additionalRequirements = requirements.filter((item) => !summarizedIds.has(item.id));

  return (
    <EntityDetailSection
      className="order-1 scroll-mt-[calc(var(--site-header-height,70px)+4.5rem)]"
      sectionId="participation-requirements"
      title="참가 조건"
      description="공고에서 확인된 입찰 참가자격입니다."
    >
      <div className="mt-5 overflow-hidden rounded-xl border bg-card">
        <div
          className={`grid gap-5 p-4 sm:grid-cols-2 sm:p-5 ${additionalRequirements.length ? "border-b" : ""}`}
        >
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
              {industrySummary.length ? (
                industrySummary.map((item) => (
                  <Badge
                    className="border-0 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
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
          </div>
        </div>
        {additionalRequirements.length > 0 && (
          <div className="divide-y">
            {additionalRequirements.slice(0, 10).map((item) => (
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
        )}
        {!requirements.length && (
          <p className="p-5 text-sm text-muted-foreground">구조화된 참가 조건이 아직 확인되지 않았습니다.</p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">최종 참가 조건은 공고 원문을 함께 확인해 주세요.</p>
    </EntityDetailSection>
  );
}
