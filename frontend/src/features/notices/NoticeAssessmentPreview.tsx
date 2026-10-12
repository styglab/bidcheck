import { Badge } from "@/components/ui/badge";
import type { AssessmentPreview } from "./api";
import { assessmentLabel, previewSummary } from "./assessment-presentation";

export function NoticeAssessmentPreview({
  item,
  loading,
  failed,
}: {
  item?: AssessmentPreview;
  loading: boolean;
  failed: boolean;
}) {
  if (loading)
    return (
      <p role="status" className="mt-2 text-xs text-muted-foreground">
        회사 기준 분석 중
      </p>
    );
  if (failed || !item)
    return <p className="mt-2 text-xs text-muted-foreground">회사 기준 분석 실패 · 확인 필요</p>;
  return (
    <div className="mt-2 space-y-1 text-xs" aria-label="회사 기준 검토 결과">
      <Badge variant="secondary">{previewSummary(item)}</Badge>
      {item.status === "completed" && (
        <p className="text-muted-foreground">
          충족 {item.satisfied_count ?? "-"} · 미충족 {item.unsatisfied_count ?? "-"} · 확인 필요{" "}
          {item.needs_review_count ?? "-"}
        </p>
      )}
      {item.issues?.slice(0, 2).map((issue, index) => (
        <p key={index}>
          {issue.summary ?? "요건 확인 필요"} · {assessmentLabel(issue.outcome)}
        </p>
      ))}
    </div>
  );
}
