import { formatKoreanDate } from "@/shared/format/date";
import type { AssessmentOutcome, AssessmentPreview } from "./api";

export const assessmentLabels: Record<AssessmentOutcome, string> = {
  satisfied: "충족",
  unsatisfied: "미충족",
  needs_review: "확인 필요",
};

export function assessmentLabel(value: unknown) {
  return typeof value === "string" && value in assessmentLabels
    ? assessmentLabels[value as AssessmentOutcome]
    : "확인 필요";
}

export function assessmentErrorLabel(code?: string) {
  if (code === "bid_requirements_not_found") return "참가요건 추출 전";
  if (code === "bid_notice_not_found") return "공고 확인 필요";
  return "평가 오류 · 확인 필요";
}

export function previewSummary(item: AssessmentPreview) {
  if (item.status === "error") return assessmentErrorLabel(item.error_code);
  if (item.outcome === "satisfied") return "주요요건 충족";
  if (item.outcome === "unsatisfied") return "명확한 미충족 있음";
  return "확인 필요";
}

export function assessmentText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

export function assessmentLifecycleLabel(value: unknown) {
  if (value === "completed") return "평가 완료";
  if (value === "review_required") return "추가 검토 필요";
  if (value === "failed") return "평가 실행 실패";
  return "평가 상태 확인 필요";
}

export function assessmentLookupTime(timestamp: number) {
  return timestamp > 0 && Number.isFinite(timestamp)
    ? formatKoreanDate(
        new Date(timestamp).toISOString(),
        {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        },
        "확인 필요",
      )
    : "확인 필요";
}
