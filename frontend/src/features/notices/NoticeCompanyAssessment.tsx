import { AssessmentEvidenceList } from "./AssessmentEvidenceList";
import { Link } from "react-router-dom";
import { EntityDetailSection } from "@/components/common/entity-detail-section";
import { SectionError } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/features/company-context/useCompany";
import { CompanySelector } from "@/features/company-context/CompanySelector";
import { useAssessment, type Requirement } from "./api";
import {
  assessmentLabel,
  assessmentText,
  assessmentLifecycleLabel,
  assessmentLookupTime,
} from "./assessment-presentation";

export function NoticeCompanyAssessment({
  noticeId,
  requirements,
}: {
  noticeId: string;
  requirements: Requirement[];
}) {
  const { currentCompany } = useCompany();
  const query = useAssessment(noticeId, currentCompany?.businessNumber);
  const overall = query.data?.assessment;
  const canShowOutcomes =
    overall?.lifecycle_status === "completed" || overall?.lifecycle_status === "review_required";
  const evidenceById = new Map((query.data?.evidence ?? []).map((item) => [item.id, item]));
  const linkedEvidenceIds = new Set(
    query.data?.requirement_assessments.flatMap((item) => item.evidence_ids ?? []),
  );
  const unlinkedEvidence = (query.data?.evidence ?? []).filter((item) => !linkedEvidenceIds.has(item.id));
  const versionFields = [
    ["ruleset_version", "판정 규칙 버전"],
    ["requirement_set_hash", "평가 요건 집합 해시"],
    ["evidence_fingerprint", "판정 근거 지문"],
  ] as const;
  const versions = versionFields.flatMap(([key, label]) => {
    const value = assessmentText(overall?.[key]);
    return value ? [{ label, value }] : [];
  });
  const requirementsById = new Map<string, Requirement>();
  for (const item of requirements) {
    requirementsById.set(item.id, item);
    if (item.local_id) requirementsById.set(item.local_id, item);
  }

  return (
    <EntityDetailSection
      className="order-2"
      title="회사 기준 검토"
      description="공고 요구사항과 선택한 회사의 정보를 비교합니다."
    >
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {currentCompany ? `${currentCompany.name} 기준` : "회사를 적용하면 참가요건을 비교할 수 있습니다."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {currentCompany && (
            <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => query.refetch()}>
              다시 평가
            </Button>
          )}
          <CompanySelector mode={currentCompany ? "change" : "apply"} />
        </div>
      </div>
      {currentCompany && query.data && !query.isError && (
        <p className="mt-3 text-xs text-muted-foreground">
          조회 시각: {assessmentLookupTime(query.dataUpdatedAt)} (한국 시간)
          {query.isStale && !query.isFetching ? " · 마지막 조회 후 1분이 지났습니다." : ""}
        </p>
      )}
      {currentCompany && query.isFetching && !query.isLoading && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          평가 갱신 중 · 이전 조회 결과를 표시하고 있습니다.
        </p>
      )}
      {!currentCompany ? (
        <Button asChild variant="outline" className="mt-3">
          <Link
            to={`/company/setup?returnTo=${encodeURIComponent(`/notices/${encodeURIComponent(noticeId)}`)}`}
          >
            회사 프로필 만들기
          </Link>
        </Button>
      ) : query.isLoading ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          회사 기준 분석 중
        </p>
      ) : query.isError ? (
        <div className="mt-4">
          <SectionError title="회사 기준 분석" error={query.error} onRetry={() => query.refetch()} />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary" aria-label="종합 판정">
              {canShowOutcomes ? assessmentLabel(overall?.outcome) : "확인 필요"}
            </Badge>
            <Badge variant="outline">{assessmentLifecycleLabel(overall?.lifecycle_status)}</Badge>
            {canShowOutcomes && (
              <span>
                충족 {overall?.satisfied_count ?? "-"} · 미충족 {overall?.unsatisfied_count ?? "-"} · 확인
                필요 {overall?.needs_review_count ?? "-"}
              </span>
            )}
          </div>
          {!canShowOutcomes && (
            <p className="text-sm text-muted-foreground">
              평가 실행 상태를 확인할 수 있어야 종합·요건별 판정을 표시할 수 있습니다. 다시 평가해 주세요.
            </p>
          )}
          <details className="rounded-xl border p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">평가 기준·버전</summary>
            <dl className="mt-2 space-y-1">
              <div>
                <dt className="inline">평가 기준일: </dt>
                <dd className="inline">{assessmentText(overall?.reference_date) ?? "확인 필요"}</dd>
              </div>
              <div>
                <dt className="inline">Registry 버전: </dt>
                <dd className="inline">
                  {assessmentText(overall?.registry_version) ?? query.data?.registry_version ?? "확인 필요"}
                </dd>
              </div>
              {versions.map(({ label, value }) => (
                <div key={label}>
                  <dt className="inline">{label}: </dt>
                  <dd className="inline break-all">{value}</dd>
                </div>
              ))}
              {!versions.length && <div>평가 규칙 정보: 확인 필요</div>}
            </dl>
          </details>
          <div className="divide-y rounded-xl border">
            {canShowOutcomes &&
              query.data?.requirement_assessments.map((item) => {
                const requirement = item.requirement_id
                  ? requirementsById.get(item.requirement_id)
                  : undefined;
                const evidence = (item.evidence_ids ?? []).flatMap((id) => {
                  const value = evidenceById.get(id);
                  return value ? [value] : [];
                });
                return (
                  <article
                    className="space-y-2 p-4 text-sm"
                    key={item.id}
                    aria-label={requirement?.title ?? "참가요건 검토"}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <strong>{requirement?.title ?? "참가요건 검토"}</strong>
                      <Badge variant="secondary" aria-label="요건 판정">
                        {assessmentLabel(item.outcome)}
                      </Badge>
                    </div>
                    {item.required_value_text && <p>공고 요구값: {item.required_value_text}</p>}
                    {requirement?.original_text && <p>공고 요구사항: {requirement.original_text}</p>}
                    {(item.evaluated_value_text ?? assessmentText(item.observed_value)) && (
                      <p>회사 확인값: {item.evaluated_value_text ?? assessmentText(item.observed_value)}</p>
                    )}
                    <p className="text-muted-foreground">
                      {item.assessment_summary ??
                        item.reasoning_summary ??
                        item.summary ??
                        "판정 근거 확인 필요"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      평가기 버전: {item.evaluator_version ?? "확인 필요"}
                      {item.evaluated_at ? ` · 평가시각 ${item.evaluated_at}` : ""}
                    </p>
                    {evidence.length ? (
                      <details className="rounded-lg border p-3">
                        <summary className="cursor-pointer font-medium">
                          판정 근거 ({evidence.length}건)
                        </summary>
                        <AssessmentEvidenceList evidence={evidence} />
                      </details>
                    ) : (
                      <p className="text-xs text-muted-foreground">연결된 판정 근거 확인 필요</p>
                    )}
                  </article>
                );
              })}
          </div>
          {canShowOutcomes && !query.data?.requirement_assessments.length && (
            <p className="text-sm text-muted-foreground">요건별 평가 결과 확인 필요</p>
          )}
          {unlinkedEvidence.length > 0 && (
            <details className="rounded-xl border p-4 text-sm">
              <summary className="cursor-pointer font-medium">
                요건 연결 확인이 필요한 근거 ({unlinkedEvidence.length}건)
              </summary>
              <AssessmentEvidenceList evidence={unlinkedEvidence} />
            </details>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        최종 참가 조건과 증빙은 공고 원문을 함께 확인해 주세요.
      </p>
    </EntityDetailSection>
  );
}
